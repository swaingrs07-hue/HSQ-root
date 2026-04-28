import { db } from "./db";
import * as schema from "@shared/schema";
import { and, eq } from "drizzle-orm";

export function parseImageList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
    }
  } catch {
    // not JSON — fall through
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export interface HeroFallbackSlide {
  id: string;
  title: string;
  subtitle: string;
  caption: string;
  imageUrl: string;
  videoUrl: null;
  sortOrder: number;
  isActive: boolean;
}

export async function buildPropertyHeroFallback(): Promise<HeroFallbackSlide[]> {
  try {
    const properties = await db
      .select({
        id: schema.properties.id,
        name: schema.properties.name,
        location: schema.properties.location,
        city: schema.properties.city,
        tourOverviewImages: schema.properties.tourOverviewImages,
        tourRoomsImages: schema.properties.tourRoomsImages,
        tourAmenitiesImages: schema.properties.tourAmenitiesImages,
        imageUrl: schema.properties.imageUrl,
      })
      .from(schema.properties)
      .where(and(eq(schema.properties.active, true), eq(schema.properties.status, "published")))
      .limit(8);

    type SlideEntry = {
      image: string;
      propertyName: string;
      area: string;
      kind: "overview" | "room" | "amenity" | "main";
    };
    const entries: SlideEntry[] = [];
    for (const p of properties) {
      const area = p.location || p.city || "Mumbai";
      const overview = parseImageList(p.tourOverviewImages);
      const rooms = parseImageList(p.tourRoomsImages);
      const amenities = parseImageList(p.tourAmenitiesImages);
      if (overview[0]) entries.push({ image: overview[0], propertyName: p.name, area, kind: "overview" });
      if (rooms[0]) entries.push({ image: rooms[0], propertyName: p.name, area, kind: "room" });
      if (overview[1]) entries.push({ image: overview[1], propertyName: p.name, area, kind: "overview" });
      if (amenities[0]) entries.push({ image: amenities[0], propertyName: p.name, area, kind: "amenity" });
      if (!overview.length && !rooms.length && !amenities.length && p.imageUrl) {
        entries.push({ image: p.imageUrl, propertyName: p.name, area, kind: "main" });
      }
    }

    const captions: Record<SlideEntry["kind"], { title: string; subtitle: string; caption: string }> = {
      overview: {
        title: "Premium Student Living",
        subtitle: "HSQUARE LIVING",
        caption: "Modern student residences designed for comfort and focus",
      },
      room: {
        title: "Thoughtfully Designed Rooms",
        subtitle: "FULLY FURNISHED",
        caption: "Premium furnishing, ample storage and study-ready desks",
      },
      amenity: {
        title: "Lifestyle Amenities",
        subtitle: "EVERYTHING INCLUDED",
        caption: "WiFi, meals, gym, common lounges and 24/7 security",
      },
      main: {
        title: "Welcome Home",
        subtitle: "HSQUARE LIVING",
        caption: "Premium hostels & co-living across Mumbai",
      },
    };

    return entries.slice(0, 6).map((e, idx) => {
      const meta = captions[e.kind];
      return {
        id: `prop-${idx}`,
        title: meta.title,
        subtitle: `${meta.subtitle} · ${e.area.toUpperCase()}`,
        caption: `${e.propertyName} — ${meta.caption}`,
        imageUrl: e.image,
        videoUrl: null,
        sortOrder: idx,
        isActive: true,
      };
    });
  } catch {
    return [];
  }
}
