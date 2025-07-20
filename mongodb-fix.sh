#!/bin/bash

# MongoDB Fix Verification Script
# This script helps verify and fix MongoDB issues before deployment

echo "========================================"
echo "   MongoDB Fix Verification Script"
echo "========================================"

# Check if MongoDB is running
echo "1. Checking MongoDB service status..."
if sudo systemctl is-active --quiet mongod; then
    echo "✅ MongoDB service is running"
else
    echo "❌ MongoDB service is not running"
    echo "   Attempting to start MongoDB..."
    sudo systemctl start mongod
    sleep 3
    if sudo systemctl is-active --quiet mongod; then
        echo "✅ MongoDB service started successfully"
    else
        echo "❌ Failed to start MongoDB service"
        exit 1
    fi
fi

# Test MongoDB connectivity
echo ""
echo "2. Testing MongoDB connectivity..."
if mongosh --eval "db.runCommand('ping').ok" --quiet 2>/dev/null; then
    echo "✅ MongoDB connection successful"
else
    echo "❌ MongoDB connection failed"
    exit 1
fi

# Check for problematic devices with null MAC addresses
echo ""
echo "3. Checking for problematic devices..."
null_mac_devices=$(mongosh iptv_hotel --eval "db.devices.countDocuments({macAddress: null})" --quiet 2>/dev/null || echo "0")
if [[ "$null_mac_devices" != "0" && "$null_mac_devices" =~ ^[0-9]+$ && $null_mac_devices -gt 0 ]]; then
    echo "⚠️  Found $null_mac_devices devices with null MAC addresses"
    echo "   These will cause duplicate key errors during deployment"
    echo ""
    echo "   Cleaning up problematic devices..."
    
    # Remove devices with null MAC addresses
    mongosh iptv_hotel --eval "
        const result = db.devices.deleteMany({macAddress: null});
        print('Removed ' + result.deletedCount + ' devices with null MAC addresses');
    " --quiet
    
    echo "✅ Cleanup completed"
else
    echo "✅ No problematic devices found"
fi

# Check for duplicate devices by MAC address
echo ""
echo "4. Checking for duplicate MAC addresses..."
duplicates=$(mongosh iptv_hotel --eval "
    const duplicates = db.devices.aggregate([
        { \$group: { _id: '\$macAddress', count: { \$sum: 1 }, docs: { \$push: '\$_id' } } },
        { \$match: { count: { \$gt: 1 } } }
    ]).toArray();
    
    let removed = 0;
    duplicates.forEach(function(duplicate) {
        if (duplicate._id !== null) {
            const docsToRemove = duplicate.docs.slice(1);
            const result = db.devices.deleteMany({ _id: { \$in: docsToRemove } });
            removed += result.deletedCount;
            print('Removed ' + result.deletedCount + ' duplicate devices for MAC: ' + duplicate._id);
        }
    });
    
    print('Total duplicates removed: ' + removed);
    removed;
" --quiet 2>/dev/null || echo "0")

if [[ "$duplicates" == "0" ]]; then
    echo "✅ No duplicate devices found"
else
    echo "✅ Removed duplicate devices"
fi

# Test database operations
echo ""
echo "5. Testing database operations..."
test_result=$(mongosh iptv_hotel --eval "
    try {
        // Test write operation
        db.health_check.insertOne({timestamp: new Date(), test: 'mongodb_fix_test'});
        
        // Test read operation
        const doc = db.health_check.findOne({test: 'mongodb_fix_test'});
        if (!doc) {
            print('ERROR: Read operation failed');
            quit(1);
        }
        
        // Clean up test document
        db.health_check.deleteOne({test: 'mongodb_fix_test'});
        
        print('SUCCESS: Database operations working correctly');
    } catch (error) {
        print('ERROR: Database operations failed - ' + error);
        quit(1);
    }
" --quiet 2>/dev/null)

if [[ $? -eq 0 ]]; then
    echo "✅ Database operations test passed"
else
    echo "❌ Database operations test failed"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ MongoDB Fix Verification Complete!"
echo "========================================"
echo ""
echo "Your MongoDB is now ready for deployment."
echo "You can now run: ./deploy.sh"
echo ""
echo "If you still encounter issues:"
echo "1. Run complete cleanup: ./cleanup.sh"
echo "2. Then run deployment: ./deploy.sh"
echo ""
