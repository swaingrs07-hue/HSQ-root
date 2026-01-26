import { storage } from "./storage";
import { hashPassword } from "./auth";

export async function seedDatabase() {
  try {
    // Only ensure admin users exist - do NOT seed sample/test data
    // Real property data should be added via admin panel or direct database import
    await ensureAdminUsers();
    
    console.log("Admin users verified.");
  } catch (error) {
    console.error("Error in seed database:", error);
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

