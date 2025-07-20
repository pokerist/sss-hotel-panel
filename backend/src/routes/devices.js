const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Device = require('../models/Device');
const { authenticateToken, requireAdmin, requireSuperAdmin, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get all devices with filtering and pagination
router.get('/', [
  authenticateToken,
  requireAdmin,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'inactive']),
  query('connectionStatus').optional().isIn(['online', 'offline', 'idle']),
  query('roomNumber').optional().isString(),
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

        const {
            page = 1,
            limit = 50,
            status,
            connectionStatus,
            roomNumber,
            search
        } = req.query;

        // Build query
        const query = {};
        if (status) query.status = status;
        if (connectionStatus) query.connectionStatus = connectionStatus;
        if (roomNumber) query.roomNumber = roomNumber;
        if (search) {
            query.$or = [
                { uuid: { $regex: search, $options: 'i' } },
                { macAddress: { $regex: search, $options: 'i' } },
                { roomNumber: { $regex: search, $options: 'i' } }
            ];
        }

        // For frontend compatibility - return all devices if no pagination params
        if (!req.query.page && !req.query.limit) {
            const devices = await Device.find(query)
                .populate('approvedBy', 'name email')
                .sort({ createdAt: -1 });
            return res.json(devices);
        }

        // Get paginated results
        const [devices, total] = await Promise.all([
            Device.find(query)
                .populate('approvedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit)),
            Device.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: {
                devices,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

  } catch (error) {
    logger.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch devices'
    });
  }
});

// Get device statistics
router.get('/stats', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const stats = await Device.getDeviceStats();

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    logger.error('Error fetching device statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device statistics'
    });
  }
});

// Get pending devices
router.get('/pending', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const pendingDevices = await Device.getPendingDevices();

    res.json({
      success: true,
      data: { devices: pendingDevices }
    });

  } catch (error) {
    logger.error('Error fetching pending devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending devices'
    });
  }
});

// Get online devices
router.get('/online', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const onlineDevices = await Device.getOnlineDevices();

    res.json({
      success: true,
      data: { devices: onlineDevices }
    });

  } catch (error) {
    logger.error('Error fetching online devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch online devices'
    });
  }
});

// Get specific device
router.get('/:deviceId', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { deviceId } = req.params;
    const dbType = process.env.DB_TYPE || 'mongodb';

    let device;
    if (dbType === 'mongodb') {
      // Check if deviceId is a valid ObjectId, if not search by other fields
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(deviceId)) {
        device = await Device.findById(deviceId).populate('approvedBy', 'name email');
      } else {
        // Search by uuid or other identifier
        device = await Device.findOne({ 
          $or: [
            { uuid: deviceId },
            { macAddress: deviceId },
            { 'id': deviceId }
          ]
        }).populate('approvedBy', 'name email');
      }
    } else {
      device = await Device.findByPk(deviceId, {
        include: [
          {
            model: require('../models/User'),
            as: 'approvedBy',
            attributes: ['name', 'email'],
            required: false
          }
        ]
      });
    }

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.json({
      success: true,
      data: { device }
    });

  } catch (error) {
    logger.error('Error fetching device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch device'
    });
  }
});

// Approve device
router.post('/:deviceId/approve', [
  authenticateToken,
  requireAdmin,
  logActivity('APPROVE_DEVICE'),
  body('roomNumber').optional().isString().trim()
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
    const { roomNumber } = req.body;
    const dbType = process.env.DB_TYPE || 'mongodb';

    let device;
    if (dbType === 'mongodb') {
      device = await Device.findById(deviceId);
    } else {
      device = await Device.findByPk(deviceId);
    }

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (device.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Device is not in pending status'
      });
    }

    // Check if room is already occupied
    if (roomNumber) {
      const existingDevice = await Device.findByRoom(roomNumber);
      if (existingDevice && existingDevice.id !== device.id && existingDevice.status === 'approved') {
        return res.status(409).json({
          success: false,
          message: `Room ${roomNumber} is already occupied by another device`
        });
      }
      device.assignRoom(roomNumber);
    }

    device.approve(req.user.id);
    await device.save();

    // Emit real-time event
    if (global.io) {
      global.io.to('admin:devices').emit('device:approved', {
        deviceId: device.id,
        uuid: device.uuid,
        roomNumber: device.roomNumber,
        approvedBy: req.user.name,
        timestamp: new Date().toISOString()
      });

      // Notify device if connected
      global.io.emit(`device:${device.uuid}`, {
        type: 'APPROVED',
        roomNumber: device.roomNumber,
        timestamp: new Date().toISOString()
      });
    }

    logger.logDeviceEvent('APPROVED', device.id, {
      userId: req.user.id,
      roomNumber: device.roomNumber,
      uuid: device.uuid
    });

    res.json({
      success: true,
      message: 'Device approved successfully',
      data: { device }
    });

  } catch (error) {
    logger.error('Error approving device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve device'
    });
  }
});

