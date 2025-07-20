const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.MOCK_PMS_PORT || 3001;

// Simple logging function
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Mock PMS: ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

function info(message) {
  console.log(`[INFO] Mock PMS: ${message}`);
}

function warn(message) {
  console.warn(`[WARN] Mock PMS: ${message}`);
}

function error(message, err = null) {
  console.error(`[ERROR] Mock PMS: ${message}`, err ? err.message : '');
}

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  log(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.body
  });
  next();
});

// Load mock data
const mockData = require('./data');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Mock PMS Server (Standalone)',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    port: PORT
  });
});

// Opera PMS API Endpoints

// Guests endpoint
app.get('/guest/v0/guests', (req, res) => {
  const { roomNumber, firstName, lastName, limit = 50, offset = 0 } = req.query;
  
  let guests = mockData.getGuests();
  
  // Filter by room number
  if (roomNumber) {
    guests = guests.filter(guest => guest.roomNumber === roomNumber);
  }
  
  // Filter by name
  if (firstName) {
    guests = guests.filter(guest => 
      guest.firstName.toLowerCase().includes(firstName.toLowerCase())
    );
  }
  
  if (lastName) {
    guests = guests.filter(guest => 
      guest.lastName.toLowerCase().includes(lastName.toLowerCase())
    );
  }
  
  // Pagination
  const total = guests.length;
  const paginatedGuests = guests.slice(offset, offset + parseInt(limit));
  
  res.json({
    guests: paginatedGuests,
    pagination: {
      offset: parseInt(offset),
      limit: parseInt(limit),
      total,
      hasMore: offset + limit < total
    }
  });
});

// Get specific guest
app.get('/guest/v0/guests/:guestId', (req, res) => {
  const { guestId } = req.params;
  const guest = mockData.getGuestById(guestId);
  
  if (!guest) {
    return res.status(404).json({
      error: 'Guest not found',
      code: 'GUEST_NOT_FOUND'
    });
  }
  
  res.json(guest);
});

// Reservations endpoint
app.get('/reservation/v0/reservations', (req, res) => {
  const { roomNumber, status, arrivalDate, departureDate, limit = 50, offset = 0 } = req.query;
  
  let reservations = mockData.getReservations();
  
  // Filter by room number
  if (roomNumber) {
    reservations = reservations.filter(reservation => 
      reservation.roomNumber === roomNumber
    );
  }
  
  // Filter by status
  if (status) {
    reservations = reservations.filter(reservation => 
      reservation.status.toLowerCase() === status.toLowerCase()
    );
  }
  
  // Filter by arrival date
  if (arrivalDate) {
    const filterDate = new Date(arrivalDate);
    reservations = reservations.filter(reservation => 
      new Date(reservation.arrivalDate) >= filterDate
    );
  }
  
  // Filter by departure date
  if (departureDate) {
    const filterDate = new Date(departureDate);
    reservations = reservations.filter(reservation => 
      new Date(reservation.departureDate) <= filterDate
    );
  }
  
  // Pagination
  const total = reservations.length;
  const paginatedReservations = reservations.slice(offset, offset + parseInt(limit));
  
  res.json({
    reservations: paginatedReservations,
    pagination: {
      offset: parseInt(offset),
      limit: parseInt(limit),
      total,
      hasMore: offset + limit < total
    }
  });
});

// Get specific reservation
app.get('/reservation/v0/reservations/:reservationId', (req, res) => {
  const { reservationId } = req.params;
  const reservation = mockData.getReservationById(reservationId);
  
  if (!reservation) {
    return res.status(404).json({
      error: 'Reservation not found',
      code: 'RESERVATION_NOT_FOUND'
    });
  }
  
  res.json(reservation);
});

