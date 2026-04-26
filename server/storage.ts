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
  salesExecProperties,
  leadActivities,
  leadRemarks,
  notifications,
  activityLogs,
  heroSlides,
  instagramPosts,
  instagramSyncLog,
  footerSettings,
  homepageAmenities,
  chatbotSettings,
  chatbotKnowledge,
  chatbotConversations,
  chatbotMessages,
  chatbotEvents,
  floors,
  rooms,
  beds,
  bedBlockLogs,
  bedReconciliationRuns,
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
  type SalesExecProperty,
  type InsertSalesExecProperty,
  type LeadActivity,
  type InsertLeadActivity,
  type LeadRemark,
  type InsertLeadRemark,
  type Notification,
  type InsertNotification,
  type ActivityLog,
  type InsertActivityLog,
  type HeroSlide,
  type InsertHeroSlide,
  type InstagramPost,
  type FooterSettings,
  mapSettings,
  type MapSettings,
  type Floor,
  type InsertFloor,
  type Room,
  type InsertRoom,
  type Bed,
  type BedBlockLog,
  type InsertBedBlockLog,
  type BedReconciliationRun,
  type InsertBedReconciliationRun,
  type InsertBed,
  type HomepageAmenity,
  type InsertHomepageAmenity,
  packages,
  type Package,
  packageItems,
  bookingPackages,
  packageUpgrades,
  packageUsage,
  walletLedger,
  propertyTargets,
  type PropertyTarget,
  registrationRequests,
  residentSeasonStatus,
  bedAllocations,
  contactMessages,
  type ContactMessage,
  type InsertContactMessage,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc, inArray, isNull, lt, lte, gte, count, or, ilike, type SQL } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(roles: string[]): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  
  // Students
  getStudent(id: string): Promise<Student | undefined>;
  getStudentByUserId(userId: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: string, data: Partial<InsertStudent>): Promise<Student | undefined>;
  getAllStudents(): Promise<Student[]>;
  
  // Properties
  getProperty(id: string): Promise<Property | undefined>;
  getPropertyBySlug(slug: string): Promise<Property | undefined>;
  getPropertyByIdOrSlug(idOrSlug: string): Promise<Property | undefined>;
  recordBrochureDownload(propertyId: string): Promise<void>;
  getAllProperties(): Promise<Property[]>;
  getAllPropertiesIncludingInactive(): Promise<Property[]>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, data: Partial<Property>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<void>;
  
  // Room Types
  getRoomType(id: string): Promise<RoomType | undefined>;
  getRoomTypesByProperty(propertyId: string): Promise<RoomType[]>;
  createRoomType(roomType: InsertRoomType): Promise<RoomType>;
  updateRoomTypeAvailability(id: string, change: number): Promise<RoomType | undefined>;
  updateRoomType(id: string, data: Partial<RoomType>): Promise<RoomType | undefined>;
  deleteRoomType(id: string): Promise<void>;
  
  // Bookings
  getBooking(id: string): Promise<Booking | undefined>;
  getBookingByCode(bookingCode: string): Promise<Booking | undefined>;
  getBookingsByStudent(studentId: string): Promise<Booking[]>;
  getBookingsByProperty(propertyId: string): Promise<Booking[]>;
  getBookingsByCreator(userId: string): Promise<Booking[]>;
  getPendingApprovalBookings(): Promise<Booking[]>;
  getAllBookings(): Promise<Booking[]>;
  createBookingWithCode(booking: InsertBooking): Promise<Booking>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: string, data: Partial<Booking>): Promise<Booking | undefined>;
  confirmBooking(id: string, approvedBy?: string): Promise<Booking | undefined>;
  cancelBooking(id: string, reason?: string): Promise<Booking | undefined>;
  generateBookingCode(): Promise<string>;
  getRoomTypeAvailability(roomTypeId: string): Promise<{ totalBeds: number; availableBeds: number; bookedBeds: number }>;
  allocateBed(bookingId: string): Promise<Booking | undefined>;
  
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
  deleteLead(id: string): Promise<void>;
  getAllLeads(propertyId?: string): Promise<Lead[]>;
  updateLeadActivity(id: string): Promise<Lead | undefined>;
  
  // Follow-up Management (userId optional - if not provided returns all, if provided filters by assigned user)
  getOverdueFollowUps(userId?: string): Promise<Lead[]>;
  getUpcomingFollowUps(userIdOrHours?: string | number): Promise<Lead[]>;
  updateFollowUpStatus(leadId: string, status: string, notes?: string): Promise<Lead | undefined>;
  markOverdueFollowUps(): Promise<number>;
  
  // Analytics
  getStats(): Promise<{
    totalStudents: number;
    totalBookings: number;
    totalRevenue: number;
    pendingPayments: number;
    occupiedBeds: number;
    totalBeds: number;
    occupancyRate: number;
    studentsThisMonth: number;
    studentsPrevMonth: number;
    bookingsThisMonth: number;
    bookingsPrevMonth: number;
    revenueThisMonth: number;
    revenuePrevMonth: number;
    pendingDueThisWeek: number;
  }>;
  
  // Lead Analytics
  getLeadAnalytics(): Promise<{
    totalLeads: number;
    leadsBySource: { source: string; count: number }[];
    leadsByStatus: { status: string; count: number }[];
    conversionRate: number;
    leadsByMonth: { month: string; count: number }[];
    conversionsByMonth: { month: string; conversions: number; total: number; rate: number }[];
    conversionsBySource: { source: string; total: number; conversions: number; rate: number }[];
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
  
  // Sales Executive Management
  getSalesExecutives(): Promise<User[]>;
  createSalesExecutive(user: InsertUser): Promise<User>;
  
  // Property Assignments
  getPropertyAssignments(userId: string): Promise<SalesExecProperty[]>;
  getAllPropertyAssignments(): Promise<(SalesExecProperty & { user?: User; property?: Property })[]>;
  assignPropertyToUser(assignment: InsertSalesExecProperty): Promise<SalesExecProperty>;
  removePropertyAssignment(userId: string, propertyId: string): Promise<void>;
  getAssignedPropertiesForUser(userId: string): Promise<Property[]>;
  getActiveSalesExecsForProperty(propertyId: string): Promise<User[]>;
  getSalesExecWithLeastLeads(propertyId: string): Promise<User | undefined>;
  getFallbackAssignee(): Promise<User | undefined>;
  
  // Lead Assignment & Scoping
  getLeadsForSalesExec(userId: string, propertyId?: string): Promise<Lead[]>;
  getLeadsForAssignedProperties(userId: string, propertyIds: string[]): Promise<Lead[]>;
  getLeadsByPropertyIds(propertyIds: string[]): Promise<Lead[]>;
  assignLeadToUser(leadId: string, userId: string, assignedBy: string): Promise<Lead | undefined>;
  reassignLead(leadId: string, newUserId: string, reassignedBy: string): Promise<Lead | undefined>;
  
  // Lead Activities (immutable log)
  createLeadActivity(activity: InsertLeadActivity): Promise<LeadActivity>;
  getLeadActivities(leadId: string): Promise<(LeadActivity & { actor?: User })[]>;
  
  // Lead Remarks
  createLeadRemark(remark: InsertLeadRemark): Promise<LeadRemark>;
  getLeadRemarks(leadId: string): Promise<(LeadRemark & { user?: User })[]>;
  
  // Deal Closure
  closeDeal(leadId: string, data: { finalPrice: number; moveInDate: string; selectedRoomTypeId: string; paymentMode: string }, closedBy: string): Promise<Lead | undefined>;
  
  // Follow-ups
  setFollowUp(leadId: string, followUpAt: Date, notes?: string): Promise<Lead | undefined>;
  
  // Sales Exec Stats
  getSalesExecStats(userId: string): Promise<{
    totalLeads: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    closedDeals: number;
    revenue: number;
  }>;
  
  // Notifications
  getUserNotifications(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(filters: {
    actionType?: string;
    entityType?: string;
    actorUserId?: string;
    propertyId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: ActivityLog[]; total: number }>;
  getActivityLogById(id: string): Promise<ActivityLog | undefined>;
  
  // Hero Slides
  getHeroSlides(activeOnly?: boolean): Promise<HeroSlide[]>;
  getHeroSlide(id: string): Promise<HeroSlide | undefined>;
  createHeroSlide(slide: InsertHeroSlide): Promise<HeroSlide>;
  updateHeroSlide(id: string, data: Partial<InsertHeroSlide>): Promise<HeroSlide | undefined>;
  deleteHeroSlide(id: string): Promise<void>;
  reorderHeroSlides(slideIds: string[]): Promise<void>;

  // Footer Settings
  getFooterSettings(): Promise<FooterSettings | null>;
  upsertFooterSettings(data: Partial<FooterSettings>): Promise<FooterSettings>;

  // Map Settings
  getMapSettings(): Promise<MapSettings | null>;
  getAllMapSettings(): Promise<MapSettings[]>;
  upsertMapSettings(data: Partial<MapSettings>): Promise<MapSettings>;
  createMapSettingsGroup(data: Partial<MapSettings>): Promise<MapSettings>;
  updateMapSettingsGroup(id: string, data: Partial<MapSettings>): Promise<MapSettings>;
  deleteMapSettingsGroup(id: string): Promise<void>;

  // Homepage Amenities
  getHomepageAmenities(): Promise<HomepageAmenity[]>;
  createHomepageAmenity(data: InsertHomepageAmenity): Promise<HomepageAmenity>;
  updateHomepageAmenity(id: string, data: Partial<InsertHomepageAmenity>): Promise<HomepageAmenity>;
  deleteHomepageAmenity(id: string): Promise<void>;

  // Instagram
  getInstagramPosts(): Promise<InstagramPost[]>;
  upsertInstagramPosts(posts: InstagramPost[]): Promise<void>;
  getLastInstagramSync(): Promise<{ syncedAt: Date; status: string } | null>;
  logInstagramSync(postCount: number, status: string, errorMessage?: string): Promise<void>;
  clearInstagramPosts(): Promise<void>;

  // Floors & Rooms
  getFloorsByProperty(propertyId: string): Promise<Floor[]>;
  createFloor(floor: InsertFloor): Promise<Floor>;
  deleteFloor(id: string): Promise<void>;
  getRoom(id: string): Promise<Room | undefined>;

  // Beds
  getBedsByFloor(floorId: string): Promise<Bed[]>;
  getBedsByProperty(propertyId: string): Promise<Bed[]>;
  updateBedStatus(bedId: string, status: string): Promise<Bed | undefined>;
  createBed(bed: InsertBed): Promise<Bed>;
  createBeds(beds: InsertBed[]): Promise<Bed[]>;
  deleteBed(id: string): Promise<void>;

  // Packages
  getPackagesByProperty(propertyId: string): Promise<Package[]>;

  // Package Upgrades
  getPackageUpgradeOptions(bookingId: string): Promise<any>;
  upgradeBookingPackage(bookingId: string, targetPackageId: string, upgradedBy: string, reason?: string): Promise<any>;
  getUpgradeHistory(bookingId: string): Promise<any[]>;

  // Property Targets
  getPropertyTargets(propertyId?: string, seasonId?: string): Promise<any[]>;
  upsertPropertyTarget(data: { propertyId: string; targetOccupancyPercent?: number; customTargetOverride?: number | null; seasonId?: string | null; notes?: string | null }): Promise<any>;

  // Bed Reconciliation Runs
  createBedReconciliationRun(data: InsertBedReconciliationRun): Promise<BedReconciliationRun>;
  getBedReconciliationRuns(filters?: { propertyId?: string; from?: Date; to?: Date; limit?: number }): Promise<BedReconciliationRun[]>;

  // Contact Messages
  createContactMessage(msg: InsertContactMessage): Promise<ContactMessage>;
  getAllContactMessages(): Promise<ContactMessage[]>;
  getContactMessage(id: string): Promise<ContactMessage | undefined>;
  updateContactMessageStatus(id: string, status: string, repliedBy?: string): Promise<ContactMessage | undefined>;
  getUnreadContactMessageCount(): Promise<number>;
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

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersByRole(roles: string[]): Promise<User[]> {
    return await db.select().from(users).where(inArray(users.role, roles as any));
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

  async getPropertyBySlug(slug: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.slug, slug));
    return property || undefined;
  }

  async getPropertyByIdOrSlug(idOrSlug: string): Promise<Property | undefined> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    if (isUuid) {
      return this.getProperty(idOrSlug);
    }
    return this.getPropertyBySlug(idOrSlug);
  }

  async recordBrochureDownload(propertyId: string): Promise<void> {
    await db
      .update(properties)
      .set({
        brochureDownloadCount: sql`${properties.brochureDownloadCount} + 1`,
        brochureLastDownloadedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));
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

  async deleteProperty(id: string): Promise<void> {
    const propertyLeads = await db.select({ id: leads.id }).from(leads).where(eq(leads.propertyId, id));
    const leadIds = propertyLeads.map(l => l.id);
    if (leadIds.length > 0) {
      for (const leadId of leadIds) {
        await db.delete(leadActivities).where(eq(leadActivities.leadId, leadId));
        await db.delete(leadRemarks).where(eq(leadRemarks.leadId, leadId));
      }
      await db.delete(leads).where(eq(leads.propertyId, id));
    }

    const convos = await db.select({ id: chatbotConversations.id }).from(chatbotConversations).where(eq(chatbotConversations.propertyId, id));
    if (convos.length > 0) {
      for (const c of convos) {
        await db.delete(chatbotMessages).where(eq(chatbotMessages.conversationId, c.id));
        await db.delete(chatbotEvents).where(eq(chatbotEvents.conversationId, c.id));
      }
      await db.delete(chatbotConversations).where(eq(chatbotConversations.propertyId, id));
    }
    await db.delete(chatbotKnowledge).where(eq(chatbotKnowledge.propertyId, id));
    await db.delete(chatbotSettings).where(eq(chatbotSettings.propertyId, id));

    await db.delete(propertyImages).where(eq(propertyImages.propertyId, id));
    await db.delete(propertyTariffs).where(eq(propertyTariffs.propertyId, id));
    await db.delete(propertyRules).where(eq(propertyRules.propertyId, id));
    await db.delete(nearbyLocations).where(eq(nearbyLocations.propertyId, id));
    await db.delete(roomTypes).where(eq(roomTypes.propertyId, id));
    await db.delete(salesExecProperties).where(eq(salesExecProperties.propertyId, id));
    await db.delete(properties).where(eq(properties.id, id));
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

  async deleteRoomType(id: string): Promise<void> {
    await db.delete(roomTypes).where(eq(roomTypes.id, id));
  }

  // Bookings
  async getBooking(id: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking || undefined;
  }

  async getBookingByCode(bookingCode: string): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.bookingCode, bookingCode));
    return booking || undefined;
  }

  async getBookingsByStudent(studentId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.studentId, studentId))
      .orderBy(desc(bookings.createdAt));
  }

  async getBookingsByProperty(propertyId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.propertyId, propertyId))
      .orderBy(desc(bookings.createdAt));
  }

  async getBookingsByCreator(userId: string): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.createdBy, userId))
      .orderBy(desc(bookings.createdAt));
  }

  async getPendingApprovalBookings(): Promise<Booking[]> {
    return await db
      .select()
      .from(bookings)
      .where(eq(bookings.approvalStatus, "pending"))
      .orderBy(desc(bookings.createdAt));
  }

  async getAllBookings(): Promise<Booking[]> {
    return await db.select().from(bookings).orderBy(desc(bookings.createdAt));
  }

  async generateBookingCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `HSQ-${year}-`;
    
    // Get the latest booking code for this year
    const [latest] = await db
      .select({ bookingCode: bookings.bookingCode })
      .from(bookings)
      .where(sql`${bookings.bookingCode} LIKE ${prefix + '%'}`)
      .orderBy(desc(bookings.bookingCode))
      .limit(1);
    
    let nextNumber = 1;
    if (latest?.bookingCode) {
      const lastNumber = parseInt(latest.bookingCode.replace(prefix, ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }
    
    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
  }

  async createBookingWithCode(insertBooking: InsertBooking): Promise<Booking> {
    const bookingCode = await this.generateBookingCode();
    const [booking] = await db.insert(bookings).values({
      ...insertBooking,
      bookingCode,
    }).returning();
    return booking;
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

  async deleteBooking(id: string): Promise<void> {
    const booking = await this.getBooking(id);
    if (booking) {
      if (booking.bedId) {
        await this.updateBedStatus(booking.bedId, "available");
        await this.updateRoomTypeAvailability(booking.roomTypeId, 1);
        if (booking.floorId) {
          const floorBeds = await this.getBedsByFloor(booking.floorId);
          const availCount = floorBeds.filter(b => b.status === "available").length;
          await db.update(floors).set({ availableBeds: availCount }).where(eq(floors.id, booking.floorId));
        }
      } else if (booking.bedAllocated) {
        await this.updateRoomTypeAvailability(booking.roomTypeId, 1);
      }
    }
    await db.update(registrationRequests)
      .set({ bookingId: null, status: 'approved' })
      .where(eq(registrationRequests.bookingId, id));
    await db.delete(packageUsage).where(eq(packageUsage.bookingId, id));
    await db.delete(residentSeasonStatus).where(eq(residentSeasonStatus.bookingId, id));
    await db.delete(bedAllocations).where(eq(bedAllocations.bookingId, id));
    await db.delete(walletLedger).where(eq(walletLedger.bookingId, id));
    await db.delete(payments).where(eq(payments.bookingId, id));
    await db.delete(installments).where(eq(installments.bookingId, id));
    await db.delete(bookingPackages).where(eq(bookingPackages.bookingId, id));
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  async confirmBooking(id: string, approvedBy?: string): Promise<Booking | undefined> {
    const booking = await this.getBooking(id);
    if (!booking) return undefined;
    
    // Allocate bed first
    const roomType = await this.getRoomType(booking.roomTypeId);
    if (!roomType || roomType.availableBeds < 1) {
      throw new Error("No beds available for this room type");
    }
    
    // Decrease available beds
    await this.updateRoomTypeAvailability(booking.roomTypeId, -1);

    if (booking.bedId) {
      await this.updateBedStatus(booking.bedId, "occupied");
      if (booking.floorId) {
        const floorBeds = await this.getBedsByFloor(booking.floorId);
        const availCount = floorBeds.filter(b => b.status === "available").length;
        await db.update(floors).set({ availableBeds: availCount }).where(eq(floors.id, booking.floorId));
      }
    }
    
    // Update booking status to confirmed
    const [updated] = await db
      .update(bookings)
      .set({
        status: "confirmed",
        approvalStatus: booking.approvalRequired ? "approved" : "not_required",
        approvedBy: approvedBy || undefined,
        approvedAt: approvedBy ? new Date() : undefined,
        bedAllocated: true,
        bedAllocatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id))
      .returning();
    
    return updated || undefined;
  }

  async cancelBooking(id: string, reason?: string): Promise<Booking | undefined> {
    const booking = await this.getBooking(id);
    if (!booking) return undefined;
    
    // Release the bed if one was assigned
    if (booking.bedId) {
      await this.updateBedStatus(booking.bedId, "available");
      await this.updateRoomTypeAvailability(booking.roomTypeId, 1);

      if (booking.floorId) {
        const floorBeds = await this.getBedsByFloor(booking.floorId);
        const availCount = floorBeds.filter(b => b.status === "available").length;
        await db.update(floors).set({ availableBeds: availCount }).where(eq(floors.id, booking.floorId));
      }
    } else if (booking.bedAllocated) {
      await this.updateRoomTypeAvailability(booking.roomTypeId, 1);
    }
    
    const [updated] = await db
      .update(bookings)
      .set({
        status: "cancelled",
        bedId: null,
        floorId: null,
        roomId: null,
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, id))
      .returning();
    
    return updated || undefined;
  }

  async getRoomTypeAvailability(roomTypeId: string): Promise<{ totalBeds: number; availableBeds: number; bookedBeds: number }> {
    const roomType = await this.getRoomType(roomTypeId);
    if (!roomType) {
      return { totalBeds: 0, availableBeds: 0, bookedBeds: 0 };
    }
    
    return {
      totalBeds: roomType.totalBeds,
      availableBeds: roomType.availableBeds,
      bookedBeds: roomType.totalBeds - roomType.availableBeds,
    };
  }

  async allocateBed(bookingId: string): Promise<Booking | undefined> {
    const booking = await this.getBooking(bookingId);
    if (!booking || booking.bedAllocated) return booking;
    
    // Decrease available beds
    await this.updateRoomTypeAvailability(booking.roomTypeId, -1);
    
    const [updated] = await db
      .update(bookings)
      .set({
        bedAllocated: true,
        bedAllocatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();
    
    return updated || undefined;
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
    const normalized = this.normalizeLeadPhone(phone) || phone;
    const [lead] = await db.select().from(leads).where(eq(leads.phone, normalized));
    if (lead) return lead;
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (digits.length === 10) {
      const [fallback] = await db.select().from(leads)
        .where(sql`regexp_replace(${leads.phone}, '[^0-9]', '', 'g') LIKE ${'%' + digits}`)
        .limit(1);
      return fallback || undefined;
    }
    return undefined;
  }

  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    return lead || undefined;
  }

  private normalizeLeadPhone(phone: string | null | undefined): string | null | undefined {
    if (!phone) return phone;
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) {
      return "+91" + digits;
    }
    if (digits.length === 12 && digits.startsWith("91")) {
      return "+" + digits;
    }
    if (digits.length === 11 && digits.startsWith("0")) {
      return "+91" + digits.slice(1);
    }
    let normalized = phone.replace(/[^\d+]/g, "");
    if (normalized.startsWith("+91") && normalized.length === 13) {
      return normalized;
    }
    return normalized || phone;
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    if (insertLead.phone) {
      insertLead = { ...insertLead, phone: this.normalizeLeadPhone(insertLead.phone) as string };
    }
    const [lead] = await db.insert(leads).values(insertLead).returning();
    return lead;
  }

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead | undefined> {
    if (data.phone) {
      data = { ...data, phone: this.normalizeLeadPhone(data.phone) as string };
    }
    const [lead] = await db
      .update(leads)
      .set(data)
      .where(eq(leads.id, id))
      .returning();
    return lead || undefined;
  }

  async deleteLead(id: string): Promise<void> {
    await db.delete(leadRemarks).where(eq(leadRemarks.leadId, id));
    await db.delete(leadActivities).where(eq(leadActivities.leadId, id));
    await db.delete(leads).where(eq(leads.id, id));
  }

  async getAllLeads(propertyId?: string): Promise<Lead[]> {
    if (propertyId) {
      return await db.select().from(leads).where(eq(leads.propertyId, propertyId)).orderBy(desc(leads.lastActivityAt));
    }
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

  // Follow-up Management
  async getOverdueFollowUps(userId?: string): Promise<Lead[]> {
    const now = new Date();
    const conditions = [
      lt(leads.followUpAt, now),
      sql`${leads.status} NOT IN ('deal_closed', 'lost', 'converted')`,
      sql`(${leads.followUpStatus} IS NULL OR ${leads.followUpStatus} != 'completed')`
    ];
    
    if (userId) {
      conditions.push(eq(leads.assignedToId, userId));
    }
    
    return await db
      .select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(asc(leads.followUpAt));
  }

  async getUpcomingFollowUps(userIdOrHours?: string | number): Promise<Lead[]> {
    const now = new Date();
    const hoursAhead = typeof userIdOrHours === 'number' ? userIdOrHours : 168; // 7 days default
    const userId = typeof userIdOrHours === 'string' ? userIdOrHours : undefined;
    const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    
    const conditions = [
      gte(leads.followUpAt, now),
      lte(leads.followUpAt, future),
      eq(leads.followUpStatus, "pending")
    ];
    
    if (userId) {
      conditions.push(eq(leads.assignedToId, userId));
    }
    
    return await db
      .select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(asc(leads.followUpAt));
  }

  async updateFollowUpStatus(leadId: string, status: string, notes?: string): Promise<Lead | undefined> {
    const updateData: Record<string, any> = { followUpStatus: status };
    if (notes !== undefined) {
      updateData.followUpNotes = notes;
    }
    const [lead] = await db
      .update(leads)
      .set(updateData)
      .where(eq(leads.id, leadId))
      .returning();
    return lead || undefined;
  }

  async markOverdueFollowUps(): Promise<number> {
    const now = new Date();
    const result = await db
      .update(leads)
      .set({ followUpStatus: "overdue" })
      .where(
        and(
          lt(leads.followUpAt, now),
          eq(leads.followUpStatus, "pending")
        )
      )
      .returning();
    return result.length;
  }

  // Analytics
  async getStats(propertyId?: string): Promise<{
    totalStudents: number;
    totalBookings: number;
    totalRevenue: number;
    pendingPayments: number;
    occupiedBeds: number;
    totalBeds: number;
    occupancyRate: number;
    studentsThisMonth: number;
    studentsPrevMonth: number;
    bookingsThisMonth: number;
    bookingsPrevMonth: number;
    revenueThisMonth: number;
    revenuePrevMonth: number;
    pendingDueThisWeek: number;
  }> {
    const propFilter = propertyId
      ? sql` AND property_id = ${propertyId}`
      : sql``;

    let totalStudents: number;
    if (propertyId) {
      const [bookingStudents] = await db
        .select({ count: sql<number>`count(DISTINCT COALESCE(student_id, walk_in_phone))::int` })
        .from(bookings)
        .where(sql`(student_id IS NOT NULL OR walk_in_phone IS NOT NULL) AND property_id = ${propertyId}`);
      totalStudents = bookingStudents?.count || 0;
    } else {
      const [registeredStudents] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(students);
      const [bookingStudents] = await db
        .select({ count: sql<number>`count(DISTINCT COALESCE(student_id, walk_in_phone))::int` })
        .from(bookings)
        .where(sql`student_id IS NOT NULL OR walk_in_phone IS NOT NULL`);
      totalStudents = (registeredStudents?.count || 0) + (bookingStudents?.count || 0);
    }

    const [bookingsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(propertyId ? eq(bookings.propertyId, propertyId) : sql`1=1`);

    const revenueResult: any = await db.execute(sql`
      SELECT COALESCE(SUM(p.amount), 0)::int AS total
      FROM payments p
      ${propertyId ? sql`JOIN bookings b ON b.id = p.booking_id` : sql``}
      WHERE p.status = 'success'
      ${propertyId ? sql`AND b.property_id = ${propertyId}` : sql``}
    `);
    const revenueData = revenueResult?.rows?.[0] ?? revenueResult?.[0] ?? { total: 0 };

    const pendingResult: any = await db.execute(sql`
      SELECT COALESCE(SUM(i.amount), 0)::int AS total
      FROM installments i
      ${propertyId ? sql`JOIN bookings b ON b.id = i.booking_id` : sql``}
      WHERE i.paid = false
      ${propertyId ? sql`AND b.property_id = ${propertyId}` : sql``}
    `);
    const pendingData = pendingResult?.rows?.[0] ?? pendingResult?.[0] ?? { total: 0 };

    const [bedStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        occupied: sql<number>`count(*) FILTER (WHERE status = 'occupied')::int`,
      })
      .from(beds)
      .where(propertyId ? eq(beds.propertyId, propertyId) : sql`1=1`);

    const totalBeds = bedStats?.total || 0;
    const occupiedBeds = bedStats?.occupied || 0;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    const [studentsThisMonthData] = await db
      .select({ count: sql<number>`count(DISTINCT COALESCE(student_id, walk_in_phone))::int` })
      .from(bookings)
      .where(sql`(student_id IS NOT NULL OR walk_in_phone IS NOT NULL) AND created_at >= date_trunc('month', CURRENT_DATE)${propFilter}`);

    const [studentsPrevMonthData] = await db
      .select({ count: sql<number>`count(DISTINCT COALESCE(student_id, walk_in_phone))::int` })
      .from(bookings)
      .where(sql`(student_id IS NOT NULL OR walk_in_phone IS NOT NULL) AND created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < date_trunc('month', CURRENT_DATE)${propFilter}`);

    const [bookingsThisMonthData] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(sql`created_at >= date_trunc('month', CURRENT_DATE)${propFilter}`);

    const [bookingsPrevMonthData] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(sql`created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < date_trunc('month', CURRENT_DATE)${propFilter}`);

    const revenueThisMonthResult: any = await db.execute(sql`
      SELECT COALESCE(SUM(p.amount), 0)::int AS total
      FROM payments p
      ${propertyId ? sql`JOIN bookings b ON b.id = p.booking_id` : sql``}
      WHERE p.status = 'success' AND p.created_at >= date_trunc('month', CURRENT_DATE)
      ${propertyId ? sql`AND b.property_id = ${propertyId}` : sql``}
    `);
    const revenueThisMonthData = revenueThisMonthResult?.rows?.[0] ?? revenueThisMonthResult?.[0] ?? { total: 0 };

    const revenuePrevMonthResult: any = await db.execute(sql`
      SELECT COALESCE(SUM(p.amount), 0)::int AS total
      FROM payments p
      ${propertyId ? sql`JOIN bookings b ON b.id = p.booking_id` : sql``}
      WHERE p.status = 'success'
        AND p.created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
        AND p.created_at < date_trunc('month', CURRENT_DATE)
      ${propertyId ? sql`AND b.property_id = ${propertyId}` : sql``}
    `);
    const revenuePrevMonthData = revenuePrevMonthResult?.rows?.[0] ?? revenuePrevMonthResult?.[0] ?? { total: 0 };

    const pendingDueThisWeekResult: any = await db.execute(sql`
      SELECT COALESCE(SUM(i.amount), 0)::int AS total
      FROM installments i
      ${propertyId ? sql`JOIN bookings b ON b.id = i.booking_id` : sql``}
      WHERE i.paid = false
      ${propertyId ? sql`AND b.property_id = ${propertyId}` : sql``}
    `);
    const pendingDueThisWeekData = pendingDueThisWeekResult?.rows?.[0] ?? pendingDueThisWeekResult?.[0] ?? { total: 0 };

    return {
      totalStudents: totalStudents,
      totalBookings: bookingsCount?.count || 0,
      totalRevenue: revenueData?.total || 0,
      pendingPayments: pendingData?.total || 0,
      occupiedBeds,
      totalBeds,
      occupancyRate,
      studentsThisMonth: studentsThisMonthData?.count || 0,
      studentsPrevMonth: studentsPrevMonthData?.count || 0,
      bookingsThisMonth: bookingsThisMonthData?.count || 0,
      bookingsPrevMonth: bookingsPrevMonthData?.count || 0,
      revenueThisMonth: revenueThisMonthData?.total || 0,
      revenuePrevMonth: revenuePrevMonthData?.total || 0,
      pendingDueThisWeek: pendingDueThisWeekData?.total || 0,
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
    conversionsBySource: { source: string; total: number; conversions: number; rate: number }[];
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

    // Conversions by source
    const conversionSourceData = await db
      .select({
        source: leads.source,
        total: sql<number>`count(*)::int`,
        conversions: sql<number>`SUM(CASE WHEN converted_to_student THEN 1 ELSE 0 END)::int`,
      })
      .from(leads)
      .groupBy(leads.source);

    const conversionsBySource = conversionSourceData.map((row) => ({
      source: row.source || "unknown",
      total: row.total,
      conversions: row.conversions || 0,
      rate: row.total > 0 ? ((row.conversions || 0) / row.total) * 100 : 0,
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
      conversionsBySource,
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
    const distinctPropertyIds = await db
      .selectDistinct({ propertyId: leads.propertyId })
      .from(leads)
      .where(sql`${leads.propertyId} IS NOT NULL`);

    const uniqueIds = [...new Set(distinctPropertyIds.map(p => p.propertyId).filter(Boolean))] as string[];

    const funnels = await Promise.all(
      uniqueIds.map(async (propertyId) => {
        return this.getPropertyLeadFunnel(propertyId);
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

  // Sales Executive Management
  async getSalesExecutives(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "sales_executive"));
  }

  async createSalesExecutive(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values({ ...user, role: "sales_executive" }).returning();
    return created;
  }

  // Property Assignments
  async getPropertyAssignments(userId: string): Promise<SalesExecProperty[]> {
    return await db.select().from(salesExecProperties).where(eq(salesExecProperties.userId, userId));
  }

  async getAllPropertyAssignments(): Promise<(SalesExecProperty & { user?: User; property?: Property })[]> {
    const assignments = await db.select().from(salesExecProperties);
    const result = [];
    for (const assignment of assignments) {
      const [user] = await db.select().from(users).where(eq(users.id, assignment.userId));
      const [property] = await db.select().from(properties).where(eq(properties.id, assignment.propertyId));
      result.push({ ...assignment, user, property });
    }
    return result;
  }

  async assignPropertyToUser(assignment: InsertSalesExecProperty): Promise<SalesExecProperty> {
    const [created] = await db.insert(salesExecProperties).values(assignment).returning();
    return created;
  }

  async removePropertyAssignment(userId: string, propertyId: string): Promise<void> {
    await db.delete(salesExecProperties).where(
      and(eq(salesExecProperties.userId, userId), eq(salesExecProperties.propertyId, propertyId))
    );
  }

  async getAssignedPropertiesForUser(userId: string): Promise<Property[]> {
    const assignments = await db.select().from(salesExecProperties).where(eq(salesExecProperties.userId, userId));
    if (assignments.length === 0) return [];
    const propertyIds = assignments.map(a => a.propertyId);
    return await db.select().from(properties).where(inArray(properties.id, propertyIds));
  }

  async getActiveSalesExecsForProperty(propertyId: string): Promise<User[]> {
    const assignments = await db.select().from(salesExecProperties)
      .where(and(
        eq(salesExecProperties.propertyId, propertyId),
        eq(salesExecProperties.isActive, true)
      ));
    if (assignments.length === 0) return [];
    const userIds = assignments.map(a => a.userId);
    return await db.select().from(users).where(inArray(users.id, userIds));
  }

  // Cached lookup for the catch-all "fallback" assignee. We cache the row
  // once on first hit because this is checked on every web/enquiry/manual
  // lead create where no property mapping exists, and the user row never
  // changes. Set to `null` if the user row is missing so we don't keep
  // re-querying.
  private cachedFallbackAssignee: User | null | undefined = undefined;

  async getFallbackAssignee(): Promise<User | undefined> {
    if (this.cachedFallbackAssignee !== undefined) {
      return this.cachedFallbackAssignee || undefined;
    }
    const [user] = await db
      .select()
      .from(users)
      .where(and(
        eq(users.email, "bibhuti@hsquareliving.com"),
        eq(users.role, "sales_executive"),
      ))
      .limit(1);
    this.cachedFallbackAssignee = user || null;
    if (!user) {
      console.warn(
        "[FallbackAssignee] No active sales_executive found for bibhuti@hsquareliving.com — leads will fall through to existing per-route behavior.",
      );
    }
    return user || undefined;
  }

  async getSalesExecWithLeastLeads(propertyId: string): Promise<User | undefined> {
    // Get all active sales execs for this property
    const salesExecs = await this.getActiveSalesExecsForProperty(propertyId);
    if (salesExecs.length === 0) return undefined;
    
    // Count active leads for each sales exec for this property
    let minLeads = Infinity;
    let selectedExec: User | undefined;
    
    for (const exec of salesExecs) {
      const leadCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(and(
          eq(leads.assignedToId, exec.id),
          eq(leads.propertyId, propertyId),
          sql`${leads.status} NOT IN ('deal_closed', 'lost', 'converted')`
        ));
      
      const count = leadCount[0]?.count || 0;
      if (count < minLeads) {
        minLeads = count;
        selectedExec = exec;
      }
    }
    
    return selectedExec;
  }

  // Lead Assignment & Scoping
  async getLeadsForSalesExec(userId: string, propertyId?: string): Promise<Lead[]> {
    const ownerCondition = or(eq(leads.assignedToId, userId), eq(leads.createdBy, userId));
    const conditions = propertyId
      ? and(ownerCondition, eq(leads.propertyId, propertyId))
      : ownerCondition;
    return await db.select().from(leads).where(conditions!).orderBy(desc(leads.createdAt));
  }

  async getLeadsForAssignedProperties(userId: string, propertyIds: string[]): Promise<Lead[]> {
    return await db.select().from(leads)
      .where(or(eq(leads.assignedToId, userId), eq(leads.createdBy, userId)))
      .orderBy(desc(leads.createdAt));
  }

  async getLeadsByPropertyIds(propertyIds: string[]): Promise<Lead[]> {
    if (propertyIds.length === 0) return [];
    return await db.select().from(leads)
      .where(inArray(leads.propertyId, propertyIds))
      .orderBy(desc(leads.createdAt));
  }

  async assignLeadToUser(leadId: string, userId: string, assignedBy: string): Promise<Lead | undefined> {
    const [updated] = await db.update(leads).set({
      assignedToId: userId,
      assignedAt: new Date(),
      assignmentType: "admin_manual",
    }).where(eq(leads.id, leadId)).returning();
    
    if (updated) {
      await this.createLeadActivity({
        leadId,
        actorId: assignedBy,
        actionType: "lead_assigned",
        newValue: JSON.stringify({ assignedToId: userId }),
        description: "Lead assigned to sales executive",
      });
    }
    return updated || undefined;
  }

  async reassignLead(leadId: string, newUserId: string, reassignedBy: string): Promise<Lead | undefined> {
    const [existingLead] = await db.select().from(leads).where(eq(leads.id, leadId));
    const previousUserId = existingLead?.assignedToId;
    
    const [updated] = await db.update(leads).set({
      assignedToId: newUserId,
      assignedAt: new Date(),
      assignmentType: "admin_manual",
    }).where(eq(leads.id, leadId)).returning();
    
    if (updated) {
      await this.createLeadActivity({
        leadId,
        actorId: reassignedBy,
        actionType: "lead_reassigned",
        previousValue: JSON.stringify({ assignedToId: previousUserId }),
        newValue: JSON.stringify({ assignedToId: newUserId }),
        description: "Lead reassigned to different sales executive",
      });
    }
    return updated || undefined;
  }

  // Lead Activities
  async createLeadActivity(activity: InsertLeadActivity): Promise<LeadActivity> {
    const [created] = await db.insert(leadActivities).values(activity).returning();
    return created;
  }

  async getLeadActivities(leadId: string): Promise<(LeadActivity & { actor?: User })[]> {
    const activities = await db.select().from(leadActivities)
      .where(eq(leadActivities.leadId, leadId))
      .orderBy(desc(leadActivities.createdAt));
    
    const result = [];
    for (const activity of activities) {
      const [actor] = await db.select().from(users).where(eq(users.id, activity.actorId));
      result.push({ ...activity, actor });
    }
    return result;
  }

  // Lead Remarks
  async createLeadRemark(remark: InsertLeadRemark): Promise<LeadRemark> {
    const [created] = await db.insert(leadRemarks).values(remark).returning();
    
    await this.createLeadActivity({
      leadId: remark.leadId,
      actorId: remark.userId,
      actionType: "remark_added",
      newValue: JSON.stringify({ remark: remark.remark }),
      description: "Remark added to lead",
    });
    
    return created;
  }

  async getLeadRemarks(leadId: string): Promise<(LeadRemark & { user?: User })[]> {
    const remarks = await db.select().from(leadRemarks)
      .where(eq(leadRemarks.leadId, leadId))
      .orderBy(desc(leadRemarks.createdAt));
    
    const result = [];
    for (const remark of remarks) {
      const [user] = await db.select().from(users).where(eq(users.id, remark.userId));
      result.push({ ...remark, user });
    }
    return result;
  }

  // Deal Closure
  async closeDeal(leadId: string, data: { finalPrice: number; moveInDate: string; selectedRoomTypeId: string; paymentMode: string }, closedBy: string): Promise<Lead | undefined> {
    const [updated] = await db.update(leads).set({
      status: "converted",
      dealClosedAt: new Date(),
      finalPrice: data.finalPrice,
      moveInDate: data.moveInDate,
      selectedRoomTypeId: data.selectedRoomTypeId,
      paymentMode: data.paymentMode,
      isLocked: true,
      score: 100,
      priority: "hot",
    }).where(eq(leads.id, leadId)).returning();
    
    if (updated) {
      await this.createLeadActivity({
        leadId,
        actorId: closedBy,
        actionType: "deal_closed",
        newValue: JSON.stringify(data),
        description: `Deal closed for ₹${data.finalPrice.toLocaleString()}`,
      });
    }
    return updated || undefined;
  }

  // Follow-ups
  async setFollowUp(leadId: string, followUpAt: Date, notes?: string): Promise<Lead | undefined> {
    const [updated] = await db.update(leads).set({
      followUpAt,
      followUpNotes: notes,
      followUpStatus: "pending",
    }).where(eq(leads.id, leadId)).returning();
    return updated || undefined;
  }

  // Sales Exec Stats
  async getSalesExecStats(userId: string): Promise<{
    totalLeads: number;
    hotLeads: number;
    warmLeads: number;
    coldLeads: number;
    closedDeals: number;
    revenue: number;
  }> {
    const userLeads = await db.select().from(leads).where(eq(leads.assignedToId, userId));
    
    const totalLeads = userLeads.length;
    const hotLeads = userLeads.filter(l => l.priority === "hot").length;
    const warmLeads = userLeads.filter(l => l.priority === "warm").length;
    const coldLeads = userLeads.filter(l => l.priority === "cold").length;
    const closedDeals = userLeads.filter(l => l.status === "converted").length;
    const revenue = userLeads
      .filter(l => l.status === "converted" && l.finalPrice)
      .reduce((sum, l) => sum + (l.finalPrice || 0), 0);
    
    return { totalLeads, hotLeads, warmLeads, coldLeads, closedDeals, revenue };
  }

  // Notifications
  async getUserNotifications(userId: string, limit: number = 20): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result[0]?.count || 0;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated || undefined;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  // Activity Logs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [created] = await db.insert(activityLogs).values(log).returning();
    return created;
  }

  async getActivityLogs(filters: {
    actionType?: string;
    entityType?: string;
    actorUserId?: string;
    propertyId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: ActivityLog[]; total: number }> {
    const conditions = [];
    
    if (filters.actionType) {
      conditions.push(eq(activityLogs.actionType, filters.actionType as any));
    }
    if (filters.entityType) {
      conditions.push(eq(activityLogs.entityType, filters.entityType as any));
    }
    if (filters.actorUserId) {
      conditions.push(eq(activityLogs.actorUserId, filters.actorUserId));
    }
    if (filters.propertyId) {
      conditions.push(eq(activityLogs.propertyId, filters.propertyId));
    }
    if (filters.startDate) {
      conditions.push(gte(activityLogs.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(activityLogs.createdAt, filters.endDate));
    }
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(activityLogs.actorName, searchTerm),
          ilike(activityLogs.entityLabel, searchTerm),
          ilike(activityLogs.propertyName || '', searchTerm)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult, logs] = await Promise.all([
      db.select({ count: count() }).from(activityLogs).where(whereClause),
      db
        .select()
        .from(activityLogs)
        .where(whereClause)
        .orderBy(desc(activityLogs.createdAt))
        .limit(filters.limit || 50)
        .offset(filters.offset || 0)
    ]);

    return {
      logs,
      total: totalResult[0]?.count || 0
    };
  }

  async getActivityLogById(id: string): Promise<ActivityLog | undefined> {
    const [log] = await db.select().from(activityLogs).where(eq(activityLogs.id, id));
    return log || undefined;
  }

  async getHeroSlides(activeOnly: boolean = false): Promise<HeroSlide[]> {
    if (activeOnly) {
      return db.select().from(heroSlides).where(eq(heroSlides.isActive, true)).orderBy(asc(heroSlides.sortOrder));
    }
    return db.select().from(heroSlides).orderBy(asc(heroSlides.sortOrder));
  }

  async getHeroSlide(id: string): Promise<HeroSlide | undefined> {
    const [slide] = await db.select().from(heroSlides).where(eq(heroSlides.id, id));
    return slide || undefined;
  }

  async createHeroSlide(slide: InsertHeroSlide): Promise<HeroSlide> {
    const [created] = await db.insert(heroSlides).values(slide).returning();
    return created;
  }

  async updateHeroSlide(id: string, data: Partial<InsertHeroSlide>): Promise<HeroSlide | undefined> {
    const [updated] = await db.update(heroSlides).set(data).where(eq(heroSlides.id, id)).returning();
    return updated || undefined;
  }

  async deleteHeroSlide(id: string): Promise<void> {
    await db.delete(heroSlides).where(eq(heroSlides.id, id));
  }

  async reorderHeroSlides(slideIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < slideIds.length; i++) {
        await tx.update(heroSlides).set({ sortOrder: i }).where(eq(heroSlides.id, slideIds[i]));
      }
    });
  }

  async getFooterSettings(): Promise<FooterSettings | null> {
    const [settings] = await db.select().from(footerSettings).limit(1);
    return settings || null;
  }

  async upsertFooterSettings(data: Partial<FooterSettings>): Promise<FooterSettings> {
    const existing = await this.getFooterSettings();
    if (existing) {
      const [updated] = await db.update(footerSettings).set({ ...data, updatedAt: new Date() }).where(eq(footerSettings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(footerSettings).values(data as any).returning();
    return created;
  }

  async getMapSettings(): Promise<MapSettings | null> {
    const [settings] = await db.select().from(mapSettings).limit(1);
    return settings || null;
  }

  async getAllMapSettings(): Promise<MapSettings[]> {
    return await db.select().from(mapSettings).orderBy(mapSettings.updatedAt);
  }

  async upsertMapSettings(data: Partial<MapSettings>): Promise<MapSettings> {
    const existing = await this.getMapSettings();
    if (existing) {
      const [updated] = await db.update(mapSettings).set({ ...data, updatedAt: new Date() }).where(eq(mapSettings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(mapSettings).values(data as any).returning();
    return created;
  }

  async createMapSettingsGroup(data: Partial<MapSettings>): Promise<MapSettings> {
    const [created] = await db.insert(mapSettings).values(data as any).returning();
    return created;
  }

  async updateMapSettingsGroup(id: string, data: Partial<MapSettings>): Promise<MapSettings> {
    const [updated] = await db.update(mapSettings).set({ ...data, updatedAt: new Date() }).where(eq(mapSettings.id, id)).returning();
    return updated;
  }

  async deleteMapSettingsGroup(id: string): Promise<void> {
    await db.delete(mapSettings).where(eq(mapSettings.id, id));
  }

  async getInstagramPosts(): Promise<InstagramPost[]> {
    return await db.select().from(instagramPosts).orderBy(desc(instagramPosts.instagramTimestamp));
  }

  async upsertInstagramPosts(posts: InstagramPost[]): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(instagramPosts);
      for (const post of posts) {
        await tx.insert(instagramPosts).values(post);
      }
    });
  }

  async getLastInstagramSync(): Promise<{ syncedAt: Date; status: string } | null> {
    const [latest] = await db.select().from(instagramSyncLog).orderBy(desc(instagramSyncLog.syncedAt)).limit(1);
    return latest ? { syncedAt: latest.syncedAt, status: latest.status } : null;
  }

  async logInstagramSync(postCount: number, status: string, errorMessage?: string): Promise<void> {
    await db.insert(instagramSyncLog).values({ postCount, status, errorMessage });
  }

  async clearInstagramPosts(): Promise<void> {
    await db.delete(instagramPosts);
  }

  // Floors
  async getFloorsByProperty(propertyId: string): Promise<Floor[]> {
    return await db.select().from(floors).where(eq(floors.propertyId, propertyId)).orderBy(asc(floors.floorNumber));
  }

  async createFloor(floor: InsertFloor): Promise<Floor> {
    const [created] = await db.insert(floors).values(floor).returning();
    return created;
  }

  async deleteFloor(id: string): Promise<void> {
    await db.delete(beds).where(eq(beds.floorId, id));
    await db.delete(rooms).where(eq(rooms.floorId, id));
    await db.delete(floors).where(eq(floors.id, id));
  }

  // Rooms
  async getRoom(id: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room || undefined;
  }

  async getRoomsByFloor(floorId: string): Promise<Room[]> {
    return await db.select().from(rooms).where(eq(rooms.floorId, floorId)).orderBy(asc(rooms.roomNumber));
  }

  async getRoomsByProperty(propertyId: string): Promise<Room[]> {
    return await db.select().from(rooms).where(eq(rooms.propertyId, propertyId)).orderBy(asc(rooms.roomNumber));
  }

  async createRoom(room: InsertRoom): Promise<Room> {
    const [created] = await db.insert(rooms).values(room).returning();
    return created;
  }

  async createRooms(roomData: InsertRoom[]): Promise<Room[]> {
    if (roomData.length === 0) return [];
    return await db.insert(rooms).values(roomData).returning();
  }

  async updateRoom(id: string, data: Partial<InsertRoom>): Promise<Room | undefined> {
    const [updated] = await db.update(rooms).set(data as any).where(eq(rooms.id, id)).returning();
    return updated || undefined;
  }

  async deleteRoom(id: string): Promise<void> {
    await db.delete(beds).where(eq(beds.roomId, id));
    await db.delete(rooms).where(eq(rooms.id, id));
  }

  // Beds
  async getBedsByFloor(floorId: string): Promise<Bed[]> {
    return await db.select().from(beds).where(eq(beds.floorId, floorId)).orderBy(asc(beds.bedNumber));
  }

  async getBedsByRoom(roomId: string): Promise<Bed[]> {
    return await db.select().from(beds).where(eq(beds.roomId, roomId)).orderBy(asc(beds.bedNumber));
  }

  async getBedsByProperty(propertyId: string): Promise<Bed[]> {
    return await db.select().from(beds).where(eq(beds.propertyId, propertyId)).orderBy(asc(beds.bedNumber));
  }

  async updateBedStatus(bedId: string, status: string): Promise<Bed | undefined> {
    const [updated] = await db.update(beds).set({ status: status as any }).where(eq(beds.id, bedId)).returning();
    return updated || undefined;
  }

  async createBed(bed: InsertBed): Promise<Bed> {
    const [created] = await db.insert(beds).values(bed).returning();
    return created;
  }

  async createBeds(bedData: InsertBed[]): Promise<Bed[]> {
    if (bedData.length === 0) return [];
    return await db.insert(beds).values(bedData).returning();
  }

  async deleteBed(id: string): Promise<void> {
    await db.delete(beds).where(eq(beds.id, id));
  }

  async getBed(id: string): Promise<Bed | undefined> {
    const [bed] = await db.select().from(beds).where(eq(beds.id, id));
    return bed || undefined;
  }

  async blockBed(bedId: string, reason: string, category: string | null, adminId: string, adminEmail: string): Promise<Bed | undefined> {
    const [updated] = await db.update(beds).set({
      status: "blocked" as any,
      blockedReason: reason,
      blockedCategory: category,
      blockedAt: new Date(),
      blockedBy: adminEmail,
      unblockedAt: null,
      unblockedBy: null,
    }).where(eq(beds.id, bedId)).returning();

    await db.insert(bedBlockLogs).values({
      bedId,
      action: "block",
      reason,
      category,
      adminId,
      adminEmail,
    });

    return updated || undefined;
  }

  async unblockBed(bedId: string, note: string | null, adminId: string, adminEmail: string): Promise<Bed | undefined> {
    const [updated] = await db.update(beds).set({
      status: "available" as any,
      blockedReason: null,
      blockedCategory: null,
      unblockedAt: new Date(),
      unblockedBy: adminEmail,
    }).where(eq(beds.id, bedId)).returning();

    await db.insert(bedBlockLogs).values({
      bedId,
      action: "unblock",
      note,
      adminId,
      adminEmail,
    });

    return updated || undefined;
  }

  async getBedBlockLogs(bedId: string): Promise<BedBlockLog[]> {
    return await db.select().from(bedBlockLogs).where(eq(bedBlockLogs.bedId, bedId)).orderBy(desc(bedBlockLogs.createdAt));
  }

  async createBedReconciliationRun(data: InsertBedReconciliationRun): Promise<BedReconciliationRun> {
    const [created] = await db.insert(bedReconciliationRuns).values(data).returning();
    return created;
  }

  async getBedReconciliationRuns(filters: { propertyId?: string; from?: Date; to?: Date; limit?: number } = {}): Promise<BedReconciliationRun[]> {
    const conds: SQL[] = [];
    if (filters.from) conds.push(gte(bedReconciliationRuns.runAt, filters.from));
    if (filters.to) conds.push(lte(bedReconciliationRuns.runAt, filters.to));
    if (filters.propertyId) {
      conds.push(sql`${bedReconciliationRuns.perProperty} @> ${JSON.stringify([{ propertyId: filters.propertyId }])}::jsonb`);
    }
    const limit = Math.min(Math.max(filters.limit ?? 30, 1), 200);

    return await db
      .select()
      .from(bedReconciliationRuns)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(bedReconciliationRuns.runAt))
      .limit(limit);
  }

  async getHomepageAmenities(): Promise<HomepageAmenity[]> {
    return await db.select().from(homepageAmenities).orderBy(asc(homepageAmenities.sortOrder));
  }

  async createHomepageAmenity(data: InsertHomepageAmenity): Promise<HomepageAmenity> {
    const [created] = await db.insert(homepageAmenities).values(data).returning();
    return created;
  }

  async updateHomepageAmenity(id: string, data: Partial<InsertHomepageAmenity>): Promise<HomepageAmenity> {
    const [updated] = await db.update(homepageAmenities).set({ ...data, updatedAt: new Date() }).where(eq(homepageAmenities.id, id)).returning();
    return updated;
  }

  async deleteHomepageAmenity(id: string): Promise<void> {
    await db.delete(homepageAmenities).where(eq(homepageAmenities.id, id));
  }

  async getPackagesByProperty(propertyId: string): Promise<Package[]> {
    return await db.select().from(packages)
      .where(and(eq(packages.propertyId, propertyId), eq(packages.isActive, true)))
      .orderBy(asc(packages.tierLevel), asc(packages.basePrice));
  }

  async getPackageUpgradeOptions(bookingId: string): Promise<any> {
    const activeBPs = await db.select().from(bookingPackages)
      .where(and(eq(bookingPackages.bookingId, bookingId), eq(bookingPackages.status, "ACTIVE")));

    if (activeBPs.length === 0) {
      return { currentPackage: null, options: [] };
    }

    const activeBP = activeBPs[0];
    const [currentPkg] = await db.select().from(packages).where(eq(packages.id, activeBP.packageId));
    if (!currentPkg) {
      return { currentPackage: null, options: [] };
    }

    const currentItems = await db.select().from(packageItems)
      .where(eq(packageItems.packageId, currentPkg.id))
      .orderBy(packageItems.sortOrder);

    const booking = await db.select().from(bookings).where(eq(bookings.id, bookingId));
    const propertyId = booking[0]?.propertyId;

    let higherTierPackages;
    if (propertyId) {
      higherTierPackages = await db.select().from(packages)
        .where(and(
          eq(packages.propertyId, propertyId),
          eq(packages.isActive, true),
          sql`${packages.tierLevel} > ${currentPkg.tierLevel}`
        ))
        .orderBy(packages.tierLevel);
    } else {
      higherTierPackages = await db.select().from(packages)
        .where(and(
          eq(packages.isActive, true),
          sql`${packages.tierLevel} > ${currentPkg.tierLevel}`
        ))
        .orderBy(packages.tierLevel);
    }

    const options = [];
    for (const pkg of higherTierPackages) {
      const items = await db.select().from(packageItems)
        .where(eq(packageItems.packageId, pkg.id))
        .orderBy(packageItems.sortOrder);

      const priceDifference = pkg.upgradeFee !== null && pkg.upgradeFee !== undefined
        ? pkg.upgradeFee
        : pkg.basePrice - currentPkg.basePrice;

      options.push({
        ...pkg,
        items,
        priceDifference,
        upgradeDescription: pkg.upgradeDescription,
        isRecommended: pkg.isHighlighted,
      });
    }

    return {
      currentPackage: { ...currentPkg, items: currentItems, bookingPackageId: activeBP.id },
      options,
    };
  }

  async upgradeBookingPackage(bookingId: string, targetPackageId: string, upgradedBy: string, reason?: string): Promise<any> {
    const activeBPs = await db.select().from(bookingPackages)
      .where(and(eq(bookingPackages.bookingId, bookingId), eq(bookingPackages.status, "ACTIVE")));

    if (activeBPs.length === 0) {
      throw new Error("No active package found for this booking");
    }

    const activeBP = activeBPs[0];
    const [currentPkg] = await db.select().from(packages).where(eq(packages.id, activeBP.packageId));
    const [targetPkg] = await db.select().from(packages).where(eq(packages.id, targetPackageId));

    if (!currentPkg) throw new Error("Current package not found");
    if (!targetPkg) throw new Error("Target package not found");
    if (!targetPkg.isActive) throw new Error("Target package is inactive");
    if (targetPkg.tierLevel <= currentPkg.tierLevel) throw new Error("Can only upgrade to a higher tier package");

    const priceDifference = targetPkg.upgradeFee !== null && targetPkg.upgradeFee !== undefined
      ? targetPkg.upgradeFee
      : Math.max(0, targetPkg.basePrice - currentPkg.basePrice);

    const targetItems = await db.select().from(packageItems)
      .where(eq(packageItems.packageId, targetPackageId))
      .orderBy(packageItems.sortOrder);

    const priceSnapshot = {
      name: targetPkg.name,
      basePrice: targetPkg.basePrice,
      priceType: targetPkg.priceType,
      taxPercent: targetPkg.taxPercent,
      items: targetItems.map(i => ({
        type: i.type,
        label: i.label,
        includedQty: i.includedQty,
        unit: i.unit,
        extraUnitPrice: i.extraUnitPrice,
      })),
    };

    return await db.transaction(async (tx) => {
      const [endedBP] = await tx.update(bookingPackages)
        .set({ status: "ENDED", endDate: new Date() })
        .where(eq(bookingPackages.id, activeBP.id))
        .returning();

      const [newBP] = await tx.insert(bookingPackages).values({
        bookingId,
        packageId: targetPackageId,
        startDate: new Date(),
        status: "ACTIVE",
        priceSnapshot,
        selectedItems: null,
      }).returning();

      const alacartItem = targetItems.find(i => i.type === "ala_cart_credit");
      if (alacartItem && alacartItem.includedQty > 0) {
        await tx.insert(walletLedger).values({
          bookingId,
          credit: alacartItem.includedQty,
          debit: 0,
          refType: "package_credit",
          refId: newBP.id,
          note: `Credit from upgrade to package "${targetPkg.name}"`,
        });
      }

      const [upgradeRecord] = await tx.insert(packageUpgrades).values({
        bookingId,
        fromPackageId: currentPkg.id,
        toPackageId: targetPkg.id,
        fromBookingPackageId: activeBP.id,
        toBookingPackageId: newBP.id,
        priceDifference,
        upgradeReason: reason || null,
        upgradedBy,
      }).returning();

      return {
        upgrade: upgradeRecord,
        previousPackage: { ...currentPkg, bookingPackageId: activeBP.id },
        newPackage: { ...targetPkg, items: targetItems, bookingPackageId: newBP.id },
        priceDifference,
      };
    });
  }

  async getUpgradeHistory(bookingId: string): Promise<any[]> {
    const upgrades = await db.select().from(packageUpgrades)
      .where(eq(packageUpgrades.bookingId, bookingId))
      .orderBy(desc(packageUpgrades.createdAt));

    const result = [];
    for (const upgrade of upgrades) {
      const [fromPkg] = await db.select().from(packages).where(eq(packages.id, upgrade.fromPackageId));
      const [toPkg] = await db.select().from(packages).where(eq(packages.id, upgrade.toPackageId));
      const [upgrader] = upgrade.upgradedBy
        ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, upgrade.upgradedBy))
        : [null];

      result.push({
        ...upgrade,
        fromPackageName: fromPkg?.name || "Unknown",
        toPackageName: toPkg?.name || "Unknown",
        fromPackage: fromPkg || null,
        toPackage: toPkg || null,
        upgradedByUser: upgrader || null,
        upgradedByName: upgrader?.name || null,
      });
    }

    return result;
  }

  async getPropertyTargets(propertyId?: string, seasonId?: string): Promise<PropertyTarget[]> {
    const conditions = [];
    if (propertyId) conditions.push(eq(propertyTargets.propertyId, propertyId));
    if (seasonId) conditions.push(eq(propertyTargets.seasonId, seasonId));
    
    if (conditions.length > 0) {
      return db.select().from(propertyTargets).where(and(...conditions));
    }
    return db.select().from(propertyTargets);
  }

  async upsertPropertyTarget(data: { propertyId: string; targetOccupancyPercent?: number; customTargetOverride?: number | null; seasonId?: string | null; notes?: string | null }): Promise<PropertyTarget> {
    const conditions = [eq(propertyTargets.propertyId, data.propertyId)];
    if (data.seasonId) {
      conditions.push(eq(propertyTargets.seasonId, data.seasonId));
    } else {
      conditions.push(isNull(propertyTargets.seasonId));
    }

    const [existing] = await db.select().from(propertyTargets).where(and(...conditions));

    if (existing) {
      const [updated] = await db.update(propertyTargets)
        .set({
          targetOccupancyPercent: data.targetOccupancyPercent ?? existing.targetOccupancyPercent,
          customTargetOverride: data.customTargetOverride !== undefined ? data.customTargetOverride : existing.customTargetOverride,
          notes: data.notes !== undefined ? data.notes : existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(propertyTargets.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(propertyTargets)
      .values({
        propertyId: data.propertyId,
        targetOccupancyPercent: data.targetOccupancyPercent ?? 100,
        customTargetOverride: data.customTargetOverride ?? null,
        seasonId: data.seasonId ?? null,
        notes: data.notes ?? null,
      })
      .returning();
    return created;
  }

  async createContactMessage(msg: InsertContactMessage): Promise<ContactMessage> {
    const [created] = await db.insert(contactMessages).values(msg).returning();
    return created;
  }

  async getAllContactMessages(): Promise<ContactMessage[]> {
    return db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
  }

  async getContactMessage(id: string): Promise<ContactMessage | undefined> {
    const [msg] = await db.select().from(contactMessages).where(eq(contactMessages.id, id));
    return msg;
  }

  async updateContactMessageStatus(id: string, status: string, repliedBy?: string): Promise<ContactMessage | undefined> {
    const updateData: any = { status };
    if (status === "replied" && repliedBy) {
      updateData.repliedBy = repliedBy;
      updateData.repliedAt = new Date();
    }
    const [updated] = await db.update(contactMessages).set(updateData).where(eq(contactMessages.id, id)).returning();
    return updated;
  }

  async getUnreadContactMessageCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(contactMessages).where(eq(contactMessages.status, "new"));
    return result?.count || 0;
  }
}

export const storage = new DatabaseStorage();
