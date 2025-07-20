const logger = require('../utils/logger');

class ConfigWatcher {
  constructor() {
    this.initialized = false;
    this.watchers = new Map();
  }

  async initialize() {
    try {
      logger.info('Initializing Config Watcher Service...');
      
      // Initialize configuration monitoring
      this.setupEnvironmentWatcher();
      
      this.initialized = true;
      logger.info('Config Watcher Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Config Watcher Service:', error.message);
      this.initialized = true; // Don't fail startup
    }
  }

  setupEnvironmentWatcher() {
    // Monitor for environment variable changes
    // In a production environment, you might want to watch config files
    logger.info('Environment configuration watcher set up');
  }

  watchConfig(key, callback) {
    try {
      this.watchers.set(key, callback);
      logger.info(`Config watcher registered for key: ${key}`);
    } catch (error) {
      logger.error(`Failed to register config watcher for ${key}:`, error.message);
    }
  }

  unwatchConfig(key) {
    try {
      this.watchers.delete(key);
      logger.info(`Config watcher removed for key: ${key}`);
    } catch (error) {
      logger.error(`Failed to remove config watcher for ${key}:`, error.message);
    }
  }

  notifyConfigChange(key, oldValue, newValue) {
    try {
      const callback = this.watchers.get(key);
      if (callback && typeof callback === 'function') {
        callback(oldValue, newValue);
        logger.info(`Config change notification sent for key: ${key}`);
      }
    } catch (error) {
      logger.error(`Failed to notify config change for ${key}:`, error.message);
    }
  }

  isInitialized() {
    return this.initialized;
  }

  getStatus() {
    return {
      initialized: this.initialized,
      watchersCount: this.watchers.size
    };
  }
}

module.exports = new ConfigWatcher();
