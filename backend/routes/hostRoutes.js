// backend/routes/hostRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const hostController = require('../controllers/hostController');
const { logError, logRouteError } = require('../utils/errorLogger');

const upload = multer({ dest: 'public/uploads/' });

const multerErrorHandler = (err, req, res, next) => {
  if (!err) return next();
  
  if (err instanceof multer.MulterError || (err && err.code)) {
    let message = err.message || 'File upload error';
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded. Maximum 12 allowed.';
    }
    else if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large.';
    }
    else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field.';
    }
    
    // Log multer errors
    logError({
      type: 'MULTER_ERROR',
      file: 'hostRoutes.js',
      method: req.method,
      endpoint: req.originalUrl,
      ip: req.ip || 'unknown',
      userId: req.user?._id,
      userEmail: req.user?.email,
      errorCode: err.code,
      message: message
    });
    
    return res.status(400).json({ success: false, message });
  }
  
  next(err);
};

// Wrap routes with try-catch
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    logRouteError(error, req);
    next(error);
  });
};

// Routes with error handling
router.post('/listings', upload.array('images', 12), multerErrorHandler, asyncHandler(hostController.createListing));
router.put('/listings/:id', upload.array('images', 12), multerErrorHandler, asyncHandler(hostController.updateListing));
router.get('/listings/:id', asyncHandler(hostController.getListingById));
router.get('/images/:id', asyncHandler(hostController.getImage));
router.get('/listings', asyncHandler(hostController.getListings));
router.patch('/listings/:listingId/status', asyncHandler(hostController.updateListingStatus));
router.delete('/listings/:id', asyncHandler(hostController.deleteListing));

// Global error handler for this router
router.use((err, req, res, next) => {
  logRouteError(err, req);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

module.exports = router;