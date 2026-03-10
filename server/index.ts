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

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

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
    },
  );
})();

// Background job for checking overdue follow-ups and sending notifications
// Track last notification time per user to avoid spamming
const lastNotificationSent = new Map<string, number>();
const NOTIFICATION_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hour cooldown between same notification types

async function startFollowUpNotificationJob() {
  const CHECK_INTERVAL_MS = 30 * 60 * 1000; // Check every 30 minutes
  
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
          
          if (Date.now() - lastSent > NOTIFICATION_COOLDOWN_MS) {
            await storage.createNotification({
              userId: execId,
              type: "follow_up",
              title: `${leads.length} follow-ups scheduled soon`,
              message: `You have ${leads.length} follow-ups scheduled within the next hour.`
            });
            lastNotificationSent.set(throttleKey, Date.now());
            log(`Created follow-up reminder for exec ${execId}`, "background");
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
  log(`Follow-up notification job started (runs every 30 minutes)`, "background");
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

        const existingCredits = await db.select().from(schema.walletLedger)
          .where(and(
            eq(schema.walletLedger.bookingId, bp.bookingId),
            eq(schema.walletLedger.refType, "package_credit_renewal"),
          ));

        const now = new Date();
        const startDate = bp.startDate ? new Date(bp.startDate) : bp.createdAt ? new Date(bp.createdAt) : null;
        if (!startDate) continue;

        if (bp.endDate && new Date(bp.endDate) < now) continue;

        const monthsSinceStart = Math.floor(
          (now.getFullYear() - startDate.getFullYear()) * 12 +
          (now.getMonth() - startDate.getMonth())
        );

        if (monthsSinceStart < 1) continue;

        const renewalCredits = existingCredits.filter(c =>
          c.refId === bp.id && c.refType === "package_credit_renewal"
        );
        const renewalsApplied = renewalCredits.length;

        if (renewalsApplied >= monthsSinceStart) continue;

        const renewalsNeeded = monthsSinceStart - renewalsApplied;
        const [pkg] = await db.select().from(schema.packages).where(eq(schema.packages.id, bp.packageId));
        const pkgName = pkg?.name || "Package";

        for (let i = 0; i < renewalsNeeded; i++) {
          const renewalMonth = renewalsApplied + i + 1;
          await db.insert(schema.walletLedger).values({
            bookingId: bp.bookingId,
            credit: alacartItem.includedQty,
            debit: 0,
            refType: "package_credit_renewal",
            refId: bp.id,
            note: `Monthly credit renewal (month ${renewalMonth}) from "${pkgName}"`,
          });
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
