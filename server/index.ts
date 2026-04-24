import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

// We sit behind Replit's edge proxy in production. Trust the first proxy
// hop so req.hostname / req.protocol come from X-Forwarded-* headers
// (needed for the www → apex redirect below to detect HTTPS correctly).
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ---- Canonical host redirect (www → apex) ----
// SEO best practice: serve the site from one canonical hostname.
// Our canonical is the apex `hsquare.in` (matches SITE_URL in seo-meta.ts
// and every <link rel="canonical">). Any visitor landing on the `www.`
// variant of a linked custom domain is 301-redirected to the apex,
// preserving path + query string. Replit's *.replit.app/.replit.dev
// preview hosts and localhost are left alone so dev/staging keep working.
app.use((req, res, next) => {
  const host = (req.hostname || "").toLowerCase();
  if (host.startsWith("www.")) {
    const apex = host.slice(4);
    // Only redirect when it looks like a real custom domain (has a dot
    // and isn't a Replit preview / localhost). This keeps dev safe.
    if (apex.includes(".") && !apex.endsWith("replit.app") && !apex.endsWith("replit.dev") && apex !== "localhost") {
      const target = `https://${apex}${req.originalUrl}`;
      // GET/HEAD → 301 (classic SEO redirect). Anything else (a stray
      // webhook POST that lands on www, etc.) → 308 so the method and
      // request body are preserved per RFC 7538 instead of silently
      // being downgraded to a body-less GET.
      const code = req.method === "GET" || req.method === "HEAD" ? 301 : 308;
      return res.redirect(code, target);
    }
  }
  next();
});

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Seed database with initial data
  const { seedDatabase } = await import("./seed");
  await seedDatabase();

  // Auto-generate slugs for properties that don't have one
  try {
    const { db } = await import("./db");
    const { properties } = await import("../shared/schema");
    const { isNull, eq } = await import("drizzle-orm");
    const propsWithoutSlug = await db.select({ id: properties.id, name: properties.name }).from(properties).where(isNull(properties.slug));
    for (const p of propsWithoutSlug) {
      let slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existing = await db.select({ id: properties.id }).from(properties).where(eq(properties.slug, slug));
      if (existing.length > 0) slug = `${slug}-${Date.now().toString(36)}`;
      await db.update(properties).set({ slug }).where(eq(properties.id, p.id));
      console.log(`Generated slug: ${p.name} -> ${slug}`);
    }
  } catch (e) {
    console.error("Failed to generate property slugs:", e);
  }

  // One-time data correction: sync bed statuses for confirmed/active bookings
  try {
    const { inArray } = await import("drizzle-orm");
    const activeBookings = await db.select({
      bedId: schema.bookings.bedId,
      floorId: schema.bookings.floorId,
      status: schema.bookings.status,
    }).from(schema.bookings).where(
      and(
        inArray(schema.bookings.status, ["confirmed", "active"]),
      )
    );
    const bookingsWithBeds = activeBookings.filter(b => b.bedId);
    if (bookingsWithBeds.length > 0) {
      const bedIds = bookingsWithBeds.map(b => b.bedId!);
      const staleResults = await db.select({ id: schema.beds.id }).from(schema.beds).where(
        and(
          inArray(schema.beds.id, bedIds),
          inArray(schema.beds.status, ["available", "reserved"])
        )
      );
      if (staleResults.length > 0) {
        const staleIds = staleResults.map(b => b.id);
        await db.update(schema.beds).set({ status: "occupied" as any }).where(inArray(schema.beds.id, staleIds));
        console.log(`[Startup] Fixed ${staleResults.length} bed(s) to "occupied" status for confirmed/active bookings`);
        const affectedFloorIds = new Set(bookingsWithBeds.filter(b => b.floorId && staleIds.some(sid => sid === b.bedId)).map(b => b.floorId!));
        for (const fid of affectedFloorIds) {
          const floorBeds = await db.select({ status: schema.beds.status }).from(schema.beds).where(eq(schema.beds.floorId, fid));
          const availCount = floorBeds.filter(b => b.status === "available").length;
          await db.update(schema.floors).set({ availableBeds: availCount }).where(eq(schema.floors.id, fid));
        }
        const affectedRoomTypeIds = new Set<string>();
        for (const sid of staleIds) {
          const [bedRow] = await db.select({ roomTypeId: schema.beds.roomTypeId }).from(schema.beds).where(eq(schema.beds.id, sid));
          if (bedRow?.roomTypeId) affectedRoomTypeIds.add(bedRow.roomTypeId);
        }
        for (const rtId of affectedRoomTypeIds) {
          const rtBeds = await db.select({ status: schema.beds.status }).from(schema.beds).where(eq(schema.beds.roomTypeId, rtId));
          const rtAvail = rtBeds.filter(b => b.status === "available").length;
          await db.update(schema.roomTypes).set({ availableBeds: rtAvail }).where(eq(schema.roomTypes.id, rtId));
        }
      }
    }
  } catch (e) {
    console.error("[Startup] Failed to sync bed occupancy statuses:", e);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      // Start background job for overdue follow-up notifications
      startFollowUpNotificationJob();
      // Start background job for monthly wallet credit renewal
      startWalletCreditRenewalJob();
      // Start background job for nightly bed status reconciliation
      import("./bed-status-reconcile").then(({ startBedStatusReconcileJob }) => {
        startBedStatusReconcileJob();
      }).catch((e) => log(`Failed to start bed status reconcile job: ${e}`, "bed-reconcile"));
      // Start daily cleanup of HMS inbound activity log (~30-day retention)
      startHmsActivityLogCleanupJob();
    },
  );
})();

