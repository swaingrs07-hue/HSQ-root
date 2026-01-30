import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStudentSchema, signupSchema, loginSchema, manualLeadSchema, dealClosureSchema, insertLeadRemarkSchema } from "@shared/schema";
import { z } from "zod";
import { hashPassword, comparePassword, generateToken, verifyToken, authMiddleware, roleMiddleware, getRoleRedirectPath, type AuthRequest } from "./auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

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
      for (const admin of admins.filter((u: any) => u.role === "admin")) {
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes for image uploads
  registerObjectStorageRoutes(app);
  
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
  
  // Get all leads
  app.get("/api/leads", async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Get lead by ID
  app.get("/api/leads/:id", async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id as string);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  // Update lead (update status, notes, source)
  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const { status, notes, source } = req.body;
      const updateData: any = {};
      
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (source) updateData.source = source;
      
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

  // Update lead status only (for Kanban board drag-drop)
  const validLeadStatuses = [
    "new", "contacted", "interested", "site_visit", "negotiation",
    "converted", "lost", "cold", "warm", "hot", "visit_scheduled", "deal_closed"
  ];
  
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
      if (user?.role === "sales_executive" && existingLead.assignedToId !== user.id) {
        return res.status(403).json({ error: "You can only update leads assigned to you" });
      }
      
      const lead = await storage.updateLead(req.params.id as string, { 
        status,
        lastActivityAt: new Date()
      });
      res.json(lead);
    } catch (error) {
      console.error("Error updating lead status:", error);
      res.status(500).json({ error: "Failed to update lead status" });
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
      if (!payload || payload.role !== "admin") {
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
      if (!payload || payload.role !== "admin") {
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
      if (!payload || payload.role !== "admin") {
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
      if (!payload || payload.role !== "admin") {
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
      if (!payload || payload.role !== "admin") {
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
      if (!payload || payload.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      const leads = await storage.getLeadsByProperty(req.params.propertyId as string);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching property leads:", error);
      res.status(500).json({ error: "Failed to fetch property leads" });
    }
  });

  // ============ FOLLOW-UP MANAGEMENT ============

  // Get overdue follow-ups (admin only)
  app.get("/api/leads/follow-ups/overdue", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const payload = req.user;
      if (!payload || (payload.role !== "admin" && payload.role !== "sales_executive")) {
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
      if (!payload || (payload.role !== "admin" && payload.role !== "sales_executive")) {
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
      if (!payload || (payload.role !== "admin" && payload.role !== "sales_executive")) {
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
  app.get("/api/properties", async (req, res) => {
    try {
      const properties = await storage.getAllProperties();
      const propertiesWithRooms = await Promise.all(
        properties.map(async (property) => {
          const roomTypes = await storage.getRoomTypesByProperty(property.id);
          return { ...property, roomTypes };
        })
      );
      res.json(propertiesWithRooms);
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });

  // Get single property
  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      const roomTypes = await storage.getRoomTypesByProperty(property.id);
      res.json({ ...property, roomTypes });
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ error: "Failed to fetch property" });
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

  // Update property (Admin only)
  app.patch("/api/admin/properties/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const id = req.params.id as string;
      const updates = req.body;
      
      const property = await storage.getProperty(id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      const updatedProperty = await storage.updateProperty(id, updates);
      
      // Log the action
      await storage.createAuditLog({
        adminId: (req as AuthRequest).user!.userId,
        action: "UPDATE_PROPERTY",
        entityType: "property",
        entityId: id,
        details: JSON.stringify({ name: property.name, changes: updates }),
      });

      res.json(updatedProperty);
    } catch (error) {
      console.error("Error updating property:", error);
      res.status(500).json({ error: "Failed to update property" });
    }
  });

  // Toggle property active status (Admin only)
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
      } = req.body;

      // Create the property
      const property = await storage.createProperty({
        name,
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

      // Log the action
      await storage.createAuditLog({
        adminId: (req as AuthRequest).user!.userId,
        action: "CREATE_PROPERTY",
        entityType: "property",
        entityId: property.id,
        details: JSON.stringify({ name: property.name, status: property.status }),
      });

      // Return property with all related data
      const propertyRules = await storage.getRulesByProperty(property.id);
      const propertyNearby = await storage.getNearbyLocationsByProperty(property.id);
      const propertyTariffs = await storage.getTariffsByProperty(property.id);
      const propertyRoomTypes = await storage.getRoomTypesByProperty(property.id);

      res.status(201).json({
        ...property,
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
  app.post("/api/bookings", async (req, res) => {
    try {
      const { studentId, propertyId, roomTypeId, baseFee, paymentPlanId, discount, discountReason } = req.body;

      // Validate room availability
      const roomType = await storage.getRoomType(roomTypeId);
      if (!roomType || roomType.availableBeds <= 0) {
        return res.status(400).json({ error: "Room not available" });
      }

      // Calculate total fee
      const totalDiscount = discount || 0;
      const totalFee = baseFee - totalDiscount;

      // Create booking
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

      // Decrease available beds
      await storage.updateRoomTypeAvailability(roomTypeId, -1);

      res.json({ booking, installments });
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(500).json({ error: "Failed to create booking" });
    }
  });

  // Get booking by ID with details
  app.get("/api/bookings/:id", async (req, res) => {
    try {
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
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

  // Get all bookings (admin)
  app.get("/api/bookings", async (req, res) => {
    try {
      const bookings = await storage.getAllBookings();
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  });

  // Get booking by code
  app.get("/api/bookings/code/:code", async (req, res) => {
    try {
      const booking = await storage.getBookingByCode(req.params.code);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }
      res.json(booking);
    } catch (error) {
      console.error("Error fetching booking by code:", error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  });

  // Get bookings by property
  app.get("/api/properties/:propertyId/bookings", async (req, res) => {
    try {
      const bookings = await storage.getBookingsByProperty(req.params.propertyId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching property bookings:", error);
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

  // Get pending approval bookings (admin only)
  app.get("/api/bookings/pending-approval", async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const payload = verifyToken(token);
      if (!payload || payload.role !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const bookings = await storage.getPendingApprovalBookings();
      
      const enrichedBookings = await Promise.all(
        bookings.map(async (booking) => {
          const property = await storage.getProperty(booking.propertyId);
          const roomType = await storage.getRoomType(booking.roomTypeId);
          const createdByUser = booking.createdBy ? await storage.getUser(booking.createdBy) : null;
          
          return {
            ...booking,
            propertyName: property?.name || "Unknown Property",
            roomTypeName: roomType?.name || "Unknown Room",
            createdByName: createdByUser?.name || "Unknown",
          };
        })
      );
      
      res.json(enrichedBookings);
    } catch (error) {
      console.error("Error fetching pending approval bookings:", error);
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
  app.post("/api/bookings/generate", async (req, res) => {
    try {
      const {
        customerType,
        studentId,
        leadId,
        walkInName,
        walkInPhone,
        walkInEmail,
        propertyId,
        roomTypeId,
        stayPlanType,
        checkInDate,
        checkOutDate,
        durationMonths,
        baseFee,
        deposit,
        discount,
        discountReason,
        paymentType,
        paymentPlanId,
        createdBy,
        assignedSalesExecId,
      } = req.body;

      // Validate room availability
      const roomType = await storage.getRoomType(roomTypeId);
      if (!roomType || roomType.availableBeds <= 0) {
        return res.status(400).json({ error: "No beds available for this room type" });
      }

      // Calculate total fee
      const totalDiscount = discount || 0;
      const totalFee = baseFee - totalDiscount;

      // Determine approval requirement based on discount percentage
      const discountPercent = baseFee > 0 ? (totalDiscount / baseFee) * 100 : 0;
      const approvalRequired = discountPercent > 10; // More than 10% discount requires admin approval

      // Determine initial status
      let initialStatus = "draft";
      if (approvalRequired) {
        initialStatus = "pending_approval";
      } else if (paymentType === "full" || paymentType === "partial") {
        initialStatus = "pending_payment";
      }

      // Create booking with code
      const booking = await storage.createBookingWithCode({
        studentId: customerType === "student" ? studentId : null,
        leadId: customerType === "lead" ? leadId : null,
        walkInName: customerType === "walk_in" ? walkInName : null,
        walkInPhone: customerType === "walk_in" ? walkInPhone : null,
        walkInEmail: customerType === "walk_in" ? walkInEmail : null,
        propertyId,
        roomTypeId,
        stayPlanType: stayPlanType || "academic_year",
        checkInDate: checkInDate ? new Date(checkInDate) : null,
        checkOutDate: checkOutDate ? new Date(checkOutDate) : null,
        durationMonths: durationMonths || null,
        baseFee,
        deposit: deposit || 0,
        discount: totalDiscount,
        totalFee,
        paymentPlanId: paymentPlanId || null,
        paymentType: paymentType || "full",
        discountReason: discountReason || null,
        discountApprovedBy: null,
        discountApprovedAt: null,
        status: initialStatus,
        approvalRequired,
        approvalStatus: approvalRequired ? "pending" : "not_required",
        createdBy: createdBy || null,
        assignedSalesExecId: assignedSalesExecId || null,
        agreementUrl: null,
        signatureData: null,
      });

      // If lead conversion, update lead status
      if (customerType === "lead" && leadId) {
        await storage.updateLead(leadId, { status: "converted" });
      }

      res.json({ booking, requiresApproval: approvalRequired });
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
      if (!payload || payload.role !== "admin") {
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
      if (!payload || payload.role !== "admin") {
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
  app.post("/api/bookings/:id/confirm", async (req, res) => {
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

      const confirmed = await storage.confirmBooking(req.params.id, approvedBy);
      res.json(confirmed);
    } catch (error: any) {
      console.error("Error confirming booking:", error);
      res.status(500).json({ error: error.message || "Failed to confirm booking" });
    }
  });

  // Cancel booking
  app.post("/api/bookings/:id/cancel", async (req, res) => {
    try {
      const { reason } = req.body;
      
      const booking = await storage.getBooking(req.params.id);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const cancelled = await storage.cancelBooking(req.params.id, reason);
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

      // Simulate payment processing
      const payment = await storage.createPayment({
        bookingId,
        installmentId: installmentId || null,
        amount,
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

  // ============ PROPERTY-SALES EXEC MANAGEMENT ============

  // Get all property-sales exec assignments
  app.get("/api/admin/property-assignments", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const assignments = await storage.getAllPropertyAssignments();
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching property assignments:", error);
      res.status(500).json({ error: "Failed to fetch property assignments" });
    }
  });

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

  // Assign sales exec to property
  app.post("/api/admin/property-assignments", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const { propertyId, salesExecId } = req.body;

      if (!propertyId || !salesExecId) {
        return res.status(400).json({ error: "Property ID and Sales Exec ID are required" });
      }

      const assignment = await storage.assignPropertyToUser({
        propertyId,
        userId: salesExecId,
        assignedBy: authReq.user!.userId,
        isActive: true,
      });

      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error assigning property:", error);
      res.status(500).json({ error: "Failed to assign property" });
    }
  });

  // Remove sales exec from property
  app.delete("/api/admin/property-assignments/:propertyId/:salesExecId", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      await storage.removePropertyAssignment(req.params.salesExecId, req.params.propertyId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing property assignment:", error);
      res.status(500).json({ error: "Failed to remove assignment" });
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
      const salesExec = await storage.getSalesExecWithLeastLeads(lead.propertyId);
      
      if (!salesExec) {
        // No sales exec mapped - mark as unassigned
        const updatedLead = await storage.updateLead(leadId, {
          assignmentType: "unassigned",
        });
        
        // Create notification for admin
        const admins = await storage.getSalesExecutives();
        for (const admin of admins.filter(u => u.role === "admin")) {
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

      // Assign to sales exec
      const authReq = req as AuthRequest;
      const updatedLead = await storage.updateLead(leadId, {
        assignedToId: salesExec.id,
        assignedAt: new Date(),
        assignmentType: "property_auto",
      });

      // Log activity
      await storage.createLeadActivity({
        leadId,
        actorId: authReq.user!.userId,
        actionType: "lead_reassigned",
        newValue: JSON.stringify({ salesExecId: salesExec.id, type: "property_auto" }),
        description: `Auto-assigned to ${salesExec.name} based on property mapping`,
      });

      // Notify sales exec
      await storage.createNotification({
        userId: salesExec.id,
        title: "New Lead Assigned",
        message: `Lead "${lead.name}" has been auto-assigned to you.`,
        type: "lead",
        actionUrl: "/sales/requests",
      });

      res.json({ ...updatedLead, assignedExec: salesExec, assignmentType: "property_auto" });
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
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
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

  // Lock/unlock room
  app.patch("/api/admin/rooms/:id/lock", async (req, res) => {
    try {
      const { locked, adminId } = req.body;
      const change = locked ? -1 : 1;
      
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
  app.get("/api/admin/sales-executives", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const salesExecs = await storage.getSalesExecutives();
      
      // Get stats and assigned properties for each sales exec
      const execsWithData = await Promise.all(salesExecs.map(async (exec) => {
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

  // Assign property to sales executive (admin only)
  app.post("/api/admin/property-assignments", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { userId, propertyId } = req.body;
      const authReq = req as AuthRequest;
      
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
        details: JSON.stringify({ userId, propertyId }),
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
      
      const lead = await storage.assignLeadToUser(leadId, userId, authReq.user!.userId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      res.json(lead);
    } catch (error) {
      console.error("Error assigning lead:", error);
      res.status(500).json({ error: "Failed to assign lead" });
    }
  });

  // Reassign lead (admin only)
  app.post("/api/admin/leads/:id/reassign", authMiddleware, roleMiddleware("admin"), async (req, res) => {
    try {
      const { userId } = req.body;
      const authReq = req as AuthRequest;
      
      const lead = await storage.reassignLead(req.params.id as string, userId, authReq.user!.userId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      res.json(lead);
    } catch (error) {
      console.error("Error reassigning lead:", error);
      res.status(500).json({ error: "Failed to reassign lead" });
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
        } catch (err) {
          results.errors.push(`Failed to assign lead ${leadId}`);
        }
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
          activeLeadCount: assignedLeads.filter(l => !["converted", "lost", "deal_closed"].includes(l.status)).length
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
  app.get("/api/sales/properties", authMiddleware, roleMiddleware("sales_executive"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const properties = await storage.getAssignedPropertiesForUser(authReq.user!.userId);
      res.json(properties);
    } catch (error) {
      console.error("Error fetching assigned properties:", error);
      res.status(500).json({ error: "Failed to fetch assigned properties" });
    }
  });

  // Get leads scoped to sales exec's assigned properties
  app.get("/api/sales/leads", authMiddleware, roleMiddleware("sales_executive"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user!.userId;
      
      // Get assigned property IDs for this sales exec
      const assignedProperties = await storage.getAssignedPropertiesForUser(userId);
      const assignedPropertyIds = assignedProperties.map(p => p.id);
      
      if (assignedPropertyIds.length === 0) {
        return res.json([]);
      }
      
      // Get leads that are either:
      // 1. Assigned to this sales exec, OR
      // 2. For their assigned properties (even if not yet assigned to them)
      const leads = await storage.getLeadsForAssignedProperties(userId, assignedPropertyIds);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Get assigned properties for current sales exec
  app.get("/api/sales/my-properties", authMiddleware, roleMiddleware("sales_executive"), async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      const properties = await storage.getAssignedPropertiesForUser(authReq.user!.userId);
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
      const leads = await storage.getLeadsForSalesExec(authReq.user!.userId);
      res.json(leads);
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
        assignedToId: authReq.user!.userId,
        assignedAt: new Date(),
        assignmentType: authReq.user!.role === "admin" ? "admin_manual" : "property_auto", // Sales exec creates = auto assignment, Admin creates = manual
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
      
      if (status === "cold") { newScore = Math.max(0, newScore); newPriority = "cold"; }
      else if (status === "warm") { newScore = Math.min(60, Math.max(31, newScore + 10)); newPriority = "warm"; }
      else if (status === "hot") { newScore = Math.min(100, Math.max(61, newScore + 20)); newPriority = "hot"; }
      else if (status === "visit_scheduled") { newScore = Math.min(100, newScore + 25); newPriority = newScore > 60 ? "hot" : "warm"; }
      else if (status === "negotiation") { newScore = Math.min(100, newScore + 30); newPriority = "hot"; }
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
      
      res.status(201).json(createdRemark);
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
      
      res.json({ lead, activities, remarks, property, roomTypes });
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

  return httpServer;
}
