const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Device = require('../models/Device');
const Settings = require('../models/Settings');
const { authenticateDevice } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Device registration endpoint (no auth required for first contact)
router.post('/register', [
  body('uuid').isUUID().withMessage('Valid UUID required'),
  body('macAddress').matches(/^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/).withMessage('Valid MAC address required'),
  body('deviceInfo').optional().isObject(),
  body('version').optional().isString()
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

    const { uuid, macAddress, deviceInfo, version } = req.body;
    
    // Check if device already exists
    const existingDevice = await Device.findByUUID(uuid);
    if (existingDevice) {
      // Update device info and heartbeat
      existingDevice.updateHeartbeat();
      if (deviceInfo) {
        existingDevice.deviceInfo = { ...existingDevice.deviceInfo, ...deviceInfo };
      }
      await existingDevice.save();

      logger.logDeviceEvent('RECONNECTION', existingDevice.id, {
        uuid,
        macAddress,
        status: existingDevice.status
      });

      return res.json({
        success: true,
        message: 'Device reconnected',
        data: {
          deviceId: existingDevice.id,
          status: existingDevice.status,
          roomNumber: existingDevice.roomNumber,
          requiresApproval: existingDevice.status === 'pending'
        }
      });
    }

    // Check if MAC address is already registered
    const existingMacDevice = await Device.findByMAC(macAddress);
    if (existingMacDevice) {
      return res.status(409).json({
        success: false,
        message: 'Device with this MAC address already exists',
        code: 'MAC_ADDRESS_EXISTS'
      });
    }

    // Create new device
    const newDevice = new Device({
      uuid,
      macAddress: macAddress.toUpperCase(),
      status: 'pending',
      firstContact: new Date(),
      deviceInfo: deviceInfo || {},
      statistics: {
        totalUptime: 0,
        configPushCount: 0,
        messagesReceived: 0
      }
    });

    newDevice.updateHeartbeat();
    await newDevice.save();

    // Emit real-time event to admins
    if (global.io) {
      global.io.to('admin:devices').emit('device:new-registration', {
        deviceId: newDevice.id,
        uuid: newDevice.uuid,
        macAddress: newDevice.macAddress,
        deviceInfo: newDevice.deviceInfo,
        timestamp: new Date().toISOString()
      });
    }

    logger.logDeviceEvent('FIRST_CONTACT', newDevice.id, {
      uuid,
      macAddress,
      deviceInfo
    });

    res.status(201).json({
      success: true,
      message: 'Device registered successfully',
      data: {
        deviceId: newDevice.id,
        status: 'pending',
        requiresApproval: true,
        message: 'Device registration pending admin approval'
      }
    });

  } catch (error) {
    logger.error('Device registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Device registration failed'
    });
  }
});

// Device heartbeat endpoint
router.post('/heartbeat', authenticateDevice, async (req, res) => {
  try {
    const { device } = req;
    const { status, uptime } = req.body;

    // Update device heartbeat
    device.updateHeartbeat();

    // Update device status if provided
    if (status && ['online', 'idle'].includes(status)) {
      device.connectionStatus = status;
    }

    // Update uptime statistics
    if (uptime && typeof uptime === 'number') {
      const stats = device.statistics || {};
      stats.totalUptime = uptime;
      device.statistics = stats;
    }

    await device.save();

    res.json({
      success: true,
      message: 'Heartbeat received',
      data: {
        serverTime: new Date().toISOString(),
        status: device.status,
        roomNumber: device.roomNumber
      }
    });

  } catch (error) {
    logger.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      message: 'Heartbeat failed'
    });
  }
});

// Get device configuration
router.get('/config', authenticateDevice, async (req, res) => {
  try {
    const { device } = req;

    if (device.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Device not approved',
        code: 'DEVICE_NOT_APPROVED'
      });
    }

    // Get guest information for the room
    let guestInfo = null;
    if (device.roomNumber) {
      // This would typically fetch from PMS, for now return mock structure
      guestInfo = {
        name: null,
        checkIn: null,
        checkOut: null,
        bill: {
          total: 0,
          currency: 'USD'
        }
      };
    }

    // Get panel settings
    const [panelName, guestMessageTemplates] = await Promise.all([
      Settings.get('panel_name', 'Hotel IPTV Panel'),
      Settings.get('guest_message_templates', {
        welcome: 'Welcome, {{guest_name}}! We hope you enjoy your stay in room {{room_number}}.',
        farewell: 'Dear {{guest_name}}, we hope you had a great stay. Checkout is at {{check_out_time}}. Safe travels!'
      })
    ]);

    const config = {
      device: {
        id: device.id,
        uuid: device.uuid,
        status: device.status
      },
      room: device.roomNumber,
      guest: guestInfo,
      panel: {
        name: panelName,
        version: '1.0.0'
      },
      apps: device.configuration?.appLayout || [],
      backgroundBundle: device.configuration?.backgroundBundle || null,
      settings: device.configuration?.settings || {
        volume: 50,
        brightness: 75,
        sleepTimeout: 30,
        autoStart: true
      },
      messageTemplates: guestMessageTemplates,
      lastUpdated: new Date().toISOString()
    };

    // Update statistics
    const stats = device.statistics || {};
    stats.configPushCount = (stats.configPushCount || 0) + 1;
    stats.lastConfigPush = new Date();
    device.statistics = stats;
    await device.save();

    logger.logDeviceEvent('CONFIG_PULLED', device.id, {
      uuid: device.uuid,
      roomNumber: device.roomNumber
    });

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Config fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration'
    });
  }
});

