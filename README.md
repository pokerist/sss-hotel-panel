# IPTV Hotel Control Panel

A secure, smart IPTV Control Panel for hotels that manages Android TV boxes in guest rooms. The system runs fully on a local hotel server, supports Opera PMS integration, and delivers personalized, real-time guest experiences.

## 🌟 Features

### Core Functionality
- **Device Management**: Approve, configure, and monitor Android TV boxes
- **Apps Library**: Manage and distribute applications to TV devices
- **Background Library**: Custom wallpapers and screensavers for rooms
- **PMS Integration**: Real-time sync with Opera Hospitality PMS
- **Guest Automation**: Welcome/farewell messages based on check-in/out
- **Real-time Communication**: WebSocket-based live updates

### Security & Administration
- **Role-based Access Control**: Super Admin and Admin roles
- **JWT Authentication**: Secure access with token refresh
- **Activity Logging**: Complete audit trail of all actions
- **Secure File Handling**: Validated uploads with size/type restrictions

### Technical Excellence
- **Dual Database Support**: MongoDB (preferred) or PostgreSQL
- **Real-time Updates**: Socket.IO for live notifications
- **Automated Deployment**: One-script Ubuntu server setup
- **Responsive Design**: Modern React UI with Material-UI
- **API Documentation**: Complete REST API specifications

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Admin Panel   │    │  Backend Server  │    │   Android TVs   │
│   (React SPA)   │◄──►│  (Node.js/Express)│◄──►│   (Launcher)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Database       │
                       │ MongoDB/PostgreSQL│
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Opera PMS      │
                       │   Integration    │
                       └──────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Ubuntu Server 18.04+ (for deployment)
- Node.js 18+ (for development)
- MongoDB 7.0+ or PostgreSQL 12+ (database)

### 1. Clone Repository
```bash
git clone <repository-url>
cd iptv-hotel-panel
```

### 2. Quick Deployment (Ubuntu Server)
```bash
chmod +x deploy.sh
./deploy.sh
```

The deployment script will:
- Install all dependencies (Node.js, PM2, Nginx, Database)
- Configure firewall and SSL (optional)
- Set up environment variables
- Initialize database with super admin account
- Start services with PM2

### 3. Development Setup
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Copy environment template
cp ../.env.template ../.env

# Edit configuration
nano ../.env
```

### 4. Running Development Environment
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start

# Terminal 3 - Mock PMS (optional)
cd backend
npm run mock-pms
```

## 📁 Project Structure

```
iptv-hotel-panel/
├── backend/                 # Node.js backend server
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── models/         # Database models
│   │   ├── middleware/     # Authentication & validation
│   │   ├── utils/          # Helper utilities
│   │   ├── config/         # Configuration files
│   │   └── mock-pms/       # Mock PMS server for testing
│   └── package.json
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── contexts/       # React contexts (Auth, Socket)
│   │   └── utils/          # Frontend utilities
│   └── package.json
├── docs/                   # Comprehensive documentation
│   ├── deployment-guide.md
│   ├── api-docs.md
│   └── launcher-api.md
├── deploy.sh              # Automated deployment script
├── .env.template          # Environment variables template
└── README.md              # This file
```

## 🔧 Configuration

### Environment Variables
Key configuration options in `.env`:

```bash
# Panel Configuration
PANEL_NAME="Your Hotel IPTV Panel"
PANEL_BASE_URL="http://your-server-ip"
PORT=3000

# Database (MongoDB or PostgreSQL)
DB_TYPE="mongodb"
MONGO_URI="mongodb://localhost:27017/iptv_hotel"

# Authentication
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-refresh-secret"

# PMS Integration
PMS_BASE_URL="http://your-pms-server:port/api"
PMS_POLLING_INTERVAL=15

# WebSocket
WS_PORT=4000

# File Upload Limits
MAX_FILE_SIZE=50MB
ALLOWED_IMAGE_TYPES="jpg,jpeg,png,gif,webp"
ALLOWED_VIDEO_TYPES="mp4,avi,mkv,webm"
```

### Database Configuration

