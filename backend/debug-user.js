// Debug script for user authentication issues
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import the database and User model
const database = require('./src/config/database');
const User = require('./src/models/User');

// Helper function to check if a string is already a bcrypt hash
const isBcryptHash = (str) => {
  return /^\$2[abxy]?\$\d+\$/.test(str);
};

async function debugUser() {
  try {
    console.log('🔧 User Authentication Debug Script');
    console.log('=====================================\n');

    // Connect to database
    console.log('1. Connecting to database...');
    await database.connect();
    console.log('✅ Database connected successfully\n');

    const testEmail = process.env.SUPER_ADMIN_EMAIL || 'ahmedaimnwasfy@gmail.com';
    const testPassword = process.env.SUPER_ADMIN_PASSWORD || 'DISsHHTMDEZPqpmrqR0T6fKM';

    console.log(`2. Testing credentials:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}\n`);

    // Check if user exists
    console.log('3. Checking if user exists...');
    const existingUser = await User.findByEmail(testEmail);
    
    if (existingUser) {
      console.log('✅ User found in database');
      console.log(`   ID: ${existingUser.id || existingUser._id}`);
      console.log(`   Name: ${existingUser.name}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Is Active: ${existingUser.isActive}`);
      console.log(`   Password Hash: ${existingUser.password.substring(0, 30)}...`);
      console.log(`   Is Bcrypt Hash: ${isBcryptHash(existingUser.password) ? '✅ YES' : '❌ NO'}`);
      
      // Test password comparison
      console.log('\n4. Testing password comparison...');
      const isPasswordValid = await existingUser.comparePassword(testPassword);
      console.log(`   Password matches: ${isPasswordValid ? '✅ YES' : '❌ NO'}`);
      
      if (!isPasswordValid) {
        console.log('\n   ❌ Password comparison failed!');
        console.log('   This indicates a hashing issue.');
        
        // Show hash details
        console.log(`\n   Hash Analysis:`);
        console.log(`   - Length: ${existingUser.password.length}`);
        console.log(`   - Starts with $2: ${existingUser.password.startsWith('$2')}`);
        console.log(`   - Pattern: ${existingUser.password.match(/^\$2[abxy]?\$\d+\$/) ? 'Valid' : 'Invalid'}`);
        
        // Try manual bcrypt comparison
        console.log('\n   Testing manual bcrypt comparison...');
        try {
          const manualCheck = await bcrypt.compare(testPassword, existingUser.password);
          console.log(`   Manual bcrypt.compare result: ${manualCheck ? '✅ YES' : '❌ NO'}`);
        } catch (error) {
          console.log(`   Manual bcrypt.compare error: ${error.message}`);
        }
      }
      
    } else {
      console.log('❌ User NOT found in database');
      console.log('   User creation during deployment may have failed.');
    }

    // Create a fresh test user
    console.log('\n5. Creating fresh test user...');
    const testUserEmail = 'debug-test@example.com';
    
    try {
      // Delete existing test user if it exists
      const existingTestUser = await User.findByEmail(testUserEmail);
      if (existingTestUser) {
        console.log('   Deleting existing test user...');
        if (process.env.DB_TYPE === 'mongodb') {
          await existingTestUser.deleteOne();
        } else {
          await existingTestUser.destroy();
        }
      }

      console.log('   Creating new test user...');
      const newUser = await User.createUser({
        email: testUserEmail,
        password: 'TestPassword123',
        name: 'Debug Test User',
        role: 'admin'
      });

      console.log('✅ Test user created successfully');
      console.log(`   ID: ${newUser.id || newUser._id}`);
      console.log(`   Email: ${newUser.email}`);
      console.log(`   Password Hash: ${newUser.password.substring(0, 30)}...`);
      console.log(`   Is Bcrypt Hash: ${isBcryptHash(newUser.password) ? '✅ YES' : '❌ NO'}`);

      // Test password on new user
      console.log('\n6. Testing password on fresh user...');
      const newUserPasswordValid = await newUser.comparePassword('TestPassword123');
      console.log(`   Fresh user password matches: ${newUserPasswordValid ? '✅ YES' : '❌ NO'}`);

      // Clean up test user
      console.log('\n   Cleaning up test user...');
      if (process.env.DB_TYPE === 'mongodb') {
        await newUser.deleteOne();
      } else {
        await newUser.destroy();
      }
      console.log('   Test user deleted');

    } catch (error) {
      console.log(`   ❌ Test user creation failed: ${error.message}`);
    }

    // If original user exists but password doesn't work, try to fix it
    if (existingUser && !(await existingUser.comparePassword(testPassword))) {
      console.log('\n7. Attempting to fix existing user password...');
      try {
        await existingUser.setPassword(testPassword);
        await existingUser.save();
        console.log('✅ User password updated');
        
        // Test again
        const fixedPasswordValid = await existingUser.comparePassword(testPassword);
        console.log(`   Fixed password matches: ${fixedPasswordValid ? '✅ YES' : '❌ NO'}`);
      } catch (error) {
        console.log(`   ❌ Password fix failed: ${error.message}`);
      }
    }

    console.log('\n=====================================');
    console.log('🎯 Debug Summary:');
    if (existingUser) {
      const finalPasswordCheck = await existingUser.comparePassword(testPassword);
      if (finalPasswordCheck) {
        console.log('✅ User authentication should work now!');
        console.log(`   You can login with: ${testEmail}`);
        console.log(`   Password: ${testPassword}`);
      } else {
        console.log('❌ User authentication is still broken');
        console.log('   Consider deleting and recreating the user');
      }
    } else {
      console.log('❌ No user found - deployment user creation failed');
      console.log('   The initialize.js script may have errors');
    }

  } catch (error) {
    console.error('❌ Debug script failed:', error);
  } finally {
    await database.disconnect();
    console.log('\n🔚 Database disconnected');
    process.exit(0);
  }
}

// Run the debug
debugUser();
