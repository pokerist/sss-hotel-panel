const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// JWT Authentication middleware for HTTP requests
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token - user not found' 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is inactive' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }

    logger.error('Authentication error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};

// Role-based authorization middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.logActivity('UNAUTHORIZED_ACCESS_ATTEMPT', req.user.id, {
        requiredRoles: roles,
        userRole: req.user.role,
        endpoint: req.path,
        method: req.method
      });

      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
    }

    next();
  };
};

// Super Admin only middleware
const requireSuperAdmin = requireRole('super_admin');

// Admin or Super Admin middleware
const requireAdmin = requireRole('admin', 'super_admin');

// Socket.IO authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error('Invalid token - user not found'));
    }

    if (!user.isActive) {
      return next(new Error('Account is inactive'));
    }

    socket.user = user;
    socket.userId = user.id;
    socket.userRole = user.role;

    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

// Device authentication middleware (for launcher devices)
const authenticateDevice = async (req, res, next) => {
  try {
    const deviceUUID = req.headers['x-device-uuid'];
    const deviceMAC = req.headers['x-device-mac'];

    if (!deviceUUID || !deviceMAC) {
      return res.status(401).json({
        success: false,
        message: 'Device UUID and MAC address required'
      });
    }

    // Find device in database
    const Device = require('../models/Device');
    const device = await Device.findByUUID(deviceUUID);

    if (!device) {
      return res.status(401).json({
        success: false,
        message: 'Device not registered',
        code: 'DEVICE_NOT_REGISTERED'
      });
    }

    if (device.macAddress !== deviceMAC) {
      return res.status(401).json({
        success: false,
        message: 'MAC address mismatch',
        code: 'MAC_MISMATCH'
      });
    }

    if (device.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Device not approved',
        code: 'DEVICE_NOT_APPROVED'
      });
    }

    req.device = device;
    next();
  } catch (error) {
    logger.error('Device authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Device authentication failed'
    });
  }
};

// Refresh token validation
const validateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token - user not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Check if refresh token is in user's valid tokens (optional security enhancement)
    if (user.refreshTokens && !user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    req.user = user;
    req.refreshToken = refreshToken;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    logger.error('Refresh token validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Refresh token validation failed'
    });
  }
};

// Activity logging middleware
const logActivity = (action) => {
  return (req, res, next) => {
    // Store original res.json to intercept successful responses
    const originalJson = res.json;
    
    res.json = function(data) {
      // Only log if request was successful
      if (res.statusCode < 400) {
        logger.logActivity(action, req.user?.id, {
          endpoint: req.path,
          method: req.method,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
          body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined
        });
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  authenticateSocket,
  authenticateDevice,
  validateRefreshToken,
  logActivity
};
