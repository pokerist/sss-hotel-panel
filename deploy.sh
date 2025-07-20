#!/bin/bash

# IPTV Hotel Control Panel Deployment Script
# Ubuntu Server Deployment with Auto-Configuration

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    error "This script should not be run as root. Please run as a regular user with sudo privileges."
fi

# Check if sudo is available
if ! sudo -n true 2>/dev/null; then
    error "This script requires sudo privileges. Please ensure your user has sudo access."
fi

echo -e "${BLUE}"
echo "=================================="
echo "   IPTV Hotel Control Panel"
echo "     Deployment Script v1.0"
echo "=================================="
echo -e "${NC}"

# Detect server IP address
detect_server_ip() {
    local ip=$(ip route get 8.8.8.8 | awk -F"src " 'NR==1{split($2,a," ");print a[1]}')
    if [[ -z "$ip" ]]; then
        ip=$(hostname -I | awk '{print $1}')
    fi
    if [[ -z "$ip" ]]; then
        ip="localhost"
    fi
    echo "$ip"
}

# Generate random password
generate_password() {
    openssl rand -base64 32 | head -c 24
}

# Generate JWT secrets
generate_jwt_secret() {
    openssl rand -hex 32
}

# Collect deployment information
collect_deployment_info() {
    log "Collecting deployment configuration..."
    
    # Auto-detect server IP
    SERVER_IP=$(detect_server_ip)
    echo
    info "Auto-detected server IP: $SERVER_IP"
    read -p "Confirm server IP address [$SERVER_IP]: " user_ip
    SERVER_IP=${user_ip:-$SERVER_IP}
    
    # Panel name
    echo
    read -p "Enter panel name [Hotel IPTV Panel]: " PANEL_NAME
    PANEL_NAME=${PANEL_NAME:-"Hotel IPTV Panel"}
    
    # Super admin credentials
    echo
    log "Setting up Super Admin account..."
    read -p "Super Admin email: " SUPER_ADMIN_EMAIL
    while [[ -z "$SUPER_ADMIN_EMAIL" ]]; do
        warn "Email is required!"
        read -p "Super Admin email: " SUPER_ADMIN_EMAIL
    done
    
    read -s -p "Super Admin password (leave empty to generate): " SUPER_ADMIN_PASSWORD
    echo
    if [[ -z "$SUPER_ADMIN_PASSWORD" ]]; then
        SUPER_ADMIN_PASSWORD=$(generate_password)
        info "Generated super admin password: $SUPER_ADMIN_PASSWORD"
        echo "Please save this password securely!"
        read -p "Press Enter to continue..."
    fi
    
    # Opera PMS Configuration
    echo
    log "PMS Integration Setup..."
    read -p "Opera PMS base URL (leave empty to skip): " PMS_BASE_URL
    
    # Database configuration (MongoDB only)
    echo
    log "Database Configuration..."
    info "Using MongoDB (simplified architecture)"
    DB_TYPE="mongodb"
    
    # SSL Configuration
    echo
    read -p "Setup SSL with Let's Encrypt? (y/N): " setup_ssl
    setup_ssl=${setup_ssl:-n}
    
    if [[ "$setup_ssl" =~ ^[Yy] ]]; then
        read -p "Enter domain name for SSL certificate: " DOMAIN_NAME
        read -p "Enter email for Let's Encrypt notifications: " SSL_EMAIL
    fi
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    sudo apt update
    
    # Install essential packages
    sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
    
    # Install Node.js
    log "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    
    # Install PM2
    log "Installing PM2..."
    sudo npm install -g pm2
    
    # Install Nginx
    log "Installing Nginx..."
    sudo apt install -y nginx
    
    # Install database
    if [[ "$DB_TYPE" == "mongodb" ]]; then
        log "Installing MongoDB..."
        curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
        echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
        sudo apt update
        sudo apt install -y mongodb-org mongodb-mongosh
        sudo systemctl enable mongod
        sudo systemctl start mongod
        
        # Wait for MongoDB to start
        log "Waiting for MongoDB to start..."
        sleep 5
        
        # Verify MongoDB installation and connectivity
        verify_mongodb_installation
    else
        log "Installing PostgreSQL..."
        sudo apt install -y postgresql postgresql-contrib
        sudo systemctl enable postgresql
        sudo systemctl start postgresql
        
        # Create database and user
        sudo -u postgres psql -c "CREATE DATABASE $PG_DATABASE;"
        sudo -u postgres psql -c "CREATE USER $PG_USERNAME WITH ENCRYPTED PASSWORD '$PG_PASSWORD';"
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $PG_DATABASE TO $PG_USERNAME;"
        sudo -u postgres psql -c "ALTER USER $PG_USERNAME CREATEDB;"
    fi
    
    log "Dependencies installed successfully!"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    
    # Enable UFW if not already enabled
    if ! sudo ufw status | grep -q "Status: active"; then
        sudo ufw --force enable
    fi
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80
    sudo ufw allow 443
    
    # Allow WebSocket port
    sudo ufw allow 4000
    
    # Allow application port
    sudo ufw allow 3000
    
    log "Firewall configured successfully!"
}

