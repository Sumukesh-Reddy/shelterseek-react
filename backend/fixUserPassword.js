// Script to fix double-hashed passwords for existing users
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Traveler, Host } = require('./model/usermodel');

async function fixUserPassword(email, newPassword) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/yourdb');
    console.log('✅ Connected to MongoDB');

    // Find user in both collections
    let user = await Traveler.findOne({ email });
    let userType = 'Traveler';
    
    if (!user) {
      user = await Host.findOne({ email });
      userType = 'Host';
    }

    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      return;
    }

    console.log(`🔍 Found user: ${user.name} (${user.email}) in ${userType} collection`);
    console.log(`📊 Current password hash length: ${user.password ? user.password.length : 'No password'}`);

    // Update password (the pre('save') hook will hash it properly)
    user.password = newPassword;
    await user.save();

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
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node fixUserPassword.js <email> <new-password>');
  console.log('Example: node fixUserPassword.js sumukeshreddy1@gmail.com mynewpassword123');
  process.exit(1);
}

fixUserPassword(email, password);

