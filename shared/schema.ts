import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "manager", "staff"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "success", "failed"]);
export const bookingStatusEnum = pgEnum("booking_status", ["pending_payment", "active", "completed", "cancelled"]);
export const roomTypeEnum = pgEnum("room_type", ["Single", "Shared"]);

// Users table (for authentication)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Students table (detailed student information)
export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  
  // Address
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),
  
  // Emergency Contact
  emergencyName: text("emergency_name").notNull(),
  emergencyRelation: text("emergency_relation").notNull(),
  emergencyPhone: text("emergency_phone").notNull(),
  
  // Academic Details
  collegeName: text("college_name").notNull(),
  course: text("course").notNull(),
  year: text("year").notNull(),
  
  // ID Proof (file path or URL)
  idProofUrl: text("id_proof_url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Properties table
export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  location: text("location").notNull(),
  amenities: text("amenities").array().notNull(), // Array of amenities
  imageUrl: text("image_url"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Room Types for each property
export const roomTypes = pgTable("room_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  name: roomTypeEnum("name").notNull(),
  basePrice: integer("base_price").notNull(), // Total annual fee
  totalBeds: integer("total_beds").notNull(),
  availableBeds: integer("available_beds").notNull(),
  imageUrl: text("image_url"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bookings table
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").references(() => students.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  roomTypeId: varchar("room_type_id").references(() => roomTypes.id).notNull(),
  
  // Pricing
  baseFee: integer("base_fee").notNull(),
  discount: integer("discount").default(0).notNull(),
  totalFee: integer("total_fee").notNull(), // baseFee - discount
  
  // Discount details
  discountReason: text("discount_reason"),
  discountApprovedBy: varchar("discount_approved_by").references(() => users.id),
  discountApprovedAt: timestamp("discount_approved_at"),
  
  // Payment plan
  paymentPlanId: text("payment_plan_id").notNull(), // plan-1, plan-2, plan-3
  
  status: bookingStatusEnum("status").default("pending_payment").notNull(),
  
  // Agreement
  agreementGenerated: boolean("agreement_generated").default(false).notNull(),
  agreementGeneratedAt: timestamp("agreement_generated_at"),
  agreementUrl: text("agreement_url"),
  signatureData: text("signature_data"), // Base64 signature image
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Installments (scheduled payments)
export const installments = pgTable("installments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => bookings.id).notNull(),
  
  name: text("name").notNull(), // "Booking Amount", "1st Installment", etc.
  amount: integer("amount").notNull(),
  dueDate: text("due_date").notNull(), // "Immediate", "Move-in Date", "October 1st"
  
  paid: boolean("paid").default(false).notNull(),
  paidAt: timestamp("paid_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Payments table (actual payment transactions)
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => bookings.id).notNull(),
  installmentId: varchar("installment_id").references(() => installments.id),
  
  amount: integer("amount").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  
  // Payment gateway details
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySignature: text("razorpay_signature"),
  
  // Metadata
  paymentMethod: text("payment_method"), // UPI, Card, Net Banking
  failureReason: text("failure_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audit log for admin actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // "discount_applied", "room_locked", etc.
  entityType: text("entity_type").notNull(), // "booking", "room", etc.
  entityId: varchar("entity_id").notNull(),
  details: text("details").notNull(), // JSON string with details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Leads table (visitor/prospect tracking)
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  
  // Login tracking
  firstLoginAt: timestamp("first_login_at").defaultNow().notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  loginCount: integer("login_count").default(1).notNull(),
  
  // Device/IP info
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"), // mobile, desktop, tablet
  
  // Conversion tracking
  convertedToStudent: boolean("converted_to_student").default(false).notNull(),
  studentId: varchar("student_id").references(() => students.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  student: one(students, {
    fields: [users.id],
    references: [students.userId],
  }),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  bookings: many(bookings),
}));

export const propertiesRelations = relations(properties, ({ many }) => ({
  roomTypes: many(roomTypes),
  bookings: many(bookings),
}));

export const roomTypesRelations = relations(roomTypes, ({ one, many }) => ({
  property: one(properties, {
    fields: [roomTypes.propertyId],
    references: [properties.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  student: one(students, {
    fields: [bookings.studentId],
    references: [students.id],
  }),
  property: one(properties, {
    fields: [bookings.propertyId],
    references: [properties.id],
  }),
  roomType: one(roomTypes, {
    fields: [bookings.roomTypeId],
    references: [roomTypes.id],
  }),
  installments: many(installments),
  payments: many(payments),
}));

export const installmentsRelations = relations(installments, ({ one }) => ({
  booking: one(bookings, {
    fields: [installments.bookingId],
    references: [bookings.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
  installment: one(installments, {
    fields: [payments.installmentId],
    references: [installments.id],
  }),
}));

// Insert/Select Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, isActive: true });

// Signup validation schema with strict rules
export const signupSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email format").transform(val => val.toLowerCase().trim()),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

// Login validation schema
export const loginSchema = z.object({
  email: z.string().email("Invalid email format").transform(val => val.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, createdAt: true, phoneVerified: true });
export const insertPropertySchema = createInsertSchema(properties).omit({ id: true, createdAt: true, active: true });
export const insertRoomTypeSchema = createInsertSchema(roomTypes).omit({ id: true, createdAt: true, active: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true, updatedAt: true, agreementGenerated: true, agreementGeneratedAt: true, status: true });
export const insertInstallmentSchema = createInsertSchema(installments).omit({ id: true, createdAt: true, paid: true, paidAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, firstLoginAt: true, lastActivityAt: true, loginCount: true, phoneVerified: true, convertedToStudent: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;

export type RoomType = typeof roomTypes.$inferSelect;
export type InsertRoomType = z.infer<typeof insertRoomTypeSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export type Installment = typeof installments.$inferSelect;
export type InsertInstallment = z.infer<typeof insertInstallmentSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
