const mongoose = require('mongoose');
const { Sequelize, DataTypes } = require('sequelize');
const database = require('../config/database');

let Settings;

// MongoDB Schema (Mongoose)
const mongoSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  type: {
    type: String,
    enum: ['string', 'number', 'boolean', 'object', 'array'],
    required: true
  },
  category: {
    type: String,
    enum: ['system', 'pms', 'branding', 'security', 'logging'],
    default: 'system'
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isEditable: {
    type: Boolean,
    default: true
  },
  isSecret: {
    type: Boolean,
    default: false
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed
  },
  validation: {
    min: Number,
    max: Number,
    pattern: String,
    options: [String],
    required: {
      type: Boolean,
      default: false
    }
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  indexes: [
    { key: 1 },
    { category: 1 }
  ]
});

// PostgreSQL Schema (Sequelize)
const postgresSchema = {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const rawValue = this.getDataValue('value');
      const type = this.getDataValue('type');
      
      if (!rawValue) return null;
      
      try {
        switch (type) {
          case 'number':
            return Number(rawValue);
          case 'boolean':
            return rawValue === 'true';
          case 'object':
          case 'array':
            return JSON.parse(rawValue);
          default:
            return rawValue;
        }
      } catch (error) {
        return rawValue;
      }
    },
    set(value) {
      const type = this.getDataValue('type');
      
      if (value === null || value === undefined) {
        this.setDataValue('value', null);
        return;
      }
      
      switch (type) {
        case 'object':
        case 'array':
          this.setDataValue('value', JSON.stringify(value));
          break;
        default:
          this.setDataValue('value', String(value));
      }
    }
  },
  type: {
    type: DataTypes.ENUM('string', 'number', 'boolean', 'object', 'array'),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('system', 'pms', 'branding', 'security', 'logging'),
    defaultValue: 'system'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  isEditable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isSecret: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  defaultValue: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const rawValue = this.getDataValue('defaultValue');
      const type = this.getDataValue('type');
      
      if (!rawValue) return null;
      
      try {
        switch (type) {
          case 'number':
            return Number(rawValue);
          case 'boolean':
            return rawValue === 'true';
          case 'object':
          case 'array':
            return JSON.parse(rawValue);
          default:
            return rawValue;
        }
      } catch (error) {
        return rawValue;
      }
    },
    set(value) {
      if (value === null || value === undefined) {
        this.setDataValue('defaultValue', null);
        return;
      }
      
      const type = this.getDataValue('type');
      switch (type) {
        case 'object':
        case 'array':
          this.setDataValue('defaultValue', JSON.stringify(value));
          break;
        default:
          this.setDataValue('defaultValue', String(value));
      }
    }
  },
  validation: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const value = this.getDataValue('validation');
      return value ? JSON.parse(value) : {};
    },
    set(value) {
      this.setDataValue('validation', JSON.stringify(value || {}));
    }
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
};

// Common methods for both database types
const commonMethods = {
  validateValue(value) {
    const validation = this.validation || {};
    
    // Type validation
    switch (this.type) {
      case 'number':
        if (isNaN(Number(value))) {
          throw new Error('Value must be a valid number');
        }
        const numValue = Number(value);
        if (validation.min !== undefined && numValue < validation.min) {
          throw new Error(`Value must be at least ${validation.min}`);
        }
        if (validation.max !== undefined && numValue > validation.max) {
          throw new Error(`Value must not exceed ${validation.max}`);
        }
        break;
        
      case 'string':
        if (typeof value !== 'string') {
          throw new Error('Value must be a string');
        }
        if (validation.pattern) {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(value)) {
            throw new Error('Value does not match required pattern');
          }
        }
        if (validation.options && !validation.options.includes(value)) {
          throw new Error(`Value must be one of: ${validation.options.join(', ')}`);
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          throw new Error('Value must be a boolean');
        }
        break;
        
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          throw new Error('Value must be an object');
        }
        break;
        
      case 'array':
        if (!Array.isArray(value)) {
          throw new Error('Value must be an array');
        }
        break;
    }
    
    return true;
  },

  setValue(value, userId = null) {
    this.validateValue(value);
    this.value = value;
    this.updatedBy = userId;
  },

  resetToDefault() {
    if (this.defaultValue !== undefined && this.defaultValue !== null) {
      this.value = this.defaultValue;
    }
  },

  toJSON() {
    const obj = this.toObject ? this.toObject() : { ...this.dataValues };
    
    // Hide secret values
    if (this.isSecret && obj.value) {
      obj.value = '***HIDDEN***';
    }
    
    return obj;
  }
};

