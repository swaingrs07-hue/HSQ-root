import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  MapPin,
  Calendar,
  Building2,
  Bed,
  IndianRupee,
  Phone,
  Mail,
  Eye,
  Edit,
  Trash2,
  ArrowRight,
  User,
} from "lucide-react";
import type { Lead } from "@shared/schema";

export type KanbanStage = "unqualified" | "qualified" | "viewing" | "negotiating" | "won";

export interface KanbanColumn {
  id: KanbanStage;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: "unqualified",
    title: "Unqualified",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-300",
  },
  {
    id: "qualified",
    title: "Qualified",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-300",
  },
  {
    id: "viewing",
    title: "Viewing",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-300",
  },
  {
    id: "negotiating",
    title: "Negotiating",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-300",
  },
  {
    id: "won",
    title: "Won",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-300",
  },
];

export function mapLeadStatusToStage(status: string): KanbanStage {
  switch (status) {
    case "new":
    case "cold":
      return "unqualified";
    case "contacted":
    case "warm":
    case "interested":
      return "qualified";
    case "site_visit":
    case "visit_scheduled":
      return "viewing";
    case "negotiation":
    case "hot":
      return "negotiating";
    case "converted":
    case "deal_closed":
      return "won";
    default:
      return "unqualified";
  }
}

export function mapStageToLeadStatus(stage: KanbanStage): string {
  switch (stage) {
    case "unqualified":
      return "new";
    case "qualified":
      return "contacted";
    case "viewing":
      return "site_visit";
    case "negotiating":
      return "negotiation";
    case "won":
      return "converted";
    default:
      return "new";
  }
}

interface RequestCardProps {
  lead: Lead;
  onView?: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  onMove?: (lead: Lead, stage: KanbanStage) => void;
  isDragging?: boolean;
}

function SortableRequestCard({
  lead,
  onView,
  onEdit,
  onDelete,
  onMove,
}: RequestCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <RequestCard
        lead={lead}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
        onMove={onMove}
        isDragging={isDragging}
      />
    </div>
  );
}

function RequestCard({
  lead,
  onView,
  onEdit,
  onDelete,
  onMove,
  isDragging,
}: RequestCardProps) {
  const stage = mapLeadStatusToStage(lead.status);
  const column = KANBAN_COLUMNS.find((c) => c.id === stage);
  const monthlyValue = lead.budgetMax || lead.budgetMin || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2, boxShadow: "0 8px 25px -5px rgba(0,0,0,0.1)" }}
      className={`group relative bg-white rounded-xl border shadow-sm overflow-hidden transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? "ring-2 ring-indigo-500 shadow-xl" : ""
      }`}
      data-testid={`kanban-card-${lead.id}`}
    >
      <div
        className={`h-1 ${column?.bgColor?.replace("50", "400") || "bg-slate-400"}`}
        style={{
          background:
            stage === "unqualified"
              ? "#94a3b8"
              : stage === "qualified"
              ? "#3b82f6"
              : stage === "viewing"
              ? "#f59e0b"
              : stage === "negotiating"
              ? "#a855f7"
              : "#10b981",
        }}
      />
      
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-800 truncate" data-testid={`card-name-${lead.id}`}>
              {lead.name}
            </h4>
            {lead.phone && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" />
                {lead.phone}
              </p>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`card-menu-${lead.id}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onView?.(lead)}>
                <Eye className="w-4 h-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(lead)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ArrowRight className="w-4 h-4 mr-2" />
                Move to
                <DropdownMenu>
                  <DropdownMenuContent>
                    {KANBAN_COLUMNS.filter((c) => c.id !== stage).map((col) => (
                      <DropdownMenuItem
                        key={col.id}
                        onClick={() => onMove?.(lead, col.id)}
                      >
                        {col.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => onDelete?.(lead)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {lead.propertyName && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Building2 className="w-4 h-4 text-indigo-500" />
            <span className="truncate">{lead.propertyName}</span>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-slate-500">
          {lead.createdAt && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(lead.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })}
            </div>
          )}
          {lead.source && (
            <Badge variant="secondary" className="text-xs px-2 py-0">
              {lead.source}
            </Badge>
          )}
        </div>

        {monthlyValue > 0 && (
          <div className="flex items-center gap-1 text-sm font-medium text-emerald-600">
            <IndianRupee className="w-3.5 h-3.5" />
            {monthlyValue.toLocaleString("en-IN")}/mo
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                {lead.assignedToId ? "SE" : <User className="w-3 h-3" />}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-slate-500">
              {lead.assignedToId ? "Assigned" : "Unassigned"}
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-xs ${
              lead.priority === "hot"
                ? "border-red-300 text-red-600 bg-red-50"
                : lead.priority === "warm"
                ? "border-amber-300 text-amber-600 bg-amber-50"
                : "border-slate-300 text-slate-600 bg-slate-50"
            }`}
          >
            {lead.priority}
          </Badge>
        </div>
      </div>
    </motion.div>
  );
}

