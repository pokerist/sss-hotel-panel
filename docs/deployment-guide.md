# IPTV Hotel Control Panel - Deployment Guide

This guide provides comprehensive instructions for deploying the IPTV Hotel Control Panel on Ubuntu Server with all the latest features and fixes.

## 🚀 Quick Deployment (Recommended)

The fastest and most reliable way to deploy is using the enhanced automated deployment script:

```bash
# Make script executable
chmod +x deploy.sh

# Run deployment (will prompt for configuration)
./deploy.sh
```

The smart deployment script will:
- Auto-detect server IP with confirmation
- Install all dependencies (Node.js, MongoDB/PostgreSQL, Nginx, PM2)
- Configure firewall for HTTP/HTTPS/WebSocket
- Generate production environment files
- Create super admin account
- Initialize database with proper indexes
- Setup PM2 monitoring with auto-restart
- Configure Nginx with WebSocket proxy
- Perform health checks

## 🔧 Manual Deployment

### Prerequisites

- Ubuntu Server 18.04+ (tested on 20.04 LTS)
- Root or sudo access
- Internet connection
- At least 2GB RAM, 10GB storage

### Step 1: System Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git unzip software-properties-common
```

### Step 2: Install Node.js 18.x

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v18.x.x
npm --version   # Should be v9.x.x or higher
```

### Step 3: Install PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

### Step 4: Database Setup

#### Option A: MongoDB (Recommended)

```bash
# Import MongoDB GPG key
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update package list and install MongoDB
sudo apt update
sudo apt install -y mongodb-org mongodb-mongosh

# Enable and start MongoDB
sudo systemctl enable mongod
sudo systemctl start mongod

# Verify MongoDB is running
sudo systemctl status mongod
mongosh --eval "db.runCommand('ping')"
```

#### Option B: PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Enable and start PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE iptv_hotel;
CREATE USER iptv_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE iptv_hotel TO iptv_user;
ALTER USER iptv_user CREATEDB;
\q
EOF
```

### Step 5: Install and Configure Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Verify Nginx is running
sudo systemctl status nginx
```

### Step 6: Configure Firewall

```bash
# Enable UFW firewall
sudo ufw --force enable

# Allow essential ports
sudo ufw allow ssh
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Application port
sudo ufw allow 4000/tcp  # WebSocket port

# Check firewall status
sudo ufw status
```

### Step 7: Deploy Application

```bash
# Create application directory
sudo mkdir -p /opt/iptv-hotel-panel

# Copy application files (assuming you have the files in current directory)
sudo cp -r . /opt/iptv-hotel-panel/

# Change ownership
sudo chown -R $USER:$USER /opt/iptv-hotel-panel

# Navigate to application directory
cd /opt/iptv-hotel-panel

# Install backend dependencies
cd backend
npm install --production

# Build frontend
cd ../frontend
npm install
npm run build

# Create necessary directories
sudo mkdir -p /opt/iptv-hotel-panel/backend/public/uploads/{backgrounds,app-icons}
sudo mkdir -p /opt/iptv-hotel-panel/backend/logs

# Set proper permissions
sudo chown -R $USER:www-data /opt/iptv-hotel-panel/backend/public
sudo chmod -R 755 /opt/iptv-hotel-panel/backend/public
sudo chown -R $USER:$USER /opt/iptv-hotel-panel/backend/logs
```

### Step 8: Configure Environment Variables

```bash
# Copy environment template
cd /opt/iptv-hotel-panel
cp .env.template backend/.env

# Edit environment file
nano backend/.env
```

**Critical Environment Configuration:**