# Verify MongoDB installation
verify_mongodb_installation() {
    log "Verifying MongoDB installation..."
    
    # Check if MongoDB service is running
    if ! sudo systemctl is-active --quiet mongod; then
        error "MongoDB service is not running"
    fi
    
    # Test MongoDB connection using mongosh
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if mongosh --eval "db.runCommand('ping').ok" --quiet iptv_hotel 2>/dev/null; then
            log "MongoDB connection verified successfully"
            break
        else
            if [[ $attempt -eq $max_attempts ]]; then
                error "Failed to connect to MongoDB after $max_attempts attempts"
            fi
            warn "MongoDB connection attempt $attempt failed, retrying in 2 seconds..."
            sleep 2
            ((attempt++))
        fi
    done
    
    # Create database and basic indexes using mongosh
    log "Setting up MongoDB database..."
    mongosh iptv_hotel --eval "
        // Create collections and indexes
        db.users.createIndex({ email: 1 }, { unique: true });
        db.users.createIndex({ role: 1 });
        db.devices.createIndex({ mac_address: 1 }, { unique: true });
        db.devices.createIndex({ room_number: 1 });
        db.devices.createIndex({ status: 1 });
        db.logs.createIndex({ timestamp: -1 });
        db.logs.createIndex({ device_id: 1 });
        db.logs.createIndex({ level: 1 });
        db.settings.createIndex({ key: 1 }, { unique: true });
        
        print('Database indexes created successfully');
    " --quiet
    
    log "MongoDB database setup completed"
}

# Check MongoDB health
check_mongodb_health() {
    log "Running MongoDB health check..."
    
    # Test basic connectivity
    if ! mongosh --eval "db.runCommand('ping').ok" --quiet iptv_hotel 2>/dev/null; then
        warn "MongoDB connectivity test failed"
        return 1
    fi
    
    # Test database operations
    if ! mongosh iptv_hotel --eval "
        // Test write operation
        db.health_check.insertOne({timestamp: new Date(), test: 'deployment_health_check'});
        
        // Test read operation  
        const doc = db.health_check.findOne({test: 'deployment_health_check'});
        if (!doc) {
            print('ERROR: Read operation failed');
            quit(1);
        }
        
        // Clean up test document
        db.health_check.deleteOne({test: 'deployment_health_check'});
        
        print('MongoDB health check passed');
    " --quiet 2>/dev/null; then
        warn "MongoDB operations test failed"
        return 1
    fi
    
    log "MongoDB health check completed successfully"
    return 0
}

# Generate environment file
generate_env_file() {
    log "Generating environment configuration..."
    
    # Generate JWT secrets
    JWT_SECRET=$(generate_jwt_secret)
    JWT_REFRESH_SECRET=$(generate_jwt_secret)
    
    # Determine URLs based on SSL setup
    if [[ "$setup_ssl" =~ ^[Yy] ]] && [[ -n "$DOMAIN_NAME" ]]; then
        BASE_URL="https://$DOMAIN_NAME"
    else
        BASE_URL="http://$SERVER_IP"
    fi
    
    # Create backend/.env file
    cat > backend/.env << EOF
# IPTV Hotel Panel Environment Configuration
# Generated on $(date)

# Panel Configuration
PANEL_NAME="$PANEL_NAME"
PANEL_BASE_URL="$BASE_URL"
PORT=3000
FRONTEND_URL="$BASE_URL"

# Database Configuration
DB_TYPE="$DB_TYPE"
EOF

    if [[ "$DB_TYPE" == "mongodb" ]]; then
        cat >> backend/.env << EOF
MONGO_URI="mongodb://127.0.0.1:27017/iptv_hotel"
EOF
    else
        cat >> backend/.env << EOF
PG_HOST="localhost"
PG_PORT=5432
PG_DATABASE="$PG_DATABASE"
PG_USERNAME="$PG_USERNAME"
PG_PASSWORD="$PG_PASSWORD"
EOF
    fi
    
    cat >> backend/.env << EOF

# Authentication
JWT_SECRET="$JWT_SECRET"
JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# WebSocket Configuration  
WS_PORT=4000

# PMS Integration
PMS_BASE_URL="$PMS_BASE_URL"
PMS_POLLING_INTERVAL=15
USE_MOCK_PMS=$([ -z "$PMS_BASE_URL" ] && echo "true" || echo "false")

# Mock PMS Server (Development)
MOCK_PMS_PORT=3001
$([ -z "$PMS_BASE_URL" ] && echo "MOCK_PMS_BASE_URL=\"http://$SERVER_IP:3001\"" || echo "")

# File Upload Configuration
MAX_FILE_SIZE=50MB
ALLOWED_IMAGE_TYPES="jpg,jpeg,png,gif,webp"
ALLOWED_VIDEO_TYPES="mp4,avi,mkv,webm"

# Security
CORS_ORIGIN="http://$SERVER_IP"
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL="info"
LOG_RETENTION_DAYS=30

# Super Admin (Created during deployment)
SUPER_ADMIN_EMAIL="$SUPER_ADMIN_EMAIL"
SUPER_ADMIN_PASSWORD="$SUPER_ADMIN_PASSWORD"

# SSL Configuration (Production)
SSL_CERT_PATH=""
SSL_KEY_PATH=""

NODE_ENV="production"
EOF

    log "Environment file generated successfully!"
}


