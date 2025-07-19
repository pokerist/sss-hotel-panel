# IPTV Hotel Control Panel - API Documentation

Complete REST API reference for the IPTV Hotel Control Panel backend.

## Base URL

```
http://your-panel-server/api
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this standard format:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Validation errors (if applicable)
  ]
}
```

## Authentication Endpoints

### Login
**POST** `/auth/login`

Authenticate user and receive access token.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "name": "Admin User",
      "email": "admin@example.com",
      "role": "admin"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Refresh Token
**POST** `/auth/refresh`

Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Get User Profile
**GET** `/auth/profile`

Get current user information.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "name": "Admin User",
      "email": "admin@example.com",
      "role": "admin",
      "createdAt": "2023-08-01T10:00:00Z"
    }
  }
}
```

### Logout
**POST** `/auth/logout`

Invalidate current session.

**Headers:** `Authorization: Bearer <token>`

## Device Management

### List Devices
**GET** `/devices`

Get all devices with filtering and pagination.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)
- `status` - Filter by status: pending, approved, rejected, inactive
- `connectionStatus` - Filter by connection: online, offline, idle
- `roomNumber` - Filter by room number
- `search` - Search by UUID, MAC address, room number, or notes

**Response:**
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "id": "64f1a2b3c4d5e6f7g8h9i0j1",
        "uuid": "550e8400-e29b-41d4-a716-446655440000",
        "macAddress": "00:11:22:33:44:55",
        "roomNumber": "304",
        "status": "approved",
        "connectionStatus": "online",
        "lastHeartbeat": "2023-08-01T10:30:00Z",
        "deviceInfo": {
          "model": "NVIDIA Shield TV",
          "androidVersion": "11"
        },
        "approvedBy": {
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "createdAt": "2023-08-01T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "pages": 1
    }
  }
}
```

### Get Device
**GET** `/devices/:deviceId`

Get specific device details.

**Response:**
```json
{
  "success": true,
  "data": {
    "device": {
      "id": "64f1a2b3c4d5e6f7g8h9i0j1",
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "macAddress": "00:11:22:33:44:55",
      "roomNumber": "304",
      "status": "approved",
      "connectionStatus": "online",
      "configuration": {
        "appLayout": [],
        "backgroundBundle": null
      },
      "statistics": {
        "totalUptime": 86400,
        "configPushCount": 5,
        "messagesReceived": 12
      }
    }
  }
}
```

### Approve Device
**POST** `/devices/:deviceId/approve`

Approve a pending device.

**Request:**
```json
{
  "roomNumber": "304"
}
```

### Reject Device
**POST** `/devices/:deviceId/reject`

Reject a pending device.

### Update Device
**PUT** `/devices/:deviceId`

Update device details.

**Request:**
```json
{
  "roomNumber": "305",
  "notes": "Moved to different room"
}
```

### Reboot Device
**POST** `/devices/:deviceId/reboot`

Send reboot command to device.

### Push Configuration
**POST** `/devices/:deviceId/push-config`

Push updated configuration to device.

### Delete Device
**DELETE** `/devices/:deviceId`

Delete device (Super Admin only).

### Device Statistics
**GET** `/devices/stats`

