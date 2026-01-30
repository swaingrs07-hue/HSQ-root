import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "manager", "staff", "sales_executive"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "success", "failed"]);
export const bookingStatusEnum = pgEnum("booking_status", ["draft", "pending_payment", "pending_approval", "confirmed", "active", "completed", "cancelled"]);
export const approvalStatusEnum = pgEnum("approval_status", ["not_required", "pending", "approved", "rejected"]);
export const stayPlanTypeEnum = pgEnum("stay_plan_type", ["academic_year", "monthly", "custom"]);
export const roomTypeEnum = pgEnum("room_type", ["Single", "Shared", "Standard", "Deluxe", "Suite", "Double", "Triple", "Dorm", "Custom"]);
export const propertyCategoryEnum = pgEnum("property_category", ["hotel", "hostel"]);
export const propertyStatusEnum = pgEnum("property_status", ["draft", "published"]);
export const bookingModeEnum = pgEnum("booking_mode", ["academic_year", "monthly"]);
export const nearbyLocationCategoryEnum = pgEnum("nearby_location_category", ["metro", "college", "office", "hospital", "mall", "restaurant", "other"]);

// Users table (for authentication)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  avatarUrl: text("avatar_url"),
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
  displayName: text("display_name"),
  category: propertyCategoryEnum("category").default("hostel"),
  bookingMode: bookingModeEnum("booking_mode").default("monthly").notNull(),
  location: text("location").notNull(),
  address: text("address"),
  city: text("city"),
  phone: text("phone"),
  email: text("email"),
  amenities: text("amenities").array().notNull(),
  rules: text("rules"),
  nearbyLocations: text("nearby_locations"),
  mapsUrl: text("maps_url"),
  imageUrl: text("image_url"),
  customFields: text("custom_fields"),
  status: propertyStatusEnum("status").default("draft"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Global Amenities (reusable across properties)
export const globalAmenities = pgTable("global_amenities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  icon: text("icon"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Property Rules (individual rules per property)
export const propertyRules = pgTable("property_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  rule: text("rule").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Nearby Locations
export const nearbyLocations = pgTable("nearby_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  placeName: text("place_name").notNull(),
  distance: text("distance").notNull(),
  category: nearbyLocationCategoryEnum("category").default("other"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Property Tariffs (Academic Year based pricing)
export const propertyTariffs = pgTable("property_tariffs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  academicYear: text("academic_year").notNull(),
  monthlyPrice: integer("monthly_price").notNull(),
  deposit: integer("deposit").default(0),
  discount: integer("discount").default(0),
  discountLabel: text("discount_label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Room Types for each property
export const roomTypes = pgTable("room_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  name: roomTypeEnum("name").notNull(),
  customName: text("custom_name"),
  basePrice: integer("base_price").notNull(),
  academicYearPrice: integer("academic_year_price"),
  deposit: integer("deposit").default(0),
  size: text("size"),
  occupancy: integer("occupancy").default(1),
  totalRooms: integer("total_rooms").default(1),
  totalBeds: integer("total_beds").notNull(),
  availableBeds: integer("available_beds").notNull(),
  imageUrl: text("image_url"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Property Images
export const propertyImages = pgTable("property_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  isPrimary: boolean("is_primary").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  roomTypeId: varchar("room_type_id").references(() => roomTypes.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bookings table
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingCode: varchar("booking_code").unique(), // Human-readable booking ID like HSQ-2026-0001
  
  // Customer (either student or walk-in)
  studentId: varchar("student_id").references(() => students.id),
  leadId: varchar("lead_id").references(() => leads.id),
  walkInName: text("walk_in_name"),
  walkInPhone: text("walk_in_phone"),
  walkInEmail: text("walk_in_email"),
  
  // Property and room
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  roomTypeId: varchar("room_type_id").references(() => roomTypes.id).notNull(),
  
  // Stay plan
  stayPlanType: stayPlanTypeEnum("stay_plan_type").default("monthly").notNull(),
  checkInDate: text("check_in_date"),
  checkOutDate: text("check_out_date"),
  durationMonths: integer("duration_months"),
  
  // Pricing
  baseFee: integer("base_fee").notNull(),
  discount: integer("discount").default(0).notNull(),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
  totalFee: integer("total_fee").notNull(), // baseFee - discount
  deposit: integer("deposit").default(0),
  
  // Discount details
  discountReason: text("discount_reason"),
  discountApprovedBy: varchar("discount_approved_by").references(() => users.id),
  discountApprovedAt: timestamp("discount_approved_at"),
  
  // Payment plan
  paymentPlanId: text("payment_plan_id").notNull(), // plan-1, plan-2, plan-3
  paymentType: text("payment_type"), // token, partial, full
  
  // Approval workflow
  approvalStatus: approvalStatusEnum("approval_status").default("not_required").notNull(),
  approvalRequired: boolean("approval_required").default(false).notNull(),
  approvalReason: text("approval_reason"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  
  // Created by (Admin or Sales Exec)
  createdBy: varchar("created_by").references(() => users.id),
  assignedSalesExecId: varchar("assigned_sales_exec_id").references(() => users.id),
  
  status: bookingStatusEnum("status").default("draft").notNull(),
  
  // Bed allocation
  bedAllocated: boolean("bed_allocated").default(false).notNull(),
  bedAllocatedAt: timestamp("bed_allocated_at"),
  
  // Agreement
  agreementGenerated: boolean("agreement_generated").default(false).notNull(),
  agreementGeneratedAt: timestamp("agreement_generated_at"),
  agreementUrl: text("agreement_url"),
  signatureData: text("signature_data"), // Base64 signature image
  
  // Invoice
  invoiceGenerated: boolean("invoice_generated").default(false).notNull(),
  invoiceUrl: text("invoice_url"),
  
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

// Lead source enum for tracking where leads come from
export const leadSourceEnum = pgEnum("lead_source", [
  "website",
  "referral", 
  "social_media",
  "google_ads",
  "walk_in",
  "phone_inquiry",
  "email_campaign",
  "event",
  "other"
]);

// Lead status enum for tracking lead progress
export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "interested",
  "site_visit",
  "negotiation",
  "converted",
  "lost",
  "cold",
  "warm",
  "hot",
  "visit_scheduled",
  "deal_closed"
]);

// Lead source enum for manual entry
export const leadEntrySourceEnum = pgEnum("lead_entry_source", [
  "walk_in",
  "call",
  "whatsapp",
  "website",
  "referral",
  "social_media",
  "other"
]);

// Lost reason enum
export const lostReasonEnum = pgEnum("lost_reason", [
  "price_too_high",
  "found_alternative",
  "location_not_suitable",
  "timing_not_right",
  "no_response",
  "budget_constraints",
  "other"
]);

// Lead priority enum for auto-scoring classification
export const leadPriorityEnum = pgEnum("lead_priority", [
  "cold",
  "warm",
  "hot"
]);

// Follow-up status enum
export const followUpStatusEnum = pgEnum("follow_up_status", [
  "pending",
  "completed",
  "overdue",
  "cancelled"
]);

// Leads table (visitor/prospect tracking)
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  
  // Property tracking
  propertyId: varchar("property_id").references(() => properties.id),
  propertyName: text("property_name"),
  
  // Source and status tracking
  source: leadSourceEnum("source").default("website").notNull(),
  entrySource: leadEntrySourceEnum("entry_source"), // for manual leads
  status: leadStatusEnum("status").default("new").notNull(),
  notes: text("notes"),
  
  // Sales Executive assignment
  assignedToId: varchar("assigned_to_id").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  isManualEntry: boolean("is_manual_entry").default(false).notNull(),
  
  // Budget tracking
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  
  // Lost lead tracking
  lostReason: lostReasonEnum("lost_reason"),
  lostNotes: text("lost_notes"),
  
  // Deal closure fields
  dealClosedAt: timestamp("deal_closed_at"),
  finalPrice: integer("final_price"),
  moveInDate: text("move_in_date"),
  selectedRoomTypeId: varchar("selected_room_type_id").references(() => roomTypes.id),
  paymentMode: text("payment_mode"), // UPI, Card, Cash, Bank Transfer
  isLocked: boolean("is_locked").default(false).notNull(), // Lock after deal closure
  
  // Follow-up tracking
  followUpAt: timestamp("follow_up_at"),
  followUpStatus: followUpStatusEnum("follow_up_status"),
  followUpNotes: text("follow_up_notes"),
  
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
  convertedAt: timestamp("converted_at"),
  studentId: varchar("student_id").references(() => students.id),
  
  // Lead Scoring (auto-calculated)
  score: integer("score").default(0).notNull(),
  priority: leadPriorityEnum("priority").default("cold").notNull(),
  signedUp: boolean("signed_up").default(false).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  enquirySubmitted: boolean("enquiry_submitted").default(false).notNull(),
  siteVisitScheduled: boolean("site_visit_scheduled").default(false).notNull(),
  bookingInitiated: boolean("booking_initiated").default(false).notNull(),
  bookingConfirmed: boolean("booking_confirmed").default(false).notNull(),
  discountRequested: boolean("discount_requested").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sales Executive Property Assignments
export const salesExecProperties = pgTable("sales_exec_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  assignedBy: varchar("assigned_by").references(() => users.id).notNull(),
});

// Lead Activities (immutable activity log)
export const leadActivities = pgTable("lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  actorId: varchar("actor_id").references(() => users.id).notNull(),
  actionType: text("action_type").notNull(), // status_change, remark_added, deal_closed, follow_up_set, lead_assigned, lead_created
  previousValue: text("previous_value"), // JSON string
  newValue: text("new_value"), // JSON string
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Lead Remarks (comments on leads)
export const leadRemarks = pgTable("lead_remarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  remark: text("remark").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Notifications
export const notificationTypeEnum = pgEnum("notification_type", ["info", "success", "warning", "error", "lead", "booking", "payment"]);

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: notificationTypeEnum("type").notNull().default("info"),
  isRead: boolean("is_read").default(false).notNull(),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  student: one(students, {
    fields: [users.id],
    references: [students.userId],
  }),
  assignedProperties: many(salesExecProperties),
  assignedLeads: many(leads),
}));

export const salesExecPropertiesRelations = relations(salesExecProperties, ({ one }) => ({
  user: one(users, {
    fields: [salesExecProperties.userId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [salesExecProperties.propertyId],
    references: [properties.id],
  }),
}));

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  lead: one(leads, {
    fields: [leadActivities.leadId],
    references: [leads.id],
  }),
  actor: one(users, {
    fields: [leadActivities.actorId],
    references: [users.id],
  }),
}));

export const leadRemarksRelations = relations(leadRemarks, ({ one }) => ({
  lead: one(leads, {
    fields: [leadRemarks.leadId],
    references: [leads.id],
  }),
  user: one(users, {
    fields: [leadRemarks.userId],
    references: [users.id],
  }),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  property: one(properties, {
    fields: [leads.propertyId],
    references: [properties.id],
  }),
  assignedTo: one(users, {
    fields: [leads.assignedToId],
    references: [users.id],
  }),
  selectedRoomType: one(roomTypes, {
    fields: [leads.selectedRoomTypeId],
    references: [roomTypes.id],
  }),
  activities: many(leadActivities),
  remarks: many(leadRemarks),
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
  lead: one(leads, {
    fields: [bookings.leadId],
    references: [leads.id],
  }),
  property: one(properties, {
    fields: [bookings.propertyId],
    references: [properties.id],
  }),
  roomType: one(roomTypes, {
    fields: [bookings.roomTypeId],
    references: [roomTypes.id],
  }),
  createdByUser: one(users, {
    fields: [bookings.createdBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [bookings.approvedBy],
    references: [users.id],
  }),
  salesExec: one(users, {
    fields: [bookings.assignedSalesExecId],
    references: [users.id],
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
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^[0-9]+$/, "Phone number must contain only digits"),
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
export const insertBookingSchema = createInsertSchema(bookings).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  agreementGenerated: true, 
  agreementGeneratedAt: true, 
  bedAllocated: true,
  bedAllocatedAt: true,
  invoiceGenerated: true,
  invoiceUrl: true,
});

// Booking creation schema for API validation
export const createBookingSchema = z.object({
  leadId: z.string().optional(),
  walkInName: z.string().optional(),
  walkInPhone: z.string().optional(),
  walkInEmail: z.string().email().optional().or(z.literal("")),
  propertyId: z.string().min(1, "Property is required"),
  roomTypeId: z.string().min(1, "Room type is required"),
  stayPlanType: z.enum(["academic_year", "monthly", "custom"]),
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  durationMonths: z.number().min(1).optional(),
  baseFee: z.number().min(0),
  discount: z.number().min(0).default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  discountReason: z.string().optional(),
  deposit: z.number().min(0).default(0),
  paymentPlanId: z.string().min(1, "Payment plan is required"),
  paymentType: z.enum(["token", "partial", "full"]).optional(),
});
export const insertInstallmentSchema = createInsertSchema(installments).omit({ id: true, createdAt: true, paid: true, paidAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, firstLoginAt: true, lastActivityAt: true, loginCount: true, phoneVerified: true, convertedToStudent: true });

// New property-related schemas
export const insertGlobalAmenitySchema = createInsertSchema(globalAmenities).omit({ id: true, createdAt: true });
export const insertPropertyRuleSchema = createInsertSchema(propertyRules).omit({ id: true, createdAt: true });
export const insertNearbyLocationSchema = createInsertSchema(nearbyLocations).omit({ id: true, createdAt: true });
export const insertPropertyTariffSchema = createInsertSchema(propertyTariffs).omit({ id: true, createdAt: true });
export const insertPropertyImageSchema = createInsertSchema(propertyImages).omit({ id: true, createdAt: true });

// Sales Executive schemas
export const insertSalesExecPropertySchema = createInsertSchema(salesExecProperties).omit({ id: true, assignedAt: true });
export const insertLeadActivitySchema = createInsertSchema(leadActivities).omit({ id: true, createdAt: true });
export const insertLeadRemarkSchema = createInsertSchema(leadRemarks).omit({ id: true, createdAt: true });

// Manual lead entry schema
export const manualLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email().optional().or(z.literal("")),
  propertyId: z.string().min(1, "Property is required"),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  entrySource: z.enum(["walk_in", "call", "whatsapp", "website", "referral", "social_media", "other"]),
  notes: z.string().optional(),
});

// Deal closure schema
export const dealClosureSchema = z.object({
  finalPrice: z.number().min(1, "Final price is required"),
  moveInDate: z.string().min(1, "Move-in date is required"),
  selectedRoomTypeId: z.string().min(1, "Room selection is required"),
  paymentMode: z.enum(["upi", "card", "cash", "bank_transfer", "cheque"]),
});

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

export type GlobalAmenity = typeof globalAmenities.$inferSelect;
export type InsertGlobalAmenity = z.infer<typeof insertGlobalAmenitySchema>;

export type PropertyRule = typeof propertyRules.$inferSelect;
export type InsertPropertyRule = z.infer<typeof insertPropertyRuleSchema>;

export type NearbyLocation = typeof nearbyLocations.$inferSelect;
export type InsertNearbyLocation = z.infer<typeof insertNearbyLocationSchema>;

export type PropertyTariff = typeof propertyTariffs.$inferSelect;
export type InsertPropertyTariff = z.infer<typeof insertPropertyTariffSchema>;

export type PropertyImage = typeof propertyImages.$inferSelect;
export type InsertPropertyImage = z.infer<typeof insertPropertyImageSchema>;

export type SalesExecProperty = typeof salesExecProperties.$inferSelect;
export type InsertSalesExecProperty = z.infer<typeof insertSalesExecPropertySchema>;

export type LeadActivity = typeof leadActivities.$inferSelect;
export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;

export type LeadRemark = typeof leadRemarks.$inferSelect;
export type InsertLeadRemark = z.infer<typeof insertLeadRemarkSchema>;

export type ManualLead = z.infer<typeof manualLeadSchema>;
export type DealClosure = z.infer<typeof dealClosureSchema>;

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