// Reject device
router.post('/:deviceId/reject', [
  authenticateToken,
  requireAdmin,
  logActivity('REJECT_DEVICE')
], async (req, res) => {
  try {
    const { deviceId } = req.params;
    const dbType = process.env.DB_TYPE || 'mongodb';

    let device;
    if (dbType === 'mongodb') {
      device = await Device.findById(deviceId);
    } else {
      device = await Device.findByPk(deviceId);
    }

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (device.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Device is not in pending status'
      });
    }

    device.reject();
    await device.save();

    // Emit real-time event
    if (global.io) {
      global.io.to('admin:devices').emit('device:rejected', {
        deviceId: device.id,
        uuid: device.uuid,
        rejectedBy: req.user.name,
        timestamp: new Date().toISOString()
      });

      // Notify device if connected
      global.io.emit(`device:${device.uuid}`, {
        type: 'REJECTED',
        reason: 'Device registration rejected by administrator',
        timestamp: new Date().toISOString()
      });
    }

    logger.logDeviceEvent('REJECTED', device.id, {
      userId: req.user.id,
      uuid: device.uuid
    });

    res.json({
      success: true,
      message: 'Device rejected successfully',
      data: { device }
    });

  } catch (error) {
    logger.error('Error rejecting device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject device'
    });
  }
});

// Update device details
router.put('/:deviceId', [
  authenticateToken,
  requireAdmin,
  logActivity('UPDATE_DEVICE'),
  body('roomNumber').optional().isString().trim(),
  body('notes').optional().isString().isLength({ max: 500 })
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
    const { roomNumber, notes } = req.body;
    const dbType = process.env.DB_TYPE || 'mongodb';

    let device;
    if (dbType === 'mongodb') {
      // Check if deviceId is a valid ObjectId, if not search by other fields
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(deviceId)) {
        device = await Device.findById(deviceId);
      } else {
        // Search by uuid or other identifier
        device = await Device.findOne({ 
          $or: [
            { uuid: deviceId },
            { macAddress: deviceId },
            { 'id': deviceId }
          ]
        });
      }
    } else {
      device = await Device.findByPk(deviceId);
    }

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check room availability if changing room
    if (roomNumber && roomNumber !== device.roomNumber) {
      const existingDevice = await Device.findByRoom(roomNumber);
      if (existingDevice && existingDevice.id !== device.id && existingDevice.status === 'approved') {
        return res.status(409).json({
          success: false,
          message: `Room ${roomNumber} is already occupied by another device`
        });
      }
      device.assignRoom(roomNumber);
    }

    if (notes !== undefined) {
      device.notes = notes;
    }

    await device.save();

    // Emit real-time event
    if (global.io) {
      global.io.to('admin:devices').emit('device:updated', {
        deviceId: device.id,
        uuid: device.uuid,
        roomNumber: device.roomNumber,
        updatedBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    logger.logDeviceEvent('UPDATED', device.id, {
      userId: req.user.id,
      changes: { roomNumber, notes }
    });

    res.json({
      success: true,
      message: 'Device updated successfully',
      data: { device }
    });

  } catch (error) {
    logger.error('Error updating device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update device'
    });
  }
});

// Reboot device
router.post('/:deviceId/reboot', [
  authenticateToken,
  requireAdmin,
  logActivity('REBOOT_DEVICE')
], async (req, res) => {
  try {
    const { deviceId } = req.params;
    const dbType = process.env.DB_TYPE || 'mongodb';

    let device;
    if (dbType === 'mongodb') {
      device = await Device.findById(deviceId);
    } else {
      device = await Device.findByPk(deviceId);
    }

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (device.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Device must be approved to reboot'
      });
    }

    // Send reboot command to device via Socket.IO
    if (global.io) {
      global.io.emit(`device:${device.uuid}`, {
        type: 'REBOOT',
        requestedBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    // Update statistics
    const stats = device.statistics || {};
    stats.lastReboot = new Date();
    device.statistics = stats;
    await device.save();

    logger.logDeviceEvent('REBOOT_REQUESTED', device.id, {
      userId: req.user.id,
      uuid: device.uuid,
      roomNumber: device.roomNumber
    });

    res.json({
      success: true,
      message: 'Reboot command sent to device',
      data: { device }
    });

  } catch (error) {
    logger.error('Error rebooting device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reboot device'
    });
  }
});