// Folios endpoint (billing)
app.get('/folio/v0/folios', (req, res) => {
  const { reservationId, roomNumber, limit = 50, offset = 0 } = req.query;
  
  let folios = mockData.getFolios();
  
  // Filter by reservation ID
  if (reservationId) {
    folios = folios.filter(folio => folio.reservationId === reservationId);
  }
  
  // Filter by room number
  if (roomNumber) {
    folios = folios.filter(folio => folio.roomNumber === roomNumber);
  }
  
  // Pagination
  const total = folios.length;
  const paginatedFolios = folios.slice(offset, offset + parseInt(limit));
  
  res.json({
    folios: paginatedFolios,
    pagination: {
      offset: parseInt(offset),
      limit: parseInt(limit),
      total,
      hasMore: offset + limit < total
    }
  });
});

// Get specific folio
app.get('/folio/v0/folios/:folioId', (req, res) => {
  const { folioId } = req.params;
  const folio = mockData.getFolioById(folioId);
  
  if (!folio) {
    return res.status(404).json({
      error: 'Folio not found',
      code: 'FOLIO_NOT_FOUND'
    });
  }
  
  res.json(folio);
});

// Room status endpoint (custom for testing)
app.get('/rooms/:roomNumber/status', (req, res) => {
  const { roomNumber } = req.params;
  const reservation = mockData.getCurrentReservationByRoom(roomNumber);
  
  if (!reservation) {
    return res.json({
      roomNumber,
      status: 'vacant',
      guest: null,
      reservation: null
    });
  }
  
  const guest = mockData.getGuestById(reservation.guestId);
  
  res.json({
    roomNumber,
    status: reservation.status,
    guest: guest ? {
      id: guest.id,
      name: `${guest.firstName} ${guest.lastName}`,
      checkIn: reservation.arrivalDate,
      checkOut: reservation.departureDate
    } : null,
    reservation: {
      id: reservation.id,
      arrivalDate: reservation.arrivalDate,
      departureDate: reservation.departureDate,
      status: reservation.status
    }
  });
});

// Error simulation endpoints
app.get('/test/error/:code', (req, res) => {
  const { code } = req.params;
  
  switch (code) {
    case '500':
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Simulated server error for testing'
      });
    case '404':
      return res.status(404).json({
        error: 'Not Found',
        message: 'Simulated not found error for testing'
      });
    case '401':
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Simulated authentication error for testing'
      });
    case 'timeout':
      // Simulate timeout by delaying response
      setTimeout(() => {
        res.json({ message: 'Delayed response for timeout testing' });
      }, 30000);
      return;
    default:
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Unknown error code for simulation'
      });
  }
});

// Catch-all for unimplemented endpoints
app.use('*', (req, res) => {
  warn(`Unimplemented endpoint ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Endpoint not implemented in Mock PMS',
    method: req.method,
    path: req.path,
    availableEndpoints: [
      'GET /guest/v0/guests',
      'GET /guest/v0/guests/:guestId',
      'GET /reservation/v0/reservations',
      'GET /reservation/v0/reservations/:reservationId',
      'GET /folio/v0/folios',
      'GET /folio/v0/folios/:folioId',
      'GET /rooms/:roomNumber/status',
      'GET /test/error/:code',
      'GET /health'
    ]
  });
});

// Error handling
app.use((err, req, res, next) => {
  error('Server Error:', err);
  res.status(500).json({
    error: 'Mock PMS Server Error',
    message: err.message
  });
});

// Start server
const server = app.listen(PORT, () => {
  info(`Mock PMS Server started on port ${PORT}`);
  info('Available endpoints:');
  info('  - GET /guest/v0/guests');
  info('  - GET /reservation/v0/reservations');
  info('  - GET /folio/v0/folios');
  info('  - GET /rooms/:roomNumber/status');
  info('  - GET /test/error/:code (for testing)');
  info('  - GET /health');
  info(`Access health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    info('Mock PMS Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  info('SIGINT received, shutting down gracefully');
  server.close(() => {
    info('Mock PMS Server closed');
    process.exit(0);
  });
});

module.exports = app;
