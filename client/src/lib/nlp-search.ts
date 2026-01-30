import { subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

export interface ParsedSearchFilters {
  searchTerm?: string;
  propertyName?: string;
  salesExecName?: string;
  status?: string[];
  priority?: string[];
  dateRange?: { from: Date; to: Date };
  budgetMin?: number;
  budgetMax?: number;
  source?: string[];
  assigned?: boolean;
}

interface PatternMatch {
  pattern: RegExp;
  handler: (match: RegExpMatchArray, filters: ParsedSearchFilters) => void;
}

const STATUS_KEYWORDS: Record<string, string[]> = {
  new: ["new", "fresh", "recent enquiry", "just added", "new enquiry", "new lead"],
  contacted: ["contacted", "called", "reached out", "follow up"],
  warm: ["warm", "showing interest", "moderate interest"],
  hot: ["hot", "very interested", "ready to close", "urgent", "ready to book"],
  cold: ["cold", "not responding", "inactive", "dead", "no response"],
  site_visit: ["site visit", "visited", "property visit", "viewing", "site viewing"],
  visit_scheduled: ["visit scheduled", "scheduled visit", "upcoming visit", "scheduled"],
  negotiation: ["negotiating", "negotiation", "price discussion", "deal in progress"],
  converted: ["converted", "won", "booked", "confirmed", "deal won"],
  deal_closed: ["deal closed", "closed deal", "successful", "closed"],
  interested: ["interested", "keen", "showing interest"],
  lost: ["lost", "rejected", "cancelled", "dropped"],
};

const PRIORITY_KEYWORDS: Record<string, string[]> = {
  hot: ["hot", "urgent", "high priority", "important", "critical"],
  warm: ["warm", "medium priority", "moderate"],
  cold: ["cold", "low priority", "not urgent"],
};

const SOURCE_KEYWORDS: Record<string, string[]> = {
  website: ["website", "online", "web"],
  referral: ["referral", "referred", "recommendation"],
  social_media: ["social media", "facebook", "instagram", "social"],
  walk_in: ["walk in", "walk-in", "walkin", "visited office"],
  whatsapp: ["whatsapp", "wa"],
  call: ["call", "phone call", "called"],
};

function parseTimeExpression(query: string): { from: Date; to: Date } | null {
  const now = new Date();
  const lowQuery = query.toLowerCase();
  
  if (/today/i.test(lowQuery)) {
    return { from: startOfDay(now), to: endOfDay(now) };
  }
  if (/yesterday/i.test(lowQuery)) {
    const yesterday = subDays(now, 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }
  if (/this week/i.test(lowQuery)) {
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  }
  if (/last week/i.test(lowQuery)) {
    const lastWeekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subDays(now, 7), { weekStartsOn: 1 });
    return { from: lastWeekStart, to: lastWeekEnd };
  }
  if (/this month/i.test(lowQuery)) {
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }
  if (/last month/i.test(lowQuery)) {
    const lastMonth = subDays(startOfMonth(now), 1);
    return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
  }
  
  const daysMatch = lowQuery.match(/(?:last|past)\s*(\d+)\s*days?/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1]);
    return { from: startOfDay(subDays(now, days)), to: endOfDay(now) };
  }
  
  const weeksMatch = lowQuery.match(/(?:last|past)\s*(\d+)\s*weeks?/i);
  if (weeksMatch) {
    const weeks = parseInt(weeksMatch[1]);
    return { from: startOfDay(subDays(now, weeks * 7)), to: endOfDay(now) };
  }
  
  return null;
}

