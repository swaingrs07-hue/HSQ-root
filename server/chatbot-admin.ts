import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";

export async function getChatbotSettings(propertyId?: string) {
  const conditions = propertyId 
    ? eq(schema.chatbotSettings.propertyId, propertyId)
    : sql`${schema.chatbotSettings.propertyId} IS NULL`;
  
  const [settings] = await db
    .select()
    .from(schema.chatbotSettings)
    .where(conditions)
    .limit(1);
  
  if (!settings) {
    const [newSettings] = await db
      .insert(schema.chatbotSettings)
      .values({ propertyId: propertyId || null })
      .returning();
    return newSettings;
  }
  
  return settings;
}

export async function updateChatbotSettings(
  data: Partial<schema.InsertChatbotSettings>,
  propertyId?: string
) {
  const existing = await getChatbotSettings(propertyId);
  
  const [updated] = await db
    .update(schema.chatbotSettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.chatbotSettings.id, existing.id))
    .returning();
  
  return updated;
}

export async function toggleChatbot(enabled: boolean, propertyId?: string) {
  return updateChatbotSettings({ enabled }, propertyId);
}

export async function getChatbotKnowledge(filters?: {
  propertyId?: string;
  category?: string;
  status?: "draft" | "published";
  search?: string;
}) {
  let query = db.select().from(schema.chatbotKnowledge);
  
  const conditions = [];
  if (filters?.propertyId) {
    conditions.push(eq(schema.chatbotKnowledge.propertyId, filters.propertyId));
  }
  if (filters?.category) {
    conditions.push(eq(schema.chatbotKnowledge.category, filters.category));
  }
  if (filters?.status) {
    conditions.push(eq(schema.chatbotKnowledge.status, filters.status));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  return query.orderBy(desc(schema.chatbotKnowledge.updatedAt));
}

export async function createChatbotKnowledge(data: schema.InsertChatbotKnowledge) {
  const [entry] = await db
    .insert(schema.chatbotKnowledge)
    .values(data)
    .returning();
  return entry;
}

export async function updateChatbotKnowledge(
  id: string,
  data: Partial<schema.InsertChatbotKnowledge>
) {
  const [updated] = await db
    .update(schema.chatbotKnowledge)
    .set({ ...data, updatedAt: new Date() })
    .returning()
    .where(eq(schema.chatbotKnowledge.id, id));
  return updated;
}

export async function deleteChatbotKnowledge(id: string) {
  await db.delete(schema.chatbotKnowledge).where(eq(schema.chatbotKnowledge.id, id));
}

export async function publishKnowledgeEntry(id: string) {
  return updateChatbotKnowledge(id, { status: "published" });
}

export async function getChatbotConversations(filters?: {
  startDate?: Date;
  endDate?: Date;
  propertyId?: string;
  outcome?: string;
  device?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  
  if (filters?.startDate) {
    conditions.push(gte(schema.chatbotConversations.startedAt, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(schema.chatbotConversations.startedAt, filters.endDate));
  }
  if (filters?.propertyId) {
    conditions.push(eq(schema.chatbotConversations.propertyId, filters.propertyId));
  }
  if (filters?.outcome) {
    conditions.push(eq(schema.chatbotConversations.outcome, filters.outcome));
  }
  if (filters?.device) {
    conditions.push(eq(schema.chatbotConversations.device, filters.device));
  }
  
  let query = db
    .select()
    .from(schema.chatbotConversations)
    .orderBy(desc(schema.chatbotConversations.startedAt));
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }
  
  return query;
}

export async function getConversationMessages(conversationId: string) {
  return db
    .select()
    .from(schema.chatbotMessages)
    .where(eq(schema.chatbotMessages.conversationId, conversationId))
    .orderBy(schema.chatbotMessages.createdAt);
}

export async function flagConversation(conversationId: string, flagStatus: string) {
  const [updated] = await db
    .update(schema.chatbotConversations)
    .set({ flagStatus })
    .where(eq(schema.chatbotConversations.id, conversationId))
    .returning();
  return updated;
}

export async function getChatbotStats(propertyId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const conditions = [gte(schema.chatbotConversations.startedAt, today)];
  if (propertyId) {
    conditions.push(eq(schema.chatbotConversations.propertyId, propertyId));
  }
  
  const [conversationsToday] = await db
    .select({ count: count() })
    .from(schema.chatbotConversations)
    .where(and(...conditions));
  
  const leadConditions = [gte(schema.chatbotEvents.createdAt, today)];
  const [leadsToday] = await db
    .select({ count: count() })
    .from(schema.chatbotEvents)
    .where(and(
      eq(schema.chatbotEvents.eventType, "lead_created"),
      ...leadConditions
    ));
  
  const [escalationsToday] = await db
    .select({ count: count() })
    .from(schema.chatbotEvents)
    .where(and(
      eq(schema.chatbotEvents.eventType, "escalation"),
      gte(schema.chatbotEvents.createdAt, today)
    ));
  
  return {
    conversationsToday: conversationsToday?.count || 0,
    leadsToday: leadsToday?.count || 0,
    escalationsToday: escalationsToday?.count || 0,
    avgResponseTime: "< 2s",
  };
}

export async function createConversation(data: schema.InsertChatbotConversation) {
  const [conversation] = await db
    .insert(schema.chatbotConversations)
    .values(data)
    .returning();
  return conversation;
}

export async function addMessage(data: schema.InsertChatbotMessage) {
  const [message] = await db
    .insert(schema.chatbotMessages)
    .values(data)
    .returning();
  
  await db
    .update(schema.chatbotConversations)
    .set({ 
      messageCount: sql`${schema.chatbotConversations.messageCount} + 1` 
    })
    .where(eq(schema.chatbotConversations.id, data.conversationId));
  
  return message;
}

export async function logChatbotEvent(data: schema.InsertChatbotEvent) {
  const [event] = await db
    .insert(schema.chatbotEvents)
    .values(data)
    .returning();
  return event;
}

export async function deleteConversation(conversationId: string) {
  await db.delete(schema.chatbotMessages).where(eq(schema.chatbotMessages.conversationId, conversationId));
  await db.delete(schema.chatbotEvents).where(eq(schema.chatbotEvents.conversationId, conversationId));
  await db.delete(schema.chatbotConversations).where(eq(schema.chatbotConversations.id, conversationId));
}

export async function getCapturedLeads(limit = 50) {
  const events = await db
    .select()
    .from(schema.chatbotEvents)
    .where(eq(schema.chatbotEvents.eventType, "lead_created"))
    .orderBy(sql`${schema.chatbotEvents.createdAt} DESC`)
    .limit(limit * 2);

  const seenLeadIds = new Set<string>();
  const uniqueLeads: Array<{
    id: string;
    createdAt: Date | null;
    leadId?: string;
    name?: string;
    email?: string;
    phone?: string;
    propertyId?: string;
    budgetMin?: number;
    budgetMax?: number;
    message?: string;
  }> = [];

  for (const event of events) {
    const metadata = event.metadata ? JSON.parse(event.metadata) : {};
    const leadId = metadata.leadId;
    
    if (leadId && seenLeadIds.has(leadId)) {
      continue;
    }
    if (leadId) {
      seenLeadIds.add(leadId);
    }
    
    uniqueLeads.push({
      id: event.id,
      createdAt: event.createdAt,
      ...metadata,
    });
    
    if (uniqueLeads.length >= limit) {
      break;
    }
  }

  return uniqueLeads;
}