Get device statistics summary.

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 25,
      "online": 18,
      "offline": 4,
      "pending": 3,
      "approved": 22,
      "rejected": 0
    }
  }
}
```

## Apps Management

### List Apps
**GET** `/apps`

Get all apps with filtering.

**Query Parameters:**
- `page`, `limit` - Pagination
- `category` - Filter by category
- `search` - Search by name, description, or package name

**Response:**
```json
{
  "success": true,
  "data": {
    "apps": [
      {
        "id": "64f1a2b3c4d5e6f7g8h9i0j1",
        "name": "Netflix",
        "description": "Streaming entertainment service",
        "category": "entertainment",
        "icon": "/uploads/app-icons/netflix.png",
        "packageName": "com.netflix.mediaclient",
        "url": "https://play.google.com/store/apps/details?id=com.netflix.mediaclient",
        "version": "8.0.0",
        "isActive": true,
        "assignedDevices": 12
      }
    ]
  }
}
```

### Create App
**POST** `/apps`

Create new app entry.

**Content-Type:** `multipart/form-data`

**Fields:**
- `name` - App name (required)
- `description` - App description
- `category` - App category (required)
- `packageName` - Android package name
- `url` - Store URL (required)
- `version` - App version
- `icon` - Icon file (image upload)

### Assign Apps
**POST** `/apps/assign`

Assign apps to devices or rooms.

**Request:**
```json
{
  "appIds": ["app1", "app2"],
  "deviceIds": ["device1", "device2"],
  "roomNumbers": ["304", "305"],
  "position": 0
}
```

### Trigger App Installation
**POST** `/apps/:appId/install`

Trigger app installation on specific devices.

**Request:**
```json
{
  "deviceIds": ["device1", "device2"]
}
```

### Get App Categories
**GET** `/apps/categories`

Get all app categories.

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "entertainment",
        "name": "Entertainment",
        "appCount": 5
      }
    ]
  }
}
```

## Background Management

### List Backgrounds
**GET** `/backgrounds`

Get all background images/videos.

**Query Parameters:**
- `page`, `limit` - Pagination
- `type` - Filter by type: image, video
- `bundleId` - Filter by bundle

### Upload Background
**POST** `/backgrounds/upload`

Upload background file.

**Content-Type:** `multipart/form-data`

**Fields:**
- `background` - File upload (required)
- `name` - Display name

### List Background Bundles
**GET** `/backgrounds/bundles`

Get all background bundles.

### Create Background Bundle
**POST** `/backgrounds/bundles`

Create new background bundle.

**Request:**
```json
{
  "name": "Nature Collection",
  "description": "Beautiful nature scenes",
  "backgroundIds": ["bg1", "bg2", "bg3"]
}
```

### Assign Background Bundle
**POST** `/backgrounds/assign`

Assign bundle to devices/rooms.

**Request:**
```json
{
  "bundleId": "bundle1",
  "deviceIds": ["device1"],
  "roomNumbers": ["304"]
}
```

## PMS Integration

### PMS Status
**GET** `/pms/status`

