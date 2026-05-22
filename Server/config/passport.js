import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import User from "../models/User.js";

const getGoogleCredentials = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientID || !clientSecret) {
    return null;
  }

  return { clientID, clientSecret };
};

const getCallbackURL = () => {
  return (
    process.env.GOOGLE_CALLBACK_URL?.trim() ||
    "http://localhost:5000/api/v1/users/google/callback"
  );
};

export const configurePassport = () => {
  const credentials = getGoogleCredentials();

  if (!credentials) {
    return false;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: credentials.clientID,
        clientSecret: credentials.clientSecret,
        callbackURL: getCallbackURL(),
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value?.toLowerCase();

          if (!googleId || !email) {
            return done(new Error("Google account did not return required profile data."));
          }

          let user = await User.findOne({ googleId });

          if (!user) {
            user = await User.findOne({ email });
          }

          if (user?.hasRole("admin")) {
            return done(new Error("Please use the admin sign-in page."));
          }

          const avatarUrl = profile.photos?.[0]?.value || "";

          if (user) {
            user.googleId = user.googleId || googleId;
            user.isGoogleUser = true;
            user.isVerified = true;
            user.lastLogin = new Date();

            if (!user.avatar?.url && avatarUrl) {
              user.avatar = { url: avatarUrl, publicId: "" };
            }

            await user.save({ validateBeforeSave: false });
            return done(null, user);
          }

          const createdUser = await User.create({
            name: profile.displayName || email.split("@")[0],
            email,
            googleId,
            isGoogleUser: true,
            isVerified: true,
            avatar: { url: avatarUrl, publicId: "" },
            lastLogin: new Date(),
          });

          return done(null, createdUser);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  return true;
};

export default passport;
