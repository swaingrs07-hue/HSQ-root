import { storage } from "./storage";
import { hashPassword } from "./auth";

export async function seedDatabase() {
  try {
    // Check if properties already exist
    const existingProperties = await storage.getAllProperties();
    if (existingProperties.length > 0) {
      console.log("Database already seeded, skipping...");
      
      // Still check if admin users exist and create them if not
      await ensureAdminUsers();
      return;
    }

    console.log("Seeding database...");

    // Create properties
    const property1 = await storage.createProperty({
      name: "Hsquare Heights",
      location: "Koramangala, Bangalore",
      amenities: ["WiFi", "AC", "Gym", "Meals", "Laundry"],
      imageUrl: "/assets/property-exterior.png",
    });

    const property2 = await storage.createProperty({
      name: "Hsquare Residency",
      location: "Indiranagar, Bangalore",
      amenities: ["WiFi", "AC", "Library", "Meals"],
      imageUrl: "/assets/property-exterior.png",
    });

    // Create room types for property 1
    await storage.createRoomType({
      propertyId: property1.id,
      name: "Single",
      basePrice: 180000,
      totalBeds: 10,
      availableBeds: 5,
      imageUrl: "/assets/room-single.png",
    });

    await storage.createRoomType({
      propertyId: property1.id,
      name: "Shared",
      basePrice: 120000,
      totalBeds: 20,
      availableBeds: 12,
      imageUrl: "/assets/room-shared.png",
    });

    // Create room types for property 2
    await storage.createRoomType({
      propertyId: property2.id,
      name: "Single",
      basePrice: 200000,
      totalBeds: 8,
      availableBeds: 2,
      imageUrl: "/assets/room-single.png",
    });

    await storage.createRoomType({
      propertyId: property2.id,
      name: "Shared",
      basePrice: 140000,
      totalBeds: 16,
      availableBeds: 8,
      imageUrl: "/assets/room-shared.png",
    });

    // Create admin users
    await ensureAdminUsers();

    // Create sample leads for analytics
    await seedSampleLeads();

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

async function ensureAdminUsers() {
  const hashedPassword = await hashPassword("hsquare123");

  // Admin user 1: Gyan
  const gyan = await storage.getUserByEmail("gyan@hsquareliving.com");
  if (!gyan) {
    await storage.createUser({
      name: "Gyan",
      email: "gyan@hsquareliving.com",
      password: hashedPassword,
      role: "admin",
    });
    console.log("Created admin user: gyan@hsquareliving.com");
  }

  // Admin user 2: Arjun
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

async function seedSampleLeads() {
  const sources = ["website", "referral", "social_media", "google_ads", "walk_in", "phone_inquiry", "email_campaign", "event"] as const;
  const statuses = ["new", "contacted", "interested", "site_visit", "negotiation", "converted", "lost"] as const;
  const devices = ["mobile", "desktop", "tablet"] as const;
  
  const sampleLeads = [
    { name: "Rahul Sharma", email: "rahul.sharma@gmail.com", phone: "9876543210", source: "website", status: "new", device: "mobile" },
    { name: "Priya Patel", email: "priya.p@yahoo.com", phone: "9876543211", source: "google_ads", status: "contacted", device: "desktop" },
    { name: "Amit Kumar", email: "amit.k@outlook.com", phone: "9876543212", source: "referral", status: "interested", device: "mobile" },
    { name: "Sneha Reddy", email: "sneha.r@gmail.com", phone: "9876543213", source: "social_media", status: "site_visit", device: "tablet" },
    { name: "Vikram Singh", email: "vikram.s@gmail.com", phone: "9876543214", source: "walk_in", status: "negotiation", device: "desktop" },
    { name: "Ananya Gupta", email: "ananya.g@gmail.com", phone: "9876543215", source: "website", status: "converted", device: "mobile" },
    { name: "Karthik Nair", email: "karthik.n@gmail.com", phone: "9876543216", source: "phone_inquiry", status: "lost", device: "desktop" },
    { name: "Divya Menon", email: "divya.m@gmail.com", phone: "9876543217", source: "email_campaign", status: "new", device: "mobile" },
    { name: "Rohan Joshi", email: "rohan.j@gmail.com", phone: "9876543218", source: "google_ads", status: "interested", device: "desktop" },
    { name: "Meera Iyer", email: "meera.i@gmail.com", phone: "9876543219", source: "event", status: "contacted", device: "tablet" },
    { name: "Sanjay Verma", email: "sanjay.v@gmail.com", phone: "9876543220", source: "referral", status: "converted", device: "mobile" },
    { name: "Pooja Desai", email: "pooja.d@gmail.com", phone: "9876543221", source: "website", status: "new", device: "desktop" },
    { name: "Arjun Rao", email: "arjun.r@gmail.com", phone: "9876543222", source: "social_media", status: "site_visit", device: "mobile" },
    { name: "Neha Kapoor", email: "neha.k@gmail.com", phone: "9876543223", source: "walk_in", status: "interested", device: "desktop" },
    { name: "Ravi Shankar", email: "ravi.s@gmail.com", phone: "9876543224", source: "google_ads", status: "lost", device: "mobile" },
    { name: "Kavitha Ramesh", email: "kavitha.r@gmail.com", phone: "9876543225", source: "website", status: "negotiation", device: "tablet" },
    { name: "Suresh Babu", email: "suresh.b@gmail.com", phone: "9876543226", source: "phone_inquiry", status: "converted", device: "desktop" },
    { name: "Lakshmi Narayan", email: "lakshmi.n@gmail.com", phone: "9876543227", source: "email_campaign", status: "new", device: "mobile" },
    { name: "Mohan Das", email: "mohan.d@gmail.com", phone: "9876543228", source: "referral", status: "contacted", device: "desktop" },
    { name: "Geetha Krishnan", email: "geetha.k@gmail.com", phone: "9876543229", source: "event", status: "interested", device: "mobile" },
  ];

  for (const lead of sampleLeads) {
    const existingLead = await storage.getLeadByEmail(lead.email);
    if (!existingLead) {
      await storage.createLead({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source as any,
        status: lead.status as any,
        deviceType: lead.device,
        ipAddress: "192.168.1." + Math.floor(Math.random() * 255),
        userAgent: "Mozilla/5.0",
      });
    }
  }
  console.log("Created sample leads for analytics");
}