// Report device status/error
router.post('/status', [
  authenticateDevice,
  body('type').isIn(['info', 'warning', 'error']),
  body('message').isString().isLength({ min: 1, max: 500 }),
  body('details').optional().isObject()
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

    const { device } = req;
    const { type, message, details } = req.body;

    // Log the device status report
    const logLevel = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
    logger.logDeviceEvent('STATUS_REPORT', device.id, {
      uuid: device.uuid,
      roomNumber: device.roomNumber,
      type,
      message,
      details
    });

    // Emit real-time event to admins for errors and warnings
    if (type === 'error' || type === 'warning') {
      if (global.io) {
        global.io.to('admin:devices').emit('device:status-alert', {
          deviceId: device.id,
          uuid: device.uuid,
          roomNumber: device.roomNumber,
          type,
          message,
          details,
          timestamp: new Date().toISOString()
        });
      }
    }

    res.json({
      success: true,
      message: 'Status report received'
    });

  } catch (error) {
    logger.error('Status report error:', error);
    res.status(500).json({
      success: false,
      message: 'Status report failed'
    });
  }
});

// Acknowledge message received by device
router.post('/message-ack', [
  authenticateDevice,
  body('messageId').isString(),
  body('type').isString(),
  body('status').isIn(['delivered', 'displayed', 'dismissed', 'error'])
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

    const { device } = req;
    const { messageId, type, status } = req.body;

    // Update message statistics
    device.incrementMessageCount();
    await device.save();

    logger.logDeviceEvent('MESSAGE_ACK', device.id, {
      uuid: device.uuid,
      roomNumber: device.roomNumber,
      messageId,
      type,
      status
    });

    res.json({
      success: true,
      message: 'Message acknowledgment received'
    });

  } catch (error) {
    logger.error('Message acknowledgment error:', error);
    res.status(500).json({
      success: false,
      message: 'Message acknowledgment failed'
    });
  }
});

// Get available apps for device
router.get('/apps', authenticateDevice, async (req, res) => {
  try {
    const { device } = req;

    if (device.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Device not approved',
        code: 'DEVICE_NOT_APPROVED'
      });
    }

    // For now, return device's configured apps
    // In a full implementation, this would fetch from Apps model
    const apps = device.configuration?.appLayout || [];
    
    const formattedApps = apps.map((app, index) => ({
      id: app.appId || `app-${index}`,
      label: app.label || `App ${index + 1}`,
      icon: app.icon || null,
      url: app.url || null,
      position: app.position || index,
      isVisible: app.isVisible !== false
    }));

    res.json({
      success: true,
      data: {
        apps: formattedApps,
        total: formattedApps.length
      }
    });

  } catch (error) {
    logger.error('Apps fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch apps'
    });
  }
});

// Get background/wallpaper for device
router.get('/background', authenticateDevice, async (req, res) => {
  try {
    const { device } = req;

    if (device.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Device not approved',
        code: 'DEVICE_NOT_APPROVED'
      });
    }

    // For now, return device's configured background
    // In a full implementation, this would fetch from BackgroundBundle model
    const backgroundBundle = device.configuration?.backgroundBundle || null;
    
    const backgroundData = {
      bundleId: backgroundBundle,
      backgrounds: [], // Would be populated from database
      settings: {
        transitionType: 'fade',
        displayDuration: 30, // seconds
        shuffle: false
      }
    };

    res.json({
      success: true,
      data: backgroundData
    });

  } catch (error) {
    logger.error('Background fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch background'
    });
  }
});

// App installation acknowledgment
router.post('/app-install-ack', [
  authenticateDevice,
  body('appId').isString(),
  body('status').isIn(['success', 'failed', 'not_found']),
  body('error').optional().isString()
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

    const { device } = req;
    const { appId, status, error } = req.body;

    logger.logDeviceEvent('APP_INSTALL_ACK', device.id, {
      uuid: device.uuid,
      roomNumber: device.roomNumber,
      appId,
      status,
      error
    });

    // Emit real-time event to admins
    if (global.io) {
      global.io.to('admin:devices').emit('device:app-install-result', {
        deviceId: device.id,
        uuid: device.uuid,
        roomNumber: device.roomNumber,
        appId,
        status,
        error,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'App installation acknowledgment received'
    });

  } catch (error) {
    logger.error('App install acknowledgment error:', error);
    res.status(500).json({
      success: false,
      message: 'App install acknowledgment failed'
    });
  }
});

// Device diagnostic information
router.post('/diagnostics', [
  authenticateDevice,
  body('diagnostics').isObject()
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

    const { device } = req;
    const { diagnostics } = req.body;

    // Update device info with diagnostics
    device.deviceInfo = {
      ...device.deviceInfo,
      ...diagnostics,
      lastDiagnostic: new Date().toISOString()
    };
    await device.save();

    logger.logDeviceEvent('DIAGNOSTICS_RECEIVED', device.id, {
      uuid: device.uuid,
      roomNumber: device.roomNumber,
      diagnostics
    });

    res.json({
      success: true,
      message: 'Diagnostics received'
    });

  } catch (error) {
    logger.error('Diagnostics error:', error);
    res.status(500).json({
      success: false,
      message: 'Diagnostics failed'
    });
  }
});

// Check for pending commands/messages
router.get('/commands', authenticateDevice, async (req, res) => {
  try {
    const { device } = req;

    // In a full implementation, this would check for pending commands
    // For now, return empty array
    const commands = [];

    res.json({
      success: true,
      data: {
        commands,
        hasCommands: commands.length > 0
      }
    });

  } catch (error) {
    logger.error('Commands check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check commands'
    });
  }
});

module.exports = router;
