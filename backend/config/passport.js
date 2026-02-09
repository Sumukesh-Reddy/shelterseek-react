// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Traveler, Host } = require('../model/usermodel');
const { logAuthError, logDatabaseError } = require('../utils/errorLogger');

module.exports = function(passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          console.log('Google profile:', profile);
          
          if (!profile.emails || !profile.emails[0]) {
            const error = new Error('No email provided by Google');
            logAuthError(error.message, {
              file: 'passport.js',
              googleId: profile.id,
              profileName: profile.displayName
            });
            return done(error, null);
          }
          
          const email = profile.emails[0].value;
          const name = profile.displayName;

          // Check for existing user by googleId or email
          let user;
          try {
            user = await Traveler.findOne({ 
              $or: [
                { googleId: profile.id },
                { email: email }
              ]
            });
          } catch (dbError) {
            logDatabaseError(dbError, {
              operation: 'findOne',
              collection: 'Traveler',
              email,
              googleId: profile.id
            });
          }

          if (!user) {
            try {
              user = await Host.findOne({ 
                $or: [
                  { googleId: profile.id },
                  { email: email }
                ]
              });
            } catch (dbError) {
              logDatabaseError(dbError, {
                operation: 'findOne',
                collection: 'Host',
                email,
                googleId: profile.id
              });
            }
          }

          if (!user) {
            // Create new traveler for Google login
            try {
              user = await Traveler.create({
                googleId: profile.id,
                name: name,
                email: email,
                password: null,
                accountType: 'traveller',
                isVerified: true,
                profilePhoto: profile.photos?.[0]?.value
              });
              console.log('New Google user created:', user.email);
            } catch (dbError) {
              logDatabaseError(dbError, {
                operation: 'create',
                collection: 'Traveler',
                email,
                googleId: profile.id
              });
              return done(dbError, null);
            }
          } else {
            // Update googleId if not set
            if (!user.googleId) {
              try {
                user.googleId = profile.id;
                await user.save();
              } catch (dbError) {
                logDatabaseError(dbError, {
                  operation: 'update googleId',
                  collection: user.accountType === 'host' ? 'Host' : 'Traveler',
                  email,
                  googleId: profile.id
                });
                // Continue even if update fails
              }
            }
            console.log('Existing Google user found:', user.email);
          }

          return done(null, user);
        } catch (err) {
          logAuthError('Google Strategy error', {
            file: 'passport.js',
            error: err.message,
            stack: err.stack,
            googleId: profile?.id
          });
          return done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    try {
      done(null, { 
        id: user.id, 
        type: user.accountType === 'host' ? 'Host' : 'Traveler' 
      });
    } catch (err) {
      logAuthError('Serialize user error', {
        file: 'passport.js',
        userId: user?.id,
        error: err.message
      });
      done(err, null);
    }
  });

  passport.deserializeUser(async (data, done) => {
    try {
      const { Traveler, Host } = require('../model/usermodel');
      let user;
      
      try {
        if (data.type === 'Host') {
          user = await Host.findById(data.id);
        } else {
          user = await Traveler.findById(data.id);
        }
      } catch (dbError) {
        logDatabaseError(dbError, {
          operation: 'findById',
          collection: data.type,
          userId: data.id
        });
        return done(dbError, null);
      }
      
      if (!user) {
        const error = new Error('User not found during deserialization');
        logAuthError(error.message, {
          file: 'passport.js',
          userId: data.id,
          userType: data.type
        });
        return done(error, null);
      }
      
      done(null, user);
    } catch (err) {
      logAuthError('Deserialize user error', {
        file: 'passport.js',
        userId: data?.id,
        userType: data?.type,
        error: err.message
      });
      done(err, null);
    }
  });
};