interface KanbanColumnProps {
  column: KanbanColumn;
  leads: Lead[];
  totalValue: number;
  onView?: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  onMove?: (lead: Lead, stage: KanbanStage) => void;
}

function KanbanColumnComponent({
  column,
  leads,
  totalValue,
  onView,
  onEdit,
  onDelete,
  onMove,
}: KanbanColumnProps) {
  return (
    <div
      className="flex-shrink-0 w-[320px] flex flex-col h-full"
      data-testid={`kanban-column-${column.id}`}
    >
      <div
        className={`sticky top-0 z-10 p-4 rounded-t-xl border-b ${column.bgColor} backdrop-blur-sm`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold ${column.color}`}>{column.title}</h3>
            <Badge variant="secondary" className="h-5 px-2 text-xs">
              {leads.length}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <IndianRupee className="w-3.5 h-3.5" />
          <span className="font-medium">
            {totalValue.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      <div
        className={`flex-1 p-3 space-y-3 overflow-y-auto ${column.bgColor} bg-opacity-30 rounded-b-xl border-x border-b ${column.borderColor}`}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence mode="popLayout">
            {leads.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-slate-400"
              >
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Building2 className="w-6 h-6" />
                </div>
                <p className="text-sm">No requests</p>
                <p className="text-xs">Drag cards here</p>
              </motion.div>
            ) : (
              leads.map((lead) => (
                <SortableRequestCard
                  key={lead.id}
                  lead={lead}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMove={onMove}
                />
              ))
            )}
          </AnimatePresence>
        </SortableContext>
      </div>
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className="flex gap-6 p-6 overflow-x-auto">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex-shrink-0 w-[320px]">
          <Skeleton className="h-20 rounded-t-xl" />
          <div className="space-y-3 p-3 bg-slate-50 rounded-b-xl">
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-36 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface KanbanBoardProps {
  leads: Lead[];
  loading?: boolean;
  error?: string;
  onStageChange?: (leadId: string, newStage: KanbanStage, oldStage: KanbanStage) => void;
  onView?: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
}

export function KanbanBoard({
  leads,
  loading,
  error,
  onStageChange,
  onView,
  onEdit,
  onDelete,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const groupedLeads = useMemo(() => {
    const groups: Record<KanbanStage, Lead[]> = {
      unqualified: [],
      qualified: [],
      viewing: [],
      negotiating: [],
      won: [],
    };

    leads.forEach((lead) => {
      const stage = mapLeadStatusToStage(lead.status);
      groups[stage].push(lead);
    });

    return groups;
  }, [leads]);

  const columnTotals = useMemo(() => {
    const totals: Record<KanbanStage, number> = {
      unqualified: 0,
      qualified: 0,
      viewing: 0,
      negotiating: 0,
      won: 0,
    };

    Object.entries(groupedLeads).forEach(([stage, stageLeads]) => {
      totals[stage as KanbanStage] = stageLeads.reduce(
        (sum, lead) => sum + (lead.budgetMax || lead.budgetMin || 0),
        0
      );
    });

    return totals;
  }, [groupedLeads]);

  const activeLead = activeId
    ? leads.find((l) => l.id === activeId)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeLeadId = active.id as string;
    const overId = over.id as string;

    const activeLead = leads.find((l) => l.id === activeLeadId);
    if (!activeLead) return;

    const activeStage = mapLeadStatusToStage(activeLead.status);

    let newStage: KanbanStage = activeStage;

    const overLead = leads.find((l) => l.id === overId);
    if (overLead) {
      newStage = mapLeadStatusToStage(overLead.status);
    } else if (KANBAN_COLUMNS.some((c) => c.id === overId)) {
      newStage = overId as KanbanStage;
    }

    if (newStage !== activeStage) {
      onStageChange?.(activeLeadId, newStage, activeStage);
    }
  };

  const handleMove = (lead: Lead, newStage: KanbanStage) => {
    const oldStage = mapLeadStatusToStage(lead.status);
    if (newStage !== oldStage) {
      onStageChange?.(lead.id, newStage, oldStage);
    }
  };

  if (loading) {
    return <KanbanSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            Failed to load requests
          </h3>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex gap-6 p-6 overflow-x-auto min-h-[600px]"
        data-testid="kanban-board"
      >
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumnComponent
            key={column.id}
            column={column}
            leads={groupedLeads[column.id]}
            totalValue={columnTotals[column.id]}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onMove={handleMove}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead && (
          <RequestCard lead={activeLead} isDragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}