# Install application
install_application() {
    log "Installing application dependencies..."
    
    # Create application directory
    APP_DIR="/opt/iptv-hotel-panel"
    sudo mkdir -p $APP_DIR
    
    # Copy application files
    sudo cp -r . $APP_DIR/
    sudo chown -R $USER:$USER $APP_DIR
    
    # Install backend dependencies
    cd $APP_DIR/backend
    npm install --production
    
    # Create frontend environment file for build
    cd $APP_DIR/frontend
    cat > .env.production << EOF
REACT_APP_SOCKET_URL=$BASE_URL
REACT_APP_API_URL=$BASE_URL/api
EOF
    
    # Install frontend dependencies and build
    npm install
    # Build with increased memory to avoid "heap out of memory" errors on low-RAM servers
    NODE_OPTIONS="--max-old-space-size=4096" npm run build
    
    # Create necessary directories
    sudo mkdir -p $APP_DIR/backend/public/uploads/backgrounds
    sudo mkdir -p $APP_DIR/backend/public/uploads/app-icons
    sudo mkdir -p $APP_DIR/backend/logs
    
    # Set proper permissions
    sudo chown -R $USER:www-data $APP_DIR/backend/public
    sudo chmod -R 755 $APP_DIR/backend/public
    sudo chown -R $USER:$USER $APP_DIR/backend/logs
    
    log "Application installed successfully!"
}

# Configure Nginx
configure_nginx() {
    log "Configuring Nginx..."
    
    # Create Nginx configuration
    sudo tee /etc/nginx/sites-available/iptv-hotel-panel << EOF
server {
    listen 80;
    server_name $SERVER_IP;
    
    # Frontend (React build)
    location / {
        root $APP_DIR/frontend/build;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # WebSocket for Socket.IO (same port as backend)
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static uploads
    location /uploads/ {
        root $APP_DIR/backend/public;
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

    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/iptv-hotel-panel /etc/nginx/sites-enabled/
    
    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload Nginx
    sudo nginx -t
    sudo systemctl reload nginx
    
    log "Nginx configured successfully!"
}

# Setup SSL with Let's Encrypt
setup_ssl() {
    if [[ "$setup_ssl" =~ ^[Yy] ]] && [[ -n "$DOMAIN_NAME" ]]; then
        log "Setting up SSL certificate..."
        
        # Install Certbot
        sudo apt install -y certbot python3-certbot-nginx
        
        # Update Nginx config with domain name
        sudo sed -i "s/server_name $SERVER_IP;/server_name $DOMAIN_NAME;/" /etc/nginx/sites-available/iptv-hotel-panel
        sudo systemctl reload nginx
        
        # Obtain SSL certificate
        sudo certbot --nginx -d $DOMAIN_NAME --email $SSL_EMAIL --agree-tos --non-interactive
        
        # Update environment file with HTTPS URLs
        sed -i "s|http://$SERVER_IP|https://$DOMAIN_NAME|g" $APP_DIR/backend/.env
        
        log "SSL certificate configured successfully!"
    fi
}

# Setup PM2
setup_pm2() {
    log "Setting up PM2 process manager..."
    
    cd $APP_DIR
    
    # Create PM2 ecosystem file with conditional mock PMS
    if [[ -z "$PMS_BASE_URL" ]]; then
        log "No PMS configured, adding mock PMS to ecosystem..."
        # Create logs directory for mock PMS
        sudo mkdir -p $APP_DIR/mock-pms/logs
        sudo chown -R $USER:$USER $APP_DIR/mock-pms/logs
        
        cat > ecosystem.config.js << EOF
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
    },
    {
      name: 'iptv-mock-pms',
      script: './mock-pms/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        MOCK_PMS_PORT: 3001
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './mock-pms/logs/pm2-error.log',
      out_file: './mock-pms/logs/pm2-out.log',
      log_file: './mock-pms/logs/pm2-combined.log',
      time: true,
      autorestart: true,
      max_memory_restart: '512M',
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      restart_delay: 4000
    }
  ]
};
EOF
    else
        log "PMS URL configured, using external PMS..."
        cat > ecosystem.config.js << EOF
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
    fi
    
    # Install mock-pms dependencies if mock PMS is needed
    if [[ -z "$PMS_BASE_URL" ]]; then
        log "Installing mock PMS dependencies..."
        cd $APP_DIR/mock-pms
        npm install --production
        cd $APP_DIR
    fi
    
    # Start the application
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
    
    if [[ -z "$PMS_BASE_URL" ]]; then
        log "PM2 configured with mock PMS server!"
    else
        log "PM2 configured successfully!"
    fi
}

