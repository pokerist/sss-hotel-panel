const mongoose = require('mongoose');

// MongoDB Schema (Mongoose)
const logSchema = new mongoose.Schema({
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

// Add text index for search
logSchema.index({
  message: 'text',
  action: 'text',
  event: 'text',
  error: 'text'
});

// Instance methods
logSchema.methods.isError = function() {
  return this.level === 'error';
};

logSchema.methods.isWarning = function() {
  return this.level === 'warn';
};

logSchema.methods.isSuccess = function() {
  return this.success === true;
};

logSchema.methods.getFormattedMessage = function() {
  let formatted = this.message;
  
  if (this.action) {
    formatted = `${this.action}: ${formatted}`;
  }
  
  if (this.event) {
    formatted = `${this.event} - ${formatted}`;
  }
  
  return formatted;
};

logSchema.methods.getSeverityLevel = function() {
  const levels = { error: 4, warn: 3, info: 2, debug: 1 };
  return levels[this.level] || 0;
};

logSchema.methods.addMetadata = function(key, value) {
  const meta = this.metadata || {};
  meta[key] = value;
  this.metadata = meta;
};

// Static methods
logSchema.statics.createLog = async function(logData) {
  const log = new this(logData);
  return await log.save();
};

logSchema.statics.getLogsByType = async function(type, options = {}) {
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

  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    this.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email')
      .populate('deviceId', 'uuid roomNumber'),
    this.countDocuments(filter)
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
};

logSchema.statics.getRecentLogs = async function(limit = 100) {
  return await this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('userId', 'name email')
    .populate('deviceId', 'uuid roomNumber');
};

logSchema.statics.getLogStats = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const [total, errors, warnings, byType] = await Promise.all([
    this.countDocuments({ createdAt: { $gte: startDate } }),
    this.countDocuments({ 
      createdAt: { $gte: startDate },
      level: 'error'
    }),
    this.countDocuments({ 
      createdAt: { $gte: startDate },
      level: 'warn'
    }),
    this.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ])
  ]);

  const typeStats = {};
  byType.forEach(stat => {
    typeStats[stat._id] = stat.count;
  });

  return { total, errors, warnings, byType: typeStats };
};

logSchema.statics.cleanupOldLogs = async function(retentionDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate }
  });
  return result.deletedCount;
};

logSchema.statics.searchLogs = async function(searchTerm, options = {}) {
  const { page = 1, limit = 50, type, level } = options;
  
  // Build search filter
  const filter = {};
  if (type) filter.type = type;
  if (level) filter.level = level;
  
  // MongoDB text search
  filter.$or = [
    { message: new RegExp(searchTerm, 'i') },
    { action: new RegExp(searchTerm, 'i') },
    { event: new RegExp(searchTerm, 'i') },
    { error: new RegExp(searchTerm, 'i') }
  ];
  
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    this.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email')
      .populate('deviceId', 'uuid roomNumber'),
    this.countDocuments(filter)
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
};

module.exports = mongoose.model('Log', logSchema);
