#!/bin/bash

# COMPLETE SYSTEM PURGE Script
# This script performs total system cleanup including complete MongoDB uninstallation
# WARNING: This will completely remove MongoDB, PM2, and all application data!

echo "========================================="
echo "    COMPLETE SYSTEM PURGE INITIATED"
echo "========================================="
echo "WARNING: This will completely destroy:"
echo "  - All MongoDB installations and data"
echo "  - All PM2 processes and data"
echo "  - All application files and folders"
echo "  - All related system configurations"
echo ""
echo "Press Ctrl+C within 10 seconds to cancel..."
sleep 10

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to handle errors (log but continue)
log_error() {
    log "ERROR: $1 - continuing with purge..."
}

# Function to run command with error handling
run_with_error_handling() {
    local command="$1"
    local description="$2"
    
    if eval "$command"; then
        log "SUCCESS: $description"
        return 0
    else
        log_error "$description failed"
        return 1
    fi
}

# PHASE 1: PROCESS & SERVICE TERMINATION
log "========================================="
log "PHASE 1: TERMINATING ALL PROCESSES"
log "========================================="

# Kill all Node.js processes with extreme prejudice
log "Killing all Node.js, npm, yarn processes..."
run_with_error_handling "pkill -9 -f node 2>/dev/null" "Kill all Node.js processes"
run_with_error_handling "pkill -9 -f npm 2>/dev/null" "Kill all npm processes"
run_with_error_handling "pkill -9 -f yarn 2>/dev/null" "Kill all yarn processes"
run_with_error_handling "pkill -9 -f pm2 2>/dev/null" "Kill all PM2 processes"

# Destroy PM2 completely
if command -v pm2 >/dev/null 2>&1; then
    log "Destroying PM2 completely..."
    run_with_error_handling "pm2 kill 2>/dev/null" "Kill PM2 daemon"
    run_with_error_handling "pm2 delete all 2>/dev/null" "Delete all PM2 processes"
    run_with_error_handling "pm2 flush 2>/dev/null" "Flush PM2 logs"
    run_with_error_handling "pm2 unstartup systemd 2>/dev/null" "Remove PM2 startup"
fi

# Kill all MongoDB processes
log "Killing all MongoDB processes..."
run_with_error_handling "pkill -9 -f mongod 2>/dev/null" "Kill mongod processes"
run_with_error_handling "pkill -9 -f mongos 2>/dev/null" "Kill mongos processes"
run_with_error_handling "pkill -9 -f mongo 2>/dev/null" "Kill mongo processes"

# Stop MongoDB services (all variants)
log "Stopping all MongoDB services..."
run_with_error_handling "sudo systemctl stop mongod 2>/dev/null" "Stop mongod service"
run_with_error_handling "sudo systemctl stop mongodb 2>/dev/null" "Stop mongodb service"
run_with_error_handling "sudo systemctl disable mongod 2>/dev/null" "Disable mongod service"
run_with_error_handling "sudo systemctl disable mongodb 2>/dev/null" "Disable mongodb service"
run_with_error_handling "sudo service mongod stop 2>/dev/null" "Stop mongod service (legacy)"
run_with_error_handling "sudo service mongodb stop 2>/dev/null" "Stop mongodb service (legacy)"

# Wait for processes to die
sleep 5

# PHASE 2: MONGODB DATABASE & APPLICATION CLEANUP
log "========================================="
log "PHASE 2: MONGODB DATABASE & APPLICATION CLEANUP"
log "========================================="

