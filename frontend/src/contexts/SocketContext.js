import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useSnackbar } from 'notistack';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (user) {
      // Initialize socket connection
      const socketUrl = process.env.REACT_APP_SOCKET_URL || window.location.origin;
      console.log('Connecting to Socket.IO server at:', socketUrl);
      
      const socketInstance = io(socketUrl, {
        auth: {
          token: localStorage.getItem('token')
        },
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: true,
        timeout: 20000,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      // Connection events
      socketInstance.on('connect', () => {
        console.log('Connected to server');
        setConnected(true);
        
        // Join admin room for admin-specific notifications
        if (user.role === 'admin' || user.role === 'super_admin') {
          socketInstance.emit('admin:join-room', 'notifications');
        }
      });

      socketInstance.on('disconnect', () => {
        console.log('Disconnected from server');
        setConnected(false);
      });

      socketInstance.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        console.error('Failed to connect to:', socketUrl);
        setConnected(false);
        enqueueSnackbar(
          'WebSocket connection failed. Some features may not work properly.',
          { 
            variant: 'error',
            autoHideDuration: 6000
          }
        );
      });

      socketInstance.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        enqueueSnackbar(
          'Connection restored',
          { 
            variant: 'success',
            autoHideDuration: 3000
          }
        );
      });

      socketInstance.on('reconnect_error', (error) => {
        console.error('Socket reconnection error:', error);
      });

      socketInstance.on('reconnect_failed', () => {
        console.error('Socket reconnection failed');
        enqueueSnackbar(
          'Failed to reconnect. Please refresh the page.',
          { 
            variant: 'error',
            persist: true
          }
        );
      });

      // Device events
      socketInstance.on('device:new-registration', (data) => {
        enqueueSnackbar(
          `New device registration: ${data.uuid} (${data.macAddress})`,
          { 
            variant: 'info',
            autoHideDuration: 5000
          }
        );
      });

      socketInstance.on('device:approved', (data) => {
        enqueueSnackbar(
          `Device approved: Room ${data.roomNumber || 'N/A'}`,
          { 
            variant: 'success',
            autoHideDuration: 3000
          }
        );
      });

      socketInstance.on('device:rejected', (data) => {
        enqueueSnackbar(
          `Device rejected: ${data.uuid}`,
          { 
            variant: 'warning',
            autoHideDuration: 3000
          }
        );
      });

      socketInstance.on('device:status-alert', (data) => {
        const variant = data.type === 'error' ? 'error' : 'warning';
        enqueueSnackbar(
          `Device ${data.roomNumber || data.uuid}: ${data.message}`,
          { 
            variant,
            autoHideDuration: 6000
          }
        );
      });

      socketInstance.on('device:offline', (data) => {
        enqueueSnackbar(
          `Device offline: Room ${data.roomNumber || data.uuid}`,
          { 
            variant: 'warning',
            autoHideDuration: 4000
          }
        );
      });

      // PMS events
      socketInstance.on('pms:sync-started', (data) => {
        enqueueSnackbar(
          `PMS sync started by ${data.triggeredBy}`,
          { 
            variant: 'info',
            autoHideDuration: 3000
          }
        );
      });

      socketInstance.on('pms:sync-completed', (data) => {
        enqueueSnackbar(
          `PMS sync completed: ${data.guestsSync} guests synced`,
          { 
            variant: 'success',
            autoHideDuration: 4000
          }
        );
      });

      socketInstance.on('pms:sync-failed', (data) => {
        enqueueSnackbar(
          `PMS sync failed: ${data.error}`,
          { 
            variant: 'error',
            autoHideDuration: 6000
          }
        );
      });

      // Settings events
      socketInstance.on('setting:updated', (data) => {
        enqueueSnackbar(
          `Setting updated: ${data.key} by ${data.updatedBy}`,
          { 
            variant: 'info',
            autoHideDuration: 3000
          }
        );
      });

      // Background events
      socketInstance.on('background:bundle-assigned', (data) => {
        enqueueSnackbar(
          `Background bundle assigned to ${data.assignments.length} target(s)`,
          { 
            variant: 'success',
            autoHideDuration: 3000
          }
        );
      });

      // App events
      socketInstance.on('app:assignments-updated', (data) => {
        enqueueSnackbar(
          `Apps assigned to ${data.assignments.length} target(s)`,
          { 
            variant: 'success',
            autoHideDuration: 3000
          }
        );
      });

      socketInstance.on('device:app-install-result', (data) => {
        const variant = data.status === 'success' ? 'success' : 'error';
        const message = data.status === 'success' 
          ? `App installed successfully on device ${data.roomNumber || data.uuid}`
          : `App installation failed on device ${data.roomNumber || data.uuid}: ${data.error}`;
        
        enqueueSnackbar(message, { 
          variant,
          autoHideDuration: 5000
        });
      });

      // System events
      socketInstance.on('system:alert', (data) => {
        enqueueSnackbar(
          data.message,
          { 
            variant: data.type || 'warning',
            autoHideDuration: data.autoHide !== false ? 6000 : null
          }
        );
      });

      socketInstance.on('user:logged-out', (data) => {
        if (data.userId !== user.id) {
          enqueueSnackbar(
            `User ${data.userName} logged out`,
            { 
              variant: 'info',
              autoHideDuration: 3000
            }
          );
        }
      });

      setSocket(socketInstance);

      // Cleanup on unmount
      return () => {
        socketInstance.disconnect();
      };
    }
  }, [user, enqueueSnackbar]);

  // Socket helper functions
  const emitEvent = (event, data) => {
    if (socket && connected) {
      socket.emit(event, data);
    }
  };

  const joinRoom = (room) => {
    if (socket && connected) {
      socket.emit('join-room', room);
    }
  };

  const leaveRoom = (room) => {
    if (socket && connected) {
      socket.emit('leave-room', room);
    }
  };

  const subscribeToDeviceUpdates = () => {
    if (socket && connected) {
      socket.emit('subscribe-device-updates');
    }
  };

  const unsubscribeFromDeviceUpdates = () => {
    if (socket && connected) {
      socket.emit('unsubscribe-device-updates');
    }
  };

  const value = {
    socket,
    connected,
    emitEvent,
    joinRoom,
    leaveRoom,
    subscribeToDeviceUpdates,
    unsubscribeFromDeviceUpdates,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
