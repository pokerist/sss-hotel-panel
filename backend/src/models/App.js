const mongoose = require('mongoose');

const appSchema = new mongoose.Schema({
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
  category: {
    type: String,
    required: true,
    trim: true,
    enum: ['entertainment', 'utility', 'communication', 'productivity', 'games', 'lifestyle']
  },
  icon: {
    type: String,
    default: null
  },
  packageName: {
    type: String,
    trim: true,
    unique: true,
    sparse: true // Allows null/undefined values to bypass unique constraint
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  version: {
    type: String,
    default: '1.0.0',
    trim: true
  },
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
  statistics: {
    totalInstalls: {
      type: Number,
      default: 0
    },
    activeInstalls: {
      type: Number,
      default: 0
    },
    lastInstall: Date,
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    }
  }
}, {
  timestamps: true,
  indexes: [
    { name: 1 },
    { category: 1 },
    { packageName: 1 },
    { isActive: 1 }
  ]
});

// Instance methods
appSchema.methods.incrementInstalls = function() {
  this.statistics.totalInstalls += 1;
  this.statistics.activeInstalls += 1;
  this.statistics.lastInstall = new Date();
};

appSchema.methods.decrementActiveInstalls = function() {
  if (this.statistics.activeInstalls > 0) {
    this.statistics.activeInstalls -= 1;
  }
};

appSchema.methods.assignToDevice = function(deviceId) {
  if (!this.assignedDevices.includes(deviceId)) {
    this.assignedDevices.push(deviceId);
  }
};

appSchema.methods.removeFromDevice = function(deviceId) {
  this.assignedDevices = this.assignedDevices.filter(id => !id.equals(deviceId));
};

// Static methods
appSchema.statics.findByCategory = async function(category) {
  return await this.find({ category, isActive: true });
};

appSchema.statics.findByPackageName = async function(packageName) {
  return await this.findOne({ packageName });
};

appSchema.statics.getAppStats = async function() {
  const [total, active, categories] = await Promise.all([
    this.countDocuments(),
    this.countDocuments({ isActive: true }),
    this.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ])
  ]);

  const categoryStats = {};
  categories.forEach(cat => {
    categoryStats[cat._id] = cat.count;
  });

  return {
    total,
    active,
    byCategory: categoryStats
  };
};

// Pre-save middleware
appSchema.pre('save', function(next) {
  // Ensure version follows semver format
  if (this.isModified('version')) {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (!semverRegex.test(this.version)) {
      this.version = '1.0.0';
    }
  }
  next();
});

module.exports = mongoose.model('App', appSchema);
