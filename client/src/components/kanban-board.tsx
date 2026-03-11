import { useState, useMemo, useCallback, memo, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
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
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  MoreVertical,
  MapPin,
  Calendar,
  Building2,
  IndianRupee,
  Phone,
  Mail,
  Eye,
  Edit,
  Trash2,
  ArrowRight,
  User,
  Clock,
  MessageSquare,
  TrendingUp,
  Target,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Activity,
  Zap,
} from "lucide-react";
import type { Lead } from "@shared/schema";

export type KanbanStage = "unqualified" | "qualified" | "viewing" | "negotiating" | "won";

export interface KanbanColumn {
  id: KanbanStage;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  gradient: string;
  iconColor: string;
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: "unqualified",
    title: "Unqualified",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    gradient: "from-slate-100 to-slate-50",
    iconColor: "#64748b",
  },
  {
    id: "qualified",
    title: "Qualified",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    gradient: "from-blue-100 to-blue-50",
    iconColor: "#3b82f6",
  },
  {
    id: "viewing",
    title: "Viewing",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    gradient: "from-indigo-100 to-indigo-50",
    iconColor: "#6366f1",
  },
  {
    id: "negotiating",
    title: "Negotiating",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    gradient: "from-amber-100 to-amber-50",
    iconColor: "#f59e0b",
  },
  {
    id: "won",
    title: "Won",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    gradient: "from-emerald-100 to-emerald-50",
    iconColor: "#10b981",
  },
];

const STAGE_ORDER: KanbanStage[] = ["unqualified", "qualified", "viewing", "negotiating", "won"];

function isValidMove(fromStage: KanbanStage, toStage: KanbanStage): boolean {
  const fromIndex = STAGE_ORDER.indexOf(fromStage);
  const toIndex = STAGE_ORDER.indexOf(toStage);
  return Math.abs(fromIndex - toIndex) <= 2;
}

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

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 800;
    const startTime = Date.now();
    const startValue = displayValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (value - startValue) * easeOut);
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value]);
  
  return <span>{prefix}{displayValue.toLocaleString("en-IN")}</span>;
}

interface PipelineAnalyticsProps {
  leads: Lead[];
  groupedLeads: Record<KanbanStage, Lead[]>;
}

