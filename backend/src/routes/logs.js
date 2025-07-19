const express = require('express');
const { query, validationResult } = require('express-validator');
const Log = require('../models/Log');
const { authenticateToken, requireSuperAdmin, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get logs with filtering and pagination (Super Admin only)
router.get('/', [
  authenticateToken,
  requireSuperAdmin,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['ADMIN_ACTION', 'PMS_SYNC', 'DEVICE_EVENT', 'SYSTEM_EVENT']),
  query('level').optional().isIn(['error', 'warn', 'info', 'debug']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
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
      type,
      level,
      startDate,
      endDate,
      userId,
      deviceId,
      roomNumber,
      search
    } = req.query;

    let result;

    if (search) {
      // Perform search
      result = await Log.searchLogs(search, {
        page: parseInt(page),
        limit: parseInt(limit),
        type,
        level
      });
    } else if (type) {
      // Get logs by type with filters
      result = await Log.getLogsByType(type, {
        page: parseInt(page),
        limit: parseInt(limit),
        startDate,
        endDate,
        level,
        userId,
        deviceId,
        roomNumber
      });
    } else {
      // Get recent logs with basic filtering
      const filter = {};
      if (level) filter.level = level;
      if (userId) filter.userId = userId;
      if (deviceId) filter.deviceId = deviceId;
      if (roomNumber) filter.roomNumber = roomNumber;

      // Date range filter
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      const dbType = process.env.DB_TYPE || 'mongodb';
      const skip = (page - 1) * limit;

      if (dbType === 'mongodb') {
        const [logs, total] = await Promise.all([
          Log.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'name email')
            .populate('deviceId', 'uuid roomNumber'),
          Log.countDocuments(filter)
        ]);

        result = {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        };
      } else {
        const { Op } = require('sequelize');
        const offset = skip;

        // Convert MongoDB-style date filter to Sequelize
        if (filter.createdAt) {
          const dateFilter = {};
          if (filter.createdAt.$gte) dateFilter[Op.gte] = filter.createdAt.$gte;
          if (filter.createdAt.$lte) dateFilter[Op.lte] = filter.createdAt.$lte;
          filter.createdAt = dateFilter;
        }

        const { count, rows } = await Log.findAndCountAll({
          where: filter,
          order: [['createdAt', 'DESC']],
          limit: parseInt(limit),
          offset,
          include: [
            {
              model: require('../models/User'),
              attributes: ['name', 'email'],
              required: false
            },
            {
              model: require('../models/Device'),
              attributes: ['uuid', 'roomNumber'],
              required: false
            }
          ]
        });

        result = {
          logs: rows,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
          }
        };
      }
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logs'
    });
  }
});

// Get specific log details (Super Admin only)
router.get('/:logId', [
  authenticateToken,
  requireSuperAdmin
], async (req, res) => {
  try {
    const { logId } = req.params;
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    let log;
    if (dbType === 'mongodb') {
      log = await Log.findById(logId)
        .populate('userId', 'name email role')
        .populate('deviceId', 'uuid roomNumber macAddress');
    } else {
      log = await Log.findByPk(logId, {
        include: [
          {
            model: require('../models/User'),
            attributes: ['name', 'email', 'role'],
            required: false
          },
          {
            model: require('../models/Device'),
            attributes: ['uuid', 'roomNumber', 'macAddress'],
            required: false
          }
        ]
      });
    }

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log not found'
      });
    }

    res.json({
      success: true,
      data: { log }
    });

  } catch (error) {
    logger.error('Error fetching log details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch log details'
    });
  }
});

// Get log statistics (Super Admin only)
router.get('/stats/overview', [
  authenticateToken,
  requireSuperAdmin,
  query('days').optional().isInt({ min: 1, max: 365 })
], async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const stats = await Log.getLogStats(parseInt(days));
    
    res.json({
      success: true,
      data: {
        period: `${days} days`,
        stats
      }
    });

  } catch (error) {
    logger.error('Error fetching log statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch log statistics'
    });
  }
});

