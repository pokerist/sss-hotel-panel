const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');
const App = require('../models/App');

const router = express.Router();

// Configure multer for app icon uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/app-icons/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type .${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size for icons
  }
});

// Get all apps with pagination
router.get('/', [
  authenticateToken,
  requireAdmin,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isString(),
  query('search').optional().isLength({ min: 1, max: 100 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { page = 1, limit = 20, category, search } = req.query;

        // Build query
        const query = {};
        if (category) query.category = category;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { packageName: { $regex: search, $options: 'i' } }
            ];
        }

        // For frontend compatibility - return all apps if no pagination params
        if (!req.query.page && !req.query.limit) {
            const apps = await App.find(query)
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 });
            return res.json(apps);
        }

        // Get paginated results
        const [apps, total] = await Promise.all([
            App.find(query)
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit)),
            App.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: {
                apps,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

  } catch (error) {
    logger.error('Error fetching apps:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch apps'
    });
  }
});

// Create new app
router.post('/', [
  authenticateToken,
  requireAdmin,
  logActivity('CREATE_APP'),
  upload.single('icon'),
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('category').isString(),
  body('packageName').optional().isString(),
  body('url').optional().custom((value) => {
    if (!value || value.trim() === '') return true;
    try {
      new URL(value);
      return true;
    } catch {
      throw new Error('Invalid URL format');
    }
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description, category, packageName, url, version } = req.body;
    const iconPath = req.file ? `/uploads/app-icons/${req.file.filename}` : null;

    // Check if packageName already exists
    if (packageName) {
      const existingApp = await App.findByPackageName(packageName);
      if (existingApp) {
        return res.status(409).json({
          success: false,
          message: 'An app with this package name already exists'
        });
      }
    }

    const app = new App({
      name,
      description,
      category,
      packageName,
      url,
      version: version || '1.0.0',
      icon: iconPath,
      createdBy: req.user.id
    });

    await app.save();

    logger.info('App created successfully', {
      userId: req.user.id,
      appId: app.id,
      appName: name,
      category,
      hasIcon: !!iconPath
    });

    res.status(201).json({
      success: true,
      message: 'App created successfully',
      data: { app }
    });

  } catch (error) {
    logger.error('App creation error:', error);
    res.status(500).json({
      success: false,
      message: 'App creation failed'
    });
  }
});

// Assign apps to devices/rooms
router.post('/assign', [
  authenticateToken,
  requireAdmin,
  logActivity('ASSIGN_APPS'),
  body('appIds').isArray().notEmpty(),
  body('deviceIds').optional().isArray(),
  body('roomNumbers').optional().isArray(),
  body('position').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { appIds, deviceIds, roomNumbers, position } = req.body;

    if (!deviceIds && !roomNumbers) {
      return res.status(400).json({
        success: false,
        message: 'Either deviceIds or roomNumbers must be provided'
      });
    }

    // Verify all apps exist
    const apps = await App.find({ _id: { $in: appIds } });
    if (apps.length !== appIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some apps were not found'
      });
    }

    const Device = require('../models/Device');
    const assignments = [];

    if (deviceIds) {
      // Find devices and verify they exist
      const devices = await Device.find({ _id: { $in: deviceIds } });
      if (devices.length !== deviceIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some devices were not found'
        });
      }

      // Update each device's app layout
      for (const device of devices) {
        device.configuration = device.configuration || {};
        device.configuration.appLayout = appIds.map((appId, index) => ({
          appId,
          position: position !== undefined ? position + index : index,
          isVisible: true
        }));
        await device.save();

        assignments.push({
          type: 'device',
          targetId: device.id,
          appIds,
          assignedAt: new Date().toISOString()
        });
      }
    }

    if (roomNumbers) {
      // Find devices by room numbers
      const devices = await Device.find({ roomNumber: { $in: roomNumbers } });
      const foundRooms = devices.map(d => d.roomNumber);
      const missingRooms = roomNumbers.filter(r => !foundRooms.includes(r));
      
      if (missingRooms.length > 0) {
        return res.status(400).json({
          success: false,
          message: `No devices found for rooms: ${missingRooms.join(', ')}`
        });
      }

      // Update each device's app layout
      for (const device of devices) {
        device.configuration = device.configuration || {};
        device.configuration.appLayout = appIds.map((appId, index) => ({
          appId,
          position: position !== undefined ? position + index : index,
          isVisible: true
        }));
        await device.save();

        assignments.push({
          type: 'room',
          targetId: device.roomNumber,
          appIds,
          assignedAt: new Date().toISOString()
        });
      }
    }

    // Emit real-time event
    if (global.io) {
      global.io.to('admin:apps').emit('app:assignments-updated', {
        assignments,
        assignedBy: req.user.name,
        timestamp: new Date().toISOString()
      });

      // Notify affected devices
      if (deviceIds) {
        deviceIds.forEach(deviceId => {
          global.io.emit(`device:${deviceId}`, {
            type: 'APPS_ASSIGNED',
            appIds,
            timestamp: new Date().toISOString()
          });
        });
      }
    }

    logger.info('Apps assigned successfully', {
      userId: req.user.id,
      appCount: appIds.length,
      deviceCount: deviceIds?.length || 0,
      roomCount: roomNumbers?.length || 0
    });

    res.json({
      success: true,
      message: 'Apps assigned successfully',
      data: { assignments }
    });

  } catch (error) {
    logger.error('Error assigning apps:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign apps'
    });
  }
});

