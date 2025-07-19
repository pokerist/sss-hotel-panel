const mongoose = require('mongoose');
const { Sequelize, DataTypes } = require('sequelize');
const database = require('../config/database');

let Device;

// MongoDB Schema (Mongoose)
const mongoSchema = new mongoose.Schema({
  uuid: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  macAddress: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/, 'Please enter a valid MAC address']
  },
  roomNumber: {
    type: String,
    required: false,
    trim: true,
    maxlength: [10, 'Room number cannot exceed 10 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'inactive'],
    default: 'pending'
  },
  connectionStatus: {
    type: String,
    enum: ['online', 'offline', 'idle'],
    default: 'offline'
  },
  lastHeartbeat: {
    type: Date,
    default: null
  },
  firstContact: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  deviceInfo: {
    manufacturer: String,
    model: String,
    androidVersion: String,
    launcherVersion: String,
    screenResolution: String,
    ipAddress: String,
    networkType: String
  },
  configuration: {
    backgroundBundle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BackgroundBundle',
      default: null
    },
    appLayout: [{
      appId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'App'
      },
      position: Number,
      isVisible: {
        type: Boolean,
        default: true
      }
    }],
    settings: {
      volume: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
      },
      brightness: {
        type: Number,
        min: 0,
        max: 100,
        default: 75
      },
      sleepTimeout: {
        type: Number,
        default: 30
      },
      autoStart: {
        type: Boolean,
        default: true
      }
    }
  },
  statistics: {
    totalUptime: {
      type: Number,
      default: 0
    },
    lastReboot: Date,
    configPushCount: {
      type: Number,
      default: 0
    },
    lastConfigPush: Date,
    messagesReceived: {
      type: Number,
      default: 0
    }
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  indexes: [
    { uuid: 1 },
    { macAddress: 1 },
    { roomNumber: 1 },
    { status: 1 },
    { connectionStatus: 1 }
  ]
});

// PostgreSQL Schema (Sequelize)
const postgresSchema = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  uuid: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  macAddress: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      is: /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/
    },
    set(value) {
      this.setDataValue('macAddress', value.toUpperCase());
    }
  },
  roomNumber: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'inactive'),
    defaultValue: 'pending'
  },
  connectionStatus: {
    type: DataTypes.ENUM('online', 'offline', 'idle'),
    defaultValue: 'offline'
  },
  lastHeartbeat: {
    type: DataTypes.DATE,
    allowNull: true
  },
  firstContact: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  approvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deviceInfo: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('deviceInfo');
      return value ? JSON.parse(value) : {};
    },
    set(value) {
      this.setDataValue('deviceInfo', JSON.stringify(value || {}));
    }
  },
  configuration: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('configuration');
      return value ? JSON.parse(value) : {
        backgroundBundle: null,
        appLayout: [],
        settings: {
          volume: 50,
          brightness: 75,
          sleepTimeout: 30,
          autoStart: true
        }
      };
    },
    set(value) {
      this.setDataValue('configuration', JSON.stringify(value || {}));
    }
  },
  statistics: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('statistics');
      return value ? JSON.parse(value) : {
        totalUptime: 0,
        lastReboot: null,
        configPushCount: 0,
        lastConfigPush: null,
        messagesReceived: 0
      };
    },
    set(value) {
      this.setDataValue('statistics', JSON.stringify(value || {}));
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  }
};

