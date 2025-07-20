const mongoose = require('mongoose');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const database = require('../config/database');

let User;

// MongoDB Schema (Mongoose)
const mongoSchema = new mongoose.Schema({
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

// PostgreSQL Schema (Sequelize)
const postgresSchema = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [6, 255]
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 100]
    }
  },
  role: {
    type: DataTypes.ENUM('super_admin', 'admin'),
    defaultValue: 'admin'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true
  },
  refreshTokens: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('refreshTokens');
      return value ? JSON.parse(value) : [];
    },
    set(value) {
      this.setDataValue('refreshTokens', JSON.stringify(value || []));
    }
  },
  profileImage: {
    type: DataTypes.STRING,
    allowNull: true
  },
  permissions: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('permissions');
      return value ? JSON.parse(value) : {
        canDeleteDevices: false,
        canManageAdmins: false,
        canChangeBranding: false,
        canConfigurePMS: false
      };
    },
    set(value) {
      this.setDataValue('permissions', JSON.stringify(value));
    }
  }
};

// Helper function to check if a string is already a bcrypt hash
const isBcryptHash = (str) => {
  return /^\$2[abxy]?\$\d+\$/.test(str);
};

// Common methods for both database types
const commonMethods = {
  async comparePassword(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  },

  async setPassword(password) {
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
  },

  addRefreshToken(token) {
    if (!this.refreshTokens) {
      this.refreshTokens = [];
    }
    this.refreshTokens.push(token);
    
    // Keep only last 5 refresh tokens
    if (this.refreshTokens.length > 5) {
      this.refreshTokens = this.refreshTokens.slice(-5);
    }
  },

  removeRefreshToken(token) {
    if (!this.refreshTokens) {
      return;
    }
    this.refreshTokens = this.refreshTokens.filter(t => t !== token);
  },

  updateLastLogin() {
    this.lastLogin = new Date();
  },

  hasPermission(permission) {
    if (this.role === 'super_admin') {
      return true;
    }
    return this.permissions && this.permissions[permission];
  },

  toJSON() {
    const obj = this.toObject ? this.toObject() : { ...this.dataValues };
    delete obj.password;
    delete obj.refreshTokens;
    return obj;
  }
};

// Static methods
const staticMethods = {
  async findByEmail(email) {
    const dbType = process.env.DB_TYPE || 'mongodb';
    if (dbType === 'mongodb') {
      // Use native mongoose query to avoid recursion - don't call findOne on the model
      const connection = mongoose.connection;
      const collection = connection.collection('users');
      const doc = await collection.findOne({ email: email.toLowerCase() });
      if (!doc) return null;
      
      // Convert plain object to mongoose document
      const UserModel = mongoose.model('User');
      return new UserModel(doc);
    } else {
      // Use Sequelize model directly  
      const sequelize = database.getSequelize();
      const UserModel = sequelize.models.User;
      return await UserModel.findOne({ where: { email: email.toLowerCase() } });
    }
  },

  async findById(id) {
    const dbType = process.env.DB_TYPE || 'mongodb';
    if (dbType === 'mongodb') {
      // Use native mongoose query to avoid recursion - don't call findById on the model
      const connection = mongoose.connection;
      const collection = connection.collection('users');
      const doc = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
      if (!doc) return null;
      
      // Convert plain object to mongoose document
      const UserModel = mongoose.model('User');
      return new UserModel(doc);
    } else {
      // Use Sequelize model directly
      const sequelize = database.getSequelize();
      const UserModel = sequelize.models.User;
      return await UserModel.findByPk(id);
    }
  },

  async createUser(userData) {
    const dbType = process.env.DB_TYPE || 'mongodb';
    let user;
    
    if (dbType === 'mongodb') {
      const UserModel = mongoose.model('User');
      user = new UserModel(userData);
    } else {
      const sequelize = database.getSequelize();
      const UserModel = sequelize.models.User;
      user = UserModel.build(userData);
    }
    
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

  // Pre-save middleware for password hashing
  mongoSchema.pre('save', async function(next) {
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

  User = mongoose.model('User', mongoSchema);
} else {
  // PostgreSQL model
  const sequelize = database.getSequelize();
  
  User = sequelize.define('User', postgresSchema, {
    hooks: {
      beforeSave: async (user) => {
        if (user.changed('password')) {
          // Skip hashing if password was already hashed manually or is already a bcrypt hash
          if (user._passwordAlreadyHashed || isBcryptHash(user.password)) {
            // Reset the flag for next time
            user._passwordAlreadyHashed = false;
            return;
          }
          await user.setPassword(user.password);
        }
      }
    }
  });

  // Add instance methods
  Object.keys(commonMethods).forEach(method => {
    User.prototype[method] = commonMethods[method];
  });

  // Add static methods
  Object.keys(staticMethods).forEach(method => {
    User[method] = staticMethods[method];
  });
}

module.exports = User;
