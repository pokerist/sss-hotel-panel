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
    const devices = [
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
            }
        }
    ];

    return await Device.insertMany(devices);
}

async function initialize() {
    try {
        console.log('Connecting to MongoDB database...');
        await database.connect();
        
        console.log('Initializing default settings...');
        await Settings.initializeDefaultSettings();
        
        console.log('Creating super admin user...');
        const superAdmin = await User.createUser({
            email: process.env.SUPER_ADMIN_EMAIL,
            password: process.env.SUPER_ADMIN_PASSWORD,
            name: 'Super Administrator',
            role: 'super_admin'
        });
        console.log('Super admin created successfully:', superAdmin.email);

        // Create test data
        const apps = await createTestApps(superAdmin);
        console.log('Created test apps:', apps.length);

        const backgrounds = await createTestBackgrounds(superAdmin);
        console.log('Created test backgrounds:', backgrounds.length);

        const bundle = await createTestBackgroundBundle(superAdmin, backgrounds);
        console.log('Created test background bundle:', bundle.name);

        const devices = await createTestDevices(superAdmin, apps);
        console.log('Created test devices:', devices.length);

        console.log('MongoDB initialization completed successfully!');
        await database.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Initialization failed:', error);
        console.error('Error details:', error.message);
        await database.disconnect();
        process.exit(1);
    }
}

initialize();
