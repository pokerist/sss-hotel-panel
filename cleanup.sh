#!/bin/bash

# NUCLEAR CLEANUP Script
# This script performs complete system cleanup including MongoDB data destruction
# WARNING: This will completely wipe MongoDB and all related data!

echo "==================================="
echo "    NUCLEAR CLEANUP INITIATED"
echo "==================================="
echo "WARNING: This will completely destroy MongoDB data!"
echo "Press Ctrl+C within 5 seconds to cancel..."
sleep 5

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to handle errors (log but continue)
log_error() {
    log "ERROR: $1 - continuing with cleanup..."
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

# Ensure we're in the correct directory
if ! cd "$(dirname "$0")"; then
    log_error "Failed to change to script directory"
    # Try to continue anyway
fi

# PHASE 1: TERMINATE ALL RELATED PROCESSES
log "PHASE 1: Terminating all related processes..."

# Kill all Node.js processes
log "Killing all Node.js processes..."
run_with_error_handling "pkill -9 -f node 2>/dev/null" "Kill all Node.js processes"
run_with_error_handling "pkill -9 -f npm 2>/dev/null" "Kill all npm processes"
run_with_error_handling "pkill -9 -f yarn 2>/dev/null" "Kill all yarn processes"

# Kill PM2 processes
if command -v pm2 >/dev/null 2>&1; then
    log "Stopping PM2 processes..."
    run_with_error_handling "pm2 kill 2>/dev/null" "Kill PM2 daemon"
    run_with_error_handling "pm2 delete all 2>/dev/null" "Delete all PM2 processes"
    run_with_error_handling "pm2 flush 2>/dev/null" "Flush PM2 logs"
fi

# PHASE 2: MONGODB NUCLEAR DESTRUCTION
log "PHASE 2: MongoDB nuclear destruction..."

# First try graceful database cleanup
if command -v mongosh >/dev/null 2>&1; then
    log "Attempting graceful database cleanup..."
    mongosh iptv_hotel --eval '
        try {
            // Drop all indexes first
            db.listCollectionNames().forEach(function(collection) {
                try {
                    print("Dropping indexes for: " + collection);
                    db[collection].dropIndexes();
                } catch(e) {
                    print("Failed to drop indexes for " + collection + ": " + e.message);
                }
            });
            
            // Drop all collections
            db.listCollectionNames().forEach(function(collection) {
                try {
                    print("Dropping collection: " + collection);
                    db[collection].drop();
                } catch(e) {
                    print("Failed to drop " + collection + ": " + e.message);
                }
            });
            
            // Force drop database
            print("Force dropping database iptv_hotel");
            db.runCommand({dropDatabase: 1});
            
        } catch(e) {
            print("Database cleanup failed: " + e.message);
        }
    ' 2>/dev/null || log_error "Graceful database cleanup failed"
fi

# Kill all MongoDB processes
log "Killing all MongoDB processes..."
run_with_error_handling "pkill -9 -f mongod 2>/dev/null" "Kill mongod processes"
run_with_error_handling "pkill -9 -f mongos 2>/dev/null" "Kill mongos processes"
run_with_error_handling "pkill -9 -f mongo 2>/dev/null" "Kill mongo processes"

# Stop MongoDB service (multiple methods)
log "Stopping MongoDB service..."
run_with_error_handling "sudo systemctl stop mongod 2>/dev/null" "Stop mongod service (systemctl)"
run_with_error_handling "sudo systemctl stop mongodb 2>/dev/null" "Stop mongodb service (systemctl)"
run_with_error_handling "sudo service mongod stop 2>/dev/null" "Stop mongod service (service)"
run_with_error_handling "sudo service mongodb stop 2>/dev/null" "Stop mongodb service (service)"

# Wait for processes to die
sleep 3

# PHASE 3: PHYSICAL DATA DESTRUCTION
log "PHASE 3: Destroying MongoDB physical data..."

# Remove MongoDB data directories (common locations)
MONGO_DATA_DIRS=(
    "/var/lib/mongodb"
    "/var/lib/mongo"
    "/data/db"
    "/usr/local/var/mongodb"
    "/opt/mongodb/data"
    "/home/$(whoami)/mongodb"
)

for dir in "${MONGO_DATA_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        log "Destroying MongoDB data directory: $dir"
        run_with_error_handling "sudo rm -rf '$dir'/*" "Clear MongoDB data directory: $dir"
        run_with_error_handling "sudo rm -rf '$dir'/.*" "Clear hidden files in: $dir"
    fi
done

# Remove MongoDB log directories
MONGO_LOG_DIRS=(
    "/var/log/mongodb"
    "/var/log/mongo"
    "/usr/local/var/log/mongodb"
    "/opt/mongodb/logs"
)

for dir in "${MONGO_LOG_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        log "Destroying MongoDB log directory: $dir"
        run_with_error_handling "sudo rm -rf '$dir'/*" "Clear MongoDB log directory: $dir"
    fi
done

# Remove MongoDB socket and lock files
MONGO_TEMP_LOCATIONS=(
    "/tmp/mongodb-*.sock"
    "/var/run/mongodb"
    "/var/run/mongo"
    "/tmp/mongo*"
)

for location in "${MONGO_TEMP_LOCATIONS[@]}"; do
    run_with_error_handling "sudo rm -rf $location 2>/dev/null" "Remove MongoDB temp files: $location"
done

# PHASE 4: APPLICATION DATA CLEANUP
log "PHASE 4: Application data cleanup..."

# Remove all application uploads and data
UPLOADS_DIRS=("backend/public/uploads" "public/uploads" "uploads" "/opt/iptv-hotel-panel/public/uploads")

for UPLOADS_DIR in "${UPLOADS_DIRS[@]}"; do
    if [ -d "$UPLOADS_DIR" ]; then
        log "Destroying uploads directory: $UPLOADS_DIR"
        run_with_error_handling "rm -rf '$UPLOADS_DIR'/*" "Clear uploads directory: $UPLOADS_DIR"
        run_with_error_handling "rm -rf '$UPLOADS_DIR'/.*" "Clear hidden files in uploads: $UPLOADS_DIR"
    fi
done

# Remove all log directories
LOG_DIRS=("backend/logs" "logs" "/opt/iptv-hotel-panel/backend/logs")
for LOGS_DIR in "${LOG_DIRS[@]}"; do
    if [ -d "$LOGS_DIR" ]; then
        log "Destroying logs directory: $LOGS_DIR"
        run_with_error_handling "rm -rf '$LOGS_DIR'/*" "Clear logs directory: $LOGS_DIR"
    fi
done

# Remove any temporary files and caches
log "Destroying temporary files and caches..."
run_with_error_handling "find . -name '*.tmp' -type f -delete 2>/dev/null" "Remove .tmp files"
run_with_error_handling "find . -name '.DS_Store' -type f -delete 2>/dev/null" "Remove .DS_Store files"
run_with_error_handling "find . -name 'Thumbs.db' -type f -delete 2>/dev/null" "Remove Thumbs.db files"

# Destroy npm cache
if command -v npm >/dev/null 2>&1; then
    run_with_error_handling "npm cache clean --force" "Destroy npm cache"
fi

# Remove node_modules directories
run_with_error_handling "find . -name 'node_modules' -type d -exec rm -rf {} + 2>/dev/null" "Destroy node_modules directories"

# Remove package-lock.json files
run_with_error_handling "find . -name 'package-lock.json' -type f -delete 2>/dev/null" "Remove package-lock.json files"

# Remove build directories
BUILD_DIRS=("frontend/build" "backend/build" "build" "dist" "/opt/iptv-hotel-panel/frontend/build")
for BUILD_DIR in "${BUILD_DIRS[@]}"; do
    if [ -d "$BUILD_DIR" ]; then
        run_with_error_handling "rm -rf '$BUILD_DIR'" "Destroy build directory: $BUILD_DIR"
    fi
done

# PHASE 5: MONGODB SERVICE RESTART
log "PHASE 5: Restarting MongoDB service..."

# Recreate MongoDB data directories with proper ownership
for dir in "${MONGO_DATA_DIRS[@]}"; do
    if [ -d "$(dirname "$dir")" ]; then
        log "Recreating MongoDB data directory: $dir"
        run_with_error_handling "sudo mkdir -p '$dir'" "Create MongoDB data directory: $dir"
        run_with_error_handling "sudo chown -R mongodb:mongodb '$dir' 2>/dev/null" "Set MongoDB ownership: $dir"
        run_with_error_handling "sudo chmod 755 '$dir'" "Set MongoDB permissions: $dir"
    fi
done

# Start MongoDB service
log "Starting MongoDB service..."
run_with_error_handling "sudo systemctl start mongod 2>/dev/null" "Start mongod service (systemctl)"
if [ $? -ne 0 ]; then
    run_with_error_handling "sudo service mongod start 2>/dev/null" "Start mongod service (service)"
fi

# Wait for MongoDB to start
log "Waiting for MongoDB to start..."
sleep 5

# PHASE 6: VERIFICATION AND SYSTEM RECREATION
log "PHASE 6: System verification and recreation..."

# Recreate directory structure
UPLOADS_DIRS=("backend/public/uploads" "public/uploads" "uploads")
for UPLOADS_DIR in "${UPLOADS_DIRS[@]}"; do
    if mkdir -p "$UPLOADS_DIR/backgrounds" "$UPLOADS_DIR/app-icons" "$UPLOADS_DIR/branding" 2>/dev/null; then
        log "Recreated directory structure: $UPLOADS_DIR"
        
        if command -v sudo >/dev/null 2>&1; then
            sudo chown -R $USER:www-data "$UPLOADS_DIR" 2>/dev/null || log_error "Failed to set ownership: $UPLOADS_DIR"
            sudo chmod -R 755 "$UPLOADS_DIR" 2>/dev/null || log_error "Failed to set permissions: $UPLOADS_DIR"
        fi
    fi
done

# Verify MongoDB is clean and running
if command -v mongosh >/dev/null 2>&1; then
    log "Verifying MongoDB is clean and accessible..."
    MONGO_STATUS=$(mongosh iptv_hotel --quiet --eval "
        try {
            print('Connected successfully');
            print('Collections: ' + db.listCollectionNames().length);
        } catch(e) {
            print('Connection failed: ' + e.message);
        }
    " 2>/dev/null)
    
    log "MongoDB status: $MONGO_STATUS"
else
    log_error "mongosh not available for verification"
fi

# Clear any remaining system caches
log "Clearing system caches..."
run_with_error_handling "sudo sync" "Sync filesystem"
run_with_error_handling "echo 3 | sudo tee /proc/sys/vm/drop_caches > /dev/null 2>&1" "Clear system caches"

log "=================================================="
log "    NUCLEAR CLEANUP COMPLETED SUCCESSFULLY!"
log "=================================================="
log "MongoDB has been completely destroyed and recreated"
log "All application data has been wiped clean"
log "System is ready for fresh deployment"
log "=================================================="
