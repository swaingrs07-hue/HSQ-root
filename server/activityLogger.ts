import { storage } from "./storage";
import type { InsertActivityLog, User } from "@shared/schema";

export type ActionType = 
  | "CREATE" 
  | "UPDATE" 
  | "DELETE" 
  | "DEACTIVATE" 
  | "ACTIVATE" 
  | "ASSIGN" 
  | "UNASSIGN" 
  | "REASSIGN" 
  | "LOGIN" 
  | "LOGOUT" 
  | "STAGE_CHANGE" 
  | "STATUS_CHANGE";

export type EntityType = 
  | "USER" 
  | "SALES_EXECUTIVE" 
  | "LEAD" 
  | "REQUEST" 
  | "PROPERTY" 
  | "BOOKING" 
  | "ROOM_TYPE" 
  | "PAYMENT";

interface LogActivityParams {
  actor: {
    id?: string;
    name: string;
    role: string;
  };
  actionType: ActionType;
  entityType: EntityType;
  entityId: string;
  entityLabel: string;
  propertyId?: string;
  propertyName?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const logData: InsertActivityLog = {
      actorUserId: params.actor.id || null,
      actorName: params.actor.name,
      actorRole: params.actor.role.toUpperCase(),
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      propertyId: params.propertyId || null,
      propertyName: params.propertyName || null,
      metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    };

    await storage.createActivityLog(logData);
  } catch (error) {
    console.error("[ActivityLogger] Failed to log activity:", error);
  }
}

export function formatActivityMessage(
  actionType: ActionType,
  entityType: EntityType,
  actorName: string,
  actorRole: string,
  entityLabel: string,
  metadata?: Record<string, any>
): string {
  const roleLabel = actorRole === "ADMIN" ? "Admin" : actorRole === "SALES_EXECUTIVE" ? "Sales Exec" : actorRole;
  
  switch (actionType) {
    case "CREATE":
      return `${roleLabel} ${actorName} created ${entityType.toLowerCase()} "${entityLabel}"`;
    case "UPDATE":
      return `${roleLabel} ${actorName} updated ${entityType.toLowerCase()} "${entityLabel}"`;
    case "DELETE":
      return `${roleLabel} ${actorName} deleted ${entityType.toLowerCase()} "${entityLabel}"`;
    case "DEACTIVATE":
      return `${roleLabel} ${actorName} deactivated ${entityType.toLowerCase()} "${entityLabel}"`;
    case "ACTIVATE":
      return `${roleLabel} ${actorName} activated ${entityType.toLowerCase()} "${entityLabel}"`;
    case "ASSIGN":
      if (metadata?.assignedTo) {
        return `${roleLabel} ${actorName} assigned ${entityType.toLowerCase()} "${entityLabel}" to ${metadata.assignedTo}`;
      }
      return `${roleLabel} ${actorName} assigned ${entityType.toLowerCase()} "${entityLabel}"`;
    case "UNASSIGN":
      return `${roleLabel} ${actorName} unassigned ${entityType.toLowerCase()} "${entityLabel}"`;
    case "REASSIGN":
      if (metadata?.from && metadata?.to) {
        return `${roleLabel} ${actorName} reassigned ${entityType.toLowerCase()} "${entityLabel}" from ${metadata.from} to ${metadata.to}`;
      }
      return `${roleLabel} ${actorName} reassigned ${entityType.toLowerCase()} "${entityLabel}"`;
    case "STAGE_CHANGE":
      if (metadata?.from && metadata?.to) {
        return `${roleLabel} ${actorName} moved ${entityType.toLowerCase()} "${entityLabel}" from ${metadata.from} to ${metadata.to}`;
      }
      return `${roleLabel} ${actorName} changed stage of ${entityType.toLowerCase()} "${entityLabel}"`;
    case "STATUS_CHANGE":
      if (metadata?.from && metadata?.to) {
        return `${roleLabel} ${actorName} changed status of ${entityType.toLowerCase()} "${entityLabel}" from ${metadata.from} to ${metadata.to}`;
      }
      return `${roleLabel} ${actorName} changed status of ${entityType.toLowerCase()} "${entityLabel}"`;
    case "LOGIN":
      return `${actorName} logged in`;
    case "LOGOUT":
      return `${actorName} logged out`;
    default:
      return `${roleLabel} ${actorName} performed action on ${entityType.toLowerCase()} "${entityLabel}"`;
  }
}

export function getActionBadgeColor(actionType: ActionType): string {
  switch (actionType) {
    case "CREATE":
      return "bg-green-100 text-green-800";
    case "UPDATE":
      return "bg-blue-100 text-blue-800";
    case "DELETE":
      return "bg-red-100 text-red-800";
    case "DEACTIVATE":
      return "bg-orange-100 text-orange-800";
    case "ACTIVATE":
      return "bg-emerald-100 text-emerald-800";
    case "ASSIGN":
      return "bg-purple-100 text-purple-800";
    case "UNASSIGN":
      return "bg-gray-100 text-gray-800";
    case "REASSIGN":
      return "bg-indigo-100 text-indigo-800";
    case "STAGE_CHANGE":
      return "bg-cyan-100 text-cyan-800";
    case "STATUS_CHANGE":
      return "bg-amber-100 text-amber-800";
    case "LOGIN":
      return "bg-teal-100 text-teal-800";
    case "LOGOUT":
      return "bg-slate-100 text-slate-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