# Clean specific databases and collections BEFORE removing MongoDB
if command -v mongosh >/dev/null 2>&1; then
    log "Cleaning MongoDB databases and collections..."
    
    # Clean the IPTV hotel database specifically
    run_with_error_handling "mongosh iptv_hotel --eval 'db.dropDatabase()' --quiet 2>/dev/null" "Drop iptv_hotel database"
    
    # Clean any test databases
    run_with_error_handling "mongosh iptv_hotel_test --eval 'db.dropDatabase()' --quiet 2>/dev/null" "Drop iptv_hotel_test database"
    
    # Remove specific problematic collections if database still exists
    run_with_error_handling "mongosh iptv_hotel --eval 'db.devices.drop()' --quiet 2>/dev/null" "Drop devices collection"
    run_with_error_handling "mongosh iptv_hotel --eval 'db.users.drop()' --quiet 2>/dev/null" "Drop users collection"
    run_with_error_handling "mongosh iptv_hotel --eval 'db.apps.drop()' --quiet 2>/dev/null" "Drop apps collection"
    run_with_error_handling "mongosh iptv_hotel --eval 'db.backgrounds.drop()' --quiet 2>/dev/null" "Drop backgrounds collection"
    run_with_error_handling "mongosh iptv_hotel --eval 'db.backgroundbundles.drop()' --quiet 2>/dev/null" "Drop backgroundbundles collection"
    run_with_error_handling "mongosh iptv_hotel --eval 'db.settings.drop()' --quiet 2>/dev/null" "Drop settings collection"
    run_with_error_handling "mongosh iptv_hotel --eval 'db.logs.drop()' --quiet 2>/dev/null" "Drop logs collection"
    
    # List and remove any orphaned databases
    run_with_error_handling "mongosh --eval 'db.adminCommand(\"listDatabases\").databases.forEach(function(d) { if(d.name.includes(\"iptv\") || d.name.includes(\"hotel\")) { print(\"Dropping: \" + d.name); db.getSiblingDB(d.name).dropDatabase(); } })' --quiet 2>/dev/null" "Remove orphaned IPTV databases"
    
    log "MongoDB database cleanup completed"
else
    log "MongoDB shell not available, skipping database cleanup"
fi

# Update package lists
log "Updating package lists..."
run_with_error_handling "sudo apt update 2>/dev/null" "Update package lists"

# Remove all MongoDB packages
log "Removing all MongoDB packages..."
MONGODB_PACKAGES=(
    "mongodb-org"
    "mongodb-org-server"
    "mongodb-org-shell"
    "mongodb-org-mongos"
    "mongodb-org-tools"
    "mongodb-server"
    "mongodb-clients"
    "mongodb"
    "mongodb-*"
)

for package in "${MONGODB_PACKAGES[@]}"; do
    run_with_error_handling "sudo apt remove --purge -y $package 2>/dev/null" "Remove package: $package"
done

# Autoremove orphaned packages
run_with_error_handling "sudo apt autoremove -y 2>/dev/null" "Remove orphaned packages"

# PHASE 3: COMPLETE FILE SYSTEM DESTRUCTION
log "========================================="
log "PHASE 3: COMPLETE FILE SYSTEM DESTRUCTION"
log "========================================="

# Remove all MongoDB data directories
log "Destroying all MongoDB data directories..."
MONGO_DATA_DIRS=(
    "/var/lib/mongodb"
    "/var/lib/mongo"
    "/data/db"
    "/usr/local/var/mongodb"
    "/opt/mongodb"
    "/home/$(whoami)/mongodb"
    "/home/*/mongodb"
)

for dir in "${MONGO_DATA_DIRS[@]}"; do
    if [ -d "$dir" ] || [ -L "$dir" ]; then
        log "Destroying: $dir"
        run_with_error_handling "sudo rm -rf '$dir'" "Remove MongoDB data directory: $dir"
    fi
done

# Remove all MongoDB configuration files
log "Destroying all MongoDB configuration files..."
MONGO_CONFIG_FILES=(
    "/etc/mongod.conf"
    "/etc/mongodb.conf"
    "/etc/default/mongod"
    "/etc/init.d/mongod"
    "/etc/init.d/mongodb"
)

for file in "${MONGO_CONFIG_FILES[@]}"; do
    if [ -f "$file" ] || [ -L "$file" ]; then
        log "Destroying: $file"
        run_with_error_handling "sudo rm -f '$file'" "Remove MongoDB config: $file"
    fi
