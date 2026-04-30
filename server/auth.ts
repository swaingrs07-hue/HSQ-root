import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;

  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    // CRITICAL: do NOT throw at module load — that crashes the autoscale
    // boot before httpServer.listen() ever runs, causing the load
    // balancer to serve the generic "Server Error" page with no logs.
    // Generate an ephemeral random secret so the server still boots and
    // can serve traffic. Existing JWTs become invalid (users get logged
    // out on cold start) but the site stays UP. The loud warning makes
    // the misconfiguration visible in deployment logs.
    const fallback = crypto.randomBytes(32).toString("hex");
    console.error(
      "WARNING: JWT_SECRET / SESSION_SECRET is not set in production. " +
        "Using an ephemeral in-memory secret. Existing user tokens will be " +
        "invalidated on every cold start. Set one of these secrets in the " +
        "deployment environment to restore stable session handling."
    );
    return fallback;
  }

  return "hsquareliving-dev-secret-key-for-development-only";
}

const JWT_SECRET = getJWTSecret();
const JWT_EXPIRES_IN = "7d";

export type UserRole = "user" | "admin" | "superadmin" | "manager" | "staff" | "sales_executive" | "receptionist";

export interface JWTPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  req.user = payload;
  next();
}

export function roleMiddleware(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const effectiveRoles = new Set(allowedRoles);
    if (effectiveRoles.has("admin")) {
      effectiveRoles.add("superadmin");
    }

    if (!effectiveRoles.has(req.user.role)) {
      return res.status(403).json({ error: "Access denied. Insufficient permissions." });
    }

    next();
  };
}

export function getRoleRedirectPath(role: UserRole): string {
  switch (role) {
    case "superadmin":
    case "admin":
    case "receptionist":
      return "/admin";
    case "manager":
    case "staff":
      return "/operations";
    case "sales_executive":
      return "/sales";
    case "user":
    default:
      return "/dashboard";
  }
}
