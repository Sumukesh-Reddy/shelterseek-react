const { Traveler, Host } = require('../model/usermodel');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const fs = require('fs');

exports.signUp = async (req, res) => {
  try {
    const { name, email, password, accountType } = req.body;

    // Validate account type
    if (!['traveller', 'host'].includes(accountType)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid account type. Must be 'traveller' or 'host'"
      });
    }

    const Model = accountType === 'traveller' ? Traveler : Host;
    
    // Check if user exists
    const existingUser = await Model.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: "fail",
        message: "Email already in use"
      });
    }

    

    // Handle profile photo upload
    let profilePhotoId = null;
    if (req.file) {
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
            resolve();
          });
      });
    }

    // Create user
    const newUser = await Model.create({
      name,
      email,
      password,
      accountType,
      profilePhoto: profilePhotoId
    });

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
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(400).json({
      status: "fail",
      message: err.message
    });
  }
};

exports.fetchUserByEmailPassword = async (req, res) => {
  try {
    const { email, password, accountType } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide email and password"
      });
    }

    // Validate account type
    if (!['traveller', 'host'].includes(accountType)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid account type. Must be 'traveller' or 'host'"
      });
    }

    const Model = accountType === 'traveller' ? Traveler : Host;
    const user = await Model.findOne({ email }).select('+password');

    // Check user exists and password matches
    if (!user || !(await user.correctPassword(password))) {
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
    res.status(400).json({
      status: "fail",
      message: err.message
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const travelers = await Traveler.find().select('-password');
    const hosts = await Host.find().select('-password');
    
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
    res.status(400).json({
      status: "fail",
      message: "Error fetching users",
      error: err.message
    });
  }
};