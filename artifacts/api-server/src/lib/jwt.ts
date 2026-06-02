import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.SESSION_SECRET ?? "fallback_access_secret";
const REFRESH_SECRET = (process.env.SESSION_SECRET ?? "fallback_refresh_secret") + "_refresh";

const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY = "7d";

export interface TokenPayload {
  userId: number;
  email: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload;
}

export const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
