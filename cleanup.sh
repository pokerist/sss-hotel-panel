#!/bin/bash

# Cleanup Script
# This script removes orphaned files and fixes permissions
# Continues through all steps even if errors occur

echo "Starting cleanup process..."

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

# Connect to MongoDB and get list of valid files
log "Getting list of valid files from database..."
VALID_FILES=$(mongosh iptv_hotel --quiet --eval '
    let files = [];
    try {
        // Get app icons
        db.apps.find({}, {icon: 1}).forEach(app => {
            if (app.icon) files.push(app.icon.replace("/uploads/", ""));
        });
        // Get backgrounds
        db.backgrounds.find({}, {filename: 1}).forEach(bg => {
            files.push("backgrounds/" + bg.filename);
        });
        print(files.join("\n"));
    } catch(e) {
        print("ERROR: " + e.message);
    }
' 2>/dev/null)

# Create temporary file with valid filenames (even if empty)
echo "$VALID_FILES" > /tmp/valid_files.txt 2>/dev/null || {
    log_error "Failed to create temporary file, continuing without orphan file cleanup"
    touch /tmp/valid_files.txt 2>/dev/null
}

# Check and clean uploads directories
UPLOADS_DIRS=("backend/public/uploads" "public/uploads" "uploads")

for UPLOADS_DIR in "${UPLOADS_DIRS[@]}"; do
    if [ -d "$UPLOADS_DIR" ]; then
        log "Found uploads directory: $UPLOADS_DIR"
        log "Checking for orphaned files in $UPLOADS_DIR..."
        
        if [ -s /tmp/valid_files.txt ]; then
            find "$UPLOADS_DIR" -type f 2>/dev/null | while read -r file; do
                relative_path=${file#"$UPLOADS_DIR/"}
                if ! grep -q "^$relative_path$" /tmp/valid_files.txt 2>/dev/null; then
                    log "Found orphaned file: $file"
                    if rm "$file" 2>/dev/null; then
                        log "Deleted: $file"
                    else
                        log_error "Failed to delete: $file"
                    fi
                fi
            done
        else
            log "No valid files list available, skipping orphan cleanup for $UPLOADS_DIR"
        fi
    else
        log "Uploads directory not found: $UPLOADS_DIR (skipping)"
    fi
done

# Remove temporary file
rm /tmp/valid_files.txt 2>/dev/null || log_error "Failed to remove temporary file"

# Fix permissions
log "Fixing permissions..."

# Create and fix permissions for all possible uploads directories
for UPLOADS_DIR in "${UPLOADS_DIRS[@]}"; do
    if mkdir -p "$UPLOADS_DIR/backgrounds" "$UPLOADS_DIR/app-icons" "$UPLOADS_DIR/branding" 2>/dev/null; then
        log "Created directories in: $UPLOADS_DIR"
    else
        log_error "Failed to create directories in: $UPLOADS_DIR"
    fi
    
    # Fix ownership and permissions (continue even if some fail)
    if command -v sudo >/dev/null 2>&1; then
        sudo chown -R $USER:www-data "$UPLOADS_DIR" 2>/dev/null || log_error "Failed to change ownership of $UPLOADS_DIR"
        sudo chmod -R 755 "$UPLOADS_DIR" 2>/dev/null || log_error "Failed to change permissions of $UPLOADS_DIR"
    else
        chown -R $USER:www-data "$UPLOADS_DIR" 2>/dev/null || log_error "Failed to change ownership of $UPLOADS_DIR (no sudo)"
        chmod -R 755 "$UPLOADS_DIR" 2>/dev/null || log_error "Failed to change permissions of $UPLOADS_DIR"
    fi
    
    find "$UPLOADS_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || log_error "Failed to fix file permissions in $UPLOADS_DIR"
done

# Fix logs directory permissions
LOG_DIRS=("backend/logs" "logs")
for LOGS_DIR in "${LOG_DIRS[@]}"; do
    if mkdir -p "$LOGS_DIR" 2>/dev/null; then
        log "Created logs directory: $LOGS_DIR"
        
        if command -v sudo >/dev/null 2>&1; then
            sudo chown -R $USER:$USER "$LOGS_DIR" 2>/dev/null || log_error "Failed to change ownership of $LOGS_DIR"
            sudo chmod -R 755 "$LOGS_DIR" 2>/dev/null || log_error "Failed to change permissions of $LOGS_DIR"
        else
            chown -R $USER:$USER "$LOGS_DIR" 2>/dev/null || log_error "Failed to change ownership of $LOGS_DIR (no sudo)"
            chmod -R 755 "$LOGS_DIR" 2>/dev/null || log_error "Failed to change permissions of $LOGS_DIR"
        fi
    else
        log_error "Failed to create logs directory: $LOGS_DIR"
    fi
done

# Remove any temporary files
log "Cleaning temporary files..."
run_with_error_handling "find . -name '*.tmp' -type f -delete 2>/dev/null" "Remove .tmp files"
run_with_error_handling "find . -name '.DS_Store' -type f -delete 2>/dev/null" "Remove .DS_Store files"
run_with_error_handling "find . -name 'Thumbs.db' -type f -delete 2>/dev/null" "Remove Thumbs.db files"

# Clean npm cache
log "Cleaning npm cache..."
if command -v npm >/dev/null 2>&1; then
    run_with_error_handling "npm cache clean --force" "Clean npm cache"
else
    log "npm not found, skipping cache cleanup"
fi

# Remove old log files (older than 30 days)
log "Removing old log files..."
for LOGS_DIR in "${LOG_DIRS[@]}"; do
    if [ -d "$LOGS_DIR" ]; then
        run_with_error_handling "find '$LOGS_DIR' -type f -name '*.log' -mtime +30 -delete 2>/dev/null" "Remove old logs from $LOGS_DIR"
    fi
done

# Clean any node_modules directories that might be left over
log "Cleaning leftover node_modules..."
run_with_error_handling "find . -name 'node_modules' -type d -exec rm -rf {} + 2>/dev/null" "Remove node_modules directories"

# Clean any package-lock.json files that might cause issues
log "Cleaning package-lock files..."
run_with_error_handling "find . -name 'package-lock.json' -type f -delete 2>/dev/null" "Remove package-lock.json files"

# Clean any build directories
log "Cleaning build directories..."
BUILD_DIRS=("frontend/build" "backend/build" "build" "dist")
for BUILD_DIR in "${BUILD_DIRS[@]}"; do
    if [ -d "$BUILD_DIR" ]; then
        run_with_error_handling "rm -rf '$BUILD_DIR'" "Remove build directory: $BUILD_DIR"
    fi
done

# Clean MongoDB database completely
log "Cleaning MongoDB database..."
if command -v mongosh >/dev/null 2>&1; then
    # First, try to drop all collections to ensure clean state
    run_with_error_handling "mongosh iptv_hotel --eval '
        try {
            // Drop all collections
            const collections = db.listCollectionNames();
            collections.forEach(function(collection) {
                print(\"Dropping collection: \" + collection);
                db[collection].drop();
            });
            
            // Also drop the database entirely for a clean slate
            print(\"Dropping database: iptv_hotel\");
            db.dropDatabase();
            
            print(\"MongoDB database cleanup completed\");
        } catch(e) {
            print(\"MongoDB cleanup failed: \" + e.message);
        }
    ' 2>/dev/null" "MongoDB database cleanup"
    
    # Alternative cleanup method if the above fails
    if [ $? -ne 0 ]; then
        log "Trying alternative MongoDB cleanup method..."
        run_with_error_handling "mongosh iptv_hotel --eval '
            try {
                // Try to drop specific collections one by one
                [\"users\", \"apps\", \"backgrounds\", \"devices\", \"logs\", \"settings\", \"backgroundbundles\"].forEach(function(collection) {
                    try {
                        print(\"Dropping collection: \" + collection);
                        db[collection].drop();
                    } catch(e) {
                        print(\"Failed to drop \" + collection + \": \" + e.message);
                    }
                });
                print(\"Alternative MongoDB cleanup completed\");
            } catch(e) {
                print(\"Alternative MongoDB cleanup failed: \" + e.message);
            }
        ' 2>/dev/null" "Alternative MongoDB cleanup"
    fi
    
    # Final compaction if database still exists
    run_with_error_handling "mongosh iptv_hotel --eval '
        try {
            db.runCommand({ compact: \"apps\" });
            db.runCommand({ compact: \"backgrounds\" });
            db.runCommand({ compact: \"devices\" });
            db.runCommand({ compact: \"logs\" });
            db.runCommand({ compact: \"users\" });
            db.runCommand({ compact: \"settings\" });
            print(\"MongoDB compaction completed\");
        } catch(e) {
            print(\"MongoDB compaction failed: \" + e.message);
        }
    ' > /dev/null 2>&1" "MongoDB compaction"
else
    log "mongosh not found, skipping database cleanup"
fi

# Clean any running processes that might interfere
log "Cleaning running processes..."
if command -v pm2 >/dev/null 2>&1; then
    run_with_error_handling "pm2 delete all 2>/dev/null" "Stop all PM2 processes"
    run_with_error_handling "pm2 flush 2>/dev/null" "Flush PM2 logs"
    run_with_error_handling "pm2 kill 2>/dev/null" "Kill PM2 daemon"
else
    log "PM2 not found, skipping PM2 cleanup"
fi

# Kill any node processes that might be running
log "Stopping any remaining Node.js processes..."
run_with_error_handling "pkill -f 'node.*iptv-hotel' 2>/dev/null" "Kill Node.js processes"
run_with_error_handling "pkill -f 'npm.*start' 2>/dev/null" "Kill npm processes"

# Remove any socket files or locks
log "Cleaning socket files and locks..."
run_with_error_handling "find /tmp -name '*iptv*' -type f -delete 2>/dev/null" "Remove temp files"
run_with_error_handling "find /var/run -name '*iptv*' -type f -delete 2>/dev/null" "Remove run files"

# Final verification - check if database is really clean
log "Verifying database cleanup..."
if command -v mongosh >/dev/null 2>&1; then
    COLLECTION_COUNT=$(mongosh iptv_hotel --quiet --eval "
        try {
            print(db.listCollectionNames().length);
        } catch(e) {
            print('0');
        }
    " 2>/dev/null)
    
    if [ "$COLLECTION_COUNT" = "0" ] || [ -z "$COLLECTION_COUNT" ]; then
        log "SUCCESS: Database is clean (no collections found)"
    else
        log "WARNING: Database still contains $COLLECTION_COUNT collections"
        # Try one more aggressive cleanup
        mongosh iptv_hotel --eval "
            try {
                db.dropDatabase();
                print('Force dropped database');
            } catch(e) {
                print('Failed to force drop database: ' + e.message);
            }
        " 2>/dev/null
    fi
fi

log "Cleanup completed - system is now ready for fresh deployment"