// Bulk assign apps (frontend compatibility)
router.post('/bulk-assign', [
  authenticateToken,
  requireAdmin,
  logActivity('BULK_ASSIGN_APPS'),
  body('apps').isArray().notEmpty(),
  body('devices').isArray().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { apps: appIds, devices: deviceIds } = req.body;

    // Verify all apps exist
    const apps = await App.find({ _id: { $in: appIds } });
    if (apps.length !== appIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some apps were not found'
      });
    }

    // Find devices and verify they exist
    const Device = require('../models/Device');
    const devices = await Device.find({ _id: { $in: deviceIds } });
    if (devices.length !== deviceIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some devices were not found'
      });
    }

    const assignments = [];

    // Update each device's app layout
    for (const device of devices) {
      device.configuration = device.configuration || {};
      device.configuration.appLayout = appIds.map((appId, index) => ({
        appId,
        position: index,
        isVisible: true
      }));
      await device.save();

      assignments.push({
        type: 'device',
        targetId: device.id,
        appIds,
        assignedAt: new Date().toISOString()
      });
    }

    // Emit real-time event
    if (global.io) {
      global.io.to('admin:apps').emit('app:assignments-updated', {
        assignments,
        assignedBy: req.user.name,
        timestamp: new Date().toISOString()
      });

      // Notify affected devices
      devices.forEach(deviceId => {
        global.io.emit(`device:${deviceId}`, {
          type: 'APPS_ASSIGNED',
          appIds: apps,
          timestamp: new Date().toISOString()
        });
      });
    }

    logger.info('Apps bulk assigned successfully', {
      userId: req.user.id,
      appCount: apps.length,
      deviceCount: devices.length
    });

    res.json({
      success: true,
      message: 'Apps assigned successfully',
      data: { assignments }
    });

  } catch (error) {
    logger.error('Error bulk assigning apps:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign apps'
    });
  }
});

// Trigger app installation on devices
router.post('/:appId/install', [
  authenticateToken,
  requireAdmin,
  logActivity('TRIGGER_APP_INSTALL'),
  body('deviceIds').isArray().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { appId } = req.params;
    const { deviceIds } = req.body;

    const app = await App.findById(appId);
    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    // Verify devices exist and are approved
    const Device = require('../models/Device');
    const devices = await Device.find({
      _id: { $in: deviceIds },
      status: 'approved'
    });

    if (devices.length !== deviceIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some devices were not found or are not approved'
      });
    }

    const installRequests = [];

    // Send install command to each device
    deviceIds.forEach(deviceId => {
      if (global.io) {
        global.io.emit(`device:${deviceId}`, {
          type: 'INSTALL_APP',
          app: {
            id: app.id,
            name: app.name,
            url: app.url,
            icon: app.icon
          },
          requestedBy: req.user.name,
          timestamp: new Date().toISOString()
        });
      }

      installRequests.push({
        deviceId,
        appId,
        status: 'requested',
        requestedAt: new Date().toISOString()
      });
    });

    logger.info('App installation triggered', {
      userId: req.user.id,
      appId,
      deviceCount: deviceIds.length
    });

    res.json({
      success: true,
      message: 'App installation requests sent',
      data: {
        installRequests,
        summary: {
          appId,
          deviceCount: deviceIds.length,
          requestedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    logger.error('Error triggering app installation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger app installation'
    });
  }
});

// Get app categories
router.get('/categories', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    // Get categories with app counts
    const categoryCounts = await App.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const categories = categoryCounts.map(cat => ({
      id: cat._id,
      name: cat._id.charAt(0).toUpperCase() + cat._id.slice(1), // Capitalize first letter
      appCount: cat.count
    }));

    res.json({
      success: true,
      data: { categories }
    });

  } catch (error) {
    logger.error('Error fetching app categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch app categories'
    });
  }
});

// Get app statistics
router.get('/stats/overview', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const Device = require('../models/Device');

    // Get app statistics
    const [
      totalApps,
      activeApps,
      devices,
      mostAssignedApp
    ] = await Promise.all([
      App.countDocuments(),
      App.countDocuments({ isActive: true }),
      Device.find({ 'configuration.appLayout': { $exists: true } }),
      Device.aggregate([
        { $unwind: '$configuration.appLayout' },
        { $group: { _id: '$configuration.appLayout.appId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
        { $lookup: { from: 'apps', localField: '_id', foreignField: '_id', as: 'app' } }
      ])
    ]);

    // Calculate total assignments and average apps per device
    const totalAssignments = devices.reduce((sum, device) => 
      sum + (device.configuration?.appLayout?.length || 0), 0);
    
    const averageAppsPerDevice = devices.length > 0 
      ? (totalAssignments / devices.length).toFixed(1)
      : 0;

    const stats = {
      totalApps,
      activeApps,
      totalAssignments,
      averageAppsPerDevice,
      mostPopularApp: mostAssignedApp[0]?.app[0]?.name || 'None',
      deviceCount: devices.length
    };

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    logger.error('Error fetching app statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch app statistics'
    });
  }
});

