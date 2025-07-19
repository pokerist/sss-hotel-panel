const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const database = require('./config/database');
const logger = require('./utils/logger');
const { authenticateSocket } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const backgroundRoutes = require('./routes/backgrounds');
const appRoutes = require('./routes/apps');
const settingsRoutes = require('./routes/settings');
const pmsRoutes = require('./routes/pms');
const launcherRoutes = require('./routes/launcher');
const logsRoutes = require('./routes/logs');

// Import services
const PMSService = require('./services/pmsService');
const ConfigWatcher = require('./services/configWatcher');
const DeviceManager = require('./services/deviceManager');
const GuestAutomation = require('./services/guestAutomation');

// Import mock PMS server
const startMockPMS = require('./mock-pms/server');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3001",
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Static files
app.use('/uploads', express.static('public/uploads'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: require('../package.json').version,
    mockPMS: process.env.USE_MOCK_PMS === 'true'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/backgrounds', backgroundRoutes);
app.use('/api/apps', appRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/pms', pmsRoutes);
app.use('/api/launcher', launcherRoutes);
app.use('/api/logs', logsRoutes);

// Error handling middleware
app.use(errorHandler);

// Socket.IO connection handling
io.use(authenticateSocket);

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`, { 
    userId: socket.user?.id,
    userRole: socket.user?.role 
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });

  // Device-specific events
  socket.on('device:heartbeat', (data) => {
    DeviceManager.handleHeartbeat(socket, data);
  });

  socket.on('device:register', (data) => {
    DeviceManager.handleRegistration(socket, data);
  });

  socket.on('admin:join-room', (room) => {
    if (socket.user?.role === 'admin' || socket.user?.role === 'super_admin') {
      socket.join(`admin:${room}`);
    }
  });
});

// Global Socket.IO instance for other modules
global.io = io;

// Initialize services
async function initializeServices() {
  try {
    // Connect to database
    await database.connect();
    logger.info('Database connected successfully');

    // Start mock PMS if enabled
    if (process.env.USE_MOCK_PMS === 'true') {
      startMockPMS();
      logger.info('Mock PMS server started');
    }

    // Initialize services
    await PMSService.initialize();
    await ConfigWatcher.initialize();
    await GuestAutomation.initialize();
    
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Start server
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 4000;

server.listen(PORT, async () => {
  logger.info(`IPTV Hotel Panel Backend started on port ${PORT}`);
  logger.info(`WebSocket server running on port ${WS_PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  await initializeServices();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    database.disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    database.disconnect();
    process.exit(0);
  });
});

module.exports = app;
