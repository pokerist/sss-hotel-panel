const logger = require('../utils/logger');
const PMSService = require('./pmsService');
const DeviceManager = require('./deviceManager');
const Settings = require('../models/Settings');

class GuestAutomation {
  constructor() {
    this.initialized = false;
    this.intervalId = null;
    this.checkInterval = 5 * 60 * 1000; // 5 minutes
  }

  async initialize() {
    try {
      logger.info('Initializing Guest Automation Service...');
      
      // Start the automation loop
      this.startAutomationLoop();
      
      this.initialized = true;
      logger.info('Guest Automation Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Guest Automation Service:', error.message);
      this.initialized = true; // Don't fail startup
    }
  }

  startAutomationLoop() {
    // Check every 5 minutes for guest automation triggers
    this.intervalId = setInterval(async () => {
      await this.processAutomationTriggers();
    }, this.checkInterval);

    logger.info('Guest automation loop started');
  }

  async processAutomationTriggers() {
    try {
      if (!PMSService.isConnected()) {
        return; // Skip if PMS is not connected
      }

      logger.debug('Processing guest automation triggers...');

      // Get all approved devices with room assignments
      const Device = require('../models/Device');
      const devices = await Device.find({ 
        status: 'approved', 
        roomNumber: { $exists: true, $ne: null } 
      });

      for (const device of devices) {
        try {
          await this.checkGuestTriggers(device);
        } catch (error) {
          logger.error(`Failed to process triggers for device ${device.uuid}:`, error.message);
        }
      }

    } catch (error) {
      logger.error('Failed to process automation triggers:', error.message);
    }
  }

  async checkGuestTriggers(device) {
    try {
      // Get guest information for this room
      const guestInfo = await PMSService.getGuestByRoom(device.roomNumber);
      if (!guestInfo || !guestInfo.guest || !guestInfo.reservation) {
        return;
      }

      const now = new Date();
      const checkIn = new Date(guestInfo.reservation.checkIn);
      const checkOut = new Date(guestInfo.reservation.checkOut);

      // Check for welcome message trigger (within 15 minutes of check-in)
      const timeSinceCheckIn = now - checkIn;
      if (timeSinceCheckIn >= 0 && timeSinceCheckIn <= 15 * 60 * 1000) {
        await this.sendWelcomeMessage(device, guestInfo);
      }

      // Check for farewell message trigger (15 minutes before check-out)
      const timeUntilCheckOut = checkOut - now;
      if (timeUntilCheckOut > 0 && timeUntilCheckOut <= 15 * 60 * 1000) {
        await this.sendFarewellMessage(device, guestInfo);
      }

    } catch (error) {
      logger.error(`Failed to check guest triggers for room ${device.roomNumber}:`, error.message);
    }
  }

  async sendWelcomeMessage(device, guestInfo) {
    try {
      // Check if we already sent a welcome message recently
      const lastWelcome = device.lastWelcomeMessage;
      if (lastWelcome && (new Date() - lastWelcome) < 24 * 60 * 60 * 1000) {
        return; // Already sent within last 24 hours
      }

      // Get welcome message template
      const welcomeTemplate = await Settings.getValue('welcome_message_template') || 
        "Welcome, {{guest_name}}! We hope you enjoy your stay in room {{room_number}}.";

      // Replace placeholders
      const message = this.replacePlaceholders(welcomeTemplate, {
        guest_name: guestInfo.guest.name || guestInfo.guest.firstName || 'Guest',
        room_number: device.roomNumber,
        check_in_time: this.formatTime(guestInfo.reservation.checkIn),
        check_out_time: this.formatTime(guestInfo.reservation.checkOut)
      });

      // Send welcome message via DeviceManager
      const result = await DeviceManager.sendWelcomeMessage(device.uuid, message);
      
      if (result.success) {
        // Update device record
        await device.updateOne({ lastWelcomeMessage: new Date() });
        logger.info(`Welcome message sent to room ${device.roomNumber} for guest ${guestInfo.guest.name}`);
      }

    } catch (error) {
      logger.error(`Failed to send welcome message to room ${device.roomNumber}:`, error.message);
    }
  }

