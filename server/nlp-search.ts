import OpenAI from "openai";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, gte, lte, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const searchFiltersSchema = z.object({
  city: z.string().nullable().optional(),
  minPrice: z.number().nullable().optional(),
  maxPrice: z.number().nullable().optional(),
  amenities: z.array(z.string()).nullable().optional(),
  roomType: z.string().nullable().optional(),
  occupancy: z.number().nullable().optional(),
  keywords: z.array(z.string()).nullable().optional(),
  sortBy: z.enum(["price_low", "price_high", "availability"]).nullable().optional(),
});

export interface SearchFilters {
  city?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  amenities?: string[] | null;
  roomType?: string | null;
  occupancy?: number | null;
  keywords?: string[] | null;
  sortBy?: "price_low" | "price_high" | "availability" | null;
}

export interface SearchResult {
  properties: {
    id: string;
    name: string;
    displayName: string | null;
    city: string | null;
    address: string | null;
    amenities: string[];
    lowestPrice: number;
    highestPrice: number;
    totalAvailableBeds: number;
    roomTypes: {
      id: string;
      name: string;
      customName: string | null;
      basePrice: number;
      occupancy: number;
      availableBeds: number;
    }[];
  }[];
  filters: SearchFilters;
  interpretation: string;
  totalResults: number;
}

export async function parseNaturalLanguageQuery(query: string): Promise<SearchFilters> {
  if (!query || query.trim().length === 0) {
    return {};
  }

  const systemPrompt = `You are a search query parser for Hsquareliving, a student accommodation platform in India.
Parse the user's natural language query and extract structured search filters.

Return a JSON object with these fields (use null if not mentioned):
- city: string (city name like "Mumbai", "Pune", "Delhi", or specific areas like "Juhu", "Goregaon", "Andheri")
- minPrice: number (minimum monthly rent in INR)
- maxPrice: number (maximum monthly rent in INR)
- amenities: array of strings (like "WiFi", "AC", "Gym", "Swimming Pool", "Parking", "Laundry", "Food", "Security")
- roomType: string (like "Single", "Double", "Triple", "Sharing", "Deluxe", "Suite", "Standard")
- occupancy: number (number of people per room - 1 for single, 2 for double sharing, etc.)
- keywords: array of strings (other relevant search terms)
- sortBy: "price_low" | "price_high" | "availability" | null

Examples:
- "rooms under 15000" -> { maxPrice: 15000 }
- "double sharing in Andheri with AC" -> { city: "Andheri", roomType: "Double", occupancy: 2, amenities: ["AC"] }
- "cheapest room near beach" -> { keywords: ["beach"], sortBy: "price_low" }
- "single room with gym and wifi" -> { occupancy: 1, roomType: "Single", amenities: ["Gym", "WiFi"] }`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return {};

    const parsed = JSON.parse(content);
    const validated = searchFiltersSchema.safeParse(parsed);
    
    if (validated.success) {
      return validated.data;
    }
    return {};
  } catch (error) {
    console.error("NLP search parsing error:", error);
    return {};
  }
}

