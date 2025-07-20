#!/bin/bash

# Cleanup Script
# This script removes orphaned files and fixes permissions

echo "Starting cleanup process..."

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to handle errors
handle_error() {
    log "ERROR: $1"
    exit 1
}

# Ensure we're in the correct directory
cd "$(dirname "$0")" || handle_error "Failed to change to script directory"

# Connect to MongoDB and get list of valid files
log "Getting list of valid files from database..."
VALID_FILES=$(mongosh iptv_hotel --quiet --eval '
    let files = [];
    // Get app icons
    db.apps.find({}, {icon: 1}).forEach(app => {
        if (app.icon) files.push(app.icon.replace("/uploads/", ""));
    });
    // Get backgrounds
    db.backgrounds.find({}, {filename: 1}).forEach(bg => {
        files.push("backgrounds/" + bg.filename);
    });
    print(files.join("\n"));
')

if [ $? -ne 0 ]; then
    handle_error "Failed to get file list from database"
fi

# Create temporary file with valid filenames
echo "$VALID_FILES" > /tmp/valid_files.txt

# Check uploads directory
UPLOADS_DIR="backend/public/uploads"
if [ ! -d "$UPLOADS_DIR" ]; then
    handle_error "Uploads directory not found"
fi

log "Checking for orphaned files..."
find "$UPLOADS_DIR" -type f | while read -r file; do
    relative_path=${file#"$UPLOADS_DIR/"}
    if ! grep -q "^$relative_path$" /tmp/valid_files.txt; then
        log "Found orphaned file: $file"
        rm "$file" && log "Deleted: $file" || log "Failed to delete: $file"
    fi
done

# Remove temporary file
rm /tmp/valid_files.txt

# Fix permissions
log "Fixing permissions..."

# Ensure uploads directory exists and has correct permissions
mkdir -p "$UPLOADS_DIR/backgrounds"
mkdir -p "$UPLOADS_DIR/app-icons"

# Fix ownership and permissions
sudo chown -R $USER:www-data "$UPLOADS_DIR"
sudo chmod -R 755 "$UPLOADS_DIR"
find "$UPLOADS_DIR" -type f -exec chmod 644 {} \;

# Fix logs directory permissions
LOGS_DIR="backend/logs"
mkdir -p "$LOGS_DIR"
sudo chown -R $USER:$USER "$LOGS_DIR"
sudo chmod -R 755 "$LOGS_DIR"

# Remove any temporary files
log "Cleaning temporary files..."
find . -name "*.tmp" -type f -delete
find . -name ".DS_Store" -type f -delete
find . -name "Thumbs.db" -type f -delete

# Clean npm cache
log "Cleaning npm cache..."
npm cache clean --force

# Remove old log files (older than 30 days)
log "Removing old log files..."
find "$LOGS_DIR" -type f -name "*.log" -mtime +30 -delete

# Vacuum MongoDB to reclaim space
log "Vacuuming MongoDB..."
mongosh iptv_hotel --eval '
    db.runCommand({ compact: "apps" });
    db.runCommand({ compact: "backgrounds" });
    db.runCommand({ compact: "devices" });
    db.runCommand({ compact: "logs" });
' > /dev/null 2>&1

log "Cleanup completed successfully"