#### MongoDB (Recommended)
```bash
DB_TYPE="mongodb"
MONGO_URI="mongodb://localhost:27017/iptv_hotel"
```

#### PostgreSQL
```bash
DB_TYPE="postgresql"
PG_HOST="localhost"
PG_PORT=5432
PG_DATABASE="iptv_hotel"
PG_USERNAME="iptv_user"
PG_PASSWORD="secure_password"
```

## 👤 User Roles

### Super Admin
- Complete system control
- Manage other admin accounts
- Configure PMS integration
- Set panel branding
- Delete devices
- Override all restrictions

### Admin (Moderator)
- Manage devices (approve, configure, reboot)
- Manage apps and backgrounds
- View system logs
- Cannot delete devices or manage users

## 🎯 Key Modules

### 1. Dashboard
- Real-time device statistics
- System health monitoring
- Recent activity feed
- Performance charts

### 2. Device Management
- Pending device approval workflow
- Room assignment and configuration
- Remote device control (reboot, config push)
- Bulk operations support

### 3. Apps Library
- Custom app entries with icons
- Google Play Store integration
- Room-specific app assignments
- Remote installation triggers

### 4. Background Library  
- Image/video upload management
- Background bundle creation
- Scheduled rotation settings
- Room-specific assignments

### 5. PMS Integration
- Opera Hospitality API support
- Real-time guest data sync
- Automated welcome/farewell messages
- Configurable sync intervals

## 🔐 Security Features

- **JWT Authentication**: Secure token-based auth with refresh
- **Role-based Permissions**: Granular access control
- **Input Validation**: Comprehensive request validation
- **File Security**: Type and size restrictions on uploads
- **Activity Logging**: Complete audit trail
- **CORS Protection**: Configurable cross-origin policies
- **Rate Limiting**: API request throttling
- **SQL Injection Protection**: Parameterized queries
- **XSS Prevention**: Input sanitization

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/profile` - Get user profile

### Device Management
- `GET /api/devices` - List all devices
- `POST /api/devices/:id/approve` - Approve device
- `PUT /api/devices/:id` - Update device
- `POST /api/devices/:id/reboot` - Reboot device
- `DELETE /api/devices/:id` - Delete device (Super Admin)

### Apps & Backgrounds
- `GET /api/apps` - List apps
- `POST /api/apps` - Create new app
- `POST /api/apps/assign` - Assign apps to devices
- `GET /api/backgrounds` - List backgrounds
- `POST /api/backgrounds/upload` - Upload background

### PMS Integration
- `GET /api/pms/status` - PMS connection status
- `GET /api/pms/guest/:roomNumber` - Get guest info
- `POST /api/pms/sync` - Trigger manual sync

### Launcher (Device Communication)
- `POST /api/launcher/register` - Device registration
- `GET /api/launcher/config` - Get device config
- `POST /api/launcher/heartbeat` - Device heartbeat
- `GET /api/launcher/apps` - Get device apps

## 🚀 Deployment

### Production Deployment (Ubuntu)
1. Run the automated deployment script:
```bash
chmod +x deploy.sh
./deploy.sh
```

2. The script will prompt for:
   - Server IP address (auto-detected)
   - Panel name and branding
   - Super admin credentials
   - PMS integration URL
   - Database choice (MongoDB/PostgreSQL)
   - SSL certificate setup (optional)

3. Access the panel at `http://your-server-ip`

### Manual Deployment
See [docs/deployment-guide.md](docs/deployment-guide.md) for detailed manual setup instructions.

## 📚 Documentation

- **[Deployment Guide](docs/deployment-guide.md)** - Detailed deployment instructions
- **[API Documentation](docs/api-docs.md)** - Complete REST API reference
- **[Launcher Integration](docs/launcher-api.md)** - TV launcher development guide

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in the `docs/` folder
- Review the API documentation for integration help

## 🎉 Acknowledgments

- **Opera Hospitality** - PMS integration support
- **Material-UI** - Beautiful React components
- **Socket.IO** - Real-time communication
- **MongoDB & PostgreSQL** - Reliable database solutions

---

**Built with ❤️ for the hospitality industry**

*Secure • Smart • Real-time IPTV Management*
