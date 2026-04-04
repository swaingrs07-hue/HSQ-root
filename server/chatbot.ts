import OpenAI from "openai";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";

function normalizeLeadPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "+91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return "+" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "+91" + digits.slice(1);
  const normalized = phone.replace(/[^\d+]/g, "");
  if (normalized.startsWith("+91") && normalized.length === 13) return normalized;
  return normalized || phone;
}

const leadQualificationSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  email: z.string().email().max(200).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  budgetMin: z.number().int().min(0).max(10000000).nullable().optional(),
  budgetMax: z.number().int().min(0).max(10000000).nullable().optional(),
  preferredPropertyId: z.string().uuid().nullable().optional(),
  message: z.string().max(1000).nullable().optional(),
  isQualified: z.boolean().default(false),
});

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface PropertyInfo {
  id: string;
  name: string;
  displayName: string | null;
  address: string;
  city: string;
  location: string;
  amenities: string[];
  rules: string | null;
  mapsUrl: string | null;
  phone: string | null;
  email: string | null;
  hmsLinked: boolean;
  roomTypes: {
    name: string;
    customName: string | null;
    basePrice: number;
    academicYearPrice: number | null;
    occupancy: number;
    availableBeds: number;
    totalBeds: number;
    size: string | null;
  }[];
  plans: {
    name: string;
    tagline: string | null;
    tierLevel: number;
    basePrice: number;
    occupancy: string | null;
    locationInfo: string | null;
    features: string[];
  }[];
  bedStats: {
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    blocked: number;
  };
}

interface ChatContext {
  properties: PropertyInfo[];
  systemPrompt: string;
}

interface LeadQualification {
  name?: string;
  email?: string;
  phone?: string;
  budgetMin?: number;
  budgetMax?: number;
  preferredPropertyId?: string;
  message?: string;
  isQualified: boolean;
}

async function getPropertiesContext(): Promise<PropertyInfo[]> {
  const properties = await db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.active, true));

  const propertiesWithDetails: PropertyInfo[] = [];

  for (const property of properties) {
    const roomTypes = await db
      .select({
        id: schema.roomTypes.id,
        name: schema.roomTypes.name,
        customName: schema.roomTypes.customName,
        basePrice: schema.roomTypes.basePrice,
        academicYearPrice: schema.roomTypes.academicYearPrice,
        occupancy: schema.roomTypes.occupancy,
        availableBeds: schema.roomTypes.availableBeds,
        totalBeds: schema.roomTypes.totalBeds,
        size: schema.roomTypes.size,
      })
      .from(schema.roomTypes)
      .where(eq(schema.roomTypes.propertyId, property.id));

    const plans = await db
      .select()
      .from(schema.packages)
      .where(
        and(
          eq(schema.packages.propertyId, property.id),
          eq(schema.packages.isActive, true)
        )
      );

    const planDetails: PropertyInfo["plans"] = [];
    for (const plan of plans) {
      const items = await db
        .select()
        .from(schema.packageItems)
        .where(eq(schema.packageItems.packageId, plan.id));

      planDetails.push({
        name: plan.name,
        tagline: plan.tagline,
        tierLevel: plan.tierLevel ?? 0,
        basePrice: Number(plan.basePrice) || 0,
        occupancy: plan.occupancy,
        locationInfo: plan.locationInfo,
        features: items
          .filter((i) => i.label)
          .map((i) => {
            const val = i.featureValue || (i.includedQty ? `${i.includedQty} ${i.unit || ""}`.trim() : null);
            return val ? `${i.label}: ${val}` : i.label;
          }),
      });
    }

    planDetails.sort((a, b) => a.tierLevel - b.tierLevel);

    let bedStats = { total: 0, available: 0, occupied: 0, reserved: 0, blocked: 0 };
    try {
      const floors = await db
        .select({ id: schema.floors.id })
        .from(schema.floors)
        .where(eq(schema.floors.propertyId, property.id));

      if (floors.length > 0) {
        const floorIds = floors.map((f) => f.id);
        const rooms = await db
          .select({ id: schema.rooms.id })
          .from(schema.rooms)
          .where(inArray(schema.rooms.floorId, floorIds));

        if (rooms.length > 0) {
          const roomIds = rooms.map((r) => r.id);
          const beds = await db
            .select({ status: schema.beds.status })
            .from(schema.beds)
            .where(inArray(schema.beds.roomId, roomIds));

          bedStats.total = beds.length;
          for (const bed of beds) {
            const s = bed.status || "available";
            if (s === "available") bedStats.available++;
            else if (s === "occupied") bedStats.occupied++;
            else if (s === "reserved") bedStats.reserved++;
            else if (s === "blocked") bedStats.blocked++;
          }
        }
      }
    } catch {}

    propertiesWithDetails.push({
      id: property.id,
      name: property.name,
      displayName: property.displayName,
      address: property.address || "",
      city: property.city || "",
      location: property.location || "",
      amenities: property.amenities || [],
      rules: property.rules,
      mapsUrl: property.mapsUrl,
      phone: property.phone,
      email: property.email,
      hmsLinked: property.hmsLinked || false,
      roomTypes: roomTypes.map((rt) => ({
        ...rt,
        basePrice: Number(rt.basePrice) || 0,
        academicYearPrice: rt.academicYearPrice ? Number(rt.academicYearPrice) : null,
        occupancy: Number(rt.occupancy) || 1,
        availableBeds: Number(rt.availableBeds) || 0,
        totalBeds: Number(rt.totalBeds) || 0,
        size: rt.size,
      })),
      plans: planDetails,
      bedStats,
    });
  }

  return propertiesWithDetails;
}

