const { v4: uuidv4 } = require('uuid');

// Helper function to generate dates relative to today
function getRelativeDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function getRelativeDateTime(days, hours = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

// Sample guest data
const guests = [
  {
    id: 'guest-001',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@email.com',
    phone: '+1-555-0101',
    nationality: 'USA',
    dateOfBirth: '1985-03-15',
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'USA'
    },
    preferences: {
      language: 'en',
      currency: 'USD',
      roomType: 'deluxe',
      bedType: 'king'
    },
    loyaltyProgram: {
      level: 'gold',
      points: 12500
    },
    roomNumber: '301'
  },
  {
    id: 'guest-002',
    firstName: 'Maria',
    lastName: 'Garcia',
    email: 'maria.garcia@email.com',
    phone: '+1-555-0102',
    nationality: 'ESP',
    dateOfBirth: '1990-07-22',
    address: {
      street: '456 Oak Ave',
      city: 'Madrid',
      state: 'Madrid',
      postalCode: '28001',
      country: 'Spain'
    },
    preferences: {
      language: 'es',
      currency: 'EUR',
      roomType: 'suite',
      bedType: 'queen'
    },
    loyaltyProgram: {
      level: 'platinum',
      points: 25000
    },
    roomNumber: '402'
  },
  {
    id: 'guest-003',
    firstName: 'David',
    lastName: 'Wilson',
    email: 'david.wilson@email.com',
    phone: '+44-20-7946-0958',
    nationality: 'GBR',
    dateOfBirth: '1978-11-08',
    address: {
      street: '789 Park Lane',
      city: 'London',
      state: 'England',
      postalCode: 'SW1A 1AA',
      country: 'United Kingdom'
    },
    preferences: {
      language: 'en',
      currency: 'GBP',
      roomType: 'standard',
      bedType: 'twin'
    },
    loyaltyProgram: {
      level: 'silver',
      points: 8500
    },
    roomNumber: '205'
  },
  {
    id: 'guest-004',
    firstName: 'Sophie',
    lastName: 'Dubois',
    email: 'sophie.dubois@email.com',
    phone: '+33-1-42-86-83-26',
    nationality: 'FRA',
    dateOfBirth: '1993-05-14',
    address: {
      street: '321 Rue de Rivoli',
      city: 'Paris',
      state: 'Île-de-France',
      postalCode: '75001',
      country: 'France'
    },
    preferences: {
      language: 'fr',
      currency: 'EUR',
      roomType: 'deluxe',
      bedType: 'king'
    },
    loyaltyProgram: {
      level: 'gold',
      points: 15750
    },
    roomNumber: '506'
  },
  {
    id: 'guest-005',
    firstName: 'Hiroshi',
    lastName: 'Tanaka',
    email: 'hiroshi.tanaka@email.com',
    phone: '+81-3-5555-0123',
    nationality: 'JPN',
    dateOfBirth: '1982-09-30',
    address: {
      street: '654 Shibuya',
      city: 'Tokyo',
      state: 'Tokyo',
      postalCode: '150-0002',
      country: 'Japan'
    },
    preferences: {
      language: 'ja',
      currency: 'JPY',
      roomType: 'suite',
      bedType: 'king'
    },
    loyaltyProgram: {
      level: 'platinum',
      points: 32000
    },
    roomNumber: '701'
  }
];

