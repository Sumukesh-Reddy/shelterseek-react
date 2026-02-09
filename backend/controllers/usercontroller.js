const { Traveler, Host } = require('../model/usermodel');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const fs = require('fs');
const { logControllerError, logDatabaseError } = require('../utils/errorLogger');

exports.signUp = async (req, res) => {
  let uploadedFilePath = null;
  
  try {
    const { name, email, password, accountType } = req.body;
    
    if (req.file) {
      uploadedFilePath = req.file.path;
    }

    // Validate account type
    if (!['traveller', 'host'].includes(accountType)) {
      const error = new Error("Invalid account type. Must be 'traveller' or 'host'");
      logControllerError(error, {
        file: 'usercontroller.js',
        function: 'signUp',
        accountType,
        email
      });
      return res.status(400).json({
        status: "fail",
        message: error.message
      });
    }

    const Model = accountType === 'traveller' ? Traveler : Host;
    
    // Check if user exists
    let existingUser;
    try {
      existingUser = await Model.findOne({ email });
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'findOne',
        collection: accountType === 'traveller' ? 'Traveler' : 'Host',
        email
      });
      throw dbError;
    }
    
    if (existingUser) {
      const error = new Error("Email already in use");
      logControllerError(error, {
        file: 'usercontroller.js',
        function: 'signUp',
        email,
        accountType
      });
      return res.status(400).json({
        status: "fail",
        message: error.message
      });
    }

    // Handle profile photo upload
    let profilePhotoId = null;
    if (req.file) {
      try {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
          bucketName: 'images'
        });
        const uploadStream = bucket.openUploadStream(req.file.originalname, {
          contentType: req.file.mimetype
        });
        
        await new Promise((resolve, reject) => {
          fs.createReadStream(req.file.path)
            .pipe(uploadStream)
            .on('error', reject)
            .on('finish', () => {
              profilePhotoId = uploadStream.id.toString();
              fs.unlinkSync(req.file.path);
              uploadedFilePath = null; // File cleaned up successfully
              resolve();
            });
        });
      } catch (uploadError) {
        logControllerError(uploadError, {
          file: 'usercontroller.js',
          function: 'signUp - file upload',
          email,
          fileName: req.file.originalname
        });
        throw new Error('Failed to upload profile photo');
      }
    }

    // Create user
    let newUser;
    try {
      newUser = await Model.create({
        name,
        email,
        password,
        accountType,
        profilePhoto: profilePhotoId
      });
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'create',
        collection: accountType === 'traveller' ? 'Traveler' : 'Host',
        email
      });
      throw dbError;
    }

    // Remove password from output
    newUser.password = undefined;

    res.status(201).json({
      status: "success",
      data: {
        user: {
          name: newUser.name,
          email: newUser.email,
          accountType: newUser.accountType,
          profilePhoto: profilePhotoId ? `/api/images/${profilePhotoId}` : null
        }
      }
    });
  } catch (err) {
    // Cleanup uploaded file on error
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (unlinkError) {
        logControllerError(unlinkError, {
          file: 'usercontroller.js',
          function: 'signUp - cleanup',
          filePath: uploadedFilePath
        });
      }
    }
    
    logControllerError(err, {
      file: 'usercontroller.js',
      function: 'signUp',
      email: req.body?.email,
      accountType: req.body?.accountType
    });
    
    res.status(400).json({
      status: "fail",
      message: err.message || 'Failed to create user'
    });
  }
};

exports.fetchUserByEmailPassword = async (req, res) => {
  try {
    const { email, password, accountType } = req.body;
    
    // Validate input
    if (!email || !password) {
      const error = new Error("Please provide email and password");
      logControllerError(error, {
        file: 'usercontroller.js',
        function: 'fetchUserByEmailPassword',
        email,
        missingField: !email ? 'email' : 'password'
      });
      return res.status(400).json({
        status: "fail",
        message: error.message
      });
    }

    // Validate account type
    if (!['traveller', 'host'].includes(accountType)) {
      const error = new Error("Invalid account type. Must be 'traveller' or 'host'");
      logControllerError(error, {
        file: 'usercontroller.js',
        function: 'fetchUserByEmailPassword',
        email,
        accountType
      });
      return res.status(400).json({
        status: "fail",
        message: error.message
      });
    }

    const Model = accountType === 'traveller' ? Traveler : Host;
    let user;
    
    try {
      user = await Model.findOne({ email }).select('+password');
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'findOne',
        collection: accountType === 'traveller' ? 'Traveler' : 'Host',
        email
      });
      throw dbError;
    }

    // Check user exists and password matches
    if (!user) {
      logControllerError(new Error('User not found'), {
        file: 'usercontroller.js',
        function: 'fetchUserByEmailPassword',
        email,
        accountType,
        reason: 'user_not_found'
      });
      return res.status(401).json({
        status: "fail",
        message: "Incorrect email or password"
      });
    }
    
    const isPasswordCorrect = await user.correctPassword(password);
    if (!isPasswordCorrect) {
      logControllerError(new Error('Incorrect password'), {
        file: 'usercontroller.js',
        function: 'fetchUserByEmailPassword',
        email,
        accountType,
        userId: user._id,
        reason: 'incorrect_password'
      });
      return res.status(401).json({
        status: "fail",
        message: "Incorrect email or password"
      });
    }

    // Remove password from output
    user.password = undefined;

    res.status(200).json({
      status: "success",
      data: {
        user: {
          name: user.name,
          email: user.email,
          accountType: user.accountType,
          profilePhoto: user.profilePhoto ? `/api/images/${user.profilePhoto}` : null
        }
      }
    });
  } catch (err) {
    logControllerError(err, {
      file: 'usercontroller.js',
      function: 'fetchUserByEmailPassword',
      email: req.body?.email,
      accountType: req.body?.accountType
    });
    
    res.status(400).json({
      status: "fail",
      message: err.message || 'Login failed'
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    let travelers, hosts;
    
    try {
      travelers = await Traveler.find().select('-password');
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'find',
        collection: 'Traveler'
      });
      throw dbError;
    }
    
    try {
      hosts = await Host.find().select('-password');
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'find',
        collection: 'Host'
      });
      throw dbError;
    }
    
    // Add profile photo URLs
    const processedTravelers = travelers.map(traveler => ({
      ...traveler._doc,
      profilePhoto: traveler.profilePhoto ? `/api/images/${traveler.profilePhoto}` : null
    }));
    
    const processedHosts = hosts.map(host => ({
      ...host._doc,
      profilePhoto: host.profilePhoto ? `/api/images/${host.profilePhoto}` : null
    }));
    
    res.status(200).json({
      status: "success",
      results: travelers.length + hosts.length,
      data: {
        travelers: processedTravelers,
        hosts: processedHosts
      }
    });
  } catch (err) {
    logControllerError(err, {
      file: 'usercontroller.js',
      function: 'getUsers',
      userId: req.user?._id,
      userEmail: req.user?.email
    });
    
    res.status(400).json({
      status: "fail",
      message: "Error fetching users",
      error: err.message
    });
  }
};