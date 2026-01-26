import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStudentSchema, signupSchema, loginSchema } from "@shared/schema";
import { z } from "zod";
import { hashPassword, comparePassword, generateToken, verifyToken, authMiddleware, roleMiddleware, getRoleRedirectPath, type AuthRequest } from "./auth";

// Server-side OTP storage for signup flow (in production, use Redis or database with TTL)
interface SignupOtpEntry {
  otp: string;
  phone: string;
  expiresAt: number;
  verified: boolean;
}
const signupOtpStore = new Map<string, SignupOtpEntry>();

function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function cleanupExpiredSignupOtps() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  signupOtpStore.forEach((entry, key) => {
    if (entry.expiresAt < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => signupOtpStore.delete(key));
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ============ AUTH ============
  
  // Send OTP for phone verification (signup flow)
  app.post("/api/auth/send-otp", async (req, res) => {
    try {
      const { phone } = req.body;
      
      if (!phone || phone.length < 10 || !/^[0-9]+$/.test(phone)) {
        return res.status(400).json({ error: "Invalid phone number" });
      }

      cleanupExpiredSignupOtps();
      
      const otp = generateOtp();
      const sessionId = `otp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      signupOtpStore.set(sessionId, {
        otp,
        phone,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes expiry
        verified: false,
      });

      // In production, send OTP via SMS (Twilio, MSG91, etc.)
      // For demo, we'll log it and return it in response
      console.log(`OTP for ${phone}: ${otp}`);

      res.json({ 
        success: true, 
        sessionId,
        message: "OTP sent successfully",
        // Only include OTP in development for testing
        ...(process.env.NODE_ENV !== "production" && { otp })
      });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ error: "Failed to send OTP" });
    }
  });

  // Verify OTP (signup flow)
  app.post("/api/auth/verify-otp", async (req, res) => {
    try {
      const { sessionId, otp } = req.body;
      
      if (!sessionId || !otp) {
        return res.status(400).json({ error: "Session ID and OTP are required" });
      }

      const entry = signupOtpStore.get(sessionId);
      
      if (!entry) {
        return res.status(400).json({ error: "Invalid or expired session" });
      }

      if (entry.expiresAt < Date.now()) {
        signupOtpStore.delete(sessionId);
        return res.status(400).json({ error: "OTP has expired" });
      }

      if (entry.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      // Mark as verified
      entry.verified = true;
      signupOtpStore.set(sessionId, entry);

      res.json({ 
        success: true, 
        phone: entry.phone,
        message: "Phone verified successfully" 
      });
    } catch (error) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // Sign up - Create new user account
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const validationResult = signupSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(e => e.message);
        return res.status(400).json({ error: errors[0], details: errors });
      }

      const { name, email, phone, password } = validationResult.data;
      const { otpSessionId } = req.body;

      // Verify phone via OTP session (server-side verification)
      let phoneVerified = false;
      if (otpSessionId) {
        const otpEntry = signupOtpStore.get(otpSessionId);
        if (otpEntry && otpEntry.verified && otpEntry.phone === phone && otpEntry.expiresAt > Date.now()) {
          phoneVerified = true;
          signupOtpStore.delete(otpSessionId); // Clean up used session
        }
      }

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
        phoneVerified,
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

  // Get lead analytics
  app.get("/api/leads/analytics/summary", async (req, res) => {
    try {
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