// Update app
router.put('/:appId', [
  authenticateToken,
  requireAdmin,
  logActivity('UPDATE_APP'),
  upload.single('icon'),
  body('name').optional().isString().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('category').optional().isString(),
  body('url').optional().custom((value) => {
    if (!value || value.trim() === '') return true;
    try {
      new URL(value);
      return true;
    } catch {
      throw new Error('Invalid URL format');
    }
  }),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { appId } = req.params;
    const updates = req.body;

    if (req.file) {
      updates.icon = `/uploads/app-icons/${req.file.filename}`;
    }

    const app = await App.findById(appId);
    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    // Check packageName uniqueness if being updated
    if (updates.packageName && updates.packageName !== app.packageName) {
      const existingApp = await App.findByPackageName(updates.packageName);
      if (existingApp) {
        return res.status(409).json({
          success: false,
          message: 'An app with this package name already exists'
        });
      }
    }

    Object.assign(app, updates);
    await app.save();

    logger.info('App updated successfully', {
      userId: req.user.id,
      appId,
      updates: Object.keys(updates)
    });

    res.json({
      success: true,
      message: 'App updated successfully',
      data: { app }
    });

  } catch (error) {
    logger.error('Error updating app:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update app'
    });
  }
});

// Get device assignments (for frontend AppsPage)
router.get('/device-assignments', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const Device = require('../models/Device');
    const devices = await Device.find({
      status: 'approved'
    }).populate('configuration.appLayout.appId', 'name');

    // Transform to the format expected by frontend
    const deviceApps = {};
    devices.forEach(device => {
      if (device.configuration && device.configuration.appLayout) {
        deviceApps[device.id] = device.configuration.appLayout.map(app => ({
          app_id: app.appId._id,
          name: app.appId.name,
          order: app.position
        }));
      } else {
        deviceApps[device.id] = [];
      }
    });

    res.json(deviceApps);

  } catch (error) {
    logger.error('Error fetching device assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device assignments'
    });
  }
});

// Reorder apps for a device
router.post('/reorder/:deviceId', [
  authenticateToken,
  requireAdmin,
  logActivity('REORDER_APPS'),
  body('apps').isArray().notEmpty(),
  body('apps.*.app_id').isString(),
  body('apps.*.order').isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { deviceId } = req.params;
    const { apps } = req.body;

    const Device = require('../models/Device');
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Verify all apps exist
    const appIds = apps.map(app => app.app_id);
    const existingApps = await App.find({ _id: { $in: appIds } });
    if (existingApps.length !== appIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some apps were not found'
      });
    }

    // Update app layout
    device.configuration = device.configuration || {};
    device.configuration.appLayout = apps.map((app, index) => ({
      appId: app.app_id,
      position: app.order || index,
      isVisible: true
    }));

    await device.save();

    const updatedAssignments = device.configuration.appLayout.map(app => ({
      deviceId,
      appId: app.appId,
      order: app.position,
      updatedAt: new Date().toISOString()
    }));

    // Emit real-time event
    if (global.io) {
      global.io.to('admin:apps').emit('app:order-updated', {
        deviceId,
        apps: updatedAssignments,
        updatedBy: req.user.name,
        timestamp: new Date().toISOString()
      });

      // Notify the specific device
      global.io.emit(`device:${deviceId}`, {
        type: 'APPS_REORDERED',
        apps: updatedAssignments,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Apps reordered successfully', {
      userId: req.user.id,
      deviceId,
      appCount: apps.length
    });

    res.json({
      success: true,
      message: 'App order updated successfully',
      data: { assignments: updatedAssignments }
    });

  } catch (error) {
    logger.error('Error reordering apps:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reorder apps'
    });
  }
});

// Delete app
router.delete('/:appId', [
  authenticateToken,
  requireAdmin,
  logActivity('DELETE_APP')
], async (req, res) => {
  try {
    const { appId } = req.params;

    const app = await App.findById(appId);
    if (!app) {
      return res.status(404).json({
        success: false,
        message: 'App not found'
      });
    }

    // Remove app from all devices that have it assigned
    const Device = require('../models/Device');
    await Device.updateMany(
      { 'configuration.appLayout.appId': appId },
      { $pull: { 'configuration.appLayout': { appId: appId } } }
    );

    // Delete the app
    await app.deleteOne();

    logger.info('App deleted successfully', {
      userId: req.user.id,
      appId,
      appName: app.name
    });

    res.json({
      success: true,
      message: 'App deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting app:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete app'
    });
  }
});

module.exports = router;
