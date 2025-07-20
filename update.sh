#!/bin/bash

# IPTV Hotel Control Panel - Update Script
# This script handles production updates via git pull

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
echo "      Update Script v1.0"
echo "=================================="
echo -e "${NC}"

# Configuration
APP_DIR="/opt/iptv-hotel-panel"
BACKUP_DIR="/tmp/iptv-backup-$(date +%Y%m%d_%H%M%S)"

# Check if application is deployed
check_deployment() {
    if [[ ! -d "$APP_DIR" ]]; then
        error "Application not found at $APP_DIR. Please run deployment first."
    fi
    
    if ! command -v pm2 &> /dev/null; then
        error "PM2 not found. Please ensure the application is properly deployed."
    fi
    
    log "Deployment check passed"
}

# Backup current deployment
backup_deployment() {
    log "Creating backup of current deployment..."
    
    sudo mkdir -p "$BACKUP_DIR"
    sudo cp -r "$APP_DIR" "$BACKUP_DIR/"
    
    # Also backup PM2 configuration
    if [[ -d ~/.pm2 ]]; then
        cp -r ~/.pm2 "$BACKUP_DIR/pm2-config" 2>/dev/null || true
    fi
    
    log "Backup created at: $BACKUP_DIR"
}

# Pull latest changes
pull_updates() {
    log "Pulling latest changes from repository..."
    
    cd "$APP_DIR"
    
    # Stash any local changes
    git stash push -m "Auto-stash before update $(date)" 2>/dev/null || true
    
    # Pull latest changes
    git pull origin main
    
    # Check if there were any changes
    if [[ $? -eq 0 ]]; then
        log "Repository updated successfully"
    else
        error "Failed to pull updates from repository"
    fi
}

# Install/update dependencies
update_dependencies() {
    log "Updating dependencies..."
    
    cd "$APP_DIR"
    
    # Update backend dependencies
    if [[ -f "backend/package.json" ]]; then
        cd "$APP_DIR/backend"
        npm install --production
        log "Backend dependencies updated"
    fi
    
    # Update frontend dependencies and rebuild
    if [[ -f "$APP_DIR/frontend/package.json" ]]; then
        cd "$APP_DIR/frontend"
        npm install
        
        # Check if .env.production exists
        if [[ -f ".env.production" ]]; then
            log "Rebuilding frontend with production environment..."
            NODE_OPTIONS="--max-old-space-size=4096" npm run build
            log "Frontend rebuilt successfully"
        else
            warn ".env.production not found, skipping frontend rebuild"
        fi
    fi
    
    # Update mock PMS dependencies if it exists
    if [[ -f "$APP_DIR/mock-pms/package.json" ]]; then
        cd "$APP_DIR/mock-pms"
        npm install --production
        log "Mock PMS dependencies updated"
    fi
}

# Run database migrations if needed
run_migrations() {
    log "Checking for database migrations..."
    
    cd "$APP_DIR/backend"
    
    # Create migration script if database schema updates are needed
    if [[ -f "migrate.js" ]]; then
        log "Running database migrations..."
        node migrate.js
    else
        info "No migrations to run"
    fi
}

# Restart services
restart_services() {
    log "Restarting application services..."
    
    cd "$APP_DIR"
    
    # Reload PM2 configuration
    if [[ -f "ecosystem.config.js" ]]; then
        pm2 reload ecosystem.config.js
        log "PM2 services reloaded"
    else
        # Fallback to basic restart
        pm2 restart all
        log "All PM2 services restarted"
    fi
    
    # Wait for services to start
    sleep 5
    
    # Check service status
    pm2 status
}

# Health check
health_check() {
    log "Performing health check..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log "Health check passed - application is responding"
            break
        else
            if [[ $attempt -eq $max_attempts ]]; then
                error "Health check failed after $max_attempts attempts"
            fi
            warn "Health check attempt $attempt failed, retrying in 2 seconds..."
            sleep 2
            ((attempt++))
        fi
    done
    
    # Additional checks
    info "Service status:"
    pm2 status
    
    log "Update completed successfully!"
}

# Rollback function
rollback() {
    error_msg="$1"
    
    warn "Update failed: $error_msg"
    warn "Initiating rollback..."
    
    if [[ -d "$BACKUP_DIR" ]]; then
        # Stop current services
        pm2 stop all 2>/dev/null || true
        
        # Restore backup
        sudo rm -rf "$APP_DIR"
        sudo cp -r "$BACKUP_DIR/iptv-hotel-panel" /opt/
        sudo chown -R $USER:$USER "$APP_DIR"
        
        # Restore PM2 config
        if [[ -d "$BACKUP_DIR/pm2-config" ]]; then
            rm -rf ~/.pm2
            cp -r "$BACKUP_DIR/pm2-config" ~/.pm2
        fi
        
        # Restart services
        cd "$APP_DIR"
        pm2 start ecosystem.config.js 2>/dev/null || pm2 start all
        
        log "Rollback completed successfully"
        
        # Clean up backup
        sudo rm -rf "$BACKUP_DIR"
        
        exit 1
    else
        error "No backup found for rollback"
    fi
}

# Main update function
update() {
    log "Starting IPTV Hotel Control Panel update..."
    
    # Set trap for error handling
    trap 'rollback "Script execution failed"' ERR
    
    # Pre-update checks
    check_deployment
    
    # Create backup
    backup_deployment
    
    # Pull updates
    pull_updates
    
    # Update dependencies
    update_dependencies
    
    # Run migrations
    run_migrations
    
    # Restart services
    restart_services
    
    # Health check
    health_check
    
    # Clean up backup on success
    log "Cleaning up backup..."
    sudo rm -rf "$BACKUP_DIR"
    
    echo
    echo -e "${GREEN}=================================="
    echo "     Update Completed!"
    echo -e "==================================${NC}"
    echo
    info "IPTV Hotel Control Panel has been updated successfully!"
    echo
    info "Services Status:"
    pm2 status
    echo
    info "Useful Commands:"
    info "  View logs: pm2 logs"
    info "  Restart all: pm2 restart all"
    info "  Stop all: pm2 stop all"
    echo
    log "Update process completed successfully!"
}

# Run update
update