// Push configuration to device
router.post('/:deviceId/push-config', [
  authenticateToken,
  requireAdmin,
  logActivity('PUSH_CONFIG')
], async (req, res) => {
  try {
    const { deviceId } = req.params;
    const dbType = process.env.DB_TYPE || 'mongodb';

    let device;
    if (dbType === 'mongodb') {
      device = await Device.findById(deviceId);
    } else {
      device = await Device.findByPk(deviceId);
    }

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (device.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Device must be approved to push configuration'
      });
    }

    // Update configuration push statistics
    device.updateConfiguration({});
    await device.save();

    // Send configuration update to device via Socket.IO
    if (global.io) {
      global.io.emit(`device:${device.uuid}`, {
        type: 'CONFIG_UPDATE',
        requestedBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    logger.logDeviceEvent('CONFIG_PUSHED', device.id, {
      userId: req.user.id,
      uuid: device.uuid,
      roomNumber: device.roomNumber
    });

    res.json({
      success: true,
      message: 'Configuration pushed to device',
      data: { device }
    });

  } catch (error) {
    logger.error('Error pushing configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to push configuration'
    });
  }
});

// Delete device (Super Admin only)
router.delete('/:deviceId', [
  authenticateToken,
  requireSuperAdmin,
  logActivity('DELETE_DEVICE')
], async (req, res) => {
  try {
    const { deviceId } = req.params;
    const dbType = process.env.DB_TYPE || 'mongodb';

    let device;
    if (dbType === 'mongodb') {
      device = await Device.findById(deviceId);
    } else {
      device = await Device.findByPk(deviceId);
    }

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    const deviceInfo = {
      uuid: device.uuid,
      roomNumber: device.roomNumber,
      macAddress: device.macAddress
    };

    // Delete device
    if (dbType === 'mongodb') {
      await Device.findByIdAndDelete(deviceId);
    } else {
      await device.destroy();
    }

    // Emit real-time event
    if (global.io) {
      global.io.to('admin:devices').emit('device:deleted', {
        deviceId,
        deviceInfo,
        deletedBy: req.user.name,
        timestamp: new Date().toISOString()
      });

      // Notify device if connected
      global.io.emit(`device:${deviceInfo.uuid}`, {
        type: 'DELETED',
        message: 'Device has been removed from the system',
        timestamp: new Date().toISOString()
      });
    }

    logger.logDeviceEvent('DELETED', deviceId, {
      userId: req.user.id,
      deviceInfo
    });

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete device'
    });
  }
});

// Bulk approve devices
router.post('/bulk/approve', [
  authenticateToken,
  requireAdmin,
  logActivity('BULK_APPROVE_DEVICES'),
  body('deviceIds').isArray().notEmpty(),
  body('deviceIds.*').isString()
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

    const { deviceIds } = req.body;
    const results = [];
    const failures = [];

    for (const deviceId of deviceIds) {
      try {
        const dbType = process.env.DB_TYPE || 'mongodb';
        let device;

        if (dbType === 'mongodb') {
          device = await Device.findById(deviceId);
        } else {
          device = await Device.findByPk(deviceId);
        }

        if (!device) {
          failures.push({ deviceId, error: 'Device not found' });
          continue;
        }

        if (device.status !== 'pending') {
          failures.push({ deviceId, error: 'Device is not in pending status' });
          continue;
        }

        device.approve(req.user.id);
        await device.save();

        results.push({ deviceId, uuid: device.uuid, status: 'approved' });

        // Emit real-time events
        if (global.io) {
          global.io.to('admin:devices').emit('device:approved', {
            deviceId: device.id,
            uuid: device.uuid,
            approvedBy: req.user.name,
            timestamp: new Date().toISOString()
          });

          global.io.emit(`device:${device.uuid}`, {
            type: 'APPROVED',
            timestamp: new Date().toISOString()
          });
        }

        logger.logDeviceEvent('BULK_APPROVED', device.id, {
          userId: req.user.id,
          uuid: device.uuid
        });

      } catch (error) {
        failures.push({ deviceId, error: error.message });
      }
    }

    res.json({
      success: failures.length === 0,
      message: failures.length === 0 
        ? 'All devices approved successfully'
        : `${results.length} devices approved, ${failures.length} failed`,
      data: {
        approved: results,
        failed: failures,
        summary: {
          total: deviceIds.length,
          successful: results.length,
          failed: failures.length
        }
      }
    });

  } catch (error) {
    logger.error('Error bulk approving devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk approve devices'
    });
  }
});

module.exports = router;
