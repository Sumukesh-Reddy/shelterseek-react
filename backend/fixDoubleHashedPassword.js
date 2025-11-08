// Script to fix double-hashed passwords for existing users
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Traveler, Host } = require('./model/usermodel');

async function fixDoubleHashedPassword(email, newPassword) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb');
    console.log('✅ Connected to MongoDB');

    // Find user in both collections
    let user = await Traveler.findOne({ email }).select('+password');
    let userType = 'Traveler';
    
    if (!user) {
      user = await Host.findOne({ email }).select('+password');
      userType = 'Host';
    }

    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      return;
    }

    console.log(`🔍 Found user: ${user.name} (${user.email}) in ${userType} collection`);
    console.log(`📊 Current password hash length: ${user.password ? user.password.length : 'No password'}`);

    // Temporarily disable the pre('save') hook to avoid double hashing
    const originalPreSave = user.constructor.schema.pre;
    user.constructor.schema.pre = function() { return this; };

    // Update password with the new password (will be hashed once by bcrypt)
    user.password = newPassword;
    await user.save();

    // Restore the pre('save') hook
    user.constructor.schema.pre = originalPreSave;

    console.log(`✅ Password updated for ${email}`);
    console.log(`📊 New password hash length: ${user.password ? user.password.length : 'No password'}`);

    // Test the new password
    const isValid = await bcrypt.compare(newPassword, user.password);
    console.log(`🧪 Password test result: ${isValid ? '✅ Valid' : '❌ Invalid'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Get command line arguments
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log('Usage: node fixDoubleHashedPassword.js <email> <newPassword>');
  console.log('Example: node fixDoubleHashedPassword.js sumukeshmopuram1@gmail.com mynewpassword');
  process.exit(1);
}

fixDoubleHashedPassword(email, newPassword);




