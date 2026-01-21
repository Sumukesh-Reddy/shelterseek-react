const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { 
    type: mongoose.Schema.Types.ObjectId,
    required: true 
  },
  senderModel: {
    type: String,
    enum: ['Traveler', 'Host'],
    required: true
  },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  mediaUrl: { type: String },
  read: { type: Boolean, default: false },
  readAt: { type: Date },
  roomId: { type: String, required: true },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", messageSchema);