import {
  users,
  students,
  properties,
  roomTypes,
  bookings,
  installments,
  payments,
  auditLogs,
  leads,
  globalAmenities,
  propertyRules,
  nearbyLocations,
  propertyTariffs,
  propertyImages,
  type User,
  type InsertUser,
  type Student,
  type InsertStudent,
  type Property,
  type InsertProperty,
  type RoomType,
  type InsertRoomType,
  type Booking,
  type InsertBooking,
  type Installment,
  type InsertInstallment,
  type Payment,
  type InsertPayment,
  type AuditLog,
  type InsertAuditLog,
  type Lead,
  type InsertLead,
  type GlobalAmenity,
  type InsertGlobalAmenity,
  type PropertyRule,
  type InsertPropertyRule,
  type NearbyLocation,
  type InsertNearbyLocation,
  type PropertyTariff,
  type InsertPropertyTariff,
  type PropertyImage,
  type InsertPropertyImage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Students
  getStudent(id: string): Promise<Student | undefined>;
  getStudentByUserId(userId: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: string, data: Partial<InsertStudent>): Promise<Student | undefined>;
  getAllStudents(): Promise<Student[]>;
  
  // Properties
  getProperty(id: string): Promise<Property | undefined>;
  getAllProperties(): Promise<Property[]>;
  getAllPropertiesIncludingInactive(): Promise<Property[]>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, data: Partial<Property>): Promise<Property | undefined>;
  
  // Room Types
  getRoomType(id: string): Promise<RoomType | undefined>;
  getRoomTypesByProperty(propertyId: string): Promise<RoomType[]>;
  createRoomType(roomType: InsertRoomType): Promise<RoomType>;
  updateRoomTypeAvailability(id: string, change: number): Promise<RoomType | undefined>;
  updateRoomType(id: string, data: Partial<RoomType>): Promise<RoomType | undefined>;
  
  // Bookings
  getBooking(id: string): Promise<Booking | undefined>;
  getBookingsByStudent(studentId: string): Promise<Booking[]>;
  getAllBookings(): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: string, data: Partial<Booking>): Promise<Booking | undefined>;
  
  // Installments
  getInstallment(id: string): Promise<Installment | undefined>;
  getInstallmentsByBooking(bookingId: string): Promise<Installment[]>;
  createInstallment(installment: InsertInstallment): Promise<Installment>;
  createInstallments(installments: InsertInstallment[]): Promise<Installment[]>;
  updateInstallment(id: string, data: Partial<Installment>): Promise<Installment | undefined>;
  
  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByBooking(bookingId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined>;
  
  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  
  // Leads
  getLead(id: string): Promise<Lead | undefined>;
  getLeadByPhone(phone: string): Promise<Lead | undefined>;
  getLeadByEmail(email: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined>;
  getAllLeads(): Promise<Lead[]>;
  updateLeadActivity(id: string): Promise<Lead | undefined>;
  
  // Analytics
  getStats(): Promise<{
    totalStudents: number;
    totalBookings: number;
    totalRevenue: number;
    pendingPayments: number;
  }>;
  
  // Lead Analytics
  getLeadAnalytics(): Promise<{
    totalLeads: number;
    leadsBySource: { source: string; count: number }[];
    leadsByStatus: { status: string; count: number }[];
    conversionRate: number;
    leadsByMonth: { month: string; count: number }[];
    conversionsByMonth: { month: string; conversions: number; total: number; rate: number }[];
    leadsByDevice: { device: string; count: number }[];
    recentLeads: Lead[];
  }>;
  
  // Property-wise Lead Analytics
  getLeadsByProperty(propertyId: string): Promise<Lead[]>;
  getLeadByEmailAndProperty(email: string, propertyId: string): Promise<Lead | undefined>;
  getPropertyLeadFunnel(propertyId: string): Promise<{
    propertyId: string;
    propertyName: string;
    totalLeads: number;
    stages: { status: string; count: number; percentage: number }[];
    conversionRate: number;
  }>;
  getAllPropertiesLeadFunnels(): Promise<{
    propertyId: string;
    propertyName: string;
    totalLeads: number;
    stages: { status: string; count: number; percentage: number }[];
    conversionRate: number;
  }[]>;
  
  // Lead Scoring
  updateLeadScore(leadId: string, action: string): Promise<Lead | undefined>;
  recalculateLeadScore(leadId: string): Promise<Lead | undefined>;
  getLeadScoreAnalytics(propertyId?: string): Promise<{
    totalLeads: number;
    averageScore: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    topProperty?: { propertyId: string; propertyName: string; avgScore: number };
  }>;
  
  // Global Amenities
  getAllGlobalAmenities(): Promise<GlobalAmenity[]>;
  createGlobalAmenity(amenity: InsertGlobalAmenity): Promise<GlobalAmenity>;
  deleteGlobalAmenity(id: string): Promise<void>;
  
  // Property Rules
  getRulesByProperty(propertyId: string): Promise<PropertyRule[]>;
  createPropertyRule(rule: InsertPropertyRule): Promise<PropertyRule>;
  updatePropertyRule(id: string, data: Partial<PropertyRule>): Promise<PropertyRule | undefined>;
  deletePropertyRule(id: string): Promise<void>;
  
  // Nearby Locations
  getNearbyLocationsByProperty(propertyId: string): Promise<NearbyLocation[]>;
  createNearbyLocation(location: InsertNearbyLocation): Promise<NearbyLocation>;
  deleteNearbyLocation(id: string): Promise<void>;
  
  // Property Tariffs
  getTariffsByProperty(propertyId: string): Promise<PropertyTariff[]>;
  createPropertyTariff(tariff: InsertPropertyTariff): Promise<PropertyTariff>;
  deletePropertyTariff(id: string): Promise<void>;
  
  // Property Images
  getImagesByProperty(propertyId: string): Promise<PropertyImage[]>;
  createPropertyImage(image: InsertPropertyImage): Promise<PropertyImage>;
  updatePropertyImage(id: string, data: Partial<PropertyImage>): Promise<PropertyImage | undefined>;
  deletePropertyImage(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Students
  async getStudent(id: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.id, id));
    return student || undefined;
  }

  async getStudentByUserId(userId: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.userId, userId));
    return student || undefined;
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const [student] = await db.insert(students).values(insertStudent).returning();
    return student;
  }

  async updateStudent(id: string, data: Partial<InsertStudent>): Promise<Student | undefined> {
    const [student] = await db
      .update(students)
      .set(data)
      .where(eq(students.id, id))
      .returning();
    return student || undefined;
  }

  async getAllStudents(): Promise<Student[]> {
    return await db.select().from(students).orderBy(desc(students.createdAt));
  }

  // Properties
  async getProperty(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property || undefined;
  }

  async getAllProperties(): Promise<Property[]> {
    return await db.select().from(properties).where(eq(properties.active, true));
  }

  async getAllPropertiesIncludingInactive(): Promise<Property[]> {
    return await db.select().from(properties);
  }

  async createProperty(insertProperty: InsertProperty): Promise<Property> {
    const [property] = await db.insert(properties).values(insertProperty).returning();
    return property;
  }

  async updateProperty(id: string, data: Partial<Property>): Promise<Property | undefined> {
    const [property] = await db
      .update(properties)
      .set(data)
      .where(eq(properties.id, id))
      .returning();
    return property || undefined;
  }

  // Room Types
  async getRoomType(id: string): Promise<RoomType | undefined> {
    const [roomType] = await db.select().from(roomTypes).where(eq(roomTypes.id, id));
    return roomType || undefined;
  }

  async getRoomTypesByProperty(propertyId: string): Promise<RoomType[]> {
    return await db
      .select()
      .from(roomTypes)
      .where(and(eq(roomTypes.propertyId, propertyId), eq(roomTypes.active, true)));
  }

  async createRoomType(insertRoomType: InsertRoomType): Promise<RoomType> {
    const [roomType] = await db.insert(roomTypes).values(insertRoomType).returning();
    return roomType;
  }

  async updateRoomTypeAvailability(id: string, change: number): Promise<RoomType | undefined> {
    const [roomType] = await db
      .update(roomTypes)
      .set({ availableBeds: sql`${roomTypes.availableBeds} + ${change}` })
      .where(eq(roomTypes.id, id))
      .returning();
    return roomType || undefined;
  }

  async updateRoomType(id: string, data: Partial<RoomType>): Promise<RoomType | undefined> {
    const [roomType] = await db
      .update(roomTypes)
      .set(data)
      .where(eq(roomTypes.id, id))
      .returning();
    return roomType || undefined;
  }

  // Bookings
  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || undefined;
  }

  async getBookingsByStudent(studentId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.studentId, studentId))
      .orderBy(desc(bookings.createdAt));
  }

  async getAllBookings(): Promise<Booking[]> {
    return await db.select().from(bookings).orderBy(desc(bookings.createdAt));
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const [booking] = await db.insert(bookings).values(insertBooking).returning();
    return booking;
  }

  async updateBooking(id: string, data: Partial<Booking>): Promise<Booking | undefined> {
    const [booking] = await db
      .update(bookings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return booking || undefined;
  }

  // Installments
  async getInstallment(id: string): Promise<Installment | undefined> {
    const [installment] = await db.select().from(installments).where(eq(installments.id, id));
    return installment || undefined;
  }

  async getInstallmentsByBooking(bookingId: string): Promise<Installment[]> {
    return await db.select().from(installments).where(eq(installments.bookingId, bookingId));
  }

  async createInstallment(insertInstallment: InsertInstallment): Promise<Installment> {
    const [installment] = await db.insert(installments).values(insertInstallment).returning();
    return installment;
  }

  async createInstallments(insertInstallments: InsertInstallment[]): Promise<Installment[]> {
    return await db.insert(installments).values(insertInstallments).returning();
  }

  async updateInstallment(id: string, data: Partial<Installment>): Promise<Installment | undefined> {
    const [installment] = await db
      .update(installments)
      .set(data)
      .where(eq(installments.id, id))
      .returning();
    return installment || undefined;
  }

  // Payments
  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async getPaymentsByBooking(bookingId: string): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    return payment;
  }

  async updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined> {
    const [payment] = await db
      .update(payments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return payment || undefined;
  }

  // Audit Logs
  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(insertLog).returning();
    return log;
  }

  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  // Leads
  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async getLeadByPhone(phone: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.phone, phone));
    return lead || undefined;
  }

  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    return lead || undefined;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set(data)
      .where(eq(leads.id, id))
      .returning();
    return lead || undefined;
  }

  async getAllLeads(): Promise<Lead[]> {
    return await db.select().from(leads).orderBy(desc(leads.lastActivityAt));
  }

  async updateLeadActivity(id: string): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set({ 
        lastActivityAt: new Date(),
        loginCount: sql`${leads.loginCount} + 1`
      })
      .where(eq(leads.id, id))
      .returning();
    return lead || undefined;
  }

  // Analytics
  async getStats(): Promise<{
    totalStudents: number;
    totalBookings: number;
    totalRevenue: number;
    pendingPayments: number;
  }> {
    const [studentsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(students);

    const [bookingsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings);

    const [revenueData] = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)::int` })
      .from(payments)
      .where(eq(payments.status, "success"));

    const [pendingData] = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)::int` })
      .from(installments)
      .where(eq(installments.paid, false));

    return {
      totalStudents: studentsCount?.count || 0,
      totalBookings: bookingsCount?.count || 0,
      totalRevenue: revenueData?.total || 0,
      pendingPayments: pendingData?.total || 0,
    };
  }

  // Lead Analytics
  async getLeadAnalytics(): Promise<{
    totalLeads: number;
    leadsBySource: { source: string; count: number }[];
    leadsByStatus: { status: string; count: number }[];
    conversionRate: number;
    leadsByMonth: { month: string; count: number }[];
    conversionsByMonth: { month: string; conversions: number; total: number; rate: number }[];
    leadsByDevice: { device: string; count: number }[];
    recentLeads: Lead[];
  }> {
    // Total leads
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads);
    const totalLeads = totalResult?.count || 0;

    // Leads by source
    const sourceData = await db
      .select({
        source: leads.source,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .groupBy(leads.source);

    const leadsBySource = sourceData.map((row) => ({
      source: row.source || "unknown",
      count: row.count,
    }));

    // Leads by status
    const statusData = await db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .groupBy(leads.status);

    const leadsByStatus = statusData.map((row) => ({
      status: row.status || "unknown",
      count: row.count,
    }));

    // Conversion rate
    const [convertedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.convertedToStudent, true));
    const conversions = convertedResult?.count || 0;
    const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0;

    // Leads by month (last 6 months)
    const monthData = await db
      .select({
        month: sql<string>`TO_CHAR(created_at, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(sql`created_at >= NOW() - INTERVAL '6 months'`)
      .groupBy(sql`TO_CHAR(created_at, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(created_at, 'YYYY-MM')`);

    const leadsByMonth = monthData.map((row) => ({
      month: row.month,
      count: row.count,
    }));

    // Conversions by month (last 6 months)
    const conversionMonthData = await db
      .select({
        month: sql<string>`TO_CHAR(created_at, 'YYYY-MM')`,
        total: sql<number>`count(*)::int`,
        conversions: sql<number>`SUM(CASE WHEN converted_to_student THEN 1 ELSE 0 END)::int`,
      })
      .from(leads)
      .where(sql`created_at >= NOW() - INTERVAL '6 months'`)
      .groupBy(sql`TO_CHAR(created_at, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(created_at, 'YYYY-MM')`);

    const conversionsByMonth = conversionMonthData.map((row) => ({
      month: row.month,
      total: row.total,
      conversions: row.conversions || 0,
      rate: row.total > 0 ? ((row.conversions || 0) / row.total) * 100 : 0,
    }));

    // Leads by device type
    const deviceData = await db
      .select({
        device: sql<string>`COALESCE(device_type, 'unknown')`,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .groupBy(sql`COALESCE(device_type, 'unknown')`);

    const leadsByDevice = deviceData.map((row) => ({
      device: row.device,
      count: row.count,
    }));

    // Recent leads (last 10)
    const recentLeads = await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt))
      .limit(10);

    return {
      totalLeads,
      leadsBySource,
      leadsByStatus,
      conversionRate,
      leadsByMonth,
      conversionsByMonth,
      leadsByDevice,
      recentLeads,
    };
  }

  // Property-wise Lead Analytics
  async getLeadsByProperty(propertyId: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.propertyId, propertyId)).orderBy(desc(leads.createdAt));
  }

  async getLeadByEmailAndProperty(email: string, propertyId: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.email, email), eq(leads.propertyId, propertyId)));
    return lead || undefined;
  }

  async getPropertyLeadFunnel(propertyId: string): Promise<{
    propertyId: string;
    propertyName: string;
    totalLeads: number;
    stages: { status: string; count: number; percentage: number }[];
    conversionRate: number;
  }> {
    // Get property name
    const [property] = await db.select().from(properties).where(eq(properties.id, propertyId));
    const propertyName = property?.name || "Unknown";

    // Get total leads for this property
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(eq(leads.propertyId, propertyId));
    const totalLeads = totalResult?.count || 0;

    // Get leads by status for this property
    const statusData = await db
      .select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(eq(leads.propertyId, propertyId))
      .groupBy(leads.status);

    const stages = statusData.map((row) => ({
      status: row.status || "unknown",
      count: row.count,
      percentage: totalLeads > 0 ? (row.count / totalLeads) * 100 : 0,
    }));

    // Calculate conversion rate
    const [convertedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(and(eq(leads.propertyId, propertyId), eq(leads.status, "converted")));
    const conversions = convertedResult?.count || 0;
    const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0;

    return {
      propertyId,
      propertyName,
      totalLeads,
      stages,
      conversionRate,
    };
  }

  async getAllPropertiesLeadFunnels(): Promise<{
    propertyId: string;
    propertyName: string;
    totalLeads: number;
    stages: { status: string; count: number; percentage: number }[];
    conversionRate: number;
  }[]> {
    // Get all properties that have leads
    const propertiesWithLeads = await db
      .selectDistinct({ propertyId: leads.propertyId, propertyName: leads.propertyName })
      .from(leads)
      .where(sql`${leads.propertyId} IS NOT NULL`);

    const funnels = await Promise.all(
      propertiesWithLeads.map(async (p) => {
        if (!p.propertyId) return null;
        return this.getPropertyLeadFunnel(p.propertyId);
      })
    );

    return funnels.filter((f): f is NonNullable<typeof f> => f !== null);
  }

  // Lead Scoring - Scoring rules configuration
  private scoringRules: Record<string, number> = {
    signup: 5,
    property_view: 10,
    multiple_views: 15,
    enquiry: 20,
    site_visit: 25,
    booking_initiated: 30,
    booking_confirmed: 40,
    discount_request: 10,
    inactivity_penalty: -10,
    lost: 0,
  };

  private calculatePriority(score: number): "cold" | "warm" | "hot" {
    if (score >= 61) return "hot";
    if (score >= 31) return "warm";
    return "cold";
  }

  async updateLeadScore(leadId: string, action: string): Promise<Lead | undefined> {
    const lead = await this.getLead(leadId);
    if (!lead) return undefined;

    let newScore = lead.score || 0;
    let updates: Partial<Lead> = { lastActivityAt: new Date() };
    const currentViewCount = lead.viewCount ?? 0;

    switch (action) {
      case "signup":
        if (!lead.signedUp) {
          newScore += this.scoringRules.signup;
          updates.signedUp = true;
        }
        break;
      case "property_view":
        const newViewCount = currentViewCount + 1;
        updates.viewCount = newViewCount;
        newScore += this.scoringRules.property_view;
        // Add bonus only when hitting exactly 3 views (crossing threshold)
        if (newViewCount === 3) {
          newScore += this.scoringRules.multiple_views;
        }
        break;
      case "enquiry":
        if (!lead.enquirySubmitted) {
          newScore += this.scoringRules.enquiry;
          updates.enquirySubmitted = true;
        }
        break;
      case "site_visit":
        if (!lead.siteVisitScheduled) {
          newScore += this.scoringRules.site_visit;
          updates.siteVisitScheduled = true;
        }
        break;
      case "booking_initiated":
        if (!lead.bookingInitiated) {
          newScore += this.scoringRules.booking_initiated;
          updates.bookingInitiated = true;
        }
        break;
      case "booking_confirmed":
        if (!lead.bookingConfirmed) {
          newScore += this.scoringRules.booking_confirmed;
          updates.bookingConfirmed = true;
        }
        break;
      case "discount_request":
        if (!lead.discountRequested) {
          newScore += this.scoringRules.discount_request;
          updates.discountRequested = true;
        }
        break;
      case "lost":
        newScore = this.scoringRules.lost;
        updates.status = "lost";
        break;
      case "inactivity":
        newScore = Math.max(0, newScore + this.scoringRules.inactivity_penalty);
        break;
    }

    newScore = Math.min(100, Math.max(0, newScore));
    const newPriority = this.calculatePriority(newScore);

    const [updated] = await db
      .update(leads)
      .set({ ...updates, score: newScore, priority: newPriority })
      .where(eq(leads.id, leadId))
      .returning();
    return updated || undefined;
  }

  async recalculateLeadScore(leadId: string): Promise<Lead | undefined> {
    const lead = await this.getLead(leadId);
    if (!lead) return undefined;

    let score = 0;
    const viewCount = lead.viewCount ?? 0;
    
    // Add signup points only if explicitly signed up
    if (lead.signedUp) {
      score += this.scoringRules.signup;
    }
    // Add property view points
    if (viewCount >= 1) {
      score += viewCount * this.scoringRules.property_view;
    }
    if (viewCount >= 3) score += this.scoringRules.multiple_views;
    if (lead.enquirySubmitted) score += this.scoringRules.enquiry;
    if (lead.siteVisitScheduled) score += this.scoringRules.site_visit;
    if (lead.bookingInitiated) score += this.scoringRules.booking_initiated;
    if (lead.bookingConfirmed) score += this.scoringRules.booking_confirmed;
    if (lead.discountRequested) score += this.scoringRules.discount_request;
    if (lead.status === "lost") score = 0;

    score = Math.min(100, Math.max(0, score));
    const priority = this.calculatePriority(score);

    const [updated] = await db
      .update(leads)
      .set({ score, priority })
      .where(eq(leads.id, leadId))
      .returning();
    return updated || undefined;
  }

  async getLeadScoreAnalytics(propertyId?: string): Promise<{
    totalLeads: number;
    averageScore: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    topProperty?: { propertyId: string; propertyName: string; avgScore: number };
  }> {
    const whereClause = propertyId ? eq(leads.propertyId, propertyId) : sql`1=1`;
    
    const allLeads = await db.select().from(leads).where(whereClause);
    const totalLeads = allLeads.length;
    const averageScore = totalLeads > 0 ? allLeads.reduce((sum, l) => sum + (l.score || 0), 0) / totalLeads : 0;
    const hotLeads = allLeads.filter(l => l.priority === "hot").length;
    const warmLeads = allLeads.filter(l => l.priority === "warm").length;
    const coldLeads = allLeads.filter(l => l.priority === "cold").length;

    let topProperty: { propertyId: string; propertyName: string; avgScore: number } | undefined;
    
    if (!propertyId) {
      const propertyScores = await db
        .select({
          propertyId: leads.propertyId,
          propertyName: leads.propertyName,
          avgScore: sql<number>`AVG(${leads.score})::float`,
        })
        .from(leads)
        .where(sql`${leads.propertyId} IS NOT NULL`)
        .groupBy(leads.propertyId, leads.propertyName)
        .orderBy(sql`AVG(${leads.score}) DESC`)
        .limit(1);

      if (propertyScores.length > 0 && propertyScores[0].propertyId) {
        topProperty = {
          propertyId: propertyScores[0].propertyId,
          propertyName: propertyScores[0].propertyName || "Unknown",
          avgScore: propertyScores[0].avgScore || 0,
        };
      }
    }

    return { totalLeads, averageScore, hotLeads, warmLeads, coldLeads, topProperty };
  }

  // Global Amenities
  async getAllGlobalAmenities(): Promise<GlobalAmenity[]> {
    return await db.select().from(globalAmenities).orderBy(globalAmenities.name);
  }

  async createGlobalAmenity(amenity: InsertGlobalAmenity): Promise<GlobalAmenity> {
    const [created] = await db.insert(globalAmenities).values(amenity).returning();
    return created;
  }

  async deleteGlobalAmenity(id: string): Promise<void> {
    await db.delete(globalAmenities).where(eq(globalAmenities.id, id));
  }

  // Property Rules
  async getRulesByProperty(propertyId: string): Promise<PropertyRule[]> {
    return await db.select().from(propertyRules).where(eq(propertyRules.propertyId, propertyId)).orderBy(propertyRules.sortOrder);
  }

  async createPropertyRule(rule: InsertPropertyRule): Promise<PropertyRule> {
    const [created] = await db.insert(propertyRules).values(rule).returning();
    return created;
  }

  async updatePropertyRule(id: string, data: Partial<PropertyRule>): Promise<PropertyRule | undefined> {
    const [updated] = await db.update(propertyRules).set(data).where(eq(propertyRules.id, id)).returning();
    return updated || undefined;
  }

  async deletePropertyRule(id: string): Promise<void> {
    await db.delete(propertyRules).where(eq(propertyRules.id, id));
  }

  // Nearby Locations
  async getNearbyLocationsByProperty(propertyId: string): Promise<NearbyLocation[]> {
    return await db.select().from(nearbyLocations).where(eq(nearbyLocations.propertyId, propertyId));
  }

  async createNearbyLocation(location: InsertNearbyLocation): Promise<NearbyLocation> {
    const [created] = await db.insert(nearbyLocations).values(location).returning();
    return created;
  }

  async deleteNearbyLocation(id: string): Promise<void> {
    await db.delete(nearbyLocations).where(eq(nearbyLocations.id, id));
  }

  // Property Tariffs
  async getTariffsByProperty(propertyId: string): Promise<PropertyTariff[]> {
    return await db.select().from(propertyTariffs).where(eq(propertyTariffs.propertyId, propertyId));
  }

  async createPropertyTariff(tariff: InsertPropertyTariff): Promise<PropertyTariff> {
    const [created] = await db.insert(propertyTariffs).values(tariff).returning();
    return created;
  }

  async deletePropertyTariff(id: string): Promise<void> {
    await db.delete(propertyTariffs).where(eq(propertyTariffs.id, id));
  }

  // Property Images
  async getImagesByProperty(propertyId: string): Promise<PropertyImage[]> {
    return await db.select().from(propertyImages).where(eq(propertyImages.propertyId, propertyId)).orderBy(propertyImages.sortOrder);
  }

  async createPropertyImage(image: InsertPropertyImage): Promise<PropertyImage> {
    const [created] = await db.insert(propertyImages).values(image).returning();
    return created;
  }

  async updatePropertyImage(id: string, data: Partial<PropertyImage>): Promise<PropertyImage | undefined> {
    const [updated] = await db.update(propertyImages).set(data).where(eq(propertyImages.id, id)).returning();
    return updated || undefined;
  }

  async deletePropertyImage(id: string): Promise<void> {
    await db.delete(propertyImages).where(eq(propertyImages.id, id));
  }
}

export const storage = new DatabaseStorage();
