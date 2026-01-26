import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStudentSchema, signupSchema, loginSchema } from "@shared/schema";
import { z } from "zod";
import { hashPassword, comparePassword, generateToken, verifyToken, authMiddleware, roleMiddleware, getRoleRedirectPath, type AuthRequest } from "./auth";

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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
      const lead = await storage.getLead(req.params.id);
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
      
      const lead = await storage.updateLead(req.params.id, updateData);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  // Track property view and update lead status to "interested"
  app.post("/api/leads/track-property-view", async (req, res) => {
    try {
      const { email, propertyId, propertyName } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email required" });
      }

      const lead = await storage.getLeadByEmail(email.toLowerCase());
      if (lead && lead.status === "new") {
        // Update status to interested when viewing a property
        await storage.updateLead(lead.id, { 
          status: "interested",
          notes: lead.notes 
            ? `${lead.notes}\nViewed property: ${propertyName || propertyId}` 
            : `Viewed property: ${propertyName || propertyId}`,
          lastActivityAt: new Date(),
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking property view:", error);
      res.status(500).json({ error: "Failed to track property view" });
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
        storage.getStudent(booking.studentId),
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
      
      const booking = await storage.updateBooking(req.params.id, {
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
      
      const roomType = await storage.updateRoomTypeAvailability(req.params.id, change);
      
      await storage.createAuditLog({
        adminId,
        action: locked ? "room_locked" : "room_unlocked",
        entityType: "room_type",
        entityId: req.params.id,
        details: JSON.stringify({ action: locked ? "locked" : "unlocked" }),
      });

      res.json(roomType);
    } catch (error) {
      console.error("Error locking/unlocking room:", error);
      res.status(500).json({ error: "Failed to update room" });
    }
  });

  return httpServer;
}