const PipelineAnalytics = memo(function PipelineAnalytics({ leads, groupedLeads }: PipelineAnalyticsProps) {
  const analytics = useMemo(() => {
    const totalRequests = leads.length;
    const totalValue = leads.reduce((sum, l) => sum + (l.budgetMax || l.budgetMin || 0), 0);
    const wonValue = groupedLeads.won.reduce((sum, l) => sum + (l.budgetMax || l.budgetMin || 0), 0);
    const wonCount = groupedLeads.won.length;
    const conversionRate = totalRequests > 0 ? Math.round((wonCount / totalRequests) * 100) : 0;
    
    return { totalRequests, totalValue, wonValue, wonCount, conversionRate };
  }, [leads, groupedLeads]);
  
  const stats = [
    {
      label: "Total Requests",
      value: analytics.totalRequests,
      icon: Target,
      color: "from-indigo-500 to-purple-500",
      bgColor: "bg-indigo-50",
      textColor: "text-indigo-600",
    },
    {
      label: "Pipeline Value",
      value: analytics.totalValue,
      prefix: "₹",
      icon: TrendingUp,
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-50",
      textColor: "text-blue-600",
    },
    {
      label: "Won Value",
      value: analytics.wonValue,
      prefix: "₹",
      icon: CheckCircle2,
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-50",
      textColor: "text-emerald-600",
    },
    {
      label: "Conversion",
      value: analytics.conversionRate,
      suffix: "%",
      icon: Zap,
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-50",
      textColor: "text-amber-600",
    },
  ];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/95 backdrop-blur-xl border-b border-slate-100 px-4 sm:px-6 py-4 relative z-10"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="relative group"
          >
            <div className={`absolute inset-0 bg-gradient-to-r ${stat.color} rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity`} />
            <div className={`relative ${stat.bgColor} rounded-2xl p-4 border border-white/50 shadow-sm`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {stat.label}
                </span>
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <p className={`text-2xl font-bold ${stat.textColor}`}>
                <AnimatedNumber value={stat.value} prefix={stat.prefix || ""} />
                {stat.suffix || ""}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
});

interface RequestCardProps {
  lead: Lead;
  onView?: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  onMove?: (lead: Lead, stage: KanbanStage) => void;
  isDragging?: boolean;
  currentStage?: KanbanStage;
}

const RequestCard = memo(function RequestCard({
  lead,
  onView,
  onEdit,
  onDelete,
  onMove,
  isDragging,
  currentStage,
}: RequestCardProps) {
  const stage = currentStage || mapLeadStatusToStage(lead.status);
  const column = KANBAN_COLUMNS.find((c) => c.id === stage);
  const monthlyValue = lead.budgetMax || lead.budgetMin || 0;
  
  const stageColorBar: Record<KanbanStage, string> = {
    unqualified: "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
    qualified: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
    viewing: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
    negotiating: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
    won: "linear-gradient(135deg, #34d399 0%, #10b981 100%)",
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      whileHover={{ y: -4, boxShadow: "0 12px 40px -8px rgba(0,0,0,0.12)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`group relative bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? "ring-2 ring-indigo-500 shadow-2xl shadow-indigo-500/20 z-50" : ""
      }`}
      data-testid={`kanban-card-${lead.id}`}
    >
      <div
        className="h-1.5"
        style={{ background: stageColorBar[stage] }}
      />
      
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-slate-800 truncate text-[15px]" data-testid={`card-name-${lead.id}`}>
              {lead.name}
            </h4>
            {lead.phone && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
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
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-slate-100 rounded-lg"
                data-testid={`card-menu-${lead.id}`}
              >
                <MoreVertical className="h-4 w-4 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-xl border-slate-100">
              <DropdownMenuItem onClick={() => onView?.(lead)} className="rounded-lg">
                <Eye className="w-4 h-4 mr-2 text-indigo-500" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(lead)} className="rounded-lg">
                <Edit className="w-4 h-4 mr-2 text-blue-500" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-slate-400 mb-1">Move to</p>
                <div className="space-y-0.5">
                  {KANBAN_COLUMNS.filter((c) => c.id !== stage).map((col) => {
                    const canMove = isValidMove(stage, col.id);
                    return (
                      <button
                        key={col.id}
                        onClick={() => canMove && onMove?.(lead, col.id)}
                        disabled={!canMove}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                          canMove 
                            ? "hover:bg-slate-50 cursor-pointer text-slate-700" 
                            : "opacity-40 cursor-not-allowed text-slate-400"
                        }`}
                      >
                        <div 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ background: col.iconColor }}
                        />
                        <span>{col.title}</span>
                        {!canMove && (
                          <span className="text-xs text-slate-400 ml-auto">Too far</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 rounded-lg focus:bg-red-50 focus:text-red-600"
                onClick={() => onDelete?.(lead)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {lead.propertyName && (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5">
            <Building2 className="w-4 h-4 text-indigo-500" />
            <span className="truncate font-medium">{lead.propertyName}</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-slate-500">
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
            <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 rounded-full ${lead.source === 'hsquare_dynamics' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
              {lead.source === 'hsquare_dynamics' ? 'Hsquare Dynamics' : lead.source === 'walk_in' ? 'Walk-in' : lead.source === 'phone_inquiry' ? 'Phone' : lead.source === 'social_media' ? 'Social Media' : lead.source === 'google_ads' ? 'Google Ads' : lead.source === 'email_campaign' ? 'Email' : lead.source}
            </Badge>
          )}
        </div>

        {monthlyValue > 0 && (
          <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-lg px-2.5 py-1.5">
            <IndianRupee className="w-3.5 h-3.5" />
            {monthlyValue.toLocaleString("en-IN")}/mo
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6 ring-2 ring-white shadow-sm">
              <AvatarFallback className="text-[10px] bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-medium">
                {lead.assignedToId ? "SE" : <User className="w-3 h-3" />}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-slate-500 font-medium">
              {lead.assignedToId ? "Assigned" : "Unassigned"}
            </span>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              lead.priority === "hot"
                ? "border-red-200 text-red-600 bg-red-50"
                : lead.priority === "warm"
                ? "border-amber-200 text-amber-600 bg-amber-50"
                : "border-slate-200 text-slate-600 bg-slate-50"
            }`}
          >
            {lead.priority}
          </Badge>
        </div>
      </div>
    </motion.div>
  );
});

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
    opacity: isDragging ? 0.4 : 1,
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

interface KanbanColumnProps {
  column: KanbanColumn;
  leads: Lead[];
  totalValue: number;
  onView?: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  onMove?: (lead: Lead, stage: KanbanStage) => void;
  isDropTarget?: boolean;
  canDrop?: boolean;
  activeStage?: KanbanStage | null;
}

const KanbanColumnComponent = memo(function KanbanColumnComponent({
  column,
  leads,
  totalValue,
  onView,
  onEdit,
  onDelete,
  onMove,
  isDropTarget,
  canDrop,
  activeStage,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });
  
  const showDropIndicator = activeStage && activeStage !== column.id;
  const validDrop = activeStage ? isValidMove(activeStage, column.id) : false;
  
  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 w-[280px] min-w-[280px] flex flex-col"
      style={{ minHeight: "500px" }}
      data-testid={`kanban-column-${column.id}`}
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`sticky top-0 z-10 p-4 rounded-t-2xl border border-b-0 bg-gradient-to-r ${column.gradient} ${column.borderColor}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
              style={{ background: column.iconColor }}
            />
            <h3 className={`font-semibold text-sm ${column.color} truncate`}>{column.title}</h3>
            <Badge 
              variant="secondary" 
              className="h-5 px-2 text-xs bg-white/60 backdrop-blur-sm font-medium flex-shrink-0"
            >
              {leads.length}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-slate-600">
          <IndianRupee className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-semibold truncate">
            {totalValue.toLocaleString("en-IN")}
          </span>
        </div>
      </motion.div>

      <div
        className={`flex-1 p-3 space-y-3 overflow-y-auto ${column.bgColor} bg-opacity-40 rounded-b-2xl border-x border-b ${column.borderColor} transition-all duration-200 ${
          isOver && validDrop 
            ? "ring-2 ring-inset ring-indigo-400 bg-indigo-50/50" 
            : isOver && !validDrop 
            ? "ring-2 ring-inset ring-red-300 bg-red-50/30" 
            : ""
        } ${showDropIndicator && validDrop ? "bg-opacity-60" : ""}`}
        style={{ minHeight: "400px" }}
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
                className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400"
              >
                <div className={`w-14 h-14 rounded-2xl ${column.bgColor} flex items-center justify-center mb-4 shadow-sm`}>
                  <Sparkles className="w-6 h-6" style={{ color: column.iconColor }} />
                </div>
                <p className="text-sm font-medium text-slate-500">No requests</p>
                <p className="text-xs text-slate-400 mt-1">Drag cards here to move</p>
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
        
        {showDropIndicator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`mt-2 p-4 rounded-xl border-2 border-dashed flex items-center justify-center ${
              validDrop 
                ? "border-indigo-300 bg-indigo-50/50 text-indigo-600" 
                : "border-red-200 bg-red-50/50 text-red-500"
            }`}
          >
            <span className="text-xs font-medium">
              {validDrop ? "Drop here" : "Cannot drop here"}
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
});

interface LeadDetailDrawerProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (lead: Lead) => void;
}

function LeadDetailDrawer({ lead, open, onClose, onEdit }: LeadDetailDrawerProps) {
  if (!lead) return null;
  
  const stage = mapLeadStatusToStage(lead.status);
  const column = KANBAN_COLUMNS.find((c) => c.id === stage);
  
  const timeline = [
    { action: "Lead created", time: lead.createdAt, icon: Target },
    { action: "Status updated", time: lead.lastActivityAt || lead.createdAt, icon: Activity },
  ];
  
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader className="space-y-4 pb-6 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-white shadow-lg">
                <AvatarFallback className="text-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold">
                  {lead.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-lg font-semibold text-slate-800">
                  {lead.name}
                </SheetTitle>
                <Badge
                  variant="outline"
                  className={`mt-1 text-xs ${column?.color} ${column?.bgColor} border-0`}
                >
                  {column?.title}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>
        
        <div className="py-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-500" />
              Contact Information
            </h4>
            <div className="space-y-3 pl-6">
              {lead.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{lead.phone}</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">{lead.email}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              Property Details
            </h4>
            <div className="pl-6 space-y-3">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <p className="font-medium text-slate-800">{lead.propertyName || "No property selected"}</p>
                {(lead.budgetMin || lead.budgetMax) && (
                  <div className="flex items-center gap-1 text-sm text-emerald-600">
                    <IndianRupee className="w-3.5 h-3.5" />
                    <span className="font-medium">
                      {lead.budgetMin?.toLocaleString("en-IN")} - {lead.budgetMax?.toLocaleString("en-IN")}/mo
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Activity Timeline
            </h4>
            <div className="pl-6 space-y-4">
              {timeline.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{item.action}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(item.time).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {lead.notes && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-500" />
                Notes
              </h4>
              <div className="pl-6">
                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4">
                  {lead.notes}
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="pt-4 border-t border-slate-100 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button 
            className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
            onClick={() => onEdit?.(lead)}
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit Lead
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function KanbanSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="bg-white/95 backdrop-blur-xl border-b border-slate-100 px-4 sm:px-6 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-x-auto px-4 sm:px-6 py-6">
        <div className="inline-flex gap-4" style={{ minWidth: "max-content" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-shrink-0 w-[280px]" style={{ minHeight: "500px" }}>
              <Skeleton className="h-20 rounded-t-2xl" />
              <div className="space-y-3 p-3 bg-slate-50 rounded-b-2xl min-h-[400px]">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-40 rounded-2xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
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
  const [activeStage, setActiveStage] = useState<KanbanStage | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const leadId = event.active.id as string;
    setActiveId(leadId);
    const lead = leads.find((l) => l.id === leadId);
    if (lead) {
      setActiveStage(mapLeadStatusToStage(lead.status));
    }
  }, [leads]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveStage(null);

    if (!over) return;

    const activeLeadId = active.id as string;
    const overId = over.id as string;

    const activeLead = leads.find((l) => l.id === activeLeadId);
    if (!activeLead) return;

    const currentStage = mapLeadStatusToStage(activeLead.status);

    let newStage: KanbanStage = currentStage;

    const overLead = leads.find((l) => l.id === overId);
    if (overLead) {
      newStage = mapLeadStatusToStage(overLead.status);
    } else if (KANBAN_COLUMNS.some((c) => c.id === overId)) {
      newStage = overId as KanbanStage;
    }

    if (newStage !== currentStage && isValidMove(currentStage, newStage)) {
      onStageChange?.(activeLeadId, newStage, currentStage);
    }
  }, [leads, onStageChange]);

  const handleMove = useCallback((lead: Lead, newStage: KanbanStage) => {
    const oldStage = mapLeadStatusToStage(lead.status);
    if (newStage !== oldStage && isValidMove(oldStage, newStage)) {
      onStageChange?.(lead.id, newStage, oldStage);
    }
  }, [onStageChange]);

  const handleView = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  }, []);

  if (loading) {
    return <KanbanSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-100">
            <Building2 className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 mb-2">
            Failed to load requests
          </h3>
          <p className="text-slate-500 max-w-sm">{error}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PipelineAnalytics leads={leads} groupedLeads={groupedLeads} />
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div 
          className="overflow-x-auto px-4 sm:px-6 py-6"
          style={{ minHeight: "500px" }}
        >
          <div
            className="inline-flex gap-4 pb-4"
            style={{ minWidth: "max-content" }}
            data-testid="kanban-board"
          >
            {KANBAN_COLUMNS.map((column) => (
              <KanbanColumnComponent
                key={column.id}
                column={column}
                leads={groupedLeads[column.id]}
                totalValue={columnTotals[column.id]}
                onView={handleView}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={handleMove}
                activeStage={activeStage}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeLead && (
            <div className="w-[280px]">
              <RequestCard lead={activeLead} isDragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      
      <LeadDetailDrawer
        lead={selectedLead}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onEdit={onEdit}
      />
    </div>
  );
}
