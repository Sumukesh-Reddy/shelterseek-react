const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: { type: String },
    participants: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        required: true 
    }],
    participantModels: [{
        type: String,
        enum: ['Traveler', 'Host']
    }],
    isGroup: { type: Boolean, default: false },
    groupPhoto: { type: String },
    groupAdmin: { 
        type: mongoose.Schema.Types.ObjectId
    },
    groupAdminModel: {
        type: String,
        enum: ['Traveler', 'Host']
    },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ChatRoom', roomSchema);