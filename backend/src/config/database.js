const mongoose = require('mongoose');
const logger = require('../utils/logger');

let db = null;

const database = {
  async connect() {
    try {
      await this.connectMongoDB();
      logger.info('Connected to MongoDB database successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  },

  async connectMongoDB() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/iptv_hotel';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      connectTimeoutMS: 10000, // Give up initial connection after 10s
    });

    db = mongoose.connection;

    // MongoDB connection events
    db.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    db.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    db.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  },

  async disconnect() {
    try {
      if (db) {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected');
      }
    } catch (error) {
      logger.error('Database disconnection error:', error);
    }
  },

  getConnection() {
    return db;
  },

  isConnected() {
    return mongoose.connection.readyState === 1;
  }
};

module.exports = database;
