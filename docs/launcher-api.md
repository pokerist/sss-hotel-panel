# Launcher API Integration Guide

This document describes how to integrate Android TV launcher applications with the IPTV Hotel Control Panel.

## Overview

The Launcher API enables Android TV devices to communicate with the hotel control panel for device registration, configuration updates, and real-time messaging.

## Base URL

```
http://your-panel-server/api/launcher
```

## Authentication

Device authentication uses UUID-based identification. After registration, devices should include their UUID in requests for identification.

## Device Lifecycle

### 1. Device Registration

**Endpoint:** `POST /register`

**Purpose:** Register a new device with the panel for approval

**Request:**
```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "macAddress": "00:11:22:33:44:55",
  "deviceInfo": {
    "model": "NVIDIA Shield TV",
    "androidVersion": "11",
    "resolution": "1920x1080",
    "storage": "16GB",
    "memory": "3GB"
  },
  "version": "1.0.0"
}
```

**Response (New Device):**
```json
{
  "success": true,
  "message": "Device registered successfully",
  "data": {
    "deviceId": "64f1a2b3c4d5e6f7g8h9i0j1",
    "status": "pending",
    "requiresApproval": true,
    "message": "Device registration pending admin approval"
  }
}
```

**Response (Existing Device):**
```json
{
  "success": true,
  "message": "Device reconnected",
  "data": {
    "deviceId": "64f1a2b3c4d5e6f7g8h9i0j1",
    "status": "approved",
    "roomNumber": "304",
    "requiresApproval": false
  }
}
```

### 2. Heartbeat

**Endpoint:** `POST /heartbeat`

**Purpose:** Maintain connection and update device status

**Headers:**
```
X-Device-UUID: 550e8400-e29b-41d4-a716-446655440000
```

**Request:**
```json
{
  "status": "online",
  "uptime": 86400,
  "lastActivity": "2023-08-01T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Heartbeat received",
  "data": {
    "serverTime": "2023-08-01T10:30:15Z",
    "status": "approved",
    "roomNumber": "304"
  }
}
```

### 3. Get Configuration

**Endpoint:** `GET /config`

**Purpose:** Retrieve device configuration, apps, and settings

**Headers:**
```
X-Device-UUID: 550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "success": true,
  "data": {
    "device": {
      "id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "status": "approved"
    },
    "room": "304",
    "guest": {
      "name": "John Doe",
      "checkIn": "2023-08-01T14:00:00Z",
      "checkOut": "2023-08-05T11:00:00Z",
      "bill": {
        "total": 740.50,
        "currency": "USD"
      }
    },
    "panel": {
      "name": "Marmarica Hotel Panel",
      "version": "1.0.0"
    },
    "apps": [
      {
        "id": "netflix",
        "label": "Netflix",
        "icon": "https://panel.local/uploads/app-icons/netflix.png",
        "url": "https://play.google.com/store/apps/details?id=com.netflix.mediaclient",
        "position": 0,
        "isVisible": true
      },
      {
        "id": "youtube",
        "label": "YouTube",
        "icon": "https://panel.local/uploads/app-icons/youtube.png",
        "url": "https://play.google.com/store/apps/details?id=com.google.android.youtube.tv",
        "position": 1,
        "isVisible": true
      }
    ],
    "backgroundBundle": {
      "id": "nature-collection",
      "backgrounds": [
        {
          "type": "image",
          "url": "https://panel.local/uploads/backgrounds/nature1.jpg",
          "duration": 30
        },
        {
          "type": "video",
          "url": "https://panel.local/uploads/backgrounds/ocean.mp4",
          "duration": null
        }
      ],
      "settings": {
        "transitionType": "fade",
        "shuffle": false
      }
    },
    "settings": {
      "volume": 50,
      "brightness": 75,
      "sleepTimeout": 30,
      "autoStart": true
    },
    "messageTemplates": {
      "welcome": "Welcome, {{guest_name}}! We hope you enjoy your stay in room {{room_number}}.",
      "farewell": "Dear {{guest_name}}, we hope you had a great stay. Checkout is at {{check_out_time}}. Safe travels!"
    },
    "lastUpdated": "2023-08-01T10:30:00Z"
  }
}
```

## Real-time Communication

### WebSocket Connection

Connect to WebSocket for real-time updates:

```javascript
const socket = io('http://your-panel-server:4000', {
  auth: {
    uuid: 'your-device-uuid'
  }
});

socket.on('connect', () => {
  console.log('Connected to panel');
  
  // Join device-specific room
  socket.emit('join-device-room', uuid);
});
```

### Message Types

#### Welcome Message
```json
{
  "type": "MESSAGE",
  "subtype": "WELCOME",
  "messageId": "msg-12345",
  "content": "Welcome, John! We hope you enjoy your stay in room 304.",
  "timestamp": "2023-08-01T14:00:00Z",
  "autoHide": 10000
}
```

#### Farewell Message
```json
{
  "type": "MESSAGE", 
  "subtype": "FAREWELL",
  "messageId": "msg-12346",
  "content": "Dear John, we hope you had a great stay. Checkout is at 11:00 AM. Safe travels!",
  "timestamp": "2023-08-05T10:45:00Z",
  "autoHide": 15000
}
```

#### Device Commands

**Reboot Command:**
```json
{
  "type": "REBOOT",
  "requestedBy": "Admin User",
  "timestamp": "2023-08-01T10:30:00Z"
}
```

**Configuration Update:**
```json
{
  "type": "CONFIG_UPDATE",
  "requestedBy": "Admin User",
  "timestamp": "2023-08-01T10:30:00Z"
}
```

