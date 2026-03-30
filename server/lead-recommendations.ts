import OpenAI from "openai";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, isNull, isNotNull, desc, sql, inArray } from "drizzle-orm";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const recommendationSchema = z.object({
  recommendations: z.array(z.object({
    leadId: z.string(),
    leadName: z.string(),
    priority: z.enum(["urgent", "high", "medium", "low"]),
    type: z.enum(["follow_up", "re_engage", "escalate", "nurture", "close", "at_risk"]),
    title: z.string(),
    rationale: z.string(),
    suggestedAction: z.string(),
    confidence: z.number().min(0).max(100),
  })),
});

type Recommendation = z.infer<typeof recommendationSchema>["recommendations"][number];

interface CachedRecommendations {
  generatedAt: string;
  recommendations: Recommendation[];
  dataHash: string;
}

let cache: CachedRecommendations | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

function computeDataHash(leads: any[]): string {
  const key = leads.map(l => `${l.id}:${l.status}:${l.score}:${l.lastActivityAt}`).join("|");
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function daysSince(date: Date | string | null): number {
  if (!date) return 999;
  const d = new Date(date);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function generateHeuristicRecommendations(leads: any[]): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const lead of leads) {
    const daysSinceActivity = daysSince(lead.lastActivityAt);
    const daysSinceCreated = daysSince(lead.createdAt);
    const isHot = lead.priority === "hot" || lead.score >= 61;
    const isWarm = lead.priority === "warm" || (lead.score >= 31 && lead.score <= 60);

    if (lead.followUpAt && lead.followUpStatus === "pending") {
      const followUpDate = new Date(lead.followUpAt);
      if (followUpDate < new Date()) {
        recs.push({
          leadId: lead.id,
          leadName: lead.name,
          priority: "urgent",
          type: "follow_up",
          title: "Overdue follow-up",
          rationale: `Follow-up was due ${daysSince(lead.followUpAt)} day(s) ago. Delayed response reduces conversion chances.`,
          suggestedAction: `Call ${lead.name} immediately and address their concerns. Consider offering a site visit.`,
          confidence: 95,
        });
      }
    }

    if (isHot && daysSinceActivity > 3 && !lead.dealClosedAt) {
      recs.push({
        leadId: lead.id,
        leadName: lead.name,
        priority: "urgent",
        type: "at_risk",
        title: "Hot lead going cold",
        rationale: `${lead.name} has a high score (${lead.score}) but no activity in ${daysSinceActivity} days. They may be exploring other options.`,
        suggestedAction: `Reach out with a personalized offer or exclusive deal. Mention specific property features they showed interest in.`,
        confidence: 88,
      });
    }

    if (lead.viewCount >= 3 && !lead.enquirySubmitted && !lead.dealClosedAt) {
      recs.push({
        leadId: lead.id,
        leadName: lead.name,
        priority: "high",
        type: "nurture",
        title: "High interest, no enquiry",
        rationale: `${lead.name} viewed properties ${lead.viewCount} times but hasn't submitted an enquiry. They need a push.`,
        suggestedAction: `Send a personalized message highlighting available rooms and current offers. Consider scheduling a virtual tour.`,
        confidence: 82,
      });
    }

    if (!lead.assignedToId && daysSinceCreated > 1) {
      recs.push({
        leadId: lead.id,
        leadName: lead.name,
        priority: "high",
        type: "escalate",
        title: "Unassigned lead",
        rationale: `${lead.name} has been unassigned for ${daysSinceCreated} day(s). Unassigned leads have significantly lower conversion rates.`,
        suggestedAction: `Assign to a sales executive with expertise in ${lead.propertyName || "available properties"} immediately.`,
        confidence: 90,
      });
    }

    if (isWarm && daysSinceActivity > 5 && daysSinceActivity < 30 && !lead.dealClosedAt) {
      recs.push({
        leadId: lead.id,
        leadName: lead.name,
        priority: "medium",
        type: "re_engage",
        title: "Re-engage warm lead",
        rationale: `${lead.name} showed moderate interest (score: ${lead.score}) but hasn't been active for ${daysSinceActivity} days.`,
        suggestedAction: `Send a WhatsApp message with updated availability and pricing. Share testimonials from current residents.`,
        confidence: 72,
      });
    }

    if (lead.siteVisitScheduled && !lead.bookingInitiated && daysSinceActivity > 2) {
      recs.push({
        leadId: lead.id,
        leadName: lead.name,
        priority: "high",
        type: "close",
        title: "Post-visit follow-up needed",
        rationale: `${lead.name} completed a site visit but hasn't initiated booking. Post-visit is the best conversion window.`,
        suggestedAction: `Call within 24 hours of visit. Address any concerns and offer early-bird or limited-time discount.`,
        confidence: 85,
      });
    }

    if (lead.enquirySubmitted && !lead.siteVisitScheduled && daysSinceActivity > 3) {
      recs.push({
        leadId: lead.id,
        leadName: lead.name,
        priority: "medium",
        type: "nurture",
        title: "Schedule site visit",
        rationale: `${lead.name} submitted an enquiry ${daysSinceActivity} days ago but hasn't scheduled a visit. Enquiry-to-visit is a critical funnel step.`,
        suggestedAction: `Offer convenient visit slots and mention key amenities. Consider arranging transport assistance.`,
        confidence: 78,
      });
    }
  }

  recs.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.confidence - a.confidence;
  });

  return recs.slice(0, 10);
}