// Sample reservation data
const reservations = [
  {
    id: 'res-001',
    guestId: 'guest-001',
    roomNumber: '301',
    roomType: 'deluxe',
    arrivalDate: getRelativeDateTime(-1, 15), // Checked in yesterday at 3 PM
    departureDate: getRelativeDateTime(2, 11), // Checking out in 2 days at 11 AM
    status: 'in-house',
    adults: 2,
    children: 0,
    confirmationNumber: 'CNF123456',
    rateCode: 'BAR',
    roomRate: 199.00,
    currency: 'USD',
    totalAmount: 597.00,
    source: 'direct',
    specialRequests: ['Late checkout', 'Extra pillows'],
    created: getRelativeDateTime(-7),
    modified: getRelativeDateTime(-1)
  },
  {
    id: 'res-002',
    guestId: 'guest-002',
    roomNumber: '402',
    roomType: 'suite',
    arrivalDate: getRelativeDateTime(0, 15), // Checking in today at 3 PM
    departureDate: getRelativeDateTime(4, 11), // Checking out in 4 days at 11 AM
    status: 'confirmed',
    adults: 1,
    children: 0,
    confirmationNumber: 'CNF789012',
    rateCode: 'ADV',
    roomRate: 299.00,
    currency: 'USD',
    totalAmount: 1196.00,
    source: 'booking.com',
    specialRequests: ['High floor', 'City view'],
    created: getRelativeDateTime(-14),
    modified: getRelativeDateTime(-2)
  },
  {
    id: 'res-003',
    guestId: 'guest-003',
    roomNumber: '205',
    roomType: 'standard',
    arrivalDate: getRelativeDateTime(-3, 15), // Checked in 3 days ago
    departureDate: getRelativeDateTime(0, 11), // Checking out today at 11 AM
    status: 'in-house',
    adults: 1,
    children: 0,
    confirmationNumber: 'CNF345678',
    rateCode: 'COR',
    roomRate: 129.00,
    currency: 'USD',
    totalAmount: 387.00,
    source: 'expedia',
    specialRequests: ['Quiet room', 'Away from elevator'],
    created: getRelativeDateTime(-21),
    modified: getRelativeDateTime(-3)
  },
  {
    id: 'res-004',
    guestId: 'guest-004',
    roomNumber: '506',
    roomType: 'deluxe',
    arrivalDate: getRelativeDateTime(1, 15), // Checking in tomorrow at 3 PM
    departureDate: getRelativeDateTime(5, 11), // Checking out in 5 days at 11 AM
    status: 'confirmed',
    adults: 2,
    children: 1,
    confirmationNumber: 'CNF901234',
    rateCode: 'PKG',
    roomRate: 229.00,
    currency: 'USD',
    totalAmount: 916.00,
    source: 'direct',
    specialRequests: ['Crib for baby', 'Welcome amenity'],
    created: getRelativeDateTime(-10),
    modified: getRelativeDateTime(-1)
  },
  {
    id: 'res-005',
    guestId: 'guest-005',
    roomNumber: '701',
    roomType: 'suite',
    arrivalDate: getRelativeDateTime(-2, 15), // Checked in 2 days ago
    departureDate: getRelativeDateTime(3, 11), // Checking out in 3 days
    status: 'in-house',
    adults: 2,
    children: 2,
    confirmationNumber: 'CNF567890',
    rateCode: 'FAM',
    roomRate: 349.00,
    currency: 'USD',
    totalAmount: 1745.00,
    source: 'travel-agent',
    specialRequests: ['Connecting rooms', 'Late checkout', 'Airport transfer'],
    created: getRelativeDateTime(-28),
    modified: getRelativeDateTime(-2)
  }
];

// Sample folio data (billing information)
const folios = [
  {
    id: 'folio-001',
    reservationId: 'res-001',
    guestId: 'guest-001',
    roomNumber: '301',
    currency: 'USD',
    totalAmount: 847.50,
    balance: 0.00,
    status: 'open',
    charges: [
      {
        id: 'charge-001',
        date: getRelativeDateTime(-1),
        description: 'Room Charge - Deluxe Room',
        amount: 199.00,
        category: 'room',
        taxAmount: 23.88,
        total: 222.88
      },
      {
        id: 'charge-002',
        date: getRelativeDateTime(-1, 19),
        description: 'Restaurant - Dinner',
        amount: 85.50,
        category: 'food_beverage',
        taxAmount: 10.26,
        total: 95.76
      },
      {
        id: 'charge-003',
        date: getRelativeDateTime(0, 9),
        description: 'Room Service - Breakfast',
        amount: 32.50,
        category: 'room_service',
        taxAmount: 3.90,
        total: 36.40
      },
      {
        id: 'charge-004',
        date: getRelativeDateTime(0, 14),
        description: 'Spa Services',
        amount: 120.00,
        category: 'spa',
        taxAmount: 14.40,
        total: 134.40
      }
    ],
    payments: [
      {
        id: 'payment-001',
        date: getRelativeDateTime(-1),
        description: 'Credit Card Authorization',
        amount: 500.00,
        method: 'credit_card',
        cardType: 'visa',
        lastFourDigits: '1234',
        status: 'authorized'
      }
    ],
    created: getRelativeDateTime(-1),
    modified: getRelativeDateTime(0, 14)
  },
  {
    id: 'folio-002',
    reservationId: 'res-003',
    guestId: 'guest-003',
    roomNumber: '205',
    currency: 'USD',
    totalAmount: 456.78,
    balance: 456.78,
    status: 'open',
    charges: [
      {
        id: 'charge-005',
        date: getRelativeDateTime(-3),
        description: 'Room Charge - Standard Room',
        amount: 129.00,
        category: 'room',
        taxAmount: 15.48,
        total: 144.48
      },
      {
        id: 'charge-006',
        date: getRelativeDateTime(-2),
        description: 'Room Charge - Standard Room',
        amount: 129.00,
        category: 'room',
        taxAmount: 15.48,
        total: 144.48
      },
      {
        id: 'charge-007',
        date: getRelativeDateTime(-1),
        description: 'Room Charge - Standard Room',
        amount: 129.00,
        category: 'room',
        taxAmount: 15.48,
        total: 144.48
      },
      {
        id: 'charge-008',
        date: getRelativeDateTime(-2, 20),
        description: 'Minibar',
        amount: 18.50,
        category: 'minibar',
        taxAmount: 2.22,
        total: 20.72
      },
      {
        id: 'charge-009',
        date: getRelativeDateTime(-1, 12),
        description: 'Business Center',
        amount: 2.60,
        category: 'business',
        taxAmount: 0.31,
        total: 2.91
      }
    ],
    payments: [],
    created: getRelativeDateTime(-3),
    modified: getRelativeDateTime(-1, 12)
  },
  {
    id: 'folio-003',
    reservationId: 'res-005',
    guestId: 'guest-005',
    roomNumber: '701',
    currency: 'USD',
    totalAmount: 1243.20,
    balance: 743.20,
    status: 'open',
    charges: [
      {
        id: 'charge-010',
        date: getRelativeDateTime(-2),
        description: 'Room Charge - Presidential Suite',
        amount: 349.00,
        category: 'room',
        taxAmount: 41.88,
        total: 390.88
      },
      {
        id: 'charge-011',
        date: getRelativeDateTime(-1),
        description: 'Room Charge - Presidential Suite',
        amount: 349.00,
        category: 'room',
        taxAmount: 41.88,
        total: 390.88
      },
      {
        id: 'charge-012',
        date: getRelativeDateTime(-2, 18),
        description: 'Restaurant - Family Dinner',
        amount: 156.80,
        category: 'food_beverage',
        taxAmount: 18.82,
        total: 175.62
      },
      {
        id: 'charge-013',
        date: getRelativeDateTime(-1, 8),
        description: 'Room Service - Continental Breakfast x4',
        amount: 68.00,
        category: 'room_service',
        taxAmount: 8.16,
        total: 76.16
      },
      {
        id: 'charge-014',
        date: getRelativeDateTime(-1, 16),
        description: 'Laundry Services',
        amount: 24.50,
        category: 'laundry',
        taxAmount: 2.94,
        total: 27.44
      }
    ],
    payments: [
      {
        id: 'payment-002',
        date: getRelativeDateTime(-2),
        description: 'Cash Deposit',
        amount: 500.00,
        method: 'cash',
        status: 'completed'
      }
    ],
    created: getRelativeDateTime(-2),
    modified: getRelativeDateTime(-1, 16)
  }
];