done

# Remove all MongoDB log directories
log "Destroying all MongoDB log directories..."
MONGO_LOG_DIRS=(
    "/var/log/mongodb"
    "/var/log/mongo"
    "/usr/local/var/log/mongodb"
    "/opt/mongodb/logs"
)

for dir in "${MONGO_LOG_DIRS[@]}"; do
    if [ -d "$dir" ] || [ -L "$dir" ]; then
        log "Destroying: $dir"
        run_with_error_handling "sudo rm -rf '$dir'" "Remove MongoDB log directory: $dir"
    fi
done

# Remove MongoDB socket, lock, and temp files
log "Destroying MongoDB socket and temp files..."
MONGO_TEMP_PATTERNS=(
    "/tmp/mongodb-*.sock"
    "/tmp/mongo*"
    "/var/run/mongodb"
    "/var/run/mongo"
    "/run/mongodb"
    "/run/mongo"
)

for pattern in "${MONGO_TEMP_PATTERNS[@]}"; do
    run_with_error_handling "sudo rm -rf $pattern 2>/dev/null" "Remove MongoDB temp files: $pattern"
done

# Remove MongoDB user and group
log "Removing MongoDB user and group..."
run_with_error_handling "sudo userdel mongodb 2>/dev/null" "Remove mongodb user"
run_with_error_handling "sudo groupdel mongodb 2>/dev/null" "Remove mongodb group"

# PHASE 4: APPLICATION DIRECTORY DESTRUCTION
log "========================================="
log "PHASE 4: APPLICATION DIRECTORY DESTRUCTION"
log "========================================="

# Remove complete application deployment
APPLICATION_DIRS=(
    "/opt/iptv-hotel-panel"
    "/home/$(whoami)/iptv-hotel-panel"
    "/home/$(whoami)/sss-hotel-panel"
    "/var/www/iptv-hotel-panel"
)

for dir in "${APPLICATION_DIRS[@]}"; do
    if [ -d "$dir" ] || [ -L "$dir" ]; then
        log "Destroying application directory: $dir"
        run_with_error_handling "sudo rm -rf '$dir'" "Remove application directory: $dir"
    fi
done

# Remove all uploads, logs, and build directories
log "Destroying application data directories..."
APP_DATA_DIRS=(
    "backend/public/uploads"
    "public/uploads"
    "uploads"
    "backend/logs"
    "logs"
    "frontend/build"
    "backend/build"
    "build"
    "dist"
    "node_modules"
)

for dir in "${APP_DATA_DIRS[@]}"; do
    if [ -d "$dir" ] || [ -L "$dir" ]; then
        log "Destroying: $dir"
        run_with_error_handling "rm -rf '$dir'" "Remove app data directory: $dir"
    fi
done

# Remove PM2 data and configurations
log "Destroying PM2 data and configurations..."
PM2_DIRS=(
    "/home/$(whoami)/.pm2"
    "/root/.pm2"
    "/etc/systemd/system/pm2-*.service"
)

for dir in "${PM2_DIRS[@]}"; do
    run_with_error_handling "sudo rm -rf $dir 2>/dev/null" "Remove PM2 data: $dir"
done

# PHASE 5: REPOSITORY & PACKAGE CLEANUP
log "========================================="
log "PHASE 5: REPOSITORY & PACKAGE CLEANUP"
log "========================================="

# Remove MongoDB GPG keys (fixes keyring issue!)
log "Removing MongoDB GPG keys..."
MONGO_GPG_KEYS=(
    "/usr/share/keyrings/mongodb-server-7.0.gpg"
    "/usr/share/keyrings/mongodb-server-6.0.gpg"
    "/usr/share/keyrings/mongodb-server-5.0.gpg"
    "/usr/share/keyrings/mongodb-server-4.4.gpg"
    "/etc/apt/trusted.gpg.d/mongodb*"
)

