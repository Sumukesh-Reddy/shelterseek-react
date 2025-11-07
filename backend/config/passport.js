// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { Traveler, Host } = require('../model/usermodel');

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
          
          const email = profile.emails[0].value;
          const name = profile.displayName;

          // Check for existing user by googleId or email
          let user = await Traveler.findOne({ 
            $or: [
              { googleId: profile.id },
              { email: email }
            ]
          });

          if (!user) {
            user = await Host.findOne({ 
              $or: [
                { googleId: profile.id },
                { email: email }
              ]
            });
          }

          if (!user) {
            // Create new traveler for Google login
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
          } else {
            // Update googleId if not set
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
            }
            console.log('Existing Google user found:', user.email);
          }

          return done(null, user);
        } catch (err) {
          console.error('Google Strategy error:', err);
          return done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, { 
      id: user.id, 
      type: user.accountType === 'host' ? 'Host' : 'Traveler' 
    });
  });

  passport.deserializeUser(async (data, done) => {
    try {
      const { Traveler, Host } = require('../model/usermodel');
      let user;
      
      if (data.type === 'Host') {
        user = await Host.findById(data.id);
      } else {
        user = await Traveler.findById(data.id);
      }
      
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};