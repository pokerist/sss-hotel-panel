const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Helper function to check if a string is already a bcrypt hash
const isBcryptHash = (str) => {
  return /^\$2[abxy]?\$\d+\$/.test(str);
};

// MongoDB Schema (Mongoose)
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: [6, 'Password must be at least 6 characters long']
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin'],
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  refreshTokens: [{
    type: String
  }],
  profileImage: {
    type: String,
    default: null
  },
  permissions: {
    canDeleteDevices: {
      type: Boolean,
      default: false
    },
    canManageAdmins: {
      type: Boolean,
      default: false
    },
    canChangeBranding: {
      type: Boolean,
      default: false
    },
    canConfigurePMS: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshTokens;
      return ret;
    }
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.setPassword = async function(password) {
  // Don't hash if password is already a bcrypt hash
  if (isBcryptHash(password)) {
    this.password = password;
    // Set flag to prevent double-hashing in hooks
    this._passwordAlreadyHashed = true;
    return;
  }
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(password, salt);
  // Set flag to prevent double-hashing in hooks
  this._passwordAlreadyHashed = true;
};

userSchema.methods.addRefreshToken = function(token) {
  if (!this.refreshTokens) {
    this.refreshTokens = [];
  }
  this.refreshTokens.push(token);
  
  // Keep only last 5 refresh tokens
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
};

userSchema.methods.removeRefreshToken = function(token) {
  if (!this.refreshTokens) {
    return;
  }
  this.refreshTokens = this.refreshTokens.filter(t => t !== token);
};

userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
};

userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'super_admin') {
    return true;
  }
  return this.permissions && this.permissions[permission];
};

// Static methods
userSchema.statics.findByEmail = async function(email) {
  return await this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.createUser = async function(userData) {
  const user = new this(userData);
  
  if (userData.password) {
    await user.setPassword(userData.password);
  }
  
  // Set permissions based on role
  if (userData.role === 'super_admin') {
    user.permissions = {
      canDeleteDevices: true,
      canManageAdmins: true,
      canChangeBranding: true,
      canConfigurePMS: true
    };
  }
  
  return await user.save();
};

// Pre-save middleware for password hashing
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  // Skip hashing if password was already hashed manually or is already a bcrypt hash
  if (this._passwordAlreadyHashed || isBcryptHash(this.password)) {
    // Reset the flag for next time
    this._passwordAlreadyHashed = false;
    return next();
  }
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', userSchema);
