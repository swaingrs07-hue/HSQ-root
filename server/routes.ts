import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStudentSchema } from "@shared/schema";
import { z } from "zod";

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
  
  // Admin login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Simple password check (in production, use bcrypt)
      if (user.password !== password) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (user.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Login failed" });
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

      // Create user account
      const user = await storage.createUser({
        email: req.body.email,
        password: "temp123",
        role: "student",
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