// Export logs (Super Admin only)
router.get('/export/download', [
  authenticateToken,
  requireSuperAdmin,
  logActivity('EXPORT_LOGS'),
  query('format').optional().isIn(['json', 'csv']),
  query('type').optional().isIn(['ADMIN_ACTION', 'PMS_SYNC', 'DEVICE_EVENT', 'SYSTEM_EVENT']),
  query('level').optional().isIn(['error', 'warn', 'info', 'debug']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 10000 })
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
      format = 'json',
      type,
      level,
      startDate,
      endDate,
      limit = 1000
    } = req.query;

    // Build filter
    const filter = {};
    if (type) filter.type = type;
    if (level) filter.level = level;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const dbType = process.env.DB_TYPE || 'mongodb';
    let logs;

    if (dbType === 'mongodb') {
      logs = await Log.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('userId', 'name email')
        .populate('deviceId', 'uuid roomNumber')
        .lean();
    } else {
      const { Op } = require('sequelize');
      
      // Convert MongoDB-style date filter to Sequelize
      if (filter.createdAt) {
        const dateFilter = {};
        if (filter.createdAt.$gte) dateFilter[Op.gte] = filter.createdAt.$gte;
        if (filter.createdAt.$lte) dateFilter[Op.lte] = filter.createdAt.$lte;
        filter.createdAt = dateFilter;
      }

      const result = await Log.findAll({
        where: filter,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        include: [
          {
            model: require('../models/User'),
            attributes: ['name', 'email'],
            required: false
          },
          {
            model: require('../models/Device'),
            attributes: ['uuid', 'roomNumber'],
            required: false
          }
        ]
      });

      logs = result.map(log => log.toJSON());
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `logs-export-${timestamp}.${format}`;

    if (format === 'csv') {
      // Convert to CSV
      const fields = [
        'createdAt',
        'type',
        'level',
        'message',
        'action',
        'event',
        'success',
        'roomNumber',
        'ipAddress',
        'endpoint',
        'method'
      ];

      let csvContent = fields.join(',') + '\n';
      
      logs.forEach(log => {
        const row = fields.map(field => {
          let value = log[field] || '';
          if (typeof value === 'string' && value.includes(',')) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvContent += row.join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json({
        exportDate: new Date().toISOString(),
        totalRecords: logs.length,
        filters: { type, level, startDate, endDate },
        logs
      });
    }

  } catch (error) {
    logger.error('Error exporting logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export logs'
    });
  }
});

// Clean up old logs (Super Admin only)
router.post('/cleanup', [
  authenticateToken,
  requireSuperAdmin,
  logActivity('CLEANUP_LOGS'),
  query('retentionDays').optional().isInt({ min: 1, max: 365 })
], async (req, res) => {
  try {
    const { retentionDays = 30 } = req.query;
    
    const deletedCount = await Log.cleanupOldLogs(parseInt(retentionDays));
    
    logger.info(`Log cleanup completed: ${deletedCount} logs deleted`, {
      userId: req.user.id,
      retentionDays: parseInt(retentionDays)
    });

    res.json({
      success: true,
      message: 'Log cleanup completed successfully',
      data: {
        deletedCount,
        retentionDays: parseInt(retentionDays)
      }
    });

  } catch (error) {
    logger.error('Error cleaning up logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up logs'
    });
  }
});

// Get recent logs for dashboard (Super Admin only)
router.get('/recent/dashboard', [
  authenticateToken,
  requireSuperAdmin,
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const logs = await Log.getRecentLogs(parseInt(limit));
    
    res.json({
      success: true,
      data: { logs }
    });

  } catch (error) {
    logger.error('Error fetching recent logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent logs'
    });
  }
});

// Get logs by type with simple response (Super Admin only)
router.get('/type/:logType', [
  authenticateToken,
  requireSuperAdmin,
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const { logType } = req.params;
    const { limit = 50 } = req.query;

    if (!['ADMIN_ACTION', 'PMS_SYNC', 'DEVICE_EVENT', 'SYSTEM_EVENT'].includes(logType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid log type'
      });
    }

    const result = await Log.getLogsByType(logType, {
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error fetching logs by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch logs by type'
    });
  }
});

module.exports = router;