// Static methods
const staticMethods = {
  async get(key, defaultValue = null) {
    const dbType = process.env.DB_TYPE || 'mongodb';
    let setting;
    
    if (dbType === 'mongodb') {
      setting = await Settings.findOne({ key });
    } else {
      setting = await Settings.findOne({ where: { key } });
    }
    
    if (!setting) {
      return defaultValue;
    }
    
    return setting.value;
  },

  async set(key, value, userId = null) {
    const dbType = process.env.DB_TYPE || 'mongodb';
    let setting;
    
    if (dbType === 'mongodb') {
      setting = await Settings.findOne({ key });
    } else {
      setting = await Settings.findOne({ where: { key } });
    }
    
    if (!setting) {
      throw new Error(`Setting '${key}' not found`);
    }
    
    if (!setting.isEditable) {
      throw new Error(`Setting '${key}' is not editable`);
    }
    
    setting.setValue(value, userId);
    return await setting.save();
  },

  async getByCategory(category) {
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      return await Settings.find({ category });
    } else {
      return await Settings.findAll({ where: { category } });
    }
  },

  async getAllEditable() {
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      return await Settings.find({ isEditable: true });
    } else {
      return await Settings.findAll({ where: { isEditable: true } });
    }
  },

  async initializeDefaultSettings() {
    const defaultSettings = [
      // System Settings
      {
        key: 'pms_polling_interval',
        value: 15,
        type: 'number',
        category: 'pms',
        description: 'PMS synchronization interval in minutes',
        defaultValue: 15,
        validation: { min: 1, max: 1440 }
      },
      {
        key: 'panel_name',
        value: 'Hotel IPTV Panel',
        type: 'string',
        category: 'branding',
        description: 'Name of the IPTV panel displayed to users'
      },
      {
        key: 'log_retention_days',
        value: 30,
        type: 'number',
        category: 'logging',
        description: 'Number of days to keep log entries',
        defaultValue: 30,
        validation: { min: 1, max: 365 }
      },
      {
        key: 'max_device_heartbeat_minutes',
        value: 5,
        type: 'number',
        category: 'system',
        description: 'Minutes before device is considered offline',
        defaultValue: 5,
        validation: { min: 1, max: 60 }
      },
      {
        key: 'auto_approve_devices',
        value: false,
        type: 'boolean',
        category: 'security',
        description: 'Automatically approve new device registrations'
      },
      {
        key: 'guest_message_templates',
        value: {
          welcome: 'Welcome, {{guest_name}}! We hope you enjoy your stay in room {{room_number}}.',
          farewell: 'Dear {{guest_name}}, we hope you had a great stay. Checkout is at {{check_out_time}}. Safe travels!'
        },
        type: 'object',
        category: 'system',
        description: 'Template messages for guest welcome and farewell'
      },
      {
        key: 'pms_base_url',
        value: '',
        type: 'string',
        category: 'pms',
        description: 'Base URL for PMS API integration'
      },
      {
        key: 'pms_endpoints',
        value: {
          guests: '/guest/v0/guests',
          reservations: '/reservation/v0/reservations',
          folios: '/folio/v0/folios'
        },
        type: 'object',
        category: 'pms',
        description: 'PMS API endpoint configurations'
      },
      {
        key: 'welcome_message_delay_minutes',
        value: 0,
        type: 'number',
        category: 'system',
        description: 'Minutes after check-in to send welcome message',
        defaultValue: 0,
        validation: { min: 0, max: 1440 }
      },
      {
        key: 'farewell_message_minutes_before_checkout',
        value: 15,
        type: 'number',
        category: 'system',
        description: 'Minutes before checkout to send farewell message',
        defaultValue: 15,
        validation: { min: 0, max: 1440 }
      }
    ];

    const dbType = process.env.DB_TYPE || 'mongodb';
    
    for (const settingData of defaultSettings) {
      let existingSetting;
      
      if (dbType === 'mongodb') {
        existingSetting = await Settings.findOne({ key: settingData.key });
      } else {
        existingSetting = await Settings.findOne({ where: { key: settingData.key } });
      }
      
      if (!existingSetting) {
        const setting = new Settings(settingData);
        await setting.save();
      }
    }
  },

  async backup() {
    const dbType = process.env.DB_TYPE || 'mongodb';
    let settings;
    
    if (dbType === 'mongodb') {
      settings = await Settings.find();
    } else {
      settings = await Settings.findAll();
    }
    
    return settings.map(setting => ({
      key: setting.key,
      value: setting.isSecret ? '***BACKUP_HIDDEN***' : setting.value,
      type: setting.type,
      category: setting.category
    }));
  },

  async restore(backupData, userId = null) {
    const results = [];
    
    for (const item of backupData) {
      if (item.value === '***BACKUP_HIDDEN***') {
        continue; // Skip secret values in restore
      }
      
      try {
        await Settings.set(item.key, item.value, userId);
        results.push({ key: item.key, status: 'success' });
      } catch (error) {
        results.push({ key: item.key, status: 'error', error: error.message });
      }
    }
    
    return results;
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

  Settings = mongoose.model('Settings', mongoSchema);
} else {
  // PostgreSQL model
  const sequelize = database.getSequelize();
  
  Settings = sequelize.define('Settings', postgresSchema);

  // Add instance methods
  Object.keys(commonMethods).forEach(method => {
    Settings.prototype[method] = commonMethods[method];
  });

  // Add static methods
  Object.keys(staticMethods).forEach(method => {
    Settings[method] = staticMethods[method];
  });
}

module.exports = Settings;