# Initialize database
initialize_database() {
    log "Initializing database and creating super admin..."
    
    cd $APP_DIR/backend
    
    # Wait for application to start
    sleep 10
    
    # Run initialization
    node initialize.js
    
    log "Database initialized successfully!"
}

# Clone repository function
clone_repository() {
    log "Cloning IPTV Hotel Control Panel repository..."
    
    # Check if we're already in a git repository
    if [[ -d ".git" ]]; then
        log "Already in git repository, pulling latest changes..."
        git pull origin main
    else
        # Clone the repository
        log "Cloning from GitHub repository..."
        git clone https://github.com/pokerist/sss-hotel-panel.git .
        
        # Verify clone was successful
        if [[ ! -f "package.json" ]] || [[ ! -d "backend" ]] || [[ ! -d "frontend" ]]; then
            error "Repository clone failed or incomplete. Please check your internet connection and try again."
        fi
        
        log "Repository cloned successfully!"
    fi
}

# Main deployment function
deploy() {
    log "Starting IPTV Hotel Control Panel deployment..."
    
    # Check system requirements
    if ! command -v curl &> /dev/null; then
        sudo apt update && sudo apt install -y curl
    fi
    
    if ! command -v git &> /dev/null; then
        sudo apt update && sudo apt install -y git
    fi
    
    # Clone/update repository
    clone_repository
    
    # Collect configuration
    collect_deployment_info
    
    # Install dependencies
    install_dependencies
    
    # Configure firewall
    configure_firewall
    
    # Generate environment file
    generate_env_file
    
    # Install application
    install_application
    
    # Configure Nginx
    configure_nginx
    
    # Setup SSL if requested
    setup_ssl
    
    # Setup PM2
    setup_pm2
    
    # Final MongoDB health check (if MongoDB is used)
    if [[ "$DB_TYPE" == "mongodb" ]]; then
        if ! check_mongodb_health; then
            error "MongoDB health check failed. Please check the database setup."
        fi
    fi
    
    # Initialize database
    initialize_database
    
    # Deployment summary
    echo
    echo -e "${GREEN}=================================="
    echo "   Deployment Completed!"
    echo -e "==================================${NC}"
    echo
    info "Panel URL: http://$SERVER_IP"
    if [[ "$setup_ssl" =~ ^[Yy] ]] && [[ -n "$DOMAIN_NAME" ]]; then
        info "Secure URL: https://$DOMAIN_NAME"
    fi
    echo
    info "Super Admin Credentials:"
    info "  Email: $SUPER_ADMIN_EMAIL"
    info "  Password: $SUPER_ADMIN_PASSWORD"
    echo
    info "Application Directory: $APP_DIR"
    info "Log Files: $APP_DIR/backend/logs/"
    echo
    info "Useful Commands:"
    info "  View logs: pm2 logs iptv-hotel-panel"
    info "  Restart app: pm2 restart iptv-hotel-panel"
    info "  Stop app: pm2 stop iptv-hotel-panel"
    info "  Check status: pm2 status"
    echo
    warn "Please save the super admin password securely!"
    warn "Consider changing default passwords after first login."
    echo
    log "IPTV Hotel Control Panel is now running!"
}

# Run deployment
deploy
