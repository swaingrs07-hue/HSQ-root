import { storage } from "./storage";

export async function seedDatabase() {
  try {
    // Check if properties already exist
    const existingProperties = await storage.getAllProperties();
    if (existingProperties.length > 0) {
      console.log("Database already seeded, skipping...");
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

    // Create admin user
    await storage.createUser({
      email: "admin@hsquareliving.com",
      password: "admin123", // In production, this should be hashed
      role: "admin",
    });

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
