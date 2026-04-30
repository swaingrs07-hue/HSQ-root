import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import path from "path";
import { storage } from "./storage";
import { db } from "./db";
import * as schema from "@shared/schema";
import { insertStudentSchema, signupSchema, loginSchema, manualLeadSchema, dealClosureSchema, insertLeadRemarkSchema, insertHeroSlideSchema, insertFloorSchema, insertRoomSchema, insertBedSchema } from "@shared/schema";
import { z } from "zod";
import { eq, and, inArray, sql, isNull, or, desc } from "drizzle-orm";
import { hashPassword, comparePassword, generateToken, verifyToken, authMiddleware, roleMiddleware, getRoleRedirectPath, type AuthRequest } from "./auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { buildPropertyHeroFallback } from "./hero-slides";
import { logActivity, formatActivityMessage, type ActionType, type EntityType } from "./activityLogger";
import { recordHmsHit, getRecentHits, getLastHitForRoute, getStats as getHmsLogStats, getRecentHitsFromDb, getLastHitsByRoute, getDbStats as getHmsDbStats } from "./hms-activity-log";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { initChatContext, streamChatResponse, extractLeadInfo, createLeadFromChat, type ChatMessage } from "./chatbot";
import { searchProperties, getSuggestedFilters } from "./nlp-search";
import { sendParentBookingConfirmationEmail, sendPaymentReceivedEmail, sendWelcomeEmail, sendWelcomeEmailForBooking } from "./email-service";
import { generateBookingReceiptPdf } from "./receipt-pdf";
import * as chatbotAdmin from "./chatbot-admin";
import { getLeadRecommendations } from "./lead-recommendations";
import { checkAndSendMilestone } from "./milestone-service";
import { resolveCanonicalApex } from "./canonical-host";

const BED_HOLD_DURATION = 15 * 60 * 1000; // 15 minutes

async function holdBed(bedId: string, sessionId: string): Promise<boolean> {
  await cleanExpiredHolds();
  const existing = await db.select().from(schema.bedHolds).where(
    and(eq(schema.bedHolds.bedId, bedId), sql`${schema.bedHolds.expiresAt} > NOW()`)
  );
  if (existing.length > 0 && existing[0].sessionId !== sessionId) return false;
  if (existing.length > 0 && existing[0].sessionId === sessionId) {
    await db.update(schema.bedHolds).set({ expiresAt: new Date(Date.now() + BED_HOLD_DURATION) }).where(eq(schema.bedHolds.id, existing[0].id));
    return true;
  }
  await db.insert(schema.bedHolds).values({ bedId, sessionId, expiresAt: new Date(Date.now() + BED_HOLD_DURATION) });
  return true;
}

async function releaseBed(bedId: string, sessionId: string): Promise<void> {
  await db.delete(schema.bedHolds).where(
    and(eq(schema.bedHolds.bedId, bedId), eq(schema.bedHolds.sessionId, sessionId))
  );
}

async function isBedHeld(bedId: string): Promise<{ held: boolean; heldBy?: string }> {
  const existing = await db.select().from(schema.bedHolds).where(
    and(eq(schema.bedHolds.bedId, bedId), sql`${schema.bedHolds.expiresAt} > NOW()`)
  );
  if (existing.length === 0) return { held: false };
  return { held: true, heldBy: existing[0].sessionId };
}

function normalizeGender(value: unknown): "male" | "female" | "other" | "" {
  if (typeof value !== "string") return "";
  const v = value.trim().toLowerCase();
  if (v === "m" || v === "male") return "male";
  if (v === "f" || v === "female") return "female";
  if (v === "o" || v === "other") return "other";
  return "";
}

/**
 * Throws { status, message } when a guest's gender is not allowed on the floor
 * containing the given bed. Floors with gender 'any' allow anyone. Returns
 * silently when compatible.
 */
async function assertGenderCompatible(bedId: string, guestGender: unknown): Promise<void> {
  const bed = await db.select({ floorId: schema.beds.floorId })
    .from(schema.beds)
    .where(eq(schema.beds.id, bedId))
    .limit(1);
  if (bed.length === 0) return; // bed not found; let caller handle separately
  const floor = await db.select({ gender: schema.floors.gender, name: schema.floors.name })
    .from(schema.floors)
    .where(eq(schema.floors.id, bed[0].floorId))
    .limit(1);
  if (floor.length === 0) return;
  const floorGender = (floor[0].gender || "any").toLowerCase();
  if (floorGender === "any") return;
  const g = normalizeGender(guestGender);
  if (!g) {
    const err: any = new Error(
      `${floor[0].name} is ${floorGender}-only. Please specify the guest's gender to book a bed here.`,
    );
    err.status = 400;
    throw err;
  }
  if (g !== floorGender) {
    const err: any = new Error(
      `${floor[0].name} is ${floorGender}-only. You cannot allocate a ${g} guest to this floor.`,
    );
    err.status = 400;
    throw err;
  }
}

async function cleanExpiredHolds(): Promise<void> {
  await db.delete(schema.bedHolds).where(sql`${schema.bedHolds.expiresAt} <= NOW()`);
}

// Rate limiter for web leads endpoint
const webLeadsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per IP per 15 minutes
  message: { error: "Too many lead submissions, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Brochure generation is CPU-heavy (jsPDF rendering). PDF route is public so
// we cap requests per IP to prevent rapid-fire abuse.
const brochureRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 brochure downloads per IP per 5 minutes
  message: { error: "Too many brochure downloads, please try again in a few minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Allowed marketing domains for CORS
const ALLOWED_MARKETING_DOMAINS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/.*\.hsquareliving\.com$/,
  /^https?:\/\/hsquareliving\.com$/,
  /^https?:\/\/.*\.replit\.dev$/,
  /^https?:\/\/.*\.repl\.co$/,
];

// CORS options for web leads
const webLeadsCorsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow non-browser requests (Postman, etc.)
    const isAllowed = ALLOWED_MARKETING_DOMAINS.some(pattern => pattern.test(origin));
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-LEAD-API-KEY"],
};

// API key validation middleware for web leads
const validateWebLeadApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers["x-lead-api-key"];
  const expectedKey = process.env.WEB_LEADS_API_KEY;
  
  if (!expectedKey) {
    console.error("WEB_LEADS_API_KEY not configured");
    return res.status(500).json({ error: "Lead capture not configured" });
  }
  
  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  
  next();
};

// Phone number normalization
function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return "+91" + digits;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return "+" + digits;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return "+91" + digits.slice(1);
  }
  let normalized = phone.replace(/[^\d+]/g, "");
  if (normalized.startsWith("+91") && normalized.length === 13) {
    return normalized;
  }
  return normalized || phone;
}

// Email normalization  
function normalizeEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  return email.trim().toLowerCase();
}

async function matchLeadByContact(phone?: string | null, email?: string | null) {
  if (!phone && !email) return null;
  const conditions = [];
  if (phone) {
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone) conditions.push(eq(schema.leads.phone, normalizedPhone));
  }
  if (email) {
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail) conditions.push(eq(schema.leads.email, normalizedEmail));
  }
  if (conditions.length === 0) return null;
  const [matched] = await db.select()
    .from(schema.leads)
    .where(or(...conditions))
    .orderBy(desc(schema.leads.lastActivityAt))
    .limit(1);
  if (matched) return matched;

  if (phone) {
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length === 10) {
      const [fallback] = await db.select().from(schema.leads)
        .where(sql`regexp_replace(${schema.leads.phone}, '[^0-9]', '', 'g') LIKE ${'%' + digits}`)
        .orderBy(desc(schema.leads.lastActivityAt))
        .limit(1);
      if (fallback) return fallback;
    }
  }
  return null;
}

// Payment plan definitions (matching frontend logic)
const PAYMENT_PLANS = [
  {
    id: "plan-1",
    name: "Full Settlement",
    discount: 5000,
    installments: [
      { name: "Booking Amount", percentage: 0, fixed: 100000, due: "Immediate" },
      { name: "Remaining Balance", percentage: 100, fixed: 0, due: "Before Move-in" },
    ],
  },
  {
    id: "plan-2",
    name: "Two Installments",
    discount: 0,
    installments: [
      { name: "Booking Amount", percentage: 0, fixed: 100000, due: "Immediate" },
      { name: "1st Installment", percentage: 50, fixed: 0, due: "Move-in Date" },
      { name: "2nd Installment", percentage: 50, fixed: 0, due: "October 1st" },
    ],
  },
  {
    id: "plan-3",
    name: "Three Installments",
    discount: 0,
    installments: [
      { name: "Booking Amount", percentage: 0, fixed: 100000, due: "Immediate" },
      { name: "1st Installment", percentage: 33.3, fixed: 0, due: "Move-in Date" },
      { name: "2nd Installment", percentage: 33.3, fixed: 0, due: "October 1st" },
      { name: "3rd Installment", percentage: 33.4, fixed: 0, due: "December 1st" },
    ],
  },
];

function calculateInstallments(baseFee: number, planId: string, customDiscount: number = 0) {
  const plan = PAYMENT_PLANS.find(p => p.id === planId);
  if (!plan) throw new Error("Invalid payment plan");

  const totalDiscount = plan.discount + customDiscount;
  const totalFee = baseFee - totalDiscount;
  const remaining = totalFee - 100000;

  return plan.installments.map(inst => {
    let amount = inst.fixed;
    if (inst.percentage > 0) {
      amount = Math.round(remaining * (inst.percentage / 100));
    }
    return {
      name: inst.name,
      amount,
      dueDate: inst.due,
    };
  });
}

// Helper function for auto-assigning leads based on property mapping
async function autoAssignLead(leadId: string, propertyId: string): Promise<{ assigned: boolean; salesExecId?: string; assignmentType: string }> {
  if (!propertyId) {
    return { assigned: false, assignmentType: "unassigned" };
  }
  
  try {
    // Get sales exec with least active leads for this property
    const salesExec = await storage.getSalesExecWithLeastLeads(propertyId);
    
    if (!salesExec) {
      // No sales exec mapped to this property
      await storage.updateLead(leadId, {
        assignmentType: "unassigned",
      });
      
      // Notify admins about unassigned lead
      const admins = await storage.getSalesExecutives();
      for (const admin of admins.filter((u: any) => u.role === "admin" || u.role === "superadmin")) {
        await storage.createNotification({
          userId: admin.id,
          title: "Unassigned Lead - Action Required",
          message: `A new lead requires assignment (no sales exec mapped to property).`,
          type: "warning",
          actionUrl: "/admin/sales-management",
        });
      }
      
      return { assigned: false, assignmentType: "unassigned" };
    }
    
    // Assign to sales exec with load balancing
    await storage.updateLead(leadId, {
      assignedToId: salesExec.id,
      assignedAt: new Date(),
      assignmentType: "property_auto",
    });
    
    // Notify sales exec
    await storage.createNotification({
      userId: salesExec.id,
      title: "New Lead Assigned",
      message: `A new lead has been auto-assigned to you based on property mapping.`,
      type: "lead",
      actionUrl: "/sales/requests",
    });
    
    // Log activity
    await storage.createLeadActivity({
      leadId,
      actorId: "system",
      actionType: "lead_assigned",
      newValue: JSON.stringify({ salesExecId: salesExec.id, type: "property_auto" }),
      description: `Auto-assigned to ${salesExec.name} based on property mapping`,
    });
    
    return { assigned: true, salesExecId: salesExec.id, assignmentType: "property_auto" };
  } catch (error) {
    console.error("Error auto-assigning lead:", error);
    return { assigned: false, assignmentType: "unassigned" };
  }
}

async function ensureFloorsForProperty(propertyId: string): Promise<boolean> {
  const existingFloors = await storage.getFloorsByProperty(propertyId);
  if (existingFloors.length > 0) return false;

  const roomTypesList = await storage.getRoomTypesByProperty(propertyId);
  const hasBedsToGenerate = roomTypesList.some(rt => rt.totalBeds > 0);
  if (roomTypesList.length === 0 || !hasBedsToGenerate) return false;

  await db.transaction(async (tx) => {
    const recheck = await tx.select({ id: schema.floors.id }).from(schema.floors).where(eq(schema.floors.propertyId, propertyId)).limit(1);
    if (recheck.length > 0) return;

    const [floor] = await tx.insert(schema.floors).values({
      propertyId,
      floorNumber: 0,
      name: "Main Floor",
      totalBeds: 0,
      availableBeds: 0,
    }).returning();

    let roomCounter = 1;
    for (const rt of roomTypesList) {
      if (rt.totalBeds <= 0) continue;
      const occupancy = rt.occupancy || 1;
      const roomsNeeded = Math.ceil(rt.totalBeds / occupancy);

      for (let r = 0; r < roomsNeeded; r++) {
        const roomNum = `${100 + roomCounter}`;
        const remainingBeds = rt.totalBeds - r * occupancy;
        const bedsInThisRoom = Math.min(occupancy, remainingBeds);
        const [room] = await tx.insert(schema.rooms).values({
          propertyId,
          floorId: floor.id,
          roomTypeId: rt.id,
          roomNumber: roomNum,
          typology: `${occupancy} Bed`,
          hasSharedWashroom: false,
          totalBeds: bedsInThisRoom,
          status: "available",
          monthlyPrice: rt.basePrice,
        }).returning();
        const bedValues: (typeof schema.beds.$inferInsert)[] = [];
        for (let b = 0; b < bedsInThisRoom; b++) {
          bedValues.push({
            propertyId,
            floorId: floor.id,
            roomId: room.id,
            roomTypeId: rt.id,
            bedNumber: occupancy === 1 ? roomNum : `${roomNum}-${String.fromCharCode(65 + b)}`,
            status: "available",
            monthlyPrice: rt.basePrice,
          });
        }
        if (bedValues.length > 0) {
          await tx.insert(schema.beds).values(bedValues);
        }
        roomCounter++;
      }
    }

    const totalGenerated = roomTypesList.reduce((sum, rt) => sum + Math.max(rt.totalBeds, 0), 0);
    await tx.update(schema.floors).set({ totalBeds: totalGenerated, availableBeds: totalGenerated }).where(eq(schema.floors.id, floor.id));
  });

  return true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes for image uploads
  registerObjectStorageRoutes(app);

  // ============ RECEPTIONIST PROPERTY SCOPING ============
  // Backed by the role-agnostic sales_exec_properties junction table. A
  // receptionist with at least one assignment is "scoped" — they only see
  // bookings/registrations/requests/booking-tree/floors-beds/property-dropdown
  // for their assigned properties. Returns null when the user is not a
  // receptionist or has zero assignments (unscoped fallback).
  async function getReceptionistScope(req: AuthRequest): Promise<Set<string> | null> {
    if (!req.user || req.user.role !== "receptionist") return null;
    const assigned = await storage.getAssignedPropertiesForUser(req.user.userId);
    if (assigned.length === 0) return null;
    return new Set(assigned.map((p) => p.id));
  }

  // Returns the receptionist scope inferred from a Bearer token, even on
  // routes that do not declare authMiddleware. Returns null when there is
  // no token, the role is not receptionist, or the user has no assignments.
  async function getReceptionistScopeFromHeader(req: { headers: { authorization?: string | undefined } }): Promise<Set<string> | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    const payload = verifyToken(authHeader.substring(7));
    if (!payload || payload.role !== "receptionist") return null;
    const assigned = await storage.getAssignedPropertiesForUser(payload.userId);
    if (assigned.length === 0) return null;
    return new Set(assigned.map((p) => p.id));
  }

  // Resolve the owning propertyId for a floor/room/bed using direct queries
  // (no per-entity storage helper exists for floor lookup).
  async function getPropertyIdForFloor(floorId: string): Promise<string | null> {
    const rows = await db.select({ propertyId: schema.floors.propertyId })
      .from(schema.floors).where(eq(schema.floors.id, floorId)).limit(1);
    return rows[0]?.propertyId ?? null;
  }
  async function getPropertyIdForRoom(roomId: string): Promise<string | null> {
    const room = await storage.getRoom(roomId);
    return room?.propertyId ?? null;
  }
  async function getPropertyIdForBed(bedId: string): Promise<string | null> {
    const bed = await storage.getBed(bedId);
    return bed?.propertyId ?? null;
  }

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Scoped property list for any logged-in staff user.
  app.get("/api/staff/properties", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = await getReceptionistScope(req);
      const all = await storage.getAllProperties();
      const filtered = scope ? all.filter((p) => scope.has(p.id)) : all;
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching staff properties:", error);
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });

  app.get("/download/android", async (req, res) => {
    try {
      const settings = await storage.getFooterSettings();
      const url = settings?.androidDownloadUrl;
      if (url) {
        return res.redirect(url);
      }
      return res.redirect("/");
    } catch {
      return res.redirect("/");
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, phone, message } = req.body;
      if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email, and message are required" });
      }
      const saved = await storage.createContactMessage({ name, email, phone: phone || null, message });
      console.log(`[Contact Form] Saved message ${saved.id} from ${name} <${email}>`);

      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Hsquare Living <noreply@hsquarehostels.com>",
          to: ["gyan@hsquareliving.com", "shreekant@hsquareliving.com", "ganesh@hsquareliving.com"],
          replyTo: email,
          subject: `New Contact Form Message from ${name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New Contact Form Submission</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Name</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${name}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
                <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${phone || "Not provided"}</td></tr>
                <tr><td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Message</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${message}</td></tr>
              </table>
              <p style="color: #666; font-size: 12px; margin-top: 20px;">View all messages at <a href="${process.env.APP_PUBLIC_URL || "https://hsquare.in"}/admin/contact-messages">Admin Dashboard</a></p>
            </div>
          `,
        });
        console.log(`[Contact Form] Email notification sent for message ${saved.id}`);
      } catch (emailErr) {
        console.error("[Contact Form] Email notification failed:", emailErr);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Contact Form] Error:", error);
      res.status(500).json({ error: "Failed to process contact form" });
    }
  });

  app.get("/api/admin/contact-messages", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
      const jwt = await import("jsonwebtoken");
      const token = authHeader.split(" ")[1];
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET || process.env.SESSION_SECRET || "hsquareliving-dev-secret-key-for-development-only") as any;
      const user = await storage.getUser(decoded.userId);
      if (!user || !["admin", "superadmin", "manager"].includes(user.role)) return res.status(403).json({ error: "Forbidden" });
      const messages = await storage.getAllContactMessages();
      const unreadCount = await storage.getUnreadContactMessageCount();
      res.json({ messages, unreadCount });
    } catch (error) {
      console.error("[Contact Messages] Error:", error);
      res.status(500).json({ error: "Failed to fetch contact messages" });
    }
  });

  app.patch("/api/admin/contact-messages/:id/status", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
      const jwt = await import("jsonwebtoken");
      const token = authHeader.split(" ")[1];
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET || process.env.SESSION_SECRET || "hsquareliving-dev-secret-key-for-development-only") as any;
      const user = await storage.getUser(decoded.userId);
      if (!user || !["admin", "superadmin", "manager"].includes(user.role)) return res.status(403).json({ error: "Forbidden" });
      const { status } = req.body;
      if (!["new", "read", "replied", "archived"].includes(status)) return res.status(400).json({ error: "Invalid status" });
      const updated = await storage.updateContactMessageStatus(req.params.id, status, status === "replied" ? user.id : undefined);
      if (!updated) return res.status(404).json({ error: "Message not found" });
      res.json(updated);
    } catch (error) {
      console.error("[Contact Messages] Error updating status:", error);
      res.status(500).json({ error: "Failed to update message status" });
    }
  });

  // ============ SEO: 301 redirect UUID property URLs to slug URLs ============
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  app.get("/properties/:idOrSlug", async (req, res, next) => {
    const param = req.params.idOrSlug;
    if (!UUID_PATTERN.test(param)) return next();

    try {
      const [prop] = await db.select({ slug: schema.properties.slug })
        .from(schema.properties)
        .where(eq(schema.properties.id, param))
        .limit(1);

      if (prop?.slug) {
        return res.redirect(301, `/properties/${prop.slug}`);
      }
    } catch {}
    next();
  });

  // ============ SEO: robots.txt & sitemap.xml ============

  app.get("/robots.txt", (req, res) => {
    const siteUrl = process.env.APP_PUBLIC_URL || "https://hsquare.in";
    res.type("text/plain").send(
`User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*
Disallow: /sales
Disallow: /sales/*
Disallow: /api/
Disallow: /auth
Disallow: /login
Disallow: /booking/generate
Disallow: /dashboard
Disallow: /my-bookings
Disallow: /profile
Disallow: /settings

Sitemap: ${siteUrl}/sitemap.xml`
    );
  });

  app.get("/sitemap.xml", async (req, res) => {
    const siteUrl = process.env.APP_PUBLIC_URL || "https://hsquare.in";
    const now = new Date().toISOString().split("T")[0];

    interface SitemapEntry {
      loc: string;
      lastmod: string;
      changefreq: string;
      priority: string;
    }

    const staticPages: SitemapEntry[] = [
      { loc: "/", lastmod: now, priority: "1.0", changefreq: "weekly" },
      { loc: "/properties", lastmod: now, priority: "0.9", changefreq: "weekly" },
      { loc: "/hostel-near-nmims", lastmod: now, priority: "0.9", changefreq: "weekly" },
      { loc: "/hostel-near-mithibai", lastmod: now, priority: "0.9", changefreq: "weekly" },
      { loc: "/hostel-near-mukesh-patel", lastmod: now, priority: "0.9", changefreq: "weekly" },
      { loc: "/hostel-near-nm-college", lastmod: now, priority: "0.9", changefreq: "weekly" },
      { loc: "/hostel-near-dj-sanghvi", lastmod: now, priority: "0.8", changefreq: "weekly" },
      { loc: "/hostel-near-whistling-woods", lastmod: now, priority: "0.8", changefreq: "weekly" },
      { loc: "/hostel-in-vile-parle", lastmod: now, priority: "0.9", changefreq: "weekly" },
      { loc: "/hostel-in-goregaon", lastmod: now, priority: "0.8", changefreq: "weekly" },
      { loc: "/about", lastmod: now, priority: "0.7", changefreq: "monthly" },
      { loc: "/contact", lastmod: now, priority: "0.7", changefreq: "monthly" },
      { loc: "/apply", lastmod: now, priority: "0.8", changefreq: "monthly" },
      { loc: "/faq", lastmod: now, priority: "0.6", changefreq: "monthly" },
      { loc: "/terms", lastmod: now, priority: "0.4", changefreq: "yearly" },
      { loc: "/privacy", lastmod: now, priority: "0.4", changefreq: "yearly" },
    ];

    let propertyEntries: SitemapEntry[] = [];
    try {
      const props = await db.select({
        id: schema.properties.id,
        slug: schema.properties.slug,
        updatedAt: schema.properties.updatedAt,
      }).from(schema.properties).where(eq(schema.properties.status, "published"));
      propertyEntries = props
        .filter(p => p.slug)
        .map(p => ({
          loc: `/properties/${p.slug}`,
          lastmod: p.updatedAt ? new Date(p.updatedAt).toISOString().split("T")[0] : now,
          priority: "0.8",
          changefreq: "weekly",
        }));
    } catch (e) {}

    const allPages: SitemapEntry[] = [...staticPages, ...propertyEntries];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${siteUrl}${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join("\n")}
</urlset>`;

    res.type("application/xml").send(xml);
  });

  // ============ HERO SLIDES ============
  
  app.get("/api/hero-slides", async (req, res) => {
    try {
      const activeOnly = req.query.active === "true";
      const slides = await storage.getHeroSlides(activeOnly);
      if (slides.length > 0 || !activeOnly) {
        return res.json(slides);
      }
      // Auto-fallback: when no admin-managed slides exist, surface real
      // photos from published properties so the homepage never shows
      // generic stock imagery.
      const fallback = await buildPropertyHeroFallback();
      res.json(fallback);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hero slides" });
    }
  });

  app.post("/api/hero-slides", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const parsed = insertHeroSlideSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid slide data", details: parsed.error.format() });
      const slide = await storage.createHeroSlide(parsed.data);
      res.status(201).json(slide);
    } catch (error) {
      res.status(500).json({ error: "Failed to create hero slide" });
    }
  });

  app.put("/api/hero-slides/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const parsed = insertHeroSlideSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid slide data", details: parsed.error.format() });
      const slide = await storage.updateHeroSlide(req.params.id, parsed.data);
      if (!slide) return res.status(404).json({ error: "Slide not found" });
      res.json(slide);
    } catch (error) {
      res.status(500).json({ error: "Failed to update hero slide" });
    }
  });

  app.delete("/api/hero-slides/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteHeroSlide(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete hero slide" });
    }
  });

  app.post("/api/hero-slides/reorder", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { slideIds } = req.body;
      if (!Array.isArray(slideIds)) return res.status(400).json({ error: "slideIds must be an array" });
      await storage.reorderHeroSlides(slideIds);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder slides" });
    }
  });

  // ============ FOOTER SETTINGS ============

  app.get("/api/footer-settings", async (req, res) => {
    try {
      const settings = await storage.getFooterSettings();
      if (!settings) {
        return res.json({
          companyDescription: "Premium student accommodation designed for comfort, community, and success.",
          email: "support@hsquareliving.com",
          phone: "+91 98765 43210",
          location: "Bangalore, India",
          copyrightText: "Hsquareliving Pvt Ltd. All rights reserved.",
          quickLinks: [{ label: "Properties", href: "/properties" }, { label: "About Us", href: "/about" }, { label: "Contact", href: "/contact" }],
          supportLinks: [{ label: "FAQs", href: "/faq" }, { label: "Terms & Conditions", href: "/terms" }, { label: "Privacy Policy", href: "/privacy" }],
          androidDownloadUrl: "",
        });
      }
      res.json({
        ...settings,
        quickLinks: JSON.parse(settings.quickLinks || "[]"),
        supportLinks: JSON.parse(settings.supportLinks || "[]"),
        androidDownloadUrl: settings.androidDownloadUrl || "",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch footer settings" });
    }
  });

  const footerUpdateSchema = z.object({
    companyDescription: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    copyrightText: z.string().optional(),
    quickLinks: z.array(z.object({ label: z.string(), href: z.string() })).optional(),
    supportLinks: z.array(z.object({ label: z.string(), href: z.string() })).optional(),
    socialInstagram: z.string().nullable().optional(),
    socialFacebook: z.string().nullable().optional(),
    socialTwitter: z.string().nullable().optional(),
    socialLinkedin: z.string().nullable().optional(),
    androidDownloadUrl: z.string().nullable().optional(),
  });

  app.put("/api/footer-settings", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const parsed = footerUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid footer data", details: parsed.error.format() });
      const { quickLinks, supportLinks, ...rest } = parsed.data;
      const data: any = { ...rest };
      if (quickLinks) data.quickLinks = JSON.stringify(quickLinks);
      if (supportLinks) data.supportLinks = JSON.stringify(supportLinks);
      const settings = await storage.upsertFooterSettings(data);
      res.json({
        ...settings,
        quickLinks: JSON.parse(settings.quickLinks || "[]"),
        supportLinks: JSON.parse(settings.supportLinks || "[]"),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update footer settings" });
    }
  });

  // ============ MAP SETTINGS ============

  const formatMapGroup = (settings: any) => ({
    id: settings.id,
    name: settings.name || "Connection 1",
    connectedPropertyIds: JSON.parse(settings.connectedPropertyIds || "[]"),
    pattern: settings.pattern,
    lineColor: settings.lineColor,
    fillColor: settings.fillColor,
    fillOpacity: parseFloat(settings.fillOpacity),
    lineWidth: parseFloat(settings.lineWidth),
    glowEnabled: settings.glowEnabled === "true",
    animationEnabled: settings.animationEnabled === "true",
  });

  app.get("/api/map-settings", async (req, res) => {
    try {
      const allSettings = await storage.getAllMapSettings();
      if (allSettings.length === 0) {
        return res.json({
          groups: [],
          connectedPropertyIds: [],
          pattern: "triangle",
          lineColor: "#34d399",
          fillColor: "#34d399",
          fillOpacity: 0.15,
          lineWidth: 2.5,
          glowEnabled: true,
          animationEnabled: true,
        });
      }
      const groups = allSettings.map(formatMapGroup);
      const first = groups[0];
      res.json({
        groups,
        ...first,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch map settings" });
    }
  });

  app.put("/api/admin/map-settings", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const data = req.body;
      if (data.groups && Array.isArray(data.groups)) {
        const existingGroups = await storage.getAllMapSettings();
        const existingIds = new Set(existingGroups.map(g => g.id));
        const incomingIds = new Set(data.groups.filter((g: any) => g.id).map((g: any) => g.id));

        for (const eg of existingGroups) {
          if (!incomingIds.has(eg.id)) {
            await storage.deleteMapSettingsGroup(eg.id);
          }
        }

        const results = [];
        for (const group of data.groups) {
          const groupData = {
            name: group.name || "Connection",
            connectedPropertyIds: JSON.stringify(group.connectedPropertyIds || []),
            pattern: group.pattern || "triangle",
            lineColor: group.lineColor || "#34d399",
            fillColor: group.fillColor || "#34d399",
            fillOpacity: String(group.fillOpacity ?? 0.15),
            lineWidth: String(group.lineWidth ?? 2.5),
            glowEnabled: String(group.glowEnabled ?? true),
            animationEnabled: String(group.animationEnabled ?? true),
          };

          if (group.id && existingIds.has(group.id)) {
            const updated = await storage.updateMapSettingsGroup(group.id, groupData);
            results.push(formatMapGroup(updated));
          } else {
            const created = await storage.createMapSettingsGroup(groupData);
            results.push(formatMapGroup(created));
          }
        }

        const first = results[0] || { connectedPropertyIds: [], pattern: "triangle", lineColor: "#34d399", fillColor: "#34d399", fillOpacity: 0.15, lineWidth: 2.5, glowEnabled: true, animationEnabled: true };
        return res.json({ groups: results, ...first });
      }

      const settings = await storage.upsertMapSettings({
        connectedPropertyIds: JSON.stringify(data.connectedPropertyIds || []),
        pattern: data.pattern || "triangle",
        lineColor: data.lineColor || "#34d399",
        fillColor: data.fillColor || "#34d399",
        fillOpacity: String(data.fillOpacity ?? 0.15),
        lineWidth: String(data.lineWidth ?? 2.5),
        glowEnabled: String(data.glowEnabled ?? true),
        animationEnabled: String(data.animationEnabled ?? true),
      });
      const formatted = formatMapGroup(settings);
      res.json({ groups: [formatted], ...formatted });
    } catch (error) {
      res.status(500).json({ error: "Failed to update map settings" });
    }
  });

  // ============ LOGO SETTINGS ============

  app.get("/api/logo-settings", async (req, res) => {
    try {
      const settings = await storage.getFooterSettings();
      res.json({
        headerLogo: settings?.headerLogo || null,
        footerLogo: settings?.footerLogo || null,
        adminLogo: settings?.adminLogo || null,
      });
    } catch (error) {
      res.json({ headerLogo: null, footerLogo: null, adminLogo: null });
    }
  });

  app.get("/api/admin/logo-settings", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const settings = await storage.getFooterSettings();
      res.json({
        headerLogo: settings?.headerLogo || null,
        footerLogo: settings?.footerLogo || null,
        adminLogo: settings?.adminLogo || null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch logo settings" });
    }
  });

  const logoUpdateSchema = z.object({
    headerLogo: z.string().nullable().optional(),
    footerLogo: z.string().nullable().optional(),
    adminLogo: z.string().nullable().optional(),
  });

  app.put("/api/admin/logo-settings", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      if (req.user!.email !== "gyan@hsquareliving.com") {
        return res.status(403).json({ error: "Only the main administrator can update logo settings" });
      }
      const parsed = logoUpdateSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid logo data" });
      const { headerLogo, footerLogo, adminLogo } = parsed.data;
      const data: any = {};
      if (headerLogo !== undefined) data.headerLogo = headerLogo;
      if (footerLogo !== undefined) data.footerLogo = footerLogo;
      if (adminLogo !== undefined) data.adminLogo = adminLogo;
      const settings = await storage.upsertFooterSettings(data);
      res.json({
        headerLogo: settings.headerLogo || null,
        footerLogo: settings.footerLogo || null,
        adminLogo: settings.adminLogo || null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update logo settings" });
    }
  });

  // ============ HOMEPAGE AMENITIES ============

  app.get("/api/homepage-amenities", async (req, res) => {
    try {
      const amenities = await storage.getHomepageAmenities();
      res.json(amenities);
    } catch (error) {
      res.json([]);
    }
  });

  const amenitySchema = z.object({
    title: z.string().min(1),
    description: z.string().default(""),
    imageUrl: z.string().min(1),
    icon: z.string().default("Star"),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  });

  app.post("/api/admin/homepage-amenities", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const parsed = amenitySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      const amenity = await storage.createHomepageAmenity(parsed.data);
      res.json(amenity);
    } catch (error) {
      res.status(500).json({ error: "Failed to create amenity" });
    }
  });

  app.put("/api/admin/homepage-amenities/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const parsed = amenitySchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      const amenity = await storage.updateHomepageAmenity(req.params.id, parsed.data);
      res.json(amenity);
    } catch (error) {
      res.status(500).json({ error: "Failed to update amenity" });
    }
  });

  app.delete("/api/admin/homepage-amenities/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      await storage.deleteHomepageAmenity(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete amenity" });
    }
  });

  // ============ INSTAGRAM LIVE FEED ============

  async function fetchInstagramPosts(): Promise<any[]> {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("Instagram access token not configured");
    }

    const response = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=25&access_token=${accessToken}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Instagram API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return (data.data || []).filter(
      (post: any) => post.media_type === "IMAGE" || post.media_type === "CAROUSEL_ALBUM"
    );
  }

  async function syncInstagramIfStale(): Promise<void> {
    const lastSync = await storage.getLastInstagramSync();
    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (lastSync && lastSync.status === "success" && (now.getTime() - lastSync.syncedAt.getTime()) < oneDayMs) {
      return;
    }

    try {
      const posts = await fetchInstagramPosts();
      const mappedPosts = posts.map((p: any) => ({
        id: p.id,
        mediaType: p.media_type,
        mediaUrl: p.media_url,
        thumbnailUrl: p.thumbnail_url || null,
        caption: p.caption || null,
        permalink: p.permalink,
        instagramTimestamp: new Date(p.timestamp),
        cachedAt: new Date(),
      }));
      await storage.upsertInstagramPosts(mappedPosts);
      await storage.logInstagramSync(mappedPosts.length, "success");
    } catch (error: any) {
      await storage.logInstagramSync(0, "error", error.message);
      throw error;
    }
  }

  app.get("/api/instagram/posts", async (req, res) => {
    try {
      try {
        await syncInstagramIfStale();
      } catch (syncError: any) {
        console.error("Instagram sync failed:", syncError.message);
      }

      const posts = await storage.getInstagramPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch Instagram posts" });
    }
  });

  app.post("/api/instagram/sync", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const posts = await fetchInstagramPosts();
      const mappedPosts = posts.map((p: any) => ({
        id: p.id,
        mediaType: p.media_type,
        mediaUrl: p.media_url,
        thumbnailUrl: p.thumbnail_url || null,
        caption: p.caption || null,
        permalink: p.permalink,
        instagramTimestamp: new Date(p.timestamp),
        cachedAt: new Date(),
      }));
      await storage.upsertInstagramPosts(mappedPosts);
      await storage.logInstagramSync(mappedPosts.length, "success");
      res.json({ success: true, count: mappedPosts.length });
    } catch (error: any) {
      await storage.logInstagramSync(0, "error", error.message);
      res.status(500).json({ error: error.message || "Failed to sync Instagram posts" });
    }
  });

  app.get("/api/instagram/sync-status", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const lastSync = await storage.getLastInstagramSync();
      res.json(lastSync || { syncedAt: null, status: "never" });
    } catch (error) {
      res.status(500).json({ error: "Failed to get sync status" });
    }
  });

  // ============ WEB LEAD CAPTURE ============
  
  // Schema for web lead validation
  const webLeadSchema = z.object({
    name: z.string().min(1, "Name is required"),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    property_interest: z.string().optional(),
    message: z.string().optional(),
    source: z.string().optional(),
    utm_source: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_term: z.string().optional(),
    utm_content: z.string().optional(),
    page_url: z.string().optional(),
    // Honeypot field - should be empty if human
    website: z.string().optional(),
  }).refine(data => data.phone || data.email, {
    message: "Either phone or email is required"
  });

  // Web lead capture endpoint - public but secured
  app.options("/api/leads/web", cors(webLeadsCorsOptions));
  app.post("/api/leads/web", 
    cors(webLeadsCorsOptions),
    webLeadsRateLimiter,
    validateWebLeadApiKey,
    async (req: Request, res: Response) => {
      try {
        // Check honeypot field - bots will fill this
        if (req.body.website && req.body.website.length > 0) {
          // Silently reject but return success to not tip off bots
          return res.json({ success: true, message: "Thank you for your interest" });
        }

        // Validate input
        const validationResult = webLeadSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({ 
            error: "Validation failed", 
            details: validationResult.error.flatten().fieldErrors 
          });
        }

        const data = validationResult.data;
        const normalizedPhone = normalizePhone(data.phone);
        const normalizedEmail = normalizeEmail(data.email);

        // Check for existing lead by phone or email
        let existingLead = null;
        if (normalizedPhone || normalizedEmail) {
          const conditions = [];
          if (normalizedPhone) {
            conditions.push(eq(schema.leads.phone, normalizedPhone));
          }
          if (normalizedEmail) {
            conditions.push(eq(schema.leads.email, normalizedEmail));
          }
          
          const existingLeads = await db.select()
            .from(schema.leads)
            .where(or(...conditions))
            .limit(1);
          
          existingLead = existingLeads[0] || null;
        }

        // Find property if property_interest is provided
        let propertyId: string | null = null;
        let propertyName: string | null = null;
        if (data.property_interest) {
          const properties = await db.select()
            .from(schema.properties)
            .where(eq(schema.properties.name, data.property_interest))
            .limit(1);
          
          if (properties[0]) {
            propertyId = properties[0].id;
            propertyName = properties[0].name;
          }
        }

        // Auto-assign to sales executive if property is specified
        let assignedToId: string | null = null;
        let assignmentType: "property_auto" | "admin_manual" | "unassigned" | "fallback_default" = "unassigned";
        
        if (propertyId) {
          // Find sales executive assigned to this property with round-robin load balancing
          const assignments = await db.select({
            salesExecId: schema.salesExecProperties.userId,
          })
            .from(schema.salesExecProperties)
            .where(and(
              eq(schema.salesExecProperties.propertyId, propertyId),
              eq(schema.salesExecProperties.isActive, true)
            ));
          
          if (assignments.length > 0) {
            // Get lead counts for each sales exec to do load balancing
            const salesExecIds = assignments.map(a => a.salesExecId);
            const leadCounts = await db.select({
              assignedToId: schema.leads.assignedToId,
              count: sql<number>`count(*)::int`,
            })
              .from(schema.leads)
              .where(and(
                inArray(schema.leads.assignedToId, salesExecIds),
                isNull(schema.leads.dealClosedAt)
              ))
              .groupBy(schema.leads.assignedToId);
            
            // Create map of lead counts
            const countMap = new Map(leadCounts.map(l => [l.assignedToId, l.count]));
            
            // Find the sales exec with fewest leads
            let minLeads = Infinity;
            let selectedExecId = salesExecIds[0];
            for (const execId of salesExecIds) {
              const count = countMap.get(execId) || 0;
              if (count < minLeads) {
                minLeads = count;
                selectedExecId = execId;
              }
            }
            
            assignedToId = selectedExecId;
            assignmentType = "property_auto";
          }
        }

        // Fallback: if no sales exec was matched (no property, or property
        // has no active execs mapped), route the lead to the catch-all
        // default assignee (Bibhuti) so leads never end up in unassigned
        // limbo. Only applied when creating a brand new lead — existing
        // leads keep whatever assignment they already had.
        ({ assignedToId, assignmentType } = await storage.assignFallbackIfUnassigned({
          assignedToId,
          assignmentType,
        }));

        let lead;
        if (existingLead) {
          // Update existing lead with new UTM data and message
          const [updatedLead] = await db.update(schema.leads)
            .set({
              name: data.name || existingLead.name,
              phone: normalizedPhone || existingLead.phone,
              email: normalizedEmail || existingLead.email,
              propertyId: propertyId || existingLead.propertyId,
              propertyName: propertyName || existingLead.propertyName,
              message: data.message || existingLead.message,
              utmSource: data.utm_source || existingLead.utmSource,
              utmCampaign: data.utm_campaign || existingLead.utmCampaign,
              utmMedium: data.utm_medium || existingLead.utmMedium,
              utmTerm: data.utm_term || existingLead.utmTerm,
              utmContent: data.utm_content || existingLead.utmContent,
              pageUrl: data.page_url || existingLead.pageUrl,
              lastActivityAt: new Date(),
              loginCount: existingLead.loginCount + 1,
              // Update assignment only if not already assigned
              assignedToId: existingLead.assignedToId || assignedToId,
              assignmentType: existingLead.assignedToId ? existingLead.assignmentType : assignmentType,
              assignedAt: existingLead.assignedToId ? existingLead.assignedAt : (assignedToId ? new Date() : null),
            })
            .where(eq(schema.leads.id, existingLead.id))
            .returning();
          
          lead = updatedLead;
          
          // Log activity for returning lead
          await logActivity({
            actionType: "update",
            entityType: "lead",
            entityId: lead.id,
            details: { 
              source: "website_return",
              message: "Lead returned via website form",
              utmSource: data.utm_source,
              pageUrl: data.page_url,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
        } else {
          const newLead = await storage.createLead({
              name: data.name,
              phone: normalizedPhone,
              email: normalizedEmail,
              source: "website",
              status: "new",
              propertyId,
              propertyName,
              message: data.message,
              utmSource: data.utm_source,
              utmCampaign: data.utm_campaign,
              utmMedium: data.utm_medium,
              utmTerm: data.utm_term,
              utmContent: data.utm_content,
              pageUrl: data.page_url,
              ipAddress: req.ip,
              userAgent: req.headers["user-agent"],
              assignedToId,
              assignmentType,
              assignedAt: assignedToId ? new Date() : null,
              signedUp: true,
              score: 5,
            });
          
          lead = newLead;
          
          // Log activity for new lead
          await logActivity({
            actionType: "create",
            entityType: "lead",
            entityId: lead.id,
            details: { 
              source: "website",
              message: "Lead created from website form",
              property: propertyName,
              assignedTo: assignedToId,
              utmSource: data.utm_source,
              utmCampaign: data.utm_campaign,
            },
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          });
        }

        const isNewLead = !existingLead;
        const assignmentChanged = existingLead && !existingLead.assignedToId && assignedToId;

        if (assignedToId && (isNewLead || assignmentChanged)) {
          await storage.createNotification({
            userId: assignedToId,
            title: "New Website Lead",
            message: `New lead "${data.name}" from website has been assigned to you.`,
            type: "lead",
            actionUrl: "/sales/requests",
          });

          // Fire-and-forget email so a slow/failing Resend call never
          // takes down the public lead-capture endpoint.
          (async () => {
            try {
              const assignee = await storage.getUser(assignedToId);
              if (assignee?.email) {
                const { sendLeadAssignmentEmail, buildLeadAssignmentEmailPayload } = await import("./email-service");
                await sendLeadAssignmentEmail(
                  buildLeadAssignmentEmailPayload(lead),
                  { id: assignee.id, name: assignee.name, email: assignee.email },
                  { assignmentType }
                );
              }
            } catch (e) {
              console.warn("[LeadAssignmentEmail] web lead failed:", e);
            }
          })();
        }
        if (isNewLead) {
          const adminUsers = await storage.getUsersByRole(["admin", "superadmin"]);
          for (const admin of adminUsers) {
            await storage.createNotification({
              userId: admin.id,
              title: "New Website Lead",
              message: `New lead "${data.name}" received from website${propertyName ? ` for ${propertyName}` : ""}.`,
              type: "lead",
              actionUrl: "/admin/leads",
            });
          }
        }

        res.json({ 
          success: true, 
          message: "Thank you for your interest! Our team will contact you shortly.",
          leadId: lead.id,
        });
      } catch (error) {
        console.error("Web lead capture error:", error);
        res.status(500).json({ error: "Failed to process lead" });
      }
    }
  );

  // ============ TOUR ENQUIRY ============
  app.post("/api/enquiry", async (req, res) => {
    try {
      const { name, phone, email, propertyId, minBudget, maxBudget, notes } = req.body;
      if (!name || !phone) {
        return res.status(400).json({ error: "Name and phone are required" });
      }

      let propertyName: string | null = null;
      let assignedToId: string | null = null;
      let assignmentType: "property_auto" | "admin_manual" | "unassigned" | "fallback_default" = "unassigned";

      if (propertyId) {
        const [prop] = await db.select().from(schema.properties).where(eq(schema.properties.id, propertyId)).limit(1);
        if (prop) {
          propertyName = prop.name;
          const assignments = await db.select({ userId: schema.salesExecProperties.userId })
            .from(schema.salesExecProperties)
            .where(and(
              eq(schema.salesExecProperties.propertyId, propertyId),
              eq(schema.salesExecProperties.isActive, true)
            ));
          if (assignments.length > 0) {
            const salesExecIds = assignments.map(a => a.userId);
            const leadCounts = await db.select({
              assignedToId: schema.leads.assignedToId,
              count: sql<number>`count(*)::int`,
            }).from(schema.leads)
              .where(and(inArray(schema.leads.assignedToId, salesExecIds), isNull(schema.leads.dealClosedAt)))
              .groupBy(schema.leads.assignedToId);
            const countMap = new Map(leadCounts.map(l => [l.assignedToId, l.count]));
            let minLeads = Infinity;
            let selectedExecId = salesExecIds[0];
            for (const execId of salesExecIds) {
              const count = countMap.get(execId) || 0;
              if (count < minLeads) { minLeads = count; selectedExecId = execId; }
            }
            assignedToId = selectedExecId;
            assignmentType = "property_auto";
          }
        }
      }

      // Fallback to default catch-all assignee (Bibhuti) when no property
      // mapping produced a sales exec, so enquiries never fall through.
      ({ assignedToId, assignmentType } = await storage.assignFallbackIfUnassigned({
        assignedToId,
        assignmentType,
      }));

      const lead = await storage.createLead({
        name,
        phone,
        email: email || null,
        source: "hsquare_dynamics",
        status: "new",
        propertyId: propertyId || null,
        propertyName,
        budgetMin: minBudget ? parseInt(String(minBudget).replace(/[^0-9]/g, '')) || null : null,
        budgetMax: maxBudget ? parseInt(String(maxBudget).replace(/[^0-9]/g, '')) || null : null,
        message: notes || null,
        enquirySubmitted: true,
        signedUp: true,
        score: 25,
        assignedToId,
        assignmentType,
        assignedAt: assignedToId ? new Date() : null,
        isManualEntry: false,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      if (assignedToId) {
        await storage.createNotification({
          userId: assignedToId,
          title: "New Tour Enquiry",
          message: `New tour enquiry from "${name}" has been assigned to you${propertyName ? ` for ${propertyName}` : ""}.`,
          type: "lead",
          actionUrl: "/sales/requests",
        });

        const assignedToIdForEmail = assignedToId;
        (async () => {
          try {
            const assignee = await storage.getUser(assignedToIdForEmail);
            if (assignee?.email) {
              const { sendLeadAssignmentEmail, buildLeadAssignmentEmailPayload } = await import("./email-service");
              await sendLeadAssignmentEmail(
                buildLeadAssignmentEmailPayload(lead),
                { id: assignee.id, name: assignee.name, email: assignee.email },
                { assignmentType }
              );
            }
          } catch (e) {
            console.warn("[LeadAssignmentEmail] tour enquiry failed:", e);
          }
        })();
      }
      const enquiryAdmins = await storage.getUsersByRole(["admin", "superadmin"]);
      for (const admin of enquiryAdmins) {
        await storage.createNotification({
          userId: admin.id,
          title: "New Tour Enquiry",
          message: `New tour enquiry from "${name}"${propertyName ? ` for ${propertyName}` : ""}.`,
          type: "lead",
          actionUrl: "/admin/leads",
        });
      }

      res.json({ success: true, message: "Thank you for your enquiry! Our team will contact you shortly." });
    } catch (error) {
      console.error("Tour enquiry error:", error);
      res.status(500).json({ error: "Failed to submit enquiry" });
    }
  });

  // ============ AUTH ============

  // Sign up - Create new user account
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const validationResult = signupSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(e => e.message);
        return res.status(400).json({ error: errors[0], details: errors });
      }

      const { name, email, phone, password } = validationResult.data;

      // Check if email already exists (case-insensitive)
      const existingUser = await storage.getUserByEmail(email.toLowerCase());
      if (existingUser) {
        return res.status(409).json({ error: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user with default role "user"
      const user = await storage.createUser({
        name,
        email: email.toLowerCase(),
        phone,
        phoneVerified: false,
        password: hashedPassword,
        role: "user",
      });

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role as any,
      });

      const redirectPath = getRoleRedirectPath(user.role as any);
      const { password: _, ...userWithoutPassword } = user;

      // Create lead for new user signup (only for non-admin users)
      if (user.role === "user") {
        const userAgent = req.headers["user-agent"] || "";
        const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || "";
        const deviceType = /mobile/i.test(userAgent) ? "mobile" : /tablet/i.test(userAgent) ? "tablet" : "desktop";
        
        try {
          // Check if lead already exists
          const existingLead = await storage.getLeadByEmail(email.toLowerCase());
          if (!existingLead) {
            await storage.createLead({
              name,
              email: email.toLowerCase(),
              phone,
              source: "website",
              status: "new",
              ipAddress,
              userAgent,
              deviceType,
            });
          }
        } catch (leadError) {
          console.error("Error creating lead during signup:", leadError);
          // Don't fail signup if lead creation fails
        }
      }

      res.status(201).json({ 
        user: userWithoutPassword, 
        token,
        redirectPath,
      });
    } catch (error) {
      console.error("Error during signup:", error);
      res.status(500).json({ error: "Signup failed. Please try again." });
    }
  });

  // Login - Authenticate existing user
  app.post("/api/auth/login", async (req, res) => {
    try {
      const validationResult = loginSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid email or password format" });
      }

      const { email, password } = validationResult.data;

      // Find user by email (case-insensitive)
      const user = await storage.getUserByEmail(email.toLowerCase());
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(403).json({ error: "Account disabled. Please contact support." });
      }

      // Compare password
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Incorrect password" });
      }

      // Generate JWT token
      const token = generateToken({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role as any,
      });

      const redirectPath = getRoleRedirectPath(user.role as any);
      const { password: _, ...userWithoutPassword } = user;

      // Track lead activity on login (only for non-admin users)
      if (user.role === "user") {
        const userAgent = req.headers["user-agent"] || "";
        const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || "";
        const deviceType = /mobile/i.test(userAgent) ? "mobile" : /tablet/i.test(userAgent) ? "tablet" : "desktop";
        
        try {
          const existingLead = await storage.getLeadByEmail(email.toLowerCase());
          if (existingLead) {
            // Update existing lead's activity
            await storage.updateLeadActivity(existingLead.id);
          } else {
            // Create new lead if user doesn't have one (legacy users)
            await storage.createLead({
              name: user.name,
              email: email.toLowerCase(),
              phone: user.phone || null,
              source: "website",
              status: "new",
              ipAddress,
              userAgent,
              deviceType,
            });
          }
        } catch (leadError) {
          console.error("Error tracking lead during login:", leadError);
          // Don't fail login if lead tracking fails
        }
      }

      res.json({ 
        user: userWithoutPassword, 
        token,
        redirectPath,
      });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Login failed. Please try again." });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }
      const user = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase().trim())).limit(1);
      if (!user.length) {
        return res.json({ message: "If an account exists with that email, a reset link has been sent." });
      }
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await db.update(schema.users).set({ resetToken, resetTokenExpiry }).where(eq(schema.users.id, user[0].id));
      const baseUrl = process.env.APP_PUBLIC_URL?.replace(/\/$/, "") || "https://hsquare.in";
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
      console.log("[forgot-password] Reset URL generated:", resetUrl);
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const emailResult = await resend.emails.send({
          from: "Hsquare Living <noreply@hsquarehostels.com>",
          to: email.toLowerCase().trim(),
          subject: "Reset Your Password - Hsquare Living",
          html: `
            <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
              <div style="text-align:center;margin-bottom:24px">
                <h1 style="font-size:22px;font-weight:700;color:#1e293b;margin:0">Password Reset</h1>
                <p style="font-size:14px;color:#64748b;margin-top:8px">Hsquare Living Admin</p>
              </div>
              <p style="font-size:14px;color:#334155;line-height:1.6">Hi ${user[0].name},</p>
              <p style="font-size:14px;color:#334155;line-height:1.6">We received a request to reset your password. Click the button below to set a new password. This link expires in 10 minutes.</p>
              <div style="text-align:center;margin:28px 0">
                <a href="${resetUrl}" style="display:inline-block;background:#6c2bd9;color:#fff;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none">Reset Password</a>
              </div>
              <p style="font-size:12px;color:#94a3b8;line-height:1.5;margin-top:16px">Or copy and paste this link into your browser:</p>
              <p style="font-size:12px;color:#6c2bd9;word-break:break-all;line-height:1.5">${resetUrl}</p>
              <p style="font-size:12px;color:#94a3b8;line-height:1.5">If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
              <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0" />
              <p style="font-size:11px;color:#cbd5e1;text-align:center">Hsquareliving Pvt Ltd</p>
            </div>
          `,
        });
        console.log("[forgot-password] Email send result:", JSON.stringify(emailResult));
      } catch (emailErr) {
        console.error("Failed to send reset email:", emailErr);
      }
      res.json({ message: "If an account exists with that email, a reset link has been sent." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password || typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ error: "Valid token and password (min 6 characters) are required" });
      }
      const user = await db.select().from(schema.users).where(eq(schema.users.resetToken, token)).limit(1);
      if (!user.length) {
        return res.status(400).json({ error: "Invalid or expired reset link" });
      }
      if (!user[0].resetTokenExpiry || new Date(user[0].resetTokenExpiry) < new Date()) {
        return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
      }
      const hashedPassword = await hashPassword(password);
      await db.update(schema.users).set({ password: hashedPassword, resetToken: null, resetTokenExpiry: null }).where(eq(schema.users.id, user[0].id));
      res.json({ message: "Password has been reset successfully. You can now log in." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  });

  // Verify token and get current user
  app.get("/api/auth/me", async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const token = authHeader.substring(7);
      const payload = verifyToken(token);

      if (!payload) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const user = await storage.getUser(payload.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account disabled" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json({ 
        user: userWithoutPassword,
        redirectPath: getRoleRedirectPath(user.role as any),
      });
    } catch (error) {
      console.error("Error verifying token:", error);
      res.status(500).json({ error: "Authentication check failed" });
    }
  });

  // Update user profile
  app.patch("/api/auth/profile", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { name, avatarUrl, phone } = req.body;
      
      const updatedUser = await storage.updateUser(userId, {
        ...(name && { name }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(phone && { phone }),
      });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Store OTPs temporarily (in production, use Redis or similar)
  const otpStore: Map<string, { otp: string; expiry: number; name: string }> = new Map();

  // Visitor login - Send OTP
  app.post("/api/auth/visitor/send-otp", async (req, res) => {
    try {
      const { phone, name } = req.body;
      
      if (!phone || !name) {
        return res.status(400).json({ error: "Phone number and name required" });
      }

      // Generate 4-digit OTP (in production, use SMS service)
      const otp = "1234"; // Mock OTP for development
      const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes
      
      otpStore.set(phone, { otp, expiry, name });
      
      console.log(`OTP for ${phone}: ${otp}`); // For development
      
      res.json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  // Visitor login - Verify OTP
  app.post("/api/auth/visitor/verify-otp", async (req, res) => {
    try {
      const { phone, otp } = req.body;
      
      if (!phone || !otp) {
        return res.status(400).json({ error: "Phone and OTP required" });
      }

      const storedData = otpStore.get(phone);
      
      if (!storedData) {
        return res.status(400).json({ error: "OTP expired or not found. Please request a new one." });
      }

      if (Date.now() > storedData.expiry) {
        otpStore.delete(phone);
        return res.status(400).json({ error: "OTP expired. Please request a new one." });
      }

      if (storedData.otp !== otp) {
        return res.status(401).json({ error: "Invalid OTP" });
      }

      // OTP verified, clear it
      otpStore.delete(phone);

      // Get device info from headers
      const userAgent = req.headers["user-agent"] || "";
      const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || "";
      const deviceType = /mobile/i.test(userAgent) ? "mobile" : /tablet/i.test(userAgent) ? "tablet" : "desktop";

      // Check if lead already exists
      let lead = await storage.getLeadByPhone(phone);
      
      if (lead) {
        // Update existing lead activity
        lead = await storage.updateLeadActivity(lead.id);
      } else {
        // Create new lead
        lead = await storage.createLead({
          name: storedData.name,
          phone,
          ipAddress,
          userAgent,
          deviceType,
        });
        // Mark phone as verified
        await storage.updateLead(lead.id, { phoneVerified: true });
      }

      res.json({ 
        success: true, 
        lead: {
          id: lead!.id,
          name: lead!.name,
          phone: lead!.phone,
          email: lead!.email,
        }
      });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // Visitor login - Email/Password fallback
  app.post("/api/auth/visitor/email-login", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name required" });
      }

      // Get device info from headers
      const userAgent = req.headers["user-agent"] || "";
      const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || "";
      const deviceType = /mobile/i.test(userAgent) ? "mobile" : /tablet/i.test(userAgent) ? "tablet" : "desktop";

      // Check if lead already exists by email
      let lead = await storage.getLeadByEmail(email);
      
      if (lead) {
        // Update existing lead activity
        lead = await storage.updateLeadActivity(lead.id);
      } else {
        // Create new lead (no password storage for visitors - just tracking)
        lead = await storage.createLead({
          name,
          email,
          ipAddress,
          userAgent,
          deviceType,
        });
      }

      res.json({ 
        success: true, 
        lead: {
          id: lead!.id,
          name: lead!.name,
          phone: lead!.phone,
          email: lead!.email,
        }
      });
    } catch (error) {
      console.error("Error during email login:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Update lead activity (heartbeat)
  app.post("/api/auth/visitor/activity", async (req, res) => {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({ error: "Lead ID required" });
      }

      await storage.updateLead(leadId, { lastActivityAt: new Date() });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating activity:", error);
      res.status(500).json({ error: "Failed to update activity" });
    }
  });

  // ============ LEADS (Admin) ============

  app.post("/api/leads/check-duplicate", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: "Phone is required" });
      }
      const digits = phone.replace(/\D/g, "");
      const last10 = digits.slice(-10);
      if (last10.length < 10) {
        return res.json({ duplicate: false, leads: [] });
      }
      const phoneVariants = [last10, `+91${last10}`, `91${last10}`];
      const allLeads = await db.select().from(schema.leads)
        .where(and(
          or(
            inArray(schema.leads.phone, phoneVariants),
            sql`RIGHT(REGEXP_REPLACE(${schema.leads.phone}, '[^0-9]', '', 'g'), 10) = ${last10}`
          ),
          sql`NOT (${schema.leads.isManualEntry} = false AND ${schema.leads.createdBy} IS NULL AND ${schema.leads.assignedToId} IS NULL AND ${schema.leads.entrySource} IS NULL)`
        ))
        .orderBy(desc(schema.leads.lastActivityAt));
      if (allLeads.length === 0) {
        return res.json({ duplicate: false, leads: [] });
      }
      const enriched = await Promise.all(allLeads.map(async (lead) => {
        let createdByName: string | null = null;
        let assignedToName: string | null = null;
        if (lead.createdBy) {
          const u = await storage.getUser(lead.createdBy);
          if (u) createdByName = u.name;
        }
        if (lead.assignedToId) {
          const u = await storage.getUser(lead.assignedToId);
          if (u) assignedToName = u.name;
        }
        let bookingStatus: string | null = null;
        if (lead.linkedBookingId) {
          const b = await storage.getBooking(lead.linkedBookingId);
          if (b) bookingStatus = b.status;
        }
        return {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          status: lead.status,
          propertyName: lead.propertyName,
          entrySource: lead.entrySource,
          createdByName,
          assignedToName,
          linkedBookingId: lead.linkedBookingId,
          bookingStatus,
          createdAt: lead.createdAt,
        };
      }));
      return res.json({ duplicate: true, leads: enriched });
    } catch (error: any) {
      console.error("Error checking duplicate leads:", error);
      res.status(500).json({ error: "Failed to check duplicate" });
    }
  });

  app.post("/api/leads/match", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { phone, email } = req.body;
      if (!phone && !email) {
        return res.status(400).json({ error: "Phone or email required" });
      }
      const matchedLead = await matchLeadByContact(phone, email);
      if (!matchedLead) {
        return res.json({ matched: false, lead: null });
      }
      let createdByName: string | null = null;
      let assignedToName: string | null = null;
      let convertedByName: string | null = null;
      if (matchedLead.createdBy) {
        const creator = await storage.getUser(matchedLead.createdBy);
        if (creator) createdByName = creator.name;
      }
      if (matchedLead.assignedToId) {
        const assignee = await storage.getUser(matchedLead.assignedToId);
        if (assignee) assignedToName = assignee.name;
      }
      if (matchedLead.convertedByUserId) {
        const converter = await storage.getUser(matchedLead.convertedByUserId);
        if (converter) convertedByName = converter.name;
      }
      let bookingInfo = null;
      if (matchedLead.linkedBookingId) {
        const booking = await storage.getBooking(matchedLead.linkedBookingId);
        if (booking) {
          let confirmedByName: string | null = null;
          if (booking.confirmedBy) {
            const confirmer = await storage.getUser(booking.confirmedBy);
            if (confirmer) confirmedByName = confirmer.name;
          }
          bookingInfo = {
            id: booking.id,
            status: booking.status,
            propertyId: booking.propertyId,
            confirmedBy: confirmedByName,
            confirmedAt: booking.confirmedAt,
            createdAt: booking.createdAt,
          };
        }
      }
      const activities = await storage.getLeadActivities(matchedLead.id);
      res.json({
        matched: true,
        lead: {
          ...matchedLead,
          createdByName,
          assignedToName,
          convertedByName,
        },
        booking: bookingInfo,
        recentActivities: activities.slice(0, 5),
      });
    } catch (error) {
      console.error("Error matching lead:", error);
      res.status(500).json({ error: "Failed to match lead" });
    }
  });

  // Get all leads (with optional propertyId filter)
  app.get("/api/leads", async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      let authenticatedUser: { id: string; role: string } | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const tokenStr = authHeader.substring(7);
        const payload = verifyToken(tokenStr);
        if (payload) {
          authenticatedUser = { id: payload.userId, role: payload.role };
        }
      }
      const user = authenticatedUser || req.session?.user;
      
      // If sales executive, only show leads assigned to them
      if (user?.role === "sales_executive") {
        const myLeads = await storage.getLeadsForSalesExec(user.id, propertyId || undefined);

        // Exclude leads belonging to staff members (mirrors the general branch filter)
        const staffUsersForSE = await storage.getUsersByRole(["admin", "superadmin", "manager", "staff", "sales_executive", "receptionist"]);
        const staffEmailsSE = new Set(staffUsersForSE.map(u => u.email?.toLowerCase()).filter(Boolean));
        const staffPhonesSE = new Set(staffUsersForSE.map(u => u.phone).filter(Boolean));
        const filteredMyLeads = myLeads.filter(lead => {
          if (lead.isManualEntry) return true;
          const email = lead.email?.toLowerCase();
          const phone = lead.phone;
          if (email && staffEmailsSE.has(email)) return false;
          if (phone && staffPhonesSE.has(phone)) return false;
          return true;
        });

        const userIds = new Set<string>();
        filteredMyLeads.forEach(l => {
          if (l.createdBy) userIds.add(l.createdBy);
          if (l.assignedToId) userIds.add(l.assignedToId);
          if (l.convertedByUserId) userIds.add(l.convertedByUserId);
        });
        const userMap = new Map<string, string>();
        for (const uid of userIds) {
          const u = await storage.getUser(uid);
          if (u) userMap.set(uid, u.name);
        }
        const enriched = filteredMyLeads.map(l => ({
          ...l,
          createdByName: l.createdBy ? userMap.get(l.createdBy) || null : null,
          assignedToName: l.assignedToId ? userMap.get(l.assignedToId) || null : null,
          convertedByName: l.convertedByUserId ? userMap.get(l.convertedByUserId) || null : null,
        }));
        return res.json(enriched);
      }
      
      let allLeads = await storage.getAllLeads(propertyId);

      if (user?.role === "receptionist") {
        const assigned = await storage.getAssignedPropertiesForUser(user.id);
        if (assigned.length > 0) {
          const allowed = new Set(assigned.map((p) => p.id));
          allLeads = allLeads.filter((l) => l.propertyId !== null && allowed.has(l.propertyId));
        }
      }

      const staffUsers = await storage.getUsersByRole(["admin", "superadmin", "manager", "staff", "sales_executive", "receptionist"]);
      const staffEmails = new Set(staffUsers.map(u => u.email?.toLowerCase()).filter(Boolean));
      const staffPhones = new Set(staffUsers.map(u => u.phone).filter(Boolean));
      
      const placeholderEmails = new Set(["noemail@gmail.com", "no@email.com", "na@na.com", "none@none.com", ""]);
      
      const seenPhones = new Set<string>();
      const seenEmails = new Set<string>();
      const uniqueLeads = allLeads.filter(lead => {
        const phone = lead.phone;
        const email = lead.email?.toLowerCase();
        
        if (!lead.isManualEntry) {
          if (email && staffEmails.has(email)) {
            return false;
          }
          if (phone && staffPhones.has(phone)) {
            return false;
          }
        }
        
        const isPlaceholderEmail = !email || placeholderEmails.has(email);
        
        if (phone && seenPhones.has(phone)) {
          return false;
        }
        if (!isPlaceholderEmail && email && seenEmails.has(email)) {
          return false;
        }
        
        if (phone) seenPhones.add(phone);
        if (!isPlaceholderEmail && email) seenEmails.add(email);
        return true;
      });
      
      const isPrivilegedUser = user && ["admin", "superadmin", "manager", "receptionist"].includes(user.role);
      if (isPrivilegedUser) {
        const userIds = new Set<string>();
        uniqueLeads.forEach(l => {
          if (l.createdBy) userIds.add(l.createdBy);
          if (l.assignedToId) userIds.add(l.assignedToId);
          if (l.convertedByUserId) userIds.add(l.convertedByUserId);
        });
        const userMap = new Map<string, string>();
        for (const uid of userIds) {
          const u = await storage.getUser(uid);
          if (u) userMap.set(uid, u.name);
        }
        const bookingIds = uniqueLeads.map(l => l.linkedBookingId).filter(Boolean) as string[];
        const bookingMap = new Map<string, { status: string; confirmedBy: string | null; confirmedByName: string | null; confirmedAt: Date | null }>();
        for (const bid of bookingIds) {
          const b = await storage.getBooking(bid);
          if (b) {
            let confirmedByName: string | null = null;
            if (b.confirmedBy) {
              if (userMap.has(b.confirmedBy)) {
                confirmedByName = userMap.get(b.confirmedBy)!;
              } else {
                const cu = await storage.getUser(b.confirmedBy);
                if (cu) { confirmedByName = cu.name; userMap.set(b.confirmedBy, cu.name); }
              }
            }
            bookingMap.set(bid, { status: b.status, confirmedBy: b.confirmedBy, confirmedByName, confirmedAt: b.confirmedAt });
          }
        }
        const enrichedLeads = uniqueLeads.map(l => ({
          ...l,
          createdByName: l.createdBy ? userMap.get(l.createdBy) || null : null,
          assignedToName: l.assignedToId ? userMap.get(l.assignedToId) || null : null,
          convertedByName: l.convertedByUserId ? userMap.get(l.convertedByUserId) || null : null,
          linkedBooking: l.linkedBookingId ? bookingMap.get(l.linkedBookingId) || null : null,
        }));
        return res.json(enrichedLeads);
      }
      
      res.json(uniqueLeads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Create a new lead (internal - from admin/sales exec panels)
  app.post("/api/leads", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { name, phone, email, propertyId, budgetMin, budgetMax, notes, source, isManualEntry } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ error: "Name and phone are required" });
      }

      let propertyName: string | null = null;
      if (propertyId) {
        const property = await storage.getProperty(propertyId);
        if (property) {
          propertyName = property.name;
        }
      }

      const lead = await storage.createLead({
        name,
        phone,
        email: email || null,
        propertyId: propertyId || null,
        propertyName,
        source: source || "website",
        entrySource: isManualEntry ? "walk_in" : null,
        status: "new",
        notes: notes || null,
        isManualEntry: isManualEntry || true,
        budgetMin: budgetMin || null,
        budgetMax: budgetMax || null,
        assignedToId: req.user?.role === "sales_executive" ? req.user.userId : null,
        assignmentType: req.user?.role === "sales_executive" ? "property_auto" : "unassigned",
        createdBy: req.user?.userId || null,
      });

      await storage.createAuditLog({
        adminId: req.user!.userId,
        action: "CREATE_LEAD",
        entityType: "lead",
        entityId: lead.id,
        details: JSON.stringify({ name, phone, source: source || "website" }),
      });

      res.status(201).json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  // Get lead by ID
  app.get("/api/leads/:id", async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id as string);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const payload = verifyToken(authHeader.substring(7));
        if (payload?.role === "receptionist") {
          const assigned = await storage.getAssignedPropertiesForUser(payload.userId);
          if (assigned.length > 0) {
            const allowed = new Set(assigned.map((p) => p.id));
            if (!lead.propertyId || !allowed.has(lead.propertyId)) {
              return res.status(403).json({ error: "Lead not in your assignment scope" });
            }
          }
        }
      }

      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  const validLeadStatuses = [
    "new", "contacted", "interested", "site_visit", "negotiation",
    "converted", "lost"
  ];

  // Update lead (update status, notes, source)
  app.patch("/api/leads/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { status, notes, source, name, email, phone, alternatePhone, budgetMin, budgetMax, priority } = req.body;
      const updateData: Record<string, any> = {};

      if (status !== undefined) {
        if (!validLeadStatuses.includes(status)) {
          return res.status(400).json({ error: "Invalid status value" });
        }
        updateData.status = status;
      }
      if (notes !== undefined) updateData.notes = notes;
      if (source !== undefined) updateData.source = source;
      if (name !== undefined) {
        if (typeof name !== "string" || !name.trim()) {
          return res.status(400).json({ error: "Name cannot be empty" });
        }
        updateData.name = name.trim();
      }
      if (email !== undefined) {
        const normalized = email ? normalizeEmail(email) : null;
        updateData.email = normalized || null;
      }
      if (phone !== undefined) {
        const normalized = phone ? normalizePhone(phone) : null;
        updateData.phone = normalized || null;
      }
      if (alternatePhone !== undefined) {
        const normalized = alternatePhone ? normalizePhone(alternatePhone) : null;
        updateData.alternatePhone = normalized || null;
      }
      if (budgetMin !== undefined) {
        updateData.budgetMin = budgetMin === null || budgetMin === "" ? null : Number(budgetMin);
      }
      if (budgetMax !== undefined) {
        updateData.budgetMax = budgetMax === null || budgetMax === "" ? null : Number(budgetMax);
      }
      if (priority !== undefined) updateData.priority = priority;

      // Sales executives may only edit leads assigned to them.
      if (req.user?.role === "sales_executive") {
        const existing = await storage.getLead(req.params.id as string);
        if (!existing) return res.status(404).json({ error: "Lead not found" });
        if (existing.assignedToId !== req.user.userId) {
          return res.status(403).json({ error: "Not authorized to edit this lead" });
        }
        if (existing.isLocked) {
          return res.status(403).json({ error: "Lead is locked and cannot be modified" });
        }
      }

      const lead = await storage.updateLead(req.params.id as string, updateData);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });
  
  app.patch("/api/leads/:id/status", authMiddleware, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      if (!validLeadStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      // Fetch lead to check ownership
      const existingLead = await storage.getLead(req.params.id as string);
      if (!existingLead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Sales executives can only update their assigned leads
      const user = (req as any).user;
      if (user?.role === "sales_executive" && existingLead.assignedToId !== user.userId) {
        return res.status(403).json({ error: "You can only update leads assigned to you" });
      }

      // Receptionists with property assignments can only update leads for their properties
      if (user?.role === "receptionist") {
        const assigned = await storage.getAssignedPropertiesForUser(user.userId);
        if (assigned.length > 0) {
          const allowed = new Set(assigned.map((p) => p.id));
          if (!existingLead.propertyId || !allowed.has(existingLead.propertyId)) {
            return res.status(403).json({ error: "Lead not in your assignment scope" });
          }
        }
      }
      
      let newScore = existingLead.score;
      let newPriority = existingLead.priority;
      
      if (status === "contacted") { newScore = Math.min(100, Math.max(newScore, 10)); newPriority = newScore > 60 ? "hot" : newScore > 30 ? "warm" : "cold"; }
      else if (status === "interested") { newScore = Math.min(100, Math.max(newScore, 20)); newPriority = newScore > 60 ? "hot" : "warm"; }
      else if (status === "site_visit") { newScore = Math.min(100, Math.max(newScore + 25, 40)); newPriority = newScore > 60 ? "hot" : "warm"; }
      else if (status === "negotiation") { newScore = Math.min(100, Math.max(newScore + 30, 60)); newPriority = "hot"; }
      else if (status === "converted") { newScore = 100; newPriority = "hot"; }
      else if (status === "lost") { newScore = 0; newPriority = "cold"; }

      const lead = await storage.updateLead(req.params.id as string, { 
        status,
        score: newScore,
        priority: newPriority,
        lastActivityAt: new Date()
      });
      res.json(lead);
    } catch (error) {
      console.error("Error updating lead status:", error);
      res.status(500).json({ error: "Failed to update lead status" });
    }
  });

  app.delete("/api/admin/leads/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id as string;
      const lead = await storage.getLead(id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const allBookings = await storage.getAllBookings();
      const leadBookings = allBookings.filter((b: any) => b.leadId === id);
      if (leadBookings.length > 0) {
        return res.status(400).json({ 
          error: `Cannot delete lead with ${leadBookings.length} existing booking(s). Please remove bookings first.` 
        });
      }

      await storage.deleteLead(id);

      await storage.createAuditLog({
        adminId: req.user!.userId,
        action: "DELETE_LEAD",
        entityType: "lead",
        entityId: id,
        details: JSON.stringify({ name: lead.name, email: lead.email, phone: lead.phone }),
      });

      res.json({ success: true, message: `Lead "${lead.name}" deleted successfully` });
    } catch (error) {
      console.error("Error deleting lead:", error);
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // Track property view and update lead status to "interested" with auto-scoring
  app.post("/api/leads/track-property-view", async (req, res) => {
    try {
      const { email, name, propertyId, propertyName } = req.body;
      
      if (!email || !propertyId) {
        return res.status(400).json({ error: "Email and propertyId required" });
      }

      const userAgent = req.headers["user-agent"] || "";
      const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || "";
      const deviceType = /mobile/i.test(userAgent) ? "mobile" : /tablet/i.test(userAgent) ? "tablet" : "desktop";

      // Check if lead already exists for this email AND property (prevent duplicates per property)
      let lead = await storage.getLeadByEmailAndProperty(email.toLowerCase(), propertyId);
      
      if (lead) {
        // Update existing lead's activity, status if still "new", and score
        const updates: any = { lastActivityAt: new Date() };
        if (lead.status === "new") {
          updates.status = "interested";
        }
        await storage.updateLead(lead.id, updates);
        // Update lead score for property view
        lead = await storage.updateLeadScore(lead.id, "property_view");
      } else {
        // Create new property-specific lead with status "interested" and initial score
        // Score: signup(5) + property_view(10) = 15, Priority: cold (0-30)
        const initialScore = 15;
        lead = await storage.createLead({
          name: name || "Unknown",
          email: email.toLowerCase(),
          propertyId,
          propertyName: propertyName || null,
          source: "website",
          status: "interested",
          ipAddress,
          userAgent,
          deviceType,
          score: initialScore,
          priority: initialScore >= 61 ? "hot" : initialScore >= 31 ? "warm" : "cold",
          signedUp: true, // Lead created from property view = signed up
          viewCount: 1,
        });
        
        // Auto-assign lead to sales executive based on property mapping
        if (lead && propertyId) {
          await autoAssignLead(lead.id, propertyId);
        }
      }
      
      res.json({ success: true, leadId: lead?.id, score: lead?.score, priority: lead?.priority });
    } catch (error) {
      console.error("Error tracking property view:", error);
      res.status(500).json({ error: "Failed to track property view" });
    }
  });

  // Update lead score for specific action (admin or internal use)
  app.post("/api/leads/:id/score", async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload || (payload.role !== "admin" && payload.role !== "superadmin")) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { action } = req.body as { action?: string };
      if (!action || typeof action !== 'string') {
        return res.status(400).json({ error: "Action required" });
      }

      const leadId = req.params.id as string;
      const lead = await storage.updateLeadScore(leadId, action);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Error updating lead score:", error);
      res.status(500).json({ error: "Failed to update lead score" });
    }
  });

  // Get lead score analytics (admin only)
  app.get("/api/leads/scores/analytics", async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload || (payload.role !== "admin" && payload.role !== "superadmin")) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const propertyIdParam = req.query.propertyId;
      const propertyId = typeof propertyIdParam === 'string' ? propertyIdParam : undefined;
      const analytics = await storage.getLeadScoreAnalytics(propertyId);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching lead score analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Get lead analytics (admin only)
  app.get("/api/leads/analytics/summary", async (req: AuthRequest, res) => {
    try {
      // Verify admin role
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload || (payload.role !== "admin" && payload.role !== "superadmin")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const analytics = await storage.getLeadAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching lead analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Get property-wise lead funnel (admin only)
  app.get("/api/leads/funnel/property/:propertyId", async (req: AuthRequest, res) => {
    try {
      // Verify admin role
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload || (payload.role !== "admin" && payload.role !== "superadmin")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const funnel = await storage.getPropertyLeadFunnel(req.params.propertyId as string);
      res.json(funnel);
    } catch (error) {
      console.error("Error fetching property lead funnel:", error);
      res.status(500).json({ error: "Failed to fetch property lead funnel" });
    }
  });

  // Get all properties lead funnels (admin only)
  app.get("/api/leads/funnel/all-properties", async (req: AuthRequest, res) => {
    try {
      // Verify admin role
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload || (payload.role !== "admin" && payload.role !== "superadmin")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const funnels = await storage.getAllPropertiesLeadFunnels();
      res.json(funnels);
    } catch (error) {
      console.error("Error fetching all property lead funnels:", error);
      res.status(500).json({ error: "Failed to fetch property lead funnels" });
    }
  });

  // Get leads for a specific property (admin only)
  app.get("/api/leads/property/:propertyId", async (req: AuthRequest, res) => {
    try {
      // Verify admin role
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload || (payload.role !== "admin" && payload.role !== "superadmin")) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const leads = await storage.getLeadsByProperty(req.params.propertyId as string);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching property leads:", error);
      res.status(500).json({ error: "Failed to fetch property leads" });
    }
  });

  // ============ CALENDAR INTEGRATION ============

  app.get("/api/calendar/events", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const payload = req.user;
      if (!payload || (payload.role !== "admin" && payload.role !== "superadmin" && payload.role !== "sales_executive" && payload.role !== "receptionist")) {
        return res.status(403).json({ error: "Access denied" });
      }

      const fromRaw = req.query.from ? new Date(req.query.from as string) : new Date();
      const toRaw = req.query.to ? new Date(req.query.to as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const from = isNaN(fromRaw.getTime()) ? new Date() : fromRaw;
      const to = isNaN(toRaw.getTime()) ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : toRaw;

      const conditions = [];

      if (payload.role === "sales_executive") {
        conditions.push(eq(schema.leads.assignedToId, payload.userId));
      }

      let allLeads = await db.select().from(schema.leads).where(
        conditions.length > 0 ? and(...conditions) : undefined
      );

      const scope = await getReceptionistScope(req);
      if (scope) {
        allLeads = allLeads.filter((l) => l.propertyId !== null && scope.has(l.propertyId));
      }

      const events: Array<{
        id: string;
        title: string;
        startAt: string;
        endAt: string;
        description: string;
        location?: string;
        sourceType: string;
        sourceId: string;
        leadName: string;
      }> = [];

      for (const lead of allLeads) {
        if (lead.followUpAt) {
          const followUpDate = new Date(lead.followUpAt);
          if (followUpDate >= from && followUpDate <= to) {
            const endDate = new Date(followUpDate.getTime() + 30 * 60 * 1000);
            events.push({
              id: `follow_up_${lead.id}`,
              title: `Follow-up: ${lead.name}`,
              startAt: followUpDate.toISOString(),
              endAt: endDate.toISOString(),
              description: `Follow-up with ${lead.name}${lead.followUpNotes ? '. Notes: ' + lead.followUpNotes : ''}`,
              location: lead.propertyName || undefined,
              sourceType: 'follow_up',
              sourceId: lead.id,
              leadName: lead.name,
            });
          }
        }

        if (lead.status === 'site_visit') {
          const visitDate = lead.followUpAt ? new Date(lead.followUpAt) : new Date(lead.createdAt);
          if (visitDate >= from && visitDate <= to) {
            const endDate = new Date(visitDate.getTime() + 60 * 60 * 1000);
            events.push({
              id: `site_visit_${lead.id}`,
              title: `Site Visit: ${lead.name}`,
              startAt: visitDate.toISOString(),
              endAt: endDate.toISOString(),
              description: `Site visit with ${lead.name}${lead.propertyName ? ' at ' + lead.propertyName : ''}`,
              location: lead.propertyName || undefined,
              sourceType: 'site_visit',
              sourceId: lead.id,
              leadName: lead.name,
            });
          }
        }
      }

      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });

  app.get("/api/calendar/events/:sourceType/:id/ics", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { sourceType, id } = req.params;
      const payload = req.user;

      if (!payload || (payload.role !== "admin" && payload.role !== "superadmin" && payload.role !== "sales_executive")) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (sourceType !== 'follow_up' && sourceType !== 'site_visit') {
        return res.status(400).json({ error: "Invalid source type" });
      }

      const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, id));
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      if (payload.role === "sales_executive" && lead.assignedToId !== payload.userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { generateICS } = await import("./calendar");
      let startAt: Date;
      let endAt: Date;
      let title: string;
      let description: string;

      if (sourceType === 'follow_up') {
        startAt = lead.followUpAt ? new Date(lead.followUpAt) : new Date(lead.createdAt);
        endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
        title = `Follow-up: ${lead.name}`;
        description = `Follow-up with ${lead.name}${lead.followUpNotes ? '. Notes: ' + lead.followUpNotes : ''}`;
      } else {
        startAt = lead.followUpAt ? new Date(lead.followUpAt) : new Date(lead.createdAt);
        endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
        title = `Site Visit: ${lead.name}`;
        description = `Site visit with ${lead.name}${lead.propertyName ? ' at ' + lead.propertyName : ''}`;
      }

      const icsContent = generateICS({
        id: `${sourceType}_${lead.id}`,
        title,
        startAt,
        endAt,
        description,
        location: lead.propertyName || undefined,
        sourceType: sourceType as 'follow_up' | 'site_visit' | 'booking',
        sourceId: lead.id,
      });

      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', 'attachment; filename="event.ics"');
      res.send(icsContent);
    } catch (error) {
      console.error("Error generating ICS:", error);
      res.status(500).json({ error: "Failed to generate calendar file" });
    }
  });

  // ============ CALENDAR SUBSCRIPTION FEED ============

  const CALENDAR_FEED_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;

  function generateCalendarFeedToken(userId: string): string {
    if (!CALENDAR_FEED_SECRET) {
      throw new Error("Calendar feed secret not configured");
    }
    return crypto.createHmac("sha256", CALENDAR_FEED_SECRET).update(`calendar-feed:${userId}`).digest("hex").substring(0, 40);
  }

  function verifyCalendarFeedToken(token: string, expectedToken: string): boolean {
    const tokenBuf = Buffer.from(token, "utf8");
    const expectedBuf = Buffer.from(expectedToken, "utf8");
    if (tokenBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  }

  const CALENDAR_FEED_ALLOWED_ROLES = ["admin", "superadmin", "manager", "sales_executive"];

  app.get("/api/calendar/feed-url", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.userId;
      const role = req.user?.role;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      if (!role || !CALENDAR_FEED_ALLOWED_ROLES.includes(role)) {
        return res.status(403).json({ error: "Calendar feed not available for your role" });
      }

      const token = generateCalendarFeedToken(userId);
      const baseUrl = (process.env.APP_PUBLIC_URL?.replace(/\/$/, "")) || `https://${req.headers.host}`;
      const feedUrl = `${baseUrl}/api/calendar/feed/${userId}/${token}`;
      const webcalUrl = feedUrl.replace(/^https?:\/\//, "webcal://");

      res.json({ feedUrl, webcalUrl, token });
    } catch (error) {
      console.error("Error generating calendar feed URL:", error);
      res.status(500).json({ error: "Failed to generate feed URL" });
    }
  });

  app.get("/api/calendar/feed/:userId/:token", async (req, res) => {
    try {
      const { userId, token } = req.params;
      const expectedToken = generateCalendarFeedToken(userId);

      if (!verifyCalendarFeedToken(token, expectedToken)) {
        return res.status(403).json({ error: "Invalid feed token" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!CALENDAR_FEED_ALLOWED_ROLES.includes(user.role)) {
        return res.status(403).json({ error: "Calendar feed not available for this user" });
      }

      const conditions = [];
      if (user.role === "sales_executive") {
        conditions.push(eq(schema.leads.assignedToId, userId));
      }

      const allLeads = await db.select().from(schema.leads).where(
        conditions.length > 0 ? and(...conditions) : undefined
      );

      const { generateICSFeed } = await import("./calendar");
      const calEvents: Array<{ id: string; title: string; startAt: Date; endAt: Date; description: string; location?: string; sourceType: 'follow_up' | 'site_visit' | 'booking'; sourceId: string }> = [];

      for (const lead of allLeads) {
        if (lead.followUpAt) {
          const followUpDate = new Date(lead.followUpAt);
          const endDate = new Date(followUpDate.getTime() + 30 * 60 * 1000);
          calEvents.push({
            id: `follow_up_${lead.id}`,
            title: `Follow-up: ${lead.name}`,
            startAt: followUpDate,
            endAt: endDate,
            description: `Follow-up with ${lead.name}${lead.phone ? '. Phone: ' + lead.phone : ''}${lead.followUpNotes ? '. Notes: ' + lead.followUpNotes : ''}`,
            location: lead.propertyName || undefined,
            sourceType: 'follow_up',
            sourceId: lead.id,
          });
        }

        if (lead.status === 'site_visit') {
          const visitDate = lead.followUpAt ? new Date(lead.followUpAt) : new Date(lead.createdAt);
          const endDate = new Date(visitDate.getTime() + 60 * 60 * 1000);
          calEvents.push({
            id: `site_visit_${lead.id}`,
            title: `Site Visit: ${lead.name}`,
            startAt: visitDate,
            endAt: endDate,
            description: `Site visit with ${lead.name}${lead.phone ? '. Phone: ' + lead.phone : ''}${lead.propertyName ? ' at ' + lead.propertyName : ''}`,
            location: lead.propertyName || undefined,
            sourceType: 'site_visit',
            sourceId: lead.id,
          });
        }
      }

      const today = new Date().toISOString().split("T")[0];
      const bookingQuery = user.role === "sales_executive"
        ? and(
            inArray(schema.bookings.status, ["confirmed", "active"]),
            eq(schema.bookings.assignedSalesExecId, userId),
            sql`${schema.bookings.checkInDate} >= ${today}`,
          )
        : and(
            inArray(schema.bookings.status, ["confirmed", "active"]),
            sql`${schema.bookings.checkInDate} >= ${today}`,
          );
      const confirmedBookings = await db.select({
        id: schema.bookings.id,
        bookingCode: schema.bookings.bookingCode,
        walkInName: schema.bookings.walkInName,
        walkInPhone: schema.bookings.walkInPhone,
        checkInDate: schema.bookings.checkInDate,
        checkOutDate: schema.bookings.checkOutDate,
        status: schema.bookings.status,
        propertyId: schema.bookings.propertyId,
      }).from(schema.bookings).where(bookingQuery);

      const bookingPropertyIds = [...new Set(confirmedBookings.map(b => b.propertyId))];
      const propertyNameMap: Record<string, string> = {};
      if (bookingPropertyIds.length > 0) {
        const props = await db.select({ id: schema.properties.id, name: schema.properties.name })
          .from(schema.properties)
          .where(inArray(schema.properties.id, bookingPropertyIds));
        for (const p of props) {
          propertyNameMap[p.id] = p.name;
        }
      }

      for (const booking of confirmedBookings) {
        if (booking.checkInDate) {
          const checkIn = new Date(booking.checkInDate + "T10:00:00Z");
          const endDate = new Date(checkIn.getTime() + 2 * 60 * 60 * 1000);
          const guestName = booking.walkInName || booking.bookingCode || "Guest";
          calEvents.push({
            id: `booking_checkin_${booking.id}`,
            title: `Check-in: ${guestName}`,
            startAt: checkIn,
            endAt: endDate,
            description: `Check-in for ${guestName}${booking.bookingCode ? ' (Booking: ' + booking.bookingCode + ')' : ''}${booking.walkInPhone ? '. Phone: ' + booking.walkInPhone : ''}`,
            location: propertyNameMap[booking.propertyId],
            sourceType: 'booking',
            sourceId: booking.id,
          });
        }
      }

      const calendarName = (user.role === "admin" || user.role === "superadmin")
        ? "Hsquare - All Events"
        : `Hsquare - ${user.name}'s Events`;

      const icsContent = generateICSFeed(calEvents, calendarName);

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="hsquare-calendar.ics"');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(icsContent);
    } catch (error) {
      console.error("Error generating calendar feed:", error);
      res.status(500).json({ error: "Failed to generate calendar feed" });
    }
  });

  // ============ FOLLOW-UP MANAGEMENT ============

  // Get overdue follow-ups (admin only)
  app.get("/api/leads/follow-ups/overdue", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const payload = req.user;
      if (!payload || (payload.role !== "admin" && payload.role !== "superadmin" && payload.role !== "sales_executive")) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const overdueLeads = await storage.getOverdueFollowUps();
      
      // Sales executives only see their assigned leads
      if (payload.role === "sales_executive") {
        const filteredLeads = overdueLeads.filter(lead => lead.assignedToId === payload.userId);
        return res.json(filteredLeads);
      }
      
      res.json(overdueLeads);
    } catch (error) {
      console.error("Error fetching overdue follow-ups:", error);
      res.status(500).json({ error: "Failed to fetch overdue follow-ups" });
    }
  });

  // Get upcoming follow-ups
  app.get("/api/leads/follow-ups/upcoming", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const payload = req.user;
      if (!payload || (payload.role !== "admin" && payload.role !== "superadmin" && payload.role !== "sales_executive")) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const hoursAhead = parseInt(req.query.hours as string) || 24;
      const upcomingLeads = await storage.getUpcomingFollowUps(hoursAhead);
      
      // Sales executives only see their assigned leads
      if (payload.role === "sales_executive") {
        const filteredLeads = upcomingLeads.filter(lead => lead.assignedToId === payload.userId);
        return res.json(filteredLeads);
      }
      
      res.json(upcomingLeads);
    } catch (error) {
      console.error("Error fetching upcoming follow-ups:", error);
      res.status(500).json({ error: "Failed to fetch upcoming follow-ups" });
    }
  });

  // Update follow-up for a lead
  app.patch("/api/leads/:id/follow-up", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const payload = req.user;
      if (!payload || (payload.role !== "admin" && payload.role !== "superadmin" && payload.role !== "sales_executive")) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { followUpAt, followUpStatus, followUpNotes } = req.body;
      const leadId = req.params.id;

      // Get the lead to check permissions
      const lead = await storage.getLead(leadId as string);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      // Sales executives can only update their own assigned leads
      if (payload.role === "sales_executive" && lead.assignedToId !== payload.userId) {
        return res.status(403).json({ error: "You can only update leads assigned to you" });
      }

      const updateData: Record<string, any> = {};
      if (followUpAt !== undefined) updateData.followUpAt = followUpAt ? new Date(followUpAt) : null;
      if (followUpStatus !== undefined) updateData.followUpStatus = followUpStatus;
      if (followUpNotes !== undefined) updateData.followUpNotes = followUpNotes;

      const updatedLead = await storage.updateLead(leadId as string, updateData);

      // Log activity
      await storage.createLeadActivity({
        leadId: leadId as string,
        actorId: payload.userId,
        actionType: "follow_up_updated",
        previousValue: JSON.stringify({ 
          followUpAt: lead.followUpAt, 
          followUpStatus: lead.followUpStatus 
        }),
        newValue: JSON.stringify({ followUpAt, followUpStatus }),
        description: followUpStatus === "completed" 
          ? "Marked follow-up as completed" 
          : `Updated follow-up to ${followUpAt ? new Date(followUpAt).toLocaleString() : "cleared"}`,
      });

      // Create notification for follow-up scheduled
      if (followUpAt && lead.assignedToId) {
        await storage.createNotification({
          userId: lead.assignedToId,
          title: "Follow-up Scheduled",
          message: `Follow-up scheduled for ${lead.name} on ${new Date(followUpAt).toLocaleDateString()}`,
          type: "lead",
          actionUrl: `/sales/leads/${leadId}`,
        });
      }

      res.json(updatedLead);
    } catch (error) {
      console.error("Error updating follow-up:", error);
      res.status(500).json({ error: "Failed to update follow-up" });
    }
  });

  // Mark overdue follow-ups (admin/cron job)
  app.post("/api/leads/follow-ups/mark-overdue", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const count = await storage.markOverdueFollowUps();
      res.json({ message: `Marked ${count} follow-ups as overdue`, count });
    } catch (error) {
      console.error("Error marking overdue follow-ups:", error);
      res.status(500).json({ error: "Failed to mark overdue follow-ups" });
    }
  });

  // ============ PROPERTIES ============
  
  // Get all properties with room types
  const enrichPropertyWithImages = async (property: any) => {
    let enriched = { ...property };
    if (!enriched.tourOverviewImages && !enriched.imageUrl) {
      const images = await storage.getImagesByProperty(property.id);
      if (images.length > 0) {
        const urls = images.map(img => img.imageUrl);
        enriched.tourOverviewImages = JSON.stringify(urls);
        enriched.imageUrl = urls[0];
        storage.updateProperty(property.id, {
          tourOverviewImages: JSON.stringify(urls),
          imageUrl: urls[0],
        }).catch(() => {});
      }
    }
    return enriched;
  };

  // Compute gender policy from a property's floors.
  // Returns "co-ed" if the property hosts (or can host) all genders,
  // "male" if only male-restricted floors, "female" if only female-restricted,
  // or null if there are no floors yet.
  const computeGenderPolicy = (
    floorList: Array<{ gender?: string | null }>,
  ): "co-ed" | "male" | "female" | null => {
    if (!floorList || floorList.length === 0) return null;
    let hasMale = false;
    let hasFemale = false;
    let hasAny = false;
    for (const f of floorList) {
      const g = (f.gender || "any").toLowerCase();
      if (g === "male") hasMale = true;
      else if (g === "female") hasFemale = true;
      else hasAny = true;
    }
    if (hasAny) return "co-ed";
    if (hasMale && hasFemale) return "co-ed";
    if (hasMale) return "male";
    if (hasFemale) return "female";
    return null;
  };

  app.get("/api/properties", async (req, res) => {
    try {
      const properties = await storage.getAllProperties();
      const propertiesWithRooms = await Promise.all(
        properties.map(async (property) => {
          const [roomTypes, enriched, propFloors] = await Promise.all([
            storage.getRoomTypesByProperty(property.id),
            enrichPropertyWithImages(property),
            storage.getFloorsByProperty(property.id),
          ]);
          return {
            ...enriched,
            roomTypes,
            genderPolicy: computeGenderPolicy(propFloors),
          };
        })
      );
      res.json(propertiesWithRooms);
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });

  // Get single property (by ID or slug)
  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getPropertyByIdOrSlug(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      const [roomTypes, enriched, nearbyLocs, propFloors] = await Promise.all([
        storage.getRoomTypesByProperty(property.id),
        enrichPropertyWithImages(property),
        storage.getNearbyLocationsByProperty(property.id),
        storage.getFloorsByProperty(property.id),
      ]);
      res.json({
        ...enriched,
        roomTypes,
        nearbyLocations: nearbyLocs,
        genderPolicy: computeGenderPolicy(propFloors),
      });
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ error: "Failed to fetch property" });
    }
  });

  // ============ Property Brochure Downloads ============
  // PDF is public (anyone can download). PPT is staff-only (admin/manager/
  // staff/sales_executive/receptionist + superadmin auto-included).
  app.get("/api/properties/:id/download/:format", brochureRateLimiter, async (req: AuthRequest, res) => {
    try {
      const { id, format } = req.params;
      if (format !== "pdf" && format !== "pptx") {
        return res.status(400).json({ error: "Invalid format. Use 'pdf' or 'pptx'." });
      }

      if (format === "pptx") {
        // Manually enforce staff-only auth for PPT.
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({ error: "Authentication required" });
        }
        const payload = verifyToken(authHeader.substring(7));
        if (!payload) return res.status(401).json({ error: "Invalid or expired token" });
        const STAFF_ROLES = new Set(["admin", "superadmin", "manager", "staff", "sales_executive", "receptionist"]);
        if (!STAFF_ROLES.has(payload.role)) {
          return res.status(403).json({ error: "Access denied. PPT downloads are restricted to staff." });
        }
        req.user = payload;
      }

      const property = await storage.getPropertyByIdOrSlug(id);
      if (!property) return res.status(404).json({ error: "Property not found" });

      // NOTE: We intentionally do not pass any caller-provided base URL — the brochure
      // generator only fetches images from a hardcoded host allowlist and from this same
      // server via loopback, to prevent SSRF via x-forwarded-host spoofing.
      const { generatePropertyBrochurePdf, generatePropertyBrochurePpt, getPropertyDownloadFilename } = await import("./property-collateral");

      const includePrice = String(req.query.price ?? "with").toLowerCase() !== "without";

      const buffer = format === "pdf"
        ? await generatePropertyBrochurePdf(property.id, { includePrice })
        : await generatePropertyBrochurePpt(property.id, { includePrice });

      if (!buffer) return res.status(500).json({ error: "Failed to generate brochure" });

      const filename = getPropertyDownloadFilename(property, format, { includePrice });
      res.setHeader("Content-Type", format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Length", String(buffer.length));
      res.end(buffer);

      storage.recordBrochureDownload(property.id).catch((e) => {
        console.error("Failed to record brochure download:", e);
      });
    } catch (err) {
      console.error("Brochure generation error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Failed to generate brochure" });
    }
  });

  // ============ NLP SEARCH ============
  
  const searchRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: "Too many search requests, please try again later" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const searchQuerySchema = z.object({
    query: z.string().max(500).optional().default(""),
    filters: z.object({
      city: z.string().max(100).nullable().optional(),
      minPrice: z.number().int().min(0).max(10000000).nullable().optional(),
      maxPrice: z.number().int().min(0).max(10000000).nullable().optional(),
      amenities: z.array(z.string().max(50)).max(20).nullable().optional(),
      roomType: z.string().max(50).nullable().optional(),
      occupancy: z.number().int().min(1).max(10).nullable().optional(),
      keywords: z.array(z.string().max(50)).max(10).nullable().optional(),
      sortBy: z.enum(["price_low", "price_high", "availability"]).nullable().optional(),
    }).optional(),
  });

  // Search properties with natural language query
  app.post("/api/search", searchRateLimiter, async (req, res) => {
    try {
      const parsed = searchQuerySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid search parameters" });
      }
      const { query, filters } = parsed.data;
      const results = await searchProperties(query || "", filters);
      res.json(results);
    } catch (error) {
      console.error("Error searching properties:", error);
      res.status(500).json({ error: "Failed to search properties" });
    }
  });

  // Get suggested filters for search UI
  app.get("/api/search/filters", searchRateLimiter, async (req, res) => {
    try {
      const filters = await getSuggestedFilters();
      res.json(filters);
    } catch (error) {
      console.error("Error getting search filters:", error);
      res.status(500).json({ error: "Failed to get search filters" });
    }
  });

  // Get all properties for admin (including inactive)
  app.get("/api/admin/properties", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const allProperties = await storage.getAllPropertiesIncludingInactive();
      const propertiesWithRooms = await Promise.all(
        allProperties.map(async (property) => {
          const roomTypes = await storage.getRoomTypesByProperty(property.id);
          return { ...property, roomTypes };
        })
      );
      res.json(propertiesWithRooms);
    } catch (error) {
      console.error("Error fetching all admin properties:", error);
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });

  // Update property tour images (Admin only)
  app.patch("/api/admin/properties/:id/tour-images", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const id = req.params.id as string;
      const { category, images } = req.body;
      
      // Validate category
      const validCategories = ["overview", "rooms", "amenities", "location"];
      if (!category || !validCategories.includes(category)) {
        return res.status(400).json({ error: "Invalid category. Must be one of: overview, rooms, amenities, location" });
      }
      
      // Validate images array
      if (!Array.isArray(images)) {
        return res.status(400).json({ error: "Images must be an array of URLs" });
      }
      
      const property = await storage.getProperty(id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Map category to column name
      const columnMap: Record<string, string> = {
        overview: "tourOverviewImages",
        rooms: "tourRoomsImages",
        amenities: "tourAmenitiesImages",
        location: "tourLocationImages",
      };
      
      const updates = {
        [columnMap[category]]: JSON.stringify(images),
      };

      const updatedProperty = await storage.updateProperty(id, updates);
      
      // Log the action
      await storage.createAuditLog({
        adminId: (req as AuthRequest).user!.userId,
        action: "UPDATE_PROPERTY_TOUR_IMAGES",
        entityType: "property",
        entityId: id,
        details: JSON.stringify({ name: property.name, category, imageCount: images.length }),
      });

      res.json(updatedProperty);
    } catch (error) {
      console.error("Error updating property tour images:", error);
      res.status(500).json({ error: "Failed to update property tour images" });
    }
  });

  // Toggle property active status (Admin only)
  app.patch("/api/admin/properties/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id as string;
      const property = await storage.getProperty(id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      const allowedFields = ["name", "displayName", "category", "bookingMode", "location", "address", "city", "phone", "alternatePhone", "email", "amenities", "rules", "mapsUrl", "imageUrl", "highlights", "status", "virtualTourUrl", "virtualTourProvider", "propertyCode", "tourOverviewImages", "includedServices", "moveInCharges", "mapLatitude", "mapLongitude", "brochureCoverImage", "brochureTagline", "brochureIntro", "brochureAgentName", "brochureAgentPhone", "featuredAmenityIds", "featuredRoomTypeIds"];
      const updates: any = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      updates.updatedAt = new Date();
      const updatedProperty = await storage.updateProperty(id, updates);
      await storage.createAuditLog({
        adminId: req.user!.userId,
        action: "EDIT_PROPERTY",
        entityType: "property",
        entityId: id,
        details: JSON.stringify({ name: updatedProperty?.name, fieldsUpdated: Object.keys(updates).filter(k => k !== "updatedAt") }),
      });
      res.json(updatedProperty);
    } catch (error) {
      console.error("Error updating property:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });

  app.post("/api/admin/properties/:id/toggle-status", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const id = req.params.id as string;
      
      const property = await storage.getProperty(id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const updatedProperty = await storage.updateProperty(id, { active: !property.active });
      
      // Log the action
      await storage.createAuditLog({
        adminId: (req as AuthRequest).user!.userId,
        action: property.active ? "DISABLE_PROPERTY" : "ENABLE_PROPERTY",
        entityType: "property",
        entityId: id,
        details: JSON.stringify({ name: property.name, newStatus: !property.active }),
      });

      res.json(updatedProperty);
    } catch (error) {
      console.error("Error toggling property status:", error);
      res.status(500).json({ error: "Failed to toggle property status" });
    }
  });

  app.delete("/api/admin/properties/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id as string;
      const property = await storage.getProperty(id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const allBookings = await storage.getAllBookings();
      const propertyBookings = allBookings.filter((b: any) => b.propertyId === id);
      if (propertyBookings.length > 0) {
        return res.status(400).json({ 
          error: `Cannot delete property with ${propertyBookings.length} existing booking(s). Please cancel or remove bookings first.` 
        });
      }

      await storage.deleteProperty(id);

      await storage.createAuditLog({
        adminId: req.user!.userId,
        action: "DELETE_PROPERTY",
        entityType: "property",
        entityId: id,
        details: JSON.stringify({ name: property.name }),
      });

      res.json({ success: true, message: `Property "${property.name}" deleted successfully` });
    } catch (error) {
      console.error("Error deleting property:", error);
      res.status(500).json({ error: "Failed to delete property" });
    }
  });

  // Update room type (Admin only)
  app.patch("/api/admin/room-types/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const id = req.params.id as string;
      const updates = req.body;
      
      const updatedRoomType = await storage.updateRoomType(id, updates);
      if (!updatedRoomType) {
        return res.status(404).json({ error: "Room type not found" });
      }

      res.json(updatedRoomType);
    } catch (error) {
      console.error("Error updating room type:", error);
      res.status(500).json({ error: "Failed to update room type" });
    }
  });

  // List ALL room types for a property (admin/receptionist) — includes
  // inactive ones so the Shift Bed dialog can offer every legitimate target,
  // not just the currently-active set returned by the public /api/properties/:id.
  app.get("/api/admin/properties/:propertyId/room-types", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const propertyId = req.params.propertyId;
      const scope = await getReceptionistScope(req);
      if (scope && !scope.has(propertyId)) {
        return res.status(403).json({ error: "Property not in your assignment scope" });
      }
      const rows = await db.select().from(schema.roomTypes).where(eq(schema.roomTypes.propertyId, propertyId));
      // Also count beds per room type at this property so the client can prefer
      // a type that actually has beds when the booking's stored type has none.
      const bedRows = await db
        .select({ roomTypeId: schema.beds.roomTypeId })
        .from(schema.beds)
        .where(eq(schema.beds.propertyId, propertyId));
      const bedCountByType = new Map<string, number>();
      for (const b of bedRows) {
        if (!b.roomTypeId) continue;
        bedCountByType.set(b.roomTypeId, (bedCountByType.get(b.roomTypeId) || 0) + 1);
      }
      const enriched = rows.map(rt => ({
        ...rt,
        bedCountAtProperty: bedCountByType.get(rt.id) || 0,
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error listing all room types:", error);
      res.status(500).json({ error: "Failed to list room types" });
    }
  });

  // Create room type (Admin only)
  app.post("/api/admin/properties/:propertyId/room-types", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const propertyId = req.params.propertyId;
      const roomData = { ...req.body, propertyId };
      const roomType = await storage.createRoomType(roomData);
      res.status(201).json(roomType);
    } catch (error) {
      console.error("Error creating room type:", error);
      res.status(500).json({ error: "Failed to create room type" });
    }
  });

  // Delete room type (Admin only)
  app.delete("/api/admin/room-types/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const id = req.params.id as string;
      await storage.deleteRoomType(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting room type:", error);
      res.status(500).json({ error: "Failed to delete room type" });
    }
  });

  // ============ GLOBAL AMENITIES ============

  // Get all global amenities
  app.get("/api/amenities", async (req, res) => {
    try {
      const amenities = await storage.getAllGlobalAmenities();
      res.json(amenities);
    } catch (error) {
      console.error("Error fetching amenities:", error);
      res.status(500).json({ error: "Failed to fetch amenities" });
    }
  });

  // Create global amenity (Admin only)
  app.post("/api/admin/amenities", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { name, icon, category } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Amenity name is required" });
      }
      const amenity = await storage.createGlobalAmenity({ name, icon, category });
      res.status(201).json(amenity);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Amenity already exists" });
      }
      console.error("Error creating amenity:", error);
      res.status(500).json({ error: "Failed to create amenity" });
    }
  });

  // Delete global amenity (Admin only)
  app.delete("/api/admin/amenities/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      await storage.deleteGlobalAmenity(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting amenity:", error);
      res.status(500).json({ error: "Failed to delete amenity" });
    }
  });

  // ============ PROPERTY RULES ============

  // Get rules for a property
  app.get("/api/properties/:propertyId/rules", async (req, res) => {
    try {
      const rules = await storage.getRulesByProperty(req.params.propertyId as string);
      res.json(rules);
    } catch (error) {
      console.error("Error fetching rules:", error);
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  });

  // Create property rule (Admin only)
  app.post("/api/admin/properties/:propertyId/rules", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const propertyId = req.params.propertyId as string;
      const { rule, sortOrder } = req.body;
      const created = await storage.createPropertyRule({ propertyId, rule, sortOrder: sortOrder || 0 });
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating rule:", error);
      res.status(500).json({ error: "Failed to create rule" });
    }
  });

  // Update property rule (Admin only)
  app.patch("/api/admin/rules/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const updated = await storage.updatePropertyRule(req.params.id as string, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Rule not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating rule:", error);
      res.status(500).json({ error: "Failed to update rule" });
    }
  });

  // Delete property rule (Admin only)
  app.delete("/api/admin/rules/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      await storage.deletePropertyRule(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rule:", error);
      res.status(500).json({ error: "Failed to delete rule" });
    }
  });

  // ============ NEARBY LOCATIONS ============

  // Get nearby locations for a property
  app.get("/api/properties/:propertyId/nearby", async (req, res) => {
    try {
      const locations = await storage.getNearbyLocationsByProperty(req.params.propertyId as string);
      res.json(locations);
    } catch (error) {
      console.error("Error fetching nearby locations:", error);
      res.status(500).json({ error: "Failed to fetch nearby locations" });
    }
  });

  // Create nearby location (Admin only)
  app.post("/api/admin/properties/:propertyId/nearby", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const propertyId = req.params.propertyId as string;
      const { placeName, distance, category } = req.body;
      const created = await storage.createNearbyLocation({ propertyId, placeName, distance, category });
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating nearby location:", error);
      res.status(500).json({ error: "Failed to create nearby location" });
    }
  });

  // Delete nearby location (Admin only)
  app.delete("/api/admin/nearby/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      await storage.deleteNearbyLocation(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting nearby location:", error);
      res.status(500).json({ error: "Failed to delete nearby location" });
    }
  });

  // ============ PROPERTY TARIFFS ============

  // Get tariffs for a property
  app.get("/api/properties/:propertyId/tariffs", async (req, res) => {
    try {
      const tariffs = await storage.getTariffsByProperty(req.params.propertyId as string);
      res.json(tariffs);
    } catch (error) {
      console.error("Error fetching tariffs:", error);
      res.status(500).json({ error: "Failed to fetch tariffs" });
    }
  });

  // Create property tariff (Admin only)
  app.post("/api/admin/properties/:propertyId/tariffs", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const propertyId = req.params.propertyId as string;
      const { academicYear, monthlyPrice, deposit, discount, discountLabel } = req.body;
      const created = await storage.createPropertyTariff({ 
        propertyId, 
        academicYear, 
        monthlyPrice, 
        deposit, 
        discount, 
        discountLabel 
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating tariff:", error);
      res.status(500).json({ error: "Failed to create tariff" });
    }
  });

  // Delete property tariff (Admin only)
  app.delete("/api/admin/tariffs/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      await storage.deletePropertyTariff(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tariff:", error);
      res.status(500).json({ error: "Failed to delete tariff" });
    }
  });

  // ============ PROPERTY IMAGES ============

  // Get images for a property
  app.get("/api/properties/:propertyId/images", async (req, res) => {
    try {
      const images = await storage.getImagesByProperty(req.params.propertyId as string);
      res.json(images);
    } catch (error) {
      console.error("Error fetching images:", error);
      res.status(500).json({ error: "Failed to fetch images" });
    }
  });

  // Create property image (Admin only)
  app.post("/api/admin/properties/:propertyId/images", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const propertyId = req.params.propertyId as string;
      const { imageUrl, caption, isPrimary, sortOrder, roomTypeId } = req.body;
      const created = await storage.createPropertyImage({ 
        propertyId, 
        imageUrl, 
        caption, 
        isPrimary: isPrimary || false, 
        sortOrder: sortOrder || 0, 
        roomTypeId 
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating image:", error);
      res.status(500).json({ error: "Failed to create image" });
    }
  });

  // Update property image (Admin only)
  app.patch("/api/admin/images/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const updated = await storage.updatePropertyImage(req.params.id as string, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Image not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating image:", error);
      res.status(500).json({ error: "Failed to update image" });
    }
  });

  // Delete property image (Admin only)
  app.delete("/api/admin/images/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      await storage.deletePropertyImage(req.params.id as string);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting image:", error);
      res.status(500).json({ error: "Failed to delete image" });
    }
  });

  // ============ CREATE PROPERTY (Full) ============

  // Create a new property with all related data (Admin only)
  app.post("/api/admin/properties", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { 
        name, 
        displayName, 
        category,
        bookingMode, 
        location, 
        city, 
        address, 
        phone, 
        email, 
        mapsUrl, 
        amenities, 
        status,
        customFields,
        rules,
        nearbyLocations: nearby,
        tariffs,
        roomTypes: rooms,
        propertyCode,
      } = req.body;

      // Create the property
      let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existing = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.slug, slug));
      if (existing.length > 0) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
      const property = await storage.createProperty({
        name,
        slug,
        displayName,
        category,
        bookingMode: bookingMode || "monthly",
        location,
        city,
        address,
        phone,
        email,
        mapsUrl,
        amenities: amenities || [],
        rules: null,
        nearbyLocations: null,
        customFields: customFields ? JSON.stringify(customFields) : null,
        status: status || "draft",
        propertyCode: propertyCode || null,
      });

      // Create property rules
      if (rules && Array.isArray(rules)) {
        for (let i = 0; i < rules.length; i++) {
          await storage.createPropertyRule({
            propertyId: property.id,
            rule: rules[i],
            sortOrder: i,
          });
        }
      }

      // Create nearby locations
      if (nearby && Array.isArray(nearby)) {
        for (const loc of nearby) {
          await storage.createNearbyLocation({
            propertyId: property.id,
            placeName: loc.placeName,
            distance: loc.distance,
            category: loc.category,
          });
        }
      }

      // Create tariffs
      if (tariffs && Array.isArray(tariffs)) {
        for (const tariff of tariffs) {
          await storage.createPropertyTariff({
            propertyId: property.id,
            academicYear: tariff.academicYear,
            monthlyPrice: tariff.monthlyPrice,
            deposit: tariff.deposit,
            discount: tariff.discount,
            discountLabel: tariff.discountLabel,
          });
        }
      }

      // Create room types
      if (rooms && Array.isArray(rooms)) {
        for (const room of rooms) {
          await storage.createRoomType({
            propertyId: property.id,
            name: room.name,
            customName: room.customName,
            basePrice: room.basePrice,
            academicYearPrice: room.academicYearPrice || null,
            deposit: room.deposit || 0,
            size: room.size,
            occupancy: room.occupancy,
            totalRooms: room.totalRooms,
            totalBeds: room.totalBeds,
            availableBeds: room.availableBeds || room.totalBeds,
          });
        }
      }

      // Create property images and auto-populate tour overview
      const { images } = req.body;
      const tourImageUrls: string[] = [];
      if (images && Array.isArray(images)) {
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          await storage.createPropertyImage({
            propertyId: property.id,
            imageUrl: img.imageUrl,
            caption: img.caption || null,
            isPrimary: img.isPrimary || false,
            sortOrder: img.order ?? i,
            roomTypeId: null,
          });
          tourImageUrls.push(img.imageUrl);
        }
      }

      if (tourImageUrls.length > 0) {
        await storage.updateProperty(property.id, {
          tourOverviewImages: JSON.stringify(tourImageUrls),
          imageUrl: tourImageUrls[0],
        });
      }

      // Log the action
      await storage.createAuditLog({
        adminId: (req as AuthRequest).user!.userId,
        action: "CREATE_PROPERTY",
        entityType: "property",
        entityId: property.id,
        details: JSON.stringify({ name: property.name, status: property.status }),
      });

      // Return property with all related data
      const updatedProperty = tourImageUrls.length > 0 
        ? await storage.getProperty(property.id) || property 
        : property;
      const propertyRules = await storage.getRulesByProperty(property.id);
      const propertyNearby = await storage.getNearbyLocationsByProperty(property.id);
      const propertyTariffs = await storage.getTariffsByProperty(property.id);
      const propertyRoomTypes = await storage.getRoomTypesByProperty(property.id);

      res.status(201).json({
        ...updatedProperty,
        rules: propertyRules,
        nearbyLocations: propertyNearby,
        tariffs: propertyTariffs,
        roomTypes: propertyRoomTypes,
      });
    } catch (error) {
      console.error("Error creating property:", error);
      res.status(500).json({ error: "Failed to create property" });
    }
  });

  // Publish/Unpublish property (Admin only)
  app.post("/api/admin/properties/:id/publish", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const id = req.params.id as string;
      const property = await storage.getProperty(id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const newStatus = property.status === "published" ? "draft" : "published";
      const updated = await storage.updateProperty(id, { status: newStatus });

      await storage.createAuditLog({
        adminId: (req as AuthRequest).user!.userId,
        action: newStatus === "published" ? "PUBLISH_PROPERTY" : "UNPUBLISH_PROPERTY",
        entityType: "property",
        entityId: id,
        details: JSON.stringify({ name: property.name, status: newStatus }),
      });

      res.json(updated);
    } catch (error) {
      console.error("Error publishing property:", error);
      res.status(500).json({ error: "Failed to publish property" });
    }
  });

  // ============ STUDENTS ============
  
  // Register student
  app.post("/api/students/register", async (req, res) => {
    try {
      const studentData = insertStudentSchema.parse(req.body);
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Create user account (hash the password properly)
      const hashedPwd = await hashPassword("temp123");
      const user = await storage.createUser({
        name: studentData.fullName,
        email: req.body.email,
        password: hashedPwd,
        role: "user",
      });

      // Create student profile
      const student = await storage.createStudent({
        ...studentData,
        userId: user.id,
      });

      res.json({ user, student });
    } catch (error) {
      console.error("Error registering student:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: "Failed to register student" });
    }
  });

  // Get student by user ID
  app.get("/api/students/by-user/:userId", async (req, res) => {
    try {
      const student = await storage.getStudentByUserId(req.params.userId);
      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      res.json(student);
    } catch (error) {
      console.error("Error fetching student:", error);
      res.status(500).json({ error: "Failed to fetch student" });
    }
  });

  // Get all students (admin)
  app.get("/api/students", async (req, res) => {
    try {
      const students = await storage.getAllStudents();
      res.json(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      res.status(500).json({ error: "Failed to fetch students" });
    }
  });

  // ============ BOOKINGS ============
  
  // Create booking
  app.post("/api/bookings", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { studentId, propertyId, roomTypeId, baseFee, paymentPlanId, discount, discountReason, selectedPlanId: legacySelectedPlanId } = req.body;

      const scope = await getReceptionistScope(req);
      if (scope && (!propertyId || !scope.has(propertyId))) {
        return res.status(403).json({ error: "Property not in your assignment scope" });
      }

      // Validate room availability
      const roomType = await storage.getRoomType(roomTypeId);
      if (!roomType || roomType.availableBeds <= 0) {
        return res.status(400).json({ error: "Room not available" });
      }
      // Cross-property mutation guard: roomType must belong to propertyId.
      // Prevents a scoped caller from decrementing an out-of-scope room
      // type while creating a booking under an assigned property.
      if (roomType.propertyId !== propertyId) {
        return res.status(400).json({ error: "Room type does not belong to this property" });
      }

      // Calculate total fee (including move-in charges from property)
      const totalDiscount = discount || 0;
      const legacyProperty = await storage.getProperty(propertyId);
      const legacyMic = legacyProperty?.moveInCharges as { serviceLegalCharges?: number; policeVerification?: number; agreement?: number } | null;
      const legacyMicTotal = (legacyMic?.serviceLegalCharges || 0) || ((legacyMic?.policeVerification || 0) + (legacyMic?.agreement || 0));
      const totalFee = baseFee - totalDiscount + legacyMicTotal;

      const booking = await storage.createBooking({
        studentId,
        propertyId,
        roomTypeId,
        baseFee,
        discount: totalDiscount,
        totalFee,
        paymentPlanId,
        discountReason: discountReason || null,
        discountApprovedBy: null,
        discountApprovedAt: null,
        agreementUrl: null,
        signatureData: null,
        createdBy: (req as AuthRequest).user!.userId,
      });

      // Create installments
      const installmentData = calculateInstallments(baseFee, paymentPlanId, totalDiscount);
      const installments = await storage.createInstallments(
        installmentData.map(inst => ({
          bookingId: booking.id,
          name: inst.name,
          amount: inst.amount,
          dueDate: inst.dueDate,
        }))
      );

      // Auto-attach selected housing plan if provided
      if (legacySelectedPlanId) {
        try {
          const [selectedPkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, legacySelectedPlanId));
          if (selectedPkg && selectedPkg.category === "housing_plan") {
            const legacyPlanItems = await db.select().from(schema.packageItems).where(eq(schema.packageItems.packageId, legacySelectedPlanId)).orderBy(schema.packageItems.sortOrder);
            const legacyBase = Number(selectedPkg.basePrice) || 0;
            const legacySnapshot = {
              name: selectedPkg.name,
              basePrice: selectedPkg.basePrice,
              totalPrice: legacyBase,
              priceType: selectedPkg.priceType,
              category: selectedPkg.category,
              amount: legacyBase,
              cadence: selectedPkg.priceType,
              items: legacyPlanItems.map(i => ({ type: i.type, label: i.label, includedQty: i.includedQty, unit: i.unit, extraUnitPrice: i.extraUnitPrice, rules: i.rules, featureValue: i.featureValue })),
            };
            const [legacyBp] = await db.insert(schema.bookingPackages).values({
              bookingId: booking.id,
              packageId: legacySelectedPlanId,
              startDate: new Date(),
              endDate: null,
              priceSnapshot: legacySnapshot,
              status: "ACTIVE",
            }).returning();

            const legacyAlacart = legacyPlanItems.find(i => i.type === "ala_cart_credit" && i.includedQty > 0);
            if (legacyAlacart && legacyBp) {
              await db.insert(schema.walletLedger).values({
                bookingId: booking.id,
                credit: legacyAlacart.includedQty,
                debit: 0,
                refType: "package_credit",
                refId: legacyBp.id,
                note: `Initial credit from package "${selectedPkg.name}"`,
              });
            }
          }
        } catch (e: any) {
          console.error("Failed to auto-attach housing plan:", e.message);
        }
      }

      // Decrease available beds
      await storage.updateRoomTypeAvailability(roomTypeId, -1);

      res.json({ booking, installments });
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  app.get("/api/bookings/completed", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      const allBookings = await storage.getAllBookings();
      
      let filtered = allBookings;
      
      if (user?.role === "sales_executive") {
        filtered = filtered.filter((b: any) => b.assignedSalesExecId === user.userId || b.createdBy === user.userId);
      }

      const scope = await getReceptionistScope(req);
      if (scope) {
        filtered = filtered.filter((b) => b.propertyId !== null && scope.has(b.propertyId));
      }

      if (filtered.length === 0) {
        return res.json([]);
      }

      const bookingIds = filtered.map(b => b.id);
      const propertyIds = [...new Set(filtered.map(b => b.propertyId).filter(Boolean))];
      const roomTypeIds = [...new Set(filtered.map(b => b.roomTypeId).filter(Boolean))];
      const studentIds = [...new Set(filtered.filter(b => b.studentId).map(b => b.studentId!))];
      const leadIds = [...new Set(filtered.filter(b => b.leadId).map(b => b.leadId!))];
      const userIds = [...new Set([
        ...filtered.filter(b => b.assignedSalesExecId).map(b => b.assignedSalesExecId!),
        ...filtered.filter(b => b.createdBy).map(b => b.createdBy!),
      ])];

      const [propertiesList, roomTypesList, studentsList, leadsList, usersList, allInstallments, allPayments, allHousingPlans, allAddonPackages] = await Promise.all([
        propertyIds.length > 0 ? db.select().from(schema.properties).where(inArray(schema.properties.id, propertyIds)) : Promise.resolve([]),
        roomTypeIds.length > 0 ? db.select().from(schema.roomTypes).where(inArray(schema.roomTypes.id, roomTypeIds)) : Promise.resolve([]),
        studentIds.length > 0 ? db.select().from(schema.students).where(inArray(schema.students.id, studentIds)) : Promise.resolve([]),
        leadIds.length > 0 ? db.select().from(schema.leads).where(inArray(schema.leads.id, leadIds)) : Promise.resolve([]),
        userIds.length > 0 ? db.select().from(schema.users).where(inArray(schema.users.id, userIds)) : Promise.resolve([]),
        db.select().from(schema.installments).where(inArray(schema.installments.bookingId, bookingIds)),
        db.select().from(schema.payments).where(inArray(schema.payments.bookingId, bookingIds)),
        db.select({
          bookingId: schema.bookingPackages.bookingId,
          planName: schema.packages.name,
          tierLevel: schema.packages.tierLevel,
          tagline: schema.packages.tagline,
          basePrice: schema.packages.basePrice,
          priceSnapshot: schema.bookingPackages.priceSnapshot,
          createdAt: schema.bookingPackages.createdAt,
        })
          .from(schema.bookingPackages)
          .innerJoin(schema.packages, eq(schema.bookingPackages.packageId, schema.packages.id))
          .where(and(
            inArray(schema.bookingPackages.bookingId, bookingIds),
            eq(schema.bookingPackages.status, "ACTIVE"),
            eq(schema.packages.category, "housing_plan"),
          )),
        db.select({
          bookingId: schema.bookingPackages.bookingId,
          basePrice: schema.packages.basePrice,
          priceSnapshot: schema.bookingPackages.priceSnapshot,
          displayPriceOverride: schema.bookingPackages.displayPriceOverride,
          includeInTotal: schema.bookingPackages.includeInTotal,
          paidStatus: schema.bookingPackages.paidStatus,
          paidAmount: schema.bookingPackages.paidAmount,
        })
          .from(schema.bookingPackages)
          .innerJoin(schema.packages, eq(schema.bookingPackages.packageId, schema.packages.id))
          .where(and(
            inArray(schema.bookingPackages.bookingId, bookingIds),
            eq(schema.bookingPackages.status, "ACTIVE"),
            eq(schema.packages.category, "addon_service"),
          )),
      ]);

      const propertyMap = new Map(propertiesList.map(p => [p.id, p]));
      const roomTypeMap = new Map(roomTypesList.map(r => [r.id, r]));
      const studentMap = new Map(studentsList.map(s => [s.id, s]));
      const leadMap = new Map(leadsList.map(l => [l.id, l]));
      const userMap = new Map(usersList.map(u => [u.id, u]));
      const installmentMap = new Map<string, any[]>();
      for (const inst of allInstallments) {
        if (!installmentMap.has(inst.bookingId)) installmentMap.set(inst.bookingId, []);
        installmentMap.get(inst.bookingId)!.push(inst);
      }
      const paymentMap = new Map<string, any[]>();
      for (const pay of allPayments) {
        if (!paymentMap.has(pay.bookingId)) paymentMap.set(pay.bookingId, []);
        paymentMap.get(pay.bookingId)!.push(pay);
      }
      const housingPlanMap = new Map<string, any>();
      for (const hp of allHousingPlans) {
        const existing = housingPlanMap.get(hp.bookingId);
        if (!existing || (hp.createdAt && existing.createdAt && hp.createdAt > existing.createdAt)) {
          housingPlanMap.set(hp.bookingId, hp);
        }
      }

      const addonRevenueMap = new Map<string, { revenue: number; collected: number; pending: number; count: number }>();
      for (const ap of allAddonPackages) {
        if (ap.includeInTotal === false) continue;
        const snap = (ap.priceSnapshot as any)?.totalPrice;
        const effective = Number(
          ap.displayPriceOverride ?? (snap != null ? snap : null) ?? ap.basePrice ?? 0,
        );
        if (!(effective > 0)) continue;
        const paid = ap.paidStatus === "paid" ? Number(ap.paidAmount || effective) : 0;
        const entry = addonRevenueMap.get(ap.bookingId) || { revenue: 0, collected: 0, pending: 0, count: 0 };
        entry.revenue += effective;
        entry.collected += paid;
        entry.pending += Math.max(0, effective - paid);
        entry.count += 1;
        addonRevenueMap.set(ap.bookingId, entry);
      }

      const enriched = filtered.map((booking: any) => {
        const property = propertyMap.get(booking.propertyId);
        const roomType = roomTypeMap.get(booking.roomTypeId);

        let customerName = booking.walkInName || "Unknown";
        let customerPhone = booking.walkInPhone || "";
        let customerEmail = booking.walkInEmail || "";

        if (booking.studentId) {
          const student = studentMap.get(booking.studentId);
          if (student) {
            customerName = student.fullName;
            customerPhone = student.phone || "";
            customerEmail = student.email;
          }
        } else if (booking.leadId) {
          const lead = leadMap.get(booking.leadId);
          if (lead) {
            customerName = lead.name;
            customerPhone = lead.phone || "";
            customerEmail = lead.email || "";
          }
        }

        const salesExec = booking.assignedSalesExecId ? userMap.get(booking.assignedSalesExecId) : null;
        const creator = booking.createdBy ? userMap.get(booking.createdBy) : null;
        const hp = housingPlanMap.get(booking.id);
        const housingPlanInfo = hp ? {
          planName: hp.planName,
          tierLevel: hp.tierLevel ?? 0,
          tagline: hp.tagline || null,
          priceSnapshot: hp.priceSnapshot,
          basePrice: hp.basePrice,
        } : null;

        return {
          ...booking,
          propertyName: property?.name || "Unknown",
          propertyLocation: property?.location || "",
          propertyIncludedServices: property?.includedServices || null,
          propertyMoveInCharges: property?.moveInCharges || null,
          roomTypeName: roomType?.customName || roomType?.name || "Unknown",
          roomTypeSize: roomType?.size || "",
          occupancy: roomType?.occupancy || 0,
          customerName,
          customerPhone,
          customerEmail,
          salesExecName: salesExec?.fullName || null,
          createdByName: creator?.name || null,
          installments: installmentMap.get(booking.id) || [],
          payments: paymentMap.get(booking.id) || [],
          housingPlanInfo,
          addonRevenue: addonRevenueMap.get(booking.id)?.revenue || 0,
          addonCollected: addonRevenueMap.get(booking.id)?.collected || 0,
          addonPending: addonRevenueMap.get(booking.id)?.pending || 0,
          addonCount: addonRevenueMap.get(booking.id)?.count || 0,
        };
      });
      
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching completed bookings:", error);
      res.status(500).json({ error: "Failed to fetch completed bookings" });
    }
  });

  // Get pending approval bookings (admin only) — must be before /:id route
  app.get("/api/bookings/pending-approval", authMiddleware, roleMiddleware("admin", "manager"), async (req, res) => {
    try {
      const bookings = await storage.getPendingApprovalBookings();
      
      const enrichedBookings = [];
      for (const booking of bookings) {
        try {
          const property = booking.propertyId ? await storage.getProperty(booking.propertyId) : null;
          const roomType = booking.roomTypeId ? await storage.getRoomType(booking.roomTypeId) : null;
          const createdByUser = booking.createdBy ? await storage.getUser(booking.createdBy) : null;
          
          enrichedBookings.push({
            ...booking,
            propertyName: property?.name || "Unknown Property",
            roomTypeName: roomType?.customName || roomType?.name || "Unknown Room",
            createdByName: createdByUser?.name || "Unknown",
          });
        } catch (enrichErr) {
          enrichedBookings.push({
            ...booking,
            propertyName: "Unknown Property",
            roomTypeName: "Unknown Room",
            createdByName: "Unknown",
          });
        }
      }
      
      res.json(enrichedBookings);
    } catch (error) {
      console.error("Error fetching pending approval bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // Get booking by ID with details
  app.get("/api/bookings/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const scope = await getReceptionistScope(req);
      if (scope && (!booking.propertyId || !scope.has(booking.propertyId))) {
        return res.status(403).json({ error: "Booking not in your assignment scope" });
      }

      const [student, property, roomType, installments, payments] = await Promise.all([
        booking.studentId ? storage.getStudent(booking.studentId) : Promise.resolve(undefined),
        storage.getProperty(booking.propertyId),
        storage.getRoomType(booking.roomTypeId),
        storage.getInstallmentsByBooking(booking.id),
        storage.getPaymentsByBooking(booking.id),
      ]);

      res.json({ booking, student, property, roomType, installments, payments });
    } catch (error) {
      console.error("Error fetching booking:", error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // Get bookings by student
  app.get("/api/students/:studentId/bookings", async (req, res) => {
    try {
      const bookings = await storage.getBookingsByStudent(req.params.studentId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching student bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  app.delete("/api/admin/bookings/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const id = req.params.id as string;
      const booking = await storage.getBooking(id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      await storage.deleteBooking(id);
      await storage.createAuditLog({
        adminId: req.user!.userId,
        action: "DELETE_BOOKING",
        entityType: "booking",
        entityId: id,
        details: JSON.stringify({ bookingCode: booking.bookingCode }),
      });
      res.json({ success: true, message: "Booking deleted successfully" });
    } catch (error) {
      console.error("Error deleting booking:", error);
      res.status(500).json({ error: "Failed to delete booking" });
    }
  });

  // Get all bookings (admin)
  app.get("/api/bookings", authMiddleware, async (req: AuthRequest, res) => {
    try {
      let bookings = await storage.getAllBookings();
      const scope = await getReceptionistScope(req);
      if (scope) {
        bookings = bookings.filter((b) => b.propertyId !== null && scope.has(b.propertyId));
      }
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // Get booking by code
  app.get("/api/bookings/code/:code", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const booking = await storage.getBookingByCode(req.params.code);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      const scope = await getReceptionistScope(req);
      if (scope && (!booking.propertyId || !scope.has(booking.propertyId))) {
        return res.status(403).json({ error: "Booking not in your assignment scope" });
      }
      res.json(booking);
    } catch (error) {
      console.error("Error fetching booking by code:", error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // Get bookings by property
  app.get("/api/properties/:propertyId/bookings", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const scope = await getReceptionistScope(req);
      if (scope && !scope.has(req.params.propertyId)) {
        return res.status(403).json({ error: "Property not in your assignment scope" });
      }
      const bookings = await storage.getBookingsByProperty(req.params.propertyId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching property bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  app.get("/api/my-bookings", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.userId;
      // Sales-exec-aware lookup: includes bookings where the user is the
      // creator OR the attributed sales exec (e.g. an admin/receptionist
      // generated the booking from a lead this user owns/converted).
      const bookings = await storage.getBookingsForSalesExec(userId);
      const enriched = await Promise.all(bookings.map(async (b) => {
        const [property, roomType, installments, payments] = await Promise.all([
          storage.getProperty(b.propertyId),
          storage.getRoomType(b.roomTypeId),
          storage.getInstallmentsByBooking(b.id),
          storage.getPaymentsByBooking(b.id),
        ]);
        return { ...b, property, roomType, installments, payments };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // Get bookings created by user (for sales executives)
  app.get("/api/bookings/created-by/:userId", async (req, res) => {
    try {
      const bookings = await storage.getBookingsByCreator(req.params.userId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // Get room type availability
  app.get("/api/room-types/:roomTypeId/availability", async (req, res) => {
    try {
      const availability = await storage.getRoomTypeAvailability(req.params.roomTypeId);
      res.json(availability);
    } catch (error) {
      console.error("Error fetching availability:", error);
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  });

  // Create booking with workflow (supports walk-in, lead, student)
  app.post("/api/beds/hold", async (req, res) => {
    try {
      const { bedId, sessionId } = req.body;
      if (!bedId || !sessionId) return res.status(400).json({ error: "bedId and sessionId required" });
      const bed = await storage.getBed(bedId);
      if (!bed) return res.status(404).json({ error: "Bed not found" });
      if (bed.status !== "available") return res.status(400).json({ error: "Bed is not available", status: bed.status });
      const holdResult = await isBedHeld(bedId);
      if (holdResult.held && holdResult.heldBy !== sessionId) {
        return res.status(409).json({ error: "This bed is currently being booked by someone else. Please choose another bed.", held: true });
      }
      await holdBed(bedId, sessionId);
      res.json({ success: true, expiresIn: BED_HOLD_DURATION / 1000 });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/beds/release", async (req, res) => {
    try {
      const { bedId, sessionId } = req.body;
      if (bedId && sessionId) await releaseBed(bedId, sessionId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bookings/generate", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const {
        customerType,
        studentId,
        leadId,
        walkInName,
        walkInPhone,
        walkInEmail,
        referrer,
        propertyId,
        roomTypeId,
        bedId,
        floorId,
        selectedPlanId,
        stayPlanType,
        checkInDate,
        checkOutDate,
        durationMonths,
        baseFee,
        deposit,
        discount,
        discountReason,
        paymentType,
        tokenAmount,
        numberOfInstallments,
        customBookingAmount,
        installmentAmounts,
        installmentDueDates,
        paymentPlanId,
        createdBy,
        assignedSalesExecId,
        residentDetails,
        registrationRequestId,
      } = req.body;

      // Receptionist scope: scoped receptionists may only generate bookings
      // on their assigned properties, and the supplied roomType / bed / floor
      // (when present) must belong to that same property to prevent cross-
      // scope mutation via crafted IDs.
      const generateScope = await getReceptionistScope(req);
      if (generateScope) {
        if (!propertyId || !generateScope.has(propertyId)) {
          return res.status(403).json({ error: "Property not in your assignment scope" });
        }
        if (roomTypeId) {
          const rt = await storage.getRoomType(roomTypeId);
          if (!rt || rt.propertyId !== propertyId) {
            return res.status(400).json({ error: "Room type does not belong to this property" });
          }
        }
        if (bedId) {
          const b = await storage.getBed(bedId);
          if (!b || b.propertyId !== propertyId) {
            return res.status(400).json({ error: "Bed does not belong to this property" });
          }
        }
        if (floorId) {
          const fp = await getPropertyIdForFloor(floorId);
          if (!fp || fp !== propertyId) {
            return res.status(400).json({ error: "Floor does not belong to this property" });
          }
        }
        if (leadId) {
          const l = await storage.getLead(leadId);
          if (l && l.propertyId && !generateScope.has(l.propertyId)) {
            return res.status(403).json({ error: "Lead not in your assignment scope" });
          }
        }
      }

      let bookingEmail = walkInEmail || residentDetails?.email || null;
      if (!bookingEmail && customerType === "student" && studentId) {
        const studentRecord = await storage.getStudent(studentId);
        if (studentRecord) bookingEmail = studentRecord.email;
      }
      // Resolve the lead once so we can both fall back to its email AND
      // auto-attribute the booking to the lead's owning sales exec below.
      // Type comes from storage.getLead so we don't reach for `any`.
      let leadRecord: Awaited<ReturnType<typeof storage.getLead>> | null = null;
      if (customerType === "lead" && leadId) {
        leadRecord = (await storage.getLead(leadId)) ?? null;
        if (!bookingEmail && leadRecord?.email) bookingEmail = leadRecord.email;
      }

      // If the client did not explicitly supply assignedSalesExecId AND this
      // booking is being generated from a lead, credit the sales exec who
      // owns / converted that lead. This makes admin- and receptionist-
      // initiated bookings show up in the right exec's My Bookings without
      // anyone having to re-key the assignment. Sales execs creating their
      // own booking already pass assignedSalesExecId from the client (see
      // client/src/pages/booking-generation.tsx) so we don't override that.
      let resolvedAssignedSalesExecId: string | null = assignedSalesExecId || null;
      if (!resolvedAssignedSalesExecId && customerType === "lead" && leadRecord) {
        resolvedAssignedSalesExecId =
          leadRecord.assignedToId || leadRecord.convertedByUserId || null;
      }
      if (!bookingEmail || !bookingEmail.trim() || !bookingEmail.includes("@")) {
        return res.status(400).json({ error: "A valid email address is required for booking" });
      }

      const roomType = await storage.getRoomType(roomTypeId);
      if (!roomType || roomType.availableBeds <= 0) {
        return res.status(400).json({ error: "No beds available for this room type" });
      }

      // Prevent duplicate bookings: check if same phone already has an active booking on this property
      let dupCheckPhone = walkInPhone || residentDetails?.phone || null;
      if (!dupCheckPhone && customerType === "student" && studentId) {
        const studentRecord = await storage.getStudent(studentId);
        if (studentRecord) dupCheckPhone = studentRecord.phone;
      }
      if (!dupCheckPhone && customerType === "lead" && leadRecord) {
        dupCheckPhone = leadRecord.phone;
      }
      if (dupCheckPhone) {
        const normalizedPhone = dupCheckPhone.replace(/\D/g, "").slice(-10);
        if (normalizedPhone.length >= 10) {
          const existingBookings = await db.select().from(schema.bookings).where(eq(schema.bookings.propertyId, propertyId));
          const duplicateBooking = existingBookings.find(b => {
            if (b.status === "cancelled" || b.status === "completed") return false;
            const bPhone = (b.walkInPhone || "").replace(/\D/g, "").slice(-10);
            const rdPhone = ((b.residentDetails as any)?.phone || "").replace(/\D/g, "").slice(-10);
            return bPhone === normalizedPhone || rdPhone === normalizedPhone;
          });
          if (duplicateBooking) {
            return res.status(400).json({
              error: `This phone number already has an active booking (${duplicateBooking.bookingCode}) for this property. Cannot create a duplicate booking.`
            });
          }
        }
      }

      // Prevent double-booking the same bed
      if (bedId) {
        const existingBedBooking = await db.select().from(schema.bookings).where(eq(schema.bookings.bedId, bedId));
        const activeBedBooking = existingBedBooking.find(b => b.status !== "cancelled" && b.status !== "completed");
        if (activeBedBooking) {
          return res.status(400).json({
            error: `This bed is already assigned to booking ${activeBedBooking.bookingCode}. Please select a different bed.`
          });
        }
      }

      // Validate bed availability if bedId provided
      let resolvedBedId: string | null = bedId || null;
      let resolvedFloorId: string | null = floorId || null;
      let resolvedRoomId: string | null = null;
      let resolvedRoomTypeId: string = roomTypeId;

      if (resolvedBedId) {
        const bed = await storage.getBed(resolvedBedId);
        if (!bed) {
          return res.status(400).json({ error: "Selected bed not found" });
        }
        if (bed.status !== "available") {
          return res.status(400).json({ error: "Selected bed is no longer available. Please choose another bed." });
        }
        try {
          const guestGender = (req.body?.gender ?? residentDetails?.gender) || "";
          await assertGenderCompatible(resolvedBedId, guestGender);
        } catch (genderErr: any) {
          return res.status(genderErr?.status || 400).json({ error: genderErr?.message || "Gender mismatch for this floor" });
        }
        resolvedFloorId = bed.floorId || resolvedFloorId;
        resolvedRoomId = bed.roomId || null;
        if (bed.roomId) {
          const bedRoom = await storage.getRoom(bed.roomId);
          if (bedRoom?.typology?.includes("+")) {
            const parts = bedRoom.typology.replace(/\s*bed\s*/gi, "").trim().split("+").map((p: string) => parseInt(p));
            const sectionIndex = parts.findIndex((_: number, i: number) => {
              const sectionLetter = String.fromCharCode(65 + i);
              return bed.bedNumber?.includes(`${bedRoom.roomNumber}${sectionLetter}`);
            });
            if (sectionIndex >= 0) {
              const sectionBedCount = parts[sectionIndex];
              const propRoomTypes = await storage.getRoomTypesByProperty(propertyId);
              const matchingRT = propRoomTypes.find((rt: any) => rt.occupancy === sectionBedCount);
              if (matchingRT) {
                resolvedRoomTypeId = matchingRT.id;
              }
            }
          } else if (bed.roomTypeId) {
            resolvedRoomTypeId = bed.roomTypeId;
          }
        } else if (bed.roomTypeId) {
          resolvedRoomTypeId = bed.roomTypeId;
        }
      }

      // Calculate total fee (including move-in charges from property)
      const totalDiscount = discount || 0;
      const genProperty = await storage.getProperty(propertyId);
      const genMic = genProperty?.moveInCharges as { serviceLegalCharges?: number; policeVerification?: number; agreement?: number } | null;
      const genMicTotal = (genMic?.serviceLegalCharges || 0) || ((genMic?.policeVerification || 0) + (genMic?.agreement || 0));
      const totalFee = baseFee - totalDiscount + genMicTotal;

      // Determine approval requirement based on discount percentage
      const discountPercent = baseFee > 0 ? (totalDiscount / baseFee) * 100 : 0;
      const approvalRequired = discountPercent > 10;

      // Determine initial status
      let initialStatus = "draft";
      if (approvalRequired) {
        initialStatus = "pending_approval";
      } else if (paymentType === "full" || paymentType === "partial" || paymentType === "installments") {
        initialStatus = "pending_payment";
      }

      // For student type, check if student exists locally before setting FK
      let validStudentId: string | null = null;
      if (customerType === "student" && studentId) {
        const localStudent = await storage.getStudent(studentId);
        if (localStudent) {
          validStudentId = studentId;
        }
      }

      // Create booking with code
      const booking = await storage.createBookingWithCode({
        customerType: customerType || "walk_in",
        studentId: validStudentId,
        leadId: customerType === "lead" ? leadId : null,
        walkInName: walkInName || null,
        walkInPhone: walkInPhone || null,
        walkInEmail: walkInEmail || null,
        referrer: referrer || null,
        propertyId,
        roomTypeId: resolvedRoomTypeId,
        bedId: resolvedBedId,
        floorId: resolvedFloorId,
        roomId: resolvedRoomId,
        stayPlanType: stayPlanType || "academic_year",
        checkInDate: checkInDate || null,
        checkOutDate: checkOutDate || null,
        durationMonths: durationMonths || null,
        baseFee,
        deposit: deposit || 0,
        discount: totalDiscount,
        totalFee,
        paymentPlanId: paymentPlanId || "custom",
        paymentType: paymentType || "full",
        discountReason: discountReason || null,
        discountApprovedBy: null,
        discountApprovedAt: null,
        status: initialStatus,
        approvalRequired,
        approvalStatus: approvalRequired ? "pending" : "not_required",
        createdBy: (req as AuthRequest).user!.userId,
        assignedSalesExecId: resolvedAssignedSalesExecId,
        agreementUrl: null,
        signatureData: null,
        residentDetails: residentDetails || null,
      });

      // Auto-attach selected housing plan as a booking package
      if (selectedPlanId) {
        try {
          const [selectedPkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, selectedPlanId));
          if (selectedPkg && selectedPkg.category === "housing_plan") {
            const planItems = await db.select().from(schema.packageItems).where(eq(schema.packageItems.packageId, selectedPlanId)).orderBy(schema.packageItems.sortOrder);
            const planBase = Number(selectedPkg.basePrice) || 0;
            const planSnapshot = {
              name: selectedPkg.name,
              basePrice: selectedPkg.basePrice,
              totalPrice: planBase,
              priceType: selectedPkg.priceType,
              taxPercent: selectedPkg.taxPercent,
              category: selectedPkg.category,
              amount: planBase,
              cadence: selectedPkg.priceType,
              items: planItems.map(i => ({ type: i.type, label: i.label, includedQty: i.includedQty, unit: i.unit, extraUnitPrice: i.extraUnitPrice, rules: i.rules, featureValue: i.featureValue })),
            };
            const [attachedBp] = await db.insert(schema.bookingPackages).values({
              bookingId: booking.id,
              packageId: selectedPlanId,
              startDate: checkInDate ? new Date(checkInDate) : new Date(),
              endDate: checkOutDate ? new Date(checkOutDate) : null,
              priceSnapshot: planSnapshot,
              status: "ACTIVE",
            }).returning();

            const alacartCreditItem = planItems.find(i => i.type === "ala_cart_credit" && i.includedQty > 0);
            if (alacartCreditItem && attachedBp) {
              await db.insert(schema.walletLedger).values({
                bookingId: booking.id,
                credit: alacartCreditItem.includedQty,
                debit: 0,
                refType: "package_credit",
                refId: attachedBp.id,
                note: `Initial credit from package "${selectedPkg.name}"`,
              });
            }
          }
        } catch (e: any) {
          console.error("Failed to auto-attach housing plan:", e.message);
        }
      }

      // Mark the bed as reserved, clear hold, and update availability counts
      if (resolvedBedId) {
        await db.delete(schema.bedHolds).where(eq(schema.bedHolds.bedId, resolvedBedId));
        await storage.updateBedStatus(resolvedBedId, "reserved");
        await storage.updateRoomTypeAvailability(resolvedRoomTypeId, -1);

        if (resolvedFloorId) {
          const floorBeds = await storage.getBedsByFloor(resolvedFloorId);
          const availCount = floorBeds.filter(b => b.status === "available").length;
          await db.update(schema.floors).set({ availableBeds: availCount }).where(eq(schema.floors.id, resolvedFloorId));
        }
      }

      // Create installment records based on payment type
      const installmentRecords: any[] = [];
      if (paymentType === "partial" && tokenAmount) {
        installmentRecords.push(
          { bookingId: booking.id, name: "Booking Amount (Token)", amount: tokenAmount, dueDate: "Immediate" },
          { bookingId: booking.id, name: "Balance Payment", amount: totalFee - tokenAmount, dueDate: "Before Move-in" }
        );
      } else if (paymentType === "installments" && numberOfInstallments) {
        const numInstallments = numberOfInstallments || 2;
        const customAmts: number[] = Array.isArray(installmentAmounts) && installmentAmounts.length > 0 ? installmentAmounts : [];
        const customFirst = customAmts.length === 0 && customBookingAmount && customBookingAmount > 0 ? customBookingAmount : 0;
        const dueDates: string[] = installmentDueDates || [];
        for (let i = 0; i < numInstallments; i++) {
          let amount: number;
          if (customAmts.length > 0 && customAmts[i] > 0) {
            amount = customAmts[i];
          } else if (customAmts.length > 0) {
            const usedByCustom = customAmts.filter((a: number) => a > 0).reduce((s: number, a: number) => s + a, 0);
            const autoCount = customAmts.filter((a: number, idx: number) => idx < numInstallments && (!a || a <= 0)).length;
            const remaining = totalFee - usedByCustom;
            const perAuto = Math.round(remaining / Math.max(autoCount, 1));
            amount = perAuto;
          } else if (customFirst > 0) {
            if (i === 0) {
              amount = customFirst;
            } else {
              const remaining = totalFee - customFirst;
              const remainingParts = numInstallments - 1;
              const perRemaining = Math.round(remaining / remainingParts);
              const isLast = i === numInstallments - 1;
              amount = isLast ? remaining - (perRemaining * (remainingParts - 1)) : perRemaining;
            }
          } else {
            const perInstallment = Math.round(totalFee / numInstallments);
            const isLast = i === numInstallments - 1;
            amount = isLast ? totalFee - (perInstallment * (numInstallments - 1)) : perInstallment;
          }
          const dueDate = dueDates[i] || (i === 0 ? "Immediate" : `Installment ${i} Due`);
          installmentRecords.push({
            bookingId: booking.id,
            name: i === 0 ? "Booking Amount" : `Installment ${i}`,
            amount,
            dueDate,
          });
        }
      } else {
        installmentRecords.push(
          { bookingId: booking.id, name: "Full Payment", amount: totalFee, dueDate: "Immediate" }
        );
      }
      let createdInstallments: any[] = [];
      if (installmentRecords.length > 0) {
        createdInstallments = await storage.createInstallments(installmentRecords);
      }

      if (customerType === "lead" && leadId) {
        const authUser = (req as AuthRequest).user!;
        await storage.updateLead(leadId, {
          status: "converted",
          bookingInitiated: true,
          linkedBookingId: booking.id,
          convertedByUserId: authUser.userId,
          convertedAt: new Date(),
        });
      } else {
        const contactPhone = walkInPhone || residentDetails?.phone;
        const contactEmail = walkInEmail || residentDetails?.email;
        if (contactPhone || contactEmail) {
          const matchedLead = await matchLeadByContact(contactPhone, contactEmail);
          if (matchedLead && matchedLead.status !== "converted") {
            const authUser = (req as AuthRequest).user!;
            await storage.updateLead(matchedLead.id, {
              status: "converted",
              bookingInitiated: true,
              linkedBookingId: booking.id,
              convertedByUserId: authUser.userId,
              convertedAt: new Date(),
            });
          }
        }
      }

      let registrationUpdateWarning: string | undefined;
      if (registrationRequestId) {
        try {
          const [existingReg] = await db.select()
            .from(schema.registrationRequests)
            .where(eq(schema.registrationRequests.id, registrationRequestId))
            .limit(1);
          if (!existingReg) {
            registrationUpdateWarning = "Registration request not found";
          } else if (existingReg.status === "booked") {
            registrationUpdateWarning = "Registration already marked as booked";
          } else if (!["pending", "reviewed", "approved"].includes(existingReg.status)) {
            registrationUpdateWarning = `Cannot transition from status '${existingReg.status}' to booked`;
          } else {
            await db.update(schema.registrationRequests)
              .set({ status: "booked", bookingId: booking.id, updatedAt: new Date() })
              .where(eq(schema.registrationRequests.id, registrationRequestId));
          }
        } catch (e: any) {
          console.error("Failed to update registration request status:", e.message);
          registrationUpdateWarning = "Failed to update registration status: " + e.message;
        }
      }

      res.json({ booking, requiresApproval: approvalRequired, installments: createdInstallments, registrationUpdateWarning });
    } catch (error) {
      console.error("Error generating booking:", error);
      res.status(500).json({ error: "Failed to generate booking" });
    }
  });

  // Approve booking (admin only)
  app.post("/api/bookings/:id/approve", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const payload = verifyToken(token);
      if (!payload || !["admin", "superadmin", "manager"].includes(payload.role)) {
        return res.status(403).json({ error: "Admin access required" });
      }
      if (!payload.userId) {
        return res.status(401).json({ error: "Invalid token payload" });
      }
      
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.approvalStatus !== "pending") {
        return res.status(400).json({ error: "Booking is not pending approval" });
      }

      const updated = await storage.updateBooking(req.params.id, {
        approvalStatus: "approved",
        approvedBy: payload.userId,
        approvedAt: new Date(),
        status: "pending_payment",
      });

      res.json(updated);
    } catch (error) {
      console.error("Error approving booking:", error);
      res.status(500).json({ error: "Failed to approve booking" });
    }
  });

  // Reject booking (admin only)
  app.post("/api/bookings/:id/reject", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const payload = verifyToken(token);
      if (!payload || !["admin", "superadmin", "manager"].includes(payload.role)) {
        return res.status(403).json({ error: "Admin access required" });
      }
      if (!payload.userId) {
        return res.status(401).json({ error: "Invalid token payload" });
      }
      
      const { rejectionReason } = req.body;
      
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.status !== "cancelled") {
        if (booking.bedId) {
          await storage.updateBedStatus(booking.bedId, "available");
          await storage.updateRoomTypeAvailability(booking.roomTypeId, 1);
          if (booking.floorId) {
            const floorBeds = await storage.getBedsByFloor(booking.floorId);
            const availCount = floorBeds.filter((b: any) => b.status === "available").length;
            await db.update(schema.floors).set({ availableBeds: availCount }).where(eq(schema.floors.id, booking.floorId));
          }
        } else if (booking.bedAllocated) {
          await storage.updateRoomTypeAvailability(booking.roomTypeId, 1);
        }
      }

      const updated = await storage.updateBooking(req.params.id, {
        approvalStatus: "rejected",
        rejectedBy: payload.userId,
        rejectionReason: rejectionReason || "Discount not approved",
        status: "cancelled",
      });

      res.json(updated);
    } catch (error) {
      console.error("Error rejecting booking:", error);
      res.status(500).json({ error: "Failed to reject booking" });
    }
  });

  // Confirm booking (after payment)
  app.post("/api/bookings/:id/confirm", authMiddleware, async (req, res) => {
    try {
      const { approvedBy } = req.body;
      
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if booking can be confirmed
      if (booking.status !== "pending_payment" && booking.status !== "draft") {
        return res.status(400).json({ error: "Booking cannot be confirmed in current status" });
      }

      const authUser = (req as AuthRequest).user!;
      const confirmed = await storage.confirmBooking(req.params.id, approvedBy);

      if (confirmed && confirmed.status === "confirmed") {
        await db.update(schema.bookings)
          .set({ confirmedBy: authUser.userId, confirmedAt: new Date() })
          .where(eq(schema.bookings.id, confirmed.id));

        if (confirmed.leadId) {
          await storage.updateLead(confirmed.leadId, {
            status: "converted",
            bookingConfirmed: true,
            convertedByUserId: authUser.userId,
            convertedAt: new Date(),
            linkedBookingId: confirmed.id,
          });
        } else {
          const residentDetails = confirmed.residentDetails as any;
          const contactPhone = confirmed.walkInPhone || residentDetails?.phone;
          const contactEmail = confirmed.walkInEmail || residentDetails?.email;
          if (contactPhone || contactEmail) {
            const matchedLead = await matchLeadByContact(contactPhone, contactEmail);
            if (matchedLead && matchedLead.status !== "converted") {
              await storage.updateLead(matchedLead.id, {
                status: "converted",
                bookingConfirmed: true,
                convertedByUserId: authUser.userId,
                convertedAt: new Date(),
                linkedBookingId: confirmed.id,
              });
            }
          }
        }

        autoSyncBookingToHMS(confirmed).catch(err => {
          console.error("[HMS Auto-Sync] Background sync failed:", err);
        });

        checkAndSendMilestone(confirmed.propertyId).catch(err => {
          console.error("[Milestone] Background check failed:", err);
        });
      }

      res.json(confirmed);
    } catch (error: any) {
      console.error("Error confirming booking:", error);
      res.status(500).json({ error: error.message || "Failed to confirm booking" });
    }
  });

  // Cancel booking
  app.post("/api/bookings/:id/cancel", authMiddleware, async (req, res) => {
    try {
      const { reason } = req.body;
      
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const cancelled = await storage.cancelBooking(req.params.id, reason);

      if (cancelled) {
        if (cancelled.leadId) {
          await storage.updateLead(cancelled.leadId, {
            status: "lost",
            bookingConfirmed: false,
            linkedBookingId: null,
            convertedByUserId: null,
          });
        } else {
          const residentDetails = cancelled.residentDetails as any;
          const contactPhone = cancelled.walkInPhone || residentDetails?.phone;
          const contactEmail = cancelled.walkInEmail || residentDetails?.email;
          if (contactPhone || contactEmail) {
            const matchedLead = await matchLeadByContact(contactPhone, contactEmail);
            if (matchedLead && matchedLead.linkedBookingId === cancelled.id) {
              await storage.updateLead(matchedLead.id, {
                status: "lost",
                bookingConfirmed: false,
                linkedBookingId: null,
                convertedByUserId: null,
              });
            }
          }
        }
      }

      res.json(cancelled);
    } catch (error) {
      console.error("Error cancelling booking:", error);
      res.status(500).json({ error: "Failed to cancel booking" });
    }
  });

  // ============ PAYMENTS ============
  
  // Create payment (simulate Razorpay)
  app.post("/api/payments", async (req, res) => {
    try {
      const { bookingId, amount, installmentId } = req.body;

      // Validate payment amount against booking balance
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      const existingPayments = await storage.getPaymentsByBooking(bookingId);
      const totalPaid = existingPayments.filter(p => p.status === "success").reduce((sum, p) => sum + (p.amount || 0), 0);
      const remainingBalance = (booking.totalFee || 0) - totalPaid;
      if (remainingBalance <= 0) {
        return res.status(400).json({ error: "Booking is already fully paid" });
      }
      const payAmount = Math.min(amount, remainingBalance);

      // Simulate payment processing
      const payment = await storage.createPayment({
        bookingId,
        installmentId: installmentId || null,
        amount: payAmount,
        status: "pending",
        razorpayOrderId: null,
        razorpayPaymentId: null,
        razorpaySignature: null,
        paymentMethod: null,
        failureReason: null,
      });

      // Simulate success after 2 seconds
      setTimeout(async () => {
        await storage.updatePayment(payment.id, {
          status: "success",
          razorpayPaymentId: `pay_${Date.now()}`,
        });

        // Mark installment as paid
        if (installmentId) {
          await storage.updateInstallment(installmentId, {
            paid: true,
            paidAt: new Date(),
          });
        }

        // Update booking status if booking amount paid
        const booking = await storage.getBooking(bookingId);
        if (booking && booking.status === "pending_payment") {
          await storage.updateBooking(bookingId, {
            status: "active",
          });

          if (booking.bedId) {
            await storage.updateBedStatus(booking.bedId, "occupied");
            if (booking.floorId) {
              const floorBeds = await storage.getBedsByFloor(booking.floorId);
              const availCount = floorBeds.filter(b => b.status === "available").length;
              await db.update(schema.floors).set({ availableBeds: availCount }).where(eq(schema.floors.id, booking.floorId));
            }
          }

          const updatedBooking = await storage.getBooking(bookingId);
          if (updatedBooking) {
            const allPayments = await storage.getPaymentsByBooking(bookingId);
            const successPayments = allPayments.filter(p => p.status === "success");
            const previousSuccessful = successPayments.filter(p => p.id !== payment.id);

            if (previousSuccessful.length === 0) {
              sendParentBookingConfirmationEmail(updatedBooking, payAmount).catch(err => {
                console.error("[Email] Background parent email after online payment failed:", err);
              });
            } else {
              sendPaymentReceivedEmail(updatedBooking, payAmount).catch(err => {
                console.error("[Email] Background payment received email after online payment failed:", err);
              });
            }

            if (!updatedBooking.welcomeEmailSent) {
              sendWelcomeEmailForBooking(updatedBooking).catch(err => {
                console.error("[Email] Background welcome email after online payment failed:", err);
              });
            }

            autoSyncBookingToHMS(updatedBooking).catch(err => {
              console.error("[HMS Auto-Sync] Background sync after payment failed:", err);
            });

            checkAndSendMilestone(updatedBooking.propertyId).catch(err => {
              console.error("[Milestone] Background check after payment failed:", err);
            });
          }
        }
      }, 2000);

      res.json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // Get payment status
  app.get("/api/payments/:id", async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      res.json(payment);
    } catch (error) {
      console.error("Error fetching payment:", error);
      res.status(500).json({ error: "Failed to fetch payment" });
    }
  });

  // Admin edit booking
  app.patch("/api/admin/bookings/:id", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const scope = await getReceptionistScope(req);
      if (scope && booking.propertyId && !scope.has(booking.propertyId)) {
        return res.status(403).json({ error: "Booking not in your assignment scope" });
      }

      const allowedFields = [
        "customerName", "customerPhone", "customerEmail",
        "status", "stayPlanType", "academicYearPeriod",
        "checkInDate", "checkOutDate", "durationMonths",
        "paymentType", "tokenAmount", "numberOfInstallments",
        "referrer",
      ];

      const fieldMapping: Record<string, string> = {
        customerName: "walkInName",
        customerPhone: "walkInPhone",
        customerEmail: "walkInEmail",
      };

      const updates: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          const dbField = fieldMapping[field] || field;
          updates[dbField] = req.body[field];
        }
      }

      if (req.body.residentDetails && typeof req.body.residentDetails === "object") {
        const existingRd = (booking.residentDetails as Record<string, any>) || {};
        updates.residentDetails = { ...existingRd, ...req.body.residentDetails };
      }

      if (updates.walkInName || updates.walkInPhone || updates.walkInEmail) {
        const existingRd = (updates.residentDetails || booking.residentDetails || {}) as Record<string, any>;
        const rdUpdates: Record<string, any> = {};
        if (updates.walkInName) rdUpdates.name = updates.walkInName;
        if (updates.walkInPhone) rdUpdates.phone = updates.walkInPhone;
        if (updates.walkInEmail) rdUpdates.email = updates.walkInEmail;
        updates.residentDetails = { ...existingRd, ...rdUpdates };
      }

      if (updates.status === "cancelled" && booking.status !== "cancelled") {
        if (booking.bedId) {
          await storage.updateBedStatus(booking.bedId, "available");
          await storage.updateRoomTypeAvailability(booking.roomTypeId, 1);
          if (booking.floorId) {
            const floorBeds = await storage.getBedsByFloor(booking.floorId);
            const availCount = floorBeds.filter((b: any) => b.status === "available").length;
            await db.update(schema.floors).set({ availableBeds: availCount }).where(eq(schema.floors.id, booking.floorId));
          }
        } else if (booking.bedAllocated) {
          await storage.updateRoomTypeAvailability(booking.roomTypeId, 1);
        }
      }

      if (updates.status && (updates.status === "confirmed" || updates.status === "active") && booking.status !== updates.status && booking.bedId) {
        await storage.updateBedStatus(booking.bedId, "occupied");
        if (booking.floorId) {
          const floorBeds = await storage.getBedsByFloor(booking.floorId);
          const availCount = floorBeds.filter((b: any) => b.status === "available").length;
          await db.update(schema.floors).set({ availableBeds: availCount }).where(eq(schema.floors.id, booking.floorId));
        }
      }

      const updated = await storage.updateBooking(req.params.id, updates);

      autoSyncBookingToHMS(updated).catch(err => {
        console.error("[HMS Auto-Sync] Background sync after admin edit failed:", err);
      });

      await storage.createAuditLog({
        adminId: req.user!.userId,
        action: "EDIT_BOOKING",
        entityType: "booking",
        entityId: req.params.id,
        details: JSON.stringify({ bookingCode: booking.bookingCode, changes: Object.keys(updates) }),
      });

      autoResyncBookingToHms(req.params.id, "booking-edit");

      res.json({
        ...updated,
        customerName: updated?.walkInName || "",
        customerPhone: updated?.walkInPhone || "",
        customerEmail: updated?.walkInEmail || "",
      });
    } catch (error: any) {
      console.error("Error editing booking:", error);
      res.status(500).json({ error: error.message || "Failed to edit booking" });
    }
  });

  // Admin bed shift / room transfer
  app.post("/api/admin/bookings/:id/shift-bed", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const { newBedId } = req.body;
      if (!newBedId) return res.status(400).json({ error: "newBedId is required" });

      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      const scope = await getReceptionistScope(req);
      if (scope && booking.propertyId && !scope.has(booking.propertyId)) {
        return res.status(403).json({ error: "Booking not in your assignment scope" });
      }

      const allowedStatuses = ["confirmed", "active", "completed", "pending_payment"];
      if (!allowedStatuses.includes(booking.status)) {
        return res.status(400).json({ error: `Cannot shift bed for booking in '${booking.status}' status` });
      }

      const newBed = await storage.getBed(newBedId);
      if (!newBed) return res.status(404).json({ error: "Target bed not found" });

      if (newBed.propertyId !== booking.propertyId) {
        return res.status(400).json({ error: "Target bed must belong to the same property" });
      }

      if (newBed.status !== "available") return res.status(400).json({ error: "Target bed is not available" });

      try {
        const bookingRd = (booking.residentDetails as Record<string, any>) || {};
        const bookingGender = bookingRd.gender || "";
        await assertGenderCompatible(newBedId, bookingGender);
      } catch (genderErr: any) {
        return res.status(genderErr?.status || 400).json({ error: genderErr?.message || "Gender mismatch for this floor" });
      }

      const isSuperadmin = req.user!.role === "superadmin";
      if (newBed.roomTypeId !== booking.roomTypeId && !isSuperadmin) {
        // Edge case: the booking's stored roomTypeId may be stale — either it
        // no longer exists in this property's room_types (renamed/removed) or
        // it exists but has zero beds attached at this property (legacy/
        // migrated data). In both cases admin/receptionist would be locked out
        // forever, so allow the shift.
        let bookingTypeIsStale = !booking.roomTypeId;
        if (!bookingTypeIsStale && booking.propertyId) {
          const propertyRoomTypes = await db.select({ id: schema.roomTypes.id })
            .from(schema.roomTypes)
            .where(eq(schema.roomTypes.propertyId, booking.propertyId));
          const validIds = new Set(propertyRoomTypes.map(rt => rt.id));
          if (!validIds.has(booking.roomTypeId!)) {
            bookingTypeIsStale = true;
          } else {
            const bedsForType = await db.select({ id: schema.beds.id })
              .from(schema.beds)
              .where(and(
                eq(schema.beds.propertyId, booking.propertyId),
                eq(schema.beds.roomTypeId, booking.roomTypeId!),
              ));
            if (bedsForType.length === 0) bookingTypeIsStale = true;
          }
        }
        if (!bookingTypeIsStale) {
          return res.status(400).json({ error: "Target bed must be in the same room type category" });
        }
      }

      const isRoomTypeChange = newBed.roomTypeId !== booking.roomTypeId;

      const newRoom = newBed.roomId ? await db.select().from(schema.rooms).where(eq(schema.rooms.id, newBed.roomId)).then(r => r[0]) : null;
      const newFloor = await db.select().from(schema.floors).where(eq(schema.floors.id, newBed.floorId)).then(r => r[0]);
      const existingRd = (booking.residentDetails as Record<string, any>) || {};

      let newRoomTypeName: string | undefined;
      if (isRoomTypeChange && newBed.roomTypeId) {
        const newRoomType = await db.select().from(schema.roomTypes).where(eq(schema.roomTypes.id, newBed.roomTypeId)).then(r => r[0]);
        newRoomTypeName = newRoomType?.customName || newRoomType?.name;
      }

      await db.transaction(async (tx) => {
        if (booking.bedId) {
          await tx.update(schema.beds).set({ status: "available" }).where(eq(schema.beds.id, booking.bedId));
        }

        const newBedStatus: "occupied" | "reserved" = (booking.status === "confirmed" || booking.status === "active") ? "occupied" : "reserved";
        const [reserveResult] = await tx.update(schema.beds)
          .set({ status: newBedStatus })
          .where(and(eq(schema.beds.id, newBedId), eq(schema.beds.status, "available")))
          .returning({ id: schema.beds.id });
        if (!reserveResult) {
          throw new Error("Target bed is no longer available (concurrent allocation)");
        }

        const updatedRd: Record<string, unknown> = {
          ...existingRd,
          roomNo: newRoom?.roomNumber || existingRd.roomNo || "",
          bedNo: newBed.bedNumber || "",
        };

        if (isRoomTypeChange && newRoomTypeName) {
          updatedRd.accommodationType = newRoomTypeName;
          updatedRd.roomType = newRoomTypeName;
        }

        const bookingUpdate: Partial<typeof schema.bookings.$inferInsert> = {
          bedId: newBedId,
          roomId: newBed.roomId || booking.roomId,
          floorId: newBed.floorId,
          residentDetails: updatedRd,
          bedAllocated: true,
          updatedAt: new Date(),
        };

        if (isRoomTypeChange && newBed.roomTypeId) {
          bookingUpdate.roomTypeId = newBed.roomTypeId;
        }

        await tx.update(schema.bookings).set(bookingUpdate).where(eq(schema.bookings.id, req.params.id));

        const affectedFloorIds = new Set<string>();
        if (booking.floorId) affectedFloorIds.add(booking.floorId);
        if (newBed.floorId) affectedFloorIds.add(newBed.floorId);
        for (const fid of affectedFloorIds) {
          const floorBeds = await tx.select().from(schema.beds).where(eq(schema.beds.floorId, fid));
          const availCount = floorBeds.filter((b) => b.status === "available").length;
          await tx.update(schema.floors).set({ availableBeds: availCount }).where(eq(schema.floors.id, fid));
        }

        if (isRoomTypeChange && newBed.roomTypeId && booking.roomTypeId) {
          const oldRtBeds = await tx.select().from(schema.beds).where(eq(schema.beds.roomTypeId, booking.roomTypeId));
          const oldAvail = oldRtBeds.filter((b) => b.status === "available").length;
          await tx.update(schema.roomTypes).set({ availableBeds: oldAvail }).where(eq(schema.roomTypes.id, booking.roomTypeId));

          const newRtBeds = await tx.select().from(schema.beds).where(eq(schema.beds.roomTypeId, newBed.roomTypeId));
          const newAvail = newRtBeds.filter((b) => b.status === "available").length;
          await tx.update(schema.roomTypes).set({ availableBeds: newAvail }).where(eq(schema.roomTypes.id, newBed.roomTypeId));
        }

        await tx.insert(schema.auditLogs).values({
          adminId: req.user!.userId,
          action: "BED_SHIFT",
          entityType: "booking",
          entityId: req.params.id,
          details: JSON.stringify({
            bookingCode: booking.bookingCode,
            oldBedId: booking.bedId,
            newBedId,
            oldRoomNo: existingRd.roomNo,
            newRoomNo: newRoom?.roomNumber,
            newBedNo: newBed.bedNumber,
            newFloor: newFloor?.name,
            ...(isRoomTypeChange ? {
              crossRoomTypeShift: true,
              oldRoomTypeId: booking.roomTypeId,
              newRoomTypeId: newBed.roomTypeId,
              newRoomTypeName,
            } : {}),
          }),
        });
      });

      const updated = await storage.getBooking(req.params.id);

      autoSyncBookingToHMS(updated).catch(err => {
        console.error("[HMS Auto-Sync] Background sync after bed shift failed:", err);
      });

      let customerName = updated?.walkInName || "";
      let customerPhone = updated?.walkInPhone || "";
      let customerEmail = updated?.walkInEmail || "";
      if (updated?.studentId) {
        const student = await storage.getStudent(updated.studentId);
        if (student) {
          customerName = student.fullName;
          customerPhone = student.phone || "";
        }
      } else if (updated?.leadId) {
        const lead = await storage.getLead(updated.leadId);
        if (lead) {
          customerName = lead.name;
          customerPhone = lead.phone || "";
          customerEmail = lead.email || "";
        }
      }

      autoResyncBookingToHms(req.params.id, "bed-shift");

      res.json({
        ...updated,
        customerName,
        customerPhone,
        customerEmail,
      });
    } catch (error: any) {
      console.error("Error shifting bed:", error);
      res.status(500).json({ error: error.message || "Failed to shift bed" });
    }
  });

  // Admin mark payment done
  app.post("/api/admin/bookings/:id/mark-payment-done", authMiddleware, roleMiddleware("admin", "receptionist", "sales_executive"), async (req: AuthRequest, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const scope = await getReceptionistScope(req);
      if (scope && booking.propertyId && !scope.has(booking.propertyId)) {
        return res.status(403).json({ error: "Booking not in your assignment scope" });
      }

      const { paymentMethod, transactionId, notes, amount, screenshotPath } = req.body;
      let { installmentId } = req.body;

      const isCash = paymentMethod === "cash";
      if (!isCash && (!transactionId || !transactionId.trim())) {
        return res.status(400).json({ error: "Transaction ID / UTR is required" });
      }
      if (!isCash && (!screenshotPath || !screenshotPath.trim())) {
        return res.status(400).json({ error: "Payment screenshot is required" });
      }

      const allExistingPayments = await db.select().from(schema.payments)
        .where(and(eq(schema.payments.bookingId, booking.id), eq(schema.payments.status, "success")));

      if (!installmentId) {
        const bookingInstallments = await db.select().from(schema.installments)
          .where(eq(schema.installments.bookingId, booking.id))
          .orderBy(schema.installments.createdAt);
        const nextUnpaid = bookingInstallments.find(i => !i.paid);
        if (nextUnpaid) {
          installmentId = nextUnpaid.id;
        }
      }

      const paymentAmount = amount || booking.totalFee;
      const txnId = isCash ? (transactionId?.trim() || `CASH-${Date.now()}`) : transactionId.trim();

      const payment = await storage.createPayment({
        bookingId: booking.id,
        amount: paymentAmount,
        paymentMethod: paymentMethod || "cash",
        razorpayPaymentId: txnId,
        status: "success",
        installmentId: installmentId || null,
        screenshotPath: screenshotPath?.trim() || null,
        notes: notes || null,
      });

      let updatedInstallment = null;
      let newBalanceInstallment = null;
      if (installmentId) {
        const [existingInst] = await db.select().from(schema.installments).where(and(eq(schema.installments.id, installmentId), eq(schema.installments.bookingId, booking.id)));
        if (!existingInst) {
          return res.status(400).json({ error: "Installment not found for this booking" });
        }
        const previousPaymentsForInst = allExistingPayments.filter(p => p.installmentId === installmentId);
        const totalPaidSoFar = previousPaymentsForInst.reduce((sum, p) => sum + (p.amount || 0), 0) + paymentAmount;
        const isFullyPaid = totalPaidSoFar >= existingInst.amount;

        if (isFullyPaid) {
          const [inst] = await db.update(schema.installments)
            .set({ paid: true, paidAt: new Date() })
            .where(and(eq(schema.installments.id, installmentId), eq(schema.installments.bookingId, booking.id)))
            .returning();
          updatedInstallment = inst;
        } else {
          const partialName = existingInst.name.includes("(Partial)") ? existingInst.name : `${existingInst.name} (Partial)`;
          const [inst] = await db.update(schema.installments)
            .set({ name: partialName, amount: paymentAmount + previousPaymentsForInst.reduce((s, p) => s + (p.amount || 0), 0), paid: true, paidAt: new Date() })
            .where(and(eq(schema.installments.id, installmentId), eq(schema.installments.bookingId, booking.id)))
            .returning();
          updatedInstallment = inst;

          const remainingAmount = existingInst.amount - totalPaidSoFar;
          const baseName = existingInst.name.replace(/ \(Partial\)$/, "");
          const nextInstName = `${baseName} - Balance`;

          const [balanceInst] = await db.insert(schema.installments).values({
            bookingId: booking.id,
            name: nextInstName,
            amount: remainingAmount,
            dueDate: existingInst.dueDate,
            paid: false,
          }).returning();
          newBalanceInstallment = balanceInst;
        }
      }

      const allInstallments = await db.select().from(schema.installments).where(eq(schema.installments.bookingId, booking.id));
      const updatedPayments = await db.select().from(schema.payments)
        .where(and(eq(schema.payments.bookingId, booking.id), eq(schema.payments.status, "success")));
      const allFullyPaid = allInstallments.length > 0 && allInstallments.every(inst => {
        if (inst.paid) return true;
        const instPayments = updatedPayments.filter(p => p.installmentId === inst.id);
        const totalPaid = instPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        return totalPaid >= inst.amount;
      });
      let bookingStatus = booking.status;
      if (allFullyPaid) {
        bookingStatus = "confirmed";
      } else if (booking.status === "pending_payment" || booking.status === "draft") {
        bookingStatus = "confirmed";
      }

      const updated = await storage.updateBooking(req.params.id, {
        status: bookingStatus,
      });

      if ((bookingStatus === "confirmed" || bookingStatus === "active") && booking.bedId) {
        await storage.updateBedStatus(booking.bedId, "occupied");
        if (booking.floorId) {
          const floorBeds = await storage.getBedsByFloor(booking.floorId);
          const availCount = floorBeds.filter(b => b.status === "available").length;
          await db.update(schema.floors).set({ availableBeds: availCount }).where(eq(schema.floors.id, booking.floorId));
        }
      }

      await storage.createAuditLog({
        adminId: req.user!.userId,
        action: "MARK_PAYMENT_DONE",
        entityType: "booking",
        entityId: req.params.id,
        details: JSON.stringify({
          bookingCode: booking.bookingCode,
          amount: paymentAmount,
          method: paymentMethod || "cash",
          transactionId: txnId,
          installmentId: installmentId || null,
          installmentName: installmentId ? allInstallments.find(i => i.id === installmentId)?.name : null,
        }),
      });

      const existingPayments = await storage.getPaymentsByBooking(booking.id);
      const previousSuccessful = existingPayments.filter(p => p.status === "success" && p.id !== payment.id);
      
      const latestBooking = await storage.getBooking(booking.id);
      if (latestBooking) {
        autoSyncBookingToHMS(latestBooking).catch(err => {
          console.error("[HMS Auto-Sync] Background sync after mark-payment failed:", err);
        });

        if (previousSuccessful.length === 0) {
          if (!latestBooking.welcomeEmailSent) {
            sendWelcomeEmailForBooking(latestBooking).catch(err => {
              console.error("[Email] Background welcome email after first payment failed:", err);
            });
          }
        }

        if (previousSuccessful.length === 0) {
          sendParentBookingConfirmationEmail(latestBooking, paymentAmount).catch(err => {
            console.error("[Email] Background parent email after first payment failed:", err);
          });
        } else {
          sendPaymentReceivedEmail(latestBooking, paymentAmount).catch(err => {
            console.error("[Email] Background payment received email after payment failed:", err);
          });
        }

        checkAndSendMilestone(latestBooking.propertyId).catch(err => {
          console.error("[Milestone] Background check after manual payment failed:", err);
        });
      }

      autoResyncBookingToHms(req.params.id, "payment-done");

      res.json({ booking: updated, payment, installment: updatedInstallment, balanceInstallment: newBalanceInstallment });
    } catch (error: any) {
      console.error("Error marking payment done:", error);
      res.status(500).json({ error: error.message || "Failed to mark payment done" });
    }
  });

  app.post("/api/admin/bookings/:id/fix-orphaned-payments", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      const allPayments = await db.select().from(schema.payments)
        .where(and(eq(schema.payments.bookingId, booking.id), eq(schema.payments.status, "success")));
      const orphanedPayments = allPayments.filter(p => !p.installmentId);
      if (orphanedPayments.length === 0) {
        return res.json({ message: "No orphaned payments found", fixed: 0 });
      }

      const allInstallments = await db.select().from(schema.installments)
        .where(eq(schema.installments.bookingId, booking.id))
        .orderBy(schema.installments.createdAt);

      let fixed = 0;
      for (const payment of orphanedPayments) {
        const linkedPayments = allPayments.filter(p => p.installmentId);
        const updatedPayments = [...linkedPayments];

        for (const inst of allInstallments) {
          const instPayments = updatedPayments.filter(p => p.installmentId === inst.id);
          const totalPaid = instPayments.reduce((s, p) => s + (p.amount || 0), 0);
          if (totalPaid < inst.amount && !inst.paid) {
            await db.update(schema.payments)
              .set({ installmentId: inst.id })
              .where(eq(schema.payments.id, payment.id));
            updatedPayments.push({ ...payment, installmentId: inst.id });
            fixed++;
            break;
          }
        }
      }

      const updatedBooking = await storage.getBooking(req.params.id);
      if (updatedBooking && fixed > 0) {
        autoSyncBookingToHMS(updatedBooking).catch(err => {
          console.error("[HMS Auto-Sync] Background sync after fix-orphaned-payments failed:", err);
        });
      }

      res.json({ message: `Fixed ${fixed} orphaned payments`, fixed });
    } catch (error: any) {
      console.error("Error fixing orphaned payments:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/bookings/:id/send-parent-email", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      const rd = booking.residentDetails as Record<string, any> | null;
      const parentEmail = rd?.parentEmail || rd?.guardianEmail;
      if (!parentEmail) {
        return res.status(400).json({ error: "No parent/guardian email found for this booking" });
      }

      const payments = await storage.getPaymentsByBooking(booking.id);
      const totalPaid = payments.filter(p => p.status === "success").reduce((sum, p) => sum + (p.amount || 0), 0);

      const result = await sendParentBookingConfirmationEmail(booking, totalPaid);
      if (result.success) {
        res.json({ success: true, message: `Parent email sent to ${parentEmail}` });
      } else {
        res.status(500).json({ error: result.error || "Failed to send parent email" });
      }
    } catch (error: any) {
      console.error("Error sending parent email:", error);
      res.status(500).json({ error: error.message || "Failed to send parent email" });
    }
  });

  app.post("/api/admin/bookings/:id/resend-welcome-email", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      await storage.updateBooking(booking.id, { welcomeEmailSent: false });
      const refreshed = await storage.getBooking(booking.id);
      if (!refreshed) return res.status(404).json({ error: "Booking not found" });

      const result = await sendWelcomeEmailForBooking(refreshed);
      if (result.success) {
        const rd = refreshed.residentDetails as Record<string, any> | null;
        const email = rd?.email || refreshed.walkInEmail || "resident";
        res.json({ success: true, message: `Welcome email sent to ${email}` });
      } else {
        res.status(500).json({ error: result.error || "Failed to send welcome email" });
      }
    } catch (error: any) {
      console.error("Error resending welcome email:", error);
      res.status(500).json({ error: error.message || "Failed to send welcome email" });
    }
  });

  async function buildHmsSyncForBooking(bookingId: string): Promise<
    | { ok: false; error: string }
    | { ok: true; booking: any; syncData: any }
  > {
    const booking = await storage.getBooking(bookingId);
    if (!booking) return { ok: false, error: "Booking not found" };
    if (!booking.propertyId) return { ok: false, error: "Booking has no property assigned" };

    const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, booking.propertyId));
    if (!property) return { ok: false, error: "Property not found" };

    const { getPropertyCode, resolvePublicUrl } = await import("./hms-sync.js");
    const resolvedPropertyCode = property.propertyCode || getPropertyCode(property.name);
    if (!resolvedPropertyCode) return { ok: false, error: `Cannot determine property code for "${property.name}"` };

    const rd = (booking.residentDetails as any) || {};
    let studentData: any = null;
    if (booking.studentId) {
      const [student] = await db.select().from(schema.students).where(eq(schema.students.id, booking.studentId));
      studentData = student || null;
    }

    const name = studentData?.fullName || rd?.fullName || rd?.name || booking.walkInName || "Unknown";
    const phone = studentData?.phone || booking.walkInPhone || rd?.phone || "";
    const email = studentData?.email || rd?.email || booking.walkInEmail || "";
    const college = studentData?.collegeName || rd?.institute || rd?.college || rd?.instituteName;
    const roomNo = rd?.roomNo || rd?.room || "";

    const syncData: any = {
      name,
      email: email || undefined,
      phone,
      room: roomNo,
      propertyCode: resolvedPropertyCode,
      dietary: rd?.dietaryPreference || rd?.dietary || undefined,
      college: college || undefined,
      instituteName: college || undefined,
      courseName: studentData?.course || rd?.course || rd?.courseName || undefined,
      courseYear: studentData?.year || rd?.year || undefined,
      moveInDate: rd?.moveInDate || (booking.checkInDate ? String(booking.checkInDate) : undefined),
      checkOutDate: rd?.checkOutDate || (booking.checkOutDate ? String(booking.checkOutDate) : undefined),
      accommodationType: rd?.accommodationType || rd?.roomType || undefined,
      parentName: rd?.parentName || rd?.guardianName || undefined,
      parentPhone: rd?.parentPhone || rd?.guardianPhone || undefined,
      parentEmail: rd?.parentEmail || rd?.guardianEmail || undefined,
      parentRelation: rd?.parentRelation || rd?.guardianRelation || undefined,
      homeAddress: rd?.homeAddress || rd?.address || undefined,
      gender: rd?.gender || studentData?.gender || undefined,
      dateOfBirth: rd?.dateOfBirth || rd?.dob || studentData?.dateOfBirth || undefined,
      studentEmail: rd?.studentEmail || email || undefined,
      bookingDate: booking.createdAt ? new Date(booking.createdAt).toISOString().split("T")[0] : undefined,
      accessLevel: "FULL",
    };

    const idProofUrl = resolvePublicUrl(studentData?.idProofUrl || rd?.idProofUrl || rd?.idProof);
    const photoUrl = resolvePublicUrl(rd?.photoUrl || rd?.photo || studentData?.photoUrl);
    if (idProofUrl) syncData.idProofUrl = idProofUrl;
    if (photoUrl) syncData.photoUrl = photoUrl;

    const rawDocs = rd?.documentUrls || rd?.documents || [];
    if (Array.isArray(rawDocs)) {
      const docUrls: string[] = [];
      for (const doc of rawDocs) {
        const resolved = resolvePublicUrl(typeof doc === "string" ? doc : doc?.url);
        if (resolved) docUrls.push(resolved);
      }
      if (docUrls.length > 0) syncData.documentUrls = docUrls;
    }

    return { ok: true, booking, syncData };
  }

  function autoResyncBookingToHms(bookingId: string, reason: string = "activity") {
    setImmediate(async () => {
      try {
        const built = await buildHmsSyncForBooking(bookingId);
        if (!built.ok) {
          console.warn(`[Auto HMS Sync] Skipped booking ${bookingId} (${reason}): ${built.error}`);
          return;
        }
        const { syncBookingToHMS } = await import("./hms-sync.js");
        const result = await syncBookingToHMS(built.syncData);
        if (result.success) {
          console.log(`[Auto HMS Sync] ${reason} → ${built.booking.bookingCode}: ${result.action}`);
        } else {
          console.warn(`[Auto HMS Sync] ${reason} → ${built.booking.bookingCode} failed: ${result.error}`);
        }
      } catch (err: any) {
        console.error(`[Auto HMS Sync] Error for booking ${bookingId} (${reason}):`, err?.message || err);
      }
    });
  }

  app.post("/api/admin/bookings/:id/resync-hms", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const scope = await getReceptionistScope(req);
      if (scope) {
        const booking = await storage.getBooking(req.params.id);
        if (!booking) return res.status(404).json({ error: "Booking not found" });
        if (booking.propertyId && !scope.has(booking.propertyId)) {
          return res.status(403).json({ error: "Booking not in your assignment scope" });
        }
      }

      const built = await buildHmsSyncForBooking(req.params.id);
      if (!built.ok) {
        const status = built.error === "Booking not found" ? 404 : 400;
        return res.status(status).json({ error: built.error });
      }
      const { syncBookingToHMS } = await import("./hms-sync.js");
      console.log(`[Admin Re-sync HMS] Syncing booking ${built.booking.bookingCode} to HMS...`);
      const result = await syncBookingToHMS(built.syncData);

      if (result.success) {
        console.log(`[Admin Re-sync HMS] Success for ${built.booking.bookingCode}: ${result.action}`);
        res.json({ success: true, message: `Booking ${built.booking.bookingCode} synced to HMS (${result.action})` });
      } else {
        console.error(`[Admin Re-sync HMS] Failed for ${built.booking.bookingCode}: ${result.error}`);
        res.status(500).json({ error: result.error || "HMS sync failed" });
      }
    } catch (error: any) {
      console.error("Error re-syncing to HMS:", error);
      res.status(500).json({ error: error.message || "Failed to sync to HMS" });
    }
  });

  app.get("/api/receipt/:bookingId", async (req, res) => {
    try {
      const { bookingId } = req.params;
      const { token } = req.query;

      if (!token || typeof token !== "string") {
        return res.status(401).json({ error: "Missing or invalid receipt token" });
      }

      const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || "hsquareliving-dev-secret-key-for-development-only";
      const expectedToken = crypto.createHmac("sha256", secret).update(`receipt:${bookingId}`).digest("hex").substring(0, 32);

      if (token !== expectedToken) {
        return res.status(403).json({ error: "Invalid receipt token" });
      }

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const pdfBuffer = await generateBookingReceiptPdf(booking);
      const filename = `Booking-Receipt-${booking.bookingCode || booking.id}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.setHeader("Content-Length", pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating public receipt:", error);
      res.status(500).json({ error: "Failed to generate receipt" });
    }
  });

  // ============ AGREEMENT ============
  
  // Generate agreement (mark as generated)
  app.post("/api/bookings/:id/agreement", async (req, res) => {
    try {
      const { signatureData } = req.body;
      
      const booking = await storage.updateBooking(req.params.id as string, {
        agreementGenerated: true,
        agreementGeneratedAt: new Date(),
        signatureData: signatureData || null,
        agreementUrl: `/agreements/${req.params.id}.pdf`,
      });

      res.json(booking);
    } catch (error) {
      console.error("Error generating agreement:", error);
      res.status(500).json({ error: "Failed to generate agreement" });
    }
  });

  // ============ ADMIN ============

  // ============ CHATBOT ADMIN CONTROL PANEL ============

  // Get chatbot settings
  app.get("/api/admin/chatbot/settings", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      const settings = await chatbotAdmin.getChatbotSettings(propertyId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching chatbot settings:", error);
      res.status(500).json({ error: "Failed to fetch chatbot settings" });
    }
  });

  // Update chatbot settings
  app.put("/api/admin/chatbot/settings", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const { propertyId, ...data } = req.body;
      const settings = await chatbotAdmin.updateChatbotSettings(data, propertyId);
      
      await logActivity({
        actorUserId: authReq.user!.userId,
        actorName: authReq.user!.email,
        actorRole: authReq.user!.role,
        actionType: "UPDATE",
        entityType: "PROPERTY",
        entityId: settings.id,
        entityLabel: "Chatbot Settings",
        metadataJson: JSON.stringify({ changes: Object.keys(data) }),
      });
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating chatbot settings:", error);
      res.status(500).json({ error: "Failed to update chatbot settings" });
    }
  });

  // Toggle chatbot on/off
  app.post("/api/admin/chatbot/toggle", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const { enabled, propertyId } = req.body;
      const settings = await chatbotAdmin.toggleChatbot(enabled, propertyId);
      
      await logActivity({
        actorUserId: authReq.user!.userId,
        actorName: authReq.user!.email,
        actorRole: authReq.user!.role,
        actionType: enabled ? "ACTIVATE" : "DEACTIVATE",
        entityType: "PROPERTY",
        entityId: settings.id,
        entityLabel: "Chatbot",
        metadataJson: JSON.stringify({ enabled }),
      });
      
      res.json(settings);
    } catch (error) {
      console.error("Error toggling chatbot:", error);
      res.status(500).json({ error: "Failed to toggle chatbot" });
    }
  });

  // Get chatbot stats
  app.get("/api/admin/chatbot/stats", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      const stats = await chatbotAdmin.getChatbotStats(propertyId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching chatbot stats:", error);
      res.status(500).json({ error: "Failed to fetch chatbot stats" });
    }
  });

  // Get chatbot knowledge entries
  app.get("/api/admin/chatbot/knowledge", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { propertyId, category, status, search } = req.query;
      const entries = await chatbotAdmin.getChatbotKnowledge({
        propertyId: propertyId as string,
        category: category as string,
        status: status as "draft" | "published",
        search: search as string,
      });
      res.json(entries);
    } catch (error) {
      console.error("Error fetching chatbot knowledge:", error);
      res.status(500).json({ error: "Failed to fetch knowledge entries" });
    }
  });

  // Create knowledge entry
  app.post("/api/admin/chatbot/knowledge", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const entry = await chatbotAdmin.createChatbotKnowledge({
        ...req.body,
        createdBy: authReq.user!.userId,
      });
      
      await logActivity({
        actorUserId: authReq.user!.userId,
        actorName: authReq.user!.email,
        actorRole: authReq.user!.role,
        actionType: "CREATE",
        entityType: "PROPERTY",
        entityId: entry.id,
        entityLabel: `Knowledge: ${entry.category}`,
      });
      
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating knowledge entry:", error);
      res.status(500).json({ error: "Failed to create knowledge entry" });
    }
  });

  // Update knowledge entry
  app.put("/api/admin/chatbot/knowledge/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const entry = await chatbotAdmin.updateChatbotKnowledge(req.params.id, req.body);
      
      await logActivity({
        actorUserId: authReq.user!.userId,
        actorName: authReq.user!.email,
        actorRole: authReq.user!.role,
        actionType: "UPDATE",
        entityType: "PROPERTY",
        entityId: req.params.id,
        entityLabel: `Knowledge: ${entry?.category}`,
      });
      
      res.json(entry);
    } catch (error) {
      console.error("Error updating knowledge entry:", error);
      res.status(500).json({ error: "Failed to update knowledge entry" });
    }
  });

  // Delete knowledge entry
  app.delete("/api/admin/chatbot/knowledge/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      await chatbotAdmin.deleteChatbotKnowledge(req.params.id);
      
      await logActivity({
        actorUserId: authReq.user!.userId,
        actorName: authReq.user!.email,
        actorRole: authReq.user!.role,
        actionType: "DELETE",
        entityType: "PROPERTY",
        entityId: req.params.id,
        entityLabel: "Knowledge Entry",
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting knowledge entry:", error);
      res.status(500).json({ error: "Failed to delete knowledge entry" });
    }
  });

  // Publish knowledge entry
  app.post("/api/admin/chatbot/knowledge/:id/publish", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const entry = await chatbotAdmin.publishKnowledgeEntry(req.params.id);
      res.json(entry);
    } catch (error) {
      console.error("Error publishing knowledge entry:", error);
      res.status(500).json({ error: "Failed to publish knowledge entry" });
    }
  });

  // Get captured leads from chatbot
  app.get("/api/admin/chatbot/captured-leads", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const leads = await chatbotAdmin.getCapturedLeads(limit);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching captured leads:", error);
      res.status(500).json({ error: "Failed to fetch captured leads" });
    }
  });

  // Get chatbot conversations
  app.get("/api/admin/chatbot/conversations", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { startDate, endDate, propertyId, outcome, device, limit, offset } = req.query;
      const conversations = await chatbotAdmin.getChatbotConversations({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        propertyId: propertyId as string,
        outcome: outcome as string,
        device: device as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get conversation messages
  app.get("/api/admin/chatbot/conversations/:id/messages", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const messages = await chatbotAdmin.getConversationMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching conversation messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Flag conversation
  app.post("/api/admin/chatbot/conversations/:id/flag", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { flagStatus } = req.body;
      const conversation = await chatbotAdmin.flagConversation(req.params.id, flagStatus);
      res.json(conversation);
    } catch (error) {
      console.error("Error flagging conversation:", error);
      res.status(500).json({ error: "Failed to flag conversation" });
    }
  });

  // Delete conversation (admin only with audit)
  app.delete("/api/admin/chatbot/conversations/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      await chatbotAdmin.deleteConversation(req.params.id);
      
      await logActivity({
        actorUserId: authReq.user!.userId,
        actorName: authReq.user!.email,
        actorRole: authReq.user!.role,
        actionType: "DELETE",
        entityType: "LEAD",
        entityId: req.params.id,
        entityLabel: "Chatbot Conversation",
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Test chatbot (sandbox mode)
  app.post("/api/admin/chatbot/test", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { message, sessionId } = req.body;
      const chatContext = await initChatContext();
      const response = await streamChatResponse(message, [], chatContext);
      res.json({ response, sessionId });
    } catch (error) {
      console.error("Error testing chatbot:", error);
      res.status(500).json({ error: "Failed to test chatbot" });
    }
  });

  // Public endpoint to get chatbot settings (for widget)
  app.get("/api/chatbot/settings", async (req, res) => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      const settings = await chatbotAdmin.getChatbotSettings(propertyId);
      res.json({
        enabled: settings.enabled,
        botName: settings.botName,
        greetingMessage: settings.greetingMessage,
        tone: settings.tone,
        defaultLanguage: settings.defaultLanguage,
        workingHoursStart: settings.workingHoursStart,
        workingHoursEnd: settings.workingHoursEnd,
        outsideHoursMessage: settings.outsideHoursMessage,
      });
    } catch (error) {
      console.error("Error fetching public chatbot settings:", error);
      res.status(500).json({ error: "Failed to fetch chatbot settings" });
    }
  });

  // ============ PROPERTY-SALES EXEC MANAGEMENT ============

  // Get all property-sales exec assignments
  // Get sales execs for a specific property
  app.get("/api/admin/properties/:propertyId/sales-execs", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const salesExecs = await storage.getActiveSalesExecsForProperty(req.params.propertyId);
      res.json(salesExecs);
    } catch (error) {
      console.error("Error fetching property sales execs:", error);
      res.status(500).json({ error: "Failed to fetch sales executives" });
    }
  });

  // Auto-assign lead to sales exec based on property
  app.post("/api/admin/leads/:id/auto-assign", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const leadId = req.params.id;
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      if (!lead.propertyId) {
        return res.status(400).json({ error: "Lead has no property assigned" });
      }

      // Get sales exec with least leads for this property
      let salesExec = await storage.getSalesExecWithLeastLeads(lead.propertyId);
      let resolvedAssignmentType: "property_auto" | "fallback_default" = "property_auto";
      const authReq = req as AuthRequest;

      if (!salesExec) {
        // No sales exec mapped to this property - fall back to the
        // catch-all default assignee (Bibhuti) via the shared helper so
        // this lead is owned immediately instead of sitting unassigned.
        const fb = await storage.assignFallbackIfUnassigned({
          assignedToId: null as string | null,
          assignmentType: "property_auto" as const,
        });
        if (fb.fallbackAssignee) {
          salesExec = fb.fallbackAssignee;
          resolvedAssignmentType = "fallback_default";
        } else {
          // Nothing to fall back to - keep the legacy "unassigned" path.
          const updatedLead = await storage.updateLead(leadId, {
            assignmentType: "unassigned",
          });
          const admins = await storage.getUsersByRole(["admin", "superadmin"]);
          for (const admin of admins) {
            await storage.createNotification({
              userId: admin.id,
              title: "Unassigned Lead - Action Required",
              message: `Lead "${lead.name}" for property has no sales executive assigned.`,
              type: "warning",
              actionUrl: "/admin/requests",
            });
          }
          return res.json({ ...updatedLead, assignedExec: null, assignmentType: "unassigned" });
        }
      }

      // Assign to sales exec
      const updatedLead = await storage.updateLead(leadId, {
        assignedToId: salesExec.id,
        assignedAt: new Date(),
        assignmentType: resolvedAssignmentType,
      });

      // Log activity
      await storage.createLeadActivity({
        leadId,
        actorId: authReq.user!.userId,
        actionType: "lead_reassigned",
        newValue: JSON.stringify({ salesExecId: salesExec.id, type: resolvedAssignmentType }),
        description: resolvedAssignmentType === "fallback_default"
          ? `Auto-assigned to ${salesExec.name} via default fallback (no property mapping)`
          : `Auto-assigned to ${salesExec.name} based on property mapping`,
      });

      // Notify sales exec
      await storage.createNotification({
        userId: salesExec.id,
        title: "New Lead Assigned",
        message: `Lead "${lead.name}" has been auto-assigned to you.`,
        type: "lead",
        actionUrl: "/sales/requests",
      });

      // Fire-and-forget assignment email
      (async () => {
        try {
          if (salesExec?.email) {
            const assigner = authReq.user?.userId ? await storage.getUser(authReq.user.userId) : null;
            const { sendLeadAssignmentEmail, buildLeadAssignmentEmailPayload } = await import("./email-service");
            await sendLeadAssignmentEmail(
              buildLeadAssignmentEmailPayload(lead),
              { id: salesExec.id, name: salesExec.name, email: salesExec.email },
              { assignerName: assigner?.name || null, assignerId: assigner?.id || null, assignmentType: resolvedAssignmentType }
            );
          }
        } catch (e) {
          console.warn("[LeadAssignmentEmail] admin auto-assign failed:", e);
        }
      })();

      res.json({ ...updatedLead, assignedExec: salesExec, assignmentType: resolvedAssignmentType });
    } catch (error) {
      console.error("Error auto-assigning lead:", error);
      res.status(500).json({ error: "Failed to auto-assign lead" });
    }
  });

  // Manual lead reassignment by admin
  app.post("/api/admin/leads/:id/reassign", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const { salesExecId } = req.body;
      const leadId = req.params.id;

      if (!salesExecId) {
        return res.status(400).json({ error: "Sales Exec ID is required" });
      }

      const lead = await storage.getLead(leadId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const updatedLead = await storage.updateLead(leadId, {
        assignedToId: salesExecId,
        assignedAt: new Date(),
        assignmentType: "admin_manual",
      });

      // Log activity
      await storage.createLeadActivity({
        leadId,
        actorId: authReq.user!.userId,
        actionType: "lead_reassigned",
        newValue: JSON.stringify({ salesExecId, type: "admin_manual" }),
        description: `Manually reassigned by admin`,
      });

      // Notify new sales exec
      const salesExec = await storage.getUser(salesExecId);
      if (salesExec) {
        await storage.createNotification({
          userId: salesExecId,
          title: "Lead Assigned to You",
          message: `Lead "${lead.name}" has been assigned to you by admin.`,
          type: "lead",
          actionUrl: "/sales/requests",
        });

        const isReassign = !!lead.assignedToId && lead.assignedToId !== salesExecId;
        (async () => {
          try {
            if (salesExec.email) {
              const assigner = authReq.user?.userId ? await storage.getUser(authReq.user.userId) : null;
              const { sendLeadAssignmentEmail, buildLeadAssignmentEmailPayload } = await import("./email-service");
              await sendLeadAssignmentEmail(
                buildLeadAssignmentEmailPayload(lead),
                { id: salesExec.id, name: salesExec.name, email: salesExec.email },
                { assignerName: assigner?.name || null, assignerId: assigner?.id || null, isReassign, assignmentType: "admin_manual" }
              );
            }
          } catch (e) {
            console.warn("[LeadAssignmentEmail] admin reassign failed:", e);
          }
        })();
      }

      res.json(updatedLead);
    } catch (error) {
      console.error("Error reassigning lead:", error);
      res.status(500).json({ error: "Failed to reassign lead" });
    }
  });

  // Get unassigned leads (needs action)
  app.get("/api/admin/leads/unassigned", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const allLeads = await storage.getAllLeads();
      const unassignedLeads = allLeads.filter(lead => 
        !lead.assignedToId || lead.assignmentType === "unassigned"
      );
      res.json(unassignedLeads);
    } catch (error) {
      console.error("Error fetching unassigned leads:", error);
      res.status(500).json({ error: "Failed to fetch unassigned leads" });
    }
  });
  
  // Get property assignment summary stats (aggregated endpoint)
  app.get("/api/admin/property-assignment-stats", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const properties = await storage.getAllProperties();
      const allLeads = await storage.getAllLeads();
      
      const propertyExecCounts = new Map<string, number>();
      for (const property of properties) {
        const execs = await storage.getActiveSalesExecsForProperty(property.id);
        propertyExecCounts.set(property.id, execs.length);
      }
      
      const propertiesWithExecs = Array.from(propertyExecCounts.values()).filter(count => count > 0).length;
      const unassignedLeads = allLeads.filter(lead => 
        !lead.assignedToId || lead.assignmentType === "unassigned"
      );
      
      res.json({
        totalProperties: properties.length,
        propertiesWithExecs,
        unassignedLeads: unassignedLeads.length
      });
    } catch (error) {
      console.error("Error fetching property assignment stats:", error);
      res.status(500).json({ error: "Failed to fetch property assignment stats" });
    }
  });
  
  // AI Lead Engagement Recommendations
  app.get("/api/admin/lead-recommendations", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const forceRefresh = req.query.refresh === "true";
      const limit = Math.min(parseInt(req.query.limit as string) || 8, 15);
      const result = await getLeadRecommendations(forceRefresh, limit);
      res.json(result);
    } catch (error) {
      console.error("Error generating lead recommendations:", error);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  // ============ EXTERNAL REGISTERED STUDENTS (HMS API) ============
  
  const HOSTEL_FLOW_BASE_URL = process.env.HMS_API_URL || "https://hostel-flow--swaingrs07.replit.app";
  
  let cachedHostelFlowJWT: string | null = null;
  let jwtExpiresAt: number = 0;

  function getHMSAuthHeaders(): Record<string, string> {
    const apiKey = process.env.HMS_API_KEY;
    if (apiKey) {
      return {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
    }
    if (cachedHostelFlowJWT) {
      return {
        "Authorization": `Bearer ${cachedHostelFlowJWT}`,
        "Content-Type": "application/json",
      };
    }
    return { "Content-Type": "application/json" };
  }

  async function getHostelFlowJWT(): Promise<string> {
    if (process.env.HMS_API_KEY) {
      return process.env.HMS_API_KEY;
    }
    if (cachedHostelFlowJWT && Date.now() < jwtExpiresAt) {
      return cachedHostelFlowJWT;
    }
    const email = process.env.HOSTEL_FLOW_EMAIL;
    const password = process.env.HOSTEL_FLOW_PASSWORD;
    if (!email || !password) {
      throw new Error("HMS_API_KEY or HOSTEL_FLOW_EMAIL/PASSWORD not configured");
    }
    const loginRes = await fetch(`${HOSTEL_FLOW_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!loginRes.ok) {
      const errText = await loginRes.text();
      throw new Error(`Login failed (${loginRes.status}): ${errText}`);
    }
    const loginData = await loginRes.json() as any;
    cachedHostelFlowJWT = loginData.jwtToken || loginData.token;
    if (!cachedHostelFlowJWT) {
      throw new Error("No token returned from Hostel Flow login");
    }
    jwtExpiresAt = Date.now() + 23 * 60 * 60 * 1000;
    return cachedHostelFlowJWT;
  }

  async function autoSyncBookingToHMS(booking: any) {
    try {
      if (!booking.propertyId) return;

      const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, booking.propertyId));
      if (!property || !property.hmsLinked) return;
      if (!property.propertyCode && !property.hmsPropertyId) return;

      const rd = booking.residentDetails as any;
      let studentData: any = null;
      if (booking.studentId) {
        const [student] = await db.select().from(schema.students).where(eq(schema.students.id, booking.studentId));
        studentData = student || null;
      }

      const name = studentData?.fullName || rd?.fullName || rd?.name || booking.walkInName || booking.customerName || booking.bookingCode || "Unknown";
      const phone = studentData?.phone || booking.walkInPhone || booking.customerPhone || rd?.phone || "";
      const email = studentData?.email || booking.customerEmail || rd?.email || rd?.studentEmail;
      const college = studentData?.collegeName || rd?.institute || rd?.college || rd?.instituteName;
      const roomNo = rd?.roomNo || rd?.room || "";

      let activeSeasons = await db.select().from(schema.seasons).where(
        and(
          eq(schema.seasons.propertyId, booking.propertyId),
          eq(schema.seasons.status, "active")
        )
      );
      if (activeSeasons.length === 0) {
        activeSeasons = await db.select().from(schema.seasons).where(
          and(
            isNull(schema.seasons.propertyId),
            eq(schema.seasons.status, "active")
          )
        );
      }
      const season = activeSeasons.length > 0 ? activeSeasons[0] : null;

      const { syncBookingToHMS, getPropertyCode } = await import("./hms-sync.js");

      const resolvedPropertyCode = property.propertyCode || getPropertyCode(property.name);
      if (!resolvedPropertyCode) {
        console.warn(`[HMS Auto-Sync] Skipping booking ${booking.bookingCode} — cannot determine property code for "${property.name}"`);
        return;
      }

      const { resolvePublicUrl } = await import("./hms-sync.js");

      const idProofUrl = resolvePublicUrl(studentData?.idProofUrl || rd?.idProofUrl || rd?.idProof);
      const photoUrl = resolvePublicUrl(rd?.photoUrl || rd?.photo || studentData?.photoUrl);
      const documentUrls: string[] = [];
      const rawDocs = rd?.documentUrls || rd?.documents || [];
      if (Array.isArray(rawDocs)) {
        for (const doc of rawDocs) {
          const resolved = resolvePublicUrl(typeof doc === "string" ? doc : doc?.url);
          if (resolved) documentUrls.push(resolved);
        }
      }

      const syncData: any = {
        name,
        email: email || undefined,
        phone,
        room: roomNo,
        propertyCode: resolvedPropertyCode,
        dietary: rd?.dietaryPreference || rd?.dietary || undefined,
        college: college || undefined,
        instituteName: college || undefined,
        courseName: studentData?.course || rd?.course || undefined,
        courseYear: studentData?.year || rd?.year || undefined,
        moveInDate: season?.startDate ? new Date(season.startDate).toISOString().split("T")[0] : undefined,
        checkOutDate: season?.endDate ? new Date(season.endDate).toISOString().split("T")[0] : undefined,
        accommodationType: rd?.accommodationType || rd?.roomType || undefined,
        parentName: rd?.parentName || rd?.guardianName || undefined,
        parentPhone: rd?.parentPhone || rd?.guardianPhone || undefined,
        parentEmail: rd?.parentEmail || rd?.guardianEmail || undefined,
        parentRelation: rd?.parentRelation || rd?.guardianRelation || undefined,
        homeAddress: rd?.homeAddress || rd?.address || undefined,
        gender: rd?.gender || studentData?.gender || undefined,
        dateOfBirth: rd?.dateOfBirth || rd?.dob || studentData?.dateOfBirth || undefined,
        studentEmail: rd?.studentEmail || email || undefined,
        bookingDate: booking.createdAt ? new Date(booking.createdAt).toISOString().split("T")[0] : undefined,
        accessLevel: "FULL",
      };

      if (idProofUrl) syncData.idProofUrl = idProofUrl;
      if (photoUrl) syncData.photoUrl = photoUrl;
      if (documentUrls.length > 0) syncData.documentUrls = documentUrls;

      const result = await syncBookingToHMS(syncData);

      if (result.success) {
        console.log(`[HMS Auto-Sync] Successfully synced booking ${booking.bookingCode} to HMS (action: ${result.action})`);

        await logActivity({
          actor: { id: "system", name: "System", role: "admin" },
          actionType: "UPDATE" as ActionType,
          entityType: "BOOKING" as EntityType,
          entityId: booking.id,
          entityLabel: `HMS Auto-Sync: ${booking.bookingCode}`,
          metadata: {
            action: result.action,
            seasonName: season?.name || "No Season",
            status: "synced",
          },
        });

        if (season) {
          const prevResults = (season.hmsSyncResults as any) || {};
          const prevSynced = (prevResults.synced || 0);
          await db.update(schema.seasons).set({
            hmsSyncStatus: "synced",
            hmsSyncedAt: new Date(),
            hmsSyncedBookingCount: prevSynced + 1,
            updatedAt: new Date(),
          }).where(eq(schema.seasons.id, season.id));
        }
      } else {
        console.error(`[HMS Auto-Sync] Failed for ${booking.bookingCode}: ${result.error}`);
      }
    } catch (error: any) {
      console.error("[HMS Auto-Sync] Unexpected error:", error.message);
    }
  }

  function hmsApiKeyAuth(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    const apiKey = process.env.HOSTEL_FLOW_API_KEY || process.env.HMS_API_KEY;
    const startedAt = Date.now();

    // Record this inbound HMS hit (for the superadmin diagnostics page)
    // when the response finishes, regardless of auth outcome. We write
    // to TWO sinks: the persistent `hms_activity_log` table (survives
    // restarts, primary source for /recent-activity and last-hit
    // timestamps) and an in-memory ring buffer (sub-second freshness
    // supplement). Both writes are best-effort and never throw.
    res.on("finish", () => {
      try {
        const route = (req.route?.path && req.baseUrl != null)
          ? `${req.baseUrl}${req.route.path}`
          : (req.originalUrl?.split("?")[0] || req.path);
        const queryEntries = Object.entries(req.query || {})
          .slice(0, 6)
          .map(([k, v]) => [k, String(v).slice(0, 80)] as [string, string]);
        const durationMs = Date.now() - startedAt;
        const identifier = req.params?.identifier
          || req.body?.bookingCode
          || req.body?.phone
          || (typeof req.query?.bookingCode === "string" ? req.query.bookingCode : undefined)
          || (typeof req.query?.phone === "string" ? req.query.phone : undefined);

        recordHmsHit({
          timestamp: new Date().toISOString(),
          method: req.method,
          route,
          path: req.originalUrl || req.path,
          status: res.statusCode,
          durationMs,
          ip: req.ip,
          identifier: identifier ? String(identifier).slice(0, 80) : undefined,
          query: Object.fromEntries(queryEntries),
          userAgent: req.get?.("user-agent") || undefined,
          hasApiKey: !!authHeader && !!apiKey && authHeader === `Bearer ${apiKey}`,
        });
      } catch {
        /* never let logging crash the request */
      }
    });

    if (!apiKey) return res.status(500).json({ error: "API key not configured" });
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const token = authHeader.slice(7);
    if (token !== apiKey) {
      return res.status(403).json({ error: "Invalid API key" });
    }
    next();
  }

  app.get("/api/hms/bookings", hmsApiKeyAuth, async (req: any, res) => {
    try {
      const { propertyCode, phone, email } = req.query;

      let allBookings = await db.select().from(schema.bookings).where(
        sql`${schema.bookings.status} NOT IN ('cancelled')`
      );

      if (phone || email) {
        const normalizedSearch = (phone as string || "").replace(/\D/g, "").slice(-10);
        const emailSearch = (email as string || "").toLowerCase().trim();
        allBookings = allBookings.filter((b: any) => {
          const rd = b.residentDetails as any;
          const bPhone = (b.walkInPhone || b.customerPhone || rd?.phone || "").replace(/\D/g, "").slice(-10);
          const bEmail = (b.walkInEmail || b.customerEmail || rd?.email || rd?.studentEmail || "").toLowerCase().trim();
          if (normalizedSearch && bPhone === normalizedSearch) return true;
          if (emailSearch && bEmail === emailSearch) return true;
          return false;
        });
      }

      const propertyIds = [...new Set(allBookings.map(b => b.propertyId).filter(Boolean))];
      const properties = propertyIds.length > 0
        ? await db.select().from(schema.properties).where(inArray(schema.properties.id, propertyIds as string[]))
        : [];
      const propertyMap = new Map(properties.map(p => [p.id, p]));

      if (propertyCode) {
        allBookings = allBookings.filter((b: any) => {
          const prop = b.propertyId ? propertyMap.get(b.propertyId) : null;
          return prop?.propertyCode === propertyCode;
        });
      }

      const bookingIds = allBookings.map(b => b.id);

      const [allInstallments, allPayments, allBookingPackages, allWalletEntries, allSeasonStatuses] = await Promise.all([
        bookingIds.length > 0 ? db.select().from(schema.installments).where(inArray(schema.installments.bookingId, bookingIds)) : [],
        bookingIds.length > 0 ? db.select().from(schema.payments).where(inArray(schema.payments.bookingId, bookingIds)) : [],
        bookingIds.length > 0 ? db.select().from(schema.bookingPackages).where(inArray(schema.bookingPackages.bookingId, bookingIds)) : [],
        bookingIds.length > 0 ? db.select().from(schema.walletLedger).where(inArray(schema.walletLedger.bookingId, bookingIds)) : [],
        bookingIds.length > 0 ? db.select().from(schema.residentSeasonStatus).where(inArray(schema.residentSeasonStatus.bookingId, bookingIds)) : [],
      ]);

      const seasonStatusMap = new Map<string, string>();
      allSeasonStatuses.forEach((ss: any) => {
        seasonStatusMap.set(ss.bookingId, ss.status);
      });

      const getHmsStatus = (bookingStatus: string, bookingId: string): string => {
        const seasonStatus = seasonStatusMap.get(bookingId);
        if (seasonStatus === "RETAINED") return "Retained";
        if (seasonStatus === "NOT_RETAINED") return "Not Retained";
        switch (bookingStatus) {
          case "draft": return "Draft";
          case "pending_payment": return "Pending Payment";
          case "pending_approval": return "Pending Approval";
          case "confirmed": return "New Booking";
          case "active": return "Active";
          case "completed": return "Completed";
          case "cancelled": return "Cancelled";
          default: return bookingStatus;
        }
      };

      const pkgIds = [...new Set(allBookingPackages.map(bp => bp.packageId).filter(Boolean))];
      const [packages, allPackageItems] = await Promise.all([
        pkgIds.length > 0 ? db.select().from(schema.packages).where(inArray(schema.packages.id, pkgIds as string[])) : [],
        pkgIds.length > 0 ? db.select().from(schema.packageItems).where(inArray(schema.packageItems.packageId, pkgIds as string[])) : [],
      ]);
      const packageMap = new Map(packages.map(p => [p.id, p]));
      const packageItemsMap = new Map<string, typeof allPackageItems>();
      allPackageItems.forEach(item => {
        const existing = packageItemsMap.get(item.packageId) || [];
        existing.push(item);
        packageItemsMap.set(item.packageId, existing);
      });

      const { resolvePublicUrl } = await import("./hms-sync.js");

      const result = allBookings.map((b: any) => {
        const prop = b.propertyId ? propertyMap.get(b.propertyId) : null;
        const rd = b.residentDetails as any;
        const installments = allInstallments.filter(i => i.bookingId === b.id);
        const payments = allPayments.filter(p => p.bookingId === b.id);
        const bPackages = allBookingPackages.filter(bp => bp.bookingId === b.id);
        const walletEntries = allWalletEntries.filter(w => w.bookingId === b.id);

        const totalPaid = payments.filter(p => p.status === "success").reduce((sum, p) => sum + (p.amount || 0), 0);
        const walletBalance = walletEntries.reduce((sum, w) => sum + (w.credit || 0) - (w.debit || 0), 0);

        return {
          bookingCode: b.bookingCode,
          status: b.status,
          hmsStatus: getHmsStatus(b.status, b.id),
          propertyName: prop?.name || null,
          propertyCode: prop?.propertyCode || null,
          resident: {
            name: rd?.fullName || rd?.name || b.walkInName || b.customerName,
            phone: b.walkInPhone || b.customerPhone || rd?.phone,
            email: b.walkInEmail || b.customerEmail || rd?.email || rd?.studentEmail,
            college: rd?.college || rd?.instituteName,
            course: rd?.course || rd?.courseName,
            year: rd?.year || rd?.courseYear,
            gender: rd?.gender,
            dateOfBirth: rd?.dateOfBirth || rd?.dob,
            parentName: rd?.parentName || rd?.guardianName,
            parentPhone: rd?.parentPhone || rd?.guardianPhone,
            parentEmail: rd?.parentEmail || rd?.guardianEmail,
            homeAddress: rd?.homeAddress || rd?.address,
            roomNo: rd?.roomNo || rd?.room,
            bedNo: rd?.bedNo,
            moveInDate: rd?.moveInDate || null,
            photoUrl: resolvePublicUrl(rd?.photoPath || rd?.photoUrl || rd?.photo) || null,
          },
          stayPlan: {
            type: b.stayPlanType,
            academicYearPeriod: b.academicYearPeriod,
            checkInDate: b.checkInDate || rd?.checkInDate || rd?.moveInDate || null,
            checkOutDate: b.checkOutDate || rd?.checkOutDate || null,
            moveInDate: rd?.moveInDate || b.checkInDate || null,
            durationMonths: b.durationMonths,
          },
          financial: {
            baseFee: b.baseFee,
            discount: b.discount,
            discountPercent: b.discountPercent,
            totalFee: b.totalFee,
            deposit: b.deposit,
            totalPaid,
            balanceDue: (b.totalFee || 0) - totalPaid,
            walletBalance,
          },
          installments: installments.map(i => ({
            name: i.name,
            amount: i.amount,
            dueDate: i.dueDate,
            paid: i.paid,
            paidAt: i.paidAt,
          })),
          payments: payments.map(p => ({
            amount: p.amount,
            status: p.status,
            method: p.paymentMethod,
            razorpayPaymentId: p.razorpayPaymentId,
            notes: p.notes,
            createdAt: p.createdAt,
          })),
          packages: bPackages.map(bp => {
            const pkg = bp.packageId ? packageMap.get(bp.packageId) : null;
            const items = bp.packageId ? (packageItemsMap.get(bp.packageId) || []) : [];
            return {
              name: pkg?.name || null,
              category: pkg?.category || null,
              tierLevel: pkg?.tierLevel ?? null,
              basePrice: pkg?.basePrice || null,
              tagline: pkg?.tagline || null,
              occupancy: pkg?.occupancy || null,
              locationInfo: pkg?.locationInfo || null,
              status: bp.status,
              startDate: bp.startDate,
              endDate: bp.endDate,
              priceSnapshot: bp.priceSnapshot,
              selectedItems: bp.selectedItems,
              features: items.map(item => ({
                type: item.type,
                label: item.label,
                value: item.featureValue,
                includedQty: item.includedQty,
                unit: item.unit,
                isOptional: item.isOptional,
              })),
            };
          }),
          wallet: walletEntries.map(w => ({
            credit: w.credit,
            debit: w.debit,
            note: w.note,
            refType: w.refType,
            createdAt: w.createdAt,
          })),
          includedServices: (() => {
            const propertyServices: any[] = Array.isArray(prop?.includedServices) ? prop.includedServices : [];
            const allActiveBps = bPackages.filter(bp => bp.status === "ACTIVE");
            const housingBp = allActiveBps.find(bp => {
              const pkg = bp.packageId ? packageMap.get(bp.packageId) : null;
              return pkg?.category === "housing_plan";
            });
            const housingPkgItems = housingBp?.packageId ? (packageItemsMap.get(housingBp.packageId) || []) : [];
            const ALL_MEALS = ["breakfast", "lunch", "evening_snacks", "dinner"];
            const MEAL_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", evening_snacks: "Evening Snacks", dinner: "Dinner" };

            return propertyServices.map((svc: any) => {
              const pkgItem = housingPkgItems.find(i => i.type === svc.type);
              let effectiveMealCount = svc.type === "meals" && pkgItem ? (pkgItem.includedQty || 0) : 0;
              let effectiveFeature = pkgItem?.featureValue || null;
              for (const abp of allActiveBps) {
                const abpPkg = abp.packageId ? packageMap.get(abp.packageId) : null;
                if (abpPkg?.category === "addon_service") {
                  const addonItems = abp.packageId ? (packageItemsMap.get(abp.packageId) || []) : [];
                  const addonItem = addonItems.find(i => i.type === svc.type);
                  if (addonItem) {
                    if (svc.type === "meals") {
                      if ((addonItem.includedQty || 0) > effectiveMealCount) {
                        effectiveMealCount = addonItem.includedQty || 0;
                        effectiveFeature = addonItem.featureValue || effectiveFeature;
                      }
                    } else {
                      effectiveFeature = addonItem.featureValue || effectiveFeature;
                    }
                  }
                }
              }
              if (svc.type === "meals" && svc.schedule) {
                const mergeMeals = (dayRules: any) => {
                  if (!dayRules) return { count: effectiveMealCount || 0, meals: [] as string[], mealLabels: [] as string[] };
                  let meals = Array.isArray(dayRules.meals) ? [...dayRules.meals] : [];
                  const baseCount = dayRules.count ?? meals.length;
                  if (effectiveMealCount > 0 && effectiveMealCount > baseCount) {
                    const missing = ALL_MEALS.filter(m => !meals.includes(m));
                    meals = [...meals, ...missing.slice(0, effectiveMealCount - baseCount)];
                    meals.sort((a, b) => ALL_MEALS.indexOf(a) - ALL_MEALS.indexOf(b));
                  }
                  const finalCount = Math.max(baseCount, effectiveMealCount > 0 ? effectiveMealCount : baseCount);
                  return { count: finalCount, meals, mealLabels: meals.map(m => MEAL_LABELS[m] || m) };
                };
                return {
                  type: svc.type,
                  label: svc.label,
                  description: svc.description || null,
                  packageFeature: effectiveFeature,
                  schedule: {
                    weekday: mergeMeals(svc.schedule.weekday),
                    saturday: mergeMeals(svc.schedule.saturday),
                    sunday: mergeMeals(svc.schedule.sunday),
                  },
                };
              }
              return {
                type: svc.type,
                label: svc.label,
                description: svc.description || null,
                packageFeature: effectiveFeature,
              };
            });
          })(),
          agreement: {
            generated: b.agreementGenerated || false,
            url: b.agreementUrl || null,
            signatureData: b.signatureData ? true : false,
          },
          invoice: {
            generated: b.invoiceGenerated || false,
            url: b.invoiceUrl || null,
          },
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        };
      });

      res.json({ bookings: result, total: result.length });
    } catch (error: any) {
      console.error("[HMS Bookings API] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/hms/bookings/:identifier", hmsApiKeyAuth, async (req: any, res) => {
    try {
      const identifier = req.params.identifier;
      let booking: any = null;

      const [byCode] = await db.select().from(schema.bookings).where(eq(schema.bookings.bookingCode, identifier));
      if (byCode) {
        booking = byCode;
      } else {
        const phone10 = identifier.replace(/\D/g, "").slice(-10);
        if (phone10.length === 10) {
          const allBookings = await db.select().from(schema.bookings).where(
            sql`${schema.bookings.status} NOT IN ('cancelled')`
          );
          booking = allBookings.find((b: any) => {
            const rd = b.residentDetails as any;
            const bPhone = (b.walkInPhone || b.customerPhone || rd?.phone || "").replace(/\D/g, "").slice(-10);
            return bPhone === phone10;
          });
        }
      }

      if (!booking) return res.status(404).json({ error: "Booking not found" });

      const [prop] = booking.propertyId
        ? await db.select().from(schema.properties).where(eq(schema.properties.id, booking.propertyId))
        : [null];

      const [installments, payments, bPackages, walletEntries, singleSeasonStatuses] = await Promise.all([
        db.select().from(schema.installments).where(eq(schema.installments.bookingId, booking.id)),
        db.select().from(schema.payments).where(eq(schema.payments.bookingId, booking.id)),
        db.select().from(schema.bookingPackages).where(eq(schema.bookingPackages.bookingId, booking.id)),
        db.select().from(schema.walletLedger).where(eq(schema.walletLedger.bookingId, booking.id)),
        db.select().from(schema.residentSeasonStatus).where(eq(schema.residentSeasonStatus.bookingId, booking.id)),
      ]);

      const singleSeasonStatus = singleSeasonStatuses.length > 0 ? singleSeasonStatuses[singleSeasonStatuses.length - 1].status : null;
      const getSingleHmsStatus = (bookingStatus: string): string => {
        if (singleSeasonStatus === "RETAINED") return "Retained";
        if (singleSeasonStatus === "NOT_RETAINED") return "Not Retained";
        switch (bookingStatus) {
          case "draft": return "Draft";
          case "pending_payment": return "Pending Payment";
          case "pending_approval": return "Pending Approval";
          case "confirmed": return "New Booking";
          case "active": return "Active";
          case "completed": return "Completed";
          case "cancelled": return "Cancelled";
          default: return bookingStatus;
        }
      };

      const pkgIds = [...new Set(bPackages.map(bp => bp.packageId).filter(Boolean))];
      const [packages, singlePkgItems] = await Promise.all([
        pkgIds.length > 0 ? db.select().from(schema.packages).where(inArray(schema.packages.id, pkgIds as string[])) : [],
        pkgIds.length > 0 ? db.select().from(schema.packageItems).where(inArray(schema.packageItems.packageId, pkgIds as string[])) : [],
      ]);
      const packageMap = new Map(packages.map(p => [p.id, p]));
      const singlePkgItemsMap = new Map<string, typeof singlePkgItems>();
      singlePkgItems.forEach(item => {
        const existing = singlePkgItemsMap.get(item.packageId) || [];
        existing.push(item);
        singlePkgItemsMap.set(item.packageId, existing);
      });

      const rd = booking.residentDetails as any;
      const totalPaid = payments.filter(p => p.status === "success").reduce((sum, p) => sum + (p.amount || 0), 0);
      const walletBalance = walletEntries.reduce((sum, w) => sum + (w.credit || 0) - (w.debit || 0), 0);

      const { resolvePublicUrl: resolveUrl } = await import("./hms-sync.js");

      res.json({
        bookingCode: booking.bookingCode,
        status: booking.status,
        hmsStatus: getSingleHmsStatus(booking.status),
        propertyName: prop?.name || null,
        propertyCode: prop?.propertyCode || null,
        resident: {
          name: rd?.fullName || rd?.name || booking.walkInName || booking.customerName,
          phone: booking.walkInPhone || booking.customerPhone || rd?.phone,
          email: booking.walkInEmail || booking.customerEmail || rd?.email || rd?.studentEmail,
          college: rd?.college || rd?.instituteName,
          course: rd?.course || rd?.courseName,
          year: rd?.year || rd?.courseYear,
          gender: rd?.gender,
          dateOfBirth: rd?.dateOfBirth || rd?.dob,
          parentName: rd?.parentName || rd?.guardianName,
          parentPhone: rd?.parentPhone || rd?.guardianPhone,
          parentEmail: rd?.parentEmail || rd?.guardianEmail,
          homeAddress: rd?.homeAddress || rd?.address,
          roomNo: rd?.roomNo || rd?.room,
          bedNo: rd?.bedNo,
          moveInDate: rd?.moveInDate || null,
          photoUrl: resolveUrl(rd?.photoPath || rd?.photoUrl || rd?.photo) || null,
        },
        stayPlan: {
          type: booking.stayPlanType,
          academicYearPeriod: booking.academicYearPeriod,
          checkInDate: booking.checkInDate || rd?.checkInDate || rd?.moveInDate || null,
          checkOutDate: booking.checkOutDate || rd?.checkOutDate || null,
          moveInDate: rd?.moveInDate || booking.checkInDate || null,
          durationMonths: booking.durationMonths,
        },
        financial: {
          baseFee: booking.baseFee,
          discount: booking.discount,
          discountPercent: booking.discountPercent,
          totalFee: booking.totalFee,
          deposit: booking.deposit,
          totalPaid,
          balanceDue: (booking.totalFee || 0) - totalPaid,
          walletBalance,
        },
        installments: installments.map(i => ({
          name: i.name,
          amount: i.amount,
          dueDate: i.dueDate,
          paid: i.paid,
          paidAt: i.paidAt,
        })),
        payments: payments.map(p => ({
          amount: p.amount,
          status: p.status,
          method: p.paymentMethod,
          razorpayPaymentId: p.razorpayPaymentId,
          notes: p.notes,
          createdAt: p.createdAt,
        })),
        packages: bPackages.map(bp => {
          const pkg = bp.packageId ? packageMap.get(bp.packageId) : null;
          const items = bp.packageId ? (singlePkgItemsMap.get(bp.packageId) || []) : [];
          return {
            name: pkg?.name || null,
            category: pkg?.category || null,
            tierLevel: pkg?.tierLevel ?? null,
            basePrice: pkg?.basePrice || null,
            tagline: pkg?.tagline || null,
            occupancy: pkg?.occupancy || null,
            locationInfo: pkg?.locationInfo || null,
            status: bp.status,
            startDate: bp.startDate,
            endDate: bp.endDate,
            priceSnapshot: bp.priceSnapshot,
            selectedItems: bp.selectedItems,
            features: items.map(item => ({
              type: item.type,
              label: item.label,
              value: item.featureValue,
              includedQty: item.includedQty,
              unit: item.unit,
              isOptional: item.isOptional,
            })),
          };
        }),
        wallet: walletEntries.map(w => ({
          credit: w.credit,
          debit: w.debit,
          note: w.note,
          refType: w.refType,
          createdAt: w.createdAt,
        })),
        includedServices: (() => {
          const propertyServices: any[] = Array.isArray(prop?.includedServices) ? prop.includedServices : [];
          const allActiveBps = bPackages.filter(bp => bp.status === "ACTIVE");
          const housingBp = allActiveBps.find(bp => {
            const pkg = bp.packageId ? packageMap.get(bp.packageId) : null;
            return pkg?.category === "housing_plan";
          });
          const housingPkgItems = housingBp?.packageId ? (singlePkgItemsMap.get(housingBp.packageId) || []) : [];
          const ALL_MEALS = ["breakfast", "lunch", "evening_snacks", "dinner"];
          const MEAL_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", evening_snacks: "Evening Snacks", dinner: "Dinner" };

          return propertyServices.map((svc: any) => {
            const pkgItem = housingPkgItems.find(i => i.type === svc.type);
            let effectiveMealCount = svc.type === "meals" && pkgItem ? (pkgItem.includedQty || 0) : 0;
            let effectiveFeature = pkgItem?.featureValue || null;
            for (const abp of allActiveBps) {
              const abpPkg = abp.packageId ? packageMap.get(abp.packageId) : null;
              if (abpPkg?.category === "addon_service") {
                const addonItems = abp.packageId ? (singlePkgItemsMap.get(abp.packageId) || []) : [];
                const addonItem = addonItems.find(i => i.type === svc.type);
                if (addonItem) {
                  if (svc.type === "meals") {
                    if ((addonItem.includedQty || 0) > effectiveMealCount) {
                      effectiveMealCount = addonItem.includedQty || 0;
                      effectiveFeature = addonItem.featureValue || effectiveFeature;
                    }
                  } else {
                    effectiveFeature = addonItem.featureValue || effectiveFeature;
                  }
                }
              }
            }
            if (svc.type === "meals" && svc.schedule) {
              const mergeMeals = (dayRules: any) => {
                if (!dayRules) return { count: effectiveMealCount || 0, meals: [] as string[], mealLabels: [] as string[] };
                let meals = Array.isArray(dayRules.meals) ? [...dayRules.meals] : [];
                const baseCount = dayRules.count ?? meals.length;
                if (effectiveMealCount > 0 && effectiveMealCount > baseCount) {
                  const missing = ALL_MEALS.filter(m => !meals.includes(m));
                  meals = [...meals, ...missing.slice(0, effectiveMealCount - baseCount)];
                  meals.sort((a, b) => ALL_MEALS.indexOf(a) - ALL_MEALS.indexOf(b));
                }
                const finalCount = Math.max(baseCount, effectiveMealCount > 0 ? effectiveMealCount : baseCount);
                return { count: finalCount, meals, mealLabels: meals.map(m => MEAL_LABELS[m] || m) };
              };
              return {
                type: svc.type,
                label: svc.label,
                description: svc.description || null,
                packageFeature: effectiveFeature,
                schedule: {
                  weekday: mergeMeals(svc.schedule.weekday),
                  saturday: mergeMeals(svc.schedule.saturday),
                  sunday: mergeMeals(svc.schedule.sunday),
                },
              };
            }
            return {
              type: svc.type,
              label: svc.label,
              description: svc.description || null,
              packageFeature: effectiveFeature,
            };
          });
        })(),
        agreement: {
          generated: booking.agreementGenerated || false,
          url: booking.agreementUrl || null,
          signatureData: booking.signatureData ? true : false,
        },
        invoice: {
          generated: booking.invoiceGenerated || false,
          url: booking.invoiceUrl || null,
        },
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
      });
    } catch (error: any) {
      console.error("[HMS Booking Detail API] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/hms/residents/update", hmsApiKeyAuth, async (req: any, res) => {
    try {
      const { phone, email, name, roomNo, bedNo, gender, dateOfBirth, dob,
              moveInDate, checkInDate, checkOutDate, course, institute,
              dietaryPreference, accommodationType, guardianName, guardianPhone,
              guardianRelation, address, city, state, pincode, notes,
              photoUrl,
              status: hmsStatus } = req.body;

      if (!phone && !email) {
        return res.status(400).json({ error: "Phone or email is required to identify the resident" });
      }

      const normalizedPhone = (phone || "").replace(/\D/g, "").slice(-10);
      const normalizedEmail = (email || "").toLowerCase().trim();

      const allBookings = await db.select().from(schema.bookings).where(
        sql`${schema.bookings.status} NOT IN ('cancelled')`
      );

      const matchedBookings = allBookings.filter((b: any) => {
        const rd = b.residentDetails as any;
        const bPhone = (b.walkInPhone || rd?.phone || "").replace(/\D/g, "").slice(-10);
        const bEmail = (b.walkInEmail || rd?.email || "").toLowerCase().trim();
        if (normalizedPhone && normalizedPhone.length === 10 && bPhone === normalizedPhone) return true;
        if (normalizedEmail && bEmail === normalizedEmail) return true;
        return false;
      });

      if (matchedBookings.length === 0) {
        return res.status(404).json({ error: "No matching booking found for this resident" });
      }

      const updatedBookings: any[] = [];

      for (const booking of matchedBookings) {
        const existingRd = (booking.residentDetails as any) || {};
        const updatedRd: any = { ...existingRd };

        if (name) updatedRd.name = name;
        if (roomNo !== undefined) updatedRd.roomNo = roomNo;
        if (bedNo !== undefined) updatedRd.bedNo = bedNo;
        if (gender) updatedRd.gender = gender;
        if (dateOfBirth || dob) updatedRd.dob = dateOfBirth || dob;
        if (moveInDate) updatedRd.moveInDate = moveInDate;
        if (checkInDate) updatedRd.checkInDate = checkInDate;
        if (checkOutDate) updatedRd.checkOutDate = checkOutDate;
        if (course) updatedRd.course = course;
        if (institute) updatedRd.institute = institute;
        if (dietaryPreference) updatedRd.dietaryPreference = dietaryPreference;
        if (accommodationType) updatedRd.accommodationType = accommodationType;
        if (guardianName) updatedRd.guardianName = guardianName;
        if (guardianPhone) updatedRd.guardianPhone = guardianPhone;
        if (guardianRelation) updatedRd.guardianRelation = guardianRelation;
        if (address) updatedRd.address = address;
        if (city) updatedRd.city = city;
        if (state) updatedRd.state = state;
        if (pincode) updatedRd.pincode = pincode;
        if (phone) updatedRd.phone = phone;
        if (email) updatedRd.email = email;
        if (photoUrl) updatedRd.photoUrl = photoUrl;

        const updateData: any = {
          residentDetails: updatedRd,
          updatedAt: new Date(),
        };

        if (name) { updateData.walkInName = name; }
        if (phone) { updateData.walkInPhone = phone; }
        if (email) { updateData.walkInEmail = email; }

        if (hmsStatus) {
          const statusMap: Record<string, string> = {
            "active": "active",
            "checked_in": "active",
            "checked_out": "completed",
            "departed": "completed",
            "cancelled": "cancelled",
          };
          const mappedStatus = statusMap[hmsStatus.toLowerCase()];
          if (mappedStatus) updateData.status = mappedStatus;
        }

        const [updated] = await db.update(schema.bookings)
          .set(updateData)
          .where(eq(schema.bookings.id, booking.id))
          .returning();

        if (updated) {
          try {
            const [adminUser] = await db.select().from(schema.users).where(inArray(schema.users.role, ["admin", "superadmin"])).limit(1);
            if (adminUser) {
              await db.insert(schema.auditLogs).values({
                id: crypto.randomUUID(),
                adminId: adminUser.id,
                action: "hms_resident_update",
                entityType: "booking",
                entityId: booking.id,
                details: JSON.stringify({
                  source: "HMS",
                  updatedFields: Object.keys(req.body).filter(k => req.body[k] !== undefined && k !== "phone" && k !== "email"),
                  phone: normalizedPhone,
                  email: normalizedEmail,
                }),
              });
            }
          } catch (auditErr: any) {
            console.warn("[HMS→CRM] Audit log failed:", auditErr.message);
          }

          updatedBookings.push({
            bookingId: updated.id,
            bookingCode: updated.bookingCode,
            customerName: updated.customerName,
            status: updated.status,
          });
        }
      }

      console.log(`[HMS→CRM] Resident update: ${updatedBookings.length} booking(s) updated for phone=${normalizedPhone} email=${normalizedEmail}`);
      res.json({
        success: true,
        message: `${updatedBookings.length} booking(s) updated`,
        updatedBookings,
      });
    } catch (error: any) {
      console.error("[HMS→CRM] Resident update error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/hms/bookings/:identifier/receipt", hmsApiKeyAuth, async (req: any, res) => {
    try {
      const identifier = req.params.identifier;
      const format = (req.query.format || "html") as string;
      let booking: any = null;

      const [byCode] = await db.select().from(schema.bookings).where(eq(schema.bookings.bookingCode, identifier));
      if (byCode) {
        booking = byCode;
      } else {
        const phone10 = identifier.replace(/\D/g, "").slice(-10);
        if (phone10.length === 10) {
          const allBookings = await db.select().from(schema.bookings).where(
            sql`${schema.bookings.status} NOT IN ('cancelled')`
          );
          booking = allBookings.find((b: any) => {
            const rd = b.residentDetails as any;
            const bPhone = (b.walkInPhone || b.customerPhone || rd?.phone || "").replace(/\D/g, "").slice(-10);
            return bPhone === phone10;
          });
        }
      }

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const property = booking.propertyId
        ? (await db.select().from(schema.properties).where(eq(schema.properties.id, booking.propertyId)))[0]
        : null;

      const [bookingPayments, bookingInstallments, bookingPkgs, receiptSeasonStatuses] = await Promise.all([
        db.select().from(schema.payments).where(eq(schema.payments.bookingId, booking.id)).orderBy(desc(schema.payments.createdAt)),
        db.select().from(schema.installments).where(eq(schema.installments.bookingId, booking.id)).orderBy(schema.installments.dueDate),
        db.select().from(schema.bookingPackages).where(eq(schema.bookingPackages.bookingId, booking.id)),
        db.select().from(schema.residentSeasonStatus).where(eq(schema.residentSeasonStatus.bookingId, booking.id)),
      ]);

      const receiptSeasonStatus = receiptSeasonStatuses.length > 0 ? receiptSeasonStatuses[receiptSeasonStatuses.length - 1].status : null;
      const getReceiptHmsStatus = (bookingStatus: string): string => {
        if (receiptSeasonStatus === "RETAINED") return "Retained";
        if (receiptSeasonStatus === "NOT_RETAINED") return "Not Retained";
        switch (bookingStatus) {
          case "draft": return "Draft";
          case "pending_payment": return "Pending Payment";
          case "pending_approval": return "Pending Approval";
          case "confirmed": return "New Booking";
          case "active": return "Active";
          case "completed": return "Completed";
          case "cancelled": return "Cancelled";
          default: return bookingStatus;
        }
      };

      const receiptPkgIds = [...new Set(bookingPkgs.map(bp => bp.packageId).filter(Boolean))] as string[];
      const [receiptPkgList, receiptPkgItemList] = await Promise.all([
        receiptPkgIds.length > 0 ? db.select().from(schema.packages).where(inArray(schema.packages.id, receiptPkgIds)) : [],
        receiptPkgIds.length > 0 ? db.select().from(schema.packageItems).where(inArray(schema.packageItems.packageId, receiptPkgIds)) : [],
      ]);
      const receiptPkgMap = new Map(receiptPkgList.map(p => [p.id, p]));
      const receiptPkgItemMap = new Map<string, typeof receiptPkgItemList>();
      receiptPkgItemList.forEach(item => {
        const existing = receiptPkgItemMap.get(item.packageId) || [];
        existing.push(item);
        receiptPkgItemMap.set(item.packageId, existing);
      });
      const pkgDetails = bookingPkgs.filter(bp => bp.packageId && receiptPkgMap.has(bp.packageId)).map(bp => ({
        ...bp,
        package: receiptPkgMap.get(bp.packageId!)!,
        items: receiptPkgItemMap.get(bp.packageId!) || [],
      }));

      const rd = (booking.residentDetails as any) || {};
      const totalPaid = bookingPayments.filter((p: any) => p.status === "success").reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      const balanceDue = (booking.totalFee || 0) - totalPaid;
      const activePlan = pkgDetails.find((bp: any) => bp.status === "ACTIVE" && bp.package?.category === "housing_plan");

      const fmtLabel = (s: string) => (s || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
      const fmtDate = (d: any) => {
        if (!d) return "N/A";
        try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
        catch { return String(d); }
      };
      const fmtCurrency = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

      if (format === "json") {
        return res.json({
          bookingCode: booking.bookingCode,
          status: booking.status,
          hmsStatus: getReceiptHmsStatus(booking.status),
          propertyName: property?.name || "N/A",
          customer: {
            name: booking.customerName || rd.name || "N/A",
            phone: booking.customerPhone || rd.phone || "N/A",
            email: booking.customerEmail || rd.email || "N/A",
          },
          resident: rd,
          stayPlan: {
            type: booking.stayPlanType,
            durationMonths: booking.durationMonths,
            checkInDate: booking.checkInDate,
            checkOutDate: booking.checkOutDate,
          },
          financial: {
            baseFee: booking.baseFee,
            discount: booking.discount,
            totalFee: booking.totalFee,
            deposit: booking.deposit,
            totalPaid,
            balanceDue,
          },
          activePlan: activePlan ? {
            name: activePlan.package?.name,
            category: activePlan.package?.category,
            tierLevel: activePlan.package?.tierLevel,
            basePrice: activePlan.package?.basePrice,
            tagline: activePlan.package?.tagline || null,
            occupancy: activePlan.package?.occupancy || null,
            locationInfo: activePlan.package?.locationInfo || null,
            features: (activePlan as any).items?.map((item: any) => ({
              type: item.type,
              label: item.label,
              value: item.featureValue,
              includedQty: item.includedQty,
              unit: item.unit,
              isOptional: item.isOptional,
            })) || [],
          } : null,
          installments: bookingInstallments.map((inst: any) => ({
            name: inst.name,
            amount: inst.amount,
            dueDate: inst.dueDate,
            paid: inst.paid,
            paidAt: inst.paidAt,
          })),
          payments: bookingPayments.map((p: any) => ({
            amount: p.amount,
            status: p.status,
            method: p.paymentMethod,
            transactionId: p.razorpayPaymentId,
            screenshotUrl: (() => { if (!p.screenshotPath) return null; try { const arr = JSON.parse(p.screenshotPath); if (Array.isArray(arr)) return arr; } catch {} return p.screenshotPath; })(),
            createdAt: p.createdAt,
          })),
          createdAt: booking.createdAt,
        });
      }

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Receipt - ${booking.bookingCode || "Booking"}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;color:#1a1a1a;padding:20px}
.receipt{max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.header{background:linear-gradient(135deg,#4f46e5,#6366f1);color:#fff;padding:28px 32px;text-align:center}
.header h1{font-size:22px;font-weight:700;letter-spacing:1px}
.header p{font-size:12px;opacity:.85;margin-top:4px}
.header .code{margin-top:16px;display:inline-block;background:rgba(255,255,255,.2);border-radius:8px;padding:8px 24px}
.header .code span{font-size:18px;font-weight:700;letter-spacing:2px}
.header .code small{display:block;font-size:10px;opacity:.7;text-transform:uppercase;margin-bottom:2px}
.body{padding:24px 32px}
.section{margin-bottom:20px}
.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#4f46e5;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e8e5ff}
.row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}
.row .label{color:#666}.row .value{font-weight:500;text-align:right;max-width:60%}
.row.highlight{background:#f0fdf4;margin:0 -8px;padding:6px 8px;border-radius:6px}
.row.highlight .value{color:#16a34a;font-weight:700}
.row.due .value{color:#dc2626;font-weight:700}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;text-transform:uppercase}
.badge-confirmed{background:#dbeafe;color:#2563eb}.badge-active{background:#dcfce7;color:#16a34a}
.badge-completed{background:#f3e8ff;color:#7c3aed}.badge-pending{background:#fef3c7;color:#d97706}
.badge-success{background:#dcfce7;color:#16a34a}.badge-failed{background:#fee2e2;color:#dc2626}
.plan-banner{background:linear-gradient(135deg,#f8fafc,#eef2ff);border:1px solid #c7d2fe;border-radius:8px;padding:14px 16px;margin-bottom:16px}
.plan-banner h3{font-size:14px;color:#4f46e5;font-weight:700}
.plan-banner p{font-size:11px;color:#64748b;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
th{text-align:left;padding:8px 10px;background:#f8fafc;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;font-size:11px;text-transform:uppercase}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
.footer{text-align:center;padding:16px 32px 24px;color:#94a3b8;font-size:11px;border-top:1px solid #f1f5f9}
.screenshot-link{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#4f46e5;text-decoration:none;margin-top:4px}
.screenshot-link:hover{text-decoration:underline}
@media print{body{background:#fff;padding:0}.receipt{box-shadow:none;border-radius:0}}
</style></head><body>
<div class="receipt">
<div class="header">
  <h1>HSQUARELIVING</h1>
  <p>Pvt Ltd &bull; Premium Student Accommodation</p>
  <div class="code"><small>Booking Code</small><span>${booking.bookingCode || "N/A"}</span></div>
</div>
<div class="body">
  <div class="section">
    <div class="section-title">Booking Details</div>
    <div class="row"><span class="label">Status</span><span class="value"><span class="badge badge-${booking.status === "confirmed" ? "confirmed" : booking.status === "active" ? "active" : booking.status === "completed" ? "completed" : "pending"}">${fmtLabel(booking.status)}</span></span></div>
    <div class="row"><span class="label">Customer</span><span class="value">${booking.customerName || rd.name || "N/A"}</span></div>
    <div class="row"><span class="label">Phone</span><span class="value">${booking.customerPhone || rd.phone || "N/A"}</span></div>
    <div class="row"><span class="label">Email</span><span class="value">${booking.customerEmail || rd.email || "N/A"}</span></div>
    <div class="row"><span class="label">Property</span><span class="value">${property?.name || "N/A"}</span></div>
    ${rd.roomNo ? `<div class="row"><span class="label">Room No.</span><span class="value">${rd.roomNo}</span></div>` : ""}
    ${rd.bedNo ? `<div class="row"><span class="label">Bed No.</span><span class="value">${rd.bedNo}</span></div>` : ""}
    <div class="row"><span class="label">Stay Plan</span><span class="value">${fmtLabel(booking.stayPlanType || "")}</span></div>
    ${booking.durationMonths ? `<div class="row"><span class="label">Duration</span><span class="value">${booking.durationMonths} months</span></div>` : ""}
    <div class="row"><span class="label">Booking Date</span><span class="value">${fmtDate(booking.createdAt)}</span></div>
  </div>

  ${activePlan ? `<div class="plan-banner">
    <h3>${activePlan.package?.name || "Housing Plan"}</h3>
    <p>Tier ${activePlan.package?.tierLevel ?? 0} &bull; ${fmtCurrency(Number(activePlan.package?.basePrice) || 0)}</p>
    ${(activePlan as any).items?.length > 0 ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">
      ${(activePlan as any).items.map((item: any) => `<span style="display:inline-block;background:#e0e7ff;color:#3730a3;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:500">${item.label}${item.featureValue ? ': ' + item.featureValue : ''}${item.includedQty > 0 ? ' (' + item.includedQty + ' ' + item.unit + ')' : ''}</span>`).join('')}
    </div>` : ''}
  </div>` : ""}

  <div class="section">
    <div class="section-title">Financial Summary</div>
    <div class="row"><span class="label">Base Fee</span><span class="value">${fmtCurrency(booking.baseFee)}</span></div>
    ${booking.discount > 0 ? `<div class="row"><span class="label">Discount</span><span class="value" style="color:#16a34a">-${fmtCurrency(booking.discount)}</span></div>` : ""}
    <div class="row" style="font-weight:600;border-top:1px solid #e2e8f0;padding-top:8px"><span class="label">Total Fee</span><span class="value">${fmtCurrency(booking.totalFee)}</span></div>
    ${booking.deposit ? `<div class="row"><span class="label">Deposit</span><span class="value">${fmtCurrency(booking.deposit)}</span></div>` : ""}
    <div class="row highlight"><span class="label">Total Paid</span><span class="value">${fmtCurrency(totalPaid)}</span></div>
    <div class="row ${balanceDue > 0 ? "due" : "highlight"}"><span class="label">Balance Due</span><span class="value">${fmtCurrency(balanceDue)}</span></div>
  </div>

  ${bookingInstallments.length > 0 ? `<div class="section">
    <div class="section-title">Installments</div>
    <table><thead><tr><th>Name</th><th>Amount</th><th>Due Date</th><th>Status</th></tr></thead><tbody>
    ${bookingInstallments.map((inst: any) => `<tr>
      <td>${inst.name}</td><td>${fmtCurrency(Number(inst.amount))}</td>
      <td>${fmtDate(inst.dueDate)}</td>
      <td><span class="badge ${inst.paid ? "badge-success" : "badge-pending"}">${inst.paid ? "Paid" : "Pending"}</span></td>
    </tr>`).join("")}
    </tbody></table></div>` : ""}

  ${bookingPayments.length > 0 ? `<div class="section">
    <div class="section-title">Payment History</div>
    <table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>UTR/Txn ID</th><th>Status</th><th></th></tr></thead><tbody>
    ${bookingPayments.map((p: any) => `<tr>
      <td>${fmtDate(p.createdAt)}</td>
      <td>${fmtCurrency(Number(p.amount))}</td>
      <td>${(p.paymentMethod || "—").toUpperCase()}</td>
      <td style="font-family:monospace;font-size:11px">${p.razorpayPaymentId || "—"}</td>
      <td><span class="badge ${p.status === "success" ? "badge-success" : p.status === "failed" ? "badge-failed" : "badge-pending"}">${(p.status || "pending").toUpperCase()}</span></td>
      <td>${p.screenshotPath ? (() => { try { const arr = JSON.parse(p.screenshotPath); if (Array.isArray(arr)) return arr.map((u: string, i: number) => `<a href="${u}" target="_blank" class="screenshot-link">📷 ${arr.length > 1 ? i + 1 : "View"}</a>`).join(" "); } catch {} return `<a href="${p.screenshotPath}" target="_blank" class="screenshot-link">📷 View</a>`; })() : ""}</td>
    </tr>`).join("")}
    </tbody></table></div>` : ""}
</div>
<div class="footer">
  <p>Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
  <p style="margin-top:4px">Hsquareliving Pvt Ltd &bull; Premium Student Accommodation</p>
</div>
</div></body></html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error: any) {
      console.error("[HMS Receipt API] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/sync/first-payment", hmsApiKeyAuth, async (req: any, res) => {
    try {
      const { bookingCode, name, email, phone, room, propertyCode, moveInDate, checkOutDate, amountPaid, paymentDate, eventId } = req.body;

      if (!bookingCode) {
        return res.status(400).json({ error: "bookingCode is required" });
      }

      console.log(`[Sync First Payment] Received webhook for ${bookingCode}, eventId: ${eventId || "none"}`);

      let booking: any = null;
      const [directMatch] = await db.select().from(schema.bookings).where(eq(schema.bookings.bookingCode, bookingCode));
      if (directMatch) {
        booking = directMatch;
      } else {
        console.log(`[Sync First Payment] Booking ${bookingCode} not found by code, trying phone match...`);
        const phone10 = (phone || "").replace(/\D/g, "").slice(-10);
        if (phone10.length === 10) {
          const allBookings = await db.select().from(schema.bookings).where(
            sql`${schema.bookings.status} NOT IN ('cancelled')`
          );
          booking = allBookings.find((b: any) => {
            const rd = b.residentDetails as any;
            const bPhone = (b.walkInPhone || rd?.phone || "").replace(/\D/g, "").slice(-10);
            return bPhone === phone10;
          }) || null;
        }
      }

      if (!booking) {
        return res.status(404).json({ error: `Booking not found for code ${bookingCode} or phone ${phone}` });
      }

      const resolvedBookingCode = booking.bookingCode || bookingCode;
      const rd = booking.residentDetails as any;
      const residentName = name || rd?.name || booking.walkInName || "Resident";
      const residentEmail = email || rd?.email || booking.walkInEmail || "";
      const residentPhone = phone || rd?.phone || booking.walkInPhone || "";

      const { syncBookingToHMS, getPropertyCode, resolvePublicUrl } = await import("./hms-sync.js");

      let resolvedPropertyCode = propertyCode || "";
      if (!resolvedPropertyCode && booking.propertyId) {
        const property = await storage.getProperty(booking.propertyId);
        if (property?.name) {
          resolvedPropertyCode = getPropertyCode(property.name) || property.propertyCode || property.name;
        }
      }

      let studentData: any = null;
      if (booking.studentId) {
        const [student] = await db.select().from(schema.students).where(eq(schema.students.id, booking.studentId));
        studentData = student || null;
      }

      const syncData: any = {
        name: residentName,
        email: residentEmail,
        phone: residentPhone,
        room: room || "",
        propertyCode: resolvedPropertyCode,
        moveInDate: moveInDate || (booking.checkInDate ? String(booking.checkInDate) : ""),
        checkOutDate: checkOutDate || (booking.checkOutDate ? String(booking.checkOutDate) : ""),
        bookingDate: paymentDate || new Date().toISOString().split("T")[0],
      };

      if (rd?.parentName || rd?.guardianName) syncData.parentName = rd.parentName || rd.guardianName;
      if (rd?.parentPhone || rd?.guardianPhone) syncData.parentPhone = rd.parentPhone || rd.guardianPhone;
      if (rd?.parentEmail || rd?.guardianEmail) syncData.parentEmail = rd.parentEmail || rd.guardianEmail;
      if (rd?.institute || rd?.college || rd?.instituteName) syncData.college = rd.institute || rd.college || rd.instituteName;
      if (rd?.course || rd?.courseName) syncData.courseName = rd.course || rd.courseName;
      if (rd?.courseYear) syncData.courseYear = rd.courseYear;
      if (rd?.gender) syncData.gender = rd.gender;
      if (rd?.dateOfBirth) syncData.dateOfBirth = rd.dateOfBirth;
      if (rd?.homeAddress || rd?.address) syncData.homeAddress = rd.homeAddress || rd.address;
      if (rd?.dietaryPreference || rd?.dietary) syncData.dietary = rd.dietaryPreference || rd.dietary;

      const idProofUrl = resolvePublicUrl(studentData?.idProofUrl || rd?.idProofUrl || rd?.idProof);
      const photoUrl = resolvePublicUrl(rd?.photoUrl || rd?.photo || studentData?.photoUrl);
      if (idProofUrl) syncData.idProofUrl = idProofUrl;
      if (photoUrl) syncData.photoUrl = photoUrl;
      const rawDocs = rd?.documentUrls || rd?.documents || [];
      if (Array.isArray(rawDocs) && rawDocs.length > 0) {
        const docUrls: string[] = [];
        for (const doc of rawDocs) {
          const resolved = resolvePublicUrl(typeof doc === "string" ? doc : doc?.url);
          if (resolved) docUrls.push(resolved);
        }
        if (docUrls.length > 0) syncData.documentUrls = docUrls;
      }

      console.log(`[Sync First Payment] Creating/syncing resident in HMS for ${resolvedBookingCode}...`);
      const syncResult = await syncBookingToHMS(syncData);
      console.log(`[Sync First Payment] HMS sync result for ${resolvedBookingCode}:`, JSON.stringify(syncResult));

      let welcomeResult: { success: boolean; error?: string };
      if (booking && !booking.welcomeEmailSent) {
        welcomeResult = await sendWelcomeEmailForBooking(booking);
      } else {
        welcomeResult = await sendWelcomeEmail({
          name: residentName,
          email: residentEmail,
          phone: residentPhone,
          room, propertyCode: resolvedPropertyCode, moveInDate, checkOutDate,
          bookingCode: resolvedBookingCode,
        }, booking);
        if (welcomeResult.success && booking) {
          await storage.updateBooking(booking.id, { welcomeEmailSent: true });
        }
      }
      console.log(`[Sync First Payment] Welcome email result for ${resolvedBookingCode}:`, JSON.stringify(welcomeResult));

      res.json({
        success: true,
        bookingCode: resolvedBookingCode,
        residentSynced: syncResult.success,
        residentAction: syncResult.action || null,
        syncError: syncResult.error || null,
        emailSent: welcomeResult.success,
        emailError: welcomeResult.error || null,
      });
    } catch (error: any) {
      console.error("[Sync First Payment] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/sync/wallet-debit", hmsApiKeyAuth, async (req: any, res) => {
    try {
      const { bookingCode, phone, amount, orderId, orderType, itemName, note, eventId } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid positive amount is required" });
      }
      if (!bookingCode && !phone) {
        return res.status(400).json({ error: "bookingCode or phone is required" });
      }

      console.log(`[Sync Wallet Debit] Received: bookingCode=${bookingCode}, amount=${amount}, orderId=${orderId}, eventId=${eventId || "none"}`);

      let booking: any = null;
      if (bookingCode) {
        const [match] = await db.select().from(schema.bookings).where(eq(schema.bookings.bookingCode, bookingCode));
        booking = match || null;
      }
      if (!booking && phone) {
        const phone10 = (phone || "").replace(/\D/g, "").slice(-10);
        if (phone10.length === 10) {
          const allBookings = await db.select().from(schema.bookings).where(
            sql`${schema.bookings.status} IN ('confirmed', 'active')`
          );
          booking = allBookings.find((b: any) => {
            const rd = b.residentDetails as any;
            const bPhone = (b.walkInPhone || rd?.phone || "").replace(/\D/g, "").slice(-10);
            return bPhone === phone10;
          }) || null;
        }
      }

      if (!booking) {
        return res.status(404).json({ error: `Booking not found for code ${bookingCode} or phone ${phone}` });
      }

      const entries = await db.select().from(schema.walletLedger).where(eq(schema.walletLedger.bookingId, booking.id));
      const balance = entries.reduce((acc: number, e: any) => acc + e.credit - e.debit, 0);

      if (amount > balance) {
        console.warn(`[Sync Wallet Debit] Insufficient balance for ${booking.bookingCode}: balance=${balance}, requested=${amount}`);
        return res.status(400).json({
          error: "Insufficient wallet balance",
          currentBalance: balance,
          requestedAmount: amount,
          bookingCode: booking.bookingCode,
        });
      }

      const debitNote = note || `À la carte order${orderId ? ` #${orderId}` : ""}${itemName ? `: ${itemName}` : ""}`;

      const [entry] = await db.insert(schema.walletLedger).values({
        bookingId: booking.id,
        credit: 0,
        debit: amount,
        refType: orderType || "alacarte_order",
        refId: orderId || null,
        note: debitNote,
      }).returning();

      const newBalance = balance - amount;
      console.log(`[Sync Wallet Debit] Debited ₹${amount} from ${booking.bookingCode}, new balance: ₹${newBalance}`);

      res.json({
        success: true,
        bookingCode: booking.bookingCode,
        debitedAmount: amount,
        previousBalance: balance,
        newBalance,
        ledgerEntryId: entry.id,
      });
    } catch (error: any) {
      console.error("[Sync Wallet Debit] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/sync/wallet-credit", hmsApiKeyAuth, async (req: any, res) => {
    try {
      const { bookingCode, phone, amount, orderId, reason, note, eventId } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid positive amount is required" });
      }
      if (!bookingCode && !phone) {
        return res.status(400).json({ error: "bookingCode or phone is required" });
      }

      console.log(`[Sync Wallet Credit] Received: bookingCode=${bookingCode}, amount=${amount}, orderId=${orderId}, reason=${reason}, eventId=${eventId || "none"}`);

      let booking: any = null;
      if (bookingCode) {
        const [match] = await db.select().from(schema.bookings).where(eq(schema.bookings.bookingCode, bookingCode));
        booking = match || null;
      }
      if (!booking && phone) {
        const phone10 = (phone || "").replace(/\D/g, "").slice(-10);
        if (phone10.length === 10) {
          const allBookings = await db.select().from(schema.bookings).where(
            sql`${schema.bookings.status} IN ('confirmed', 'active')`
          );
          booking = allBookings.find((b: any) => {
            const rd = b.residentDetails as any;
            const bPhone = (b.walkInPhone || rd?.phone || "").replace(/\D/g, "").slice(-10);
            return bPhone === phone10;
          }) || null;
        }
      }

      if (!booking) {
        return res.status(404).json({ error: `Booking not found for code ${bookingCode} or phone ${phone}` });
      }

      const entries = await db.select().from(schema.walletLedger).where(eq(schema.walletLedger.bookingId, booking.id));
      const balance = entries.reduce((acc: number, e: any) => acc + e.credit - e.debit, 0);

      const creditNote = note || `Refund${orderId ? ` for order #${orderId}` : ""}${reason ? ` — ${reason}` : ""}`;

      const refType = reason === "order_cancel" ? "order_refund" :
                      reason === "order_reject" ? "order_refund" :
                      reason || "manual_credit";

      const [entry] = await db.insert(schema.walletLedger).values({
        bookingId: booking.id,
        credit: amount,
        debit: 0,
        refType,
        refId: orderId || null,
        note: creditNote,
      }).returning();

      const newBalance = balance + amount;
      console.log(`[Sync Wallet Credit] Credited ₹${amount} to ${booking.bookingCode}, new balance: ₹${newBalance}`);

      res.json({
        success: true,
        bookingCode: booking.bookingCode,
        creditedAmount: amount,
        previousBalance: balance,
        newBalance,
        ledgerEntryId: entry.id,
      });
    } catch (error: any) {
      console.error("[Sync Wallet Credit] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/sync/wallet-balance", hmsApiKeyAuth, async (req: any, res) => {
    try {
      const { bookingCode, phone } = req.query;

      if (!bookingCode && !phone) {
        return res.status(400).json({ error: "bookingCode or phone query param is required" });
      }

      let booking: any = null;
      if (bookingCode) {
        const [match] = await db.select().from(schema.bookings).where(eq(schema.bookings.bookingCode, String(bookingCode)));
        booking = match || null;
      }
      if (!booking && phone) {
        const phone10 = String(phone || "").replace(/\D/g, "").slice(-10);
        if (phone10.length === 10) {
          const allBookings = await db.select().from(schema.bookings).where(
            sql`${schema.bookings.status} IN ('confirmed', 'active')`
          );
          booking = allBookings.find((b: any) => {
            const rd = b.residentDetails as any;
            const bPhone = (b.walkInPhone || rd?.phone || "").replace(/\D/g, "").slice(-10);
            return bPhone === phone10;
          }) || null;
        }
      }

      if (!booking) {
        return res.status(404).json({ error: `Booking not found` });
      }

      const entries = await db.select().from(schema.walletLedger).where(eq(schema.walletLedger.bookingId, booking.id)).orderBy(sql`${schema.walletLedger.createdAt} DESC`);
      const balance = entries.reduce((acc: number, e: any) => acc + e.credit - e.debit, 0);

      res.json({
        bookingCode: booking.bookingCode,
        balance,
        totalCredits: entries.reduce((acc: number, e: any) => acc + e.credit, 0),
        totalDebits: entries.reduce((acc: number, e: any) => acc + e.debit, 0),
        transactionCount: entries.length,
        recentTransactions: entries.slice(0, 10).map((e: any) => ({
          id: e.id,
          credit: e.credit,
          debit: e.debit,
          refType: e.refType,
          refId: e.refId,
          note: e.note,
          createdAt: e.createdAt,
        })),
      });
    } catch (error: any) {
      console.error("[Sync Wallet Balance] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/hms/sync-all-completed", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const completedBookings = await db.select().from(schema.bookings).where(
        sql`${schema.bookings.status} IN ('confirmed', 'active', 'completed', 'pending_payment')`
      );

      if (completedBookings.length === 0) {
        return res.json({ success: true, total: 0, synced: 0, failed: 0, errors: [], message: "No bookings to sync" });
      }

      const propertyIds = [...new Set(completedBookings.map(b => b.propertyId).filter(Boolean))];
      const properties = propertyIds.length > 0
        ? await db.select().from(schema.properties).where(inArray(schema.properties.id, propertyIds as string[]))
        : [];
      const propertyMap = new Map(properties.map(p => [p.id, p]));

      const { syncBookingToHMS, getPropertyCode } = await import("./hms-sync.js");

      const results = {
        total: completedBookings.length,
        synced: 0,
        failed: 0,
        skipped: 0,
        errors: [] as string[],
      };

      for (const booking of completedBookings) {
        const property = booking.propertyId ? propertyMap.get(booking.propertyId) : null;
        if (!property || !property.hmsLinked) {
          results.skipped++;
          continue;
        }

        const rd = booking.residentDetails as any;
        let studentData: any = null;
        if (booking.studentId) {
          const [student] = await db.select().from(schema.students).where(eq(schema.students.id, booking.studentId));
          studentData = student || null;
        }

        const name = studentData?.fullName || rd?.fullName || rd?.name || booking.walkInName || booking.customerName || booking.bookingCode || "Unknown";
        const phone = studentData?.phone || booking.walkInPhone || booking.customerPhone || rd?.phone || "";
        const email = studentData?.email || booking.customerEmail || rd?.email || rd?.studentEmail;
        const college = studentData?.collegeName || rd?.college || rd?.instituteName;
        const roomNo = rd?.roomNo || rd?.room || "TBA";

        const resolvedCode = property.propertyCode || getPropertyCode(property.name);
        if (!resolvedCode) {
          results.skipped++;
          results.errors.push(`${name} (${booking.bookingCode}): unknown property "${property.name}"`);
          continue;
        }

        const result = await syncBookingToHMS({
          name,
          email: email || undefined,
          phone,
          room: roomNo,
          propertyCode: resolvedCode,
          college: college || undefined,
          instituteName: college || undefined,
          courseName: studentData?.course || rd?.course || undefined,
          courseYear: studentData?.year || rd?.year || undefined,
          accommodationType: rd?.accommodationType || rd?.roomType || undefined,
          parentName: rd?.parentName || rd?.guardianName || undefined,
          parentPhone: rd?.parentPhone || rd?.guardianPhone || undefined,
          parentEmail: rd?.parentEmail || rd?.guardianEmail || undefined,
          parentRelation: rd?.parentRelation || rd?.guardianRelation || undefined,
          homeAddress: rd?.homeAddress || rd?.address || undefined,
          gender: rd?.gender || studentData?.gender || undefined,
          dateOfBirth: rd?.dateOfBirth || rd?.dob || studentData?.dateOfBirth || undefined,
          studentEmail: rd?.studentEmail || email || undefined,
          bookingDate: booking.createdAt ? new Date(booking.createdAt).toISOString().split("T")[0] : undefined,
          accessLevel: "FULL",
        });

        if (result.success) {
          results.synced++;
        } else {
          results.failed++;
          results.errors.push(`${name} (${booking.bookingCode}): ${result.error}`);
        }
      }

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "UPDATE" as ActionType,
        entityType: "BOOKING" as EntityType,
        entityId: "bulk-sync",
        entityLabel: "HMS Bulk Sync",
        metadata: { total: results.total, synced: results.synced, failed: results.failed, skipped: results.skipped },
      });

      res.json({ success: true, ...results });
    } catch (error: any) {
      console.error("[HMS Bulk Sync] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/hms/properties", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      if (!process.env.HMS_API_KEY) {
        try { await getHostelFlowJWT(); } catch (loginErr: any) {
          return res.status(502).json({ error: "Failed to authenticate with HMS: " + loginErr.message });
        }
      }

      const response = await fetch(`${HOSTEL_FLOW_BASE_URL}/api/properties`, {
        headers: getHMSAuthHeaders(),
      });

      if (!response.ok) {
        return res.status(502).json({ error: "Failed to fetch HMS properties" });
      }

      const hmsProperties = await response.json();
      res.json(hmsProperties);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch HMS properties" });
    }
  });

  app.post("/api/admin/properties/:id/link-hms", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { hmsPropertyId, hmsPropertyName, propertyCode } = req.body;
      if (!hmsPropertyId || !hmsPropertyName) {
        return res.status(400).json({ error: "hmsPropertyId and hmsPropertyName are required" });
      }

      let resolvedCode = propertyCode || null;
      if (!resolvedCode) {
        const { getPropertyCode } = await import("./hms-sync.js");
        const [currentProp] = await db.select().from(schema.properties).where(eq(schema.properties.id, req.params.id));
        resolvedCode = getPropertyCode(hmsPropertyName) || getPropertyCode(currentProp?.name || "") || null;
      }

      const [updated] = await db.update(schema.properties).set({
        hmsPropertyId,
        hmsPropertyName,
        propertyCode: resolvedCode,
        hmsLinked: true,
        updatedAt: new Date(),
      }).where(eq(schema.properties.id, req.params.id)).returning();

      if (!updated) return res.status(404).json({ error: "Property not found" });

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "UPDATE",
        entityType: "PROPERTY",
        entityId: updated.id,
        entityLabel: updated.name,
        metadata: { action: "hms_linked", hmsPropertyId, hmsPropertyName, propertyCode },
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to link HMS property" });
    }
  });

  app.post("/api/admin/properties/:id/unlink-hms", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [updated] = await db.update(schema.properties).set({
        hmsPropertyId: null,
        hmsPropertyName: null,
        hmsLinked: false,
        updatedAt: new Date(),
      }).where(eq(schema.properties.id, req.params.id)).returning();

      if (!updated) return res.status(404).json({ error: "Property not found" });

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "UPDATE",
        entityType: "PROPERTY",
        entityId: updated.id,
        entityLabel: updated.name,
        metadata: { action: "hms_unlinked" },
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to unlink HMS property" });
    }
  });

  app.post("/api/admin/properties/:id/verify-hms", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, req.params.id));
      if (!property) return res.status(404).json({ error: "Property not found" });

      if (!process.env.HMS_API_KEY) {
        try { await getHostelFlowJWT(); } catch (loginErr: any) {
          return res.status(502).json({ error: "Failed to authenticate with HMS" });
        }
      }

      const response = await fetch(`${HOSTEL_FLOW_BASE_URL}/api/properties`, {
        headers: getHMSAuthHeaders(),
      });

      if (!response.ok) {
        return res.status(502).json({ error: "Failed to fetch HMS properties" });
      }

      const hmsProperties = (await response.json()) as any[];

      let matched = null;
      if (property.propertyCode) {
        matched = hmsProperties.find((h: any) => h.propertyCode === property.propertyCode);
      }
      if (!matched) {
        const normalizedName = property.name.toLowerCase().trim();
        matched = hmsProperties.find((h: any) => h.name.toLowerCase().trim() === normalizedName);
      }
      if (!matched) {
        const words = property.name.toLowerCase().split(/\s+/);
        matched = hmsProperties.find((h: any) => {
          const hmsWords = h.name.toLowerCase().split(/\s+/);
          const common = words.filter((w: string) => hmsWords.includes(w));
          return common.length >= 2;
        });
      }

      let matchedBy = "none";
      if (matched && property.propertyCode) {
        const codeMatch = hmsProperties.find((h: any) => h.propertyCode === property.propertyCode);
        matchedBy = codeMatch === matched ? "propertyCode" : "name";
      } else if (matched) {
        matchedBy = "name";
      }

      if (matched) {
        res.json({
          linked: true,
          found: true,
          hmsProperty: matched,
          matchedBy,
        });
      } else {
        res.json({
          linked: false,
          found: false,
          availableHmsProperties: hmsProperties.map((h: any) => ({ id: h.id, name: h.name, city: h.city })),
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to verify HMS property" });
    }
  });

  app.get("/api/admin/registered-students", authMiddleware, roleMiddleware("admin", "manager", "staff", "receptionist", "sales_executive"), async (req: AuthRequest, res) => {
    try {
      if (!process.env.HMS_API_KEY) {
        try { await getHostelFlowJWT(); } catch (loginErr: any) {
          console.error("HMS login error:", loginErr.message);
          return res.status(502).json({ 
            error: "Failed to authenticate with HMS",
            details: loginErr.message
          });
        }
      }

      const searchQuery = (req.query.search as string || "").trim();

      let response = await fetch(`${HOSTEL_FLOW_BASE_URL}/api/residents`, {
        headers: getHMSAuthHeaders(),
      });

      if (response.status === 401 && !process.env.HMS_API_KEY) {
        cachedHostelFlowJWT = null;
        jwtExpiresAt = 0;
        try {
          await getHostelFlowJWT();
          response = await fetch(`${HOSTEL_FLOW_BASE_URL}/api/residents`, {
            headers: getHMSAuthHeaders(),
          });
        } catch (retryErr: any) {
          return res.status(502).json({ error: "Failed to re-authenticate with HMS", details: retryErr.message });
        }
      }

      if (!response.ok) {
        let errorDetail = "External service unavailable";
        try {
          const errorData = JSON.parse(await response.text());
          errorDetail = errorData.error || errorDetail;
        } catch (e) {}
        console.error("External API error:", response.status, errorDetail);
        return res.status(502).json({ 
          error: "Failed to fetch from external system",
          details: errorDetail
        });
      }

      let residents = await response.json();
      
      if (!Array.isArray(residents)) {
        residents = (residents as any).residents || (residents as any).data || [];
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        residents = (residents as any[]).filter((r: any) => {
          const name = (r.fullName || r.name || "").toLowerCase();
          const phone = (r.phone || "").toLowerCase();
          const email = (r.email || "").toLowerCase();
          const college = (r.college || r.instituteName || "").toLowerCase();
          const room = (r.room || "").toLowerCase();
          return name.includes(query) || phone.includes(query) || email.includes(query) || college.includes(query) || room.includes(query);
        });
      }

      const activeBookings = await db.select({
        walkInPhone: schema.bookings.walkInPhone,
        walkInEmail: schema.bookings.walkInEmail,
        bookingCode: schema.bookings.bookingCode,
        propertyId: schema.bookings.propertyId,
        status: schema.bookings.status,
        residentDetails: schema.bookings.residentDetails,
      }).from(schema.bookings).where(
        sql`${schema.bookings.status} NOT IN ('cancelled', 'completed')`
      );

      const bookedPhones = new Map<string, { bookingCode: string; propertyId: string }>();
      const bookedEmails = new Map<string, { bookingCode: string; propertyId: string }>();
      for (const b of activeBookings) {
        const rd = b.residentDetails as any;
        const phones = [b.walkInPhone, rd?.phone].filter(Boolean).map((p: string) => p.replace(/\D/g, "").slice(-10));
        const emails = [b.walkInEmail, rd?.email, rd?.studentEmail, rd?.registeredEmail].filter(Boolean).map((e: string) => e.toLowerCase().trim());
        const info = { bookingCode: b.bookingCode || "", propertyId: b.propertyId || "" };
        for (const ph of phones) { if (ph.length >= 10) bookedPhones.set(ph, info); }
        for (const em of emails) { if (em) bookedEmails.set(em, info); }
      }

      residents = (residents as any[]).map((r: any) => {
        const rPhone = (r.phone || "").replace(/\D/g, "").slice(-10);
        const rEmail = (r.email || "").toLowerCase().trim();
        const matchByPhone = rPhone.length >= 10 ? bookedPhones.get(rPhone) : undefined;
        const matchByEmail = rEmail ? bookedEmails.get(rEmail) : undefined;
        const existingBooking = matchByPhone || matchByEmail;
        return {
          ...r,
          hasActiveBooking: !!existingBooking,
          activeBookingCode: existingBooking?.bookingCode || null,
          activeBookingPropertyId: existingBooking?.propertyId || null,
        };
      });

      if (req.user!.role === "sales_executive") {
        const userId = req.user!.userId;
        const salesLeads = await storage.getLeadsForAssignedProperties(userId, []);
        const leadPhones = new Set(salesLeads.map(l => (l.phone || "").replace(/\D/g, "").slice(-10)).filter(p => p.length >= 10));
        const leadEmails = new Set(salesLeads.map(l => (l.email || "").toLowerCase().trim()).filter(Boolean));

        residents = (residents as any[]).filter((r: any) => {
          const rPhone = (r.phone || "").replace(/\D/g, "").slice(-10);
          const rEmail = (r.email || "").toLowerCase().trim();
          if (rPhone.length >= 10 && leadPhones.has(rPhone)) return true;
          if (rEmail && leadEmails.has(rEmail)) return true;
          return false;
        });
      }

      const scope = await getReceptionistScope(req);
      if (scope) {
        residents = (residents as any[]).filter((r: any) =>
          r.activeBookingPropertyId && scope.has(r.activeBookingPropertyId)
        );
      }

      res.json(residents);
    } catch (error) {
      console.error("Error fetching registered students:", error);
      res.status(500).json({ error: "Failed to connect to external system" });
    }
  });

  app.get("/api/admin/registered-students/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      if (!process.env.HMS_API_KEY) {
        try { await getHostelFlowJWT(); } catch (loginErr: any) {
          return res.status(502).json({ error: "Failed to authenticate with HMS" });
        }
      }

      let response = await fetch(`${HOSTEL_FLOW_BASE_URL}/api/residents/${req.params.id}`, {
        headers: getHMSAuthHeaders(),
      });

      if (response.status === 401 && !process.env.HMS_API_KEY) {
        cachedHostelFlowJWT = null;
        jwtExpiresAt = 0;
        try {
          await getHostelFlowJWT();
          response = await fetch(`${HOSTEL_FLOW_BASE_URL}/api/residents/${req.params.id}`, {
            headers: getHMSAuthHeaders(),
          });
        } catch (retryErr: any) {
          return res.status(502).json({ error: "Failed to re-authenticate with HMS", details: retryErr.message });
        }
      }

      if (!response.ok) {
        return res.status(response.status === 404 ? 404 : 502).json({ error: "Student not found in external system" });
      }

      const resident = await response.json();
      res.json(resident);
    } catch (error) {
      console.error("Error fetching registered student:", error);
      res.status(500).json({ error: "Failed to connect to external system" });
    }
  });

  // Apply discount override
  app.post("/api/admin/discount", async (req, res) => {
    try {
      const { bookingId, discount, reason, adminId } = req.body;

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // Recalculate total fee
      const newTotalFee = booking.baseFee - discount;

      // Update booking
      const updatedBooking = await storage.updateBooking(bookingId, {
        discount,
        totalFee: newTotalFee,
        discountReason: reason,
        discountApprovedBy: adminId,
        discountApprovedAt: new Date(),
      });

      // Recalculate and update installments
      const installmentData = calculateInstallments(booking.baseFee, booking.paymentPlanId, discount);
      const existingInstallments = await storage.getInstallmentsByBooking(bookingId);
      
      for (let i = 0; i < existingInstallments.length && i < installmentData.length; i++) {
        await storage.updateInstallment(existingInstallments[i].id, {
          amount: installmentData[i].amount,
        });
      }

      // Create audit log
      await storage.createAuditLog({
        adminId,
        action: "discount_applied",
        entityType: "booking",
        entityId: bookingId,
        details: JSON.stringify({ discount, reason, oldDiscount: booking.discount }),
      });

      res.json(updatedBooking);
    } catch (error) {
      console.error("Error applying discount:", error);
      res.status(500).json({ error: "Failed to apply discount" });
    }
  });

  // Get dashboard stats
  app.get("/api/admin/stats", async (req, res) => {
    try {
      const propertyId = typeof req.query.propertyId === "string" && req.query.propertyId.trim()
        ? req.query.propertyId.trim()
        : undefined;
      const stats = await storage.getStats(propertyId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Target & Achievement endpoints
  app.get("/api/admin/targets", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { seasonId, propertyId, month, startDate, endDate, bookingStatus } = req.query;

      const allProperties = await storage.getAllPropertiesIncludingInactive();
      const targetSettings = await storage.getPropertyTargets(
        propertyId as string | undefined,
        seasonId as string | undefined
      );

      const targetMap = new Map(targetSettings.map(t => [t.propertyId, t]));

      const propertiesToProcess = propertyId
        ? allProperties.filter(p => p.id === propertyId)
        : allProperties;

      const results = [];

      for (const prop of propertiesToProcess) {
        const propBeds = await db.select().from(schema.beds)
          .leftJoin(schema.rooms, eq(schema.beds.roomId, schema.rooms.id))
          .where(and(
            eq(schema.beds.propertyId, prop.id),
            inArray(schema.beds.status, ['available', 'occupied', 'reserved'])
          ));

        let totalBeds = propBeds.length;
        let totalBedValue = 0;

        const propPackages = await db.select().from(schema.packages)
          .where(and(
            eq(schema.packages.propertyId, prop.id),
            eq(schema.packages.isActive, true),
            eq(schema.packages.category, 'housing_plan')
          ));

        if (propPackages.length > 0) {
          const avgPkgPrice = propPackages.reduce((s, p) => s + (Number(p.basePrice) || 0), 0) / propPackages.length;
          if (totalBeds === 0) {
            const propRoomTypes = await db.select().from(schema.roomTypes)
              .where(eq(schema.roomTypes.propertyId, prop.id));
            totalBeds = propRoomTypes.reduce((s, rt) => s + (rt.totalBeds || 0), 0);
          }
          totalBedValue = totalBeds * avgPkgPrice;
        }

        const bookingConditions = [
          eq(schema.bookings.propertyId, prop.id),
        ];

        const validStatuses = bookingStatus
          ? [bookingStatus as string]
          : ['confirmed', 'active', 'completed', 'pending_payment', 'pending_approval'];
        bookingConditions.push(inArray(schema.bookings.status, validStatuses));

        if (month) {
          const monthNum = parseInt(month as string);
          const year = new Date().getFullYear();
          bookingConditions.push(sql`EXTRACT(MONTH FROM ${schema.bookings.createdAt}) = ${monthNum}`);
          bookingConditions.push(sql`EXTRACT(YEAR FROM ${schema.bookings.createdAt}) = ${year}`);
        }

        if (startDate) {
          bookingConditions.push(sql`${schema.bookings.createdAt} >= ${new Date(startDate as string)}`);
        }
        if (endDate) {
          bookingConditions.push(sql`${schema.bookings.createdAt} <= ${new Date(endDate as string)}`);
        }

        if (seasonId) {
          bookingConditions.push(eq(schema.bookings.seasonId, seasonId as string));
        }

        const propBookings = await db.select().from(schema.bookings)
          .where(and(...bookingConditions));

        if (totalBedValue === 0 && propBookings.length > 0) {
          const avgBookingFee = propBookings.reduce((s, b) => s + (Number(b.totalFee) || 0), 0) / propBookings.length;
          totalBedValue = totalBeds * avgBookingFee;
        }

        if (totalBedValue === 0 && totalBeds > 0) {
          const bedPrices = propBeds.map(b => {
            const bedPrice = b.beds?.monthlyPrice ? Number(b.beds.monthlyPrice) : 0;
            const roomPrice = b.rooms?.monthlyPrice ? Number(b.rooms.monthlyPrice) : 0;
            return bedPrice || roomPrice || 0;
          });
          const totalMonthly = bedPrices.reduce((sum, p) => sum + p, 0);
          if (totalMonthly > 0) {
            const isAcademicYear = prop.bookingMode === 'academic_year';
            totalBedValue = isAcademicYear ? totalMonthly * 10 : totalMonthly;
          }
        }

        if (totalBedValue === 0 && totalBeds === 0) {
          const propRoomTypes = await db.select().from(schema.roomTypes)
            .where(eq(schema.roomTypes.propertyId, prop.id));
          if (propRoomTypes.length > 0) {
            let rtTotalBeds = 0;
            let rtTotalValue = 0;
            for (const rt of propRoomTypes) {
              const beds = rt.totalBeds || 0;
              const price = Number(rt.basePrice) || 0;
              const isAcademicYear = prop.bookingMode === 'academic_year';
              rtTotalBeds += beds;
              rtTotalValue += beds * price * (isAcademicYear ? 10 : 1);
            }
            totalBeds = rtTotalBeds;
            totalBedValue = rtTotalValue;
          }
        }

        const target = targetMap.get(prop.id);
        const occupancyTarget = target?.targetOccupancyPercent ?? 100;
        const autoTarget = Math.round(totalBedValue * (occupancyTarget / 100));
        const targetAmount = target?.customTargetOverride ?? autoTarget;

        const achievedAmount = propBookings.reduce((sum, b) => sum + (Number(b.totalFee) || 0), 0);
        const avgBedPrice = propBookings.length > 0
          ? Math.round(achievedAmount / propBookings.length)
          : (totalBeds > 0 ? Math.round(totalBedValue / totalBeds) : 0);
        const bookedBeds = propBookings.filter(b => ['confirmed', 'active'].includes(b.status)).length;
        const occupiedBeds = propBeds.filter(b => b.beds.status === 'occupied').length;
        const vacantBeds = totalBeds - occupiedBeds;
        const occupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
        const achievementPercent = targetAmount > 0 ? Math.round((achievedAmount / targetAmount) * 100) : 0;
        const remainingAmount = Math.max(0, targetAmount - achievedAmount);

        results.push({
          propertyId: prop.id,
          propertyName: prop.name,
          totalBeds,
          occupiedBeds,
          vacantBeds,
          bookedBeds,
          avgBedPrice,
          targetAmount,
          autoTarget,
          achievedAmount,
          remainingAmount,
          achievementPercent,
          occupancyPercent,
          targetOccupancyPercent: occupancyTarget,
          hasCustomTarget: !!target?.customTargetOverride,
          notes: target?.notes || null,
        });
      }

      const summary = {
        totalTarget: results.reduce((s, r) => s + r.targetAmount, 0),
        totalAchieved: results.reduce((s, r) => s + r.achievedAmount, 0),
        totalRemaining: results.reduce((s, r) => s + r.remainingAmount, 0),
        totalBeds: results.reduce((s, r) => s + r.totalBeds, 0),
        totalOccupied: results.reduce((s, r) => s + r.occupiedBeds, 0),
        overallOccupancy: 0,
        overallAchievement: 0,
        topProperty: null as any,
        lowestProperty: null as any,
      };

      summary.overallOccupancy = summary.totalBeds > 0
        ? Math.round((summary.totalOccupied / summary.totalBeds) * 100)
        : 0;
      summary.overallAchievement = summary.totalTarget > 0
        ? Math.round((summary.totalAchieved / summary.totalTarget) * 100)
        : 0;

      const sorted = [...results].sort((a, b) => b.achievementPercent - a.achievementPercent);
      summary.topProperty = sorted[0] || null;
      summary.lowestProperty = sorted[sorted.length - 1] || null;

      res.json({ properties: results, summary });
    } catch (error) {
      console.error("Error fetching targets:", error);
      res.status(500).json({ error: "Failed to fetch target data" });
    }
  });

  app.get("/api/admin/targets/trends", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { propertyId } = req.query;
      const trendData = await db.select({
        month: sql<string>`TO_CHAR(${schema.bookings.createdAt}, 'Mon YYYY')`,
        monthNum: sql<number>`EXTRACT(MONTH FROM ${schema.bookings.createdAt})::int`,
        year: sql<number>`EXTRACT(YEAR FROM ${schema.bookings.createdAt})::int`,
        totalAchieved: sql<number>`COALESCE(SUM(${schema.bookings.totalFee}), 0)::int`,
        bookingCount: sql<number>`COUNT(*)::int`,
      })
      .from(schema.bookings)
      .where(and(
        inArray(schema.bookings.status, ['confirmed', 'active', 'completed', 'pending_payment', 'pending_approval']),
        sql`${schema.bookings.createdAt} >= NOW() - INTERVAL '12 months'`,
        ...(propertyId ? [eq(schema.bookings.propertyId, propertyId as string)] : [])
      ))
      .groupBy(
        sql`TO_CHAR(${schema.bookings.createdAt}, 'Mon YYYY')`,
        sql`EXTRACT(MONTH FROM ${schema.bookings.createdAt})`,
        sql`EXTRACT(YEAR FROM ${schema.bookings.createdAt})`
      )
      .orderBy(
        sql`EXTRACT(YEAR FROM ${schema.bookings.createdAt})`,
        sql`EXTRACT(MONTH FROM ${schema.bookings.createdAt})`
      );

      res.json(trendData);
    } catch (error) {
      console.error("Error fetching trends:", error);
      res.status(500).json({ error: "Failed to fetch trends" });
    }
  });

  app.put("/api/admin/targets/:propertyId", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { propertyId } = req.params;

      const bodySchema = z.object({
        targetOccupancyPercent: z.number().int().min(0).max(100).optional(),
        customTargetOverride: z.number().int().min(0).nullable().optional(),
        seasonId: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      });

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const { targetOccupancyPercent, customTargetOverride, seasonId, notes } = parsed.data;

      const result = await storage.upsertPropertyTarget({
        propertyId,
        targetOccupancyPercent,
        customTargetOverride,
        seasonId,
        notes,
      });

      res.json(result);
    } catch (error) {
      console.error("Error updating target:", error);
      res.status(500).json({ error: "Failed to update target" });
    }
  });

  // Get audit logs
  app.get("/api/admin/audit-logs", async (req, res) => {
    try {
      const logs = await storage.getAuditLogs(50);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Lock/unlock room (room type availability)
  app.patch("/api/admin/rooms/:id/lock", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const { locked, adminId } = req.body;
      const change = locked ? -1 : 1;

      const scope = await getReceptionistScope(req);
      if (scope) {
        const [rt] = await db.select().from(schema.roomTypes).where(eq(schema.roomTypes.id, req.params.id as string)).limit(1);
        if (!rt || !scope.has(rt.propertyId)) {
          return res.status(403).json({ error: "Room type not in your assignment scope" });
        }
      }

      const roomType = await storage.updateRoomTypeAvailability(req.params.id as string, change);

      await storage.createAuditLog({
        adminId,
        action: locked ? "room_locked" : "room_unlocked",
        entityType: "room_type",
        entityId: req.params.id as string,
        details: JSON.stringify({ action: locked ? "locked" : "unlocked" }),
      });

      res.json(roomType);
    } catch (error) {
      console.error("Error locking/unlocking room:", error);
      res.status(500).json({ error: "Failed to update room" });
    }
  });

  // ============ SALES EXECUTIVE MANAGEMENT ============

  // Get all sales executives (admin only)
  // List receptionist users with their assigned-property scope so admins can
  // manage the scoping from the same UI that handles sales executives. Mirrors
  // the response shape of /api/admin/sales-executives but omits sales-only
  // stat fields. A receptionist with zero assignedProperties is unscoped.
  app.get("/api/admin/receptionists", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const allUsers = await db.select().from(schema.users).where(eq(schema.users.role, "receptionist"));
      const activeReceptionists = allUsers.filter((u: any) => !u.deletedAt);
      const result = await Promise.all(activeReceptionists.map(async (u) => {
        const assignedProperties = await storage.getAssignedPropertiesForUser(u.id);
        const { password: _pw, ...safe } = u as any;
        return {
          ...safe,
          assignedProperties: assignedProperties.map((p) => ({ id: p.id, name: p.name })),
        };
      }));
      res.json(result);
    } catch (error) {
      console.error("Error fetching receptionists:", error);
      res.status(500).json({ error: "Failed to fetch receptionists" });
    }
  });

  app.get("/api/admin/sales-executives", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const salesExecs = await storage.getSalesExecutives();
      // Filter out soft-deleted users
      const activeExecs = salesExecs.filter((u: any) => !u.deletedAt);
      
      // Get stats and assigned properties for each sales exec
      const execsWithData = await Promise.all(activeExecs.map(async (exec) => {
        const stats = await storage.getSalesExecStats(exec.id);
        const assignedProperties = await storage.getAssignedPropertiesForUser(exec.id);
        return { 
          ...exec, 
          // Flatten stats to top level for frontend compatibility
          totalLeads: stats?.totalLeads || 0,
          hotLeads: stats?.hotLeads || 0,
          warmLeads: stats?.warmLeads || 0,
          coldLeads: stats?.coldLeads || 0,
          closedDeals: stats?.closedDeals || 0,
          // Return assigned properties with id and name
          assignedProperties: assignedProperties.map(p => ({ id: p.id, name: p.name }))
        };
      }));
      
      res.json(execsWithData);
    } catch (error) {
      console.error("Error fetching sales executives:", error);
      res.status(500).json({ error: "Failed to fetch sales executives" });
    }
  });

  // Create sales executive (admin only)
  app.post("/api/admin/sales-executives", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { name, email, phone, password } = req.body;
      
      // Validate required fields
      if (!name || !name.trim()) {
        console.error("Sales exec creation failed: Name is required");
        return res.status(400).json({ error: "Full name is required" });
      }
      if (!email || !email.trim()) {
        console.error("Sales exec creation failed: Email is required");
        return res.status(400).json({ error: "Email is required" });
      }
      if (!phone || !phone.trim()) {
        console.error("Sales exec creation failed: Phone is required");
        return res.status(400).json({ error: "Phone number is required" });
      }
      if (!password || password.length < 6) {
        console.error("Sales exec creation failed: Password too short");
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      
      // Check if email exists
      const existingEmail = await storage.getUserByEmail(email.toLowerCase());
      if (existingEmail) {
        console.error("Sales exec creation failed: Email already registered -", email);
        return res.status(409).json({ error: "Email already registered" });
      }
      
      // Check if phone exists
      const existingPhone = await storage.getUserByPhone(phone.trim());
      if (existingPhone) {
        console.error("Sales exec creation failed: Phone already registered -", phone);
        return res.status(409).json({ error: "Phone number already registered" });
      }
      
      const hashedPassword = await hashPassword(password);
      console.log("Creating sales executive:", { name, email: email.toLowerCase(), phone });
      
      const salesExec = await storage.createSalesExecutive({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password: hashedPassword,
        role: "sales_executive",
      });
      
      console.log("Sales executive created successfully:", salesExec.id);
      res.status(201).json({ ...salesExec, password: undefined });
    } catch (error: any) {
      console.error("Error creating sales executive:", error.message, error.stack);
      res.status(500).json({ error: error.message || "Failed to create sales executive" });
    }
  });

  // Update sales executive (admin only)
  app.put("/api/admin/sales-executives/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone } = req.body;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "Sales executive not found" });
      }
      
      // Check email uniqueness if changed
      if (email && email.toLowerCase() !== user.email) {
        const existingEmail = await storage.getUserByEmail(email.toLowerCase());
        if (existingEmail) {
          return res.status(409).json({ error: "Email already registered" });
        }
      }
      
      const updated = await storage.updateUser(id, {
        name: name?.trim(),
        email: email?.toLowerCase().trim(),
        phone: phone?.trim(),
      });
      
      res.json({ ...updated, password: undefined });
    } catch (error: any) {
      console.error("Error updating sales executive:", error);
      res.status(500).json({ error: error.message || "Failed to update sales executive" });
    }
  });

  // Deactivate sales executive (admin only)
  app.post("/api/admin/sales-executives/:id/deactivate", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthRequest;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "Sales executive not found" });
      }
      
      const adminUser = await storage.getUser(authReq.user!.userId);
      const updated = await storage.updateUser(id, { isActive: false });
      
      await storage.createAuditLog({
        adminId: authReq.user!.userId,
        action: "sales_exec_deactivated",
        entityType: "user",
        entityId: id,
        details: JSON.stringify({ name: user.name }),
      });

      await logActivity({
        actor: { id: authReq.user!.userId, name: adminUser?.name || "Admin", role: "admin" },
        actionType: "DEACTIVATE",
        entityType: "SALES_EXECUTIVE",
        entityId: id,
        entityLabel: user.name,
        metadata: { previousStatus: "active" },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
      
      res.json({ success: true, message: "Sales executive deactivated" });
    } catch (error: any) {
      console.error("Error deactivating sales executive:", error);
      res.status(500).json({ error: error.message || "Failed to deactivate" });
    }
  });

  // Reactivate sales executive (admin only)
  app.post("/api/admin/sales-executives/:id/reactivate", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthRequest;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "Sales executive not found" });
      }
      
      const adminUser = await storage.getUser(authReq.user!.userId);
      const updated = await storage.updateUser(id, { isActive: true });
      
      await storage.createAuditLog({
        adminId: authReq.user!.userId,
        action: "sales_exec_reactivated",
        entityType: "user",
        entityId: id,
        details: JSON.stringify({ name: user.name }),
      });

      await logActivity({
        actor: { id: authReq.user!.userId, name: adminUser?.name || "Admin", role: "admin" },
        actionType: "ACTIVATE",
        entityType: "SALES_EXECUTIVE",
        entityId: id,
        entityLabel: user.name,
        metadata: { previousStatus: "inactive" },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
      
      res.json({ success: true, message: "Sales executive reactivated" });
    } catch (error: any) {
      console.error("Error reactivating sales executive:", error);
      res.status(500).json({ error: error.message || "Failed to reactivate" });
    }
  });

  // Reassign all leads from one sales exec to another (admin only)
  app.post("/api/admin/sales-executives/:id/reassign-all", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { toUserId } = req.body;
      const authReq = req as AuthRequest;
      
      if (!toUserId) {
        return res.status(400).json({ error: "Target user ID required" });
      }
      
      const fromUser = await storage.getUser(id);
      const toUser = await storage.getUser(toUserId);
      const adminUser = await storage.getUser(authReq.user!.userId);
      
      // Get all leads assigned to this exec
      const allLeads = await storage.getAllLeads();
      const leadsToReassign = allLeads.filter(l => l.assignedToId === id);
      
      // Reassign each lead
      let count = 0;
      for (const lead of leadsToReassign) {
        await storage.updateLead(lead.id, {
          assignedToId: toUserId,
          assignmentType: "admin_manual",
        });
        count++;
      }
      
      await storage.createAuditLog({
        adminId: authReq.user!.userId,
        action: "bulk_lead_reassignment",
        entityType: "user",
        entityId: id,
        details: JSON.stringify({ count, fromUserId: id, toUserId }),
      });

      await logActivity({
        actor: { id: authReq.user!.userId, name: adminUser?.name || "Admin", role: "admin" },
        actionType: "REASSIGN",
        entityType: "LEAD",
        entityId: id,
        entityLabel: `${count} leads`,
        metadata: { from: fromUser?.name, to: toUser?.name, leadCount: count },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
      
      res.json({ success: true, message: `${count} leads reassigned`, count });
    } catch (error: any) {
      console.error("Error reassigning leads:", error);
      res.status(500).json({ error: error.message || "Failed to reassign leads" });
    }
  });

  // ============ ADMIN USER MANAGEMENT ============

  // Get all users (admin only)
  app.get("/api/admin/users", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Filter out soft-deleted users (deletedAt is not null)
      const activeUsers = allUsers.filter((u: any) => !u.deletedAt);
      res.json(activeUsers.map((u: any) => ({ ...u, password: undefined })));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Create user (admin only)
  app.post("/api/admin/users", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { name, email, phone, password, role } = req.body;
      const authReq = req as AuthRequest;
      
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
      }
      
      const existingEmail = await storage.getUserByEmail(email.toLowerCase());
      if (existingEmail) {
        return res.status(409).json({ error: "Email already registered" });
      }
      
      if (phone) {
        const existingPhone = await storage.getUserByPhone(phone.trim());
        if (existingPhone) {
          return res.status(409).json({ error: "Phone number already registered" });
        }
      }
      
      const adminUser = await storage.getUser(authReq.user!.userId);
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        password: hashedPassword,
        role: role || "user",
      });

      const entityType = role === "sales_executive" ? "SALES_EXECUTIVE" : "USER";
      await logActivity({
        actor: { id: authReq.user!.userId, name: adminUser?.name || "Admin", role: "admin" },
        actionType: "CREATE",
        entityType: entityType as EntityType,
        entityId: user.id,
        entityLabel: user.name,
        metadata: { role: user.role, email: user.email },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
      
      res.status(201).json({ ...user, password: undefined });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: error.message || "Failed to create user" });
    }
  });

  // Update user (admin only)
  app.put("/api/admin/users/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, role } = req.body;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (email && email.toLowerCase() !== user.email) {
        const existingEmail = await storage.getUserByEmail(email.toLowerCase());
        if (existingEmail) {
          return res.status(409).json({ error: "Email already registered" });
        }
      }
      
      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (email) updateData.email = email.toLowerCase().trim();
      if (phone !== undefined) updateData.phone = phone?.trim() || null;
      if (role) updateData.role = role;
      
      const updated = await storage.updateUser(id, updateData);
      
      res.json({ ...updated, password: undefined });
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: error.message || "Failed to update user" });
    }
  });

  // Deactivate user (admin only)
  app.post("/api/admin/users/:id/deactivate", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthRequest;
      
      if (id === authReq.user!.userId) {
        return res.status(400).json({ error: "Cannot deactivate yourself" });
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await db.update(schema.users)
        .set({ 
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: authReq.user!.userId,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, id));
      
      await storage.createAuditLog({
        adminId: authReq.user!.userId,
        action: "user_deactivated",
        entityType: "user",
        entityId: id,
        details: JSON.stringify({ name: user.name }),
      });

      // Log activity
      await logActivity({
        actor: { id: authReq.user!.userId, name: authReq.user!.name, role: "admin" },
        actionType: "DEACTIVATE",
        entityType: "USER",
        entityId: id,
        entityLabel: user.name,
        metadata: { email: user.email, role: user.role },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
      
      res.json({ success: true, message: "User deactivated" });
    } catch (error: any) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ error: error.message || "Failed to deactivate" });
    }
  });

  // Reactivate user (admin only)
  app.post("/api/admin/users/:id/reactivate", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthRequest;
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      await db.update(schema.users)
        .set({ 
          isActive: true,
          deactivatedAt: null,
          deactivatedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, id));
      
      await storage.createAuditLog({
        adminId: authReq.user!.userId,
        action: "user_reactivated",
        entityType: "user",
        entityId: id,
        details: JSON.stringify({ name: user.name }),
      });

      // Log activity
      await logActivity({
        actor: { id: authReq.user!.userId, name: authReq.user!.name, role: "admin" },
        actionType: "ACTIVATE",
        entityType: "USER",
        entityId: id,
        entityLabel: user.name,
        metadata: { email: user.email, role: user.role },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });
      
      res.json({ success: true, message: "User reactivated" });
    } catch (error: any) {
      console.error("Error reactivating user:", error);
      res.status(500).json({ error: error.message || "Failed to reactivate" });
    }
  });

  // Get user dependencies (leads, requests, properties assigned)
  app.get("/api/admin/users/:id/dependencies", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get counts of assigned items
      const leads = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.leads)
        .where(eq(schema.leads.assignedToId, id));
      
      const requests = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.leads)
        .where(and(
          eq(schema.leads.assignedToId, id),
          inArray(schema.leads.status, ["new", "contacted", "interested", "site_visit", "negotiation"])
        ));

      const properties = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.salesExecProperties)
        .where(eq(schema.salesExecProperties.userId, id));

      const adminCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.users)
        .where(and(
          inArray(schema.users.role, ["admin", "superadmin"]),
          eq(schema.users.isActive, true)
        ));

      res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        dependencies: {
          leads: leads[0]?.count || 0,
          activeLeads: requests[0]?.count || 0,
          properties: properties[0]?.count || 0,
        },
        isLastAdmin: (user.role === "admin" || user.role === "superadmin") && (adminCount[0]?.count || 0) <= 1,
        canDelete: (leads[0]?.count || 0) === 0 && (properties[0]?.count || 0) === 0,
      });
    } catch (error: any) {
      console.error("Error getting user dependencies:", error);
      res.status(500).json({ error: error.message || "Failed to get dependencies" });
    }
  });

  // Reassign all user items to another user
  app.post("/api/admin/users/:id/reassign", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { toUserId, reassignLeads, reassignProperties } = req.body;
      const authReq = req as AuthRequest;

      if (!toUserId) {
        return res.status(400).json({ error: "Target user is required" });
      }

      const sourceUser = await storage.getUser(id);
      const targetUser = await storage.getUser(toUserId);
      
      if (!sourceUser || !targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (!targetUser.isActive) {
        return res.status(400).json({ error: "Cannot reassign to an inactive user" });
      }

      let leadsReassigned = 0;
      let propertiesReassigned = 0;

      // Reassign leads
      if (reassignLeads !== false) {
        const result = await db.update(schema.leads)
          .set({ assignedToId: toUserId, updatedAt: new Date() })
          .where(eq(schema.leads.assignedToId, id));
        leadsReassigned = result.rowCount || 0;
      }

      // Reassign property assignments
      if (reassignProperties !== false) {
        // Delete old assignments and create new ones
        const existingAssignments = await db.select()
          .from(schema.salesExecProperties)
          .where(eq(schema.salesExecProperties.userId, id));
        
        for (const assignment of existingAssignments) {
          // Check if target already has this property
          const targetHas = await db.select()
            .from(schema.salesExecProperties)
            .where(and(
              eq(schema.salesExecProperties.userId, toUserId),
              eq(schema.salesExecProperties.propertyId, assignment.propertyId)
            ));
          
          if (targetHas.length === 0) {
            await db.insert(schema.salesExecProperties).values({
              userId: toUserId,
              propertyId: assignment.propertyId,
              assignedBy: authReq.user!.userId,
            });
            propertiesReassigned++;
          }
        }

        // Remove old assignments
        await db.delete(schema.salesExecProperties)
          .where(eq(schema.salesExecProperties.userId, id));
      }

      // Log activity
      await logActivity({
        actor: { id: authReq.user!.userId, name: authReq.user!.name, role: "admin" },
        actionType: "REASSIGN",
        entityType: "USER",
        entityId: id,
        entityLabel: sourceUser.name,
        metadata: {
          toUserId,
          toUserName: targetUser.name,
          leadsReassigned,
          propertiesReassigned,
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });

      res.json({
        success: true,
        message: `Reassigned ${leadsReassigned} leads and ${propertiesReassigned} properties to ${targetUser.name}`,
        leadsReassigned,
        propertiesReassigned,
      });
    } catch (error: any) {
      console.error("Error reassigning user items:", error);
      res.status(500).json({ error: error.message || "Failed to reassign" });
    }
  });

  // Delete user permanently (only when safe)
  app.delete("/api/admin/users/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const authReq = req as AuthRequest;
      const { confirmText } = req.body || {};

      if (id === authReq.user!.userId) {
        return res.status(400).json({ error: "Cannot delete yourself" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if last admin
      if (user.role === "admin" || user.role === "superadmin") {
        const adminCount = await db.select({ count: sql<number>`count(*)::int` })
          .from(schema.users)
          .where(and(
            inArray(schema.users.role, ["admin", "superadmin"]),
            eq(schema.users.isActive, true)
          ));
        
        if ((adminCount[0]?.count || 0) <= 1) {
          return res.status(400).json({ error: "Cannot delete the last admin" });
        }

        // Require confirmation for admin deletion
        if (confirmText !== "DELETE") {
          return res.status(400).json({ error: "Type DELETE to confirm admin deletion", requireConfirm: true });
        }
      }

      // Check for remaining dependencies
      const leads = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.leads)
        .where(eq(schema.leads.assignedToId, id));
      
      const properties = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.salesExecProperties)
        .where(eq(schema.salesExecProperties.userId, id));

      if ((leads[0]?.count || 0) > 0 || (properties[0]?.count || 0) > 0) {
        return res.status(400).json({ 
          error: "User has active assignments. Please reassign before deleting.",
          hasLeads: (leads[0]?.count || 0) > 0,
          hasProperties: (properties[0]?.count || 0) > 0,
        });
      }

      // Soft delete - mark as deleted
      await db.update(schema.users)
        .set({ 
          isActive: false, 
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, id));

      // Log activity
      await logActivity({
        actor: { id: authReq.user!.userId, name: authReq.user!.name, role: "admin" },
        actionType: "DELETE",
        entityType: "USER",
        entityId: id,
        entityLabel: user.name,
        metadata: { email: user.email, role: user.role },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
      });

      res.json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: error.message || "Failed to delete user" });
    }
  });

  // Get all property assignments (admin only)
  app.get("/api/admin/property-assignments", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const assignments = await storage.getAllPropertyAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching property assignments:", error);
      res.status(500).json({ error: "Failed to fetch property assignments" });
    }
  });

  // Assign property to sales executive or receptionist (admin only)
  app.post("/api/admin/property-assignments", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { userId, propertyId } = req.body;
      const authReq = req as AuthRequest;

      if (!userId || !propertyId) {
        return res.status(400).json({ error: "userId and propertyId are required" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }
      if (targetUser.role !== "sales_executive" && targetUser.role !== "receptionist") {
        return res.status(400).json({ error: "Property assignments are only allowed for sales executives or receptionists" });
      }

      const targetProperty = await storage.getProperty(propertyId);
      if (!targetProperty) {
        return res.status(404).json({ error: "Property not found" });
      }

      const assignment = await storage.assignPropertyToUser({
        userId,
        propertyId,
        assignedBy: authReq.user!.userId,
      });

      await storage.createAuditLog({
        adminId: authReq.user!.userId,
        action: "property_assigned",
        entityType: "sales_exec_property",
        entityId: assignment.id,
        details: JSON.stringify({ userId, propertyId, targetRole: targetUser.role }),
      });

      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning property:", error);
      res.status(500).json({ error: "Failed to assign property" });
    }
  });

  // Remove property assignment (admin only)
  app.delete("/api/admin/property-assignments/:userId/:propertyId", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const userId = req.params.userId as string;
      const propertyId = req.params.propertyId as string;
      const authReq = req as AuthRequest;
      
      await storage.removePropertyAssignment(userId, propertyId);
      
      await storage.createAuditLog({
        adminId: authReq.user!.userId,
        action: "property_unassigned",
        entityType: "sales_exec_property",
        entityId: `${userId}-${propertyId}`,
        details: JSON.stringify({ userId, propertyId }),
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing property assignment:", error);
      res.status(500).json({ error: "Failed to remove property assignment" });
    }
  });

  // Assign lead to sales executive (admin only)
  app.post("/api/admin/leads/:id/assign", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { userId } = req.body;
      const authReq = req as AuthRequest;
      const leadId = req.params.id as string;

      const existingLead = await storage.getLead(leadId);
      
      const lead = await storage.assignLeadToUser(leadId, userId, authReq.user!.userId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      if (userId && (!existingLead || existingLead.assignedToId !== userId)) {
        const isReassign = !!(existingLead?.assignedToId && existingLead.assignedToId !== userId);
        await storage.createNotification({
          userId,
          title: isReassign ? "Lead Reassigned to You" : "New Lead Assigned",
          message: isReassign
            ? `Lead "${lead.name}" has been reassigned to you by admin.`
            : `Lead "${lead.name}" has been assigned to you by admin.`,
          type: "lead",
          actionUrl: "/sales/requests",
        });

        (async () => {
          try {
            const assignee = await storage.getUser(userId);
            if (assignee?.email) {
              const assigner = authReq.user?.userId ? await storage.getUser(authReq.user.userId) : null;
              const { sendLeadAssignmentEmail, buildLeadAssignmentEmailPayload } = await import("./email-service");
              await sendLeadAssignmentEmail(
                buildLeadAssignmentEmailPayload(lead),
                { id: assignee.id, name: assignee.name, email: assignee.email },
                { assignerName: assigner?.name || null, assignerId: assigner?.id || null, isReassign, assignmentType: "admin_manual" }
              );
            }
          } catch (e) {
            console.warn("[LeadAssignmentEmail] admin assign failed:", e);
          }
        })();
      }
      
      res.json(lead);
    } catch (error) {
      console.error("Error assigning lead:", error);
      res.status(500).json({ error: "Failed to assign lead" });
    }
  });

  // Bulk assign leads (admin only)
  app.post("/api/admin/leads/bulk-assign", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { leadIds, userId } = req.body;
      const authReq = req as AuthRequest;
      
      if (!Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: "Lead IDs array required" });
      }
      if (!userId) {
        return res.status(400).json({ error: "Sales executive ID required" });
      }
      
      const results = { assigned: 0, skipped: 0, errors: [] as string[] };
      const assignedLeads: Array<{ id: string; name: string; phone: string | null; propertyName: string | null; budgetMin: number | null; budgetMax: number | null }> = [];
      
      for (const leadId of leadIds) {
        try {
          const lead = await storage.getLead(leadId);
          if (!lead) {
            results.errors.push(`Lead ${leadId} not found`);
            continue;
          }
          
          // Skip if already assigned to same user
          if (lead.assignedToId === userId) {
            results.skipped++;
            continue;
          }
          
          await storage.assignLeadToUser(leadId, userId, authReq.user!.userId);
          results.assigned++;
          assignedLeads.push({
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            propertyName: lead.propertyName,
            budgetMin: lead.budgetMin,
            budgetMax: lead.budgetMax,
          });
        } catch (err) {
          results.errors.push(`Failed to assign lead ${leadId}`);
        }
      }

      if (results.assigned > 0 && userId) {
        await storage.createNotification({
          userId,
          title: "Leads Assigned to You",
          message: `${results.assigned} lead${results.assigned > 1 ? "s have" : " has"} been assigned to you by admin.`,
          type: "lead",
          actionUrl: "/sales/requests",
        });

        (async () => {
          try {
            const assignee = await storage.getUser(userId);
            if (assignee?.email && assignedLeads.length > 0) {
              const assigner = authReq.user?.userId ? await storage.getUser(authReq.user.userId) : null;
              const { sendLeadAssignmentBulkSummaryEmail } = await import("./email-service");
              await sendLeadAssignmentBulkSummaryEmail(
                { id: assignee.id, name: assignee.name, email: assignee.email },
                assignedLeads,
                { assignerName: assigner?.name || null, assignerId: assigner?.id || null }
              );
            }
          } catch (e) {
            console.warn("[LeadAssignmentEmail] bulk-assign failed:", e);
          }
        })();
      }
      
      res.json({ 
        success: true, 
        message: `Assigned ${results.assigned} leads, skipped ${results.skipped}`,
        ...results 
      });
    } catch (error) {
      console.error("Error bulk assigning leads:", error);
      res.status(500).json({ error: "Failed to bulk assign leads" });
    }
  });

  // Get lead assignment history (admin only)
  app.get("/api/admin/leads/:id/history", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const leadId = req.params.id as string;
      const activities = await storage.getLeadActivities(leadId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching lead history:", error);
      res.status(500).json({ error: "Failed to fetch lead history" });
    }
  });

  app.get("/api/admin/leads/:id/remarks", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const remarks = await storage.getLeadRemarks(req.params.id as string);
      res.json(remarks);
    } catch (error) {
      console.error("Error fetching lead remarks:", error);
      res.status(500).json({ error: "Failed to fetch lead remarks" });
    }
  });

  // Get sales executives with lead counts
  app.get("/api/admin/sales-executives/lead-counts", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const salesExecs = await storage.getSalesExecutives();
      const leads = await storage.getAllLeads();
      
      const execsWithCounts = salesExecs.map(exec => {
        const assignedLeads = leads.filter(l => l.assignedToId === exec.id);
        return {
          ...exec,
          leadCount: assignedLeads.length,
          activeLeadCount: assignedLeads.filter(l => !["converted", "lost"].includes(l.status)).length
        };
      });
      
      res.json(execsWithCounts);
    } catch (error) {
      console.error("Error fetching sales exec lead counts:", error);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  });

  // ============ SALES EXECUTIVE DASHBOARD ============

  // Get assigned properties for current sales exec (alias for frontend compatibility)
  app.get("/api/sales/properties", authMiddleware, roleMiddleware("sales_executive", "admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const isAdmin = authReq.user!.role === "admin" || authReq.user!.role === "superadmin";
      const properties = isAdmin
        ? await storage.getAllProperties()
        : await storage.getAssignedPropertiesForUser(authReq.user!.userId);
      res.json(properties);
    } catch (error) {
      console.error("Error fetching assigned properties:", error);
      res.status(500).json({ error: "Failed to fetch assigned properties" });
    }
  });

  // Get leads scoped to sales exec's assigned properties
  app.get("/api/sales/leads", authMiddleware, roleMiddleware("sales_executive", "admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.userId;
      const propertyId = req.query.propertyId as string | undefined;
      const isAdmin = authReq.user!.role === "admin" || authReq.user!.role === "superadmin";
      
      let fetchedLeads: any[];
      if (isAdmin) {
        const allProperties = await storage.getAllProperties();
        const assignedPropertyIds = allProperties.map(p => p.id);
        const targetPropertyIds = propertyId ? [propertyId] : assignedPropertyIds;
        fetchedLeads = await storage.getLeadsByPropertyIds(targetPropertyIds);
      } else {
        fetchedLeads = await storage.getLeadsForAssignedProperties(userId, []);
        if (propertyId) {
          fetchedLeads = fetchedLeads.filter(l => l.propertyId === propertyId);
        }
      }

      const teamUsers = await db.select({ email: schema.users.email }).from(schema.users)
        .where(inArray(schema.users.role, ["admin", "superadmin", "manager", "staff"]));
      const teamEmails = new Set(teamUsers.map(u => (u.email || "").toLowerCase().trim()).filter(Boolean));
      fetchedLeads = fetchedLeads.filter(l => !teamEmails.has((l.email || "").toLowerCase().trim()));
      
      const userIds = new Set<string>();
      fetchedLeads.forEach(l => {
        if (l.createdBy) userIds.add(l.createdBy);
        if (l.assignedToId) userIds.add(l.assignedToId);
        if (l.convertedByUserId) userIds.add(l.convertedByUserId);
      });
      const userMap = new Map<string, string>();
      for (const uid of userIds) {
        const u = await storage.getUser(uid);
        if (u) userMap.set(uid, u.name);
      }
      const bookingIds = fetchedLeads.map(l => l.linkedBookingId).filter(Boolean) as string[];
      const bookingMap = new Map<string, { status: string; confirmedByName: string | null; confirmedAt: Date | null }>();
      for (const bid of bookingIds) {
        const b = await storage.getBooking(bid);
        if (b) {
          let confirmedByName: string | null = null;
          if (b.confirmedBy) {
            if (userMap.has(b.confirmedBy)) {
              confirmedByName = userMap.get(b.confirmedBy)!;
            } else {
              const cu = await storage.getUser(b.confirmedBy);
              if (cu) { confirmedByName = cu.name; userMap.set(b.confirmedBy, cu.name); }
            }
          }
          bookingMap.set(bid, { status: b.status, confirmedByName, confirmedAt: b.confirmedAt });
        }
      }
      const enrichedLeads = fetchedLeads.map(l => ({
        ...l,
        createdByName: l.createdBy ? userMap.get(l.createdBy) || null : null,
        assignedToName: l.assignedToId ? userMap.get(l.assignedToId) || null : null,
        convertedByName: l.convertedByUserId ? userMap.get(l.convertedByUserId) || null : null,
        linkedBooking: l.linkedBookingId ? bookingMap.get(l.linkedBookingId) || null : null,
      }));
      res.json(enrichedLeads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Get assigned properties for current sales exec
  app.get("/api/sales/my-properties", authMiddleware, roleMiddleware("sales_executive", "admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const isAdmin = authReq.user!.role === "admin" || authReq.user!.role === "superadmin";
      const properties = isAdmin 
        ? await storage.getAllProperties()
        : await storage.getAssignedPropertiesForUser(authReq.user!.userId);
      res.json(properties);
    } catch (error) {
      console.error("Error fetching assigned properties:", error);
      res.status(500).json({ error: "Failed to fetch assigned properties" });
    }
  });

  // Get leads for current sales exec
  app.get("/api/sales/my-leads", authMiddleware, roleMiddleware("sales_executive"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const propertyId = req.query.propertyId as string | undefined;
      const leads = await storage.getLeadsForSalesExec(authReq.user!.userId, propertyId);
      
      const userIds = new Set<string>();
      leads.forEach(l => {
        if (l.createdBy) userIds.add(l.createdBy);
        if (l.assignedToId) userIds.add(l.assignedToId);
        if (l.convertedByUserId) userIds.add(l.convertedByUserId);
      });
      const userMap = new Map<string, string>();
      for (const uid of userIds) {
        const u = await storage.getUser(uid);
        if (u) userMap.set(uid, u.name);
      }
      const bookingIds = leads.map(l => l.linkedBookingId).filter(Boolean) as string[];
      const bookingMap = new Map<string, { status: string; confirmedBy: string | null; confirmedByName: string | null; confirmedAt: Date | null }>();
      for (const bid of bookingIds) {
        const booking = await storage.getBooking(bid);
        if (booking) {
          let confirmedByName: string | null = null;
          if (booking.confirmedBy) {
            const confirmer = await storage.getUser(booking.confirmedBy);
            if (confirmer) confirmedByName = confirmer.name;
          }
          bookingMap.set(bid, { status: booking.status, confirmedBy: booking.confirmedBy, confirmedByName, confirmedAt: booking.confirmedAt });
        }
      }
      const enriched = leads.map(l => ({
        ...l,
        createdByName: l.createdBy ? userMap.get(l.createdBy) || null : null,
        assignedToName: l.assignedToId ? userMap.get(l.assignedToId) || null : null,
        convertedByName: l.convertedByUserId ? userMap.get(l.convertedByUserId) || null : null,
        linkedBooking: l.linkedBookingId && bookingMap.has(l.linkedBookingId)
          ? { status: bookingMap.get(l.linkedBookingId)!.status, confirmedByName: bookingMap.get(l.linkedBookingId)!.confirmedByName, confirmedAt: bookingMap.get(l.linkedBookingId)!.confirmedAt }
          : null,
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Get sales exec stats
  app.get("/api/sales/my-stats", authMiddleware, roleMiddleware("sales_executive"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const stats = await storage.getSalesExecStats(authReq.user!.userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Create manual lead (on-spot entry)
  app.post("/api/sales/leads", authMiddleware, roleMiddleware("sales_executive", "admin"), async (req, res) => {
    try {
      const validation = manualLeadSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors[0].message });
      }
      
      const authReq = req as AuthRequest;
      const data = validation.data;
      
      // If sales executive, verify they're assigned to this property
      if (authReq.user!.role === "sales_executive") {
        const assignedProperties = await storage.getAssignedPropertiesForUser(authReq.user!.userId);
        const isAssigned = assignedProperties.some(p => p.id === data.propertyId);
        if (!isAssigned) {
          return res.status(403).json({ error: "You are not assigned to this property" });
        }
      }
      
      // Get property name
      const property = await storage.getProperty(data.propertyId);
      
      let assignToId = authReq.user!.userId;
      const isAdminRole = authReq.user!.role === "admin" || authReq.user!.role === "superadmin";
      let assignType: "admin_manual" | "property_auto" | "fallback_default" = isAdminRole ? "admin_manual" : "property_auto";
      
      if (isAdminRole && data.assignToUserId) {
        assignToId = data.assignToUserId;
        assignType = "admin_manual";
      } else if (isAdminRole && !data.assignToUserId) {
        const assignments = await db.select({ salesExecId: schema.salesExecProperties.userId })
          .from(schema.salesExecProperties)
          .where(and(
            eq(schema.salesExecProperties.propertyId, data.propertyId),
            eq(schema.salesExecProperties.isActive, true)
          ));
        if (assignments.length > 0) {
          const salesExecIds = assignments.map(a => a.salesExecId);
          const leadCounts = await db.select({
            assignedToId: schema.leads.assignedToId,
            count: sql<number>`count(*)::int`,
          }).from(schema.leads)
            .where(and(inArray(schema.leads.assignedToId, salesExecIds), isNull(schema.leads.dealClosedAt)))
            .groupBy(schema.leads.assignedToId);
          const countMap = new Map(leadCounts.map(l => [l.assignedToId, l.count]));
          let minLeads = Infinity;
          let selectedExecId = salesExecIds[0];
          for (const execId of salesExecIds) {
            const count = countMap.get(execId) || 0;
            if (count < minLeads) { minLeads = count; selectedExecId = execId; }
          }
          assignToId = selectedExecId;
          assignType = "admin_manual";
        } else {
          // Admin created the lead but no sales exec is mapped to the
          // property. Fall back to the catch-all default assignee via
          // the shared helper instead of silently routing to the admin.
          const fb = await storage.assignFallbackIfUnassigned({
            assignedToId: null as string | null,
            assignmentType: "admin_manual" as const,
          });
          if (fb.fallbackAssignee) {
            assignToId = fb.fallbackAssignee.id;
            assignType = "fallback_default";
          }
        }
      }

      const lead = await storage.createLead({
        name: data.name,
        phone: data.phone,
        email: data.email || undefined,
        propertyId: data.propertyId,
        propertyName: property?.name,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        entrySource: data.entrySource,
        notes: data.notes,
        source: "walk_in",
        isManualEntry: true,
        assignedToId: assignToId,
        assignedAt: new Date(),
        assignmentType: assignType,
        createdBy: authReq.user!.userId,
        score: 5,
        priority: "cold",
      });
      
      // Log activity
      await storage.createLeadActivity({
        leadId: lead.id,
        actorId: authReq.user!.userId,
        actionType: "lead_created",
        newValue: JSON.stringify({ source: data.entrySource }),
        description: `Manual lead created via ${data.entrySource}`,
      });

      if (assignToId) {
        // Skip the in-app "new lead assigned" notification AND the
        // assignment email when the assignee is the current user — they
        // just created the lead and assigned it to themselves, no need
        // to ping them.
        if (assignToId !== authReq.user!.userId) {
          await storage.createNotification({
            userId: assignToId,
            title: "New Lead Assigned",
            message: `New lead "${data.name}" has been assigned to you${property?.name ? ` for ${property.name}` : ""}.`,
            type: "lead",
            actionUrl: "/sales/requests",
          });
        }

        const assignToIdForEmail = assignToId;
        const finalAssignType = assignType;
        (async () => {
          try {
            const assignee = await storage.getUser(assignToIdForEmail);
            if (assignee?.email) {
              const assigner = authReq.user?.userId ? await storage.getUser(authReq.user.userId) : null;
              const { sendLeadAssignmentEmail, buildLeadAssignmentEmailPayload } = await import("./email-service");
              await sendLeadAssignmentEmail(
                buildLeadAssignmentEmailPayload(lead),
                { id: assignee.id, name: assignee.name, email: assignee.email },
                { assignerName: assigner?.name || null, assignerId: assigner?.id || null, assignmentType: finalAssignType }
              );
            }
          } catch (e) {
            console.warn("[LeadAssignmentEmail] manual sales create failed:", e);
          }
        })();
      }
      
      res.status(201).json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  // Update lead status (sales exec can update their own leads)
  app.patch("/api/sales/leads/:id/status", authMiddleware, roleMiddleware("sales_executive", "admin"), async (req, res) => {
    try {
      const { status, lostReason, lostNotes } = req.body;
      const authReq = req as AuthRequest;
      
      if (!status || !validLeadStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      
      const lead = await storage.getLead(req.params.id as string);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Check ownership (sales exec can only update their leads, admin can update any)
      if (authReq.user!.role === "sales_executive" && lead.assignedToId !== authReq.user!.userId) {
        return res.status(403).json({ error: "Not authorized to update this lead" });
      }
      
      // Check if lead is locked
      if (lead.isLocked) {
        return res.status(403).json({ error: "Lead is locked and cannot be modified" });
      }
      
      const previousStatus = lead.status;
      
      // Calculate new score based on status
      let newScore = lead.score;
      let newPriority = lead.priority;
      
      if (status === "contacted") { newScore = Math.min(100, Math.max(newScore, 10)); newPriority = newScore > 60 ? "hot" : newScore > 30 ? "warm" : "cold"; }
      else if (status === "interested") { newScore = Math.min(100, Math.max(newScore, 20)); newPriority = newScore > 60 ? "hot" : "warm"; }
      else if (status === "site_visit") { newScore = Math.min(100, Math.max(newScore + 25, 40)); newPriority = newScore > 60 ? "hot" : "warm"; }
      else if (status === "negotiation") { newScore = Math.min(100, Math.max(newScore + 30, 60)); newPriority = "hot"; }
      else if (status === "converted") { newScore = 100; newPriority = "hot"; }
      else if (status === "lost") { newScore = 0; newPriority = "cold"; }
      
      const updateData: any = {
        status,
        score: newScore,
        priority: newPriority,
        lastActivityAt: new Date(),
      };
      
      if (status === "lost") {
        updateData.lostReason = lostReason;
        updateData.lostNotes = lostNotes;
      }
      
      const updated = await storage.updateLead(req.params.id as string, updateData);
      
      // Log activity
      await storage.createLeadActivity({
        leadId: req.params.id as string,
        actorId: authReq.user!.userId,
        actionType: "status_change",
        previousValue: JSON.stringify({ status: previousStatus }),
        newValue: JSON.stringify({ status, lostReason }),
        description: `Status changed from ${previousStatus} to ${status}`,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating lead status:", error);
      res.status(500).json({ error: "Failed to update lead status" });
    }
  });

  // Close deal
  app.post("/api/sales/leads/:id/close-deal", authMiddleware, roleMiddleware("sales_executive", "admin"), async (req, res) => {
    try {
      const validation = dealClosureSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors[0].message });
      }
      
      const authReq = req as AuthRequest;
      const lead = await storage.getLead(req.params.id as string);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Check ownership
      if (authReq.user!.role === "sales_executive" && lead.assignedToId !== authReq.user!.userId) {
        return res.status(403).json({ error: "Not authorized to close this deal" });
      }
      
      const closedLead = await storage.closeDeal(req.params.id as string, validation.data, authReq.user!.userId);
      
      res.json(closedLead);
    } catch (error) {
      console.error("Error closing deal:", error);
      res.status(500).json({ error: "Failed to close deal" });
    }
  });

  // Add remark to lead
  app.post("/api/sales/leads/:id/remarks", authMiddleware, roleMiddleware("sales_executive", "admin"), async (req, res) => {
    try {
      const { remark } = req.body;
      const authReq = req as AuthRequest;
      
      const lead = await storage.getLead(req.params.id as string);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Check ownership
      if (authReq.user!.role === "sales_executive" && lead.assignedToId !== authReq.user!.userId) {
        return res.status(403).json({ error: "Not authorized to add remarks to this lead" });
      }
      
      const createdRemark = await storage.createLeadRemark({
        leadId: req.params.id as string,
        userId: authReq.user!.userId,
        remark,
      });

      let followUpCleared = false;
      if (lead.followUpAt && lead.followUpStatus !== "completed" && new Date(lead.followUpAt) < new Date()) {
        await storage.updateLead(lead.id, {
          followUpStatus: "completed",
        });
        followUpCleared = true;
      }
      
      res.status(201).json({ ...createdRemark, followUpCleared });
    } catch (error) {
      console.error("Error adding remark:", error);
      res.status(500).json({ error: "Failed to add remark" });
    }
  });

  // Get lead details with activities and remarks
  app.get("/api/sales/leads/:id/details", authMiddleware, roleMiddleware("sales_executive", "admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const lead = await storage.getLead(req.params.id as string);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Check ownership
      if (authReq.user!.role === "sales_executive" && lead.assignedToId !== authReq.user!.userId) {
        return res.status(403).json({ error: "Not authorized to view this lead" });
      }
      
      const activities = await storage.getLeadActivities(req.params.id as string);
      const remarks = await storage.getLeadRemarks(req.params.id as string);
      const property = lead.propertyId ? await storage.getProperty(lead.propertyId) : null;
      const roomTypes = lead.propertyId ? await storage.getRoomTypesByProperty(lead.propertyId) : [];

      // Build a unified, chronological remarks list that merges:
      //   - lead_remarks rows (with author user)
      //   - the lead's initial `notes` (lead-creation remark)
      //   - the lead's website `message` (visitor's enquiry text, when present)
      //   - `followUpNotes` (when present)
      //   - `lostNotes` (when present)
      // Each entry carries enough metadata for the UI: id, remark text, createdAt, source kind, optional user.
      const mergedRemarks: Array<{
        id: string;
        remark: string;
        createdAt: Date;
        source: "remark" | "initial_note" | "lead_message" | "follow_up_note" | "lost_note";
        user?: any;
      }> = [];

      for (const r of remarks) {
        mergedRemarks.push({
          id: `remark-${r.id}`,
          remark: r.remark,
          createdAt: r.createdAt as Date,
          source: "remark",
          user: r.user,
        });
      }

      const leadCreatedAt = lead.createdAt as Date;

      // Look up the most recent activity-log entries that correspond to when
      // each synthesized note was actually written, so the merged list is
      // chronologically accurate (rather than always falling back to the
      // lead's createdAt). Activities are returned newest-first by storage.
      const lastFollowUpActivity = activities.find(
        (a: any) => a.actionType === "follow_up_set" || a.actionType === "follow_up_updated",
      );
      const lastLostActivity = activities.find((a: any) => {
        if (a.actionType !== "status_change") return false;
        try {
          const parsed = a.newValue ? JSON.parse(a.newValue) : null;
          return parsed && parsed.status === "lost";
        } catch {
          return false;
        }
      });

      if (lead.notes && lead.notes.trim()) {
        mergedRemarks.push({
          id: `initial-${lead.id}`,
          remark: lead.notes,
          createdAt: leadCreatedAt,
          source: "initial_note",
        });
      }

      if (lead.message && lead.message.trim()) {
        mergedRemarks.push({
          id: `message-${lead.id}`,
          remark: lead.message,
          createdAt: leadCreatedAt,
          source: "lead_message",
        });
      }

      if (lead.followUpNotes && lead.followUpNotes.trim()) {
        mergedRemarks.push({
          id: `followup-${lead.id}`,
          remark: lead.followUpNotes,
          createdAt:
            (lastFollowUpActivity?.createdAt as Date | undefined) ||
            (lead.followUpAt as Date | null) ||
            leadCreatedAt,
          source: "follow_up_note",
          user: lastFollowUpActivity?.actor,
        });
      }

      if (lead.lostNotes && lead.lostNotes.trim()) {
        mergedRemarks.push({
          id: `lost-${lead.id}`,
          remark: lead.lostNotes,
          createdAt: (lastLostActivity?.createdAt as Date | undefined) || leadCreatedAt,
          source: "lost_note",
          user: lastLostActivity?.actor,
        });
      }

      mergedRemarks.sort((a, b) => {
        const tA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const tB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return tB - tA;
      });

      res.json({ lead, activities, remarks: mergedRemarks, property, roomTypes });
    } catch (error) {
      console.error("Error fetching lead details:", error);
      res.status(500).json({ error: "Failed to fetch lead details" });
    }
  });

  // Set follow-up
  app.post("/api/sales/leads/:id/follow-up", authMiddleware, roleMiddleware("sales_executive", "admin"), async (req, res) => {
    try {
      const { followUpAt, notes } = req.body;
      const authReq = req as AuthRequest;
      
      const lead = await storage.getLead(req.params.id as string);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Check ownership
      if (authReq.user!.role === "sales_executive" && lead.assignedToId !== authReq.user!.userId) {
        return res.status(403).json({ error: "Not authorized to set follow-up for this lead" });
      }
      
      const updated = await storage.setFollowUp(req.params.id as string, new Date(followUpAt), notes);
      
      await storage.createLeadActivity({
        leadId: req.params.id as string,
        actorId: authReq.user!.userId,
        actionType: "follow_up_set",
        newValue: JSON.stringify({ followUpAt, notes }),
        description: `Follow-up scheduled for ${new Date(followUpAt).toLocaleDateString()}`,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error setting follow-up:", error);
      res.status(500).json({ error: "Failed to set follow-up" });
    }
  });

  // Get upcoming follow-ups
  app.get("/api/sales/follow-ups/upcoming", authMiddleware, roleMiddleware("sales_executive"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const leads = await storage.getUpcomingFollowUps(authReq.user!.userId);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching upcoming follow-ups:", error);
      res.status(500).json({ error: "Failed to fetch upcoming follow-ups" });
    }
  });

  // Get overdue follow-ups
  app.get("/api/sales/follow-ups/overdue", authMiddleware, roleMiddleware("sales_executive"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const leads = await storage.getOverdueFollowUps(authReq.user!.userId);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching overdue follow-ups:", error);
      res.status(500).json({ error: "Failed to fetch overdue follow-ups" });
    }
  });

  // ===================== NOTIFICATIONS =====================

  // Get user notifications
  app.get("/api/notifications", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const limit = parseInt(req.query.limit as string) || 20;
      const notificationsList = await storage.getUserNotifications(userId, limit);
      const unreadCount = await storage.getUnreadNotificationCount(userId);
      
      res.json({ notifications: notificationsList, unreadCount });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // Get unread notification count
  app.get("/api/notifications/unread-count", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  // Mark notification as read
  app.patch("/api/notifications/:id/read", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationRead(id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/mark-all-read", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ error: "Not authenticated" });
      
      await storage.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // =============================================
  // ACTIVITY LOGS ENDPOINTS (Admin Only)
  // =============================================

  // Get activity logs with filters
  app.get("/api/admin/activity-logs", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const {
        actionType,
        entityType,
        actorUserId,
        propertyId,
        startDate,
        endDate,
        search,
        limit = "50",
        offset = "0"
      } = req.query;

      const filters = {
        actionType: actionType as string | undefined,
        entityType: entityType as string | undefined,
        actorUserId: actorUserId as string | undefined,
        propertyId: propertyId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        search: search as string | undefined,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      };

      const result = await storage.getActivityLogs(filters);
      
      // Add formatted messages
      const logsWithMessages = result.logs.map(log => ({
        ...log,
        formattedMessage: formatActivityMessage(
          log.actionType as ActionType,
          log.entityType as EntityType,
          log.actorName,
          log.actorRole,
          log.entityLabel,
          log.metadataJson ? JSON.parse(log.metadataJson) : undefined
        )
      }));

      res.json({
        logs: logsWithMessages,
        total: result.total,
        limit: filters.limit,
        offset: filters.offset
      });
    } catch (error: any) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ error: error.message || "Failed to fetch activity logs" });
    }
  });

  // Get single activity log by ID
  app.get("/api/admin/activity-logs/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const log = await storage.getActivityLogById(id);
      
      if (!log) {
        return res.status(404).json({ error: "Activity log not found" });
      }

      const formattedMessage = formatActivityMessage(
        log.actionType as ActionType,
        log.entityType as EntityType,
        log.actorName,
        log.actorRole,
        log.entityLabel,
        log.metadataJson ? JSON.parse(log.metadataJson) : undefined
      );

      res.json({
        ...log,
        formattedMessage,
        metadata: log.metadataJson ? JSON.parse(log.metadataJson) : null
      });
    } catch (error: any) {
      console.error("Error fetching activity log:", error);
      res.status(500).json({ error: error.message || "Failed to fetch activity log" });
    }
  });

  // Get available actors for filter dropdown
  app.get("/api/admin/activity-logs/actors/list", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const actors = allUsers.map(u => ({ id: u.id, name: u.name, role: u.role }));
      res.json(actors);
    } catch (error: any) {
      console.error("Error fetching actors:", error);
      res.status(500).json({ error: error.message || "Failed to fetch actors" });
    }
  });

  // Export activity logs as CSV
  app.get("/api/admin/activity-logs/export/csv", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { actionType, entityType, actorUserId, propertyId, startDate, endDate, search } = req.query;

      const filters = {
        actionType: actionType as string | undefined,
        entityType: entityType as string | undefined,
        actorUserId: actorUserId as string | undefined,
        propertyId: propertyId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        search: search as string | undefined,
        limit: 10000,
        offset: 0
      };

      const result = await storage.getActivityLogs(filters);
      
      const csvRows = [
        ["Time", "Actor", "Role", "Action", "Entity Type", "Entity", "Property", "Details"].join(",")
      ];

      for (const log of result.logs) {
        const formattedMessage = formatActivityMessage(
          log.actionType as ActionType,
          log.entityType as EntityType,
          log.actorName,
          log.actorRole,
          log.entityLabel,
          log.metadataJson ? JSON.parse(log.metadataJson) : undefined
        );
        
        csvRows.push([
          new Date(log.createdAt).toISOString(),
          `"${log.actorName}"`,
          log.actorRole,
          log.actionType,
          log.entityType,
          `"${log.entityLabel}"`,
          `"${log.propertyName || ''}"`,
          `"${formattedMessage.replace(/"/g, '""')}"`
        ].join(","));
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvRows.join("\n"));
    } catch (error: any) {
      console.error("Error exporting activity logs:", error);
      res.status(500).json({ error: error.message || "Failed to export activity logs" });
    }
  });

  // ==================== CHATBOT API ====================
  
  // Rate limiter for chatbot (more generous than web leads)
  const chatbotRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 messages per minute per IP
    message: { error: "Too many messages, please slow down" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Request size validation middleware for chatbot (limit to 50KB)
  const chatbotSizeLimit = (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > 50 * 1024) {
      return res.status(413).json({ error: "Request too large" });
    }
    next();
  };

  // Initialize chat context (cached)
  let chatContextCache: Awaited<ReturnType<typeof initChatContext>> | null = null;
  let chatContextLastUpdate = 0;
  const CONTEXT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async function getChatContext() {
    const now = Date.now();
    if (!chatContextCache || now - chatContextLastUpdate > CONTEXT_CACHE_TTL) {
      chatContextCache = await initChatContext();
      chatContextLastUpdate = now;
    }
    return chatContextCache;
  }

  // Chatbot message endpoint with streaming
  app.post("/api/chatbot/message", chatbotSizeLimit, chatbotRateLimiter, async (req: Request, res: Response) => {
    try {
      const { messages } = req.body as { messages: ChatMessage[] };
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      const context = await getChatContext();

      // Set up SSE for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const stream = await streamChatResponse(messages, context);
      let fullResponse = "";

      for await (const chunk of stream) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      // After response is complete, try to extract lead info
      const allMessages: ChatMessage[] = [
        ...messages,
        { role: "assistant" as const, content: fullResponse },
      ];

      const qualification = await extractLeadInfo(allMessages, context);
      
      // Try to create lead - server-side validation enforces qualification rules
      const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip;
      const result = await createLeadFromChat(qualification, {
        ipAddress,
        userAgent: req.headers["user-agent"],
        pageUrl: req.headers.referer,
      });
      
      if (result) {
        res.write(`data: ${JSON.stringify({ leadCreated: true, leadId: result.leadId })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      console.error("Chatbot error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "An error occurred" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process message" });
      }
    }
  });

  // Non-streaming endpoint for simple queries
  app.post("/api/chatbot/query", chatbotSizeLimit, chatbotRateLimiter, async (req: Request, res: Response) => {
    try {
      const { messages } = req.body as { messages: ChatMessage[] };
      
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      const context = await getChatContext();
      const stream = await streamChatResponse(messages, context);
      
      let fullResponse = "";
      for await (const chunk of stream) {
        fullResponse += chunk;
      }

      res.json({ response: fullResponse });
    } catch (error: any) {
      console.error("Chatbot query error:", error);
      res.status(500).json({ error: "Failed to process query" });
    }
  });

  // Get chatbot context/status
  app.get("/api/chatbot/status", async (_req: Request, res: Response) => {
    try {
      const context = await getChatContext();
      res.json({
        available: true,
        hmsIntegrated: true,
        propertiesCount: context.properties.length,
        properties: context.properties.map(p => ({
          id: p.id,
          name: p.name,
          city: p.city || p.location,
          hmsLinked: p.hmsLinked,
          plansCount: p.plans.length,
          bedStats: p.bedStats,
        })),
      });
    } catch (error) {
      console.error("Chatbot status error:", error);
      res.json({ available: false, error: "Chatbot temporarily unavailable" });
    }
  });

  // ==================== DATA EXPORT / DOWNLOAD ====================

  const escapeCsvField = (val: any): string => {
    if (val === null || val === undefined) return "";
    let str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRow = (fields: any[]) => fields.map(escapeCsvField).join(",");

  app.get("/api/admin/export/bookings", authMiddleware, roleMiddleware("admin"), async (_req: AuthRequest, res) => {
    try {
      const rows = await db.select().from(schema.bookings).orderBy(schema.bookings.createdAt);
      const allProperties = await db.select().from(schema.properties);
      const allRooms = await db.select().from(schema.roomTypes);
      const allUsers = await db.select().from(schema.users);
      const propMap = new Map(allProperties.map(p => [p.id, p.name]));
      const roomMap = new Map(allRooms.map(r => [r.id, r.name]));
      const userMap = new Map(allUsers.map(u => [u.id, u.name]));

      const header = ["Booking Code","Customer Type","Walk-in Name","Walk-in Phone","Walk-in Email","Property Name","Room / Bed","Stay Plan","Check-in","Check-out","Base Fee","Deposit","Discount","Discount Reason","Total Amount","Payment Type","Token Amount","Status","Approval Status","Approved By","Created By","Confirmed By","Confirmed At","Agreement Generated","Created At"];
      const csv = [header.join(","), ...rows.map(r => {
        const rd = r.residentDetails as any;
        const roomLabel = rd?.roomNo ? (rd.bedNo ? `${rd.roomNo}-${rd.bedNo}` : rd.roomNo) : roomMap.get(r.roomTypeId || "") || r.roomTypeId || "";
        return csvRow([
          r.bookingCode, r.customerType, r.walkInName, r.walkInPhone, r.walkInEmail,
          propMap.get(r.propertyId || "") || r.propertyId || "",
          roomLabel,
          r.stayPlanType, r.checkInDate, r.checkOutDate,
          r.baseFee, r.deposit, r.discount, r.discountReason, r.totalAmount,
          r.paymentType, r.tokenAmount, r.status, r.approvalStatus,
          userMap.get(r.approvedBy || "") || r.approvedBy || "",
          userMap.get(r.createdBy || "") || r.createdBy || "",
          userMap.get(r.confirmedBy || "") || r.confirmedBy || "",
          r.confirmedAt ? new Date(r.confirmedAt).toISOString() : "",
          r.agreementGenerated, r.createdAt ? new Date(r.createdAt).toISOString() : ""
        ]);
      })].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=bookings_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  app.get("/api/admin/export/leads", authMiddleware, roleMiddleware("admin"), async (_req: AuthRequest, res) => {
    try {
      const rows = await db.select().from(schema.leads).orderBy(schema.leads.createdAt);
      const allUsers = await db.select().from(schema.users);
      const userMap = new Map(allUsers.map(u => [u.id, u.name]));
      const allBookings = await db.select().from(schema.bookings);
      const bookingMap = new Map(allBookings.map(b => [b.id, b]));
      const header = ["Name","Email","Phone","Property Name","Source","Entry Source","Status","Notes","Assigned To","Lead Created By","Priority","Budget Min","Budget Max","Follow-up Date","Follow-up Notes","Deal Amount","Deal Room Type","Deal Payment Plan","Booking Initiated By","Booking Confirmed By","Booking Status","Converted At","Created At"];
      const csv = [header.join(","), ...rows.map(r => {
        const linkedBooking = r.linkedBookingId ? bookingMap.get(r.linkedBookingId) : null;
        return csvRow([
          r.name, r.email, r.phone, r.propertyName, r.source, r.entrySource, r.status, r.notes,
          userMap.get(r.assignedToId || "") || r.assignedToId || "",
          userMap.get(r.createdBy || "") || r.createdBy || "",
          r.priority, r.budgetMin, r.budgetMax,
          r.followUpDate, r.followUpNotes, r.dealAmount, r.dealRoomType, r.dealPaymentPlan,
          userMap.get(r.convertedByUserId || "") || "",
          linkedBooking ? (userMap.get(linkedBooking.confirmedBy || "") || "") : "",
          linkedBooking ? linkedBooking.status : "",
          r.convertedAt ? new Date(r.convertedAt).toISOString() : "",
          r.createdAt ? new Date(r.createdAt).toISOString() : ""
        ]);
      })].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=leads_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  app.get("/api/admin/export/students", authMiddleware, roleMiddleware("admin"), async (_req: AuthRequest, res) => {
    try {
      const rows = await db.select().from(schema.students);
      const header = ["Full Name","Phone","Address","City","State","Pincode","Emergency Name","Emergency Relation","Emergency Phone","College","Course","Year","ID Proof Type","Created At"];
      const csv = [header.join(","), ...rows.map(r => csvRow([
        r.fullName, r.phone, r.address, r.city, r.state, r.pincode,
        r.emergencyName, r.emergencyRelation, r.emergencyPhone,
        r.collegeName, r.course, r.year, r.idProofType,
        r.createdAt ? new Date(r.createdAt).toISOString() : ""
      ]))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=students_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  app.get("/api/admin/export/payments", authMiddleware, roleMiddleware("admin"), async (_req: AuthRequest, res) => {
    try {
      const rows = await db.select().from(schema.payments).orderBy(schema.payments.createdAt);
      const allBookings = await db.select().from(schema.bookings);
      const bookingMap = new Map(allBookings.map(b => [b.id, b.bookingCode || b.id]));
      const allInstallments = await db.select().from(schema.installments);
      const instMap = new Map(allInstallments.map(i => [i.id, i.name || i.id]));
      const header = ["Booking Code","Installment","Amount","Status","Payment Method","Razorpay Order ID","Razorpay Payment ID","Failure Reason","Created At"];
      const csv = [header.join(","), ...rows.map(r => csvRow([
        bookingMap.get(r.bookingId || "") || r.bookingId,
        instMap.get(r.installmentId || "") || r.installmentId || "",
        r.amount, r.status,
        r.paymentMethod, r.razorpayOrderId, r.razorpayPaymentId, r.failureReason,
        r.createdAt ? new Date(r.createdAt).toISOString() : ""
      ]))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=payments_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  app.get("/api/admin/export/installments", authMiddleware, roleMiddleware("admin"), async (_req: AuthRequest, res) => {
    try {
      const rows = await db.select().from(schema.installments).orderBy(schema.installments.createdAt);
      const allBookings = await db.select().from(schema.bookings);
      const bookingMap = new Map(allBookings.map(b => [b.id, b.bookingCode || b.id]));
      const header = ["Booking Code","Name","Amount","Due Date","Paid","Paid At","Created At"];
      const csv = [header.join(","), ...rows.map(r => csvRow([
        bookingMap.get(r.bookingId || "") || r.bookingId,
        r.name, r.amount, r.dueDate, r.paid,
        r.paidAt ? new Date(r.paidAt).toISOString() : "",
        r.createdAt ? new Date(r.createdAt).toISOString() : ""
      ]))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=installments_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  app.get("/api/admin/export/users", authMiddleware, roleMiddleware("admin"), async (_req: AuthRequest, res) => {
    try {
      const rows = await db.select({
        id: schema.users.id, name: schema.users.name, email: schema.users.email,
        phone: schema.users.phone, role: schema.users.role, isActive: schema.users.isActive,
        createdAt: schema.users.createdAt
      }).from(schema.users).orderBy(schema.users.createdAt);
      const header = ["Name","Email","Phone","Role","Active","Created At"];
      const csv = [header.join(","), ...rows.map(r => csvRow([
        r.name, r.email, r.phone, r.role, r.isActive,
        r.createdAt ? new Date(r.createdAt).toISOString() : ""
      ]))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=users_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  app.get("/api/admin/export/properties", authMiddleware, roleMiddleware("admin"), async (_req: AuthRequest, res) => {
    try {
      const rows = await db.select().from(schema.properties);
      const header = ["Name","Address","City","State","Description","Booking Mode","Amenities","Created At"];
      const csv = [header.join(","), ...rows.map(r => csvRow([
        r.name, r.address, r.city, r.state, r.description, r.bookingMode,
        Array.isArray(r.amenities) ? (r.amenities as string[]).join("; ") : "",
        r.createdAt ? new Date(r.createdAt).toISOString() : ""
      ]))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=properties_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  app.get("/api/admin/export/floors", authMiddleware, roleMiddleware("admin"), async (_req: AuthRequest, res) => {
    try {
      const rows = await db.select({
        id: schema.floors.id,
        propertyId: schema.floors.propertyId,
        floorNumber: schema.floors.floorNumber,
        name: schema.floors.name,
        totalBeds: schema.floors.totalBeds,
        availableBeds: schema.floors.availableBeds,
        createdAt: schema.floors.createdAt,
        propertyName: schema.properties.name,
      }).from(schema.floors).leftJoin(schema.properties, eq(schema.floors.propertyId, schema.properties.id));
      const header = ["Floor Name","Floor Number","Property","Total Beds","Available Beds","Created At"];
      const csv = [header.join(","), ...rows.map(r => csvRow([
        r.name, r.floorNumber, r.propertyName || "", r.totalBeds, r.availableBeds,
        r.createdAt ? new Date(r.createdAt).toISOString() : ""
      ]))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=floors_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  app.get("/api/admin/export/beds", authMiddleware, roleMiddleware("admin"), async (_req: AuthRequest, res) => {
    try {
      const rows = await db.select({
        id: schema.beds.id,
        bedNumber: schema.beds.bedNumber,
        status: schema.beds.status,
        monthlyPrice: schema.beds.monthlyPrice,
        blockedReason: schema.beds.blockedReason,
        blockedCategory: schema.beds.blockedCategory,
        createdAt: schema.beds.createdAt,
        propertyName: schema.properties.name,
        floorName: schema.floors.name,
        roomNumber: schema.rooms.roomNumber,
      }).from(schema.beds)
        .leftJoin(schema.properties, eq(schema.beds.propertyId, schema.properties.id))
        .leftJoin(schema.floors, eq(schema.beds.floorId, schema.floors.id))
        .leftJoin(schema.rooms, eq(schema.beds.roomId, schema.rooms.id));
      const header = ["Bed Number","Property","Floor","Room","Status","Monthly Price","Blocked Reason","Blocked Category","Created At"];
      const csv = [header.join(","), ...rows.map(r => csvRow([
        r.bedNumber, r.propertyName || "", r.floorName || "", r.roomNumber || "",
        r.status, r.monthlyPrice || "", r.blockedReason || "", r.blockedCategory || "",
        r.createdAt ? new Date(r.createdAt).toISOString() : ""
      ]))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=beds_${new Date().toISOString().split("T")[0]}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Export failed" });
    }
  });

  app.get("/api/admin/export/summary", authMiddleware, roleMiddleware("admin"), async (_req: AuthRequest, res) => {
    try {
      const [bookingCount] = await db.select({ count: sql`count(*)` }).from(schema.bookings);
      const [leadCount] = await db.select({ count: sql`count(*)` }).from(schema.leads);
      const [studentCount] = await db.select({ count: sql`count(*)` }).from(schema.students);
      const [paymentCount] = await db.select({ count: sql`count(*)` }).from(schema.payments);
      const [installmentCount] = await db.select({ count: sql`count(*)` }).from(schema.installments);
      const [userCount] = await db.select({ count: sql`count(*)` }).from(schema.users);
      const [propertyCount] = await db.select({ count: sql`count(*)` }).from(schema.properties);
      const [floorCount] = await db.select({ count: sql`count(*)` }).from(schema.floors);
      const [bedCount] = await db.select({ count: sql`count(*)` }).from(schema.beds);
      res.json({
        bookings: Number(bookingCount.count),
        leads: Number(leadCount.count),
        students: Number(studentCount.count),
        payments: Number(paymentCount.count),
        installments: Number(installmentCount.count),
        users: Number(userCount.count),
        properties: Number(propertyCount.count),
        floors: Number(floorCount.count),
        beds: Number(bedCount.count),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch summary" });
    }
  });

  // ============ FLOORS & BEDS ============

  app.get("/api/properties/:id/available-beds", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const propertyId = req.params.id;
      const roomTypeId = req.query.roomTypeId as string;
      const isSuperadmin = req.user!.role === "superadmin";
      if (!roomTypeId && !isSuperadmin) return res.status(400).json({ error: "roomTypeId query param is required" });

      const scope = await getReceptionistScope(req);
      if (scope && !scope.has(propertyId)) {
        return res.status(403).json({ error: "Property not in your assignment scope" });
      }

      const allBeds = await storage.getBedsByProperty(propertyId);

      let targetOccupancy: number | null = null;
      if (roomTypeId) {
        const rtRows = await db.select().from(schema.roomTypes).where(eq(schema.roomTypes.id, roomTypeId));
        targetOccupancy = rtRows[0]?.occupancy || null;
      }

      const allRoomIds = [...new Set(allBeds.map(b => b.roomId).filter(Boolean))];
      const allRoomsList = allRoomIds.length > 0 ? await db.select().from(schema.rooms).where(inArray(schema.rooms.id, allRoomIds as string[])) : [];
      const allRoomMap = Object.fromEntries(allRoomsList.map(r => [r.id, r]));

      // Source of truth for occupancy: which beds are held by an active booking?
      // The beds.status column drifts (cancellations, end-of-season, HMS sync, manual edits)
      // so we rely on bookings instead and treat status only as a fallback signal.
      const allBedIds = allBeds.map(b => b.id);
      const activeBedRows = allBedIds.length > 0
        ? await db.select({ bedId: schema.bookings.bedId }).from(schema.bookings).where(
            and(
              inArray(schema.bookings.bedId, allBedIds),
              inArray(schema.bookings.status, ["confirmed", "active", "pending_payment", "pending_approval"]),
            ),
          )
        : [];
      const occupiedBedIds = new Set(activeBedRows.map(r => r.bedId).filter(Boolean) as string[]);

      // beds.status is a fallback signal: even when no booking holds the bed, the bed
      // can be operationally non-allocatable (blocked, under maintenance, manually reserved).
      // Treat these as unavailable for shift targets.
      const NON_ALLOCATABLE_STATUSES = new Set(["blocked", "maintenance", "reserved"]);
      const isBedAvailable = (b: any) => {
        if (occupiedBedIds.has(b.id)) return false;
        if (b.status && NON_ALLOCATABLE_STATUSES.has(b.status)) return false;
        return true;
      };

      const bedMatchesRoomType = (b: any): boolean => {
        if (!roomTypeId) return true;
        const room = b.roomId ? allRoomMap[b.roomId] : undefined;
        // Mixed-occupancy rooms (e.g. "2+2") may use the bed-letter convention.
        // Only narrow by letter when the room type's occupancy actually matches one
        // of the typology pieces. Otherwise fall through to the standard match —
        // never hard-reject the bed, because the user explicitly chose this room
        // type and the bed itself may be tagged with the matching roomTypeId.
        if (room?.typology?.includes("+") && targetOccupancy) {
          const parts = room.typology.split("+").map((p: string) => parseInt(p));
          const matchingLetters = parts
            .map((p: number, i: number) => p === targetOccupancy ? String.fromCharCode(65 + i) : null)
            .filter(Boolean);
          if (matchingLetters.length > 0) {
            return matchingLetters.some((letter: string | null) => b.bedNumber?.includes(`${room.roomNumber}${letter}`));
          }
          // Fall through to standard match below.
        }
        // Standard rooms: prefer the bed's roomTypeId, fall back to the room's roomTypeId
        // when the bed row is missing it (data drift on older properties).
        if (b.roomTypeId) return b.roomTypeId === roomTypeId;
        return room?.roomTypeId === roomTypeId;
      };

      const matchingBeds = allBeds.filter(bedMatchesRoomType);
      const totalInType = matchingBeds.length;
      const occupiedInType = matchingBeds.filter(b => occupiedBedIds.has(b.id)).length;
      const unallocatableInType = matchingBeds.filter(b => !occupiedBedIds.has(b.id) && b.status && NON_ALLOCATABLE_STATUSES.has(b.status)).length;
      const availableBeds = matchingBeds.filter(isBedAvailable);

      const floorIds = [...new Set(availableBeds.map(b => b.floorId))];
      const roomIds = [...new Set(availableBeds.map(b => b.roomId).filter(Boolean))];

      const floorsList = floorIds.length > 0 ? await db.select().from(schema.floors).where(inArray(schema.floors.id, floorIds)) : [];
      const roomsList = roomIds.length > 0 ? await db.select().from(schema.rooms).where(inArray(schema.rooms.id, roomIds as string[])) : [];

      const floorMap = Object.fromEntries(floorsList.map(f => [f.id, f]));
      const roomMap = Object.fromEntries(roomsList.map(r => [r.id, r]));

      const roomBedIds = availableBeds.filter(b => b.roomId).map(b => b.roomId as string);
      const siblingBedIds = roomBedIds.length > 0
        ? await db.select({ id: schema.beds.id, roomId: schema.beds.roomId }).from(schema.beds).where(inArray(schema.beds.roomId, roomBedIds))
        : [];
      const siblingBookings = siblingBedIds.length > 0
        ? await db.select({
            bedId: schema.bookings.bedId,
            bookingId: schema.bookings.id,
          }).from(schema.bookings).where(
            and(
              inArray(schema.bookings.bedId, siblingBedIds.map(b => b.id)),
              inArray(schema.bookings.status, ["confirmed", "active", "completed", "pending_payment"])
            )
          )
        : [];
      const bookingIds = siblingBookings.map(b => b.bookingId);
      const activePackages = bookingIds.length > 0
        ? await db.select({
            bookingId: schema.bookingPackages.bookingId,
            packageName: schema.packages.name,
            tierLevel: schema.packages.tierLevel,
          })
          .from(schema.bookingPackages)
          .innerJoin(schema.packages, eq(schema.bookingPackages.packageId, schema.packages.id))
          .where(and(
            inArray(schema.bookingPackages.bookingId, bookingIds),
            eq(schema.bookingPackages.status, "ACTIVE"),
            eq(schema.packages.category, "housing_plan"),
          ))
        : [];

      const bedBookingMap: Record<string, string> = {};
      for (const sb of siblingBookings) {
        if (sb.bedId) bedBookingMap[sb.bedId] = sb.bookingId;
      }
      const bookingPackageMap: Record<string, string> = {};
      for (const ap of activePackages) {
        bookingPackageMap[ap.bookingId] = ap.packageName;
      }

      const roomPackageMap: Record<string, Set<string>> = {};
      for (const sib of siblingBedIds) {
        if (sib.roomId) {
          const bkId = bedBookingMap[sib.id];
          if (bkId && bookingPackageMap[bkId]) {
            if (!roomPackageMap[sib.roomId]) roomPackageMap[sib.roomId] = new Set();
            roomPackageMap[sib.roomId].add(bookingPackageMap[bkId]);
          }
        }
      }

      const roomTypeIds = [...new Set(availableBeds.map(b => b.roomTypeId).filter(Boolean))];
      const roomTypesList = roomTypeIds.length > 0 ? await db.select().from(schema.roomTypes).where(inArray(schema.roomTypes.id, roomTypeIds as string[])) : [];
      const roomTypeMap = Object.fromEntries(roomTypesList.map(rt => [rt.id, rt]));

      const enriched = availableBeds.map(bed => {
        const packageNames = bed.roomId && roomPackageMap[bed.roomId]
          ? [...roomPackageMap[bed.roomId]]
          : [];
        return {
          id: bed.id,
          bedNumber: bed.bedNumber,
          floorId: bed.floorId,
          floorName: floorMap[bed.floorId]?.name || `Floor ${floorMap[bed.floorId]?.floorNumber || "?"}`,
          floorNumber: floorMap[bed.floorId]?.floorNumber || 0,
          roomId: bed.roomId,
          roomNumber: bed.roomId ? roomMap[bed.roomId]?.roomNumber || "" : "",
          roomTypeId: bed.roomTypeId,
          roomTypeName: bed.roomTypeId ? (roomTypeMap[bed.roomTypeId]?.customName || roomTypeMap[bed.roomTypeId]?.name || "") : "",
          linkedPackages: packageNames,
        };
      });

      enriched.sort((a, b) => a.floorNumber - b.floorNumber || a.roomNumber.localeCompare(b.roomNumber) || a.bedNumber.localeCompare(b.bedNumber));

      res.json({ beds: enriched, totalInType, occupiedInType, unallocatableInType });
    } catch (error: any) {
      console.error("Error fetching available beds:", error);
      res.status(500).json({ error: "Failed to fetch available beds" });
    }
  });

  app.get("/api/properties/:id/floors", async (req, res) => {
    try {
      const propertyId = req.params.id;
      const scope = await getReceptionistScopeFromHeader(req);
      if (scope && !scope.has(propertyId)) {
        return res.status(403).json({ error: "Property not in your assignment scope" });
      }
      let floorsList = await storage.getFloorsByProperty(propertyId);

      if (floorsList.length === 0) {
        let isAdmin = false;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          const payload = verifyToken(authHeader.substring(7));
          if (payload && (payload.role === "admin" || payload.role === "superadmin")) {
            isAdmin = true;
          }
        }

        if (isAdmin) {
          const generated = await ensureFloorsForProperty(propertyId);
          if (generated) {
            floorsList = await storage.getFloorsByProperty(propertyId);
          }
        }
      }

      const activeBookings = await db.select({
        bedId: schema.bookings.bedId,
        studentId: schema.bookings.studentId,
        walkInName: schema.bookings.walkInName,
        bookingCode: schema.bookings.bookingCode,
        status: schema.bookings.status,
      }).from(schema.bookings).where(
        and(
          eq(schema.bookings.propertyId, propertyId),
          inArray(schema.bookings.status, ["confirmed", "active", "pending_payment", "pending_approval"]),
          sql`${schema.bookings.bedId} IS NOT NULL`
        )
      );

      const studentIds = activeBookings.filter(b => b.studentId).map(b => b.studentId!);
      let studentMap: Record<string, string> = {};
      if (studentIds.length > 0) {
        const students = await db.select({ id: schema.students.id, fullName: schema.students.fullName }).from(schema.students).where(inArray(schema.students.id, studentIds));
        studentMap = Object.fromEntries(students.map(s => [s.id, s.fullName]));
      }

      const bedBookingMap: Record<string, { occupantName: string; bookingCode: string | null; bookingStatus: string }> = {};
      for (const b of activeBookings) {
        if (b.bedId) {
          const name = b.studentId ? (studentMap[b.studentId] || "Student") : (b.walkInName || "Occupant");
          bedBookingMap[b.bedId] = { occupantName: name, bookingCode: b.bookingCode, bookingStatus: b.status };
        }
      }

      const floorsWithData = await Promise.all(
        floorsList.map(async (floor) => {
          const floorBeds = await storage.getBedsByFloor(floor.id);
          const floorRooms = await storage.getRoomsByFloor(floor.id);
          const roomsWithBeds = await Promise.all(
            floorRooms.map(async (room) => {
              const roomBeds = await storage.getBedsByRoom(room.id);
              const bedsWithInfo = await Promise.all(roomBeds.map(async (bed) => {
                const hold = await isBedHeld(bed.id);
                const booking = bedBookingMap[bed.id];
                return { ...bed, held: hold.held, occupantName: booking?.occupantName || null, bookingCode: booking?.bookingCode || null, bookingStatus: booking?.bookingStatus || null };
              }));
              return { ...room, beds: bedsWithInfo };
            })
          );
          const availableBeds = floorBeds.filter(b => b.status === "available").length;
          return {
            ...floor,
            totalBeds: floorBeds.length,
            availableBeds,
            beds: floorBeds,
            rooms: roomsWithBeds,
          };
        })
      );
      res.json(floorsWithData);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch floors" });
    }
  });

  app.get("/api/properties/:id/floors/:floorId/beds", async (req, res) => {
    try {
      const scope = await getReceptionistScopeFromHeader(req);
      if (scope && !scope.has(req.params.id)) {
        return res.status(403).json({ error: "Property not in your assignment scope" });
      }
      // Validate floorId actually belongs to :id so callers can't enumerate
      // floors from other properties by passing a foreign floorId.
      const floorPropertyId = await getPropertyIdForFloor(req.params.floorId);
      if (!floorPropertyId) {
        return res.status(404).json({ error: "Floor not found" });
      }
      if (floorPropertyId !== req.params.id) {
        return res.status(400).json({ error: "Floor does not belong to this property" });
      }
      const bedsList = await storage.getBedsByFloor(req.params.floorId);
      res.json(bedsList);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch beds" });
    }
  });

  app.get("/api/properties/:id/rooms", async (req, res) => {
    try {
      const scope = await getReceptionistScopeFromHeader(req);
      if (scope && !scope.has(req.params.id)) {
        return res.status(403).json({ error: "Property not in your assignment scope" });
      }
      const roomsList = await storage.getRoomsByProperty(req.params.id);
      const roomsWithBeds = await Promise.all(
        roomsList.map(async (room) => {
          const roomBeds = await storage.getBedsByRoom(room.id);
          return { ...room, beds: roomBeds };
        })
      );
      res.json(roomsWithBeds);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch rooms" });
    }
  });

  app.get("/api/floors/:floorId/rooms", async (req, res) => {
    try {
      const scope = await getReceptionistScopeFromHeader(req);
      if (scope) {
        const propertyId = await getPropertyIdForFloor(req.params.floorId);
        if (!propertyId || !scope.has(propertyId)) {
          return res.status(403).json({ error: "Floor not in your assignment scope" });
        }
      }
      const roomsList = await storage.getRoomsByFloor(req.params.floorId);
      const roomsWithBeds = await Promise.all(
        roomsList.map(async (room) => {
          const roomBeds = await storage.getBedsByRoom(room.id);
          return { ...room, beds: roomBeds };
        })
      );
      res.json(roomsWithBeds);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch rooms" });
    }
  });

  app.post("/api/admin/properties/:id/floors/:floorId/rooms", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const {
        roomNumber, roomTypeId, typology, hasSharedWashroom, sharedWashroomSections, flatAmenities, monthlyPrice,
        basePriceOverride, academicYearPriceOverride, depositOverride, sectionPriceOverrides,
      } = req.body;
      if (!roomNumber || !roomTypeId || !typology) {
        return res.status(400).json({ error: "roomNumber, roomTypeId, and typology are required" });
      }

      const roomNumbers = roomNumber.includes(",")
        ? roomNumber.split(",").map((s: string) => s.trim()).filter((s: string) => s)
        : [roomNumber.trim()];

      const cleanedAmenities = Array.isArray(flatAmenities)
        ? flatAmenities.filter((a: any) => typeof a === "string" && a.trim()).map((a: string) => a.trim())
        : [];

      const isCombo = typeof typology === "string" && typology.includes("+");
      const sectionLabels = isCombo
        ? typology.split("+").map((_: string, i: number) => String.fromCharCode(65 + i))
        : [];
      let cleanedSections: string[] = [];
      if (isCombo && Array.isArray(sharedWashroomSections)) {
        cleanedSections = sharedWashroomSections
          .filter((s: any) => typeof s === "string")
          .map((s: string) => s.trim().toUpperCase())
          .filter((s: string) => sectionLabels.includes(s));
        cleanedSections = Array.from(new Set(cleanedSections));
      }
      const allSectionsShared = isCombo && cleanedSections.length > 0 && cleanedSections.length === sectionLabels.length;
      const effectiveHasSharedWashroom = isCombo
        ? (cleanedSections.length === 0 ? !!hasSharedWashroom : allSectionsShared)
        : !!hasSharedWashroom;

      const createdRooms: any[] = [];

      for (const singleRoomNumber of roomNumbers) {
        const room = await storage.createRoom({
          propertyId: req.params.id,
          floorId: req.params.floorId,
          roomTypeId,
          roomNumber: singleRoomNumber,
          typology,
          hasSharedWashroom: effectiveHasSharedWashroom,
          sharedWashroomSections: cleanedSections,
          flatAmenities: cleanedAmenities,
          totalBeds: 0,
          status: "available",
          monthlyPrice: monthlyPrice || null,
          basePriceOverride: typeof basePriceOverride === "number" && basePriceOverride > 0 ? basePriceOverride : null,
          academicYearPriceOverride: typeof academicYearPriceOverride === "number" && academicYearPriceOverride > 0 ? academicYearPriceOverride : null,
          depositOverride: typeof depositOverride === "number" ? depositOverride : null,
          sectionPriceOverrides: sectionPriceOverrides && typeof sectionPriceOverrides === "object" ? sectionPriceOverrides : null,
        } as any);

        const bedsToCreate: any[] = [];
        const normalizedTypology = typology.replace(/\s*bed\s*/gi, "").trim();
        const parts = normalizedTypology.split("+").map((p: string) => parseInt(p.trim()));
        if (parts.length === 1 && !isNaN(parts[0])) {
          for (let i = 0; i < parts[0]; i++) {
            bedsToCreate.push({
              propertyId: req.params.id,
              floorId: req.params.floorId,
              roomId: room.id,
              roomTypeId,
              bedNumber: parts[0] === 1 ? singleRoomNumber : `${singleRoomNumber}-${String.fromCharCode(65 + i)}`,
              status: "available" as const,
              monthlyPrice: monthlyPrice || null,
            });
          }
        } else if (parts.length > 1) {
          const propertyRoomTypes = await storage.getRoomTypesByProperty(req.params.id);
          for (let section = 0; section < parts.length; section++) {
            const sectionLabel = String.fromCharCode(65 + section);
            const bedCount = parts[section];
            if (isNaN(bedCount)) continue;
            let sectionRoomTypeId = roomTypeId;
            const sectionRT = propertyRoomTypes.find((rt: any) => rt.occupancy === bedCount && rt.id !== roomTypeId);
            if (sectionRT) {
              sectionRoomTypeId = sectionRT.id;
            } else {
              const baseRT = propertyRoomTypes.find((rt: any) => rt.id === roomTypeId);
              if (baseRT && baseRT.occupancy === bedCount) {
                sectionRoomTypeId = roomTypeId;
              }
            }
            for (let b = 0; b < bedCount; b++) {
              bedsToCreate.push({
                propertyId: req.params.id,
                floorId: req.params.floorId,
                roomId: room.id,
                roomTypeId: sectionRoomTypeId,
                bedNumber: `${singleRoomNumber}${sectionLabel}${bedCount > 1 ? `-${b + 1}` : ""}`,
                status: "available" as const,
                monthlyPrice: monthlyPrice || null,
              });
            }
          }
        }

        let createdBeds: any[] = [];
        if (bedsToCreate.length > 0) {
          createdBeds = await storage.createBeds(bedsToCreate);
          await storage.updateRoom(room.id, { totalBeds: createdBeds.length } as any);
        }

        createdRooms.push({ ...room, totalBeds: createdBeds.length, beds: createdBeds });
      }

      const allFloorBeds = await storage.getBedsByFloor(req.params.floorId);
      const availCount = allFloorBeds.filter(b => b.status === "available").length;
      await db.update(schema.floors).set({ totalBeds: allFloorBeds.length, availableBeds: availCount }).where(eq(schema.floors.id, req.params.floorId));

      res.status(201).json(createdRooms.length === 1 ? createdRooms[0] : createdRooms);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create room" });
    }
  });

  app.patch("/api/admin/rooms/:id", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const scope = await getReceptionistScope(req);
      if (scope) {
        const propertyId = await getPropertyIdForRoom(req.params.id);
        if (!propertyId || !scope.has(propertyId)) {
          return res.status(403).json({ error: "Room not in your assignment scope" });
        }
      }
      const {
        status, roomNumber, typology, hasSharedWashroom, sharedWashroomSections, flatAmenities, monthlyPrice,
        basePriceOverride, academicYearPriceOverride, depositOverride, sectionPriceOverrides,
      } = req.body;
      const updateData: any = {};
      if (status) updateData.status = status;
      if (roomNumber) updateData.roomNumber = roomNumber;
      if (typology !== undefined) updateData.typology = typology;
      if (hasSharedWashroom !== undefined) updateData.hasSharedWashroom = hasSharedWashroom;
      // Per-room and per-section price overrides — null/empty clears the override.
      if (basePriceOverride !== undefined) {
        updateData.basePriceOverride = (typeof basePriceOverride === "number" && basePriceOverride > 0) ? basePriceOverride : null;
      }
      if (academicYearPriceOverride !== undefined) {
        updateData.academicYearPriceOverride = (typeof academicYearPriceOverride === "number" && academicYearPriceOverride > 0) ? academicYearPriceOverride : null;
      }
      if (depositOverride !== undefined) {
        updateData.depositOverride = (typeof depositOverride === "number") ? depositOverride : null;
      }
      if (sectionPriceOverrides !== undefined) {
        // Strip empty entries so the JSON stays clean.
        if (sectionPriceOverrides && typeof sectionPriceOverrides === "object") {
          const cleaned: Record<string, any> = {};
          for (const [k, v] of Object.entries(sectionPriceOverrides as Record<string, any>)) {
            if (!v || typeof v !== "object") continue;
            const entry: Record<string, number> = {};
            if (typeof v.basePrice === "number" && v.basePrice > 0) entry.basePrice = v.basePrice;
            if (typeof v.academicYearPrice === "number" && v.academicYearPrice > 0) entry.academicYearPrice = v.academicYearPrice;
            if (typeof v.deposit === "number") entry.deposit = v.deposit;
            if (Object.keys(entry).length > 0) cleaned[k.toUpperCase()] = entry;
          }
          updateData.sectionPriceOverrides = Object.keys(cleaned).length > 0 ? cleaned : null;
        } else {
          updateData.sectionPriceOverrides = null;
        }
      }
      if (flatAmenities !== undefined) {
        updateData.flatAmenities = Array.isArray(flatAmenities)
          ? flatAmenities.filter((a: any) => typeof a === "string" && a.trim()).map((a: string) => a.trim())
          : [];
      }
      if (sharedWashroomSections !== undefined || typology !== undefined) {
        const existingRoomList = await db.select().from(schema.rooms).where(eq(schema.rooms.id, req.params.id));
        const existingRoom = existingRoomList[0];
        const effectiveTypology = (typology !== undefined ? typology : existingRoom?.typology) || "";
        const isCombo = typeof effectiveTypology === "string" && effectiveTypology.includes("+");
        if (isCombo) {
          const sectionLabels = effectiveTypology.split("+").map((_: string, i: number) => String.fromCharCode(65 + i));
          const sourceSections = sharedWashroomSections !== undefined
            ? sharedWashroomSections
            : (existingRoom?.sharedWashroomSections ?? []);
          const cleaned = Array.isArray(sourceSections)
            ? Array.from(new Set(
                (sourceSections as any[])
                  .filter((s: any) => typeof s === "string")
                  .map((s: string) => s.trim().toUpperCase())
                  .filter((s: string) => sectionLabels.includes(s))
              ))
            : [];
          if (sharedWashroomSections !== undefined) {
            updateData.sharedWashroomSections = cleaned;
            if (cleaned.length > 0) {
              updateData.hasSharedWashroom = cleaned.length === sectionLabels.length;
            }
          } else if (typology !== undefined && Array.isArray(existingRoom?.sharedWashroomSections)) {
            const before = existingRoom!.sharedWashroomSections!.slice().sort().join(",");
            const after = cleaned.slice().sort().join(",");
            if (before !== after) {
              updateData.sharedWashroomSections = cleaned;
              if (cleaned.length > 0) {
                updateData.hasSharedWashroom = cleaned.length === sectionLabels.length;
              }
            }
          }
        } else {
          updateData.sharedWashroomSections = [];
        }
      }
      if (monthlyPrice !== undefined) updateData.monthlyPrice = monthlyPrice;
      const updated = await storage.updateRoom(req.params.id, updateData);
      if (!updated) return res.status(404).json({ error: "Room not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update room" });
    }
  });

  app.delete("/api/admin/rooms/:id", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const roomsList = await db.select().from(schema.rooms).where(eq(schema.rooms.id, req.params.id));
      const room = roomsList[0];
      const scope = await getReceptionistScope(req);
      if (scope && (!room?.propertyId || !scope.has(room.propertyId))) {
        return res.status(403).json({ error: "Room not in your assignment scope" });
      }
      await storage.deleteRoom(req.params.id);
      if (room) {
        const allFloorBeds = await storage.getBedsByFloor(room.floorId);
        const availCount = allFloorBeds.filter(b => b.status === "available").length;
        await db.update(schema.floors).set({ totalBeds: allFloorBeds.length, availableBeds: availCount }).where(eq(schema.floors.id, room.floorId));
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete room" });
    }
  });

  app.post("/api/admin/properties/:id/fix-combo-beds", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const propertyId = req.params.id;
      const propertyRoomTypes = await storage.getRoomTypesByProperty(propertyId);
      const allRooms = await storage.getRoomsByProperty(propertyId);
      const allBeds = await storage.getBedsByProperty(propertyId);
      const allBookings = await db.select().from(schema.bookings).where(eq(schema.bookings.propertyId, propertyId));

      let bedsFixed = 0;
      let bookingsFixed = 0;

      for (const room of allRooms) {
        if (!room.typology?.includes("+")) continue;
        const parts = room.typology.replace(/\s*bed\s*/gi, "").trim().split("+").map((p: string) => parseInt(p));
        if (parts.some(isNaN)) continue;

        const totalBedsInRoom = parts.reduce((a: number, b: number) => a + b, 0);
        const rtDisplayName = (rt: any) => rt.customName || rt.name || "";
        const roomLevelRT = propertyRoomTypes.find((rt: any) =>
          rt.occupancy === totalBedsInRoom && rtDisplayName(rt).includes(room.typology!)
        );

        const roomBeds = allBeds.filter(b => b.roomId === room.id);

        if (roomLevelRT) {
          const allSectionsSame = parts.every((p: number) => p === parts[0]);

          if (allSectionsSame) {
            for (const bed of roomBeds) {
              if (bed.roomTypeId !== roomLevelRT.id) {
                await db.update(schema.beds).set({ roomTypeId: roomLevelRT.id }).where(eq(schema.beds.id, bed.id));
                bedsFixed++;
              }
              const bedBookings = allBookings.filter(bk => bk.bedId === bed.id && bk.status !== "cancelled" && bk.status !== "completed");
              for (const bk of bedBookings) {
                if (bk.roomTypeId !== roomLevelRT.id) {
                  await db.update(schema.bookings).set({ roomTypeId: roomLevelRT.id }).where(eq(schema.bookings.id, bk.id));
                  bookingsFixed++;
                }
              }
            }
          } else {
            const maxSectionSize = Math.max(...parts);
            for (const bed of roomBeds) {
              const sectionIndex = parts.findIndex((_: number, i: number) => {
                const sectionLetter = String.fromCharCode(65 + i);
                return bed.bedNumber?.includes(`${room.roomNumber}${sectionLetter}`);
              });
              if (sectionIndex < 0) continue;
              const sectionSize = parts[sectionIndex];
              let correctRT: any;
              if (sectionSize === maxSectionSize) {
                correctRT = roomLevelRT;
              } else {
                correctRT = propertyRoomTypes.find((rt: any) => rt.occupancy === sectionSize && !rtDisplayName(rt).includes("+"));
              }
              if (correctRT && bed.roomTypeId !== correctRT.id) {
                await db.update(schema.beds).set({ roomTypeId: correctRT.id }).where(eq(schema.beds.id, bed.id));
                bedsFixed++;
              }
              if (correctRT) {
                const bedBookings = allBookings.filter(bk => bk.bedId === bed.id && bk.status !== "cancelled" && bk.status !== "completed");
                for (const bk of bedBookings) {
                  if (bk.roomTypeId !== correctRT.id) {
                    await db.update(schema.bookings).set({ roomTypeId: correctRT.id }).where(eq(schema.bookings.id, bk.id));
                    bookingsFixed++;
                  }
                }
              }
            }
          }
        } else {
          for (const bed of roomBeds) {
            const sectionIndex = parts.findIndex((_: number, i: number) => {
              const sectionLetter = String.fromCharCode(65 + i);
              return bed.bedNumber?.includes(`${room.roomNumber}${sectionLetter}`);
            });
            if (sectionIndex < 0) continue;
            const sectionBedCount = parts[sectionIndex];
            const correctRT = propertyRoomTypes.find((rt: any) => rt.occupancy === sectionBedCount);
            if (correctRT && bed.roomTypeId !== correctRT.id) {
              await db.update(schema.beds).set({ roomTypeId: correctRT.id }).where(eq(schema.beds.id, bed.id));
              bedsFixed++;
            }

            if (correctRT) {
              const sectionLabels: Record<number, string> = { 1: "SINGLE", 2: "DOUBLE", 3: "TRIPLE", 4: "QUAD" };
              const correctLabel = `${sectionLabels[sectionBedCount] || sectionBedCount + "-BED"}(${room.typology})`;
              const bedBookings = allBookings.filter(bk => bk.bedId === bed.id && bk.status !== "cancelled" && bk.status !== "completed");
              for (const bk of bedBookings) {
                const updates: any = {};
                if (bk.roomTypeId !== correctRT.id) {
                  updates.roomTypeId = correctRT.id;
                }
                const rd = bk.residentDetails as any;
                if (rd?.accommodationType && rd.accommodationType !== correctLabel) {
                  updates.residentDetails = { ...rd, accommodationType: correctLabel };
                }
                if (Object.keys(updates).length > 0) {
                  await db.update(schema.bookings).set(updates).where(eq(schema.bookings.id, bk.id));
                  bookingsFixed++;
                }
              }
            }
          }
        }
      }

      for (const rt of propertyRoomTypes) {
        const rtBeds = await db.select().from(schema.beds).where(
          and(eq(schema.beds.propertyId, propertyId), eq(schema.beds.roomTypeId, rt.id))
        );
        const totalBeds = rtBeds.length;
        const availableBeds = rtBeds.filter(b => b.status === "available").length;
        await db.update(schema.roomTypes).set({ totalBeds, availableBeds }).where(eq(schema.roomTypes.id, rt.id));
      }

      const allFloors = await storage.getFloorsByProperty(propertyId);
      for (const floor of allFloors) {
        const floorBeds = await storage.getBedsByFloor(floor.id);
        const totalBeds = floorBeds.length;
        const availableBeds = floorBeds.filter(b => b.status === "available").length;
        await db.update(schema.floors).set({ totalBeds, availableBeds }).where(eq(schema.floors.id, floor.id));
      }

      res.json({ success: true, bedsFixed, bookingsFixed, message: `Fixed ${bedsFixed} beds and ${bookingsFixed} bookings. Availability counts recalculated.` });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fix combo beds" });
    }
  });

  app.post("/api/admin/properties/:id/floors", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const parsed = insertFloorSchema.safeParse({ ...req.body, propertyId: req.params.id });
      if (!parsed.success) return res.status(400).json({ error: "Invalid floor data", details: parsed.error.format() });
      if (parsed.data.gender !== undefined && !["any", "male", "female"].includes(String(parsed.data.gender).toLowerCase())) {
        return res.status(400).json({ error: "Invalid gender value. Must be 'any', 'male', or 'female'." });
      }
      if (parsed.data.gender) parsed.data.gender = String(parsed.data.gender).toLowerCase();
      const floor = await storage.createFloor(parsed.data);
      res.status(201).json(floor);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create floor" });
    }
  });

  app.post("/api/admin/properties/:id/floors/:floorId/beds", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { beds: bedData } = req.body;
      if (!Array.isArray(bedData) || bedData.length === 0) {
        return res.status(400).json({ error: "beds must be a non-empty array" });
      }
      const parsedBeds = bedData.map((b: any) => {
        const result = insertBedSchema.safeParse({
          ...b,
          propertyId: req.params.id,
          floorId: req.params.floorId,
        });
        if (!result.success) throw new Error(`Invalid bed data: ${JSON.stringify(result.error.format())}`);
        return result.data;
      });
      const created = await storage.createBeds(parsedBeds);
      const floor = (await storage.getFloorsByProperty(req.params.id)).find(f => f.id === req.params.floorId);
      if (floor) {
        const allFloorBeds = await storage.getBedsByFloor(req.params.floorId);
        const availCount = allFloorBeds.filter(b => b.status === "available").length;
        await db.update(schema.floors).set({ totalBeds: allFloorBeds.length, availableBeds: availCount }).where(eq(schema.floors.id, req.params.floorId));
      }
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create beds" });
    }
  });

  // Superadmin: reconcile bed statuses across all properties on demand
  app.post("/api/admin/beds/reconcile-status", authMiddleware, roleMiddleware("superadmin"), async (req: AuthRequest, res) => {
    try {
      const { reconcileBedStatuses } = await import("./bed-status-reconcile");
      const result = await reconcileBedStatuses({ source: "manual", triggeredByEmail: req.user?.email });
      res.json(result);
    } catch (error: any) {
      console.error("Bed status reconciliation failed:", error);
      res.status(500).json({ error: error.message || "Failed to reconcile bed statuses" });
    }
  });

  app.patch("/api/admin/beds/:id", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      if (!status || !["available", "occupied", "reserved", "maintenance", "blocked"].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be one of: available, occupied, reserved, maintenance, blocked" });
      }
      const scope = await getReceptionistScope(req);
      if (scope) {
        const propertyId = await getPropertyIdForBed(req.params.id);
        if (!propertyId || !scope.has(propertyId)) {
          return res.status(403).json({ error: "Bed not in your assignment scope" });
        }
      }
      const updated = await storage.updateBedStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: "Bed not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update bed" });
    }
  });

  app.post("/api/admin/beds/:id/block", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const { reason, category } = req.body;
      if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ error: "Reason is required and must be at least 5 characters" });
      }

      const bed = await storage.getBed(req.params.id);
      if (!bed) return res.status(404).json({ error: "Bed not found" });

      const scope = await getReceptionistScope(req);
      if (scope && (!bed.propertyId || !scope.has(bed.propertyId))) {
        return res.status(403).json({ error: "Bed not in your assignment scope" });
      }

      if (bed.status === "occupied") {
        return res.status(400).json({ error: "Cannot block an occupied bed. Please unassign the resident first." });
      }
      if (bed.status === "blocked") {
        return res.status(400).json({ error: "Bed is already blocked" });
      }

      const updated = await storage.blockBed(
        req.params.id,
        reason.trim(),
        category || null,
        req.user!.userId,
        req.user!.email
      );

      if (bed.floorId) {
        const allFloorBeds = await storage.getBedsByFloor(bed.floorId);
        const availCount = allFloorBeds.filter(b => b.status === "available").length;
        await db.update(schema.floors).set({ availableBeds: availCount }).where(eq(schema.floors.id, bed.floorId));
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to block bed" });
    }
  });

  app.post("/api/admin/properties/:id/ensure-floors", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const generated = await ensureFloorsForProperty(req.params.id);
      res.json({ generated, message: generated ? "Floors and beds auto-generated successfully" : "Floors already exist or no room types with beds" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to ensure floors";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/admin/beds/:id/unblock", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const { note } = req.body || {};

      const bed = await storage.getBed(req.params.id);
      if (!bed) return res.status(404).json({ error: "Bed not found" });

      const scope = await getReceptionistScope(req);
      if (scope && (!bed.propertyId || !scope.has(bed.propertyId))) {
        return res.status(403).json({ error: "Bed not in your assignment scope" });
      }

      if (bed.status !== "blocked") {
        return res.status(400).json({ error: "Bed is not blocked" });
      }

      const updated = await storage.unblockBed(
        req.params.id,
        note || null,
        req.user!.userId,
        req.user!.email
      );

      if (bed.floorId) {
        const allFloorBeds = await storage.getBedsByFloor(bed.floorId);
        const availCount = allFloorBeds.filter(b => b.status === "available").length;
        await db.update(schema.floors).set({ availableBeds: availCount }).where(eq(schema.floors.id, bed.floorId));
      }

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to unblock bed" });
    }
  });

  app.get("/api/admin/beds/reconciliation-runs", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { propertyId, from, to, limit } = req.query as { propertyId?: string; from?: string; to?: string; limit?: string };
      const fromDate = from ? new Date(from) : undefined;
      const toDate = to ? new Date(to) : undefined;
      if (fromDate && isNaN(fromDate.getTime())) return res.status(400).json({ error: "Invalid 'from' date" });
      if (toDate && isNaN(toDate.getTime())) return res.status(400).json({ error: "Invalid 'to' date" });
      const limitNum = limit ? Math.max(1, Math.min(parseInt(limit, 10) || 30, 200)) : 30;
      const runs = await storage.getBedReconciliationRuns({
        propertyId: propertyId || undefined,
        from: fromDate,
        to: toDate,
        limit: limitNum,
      });
      res.json(runs);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch reconciliation runs" });
    }
  });

  app.get("/api/admin/beds/:id/block-logs", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const logs = await storage.getBedBlockLogs(req.params.id);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch block logs" });
    }
  });

  app.delete("/api/admin/floors/:id", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const scope = await getReceptionistScope(req);
      if (scope) {
        const propertyId = await getPropertyIdForFloor(req.params.id);
        if (!propertyId || !scope.has(propertyId)) {
          return res.status(403).json({ error: "Floor not in your assignment scope" });
        }
      }
      await storage.deleteFloor(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete floor" });
    }
  });

  app.delete("/api/admin/beds/:id", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const scope = await getReceptionistScope(req);
      if (scope) {
        const propertyId = await getPropertyIdForBed(req.params.id);
        if (!propertyId || !scope.has(propertyId)) {
          return res.status(403).json({ error: "Bed not in your assignment scope" });
        }
      }
      await storage.deleteBed(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete bed" });
    }
  });

  // Update floor metadata (name / floorNumber / gender / layoutImage)
  app.patch("/api/admin/floors/:id", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const scope = await getReceptionistScope(req);
      if (scope) {
        const propertyId = await getPropertyIdForFloor(req.params.id);
        if (!propertyId || !scope.has(propertyId)) {
          return res.status(403).json({ error: "Floor not in your assignment scope" });
        }
      }
      const allowed: Record<string, unknown> = {};
      if (typeof req.body?.name === "string") allowed.name = req.body.name.trim();
      if (typeof req.body?.floorNumber === "number") allowed.floorNumber = req.body.floorNumber;
      if (typeof req.body?.gender === "string") {
        const g = req.body.gender.trim().toLowerCase();
        if (!["any", "male", "female"].includes(g)) {
          return res.status(400).json({ error: "gender must be 'any', 'male', or 'female'" });
        }
        allowed.gender = g;
      }
      if (req.body?.layoutImage === null || typeof req.body?.layoutImage === "string") {
        allowed.layoutImage = req.body.layoutImage;
      }
      if (Object.keys(allowed).length === 0) {
        return res.status(400).json({ error: "No editable fields provided" });
      }
      const [updated] = await db.update(schema.floors)
        .set(allowed)
        .where(eq(schema.floors.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Floor not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update floor" });
    }
  });

  app.post("/api/admin/properties/:id/auto-generate-floors", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const propertyId = req.params.id;
      const { floorCount = 3 } = req.body;

      const property = await storage.getProperty(propertyId);
      if (!property) return res.status(404).json({ error: "Property not found" });

      const roomTypesList = await storage.getRoomTypesByProperty(propertyId);
      if (roomTypesList.length === 0) return res.status(400).json({ error: "No room types found for this property" });

      const existingFloors = await storage.getFloorsByProperty(propertyId);
      if (existingFloors.length > 0) {
        return res.status(400).json({ error: "Floors already exist for this property. Delete existing floors first." });
      }

      const createdFloors: any[] = [];
      for (let i = 0; i < floorCount; i++) {
        const floorName = i === 0 ? "Ground Floor" : `${i}${i === 1 ? "st" : i === 2 ? "nd" : i === 3 ? "rd" : "th"} Floor`;
        const floor = await storage.createFloor({
          propertyId,
          floorNumber: i,
          name: floorName,
          totalBeds: 0,
          availableBeds: 0,
        });

        const allBedsForFloor: any[] = [];
        const allRoomsForFloor: any[] = [];
        let roomCounter = 1;

        for (const rt of roomTypesList) {
          const bedsPerFloor = Math.ceil(rt.totalBeds / floorCount);
          const occupancy = rt.occupancy || 1;
          const roomsNeeded = Math.ceil(bedsPerFloor / occupancy);

          for (let r = 0; r < roomsNeeded; r++) {
            const roomNum = `${(i + 1) * 100 + roomCounter}`;
            const typology = `${occupancy}`;
            
            const room = await storage.createRoom({
              propertyId,
              floorId: floor.id,
              roomTypeId: rt.id,
              roomNumber: roomNum,
              typology: `${occupancy} Bed`,
              hasSharedWashroom: false,
              totalBeds: occupancy,
              status: "available",
              monthlyPrice: rt.basePrice,
            });

            const bedsForRoom: any[] = [];
            for (let b = 0; b < occupancy; b++) {
              bedsForRoom.push({
                propertyId,
                floorId: floor.id,
                roomId: room.id,
                roomTypeId: rt.id,
                bedNumber: occupancy === 1 ? roomNum : `${roomNum}-${String.fromCharCode(65 + b)}`,
                status: "available" as const,
                monthlyPrice: rt.basePrice,
              });
            }

            const createdBeds = await storage.createBeds(bedsForRoom);
            allBedsForFloor.push(...createdBeds);
            allRoomsForFloor.push({ ...room, beds: createdBeds });
            roomCounter++;
          }
        }

        await db.update(schema.floors).set({ totalBeds: allBedsForFloor.length, availableBeds: allBedsForFloor.length }).where(eq(schema.floors.id, floor.id));
        createdFloors.push({ ...floor, totalBeds: allBedsForFloor.length, availableBeds: allBedsForFloor.length, beds: allBedsForFloor, rooms: allRoomsForFloor });
      }

      res.status(201).json(createdFloors);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to auto-generate floors" });
    }
  });

  const ALLOWED_IMAGE_DOMAINS = [
    "images.unsplash.com",
    "unsplash.com",
    "lh3.googleusercontent.com",
    "drive.google.com",
    "i.imgur.com",
    "upload.wikimedia.org",
  ];
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
  const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
  const MAX_IMPORT_URLS = 20;
  const FETCH_TIMEOUT_MS = 15000;

  function validateImageUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") return false;
      return ALLOWED_IMAGE_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
    } catch { return false; }
  }

  async function fetchImageSafely(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!validateImageUrl(url)) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type")?.split(";")[0].trim() || "";
      if (!ALLOWED_IMAGE_TYPES.includes(contentType)) return null;
      const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
      if (contentLength > MAX_IMAGE_SIZE) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > MAX_IMAGE_SIZE) return null;
      return { buffer, contentType };
    } catch { return null; } finally { clearTimeout(timeout); }
  }

  app.post("/api/admin/import-image-from-url", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }
      if (!validateImageUrl(url)) {
        return res.status(400).json({ error: "URL domain not allowed. Allowed: " + ALLOWED_IMAGE_DOMAINS.join(", ") });
      }

      const result = await fetchImageSafely(url);
      if (!result) {
        return res.status(400).json({ error: "Failed to fetch image or invalid content type" });
      }

      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const objectService = new ObjectStorageService();
      const uploadURL = await objectService.getObjectEntityUploadURL();

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": result.contentType },
        body: result.buffer,
      });

      if (!uploadResponse.ok) {
        return res.status(500).json({ error: "Failed to upload to object storage" });
      }

      const objectPath = objectService.normalizeObjectEntityPath(uploadURL);
      res.json({ objectPath, contentType: result.contentType, size: result.buffer.length });
    } catch (error: any) {
      console.error("Error importing image:", error);
      res.status(500).json({ error: error.message || "Failed to import image" });
    }
  });

  app.post("/api/admin/import-tour-images", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { propertyId, category, urls } = req.body;
      if (!propertyId || !category || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: "propertyId, category, and urls array are required" });
      }
      if (urls.length > MAX_IMPORT_URLS) {
        return res.status(400).json({ error: `Maximum ${MAX_IMPORT_URLS} URLs allowed per import` });
      }

      const validCategories = ["overview", "rooms", "amenities", "location"];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ error: "Invalid category" });
      }

      const invalidUrls = urls.filter((u: string) => !validateImageUrl(u));
      if (invalidUrls.length > 0) {
        return res.status(400).json({ error: "Some URLs have disallowed domains. Allowed: " + ALLOWED_IMAGE_DOMAINS.join(", ") });
      }

      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const { ObjectStorageService } = await import("./replit_integrations/object_storage/objectStorage");
      const objectService = new ObjectStorageService();
      const importedPaths: string[] = [];

      for (const url of urls) {
        try {
          const result = await fetchImageSafely(url);
          if (!result) continue;

          const uploadURL = await objectService.getObjectEntityUploadURL();
          const uploadResponse = await fetch(uploadURL, {
            method: "PUT",
            headers: { "Content-Type": result.contentType },
            body: result.buffer,
          });

          if (uploadResponse.ok) {
            const objectPath = objectService.normalizeObjectEntityPath(uploadURL);
            importedPaths.push(objectPath);
          }
        } catch (err) {
          console.error(`Failed to import ${url}:`, err);
        }
      }

      const columnMap: Record<string, string> = {
        overview: "tourOverviewImages",
        rooms: "tourRoomsImages",
        amenities: "tourAmenitiesImages",
        location: "tourLocationImages",
      };

      const updates = { [columnMap[category]]: JSON.stringify(importedPaths) };
      const updatedProperty = await storage.updateProperty(propertyId, updates);

      res.json({
        imported: importedPaths.length,
        total: urls.length,
        paths: importedPaths,
        property: updatedProperty,
      });
    } catch (error: any) {
      console.error("Error importing tour images:", error);
      res.status(500).json({ error: error.message || "Failed to import tour images" });
    }
  });

  // ==========================================
  // BED-WISE BOOKING TREE ENDPOINTS
  // ==========================================

  // Get full booking tree for a property (property → floors → rooms → beds with booking info)
  app.get("/api/admin/properties/:id/booking-tree", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const propertyId = req.params.id;

      const scope = await getReceptionistScope(req);
      if (scope && !scope.has(propertyId)) {
        return res.status(403).json({ error: "Property not in your assignment scope" });
      }

      // Get all floors with rooms and beds
      const propertyFloors = await db.query.floors.findMany({
        where: eq(schema.floors.propertyId, propertyId),
        orderBy: schema.floors.floorNumber,
        with: {
          rooms: {
            with: {
              beds: true,
              roomType: true,
            },
          },
          beds: true,
        },
      });

      // Get all active bed allocations for this property
      const activeAllocations = await db.select()
        .from(schema.bedAllocations)
        .where(and(
          eq(schema.bedAllocations.propertyId, propertyId),
          eq(schema.bedAllocations.isActive, true),
        ));

      // Get all active/confirmed bookings for this property with bed assignments
      const activeBookings = await db.select()
        .from(schema.bookings)
        .where(and(
          eq(schema.bookings.propertyId, propertyId),
          inArray(schema.bookings.status, ["confirmed", "active", "pending_payment", "pending_approval"]),
        ));

      // Get installments for these bookings
      const bookingIds = activeBookings.map(b => b.id);
      let bookingInstallments: any[] = [];
      if (bookingIds.length > 0) {
        bookingInstallments = await db.select()
          .from(schema.installments)
          .where(inArray(schema.installments.bookingId, bookingIds));
      }

      // Get payments for these bookings
      let bookingPayments: any[] = [];
      if (bookingIds.length > 0) {
        bookingPayments = await db.select()
          .from(schema.payments)
          .where(inArray(schema.payments.bookingId, bookingIds));
      }

      // Map bed allocations by bedId for quick lookup
      const allocationsByBed: Record<string, any> = {};
      for (const alloc of activeAllocations) {
        allocationsByBed[alloc.bedId] = alloc;
      }

      // Map bookings by id
      const bookingsById: Record<string, any> = {};
      for (const b of activeBookings) {
        bookingsById[b.id] = {
          ...b,
          installments: bookingInstallments.filter(i => i.bookingId === b.id),
          payments: bookingPayments.filter(p => p.bookingId === b.id),
        };
      }

      // Also map bookings by bedId
      const bookingsByBed: Record<string, any> = {};
      for (const b of activeBookings) {
        if (b.bedId) {
          bookingsByBed[b.bedId] = bookingsById[b.id];
        }
      }

      // Enrich beds with booking info
      const enrichBed = (bed: any) => {
        const allocation = allocationsByBed[bed.id];
        const booking = bookingsByBed[bed.id];
        return {
          ...bed,
          currentAllocation: allocation || null,
          currentBooking: booking || null,
        };
      };

      // Build tree response
      const tree = propertyFloors.map((floor: any) => ({
        ...floor,
        rooms: (floor.rooms || []).map((room: any) => ({
          ...room,
          beds: (room.beds || []).map(enrichBed),
        })),
        beds: (floor.beds || []).filter((b: any) => !b.roomId).map(enrichBed),
      }));

      // Summary stats
      const allBeds = tree.flatMap((f: any) => [
        ...f.beds,
        ...f.rooms.flatMap((r: any) => r.beds),
      ]);
      const stats = {
        totalBeds: allBeds.length,
        available: allBeds.filter((b: any) => b.status === "available").length,
        occupied: allBeds.filter((b: any) => b.status === "occupied").length,
        reserved: allBeds.filter((b: any) => b.status === "reserved").length,
        maintenance: allBeds.filter((b: any) => b.status === "maintenance").length,
        blocked: allBeds.filter((b: any) => b.status === "blocked").length,
        withBooking: allBeds.filter((b: any) => b.currentBooking).length,
      };

      res.json({ floors: tree, stats });
    } catch (error: any) {
      console.error("Error fetching booking tree:", error);
      res.status(500).json({ error: error.message || "Failed to fetch booking tree" });
    }
  });

  // Get detailed bed info with full booking history and allocation timeline
  app.get("/api/admin/beds/:id/details", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const bedId = req.params.id;

      // Get bed with room/floor info
      const bed = await db.query.beds.findFirst({
        where: eq(schema.beds.id, bedId),
        with: {
          room: true,
          floor: true,
          property: true,
          roomType: true,
        },
      });

      if (!bed) {
        return res.status(404).json({ error: "Bed not found" });
      }

      const scope = await getReceptionistScope(req);
      if (scope && (!bed.propertyId || !scope.has(bed.propertyId))) {
        return res.status(403).json({ error: "Bed not in your assignment scope" });
      }

      // Get all allocations for this bed (history)
      const allocations = await db.select()
        .from(schema.bedAllocations)
        .where(eq(schema.bedAllocations.bedId, bedId))
        .orderBy(sql`${schema.bedAllocations.createdAt} DESC`);

      // Get all bookings that have this bedId
      const bedBookings = await db.select()
        .from(schema.bookings)
        .where(eq(schema.bookings.bedId, bedId))
        .orderBy(sql`${schema.bookings.createdAt} DESC`);

      // Get installments and payments for these bookings
      const bIds = bedBookings.map(b => b.id);
      let installments: any[] = [];
      let payments: any[] = [];
      if (bIds.length > 0) {
        installments = await db.select()
          .from(schema.installments)
          .where(inArray(schema.installments.bookingId, bIds));
        payments = await db.select()
          .from(schema.payments)
          .where(inArray(schema.payments.bookingId, bIds));
      }

      // Get block logs
      const blockLogs = await db.select()
        .from(schema.bedBlockLogs)
        .where(eq(schema.bedBlockLogs.bedId, bedId))
        .orderBy(sql`${schema.bedBlockLogs.createdAt} DESC`);

      // Get current active booking
      const activeBooking = bedBookings.find(b => 
        ["confirmed", "active", "pending_payment", "pending_approval"].includes(b.status)
      );

      // Get guest/student details if active booking exists
      let guestDetails: any = null;
      if (activeBooking) {
        if (activeBooking.studentId) {
          const student = await db.select()
            .from(schema.students)
            .where(eq(schema.students.id, activeBooking.studentId))
            .limit(1);
          if (student.length > 0) {
            guestDetails = {
              type: "student",
              name: student[0].fullName,
              phone: student[0].phone,
              email: student[0].email,
              college: student[0].collegeName,
              photo: student[0].photoUrl,
            };
          }
        } else if (activeBooking.walkInName) {
          guestDetails = {
            type: "walk_in",
            name: activeBooking.walkInName,
            phone: activeBooking.walkInPhone,
            email: activeBooking.walkInEmail,
          };
        }

        if (activeBooking.leadId) {
          const lead = await db.select()
            .from(schema.leads)
            .where(eq(schema.leads.id, activeBooking.leadId))
            .limit(1);
          if (lead.length > 0) {
            guestDetails = {
              ...guestDetails,
              type: "lead",
              name: lead[0].name,
              phone: lead[0].phone,
              email: lead[0].email,
            };
          }
        }
      }

      // Enrich bookings with installments/payments
      const enrichedBookings = bedBookings.map(b => ({
        ...b,
        installments: installments.filter(i => i.bookingId === b.id),
        payments: payments.filter(p => p.bookingId === b.id),
        totalPaid: payments
          .filter(p => p.bookingId === b.id && p.status === "success")
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0),
      }));

      res.json({
        bed,
        guestDetails,
        activeBooking: activeBooking ? enrichedBookings.find(b => b.id === activeBooking.id) : null,
        bookingHistory: enrichedBookings,
        allocations,
        blockLogs,
      });
    } catch (error: any) {
      console.error("Error fetching bed details:", error);
      res.status(500).json({ error: error.message || "Failed to fetch bed details" });
    }
  });

  // Allocate a bed to a booking
  app.post("/api/admin/beds/:id/allocate", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const bedId = req.params.id;
      const { bookingId, notes } = req.body;

      if (!bookingId) {
        return res.status(400).json({ error: "bookingId is required" });
      }

      // Check bed exists and is available
      const bed = await db.select().from(schema.beds).where(eq(schema.beds.id, bedId)).limit(1);
      if (bed.length === 0) return res.status(404).json({ error: "Bed not found" });

      const scope = await getReceptionistScope(req);
      if (scope && (!bed[0].propertyId || !scope.has(bed[0].propertyId))) {
        return res.status(403).json({ error: "Bed not in your assignment scope" });
      }

      if (bed[0].status !== "available") {
        return res.status(400).json({ error: `Bed is currently ${bed[0].status}, cannot allocate` });
      }

      // Check no overlapping active allocation
      const existing = await db.select()
        .from(schema.bedAllocations)
        .where(and(
          eq(schema.bedAllocations.bedId, bedId),
          eq(schema.bedAllocations.isActive, true),
        ));
      if (existing.length > 0) {
        return res.status(400).json({ error: "Bed already has an active allocation" });
      }

      // Check booking exists
      const booking = await db.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId)).limit(1);
      if (booking.length === 0) return res.status(404).json({ error: "Booking not found" });

      // Booking property must match the bed's property; also receptionist scope
      // must include the booking's property to prevent cross-scope allocation.
      if (booking[0].propertyId && bed[0].propertyId && booking[0].propertyId !== bed[0].propertyId) {
        return res.status(400).json({ error: "Booking property does not match bed property" });
      }
      if (scope && booking[0].propertyId && !scope.has(booking[0].propertyId)) {
        return res.status(403).json({ error: "Booking not in your assignment scope" });
      }

      // Validate gender vs floor restriction
      try {
        const bookingRd = (booking[0].residentDetails as Record<string, any>) || {};
        const bookingGender = bookingRd.gender || "";
        await assertGenderCompatible(bedId, bookingGender);
      } catch (genderErr: any) {
        return res.status(genderErr?.status || 400).json({ error: genderErr?.message || "Gender mismatch for this floor" });
      }

      // Create allocation
      const [allocation] = await db.insert(schema.bedAllocations).values({
        bedId,
        bookingId,
        propertyId: bed[0].propertyId,
        floorId: bed[0].floorId,
        roomId: bed[0].roomId,
        action: "allocate",
        allocatedBy: req.user?.email || "admin",
        notes,
      }).returning();

      // Update bed status
      await db.update(schema.beds)
        .set({ status: "occupied" })
        .where(eq(schema.beds.id, bedId));

      // Update booking with bed info
      await db.update(schema.bookings)
        .set({
          bedId,
          floorId: bed[0].floorId,
          roomId: bed[0].roomId,
          bedAllocated: true,
          bedAllocatedAt: new Date(),
        })
        .where(eq(schema.bookings.id, bookingId));

      res.json({ allocation, message: "Bed allocated successfully" });
    } catch (error: any) {
      console.error("Error allocating bed:", error);
      res.status(500).json({ error: error.message || "Failed to allocate bed" });
    }
  });

  // Deallocate a bed (free it up)
  app.post("/api/admin/beds/:id/deallocate", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const bedId = req.params.id;
      const { notes } = req.body;

      const scope = await getReceptionistScope(req);
      if (scope) {
        const propertyId = await getPropertyIdForBed(bedId);
        if (!propertyId || !scope.has(propertyId)) {
          return res.status(403).json({ error: "Bed not in your assignment scope" });
        }
      }

      // Deactivate current allocation
      await db.update(schema.bedAllocations)
        .set({
          isActive: false,
          deallocatedAt: new Date(),
          deallocatedBy: req.user?.email || "admin",
        })
        .where(and(
          eq(schema.bedAllocations.bedId, bedId),
          eq(schema.bedAllocations.isActive, true),
        ));

      // Set bed back to available
      await db.update(schema.beds)
        .set({ status: "available" })
        .where(eq(schema.beds.id, bedId));

      // Clear bed assignment from booking
      const booking = await db.select().from(schema.bookings).where(eq(schema.bookings.bedId, bedId)).limit(1);
      if (booking.length > 0) {
        await db.update(schema.bookings)
          .set({ bedId: null, bedAllocated: false })
          .where(eq(schema.bookings.id, booking[0].id));
      }

      res.json({ message: "Bed deallocated successfully" });
    } catch (error: any) {
      console.error("Error deallocating bed:", error);
      res.status(500).json({ error: error.message || "Failed to deallocate bed" });
    }
  });

  // Get unassigned bookings (bookings without a bed) for a property
  app.get("/api/admin/properties/:id/unassigned-bookings", authMiddleware, roleMiddleware("admin", "receptionist"), async (req: AuthRequest, res) => {
    try {
      const propertyId = req.params.id;

      const scope = await getReceptionistScope(req);
      if (scope && !scope.has(propertyId)) {
        return res.status(403).json({ error: "Property not in your assignment scope" });
      }

      const unassigned = await db.select()
        .from(schema.bookings)
        .where(and(
          eq(schema.bookings.propertyId, propertyId),
          inArray(schema.bookings.status, ["confirmed", "active", "pending_payment", "pending_approval", "draft"]),
          or(
            isNull(schema.bookings.bedId),
            eq(schema.bookings.bedAllocated, false),
          ),
        ))
        .orderBy(sql`${schema.bookings.createdAt} DESC`);

      res.json(unassigned);
    } catch (error: any) {
      console.error("Error fetching unassigned bookings:", error);
      res.status(500).json({ error: error.message || "Failed to fetch unassigned bookings" });
    }
  });

  // ============ PACKAGE MANAGEMENT ============

  app.get("/api/admin/packages", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const category = req.query.category as string | undefined;
      const conditions = [];
      if (category && (category === "housing_plan" || category === "addon_service")) {
        conditions.push(eq(schema.packages.category, category));
      }
      const allPackages = conditions.length > 0
        ? await db.select().from(schema.packages).where(and(...conditions)).orderBy(sql`${schema.packages.createdAt} DESC`)
        : await db.select().from(schema.packages).orderBy(sql`${schema.packages.createdAt} DESC`);
      const result = [];
      for (const pkg of allPackages) {
        const items = await db.select().from(schema.packageItems).where(eq(schema.packageItems.packageId, pkg.id)).orderBy(schema.packageItems.sortOrder);
        let roomTypeName = null;
        if (pkg.roomTypeId) {
          const [rt] = await db.select().from(schema.roomTypes).where(eq(schema.roomTypes.id, pkg.roomTypeId));
          if (rt) roomTypeName = rt.customName || rt.name;
        }
        const linkedRoomTypeNames: string[] = [];
        const allLinkedIds: string[] = Array.isArray(pkg.linkedRoomTypeIds) ? pkg.linkedRoomTypeIds : (pkg.roomTypeId ? [pkg.roomTypeId] : []);
        for (const rtId of allLinkedIds) {
          const [rt] = await db.select().from(schema.roomTypes).where(eq(schema.roomTypes.id, rtId));
          if (rt) linkedRoomTypeNames.push(rt.customName || rt.name);
        }
        result.push({ ...pkg, items, roomTypeName, linkedRoomTypeNames });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch packages" });
    }
  });

  app.get("/api/admin/packages/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, req.params.id));
      if (!pkg) return res.status(404).json({ error: "Package not found" });
      const items = await db.select().from(schema.packageItems).where(eq(schema.packageItems.packageId, pkg.id)).orderBy(schema.packageItems.sortOrder);
      res.json({ ...pkg, items });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch package" });
    }
  });

  app.post("/api/admin/packages", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { items, ...packageData } = req.body;
      const [pkg] = await db.insert(schema.packages).values({
        propertyId: packageData.propertyId || null,
        roomTypeId: packageData.roomTypeId || null,
        category: packageData.category || "housing_plan",
        name: packageData.name,
        description: packageData.description || null,
        tagline: packageData.tagline || null,
        priceType: packageData.priceType || "PER_MONTH",
        basePrice: packageData.basePrice || 0,
        currency: packageData.currency || "INR",
        taxPercent: packageData.taxPercent || null,
        tierLevel: packageData.tierLevel ?? 0,
        isHighlighted: packageData.isHighlighted || false,
        occupancy: packageData.occupancy || null,
        locationInfo: packageData.locationInfo || null,
        upgradeDescription: packageData.upgradeDescription || null,
        upgradeFee: packageData.upgradeFee ?? null,
        validFrom: packageData.validFrom ? new Date(packageData.validFrom) : null,
        validTo: packageData.validTo ? new Date(packageData.validTo) : null,
        isActive: packageData.isActive !== false,
      }).returning();

      if (items && Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          await db.insert(schema.packageItems).values({
            packageId: pkg.id,
            type: item.type,
            label: item.label,
            featureValue: item.featureValue || null,
            includedQty: item.includedQty || 0,
            unit: item.unit || "unit",
            extraUnitPrice: item.extraUnitPrice || 0,
            rules: item.rules || null,
            isOptional: item.isOptional || false,
            maxQty: item.maxQty || null,
            sortOrder: i,
          });
        }
      }

      const savedItems = await db.select().from(schema.packageItems).where(eq(schema.packageItems.packageId, pkg.id)).orderBy(schema.packageItems.sortOrder);
      res.status(201).json({ ...pkg, items: savedItems });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create package" });
    }
  });

  app.put("/api/admin/packages/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { items, ...packageData } = req.body;
      const [existing] = await db.select().from(schema.packages).where(eq(schema.packages.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Package not found" });

      let newLinkedIds: string[] = Array.isArray(existing.linkedRoomTypeIds) ? [...existing.linkedRoomTypeIds] : [];
      if (existing.roomTypeId && !newLinkedIds.includes(existing.roomTypeId)) {
        newLinkedIds.push(existing.roomTypeId);
      }
      if (packageData.linkRoomTypeId) {
        if (!newLinkedIds.includes(packageData.linkRoomTypeId)) {
          newLinkedIds.push(packageData.linkRoomTypeId);
        }
      }
      if (packageData.unlinkRoomTypeId) {
        newLinkedIds = newLinkedIds.filter((id: string) => id !== packageData.unlinkRoomTypeId);
      }
      if (packageData.roomTypeId !== undefined) {
        if (packageData.roomTypeId) {
          if (!newLinkedIds.includes(packageData.roomTypeId)) {
            newLinkedIds.push(packageData.roomTypeId);
          }
        }
      }

      let newLinkedRoomIds: string[] = Array.isArray(existing.linkedRoomIds) ? [...existing.linkedRoomIds] : [];
      if (packageData.linkRoomId) {
        if (!newLinkedRoomIds.includes(packageData.linkRoomId)) {
          newLinkedRoomIds.push(packageData.linkRoomId);
        }
      }
      if (packageData.unlinkRoomId) {
        newLinkedRoomIds = newLinkedRoomIds.filter((id: string) => id !== packageData.unlinkRoomId);
      }

      let resolvedRoomTypeId = packageData.roomTypeId !== undefined ? (packageData.roomTypeId || null) : existing.roomTypeId;
      if (packageData.unlinkRoomTypeId && resolvedRoomTypeId === packageData.unlinkRoomTypeId) {
        resolvedRoomTypeId = newLinkedIds.length > 0 ? newLinkedIds[0] : null;
      }

      const [pkg] = await db.update(schema.packages).set({
        propertyId: packageData.propertyId ?? existing.propertyId,
        roomTypeId: resolvedRoomTypeId,
        linkedRoomTypeIds: newLinkedIds.length > 0 ? newLinkedIds : null,
        linkedRoomIds: newLinkedRoomIds.length > 0 ? newLinkedRoomIds : null,
        category: packageData.category ?? existing.category,
        name: packageData.name ?? existing.name,
        description: packageData.description !== undefined ? (packageData.description || null) : existing.description,
        tagline: packageData.tagline ?? existing.tagline,
        priceType: packageData.priceType || existing.priceType,
        basePrice: packageData.basePrice ?? existing.basePrice,
        currency: packageData.currency || existing.currency,
        taxPercent: packageData.taxPercent ?? existing.taxPercent,
        tierLevel: packageData.tierLevel ?? existing.tierLevel,
        isHighlighted: packageData.isHighlighted ?? existing.isHighlighted,
        occupancy: packageData.occupancy ?? existing.occupancy,
        locationInfo: packageData.locationInfo ?? existing.locationInfo,
        upgradeDescription: packageData.upgradeDescription ?? existing.upgradeDescription,
        upgradeFee: packageData.upgradeFee !== undefined ? packageData.upgradeFee : existing.upgradeFee,
        validFrom: packageData.validFrom !== undefined ? (packageData.validFrom ? new Date(packageData.validFrom) : null) : existing.validFrom,
        validTo: packageData.validTo !== undefined ? (packageData.validTo ? new Date(packageData.validTo) : null) : existing.validTo,
        isActive: packageData.isActive ?? existing.isActive,
        updatedAt: new Date(),
      }).where(eq(schema.packages.id, req.params.id)).returning();

      if (items && Array.isArray(items)) {
        await db.delete(schema.packageItems).where(eq(schema.packageItems.packageId, pkg.id));
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          await db.insert(schema.packageItems).values({
            packageId: pkg.id,
            type: item.type,
            label: item.label,
            featureValue: item.featureValue || null,
            includedQty: item.includedQty || 0,
            unit: item.unit || "unit",
            extraUnitPrice: item.extraUnitPrice || 0,
            rules: item.rules || null,
            isOptional: item.isOptional || false,
            maxQty: item.maxQty || null,
            sortOrder: i,
          });
        }
      }

      const savedItems = await db.select().from(schema.packageItems).where(eq(schema.packageItems.packageId, pkg.id)).orderBy(schema.packageItems.sortOrder);
      res.json({ ...pkg, items: savedItems });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update package" });
    }
  });

  app.delete("/api/admin/packages/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const forceDelete = req.query.force === "true";
      const attached = await db.select().from(schema.bookingPackages).where(and(eq(schema.bookingPackages.packageId, req.params.id), eq(schema.bookingPackages.status, "ACTIVE")));
      if (attached.length > 0 && !forceDelete) {
        return res.status(400).json({ error: `This plan has ${attached.length} active booking attachment(s). Use force delete to end them and remove the plan.`, attachmentCount: attached.length });
      }
      if (attached.length > 0 && forceDelete) {
        await db.update(schema.bookingPackages).set({ status: "ENDED", endDate: new Date() }).where(and(eq(schema.bookingPackages.packageId, req.params.id), eq(schema.bookingPackages.status, "ACTIVE")));
      }
      await db.delete(schema.bookingPackages).where(eq(schema.bookingPackages.packageId, req.params.id));
      await db.delete(schema.packageUpgrades).where(or(eq(schema.packageUpgrades.fromPackageId, req.params.id), eq(schema.packageUpgrades.toPackageId, req.params.id)));
      await db.delete(schema.packageItems).where(eq(schema.packageItems.packageId, req.params.id));
      await db.delete(schema.packages).where(eq(schema.packages.id, req.params.id));
      res.json({ success: true, endedAttachments: attached.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete package" });
    }
  });

  app.post("/api/admin/packages/:id/duplicate", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [original] = await db.select().from(schema.packages).where(eq(schema.packages.id, req.params.id));
      if (!original) return res.status(404).json({ error: "Package not found" });
      const items = await db.select().from(schema.packageItems).where(eq(schema.packageItems.packageId, original.id)).orderBy(schema.packageItems.sortOrder);

      const [newPkg] = await db.insert(schema.packages).values({
        propertyId: original.propertyId,
        category: original.category,
        name: `${original.name} (Copy)`,
        description: original.description,
        tagline: original.tagline,
        priceType: original.priceType,
        basePrice: original.basePrice,
        currency: original.currency,
        taxPercent: original.taxPercent,
        tierLevel: original.tierLevel,
        isHighlighted: false,
        occupancy: original.occupancy,
        locationInfo: original.locationInfo,
        validFrom: original.validFrom,
        validTo: original.validTo,
        isActive: false,
      }).returning();

      for (let i = 0; i < items.length; i++) {
        await db.insert(schema.packageItems).values({
          packageId: newPkg.id,
          type: items[i].type,
          label: items[i].label,
          featureValue: items[i].featureValue,
          includedQty: items[i].includedQty,
          unit: items[i].unit,
          extraUnitPrice: items[i].extraUnitPrice,
          rules: items[i].rules,
          isOptional: items[i].isOptional,
          maxQty: items[i].maxQty,
          sortOrder: i,
        });
      }

      const newItems = await db.select().from(schema.packageItems).where(eq(schema.packageItems.packageId, newPkg.id)).orderBy(schema.packageItems.sortOrder);
      res.status(201).json({ ...newPkg, items: newItems });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to duplicate package" });
    }
  });

  app.post("/api/admin/packages/:id/toggle", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, req.params.id));
      if (!pkg) return res.status(404).json({ error: "Package not found" });
      const [updated] = await db.update(schema.packages).set({ isActive: !pkg.isActive, updatedAt: new Date() }).where(eq(schema.packages.id, req.params.id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to toggle package" });
    }
  });

  app.get("/api/plans/featured", async (_req, res) => {
    try {
      const allPlans = await db.select().from(schema.packages)
        .where(and(eq(schema.packages.isActive, true), eq(schema.packages.category, "housing_plan")))
        .orderBy(schema.packages.tierLevel);
      if (allPlans.length === 0) return res.json([]);
      const planIds = allPlans.map(p => p.id);
      const propertyIds = [...new Set(allPlans.map(p => p.propertyId).filter(Boolean))] as string[];
      const [allItems, allProps] = await Promise.all([
        db.select().from(schema.packageItems)
          .where(inArray(schema.packageItems.packageId, planIds))
          .orderBy(schema.packageItems.sortOrder),
        propertyIds.length > 0
          ? db.select({ id: schema.properties.id, name: schema.properties.name, displayName: schema.properties.displayName, slug: schema.properties.slug })
              .from(schema.properties).where(inArray(schema.properties.id, propertyIds))
          : Promise.resolve([]),
      ]);
      const itemsByPlan: Record<string, typeof allItems> = {};
      for (const item of allItems) {
        if (!itemsByPlan[item.packageId]) itemsByPlan[item.packageId] = [];
        itemsByPlan[item.packageId].push(item);
      }
      const propsMap: Record<string, typeof allProps[0]> = {};
      for (const p of allProps) propsMap[p.id] = p;
      const result = allPlans.map(plan => ({
        ...plan,
        items: itemsByPlan[plan.id] || [],
        propertyName: plan.propertyId && propsMap[plan.propertyId]
          ? (propsMap[plan.propertyId].displayName || propsMap[plan.propertyId].name)
          : null,
        propertySlug: plan.propertyId && propsMap[plan.propertyId]
          ? propsMap[plan.propertyId].slug
          : null,
      }));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch featured plans" });
    }
  });

  app.get("/api/properties/:propertyId/plans", async (req, res) => {
    try {
      const prop = await storage.getPropertyByIdOrSlug(req.params.propertyId);
      const resolvedId = prop?.id || req.params.propertyId;
      const plans = await db.select().from(schema.packages)
        .where(and(
          eq(schema.packages.propertyId, resolvedId),
          eq(schema.packages.isActive, true),
          eq(schema.packages.category, "housing_plan")
        ))
        .orderBy(schema.packages.tierLevel);

      const result = [];
      for (const plan of plans) {
        const items = await db.select().from(schema.packageItems)
          .where(eq(schema.packageItems.packageId, plan.id))
          .orderBy(schema.packageItems.sortOrder);
        let roomTypeName = null;

        if (plan.roomTypeId) {
          const [rt] = await db.select().from(schema.roomTypes).where(eq(schema.roomTypes.id, plan.roomTypeId));
          if (rt) roomTypeName = rt.customName || rt.name;
        }

        result.push({ ...plan, items, roomTypeName });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch property plans" });
    }
  });

  app.get("/api/properties/:propertyId/addon-services", async (req, res) => {
    try {
      const services = await db.select().from(schema.packages)
        .where(and(
          eq(schema.packages.propertyId, req.params.propertyId),
          eq(schema.packages.isActive, true),
          eq(schema.packages.category, "addon_service")
        ))
        .orderBy(schema.packages.createdAt);
      const result = [];
      for (const svc of services) {
        const items = await db.select().from(schema.packageItems)
          .where(eq(schema.packageItems.packageId, svc.id))
          .orderBy(schema.packageItems.sortOrder);
        result.push({ ...svc, items });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch addon services" });
    }
  });

  app.get("/api/admin/bookings/:bookingId/packages", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const bps = await db.select().from(schema.bookingPackages).where(eq(schema.bookingPackages.bookingId, req.params.bookingId)).orderBy(sql`${schema.bookingPackages.createdAt} DESC`);
      const result = [];
      for (const bp of bps) {
        const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, bp.packageId));
        const items = await db.select().from(schema.packageItems).where(eq(schema.packageItems.packageId, bp.packageId)).orderBy(schema.packageItems.sortOrder);
        const usage = await db.select().from(schema.packageUsage).where(eq(schema.packageUsage.bookingPackageId, bp.id)).orderBy(sql`${schema.packageUsage.createdAt} DESC`);
        result.push({ ...bp, package: pkg ? { ...pkg, items } : null, usage });
      }

      const walletEntries = await db.select().from(schema.walletLedger).where(eq(schema.walletLedger.bookingId, req.params.bookingId)).orderBy(sql`${schema.walletLedger.createdAt} DESC`);
      const walletBalance = walletEntries.reduce((acc, e) => acc + e.credit - e.debit, 0);

      res.json({ bookingPackages: result, wallet: { balance: walletBalance, entries: walletEntries } });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch booking packages" });
    }
  });

  app.post("/api/admin/bookings/:bookingId/packages/attach", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { packageId, startDate, endDate, selectedItems } = req.body;
      if (!packageId || !startDate) return res.status(400).json({ error: "packageId and startDate are required" });

      const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, packageId));
      if (!pkg) return res.status(404).json({ error: "Package not found" });
      if (!pkg.isActive) return res.status(400).json({ error: "Cannot attach an inactive package" });

      const items = await db.select().from(schema.packageItems).where(eq(schema.packageItems.packageId, packageId)).orderBy(schema.packageItems.sortOrder);
      const base = Number(pkg.basePrice) || 0;
      let totalPrice = base;
      if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        if (e > s) {
          const diffDays = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
          if (pkg.priceType === "PER_DAY") {
            totalPrice = base * diffDays;
          } else if (pkg.priceType === "PER_MONTH") {
            const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) || 1;
            totalPrice = base * months;
          } else if (pkg.priceType === "PER_YEAR") {
            const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) || 1;
            const monthlyRate = base / 11;
            totalPrice = monthlyRate * months;
          }
        }
      }
      const priceSnapshot = { name: pkg.name, basePrice: pkg.basePrice, totalPrice: Math.round(totalPrice), priceType: pkg.priceType, taxPercent: pkg.taxPercent, category: pkg.category, items: items.map(i => ({ type: i.type, label: i.label, includedQty: i.includedQty, unit: i.unit, extraUnitPrice: i.extraUnitPrice, rules: i.rules })) };

      const [bp] = await db.insert(schema.bookingPackages).values({
        bookingId: req.params.bookingId,
        packageId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: "ACTIVE",
        priceSnapshot,
        selectedItems: selectedItems || null,
      }).returning();

      const alacartItem = items.find(i => i.type === "ala_cart_credit");
      if (alacartItem && alacartItem.includedQty > 0) {
        await db.insert(schema.walletLedger).values({
          bookingId: req.params.bookingId,
          credit: alacartItem.includedQty,
          debit: 0,
          refType: "package_credit",
          refId: bp.id,
          note: `Initial credit from package "${pkg.name}"`,
        });
      }

      autoResyncBookingToHms(req.params.bookingId, "package-attach");
      res.status(201).json(bp);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to attach package" });
    }
  });

  app.patch("/api/admin/bookings/:bookingId/packages/:bookingPackageId", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { bookingId, bookingPackageId } = req.params;
      const {
        includeInTotal,
        displayPriceOverride,
        paidStatus,
        paidAmount,
        paymentMethod,
        paymentReference,
      } = req.body ?? {};

      const updates: Partial<{
        includeInTotal: boolean;
        displayPriceOverride: number | null;
        paidStatus: string;
        paidAmount: number;
        paidAt: Date | null;
        paymentMethod: string | null;
        paymentReference: string | null;
      }> = {};

      if (includeInTotal !== undefined) {
        if (typeof includeInTotal !== "boolean") {
          return res.status(400).json({ error: "includeInTotal must be a boolean" });
        }
        updates.includeInTotal = includeInTotal;
      }

      if (displayPriceOverride !== undefined) {
        if (displayPriceOverride === null || displayPriceOverride === "") {
          updates.displayPriceOverride = null;
        } else {
          const n = Number(displayPriceOverride);
          if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
            return res.status(400).json({ error: "displayPriceOverride must be a non-negative number up to 100000000" });
          }
          updates.displayPriceOverride = Math.round(n);
        }
      }

      if (paidStatus !== undefined) {
        if (paidStatus !== "pending" && paidStatus !== "paid") {
          return res.status(400).json({ error: "paidStatus must be 'pending' or 'paid'" });
        }
        updates.paidStatus = paidStatus;
        if (paidStatus === "paid") {
          updates.paidAt = new Date();
        } else {
          updates.paidAt = null;
          updates.paidAmount = 0;
          updates.paymentMethod = null;
          updates.paymentReference = null;
        }
      }

      if (paidAmount !== undefined && paidAmount !== null && paidAmount !== "") {
        const n = Number(paidAmount);
        if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
          return res.status(400).json({ error: "paidAmount must be a non-negative number up to 100000000" });
        }
        updates.paidAmount = Math.round(n);
      }

      if (paymentMethod !== undefined) {
        if (paymentMethod === null || paymentMethod === "") {
          updates.paymentMethod = null;
        } else if (typeof paymentMethod === "string" && paymentMethod.length <= 32) {
          updates.paymentMethod = paymentMethod;
        } else {
          return res.status(400).json({ error: "paymentMethod must be a short string" });
        }
      }

      if (paymentReference !== undefined) {
        if (paymentReference === null || paymentReference === "") {
          updates.paymentReference = null;
        } else if (typeof paymentReference === "string" && paymentReference.length <= 128) {
          updates.paymentReference = paymentReference;
        } else {
          return res.status(400).json({ error: "paymentReference must be a string up to 128 chars" });
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "Nothing to update" });
      }

      const [bp] = await db.select().from(schema.bookingPackages).where(eq(schema.bookingPackages.id, bookingPackageId));
      if (!bp) return res.status(404).json({ error: "Booking package not found" });
      if (bp.bookingId !== bookingId) return res.status(400).json({ error: "Package does not belong to this booking" });

      const onlyPaymentFields = Object.keys(updates).every((k) =>
        ["paidStatus", "paidAmount", "paidAt", "paymentMethod", "paymentReference"].includes(k),
      );
      if (bp.status !== "ACTIVE" && !onlyPaymentFields) {
        return res.status(400).json({ error: "Cannot edit an ended package" });
      }

      const [updated] = await db.update(schema.bookingPackages)
        .set(updates)
        .where(eq(schema.bookingPackages.id, bookingPackageId))
        .returning();

      autoResyncBookingToHms(req.params.bookingId, "package-update");
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update booking package" });
    }
  });

  app.post("/api/admin/bookings/:bookingId/packages/detach", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { bookingPackageId } = req.body;
      if (!bookingPackageId) return res.status(400).json({ error: "bookingPackageId is required" });
      const [bp] = await db.select().from(schema.bookingPackages).where(eq(schema.bookingPackages.id, bookingPackageId));
      if (!bp) return res.status(404).json({ error: "Booking package not found" });
      if (bp.bookingId !== req.params.bookingId) return res.status(400).json({ error: "Package does not belong to this booking" });
      if (bp.status !== "ACTIVE") return res.status(400).json({ error: "Package is already ended" });
      const [updated] = await db.update(schema.bookingPackages).set({ status: "ENDED", endDate: new Date() }).where(eq(schema.bookingPackages.id, bookingPackageId)).returning();
      autoResyncBookingToHms(req.params.bookingId, "package-detach");
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to detach package" });
    }
  });

  app.post("/api/admin/bookings/:bookingId/packages/usage", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { bookingPackageId, itemType, qtyUsed, note } = req.body;
      if (!bookingPackageId || !itemType) return res.status(400).json({ error: "bookingPackageId and itemType are required" });

      const [bp] = await db.select().from(schema.bookingPackages).where(eq(schema.bookingPackages.id, bookingPackageId));
      if (!bp) return res.status(404).json({ error: "Booking package not found" });
      if (bp.bookingId !== req.params.bookingId) return res.status(400).json({ error: "Package does not belong to this booking" });
      if (bp.status !== "ACTIVE") return res.status(400).json({ error: "Cannot record usage on an ended package" });

      const items = await db.select().from(schema.packageItems).where(and(eq(schema.packageItems.packageId, bp.packageId), eq(schema.packageItems.type, itemType)));
      const item = items[0];
      if (!item) return res.status(400).json({ error: `Invalid item type "${itemType}" for this package` });

      const existingUsage = await db.select().from(schema.packageUsage).where(and(eq(schema.packageUsage.bookingPackageId, bookingPackageId), eq(schema.packageUsage.itemType, itemType)));
      const totalUsed = existingUsage.reduce((s, u) => s + u.qtyUsed, 0);
      const qty = qtyUsed || 1;
      let amountCharged = 0;

      if (item) {
        const includedQty = item.includedQty || 0;
        const excessQty = Math.max(0, (totalUsed + qty) - includedQty);
        const prevExcess = Math.max(0, totalUsed - includedQty);
        const newChargeableQty = excessQty - prevExcess;
        if (newChargeableQty > 0) {
          amountCharged = newChargeableQty * (item.extraUnitPrice || 0);
        }
      }

      const [usageRecord] = await db.insert(schema.packageUsage).values({
        bookingPackageId,
        bookingId: req.params.bookingId,
        itemType,
        qtyUsed: qty,
        amountCharged,
        note: note || null,
      }).returning();

      res.status(201).json(usageRecord);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to record usage" });
    }
  });

  app.post("/api/admin/bookings/:bookingId/wallet/topup", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { amount, note } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ error: "Valid amount required" });
      const [entry] = await db.insert(schema.walletLedger).values({
        bookingId: req.params.bookingId,
        credit: amount,
        debit: 0,
        refType: "manual_topup",
        note: note || "Manual top-up",
      }).returning();
      autoResyncBookingToHms(req.params.bookingId, "wallet-topup");
      res.status(201).json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to top up wallet" });
    }
  });

  app.post("/api/admin/bookings/:bookingId/wallet/debit", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { amount, note } = req.body;
      if (!amount || amount <= 0) return res.status(400).json({ error: "Valid amount required" });
      const entries = await db.select().from(schema.walletLedger).where(eq(schema.walletLedger.bookingId, req.params.bookingId));
      const balance = entries.reduce((acc, e) => acc + e.credit - e.debit, 0);
      if (amount > balance) return res.status(400).json({ error: "Insufficient wallet balance" });
      const [entry] = await db.insert(schema.walletLedger).values({
        bookingId: req.params.bookingId,
        credit: 0,
        debit: amount,
        refType: "manual_debit",
        note: note || "Manual debit",
      }).returning();
      autoResyncBookingToHms(req.params.bookingId, "wallet-debit");
      res.status(201).json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to debit wallet" });
    }
  });

  app.post("/api/admin/bookings/:bookingId/wallet/sync-package-credits", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const bookingId = req.params.bookingId;
      const activeBPs = await db.select().from(schema.bookingPackages).where(
        and(eq(schema.bookingPackages.bookingId, bookingId), eq(schema.bookingPackages.status, "ACTIVE"))
      );
      if (activeBPs.length === 0) return res.status(400).json({ error: "No active packages found" });

      const existingCredits = await db.select().from(schema.walletLedger).where(
        and(eq(schema.walletLedger.bookingId, bookingId), eq(schema.walletLedger.refType, "package_credit"))
      );
      const creditedBpIds = new Set(existingCredits.map(c => c.refId).filter(Boolean));

      let totalCredited = 0;
      for (const bp of activeBPs) {
        if (creditedBpIds.has(bp.id)) continue;
        if (!bp.packageId) continue;

        const items = await db.select().from(schema.packageItems).where(eq(schema.packageItems.packageId, bp.packageId));
        const alacartItem = items.find(i => i.type === "ala_cart_credit" && i.includedQty > 0);
        if (alacartItem) {
          const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, bp.packageId));
          await db.insert(schema.walletLedger).values({
            bookingId,
            credit: alacartItem.includedQty,
            debit: 0,
            refType: "package_credit",
            refId: bp.id,
            note: `Synced credit from package "${pkg?.name || "Unknown"}"`,
          });
          totalCredited += alacartItem.includedQty;
        }
      }

      res.json({ success: true, totalCredited, message: totalCredited > 0 ? `Credited ${totalCredited} to wallet` : "No missing credits found" });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to sync wallet credits" });
    }
  });

  // ============ PACKAGE UPGRADE ============

  app.get("/api/admin/bookings/:bookingId/packages/upgrade-options", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const result = await storage.getPackageUpgradeOptions(req.params.bookingId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch upgrade options" });
    }
  });

  app.post("/api/admin/bookings/:bookingId/packages/upgrade", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { targetPackageId, reason } = req.body;
      if (!targetPackageId) return res.status(400).json({ error: "targetPackageId is required" });

      const result = await storage.upgradeBookingPackage(
        req.params.bookingId,
        targetPackageId,
        req.user!.id,
        reason
      );

      await logActivity({
        actor: {
          id: req.user!.id,
          name: req.user!.name || req.user!.email,
          role: req.user!.role || "admin",
        },
        actionType: "UPDATE" as ActionType,
        entityType: "BOOKING" as EntityType,
        entityId: req.params.bookingId,
        entityLabel: `Package upgrade: ${result.previousPackage.name} → ${result.newPackage.name}`,
        metadata: {
          upgradeType: "package_upgrade",
          fromPackageId: result.previousPackage.id,
          toPackageId: result.newPackage.id,
          priceDifference: result.priceDifference,
          reason: reason || null,
        },
      });

      const upgradedBooking = await storage.getBooking(req.params.bookingId);
      if (upgradedBooking) {
        autoSyncBookingToHMS(upgradedBooking).catch(err => {
          console.error("[HMS Auto-Sync] Background sync after package upgrade failed:", err);
        });
      }

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to upgrade package" });
    }
  });

  app.get("/api/admin/bookings/:bookingId/packages/upgrade-history", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const history = await storage.getUpgradeHistory(req.params.bookingId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch upgrade history" });
    }
  });

  // ============ SEASON / BATCH MANAGEMENT ============

  const insertSeasonBodySchema = z.object({
    name: z.string().min(1),
    startDate: z.string(),
    endDate: z.string(),
    graceDays: z.number().int().min(0).optional().default(30),
    status: z.enum(["UPCOMING", "ACTIVE", "ENDED"]).optional().default("UPCOMING"),
    nextSeasonId: z.string().nullable().optional(),
  });

  app.get("/api/admin/seasons", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const allSeasons = await db.select().from(schema.seasons).orderBy(sql`${schema.seasons.startDate} DESC`);
      res.json(allSeasons);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch seasons" });
    }
  });

  app.post("/api/admin/seasons", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const parsed = insertSeasonBodySchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid season data", details: parsed.error.format() });

      const { name, startDate, endDate, graceDays, status, nextSeasonId } = parsed.data;
      const propertyId = req.body.propertyId || null;

      if (new Date(startDate) >= new Date(endDate)) {
        return res.status(400).json({ error: "Start date must be before end date" });
      }

      if (status === "ACTIVE") {
        const activeConds: any[] = [eq(schema.seasons.status, "ACTIVE")];
        if (propertyId) activeConds.push(eq(schema.seasons.propertyId, propertyId));
        const existing = await db.select().from(schema.seasons).where(and(...activeConds));
        if (existing.length > 0) {
          return res.status(400).json({ error: "Only one season can be ACTIVE at a time for this property. End the current active season first." });
        }
      }

      const [season] = await db.insert(schema.seasons).values({
        name,
        propertyId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        graceDays: graceDays ?? 30,
        status: status ?? "UPCOMING",
        nextSeasonId: nextSeasonId ?? null,
      }).returning();

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "CREATE",
        entityType: "BOOKING",
        entityId: season.id,
        entityLabel: `Season: ${season.name}`,
        metadata: { seasonName: season.name, status: season.status },
      });

      res.status(201).json(season);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create season" });
    }
  });

  app.put("/api/admin/seasons/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [existing] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Season not found" });

      const updateData: any = { updatedAt: new Date() };
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.startDate !== undefined) updateData.startDate = new Date(req.body.startDate);
      if (req.body.endDate !== undefined) updateData.endDate = new Date(req.body.endDate);
      if (req.body.graceDays !== undefined) updateData.graceDays = req.body.graceDays;
      if (req.body.nextSeasonId !== undefined) updateData.nextSeasonId = req.body.nextSeasonId;
      if (req.body.propertyId !== undefined) updateData.propertyId = req.body.propertyId || null;

      const [updated] = await db.update(schema.seasons).set(updateData).where(eq(schema.seasons.id, req.params.id)).returning();

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "UPDATE",
        entityType: "BOOKING",
        entityId: updated.id,
        entityLabel: `Season: ${updated.name}`,
        metadata: { changes: Object.keys(updateData) },
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update season" });
    }
  });

  app.delete("/api/admin/seasons/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [existing] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Season not found" });
      if (existing.status !== "UPCOMING") return res.status(400).json({ error: "Only UPCOMING seasons can be deleted" });

      const jobs = await db.select().from(schema.seasonCloseJobs).where(eq(schema.seasonCloseJobs.seasonId, req.params.id));
      if (jobs.length > 0) return res.status(400).json({ error: "Cannot delete season with existing close jobs" });

      await db.delete(schema.seasons).where(eq(schema.seasons.id, req.params.id));

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "DELETE",
        entityType: "BOOKING",
        entityId: existing.id,
        entityLabel: `Season: ${existing.name}`,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete season" });
    }
  });

  app.post("/api/admin/seasons/:id/activate", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [existing] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Season not found" });

      const activeConds = [eq(schema.seasons.status, "ACTIVE")];
      if (existing.propertyId) {
        activeConds.push(eq(schema.seasons.propertyId, existing.propertyId));
      }
      const activeSeasons = await db.select().from(schema.seasons).where(and(...activeConds));
      for (const active of activeSeasons) {
        if (active.id !== req.params.id) {
          await db.update(schema.seasons).set({ status: "ENDED", updatedAt: new Date() }).where(eq(schema.seasons.id, active.id));
        }
      }

      const [activated] = await db.update(schema.seasons).set({ status: "ACTIVE", updatedAt: new Date() }).where(eq(schema.seasons.id, req.params.id)).returning();

      const bookingConds: any[] = [inArray(schema.bookings.status, ["active", "confirmed", "pending_payment"])];
      if (activated.propertyId) {
        bookingConds.push(eq(schema.bookings.propertyId, activated.propertyId));
      }
      const activeBookings = await db.select().from(schema.bookings)
        .where(and(...bookingConds));

      const existingStatuses = await db.select().from(schema.residentSeasonStatus)
        .where(eq(schema.residentSeasonStatus.seasonId, req.params.id));
      const existingBookingIds = new Set(existingStatuses.map(s => s.bookingId));

      let autoLinked = 0;
      for (const booking of activeBookings) {
        if (!existingBookingIds.has(booking.id)) {
          const graceDays = activated.graceDays || 30;
          const graceUntil = new Date(activated.endDate);
          graceUntil.setDate(graceUntil.getDate() + graceDays);
          const isRegistered = !!(booking.studentId || booking.walkInName || (booking.residentDetails as any)?.fullName);
          await db.insert(schema.residentSeasonStatus).values({
            bookingId: booking.id,
            seasonId: req.params.id,
            status: isRegistered ? "RETAINED" : "PENDING",
            graceUntil,
          });
          autoLinked++;
        }
      }

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "STATUS_CHANGE",
        entityType: "BOOKING",
        entityId: activated.id,
        entityLabel: `Season: ${activated.name}`,
        metadata: { from: existing.status, to: "ACTIVE", endedSeasons: activeSeasons.map(s => s.name), autoLinkedResidents: autoLinked },
      });

      res.json({ ...activated, autoLinkedResidents: autoLinked });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to activate season" });
    }
  });

  app.post("/api/admin/seasons/:id/end", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [existing] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Season not found" });

      const [ended] = await db.update(schema.seasons).set({ status: "ENDED", updatedAt: new Date() }).where(eq(schema.seasons.id, req.params.id)).returning();

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "STATUS_CHANGE",
        entityType: "BOOKING",
        entityId: ended.id,
        entityLabel: `Season: ${ended.name}`,
        metadata: { from: existing.status, to: "ENDED" },
      });

      res.json(ended);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to end season" });
    }
  });

  app.post("/api/admin/seasons/:id/sync-residents", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, req.params.id));
      if (!season) return res.status(404).json({ error: "Season not found" });

      const bookingConds: any[] = [inArray(schema.bookings.status, ["active", "confirmed", "pending_payment"])];
      if (season.propertyId) {
        bookingConds.push(eq(schema.bookings.propertyId, season.propertyId));
      }
      const activeBookings = await db.select().from(schema.bookings)
        .where(and(...bookingConds));

      const existingStatuses = await db.select().from(schema.residentSeasonStatus)
        .where(eq(schema.residentSeasonStatus.seasonId, req.params.id));
      const existingBookingIds = new Set(existingStatuses.map(s => s.bookingId));

      let added = 0;
      let retainedCount = 0;
      for (const booking of activeBookings) {
        if (existingBookingIds.has(booking.id)) continue;

        const isRegisteredResident = booking.customerType === "student";
        const status = isRegisteredResident ? "RETAINED" : "PENDING";
        if (isRegisteredResident) retainedCount++;

        const graceDays = season.graceDays || 30;
        const graceUntil = new Date(season.endDate);
        graceUntil.setDate(graceUntil.getDate() + graceDays);
        await db.insert(schema.residentSeasonStatus).values({
          bookingId: booking.id,
          seasonId: req.params.id,
          status,
          graceUntil,
        });
        added++;
      }

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "UPDATE",
        entityType: "BOOKING",
        entityId: season.id,
        entityLabel: `Sync residents for ${season.name}`,
        metadata: { seasonId: season.id, addedResidents: added, retainedCount, totalBookings: activeBookings.length },
      });

      res.json({ success: true, added, retained: retainedCount, total: existingStatuses.length + added });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to sync residents" });
    }
  });

  app.post("/api/admin/seasons/:id/sync-to-hms", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, req.params.id));
      if (!season) return res.status(404).json({ error: "Season not found" });
      if (!season.propertyId) return res.status(400).json({ error: "Season has no property assigned" });

      const [property] = await db.select().from(schema.properties).where(eq(schema.properties.id, season.propertyId));
      if (!property) return res.status(404).json({ error: "Property not found" });
      if (!property.hmsLinked || !property.hmsPropertyId) {
        return res.status(400).json({ error: "Property is not linked to HMS. Link it first in HMS Sync page." });
      }

      const activeBookings = await db.select({
        id: schema.bookings.id,
        bookingCode: schema.bookings.bookingCode,
        status: schema.bookings.status,
        walkInName: schema.bookings.walkInName,
        walkInPhone: schema.bookings.walkInPhone,
        residentDetails: schema.bookings.residentDetails,
        studentId: schema.bookings.studentId,
        studentFullName: schema.students.fullName,
        studentPhone: schema.students.phone,
        studentEmail: schema.students.email,
        studentCollege: schema.students.collegeName,
        studentCourse: schema.students.course,
        studentYear: schema.students.year,
      })
        .from(schema.bookings)
        .leftJoin(schema.students, eq(schema.bookings.studentId, schema.students.id))
        .where(and(
          eq(schema.bookings.propertyId, season.propertyId),
          inArray(schema.bookings.status, ["active", "confirmed", "pending_payment"])
        ));

      if (activeBookings.length === 0) {
        await db.update(schema.seasons).set({
          hmsSyncStatus: "synced",
          hmsSyncedAt: new Date(),
          hmsSyncedBookingCount: 0,
          hmsSyncResults: { synced: 0, notMatched: 0, failed: 0, message: "No active bookings to sync" },
          updatedAt: new Date(),
        }).where(eq(schema.seasons.id, req.params.id));
        return res.json({ synced: 0, notMatched: 0, failed: 0, total: 0, message: "No active bookings to sync" });
      }

      if (!process.env.HMS_API_KEY) {
        try { await getHostelFlowJWT(); } catch (loginErr: any) {
          return res.status(502).json({ error: "Failed to authenticate with HMS: " + loginErr.message });
        }
      }

      let hmsResidents: any[] = [];
      try {
        let hmsRes = await fetch(`${HOSTEL_FLOW_BASE_URL}/api/residents?propertyId=${property.hmsPropertyId}`, {
          headers: getHMSAuthHeaders(),
        });
        if (hmsRes.status === 401 && !process.env.HMS_API_KEY) {
          cachedHostelFlowJWT = null;
          jwtExpiresAt = 0;
          await getHostelFlowJWT();
          hmsRes = await fetch(`${HOSTEL_FLOW_BASE_URL}/api/residents?propertyId=${property.hmsPropertyId}`, {
            headers: getHMSAuthHeaders(),
          });
        }
        if (!hmsRes.ok) throw new Error(`HMS API returned ${hmsRes.status}`);
        const hmsData = await hmsRes.json();
        hmsResidents = Array.isArray(hmsData) ? hmsData : (hmsData as any).residents || (hmsData as any).data || [];
      } catch (hmsErr: any) {
        await db.update(schema.seasons).set({
          hmsSyncStatus: "failed",
          hmsSyncedAt: new Date(),
          hmsSyncResults: { error: "Failed to fetch HMS residents: " + hmsErr.message },
          updatedAt: new Date(),
        }).where(eq(schema.seasons.id, req.params.id));
        return res.status(502).json({ error: "Failed to fetch HMS residents: " + hmsErr.message });
      }

      function normalizePhone(phone: string | null | undefined): string {
        if (!phone) return "";
        let cleaned = phone.replace(/[\s\-\(\)]/g, "");
        if (cleaned.startsWith("+91")) cleaned = cleaned.slice(3);
        else if (cleaned.startsWith("91") && cleaned.length > 10) cleaned = cleaned.slice(2);
        else if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
        return cleaned.slice(-10);
      }

      const hmsPhoneMap = new Map<string, any>();
      const hmsEmailMap = new Map<string, any>();
      for (const r of hmsResidents) {
        const phone = normalizePhone(r.phone);
        if (phone) hmsPhoneMap.set(phone, r);
        if (r.email) hmsEmailMap.set(r.email.toLowerCase().trim(), r);
      }

      const syncedDetails: any[] = [];
      const notMatchedDetails: any[] = [];
      const failedDetails: any[] = [];

      for (const booking of activeBookings) {
        const rd = booking.residentDetails as any;
        const name = booking.studentFullName || rd?.fullName || rd?.name || booking.walkInName || booking.bookingCode || "Unknown";
        const phone = booking.studentPhone || booking.walkInPhone || rd?.phone;
        const email = booking.studentEmail || rd?.email;
        const college = booking.studentCollege || rd?.college || rd?.instituteName;
        const roomNo = rd?.roomNo || rd?.room;

        const normalizedPhone = normalizePhone(phone);
        let matchedResident = normalizedPhone ? hmsPhoneMap.get(normalizedPhone) : null;
        if (!matchedResident && email) {
          matchedResident = hmsEmailMap.get(email.toLowerCase().trim());
        }

        if (!matchedResident) {
          notMatchedDetails.push({
            bookingCode: booking.bookingCode,
            name,
            phone: phone || "N/A",
            email: email || "N/A",
            reason: "No matching HMS resident found by phone or email",
          });
          continue;
        }

        const syncPayload = {
          residentId: matchedResident.id,
          seasonAccess: "FULL",
          bookingCode: booking.bookingCode,
          bookingStatus: booking.status,
          seasonName: season.name,
          seasonStartDate: season.startDate,
          seasonEndDate: season.endDate,
          syncedAt: new Date().toISOString(),
          residentDetails: {
            name,
            phone: phone || null,
            email: email || null,
            college: college || null,
            room: roomNo || matchedResident.room || null,
            course: booking.studentCourse || rd?.course || null,
            year: booking.studentYear || rd?.year || null,
          },
        };

        try {
          const syncRes = await fetch(`${HOSTEL_FLOW_BASE_URL}/api/crm/season-sync`, {
            method: "POST",
            headers: getHMSAuthHeaders(),
            body: JSON.stringify(syncPayload),
          });

          if (syncRes.ok) {
            const syncResult = await syncRes.json();
            syncedDetails.push({
              bookingCode: booking.bookingCode,
              name,
              hmsResidentId: matchedResident.id,
              hmsResidentName: matchedResident.name,
              response: syncResult,
            });
          } else {
            const errText = await syncRes.text();
            failedDetails.push({
              bookingCode: booking.bookingCode,
              name,
              hmsResidentId: matchedResident.id,
              error: `HMS returned ${syncRes.status}: ${errText}`,
            });
          }
        } catch (syncErr: any) {
          failedDetails.push({
            bookingCode: booking.bookingCode,
            name,
            hmsResidentId: matchedResident.id,
            error: syncErr.message || "Network error",
          });
        }
      }

      const syncStatus = failedDetails.length === 0 && notMatchedDetails.length === 0
        ? "synced"
        : syncedDetails.length === 0
          ? "failed"
          : "partial";

      const results = {
        synced: syncedDetails.length,
        notMatched: notMatchedDetails.length,
        failed: failedDetails.length,
        total: activeBookings.length,
        syncedDetails,
        notMatchedDetails,
        failedDetails,
      };

      await db.update(schema.seasons).set({
        hmsSyncStatus: syncStatus,
        hmsSyncedAt: new Date(),
        hmsSyncedBookingCount: syncedDetails.length,
        hmsSyncResults: results,
        updatedAt: new Date(),
      }).where(eq(schema.seasons.id, req.params.id));

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "UPDATE",
        entityType: "BOOKING",
        entityId: season.id,
        entityLabel: `HMS Season Sync for ${season.name}`,
        metadata: { synced: syncedDetails.length, notMatched: notMatchedDetails.length, failed: failedDetails.length, total: activeBookings.length },
      });

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to sync to HMS" });
    }
  });

  app.get("/api/admin/seasons/:id/residents", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const residents = await db.select({
        id: schema.residentSeasonStatus.id,
        bookingId: schema.residentSeasonStatus.bookingId,
        seasonId: schema.residentSeasonStatus.seasonId,
        status: schema.residentSeasonStatus.status,
        graceUntil: schema.residentSeasonStatus.graceUntil,
        decisionReason: schema.residentSeasonStatus.decisionReason,
        updatedBy: schema.residentSeasonStatus.updatedBy,
        createdAt: schema.residentSeasonStatus.createdAt,
        updatedAt: schema.residentSeasonStatus.updatedAt,
        bookingCode: schema.bookings.bookingCode,
        walkInName: schema.bookings.walkInName,
        walkInPhone: schema.bookings.walkInPhone,
        propertyId: schema.bookings.propertyId,
        roomTypeId: schema.bookings.roomTypeId,
        bookingStatus: schema.bookings.status,
        bedId: schema.bookings.bedId,
        floorId: schema.bookings.floorId,
        roomId: schema.bookings.roomId,
        residentDetails: schema.bookings.residentDetails,
        studentId: schema.bookings.studentId,
        studentFullName: schema.students.fullName,
        studentPhone: schema.students.phone,
        studentCollege: schema.students.collegeName,
        studentCourse: schema.students.course,
        studentYear: schema.students.year,
        studentAddress: schema.students.address,
        studentCity: schema.students.city,
        studentEmergencyName: schema.students.emergencyName,
        studentEmergencyPhone: schema.students.emergencyPhone,
        studentEmergencyRelation: schema.students.emergencyRelation,
        propertyName: schema.properties.name,
      })
      .from(schema.residentSeasonStatus)
      .innerJoin(schema.bookings, eq(schema.residentSeasonStatus.bookingId, schema.bookings.id))
      .leftJoin(schema.students, eq(schema.bookings.studentId, schema.students.id))
      .leftJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
      .where(eq(schema.residentSeasonStatus.seasonId, req.params.id))
      .orderBy(schema.residentSeasonStatus.createdAt);

      res.json(residents);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch residents" });
    }
  });

  app.put("/api/admin/seasons/residents/:id", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [existing] = await db.select().from(schema.residentSeasonStatus).where(eq(schema.residentSeasonStatus.id, req.params.id));
      if (!existing) return res.status(404).json({ error: "Resident season status not found" });

      const updateData: any = { updatedAt: new Date(), updatedBy: req.user!.userId };
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.decisionReason !== undefined) updateData.decisionReason = req.body.decisionReason;
      if (req.body.graceUntil !== undefined) updateData.graceUntil = req.body.graceUntil ? new Date(req.body.graceUntil) : null;

      const [updated] = await db.update(schema.residentSeasonStatus).set(updateData).where(eq(schema.residentSeasonStatus.id, req.params.id)).returning();

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "UPDATE",
        entityType: "BOOKING",
        entityId: updated.id,
        entityLabel: `Resident Status for booking ${existing.bookingId}`,
        metadata: { previousStatus: existing.status, newStatus: updated.status },
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update resident status" });
    }
  });

  app.post("/api/admin/seasons/:id/bulk-update-residents", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const { residentIds, status, decisionReason } = req.body;
      if (!Array.isArray(residentIds) || residentIds.length === 0) {
        return res.status(400).json({ error: "residentIds must be a non-empty array" });
      }
      if (!status || !["RETAINED", "NOT_RETAINED", "PENDING"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updated = await db.update(schema.residentSeasonStatus)
        .set({
          status,
          decisionReason: decisionReason || null,
          updatedBy: req.user!.userId,
          updatedAt: new Date(),
        })
        .where(and(
          inArray(schema.residentSeasonStatus.id, residentIds),
          eq(schema.residentSeasonStatus.seasonId, req.params.id)
        ))
        .returning();

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "UPDATE",
        entityType: "BOOKING",
        entityId: req.params.id,
        entityLabel: `Bulk resident update for season`,
        metadata: { count: updated.length, newStatus: status },
      });

      res.json({ updated: updated.length, records: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to bulk update residents" });
    }
  });

  app.post("/api/admin/seasons/:id/generate-close-job", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, req.params.id));
      if (!season) return res.status(404).json({ error: "Season not found" });

      const closeBookingConds: any[] = [inArray(schema.bookings.status, ["active", "confirmed", "pending_payment"])];
      if (season.propertyId) {
        closeBookingConds.push(eq(schema.bookings.propertyId, season.propertyId));
      }
      const activeBookings = await db.select({
        id: schema.bookings.id,
        bookingCode: schema.bookings.bookingCode,
        walkInName: schema.bookings.walkInName,
        studentId: schema.bookings.studentId,
        residentDetails: schema.bookings.residentDetails,
        floorId: schema.bookings.floorId,
        roomId: schema.bookings.roomId,
        bedId: schema.bookings.bedId,
        status: schema.bookings.status,
        studentFullName: schema.students.fullName,
        studentPhone: schema.students.phone,
        studentCollege: schema.students.collegeName,
        propertyName: schema.properties.name,
      })
        .from(schema.bookings)
        .leftJoin(schema.students, eq(schema.bookings.studentId, schema.students.id))
        .leftJoin(schema.properties, eq(schema.bookings.propertyId, schema.properties.id))
        .where(and(...closeBookingConds));

      const residentStatuses = await db.select().from(schema.residentSeasonStatus)
        .where(eq(schema.residentSeasonStatus.seasonId, req.params.id));

      const statusMap = new Map(residentStatuses.map(rs => [rs.bookingId, rs]));

      const [job] = await db.insert(schema.seasonCloseJobs).values({
        seasonId: req.params.id,
        nextSeasonId: season.nextSeasonId || null,
        status: "PREVIEW",
        generatedAt: new Date(),
        syncStatus: "pending",
      }).returning();

      const jobItems = [];
      for (const booking of activeBookings) {
        const rs = statusMap.get(booking.id);
        const rd = booking.residentDetails as any;
        const residentName = booking.studentFullName || rd?.fullName || rd?.name || booking.walkInName || booking.bookingCode || "Unknown";
        const roomParts: string[] = [];
        if (booking.propertyName) roomParts.push(booking.propertyName);
        if (rd?.roomNo) roomParts.push(`Room ${rd.roomNo}`);
        if (rd?.bedNo) roomParts.push(`Bed ${rd.bedNo}`);
        const roomInfo = roomParts.join(" • ") || "Unassigned";

        const [item] = await db.insert(schema.seasonCloseJobItems).values({
          jobId: job.id,
          bookingId: booking.id,
          residentName,
          roomInfo,
          finalStatus: rs?.status || "PENDING",
          graceUntil: rs?.graceUntil || null,
          note: rs?.decisionReason || null,
        }).returning();

        jobItems.push(item);
      }

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "CREATE",
        entityType: "BOOKING",
        entityId: job.id,
        entityLabel: `Season Close Job for ${season.name}`,
        metadata: { seasonId: season.id, itemCount: jobItems.length },
      });

      res.status(201).json({ job, items: jobItems });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate close job" });
    }
  });

  app.get("/api/admin/seasons/close-jobs/:jobId", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [job] = await db.select().from(schema.seasonCloseJobs).where(eq(schema.seasonCloseJobs.id, req.params.jobId));
      if (!job) return res.status(404).json({ error: "Close job not found" });

      const items = await db.select().from(schema.seasonCloseJobItems)
        .where(eq(schema.seasonCloseJobItems.jobId, req.params.jobId))
        .orderBy(schema.seasonCloseJobItems.finalStatus);

      const grouped: Record<string, typeof items> = { RETAINED: [], NOT_RETAINED: [], PENDING: [] };
      for (const item of items) {
        const key = item.finalStatus || "PENDING";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      }

      res.json({ job, items, grouped });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch close job" });
    }
  });

  app.post("/api/admin/seasons/close-jobs/:jobId/apply", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [job] = await db.select().from(schema.seasonCloseJobs).where(eq(schema.seasonCloseJobs.id, req.params.jobId));
      if (!job) return res.status(404).json({ error: "Close job not found" });
      if (job.status === "APPLIED") return res.status(400).json({ error: "Job already applied" });

      const [season] = await db.select().from(schema.seasons).where(eq(schema.seasons.id, job.seasonId));

      const syncPayload = {
        eventId: `season-close-${job.id}`,
        jobId: job.id,
        seasonId: job.seasonId,
        nextSeasonId: job.nextSeasonId,
        generatedAt: job.generatedAt,
      };

      let syncResponse: any = null;
      let syncStatus = "pending";
      let errorMessage: string | null = null;

      try {
        const protocol = req.protocol;
        const host = req.get("host");
        const syncResult = await fetch(`${protocol}://${host}/api/sync/season-close`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Token": "hsquare-internal-sync" },
          body: JSON.stringify(syncPayload),
        });
        syncResponse = await syncResult.json();
        syncStatus = syncResult.ok ? "synced" : "failed";
        if (!syncResult.ok) errorMessage = syncResponse.error || "Sync failed";
      } catch (syncError: any) {
        syncStatus = "failed";
        errorMessage = syncError.message || "Sync request failed";
      }

      const [updated] = await db.update(schema.seasonCloseJobs).set({
        status: syncStatus === "synced" ? "APPLIED" : "FAILED",
        appliedAt: new Date(),
        appliedBy: req.user!.userId,
        syncPayload,
        syncResponse,
        syncStatus,
        errorMessage,
      }).where(eq(schema.seasonCloseJobs.id, req.params.jobId)).returning();

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "STATUS_CHANGE",
        entityType: "BOOKING",
        entityId: job.id,
        entityLabel: `Season Close Job Applied for ${season?.name || job.seasonId}`,
        metadata: { syncStatus, errorMessage },
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to apply close job" });
    }
  });

  app.post("/api/admin/seasons/close-jobs/:jobId/retry-sync", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const [job] = await db.select().from(schema.seasonCloseJobs).where(eq(schema.seasonCloseJobs.id, req.params.jobId));
      if (!job) return res.status(404).json({ error: "Close job not found" });
      if (job.syncStatus !== "failed") return res.status(400).json({ error: "Only failed syncs can be retried" });

      const syncPayload = job.syncPayload || {
        eventId: `season-close-${job.id}`,
        jobId: job.id,
        seasonId: job.seasonId,
        nextSeasonId: job.nextSeasonId,
        generatedAt: job.generatedAt,
      };

      let syncResponse: any = null;
      let syncStatus = "pending";
      let errorMessage: string | null = null;

      try {
        const protocol = req.protocol;
        const host = req.get("host");
        const syncResult = await fetch(`${protocol}://${host}/api/sync/season-close`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Internal-Token": "hsquare-internal-sync" },
          body: JSON.stringify(syncPayload),
        });
        syncResponse = await syncResult.json();
        syncStatus = syncResult.ok ? "synced" : "failed";
        if (!syncResult.ok) errorMessage = syncResponse.error || "Sync failed";
      } catch (syncError: any) {
        syncStatus = "failed";
        errorMessage = syncError.message || "Sync request failed";
      }

      const [updated] = await db.update(schema.seasonCloseJobs).set({
        status: syncStatus === "synced" ? "APPLIED" : "FAILED",
        syncPayload,
        syncResponse,
        syncStatus,
        syncRetries: (job.syncRetries || 0) + 1,
        errorMessage,
      }).where(eq(schema.seasonCloseJobs.id, req.params.jobId)).returning();

      await logActivity({
        actor: { id: req.user!.userId, name: req.user!.name, role: req.user!.role },
        actionType: "UPDATE",
        entityType: "BOOKING",
        entityId: job.id,
        entityLabel: `Season Close Job Retry Sync`,
        metadata: { syncStatus, retryCount: updated.syncRetries, errorMessage },
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to retry sync" });
    }
  });

  app.get("/api/admin/seasons/:id/close-jobs", authMiddleware, roleMiddleware("admin"), async (req: AuthRequest, res) => {
    try {
      const jobs = await db.select().from(schema.seasonCloseJobs)
        .where(eq(schema.seasonCloseJobs.seasonId, req.params.id))
        .orderBy(sql`${schema.seasonCloseJobs.generatedAt} DESC`);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch close jobs" });
    }
  });

  app.post("/api/sync/season-close", async (req: Request, res: Response) => {
    try {
      const internalToken = req.headers["x-internal-token"];
      if (internalToken !== "hsquare-internal-sync") {
        return res.status(403).json({ error: "Forbidden: internal endpoint" });
      }
      const { eventId, jobId, seasonId, nextSeasonId } = req.body;
      if (!jobId || !seasonId) {
        return res.status(400).json({ error: "jobId and seasonId are required" });
      }

      const items = await db.select().from(schema.seasonCloseJobItems)
        .where(eq(schema.seasonCloseJobItems.jobId, jobId));

      let processedCount = 0;
      for (const item of items) {
        if (item.finalStatus === "NOT_RETAINED") {
          await db.update(schema.bookings)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(schema.bookings.id, item.bookingId));
          processedCount++;
        }
      }

      res.json({
        success: true,
        eventId,
        processedCount,
        totalItems: items.length,
        message: `Processed ${processedCount} bookings for season close`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Sync processing failed" });
    }
  });

  // ===== REGISTRATION REQUESTS (Public Form) =====
  
  app.get("/api/registration-requests/properties", async (req, res) => {
    try {
      const props = await db.select({
        id: schema.properties.id,
        name: schema.properties.name,
        displayName: schema.properties.displayName,
        location: schema.properties.location,
      }).from(schema.properties)
        .where(eq(schema.properties.active, true));
      res.json(props);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const registrationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Too many registration attempts. Please try again later." } });

  app.post("/api/registration-requests", registrationLimiter, async (req, res) => {
    try {
      const { fullName, phone, email, gender, dob, dietaryPreference, instituteName, courseName, moveInDate, checkOutDate, parentName, parentRelation, parentPhone, parentEmail, photoPath, idProofPath, propertyId, propertyName, notes } = req.body;
      if (!fullName || !phone || !email || !gender) {
        return res.status(400).json({ error: "Full name, phone, email, and gender are required" });
      }

      let isRetain = false;
      const matchedFields: string[] = [];
      const normPhone = phone?.replace(/[^0-9]/g, "").slice(-10);
      const normName = fullName?.trim().toLowerCase();
      const normEmail = email?.trim().toLowerCase();

      try {
        const existingStudents = await db.select({
          name: schema.students.fullName,
          phone: schema.students.phone,
          email: schema.users.email,
        }).from(schema.students)
          .innerJoin(schema.users, eq(schema.students.userId, schema.users.id));

        for (const s of existingStudents) {
          const sName = s.name?.trim().toLowerCase();
          const sEmail = s.email?.trim().toLowerCase();
          const sPhone = s.phone?.replace(/[^0-9]/g, "").slice(-10);
          let fieldMatches = 0;
          const fields: string[] = [];
          if (normName && sName && normName === sName) { fieldMatches++; fields.push("name"); }
          if (normEmail && sEmail && normEmail === sEmail) { fieldMatches++; fields.push("email"); }
          if (normPhone && sPhone && normPhone === sPhone) { fieldMatches++; fields.push("phone"); }
          if (fieldMatches >= 2) {
            isRetain = true;
            matchedFields.push(...fields);
            break;
          }
        }

        if (!isRetain) {
          const existingBookings = await db.select({
            name: schema.bookings.walkInName,
            phone: schema.bookings.walkInPhone,
            email: schema.bookings.walkInEmail,
          }).from(schema.bookings)
            .where(sql`${schema.bookings.walkInName} IS NOT NULL OR ${schema.bookings.walkInEmail} IS NOT NULL OR ${schema.bookings.walkInPhone} IS NOT NULL`);

          for (const b of existingBookings) {
            const bName = b.name?.trim().toLowerCase();
            const bEmail = b.email?.trim().toLowerCase();
            const bPhone = b.phone?.replace(/[^0-9]/g, "").slice(-10);
            let fieldMatches = 0;
            const fields: string[] = [];
            if (normName && bName && normName === bName) { fieldMatches++; fields.push("name"); }
            if (normEmail && bEmail && normEmail === bEmail) { fieldMatches++; fields.push("email"); }
            if (normPhone && bPhone && normPhone === bPhone) { fieldMatches++; fields.push("phone"); }
            if (fieldMatches >= 2) {
              isRetain = true;
              matchedFields.push(...fields);
              break;
            }
          }
        }
      } catch (retainErr) {
        console.error("Retain check failed (non-blocking):", retainErr);
      }

      const [request] = await db.insert(schema.registrationRequests).values({
        fullName, phone, email, gender, dob: dob || null, dietaryPreference: dietaryPreference || null, instituteName: instituteName || null, courseName: courseName || null, moveInDate: moveInDate || null, checkOutDate: checkOutDate || null, parentName: parentName || null, parentRelation: parentRelation || null, parentPhone: parentPhone || null, parentEmail: parentEmail || null, photoPath: photoPath || null, idProofPath: idProofPath || null, propertyId: propertyId || null, propertyName: propertyName || null, notes: notes || null, status: "pending",
        isRetain,
        retainMatchedFields: matchedFields.length > 0 ? matchedFields.join(",") : null,
      }).returning();
      res.status(201).json(request);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to submit registration" });
    }
  });

  app.get("/api/admin/registration-requests", authMiddleware, roleMiddleware("admin", "manager", "staff", "receptionist", "sales_executive"), async (req: AuthRequest, res) => {
    try {
      const uncheckedRetain = await db.select().from(schema.registrationRequests)
        .where(sql`${schema.registrationRequests.isRetain} = false`);
      if (uncheckedRetain.length > 0) {
        const allStudents = await db.select({
          name: schema.students.fullName,
          phone: schema.students.phone,
          email: schema.users.email,
        }).from(schema.students)
          .innerJoin(schema.users, eq(schema.students.userId, schema.users.id));
        const allBookings = await db.select({
          name: schema.bookings.walkInName,
          phone: schema.bookings.walkInPhone,
          email: schema.bookings.walkInEmail,
        }).from(schema.bookings)
          .where(sql`${schema.bookings.walkInName} IS NOT NULL OR ${schema.bookings.walkInEmail} IS NOT NULL OR ${schema.bookings.walkInPhone} IS NOT NULL`);

        for (const reg of uncheckedRetain) {
          const normName = reg.fullName?.trim().toLowerCase();
          const normEmail = reg.email?.trim().toLowerCase();
          const normPhone = reg.phone?.replace(/[^0-9]/g, "").slice(-10);
          let foundRetain = false;
          const matchedFields: string[] = [];

          for (const s of allStudents) {
            const sName = s.name?.trim().toLowerCase();
            const sEmail = s.email?.trim().toLowerCase();
            const sPhone = s.phone?.replace(/[^0-9]/g, "").slice(-10);
            let fm = 0; const flds: string[] = [];
            if (normName && sName && normName === sName) { fm++; flds.push("name"); }
            if (normEmail && sEmail && normEmail === sEmail) { fm++; flds.push("email"); }
            if (normPhone && sPhone && normPhone === sPhone) { fm++; flds.push("phone"); }
            if (fm >= 2) { foundRetain = true; matchedFields.push(...flds); break; }
          }
          if (!foundRetain) {
            for (const b of allBookings) {
              const bName = b.name?.trim().toLowerCase();
              const bEmail = b.email?.trim().toLowerCase();
              const bPhone = b.phone?.replace(/[^0-9]/g, "").slice(-10);
              let fm = 0; const flds: string[] = [];
              if (normName && bName && normName === bName) { fm++; flds.push("name"); }
              if (normEmail && bEmail && normEmail === bEmail) { fm++; flds.push("email"); }
              if (normPhone && bPhone && normPhone === bPhone) { fm++; flds.push("phone"); }
              if (fm >= 2) { foundRetain = true; matchedFields.push(...flds); break; }
            }
          }
          if (foundRetain) {
            await db.update(schema.registrationRequests)
              .set({ isRetain: true, retainMatchedFields: matchedFields.join(","), updatedAt: new Date() })
              .where(eq(schema.registrationRequests.id, reg.id));
          }
        }
      }

      const unlinked = await db.select().from(schema.registrationRequests)
        .where(sql`${schema.registrationRequests.bookingId} IS NULL AND ${schema.registrationRequests.status} != 'rejected'`);
      for (const reg of unlinked) {
        const phone = reg.phone?.replace(/[^0-9]/g, "").slice(-10);
        if (!phone && !reg.email) continue;
        const conditions = [];
        if (phone) conditions.push(sql`REPLACE(REPLACE(${schema.bookings.walkInPhone}, '+91', ''), ' ', '') LIKE ${'%' + phone}`);
        if (reg.email) conditions.push(sql`LOWER(${schema.bookings.walkInEmail}) = LOWER(${reg.email})`);
        if (conditions.length === 0) continue;
        const [matchingBooking] = await db.select({ id: schema.bookings.id })
          .from(schema.bookings)
          .where(sql`(${sql.join(conditions, sql` OR `)})`)
          .orderBy(sql`${schema.bookings.createdAt} DESC`)
          .limit(1);
        if (matchingBooking) {
          await db.update(schema.registrationRequests)
            .set({ bookingId: matchingBooking.id, status: "booked", updatedAt: new Date() })
            .where(eq(schema.registrationRequests.id, reg.id));
        }
      }
      const requests = await db.select({
        request: schema.registrationRequests,
        bookingCode: schema.bookings.bookingCode,
      })
        .from(schema.registrationRequests)
        .leftJoin(schema.bookings, eq(schema.registrationRequests.bookingId, schema.bookings.id))
        .orderBy(sql`${schema.registrationRequests.createdAt} DESC`);
      let result = requests.map(r => ({ ...r.request, bookingCode: r.bookingCode }));

      if (req.user!.role === "sales_executive") {
        const userId = req.user!.userId;
        const salesLeads = await storage.getLeadsForAssignedProperties(userId, []);
        const leadPhones = new Set(salesLeads.map(l => (l.phone || "").replace(/\D/g, "").slice(-10)).filter(p => p.length >= 10));
        const leadEmails = new Set(salesLeads.map(l => (l.email || "").toLowerCase().trim()).filter(Boolean));

        result = result.filter(r => {
          const rPhone = (r.phone || "").replace(/\D/g, "").slice(-10);
          const rEmail = (r.email || "").toLowerCase().trim();
          if (rPhone.length >= 10 && leadPhones.has(rPhone)) return true;
          if (rEmail && leadEmails.has(rEmail)) return true;
          return false;
        });
      }

      const scope = await getReceptionistScope(req);
      if (scope) {
        result = result.filter(r => r.propertyId && scope.has(r.propertyId));
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/registration-requests/:id/status", authMiddleware, roleMiddleware("admin", "manager", "staff"), async (req: AuthRequest, res) => {
    try {
      const { status, reviewNotes, bookingId } = req.body;
      if (!["reviewed", "approved", "rejected", "booked"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const updateData: any = { status, reviewNotes, reviewedBy: req.user!.userId, reviewedAt: new Date(), updatedAt: new Date() };
      if (bookingId) updateData.bookingId = bookingId;
      const [updated] = await db.update(schema.registrationRequests)
        .set(updateData)
        .where(eq(schema.registrationRequests.id, req.params.id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Request not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/registration-requests/:id", authMiddleware, roleMiddleware("admin", "manager", "staff", "receptionist", "sales_executive"), async (req: AuthRequest, res) => {
    try {
      const [request] = await db.select().from(schema.registrationRequests)
        .where(eq(schema.registrationRequests.id, req.params.id));
      if (!request) return res.status(404).json({ error: "Request not found" });
      const scope = await getReceptionistScope(req);
      if (scope && (!request.propertyId || !scope.has(request.propertyId))) {
        return res.status(403).json({ error: "Request not in your assignment scope" });
      }
      res.json(request);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ HMS HEALTH DIAGNOSTICS (superadmin only) ============
  // These endpoints let a superadmin verify the HostelFlow integration
  // end-to-end (auth, inbound traffic, lookup, wallet) without touching
  // server logs. Read-only — no mutations to bookings, residents, or wallet.

  app.get("/api/admin/hms-health/status", authMiddleware, roleMiddleware("superadmin"), async (req: AuthRequest, res) => {
    try {
      const hasApiKey = !!(process.env.HOSTEL_FLOW_API_KEY || process.env.HMS_API_KEY);
      const hasLoginCreds = !!(process.env.HOSTEL_FLOW_EMAIL && process.env.HOSTEL_FLOW_PASSWORD);
      const apiBaseUrl = process.env.HMS_API_URL || "https://hostel-flow--swaingrs07.replit.app";
      const appPublicUrl = process.env.APP_PUBLIC_URL || null;
      // Same resolver as the canonical-host redirect middleware so the
      // diagnostic and the redirect can never disagree about what the
      // canonical apex is. APP_EXPECTED_APEX overrides for tests; in
      // production both code paths read APP_PUBLIC_URL.
      const expectedApex = process.env.APP_EXPECTED_APEX
        ? resolveCanonicalApex(process.env.APP_EXPECTED_APEX)
        : resolveCanonicalApex(process.env.APP_PUBLIC_URL);
      const requestHost = req.get("host") || null;
      const requestProtocol = (req.headers["x-forwarded-proto"] as string) || req.protocol;

      // Outbound auth ping: prefer API key; if absent fall back to the
      // configured email/password login flow so we report green when EITHER
      // credential mode is healthy.
      let outbound: {
        ok: boolean; status?: number; error?: string; latencyMs?: number;
        tested?: string; mode?: "api_key" | "login" | "none";
      } = { ok: false, mode: "none" };
      try {
        const apiKey = process.env.HOSTEL_FLOW_API_KEY || process.env.HMS_API_KEY;
        if (apiKey) {
          const t0 = Date.now();
          const url = `${apiBaseUrl}/api/properties`;
          const resp = await fetch(url, {
            method: "GET",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            signal: AbortSignal.timeout(8000),
          });
          outbound = {
            ok: resp.ok,
            status: resp.status,
            latencyMs: Date.now() - t0,
            tested: url,
            mode: "api_key",
          };
          if (!resp.ok) {
            const text = await resp.text().catch(() => "");
            outbound.error = text.slice(0, 200) || `HTTP ${resp.status}`;
          }
        } else if (hasLoginCreds) {
          // Use the cached JWT helper so we exercise the same login path the
          // rest of the app does. getHostelFlowJWT() throws on failure.
          const t0 = Date.now();
          const token = await getHostelFlowJWT();
          outbound = {
            ok: !!token,
            status: token ? 200 : 0,
            latencyMs: Date.now() - t0,
            tested: `${apiBaseUrl} (login)`,
            mode: "login",
          };
          if (!token) outbound.error = "Login returned empty token";
        } else {
          outbound = { ok: false, error: "No HMS credentials configured (need HMS_API_KEY or HOSTEL_FLOW_EMAIL+PASSWORD)", mode: "none" };
        }
      } catch (e: any) {
        outbound = { ok: false, error: e?.message || "Network error", mode: outbound.mode };
      }

      // Token age — peek at the cached HostelFlow JWT (if any) so we know
      // when our credentials were last refreshed. We never call login here
      // (that's the dedicated /ping-auth endpoint) — we just report age.
      const tokenInfo: { source: "api_key" | "cached_jwt" | "none"; ageMinutes: number | null; expiresInMinutes: number | null } = {
        source: hasApiKey ? "api_key" : (cachedHostelFlowJWT ? "cached_jwt" : "none"),
        ageMinutes: null,
        expiresInMinutes: null,
      };
      if (cachedHostelFlowJWT && jwtExpiresAt > 0) {
        // jwtExpiresAt is set 23h after issue; back into issuedAt.
        const issuedAt = jwtExpiresAt - 23 * 60 * 60 * 1000;
        tokenInfo.ageMinutes = Math.max(0, Math.floor((Date.now() - issuedAt) / 60_000));
        tokenInfo.expiresInMinutes = Math.max(0, Math.floor((jwtExpiresAt - Date.now()) / 60_000));
      }

      // Inbound endpoints we expose to HMS. "Last hit" is enriched from two
      // sources: the in-memory ring buffer (sub-second freshness, but resets
      // on restart) and persistent evidence from the wallet ledger and
      // bookings tables (survives restarts but only proves the *body* of the
      // request was processed, not the auth header).
      const canonicalBase = appPublicUrl || `${requestProtocol}://${requestHost}`;
      const baseEndpoints = [
        { method: "GET",  path: "/api/hms/bookings",                       label: "List bookings" },
        { method: "GET",  path: "/api/hms/bookings/:identifier",           label: "Lookup booking" },
        { method: "PUT",  path: "/api/hms/residents/update",               label: "Resident updates" },
        { method: "GET",  path: "/api/hms/bookings/:identifier/receipt",   label: "Booking receipt" },
        { method: "POST", path: "/sync/first-payment",                     label: "First payment sync" },
        { method: "POST", path: "/sync/wallet-debit",                      label: "Wallet debit" },
        { method: "POST", path: "/sync/wallet-credit",                     label: "Wallet credit" },
        { method: "GET",  path: "/sync/wallet-balance",                    label: "Wallet balance" },
      ];

      // Persistent evidence: most-recent wallet ledger rows (HMS-driven only).
      let lastWalletDebit: Date | null = null;
      let lastWalletCredit: Date | null = null;
      try {
        const recentLedger = await db.select({
          createdAt: schema.walletLedger.createdAt,
          credit: schema.walletLedger.credit,
          debit: schema.walletLedger.debit,
          refType: schema.walletLedger.refType,
        })
          .from(schema.walletLedger)
          .orderBy(sql`${schema.walletLedger.createdAt} DESC`)
          .limit(50);
        for (const row of recentLedger) {
          const isHmsDriven = row.refType === "order_refund" || row.refType === "manual_credit" ||
            row.refType === "ala_carte" || row.refType === "hms_debit" || row.refType === "hms_credit";
          if (!isHmsDriven) continue;
          const ts = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as any);
          if ((row.debit || 0) > 0 && !lastWalletDebit) lastWalletDebit = ts;
          if ((row.credit || 0) > 0 && !lastWalletCredit) lastWalletCredit = ts;
          if (lastWalletDebit && lastWalletCredit) break;
        }
      } catch {
        /* non-fatal: persistent evidence is best-effort */
      }

      const persistentLastHitFor = (path: string): string | null => {
        if (path === "/sync/wallet-debit") return lastWalletDebit ? lastWalletDebit.toISOString() : null;
        if (path === "/sync/wallet-credit") return lastWalletCredit ? lastWalletCredit.toISOString() : null;
        return null;
      };

      // Persistent last-hit per route — read the most recent
      // hms_activity_log row for each inbound route. Survives restarts,
      // mirrors what HMS actually called us with (route + method +
      // status). This is the PRIMARY source for last-hit; the in-memory
      // ring buffer is just a sub-second freshness supplement for the
      // very latest call.
      let auditLastHit: Record<string, { timestamp: string; status: number | null } | null> = {};
      try {
        const lookup = await getLastHitsByRoute(baseEndpoints.map((e) => e.path));
        auditLastHit = Object.fromEntries(
          Object.entries(lookup).map(([k, v]) => [k, v ? { timestamp: v.timestamp, status: v.status } : null])
        );
      } catch {
        /* non-fatal: audit lookup is best-effort */
      }

      const inboundEndpoints = baseEndpoints.map((e) => {
        const ringHit = getLastHitForRoute(e.path) || null;
        const auditHit = auditLastHit[e.path] || null;
        const persistentTs = persistentLastHitFor(e.path);

        // Prefer the more-recent of (audit log, ring buffer). Audit log
        // is the persistent primary source; ring buffer is sub-second
        // freshness for the very latest call. Always return a consistent
        // object shape: { timestamp, status, source }.
        let lastHit: { timestamp: string; status: number | null; source: "audit_log" | "in_memory" } | null = null;
        if (auditHit && (!ringHit || new Date(auditHit.timestamp).getTime() >= new Date(ringHit.timestamp).getTime())) {
          lastHit = { timestamp: auditHit.timestamp, status: auditHit.status, source: "audit_log" };
        } else if (ringHit) {
          lastHit = { timestamp: ringHit.timestamp, status: ringHit.status, source: "in_memory" };
        }

        return {
          ...e,
          url: `${canonicalBase}${e.path}`,
          lastHit,
          lastHitPersistent: persistentTs,
        };
      });

      // Domain canonicality — explicitly flag www prefix and apex mismatch.
      const stripScheme = (u: string) => u.replace(/^https?:\/\//, "").replace(/\/$/, "").split("/")[0];
      const appPublicHost = appPublicUrl ? stripScheme(appPublicUrl) : null;
      const requestIsWww = !!requestHost && requestHost.toLowerCase().startsWith("www.");
      const appPublicIsWww = !!appPublicHost && appPublicHost.toLowerCase().startsWith("www.");
      const requestMatchesApex = !!requestHost && requestHost.toLowerCase() === expectedApex.toLowerCase();
      const appPublicMatchesApex = !!appPublicHost && appPublicHost.toLowerCase() === expectedApex.toLowerCase();
      // Strict: both the request host and APP_PUBLIC_URL must equal the
      // expected apex (no www, no subdomain). Otherwise the warnings
      // banner and this top-level flag could disagree.
      const isCanonical = !!appPublicHost && !!requestHost &&
        requestMatchesApex && appPublicMatchesApex &&
        !appPublicIsWww && !requestIsWww;

      // Active probes: HEAD-request each known non-canonical hostname and
      // report whether (a) TLS handshakes, (b) we get a 30x to the apex,
      // or (c) we get a 2xx from a non-canonical host (which means the
      // server-side redirect did NOT fire and Google sees duplicate
      // content). Add new domains to NON_CANONICAL_HOSTS_TO_PROBE only —
      // every other piece of the diagnostic is data-driven from this list.
      const NON_CANONICAL_HOSTS_TO_PROBE = [
        `www.${expectedApex}`,
        "hsquareliving.com",
        "www.hsquareliving.com",
      ];
      type DomainProbeStatus = "tls_ok_redirect" | "tls_failed" | "no_redirect" | "redirect_wrong_target";
      type DomainProbe = {
        host: string;
        status: DomainProbeStatus;
        httpStatus: number | null;
        redirectTo: string | null;
        latencyMs: number | null;
        error: string | null;
        hint: string | null;
      };
      const probeDomain = async (host: string): Promise<DomainProbe> => {
        const t0 = Date.now();
        try {
          const resp = await fetch(`https://${host}/`, {
            method: "HEAD",
            redirect: "manual",
            signal: AbortSignal.timeout(5000),
          });
          const latencyMs = Date.now() - t0;
          const location = resp.headers.get("location");
          // Strict: HEAD probes should see a 301 (permanent SEO redirect)
          // or a 308 (permanent redirect that preserves method) pointing
          // at the canonical apex. 302/307 are temporary and won't
          // consolidate Google's index, so we surface them as amber via
          // redirect_wrong_target with an explicit hint.
          if (resp.status >= 300 && resp.status < 400 && location) {
            try {
              const target = new URL(location, `https://${host}/`);
              const targetHost = target.hostname.toLowerCase();
              const isPermanent = resp.status === 301 || resp.status === 308;
              if (targetHost === expectedApex.toLowerCase() && isPermanent) {
                return {
                  host, status: "tls_ok_redirect", httpStatus: resp.status,
                  redirectTo: location, latencyMs, error: null, hint: null,
                };
              }
              if (targetHost === expectedApex.toLowerCase() && !isPermanent) {
                return {
                  host, status: "redirect_wrong_target", httpStatus: resp.status,
                  redirectTo: location, latencyMs, error: null,
                  hint: `Redirect to apex uses ${resp.status} (temporary). SEO needs a permanent 301/308 — check canonical-host middleware.`,
                };
              }
              return {
                host, status: "redirect_wrong_target", httpStatus: resp.status,
                redirectTo: location, latencyMs, error: null,
                hint: `Redirects to "${targetHost}" instead of "${expectedApex}". Check canonical-host middleware.`,
              };
            } catch {
              return {
                host, status: "redirect_wrong_target", httpStatus: resp.status,
                redirectTo: location, latencyMs, error: null,
                hint: `Redirect target "${location}" could not be parsed.`,
              };
            }
          }
          // No redirect — server is serving content from the non-canonical
          // host. Bad for SEO.
          return {
            host, status: "no_redirect", httpStatus: resp.status,
            redirectTo: null, latencyMs, error: null,
            hint: "Server reachable but did not redirect. Check the canonical-host middleware in server/index.ts.",
          };
        } catch (e: unknown) {
          const latencyMs = Date.now() - t0;
          // Most TLS / DNS / connection failures land here. We surface
          // the message so the admin can tell apart "domain not linked"
          // from "TLS cert missing" from "DNS not propagated".
          const msg = e instanceof Error ? e.message : String(e);
          return {
            host, status: "tls_failed", httpStatus: null,
            redirectTo: null, latencyMs, error: msg.slice(0, 200),
            hint: `Connection or TLS failure. Re-link "${host}" in Replit Deployments so a TLS cert is issued, and confirm DNS points at Replit.`,
          };
        }
      };
      const domainProbes: DomainProbe[] = await Promise.all(
        NON_CANONICAL_HOSTS_TO_PROBE.map(probeDomain)
      );

      const canonicality = {
        expectedApex,
        appPublicHost,
        requestHost,
        requestIsWww,
        appPublicIsWww,
        requestMatchesApex,
        appPublicMatchesApex,
        isCanonical,
        domainProbes,
        warnings: [
          ...(requestIsWww ? [`Request host "${requestHost}" uses www. — HMS should hit apex (${expectedApex}).`] : []),
          ...(appPublicIsWww ? [`APP_PUBLIC_URL "${appPublicUrl}" uses www. — should be apex.`] : []),
          ...(appPublicHost && !appPublicMatchesApex ? [`APP_PUBLIC_URL host "${appPublicHost}" != expected apex "${expectedApex}".`] : []),
          ...(requestHost && !requestMatchesApex && requestHost.includes(expectedApex.split(".").slice(-2).join(".")) ? [`Request host "${requestHost}" != expected apex "${expectedApex}".`] : []),
        ],
      };

      res.json({
        // Green when EITHER credential mode reports a healthy outbound
        // ping (API key or login fallback). Was previously gated on
        // hasApiKey which produced false negatives in login-only setups.
        ok: !!outbound.ok,
        config: {
          hasApiKey,
          hasLoginCreds,
          apiBaseUrl,
          appPublicUrl,
        },
        request: {
          host: requestHost,
          protocol: requestProtocol,
          canonicalBase,
        },
        outbound,
        token: tokenInfo,
        canonicality,
        inboundEndpoints,
        activityLog: getHmsLogStats(),
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error?.message || "Failed to read HMS status" });
    }
  });

  // Live "Ping HMS auth" — performs the actual login flow on demand and
  // returns the resulting token's source + age. This is the explicit
  // diagnostic action a superadmin clicks to verify HMS auth is alive.
  app.post("/api/admin/hms-health/ping-auth", authMiddleware, roleMiddleware("superadmin"), async (_req: AuthRequest, res) => {
    const t0 = Date.now();
    try {
      // Resolve API key the same way hmsApiKeyAuth does — either name is
      // valid in production. Mismatches here previously caused false
      // negatives in HOSTEL_FLOW_API_KEY-only deployments.
      const apiKey = process.env.HOSTEL_FLOW_API_KEY || process.env.HMS_API_KEY;
      if (apiKey) {
        // No login flow — verify the API key works by doing a real GET.
        const apiBaseUrl = process.env.HMS_API_URL || "https://hostel-flow--swaingrs07.replit.app";
        const resp = await fetch(`${apiBaseUrl}/api/properties`, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          return res.status(502).json({
            ok: false,
            mode: "api_key",
            status: resp.status,
            latencyMs: Date.now() - t0,
            error: text.slice(0, 200) || `HTTP ${resp.status}`,
          });
        }
        return res.json({
          ok: true,
          mode: "api_key",
          status: resp.status,
          latencyMs: Date.now() - t0,
          message: "API key is accepted by HMS.",
        });
      }
      // Fall back to email/password login — invalidate the cache first so
      // we exercise a fresh login round-trip, then report token age.
      cachedHostelFlowJWT = null;
      jwtExpiresAt = 0;
      const token = await getHostelFlowJWT();
      const issuedAt = jwtExpiresAt - 23 * 60 * 60 * 1000;
      return res.json({
        ok: true,
        mode: "login",
        latencyMs: Date.now() - t0,
        tokenLength: token?.length || 0,
        ageMinutes: Math.max(0, Math.floor((Date.now() - issuedAt) / 60_000)),
        expiresInMinutes: Math.max(0, Math.floor((jwtExpiresAt - Date.now()) / 60_000)),
        message: "Successfully obtained a fresh HostelFlow JWT.",
      });
    } catch (error: any) {
      return res.status(502).json({
        ok: false,
        latencyMs: Date.now() - t0,
        error: error?.message || "Auth ping failed",
      });
    }
  });

  app.get("/api/admin/hms-health/recent-activity", authMiddleware, roleMiddleware("superadmin"), async (_req: AuthRequest, res) => {
    try {
      // Pull from the persistent `hms_activity_log` table (survives
      // restarts and deploys). Cap at the latest 100 rows per the spec.
      const dbHits = await getRecentHitsFromDb(100);
      const hits = dbHits.map((h) => ({
        timestamp: h.timestamp,
        method: h.method,
        route: h.route,
        path: h.path,
        status: h.status,
        durationMs: h.durationMs,
        ip: h.ip || null,
        identifier: h.identifier || null,
        bookingRef: h.identifier || null,
        hasApiKey: !!h.hasApiKey,
        userAgent: h.userAgent || null,
        query: h.query || {},
      }));
      const dbStats = await getHmsDbStats().catch(() => ({ total: 0, oldest: null }));
      // Also surface the in-memory ring so right-after-a-call we have
      // sub-second freshness even before the DB write commits.
      res.json({
        ok: true,
        hits,
        ring: getRecentHits(20),
        stats: getHmsLogStats(),
        persistent: dbStats,
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error?.message || "Failed to read activity" });
    }
  });

  app.post("/api/admin/hms-health/lookup-resident", authMiddleware, roleMiddleware("superadmin"), async (req: AuthRequest, res) => {
    try {
      const phoneRaw = String(req.body?.phone || "").trim();
      if (!phoneRaw) return res.status(400).json({ ok: false, error: "phone required" });
      const last10 = phoneRaw.replace(/\D/g, "").slice(-10);
      // Reject if we can't form a 10-digit phone — otherwise a `LIKE '%'`
      // would return arbitrary recent bookings and mislead the diagnostic.
      if (last10.length !== 10) {
        return res.status(400).json({
          ok: false,
          error: "Phone must contain at least 10 digits (last 10 are matched).",
        });
      }

      // Mirrors the matching logic of /sync/wallet-balance: pull all
      // confirmed/active bookings, then filter in JS by phone tail. Avoids
      // brittle JSONB operator interpolation in tagged SQL templates.
      const candidates = await db.select().from(schema.bookings)
        .where(sql`${schema.bookings.status} IN ('confirmed', 'active')`);

      const matches = candidates
        .filter((b: any) => {
          const rd = (b.residentDetails || {}) as any;
          const phoneFields = [b.walkInPhone, rd.phone, b.customerPhone].filter(Boolean);
          return phoneFields.some((p: string) => String(p).replace(/\D/g, "").slice(-10) === last10);
        })
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map((b: any) => ({
          id: b.id,
          bookingCode: b.bookingCode,
          status: b.status,
          propertyId: b.propertyId,
          walkInName: b.walkInName,
          walkInPhone: b.walkInPhone,
          customerEmail: b.customerEmail,
          residentDetails: b.residentDetails,
          createdAt: b.createdAt,
        }));

      res.json({ ok: true, last10, count: matches.length, matches });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error?.message || "Lookup failed" });
    }
  });

  app.post("/api/admin/hms-health/wallet-balance", authMiddleware, roleMiddleware("superadmin"), async (req: AuthRequest, res) => {
    try {
      const phoneRaw = String(req.body?.phone || "").trim();
      const bookingCodeRaw = String(req.body?.bookingCode || "").trim();
      if (!phoneRaw && !bookingCodeRaw) {
        return res.status(400).json({ ok: false, error: "phone or bookingCode required" });
      }

      // Mirrors the matching logic of the live /sync/wallet-balance endpoint.
      let booking: any = null;
      if (bookingCodeRaw) {
        const [match] = await db.select().from(schema.bookings)
          .where(eq(schema.bookings.bookingCode, bookingCodeRaw));
        booking = match || null;
      }
      if (!booking && phoneRaw) {
        const phone10 = phoneRaw.replace(/\D/g, "").slice(-10);
        if (phone10.length === 10) {
          const candidates = await db.select().from(schema.bookings)
            .where(sql`${schema.bookings.status} IN ('confirmed', 'active')`);
          booking = candidates.find((b: any) => {
            const rd = b.residentDetails as any;
            const bPhone = (b.walkInPhone || rd?.phone || "").replace(/\D/g, "").slice(-10);
            return bPhone === phone10;
          }) || null;
        }
      }

      if (!booking) {
        return res.json({ ok: true, found: false, message: "No active/confirmed booking matched" });
      }

      const entries = await db.select().from(schema.walletLedger)
        .where(eq(schema.walletLedger.bookingId, booking.id))
        .orderBy(sql`${schema.walletLedger.createdAt} DESC`);

      const balance = entries.reduce((acc: number, e: any) => acc + (e.credit || 0) - (e.debit || 0), 0);
      const totalCredits = entries.reduce((acc: number, e: any) => acc + (e.credit || 0), 0);
      const totalDebits = entries.reduce((acc: number, e: any) => acc + (e.debit || 0), 0);

      res.json({
        ok: true,
        found: true,
        booking: {
          id: booking.id,
          bookingCode: booking.bookingCode,
          status: booking.status,
          guestName: booking.walkInName || (booking.residentDetails as any)?.name || null,
          phone: booking.walkInPhone || (booking.residentDetails as any)?.phone || null,
        },
        balance,
        totalCredits,
        totalDebits,
        transactionCount: entries.length,
        recentTransactions: entries.slice(0, 10).map((e: any) => ({
          id: e.id,
          credit: e.credit,
          debit: e.debit,
          refType: e.refType,
          refId: e.refId,
          note: e.note,
          createdAt: e.createdAt,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error?.message || "Wallet lookup failed" });
    }
  });

  return httpServer;
}
