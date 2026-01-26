import { storage } from "./storage";

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

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

async function ensureAdminUsers() {
  // Admin user 1: Gyan
  const gyan = await storage.getUserByEmail("gyan@hsquareliving.com");
  if (!gyan) {
    await storage.createUser({
      email: "gyan@hsquareliving.com",
      password: "hsquare123",
      role: "admin",
    });
    console.log("Created admin user: gyan@hsquareliving.com");
  }

  // Admin user 2: Arjun
  const arjun = await storage.getUserByEmail("arjun@hsquareliving.com");
  if (!arjun) {
    await storage.createUser({
      email: "arjun@hsquareliving.com",
      password: "hsquare123",
      role: "admin",
    });
    console.log("Created admin user: arjun@hsquareliving.com");
  }
}
