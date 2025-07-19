# IPTV Hotel Control Panel - Deployment Guide

This guide provides detailed instructions for deploying the IPTV Hotel Control Panel on Ubuntu Server.

## Quick Deployment (Recommended)

The fastest way to deploy is using the automated deployment script:

```bash
chmod +x deploy.sh
./deploy.sh
```

## Manual Deployment

### Prerequisites

- Ubuntu Server 18.04+
- Root or sudo access
- Internet connection

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. Install PM2

```bash
sudo npm install -g pm2
```

### 4. Install and Configure Database

#### Option A: MongoDB (Recommended)

```bash
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable mongod
sudo systemctl start mongod
```

#### Option B: PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql
CREATE DATABASE iptv_hotel;
CREATE USER iptv_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE iptv_hotel TO iptv_user;
\q
```

### 5. Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 6. Configure Firewall

```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000
sudo ufw allow 4000
```

### 7. Deploy Application

```bash
# Create application directory
sudo mkdir -p /opt/iptv-hotel-panel
cd /opt/iptv-hotel-panel

# Copy application files (assuming files are in current directory)
sudo cp -r . /opt/iptv-hotel-panel/
sudo chown -R $USER:$USER /opt/iptv-hotel-panel

# Install dependencies
cd backend
npm install --production

cd ../frontend
npm install
npm run build

# Create necessary directories
sudo mkdir -p backend/public/uploads/backgrounds
sudo mkdir -p backend/public/uploads/app-icons
sudo mkdir -p backend/logs

# Set permissions
sudo chown -R $USER:www-data backend/public
sudo chmod -R 755 backend/public
```

### 8. Configure Environment

```bash
cp .env.template .env
nano .env
```

Configure the following variables:

```bash
PANEL_NAME="Your Hotel IPTV Panel"
PANEL_BASE_URL="http://your-server-ip"
PORT=3000
FRONTEND_URL="http://your-server-ip"

# Database
DB_TYPE="mongodb"
MONGO_URI="mongodb://localhost:27017/iptv_hotel"

# JWT Secrets (generate secure random strings)
JWT_SECRET="your-generated-jwt-secret"
JWT_REFRESH_SECRET="your-generated-refresh-secret"

# WebSocket
WS_PORT=4000

# Super Admin
SUPER_ADMIN_EMAIL="admin@yourhotel.com"
SUPER_ADMIN_PASSWORD="secure-password"

NODE_ENV="production"
```

### 9. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/iptv-hotel-panel
```

Add configuration:

```nginx
server {
    listen 80;
    server_name your-server-ip;
    
    # Frontend
    location / {
        root /opt/iptv-hotel-panel/frontend/build;
        index index.html;
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
    
    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
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
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/iptv-hotel-panel /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 10. Setup PM2

Create ecosystem file:

```bash
nano /opt/iptv-hotel-panel/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
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
    max_memory_restart: '1G'
  }]
};
```

Start application:

```bash
cd /opt/iptv-hotel-panel
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 11. Initialize Database

Create and run initialization script:

```bash
cd /opt/iptv-hotel-panel/backend
node -e "
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Settings = require('./src/models/Settings');
const database = require('./src/config/database');

(async () => {
  try {
    await database.connect();
    await Settings.initializeDefaultSettings();
    await User.createUser({
      email: process.env.SUPER_ADMIN_EMAIL,
      password: process.env.SUPER_ADMIN_PASSWORD,
      name: 'Super Administrator',
      role: 'super_admin'
    });
    console.log('Initialization completed!');
    process.exit(0);
  } catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1);
  }
})();
"
```

### 12. SSL Setup (Optional)

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Get certificate:

```bash
sudo certbot --nginx -d your-domain.com
```

## Post-Deployment

### Verify Installation

1. Check PM2 status: `pm2 status`
2. Check logs: `pm2 logs iptv-hotel-panel`
3. Test API: `curl http://your-server-ip/api/health`
4. Access web panel: `http://your-server-ip`

### Useful Commands

```bash
# View logs
pm2 logs iptv-hotel-panel

# Restart application
pm2 restart iptv-hotel-panel

# Stop application
pm2 stop iptv-hotel-panel

# Monitor application
pm2 monit

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Maintenance

#### Database Backup (MongoDB)

```bash
mongodump --db iptv_hotel --out /backup/mongodb/$(date +%Y%m%d)
```

#### Database Backup (PostgreSQL)

```bash
pg_dump -U iptv_user -h localhost iptv_hotel > /backup/postgresql/iptv_hotel_$(date +%Y%m%d).sql
```

#### Update Application

```bash
cd /opt/iptv-hotel-panel
git pull origin main
cd backend && npm install --production
cd ../frontend && npm install && npm run build
pm2 restart iptv-hotel-panel
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000 and 4000 are available
2. **Database connection**: Verify database service is running
3. **Permission issues**: Check file ownership and permissions
4. **Nginx configuration**: Test with `sudo nginx -t`

### Log Locations

- Application logs: `/opt/iptv-hotel-panel/backend/logs/`
- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`
- MongoDB logs: `/var/log/mongodb/`

### Performance Tuning

- Increase PM2 instances for higher load
- Configure Nginx caching
- Optimize database connections
- Monitor resource usage with `htop`
