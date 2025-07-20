const mongoose = require('mongoose');

// MongoDB Schema (Mongoose)
const settingsSchema = new mongoose.Schema({
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

// Instance methods
settingsSchema.methods.validateValue = function(value) {
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
};

settingsSchema.methods.setValue = function(value, userId = null) {
  this.validateValue(value);
  this.value = value;
  this.updatedBy = userId;
};

settingsSchema.methods.resetToDefault = function() {
  if (this.defaultValue !== undefined && this.defaultValue !== null) {
    this.value = this.defaultValue;
  }
};

settingsSchema.methods.toJSON = function() {
  const obj = this.toObject();
  
  // Hide secret values
  if (this.isSecret && obj.value) {
    obj.value = '***HIDDEN***';
  }
  
  return obj;
};

// Static methods
settingsSchema.statics.get = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key });
  
  if (!setting) {
    return defaultValue;
  }
  
  return setting.value;
};

settingsSchema.statics.set = async function(key, value, userId = null) {
  const setting = await this.findOne({ key });
  
  if (!setting) {
    throw new Error(`Setting '${key}' not found`);
  }
  
  if (!setting.isEditable) {
    throw new Error(`Setting '${key}' is not editable`);
  }
  
  setting.setValue(value, userId);
  return await setting.save();
};

settingsSchema.statics.getByCategory = async function(category) {
  return await this.find({ category });
};

settingsSchema.statics.getAllEditable = async function() {
  return await this.find({ isEditable: true });
};

settingsSchema.statics.initializeDefaultSettings = async function() {
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

  for (const settingData of defaultSettings) {
    const existingSetting = await this.findOne({ key: settingData.key });
    
    if (!existingSetting) {
      const setting = new this(settingData);
      await setting.save();
    }
  }
};

settingsSchema.statics.backup = async function() {
  const settings = await this.find();
  
  return settings.map(setting => ({
    key: setting.key,
    value: setting.isSecret ? '***BACKUP_HIDDEN***' : setting.value,
    type: setting.type,
    category: setting.category
  }));
};

settingsSchema.statics.restore = async function(backupData, userId = null) {
  const results = [];
  
  for (const item of backupData) {
    if (item.value === '***BACKUP_HIDDEN***') {
      continue; // Skip secret values in restore
    }
    
    try {
      await this.set(item.key, item.value, userId);
      results.push({ key: item.key, status: 'success' });
    } catch (error) {
      results.push({ key: item.key, status: 'error', error: error.message });
    }
  }
  
  return results;
};

module.exports = mongoose.model('Settings', settingsSchema);
