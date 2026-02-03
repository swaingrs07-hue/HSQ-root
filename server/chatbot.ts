import OpenAI from "openai";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

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
  amenities: string[];
  roomTypes: {
    name: string;
    customName: string | null;
    basePrice: number;
    occupancy: number;
    availableBeds: number;
  }[];
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
    .where(eq(schema.properties.status, "published"));

  const propertiesWithRooms: PropertyInfo[] = [];

  for (const property of properties) {
    const roomTypes = await db
      .select({
        name: schema.roomTypes.name,
        customName: schema.roomTypes.customName,
        basePrice: schema.roomTypes.basePrice,
        occupancy: schema.roomTypes.occupancy,
        availableBeds: schema.roomTypes.availableBeds,
      })
      .from(schema.roomTypes)
      .where(eq(schema.roomTypes.propertyId, property.id));

    propertiesWithRooms.push({
      id: property.id,
      name: property.name,
      displayName: property.displayName,
      address: property.address || "",
      city: property.city || "",
      amenities: property.amenities || [],
      roomTypes: roomTypes.map(rt => ({
        ...rt,
        basePrice: Number(rt.basePrice) || 0,
        occupancy: Number(rt.occupancy) || 1,
        availableBeds: Number(rt.availableBeds) || 0,
      })),
    });
  }

  return propertiesWithRooms;
}

function buildSystemPrompt(properties: PropertyInfo[]): string {
  const propertyDetails = properties.map(p => {
    const roomInfo = p.roomTypes.map(r => {
      const displayName = r.customName || r.name;
      return `  - ${displayName}: ₹${r.basePrice.toLocaleString('en-IN')}/month, ${r.availableBeds} beds available, ${r.occupancy} person(s)`;
    }).join('\n');
    
    const propertyName = p.displayName || p.name;
    return `${propertyName} (${p.city}):
Location: ${p.address}
Amenities: ${p.amenities.length > 0 ? p.amenities.join(', ') : 'WiFi, Furnished, 24/7 Security'}
Room Options:
${roomInfo || '  - Contact us for availability'}`;
  }).join('\n\n');

  return `You are a helpful and friendly assistant for Hsquareliving, a premium student accommodation provider. Your role is to:

1. GREET visitors warmly and understand their accommodation needs
2. RECOMMEND suitable properties and room types based on their preferences
3. ANSWER questions about pricing, amenities, location, and availability
4. COLLECT contact information naturally for follow-up
5. QUALIFY leads by understanding their budget, move-in timeline, and preferences

AVAILABLE PROPERTIES:
${propertyDetails || 'Currently updating our property listings. Please share your requirements!'}

CONVERSATION GUIDELINES:
- Be conversational, friendly, and helpful - not pushy or salesy
- Ask one question at a time to understand their needs
- When recommending properties, explain why they'd be a good fit
- If they share contact info (name, email, phone), acknowledge it politely
- Prices are in Indian Rupees (₹)
- If asked about booking, encourage them to schedule a site visit
- For specific queries you can't answer, suggest they speak with our team

LEAD QUALIFICATION GOALS:
- Get their name for personalized service
- Understand their budget range
- Know which property/location interests them
- Get contact details (phone or email) for follow-up

Keep responses concise (2-3 sentences max) unless they ask for detailed information.`;
}

export async function initChatContext(): Promise<ChatContext> {
  const properties = await getPropertiesContext();
  const systemPrompt = buildSystemPrompt(properties);
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
    max_tokens: 500,
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
${context.properties.map(p => `- "${p.id}": ${p.name} (${p.city})`).join('\n')}

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
    const [lead] = await db
      .insert(schema.leads)
      .values({
        name: safeName as string,
        email: safeEmail,
        phone: safePhone,
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

    return { leadId: lead.id };
  } catch (error) {
    console.error("Error creating lead from chat:", error);
    return null;
  }
}
