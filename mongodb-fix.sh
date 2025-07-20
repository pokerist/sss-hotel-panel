#!/bin/bash

# MongoDB Index Fix Script
# This script ensures all required indexes are created in MongoDB

echo "Creating MongoDB indexes..."

# Connect to MongoDB and create indexes
mongosh iptv_hotel --eval '
// User indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "role": 1 });

// Device indexes
db.devices.createIndex({ "macAddress": 1 }, { unique: true });
db.devices.createIndex({ "uuid": 1 }, { unique: true });
db.devices.createIndex({ "roomNumber": 1 });
db.devices.createIndex({ "status": 1 });
db.devices.createIndex({ "connectionStatus": 1 });
db.devices.createIndex({ "lastHeartbeat": 1 });

// App indexes
db.apps.createIndex({ "name": 1 });
db.apps.createIndex({ "packageName": 1 }, { unique: true, sparse: true });
db.apps.createIndex({ "category": 1 });
db.apps.createIndex({ "isActive": 1 });
db.apps.createIndex({ "assignedDevices": 1 });

// Background indexes
db.backgrounds.createIndex({ "filename": 1 }, { unique: true });
db.backgrounds.createIndex({ "type": 1 });
db.backgrounds.createIndex({ "bundleId": 1 });
db.backgrounds.createIndex({ "isActive": 1 });
db.backgrounds.createIndex({ "metadata.tags": 1 });

// Background Bundle indexes
db.backgroundbundles.createIndex({ "name": 1 });
db.backgroundbundles.createIndex({ "isActive": 1 });
db.backgroundbundles.createIndex({ "createdBy": 1 });

// Settings indexes
db.settings.createIndex({ "key": 1 }, { unique: true });

// Log indexes
db.logs.createIndex({ "timestamp": -1 });
db.logs.createIndex({ "type": 1 });
db.logs.createIndex({ "level": 1 });
db.logs.createIndex({ "userId": 1 });

print("All indexes created successfully");
'

echo "MongoDB indexes have been created/updated"
