import { storage } from "./storage";
import { hashPassword } from "./auth";
import { db } from "./db";
import { properties } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  try {
    await ensureAdminUsers();
    console.log("Admin users verified.");
    
    await ensureSalesExecutives();
    console.log("Sales executives verified.");
    
    if (process.env.NODE_ENV !== "production") {
      await ensureTestLeads();
      console.log("Test leads verified.");
    }

    await fixBookingModes();
  } catch (error) {
    console.error("Error in seed database:", error);
  }
}

async function fixBookingModes() {
  const allProperties = await db.select({ id: properties.id, name: properties.name, bookingMode: properties.bookingMode }).from(properties);
  let fixed = 0;
  for (const prop of allProperties) {
    if (prop.bookingMode !== "academic_year") {
      await db.update(properties).set({ bookingMode: "academic_year" }).where(eq(properties.id, prop.id));
      fixed++;
    }
  }
  if (fixed > 0) {
    console.log(`Fixed booking mode to academic_year for ${fixed} properties.`);
  }
}

async function ensureAdminUsers() {
  const hashedPassword = await hashPassword("hsquare123");

  const gyan = await storage.getUserByEmail("gyan@hsquareliving.com");
  if (!gyan) {
    await storage.createUser({
      name: "Gyan",
      email: "gyan@hsquareliving.com",
      password: hashedPassword,
      role: "superadmin",
    });
    console.log("Created superadmin user: gyan@hsquareliving.com");
  } else if (gyan.role !== "superadmin") {
    await storage.updateUser(gyan.id, { role: "superadmin" });
    console.log("Upgraded gyan@hsquareliving.com to superadmin");
  }

  const arjun = await storage.getUserByEmail("arjun@hsquareliving.com");
  if (!arjun) {
    await storage.createUser({
      name: "Arjun",
      email: "arjun@hsquareliving.com",
      password: hashedPassword,
      role: "admin",
    });
    console.log("Created admin user: arjun@hsquareliving.com");
  }
}

async function ensureSalesExecutives() {
  const hashedPassword = await hashPassword("sales123");
  
  const salesExecs = [
    { name: "Rahul Sharma", email: "rahul@hsquareliving.com", phone: "9876543210" },
    { name: "Priya Patel", email: "priya@hsquareliving.com", phone: "9876543211" },
    { name: "Amit Kumar", email: "amit@hsquareliving.com", phone: "9876543212" },
  ];
  
  for (const exec of salesExecs) {
    const existing = await storage.getUserByEmail(exec.email);
    if (!existing) {
      await storage.createUser({
        name: exec.name,
        email: exec.email,
        phone: exec.phone,
        password: hashedPassword,
        role: "sales_executive",
      });
      console.log(`Created sales executive: ${exec.email}`);
    }
  }

  // Ensure the catch-all fallback assignee (Bibhuti) exists. Any new lead
  // that the auto-assignment logic cannot route to a property-mapped exec
  // is routed to this user instead, so leads are never lost in limbo.
  const fallbackEmail = "bibhuti@hsquareliving.com";
  const existingFallback = await storage.getUserByEmail(fallbackEmail);
  if (!existingFallback) {
    await storage.createUser({
      name: "Bibhuti",
      email: fallbackEmail,
      phone: "",
      password: hashedPassword,
      role: "sales_executive",
    });
    console.log(`Created fallback sales executive: ${fallbackEmail}`);
  }
}

async function ensureTestLeads() {
  const properties = await storage.getAllProperties();
  if (properties.length === 0) {
    console.log("No properties found, skipping lead seeding");
    return;
  }
  
  const salesExecs = await storage.getSalesExecutives();
  
  const leadStatuses = ["new", "contacted", "site_visit", "negotiation", "converted", "cold", "warm", "hot"] as const;
  const sources = ["website", "referral", "social_media", "walk_in"] as const;
  
  const testLeads = [
    { name: "Vikram Singh", phone: "9988776601", email: "vikram@email.com", budgetMin: 12000, budgetMax: 18000, status: "new", notes: "Interested in single room" },
    { name: "Ananya Gupta", phone: "9988776602", email: "ananya@email.com", budgetMin: 15000, budgetMax: 25000, status: "contacted", notes: "Looking for AC room" },
    { name: "Ravi Mehta", phone: "9988776603", email: "ravi.m@email.com", budgetMin: 10000, budgetMax: 15000, status: "site_visit", notes: "Visited yesterday, liked the property" },
    { name: "Neha Kapoor", phone: "9988776604", email: "neha.k@email.com", budgetMin: 20000, budgetMax: 30000, status: "negotiation", notes: "Negotiating on price" },
    { name: "Arjun Reddy", phone: "9988776605", email: "arjun.r@email.com", budgetMin: 18000, budgetMax: 22000, status: "converted", notes: "Booking confirmed!" },
    { name: "Meera Joshi", phone: "9988776606", email: "meera@email.com", budgetMin: 8000, budgetMax: 12000, status: "new", notes: "Not responding to calls" },
    { name: "Karan Malhotra", phone: "9988776607", email: "karan.m@email.com", budgetMin: 14000, budgetMax: 20000, status: "contacted", notes: "Will visit next week" },
    { name: "Pooja Agarwal", phone: "9988776608", email: "pooja.a@email.com", budgetMin: 16000, budgetMax: 24000, status: "interested", notes: "Very interested, follow up tomorrow" },
    { name: "Sanjay Verma", phone: "9988776609", email: "sanjay.v@email.com", budgetMin: 11000, budgetMax: 16000, status: "interested", notes: "Asked for more details" },
    { name: "Divya Nair", phone: "9988776610", email: "divya.n@email.com", budgetMin: 13000, budgetMax: 19000, status: "site_visit", notes: "Visit scheduled for Saturday" },
    { name: "Rohit Saxena", phone: "9988776611", email: "rohit.s@email.com", budgetMin: 9000, budgetMax: 14000, status: "new", notes: "Just inquired" },
    { name: "Shreya Pandey", phone: "9988776612", email: "shreya.p@email.com", budgetMin: 17000, budgetMax: 25000, status: "converted", notes: "Payment received" },
  ];
  
  for (let i = 0; i < testLeads.length; i++) {
    const lead = testLeads[i];
    const existing = await storage.getLeadByPhone(lead.phone);
    if (!existing) {
      const property = properties[i % properties.length];
      const salesExec = salesExecs.length > 0 ? salesExecs[i % salesExecs.length] : null;
      
      await storage.createLead({
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        propertyId: property.id,
        propertyName: property.name,
        budgetMin: lead.budgetMin,
        budgetMax: lead.budgetMax,
        status: lead.status as any,
        notes: lead.notes,
        source: sources[i % sources.length],
        assignedToId: salesExec?.id,
        assignedAt: salesExec ? new Date() : undefined,
        priority: lead.status === "hot" || lead.status === "negotiation" ? "hot" : lead.status === "warm" || lead.status === "interested" ? "warm" : "cold",
      });
      console.log(`Created test lead: ${lead.name}`);
    }
  }
}
