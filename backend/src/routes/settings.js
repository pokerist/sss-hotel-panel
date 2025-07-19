const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Settings = require('../models/Settings');
const { authenticateToken, requireSuperAdmin, requireAdmin, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get all editable settings (Admin access)
router.get('/', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const settings = await Settings.getAllEditable();
    
    // Group settings by category
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        settings: groupedSettings,
        categories: Object.keys(groupedSettings)
      }
    });

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

// Update specific setting
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

// Update multiple settings at once
router.put('/', [
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

module.exports = router;