```bash
# Panel Configuration
PANEL_NAME="Your Hotel IPTV Panel"
PANEL_BASE_URL="http://YOUR_SERVER_IP"
PORT=3000
FRONTEND_URL="http://YOUR_SERVER_IP"

# Frontend Environment Variables (for React build)
REACT_APP_SOCKET_URL="http://YOUR_SERVER_IP"
REACT_APP_API_URL="http://YOUR_SERVER_IP/api"

# Database Configuration
DB_TYPE="mongodb"
MONGO_URI="mongodb://localhost:27017/iptv_hotel"

# For PostgreSQL instead:
# DB_TYPE="postgresql"
# PG_HOST="localhost"
# PG_PORT=5432
# PG_DATABASE="iptv_hotel"
# PG_USERNAME="iptv_user"
# PG_PASSWORD="secure_password_here"

# Authentication (Generate secure random strings)
JWT_SECRET="your-super-secure-jwt-secret-64-chars-long"
JWT_REFRESH_SECRET="your-super-secure-refresh-secret-64-chars-long"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# WebSocket Configuration (Same port as HTTP - handled by Nginx)
WS_PORT=4000

# PMS Integration
PMS_BASE_URL="http://192.168.1.200:7001/api"
PMS_POLLING_INTERVAL=15
USE_MOCK_PMS=false

# Security
CORS_ORIGIN="http://YOUR_SERVER_IP"

# Super Admin Account (Created during initialization)
SUPER_ADMIN_EMAIL="admin@yourhotel.com"
SUPER_ADMIN_PASSWORD="secure-admin-password"

# Production Environment
NODE_ENV="production"
```

**Generate Secure JWT Secrets:**

```bash
# Generate JWT secrets
openssl rand -hex 32  # Use for JWT_SECRET
openssl rand -hex 32  # Use for JWT_REFRESH_SECRET
```

### Step 9: Create Frontend Production Environment

```bash
# Create frontend production environment file
cd /opt/iptv-hotel-panel/frontend
cat > .env.production << EOF
REACT_APP_SOCKET_URL=http://YOUR_SERVER_IP
REACT_APP_API_URL=http://YOUR_SERVER_IP/api
EOF

# Rebuild frontend with production environment
npm run build
```

### Step 10: Configure Nginx with WebSocket Support

```bash
# Create Nginx configuration
sudo tee /etc/nginx/sites-available/iptv-hotel-panel << 'EOF'
server {
    listen 80;
    server_name YOUR_SERVER_IP;
    
    # Frontend (React build)
    location / {
        root /opt/iptv-hotel-panel/frontend/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket for Socket.IO on port 4000
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static uploads
    location /uploads/ {
        root /opt/iptv-hotel-panel/backend/public;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF

# Replace YOUR_SERVER_IP with actual IP
SERVER_IP=$(hostname -I | awk '{print $1}')
sudo sed -i "s/YOUR_SERVER_IP/$SERVER_IP/g" /etc/nginx/sites-available/iptv-hotel-panel

# Enable the site
sudo ln -sf /etc/nginx/sites-available/iptv-hotel-panel /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 11: Setup PM2 Process Manager

```bash
# Create PM2 ecosystem file
cd /opt/iptv-hotel-panel
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'iptv-hotel-panel',
      script: './backend/src/app.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './backend/logs/pm2-error.log',
      out_file: './backend/logs/pm2-out.log',
      log_file: './backend/logs/pm2-combined.log',
      time: true,
      autorestart: true,
      max_memory_restart: '1G',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'public/uploads']
    }
  ]
};
EOF

# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# Check PM2 status
pm2 status
```

### Step 12: Initialize Database and Create Super Admin

```bash
cd /opt/iptv-hotel-panel/backend

# Create initialization script
cat > initialize.js << 'EOF'
const mongoose = require('mongoose');
const { Sequelize } = require('sequelize');
require('dotenv').config();

const User = require('./src/models/User');
const Settings = require('./src/models/Settings');
const database = require('./src/config/database');

async function initialize() {
    try {
        console.log('Connecting to database...');
        await database.connect();
        
        console.log('Initializing default settings...');
        await Settings.initializeDefaultSettings();
        
        console.log('Creating super admin user...');
        const superAdmin = await User.createUser({
            email: process.env.SUPER_ADMIN_EMAIL,
            password: process.env.SUPER_ADMIN_PASSWORD,
            name: 'Super Administrator',
            role: 'super_admin'
        });
        
        console.log('Super admin created successfully:', superAdmin.email);
        console.log('Initialization completed!');
        
        await database.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Initialization failed:', error);
        process.exit(1);
    }
}

initialize();
EOF

# Run initialization
node initialize.js