export async function searchProperties(
  query: string,
  filters?: SearchFilters
): Promise<SearchResult> {
  let appliedFilters: SearchFilters = filters || {};
  let interpretation = "";

  if (query && query.trim().length > 0) {
    const nlpFilters = await parseNaturalLanguageQuery(query);
    appliedFilters = {
      city: filters?.city || nlpFilters.city,
      minPrice: filters?.minPrice ?? nlpFilters.minPrice,
      maxPrice: filters?.maxPrice ?? nlpFilters.maxPrice,
      amenities: [...(filters?.amenities || []), ...(nlpFilters.amenities || [])].filter((v, i, a) => a.indexOf(v) === i),
      roomType: filters?.roomType || nlpFilters.roomType,
      occupancy: filters?.occupancy ?? nlpFilters.occupancy,
      keywords: [...(filters?.keywords || []), ...(nlpFilters.keywords || [])].filter((v, i, a) => a.indexOf(v) === i),
      sortBy: filters?.sortBy || nlpFilters.sortBy,
    };
    interpretation = generateInterpretation(appliedFilters, query);
  }

  const properties = await db
    .select()
    .from(schema.properties)
    .where(eq(schema.properties.active, true));

  const results: SearchResult["properties"] = [];

  for (const property of properties) {
    const roomTypes = await db
      .select()
      .from(schema.roomTypes)
      .where(eq(schema.roomTypes.propertyId, property.id));

    let matchesCity = true;
    if (appliedFilters.city) {
      const cityLower = appliedFilters.city.toLowerCase();
      matchesCity = 
        (property.city?.toLowerCase().includes(cityLower) || false) ||
        (property.address?.toLowerCase().includes(cityLower) || false) ||
        (property.name?.toLowerCase().includes(cityLower) || false);
    }

    if (!matchesCity) continue;

    let matchesAmenities = true;
    if (appliedFilters.amenities && appliedFilters.amenities.length > 0) {
      const propertyAmenities = (property.amenities || []).map(a => a.toLowerCase());
      matchesAmenities = appliedFilters.amenities.some(
        amenity => propertyAmenities.some(pa => pa.includes(amenity.toLowerCase()))
      );
    }

    if (!matchesAmenities) continue;

    let matchesKeywords = true;
    if (appliedFilters.keywords && appliedFilters.keywords.length > 0) {
      const searchText = `${property.name} ${property.displayName || ""} ${property.city || ""} ${property.address || ""} ${(property.amenities || []).join(" ")}`.toLowerCase();
      matchesKeywords = appliedFilters.keywords.some(
        keyword => searchText.includes(keyword.toLowerCase())
      );
    }

    if (!matchesKeywords) continue;

    let filteredRoomTypes = roomTypes;

    if (appliedFilters.minPrice) {
      filteredRoomTypes = filteredRoomTypes.filter(
        rt => Number(rt.basePrice) >= (appliedFilters.minPrice || 0)
      );
    }

    if (appliedFilters.maxPrice) {
      filteredRoomTypes = filteredRoomTypes.filter(
        rt => Number(rt.basePrice) <= (appliedFilters.maxPrice || Infinity)
      );
    }

    if (appliedFilters.occupancy) {
      filteredRoomTypes = filteredRoomTypes.filter(
        rt => Number(rt.occupancy) === appliedFilters.occupancy
      );
    }

    if (appliedFilters.roomType) {
      const rtLower = appliedFilters.roomType.toLowerCase();
      filteredRoomTypes = filteredRoomTypes.filter(rt => {
        const name = (rt.customName || rt.name).toLowerCase();
        return name.includes(rtLower);
      });
    }

    if (filteredRoomTypes.length === 0 && (appliedFilters.minPrice || appliedFilters.maxPrice || appliedFilters.occupancy || appliedFilters.roomType)) {
      continue;
    }

    const relevantRooms = filteredRoomTypes.length > 0 ? filteredRoomTypes : roomTypes;
    const prices = relevantRooms.map(rt => Number(rt.basePrice)).filter(p => p > 0);
    const totalBeds = relevantRooms.reduce((sum, rt) => sum + (Number(rt.availableBeds) || 0), 0);

    results.push({
      id: property.id,
      name: property.name,
      displayName: property.displayName,
      city: property.city,
      address: property.address,
      amenities: property.amenities || [],
      lowestPrice: prices.length > 0 ? Math.min(...prices) : 0,
      highestPrice: prices.length > 0 ? Math.max(...prices) : 0,
      totalAvailableBeds: totalBeds,
      roomTypes: relevantRooms.map(rt => ({
        id: rt.id,
        name: rt.name,
        customName: rt.customName,
        basePrice: Number(rt.basePrice) || 0,
        occupancy: Number(rt.occupancy) || 1,
        availableBeds: Number(rt.availableBeds) || 0,
      })),
    });
  }

  if (appliedFilters.sortBy === "price_low") {
    results.sort((a, b) => a.lowestPrice - b.lowestPrice);
  } else if (appliedFilters.sortBy === "price_high") {
    results.sort((a, b) => b.lowestPrice - a.lowestPrice);
  } else if (appliedFilters.sortBy === "availability") {
    results.sort((a, b) => b.totalAvailableBeds - a.totalAvailableBeds);
  }

  return {
    properties: results,
    filters: appliedFilters,
    interpretation,
    totalResults: results.length,
  };
}

function generateInterpretation(filters: SearchFilters, originalQuery: string): string {
  const parts: string[] = [];

  if (filters.city) {
    parts.push(`in ${filters.city}`);
  }

  if (filters.minPrice && filters.maxPrice) {
    parts.push(`priced between ₹${filters.minPrice.toLocaleString("en-IN")} - ₹${filters.maxPrice.toLocaleString("en-IN")}`);
  } else if (filters.maxPrice) {
    parts.push(`under ₹${filters.maxPrice.toLocaleString("en-IN")}`);
  } else if (filters.minPrice) {
    parts.push(`above ₹${filters.minPrice.toLocaleString("en-IN")}`);
  }

  if (filters.roomType) {
    parts.push(`${filters.roomType} rooms`);
  }

  if (filters.occupancy) {
    parts.push(`${filters.occupancy}-person occupancy`);
  }

  if (filters.amenities && filters.amenities.length > 0) {
    parts.push(`with ${filters.amenities.join(", ")}`);
  }

  if (filters.sortBy) {
    const sortLabels = {
      price_low: "sorted by lowest price",
      price_high: "sorted by highest price",
      availability: "sorted by availability",
    };
    parts.push(sortLabels[filters.sortBy]);
  }

  if (parts.length === 0) {
    return `Showing all properties for "${originalQuery}"`;
  }

  return `Showing properties ${parts.join(", ")}`;
}

export async function getSuggestedFilters(): Promise<{
  cities: string[];
  amenities: string[];
  priceRanges: { label: string; min: number; max: number }[];
}> {
  const properties = await db
    .select({
      city: schema.properties.city,
      amenities: schema.properties.amenities,
    })
    .from(schema.properties)
    .where(eq(schema.properties.active, true));

  const citiesSet = new Set(properties.map(p => p.city).filter(Boolean));
  const cities = Array.from(citiesSet) as string[];
  const allAmenities = properties.flatMap(p => p.amenities || []);
  const amenitiesSet = new Set(allAmenities);
  const amenities = Array.from(amenitiesSet);

  const priceRanges = [
    { label: "Budget (Under ₹10,000)", min: 0, max: 10000 },
    { label: "Mid-range (₹10,000 - ₹20,000)", min: 10000, max: 20000 },
    { label: "Premium (₹20,000 - ₹35,000)", min: 20000, max: 35000 },
    { label: "Luxury (Above ₹35,000)", min: 35000, max: 100000 },
  ];

  return { cities, amenities, priceRanges };
}
