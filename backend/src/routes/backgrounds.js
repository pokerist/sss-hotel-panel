const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/backgrounds/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = process.env.ALLOWED_IMAGE_TYPES?.split(',') || ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const allowedVideoTypes = process.env.ALLOWED_VIDEO_TYPES?.split(',') || ['mp4', 'avi', 'mkv', 'webm'];
  const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

  const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
  
  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type .${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

// Get all backgrounds with pagination
router.get('/', [
  authenticateToken,
  requireAdmin,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['image', 'video']),
  query('bundleId').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { page = 1, limit = 20, type, bundleId } = req.query;

    // Mock data for now - in full implementation, this would query the database
    const backgrounds = [
      {
        id: '1',
        name: 'Nature Landscape',
        filename: 'nature-landscape.jpg',
        type: 'image',
        size: 2048576,
        dimensions: { width: 1920, height: 1080 },
        duration: null,
        bundleId: 'bundle-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Ocean Waves',
        filename: 'ocean-waves.mp4',
        type: 'video',
        size: 15728640,
        dimensions: { width: 1920, height: 1080 },
        duration: 30,
        bundleId: 'bundle-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Filter by type
    let filteredBackgrounds = backgrounds;
    if (type) {
      filteredBackgrounds = backgrounds.filter(bg => bg.type === type);
    }

    // Filter by bundle
    if (bundleId) {
      filteredBackgrounds = filteredBackgrounds.filter(bg => bg.bundleId === bundleId);
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedBackgrounds = filteredBackgrounds.slice(startIndex, startIndex + parseInt(limit));

    res.json({
      success: true,
      data: {
        backgrounds: paginatedBackgrounds,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredBackgrounds.length,
          pages: Math.ceil(filteredBackgrounds.length / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching backgrounds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch backgrounds'
    });
  }
});

// Upload background file
router.post('/upload', [
  authenticateToken,
  requireAdmin,
  logActivity('UPLOAD_BACKGROUND'),
  upload.single('background')
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const file = req.file;
    const isVideo = ['mp4', 'avi', 'mkv', 'webm'].includes(path.extname(file.filename).toLowerCase().substring(1));

    // Mock background record - in full implementation, this would save to database
    const background = {
      id: `bg-${Date.now()}`,
      name: req.body.name || path.parse(file.originalname).name,
      filename: file.filename,
      originalName: file.originalname,
      type: isVideo ? 'video' : 'image',
      size: file.size,
      path: `/uploads/backgrounds/${file.filename}`,
      mimeType: file.mimetype,
      uploadedBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    logger.info('Background uploaded successfully', {
      userId: req.user.id,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      type: background.type
    });

    res.status(201).json({
      success: true,
      message: 'Background uploaded successfully',
      data: { background }
    });

  } catch (error) {
    logger.error('Background upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Background upload failed'
    });
  }
});

// Get background bundles
router.get('/bundles', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    // Mock bundles data - in full implementation, this would query the database
    const bundles = [
      {
        id: 'bundle-1',
        name: 'Nature Collection',
        description: 'Beautiful nature scenes and landscapes',
        backgroundCount: 5,
        totalSize: 25600000,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'bundle-2',
        name: 'Hotel Branding',
        description: 'Hotel branded backgrounds and promotional content',
        backgroundCount: 3,
        totalSize: 12800000,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    res.json({
      success: true,
      data: { bundles }
    });

  } catch (error) {
    logger.error('Error fetching background bundles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch background bundles'
    });
  }
});

// Create background bundle
router.post('/bundles', [
  authenticateToken,
  requireAdmin,
  logActivity('CREATE_BACKGROUND_BUNDLE'),
  body('name').isString().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('backgroundIds').isArray().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description, backgroundIds } = req.body;

    // Mock bundle creation - in full implementation, this would save to database
    const bundle = {
      id: `bundle-${Date.now()}`,
      name,
      description,
      backgroundIds,
      backgroundCount: backgroundIds.length,
      isActive: true,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    logger.info('Background bundle created', {
      userId: req.user.id,
      bundleId: bundle.id,
      bundleName: name,
      backgroundCount: backgroundIds.length
    });

    res.status(201).json({
      success: true,
      message: 'Background bundle created successfully',
      data: { bundle }
    });

  } catch (error) {
    logger.error('Error creating background bundle:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create background bundle'
    });
  }
});

// Assign bundle to device/room
router.post('/assign', [
  authenticateToken,
  requireAdmin,
  logActivity('ASSIGN_BACKGROUND_BUNDLE'),
  body('bundleId').isString(),
  body('deviceIds').optional().isArray(),
  body('roomNumbers').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { bundleId, deviceIds, roomNumbers } = req.body;

    if (!deviceIds && !roomNumbers) {
      return res.status(400).json({
        success: false,
        message: 'Either deviceIds or roomNumbers must be provided'
      });
    }

    // Mock assignment - in full implementation, this would update device configurations
    const assignments = [];

    if (deviceIds) {
      deviceIds.forEach(deviceId => {
        assignments.push({
          type: 'device',
          id: deviceId,
          bundleId,
          assignedAt: new Date().toISOString()
        });
      });
    }

    if (roomNumbers) {
      roomNumbers.forEach(roomNumber => {
        assignments.push({
          type: 'room',
          id: roomNumber,
          bundleId,
          assignedAt: new Date().toISOString()
        });
      });
    }

    // Emit real-time event
    if (global.io) {
      global.io.to('admin:backgrounds').emit('background:bundle-assigned', {
        bundleId,
        assignments,
        assignedBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    logger.info('Background bundle assigned', {
      userId: req.user.id,
      bundleId,
      deviceCount: deviceIds?.length || 0,
      roomCount: roomNumbers?.length || 0
    });

    res.json({
      success: true,
      message: 'Background bundle assigned successfully',
      data: { assignments }
    });

  } catch (error) {
    logger.error('Error assigning background bundle:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign background bundle'
    });
  }
});

// Delete background
router.delete('/:backgroundId', [
  authenticateToken,
  requireAdmin,
  logActivity('DELETE_BACKGROUND')
], async (req, res) => {
  try {
    const { backgroundId } = req.params;

    // Mock deletion - in full implementation, this would delete from database and filesystem
    logger.info('Background deleted', {
      userId: req.user.id,
      backgroundId
    });

    res.json({
      success: true,
      message: 'Background deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting background:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete background'
    });
  }
});

// Get background statistics
router.get('/stats/overview', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    // Mock statistics - in full implementation, this would query the database
    const stats = {
      totalBackgrounds: 15,
      totalBundles: 3,
      totalSize: '125.6 MB',
      imageCount: 10,
      videoCount: 5,
      activeAssignments: 8,
      mostUsedBundle: 'Nature Collection'
    };

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    logger.error('Error fetching background statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch background statistics'
    });
  }
});

module.exports = router;
