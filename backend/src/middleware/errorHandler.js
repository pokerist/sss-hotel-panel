const logger = require('../utils/logger');

const errorHandler = (error, req, res, next) => {
  logger.error('Error caught by middleware:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    user: req.user ? { id: req.user.id, email: req.user.email } : null
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    // Mongoose/Sequelize validation error
    statusCode = 400;
    message = 'Validation Error';
    details = Object.values(error.errors || {}).map(err => err.message);
  } else if (error.name === 'CastError') {
    // MongoDB ObjectId casting error
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    message = 'Duplicate entry';
    const field = Object.keys(error.keyPattern || {})[0];
    details = field ? `${field} already exists` : 'Duplicate entry detected';
  } else if (error.name === 'SequelizeUniqueConstraintError') {
    // PostgreSQL unique constraint error
    statusCode = 409;
    message = 'Duplicate entry';
    details = error.errors?.map(err => err.message) || ['Duplicate entry detected'];
  } else if (error.name === 'SequelizeValidationError') {
    // PostgreSQL validation error
    statusCode = 400;
    message = 'Validation Error';
    details = error.errors?.map(err => err.message) || ['Validation failed'];
  } else if (error.name === 'MulterError') {
    // File upload error
    statusCode = 400;
    message = 'File upload error';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        details = 'File size too large';
        break;
      case 'LIMIT_FILE_COUNT':
        details = 'Too many files';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        details = 'Unexpected file field';
        break;
      default:
        details = error.message;
    }
  } else if (error.status || error.statusCode) {
    // Custom status code
    statusCode = error.status || error.statusCode;
    message = error.message || message;
  } else if (error.message) {
    // Custom error with message
    message = error.message;
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
    details = null;
  }

  const response = {
    success: false,
    message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      originalError: error.message
    })
  };

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
