const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');
const Settings = require('./src/models/Settings');
const Device = require('./src/models/Device');
const App = require('./src/models/App');
const Background = require('./src/models/Background');
const BackgroundBundle = require('./src/models/BackgroundBundle');
const database = require('./src/config/database');

async function createTestApps(superAdmin) {
    console.log('Creating test apps...');
    const apps = [
        {
            name: 'Netflix',
            description: 'Streaming entertainment service',
            category: 'entertainment',
            icon: '/uploads/app-icons/netflix.png',
            packageName: 'com.netflix.mediaclient',
            url: 'https://play.google.com/store/apps/details?id=com.netflix.mediaclient',
            version: '8.0.0',
            createdBy: superAdmin._id
        },
        {
            name: 'YouTube',
            description: 'Video sharing platform',
            category: 'entertainment',
            icon: '/uploads/app-icons/youtube.png',
            packageName: 'com.google.android.youtube.tv',
            url: 'https://play.google.com/store/apps/details?id=com.google.android.youtube.tv',
            version: '2.0.0',
            createdBy: superAdmin._id
        },
        {
            name: 'Hotel Services',
            description: 'In-room services and information',
            category: 'utility',
            icon: '/uploads/app-icons/hotel-services.png',
            packageName: 'com.hotel.services',
            url: 'https://example.com/hotel-app.apk',
            version: '1.5.2',
            createdBy: superAdmin._id
        }
    ];

    return await App.insertMany(apps);
}

async function createTestBackgrounds(superAdmin) {
    console.log('Creating test backgrounds...');
    const backgrounds = [
        {
            name: 'Nature Landscape',
            filename: 'nature-landscape.jpg',
            originalName: 'nature-landscape.jpg',
            type: 'image',
            size: 2048576,
            path: '/uploads/backgrounds/nature-landscape.jpg',
            mimeType: 'image/jpeg',
            dimensions: { width: 1920, height: 1080 },
            uploadedBy: superAdmin._id,
            metadata: {
                tags: ['nature', 'landscape', 'mountains'],
                season: 'summer'
            }
        },
        {
            name: 'Ocean Waves',
            filename: 'ocean-waves.mp4',
            originalName: 'ocean-waves.mp4',
            type: 'video',
            size: 15728640,
            path: '/uploads/backgrounds/ocean-waves.mp4',
            mimeType: 'video/mp4',
            dimensions: { width: 1920, height: 1080 },
            duration: 30,
            uploadedBy: superAdmin._id,
            metadata: {
                tags: ['ocean', 'waves', 'relaxing'],
                season: 'all'
            }
        }
    ];

    return await Background.insertMany(backgrounds);
}

async function createTestBackgroundBundle(superAdmin, backgrounds) {
    console.log('Creating test background bundle...');
    const bundle = new BackgroundBundle({
        name: 'Nature Collection',
        description: 'Beautiful nature scenes and landscapes',
        backgrounds: backgrounds.map(bg => bg._id),
        createdBy: superAdmin._id,
        settings: {
            displayDuration: 30,
            transitionEffect: 'fade',
            shuffleEnabled: true
        }
    });

    await bundle.save();
    return bundle;
}