  async sendFarewellMessage(device, guestInfo) {
    try {
      // Check if we already sent a farewell message recently
      const lastFarewell = device.lastFarewellMessage;
      if (lastFarewell && (new Date() - lastFarewell) < 6 * 60 * 60 * 1000) {
        return; // Already sent within last 6 hours
      }

      // Get farewell message template
      const farewellTemplate = await Settings.getValue('farewell_message_template') || 
        "Dear {{guest_name}}, we hope you had a great stay. Checkout is at {{check_out_time}}. Safe travels!";

      // Replace placeholders
      const message = this.replacePlaceholders(farewellTemplate, {
        guest_name: guestInfo.guest.name || guestInfo.guest.firstName || 'Guest',
        room_number: device.roomNumber,
        check_in_time: this.formatTime(guestInfo.reservation.checkIn),
        check_out_time: this.formatTime(guestInfo.reservation.checkOut)
      });

      // Send farewell message via DeviceManager
      const result = await DeviceManager.sendFarewellMessage(device.uuid, message);
      
      if (result.success) {
        // Update device record
        await device.updateOne({ lastFarewellMessage: new Date() });
        logger.info(`Farewell message sent to room ${device.roomNumber} for guest ${guestInfo.guest.name}`);
      }

    } catch (error) {
      logger.error(`Failed to send farewell message to room ${device.roomNumber}:`, error.message);
    }
  }

  replacePlaceholders(template, variables) {
    let message = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      message = message.replace(new RegExp(placeholder, 'g'), value || '');
    }
    
    return message;
  }

  formatTime(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return dateString;
    }
  }

  async triggerWelcomeMessage(roomNumber, guestName) {
    try {
      const Device = require('../models/Device');
      const device = await Device.findOne({ roomNumber, status: 'approved' });
      
      if (!device) {
        logger.warn(`No approved device found for room ${roomNumber}`);
        return { success: false, message: 'Device not found' };
      }

      const welcomeTemplate = await Settings.getValue('welcome_message_template') || 
        "Welcome, {{guest_name}}! We hope you enjoy your stay in room {{room_number}}.";

      const message = this.replacePlaceholders(welcomeTemplate, {
        guest_name: guestName,
        room_number: roomNumber
      });

      const result = await DeviceManager.sendWelcomeMessage(device.uuid, message);
      
      if (result.success) {
        await device.updateOne({ lastWelcomeMessage: new Date() });
        logger.info(`Manual welcome message sent to room ${roomNumber} for guest ${guestName}`);
      }

      return result;
    } catch (error) {
      logger.error(`Failed to trigger welcome message for room ${roomNumber}:`, error.message);
      return { success: false, message: error.message };
    }
  }

  async triggerFarewellMessage(roomNumber, guestName) {
    try {
      const Device = require('../models/Device');
      const device = await Device.findOne({ roomNumber, status: 'approved' });
      
      if (!device) {
        logger.warn(`No approved device found for room ${roomNumber}`);
        return { success: false, message: 'Device not found' };
      }

      const farewellTemplate = await Settings.getValue('farewell_message_template') || 
        "Dear {{guest_name}}, we hope you had a great stay. Safe travels!";

      const message = this.replacePlaceholders(farewellTemplate, {
        guest_name: guestName,
        room_number: roomNumber
      });

      const result = await DeviceManager.sendFarewellMessage(device.uuid, message);
      
      if (result.success) {
        await device.updateOne({ lastFarewellMessage: new Date() });
        logger.info(`Manual farewell message sent to room ${roomNumber} for guest ${guestName}`);
      }

      return result;
    } catch (error) {
      logger.error(`Failed to trigger farewell message for room ${roomNumber}:`, error.message);
      return { success: false, message: error.message };
    }
  }

  isInitialized() {
    return this.initialized;
  }

  getStatus() {
    return {
      initialized: this.initialized,
      checkInterval: this.checkInterval,
      running: this.intervalId !== null
    };
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Guest automation loop stopped');
    }
  }
}

module.exports = new GuestAutomation();