function parseBudgetExpression(query: string): { min?: number; max?: number } | null {
  const lowQuery = query.toLowerCase();
  
  const rangeMatch = lowQuery.match(/budget\s*(?:between|from)?\s*₹?\s*(\d+(?:,\d+)*(?:k)?)\s*(?:to|-|and)\s*₹?\s*(\d+(?:,\d+)*(?:k)?)/i);
  if (rangeMatch) {
    const parseAmount = (str: string) => {
      const cleaned = str.replace(/,/g, "").toLowerCase();
      if (cleaned.endsWith("k")) {
        return parseInt(cleaned) * 1000;
      }
      return parseInt(cleaned);
    };
    return { min: parseAmount(rangeMatch[1]), max: parseAmount(rangeMatch[2]) };
  }
  
  const aboveMatch = lowQuery.match(/budget\s*(?:above|over|more than|greater than|>)\s*₹?\s*(\d+(?:,\d+)*(?:k)?)/i);
  if (aboveMatch) {
    const parseAmount = (str: string) => {
      const cleaned = str.replace(/,/g, "").toLowerCase();
      if (cleaned.endsWith("k")) {
        return parseInt(cleaned) * 1000;
      }
      return parseInt(cleaned);
    };
    return { min: parseAmount(aboveMatch[1]) };
  }
  
  const belowMatch = lowQuery.match(/budget\s*(?:below|under|less than|<)\s*₹?\s*(\d+(?:,\d+)*(?:k)?)/i);
  if (belowMatch) {
    const parseAmount = (str: string) => {
      const cleaned = str.replace(/,/g, "").toLowerCase();
      if (cleaned.endsWith("k")) {
        return parseInt(cleaned) * 1000;
      }
      return parseInt(cleaned);
    };
    return { max: parseAmount(belowMatch[1]) };
  }
  
  const highBudget = lowQuery.match(/high\s*budget|premium|expensive/i);
  if (highBudget) {
    return { min: 20000 };
  }
  
  const lowBudget = lowQuery.match(/low\s*budget|cheap|affordable/i);
  if (lowBudget) {
    return { max: 15000 };
  }
  
  return null;
}

export function parseNaturalLanguageQuery(query: string): ParsedSearchFilters {
  const filters: ParsedSearchFilters = {};
  const lowQuery = query.toLowerCase();
  let remainingQuery = query;
  
  const timeRange = parseTimeExpression(query);
  if (timeRange) {
    filters.dateRange = timeRange;
    remainingQuery = remainingQuery.replace(/(?:today|yesterday|this week|last week|this month|last month|(?:last|past)\s*\d+\s*(?:days?|weeks?))/gi, "");
  }
  
  const budget = parseBudgetExpression(query);
  if (budget) {
    if (budget.min) filters.budgetMin = budget.min;
    if (budget.max) filters.budgetMax = budget.max;
    remainingQuery = remainingQuery.replace(/budget\s*(?:between|from|above|over|more than|greater than|below|under|less than|>|<)?\s*₹?\s*\d+(?:,\d+)*(?:k)?\s*(?:to|-|and)?\s*₹?\s*\d*(?:,\d+)*(?:k)?/gi, "");
    remainingQuery = remainingQuery.replace(/high\s*budget|premium|expensive|low\s*budget|cheap|affordable/gi, "");
  }
  
  const matchedStatuses: string[] = [];
  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowQuery.includes(keyword.toLowerCase())) {
        if (!matchedStatuses.includes(status)) {
          matchedStatuses.push(status);
        }
        remainingQuery = remainingQuery.replace(new RegExp(keyword, "gi"), "");
      }
    }
  }
  if (matchedStatuses.length > 0) {
    filters.status = matchedStatuses;
  }
  
  const matchedPriorities: string[] = [];
  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowQuery.includes(keyword.toLowerCase())) {
        if (!matchedPriorities.includes(priority)) {
          matchedPriorities.push(priority);
        }
        remainingQuery = remainingQuery.replace(new RegExp(keyword, "gi"), "");
      }
    }
  }
  if (matchedPriorities.length > 0) {
    filters.priority = matchedPriorities;
  }
  
  const matchedSources: string[] = [];
  for (const [source, keywords] of Object.entries(SOURCE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowQuery.includes(keyword.toLowerCase())) {
        if (!matchedSources.includes(source)) {
          matchedSources.push(source);
        }
        remainingQuery = remainingQuery.replace(new RegExp(keyword, "gi"), "");
      }
    }
  }
  if (matchedSources.length > 0) {
    filters.source = matchedSources;
  }
  
  const assignedMatch = lowQuery.match(/(?:assigned to|handled by|managed by)\s+([a-z]+(?:\s+[a-z]+)?)/i);
  if (assignedMatch) {
    filters.salesExecName = assignedMatch[1].trim();
    remainingQuery = remainingQuery.replace(/(?:assigned to|handled by|managed by)\s+[a-z]+(?:\s+[a-z]+)?/gi, "");
  }
  
  if (/unassigned|not assigned|no assignment/i.test(lowQuery)) {
    filters.assigned = false;
    remainingQuery = remainingQuery.replace(/unassigned|not assigned|no assignment/gi, "");
  } else if (/assigned|has assignment/i.test(lowQuery)) {
    filters.assigned = true;
    remainingQuery = remainingQuery.replace(/assigned|has assignment/gi, "");
  }
  
  const propertyMatch = lowQuery.match(/(?:property|at|from|in)\s+(?:hsquare\s+)?([a-z]+(?:\s+[a-z]+)?)/i);
  if (propertyMatch) {
    filters.propertyName = propertyMatch[1].trim();
    remainingQuery = remainingQuery.replace(/(?:property|at|from|in)\s+(?:hsquare\s+)?[a-z]+(?:\s+[a-z]+)?/gi, "");
  }
  
  const cleanedRemaining = remainingQuery
    .replace(/\b(leads?|requests?|enquiry|enquiries|prospects?|show|find|get|all|the|with|and|or|for|from)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  
  if (cleanedRemaining.length > 2) {
    filters.searchTerm = cleanedRemaining;
  }
  
  return filters;
}

