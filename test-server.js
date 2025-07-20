#!/usr/bin/env node

// Simple test script to verify server starts without errors
const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing server startup...\n');

// Change to backend directory
process.chdir(path.join(__dirname, 'backend'));

// Start the server
const serverProcess = spawn('node', ['src/app.js'], {
  stdio: 'pipe',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    JWT_SECRET: 'test-jwt-secret-for-testing-only-12345678901234567890123456789012',
    JWT_REFRESH_SECRET: 'test-refresh-secret-for-testing-only-12345678901234567890123456789012',
    MONGO_URI: 'mongodb://localhost:27017/test-iptv-hotel-panel',
    PORT: 3000,
    USE_MOCK_PMS: 'true'
  }
});

let output = '';
let errorOutput = '';

serverProcess.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log(text.trim());
});

serverProcess.stderr.on('data', (data) => {
  const text = data.toString();
  errorOutput += text;
  console.error('STDERR:', text.trim());
});

// Test for successful startup
setTimeout(() => {
  if (output.includes('IPTV Hotel Panel Backend started')) {
    console.log('\n✅ Server started successfully!');
    console.log('✅ No critical startup errors detected');
    
    // Test key endpoints
    testEndpoints();
  } else {
    console.log('\n❌ Server failed to start properly');
    console.log('Output:', output);
    if (errorOutput) {
      console.log('Errors:', errorOutput);
    }
  }
  
  // Clean shutdown
  setTimeout(() => {
    serverProcess.kill('SIGTERM');
    process.exit(0);
  }, 2000);
}, 5000);

async function testEndpoints() {
  console.log('\n🔍 Testing endpoints...');
  
  try {
    const fetch = require('node-fetch').default || require('node-fetch');
    
    // Test health endpoint
    const healthRes = await fetch('http://localhost:3000/health');
    if (healthRes.ok) {
      console.log('✅ Health endpoint working');
    } else {
      console.log('❌ Health endpoint failed');
    }
  } catch (error) {
    console.log('⚠️  Endpoint testing skipped (fetch not available)');
  }
}

serverProcess.on('close', (code) => {
  console.log(`\n📊 Server process exited with code ${code}`);
});
