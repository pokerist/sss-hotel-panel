const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');
const Background = require('../models/Background');
const BackgroundBundle = require('../models/BackgroundBundle');

const router = express.Router();

const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../public/uploads/backgrounds');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
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

        const { page = 1, limit = 20, type, search } = req.query;

        // Build query
        const query = {};
        if (type) query.type = type;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { 'metadata.tags': { $regex: search, $options: 'i' } }
            ];
        }

        // For frontend compatibility - return all backgrounds if no pagination params
        if (!req.query.page && !req.query.limit) {
            const backgrounds = await Background.find(query)
                .populate('uploadedBy', 'name email')
                .sort({ createdAt: -1 });
            return res.json(backgrounds);
        }

        // Get paginated results
        const [backgrounds, total] = await Promise.all([
            Background.find(query)
                .populate('uploadedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit)),
            Background.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: {
                backgrounds,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
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
  upload.array('background', 10) // Support up to 10 files
], async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const backgrounds = [];
    
    for (const file of req.files) {
      const isVideo = ['mp4', 'avi', 'mkv', 'webm'].includes(path.extname(file.filename).toLowerCase().substring(1));

      const background = new Background({
        name: req.body.name || path.parse(file.originalname).name,
        filename: file.filename,
        originalName: file.originalname,
        type: isVideo ? 'video' : 'image',
        size: file.size,
        url: `/uploads/backgrounds/${file.filename}`,
        mimeType: file.mimetype,
        uploadedBy: req.user.id,
        metadata: {
          tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
          season: req.body.season || 'all',
          timeOfDay: req.body.timeOfDay || 'all'
        }
      });

      await background.save();
      backgrounds.push(background);
    }

    logger.info('Backgrounds uploaded successfully', {
      userId: req.user.id,
      count: req.files.length,
      files: req.files.map(f => f.originalname)
    });

    res.status(201).json({
      success: true,
      message: `${backgrounds.length} background(s) uploaded successfully`,
      data: { 
        backgrounds,
        count: backgrounds.length
      }
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
    const bundles = await BackgroundBundle.find()
      .populate('createdBy', 'name email')
      .populate('backgrounds')
      .sort({ createdAt: -1 });

    // Transform bundles to include statistics
    const bundlesWithStats = bundles.map(bundle => ({
      id: bundle._id,
      name: bundle.name,
      description: bundle.description,
      backgroundCount: bundle.backgrounds.length,
      totalSize: bundle.statistics.totalSize,
      imageCount: bundle.statistics.imageCount,
      videoCount: bundle.statistics.videoCount,
      isActive: bundle.isActive,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt
    }));

    res.json({
      success: true,
      data: { bundles: bundlesWithStats }
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

    // Verify backgrounds exist
    const backgrounds = await Background.find({ _id: { $in: backgroundIds } });
    if (backgrounds.length !== backgroundIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some backgrounds were not found'
      });
    }

    const bundle = new BackgroundBundle({
      name,
      description,
      backgrounds: backgroundIds,
      createdBy: req.user.id,
      settings: {
        displayDuration: req.body.displayDuration || 30,
        transitionEffect: req.body.transitionEffect || 'fade',
        shuffleEnabled: req.body.shuffleEnabled || false
      }
    });

    await bundle.save();

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

    // Verify bundle exists
    const bundle = await BackgroundBundle.findById(bundleId);
    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: 'Background bundle not found'
      });
    }

    const Device = require('../models/Device');
    const assignments = [];

    if (deviceIds) {
      // Find devices and verify they exist
      const devices = await Device.find({ _id: { $in: deviceIds } });
      if (devices.length !== deviceIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some devices were not found'
        });
      }

      // Update each device's configuration
      for (const device of devices) {
        device.configuration = device.configuration || {};
        device.configuration.backgroundBundle = bundleId;
        await device.save();

        assignments.push({
          type: 'device',
          id: device.id,
          bundleId,
          assignedAt: new Date().toISOString()
        });
      }
    }

    if (roomNumbers) {
      // Find devices by room numbers
      const devices = await Device.find({ roomNumber: { $in: roomNumbers } });
      const foundRooms = devices.map(d => d.roomNumber);
      const missingRooms = roomNumbers.filter(r => !foundRooms.includes(r));
      
      if (missingRooms.length > 0) {
        return res.status(400).json({
          success: false,
          message: `No devices found for rooms: ${missingRooms.join(', ')}`
        });
      }

      // Update each device's configuration
      for (const device of devices) {
        device.configuration = device.configuration || {};
        device.configuration.backgroundBundle = bundleId;
        await device.save();

        assignments.push({
          type: 'room',
          id: device.roomNumber,
          bundleId,
          assignedAt: new Date().toISOString()
        });
      }
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

// Update background
router.put('/:backgroundId', [
  authenticateToken,
  requireAdmin,
  logActivity('UPDATE_BACKGROUND'),
  body('name').optional().isString().isLength({ min: 1, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 })
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

    const { backgroundId } = req.params;
    const { name, description } = req.body;

    const background = await Background.findById(backgroundId);
    if (!background) {
      return res.status(404).json({
        success: false,
        message: 'Background not found'
      });
    }

    // Update fields
    if (name !== undefined) background.name = name;
    if (description !== undefined) background.description = description;

    await background.save();

    logger.info('Background updated', {
      userId: req.user.id,
      backgroundId,
      changes: { name, description }
    });

    res.json({
      success: true,
      message: 'Background updated successfully',
      data: { background }
    });

  } catch (error) {
    logger.error('Error updating background:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update background'
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

    const background = await Background.findById(backgroundId);
    if (!background) {
      return res.status(404).json({
        success: false,
        message: 'Background not found'
      });
    }

    // Remove from any bundles that contain it
    await BackgroundBundle.updateMany(
      { backgrounds: backgroundId },
      { $pull: { backgrounds: backgroundId } }
    );

    // Delete the file from filesystem
    const filePath = path.join(uploadDir, background.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await background.deleteOne();

    logger.info('Background deleted', {
      userId: req.user.id,
      backgroundId,
      filename: background.filename
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
    const [
      totalBackgrounds,
      totalBundles,
      typeCounts,
      totalSize,
      mostUsedBundle
    ] = await Promise.all([
      Background.countDocuments(),
      BackgroundBundle.countDocuments(),
      Background.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      Background.aggregate([
        { $group: { _id: null, total: { $sum: '$size' } } }
      ]),
      BackgroundBundle.aggregate([
        { $lookup: { from: 'devices', localField: '_id', foreignField: 'configuration.backgroundBundle', as: 'devices' } },
        { $project: { name: 1, deviceCount: { $size: '$devices' } } },
        { $sort: { deviceCount: -1 } },
        { $limit: 1 }
      ])
    ]);

    const typeStats = {};
    typeCounts.forEach(type => {
      typeStats[type._id] = type.count;
    });

    const stats = {
      totalBackgrounds,
      totalBundles,
      totalSize: Math.round(totalSize[0]?.total / (1024 * 1024)) + ' MB',
      imageCount: typeStats['image'] || 0,
      videoCount: typeStats['video'] || 0,
      activeAssignments: mostUsedBundle[0]?.deviceCount || 0,
      mostUsedBundle: mostUsedBundle[0]?.name || 'None'
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
