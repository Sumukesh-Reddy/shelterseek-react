// Script to check and fix user data in MongoDB
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Traveler, Host } = require('./model/usermodel');

async function checkUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb');
    console.log('✅ Connected to MongoDB');

    // Check Travelers
    console.log('\n📊 TRAVELERS:');
    const travelers = await Traveler.find({}).select('+password');
    console.log(`Found ${travelers.length} travelers:`);
    
    for (const traveler of travelers) {
      console.log(`- ${traveler.email} (${traveler.name}) - Account: ${traveler.accountType}`);
      console.log(`  Password hash length: ${traveler.password ? traveler.password.length : 'No password'}`);
    }

    // Check Hosts
    console.log('\n📊 HOSTS:');
    const hosts = await Host.find({}).select('+password');
    console.log(`Found ${hosts.length} hosts:`);
    
    for (const host of hosts) {
      console.log(`- ${host.email} (${host.name}) - Account: ${host.accountType}`);
      console.log(`  Password hash length: ${host.password ? host.password.length : 'No password'}`);
    }

    // Test password for a specific user (uncomment and modify as needed)
    /*
    const testEmail = 'your-email@example.com';
    const testPassword = 'your-password';
    
    let testUser = await Traveler.findOne({ email: testEmail }).select('+password');
    if (!testUser) {
      testUser = await Host.findOne({ email: testEmail }).select('+password');
    }
    
    if (testUser) {
      console.log(`\n🧪 Testing password for ${testEmail}:`);
      const isValid = await bcrypt.compare(testPassword, testUser.password);
      console.log(`Password valid: ${isValid}`);
    } else {
      console.log(`\n❌ User ${testEmail} not found`);
    }
    */

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

checkUsers();

