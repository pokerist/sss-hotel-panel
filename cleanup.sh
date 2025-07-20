#!/bin/bash

# IPTV Hotel Control Panel - Complete Environment Cleanup Script
# This script removes all traces of previous deployments

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

echo -e "${RED}"
echo "==========================================="
echo "   IPTV Hotel Control Panel"
echo "     COMPLETE CLEANUP SCRIPT"
echo "   ⚠️  THIS WILL REMOVE EVERYTHING! ⚠️"
echo "==========================================="
echo -e "${NC}"

# Confirmation prompt
echo -e "${YELLOW}"
echo "This script will completely remove:"
echo "  • All PM2 processes and configurations"
echo "  • Application files and directories"
echo "  • Database data (MongoDB)"
echo "  • Nginx configurations"
echo "  • SSL certificates"
echo "  • Log files"
echo "  • Uploaded files"
echo -e "${NC}"

read -p "Are you absolutely sure you want to continue? (type 'DESTROY' to confirm): " confirmation

if [[ "$confirmation" != "DESTROY" ]]; then
    info "Cleanup cancelled. No changes were made."
    exit 0
fi

log "Starting complete cleanup process..."

# Stop and remove PM2 processes
cleanup_pm2() {
    log "Cleaning up PM2 processes..."
    
    # Stop all PM2 processes
    if command -v pm2 &> /dev/null; then
        pm2 stop all 2>/dev/null || true
        pm2 delete all 2>/dev/null || true
        pm2 kill 2>/dev/null || true
        
        # Remove PM2 startup script
        pm2 unstartup 2>/dev/null || true
        sudo systemctl disable pm2-$USER 2>/dev/null || true
        sudo rm -f /etc/systemd/system/pm2-$USER.service 2>/dev/null || true
        
        # Remove PM2 directories
        rm -rf ~/.pm2 2>/dev/null || true
        
        log "PM2 processes cleaned up successfully"
    else
        info "PM2 not installed, skipping..."
    fi
}

# Remove application files
cleanup_application() {
    log "Removing application files..."
    
    # Remove main application directory
    if [[ -d "/opt/iptv-hotel-panel" ]]; then
        sudo rm -rf /opt/iptv-hotel-panel
        log "Application directory removed"
    fi
    
    # Remove any backup directories
    sudo rm -rf /opt/iptv-hotel-panel-* 2>/dev/null || true
    
    log "Application files cleaned up successfully"
}

# Clean up Nginx configuration
cleanup_nginx() {
    log "Cleaning up Nginx configuration..."
    
    # Remove site configuration
    sudo rm -f /etc/nginx/sites-available/iptv-hotel-panel
    sudo rm -f /etc/nginx/sites-enabled/iptv-hotel-panel
    
    # Restore default site if it doesn't exist
    if [[ ! -f "/etc/nginx/sites-enabled/default" ]] && [[ -f "/etc/nginx/sites-available/default" ]]; then
        sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
    fi
    
    # Test and reload Nginx
    sudo nginx -t && sudo systemctl reload nginx 2>/dev/null || true
    
    log "Nginx configuration cleaned up successfully"
}

# Clean up SSL certificates
cleanup_ssl() {
    log "Cleaning up SSL certificates..."
    
    if command -v certbot &> /dev/null; then
        # List and remove all certificates
        DOMAINS=$(sudo certbot certificates 2>/dev/null | grep "Certificate Name:" | awk '{print $3}' || echo "")
        
        if [[ -n "$DOMAINS" ]]; then
            for domain in $DOMAINS; do
                sudo certbot delete --cert-name "$domain" --non-interactive 2>/dev/null || true
                log "Removed SSL certificate for: $domain"
            done
        fi
        
        # Remove certbot auto-renewal
        sudo systemctl disable certbot.timer 2>/dev/null || true
        
        log "SSL certificates cleaned up successfully"
    else
        info "Certbot not installed, skipping SSL cleanup..."
    fi
}

