const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');

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

    // Mock data for now - in full implementation, this would query the database
    const apps = [
      {
        id: '1',
        name: 'Netflix',
        description: 'Streaming entertainment service',
        category: 'entertainment',
        icon: '/uploads/app-icons/netflix.png',
        packageName: 'com.netflix.mediaclient',
        url: 'https://play.google.com/store/apps/details?id=com.netflix.mediaclient',
        version: '8.0.0',
        isActive: true,
        assignedDevices: 12,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'YouTube',
        description: 'Video sharing platform',
        category: 'entertainment',
        icon: '/uploads/app-icons/youtube.png',
        packageName: 'com.google.android.youtube.tv',
        url: 'https://play.google.com/store/apps/details?id=com.google.android.youtube.tv',
        version: '2.0.0',
        isActive: true,
        assignedDevices: 15,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '3',
        name: 'Hotel Services',
        description: 'In-room services and information',
        category: 'utility',
        icon: '/uploads/app-icons/hotel-services.png',
        packageName: 'com.hotel.services',
        url: 'https://example.com/hotel-app.apk',
        version: '1.5.2',
        isActive: true,
        assignedDevices: 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Filter by category
    let filteredApps = apps;
    if (category) {
      filteredApps = apps.filter(app => app.category === category);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredApps = filteredApps.filter(app => 
        app.name.toLowerCase().includes(searchLower) ||
        app.description.toLowerCase().includes(searchLower) ||
        app.packageName.toLowerCase().includes(searchLower)
      );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedApps = filteredApps.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      success: true,
      data: {
        apps: paginatedApps,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredApps.length,
          pages: Math.ceil(filteredApps.length / limit)
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
  body('url').isURL()
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

    // Mock app creation - in full implementation, this would save to database
    const app = {
      id: `app-${Date.now()}`,
      name,
      description,
      category,
      packageName,
      url,
      version: version || '1.0.0',
      icon: iconPath,
      isActive: true,
      assignedDevices: 0,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

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

    // Mock assignment - in full implementation, this would update device configurations
    const assignments = [];

    if (deviceIds) {
      deviceIds.forEach(deviceId => {
        appIds.forEach((appId, index) => {
          assignments.push({
            type: 'device',
            targetId: deviceId,
            appId,
            position: position !== undefined ? position + index : index,
            assignedAt: new Date().toISOString()
          });
        });
      });
    }

    if (roomNumbers) {
      roomNumbers.forEach(roomNumber => {
        appIds.forEach((appId, index) => {
          assignments.push({
            type: 'room',
            targetId: roomNumber,
            appId,
            position: position !== undefined ? position + index : index,
            assignedAt: new Date().toISOString()
          });
        });
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

    // Mock app data - in full implementation, this would fetch from database
    const app = {
      id: appId,
      name: 'Mock App',
      url: 'https://play.google.com/store/apps/details?id=com.example.app',
      icon: '/uploads/app-icons/app.png'
    };

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
    // Mock categories - in full implementation, this could be configurable
    const categories = [
      { id: 'entertainment', name: 'Entertainment', appCount: 5 },
      { id: 'utility', name: 'Utilities', appCount: 3 },
      { id: 'communication', name: 'Communication', appCount: 2 },
      { id: 'productivity', name: 'Productivity', appCount: 1 },
      { id: 'games', name: 'Games', appCount: 4 },
      { id: 'lifestyle', name: 'Lifestyle', appCount: 2 }
    ];

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
    // Mock statistics - in full implementation, this would query the database
    const stats = {
      totalApps: 17,
      activeApps: 15,
      totalAssignments: 45,
      averageAppsPerDevice: 3.2,
      mostPopularApp: 'Netflix',
      recentInstalls: 8,
      installSuccessRate: '94.2%'
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
  body('url').optional().isURL(),
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

    // Mock update - in full implementation, this would update database
    const updatedApp = {
      id: appId,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    logger.info('App updated successfully', {
      userId: req.user.id,
      appId,
      updates: Object.keys(updates)
    });

    res.json({
      success: true,
      message: 'App updated successfully',
      data: { app: updatedApp }
    });

  } catch (error) {
    logger.error('Error updating app:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update app'
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

    // Mock deletion - in full implementation, this would delete from database
    logger.info('App deleted successfully', {
      userId: req.user.id,
      appId
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
