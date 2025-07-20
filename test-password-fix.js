// Test script to verify password hashing fix
const bcrypt = require('bcryptjs');

// Simulate the helper function
const isBcryptHash = (str) => {
  return /^\$2[abxy]?\$\d+\$/.test(str);
};

// Simulate the setPassword method
const setPassword = async (password) => {
  console.log(`\n=== Testing setPassword with: "${password}" ===`);
  
  // Don't hash if password is already a bcrypt hash
  if (isBcryptHash(password)) {
    console.log('✓ Detected already hashed password, skipping hash');
    return password;
  }
  
  console.log('✓ Plain text password detected, hashing...');
  const salt = await bcrypt.genSalt(12);
  const hashed = await bcrypt.hash(password, salt);
  console.log(`✓ Hashed: ${hashed.substring(0, 20)}...`);
  return hashed;
};

// Test comparePassword
const testComparePassword = async (plaintext, hash) => {
  console.log(`\n=== Testing comparePassword ===`);
  console.log(`Plain text: "${plaintext}"`);
  console.log(`Hash: ${hash.substring(0, 30)}...`);
  
  const isValid = await bcrypt.compare(plaintext, hash);
  console.log(`✓ Password match: ${isValid}`);
  return isValid;
};

// Run tests
async function runTests() {
  console.log('🔧 Testing Password Hashing Fix\n');
  
  // Test 1: Plain text password
  const plainPassword = 'testPassword123';
  const hashedOnce = await setPassword(plainPassword);
  
  // Test 2: Already hashed password (should not double-hash)
  const notDoubleHashed = await setPassword(hashedOnce);
  
  console.log(`\n=== Comparison Results ===`);
  console.log(`Original hash: ${hashedOnce.substring(0, 30)}...`);
  console.log(`After "rehashing": ${notDoubleHashed.substring(0, 30)}...`);
  console.log(`Are they the same? ${hashedOnce === notDoubleHashed ? '✓ YES' : '✗ NO'}`);
  
  // Test 3: Verify password comparison still works
  const isValidOriginal = await testComparePassword(plainPassword, hashedOnce);
  const isValidNotDouble = await testComparePassword(plainPassword, notDoubleHashed);
  
  console.log(`\n=== Final Results ===`);
  console.log(`✓ Plain password hashes correctly: ${isValidOriginal}`);
  console.log(`✓ Already-hashed password not double-hashed: ${hashedOnce === notDoubleHashed}`);
  console.log(`✓ Password comparison still works: ${isValidNotDouble}`);
  
  if (isValidOriginal && isValidNotDouble && hashedOnce === notDoubleHashed) {
    console.log('\n🎉 All tests passed! The fix should resolve the login issue.');
  } else {
    console.log('\n❌ Some tests failed. Please review the implementation.');
  }
}

runTests().catch(console.error);
