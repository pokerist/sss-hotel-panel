const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, query, validationResult } = require('express-validator');
const Settings = require('../models/Settings');
const User = require('../models/User');
const { authenticateToken, requireSuperAdmin, requireAdmin, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/branding/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
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
    fileSize: 5 * 1024 * 1024 // 5MB max file size for logos
  }
});

// Get all editable settings (Admin access)
router.get('/', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
    try {
        const settings = await Settings.getAllEditable();
        const settingsObject = {};
        
        settings.forEach(setting => {
            settingsObject[setting.key] = setting.value;
        });

        res.json(settingsObject);

  } catch (error) {
    logger.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
});

// Get settings by category (Admin access)
router.get('/category/:category', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { category } = req.params;
    
    const validCategories = ['system', 'pms', 'branding', 'security', 'logging'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category'
      });
    }

    const settings = await Settings.getByCategory(category);

    res.json({
      success: true,
      data: { settings }
    });

  } catch (error) {
    logger.error('Error fetching settings by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
});

// Update single setting (Frontend compatible)
router.put('/', [
  authenticateToken,
  requireAdmin,
  logActivity('UPDATE_SETTING'),
  body('key').isString().notEmpty(),
  body('value').exists()
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

    const { key, value } = req.body;
    
    // Special permission checks for certain settings
    if (key === 'pms_base_url' || key === 'pms_endpoints') {
      if (!req.user.hasPermission('canConfigurePMS')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to modify PMS settings'
        });
      }
    }

    if (key === 'panel_name') {
      if (!req.user.hasPermission('canChangeBranding')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to modify branding settings'
        });
      }
    }

    const updatedSetting = await Settings.set(key, value, req.user.id);

    // Emit setting change event for real-time updates
    if (global.io) {
      global.io.to('admin:settings').emit('setting:updated', {
        key,
        value,
        updatedBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Setting updated: ${key}`, {
      userId: req.user.id,
      oldValue: updatedSetting.value !== value ? 'CHANGED' : 'SAME',
      newValue: updatedSetting.isSecret ? '***HIDDEN***' : value
    });

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: {
        setting: updatedSetting
      }
    });

  } catch (error) {
    logger.error('Error updating setting:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    if (error.message.includes('not editable')) {
      return res.status(403).json({
        success: false,
        message: 'Setting is not editable'
      });
    }

    if (error.message.includes('validation') || error.message.includes('must be')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update setting'
    });
  }
});

// Get specific setting value
router.get('/:key', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { key } = req.params;
    
    const value = await Settings.get(key);
    
    if (value === null) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    res.json({
      success: true,
      data: {
        key,
        value
      }
    });

  } catch (error) {
    logger.error('Error fetching setting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch setting'
    });
  }
});

// Update specific setting by key parameter
router.put('/:key', [
  authenticateToken,
  requireAdmin,
  logActivity('UPDATE_SETTING'),
  body('value').exists()
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

    const { key } = req.params;
    const { value } = req.body;
    
    // Special permission checks for certain settings
    if (key === 'pms_base_url' || key === 'pms_endpoints') {
      if (!req.user.hasPermission('canConfigurePMS')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to modify PMS settings'
        });
      }
    }

    if (key === 'panel_name') {
      if (!req.user.hasPermission('canChangeBranding')) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to modify branding settings'
        });
      }
    }

    const updatedSetting = await Settings.set(key, value, req.user.id);

    // Emit setting change event for real-time updates
    if (global.io) {
      global.io.to('admin:settings').emit('setting:updated', {
        key,
        value,
        updatedBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Setting updated: ${key}`, {
      userId: req.user.id,
      oldValue: updatedSetting.value !== value ? 'CHANGED' : 'SAME',
      newValue: updatedSetting.isSecret ? '***HIDDEN***' : value
    });

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: {
        setting: updatedSetting
      }
    });

  } catch (error) {
    logger.error('Error updating setting:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    if (error.message.includes('not editable')) {
      return res.status(403).json({
        success: false,
        message: 'Setting is not editable'
      });
    }

    if (error.message.includes('validation') || error.message.includes('must be')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update setting'
    });
  }
});