async function getActiveSeasonInfo(): Promise<string> {
  try {
    const activeSeasons = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "ACTIVE"));

    if (activeSeasons.length === 0) return "";

    return activeSeasons
      .map((s) => {
        const start = s.startDate ? new Date(s.startDate).toLocaleDateString("en-IN") : "TBD";
        const end = s.endDate ? new Date(s.endDate).toLocaleDateString("en-IN") : "TBD";
        return `- ${s.name}: ${start} to ${end} (Grace: ${s.graceDays || 0} days)`;
      })
      .join("\n");
  } catch {
    return "";
  }
}

async function getBookingStats(): Promise<string> {
  try {
    const result = await db
      .select({
        status: schema.bookings.status,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.bookings)
      .groupBy(schema.bookings.status);

    if (result.length === 0) return "";

    return result.map((r) => `  ${r.status}: ${r.count}`).join("\n");
  } catch {
    return "";
  }
}

function buildSystemPrompt(
  properties: PropertyInfo[],
  seasonInfo: string,
  bookingStats: string
): string {
  const propertyDetails = properties
    .map((p) => {
      const propertyName = p.displayName || p.name;
      const roomInfo = p.roomTypes
        .map((r) => {
          const displayName = r.customName || r.name;
          const price = r.academicYearPrice || r.basePrice;
          const priceLabel = r.academicYearPrice ? "/year" : "/month";
          return `  - ${displayName}: ₹${price.toLocaleString("en-IN")}${priceLabel}, ${r.size || "N/A"}, ${r.occupancy}-sharing, ${r.availableBeds}/${r.totalBeds} beds available`;
        })
        .join("\n");

      const planInfo =
        p.plans.length > 0
          ? p.plans
              .map((pl) => {
                const tierLabel =
                  pl.tierLevel === 0
                    ? "Essential"
                    : pl.tierLevel === 1
                    ? "Popular"
                    : "Premium";
                const featureList =
                  pl.features.length > 0
                    ? pl.features.slice(0, 5).join(", ")
                    : "Contact for details";
                return `  - ${pl.name} (${tierLabel} Tier): ₹${pl.basePrice.toLocaleString("en-IN")}/year${pl.tagline ? ` — "${pl.tagline}"` : ""}${pl.occupancy ? `, ${pl.occupancy}` : ""}${pl.locationInfo ? `, ${pl.locationInfo}` : ""}
    Includes: ${featureList}`;
              })
              .join("\n")
          : "  No housing plans configured yet";

      const bedSummary =
        p.bedStats.total > 0
          ? `Bed Availability (from room config): ${p.bedStats.available} available / ${p.bedStats.total} total (${p.bedStats.occupied} occupied, ${p.bedStats.reserved} reserved, ${p.bedStats.blocked} blocked)`
          : "Bed Availability: Contact us for current availability";

      return `${propertyName}:
Location: ${p.location}${p.address ? ` — ${p.address}` : ""}
Contact: ${p.phone || "N/A"} | ${p.email || "N/A"}${p.mapsUrl ? `\nGoogle Maps: ${p.mapsUrl}` : ""}
Amenities: ${p.amenities.length > 0 ? p.amenities.join(", ") : "WiFi, Furnished, 24/7 Security"}${p.rules ? `\nRules: ${p.rules}` : ""}
${bedSummary ? bedSummary + "\n" : ""}HMS Connected: ${p.hmsLinked ? "Yes" : "No"}

Room Types:
${roomInfo || "  - Contact us for availability"}

Housing Plans (Service Tiers):
${planInfo}`;
    })
    .join("\n\n---\n\n");

  const seasonSection = seasonInfo
    ? `\nACTIVE ACADEMIC SEASONS:\n${seasonInfo}\n`
    : "";

  const bookingSection = bookingStats
    ? `\nSYSTEM BOOKING STATS:\n${bookingStats}\n`
    : "";

  return `You are Gyan AI, the official AI assistant for Hsquareliving (also known as Hsquare), a premium student accommodation provider in India. You are connected to the Hostel Management System (HMS) and have knowledge of properties, housing plans, room types, pricing, and approximate availability.

Your introduction: "Hello, I'm Gyan AI — your assistant for Hsquareliving. I can help you with property details, housing plans, pricing, and room availability. Ask me anything about your stay!"

IMPORTANT RULES:
- You ONLY recommend and discuss Hsquareliving/Hsquare properties
- NEVER suggest or mention competitor properties, other hostels, or PG accommodations
- If someone asks about properties not in our portfolio, politely explain you can only help with Hsquareliving properties
- When asked about availability, share the numbers from the data below and note that exact real-time availability may vary — suggest contacting us for confirmation
- When asked about pricing, always mention the housing plans if available for that property

YOUR CAPABILITIES (HMS-Connected):
1. PROPERTY INFO: Full details on all Hsquareliving properties — locations, amenities, rules, contact info
2. ROOM & BED AVAILABILITY: Bed counts and room types from our system (availability may change; suggest confirming with our team)
3. HOUSING PLANS: Complete knowledge of service tiers (Essential/Popular/Premium), pricing, and inclusions
4. BOOKING GUIDANCE: Walk users through the booking process — select property → choose plan → pick room → book bed
5. PRICING EXPERTISE: Accurate pricing for all room types and plans including monthly/yearly breakdowns
6. ACADEMIC SEASONS: Knowledge of current active batches and move-in timelines
7. LEAD CAPTURE: Collect visitor details naturally for our sales team follow-up

HSQUARELIVING PROPERTIES — LIVE DATA:
${propertyDetails || "We are currently updating our property listings. Please share your requirements!"}
${seasonSection}${bookingSection}
ABOUT HSQUARELIVING:
- Premium student accommodation provider operating across major educational hubs in India
- All properties feature furnished rooms, high-speed WiFi, 24/7 security, daily housekeeping
- Housing Plans provide tiered living experiences — from Essential (budget-friendly) to Premium (all-inclusive luxury)
- Each plan includes meals, laundry, shuttle services, and lifestyle credits at different levels
- Properties are managed through an integrated HMS for real-time operations

HOW BOOKING WORKS (Guide users through this):
1. Browse our properties and choose a location
2. Compare Housing Plans to select your service tier (e.g., THE HIGHLANDER, THE STERLING, THE ROYAL)
3. Take a virtual tour of the property
4. Select your preferred floor and room
5. Pick an available bed
6. Complete the booking with registration, payment plan, and digital agreement

HOUSING PLAN COMPARISON (Key Differentiators):
- Essential Tier: Affordable, includes basic meals, standard room, pay-per-use extras
- Popular Tier: Best value, enhanced meals with high tea, monthly credits for ala carte kitchen & EV bikes, more laundry
- Premium Tier: All-inclusive luxury, unlimited laundry, highest credits, priority services, premium room locations

CONVERSATION GUIDELINES:
- Be conversational, knowledgeable, and confident — you have real data
- When recommending, always compare plans and explain the value difference
- Proactively mention available bed counts when discussing a property
- If asked about pricing, show both the plan price (yearly) and approximate monthly breakdown
- Prices are in Indian Rupees (₹)
- For booking, direct them to visit the property page on our website
- Collect contact info naturally for sales team follow-up

LEAD QUALIFICATION GOALS:
- Get their name for personalized service
- Understand their budget range
- Know which property/location/plan interests them
- Get contact details (phone or email) for follow-up

Keep responses concise (2-4 sentences) unless they ask for detailed comparisons or plan breakdowns.`;
}

export async function initChatContext(): Promise<ChatContext> {
  const properties = await getPropertiesContext();
  const seasonInfo = await getActiveSeasonInfo();
  const bookingStats = await getBookingStats();
  const systemPrompt = buildSystemPrompt(properties, seasonInfo, bookingStats);
  return { properties, systemPrompt };
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function streamChatResponse(
  messages: ChatMessage[],
  context: ChatContext
): Promise<AsyncIterable<string>> {
  const chatMessages: ChatMessage[] = [
    { role: "system", content: context.systemPrompt },
    ...messages,
  ];

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: chatMessages,
    stream: true,
    max_tokens: 800,
    temperature: 0.7,
  });

  return {
    async *[Symbol.asyncIterator]() {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          yield content;
        }
      }
    },
  };
}

