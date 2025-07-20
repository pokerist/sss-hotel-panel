const mongoose = require('mongoose');

// MongoDB Schema (Mongoose)
const deviceSchema = new mongoose.Schema({
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

// Instance methods
deviceSchema.methods.updateHeartbeat = function() {
  this.lastHeartbeat = new Date();
  this.connectionStatus = 'online';
};

deviceSchema.methods.setOffline = function() {
  this.connectionStatus = 'offline';
};

deviceSchema.methods.setIdle = function() {
  this.connectionStatus = 'idle';
};

deviceSchema.methods.approve = function(userId) {
  this.status = 'approved';
  this.approvedBy = userId;
  this.approvedAt = new Date();
};

deviceSchema.methods.reject = function() {
  this.status = 'rejected';
};

deviceSchema.methods.assignRoom = function(roomNumber) {
  this.roomNumber = roomNumber;
};

deviceSchema.methods.updateConfiguration = function(config) {
  this.configuration = { ...this.configuration, ...config };
  
  // Update statistics
  const stats = this.statistics || {};
  stats.configPushCount = (stats.configPushCount || 0) + 1;
  stats.lastConfigPush = new Date();
  this.statistics = stats;
};

deviceSchema.methods.addAppToLayout = function(appId, position = null) {
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
};

deviceSchema.methods.removeAppFromLayout = function(appId) {
  const appLayout = this.configuration?.appLayout || [];
  const filteredLayout = appLayout.filter(app => app.appId.toString() !== appId.toString());
  
  this.configuration = {
    ...this.configuration,
    appLayout: filteredLayout
  };
};

deviceSchema.methods.reorderApps = function(appOrder) {
  const appLayout = appOrder.map((appId, index) => ({
    appId,
    position: index,
    isVisible: true
  }));

  this.configuration = {
    ...this.configuration,
    appLayout
  };
};

deviceSchema.methods.isOnline = function() {
  if (!this.lastHeartbeat) return false;
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.lastHeartbeat > fiveMinutesAgo;
};

deviceSchema.methods.getUptimeHours = function() {
  const stats = this.statistics || {};
  return Math.floor((stats.totalUptime || 0) / 3600);
};

deviceSchema.methods.incrementMessageCount = function() {
  const stats = this.statistics || {};
  stats.messagesReceived = (stats.messagesReceived || 0) + 1;
  this.statistics = stats;
};

// Static methods
deviceSchema.statics.findByUUID = async function(uuid) {
  return await this.findOne({ uuid });
};

deviceSchema.statics.findByMAC = async function(macAddress) {
  const mac = macAddress.toUpperCase();
  return await this.findOne({ macAddress: mac });
};

deviceSchema.statics.findByRoom = async function(roomNumber) {
  return await this.findOne({ roomNumber });
};

deviceSchema.statics.getOnlineDevices = async function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return await this.find({
    lastHeartbeat: { $gte: fiveMinutesAgo },
    status: 'approved'
  });
};

deviceSchema.statics.getPendingDevices = async function() {
  return await this.find({ status: 'pending' }).sort({ firstContact: -1 });
};

deviceSchema.statics.getDeviceStats = async function() {
  const [total, approved, pending, online] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ status: 'approved' }),
    this.countDocuments({ status: 'pending' }),
    this.countDocuments({
      lastHeartbeat: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
      status: 'approved'
    })
  ]);
  
  return { total, approved, pending, online, offline: approved - online };
};

// Pre-save middleware
deviceSchema.pre('save', function(next) {
  if (this.macAddress) {
    this.macAddress = this.macAddress.toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Device', deviceSchema);