# Clean up
rm initialize.js
```

## 🔐 SSL Certificate Setup (Recommended for Production)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Replace YOUR_DOMAIN with your actual domain
DOMAIN_NAME="your-domain.com"

# Update Nginx configuration with domain
sudo sed -i "s/server_name.*/server_name $DOMAIN_NAME;/" /etc/nginx/sites-available/iptv-hotel-panel
sudo systemctl reload nginx

# Obtain SSL certificate
sudo certbot --nginx -d $DOMAIN_NAME --email admin@$DOMAIN_NAME --agree-tos --non-interactive

# Update environment files for HTTPS
cd /opt/iptv-hotel-panel
sed -i "s|http://|https://|g" backend/.env
sed -i "s|http://|https://|g" frontend/.env.production

# Rebuild frontend with HTTPS URLs
cd frontend && npm run build

# Restart application
pm2 restart iptv-hotel-panel
```

## ✅ Post-Deployment Verification

### 1. System Health Checks

```bash
# Check PM2 status
pm2 status
pm2 logs iptv-hotel-panel --lines 50

# Check Nginx status
sudo systemctl status nginx
sudo nginx -t

# Check database status
# For MongoDB:
mongosh --eval "db.adminCommand('ping')"
# For PostgreSQL:
sudo -u postgres psql -c "SELECT version();"

# Test API endpoints
curl http://YOUR_SERVER_IP/health
curl http://YOUR_SERVER_IP/api/auth/health
```

### 2. Access the Admin Panel

1. Open web browser
2. Navigate to `http://YOUR_SERVER_IP` (or your domain)
3. Login with super admin credentials:
   - Email: From `SUPER_ADMIN_EMAIL` in `.env`
   - Password: From `SUPER_ADMIN_PASSWORD` in `.env`

### 3. Verify All Features

**Dashboard:**
- ✅ Real-time statistics display
- ✅ WebSocket connection indicator shows "Connected"
- ✅ Device and PMS status cards

**Device Management:**
- ✅ Device list loads without errors
- ✅ Real-time notifications working
- ✅ Device approval workflow functional

**Background Library:**
- ✅ File upload working
- ✅ Bundle creation and assignment
- ✅ Preview functionality

**Apps Library:**
- ✅ App creation with icon upload
- ✅ Device assignments working
- ✅ Installation triggers functional

**Settings:**
- ✅ User management (CRUD)
- ✅ System settings save correctly
- ✅ Logo upload working

**PMS Integration:**
- ✅ Configuration interface accessible
- ✅ Connection testing working
- ✅ Manual sync triggers

## 🛠️ Management Commands

### PM2 Process Management

```bash
# View application status
pm2 status

# View real-time logs
pm2 logs iptv-hotel-panel

# Restart application
pm2 restart iptv-hotel-panel

# Stop application
pm2 stop iptv-hotel-panel

# Monitor resources
pm2 monit

# Reload application (zero downtime)
pm2 reload iptv-hotel-panel
```

### Application Updates

```bash
cd /opt/iptv-hotel-panel

# Pull latest changes (if using git)
git pull origin main

# Update backend dependencies
cd backend && npm install --production

# Rebuild frontend
cd ../frontend && npm install && npm run build

# Restart application
pm2 restart iptv-hotel-panel
```

### Database Management

#### MongoDB Backup

```bash
# Create backup
mongodump --db iptv_hotel --out /backup/mongodb/$(date +%Y%m%d_%H%M%S)

# Restore backup
mongorestore --db iptv_hotel /backup/mongodb/BACKUP_FOLDER/iptv_hotel/
```

#### PostgreSQL Backup

```bash
# Create backup
pg_dump -U iptv_user -h localhost iptv_hotel > /backup/postgresql/iptv_hotel_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql -U iptv_user -h localhost iptv_hotel < /backup/postgresql/backup_file.sql
```

### Log Management

```bash
# View application logs
tail -f /opt/iptv-hotel-panel/backend/logs/pm2-combined.log

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View system logs
journalctl -u nginx -f
journalctl -u mongod -f  # For MongoDB
```

## 🔍 Troubleshooting

### Common Issues and Solutions

