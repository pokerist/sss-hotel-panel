#!/bin/bash

# MongoDB Connection Fix Script
# This script helps diagnose and fix MongoDB connection issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

echo -e "${BLUE}"
echo "==============================="
echo "  MongoDB Connection Fix Tool"
echo "==============================="
echo -e "${NC}"

# Check if MongoDB service is running
log "Checking MongoDB service status..."
if sudo systemctl is-active --quiet mongod; then
    info "MongoDB service is running"
else
    warn "MongoDB service is not running. Starting it..."
    sudo systemctl start mongod
    sleep 3
    
    if sudo systemctl is-active --quiet mongod; then
        info "MongoDB service started successfully"
    else
        error "Failed to start MongoDB service"
        exit 1
    fi
fi

# Check MongoDB configuration
log "Checking MongoDB configuration..."
MONGO_CONFIG="/etc/mongod.conf"

if [[ -f "$MONGO_CONFIG" ]]; then
    info "MongoDB config file found at $MONGO_CONFIG"
    
    # Check if bindIp is configured correctly
    if grep -q "bindIp:" "$MONGO_CONFIG"; then
        CURRENT_BIND_IP=$(grep "bindIp:" "$MONGO_CONFIG" | awk '{print $2}')
        info "Current bindIp setting: $CURRENT_BIND_IP"
        
        # Check if it includes localhost/127.0.0.1
        if [[ "$CURRENT_BIND_IP" == *"127.0.0.1"* ]] || [[ "$CURRENT_BIND_IP" == *"localhost"* ]]; then
            info "MongoDB is configured to accept local connections"
        else
            warn "MongoDB might not be configured for local connections"
            log "Updating MongoDB configuration to accept local connections..."
            
            # Backup original config
            sudo cp "$MONGO_CONFIG" "${MONGO_CONFIG}.backup"
            
            # Update bindIp to include localhost
            sudo sed -i 's/bindIp:.*/bindIp: 127.0.0.1,localhost/' "$MONGO_CONFIG"
            
            log "Restarting MongoDB service..."
            sudo systemctl restart mongod
            sleep 5
        fi
    else
        warn "No bindIp setting found in MongoDB config"
        log "Adding bindIp configuration..."
        
        # Backup original config
        sudo cp "$MONGO_CONFIG" "${MONGO_CONFIG}.backup"
        
        # Add bindIp setting under net section
        sudo sed -i '/^net:/a \ \ bindIp: 127.0.0.1,localhost' "$MONGO_CONFIG"
        
        log "Restarting MongoDB service..."
        sudo systemctl restart mongod
        sleep 5
    fi
else
    error "MongoDB configuration file not found at $MONGO_CONFIG"
    exit 1
fi

# Test MongoDB connection
log "Testing MongoDB connection..."

# Test with mongosh
if command -v mongosh >/dev/null 2>&1; then
    if mongosh --eval "db.runCommand('ping').ok" --quiet iptv_hotel 2>/dev/null; then
        info "✅ MongoDB connection successful with mongosh"
    else
        error "❌ Failed to connect to MongoDB with mongosh"
        
        # Try with explicit host
        if mongosh --host 127.0.0.1 --eval "db.runCommand('ping').ok" --quiet iptv_hotel 2>/dev/null; then
            info "✅ MongoDB connection successful with explicit host 127.0.0.1"
        else
            error "❌ Failed to connect to MongoDB even with explicit host"
        fi
    fi
else
    error "mongosh command not found"
fi

# Check if port 27017 is listening
log "Checking if MongoDB is listening on port 27017..."
if netstat -tuln | grep -q ":27017"; then
    info "✅ Port 27017 is listening"
    netstat -tuln | grep ":27017"
else
    error "❌ Port 27017 is not listening"
fi

# Check MongoDB logs for errors
log "Checking recent MongoDB logs..."
if [[ -f "/var/log/mongodb/mongod.log" ]]; then
    info "Recent MongoDB log entries:"
    sudo tail -n 20 /var/log/mongodb/mongod.log
else
    warn "MongoDB log file not found at /var/log/mongodb/mongod.log"
fi

# Test Node.js MongoDB connection
log "Testing Node.js MongoDB connection..."
cat > test-mongo.js << 'EOF'
const mongoose = require('mongoose');

async function testConnection() {
    try {
        console.log('Attempting to connect to MongoDB...');
        await mongoose.connect('mongodb://127.0.0.1:27017/iptv_hotel', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
        });
        console.log('✅ Node.js MongoDB connection successful!');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Node.js MongoDB connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();
EOF

if [[ -f "/opt/iptv-hotel-panel/backend/node_modules/mongoose/index.js" ]]; then
    cd /opt/iptv-hotel-panel/backend
    if node ../test-mongo.js; then
        info "✅ Node.js can connect to MongoDB successfully"
    else
        error "❌ Node.js cannot connect to MongoDB"
    fi
    rm -f ../test-mongo.js
else
    warn "Mongoose not found, skipping Node.js connection test"
    rm -f test-mongo.js
fi

log "MongoDB connection diagnosis completed!"
echo
echo -e "${BLUE}Next steps:${NC}"
echo "1. If MongoDB is working now, try running the deployment initialization again:"
echo "   cd /opt/iptv-hotel-panel/backend && node initialize.js"
echo
echo "2. If issues persist, check the MongoDB service logs:"
echo "   sudo journalctl -u mongod -f"
echo
echo "3. Verify MongoDB is accepting connections:"
echo "   mongosh --eval 'db.runCommand(\"ping\")' iptv_hotel"
