const mongoose = require('mongoose');

const backgroundBundleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  backgrounds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Background'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  assignedDevices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  settings: {
    displayDuration: {
      type: Number,
      default: 30, // seconds
      min: 5,
      max: 3600
    },
    transitionEffect: {
      type: String,
      enum: ['fade', 'slide', 'zoom', 'none'],
      default: 'fade'
    },
    transitionDuration: {
      type: Number,
      default: 1, // seconds
      min: 0.5,
      max: 5
    },
    shuffleEnabled: {
      type: Boolean,
      default: false
    },
    schedule: {
      enabled: {
        type: Boolean,
        default: false
      },
      startTime: String, // HH:mm format
      endTime: String, // HH:mm format
      daysOfWeek: [{
        type: Number,
        min: 0,
        max: 6
      }]
    }
  },
  statistics: {
    totalBackgrounds: {
      type: Number,
      default: 0
    },
    totalSize: {
      type: Number,
      default: 0
    },
    imageCount: {
      type: Number,
      default: 0
    },
    videoCount: {
      type: Number,
      default: 0
    },
    lastUpdated: Date
  }
}, {
  timestamps: true,
  indexes: [
    { name: 1 },
    { isActive: 1 },
    { createdBy: 1 }
  ]
});

// Instance methods
backgroundBundleSchema.methods.assignToDevice = function(deviceId) {
  if (!this.assignedDevices.includes(deviceId)) {
    this.assignedDevices.push(deviceId);
  }
};

backgroundBundleSchema.methods.removeFromDevice = function(deviceId) {
  this.assignedDevices = this.assignedDevices.filter(id => !id.equals(deviceId));
};

backgroundBundleSchema.methods.addBackground = function(backgroundId) {
  if (!this.backgrounds.includes(backgroundId)) {
    this.backgrounds.push(backgroundId);
  }
};

backgroundBundleSchema.methods.removeBackground = function(backgroundId) {
  this.backgrounds = this.backgrounds.filter(id => !id.equals(backgroundId));
};

backgroundBundleSchema.methods.updateStatistics = async function() {
  const Background = mongoose.model('Background');
  const backgrounds = await Background.find({ _id: { $in: this.backgrounds } });
  
  this.statistics.totalBackgrounds = backgrounds.length;
  this.statistics.imageCount = backgrounds.filter(bg => bg.type === 'image').length;
  this.statistics.videoCount = backgrounds.filter(bg => bg.type === 'video').length;
  this.statistics.totalSize = backgrounds.reduce((sum, bg) => sum + bg.size, 0);
  this.statistics.lastUpdated = new Date();
};

// Static methods
backgroundBundleSchema.statics.findActive = async function() {
  return await this.find({ isActive: true });
};

backgroundBundleSchema.statics.findByDevice = async function(deviceId) {
  return await this.find({ assignedDevices: deviceId, isActive: true });
};

backgroundBundleSchema.statics.getBundleStats = async function() {
  const [total, active, deviceAssignments] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ isActive: true }),
    this.aggregate([
      { $project: { assignedDeviceCount: { $size: '$assignedDevices' } } },
      { $group: { _id: null, totalAssignments: { $sum: '$assignedDeviceCount' } } }
    ])
  ]);

  return {
    total,
    active,
    totalAssignments: deviceAssignments[0]?.totalAssignments || 0
  };
};

// Pre-save middleware
backgroundBundleSchema.pre('save', async function(next) {
  if (this.isModified('backgrounds')) {
    await this.updateStatistics();
  }
  next();
});

module.exports = mongoose.model('BackgroundBundle', backgroundBundleSchema);
