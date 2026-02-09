const express = require("express");
const Message = require("../model/Message");
const { logRouteError, logDatabaseError } = require("../utils/errorLogger");

const router = express.Router();

router.get("/:roomId", async (req, res) => {
  try {
    const roomId = req.params.roomId;
    
    if (!roomId) {
      return res.status(400).json({ 
        success: false,
        message: "Room ID is required" 
      });
    }

    let msgs;
    try {
      msgs = await Message.find({ roomId })
        .populate("sender", "name avatar")
        .sort({ createdAt: 1 })
        .limit(100);
    } catch (dbError) {
      logDatabaseError(dbError, {
        operation: 'find messages',
        collection: 'Message',
        roomId,
        userId: req.user?._id
      });
      throw dbError;
    }

    res.json(msgs);
  } catch (err) {
    logRouteError(err, req);
    res.status(500).json({ 
      success: false,
      message: "Could not load messages",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;