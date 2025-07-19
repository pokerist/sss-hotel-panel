const mongoose = require('mongoose');
const { Sequelize, DataTypes } = require('sequelize');
const database = require('../config/database');

let Log;

// MongoDB Schema (Mongoose)
const mongoSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['ADMIN_ACTION', 'PMS_SYNC', 'DEVICE_EVENT', 'SYSTEM_EVENT'],
    required: true,
    index: true
  },
  level: {
    type: String,
    enum: ['error', 'warn', 'info', 'debug'],
    default: 'info',
    index: true
  },
  message: {
    type: String,
    required: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    default: null,
    index: true
  },
  roomNumber: {
    type: String,
    default: null,
    index: true
  },
  action: {
    type: String,
    default: null
  },
  event: {
    type: String,
    default: null
  },
  success: {
    type: Boolean,
    default: null
  },
  error: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  endpoint: {
    type: String,
    default: null
  },
  method: {
    type: String,
    default: null
  },
  duration: {
    type: Number,
    default: null
  },
  statusCode: {
    type: Number,
    default: null
  }
}, {
  timestamps: true,
  indexes: [
    { type: 1, createdAt: -1 },
    { level: 1, createdAt: -1 },
    { userId: 1, createdAt: -1 },
    { deviceId: 1, createdAt: -1 },
    { roomNumber: 1, createdAt: -1 },
    { createdAt: -1 },
    // Compound index for common queries
    { type: 1, level: 1, createdAt: -1 }
  ]
});

