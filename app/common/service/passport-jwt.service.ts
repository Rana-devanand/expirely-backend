import bcrypt from "bcryptjs";
import createError from "http-errors";
import jwt from "jsonwebtoken";
import passport from "passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Strategy as LocalStrategy } from "passport-local";
import { supabaseAdmin } from "./supabase.admin";
import crypto from "node:crypto";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return secret;
};

export const isValidPassword = async function (
  value: string,
  password: string,
) {
  const compare = await bcrypt.compare(value, password);
  return compare;
};

export const getUserByEmail = async (email: string) => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, username, email, avatar_url, password, role, auth_provider, status, is_verified, created_at, updated_at",
    )
    .eq("email", email)
    .single();
  if (error) return null;
  return data;
};

export const getUserById = async (id: string) => {
  const { data } = await supabaseAdmin
    .from("users")
    .select(
      "id, username, email, avatar_url, role, auth_provider, created_at, updated_at",
    )
    .eq("id", id)
    .single();
  return data;
};

export const initPassport = () => {
  // JWT Strategy for protected routes
  passport.use(
    new Strategy(
      {
        secretOrKey: getJwtSecret(),
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      },
      async (payload: any, done) => {
        try {
          done(null, payload);
        } catch (error) {
          done(error);
        }
      },
    ),
  );

  // Local Strategy for login
  passport.use(
    "login",
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          console.log("Login attempt for email:", email);
          const user = await getUserByEmail(email);

          if (!user) {
            console.log("User not found for email:", email);
            return done(createError(401, "Invalid email or password"), false);
          }

          if (user.status === "blocked") {
            console.log("User account is blocked:", email);
            return done(
              createError(
                403,
                "Your account has been blocked. Please contact support.",
              ),
              false,
            );
          }

          console.log("User found:", {
            id: user.id,
            email: user.email,
            hasPassword: !!user.password,
          });

          if (!user.password) {
            console.log("User has no password set");
            return done(createError(401, "Invalid email or password"), false);
          }

          const isMatch = await isValidPassword(password, user.password);
          console.log("Password match result:", isMatch);

          if (!isMatch)
            return done(createError(401, "Invalid email or password"), false);

          const { password: _, ...userWithoutPassword } = user;

          return done(null, userWithoutPassword);
        } catch (err: any) {
          console.error("Login error:", err);
          return done(createError(500, err.message));
        }
      },
    ),
  );
};

export const createUserTokens = (user: any, sessionId = crypto.randomUUID()) => {
  const jwtSecret = getJwtSecret();

  // Create payload for JWT
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    sid: sessionId,
    type: "access",
  };

  const accessToken = jwt.sign(payload, jwtSecret, {
    expiresIn: (process.env.ACCESS_TOKEN_EXPIRY || "15m") as jwt.SignOptions["expiresIn"],
    issuer: "expirely-api",
    audience: "expirely-mobile",
    jwtid: crypto.randomUUID(),
  });

  const refreshToken = jwt.sign({ id: user.id, sub: user.id, sid: sessionId, type: "refresh" }, jwtSecret, {
    expiresIn: (process.env.REFRESH_TOKEN_EXPIRY || "30d") as jwt.SignOptions["expiresIn"],
    issuer: "expirely-api",
    audience: "expirely-mobile",
    jwtid: crypto.randomUUID(),
  });

  // Ensure sensitive data is removed
  const {
    password: _,
    access_token: __,
    refresh_token: ___,
    ...safeUser
  } = user;

  return {
    user: safeUser,
    accessToken,
    refreshToken,
    sessionId,
  };
};

export const decodeToken = (token: string) => {
  const decode = jwt.decode(token) as any;
  if (!decode || !decode.exp) return { expired: true };
  const expired = decode.exp * 1000 < Date.now();
  return { ...decode, expired };
};

export const verifyToken = (token: string) => {
  const decode = jwt.verify(token, getJwtSecret(), {
    issuer: "expirely-api",
    audience: "expirely-mobile",
  });
  return decode;
};

export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const tokenFingerprint = (token: string) => hashToken(token).slice(0, 12);
