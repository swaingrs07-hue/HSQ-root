import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("FATAL: JWT_SECRET or SESSION_SECRET must be set in production environment");
  }
  
  return secret || "hsquareliving-dev-secret-key-for-development-only";
}

const JWT_SECRET = getJWTSecret();
const JWT_EXPIRES_IN = "7d";

export type UserRole = "user" | "admin" | "manager" | "staff" | "sales_executive";

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

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied. Insufficient permissions." });
    }

    next();
  };
}

export function getRoleRedirectPath(role: UserRole): string {
  switch (role) {
    case "admin":
    case "receptionist":
      return "/admin";
    case "manager":
    case "staff":
      return "/operations";
    case "user":
    default:
      return "/dashboard";
  }
}