async function generateAIRecommendations(leads: any[], heuristicRecs: Recommendation[]): Promise<Recommendation[]> {
  try {
    const leadSummaries = leads.slice(0, 20).map(l => ({
      id: l.id,
      name: l.name,
      status: l.status,
      score: l.score,
      priority: l.priority,
      source: l.source,
      property: l.propertyName || "Unknown",
      daysSinceActivity: daysSince(l.lastActivityAt),
      daysSinceCreated: daysSince(l.createdAt),
      viewCount: l.viewCount || 0,
      enquirySubmitted: l.enquirySubmitted || false,
      siteVisitScheduled: l.siteVisitScheduled || false,
      bookingInitiated: l.bookingInitiated || false,
      hasFollowUp: !!l.followUpAt,
      followUpOverdue: l.followUpAt ? new Date(l.followUpAt) < new Date() : false,
      assigned: !!l.assignedToId,
      budgetRange: l.budgetMin && l.budgetMax ? `₹${l.budgetMin.toLocaleString()}-₹${l.budgetMax.toLocaleString()}` : "Unknown",
    }));

    const systemPrompt = `You are an expert sales strategy AI for Hsquareliving, a student accommodation company in Mumbai, India. Analyze lead data and provide actionable engagement recommendations.

Rules:
- Focus on leads with the highest conversion potential
- Prioritize time-sensitive situations (overdue follow-ups, hot leads going cold)
- Give specific, actionable advice (not generic "follow up")
- Consider the student accommodation market context (academic year timing, budget sensitivity)
- Each recommendation must reference a specific lead by their id and name
- Return exactly 8 recommendations maximum
- Respond ONLY with valid JSON matching the schema

Output JSON schema:
{
  "recommendations": [
    {
      "leadId": "string (exact id from input)",
      "leadName": "string",
      "priority": "urgent|high|medium|low",
      "type": "follow_up|re_engage|escalate|nurture|close|at_risk",
      "title": "Short action title (max 6 words)",
      "rationale": "Why this action matters (1-2 sentences)",
      "suggestedAction": "Specific step to take (1-2 sentences)",
      "confidence": number (0-100)
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here are the current leads:\n${JSON.stringify(leadSummaries, null, 2)}\n\nProvide strategic engagement recommendations.` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");

    const parsed = JSON.parse(content);
    const validated = recommendationSchema.parse(parsed);
    return validated.recommendations;
  } catch (error) {
    console.error("AI recommendation generation failed, using heuristic fallback:", error);
    return heuristicRecs;
  }
}

export async function getLeadRecommendations(forceRefresh = false, limit = 8): Promise<CachedRecommendations> {
  const now = Date.now();

  const allActiveLeads = await db.select().from(schema.leads)
    .where(and(
      isNull(schema.leads.dealClosedAt),
      isNull(schema.leads.convertedAt),
    ))
    .orderBy(desc(schema.leads.score))
    .limit(50);

  const staffUsers = await db.select({ email: schema.users.email, phone: schema.users.phone })
    .from(schema.users)
    .where(inArray(schema.users.role, ["admin", "manager", "staff", "sales_executive", "receptionist"]));
  const staffEmails = new Set(staffUsers.map(u => u.email?.toLowerCase()).filter(Boolean));
  const staffPhones = new Set(staffUsers.map(u => u.phone).filter(Boolean));

  const activeLeads = allActiveLeads.filter(lead => {
    if (lead.email && staffEmails.has(lead.email.toLowerCase())) return false;
    if (lead.phone && staffPhones.has(lead.phone)) return false;
    return true;
  }).slice(0, 30);

  if (activeLeads.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      recommendations: [],
      dataHash: "empty",
    };
  }

  const dataHash = computeDataHash(activeLeads);

  if (!forceRefresh && cache && cache.dataHash === dataHash) {
    const cacheAge = now - new Date(cache.generatedAt).getTime();
    if (cacheAge < CACHE_TTL_MS) {
      return { ...cache, recommendations: cache.recommendations.slice(0, limit) };
    }
  }

  const heuristicRecs = generateHeuristicRecommendations(activeLeads);
  const aiRecs = await generateAIRecommendations(activeLeads, heuristicRecs);

  const finalRecs = aiRecs.length > 0 ? aiRecs : heuristicRecs;

  cache = {
    generatedAt: new Date().toISOString(),
    recommendations: finalRecs,
    dataHash,
  };

  return { ...cache, recommendations: cache.recommendations.slice(0, limit) };
}
