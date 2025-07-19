const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(logColors);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define log format for files (no colors)
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => {
      const { timestamp, level, message, ...meta } = info;
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
    }
  )
);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');

// Configure daily rotate file transport
const fileRotateTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: process.env.LOG_RETENTION_DAYS || '30d',
  format: fileLogFormat,
  level: process.env.LOG_LEVEL || 'info'
});

// Configure error log file transport
const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: process.env.LOG_RETENTION_DAYS || '30d',
  format: fileLogFormat,
  level: 'error'
});

// Create logger instance
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: logFormat,
      silent: process.env.NODE_ENV === 'test'
    }),
    // File transports
    fileRotateTransport,
    errorFileTransport
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileLogFormat
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      format: fileLogFormat
    })
  ]
});

// Custom logging methods for specific use cases
logger.logActivity = (action, userId, details = {}) => {
  logger.info(`Admin Action: ${action}`, {
    userId,
    action,
    timestamp: new Date().toISOString(),
    ...details
  });
};

logger.logPMSSync = (success, roomNumber, error = null) => {
  const level = success ? 'info' : 'error';
  const message = success 
    ? `PMS sync successful for room ${roomNumber}` 
    : `PMS sync failed for room ${roomNumber}: ${error}`;
  
  logger[level](message, {
    type: 'PMS_SYNC',
    roomNumber,
    success,
    error,
    timestamp: new Date().toISOString()
  });
};

logger.logDeviceEvent = (event, deviceId, details = {}) => {
  logger.info(`Device Event: ${event}`, {
    type: 'DEVICE_EVENT',
    deviceId,
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

logger.logSystemEvent = (event, details = {}) => {
  logger.info(`System Event: ${event}`, {
    type: 'SYSTEM_EVENT',
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
};

// Handle log rotation events
fileRotateTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info(`Log file rotated: ${oldFilename} -> ${newFilename}`);
});

fileRotateTransport.on('new', (newFilename) => {
  logger.info(`New log file created: ${newFilename}`);
});

errorFileTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info(`Error log file rotated: ${oldFilename} -> ${newFilename}`);
});

module.exports = logger;
