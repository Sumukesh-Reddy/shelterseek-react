// model/Image.js 
//97
const mongoose = require('mongoose');
const { Schema } = mongoose;

const imageSchema = new Schema({
  filename: String,
  contentType: String,
  length: Number,
  uploadDate: {
    type: Date,
    default: Date.now
  }
});

// Create a model for GridFS
const Image = mongoose.model('Image', imageSchema);

module.exports = Image;