// PostgreSQL Schema (Sequelize)
const postgresSchema = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM('ADMIN_ACTION', 'PMS_SYNC', 'DEVICE_EVENT', 'SYSTEM_EVENT'),
    allowNull: false
  },
  level: {
    type: DataTypes.ENUM('error', 'warn', 'info', 'debug'),
    defaultValue: 'info'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 1000]
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  deviceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Devices',
      key: 'id'
    }
  },
  roomNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: true
  },
  event: {
    type: DataTypes.STRING,
    allowNull: true
  },
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('metadata');
      return value ? JSON.parse(value) : {};
    },
    set(value) {
      this.setDataValue('metadata', JSON.stringify(value || {}));
    }
  },
  ipAddress: {
    type: DataTypes.INET,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  endpoint: {
    type: DataTypes.STRING,
    allowNull: true
  },
  method: {
    type: DataTypes.STRING,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  statusCode: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
};

// Common methods for both database types
const commonMethods = {
  isError() {
    return this.level === 'error';
  },

  isWarning() {
    return this.level === 'warn';
  },

  isSuccess() {
    return this.success === true;
  },

  getFormattedMessage() {
    let formatted = this.message;
    
    if (this.action) {
      formatted = `${this.action}: ${formatted}`;
    }
    
    if (this.event) {
      formatted = `${this.event} - ${formatted}`;
    }
    
    return formatted;
  },

  getSeverityLevel() {
    const levels = { error: 4, warn: 3, info: 2, debug: 1 };
    return levels[this.level] || 0;
  },

  addMetadata(key, value) {
    const meta = this.metadata || {};
    meta[key] = value;
    this.metadata = meta;
  }
};

// Static methods
const staticMethods = {
  async createLog(logData) {
    const log = new Log(logData);
    return await log.save();
  },

  async getLogsByType(type, options = {}) {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      level,
      userId,
      deviceId,
      roomNumber
    } = options;

    const dbType = process.env.DB_TYPE || 'mongodb';
    
    // Build filter
    const filter = { type };
    
    if (level) filter.level = level;
    if (userId) filter.userId = userId;
    if (deviceId) filter.deviceId = deviceId;
    if (roomNumber) filter.roomNumber = roomNumber;
    
    // Date range filter
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      filter.createdAt = dateFilter;
    }

    if (dbType === 'mongodb') {
      const skip = (page - 1) * limit;
      const [logs, total] = await Promise.all([
        Log.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('userId', 'name email')
          .populate('deviceId', 'uuid roomNumber'),
        Log.countDocuments(filter)
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } else {
      const { Op } = require('sequelize');
      const offset = (page - 1) * limit;
      
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
        limit,
        offset,
        include: [
          {
            model: require('./User'),
            attributes: ['name', 'email'],
            required: false
          },
          {
            model: require('./Device'),
            attributes: ['uuid', 'roomNumber'],
            required: false
          }
        ]
      });

      return {
        logs: rows,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit)
        }
      };
    }
  },

  async getRecentLogs(limit = 100) {
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      return await Log.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('userId', 'name email')
        .populate('deviceId', 'uuid roomNumber');
    } else {
      return await Log.findAll({
        order: [['createdAt', 'DESC']],
        limit,
        include: [
          {
            model: require('./User'),
            attributes: ['name', 'email'],
            required: false
          },
          {
            model: require('./Device'),
            attributes: ['uuid', 'roomNumber'],
            required: false
          }
        ]
      });
    }
  },

  async getLogStats(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      const [total, errors, warnings, byType] = await Promise.all([
        Log.countDocuments({ createdAt: { $gte: startDate } }),
        Log.countDocuments({ 
          createdAt: { $gte: startDate },
          level: 'error'
        }),
        Log.countDocuments({ 
          createdAt: { $gte: startDate },
          level: 'warn'
        }),
        Log.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ])
      ]);

      const typeStats = {};
      byType.forEach(stat => {
        typeStats[stat._id] = stat.count;
      });

      return { total, errors, warnings, byType: typeStats };
    } else {
      const { Op } = require('sequelize');
      const [total, errors, warnings, byType] = await Promise.all([
        Log.count({ where: { createdAt: { [Op.gte]: startDate } } }),
        Log.count({ 
          where: { 
            createdAt: { [Op.gte]: startDate },
            level: 'error'
          }
        }),
        Log.count({ 
          where: { 
            createdAt: { [Op.gte]: startDate },
            level: 'warn'
          }
        }),
        Log.findAll({
          where: { createdAt: { [Op.gte]: startDate } },
          attributes: [
            'type',
            [Sequelize.fn('COUNT', Sequelize.col('type')), 'count']
          ],
          group: ['type']
        })
      ]);

      const typeStats = {};
      byType.forEach(stat => {
        typeStats[stat.type] = parseInt(stat.get('count'));
      });

      return { total, errors, warnings, byType: typeStats };
    }
  },

  async cleanupOldLogs(retentionDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      const result = await Log.deleteMany({
        createdAt: { $lt: cutoffDate }
      });
      return result.deletedCount;
    } else {
      const { Op } = require('sequelize');
      const result = await Log.destroy({
        where: {
          createdAt: { [Op.lt]: cutoffDate }
        }
      });
      return result;
    }
  },

  async searchLogs(searchTerm, options = {}) {
    const { page = 1, limit = 50, type, level } = options;
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    // Build search filter
    const filter = {};
    if (type) filter.type = type;
    if (level) filter.level = level;
    
    if (dbType === 'mongodb') {
      // MongoDB text search
      filter.$or = [
        { message: new RegExp(searchTerm, 'i') },
        { action: new RegExp(searchTerm, 'i') },
        { event: new RegExp(searchTerm, 'i') },
        { error: new RegExp(searchTerm, 'i') }
      ];
      
      const skip = (page - 1) * limit;
      const [logs, total] = await Promise.all([
        Log.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('userId', 'name email')
          .populate('deviceId', 'uuid roomNumber'),
        Log.countDocuments(filter)
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } else {
      // PostgreSQL text search
      const { Op } = require('sequelize');
      filter[Op.or] = [
        { message: { [Op.iLike]: `%${searchTerm}%` } },
        { action: { [Op.iLike]: `%${searchTerm}%` } },
        { event: { [Op.iLike]: `%${searchTerm}%` } },
        { error: { [Op.iLike]: `%${searchTerm}%` } }
      ];
      
      const offset = (page - 1) * limit;
      const { count, rows } = await Log.findAndCountAll({
        where: filter,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        include: [
          {
            model: require('./User'),
            attributes: ['name', 'email'],
            required: false
          },
          {
            model: require('./Device'),
            attributes: ['uuid', 'roomNumber'],
            required: false
          }
        ]
      });

      return {
        logs: rows,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit)
        }
      };
    }
  }
};

// Initialize based on database type
const dbType = process.env.DB_TYPE || 'mongodb';

if (dbType === 'mongodb') {
  // Add instance methods to mongoose schema
  Object.keys(commonMethods).forEach(method => {
    mongoSchema.methods[method] = commonMethods[method];
  });

  // Add static methods
  Object.keys(staticMethods).forEach(method => {
    mongoSchema.statics[method] = staticMethods[method];
  });

  // Add text index for search
  mongoSchema.index({
    message: 'text',
    action: 'text',
    event: 'text',
    error: 'text'
  });

  Log = mongoose.model('Log', mongoSchema);
} else {
  // PostgreSQL model
  const sequelize = database.getSequelize();
  
  Log = sequelize.define('Log', postgresSchema, {
    indexes: [
      { fields: ['type', 'createdAt'] },
      { fields: ['level', 'createdAt'] },
      { fields: ['userId', 'createdAt'] },
      { fields: ['deviceId', 'createdAt'] },
      { fields: ['roomNumber', 'createdAt'] },
      { fields: ['createdAt'] }
    ]
  });

  // Add instance methods
  Object.keys(commonMethods).forEach(method => {
    Log.prototype[method] = commonMethods[method];
  });

  // Add static methods
  Object.keys(staticMethods).forEach(method => {
    Log[method] = staticMethods[method];
  });
}

module.exports = Log;