# Clean up MongoDB
cleanup_mongodb() {
    log "Cleaning up MongoDB..."
    
    if command -v mongosh &> /dev/null; then
        # Drop the database
        mongosh iptv_hotel --eval "db.dropDatabase()" --quiet 2>/dev/null || true
        log "MongoDB database dropped"
        
        # Optionally stop MongoDB service
        read -p "Do you want to stop and disable MongoDB service? (y/N): " stop_mongo
        if [[ "$stop_mongo" =~ ^[Yy] ]]; then
            sudo systemctl stop mongod 2>/dev/null || true
            sudo systemctl disable mongod 2>/dev/null || true
            log "MongoDB service stopped and disabled"
        fi
        
        # Optionally remove MongoDB completely
        read -p "Do you want to completely remove MongoDB? (y/N): " remove_mongo
        if [[ "$remove_mongo" =~ ^[Yy] ]]; then
            sudo systemctl stop mongod 2>/dev/null || true
            sudo apt remove --purge mongodb-org* -y 2>/dev/null || true
            sudo rm -rf /var/log/mongodb
            sudo rm -rf /var/lib/mongodb
            sudo rm -f /etc/apt/sources.list.d/mongodb-org-*.list
            sudo rm -f /usr/share/keyrings/mongodb-server-*.gpg
            log "MongoDB completely removed"
        fi
    else
        info "MongoDB not installed, skipping database cleanup..."
    fi
}

# Clean up firewall rules
cleanup_firewall() {
    log "Cleaning up firewall rules..."
    
    if command -v ufw &> /dev/null; then
        read -p "Do you want to reset firewall rules? (y/N): " reset_fw
        if [[ "$reset_fw" =~ ^[Yy] ]]; then
            sudo ufw --force reset
            sudo ufw --force disable
            log "Firewall rules reset and disabled"
        fi
    fi
}

# Clean up system packages
cleanup_packages() {
    log "Cleaning up system packages..."
    
    read -p "Do you want to remove Node.js and npm? (y/N): " remove_node
    if [[ "$remove_node" =~ ^[Yy] ]]; then
        # Remove Node.js
        sudo apt remove --purge nodejs npm -y 2>/dev/null || true
        sudo rm -f /etc/apt/sources.list.d/nodesource.list
        sudo rm -f /usr/share/keyrings/nodesource.gpg
        
        # Remove global npm packages directory
        rm -rf ~/.npm 2>/dev/null || true
        
        log "Node.js and npm removed"
    fi
    
    read -p "Do you want to remove Nginx? (y/N): " remove_nginx
    if [[ "$remove_nginx" =~ ^[Yy] ]]; then
        sudo systemctl stop nginx 2>/dev/null || true
        sudo apt remove --purge nginx nginx-common -y 2>/dev/null || true
        sudo rm -rf /etc/nginx
        sudo rm -rf /var/log/nginx
        sudo rm -rf /var/www
        log "Nginx removed"
    fi
    
    # Clean up package cache
    sudo apt autoremove -y
    sudo apt autoclean
    
    log "System packages cleaned up"
}

# Clean up log files
cleanup_logs() {
    log "Cleaning up log files..."
    
    # Remove application logs
    sudo rm -rf /var/log/iptv-* 2>/dev/null || true
    
    # Clean system logs related to our services
    sudo journalctl --vacuum-time=1d 2>/dev/null || true
    
    log "Log files cleaned up"
}

# Main cleanup function
cleanup() {
    log "Starting complete cleanup process..."
    
    # Stop and clean PM2 processes first
    cleanup_pm2
    
    # Remove application files
    cleanup_application
    
    # Clean up web server configuration
    cleanup_nginx
    
    # Clean up SSL certificates
    cleanup_ssl
    
    # Clean up database
    cleanup_mongodb
    
    # Clean up firewall rules
    cleanup_firewall
    
    # Clean up system packages (optional)
    cleanup_packages
    
    # Clean up logs
    cleanup_logs
    
    # Final cleanup
    log "Performing final cleanup..."
    
    # Remove any remaining traces
    sudo rm -rf /tmp/iptv-* 2>/dev/null || true
    sudo rm -rf /var/tmp/iptv-* 2>/dev/null || true
    
    echo
    echo -e "${GREEN}========================================="
    echo "         CLEANUP COMPLETED!"
    echo -e "=========================================${NC}"
    echo
    info "All IPTV Hotel Control Panel components have been removed."
    info "The system has been restored to a clean state."
    echo
    warn "If you want to redeploy, you can now run:"
    warn "  git clone https://github.com/pokerist/sss-hotel-panel.git"
    warn "  cd sss-hotel-panel"
    warn "  chmod +x deploy.sh"
    warn "  ./deploy.sh"
    echo
    log "Cleanup process completed successfully!"
}

# Run cleanup
cleanup
