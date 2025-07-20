const axios = require('axios');
const logger = require('../utils/logger');

class PMSService {
  constructor() {
    this.baseURL = process.env.PMS_BASE_URL;
    this.initialized = false;
    this.connected = false;
  }

  async initialize() {
    try {
      logger.info('Initializing PMS Service...');
      
      if (!this.baseURL) {
        logger.warn('PMS_BASE_URL not configured, skipping PMS initialization');
        this.initialized = true;
        return;
      }

      // Test connection
      await this.testConnection();
      this.initialized = true;
      logger.info('PMS Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PMS Service:', error.message);
      this.initialized = true; // Don't fail startup
    }
  }

  async testConnection() {
    try {
      if (!this.baseURL) {
        throw new Error('PMS_BASE_URL not configured');
      }

      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });
      
      this.connected = response.status === 200;
      return this.connected;
    } catch (error) {
      this.connected = false;
      logger.warn('PMS connection test failed:', error.message);
      return false;
    }
  }

  async getGuestByRoom(roomNumber) {
    try {
      if (!this.connected) {
        throw new Error('PMS not connected');
      }

      const response = await axios.get(`${this.baseURL}/guest/v0/guests`, {
        params: { roomNumber },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to get guest for room ${roomNumber}:`, error.message);
      throw error;
    }
  }

  async getReservationByRoom(roomNumber) {
    try {
      if (!this.connected) {
        throw new Error('PMS not connected');
      }

      const response = await axios.get(`${this.baseURL}/reservation/v0/reservations`, {
        params: { roomNumber },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to get reservation for room ${roomNumber}:`, error.message);
      throw error;
    }
  }

  async syncGuests() {
    try {
      if (!this.connected) {
        logger.warn('PMS not connected, skipping sync');
        return { success: false, message: 'PMS not connected' };
      }

      logger.info('Starting PMS guest sync...');
      
      const response = await axios.get(`${this.baseURL}/guest/v0/guests`, {
        timeout: 30000
      });

      const guests = response.data;
      logger.info(`Synced ${guests?.length || 0} guests from PMS`);

      return { 
        success: true, 
        guestsCount: guests?.length || 0,
        message: 'Sync completed successfully'
      };
    } catch (error) {
      logger.error('PMS sync failed:', error.message);
      return { 
        success: false, 
        message: error.message 
      };
    }
  }

  isConnected() {
    return this.connected;
  }

  getStatus() {
    return {
      initialized: this.initialized,
      connected: this.connected,
      baseURL: this.baseURL,
      mockMode: process.env.USE_MOCK_PMS === 'true'
    };
  }
}

module.exports = new PMSService();
