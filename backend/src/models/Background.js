const mongoose = require('mongoose');

const backgroundSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  filename: {
    type: String,
    required: true,
    unique: true
  },
  originalName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  dimensions: {
    width: Number,
    height: Number
  },
  duration: {
    type: Number,
    default: null // For videos only
  },
  bundleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BackgroundBundle',
    default: null
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  assignedDevices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  }],
  metadata: {
    tags: [String],
    description: String,
    season: {
      type: String,
      enum: ['spring', 'summer', 'autumn', 'winter', 'all'],
      default: 'all'
    },
    timeOfDay: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', 'all'],
      default: 'all'
    }
  }
}, {
  timestamps: true,
  indexes: [
    { filename: 1 },
    { type: 1 },
    { bundleId: 1 },
    { isActive: 1 },
    { 'metadata.tags': 1 }
  ]
});

// Instance methods
backgroundSchema.methods.assignToDevice = function(deviceId) {
  if (!this.assignedDevices.includes(deviceId)) {
    this.assignedDevices.push(deviceId);
  }
};

backgroundSchema.methods.removeFromDevice = function(deviceId) {
  this.assignedDevices = this.assignedDevices.filter(id => !id.equals(deviceId));
};

backgroundSchema.methods.assignToBundle = function(bundleId) {
  this.bundleId = bundleId;
};

backgroundSchema.methods.removeFromBundle = function() {
  this.bundleId = null;
};

// Static methods
backgroundSchema.statics.findByType = async function(type) {
  return await this.find({ type, isActive: true });
};

backgroundSchema.statics.findByBundle = async function(bundleId) {
  return await this.find({ bundleId, isActive: true });
};

backgroundSchema.statics.getBackgroundStats = async function() {
  const [total, active, byType] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ isActive: true }),
    this.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 }, totalSize: { $sum: '$size' } } }
    ])
  ]);

  const typeStats = {};
  byType.forEach(type => {
    typeStats[type._id] = {
      count: type.count,
      totalSize: type.totalSize
    };
  });

  return {
    total,
    active,
    byType: typeStats
  };
};

// Pre-save middleware
backgroundSchema.pre('save', function(next) {
  // Ensure path starts with /uploads/
  if (this.isModified('path') && !this.path.startsWith('/uploads/')) {
    this.path = '/uploads/backgrounds/' + this.filename;
  }
  next();
});

module.exports = mongoose.model('Background', backgroundSchema);