export async function extractLeadInfo(
  messages: ChatMessage[],
  context: ChatContext
): Promise<LeadQualification> {
  const extractionPrompt = `Analyze this conversation and extract any lead qualification information shared by the user.

Return a JSON object with these fields (use null if not mentioned):
- name: string or null
- email: string or null  
- phone: string or null
- budgetMin: number or null (monthly rent budget lower bound)
- budgetMax: number or null (monthly rent budget upper bound)
- preferredPropertyId: string or null (match to property ID if they mentioned a preference)
- message: string or null (summarize their key requirements in 1-2 sentences)
- isQualified: boolean (true if they shared at least name AND (email OR phone))

Available property IDs for matching:
${context.properties.map(p => `- "${p.id}": ${p.name} (${p.city || p.location})`).join('\n')}

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}

Respond ONLY with the JSON object, no other text.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: extractionPrompt }],
    response_format: { type: "json_object" },
    max_tokens: 300,
    temperature: 0,
  });

  try {
    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const validated = leadQualificationSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("Lead validation failed:", validated.error);
      return { isQualified: false };
    }
    return {
      name: validated.data.name || undefined,
      email: validated.data.email || undefined,
      phone: validated.data.phone || undefined,
      budgetMin: validated.data.budgetMin || undefined,
      budgetMax: validated.data.budgetMax || undefined,
      preferredPropertyId: validated.data.preferredPropertyId || undefined,
      message: validated.data.message || undefined,
      isQualified: validated.data.isQualified,
    };
  } catch (error) {
    console.error("Lead extraction error:", error);
    return { isQualified: false };
  }
}

function sanitizeString(str: string | undefined, maxLen: number): string | undefined {
  if (!str) return undefined;
  return str.replace(/[<>]/g, '').trim().slice(0, maxLen) || undefined;
}

function sanitizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  return phone.replace(/[^\d+\-\s()]/g, '').trim().slice(0, 20) || undefined;
}

async function validatePropertyId(propertyId: string | undefined): Promise<string | undefined> {
  if (!propertyId) return undefined;
  try {
    const [property] = await db
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .where(and(
        eq(schema.properties.id, propertyId),
        eq(schema.properties.active, true)
      ))
      .limit(1);
    return property?.id;
  } catch {
    return undefined;
  }
}

function computeIsQualified(name?: string, email?: string, phone?: string): boolean {
  const hasName = Boolean(name && name.trim().length > 0);
  const hasContact = Boolean((email && email.trim().length > 0) || (phone && phone.trim().length > 0));
  return hasName && hasContact;
}

export async function createLeadFromChat(
  qualification: LeadQualification,
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    pageUrl?: string;
  }
): Promise<{ leadId: string } | null> {
  const safeName = sanitizeString(qualification.name, 200);
  const safeEmail = sanitizeString(qualification.email, 200);
  const safePhone = sanitizePhone(qualification.phone);

  const isActuallyQualified = computeIsQualified(safeName, safeEmail, safePhone);
  if (!isActuallyQualified || !safeName) {
    return null;
  }

  const validPropertyId = await validatePropertyId(qualification.preferredPropertyId);
  
  let budgetMin = qualification.budgetMin;
  let budgetMax = qualification.budgetMax;
  if (budgetMin && budgetMax && budgetMin > budgetMax) {
    [budgetMin, budgetMax] = [budgetMax, budgetMin];
  }

  try {
    const normalizedPhone = safePhone ? normalizeLeadPhone(safePhone) : safePhone;
    const [lead] = await db
      .insert(schema.leads)
      .values({
        name: safeName as string,
        email: safeEmail,
        phone: normalizedPhone,
        propertyId: validPropertyId,
        source: "chatbot",
        status: "new",
        budgetMin: budgetMin || undefined,
        budgetMax: budgetMax || undefined,
        message: sanitizeString(qualification.message, 1000),
        ipAddress: sanitizeString(metadata.ipAddress, 50),
        userAgent: sanitizeString(metadata.userAgent, 500),
        pageUrl: sanitizeString(metadata.pageUrl, 500),
        enquirySubmitted: true,
        score: 25,
        priority: "warm",
      })
      .returning({ id: schema.leads.id });

    await db.insert(schema.chatbotEvents).values({
      eventType: "lead_created",
      metadata: JSON.stringify({
        leadId: lead.id,
        name: safeName,
        email: safeEmail,
        phone: safePhone,
        propertyId: validPropertyId,
        budgetMin,
        budgetMax,
        message: qualification.message,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      }),
    });

    return { leadId: lead.id };
  } catch (error) {
    console.error("Error creating lead from chat:", error);
    return null;
  }
}