// Data access methods
const mockData = {
  getGuests() {
    return guests;
  },

  getGuestById(guestId) {
    return guests.find(guest => guest.id === guestId);
  },

  getGuestByRoom(roomNumber) {
    return guests.find(guest => guest.roomNumber === roomNumber);
  },

  getReservations() {
    return reservations;
  },

  getReservationById(reservationId) {
    return reservations.find(reservation => reservation.id === reservationId);
  },

  getReservationsByRoom(roomNumber) {
    return reservations.filter(reservation => reservation.roomNumber === roomNumber);
  },

  getCurrentReservationByRoom(roomNumber) {
    return reservations.find(reservation => 
      reservation.roomNumber === roomNumber && 
      (reservation.status === 'in-house' || reservation.status === 'confirmed')
    );
  },

  getReservationsByGuest(guestId) {
    return reservations.filter(reservation => reservation.guestId === guestId);
  },

  getFolios() {
    return folios;
  },

  getFolioById(folioId) {
    return folios.find(folio => folio.id === folioId);
  },

  getFoliosByRoom(roomNumber) {
    return folios.filter(folio => folio.roomNumber === roomNumber);
  },

  getFoliosByReservation(reservationId) {
    return folios.filter(folio => folio.reservationId === reservationId);
  },

  getFoliosByGuest(guestId) {
    return folios.filter(folio => folio.guestId === guestId);
  },

  // Helper method to get room status with guest info
  getRoomStatus(roomNumber) {
    const reservation = this.getCurrentReservationByRoom(roomNumber);
    if (!reservation) {
      return {
        roomNumber,
        status: 'vacant',
        guest: null,
        reservation: null
      };
    }

    const guest = this.getGuestById(reservation.guestId);
    return {
      roomNumber,
      status: reservation.status,
      guest: guest ? {
        id: guest.id,
        name: `${guest.firstName} ${guest.lastName}`,
        email: guest.email,
        checkIn: reservation.arrivalDate,
        checkOut: reservation.departureDate
      } : null,
      reservation: {
        id: reservation.id,
        confirmationNumber: reservation.confirmationNumber,
        arrivalDate: reservation.arrivalDate,
        departureDate: reservation.departureDate,
        status: reservation.status,
        adults: reservation.adults,
        children: reservation.children
      }
    };
  },

  // Method to add dynamic data (for testing purposes)
  addGuest(guestData) {
    const guest = {
      id: `guest-${Date.now()}`,
      ...guestData
    };
    guests.push(guest);
    return guest;
  },

  addReservation(reservationData) {
    const reservation = {
      id: `res-${Date.now()}`,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      ...reservationData
    };
    reservations.push(reservation);
    return reservation;
  },

  addFolio(folioData) {
    const folio = {
      id: `folio-${Date.now()}`,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      charges: [],
      payments: [],
      ...folioData
    };
    folios.push(folio);
    return folio;
  }
};

module.exports = mockData;
