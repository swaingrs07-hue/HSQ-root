import { useState, useMemo, useCallback, memo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  Building2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Filter,
  User,
  Calendar,
  IndianRupee,
  Mail,
  MessageSquare,
} from "lucide-react";
import type { Lead } from "@shared/schema";
import { KANBAN_COLUMNS, type KanbanStage, mapLeadStatusToStage, mapStageToLeadStatus } from "./kanban-board";

interface MobileKanbanProps {
  leads: Lead[];
  onStageChange: (leadId: string, newStage: KanbanStage) => Promise<void>;
  onAddClick: () => void;
  onFilterClick: () => void;
  onSearchClick: () => void;
  onCardView?: (lead: Lead) => void;
  loading?: boolean;
  canEdit?: boolean;
}

const STAGE_ORDER: KanbanStage[] = ["unqualified", "qualified", "viewing", "negotiating", "won"];
const SWIPE_THRESHOLD = 80;
const SWIPE_VELOCITY_THRESHOLD = 500;

interface CompactCardProps {
  lead: Lead;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onTap: () => void;
  canSwipeLeft: boolean;
  canSwipeRight: boolean;
  canEdit: boolean;
}

const CompactCard = memo(function CompactCard({
  lead,
  onSwipeLeft,
  onSwipeRight,
  onTap,
  canSwipeLeft,
  canSwipeRight,
  canEdit,
}: CompactCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const x = useMotionValue(0);
  
  const leftIndicatorOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const rightIndicatorOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const scale = useTransform(x, [-100, 0, 100], [0.98, 1, 0.98]);
  
  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setSwiping(false);
      const threshold = SWIPE_THRESHOLD;
      const velocity = info.velocity.x;
      
      if (Math.abs(info.offset.x) > threshold || Math.abs(velocity) > SWIPE_VELOCITY_THRESHOLD) {
        if (info.offset.x > 0 && canSwipeRight && canEdit) {
          onSwipeRight();
        } else if (info.offset.x < 0 && canSwipeLeft && canEdit) {
          onSwipeLeft();
        }
      }
    },
    [canSwipeLeft, canSwipeRight, canEdit, onSwipeLeft, onSwipeRight]
  );
  
  const priorityColors = {
    hot: "border-red-400 bg-red-50 text-red-600",
    warm: "border-amber-400 bg-amber-50 text-amber-600",
    cold: "border-slate-300 bg-slate-50 text-slate-600",
  };
  
  return (
    <div className="relative mb-3 overflow-hidden">
      {canEdit && canSwipeLeft && (
        <motion.div
          className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-indigo-600"
          style={{ opacity: leftIndicatorOpacity }}
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-xs font-medium">Prev</span>
        </motion.div>
      )}
      
      {canEdit && canSwipeRight && (
        <motion.div
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-emerald-600"
          style={{ opacity: rightIndicatorOpacity }}
        >
          <span className="text-xs font-medium">Next</span>
          <ChevronRight className="w-5 h-5" />
        </motion.div>
      )}
      
      <motion.div
        drag={canEdit ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragStart={() => setSwiping(true)}
        onDragEnd={handleDragEnd}
        style={{ x, scale }}
        whileTap={{ scale: 0.98 }}
        className={`relative bg-white rounded-2xl border shadow-sm overflow-hidden touch-pan-y ${
          swiping ? "cursor-grabbing" : "cursor-pointer"
        }`}
        onClick={() => !swiping && setExpanded(!expanded)}
      >
        <div className="p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-800 truncate text-sm">
                {lead.name}
              </h4>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                priorityColors[lead.priority as keyof typeof priorityColors] || priorityColors.cold
              }`}
            >
              {lead.priority}
            </Badge>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {lead.phone && (
              <div className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <span className="truncate">{lead.phone}</span>
              </div>
            )}
          </div>
          
          {lead.propertyName && (
            <div className="flex items-center gap-1.5 text-xs text-indigo-600">
              <Building2 className="w-3 h-3 shrink-0" />
              <span className="truncate font-medium">{lead.propertyName}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between pt-1">
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full">
              {lead.status.replace(/_/g, " ")}
            </Badge>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="p-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>
        
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="px-3.5 pb-3.5 pt-1 space-y-2 border-t border-slate-100 bg-slate-50/50">
                {lead.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{lead.email}</span>
                  </div>
                )}
                
                {(lead.budgetMin || lead.budgetMax) && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <IndianRupee className="w-3.5 h-3.5" />
                    <span className="font-medium">
                      {lead.budgetMin?.toLocaleString("en-IN")} - {lead.budgetMax?.toLocaleString("en-IN")}/mo
                    </span>
                  </div>
                )}
                
                {lead.createdAt && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {new Date(lead.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                
                {lead.notes && (
                  <div className="flex items-start gap-2 text-xs text-slate-600">
                    <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{lead.notes}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                  <User className="w-3.5 h-3.5" />
                  <span>{lead.assignedToId ? "Assigned" : "Unassigned"}</span>
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 text-xs h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTap();
                  }}
                >
                  View Full Details
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
});

const ITEM_HEIGHT = 130;

interface VirtualizedListProps {
  items: Lead[];
  currentStage: KanbanStage;
  onSwipeLeft: (lead: Lead) => void;
  onSwipeRight: (lead: Lead) => void;
  onCardView: (lead: Lead) => void;
  onScroll: (scrollTop: number) => void;
  canEdit: boolean;
}

const VirtualizedList = memo(function VirtualizedList({
  items,
  currentStage,
  onSwipeLeft,
  onSwipeRight,
  onCardView,
  onScroll,
  canEdit,
}: VirtualizedListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 15 });
  
  const stageIndex = STAGE_ORDER.indexOf(currentStage);
  const canSwipeToNext = stageIndex < STAGE_ORDER.length - 1;
  const canSwipeToPrev = stageIndex > 0;
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const visibleItems = Math.ceil(container.clientHeight / ITEM_HEIGHT);
      const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 3);
      const endIndex = Math.min(items.length, startIndex + visibleItems + 6);
      
      setVisibleRange({ start: startIndex, end: endIndex });
      onScroll(scrollTop);
    };
    
    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    
    return () => container.removeEventListener("scroll", handleScroll);
  }, [items.length, onScroll]);
  
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end);
  }, [items, visibleRange]);
  
  const topPadding = visibleRange.start * ITEM_HEIGHT;
  const bottomPadding = Math.max(0, (items.length - visibleRange.end) * ITEM_HEIGHT);
  
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <Building2 className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm font-medium">No leads in this stage</p>
        <p className="text-xs mt-1">Swipe cards to move them here</p>
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div style={{ paddingTop: topPadding, paddingBottom: bottomPadding }}>
        {visibleItems.map((lead) => (
          <CompactCard
            key={lead.id}
            lead={lead}
            onSwipeLeft={() => onSwipeLeft(lead)}
            onSwipeRight={() => onSwipeRight(lead)}
            onTap={() => onCardView(lead)}
            canSwipeLeft={canSwipeToPrev}
            canSwipeRight={canSwipeToNext}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
});

export function MobileKanban({
  leads,
  onStageChange,
  onAddClick,
  onFilterClick,
  onSearchClick,
  onCardView,
  loading,
  canEdit = true,
}: MobileKanbanProps) {
  const { toast } = useToast();
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [bottomBarVisible, setBottomBarVisible] = useState(true);
  const lastScrollY = useRef(0);
  const swipeDebounce = useRef<NodeJS.Timeout | null>(null);
  
  const currentStage = STAGE_ORDER[currentStageIndex];
  const currentColumn = KANBAN_COLUMNS.find((c) => c.id === currentStage)!;
  
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
  
  const currentLeads = groupedLeads[currentStage];
  
  const navigateToStage = useCallback((direction: "prev" | "next") => {
    if (isTransitioning) return;
    
    const newIndex = direction === "next" 
      ? Math.min(currentStageIndex + 1, STAGE_ORDER.length - 1)
      : Math.max(currentStageIndex - 1, 0);
    
    if (newIndex !== currentStageIndex) {
      setIsTransitioning(true);
      setCurrentStageIndex(newIndex);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentStageIndex, isTransitioning]);
  
  const handleSwipeCard = useCallback(
    async (lead: Lead, direction: "prev" | "next") => {
      if (!canEdit) {
        toast({
          title: "Permission Denied",
          description: "You don't have permission to move leads",
          variant: "destructive",
        });
        return;
      }
      
      if (swipeDebounce.current) {
        return;
      }
      
      swipeDebounce.current = setTimeout(() => {
        swipeDebounce.current = null;
      }, 500);
      
      const currentLeadStage = mapLeadStatusToStage(lead.status);
      const stageIndex = STAGE_ORDER.indexOf(currentLeadStage);
      const newStageIndex = direction === "next" ? stageIndex + 1 : stageIndex - 1;
      
      if (newStageIndex < 0 || newStageIndex >= STAGE_ORDER.length) return;
      
      const newStage = STAGE_ORDER[newStageIndex];
      
      try {
        await onStageChange(lead.id, newStage);
        toast({
          title: "Lead Moved",
          description: `${lead.name} moved to ${KANBAN_COLUMNS.find(c => c.id === newStage)?.title}`,
        });
      } catch (error) {
        toast({
          title: "Failed to Move",
          description: "Could not move the lead. Please try again.",
          variant: "destructive",
        });
      }
    },
    [canEdit, onStageChange, toast]
  );
  
  const handleListScroll = useCallback((scrollTop: number) => {
    const isScrollingDown = scrollTop > lastScrollY.current && scrollTop > 50;
    
    setBottomBarVisible(!isScrollingDown);
    lastScrollY.current = scrollTop;
  }, []);
  
  const handleStageDrag = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (Math.abs(info.offset.x) > 100 || Math.abs(info.velocity.x) > 300) {
        if (info.offset.x > 0) {
          navigateToStage("prev");
        } else {
          navigateToStage("next");
        }
      }
    },
    [navigateToStage]
  );
  
  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-slate-100 shadow-sm"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigateToStage("prev")}
            disabled={currentStageIndex === 0}
            className={`p-2 rounded-xl transition-all ${
              currentStageIndex === 0
                ? "opacity-30 cursor-not-allowed"
                : "hover:bg-slate-100 active:scale-95"
            }`}
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex flex-col items-center"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: currentColumn.iconColor }}
                />
                <h2 className={`text-lg font-bold ${currentColumn.color}`}>
                  {currentColumn.title}
                </h2>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                <span className="font-semibold">{currentLeads.length}</span>
                <span>leads</span>
              </div>
            </motion.div>
          </AnimatePresence>
          
          <button
            onClick={() => navigateToStage("next")}
            disabled={currentStageIndex === STAGE_ORDER.length - 1}
            className={`p-2 rounded-xl transition-all ${
              currentStageIndex === STAGE_ORDER.length - 1
                ? "opacity-30 cursor-not-allowed"
                : "hover:bg-slate-100 active:scale-95"
            }`}
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        
        <div className="flex justify-center gap-1.5 pb-3">
          {STAGE_ORDER.map((stage, index) => {
            const column = KANBAN_COLUMNS.find((c) => c.id === stage)!;
            const count = groupedLeads[stage].length;
            const isActive = index === currentStageIndex;
            
            return (
              <button
                key={stage}
                onClick={() => {
                  if (!isTransitioning) {
                    setIsTransitioning(true);
                    setCurrentStageIndex(index);
                    setTimeout(() => setIsTransitioning(false), 300);
                  }
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? `${column.bgColor} ${column.color} shadow-sm`
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: column.iconColor, opacity: isActive ? 1 : 0.5 }}
                />
                {isActive && <span>{count}</span>}
              </button>
            );
          })}
        </div>
      </motion.div>
      
      <motion.div
        key={currentStage}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex-1 overflow-hidden"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleStageDrag}
      >
        <VirtualizedList
          items={currentLeads}
          currentStage={currentStage}
          onSwipeLeft={(lead) => handleSwipeCard(lead, "prev")}
          onSwipeRight={(lead) => handleSwipeCard(lead, "next")}
          onCardView={(lead) => onCardView?.(lead)}
          onScroll={handleListScroll}
          canEdit={canEdit}
        />
      </motion.div>
      
      <AnimatePresence>
        {bottomBarVisible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-xl border-t border-slate-100 shadow-lg safe-area-bottom"
          >
            <div className="flex items-center justify-around px-4 py-3">
              <button
                onClick={onSearchClick}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
              >
                <Search className="w-5 h-5 text-slate-600" />
                <span className="text-[10px] font-medium text-slate-500">Search</span>
              </button>
              
              <button
                onClick={onAddClick}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl shadow-lg shadow-indigo-500/25 active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-semibold">New Lead</span>
              </button>
              
              <button
                onClick={onFilterClick}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl hover:bg-slate-50 active:scale-95 transition-all"
              >
                <Filter className="w-5 h-5 text-slate-600" />
                <span className="text-[10px] font-medium text-slate-500">Filter</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="h-20" />
    </div>
  );
}

export default MobileKanban;