// Update multiple settings at once (when body contains settings array)
router.put('/bulk', [
  authenticateToken,
  requireAdmin,
  logActivity('UPDATE_MULTIPLE_SETTINGS'),
  body('settings').isArray().notEmpty(),
  body('settings.*.key').isString().notEmpty(),
  body('settings.*.value').exists()
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

    const { settings } = req.body;
    const results = [];
    const failures = [];

    for (const { key, value } of settings) {
      try {
        // Permission checks
        if ((key === 'pms_base_url' || key === 'pms_endpoints') && 
            !req.user.hasPermission('canConfigurePMS')) {
          failures.push({
            key,
            error: 'Insufficient permissions to modify PMS settings'
          });
          continue;
        }

        if (key === 'panel_name' && !req.user.hasPermission('canChangeBranding')) {
          failures.push({
            key,
            error: 'Insufficient permissions to modify branding settings'
          });
          continue;
        }

        const updatedSetting = await Settings.set(key, value, req.user.id);
        results.push({
          key,
          status: 'success',
          setting: updatedSetting
        });

        // Emit individual setting change events
        if (global.io) {
          global.io.to('admin:settings').emit('setting:updated', {
            key,
            value: updatedSetting.isSecret ? '***HIDDEN***' : value,
            updatedBy: req.user.name,
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        failures.push({
          key,
          error: error.message
        });
      }
    }

    logger.info(`Bulk settings update completed`, {
      userId: req.user.id,
      successCount: results.length,
      failureCount: failures.length,
      settings: settings.map(s => s.key)
    });

    const response = {
      success: failures.length === 0,
      message: failures.length === 0 
        ? 'All settings updated successfully'
        : `${results.length} settings updated, ${failures.length} failed`,
      data: {
        updated: results,
        failed: failures,
        summary: {
          total: settings.length,
          successful: results.length,
          failed: failures.length
        }
      }
    };

    res.status(failures.length === 0 ? 200 : 207).json(response);

  } catch (error) {
    logger.error('Error updating multiple settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
});

// Reset setting to default value (Super Admin only)
router.post('/:key/reset', [
  authenticateToken,
  requireSuperAdmin,
  logActivity('RESET_SETTING')
], async (req, res) => {
  try {
    const { key } = req.params;
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    let setting;
    if (dbType === 'mongodb') {
      setting = await Settings.findOne({ key });
    } else {
      setting = await Settings.findOne({ where: { key } });
    }

    if (!setting) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    if (!setting.defaultValue) {
      return res.status(400).json({
        success: false,
        message: 'Setting has no default value'
      });
    }

    setting.resetToDefault();
    setting.updatedBy = req.user.id;
    await setting.save();

    if (global.io) {
      global.io.to('admin:settings').emit('setting:reset', {
        key,
        value: setting.isSecret ? '***HIDDEN***' : setting.value,
        resetBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Setting reset to default: ${key}`, {
      userId: req.user.id,
      defaultValue: setting.isSecret ? '***HIDDEN***' : setting.defaultValue
    });

    res.json({
      success: true,
      message: 'Setting reset to default value successfully',
      data: {
        setting: setting
      }
    });

  } catch (error) {
    logger.error('Error resetting setting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset setting'
    });
  }
});

// Get PMS polling interval (special endpoint for config watcher)
router.get('/pms/polling-interval', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const pollingInterval = await Settings.get('pms_polling_interval', 15);
    
    res.json({
      success: true,
      data: {
        pollingInterval,
        unit: 'minutes'
      }
    });

  } catch (error) {
    logger.error('Error fetching PMS polling interval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch PMS polling interval'
    });
  }
});

// Update PMS polling interval (special endpoint with validation)
router.put('/pms/polling-interval', [
  authenticateToken,
  requireAdmin,
  logActivity('UPDATE_PMS_POLLING_INTERVAL'),
  body('interval').isInt({ min: 1, max: 1440 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Polling interval must be between 1 and 1440 minutes',
        errors: errors.array()
      });
    }

    if (!req.user.hasPermission('canConfigurePMS')) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to modify PMS settings'
      });
    }

    const { interval } = req.body;
    
    await Settings.set('pms_polling_interval', interval, req.user.id);

    // Emit special event for PMS polling interval change
    if (global.io) {
      global.io.emit('pms:polling-interval-changed', {
        newInterval: interval,
        changedBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`PMS polling interval updated to ${interval} minutes`, {
      userId: req.user.id,
      previousInterval: 'CHANGED'
    });

    res.json({
      success: true,
      message: 'PMS polling interval updated successfully',
      data: {
        pollingInterval: interval,
        unit: 'minutes'
      }
    });

  } catch (error) {
    logger.error('Error updating PMS polling interval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update PMS polling interval'
    });
  }
});

// Backup settings (Super Admin only)
router.get('/backup/export', [
  authenticateToken,
  requireSuperAdmin,
  logActivity('EXPORT_SETTINGS')
], async (req, res) => {
  try {
    const backup = await Settings.backup();
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `settings-backup-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.json({
      backupDate: new Date().toISOString(),
      version: require('../../package.json').version,
      settings: backup
    });

  } catch (error) {
    logger.error('Error exporting settings backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export settings backup'
    });
  }
});

// Restore settings from backup (Super Admin only)
router.post('/backup/restore', [
  authenticateToken,
  requireSuperAdmin,
  logActivity('RESTORE_SETTINGS'),
  body('settings').isArray().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup data',
        errors: errors.array()
      });
    }

    const { settings } = req.body;
    
    const results = await Settings.restore(settings, req.user.id);
    
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

    // Emit settings restored event
    if (global.io) {
      global.io.emit('settings:restored', {
        restoredBy: req.user.name,
        successful,
        failed,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Settings restore completed`, {
      userId: req.user.id,
      successful,
      failed,
      total: settings.length
    });

    res.json({
      success: failed === 0,
      message: failed === 0 
        ? 'Settings restored successfully'
        : `${successful} settings restored, ${failed} failed`,
      data: {
        results,
        summary: {
          total: settings.length,
          successful,
          failed
        }
      }
    });

  } catch (error) {
    logger.error('Error restoring settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore settings'
    });
  }
});

// Upload logo endpoint
router.post('/upload-logo', [
  authenticateToken,
  requireAdmin,
  logActivity('UPLOAD_LOGO'),
  upload.single('logo')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const logoPath = `/uploads/branding/${req.file.filename}`;
    
    // Update the panel_logo setting
    await Settings.set('panel_logo', logoPath, req.user.id);

    // Emit real-time event
    if (global.io) {
      global.io.to('admin:settings').emit('setting:updated', {
        key: 'panel_logo',
        value: logoPath,
        updatedBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Panel logo uploaded', {
      userId: req.user.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      logo_url: logoPath
    });

  } catch (error) {
    logger.error('Error uploading logo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload logo'
    });
  }
});

// Get system health settings
router.get('/system/health', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const [
      logRetentionDays,
      maxDeviceHeartbeat,
      autoApproveDevices
    ] = await Promise.all([
      Settings.get('log_retention_days', 30),
      Settings.get('max_device_heartbeat_minutes', 5),
      Settings.get('auto_approve_devices', false)
    ]);

    res.json({
      success: true,
      data: {
        logRetentionDays,
        maxDeviceHeartbeat,
        autoApproveDevices
      }
    });

  } catch (error) {
    logger.error('Error fetching system health settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system health settings'
    });
  }
});

// USER MANAGEMENT ENDPOINTS

// Get all users (Admin access)
router.get('/users', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
    try {
        const users = await User.find({}, '-password -refreshTokens');
        res.json(users);

  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Create new user (Super Admin only)
router.post('/users', [
  authenticateToken,
  requireSuperAdmin,
  logActivity('CREATE_USER'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').isLength({ min: 1, max: 100 }),
  body('role').isIn(['admin', 'super_admin']).optional()
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

    const { email, password, name, role = 'admin' } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const newUser = await User.createUser({
      email,
      password,
      name,
      role
    });

    // Emit user created event
    if (global.io) {
      global.io.to('admin:settings').emit('user:created', {
        user: newUser.toJSON(),
        createdBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`User created: ${email}`, {
      userId: req.user.id,
      createdUserId: newUser.id,
      role: role
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: newUser.toJSON()
      }
    });

  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
});

// Update user (Super Admin only, or admin updating themselves)
router.put('/users/:id', [
  authenticateToken,
  logActivity('UPDATE_USER'),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 6 }),
  body('name').optional().isLength({ min: 1, max: 100 }),
  body('role').optional().isIn(['admin', 'super_admin'])
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

    const { id } = req.params;
    const { email, password, name, role } = req.body;

    // Find user to update
    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Permission checks
    const isUpdatingSelf = req.user.id === id;
    const isSuperAdmin = req.user.role === 'super_admin';

    if (!isUpdatingSelf && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile or you must be a super admin'
      });
    }

    // Only super admin can change roles
    if (role && role !== userToUpdate.role && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only super admin can change user roles'
      });
    }

    // Prevent super admin from demoting themselves
    if (isUpdatingSelf && req.user.role === 'super_admin' && role && role !== 'super_admin') {
      return res.status(400).json({
        success: false,
        message: 'Super admin cannot demote themselves'
      });
    }

    // Check email uniqueness
    if (email && email !== userToUpdate.email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== id) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Update user fields
    if (name) userToUpdate.name = name;
    if (email) userToUpdate.email = email;
    if (role) userToUpdate.role = role;
    
    if (password) {
      await userToUpdate.setPassword(password);
    }

    // Set permissions based on role
    if (role === 'super_admin') {
      userToUpdate.permissions = {
        canDeleteDevices: true,
        canManageAdmins: true,
        canChangeBranding: true,
        canConfigurePMS: true
      };
    } else if (role === 'admin' && userToUpdate.role !== 'admin') {
      userToUpdate.permissions = {
        canDeleteDevices: false,
        canManageAdmins: false,
        canChangeBranding: false,
        canConfigurePMS: false
      };
    }

    await userToUpdate.save();

    // Emit user updated event
    if (global.io) {
      global.io.to('admin:settings').emit('user:updated', {
        user: userToUpdate.toJSON(),
        updatedBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`User updated: ${userToUpdate.email}`, {
      userId: req.user.id,
      updatedUserId: userToUpdate.id,
      changedFields: Object.keys(req.body)
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: userToUpdate.toJSON()
      }
    });

  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user'
    });
  }
});

// Delete user (Super Admin only)
router.delete('/users/:id', [
  authenticateToken,
  requireSuperAdmin,
  logActivity('DELETE_USER')
], async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent super admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete yourself'
      });
    }

    // Find user to delete
    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const deletedUserEmail = userToDelete.email;

    // Delete user
    const dbType = process.env.DB_TYPE || 'mongodb';
    if (dbType === 'mongodb') {
      await userToDelete.deleteOne();
    } else {
      await userToDelete.destroy();
    }

    // Emit user deleted event
    if (global.io) {
      global.io.to('admin:settings').emit('user:deleted', {
        userId: id,
        email: deletedUserEmail,
        deletedBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`User deleted: ${deletedUserEmail}`, {
      userId: req.user.id,
      deletedUserId: id
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
});

module.exports = router;