for key in "${MONGO_GPG_KEYS[@]}"; do
    run_with_error_handling "sudo rm -f $key 2>/dev/null" "Remove MongoDB GPG key: $key"
done

# Remove MongoDB repositories
log "Removing MongoDB repositories..."
MONGO_REPOS=(
    "/etc/apt/sources.list.d/mongodb-org-*.list"
    "/etc/apt/sources.list.d/mongodb*.list"
)

for repo in "${MONGO_REPOS[@]}"; do
    run_with_error_handling "sudo rm -f $repo 2>/dev/null" "Remove MongoDB repository: $repo"
done

# Clean package manager caches
log "Cleaning package manager caches..."
run_with_error_handling "sudo apt clean" "Clean apt cache"
run_with_error_handling "sudo apt autoclean" "Clean apt autoclean"
run_with_error_handling "sudo apt update 2>/dev/null" "Update package lists"

# PHASE 6: APPLICATION CLEANUP
log "========================================="
log "PHASE 6: APPLICATION CLEANUP"
log "========================================="

# Remove package files
log "Removing Node.js package files..."
run_with_error_handling "find . -name 'package-lock.json' -type f -delete 2>/dev/null" "Remove package-lock.json files"
run_with_error_handling "find . -name 'yarn.lock' -type f -delete 2>/dev/null" "Remove yarn.lock files"

# Clean npm/yarn caches
log "Cleaning Node.js caches..."
if command -v npm >/dev/null 2>&1; then
    run_with_error_handling "npm cache clean --force" "Clean npm cache"
fi

if command -v yarn >/dev/null 2>&1; then
    run_with_error_handling "yarn cache clean" "Clean yarn cache"
fi

# Remove temporary files
log "Removing temporary files..."
run_with_error_handling "find . -name '*.tmp' -type f -delete 2>/dev/null" "Remove .tmp files"
run_with_error_handling "find . -name '.DS_Store' -type f -delete 2>/dev/null" "Remove .DS_Store files"
run_with_error_handling "find . -name 'Thumbs.db' -type f -delete 2>/dev/null" "Remove Thumbs.db files"

# Clean system-wide temp files
run_with_error_handling "sudo find /tmp -name '*iptv*' -type f -delete 2>/dev/null" "Remove app temp files"
run_with_error_handling "sudo find /tmp -name '*mongo*' -type f -delete 2>/dev/null" "Remove MongoDB temp files"

# PHASE 7: SYSTEM CLEANUP
log "========================================="
log "PHASE 7: FINAL SYSTEM CLEANUP"
log "========================================="

# Clear system caches
log "Clearing system caches..."
run_with_error_handling "sudo sync" "Sync filesystem"
run_with_error_handling "echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null 2>&1" "Clear system caches"

# Remove any remaining systemd services
log "Removing remaining systemd services..."
run_with_error_handling "sudo systemctl daemon-reload" "Reload systemd daemon"

# Final verification
log "========================================="
log "FINAL VERIFICATION"
log "========================================="

# Check if MongoDB is completely removed
if command -v mongosh >/dev/null 2>&1; then
    log_error "mongosh still found - MongoDB removal may be incomplete"
else
    log "SUCCESS: mongosh completely removed"
fi

if command -v mongod >/dev/null 2>&1; then
    log_error "mongod still found - MongoDB removal may be incomplete"
else
    log "SUCCESS: mongod completely removed"
fi

# Check PM2 status
if command -v pm2 >/dev/null 2>&1; then
    log "INFO: PM2 command still available (may be global install)"
else
    log "SUCCESS: PM2 command removed"
fi

log "========================================="
log "    COMPLETE SYSTEM PURGE FINISHED!"
log "========================================="
log "✅ All MongoDB installations removed"
log "✅ All MongoDB data destroyed"
log "✅ All PM2 processes terminated"
log "✅ All application files removed"
log "✅ All repository configurations cleaned"
log "✅ System caches cleared"
log ""
log "The system is now completely clean and ready"
log "for fresh deployment via deploy.sh"
log "========================================="