export function getSearchSuggestions(query: string): string[] {
  const suggestions: string[] = [];
  const lowQuery = query.toLowerCase();
  
  if (lowQuery.length === 0) {
    return [
      "hot leads from last week",
      "unassigned enquiries",
      "high budget prospects",
      "site visits this month",
      "leads from website",
    ];
  }
  
  if (lowQuery.startsWith("hot") || lowQuery.includes("hot")) {
    suggestions.push("hot leads", "hot leads from last week", "hot leads at Goregaon");
  }
  if (lowQuery.startsWith("new") || lowQuery.includes("new")) {
    suggestions.push("new enquiries", "new leads today", "new leads this week");
  }
  if (lowQuery.includes("budget")) {
    suggestions.push("high budget leads", "budget above 20k", "budget between 10k to 20k");
  }
  if (lowQuery.includes("assign")) {
    suggestions.push("assigned to Rahul", "unassigned leads", "assigned leads");
  }
  if (lowQuery.includes("last") || lowQuery.includes("week") || lowQuery.includes("month")) {
    suggestions.push("last 7 days", "last week", "last month", "last 30 days");
  }
  if (lowQuery.includes("visit")) {
    suggestions.push("site visits", "visit scheduled", "visited this week");
  }
  
  return suggestions.slice(0, 5);
}

export function describeFilters(filters: ParsedSearchFilters): string {
  const parts: string[] = [];
  
  if (filters.status?.length) {
    parts.push(`status: ${filters.status.join(", ")}`);
  }
  if (filters.priority?.length) {
    parts.push(`priority: ${filters.priority.join(", ")}`);
  }
  if (filters.dateRange) {
    const { from, to } = filters.dateRange;
    parts.push(`date: ${from.toLocaleDateString()} - ${to.toLocaleDateString()}`);
  }
  if (filters.budgetMin || filters.budgetMax) {
    if (filters.budgetMin && filters.budgetMax) {
      parts.push(`budget: ₹${filters.budgetMin.toLocaleString()} - ₹${filters.budgetMax.toLocaleString()}`);
    } else if (filters.budgetMin) {
      parts.push(`budget: > ₹${filters.budgetMin.toLocaleString()}`);
    } else if (filters.budgetMax) {
      parts.push(`budget: < ₹${filters.budgetMax.toLocaleString()}`);
    }
  }
  if (filters.salesExecName) {
    parts.push(`assigned to: ${filters.salesExecName}`);
  }
  if (filters.assigned === false) {
    parts.push("unassigned");
  }
  if (filters.propertyName) {
    parts.push(`property: ${filters.propertyName}`);
  }
  if (filters.source?.length) {
    parts.push(`source: ${filters.source.join(", ")}`);
  }
  if (filters.searchTerm) {
    parts.push(`text: "${filters.searchTerm}"`);
  }
  
  return parts.join(" • ");
}