Get PMS connection status.

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "status": "connected",
    "message": "PMS connection successful",
    "mockMode": false,
    "version": "1.0.0",
    "lastCheck": "2023-08-01T10:30:00Z"
  }
}
```

### Get Guest Information
**GET** `/pms/guest/:roomNumber`

Get guest information for specific room.

**Response:**
```json
{
  "success": true,
  "data": {
    "guest": {
      "id": "guest123",
      "name": "John Doe",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "reservation": {
      "id": "res123",
      "confirmationNumber": "ABC123",
      "checkIn": "2023-08-01T14:00:00Z",
      "checkOut": "2023-08-05T11:00:00Z",
      "status": "in-house"
    },
    "billing": {
      "total": 740.50,
      "currency": "USD",
      "status": "active"
    },
    "roomNumber": "304"
  }
}
```

### Get All Guests
**GET** `/pms/guests`

Get all guests with pagination.

### Get Reservations
**GET** `/pms/reservations`

Get reservations with filtering.

### Test PMS Connection
**POST** `/pms/test-connection`

Test PMS connectivity.

### Manual Sync
**POST** `/pms/sync`

Trigger manual PMS synchronization.

## System Settings

### List Settings
**GET** `/settings`

Get all editable settings grouped by category.

**Response:**
```json
{
  "success": true,
  "data": {
    "settings": {
      "system": [
        {
          "key": "panel_name",
          "value": "Hotel IPTV Panel",
          "category": "system",
          "description": "Panel display name",
          "isEditable": true
        }
      ],
      "pms": [
        {
          "key": "pms_base_url",
          "value": "http://pms-server/api",
          "category": "pms",
          "isEditable": true
        }
      ]
    },
    "categories": ["system", "pms", "branding", "security"]
  }
}
```

### Get Setting
**GET** `/settings/:key`

Get specific setting value.

### Update Setting
**PUT** `/settings/:key`

Update setting value.

**Request:**
```json
{
  "value": "New Value"
}
```

### Update Multiple Settings
**PUT** `/settings`

Update multiple settings at once.

**Request:**
```json
{
  "settings": [
    {
      "key": "panel_name",
      "value": "My Hotel Panel"
    },
    {
      "key": "pms_polling_interval",
      "value": 10
    }
  ]
}
```

## System Logs

### Get Logs
**GET** `/logs`

Get system activity logs.

**Query Parameters:**
- `page`, `limit` - Pagination
- `level` - Filter by log level: info, warn, error
- `action` - Filter by action type
- `userId` - Filter by user
- `startDate`, `endDate` - Date range filter

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "64f1a2b3c4d5e6f7g8h9i0j1",
        "level": "info",
        "action": "APPROVE_DEVICE",
        "message": "Device approved successfully",
        "userId": "admin123",
        "userName": "Admin User",
        "metadata": {
          "deviceId": "device123",
          "roomNumber": "304"
        },
        "timestamp": "2023-08-01T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "pages": 3
    }
  }
}
```

### Get Log Statistics
**GET** `/logs/stats`

Get log statistics and activity summary.

## Launcher API (Device Communication)

### Device Registration
**POST** `/launcher/register`

Register new device (no auth required).

### Device Heartbeat
**POST** `/launcher/heartbeat`

Device heartbeat (requires device UUID).

**Headers:**
```
X-Device-UUID: 550e8400-e29b-41d4-a716-446655440000
```

### Get Device Configuration
**GET** `/launcher/config`

Get device configuration and apps.

### Report Status
**POST** `/launcher/status`

Report device status/errors.

### Message Acknowledgment
**POST** `/launcher/message-ack`

Acknowledge message receipt.

### App Installation Acknowledgment
**POST** `/launcher/app-install-ack`

Report app installation result.

### Device Diagnostics
**POST** `/launcher/diagnostics`

Send device diagnostic data.

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid request data |
| 401 | Unauthorized - Invalid or missing authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 422 | Validation Error - Request validation failed |
| 500 | Internal Server Error - Server error |

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 10 requests per 15 minutes per IP
- **File Upload**: 20 requests per 15 minutes per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1690891200
```

## WebSocket Events

Connect to WebSocket at `/socket.io` for real-time updates:

```javascript
const socket = io('http://your-server:4000', {
  auth: { token: 'your-jwt-token' }
});
```

### Admin Events
- `device:new-registration` - New device registered
- `device:approved` - Device approved
- `device:status-alert` - Device error/warning
- `pms:sync-completed` - PMS sync finished
- `setting:updated` - Setting changed

### Device Events  
- `device:{uuid}` - Device-specific commands
- `APPROVED` - Device approved
- `REJECTED` - Device rejected
- `REBOOT` - Reboot command
- `CONFIG_UPDATE` - Configuration updated
- `INSTALL_APP` - Install app command

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class IPTVPanelAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
    
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  async getDevices(params = {}) {
    const response = await this.client.get('/devices', { params });
    return response.data;
  }
  
  async approveDevice(deviceId, roomNumber) {
    const response = await this.client.post(`/devices/${deviceId}/approve`, {
      roomNumber
    });
    return response.data;
  }
}
```

### Python

```python
import requests

class IPTVPanelAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        })
    
    def get_devices(self, **params):
        response = self.session.get(f'{self.base_url}/devices', params=params)
        return response.json()
    
    def approve_device(self, device_id, room_number=None):
        data = {'roomNumber': room_number} if room_number else {}
        response = self.session.post(f'{self.base_url}/devices/{device_id}/approve', json=data)
        return response.json()
```

This completes the comprehensive API documentation for the IPTV Hotel Control Panel.
