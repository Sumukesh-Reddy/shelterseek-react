// utils/errorLogger.js
const rfs = require('rotating-file-stream');
const path = require('path');
const mkdirp = require('mkdirp');

// Create logs directory
const logDirectory = path.join(__dirname, '..', 'logs');
mkdirp.sync(logDirectory);

// Create error log stream
const errorLogStream = rfs.createStream('error.log', {
  interval: '1d',
  path: logDirectory,
  size: '10M',
  compress: 'gzip'
});

/**
 * Log error to file with comprehensive details
 * @param {Object} errorDetails - Error details object
 */
function logError(errorDetails) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    ...errorDetails
  };
  
  errorLogStream.write(JSON.stringify(errorLog) + '\n');
  
  // Also log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('🚨 Error:', errorLog);
  }
}

/**
 * Log controller/service errors
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function logControllerError(error, context = {}) {
  logError({
    type: 'CONTROLLER_ERROR',
    file: context.file || 'unknown',
    function: context.function || 'unknown',
    userId: context.userId || 'anonymous',
    userEmail: context.userEmail || '',
    message: error.message,
    stack: error.stack,
    ...context
  });
}

/**
 * Log route errors
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 */
function logRouteError(error, req) {
  logError({
    type: 'ROUTE_ERROR',
    method: req.method,
    url: req.originalUrl,
    userId: req.user?._id || 'anonymous',
    userEmail: req.user?.email || '',
    userRole: req.user?.accountType || 'unauthenticated',
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    message: error.message,
    stack: error.stack
  });
}

/**
 * Log database errors
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function logDatabaseError(error, context = {}) {
  logError({
    type: 'DATABASE_ERROR',
    operation: context.operation || 'unknown',
    collection: context.collection || 'unknown',
    message: error.message,
    stack: error.stack,
    ...context
  });
}

/**
 * Log authentication errors
 * @param {String} message - Error message
 * @param {Object} context - Additional context
 */
function logAuthError(message, context = {}) {
  logError({
    type: 'AUTH_ERROR',
    message,
    ...context
  });
}

module.exports = {
  logError,
  logControllerError,
  logRouteError,
  logDatabaseError,
  logAuthError,
  errorLogStream
};