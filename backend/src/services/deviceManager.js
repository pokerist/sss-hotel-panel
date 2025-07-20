const logger = require('../utils/logger');
const Device = require('../models/Device');

class DeviceManager {
  constructor() {
    this.initialized = false;
    this.connectedDevices = new Map();
  }

  async initialize() {
    try {
      logger.info('Initializing Device Manager Service...');
      
      // Load existing devices from database
      await this.loadExistingDevices();
      
      this.initialized = true;
      logger.info('Device Manager Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Device Manager Service:', error.message);
      this.initialized = true; // Don't fail startup
    }
  }

  async loadExistingDevices() {
    try {
      const devices = await Device.find({ status: 'approved' });
      logger.info(`Loaded ${devices.length} approved devices from database`);
    } catch (error) {
      logger.error('Failed to load existing devices:', error.message);
    }
  }

  async handleRegistration(socket, data) {
    try {
      logger.info('Device registration request received', { uuid: data.uuid });

      // Check if device already exists
      let device = await Device.findOne({ uuid: data.uuid });
      
      if (device) {
        // Device exists, update connection status
        device.connectionStatus = 'online';
        device.lastHeartbeat = new Date();
        await device.save();

        socket.emit('registration-response', {
          success: true,
          message: 'Device reconnected',
          data: {
            deviceId: device._id,
            status: device.status,
            roomNumber: device.roomNumber,
            requiresApproval: false
          }
        });

        logger.info('Device reconnected', { uuid: data.uuid, roomNumber: device.roomNumber });
      } else {
        // New device registration
        device = new Device({
          uuid: data.uuid,
          macAddress: data.macAddress,
          deviceInfo: data.deviceInfo,
          version: data.version,
          status: 'pending',
          connectionStatus: 'online',
          lastHeartbeat: new Date()
        });

        await device.save();

        socket.emit('registration-response', {
          success: true,
          message: 'Device registered successfully',
          data: {
            deviceId: device._id,
            status: 'pending',
            requiresApproval: true,
            message: 'Device registration pending admin approval'
          }
        });

        // Notify admins of new device registration
        if (global.io) {
          global.io.to('admin-room').emit('device:new-registration', {
            uuid: data.uuid,
            macAddress: data.macAddress,
            deviceInfo: data.deviceInfo
          });
        }

        logger.info('New device registered', { uuid: data.uuid });
      }

      this.connectedDevices.set(data.uuid, {
        socket,
        device,
        lastSeen: new Date()
      });

    } catch (error) {
      logger.error('Device registration failed:', error);
      socket.emit('registration-response', {
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  }

  async handleHeartbeat(socket, data) {
    try {
      const deviceUuid = socket.deviceUuid || data.uuid;
      
      if (!deviceUuid) {
        logger.warn('Heartbeat received without device UUID');
        return;
      }

      // Update device in database
      const device = await Device.findOne({ uuid: deviceUuid });
      if (device) {
        device.lastHeartbeat = new Date();
        device.connectionStatus = 'online';
        await device.save();
      }

      // Update in-memory tracking
      const deviceInfo = this.connectedDevices.get(deviceUuid);
      if (deviceInfo) {
        deviceInfo.lastSeen = new Date();
      }

      socket.emit('heartbeat-response', {
        success: true,
        serverTime: new Date().toISOString(),
        status: device?.status || 'unknown',
        roomNumber: device?.roomNumber
      });

    } catch (error) {
      logger.error('Heartbeat handling failed:', error);
      socket.emit('heartbeat-response', {
        success: false,
        message: 'Heartbeat failed',
        error: error.message
      });
    }
  }

  async sendRebootCommand(deviceUuid, requestedBy) {
    try {
      const deviceInfo = this.connectedDevices.get(deviceUuid);
      if (deviceInfo && deviceInfo.socket) {
        deviceInfo.socket.emit('REBOOT', {
          requestedBy,
          timestamp: new Date().toISOString()
        });
        
        logger.info(`Reboot command sent to device ${deviceUuid} by ${requestedBy}`);
        return { success: true };
      } else {
        logger.warn(`Device ${deviceUuid} not connected, cannot send reboot command`);
        return { success: false, message: 'Device not connected' };
      }
    } catch (error) {
      logger.error('Failed to send reboot command:', error);
      return { success: false, message: error.message };
    }
  }

  async sendConfigUpdate(deviceUuid, requestedBy) {
    try {
      const deviceInfo = this.connectedDevices.get(deviceUuid);
      if (deviceInfo && deviceInfo.socket) {
        deviceInfo.socket.emit('CONFIG_UPDATE', {
          requestedBy,
          timestamp: new Date().toISOString()
        });
        
        logger.info(`Config update sent to device ${deviceUuid} by ${requestedBy}`);
        return { success: true };
      } else {
        logger.warn(`Device ${deviceUuid} not connected, cannot send config update`);
        return { success: false, message: 'Device not connected' };
      }
    } catch (error) {
      logger.error('Failed to send config update:', error);
      return { success: false, message: error.message };
    }
  }

  async sendWelcomeMessage(deviceUuid, message) {
    try {
      const deviceInfo = this.connectedDevices.get(deviceUuid);
      if (deviceInfo && deviceInfo.socket) {
        deviceInfo.socket.emit('MESSAGE', {
          type: 'MESSAGE',
          subtype: 'WELCOME',
          messageId: `welcome-${Date.now()}`,
          content: message,
          timestamp: new Date().toISOString(),
          autoHide: 10000
        });
        
        logger.info(`Welcome message sent to device ${deviceUuid}`);
        return { success: true };
      } else {
        logger.warn(`Device ${deviceUuid} not connected, cannot send welcome message`);
        return { success: false, message: 'Device not connected' };
      }
    } catch (error) {
      logger.error('Failed to send welcome message:', error);
      return { success: false, message: error.message };
    }
  }

  async sendFarewellMessage(deviceUuid, message) {
    try {
      const deviceInfo = this.connectedDevices.get(deviceUuid);
      if (deviceInfo && deviceInfo.socket) {
        deviceInfo.socket.emit('MESSAGE', {
          type: 'MESSAGE',
          subtype: 'FAREWELL',
          messageId: `farewell-${Date.now()}`,
          content: message,
          timestamp: new Date().toISOString(),
          autoHide: 15000
        });
        
        logger.info(`Farewell message sent to device ${deviceUuid}`);
        return { success: true };
      } else {
        logger.warn(`Device ${deviceUuid} not connected, cannot send farewell message`);
        return { success: false, message: 'Device not connected' };
      }
    } catch (error) {
      logger.error('Failed to send farewell message:', error);
      return { success: false, message: error.message };
    }
  }

  getConnectedDevicesCount() {
    return this.connectedDevices.size;
  }

  isDeviceConnected(uuid) {
    return this.connectedDevices.has(uuid);
  }

  getStatus() {
    return {
      initialized: this.initialized,
      connectedDevices: this.connectedDevices.size,
      devices: Array.from(this.connectedDevices.keys())
    };
  }

  // Cleanup disconnected devices periodically
  startCleanupTask() {
    setInterval(() => {
      const now = new Date();
      const timeout = 5 * 60 * 1000; // 5 minutes

      for (const [uuid, deviceInfo] of this.connectedDevices.entries()) {
        if (now - deviceInfo.lastSeen > timeout) {
          this.connectedDevices.delete(uuid);
          logger.info(`Cleaned up disconnected device: ${uuid}`);
        }
      }
    }, 60 * 1000); // Run every minute
  }
}

module.exports = new DeviceManager();