// Background job: trim hms_activity_log rows older than ~30 days so the
// table stays small. The HMS diagnostics page only ever reads the latest
// 100 rows, so anything older is pure deadweight.
async function startHmsActivityLogCleanupJob() {
  const RETENTION_DAYS = 30;
  const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // every 24h

  async function runCleanup() {
    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const { pruneOldHmsActivity } = await import("./hms-activity-log");
      const removed = await pruneOldHmsActivity(cutoff);
      if (removed > 0) {
        log(`HMS activity log cleanup: removed ${removed} row(s) older than ${RETENTION_DAYS}d`, "background");
      }
    } catch (error) {
      log(`HMS activity log cleanup failed: ${error}`, "background");
    }
  }

  // Run once on startup, then every 24h.
  await runCleanup();
  setInterval(runCleanup, RUN_INTERVAL_MS);
  log(`HMS activity log cleanup job started (runs daily, ${RETENTION_DAYS}d retention)`, "background");
}

// Background job for checking overdue follow-ups and sending notifications
// Track last notification time per user to avoid spamming
const lastNotificationSent = new Map<string, number>();
const NOTIFICATION_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hour cooldown for overdue notifications
const UPCOMING_COOLDOWN_MS = 30 * 60 * 1000; // 30 min cooldown for upcoming follow-up reminders

async function startFollowUpNotificationJob() {
  const CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes
  
  async function checkOverdueFollowUps() {
    try {
      log("Checking for overdue follow-ups...", "background");
      
      // Get all overdue follow-ups (across all sales execs)
      const overdueLeads = await storage.getOverdueFollowUps();
      
      if (overdueLeads.length > 0) {
        log(`Found ${overdueLeads.length} leads with overdue follow-ups`, "background");
        
        // Group leads by assigned exec
        const leadsByExec = new Map<string, typeof overdueLeads>();
        for (const lead of overdueLeads) {
          if (lead.assignedToId) {
            const execId = lead.assignedToId;
            if (!leadsByExec.has(execId)) {
              leadsByExec.set(execId, []);
            }
            leadsByExec.get(execId)!.push(lead);
          }
        }
        
        // Create notifications for each exec with overdue leads (with deduplication)
        for (const [execId, leads] of Array.from(leadsByExec.entries())) {
          const throttleKey = `overdue_${execId}`;
          const lastSent = lastNotificationSent.get(throttleKey) || 0;
          
          if (Date.now() - lastSent > NOTIFICATION_COOLDOWN_MS) {
            await storage.createNotification({
              userId: execId,
              type: "warning",
              title: `${leads.length} overdue follow-ups need attention`,
              message: `You have ${leads.length} leads with overdue follow-ups. Please review and take action.`
            });
            lastNotificationSent.set(throttleKey, Date.now());
            log(`Created overdue notification for exec ${execId} (${leads.length} leads)`, "background");
          } else {
            log(`Skipped overdue notification for exec ${execId} (cooldown active)`, "background");
          }
        }
      }
      
      // Also check upcoming follow-ups (within 1 hour) to send reminder notifications
      const upcomingLeads = await storage.getUpcomingFollowUps(1);
      if (upcomingLeads.length > 0) {
        log(`Found ${upcomingLeads.length} leads with follow-ups in the next hour`, "background");
        
        // Group by exec to send one notification per exec
        const upcomingByExec = new Map<string, typeof upcomingLeads>();
        for (const lead of upcomingLeads) {
          if (lead.assignedToId) {
            if (!upcomingByExec.has(lead.assignedToId)) {
              upcomingByExec.set(lead.assignedToId, []);
            }
            upcomingByExec.get(lead.assignedToId)!.push(lead);
          }
        }
        
        for (const [execId, leads] of Array.from(upcomingByExec.entries())) {
          const throttleKey = `upcoming_${execId}`;
          const lastSent = lastNotificationSent.get(throttleKey) || 0;
          
          if (Date.now() - lastSent > UPCOMING_COOLDOWN_MS) {
            await storage.createNotification({
              userId: execId,
              type: "follow_up",
              title: `${leads.length} follow-ups scheduled soon`,
              message: `You have ${leads.length} follow-ups scheduled within the next hour.`
            });
            lastNotificationSent.set(throttleKey, Date.now());
            log(`Created follow-up reminder for exec ${execId}`, "background");

            try {
              const execUser = await storage.getUser(execId);
              if (execUser?.email) {
                const { sendFollowUpReminderEmail } = await import("./email-service");
                await sendFollowUpReminderEmail(execUser, leads);
                log(`Sent follow-up reminder email to ${execUser.email}`, "background");
              }
            } catch (emailErr) {
              log(`Failed to send follow-up reminder email for exec ${execId}: ${emailErr}`, "background");
            }
          } else {
            log(`Skipped upcoming notification for exec ${execId} (cooldown active)`, "background");
          }
        }
      }
    } catch (error) {
      log(`Error in follow-up notification job: ${error}`, "background");
    }
  }
  
  // Run immediately on startup
  await checkOverdueFollowUps();
  
  // Then run every CHECK_INTERVAL_MS
  setInterval(checkOverdueFollowUps, CHECK_INTERVAL_MS);
  log(`Follow-up notification job started (runs every 15 minutes)`, "background");
}

