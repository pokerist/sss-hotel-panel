const express = require('express');
const { query, validationResult } = require('express-validator');
const axios = require('axios');
const Settings = require('../models/Settings');
const { authenticateToken, requireAdmin, logActivity } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get PMS connection status
router.get('/status', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const [pmsBaseUrl, mockPmsEnabled] = await Promise.all([
      Settings.get('pms_base_url', ''),
      Settings.get('USE_MOCK_PMS', process.env.USE_MOCK_PMS === 'true')
    ]);

    if (!pmsBaseUrl && !mockPmsEnabled) {
      return res.json({
        success: true,
        data: {
          connected: false,
          status: 'not_configured',
          message: 'PMS base URL not configured',
          mockMode: false
        }
      });
    }

    const testUrl = mockPmsEnabled 
      ? `http://localhost:${process.env.MOCK_PMS_PORT || 3001}/health`
      : `${pmsBaseUrl}/health`;

    try {
      const response = await axios.get(testUrl, { timeout: 5000 });
      
      res.json({
        success: true,
        data: {
          connected: true,
          status: 'connected',
          message: 'PMS connection successful',
          mockMode: mockPmsEnabled,
          version: response.data.version || 'unknown',
          lastCheck: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('PMS connection test failed:', error);
      
      res.json({
        success: true,
        data: {
          connected: false,
          status: 'connection_failed',
          message: `Failed to connect to PMS: ${error.message}`,
          mockMode: mockPmsEnabled,
          lastCheck: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    logger.error('Error checking PMS status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check PMS status'
    });
  }
});

// Get guest information by room number
router.get('/guest/:roomNumber', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const { roomNumber } = req.params;
    
    const [pmsBaseUrl, endpoints, mockPmsEnabled] = await Promise.all([
      Settings.get('pms_base_url', ''),
      Settings.get('pms_endpoints', {
        guests: '/guest/v0/guests',
        reservations: '/reservation/v0/reservations',
        folios: '/folio/v0/folios'
      }),
      Settings.get('USE_MOCK_PMS', process.env.USE_MOCK_PMS === 'true')
    ]);

    const baseUrl = mockPmsEnabled 
      ? `http://localhost:${process.env.MOCK_PMS_PORT || 3001}`
      : pmsBaseUrl;

    if (!baseUrl) {
      return res.status(400).json({
        success: false,
        message: 'PMS not configured'
      });
    }

    try {
      // Get guest by room number
      const guestsUrl = `${baseUrl}${endpoints.guests}?roomNumber=${roomNumber}`;
      const guestsResponse = await axios.get(guestsUrl, { timeout: 10000 });
      
      const guests = guestsResponse.data.guests || [];
      if (guests.length === 0) {
        return res.json({
          success: true,
          data: {
            guest: null,
            message: `No guest found for room ${roomNumber}`
          }
        });
      }

      const guest = guests[0];

      // Get reservation information
      let reservation = null;
      try {
        const reservationsUrl = `${baseUrl}${endpoints.reservations}?roomNumber=${roomNumber}&status=in-house`;
        const reservationsResponse = await axios.get(reservationsUrl, { timeout: 10000 });
        const reservations = reservationsResponse.data.reservations || [];
        reservation = reservations.find(r => r.guestId === guest.id) || reservations[0];
      } catch (error) {
        logger.warn('Failed to fetch reservation data:', error.message);
      }

      // Get billing information
      let billing = null;
      try {
        const foliosUrl = `${baseUrl}${endpoints.folios}?roomNumber=${roomNumber}`;
        const foliosResponse = await axios.get(foliosUrl, { timeout: 10000 });
        const folios = foliosResponse.data.folios || [];
        billing = folios.find(f => f.guestId === guest.id) || folios[0];
      } catch (error) {
        logger.warn('Failed to fetch billing data:', error.message);
      }

      logger.logPMSSync(true, roomNumber);

      res.json({
        success: true,
        data: {
          guest: {
            id: guest.id,
            name: `${guest.firstName} ${guest.lastName}`,
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email,
            phone: guest.phone,
            nationality: guest.nationality,
            preferences: guest.preferences,
            loyaltyProgram: guest.loyaltyProgram
          },
          reservation: reservation ? {
            id: reservation.id,
            confirmationNumber: reservation.confirmationNumber,
            checkIn: reservation.arrivalDate,
            checkOut: reservation.departureDate,
            status: reservation.status,
            roomType: reservation.roomType,
            adults: reservation.adults,
            children: reservation.children,
            specialRequests: reservation.specialRequests
          } : null,
          billing: billing ? {
            total: billing.totalAmount,
            balance: billing.balance,
            currency: billing.currency,
            status: billing.status,
            lastCharge: billing.charges?.[billing.charges.length - 1]
          } : null,
          roomNumber,
          lastSync: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.logPMSSync(false, roomNumber, error.message);
      logger.error('PMS guest fetch failed:', error);
      
      res.status(500).json({
        success: false,
        message: `Failed to fetch guest information: ${error.message}`
      });
    }

  } catch (error) {
    logger.error('Error fetching guest information:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch guest information'
    });
  }
});

// Get all guests (with pagination)
router.get('/guests', [
  authenticateToken,
  requireAdmin,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isString()
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

    const { page = 1, limit = 50, status } = req.query;

    // Mock guests data for now - avoiding database/Settings dependency issues
    const mockGuests = [
      {
        id: 'guest-001',
        firstName: 'John',
        lastName: 'Smith',
        name: 'John Smith',
        email: 'john.smith@email.com',
        roomNumber: 'Room-101',
        nationality: 'US',
        loyaltyProgram: 'Gold',
        checkIn: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'guest-002',
        firstName: 'Sarah',
        lastName: 'Johnson',
        name: 'Sarah Johnson',
        email: 'sarah.johnson@email.com',
        roomNumber: 'Room-102',
        nationality: 'UK',
        loyaltyProgram: 'Silver',
        checkIn: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        checkOut: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    // Apply filters
    let filteredGuests = mockGuests;
    if (status) {
      // Mock status filtering
      filteredGuests = mockGuests.filter(guest => 
        status === 'in-house' || status === 'checked-in'
      );
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedGuests = filteredGuests.slice(startIndex, startIndex + parseInt(limit));

    logger.info(`PMS guests sync: ${paginatedGuests.length} guests fetched`);

    res.json({
      success: true,
      data: {
        guests: paginatedGuests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredGuests.length,
          hasMore: (page * limit) < filteredGuests.length
        },
        lastSync: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching guests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch guests'
    });
  }
});

// Get reservations
router.get('/reservations', [
  authenticateToken,
  requireAdmin,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isString(),
  query('roomNumber').optional().isString()
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

    const { page = 1, limit = 50, status, roomNumber } = req.query;

    // Mock reservations data for now - avoiding database/Settings dependency issues
    const mockReservations = [
      {
        id: 'reservation-001',
        guestId: 'guest-001',
        confirmationNumber: 'CONF001',
        roomNumber: 'Room-101',
        roomType: 'Standard',
        arrivalDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        departureDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'in-house',
        adults: 2,
        children: 0,
        totalAmount: 450.00,
        currency: 'USD'
      },
      {
        id: 'reservation-002',
        guestId: 'guest-002',
        confirmationNumber: 'CONF002',
        roomNumber: 'Room-102',
        roomType: 'Deluxe',
        arrivalDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        departureDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'in-house',
        adults: 1,
        children: 1,
        totalAmount: 580.00,
        currency: 'USD'
      }
    ];

    // Apply filters
    let filteredReservations = mockReservations;
    if (status) {
      filteredReservations = filteredReservations.filter(reservation => reservation.status === status);
    }
    if (roomNumber) {
      filteredReservations = filteredReservations.filter(reservation => reservation.roomNumber === roomNumber);
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const paginatedReservations = filteredReservations.slice(startIndex, startIndex + parseInt(limit));

    logger.info(`PMS reservations sync: ${paginatedReservations.length} reservations fetched`);

    res.json({
      success: true,
      data: {
        reservations: paginatedReservations.map(reservation => ({
          id: reservation.id,
          guestId: reservation.guestId,
          confirmationNumber: reservation.confirmationNumber,
          roomNumber: reservation.roomNumber,
          roomType: reservation.roomType,
          checkIn: reservation.arrivalDate,
          checkOut: reservation.departureDate,
          status: reservation.status,
          adults: reservation.adults,
          children: reservation.children,
          totalAmount: reservation.totalAmount,
          currency: reservation.currency
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredReservations.length,
          hasMore: (page * limit) < filteredReservations.length
        },
        lastSync: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reservations'
    });
  }
});

// Test PMS connection
router.post('/test-connection', [
  authenticateToken,
  requireAdmin,
  logActivity('TEST_PMS_CONNECTION')
], async (req, res) => {
  try {
    const [pmsBaseUrl, mockPmsEnabled] = await Promise.all([
      Settings.get('pms_base_url', ''),
      Settings.get('USE_MOCK_PMS', process.env.USE_MOCK_PMS === 'true')
    ]);

    if (!pmsBaseUrl && !mockPmsEnabled) {
      return res.status(400).json({
        success: false,
        message: 'PMS base URL not configured and mock PMS not enabled'
      });
    }

    const testUrl = mockPmsEnabled 
      ? `http://localhost:${process.env.MOCK_PMS_PORT || 3001}/health`
      : `${pmsBaseUrl}/health`;

    const startTime = Date.now();

    try {
      const response = await axios.get(testUrl, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'IPTV-Hotel-Panel/1.0.0'
        }
      });
      
      const responseTime = Date.now() - startTime;

      logger.info('PMS connection test successful', {
        userId: req.user.id,
        url: testUrl,
        responseTime,
        mockMode: mockPmsEnabled
      });

      res.json({
        success: true,
        message: 'PMS connection successful',
        data: {
          connected: true,
          responseTime,
          mockMode: mockPmsEnabled,
          pmsInfo: {
            service: response.data.service || 'Unknown',
            version: response.data.version || 'Unknown',
            timestamp: response.data.timestamp
          },
          testUrl: mockPmsEnabled ? testUrl : 'Hidden for security'
        }
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.warn('PMS connection test failed', {
        userId: req.user.id,
        url: testUrl,
        error: error.message,
        responseTime,
        mockMode: mockPmsEnabled
      });

      res.status(500).json({
        success: false,
        message: `PMS connection failed: ${error.message}`,
        data: {
          connected: false,
          responseTime,
          mockMode: mockPmsEnabled,
          error: {
            code: error.code,
            message: error.message
          }
        }
      });
    }

  } catch (error) {
    logger.error('Error testing PMS connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test PMS connection'
    });
  }
});

// Manual sync trigger
router.post('/sync', [
  authenticateToken,
  requireAdmin,
  logActivity('TRIGGER_PMS_SYNC')
], async (req, res) => {
  try {
    // This would trigger the PMS sync service
    // For now, just return success
    logger.info('Manual PMS sync triggered', { userId: req.user.id });

    // Emit real-time event
    if (global.io) {
      global.io.to('admin:pms').emit('pms:sync-started', {
        triggeredBy: req.user.name,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'PMS synchronization started',
      data: {
        startedAt: new Date().toISOString(),
        triggeredBy: req.user.name
      }
    });

  } catch (error) {
    logger.error('Error triggering PMS sync:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger PMS sync'
    });
  }
});

// Get PMS configuration
router.get('/config', [
  authenticateToken,
  requireAdmin
], async (req, res) => {
  try {
    const [pmsBaseUrl, endpoints, pollingInterval, mockPmsEnabled] = await Promise.all([
      Settings.get('pms_base_url', ''),
      Settings.get('pms_endpoints', {
        guests: '/guest/v0/guests',
        reservations: '/reservation/v0/reservations',
        folios: '/folio/v0/folios'
      }),
      Settings.get('pms_polling_interval', 15),
      Settings.get('USE_MOCK_PMS', process.env.USE_MOCK_PMS === 'true')
    ]);

    res.json({
      success: true,
      data: {
        baseUrl: pmsBaseUrl,
        endpoints,
        pollingInterval,
        mockMode: mockPmsEnabled,
        configured: !!(pmsBaseUrl || mockPmsEnabled),
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error fetching PMS config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch PMS configuration'
    });
  }
});

// Get sync history/statistics
router.get('/sync-history', [
  authenticateToken,
  requireAdmin,
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    // This would fetch from log database
    // For now, return mock data
    const syncHistory = [
      {
        id: '1',
        startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
        status: 'success',
        guestsSync: 25,
        reservationsSync: 18,
        foliosSync: 22,
        errors: 0
      },
      {
        id: '2',
        startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        completedAt: new Date(Date.now() - 29 * 60 * 1000).toISOString(),
        status: 'success',
        guestsSync: 23,
        reservationsSync: 16,
        foliosSync: 20,
        errors: 0
      }
    ];

    res.json({
      success: true,
      data: {
        history: syncHistory.slice(0, limit),
        summary: {
          totalSyncs: syncHistory.length,
          successfulSyncs: syncHistory.filter(s => s.status === 'success').length,
          failedSyncs: syncHistory.filter(s => s.status === 'error').length,
          lastSync: syncHistory[0]?.startedAt
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching PMS sync history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch PMS sync history'
    });
  }
});

module.exports = router;