**App Installation:**
```json
{
  "type": "INSTALL_APP",
  "app": {
    "id": "netflix",
    "name": "Netflix",
    "url": "https://play.google.com/store/apps/details?id=com.netflix.mediaclient",
    "icon": "https://panel.local/uploads/app-icons/netflix.png"
  },
  "requestedBy": "Admin User",
  "timestamp": "2023-08-01T10:30:00Z"
}
```

**Device Status:**
```json
{
  "type": "STATUS_CHANGE",
  "status": "approved",
  "roomNumber": "304",
  "timestamp": "2023-08-01T10:30:00Z"
}
```

## Device Reporting

### Status Reports

**Endpoint:** `POST /status`

**Purpose:** Report device status, errors, or information

**Headers:**
```
X-Device-UUID: 550e8400-e29b-41d4-a716-446655440000
```

**Request:**
```json
{
  "type": "error",
  "message": "Failed to install Netflix",
  "details": {
    "errorCode": "INSTALL_FAILED",
    "appId": "netflix",
    "retryCount": 3
  }
}
```

### Message Acknowledgments

**Endpoint:** `POST /message-ack`

**Purpose:** Acknowledge receipt and display of messages

**Request:**
```json
{
  "messageId": "msg-12345",
  "type": "WELCOME",
  "status": "displayed"
}
```

**Status Values:**
- `delivered` - Message received
- `displayed` - Message shown to user
- `dismissed` - Message dismissed by user
- `error` - Error displaying message

### App Installation Reports

**Endpoint:** `POST /app-install-ack`

**Purpose:** Report app installation results

**Request:**
```json
{
  "appId": "netflix",
  "status": "success"
}
```

**Status Values:**
- `success` - App installed successfully
- `failed` - Installation failed
- `not_found` - App not found in store

### Diagnostics

**Endpoint:** `POST /diagnostics`

**Purpose:** Send device diagnostic information

**Request:**
```json
{
  "diagnostics": {
    "cpuUsage": 45.2,
    "memoryUsage": 67.8,
    "storageUsage": 23.1,
    "temperature": 42,
    "networkLatency": 12,
    "lastReboot": "2023-07-30T08:00:00Z",
    "runningApps": ["com.netflix.mediaclient", "com.google.android.youtube.tv"],
    "errors": []
  }
}
```

## Error Handling

### Common Error Codes

- `DEVICE_NOT_FOUND` - Device UUID not registered
- `DEVICE_NOT_APPROVED` - Device pending approval
- `VALIDATION_ERROR` - Invalid request data
- `AUTHENTICATION_ERROR` - Invalid or missing UUID
- `SERVER_ERROR` - Internal server error

### Error Response Format

```json
{
  "success": false,
  "message": "Device not approved",
  "code": "DEVICE_NOT_APPROVED",
  "timestamp": "2023-08-01T10:30:00Z"
}
```

## Implementation Examples

### Android (Java/Kotlin)

```kotlin
class PanelApiClient {
    private val baseUrl = "http://panel-server/api/launcher"
    private val uuid = getDeviceUUID()
    
    fun registerDevice() {
        val request = DeviceRegistration(
            uuid = uuid,
            macAddress = getMacAddress(),
            deviceInfo = getDeviceInfo()
        )
        
        // Make HTTP POST request
        apiService.register(request).enqueue(object : Callback<ApiResponse> {
            override fun onResponse(response: Response<ApiResponse>) {
                if (response.isSuccessful) {
                    handleRegistrationSuccess(response.body())
                }
            }
            
            override fun onFailure(t: Throwable) {
                handleRegistrationError(t)
            }
        })
    }
    
    fun startHeartbeat() {
        timer = Timer()
        timer.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                sendHeartbeat()
            }
        }, 0, 30000) // Every 30 seconds
    }
}
```

### JavaScript/TypeScript

```typescript
class LauncherAPI {
  private baseUrl: string;
  private uuid: string;
  private socket: Socket;
  
  constructor(panelUrl: string, deviceUuid: string) {
    this.baseUrl = `${panelUrl}/api/launcher`;
    this.uuid = deviceUuid;
  }
  
  async registerDevice(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uuid: this.uuid,
        macAddress: await this.getMacAddress(),
        deviceInfo: await this.getDeviceInfo()
      })
    });
    
    const result = await response.json();
    this.handleRegistrationResult(result);
  }
  
  connectWebSocket(): void {
    this.socket = io(this.baseUrl.replace('/api/launcher', ''), {
      auth: { uuid: this.uuid }
    });
    
    this.socket.on('MESSAGE', this.handleMessage.bind(this));
    this.socket.on('REBOOT', this.handleReboot.bind(this));
    this.socket.on('CONFIG_UPDATE', this.refreshConfig.bind(this));
  }
}
```

## Best Practices

1. **Connection Management**
   - Implement reconnection logic for network interruptions
   - Use exponential backoff for failed requests
   - Maintain persistent WebSocket connection

2. **Error Handling**
   - Always handle API errors gracefully
   - Implement fallback behavior for offline scenarios
   - Log errors for debugging

3. **Performance**
   - Cache configuration data locally
   - Implement efficient background sync
   - Minimize API calls during active use

4. **Security**
   - Validate all incoming WebSocket messages
   - Sanitize display content
   - Use HTTPS in production

5. **User Experience**
   - Show connection status to users
   - Provide offline functionality where possible
   - Handle message display thoughtfully

## Testing

Use the mock PMS server for development:

```bash
cd backend
npm run mock-pms
```

This provides test endpoints and data for launcher development.