async function createTestDevices(superAdmin, apps) {
    console.log('Creating test devices...');
    const devicesData = [
        {
            uuid: 'device-001-uuid',
            macAddress: '00:11:22:33:44:55',
            roomNumber: 'Room-101',
            status: 'approved',
            connectionStatus: 'online',
            lastHeartbeat: new Date(),
            approvedBy: superAdmin._id,
            approvedAt: new Date(),
            deviceInfo: {
                manufacturer: 'Samsung',
                model: 'Smart TV',
                androidVersion: '9.0'
            },
            configuration: {
                appLayout: apps.map((app, index) => ({
                    appId: app._id,
                    position: index,
                    isVisible: true
                }))
            },
            statistics: {
                totalUptime: 0,
                configPushCount: 0,
                messagesReceived: 0
            }
        },
        {
            uuid: 'device-002-uuid',
            macAddress: '00:11:22:33:44:66',
            roomNumber: 'Room-102',
            status: 'approved',
            connectionStatus: 'online',
            lastHeartbeat: new Date(),
            approvedBy: superAdmin._id,
            approvedAt: new Date(),
            deviceInfo: {
                manufacturer: 'LG',
                model: 'Smart TV',
                androidVersion: '10.0'
            },
            configuration: {
                appLayout: apps.map((app, index) => ({
                    appId: app._id,
                    position: index,
                    isVisible: true
                }))
            },
            statistics: {
                totalUptime: 0,
                configPushCount: 0,
                messagesReceived: 0
            }
        }
    ];

    const createdDevices = [];
    
    // Insert devices one by one with individual error handling
    for (const deviceData of devicesData) {
        try {
            // Use findOneAndUpdate with upsert to avoid duplicate key errors
            const device = await Device.findOneAndUpdate(
                { $or: [{ uuid: deviceData.uuid }, { macAddress: deviceData.macAddress }] },
                deviceData,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            createdDevices.push(device);
            console.log(`Test device created/updated: ${device.uuid} (${device.macAddress})`);
        } catch (error) {
            console.warn(`Warning: Failed to create device ${deviceData.uuid}:`, error.message);
            // Try to create without upsert as fallback
            try {
                const existingDevice = await Device.findOne({
                    $or: [{ uuid: deviceData.uuid }, { macAddress: deviceData.macAddress }]
                });
                if (existingDevice) {
                    createdDevices.push(existingDevice);
                    console.log(`Using existing device: ${existingDevice.uuid}`);
                }
            } catch (fallbackError) {
                console.warn(`Could not handle device ${deviceData.uuid}:`, fallbackError.message);
            }
        }
    }

    return createdDevices;
}

async function cleanupExistingData() {
    console.log('Cleaning up existing data to prevent conflicts...');
    
    try {
        // Remove any devices with null MAC addresses or duplicate entries
        const devicesWithNullMac = await Device.deleteMany({ macAddress: null });
        if (devicesWithNullMac.deletedCount > 0) {
            console.log(`Removed ${devicesWithNullMac.deletedCount} devices with null MAC addresses`);
        }
        
        // Remove any duplicate devices by MAC address
        const deviceDuplicates = await Device.aggregate([
            { $group: { _id: "$macAddress", count: { $sum: 1 }, docs: { $push: "$_id" } } },
            { $match: { count: { $gt: 1 } } }
        ]);
        
        for (const duplicate of deviceDuplicates) {
            // Keep the first document, remove the rest
            const docsToRemove = duplicate.docs.slice(1);
            await Device.deleteMany({ _id: { $in: docsToRemove } });
            console.log(`Removed ${docsToRemove.length} duplicate devices for MAC: ${duplicate._id}`);
        }
        
        // Clean up orphaned test data if exists
        await Device.deleteMany({ uuid: { $regex: /^device-\d+-uuid$/ } });
        await App.deleteMany({ name: { $in: ['Netflix', 'YouTube', 'Hotel Services'] } });
        await Background.deleteMany({ name: { $in: ['Nature Landscape', 'Ocean Waves'] } });
        await BackgroundBundle.deleteMany({ name: 'Nature Collection' });
        
        console.log('Existing data cleanup completed');
    } catch (error) {
        console.warn('Warning during cleanup:', error.message);
        // Continue with initialization even if cleanup fails
    }
}

async function createOrUpdateSuperAdmin() {
    console.log('Creating/updating super admin user...');
    
    try {
        // Check if super admin already exists
        const existingAdmin = await User.findOne({ email: process.env.SUPER_ADMIN_EMAIL });
        
        if (existingAdmin) {
            console.log('Super admin already exists, updating password...');
            existingAdmin.password = process.env.SUPER_ADMIN_PASSWORD;
            await existingAdmin.save();
            return existingAdmin;
        } else {
            const superAdmin = await User.createUser({
                email: process.env.SUPER_ADMIN_EMAIL,
                password: process.env.SUPER_ADMIN_PASSWORD,
                name: 'Super Administrator',
                role: 'super_admin'
            });
            console.log('Super admin created successfully:', superAdmin.email);
            return superAdmin;
        }
    } catch (error) {
        // If user creation fails due to duplicate email, try to find existing user
        if (error.code === 11000) {
            console.log('Super admin email already exists, fetching existing user...');
            return await User.findOne({ email: process.env.SUPER_ADMIN_EMAIL });
        }
        throw error;
    }
}

async function initialize() {
    try {
        console.log('Connecting to MongoDB database...');
        await database.connect();
        
        // Clean up any problematic existing data first
        await cleanupExistingData();
        
        console.log('Initializing default settings...');
        await Settings.initializeDefaultSettings();
        
        // Create or update super admin user
        const superAdmin = await createOrUpdateSuperAdmin();

        // Create test data only if it doesn't exist
        console.log('Creating test data...');
        
        let apps = await App.find({ name: { $in: ['Netflix', 'YouTube', 'Hotel Services'] } });
        if (apps.length === 0) {
            apps = await createTestApps(superAdmin);
            console.log('Created test apps:', apps.length);
        } else {
            console.log('Test apps already exist, skipping creation');
        }

        let backgrounds = await Background.find({ name: { $in: ['Nature Landscape', 'Ocean Waves'] } });
        if (backgrounds.length === 0) {
            backgrounds = await createTestBackgrounds(superAdmin);
            console.log('Created test backgrounds:', backgrounds.length);
        } else {
            console.log('Test backgrounds already exist, skipping creation');
        }

        let bundle = await BackgroundBundle.findOne({ name: 'Nature Collection' });
        if (!bundle) {
            bundle = await createTestBackgroundBundle(superAdmin, backgrounds);
            console.log('Created test background bundle:', bundle.name);
        } else {
            console.log('Test background bundle already exists, skipping creation');
        }

        // Only create test devices if none exist with the test UUIDs
        const existingTestDevices = await Device.find({ uuid: { $regex: /^device-\d+-uuid$/ } });
        if (existingTestDevices.length === 0) {
            const devices = await createTestDevices(superAdmin, apps);
            console.log('Created test devices:', devices.length);
        } else {
            console.log('Test devices already exist, skipping creation');
        }

        console.log('MongoDB initialization completed successfully!');
        await database.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Initialization failed:', error);
        console.error('Error details:', error.message);
        
        // Provide helpful error messages for common issues
        if (error.message.includes('E11000')) {
            console.error('\nTroubleshooting: This appears to be a duplicate key error.');
            console.error('Try running the cleanup script first: ./cleanup.sh');
            console.error('Then run the deployment again: ./deploy.sh');
        }
        
        await database.disconnect();
        process.exit(1);
    }
}

initialize();