// Common methods for both database types
const commonMethods = {
  updateHeartbeat() {
    this.lastHeartbeat = new Date();
    this.connectionStatus = 'online';
  },

  setOffline() {
    this.connectionStatus = 'offline';
  },

  setIdle() {
    this.connectionStatus = 'idle';
  },

  approve(userId) {
    this.status = 'approved';
    this.approvedBy = userId;
    this.approvedAt = new Date();
  },

  reject() {
    this.status = 'rejected';
  },

  assignRoom(roomNumber) {
    this.roomNumber = roomNumber;
  },

  updateConfiguration(config) {
    this.configuration = { ...this.configuration, ...config };
    
    // Update statistics
    const stats = this.statistics || {};
    stats.configPushCount = (stats.configPushCount || 0) + 1;
    stats.lastConfigPush = new Date();
    this.statistics = stats;
  },

  addAppToLayout(appId, position = null) {
    const appLayout = this.configuration?.appLayout || [];
    
    // Remove if already exists
    const filteredLayout = appLayout.filter(app => app.appId.toString() !== appId.toString());
    
    // Add to position or end
    if (position !== null && position < filteredLayout.length) {
      filteredLayout.splice(position, 0, { appId, position, isVisible: true });
    } else {
      filteredLayout.push({ appId, position: filteredLayout.length, isVisible: true });
    }

    // Update configuration
    this.configuration = {
      ...this.configuration,
      appLayout: filteredLayout
    };
  },

  removeAppFromLayout(appId) {
    const appLayout = this.configuration?.appLayout || [];
    const filteredLayout = appLayout.filter(app => app.appId.toString() !== appId.toString());
    
    this.configuration = {
      ...this.configuration,
      appLayout: filteredLayout
    };
  },

  reorderApps(appOrder) {
    const appLayout = appOrder.map((appId, index) => ({
      appId,
      position: index,
      isVisible: true
    }));

    this.configuration = {
      ...this.configuration,
      appLayout
    };
  },

  isOnline() {
    if (!this.lastHeartbeat) return false;
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.lastHeartbeat > fiveMinutesAgo;
  },

  getUptimeHours() {
    const stats = this.statistics || {};
    return Math.floor((stats.totalUptime || 0) / 3600);
  },

  incrementMessageCount() {
    const stats = this.statistics || {};
    stats.messagesReceived = (stats.messagesReceived || 0) + 1;
    this.statistics = stats;
  }
};

// Static methods
const staticMethods = {
  async findByUUID(uuid) {
    const dbType = process.env.DB_TYPE || 'mongodb';
    if (dbType === 'mongodb') {
      return await Device.findOne({ uuid });
    } else {
      return await Device.findOne({ where: { uuid } });
    }
  },

  async findByMAC(macAddress) {
    const dbType = process.env.DB_TYPE || 'mongodb';
    const mac = macAddress.toUpperCase();
    
    if (dbType === 'mongodb') {
      return await Device.findOne({ macAddress: mac });
    } else {
      return await Device.findOne({ where: { macAddress: mac } });
    }
  },

  async findByRoom(roomNumber) {
    const dbType = process.env.DB_TYPE || 'mongodb';
    if (dbType === 'mongodb') {
      return await Device.findOne({ roomNumber });
    } else {
      return await Device.findOne({ where: { roomNumber } });
    }
  },

  async getOnlineDevices() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      return await Device.find({
        lastHeartbeat: { $gte: fiveMinutesAgo },
        status: 'approved'
      });
    } else {
      const { Op } = require('sequelize');
      return await Device.findAll({
        where: {
          lastHeartbeat: { [Op.gte]: fiveMinutesAgo },
          status: 'approved'
        }
      });
    }
  },

  async getPendingDevices() {
    const dbType = process.env.DB_TYPE || 'mongodb';
    if (dbType === 'mongodb') {
      return await Device.find({ status: 'pending' }).sort({ firstContact: -1 });
    } else {
      return await Device.findAll({
        where: { status: 'pending' },
        order: [['firstContact', 'DESC']]
      });
    }
  },

  async getDeviceStats() {
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      const [total, approved, pending, online] = await Promise.all([
        Device.countDocuments(),
        Device.countDocuments({ status: 'approved' }),
        Device.countDocuments({ status: 'pending' }),
        Device.countDocuments({
          lastHeartbeat: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
          status: 'approved'
        })
      ]);
      
      return { total, approved, pending, online, offline: approved - online };
    } else {
      const { Op } = require('sequelize');
      const [total, approved, pending, online] = await Promise.all([
        Device.count(),
        Device.count({ where: { status: 'approved' } }),
        Device.count({ where: { status: 'pending' } }),
        Device.count({
          where: {
            lastHeartbeat: { [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) },
            status: 'approved'
          }
        })
      ]);
      
      return { total, approved, pending, online, offline: approved - online };
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

  // Pre-save middleware
  mongoSchema.pre('save', function(next) {
    if (this.macAddress) {
      this.macAddress = this.macAddress.toUpperCase();
    }
    next();
  });

  Device = mongoose.model('Device', mongoSchema);
} else {
  // PostgreSQL model
  const sequelize = database.getSequelize();
  
  Device = sequelize.define('Device', postgresSchema);

  // Add instance methods
  Object.keys(commonMethods).forEach(method => {
    Device.prototype[method] = commonMethods[method];
  });

  // Add static methods
  Object.keys(staticMethods).forEach(method => {
    Device[method] = staticMethods[method];
  });
}

module.exports = Device;
