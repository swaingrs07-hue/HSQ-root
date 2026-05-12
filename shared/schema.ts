import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean, pgEnum, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["user", "admin", "superadmin", "manager", "staff", "sales_executive", "receptionist", "frontdesk", "hotel_admin", "hotel_staff"]);
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
  deactivatedAt: timestamp("deactivated_at"),
  deactivatedBy: varchar("deactivated_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  canApproveBookings: boolean("can_approve_bookings").default(false).notNull(),
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
  slug: varchar("slug", { length: 255 }),
  displayName: text("display_name"),
  propertyCode: text("property_code"),
  hmsPropertyId: integer("hms_property_id"),
  hmsPropertyName: text("hms_property_name"),
  hmsLinked: boolean("hms_linked").default(false).notNull(),
  category: propertyCategoryEnum("category").default("hostel"),
  bookingMode: bookingModeEnum("booking_mode").default("monthly").notNull(),
  location: text("location").notNull(),
  address: text("address"),
  city: text("city"),
  phone: text("phone"),
  alternatePhone: text("alternate_phone"),
  email: text("email"),
  amenities: text("amenities").array().notNull(),
  rules: text("rules"),
  nearbyLocations: text("nearby_locations"),
  mapsUrl: text("maps_url"),
  imageUrl: text("image_url"),
  customFields: text("custom_fields"),
  status: propertyStatusEnum("status").default("draft"),
  active: boolean("active").default(true).notNull(),
  tourOverviewImages: text("tour_overview_images"),
  tourRoomsImages: text("tour_rooms_images"),
  tourAmenitiesImages: text("tour_amenities_images"),
  tourLocationImages: text("tour_location_images"),
  mapLatitude: text("map_latitude"),
  mapLongitude: text("map_longitude"),
  virtualTourUrl: text("virtual_tour_url"),
  virtualTourProvider: text("virtual_tour_provider"),
  highlights: text("highlights").array(),
  includedServices: jsonb("included_services"),
  moveInCharges: jsonb("move_in_charges"),
  brochureDownloadCount: integer("brochure_download_count").default(0).notNull(),
  brochureLastDownloadedAt: timestamp("brochure_last_downloaded_at"),
  brochureCoverImage: text("brochure_cover_image"),
  brochureTagline: text("brochure_tagline"),
  brochureIntro: text("brochure_intro"),
  brochureAgentName: text("brochure_agent_name"),
  brochureAgentPhone: text("brochure_agent_phone"),
  featuredAmenityIds: text("featured_amenity_ids").array(),
  featuredRoomTypeIds: text("featured_room_type_ids").array(),
  isSoldOut: boolean("is_sold_out").default(false).notNull(),
  soldOutNote: text("sold_out_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Global Amenities (reusable across properties)
export const globalAmenities = pgTable("global_amenities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  icon: text("icon"),
  category: text("category"),
  type: text("type").default("amenity"),
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
  // Optional shared-WC pricing variant — used when the room (or section) has a shared washroom.
  // If null, falls back to the default price above.
  basePriceShared: integer("base_price_shared"),
  academicYearPriceShared: integer("academic_year_price_shared"),
  depositShared: integer("deposit_shared"),
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
  bookingNature: text("booking_nature"), // "new" | "retention"
  customerType: text("customer_type"),
  studentId: varchar("student_id").references(() => students.id),
  leadId: varchar("lead_id").references(() => leads.id),
  walkInName: text("walk_in_name"),
  walkInPhone: text("walk_in_phone"),
  walkInEmail: text("walk_in_email"),
  referrer: text("referrer"),
  
  // Property and room
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  roomTypeId: varchar("room_type_id").references(() => roomTypes.id).notNull(),
  
  // Stay plan
  stayPlanType: stayPlanTypeEnum("stay_plan_type").default("monthly").notNull(),
  academicYearPeriod: text("academic_year_period"),
  checkInDate: text("check_in_date"),
  checkOutDate: text("check_out_date"),
  durationMonths: integer("duration_months"),
  
  // Pricing
  baseFee: integer("base_fee").notNull(),
  discount: integer("discount").default(0).notNull(),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default("0"),
  totalFee: integer("total_fee").notNull(), // baseFee - discount
  deposit: integer("deposit").default(0),
  depositType: text("deposit_type"), // cash, online, cheque, paid_last_year, waived — set when admin confirms receipt
  depositProofPath: text("deposit_proof_path"),
  depositTransactionId: text("deposit_transaction_id"),
  depositReceived: boolean("deposit_received").default(false),
  depositRefunded: boolean("deposit_refunded").default(false),
  depositRefundedAt: text("deposit_refunded_at"),
  depositRefundAmount: integer("deposit_refund_amount"),
  depositRefundMethod: text("deposit_refund_method"),
  depositRefundNotes: text("deposit_refund_notes"),

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
  bedId: varchar("bed_id"),
  floorId: varchar("floor_id"),
  roomId: varchar("room_id"),
  
  // Resident details (JSON)
  residentDetails: jsonb("resident_details"),
  
  // Agreement
  agreementGenerated: boolean("agreement_generated").default(false).notNull(),
  agreementGeneratedAt: timestamp("agreement_generated_at"),
  agreementUrl: text("agreement_url"),
  signatureData: text("signature_data"), // Base64 signature image
  
  // Invoice
  invoiceGenerated: boolean("invoice_generated").default(false).notNull(),
  invoiceUrl: text("invoice_url"),

  welcomeEmailSent: boolean("welcome_email_sent").default(false).notNull(),

  // Coupon (Promotion Engine)
  couponId: varchar("coupon_id"),
  couponCode: text("coupon_code"),
  couponDiscount: integer("coupon_discount").default(0),
  couponRedeemedAt: timestamp("coupon_redeemed_at"),

  confirmedBy: varchar("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at"),
  
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
  bookingPackageId: varchar("booking_package_id").references(() => bookingPackages.id),
  
  amount: integer("amount").notNull(),
  status: paymentStatusEnum("status").default("pending").notNull(),
  
  // Payment gateway details
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  razorpaySignature: text("razorpay_signature"),
  
  // Metadata
  paymentMethod: text("payment_method"), // UPI, Card, Net Banking
  failureReason: text("failure_reason"),
  screenshotPath: text("screenshot_path"),
  notes: text("notes"),
  
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
  "phone_call",
  "call",
  "whatsapp",
  "email_campaign",
  "event",
  "chatbot",
  "hsquare_dynamics",
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

// Assignment type enum - how the lead was assigned to a sales executive
export const assignmentTypeEnum = pgEnum("assignment_type", [
  "property_auto",     // Auto-assigned based on property mapping
  "admin_manual",      // Manually assigned by admin
  "unassigned",        // No sales executive mapped - needs action
  "fallback_default"   // Fallback to default catch-all assignee (Bibhuti) when no property mapping exists
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
  assignmentType: assignmentTypeEnum("assignment_type").default("unassigned"),
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
  convertedByUserId: varchar("converted_by_user_id").references(() => users.id),
  linkedBookingId: varchar("linked_booking_id"),
  
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
  
  // UTM tracking for website leads
  utmSource: text("utm_source"),
  utmCampaign: text("utm_campaign"),
  utmMedium: text("utm_medium"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  pageUrl: text("page_url"),
  message: text("message"),

  createdBy: varchar("created_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sales Executive Property Assignments
export const salesExecProperties = pgTable("sales_exec_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
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
export const notificationTypeEnum = pgEnum("notification_type", ["info", "success", "warning", "error", "lead", "booking", "payment", "follow_up"]);

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
  academicYearPeriod: z.string().optional(),
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
  assignToUserId: z.string().optional(),
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

// Activity action type enum
export const activityActionTypeEnum = pgEnum("activity_action_type", [
  "CREATE",
  "UPDATE", 
  "DELETE",
  "DEACTIVATE",
  "ACTIVATE",
  "ASSIGN",
  "UNASSIGN",
  "REASSIGN",
  "LOGIN",
  "LOGOUT",
  "STAGE_CHANGE",
  "STATUS_CHANGE"
]);

// Activity entity type enum
export const activityEntityTypeEnum = pgEnum("activity_entity_type", [
  "USER",
  "SALES_EXECUTIVE",
  "LEAD",
  "REQUEST",
  "PROPERTY",
  "BOOKING",
  "ROOM_TYPE",
  "PAYMENT"
]);

// Activity Logs table for comprehensive audit trail
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  actorName: text("actor_name").notNull(),
  actorRole: text("actor_role").notNull(),
  actionType: activityActionTypeEnum("action_type").notNull(),
  entityType: activityEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  entityLabel: text("entity_label").notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  propertyName: text("property_name"),
  metadataJson: text("metadata_json"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// HMS Inbound Activity Log — persists every inbound HMS hit so the
// superadmin diagnostics page can show traffic across server restarts and
// deploys. Trimmed daily to ~30 days by a background job.
export const hmsActivityLog = pgTable("hms_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  route: text("route").notNull(),
  method: text("method").notNull(),
  status: integer("status").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  hasApiKey: boolean("has_api_key").notNull().default(false),
  identifier: text("identifier"),
  path: text("path"),
  query: jsonb("query"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  // Latest-N reads (`/recent-activity`) and the daily prune scan both
  // sort by timestamp; this keeps both fast as the table grows.
  timestampIdx: index("hms_activity_log_timestamp_idx").on(table.timestamp),
  // Per-route last-hit lookups (`getLastHitsByRoute`) are a tight hot
  // path on the diagnostics page.
  routeTimestampIdx: index("hms_activity_log_route_timestamp_idx").on(table.route, table.timestamp),
}));

export const insertHmsActivityLogSchema = createInsertSchema(hmsActivityLog).omit({ id: true, timestamp: true });
export type HmsActivityLogRow = typeof hmsActivityLog.$inferSelect;
export type InsertHmsActivityLog = z.infer<typeof insertHmsActivityLogSchema>;

// ============ CHATBOT ADMIN CONTROL TABLES ============

// Chatbot tone enum
export const chatbotToneEnum = pgEnum("chatbot_tone", ["professional", "friendly", "sales", "support"]);

// Chatbot knowledge status enum
export const chatbotKnowledgeStatusEnum = pgEnum("chatbot_knowledge_status", ["draft", "published"]);

// Chatbot message role enum
export const chatbotMessageRoleEnum = pgEnum("chatbot_message_role", ["user", "bot"]);

// Chatbot event type enum
export const chatbotEventTypeEnum = pgEnum("chatbot_event_type", ["lead_created", "escalation", "error", "session_start", "session_end"]);

// Chatbot Settings table (global or per-property)
export const chatbotSettings = pgTable("chatbot_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id),
  enabled: boolean("enabled").default(true).notNull(),
  botName: text("bot_name").default("Gyan AI").notNull(),
  greetingMessage: text("greeting_message").default("Hello! I'm Gyan AI, your personal assistant for finding the perfect student accommodation. How can I help you today?").notNull(),
  tone: chatbotToneEnum("tone").default("friendly").notNull(),
  defaultLanguage: text("default_language").default("English").notNull(),
  workingHoursStart: text("working_hours_start").default("09:00"),
  workingHoursEnd: text("working_hours_end").default("21:00"),
  outsideHoursMessage: text("outside_hours_message").default("Thanks for reaching out! Our team is currently away. We'll respond during business hours (9 AM - 9 PM IST)."),
  allowedTopics: text("allowed_topics").array().default(sql`ARRAY['faqs', 'pricing', 'availability', 'booking', 'amenities', 'location']`),
  blockedTopics: text("blocked_topics").array().default(sql`ARRAY[]::text[]`),
  leadCaptureEnabled: boolean("lead_capture_enabled").default(true).notNull(),
  leadCaptureOnPricing: boolean("lead_capture_on_pricing").default(true),
  leadCaptureOnAvailability: boolean("lead_capture_on_availability").default(true),
  leadCaptureOnBooking: boolean("lead_capture_on_booking").default(true),
  leadCaptureOnLocation: boolean("lead_capture_on_location").default(true),
  leadCaptureOnContact: boolean("lead_capture_on_contact").default(true),
  requiredLeadFields: text("required_lead_fields").array().default(sql`ARRAY['name', 'phone', 'email']`),
  escalationEnabled: boolean("escalation_enabled").default(true).notNull(),
  escalationTriggerWords: text("escalation_trigger_words").array().default(sql`ARRAY['call me', 'talk to agent', 'speak to human', 'real person']`),
  escalationWhatsapp: text("escalation_whatsapp"),
  escalationEmail: text("escalation_email"),
  rateLimitPerMinute: integer("rate_limit_per_minute").default(10).notNull(),
  spamDetectionEnabled: boolean("spam_detection_enabled").default(true).notNull(),
  allowedDomains: text("allowed_domains").array().default(sql`ARRAY[]::text[]`),
  blockedIps: text("blocked_ips").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Chatbot Knowledge entries (FAQs, property info, policies)
export const chatbotKnowledge = pgTable("chatbot_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id),
  category: text("category").notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  status: chatbotKnowledgeStatusEnum("status").default("draft").notNull(),
  version: integer("version").default(1).notNull(),
  previousVersionId: varchar("previous_version_id"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Chatbot Conversations
export const chatbotConversations = pgTable("chatbot_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  userId: varchar("user_id").references(() => users.id),
  propertyId: varchar("property_id").references(() => properties.id),
  leadId: varchar("lead_id").references(() => leads.id),
  channel: text("channel").default("web").notNull(),
  pageUrl: text("page_url"),
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  device: text("device"),
  ipAddress: text("ip_address"),
  outcome: text("outcome"),
  flagStatus: text("flag_status"),
  messageCount: integer("message_count").default(0).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

// Chatbot Messages
export const chatbotMessages = pgTable("chatbot_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => chatbotConversations.id).notNull(),
  role: chatbotMessageRoleEnum("role").notNull(),
  message: text("message").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chatbot Events (lead creation, escalation, errors)
export const chatbotEvents = pgTable("chatbot_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").references(() => chatbotConversations.id),
  eventType: chatbotEventTypeEnum("event_type").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chatbot schemas and types
export const insertChatbotSettingsSchema = createInsertSchema(chatbotSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type ChatbotSettings = typeof chatbotSettings.$inferSelect;
export type InsertChatbotSettings = z.infer<typeof insertChatbotSettingsSchema>;

export const insertChatbotKnowledgeSchema = createInsertSchema(chatbotKnowledge).omit({ id: true, createdAt: true, updatedAt: true });
export type ChatbotKnowledge = typeof chatbotKnowledge.$inferSelect;
export type InsertChatbotKnowledge = z.infer<typeof insertChatbotKnowledgeSchema>;

export const insertChatbotConversationSchema = createInsertSchema(chatbotConversations).omit({ id: true, startedAt: true });
export type ChatbotConversation = typeof chatbotConversations.$inferSelect;
export type InsertChatbotConversation = z.infer<typeof insertChatbotConversationSchema>;

export const insertChatbotMessageSchema = createInsertSchema(chatbotMessages).omit({ id: true, createdAt: true });
export type ChatbotMessage = typeof chatbotMessages.$inferSelect;
export type InsertChatbotMessage = z.infer<typeof insertChatbotMessageSchema>;

export const insertChatbotEventSchema = createInsertSchema(chatbotEvents).omit({ id: true, createdAt: true });
export type ChatbotEvent = typeof chatbotEvents.$inferSelect;
export type InsertChatbotEvent = z.infer<typeof insertChatbotEventSchema>;

// Instagram Posts Cache (for live Instagram feed on homepage)
export const instagramPosts = pgTable("instagram_posts", {
  id: varchar("id").primaryKey(),
  mediaType: text("media_type").notNull(),
  mediaUrl: text("media_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  caption: text("caption"),
  permalink: text("permalink").notNull(),
  instagramTimestamp: timestamp("instagram_timestamp").notNull(),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
});

export type InstagramPost = typeof instagramPosts.$inferSelect;

export const instagramSyncLog = pgTable("instagram_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  postCount: integer("post_count").default(0),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
});

// Hero Slides table (for admin-managed homepage carousel)
export const heroSlides = pgTable("hero_slides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  caption: text("caption"),
  imageUrl: text("image_url").notNull(),
  videoUrl: text("video_url"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHeroSlideSchema = createInsertSchema(heroSlides).omit({ id: true, createdAt: true });
export type HeroSlide = typeof heroSlides.$inferSelect;
export type InsertHeroSlide = z.infer<typeof insertHeroSlideSchema>;

// Footer Settings (admin-editable footer content)
export const footerSettings = pgTable("footer_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyDescription: text("company_description").notNull().default("Premium student accommodation designed for comfort, community, and success."),
  email: text("email").notNull().default("support@hsquareliving.com"),
  phone: text("phone").notNull().default("+91 98765 43210"),
  location: text("location").notNull().default("Bangalore, India"),
  copyrightText: text("copyright_text").notNull().default("Hsquareliving Pvt Ltd. All rights reserved."),
  quickLinks: text("quick_links").notNull().default('[{"label":"Properties","href":"/properties"},{"label":"About Us","href":"/about"},{"label":"Contact","href":"/contact"}]'),
  supportLinks: text("support_links").notNull().default('[{"label":"FAQs","href":"/faq"},{"label":"Terms & Conditions","href":"/terms"},{"label":"Privacy Policy","href":"/privacy"}]'),
  socialInstagram: text("social_instagram"),
  socialFacebook: text("social_facebook"),
  socialTwitter: text("social_twitter"),
  socialLinkedin: text("social_linkedin"),
  headerLogo: text("header_logo"),
  footerLogo: text("footer_logo"),
  adminLogo: text("admin_logo"),
  androidDownloadUrl: text("android_download_url"),
  homeHeroVideoUrl: text("home_hero_video_url"),
  homeSectionVideoUrl: text("home_section_video_url"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFooterSettingsSchema = createInsertSchema(footerSettings).omit({ id: true, updatedAt: true });
export type FooterSettings = typeof footerSettings.$inferSelect;
export type InsertFooterSettings = z.infer<typeof insertFooterSettingsSchema>;

export const homepageAmenities = pgTable("homepage_amenities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  icon: text("icon").notNull().default("Star"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHomepageAmenitySchema = createInsertSchema(homepageAmenities).omit({ id: true, createdAt: true, updatedAt: true });
export type HomepageAmenity = typeof homepageAmenities.$inferSelect;
export type InsertHomepageAmenity = z.infer<typeof insertHomepageAmenitySchema>;

// Bed allocation action enum
export const bedAllocationActionEnum = pgEnum("bed_allocation_action", ["allocate", "deallocate", "transfer"]);

// Bed allocations table (tracks which booking occupies which bed and full history)
export const bedAllocations = pgTable("bed_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bedId: varchar("bed_id").notNull(),
  bookingId: varchar("booking_id").notNull(),
  propertyId: varchar("property_id").notNull(),
  floorId: varchar("floor_id").notNull(),
  roomId: varchar("room_id"),
  action: bedAllocationActionEnum("action").notNull(),
  allocatedAt: timestamp("allocated_at").defaultNow().notNull(),
  deallocatedAt: timestamp("deallocated_at"),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  allocatedBy: varchar("allocated_by"),
  deallocatedBy: varchar("deallocated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBedAllocationSchema = createInsertSchema(bedAllocations).omit({ id: true, createdAt: true });
export type BedAllocation = typeof bedAllocations.$inferSelect;
export type InsertBedAllocation = z.infer<typeof insertBedAllocationSchema>;

// Bed status enum
export const bedStatusEnum = pgEnum("bed_status", ["available", "occupied", "reserved", "maintenance", "blocked"]);

// Floors table (for floor-wise property management)
// gender: 'any' | 'male' | 'female' — restricts which guests can be booked on this floor
export const floors = pgTable("floors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  floorNumber: integer("floor_number").notNull(),
  name: text("name").notNull(),
  gender: text("gender").notNull().default("any"),
  totalBeds: integer("total_beds").default(0).notNull(),
  availableBeds: integer("available_beds").default(0).notNull(),
  layoutImage: text("layout_image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Rooms table (room-level grouping between floors and beds)
export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  floorId: varchar("floor_id").references(() => floors.id).notNull(),
  roomTypeId: varchar("room_type_id").references(() => roomTypes.id).notNull(),
  roomNumber: text("room_number").notNull(),
  typology: text("typology").notNull().default("1 Bed"),
  hasSharedWashroom: boolean("has_shared_washroom").default(false).notNull(),
  sharedWashroomSections: text("shared_washroom_sections").array().default(sql`'{}'::text[]`).notNull(),
  flatAmenities: text("flat_amenities").array().default(sql`'{}'::text[]`).notNull(),
  totalBeds: integer("total_beds").default(1).notNull(),
  status: bedStatusEnum("status").default("available").notNull(),
  monthlyPrice: integer("monthly_price"),
  // Per-room price overrides — when set, take precedence over the room type's price.
  basePriceOverride: integer("base_price_override"),
  academicYearPriceOverride: integer("academic_year_price_override"),
  depositOverride: integer("deposit_override"),
  // Per-section overrides for combo rooms (e.g. typology "2+2+3"):
  // { "A": { basePrice?: number, academicYearPrice?: number, deposit?: number }, "B": {...}, ... }
  sectionPriceOverrides: jsonb("section_price_overrides"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Beds table (individual bed tracking)
export const beds = pgTable("beds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  floorId: varchar("floor_id").references(() => floors.id).notNull(),
  roomId: varchar("room_id").references(() => rooms.id),
  roomTypeId: varchar("room_type_id").references(() => roomTypes.id).notNull(),
  bedNumber: text("bed_number").notNull(),
  status: bedStatusEnum("status").default("available").notNull(),
  monthlyPrice: integer("monthly_price"),
  position: jsonb("position"),
  blockedReason: text("blocked_reason"),
  blockedCategory: text("blocked_category"),
  blockedAt: timestamp("blocked_at"),
  blockedBy: varchar("blocked_by"),
  unblockedAt: timestamp("unblocked_at"),
  unblockedBy: varchar("unblocked_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bed block action enum
export const bedBlockActionEnum = pgEnum("bed_block_action", ["block", "unblock"]);

// Bed block logs table (audit trail)
export const bedBlockLogs = pgTable("bed_block_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bedId: varchar("bed_id").references(() => beds.id).notNull(),
  action: bedBlockActionEnum("action").notNull(),
  reason: text("reason"),
  category: text("category"),
  note: text("note"),
  adminId: varchar("admin_id"),
  adminEmail: text("admin_email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const floorsRelations = relations(floors, ({ one, many }) => ({
  property: one(properties, { fields: [floors.propertyId], references: [properties.id] }),
  rooms: many(rooms),
  beds: many(beds),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  property: one(properties, { fields: [rooms.propertyId], references: [properties.id] }),
  floor: one(floors, { fields: [rooms.floorId], references: [floors.id] }),
  roomType: one(roomTypes, { fields: [rooms.roomTypeId], references: [roomTypes.id] }),
  beds: many(beds),
}));

export const bedsRelations = relations(beds, ({ one }) => ({
  property: one(properties, { fields: [beds.propertyId], references: [properties.id] }),
  floor: one(floors, { fields: [beds.floorId], references: [floors.id] }),
  room: one(rooms, { fields: [beds.roomId], references: [rooms.id] }),
  roomType: one(roomTypes, { fields: [beds.roomTypeId], references: [roomTypes.id] }),
}));

export const insertFloorSchema = createInsertSchema(floors).omit({ id: true, createdAt: true });
export type Floor = typeof floors.$inferSelect;
export type InsertFloor = z.infer<typeof insertFloorSchema>;

export const insertRoomSchema = createInsertSchema(rooms).omit({ id: true, createdAt: true });
export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;

export const insertBedSchema = createInsertSchema(beds).omit({ id: true, createdAt: true });
export type Bed = typeof beds.$inferSelect;
export type InsertBed = z.infer<typeof insertBedSchema>;

export const insertBedBlockLogSchema = createInsertSchema(bedBlockLogs).omit({ id: true, createdAt: true });
export type BedBlockLog = typeof bedBlockLogs.$inferSelect;
export type InsertBedBlockLog = z.infer<typeof insertBedBlockLogSchema>;

export interface BedReconciliationPerProperty {
  propertyId: string;
  propertyName: string;
  corrected: number;
  toAvailable: number;
  toOccupied: number;
  toReserved: number;
}

export const bedReconciliationRuns = pgTable("bed_reconciliation_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runAt: timestamp("run_at").defaultNow().notNull(),
  source: text("source").notNull().default("scheduled"),
  totalBedsScanned: integer("total_beds_scanned").notNull().default(0),
  totalCorrected: integer("total_corrected").notNull().default(0),
  affectedFloors: integer("affected_floors").notNull().default(0),
  affectedRoomTypes: integer("affected_room_types").notNull().default(0),
  perProperty: jsonb("per_property").$type<BedReconciliationPerProperty[]>().notNull().default(sql`'[]'::jsonb`),
  triggeredByEmail: text("triggered_by_email"),
});

const bedReconciliationPerPropertySchema = z.object({
  propertyId: z.string(),
  propertyName: z.string(),
  corrected: z.number().int().nonnegative(),
  toAvailable: z.number().int().nonnegative(),
  toOccupied: z.number().int().nonnegative(),
  toReserved: z.number().int().nonnegative(),
});

export const insertBedReconciliationRunSchema = createInsertSchema(bedReconciliationRuns, {
  perProperty: z.array(bedReconciliationPerPropertySchema),
}).omit({ id: true, runAt: true });
export type BedReconciliationRun = typeof bedReconciliationRuns.$inferSelect;
export type InsertBedReconciliationRun = z.infer<typeof insertBedReconciliationRunSchema>;

// ============ PACKAGE MANAGEMENT SYSTEM ============

export const packagePriceTypeEnum = pgEnum("package_price_type", ["ONE_TIME", "PER_DAY", "PER_MONTH", "PER_YEAR"]);
export const packageCategoryEnum = pgEnum("package_category", ["housing_plan", "addon_service"]);
export const packageStatusEnum = pgEnum("package_status", ["active", "inactive"]);
export const bookingPackageStatusEnum = pgEnum("booking_package_status", ["ACTIVE", "ENDED"]);

export const packages = pgTable("packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: "set null" }),
  roomTypeId: varchar("room_type_id").references(() => roomTypes.id, { onDelete: "set null" }),
  linkedRoomTypeIds: text("linked_room_type_ids").array(),
  linkedRoomIds: text("linked_room_ids").array(),
  category: packageCategoryEnum("category").notNull().default("housing_plan"),
  name: text("name").notNull(),
  description: text("description"),
  tagline: text("tagline"),
  priceType: packagePriceTypeEnum("price_type").notNull().default("PER_MONTH"),
  basePrice: integer("base_price").notNull().default(0),
  currency: text("currency").notNull().default("INR"),
  taxPercent: decimal("tax_percent", { precision: 5, scale: 2 }),
  tierLevel: integer("tier_level").notNull().default(0),
  isHighlighted: boolean("is_highlighted").notNull().default(false),
  occupancy: text("occupancy"),
  locationInfo: text("location_info"),
  upgradeDescription: text("upgrade_description"),
  upgradeFee: integer("upgrade_fee"),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const packageItems = pgTable("package_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageId: varchar("package_id").references(() => packages.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  label: text("label").notNull(),
  featureValue: text("feature_value"),
  includedQty: integer("included_qty").notNull().default(0),
  unit: text("unit").notNull().default("unit"),
  extraUnitPrice: integer("extra_unit_price").notNull().default(0),
  rules: jsonb("rules"),
  isOptional: boolean("is_optional").notNull().default(false),
  maxQty: integer("max_qty"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookingPackages = pgTable("booking_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  packageId: varchar("package_id").references(() => packages.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  status: bookingPackageStatusEnum("status").notNull().default("ACTIVE"),
  priceSnapshot: jsonb("price_snapshot"),
  selectedItems: jsonb("selected_items"),
  includeInTotal: boolean("include_in_total").notNull().default(true),
  displayPriceOverride: integer("display_price_override"),
  paidStatus: text("paid_status").notNull().default("pending"),
  paidAmount: integer("paid_amount").notNull().default(0),
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const packageUsage = pgTable("package_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingPackageId: varchar("booking_package_id").references(() => bookingPackages.id, { onDelete: "cascade" }).notNull(),
  bookingId: varchar("booking_id").references(() => bookings.id).notNull(),
  itemType: text("item_type").notNull(),
  qtyUsed: integer("qty_used").notNull().default(1),
  amountCharged: integer("amount_charged").notNull().default(0),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const walletLedger = pgTable("wallet_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  credit: integer("credit").notNull().default(0),
  debit: integer("debit").notNull().default(0),
  refType: text("ref_type"),
  refId: varchar("ref_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const packageUpgrades = pgTable("package_upgrades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  fromPackageId: varchar("from_package_id").references(() => packages.id).notNull(),
  toPackageId: varchar("to_package_id").references(() => packages.id).notNull(),
  fromBookingPackageId: varchar("from_booking_package_id").references(() => bookingPackages.id),
  toBookingPackageId: varchar("to_booking_package_id").references(() => bookingPackages.id),
  priceDifference: integer("price_difference").notNull().default(0),
  upgradeReason: text("upgrade_reason"),
  upgradedBy: varchar("upgraded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const packagesRelations = relations(packages, ({ many }) => ({
  items: many(packageItems),
  bookingPackages: many(bookingPackages),
}));

export const packageItemsRelations = relations(packageItems, ({ one }) => ({
  package: one(packages, { fields: [packageItems.packageId], references: [packages.id] }),
}));

export const bookingPackagesRelations = relations(bookingPackages, ({ one, many }) => ({
  booking: one(bookings, { fields: [bookingPackages.bookingId], references: [bookings.id] }),
  package: one(packages, { fields: [bookingPackages.packageId], references: [packages.id] }),
  usage: many(packageUsage),
}));

export const packageUsageRelations = relations(packageUsage, ({ one }) => ({
  bookingPackage: one(bookingPackages, { fields: [packageUsage.bookingPackageId], references: [bookingPackages.id] }),
  booking: one(bookings, { fields: [packageUsage.bookingId], references: [bookings.id] }),
}));

export const insertPackageSchema = createInsertSchema(packages).omit({ id: true, createdAt: true, updatedAt: true });
export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;

export const insertPackageItemSchema = createInsertSchema(packageItems).omit({ id: true, createdAt: true });
export type PackageItem = typeof packageItems.$inferSelect;
export type InsertPackageItem = z.infer<typeof insertPackageItemSchema>;

export const insertBookingPackageSchema = createInsertSchema(bookingPackages).omit({ id: true, createdAt: true });
export type BookingPackage = typeof bookingPackages.$inferSelect;
export type InsertBookingPackage = z.infer<typeof insertBookingPackageSchema>;

export const insertPackageUsageSchema = createInsertSchema(packageUsage).omit({ id: true, createdAt: true });
export type PackageUsageRecord = typeof packageUsage.$inferSelect;
export type InsertPackageUsage = z.infer<typeof insertPackageUsageSchema>;

export const insertWalletLedgerSchema = createInsertSchema(walletLedger).omit({ id: true, createdAt: true });
export type WalletLedgerEntry = typeof walletLedger.$inferSelect;
export type InsertWalletLedger = z.infer<typeof insertWalletLedgerSchema>;

export const insertPackageUpgradeSchema = createInsertSchema(packageUpgrades).omit({ id: true, createdAt: true });
export type PackageUpgrade = typeof packageUpgrades.$inferSelect;
export type InsertPackageUpgrade = z.infer<typeof insertPackageUpgradeSchema>;

// ============ SEASON / BATCH MANAGEMENT ============

export const seasonStatusEnum = pgEnum("season_status", ["UPCOMING", "ACTIVE", "ENDED"]);
export const residentSeasonStatusEnum = pgEnum("resident_season_status_enum", ["RETAINED", "NOT_RETAINED", "PENDING"]);
export const seasonCloseJobStatusEnum = pgEnum("season_close_job_status", ["PREVIEW", "APPLIED", "FAILED"]);

export const seasons = pgTable("seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  graceDays: integer("grace_days").notNull().default(30),
  status: seasonStatusEnum("status").notNull().default("UPCOMING"),
  nextSeasonId: varchar("next_season_id"),
  hmsSyncStatus: text("hms_sync_status"),
  hmsSyncedAt: timestamp("hms_synced_at"),
  hmsSyncResults: jsonb("hms_sync_results"),
  hmsSyncedBookingCount: integer("hms_synced_booking_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const residentSeasonStatus = pgTable("resident_season_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  seasonId: varchar("season_id").references(() => seasons.id, { onDelete: "cascade" }).notNull(),
  status: residentSeasonStatusEnum("status").notNull().default("PENDING"),
  graceUntil: timestamp("grace_until"),
  decisionReason: text("decision_reason"),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const seasonCloseJobs = pgTable("season_close_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").references(() => seasons.id, { onDelete: "cascade" }).notNull(),
  nextSeasonId: varchar("next_season_id").references(() => seasons.id),
  status: seasonCloseJobStatusEnum("status").notNull().default("PREVIEW"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  appliedAt: timestamp("applied_at"),
  appliedBy: varchar("applied_by").references(() => users.id),
  syncPayload: jsonb("sync_payload"),
  syncResponse: jsonb("sync_response"),
  syncRetries: integer("sync_retries").notNull().default(0),
  syncStatus: text("sync_status"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seasonCloseJobItems = pgTable("season_close_job_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").references(() => seasonCloseJobs.id, { onDelete: "cascade" }).notNull(),
  bookingId: varchar("booking_id").references(() => bookings.id).notNull(),
  residentName: text("resident_name").notNull(),
  roomInfo: text("room_info"),
  finalStatus: residentSeasonStatusEnum("final_status").notNull().default("PENDING"),
  graceUntil: timestamp("grace_until"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seasonsRelations = relations(seasons, ({ many }) => ({
  residentStatuses: many(residentSeasonStatus),
  closeJobs: many(seasonCloseJobs),
}));

export const residentSeasonStatusRelations = relations(residentSeasonStatus, ({ one }) => ({
  booking: one(bookings, { fields: [residentSeasonStatus.bookingId], references: [bookings.id] }),
  season: one(seasons, { fields: [residentSeasonStatus.seasonId], references: [seasons.id] }),
}));

export const seasonCloseJobsRelations = relations(seasonCloseJobs, ({ one, many }) => ({
  season: one(seasons, { fields: [seasonCloseJobs.seasonId], references: [seasons.id] }),
  items: many(seasonCloseJobItems),
}));

export const seasonCloseJobItemsRelations = relations(seasonCloseJobItems, ({ one }) => ({
  job: one(seasonCloseJobs, { fields: [seasonCloseJobItems.jobId], references: [seasonCloseJobs.id] }),
  booking: one(bookings, { fields: [seasonCloseJobItems.bookingId], references: [bookings.id] }),
}));

export const insertSeasonSchema = createInsertSchema(seasons).omit({ id: true, createdAt: true, updatedAt: true });
export type Season = typeof seasons.$inferSelect;
export type InsertSeason = z.infer<typeof insertSeasonSchema>;

export const insertResidentSeasonStatusSchema = createInsertSchema(residentSeasonStatus).omit({ id: true, createdAt: true, updatedAt: true });
export type ResidentSeasonStatusRecord = typeof residentSeasonStatus.$inferSelect;
export type InsertResidentSeasonStatus = z.infer<typeof insertResidentSeasonStatusSchema>;

export const insertSeasonCloseJobSchema = createInsertSchema(seasonCloseJobs).omit({ id: true, createdAt: true });
export type SeasonCloseJob = typeof seasonCloseJobs.$inferSelect;
export type InsertSeasonCloseJob = z.infer<typeof insertSeasonCloseJobSchema>;

export const insertSeasonCloseJobItemSchema = createInsertSchema(seasonCloseJobItems).omit({ id: true, createdAt: true });
export type SeasonCloseJobItem = typeof seasonCloseJobItems.$inferSelect;
export type InsertSeasonCloseJobItem = z.infer<typeof insertSeasonCloseJobItemSchema>;

// Property Targets table (for Target & Achievement dashboard)
export const propertyTargets = pgTable("property_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").notNull(),
  targetOccupancyPercent: integer("target_occupancy_percent").default(100).notNull(),
  customTargetOverride: integer("custom_target_override"),
  seasonId: varchar("season_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPropertyTargetSchema = createInsertSchema(propertyTargets).omit({ id: true, createdAt: true, updatedAt: true });
export type PropertyTarget = typeof propertyTargets.$inferSelect;
export type InsertPropertyTarget = z.infer<typeof insertPropertyTargetSchema>;

// Bed holds table (persistent hold during booking)
export const bedHolds = pgTable("bed_holds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bedId: varchar("bed_id").notNull(),
  sessionId: varchar("session_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Registration request status enum
export const registrationRequestStatusEnum = pgEnum("registration_request_status", [
  "pending",
  "reviewed",
  "approved",
  "rejected",
  "booked"
]);

// Registration Requests table (public form submissions)
export const registrationRequests = pgTable("registration_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  gender: text("gender").notNull(),
  dob: text("dob"),
  dietaryPreference: text("dietary_preference"),
  
  instituteName: text("institute_name"),
  courseName: text("course_name"),
  moveInDate: text("move_in_date"),
  checkOutDate: text("check_out_date"),
  
  parentName: text("parent_name"),
  parentRelation: text("parent_relation"),
  parentPhone: text("parent_phone"),
  parentEmail: text("parent_email"),
  
  photoPath: text("photo_path"),
  idProofPath: text("id_proof_path"),
  
  propertyId: varchar("property_id").references(() => properties.id),
  propertyName: text("property_name"),
  
  notes: text("notes"),

  isRetain: boolean("is_retain").default(false).notNull(),
  retainMatchedFields: text("retain_matched_fields"),
  
  status: registrationRequestStatusEnum("status").default("pending").notNull(),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  bookingId: varchar("booking_id").references(() => bookings.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRegistrationRequestSchema = createInsertSchema(registrationRequests).omit({ id: true, createdAt: true, updatedAt: true, reviewedBy: true, reviewedAt: true, reviewNotes: true, bookingId: true, isRetain: true, retainMatchedFields: true });
export type RegistrationRequest = typeof registrationRequests.$inferSelect;
export type InsertRegistrationRequest = z.infer<typeof insertRegistrationRequestSchema>;

export const mapSettings = pgTable("map_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().default("Connection 1"),
  connectedPropertyIds: text("connected_property_ids").notNull().default("[]"),
  pattern: text("pattern").notNull().default("triangle"),
  lineColor: text("line_color").notNull().default("#34d399"),
  fillColor: text("fill_color").notNull().default("#34d399"),
  fillOpacity: text("fill_opacity").notNull().default("0.15"),
  lineWidth: text("line_width").notNull().default("2.5"),
  glowEnabled: text("glow_enabled").notNull().default("true"),
  animationEnabled: text("animation_enabled").notNull().default("true"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MapSettings = typeof mapSettings.$inferSelect;

export const propertyMilestones = pgTable("property_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  milestoneType: text("milestone_type").notNull(),
  milestoneValue: integer("milestone_value").notNull(),
  totalBookings: integer("total_bookings").notNull(),
  occupancyPercent: integer("occupancy_percent"),
  emailSent: boolean("email_sent").default(false).notNull(),
  sentAt: timestamp("sent_at"),
}, (table) => [
  uniqueIndex("property_milestone_unique").on(table.propertyId, table.milestoneType, table.milestoneValue),
]);

export type PropertyMilestone = typeof propertyMilestones.$inferSelect;

export const contactMessageStatusEnum = pgEnum("contact_message_status", ["new", "read", "replied", "archived"]);

export const contactMessages = pgTable("contact_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  message: text("message").notNull(),
  source: varchar("source", { length: 20 }).default("hostel").notNull(),
  status: contactMessageStatusEnum("status").default("new").notNull(),
  repliedBy: varchar("replied_by"),
  repliedAt: timestamp("replied_at"),
  convertedToLeadId: varchar("converted_to_lead_id"),
  convertedExecName: varchar("converted_exec_name", { length: 255 }),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({ id: true, status: true, repliedBy: true, repliedAt: true, createdAt: true });
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type ContactMessage = typeof contactMessages.$inferSelect;

// ============ Hotels Module: Housekeeping ============
export const housekeepingTaskStatusEnum = pgEnum("housekeeping_task_status", ["pending", "in_progress", "completed", "cancelled"]);
export const housekeepingTaskTypeEnum = pgEnum("housekeeping_task_type", ["cleaning", "turnover", "deep_clean", "maintenance", "inspection", "linen_change"]);
export const housekeepingTaskPriorityEnum = pgEnum("housekeeping_task_priority", ["low", "normal", "high", "urgent"]);

export const housekeepingTasks = pgTable("housekeeping_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id).notNull(),
  roomId: varchar("room_id").references(() => rooms.id),
  roomLabel: text("room_label"),
  taskType: housekeepingTaskTypeEnum("task_type").default("cleaning").notNull(),
  status: housekeepingTaskStatusEnum("status").default("pending").notNull(),
  priority: housekeepingTaskPriorityEnum("priority").default("normal").notNull(),
  assignedTo: varchar("assigned_to").references(() => users.id),
  scheduledFor: timestamp("scheduled_for"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("housekeeping_tasks_property_idx").on(table.propertyId),
  index("housekeeping_tasks_assigned_idx").on(table.assignedTo),
  index("housekeeping_tasks_status_idx").on(table.status),
]);

export const insertHousekeepingTaskSchema = createInsertSchema(housekeepingTasks).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type HousekeepingTask = typeof housekeepingTasks.$inferSelect;
export type InsertHousekeepingTask = z.infer<typeof insertHousekeepingTaskSchema>;

// ============================================================================
// FEATURE FLAGS — generic key/value boolean flags toggleable by superadmin
// ============================================================================
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  enabled: boolean("enabled").default(false).notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

// ============================================================================
// SITE CONTENT — generic key/value JSON content blocks editable by superadmin
// Used for editable headlines, subtitles, eyebrows, etc. on marketing pages.
// ============================================================================
export const siteContent = pgTable("site_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertSiteContentSchema = createInsertSchema(siteContent).omit({
  id: true,
  updatedAt: true,
  createdAt: true,
});
export type SiteContent = typeof siteContent.$inferSelect;
export type InsertSiteContent = z.infer<typeof insertSiteContentSchema>;

// ============================================================================
// PROMOTION ENGINE — coupons + redemptions
// ============================================================================
export const couponTypeEnum = pgEnum("coupon_type", ["percent", "flat"]);
export const couponStatusEnum = pgEnum("coupon_status", ["active", "paused", "expired", "exhausted"]);

export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  discountType: couponTypeEnum("discount_type").notNull(),
  discountValue: integer("discount_value").notNull(), // % (1-100) or ₹ flat
  minBookingValue: integer("min_booking_value").default(0).notNull(),
  maxDiscount: integer("max_discount"), // cap for % type
  validFrom: timestamp("valid_from").defaultNow().notNull(),
  validUntil: timestamp("valid_until"),
  usageLimit: integer("usage_limit"), // null = unlimited
  perUserLimit: integer("per_user_limit").default(1),
  usageCount: integer("usage_count").default(0).notNull(),
  // Targeting (null arrays = applies to all)
  applicablePropertyIds: text("applicable_property_ids").array(),
  applicableRoomTypeIds: text("applicable_room_type_ids").array(),
  // First-booking only (loyalty / new-user campaigns)
  firstBookingOnly: boolean("first_booking_only").default(false).notNull(),
  status: couponStatusEnum("status").default("active").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;

export const couponRedemptions = pgTable("coupon_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id").references(() => coupons.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  bookingId: varchar("booking_id").references(() => bookings.id),
  bookingValue: integer("booking_value").notNull(),
  discountAmount: integer("discount_amount").notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("coupon_redemptions_booking_id_unique")
    .on(table.bookingId)
    .where(sql`${table.bookingId} is not null`),
]);
export const insertCouponRedemptionSchema = createInsertSchema(couponRedemptions).omit({
  id: true,
  redeemedAt: true,
});
export type CouponRedemption = typeof couponRedemptions.$inferSelect;
export type InsertCouponRedemption = z.infer<typeof insertCouponRedemptionSchema>;

// Re-export chat models for AI integrations
export * from "./models/chat";