#### 1. WebSocket Connection Failed
**Problem:** Frontend shows "Real-time Disconnected"

**Solutions:**
```bash
# Check if backend is running
pm2 status

# Check Nginx configuration
sudo nginx -t
sudo systemctl reload nginx

# Verify WebSocket proxy configuration
curl -I http://YOUR_SERVER_IP/socket.io/
```

#### 2. 502 Bad Gateway Error
**Problem:** Nginx returns 502 error

**Solutions:**
```bash
# Check if backend is running on port 3000
netstat -tlnp | grep 3000

# Restart PM2
pm2 restart iptv-hotel-panel

# Check PM2 logs
pm2 logs iptv-hotel-panel
```

#### 3. Database Connection Error
**Problem:** App fails to connect to database

**Solutions:**
```bash
# For MongoDB:
sudo systemctl status mongod
sudo systemctl restart mongod

# For PostgreSQL:
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Check environment variables
cd /opt/iptv-hotel-panel/backend
grep -E "(MONGO_URI|DB_TYPE)" .env
```

#### 4. File Upload Errors
**Problem:** Cannot upload backgrounds or app icons

**Solutions:**
```bash
# Check directory permissions
ls -la /opt/iptv-hotel-panel/backend/public/uploads/

# Fix permissions
sudo chown -R $USER:www-data /opt/iptv-hotel-panel/backend/public/uploads/
sudo chmod -R 755 /opt/iptv-hotel-panel/backend/public/uploads/
```

#### 5. Frontend Not Loading
**Problem:** Blank page or build errors

**Solutions:**
```bash
# Rebuild frontend with correct environment
cd /opt/iptv-hotel-panel/frontend
rm -rf build node_modules
npm install
npm run build

# Check Nginx static file serving
sudo nginx -t
sudo systemctl reload nginx
```

### Performance Optimization

#### 1. Enable Nginx Caching

```bash
# Add to Nginx configuration
sudo nano /etc/nginx/sites-available/iptv-hotel-panel

# Add these lines inside server block:
# location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
#     expires 1y;
#     add_header Cache-Control "public, immutable";
# }
```

#### 2. Increase PM2 Instances

```bash
# Edit ecosystem.config.js
nano /opt/iptv-hotel-panel/ecosystem.config.js

# Change instances to number of CPU cores
# instances: require('os').cpus().length,
# exec_mode: 'cluster',

pm2 restart iptv-hotel-panel
```

#### 3. MongoDB Optimization

```bash
# Create indexes for better performance
mongosh iptv_hotel --eval "
db.users.createIndex({ email: 1 });
db.devices.createIndex({ mac_address: 1 });
db.devices.createIndex({ room_number: 1 });
db.logs.createIndex({ timestamp: -1 });
"
```

## 📊 Monitoring and Maintenance

### Health Monitoring

```bash
# Check system resources
htop
df -h
free -h

# Monitor PM2 processes
pm2 monit

# Check application health
curl http://YOUR_SERVER_IP/health
```

### Regular Maintenance Tasks

1. **Daily:** Check PM2 logs for errors
2. **Weekly:** Backup database
3. **Monthly:** Update system packages and restart services
4. **Quarterly:** Review and clean old log files

### Log Rotation Setup

```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/iptv-hotel-panel << 'EOF'
/opt/iptv-hotel-panel/backend/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

## 🎯 Production Checklist

Before going live, ensure:

- [ ] SSL certificate installed and working
- [ ] Firewall properly configured
- [ ] Database backups scheduled
- [ ] Strong passwords set for all accounts
- [ ] Log rotation configured
- [ ] Monitoring set up
- [ ] PMS integration tested
- [ ] Device registration workflow tested
- [ ] All admin features working
- [ ] WebSocket real-time updates working
- [ ] File uploads working correctly
- [ ] Email notifications configured (if applicable)

## 📞 Support

For additional support or issues:

1. Check application logs: `pm2 logs iptv-hotel-panel`
2. Review system logs: `journalctl -xe`
3. Verify configuration files
4. Test network connectivity
5. Check resource usage (`htop`, `df -h`)

---

**Deployment completed successfully! Your IPTV Hotel Control Panel is now ready for production use.**