// Background job for monthly wallet credit auto-renewal
async function startWalletCreditRenewalJob() {
  const RENEWAL_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // Check every 6 hours

  async function renewWalletCredits() {
    try {
      log("Checking for monthly wallet credit renewals...", "background");

      const activeBookingPkgs = await db.select().from(schema.bookingPackages)
        .where(eq(schema.bookingPackages.status, "ACTIVE"));

      if (activeBookingPkgs.length === 0) {
        log("No active booking packages found for renewal", "background");
        return;
      }

      let totalRenewed = 0;

      for (const bp of activeBookingPkgs) {
        if (!bp.packageId) continue;

        const items = await db.select().from(schema.packageItems)
          .where(eq(schema.packageItems.packageId, bp.packageId));
        const alacartItem = items.find(i => i.type === "ala_cart_credit" && i.includedQty > 0);
        if (!alacartItem) continue;

        const now = new Date();
        const startDate = bp.startDate ? new Date(bp.startDate) : bp.createdAt ? new Date(bp.createdAt) : null;
        if (!startDate) continue;

        if (bp.endDate && new Date(bp.endDate) < now) continue;

        const monthsSinceStart = Math.floor(
          (now.getFullYear() - startDate.getFullYear()) * 12 +
          (now.getMonth() - startDate.getMonth())
        );

        if (monthsSinceStart < 1) continue;

        const existingRenewals = await db.select().from(schema.walletLedger)
          .where(and(
            eq(schema.walletLedger.bookingId, bp.bookingId),
            eq(schema.walletLedger.refType, "package_credit_renewal"),
            eq(schema.walletLedger.refId, bp.id),
          ));
        const renewalsApplied = existingRenewals.length;

        if (renewalsApplied >= monthsSinceStart) continue;

        const monthlyLimit = alacartItem.includedQty;

        const allWalletEntries = await db.select().from(schema.walletLedger)
          .where(eq(schema.walletLedger.bookingId, bp.bookingId));

        const packageCreditBalance = allWalletEntries
          .filter(e => e.refType === "package_credit" || e.refType === "package_credit_renewal")
          .reduce((sum, e) => sum + (e.credit || 0), 0);
        const totalDebits = allWalletEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
        const packageBalance = Math.max(0, packageCreditBalance - totalDebits);

        const topUpAmount = Math.max(0, monthlyLimit - packageBalance);

        const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, bp.packageId));
        const pkgName = pkg?.name || "Package";

        const renewalsNeeded = monthsSinceStart - renewalsApplied;
        for (let i = 0; i < renewalsNeeded; i++) {
          const renewalMonth = renewalsApplied + i + 1;
          const creditAmount = i === renewalsNeeded - 1 ? topUpAmount : monthlyLimit;
          if (creditAmount <= 0 && i === renewalsNeeded - 1) {
            await db.insert(schema.walletLedger).values({
              bookingId: bp.bookingId,
              credit: 0,
              debit: 0,
              refType: "package_credit_renewal",
              refId: bp.id,
              note: `Monthly renewal (month ${renewalMonth}) from "${pkgName}" — balance already at ${packageBalance}/${monthlyLimit}, no top-up needed`,
            });
          } else {
            await db.insert(schema.walletLedger).values({
              bookingId: bp.bookingId,
              credit: creditAmount,
              debit: 0,
              refType: "package_credit_renewal",
              refId: bp.id,
              note: `Monthly credit reset (month ${renewalMonth}) from "${pkgName}" — topped up ${creditAmount} to restore ${monthlyLimit}/mo`,
            });
          }
          totalRenewed++;
        }
      }

      if (totalRenewed > 0) {
        log(`Wallet credit renewal complete: ${totalRenewed} renewal(s) applied`, "background");
      } else {
        log("No wallet credit renewals needed", "background");
      }
    } catch (error) {
      log(`Error in wallet credit renewal job: ${error}`, "background");
    }
  }

  await renewWalletCredits();

  setInterval(renewWalletCredits, RENEWAL_CHECK_INTERVAL_MS);
  log(`Wallet credit renewal job started (runs every 6 hours)`, "background");
}
