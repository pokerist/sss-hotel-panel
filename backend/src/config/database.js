const mongoose = require('mongoose');
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

let db = null;
let sequelize = null;

const database = {
  async connect() {
    try {
      const dbType = process.env.DB_TYPE || 'mongodb';
      
      if (dbType === 'mongodb') {
        await this.connectMongoDB();
      } else if (dbType === 'postgresql') {
        await this.connectPostgreSQL();
      } else {
        throw new Error(`Unsupported database type: ${dbType}`);
      }
      
      logger.info(`Connected to ${dbType} database successfully`);
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  },

  async connectMongoDB() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/iptv_hotel';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
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

  async connectPostgreSQL() {
    const config = {
      host: process.env.PG_HOST || 'localhost',
      port: process.env.PG_PORT || 5432,
      database: process.env.PG_DATABASE || 'iptv_hotel',
      username: process.env.PG_USERNAME || 'postgres',
      password: process.env.PG_PASSWORD || 'password',
      dialect: 'postgres',
      logging: (msg) => logger.debug(msg),
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    };

    sequelize = new Sequelize(config);
    await sequelize.authenticate();
    
    // Sync database tables (in development)
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
    }
  },

  async disconnect() {
    try {
      const dbType = process.env.DB_TYPE || 'mongodb';
      
      if (dbType === 'mongodb' && db) {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected');
      } else if (dbType === 'postgresql' && sequelize) {
        await sequelize.close();
        logger.info('PostgreSQL disconnected');
      }
    } catch (error) {
      logger.error('Database disconnection error:', error);
    }
  },

  getConnection() {
    const dbType = process.env.DB_TYPE || 'mongodb';
    return dbType === 'mongodb' ? db : sequelize;
  },

  getSequelize() {
    return sequelize;
  },

  isConnected() {
    const dbType = process.env.DB_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      return mongoose.connection.readyState === 1;
    } else if (dbType === 'postgresql') {
      return sequelize && sequelize.authenticate !== undefined;
    }
    
    return false;
  }
};

module.exports = database;
