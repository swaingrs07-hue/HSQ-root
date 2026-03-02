import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Building2, Layers, BedDouble, ChevronDown, ChevronUp, DoorOpen, Bath, Ban,
  User, Phone, Mail, Calendar, IndianRupee, CreditCard, CheckCircle, AlertTriangle,
  Clock, Eye, Loader2, X, FileText, Shield, ArrowRight, History, Activity,
  Unlock, Link2, GraduationCap, MapPin, ChevronRight, Sparkles,
  LayoutGrid, Box, ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, List,
  ChevronLeft, Home
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function getAuthToken(): string {
  try {
    const auth = JSON.parse(localStorage.getItem("hsquare_auth") || "{}");
    return auth.token || "";
  } catch {
    return "";
  }
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-500",
  occupied: "bg-rose-500",
  reserved: "bg-amber-400",
  maintenance: "bg-slate-400",
  blocked: "bg-red-700",
};

const STATUS_BG: Record<string, string> = {
  available: "border-emerald-300 bg-emerald-50",
  occupied: "border-rose-300 bg-rose-50",
  reserved: "border-amber-300 bg-amber-50",
  maintenance: "border-slate-300 bg-slate-50",
  blocked: "border-red-300 bg-red-50",
};

const BOOKING_STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  pending_payment: "bg-amber-100 text-amber-700",
  pending_approval: "bg-orange-100 text-orange-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-indigo-100 text-indigo-700",
  cancelled: "bg-red-100 text-red-700",
};

const ISO_BED_GLOW: Record<string, { bg: string; glow: string; border: string; text: string; label: string }> = {
  available: { bg: "from-emerald-500/80 to-emerald-600/80", glow: "shadow-[0_0_20px_rgba(16,185,129,0.6)]", border: "border-emerald-400/60", text: "text-emerald-100", label: "Available" },
  occupied: { bg: "from-blue-500/80 to-blue-600/80", glow: "shadow-[0_0_20px_rgba(59,130,246,0.6)]", border: "border-blue-400/60", text: "text-blue-100", label: "Booked" },
  reserved: { bg: "from-amber-500/80 to-amber-600/80", glow: "shadow-[0_0_20px_rgba(245,158,11,0.6)]", border: "border-amber-400/60", text: "text-amber-100", label: "Checked-in" },
  maintenance: { bg: "from-slate-500/80 to-slate-600/80", glow: "shadow-[0_0_15px_rgba(100,116,139,0.4)]", border: "border-slate-400/60", text: "text-slate-200", label: "Maintenance" },
  blocked: { bg: "from-red-600/80 to-red-700/80", glow: "shadow-[0_0_20px_rgba(220,38,38,0.6)]", border: "border-red-400/60", text: "text-red-100", label: "Blocked" },
};

function getGender(bed: any): "male" | "female" {
  const g = bed.currentBooking?.residentDetails?.gender || bed.currentBooking?.gender || "";
  return g.toLowerCase() === "female" ? "female" : "male";
}

function SharedCharDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="iso-shirt-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" /><stop offset="100%" stopColor="#2563EB" /></linearGradient>
        <linearGradient id="iso-shirt-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A855F7" /><stop offset="100%" stopColor="#9333EA" /></linearGradient>
        <filter id="iso-char-shadow"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="rgba(0,0,0,0.4)" /></filter>
      </defs>
    </svg>
  );
}

const BedCharacter3D = React.memo(function BedCharacter3D({ gender, status, size = "md" }: { gender: "male" | "female"; status: string; size?: "sm" | "md" | "lg" }) {
  const isMale = gender === "male";
  const skinTone = "#D4A574";
  const skinShadow = "#C49564";
  const hairColor = isMale ? "#2D1B0E" : "#1A0A00";
  const pantsColor = isMale ? "#1E293B" : "#374151";
  const auraColor = status === "reserved" ? "rgba(245,158,11,0.25)" : "rgba(59,130,246,0.2)";
  const shirtRef = isMale ? "url(#iso-shirt-m)" : "url(#iso-shirt-f)";
  const dims = size === "sm" ? { w: 22, h: 28 } : size === "md" ? { w: 32, h: 40 } : { w: 44, h: 56 };

  return (
    <div className="iso-character-container" style={{ width: dims.w, height: dims.h }} role="img" aria-label={`${gender} guest character`}>
      <svg viewBox="0 0 44 56" width={dims.w} height={dims.h} className="iso-character-breathe" aria-hidden="true">
        <ellipse cx="22" cy="52" rx="14" ry="3" fill={auraColor} className="iso-aura-pulse" />
        <g filter="url(#iso-char-shadow)" className="iso-character-idle">
          <rect x="14" y="36" width="7" height="14" rx="3" fill={pantsColor} className="iso-leg-left" />
          <rect x="23" y="36" width="7" height="14" rx="3" fill={pantsColor} className="iso-leg-right" />
          <rect x="12" y="22" width="20" height="16" rx="4" fill={shirtRef} />
          {isMale ? (
            <rect x="8" y="24" width="5" height="12" rx="2.5" fill={shirtRef} className="iso-arm-left" />
          ) : (
            <rect x="7" y="24" width="5" height="11" rx="2.5" fill={shirtRef} className="iso-arm-left-phone" />
          )}
          <rect x="31" y="24" width="5" height="12" rx="2.5" fill={shirtRef} className="iso-arm-right" />
          {!isMale && <rect x="8" y="34" width="4" height="6" rx="1.5" fill="#1F2937" className="iso-phone" />}
          <circle cx="22" cy="16" r="7" fill={skinTone} />
          <ellipse cx="22" cy="15.5" rx="7" ry="6.5" fill={skinTone} />
          <circle cx="19" cy="15" r="0.8" fill="#1A0A00" />
          <circle cx="25" cy="15" r="0.8" fill="#1A0A00" />
          <ellipse cx="22" cy="17.5" rx="1.5" ry="0.6" fill={skinShadow} />
          {isMale ? (
            <>
              <path d="M15 13 Q15 8 22 7 Q29 8 29 13 L28 12 Q27 9 22 8.5 Q17 9 16 12 Z" fill={hairColor} />
              <rect x="14.5" y="11" width="1.5" height="4" rx="0.75" fill={hairColor} />
              <rect x="28" y="11" width="1.5" height="4" rx="0.75" fill={hairColor} />
            </>
          ) : (
            <>
              <path d="M14 14 Q14 7 22 6 Q30 7 30 14 L29 11 Q28 8 22 7.5 Q16 8 15 11 Z" fill={hairColor} />
              <path d="M14 14 Q13 18 13 22 L14.5 22 Q14.5 18 15 14 Z" fill={hairColor} />
              <path d="M30 14 Q31 18 31 22 L29.5 22 Q29.5 18 29 14 Z" fill={hairColor} />
            </>
          )}
          <circle cx="22" cy="19.5" r="0.5" fill={skinShadow} opacity="0.3" />
        </g>
      </svg>
    </div>
  );
});

function BedScene3D({ bed, onClick, onHover, onLeave, onAllocate, onDeallocate, size = "md" }: {
  bed: any; onClick: () => void; onHover: (e: React.MouseEvent) => void; onLeave: () => void;
  onAllocate: () => void; onDeallocate: () => void; size?: "sm" | "md" | "lg";
}) {
  const bStyle = ISO_BED_GLOW[bed.status] || ISO_BED_GLOW.maintenance;
  const hasBooking = !!bed.currentBooking;
  const guestName = bed.currentBooking?.walkInName || bed.currentBooking?.residentDetails?.residentName || "";
  const gender = getGender(bed);
  const isAvailable = bed.status === "available";
  const isOccupied = bed.status === "occupied";
  const isReserved = bed.status === "reserved";
  const isBlocked = bed.status === "blocked";
  const showChar = hasBooking && (isOccupied || isReserved);

  const bedW = size === "sm" ? "w-[60px]" : size === "md" ? "w-[80px]" : "w-[100px]";
  const bedH = size === "sm" ? "h-[70px]" : size === "md" ? "h-[100px]" : "h-[130px]";

  return (
    <div className="relative group/bed3d">
      <button
        onClick={onClick}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        className={cn("iso-bed-scene relative rounded-xl transition-all duration-500 cursor-pointer border overflow-hidden", bedW, bedH,
          bStyle.border,
          isAvailable && "iso-bed-avail-glow",
          isOccupied && "iso-bed-booked-scene",
          isReserved && "iso-bed-checkin-scene",
          isBlocked && "iso-bed-blocked-scene"
        )}
        data-testid={`iso-bed-${bed.id}`}
      >
        <div className="absolute inset-0" style={{
          background: isAvailable
            ? "linear-gradient(145deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 50%, rgba(6,78,59,0.08) 100%)"
            : isOccupied
            ? "linear-gradient(145deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0.04) 50%, rgba(30,58,138,0.08) 100%)"
            : isReserved
            ? "linear-gradient(145deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.05) 50%, rgba(120,53,15,0.08) 100%)"
            : isBlocked
            ? "linear-gradient(145deg, rgba(220,38,38,0.12) 0%, rgba(220,38,38,0.04) 50%, rgba(127,29,29,0.08) 100%)"
            : "linear-gradient(145deg, rgba(100,116,139,0.1) 0%, rgba(100,116,139,0.04) 100%)"
        }} />

        {isAvailable && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10">
            <div className="iso-empty-bed-icon">
              <BedDouble className={cn("text-emerald-400/60", size === "sm" ? "w-4 h-4" : "w-6 h-6")} />
            </div>
            <span className={cn("font-bold text-emerald-400/80", size === "sm" ? "text-[7px]" : "text-[9px]")}>{bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}</span>
          </div>
        )}

        {isBlocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10">
            <div className="iso-blocked-pulse">
              <Ban className={cn("text-red-400/70", size === "sm" ? "w-4 h-4" : "w-5 h-5")} />
            </div>
            <span className={cn("font-bold text-red-400/70", size === "sm" ? "text-[7px]" : "text-[9px]")}>{bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}</span>
          </div>
        )}

        {bed.status === "maintenance" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 z-10">
            <AlertTriangle className={cn("text-slate-400/60", size === "sm" ? "w-4 h-4" : "w-5 h-5")} />
            <span className={cn("font-bold text-slate-400/70", size === "sm" ? "text-[7px]" : "text-[9px]")}>{bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}</span>
          </div>
        )}

        {showChar && (
          <div className="absolute inset-0 flex flex-col items-center z-10" style={{ paddingTop: size === "sm" ? "2px" : "4px" }}>
            <BedCharacter3D gender={gender} status={bed.status} size={size} />
            <div className="mt-auto mb-1 px-1 w-full text-center">
              <span className={cn("font-bold truncate block", size === "sm" ? "text-[6px] text-white/70" : "text-[8px] text-white/80")}>{bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}</span>
              {guestName && size !== "sm" && (
                <span className="text-[7px] text-white/50 truncate block">{guestName.split(" ")[0].slice(0, 8)}</span>
              )}
            </div>
          </div>
        )}

        {showChar && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-xl" style={{
            background: isReserved
              ? "linear-gradient(90deg, transparent, rgba(245,158,11,0.6), transparent)"
              : "linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)"
          }} />
        )}
      </button>

      <div className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/bed3d:opacity-100 transition-all duration-300 flex gap-0.5 z-30">
        {isAvailable && !hasBooking && (
          <button onClick={(e) => { e.stopPropagation(); onAllocate(); }} className="w-5 h-5 rounded-full bg-blue-500/90 hover:bg-blue-500 flex items-center justify-center shadow-lg backdrop-blur border border-blue-400/30" title="Allocate"><Link2 className="w-3 h-3 text-white" /></button>
        )}
        {isOccupied && hasBooking && (
          <button onClick={(e) => { e.stopPropagation(); onDeallocate(); }} className="w-5 h-5 rounded-full bg-orange-500/90 hover:bg-orange-500 flex items-center justify-center shadow-lg backdrop-blur border border-orange-400/30" title="Deallocate"><Unlock className="w-3 h-3 text-white" /></button>
        )}
      </div>
    </div>
  );
}

interface Property {
  id: string;
  name: string;
  roomTypes?: any[];
}

export default function AdminBookingTree() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [bedDetailOpen, setBedDetailOpen] = useState(false);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocateBedId, setAllocateBedId] = useState("");
  const [allocateBookingId, setAllocateBookingId] = useState("");
  const [allocateNotes, setAllocateNotes] = useState("");
  const [deallocateOpen, setDeallocateOpen] = useState(false);
  const [deallocateBedId, setDeallocateBedId] = useState("");
  const [deallocateNotes, setDeallocateNotes] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "3d">("3d");

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    queryFn: async () => {
      const r = await fetch("/api/properties");
      return r.json();
    },
  });

  const { data: treeData, isLoading: treeLoading } = useQuery({
    queryKey: ["/api/admin/properties", selectedPropertyId, "booking-tree"],
    queryFn: async () => {
      const r = await fetch(`/api/admin/properties/${selectedPropertyId}/booking-tree`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
    enabled: !!selectedPropertyId,
    refetchInterval: 30000,
  });

  const { data: bedDetails, isLoading: bedDetailsLoading } = useQuery({
    queryKey: ["/api/admin/beds", selectedBedId, "details"],
    queryFn: async () => {
      const r = await fetch(`/api/admin/beds/${selectedBedId}/details`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
    enabled: !!selectedBedId && bedDetailOpen,
  });

  const { data: unassignedBookings = [] } = useQuery({
    queryKey: ["/api/admin/properties", selectedPropertyId, "unassigned-bookings"],
    queryFn: async () => {
      const r = await fetch(`/api/admin/properties/${selectedPropertyId}/unassigned-bookings`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedPropertyId && allocateOpen,
  });

  const allocateMutation = useMutation({
    mutationFn: async ({ bedId, bookingId, notes }: { bedId: string; bookingId: string; notes: string }) => {
      const r = await fetch(`/api/admin/beds/${bedId}/allocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ bookingId, notes }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Failed to allocate");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Bed allocated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/properties", selectedPropertyId, "booking-tree"] });
      setAllocateOpen(false);
      setAllocateBedId("");
      setAllocateBookingId("");
      setAllocateNotes("");
    },
    onError: (err: Error) => {
      toast({ title: "Allocation failed", description: err.message, variant: "destructive" });
    },
  });

  const deallocateMutation = useMutation({
    mutationFn: async ({ bedId, notes }: { bedId: string; notes: string }) => {
      const r = await fetch(`/api/admin/beds/${bedId}/deallocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ notes }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Failed to deallocate");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Bed deallocated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/properties", selectedPropertyId, "booking-tree"] });
      setDeallocateOpen(false);
      setDeallocateBedId("");
      setDeallocateNotes("");
    },
    onError: (err: Error) => {
      toast({ title: "Deallocation failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleFloor = (id: string) => {
    setExpandedFloors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openBedDetail = (bedId: string) => {
    setSelectedBedId(bedId);
    setBedDetailOpen(true);
  };

  const floors = treeData?.floors || [];
  const stats = treeData?.stats || {};
  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  return (
    <div className="space-y-6" data-testid="admin-booking-tree">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight" data-testid="page-title">Booking Tree</h1>
          <p className="text-sm text-slate-500 mt-1">Property → Floor → Room → Bed with live booking status</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("3d")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "3d" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
              )}
              data-testid="toggle-3d-view"
            >
              <Box className="w-3.5 h-3.5" /> 3D View
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                viewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
              )}
              data-testid="toggle-list-view"
            >
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-full sm:w-80">
          <Select value={selectedPropertyId} onValueChange={(val) => {
            setSelectedPropertyId(val);
            setExpandedFloors(new Set());
          }}>
            <SelectTrigger className="bg-white" data-testid="select-property">
              <SelectValue placeholder="Select a property..." />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPropertyId && stats.totalBeds > 0 && (
          <div className="flex flex-wrap gap-2">
            <StatPill label="Total" value={stats.totalBeds} color="bg-slate-100 text-slate-700" />
            <StatPill label="Available" value={stats.available} color="bg-emerald-100 text-emerald-700" />
            <StatPill label="Occupied" value={stats.occupied} color="bg-rose-100 text-rose-700" />
            <StatPill label="Reserved" value={stats.reserved} color="bg-amber-100 text-amber-700" />
            <StatPill label="Blocked" value={stats.blocked} color="bg-red-100 text-red-700" />
            <StatPill label="With Booking" value={stats.withBooking} color="bg-blue-100 text-blue-700" />
          </div>
        )}
      </div>

      {!selectedPropertyId && (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 font-medium" data-testid="text-select-property">Select a property to view the booking tree</p>
            <p className="text-sm text-slate-400 mt-1">Choose from the dropdown above to see floors, rooms, beds and their booking status</p>
          </CardContent>
        </Card>
      )}

      {selectedPropertyId && treeLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="ml-3 text-slate-500">Loading booking tree...</span>
        </div>
      )}

      {selectedPropertyId && !treeLoading && floors.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500" data-testid="text-no-floors">No floors configured for this property</p>
            <p className="text-sm text-slate-400 mt-1">Go to Floors & Beds management to set up the property structure</p>
          </CardContent>
        </Card>
      )}

      {selectedPropertyId && !treeLoading && floors.length > 0 && viewMode === "3d" && (
        <Isometric3DView
          floors={floors}
          stats={stats}
          propertyName={selectedProperty?.name || "Property"}
          onBedClick={openBedDetail}
          onAllocate={(bedId) => { setAllocateBedId(bedId); setAllocateOpen(true); }}
          onDeallocate={(bedId) => { setDeallocateBedId(bedId); setDeallocateOpen(true); }}
        />
      )}

      {selectedPropertyId && !treeLoading && floors.length > 0 && viewMode === "list" && (
        <div className="space-y-4">
          {floors.map((floor: any) => {
            const isExpanded = expandedFloors.has(floor.id);
            const floorRooms = floor.rooms || [];
            const allBeds = [...(floor.beds || []), ...floorRooms.flatMap((r: any) => r.beds || [])];
            const availCount = allBeds.filter((b: any) => b.status === "available").length;
            const occupiedCount = allBeds.filter((b: any) => b.status === "occupied").length;
            const bookedCount = allBeds.filter((b: any) => b.currentBooking).length;
            const orphanBeds = (floor.beds || []).filter((b: any) => !b.roomId);

            return (
              <Card key={floor.id} className="overflow-hidden" data-testid={`tree-floor-${floor.id}`}>
                <button
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50/50 transition-colors"
                  onClick={() => toggleFloor(floor.id)}
                  data-testid={`toggle-floor-${floor.id}`}
                >
                  <div className="w-12 h-12 rounded-full border-2 border-amber-400 bg-amber-50 flex items-center justify-center text-lg font-bold text-amber-700">
                    {floor.floorNumber}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{floor.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {floorRooms.length} room{floorRooms.length !== 1 ? "s" : ""} ·{" "}
                      <span className="text-emerald-600 font-medium">{availCount} open</span> ·{" "}
                      <span className="text-rose-600 font-medium">{occupiedCount} occupied</span>
                      {bookedCount > 0 && <> · <span className="text-blue-600 font-medium">{bookedCount} booked</span></>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs px-2 py-1 ${availCount > 0 ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500"}`}>
                      {availCount} open
                    </Badge>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4 space-y-3">
                    {floorRooms.length === 0 && orphanBeds.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed rounded-lg">
                        No rooms on this floor
                      </div>
                    )}

                    {floorRooms.map((room: any) => (
                      <RoomCardTree
                        key={room.id}
                        room={room}
                        onBedClick={openBedDetail}
                        onAllocate={(bedId) => { setAllocateBedId(bedId); setAllocateOpen(true); }}
                        onDeallocate={(bedId) => { setDeallocateBedId(bedId); setDeallocateOpen(true); }}
                      />
                    ))}

                    {orphanBeds.length > 0 && (
                      <div className="border border-slate-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-500 mb-2">Unassigned Beds ({orphanBeds.length})</p>
                        <div className="flex gap-2 flex-wrap">
                          {orphanBeds.map((bed: any) => (
                            <BedCellTree key={bed.id} bed={bed} onBedClick={openBedDetail}
                              onAllocate={() => { setAllocateBedId(bed.id); setAllocateOpen(true); }}
                              onDeallocate={() => { setDeallocateBedId(bed.id); setDeallocateOpen(true); }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <BedDetailDrawer
        open={bedDetailOpen}
        onClose={() => { setBedDetailOpen(false); setSelectedBedId(null); }}
        bedDetails={bedDetails}
        loading={bedDetailsLoading}
        onAllocate={(bedId) => { setBedDetailOpen(false); setAllocateBedId(bedId); setAllocateOpen(true); }}
        onDeallocate={(bedId) => { setBedDetailOpen(false); setDeallocateBedId(bedId); setDeallocateOpen(true); }}
      />

      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Bed</DialogTitle>
            <DialogDescription>Assign a booking to this bed</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Booking</Label>
              <Select value={allocateBookingId} onValueChange={setAllocateBookingId}>
                <SelectTrigger data-testid="select-allocate-booking">
                  <SelectValue placeholder="Choose an unassigned booking..." />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {unassignedBookings.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500 text-center">No unassigned bookings</div>
                  ) : (
                    unassignedBookings.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        <span className="font-medium">{b.bookingCode || b.id.slice(0, 8)}</span>
                        <span className="text-slate-400 ml-2">·</span>
                        <span className="text-slate-500 ml-2">{b.walkInName || "Student"}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={allocateNotes} onChange={(e) => setAllocateNotes(e.target.value)} placeholder="Add allocation notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateOpen(false)}>Cancel</Button>
            <Button onClick={() => allocateMutation.mutate({ bedId: allocateBedId, bookingId: allocateBookingId, notes: allocateNotes })}
              disabled={!allocateBookingId || allocateMutation.isPending}
              data-testid="button-confirm-allocate"
            >
              {allocateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Allocate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deallocateOpen} onOpenChange={setDeallocateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deallocate Bed</DialogTitle>
            <DialogDescription>Free up this bed and remove booking assignment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <p className="text-sm text-amber-700 font-medium">This will set the bed back to "available"</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={deallocateNotes} onChange={(e) => setDeallocateNotes(e.target.value)} placeholder="Reason for deallocation..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeallocateOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deallocateMutation.mutate({ bedId: deallocateBedId, notes: deallocateNotes })}
              disabled={deallocateMutation.isPending}
              data-testid="button-confirm-deallocate"
            >
              {deallocateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Deallocate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Isometric3DView({ floors, stats, propertyName, onBedClick, onAllocate, onDeallocate }: {
  floors: any[];
  stats: any;
  propertyName: string;
  onBedClick: (bedId: string) => void;
  onAllocate: (bedId: string) => void;
  onDeallocate: (bedId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.85);
  const [hoveredBed, setHoveredBed] = useState<any>(null);
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });
  const [drillLevel, setDrillLevel] = useState<"building" | "floor" | "room">("building");
  const [activeFloorIdx, setActiveFloorIdx] = useState<number | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const [activityLog, setActivityLog] = useState<any[]>([]);

  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  useEffect(() => {
    const logs: any[] = [];
    floors.forEach(floor => {
      const allBeds = [...(floor.beds || []), ...(floor.rooms || []).flatMap((r: any) => r.beds || [])];
      allBeds.forEach(bed => {
        if (bed.currentBooking) {
          logs.push({
            bedNumber: bed.bedNumber,
            guest: bed.currentBooking.walkInName || bed.currentBooking.residentDetails?.residentName || "Guest",
            status: bed.status,
            floor: floor.name,
            time: bed.currentBooking.createdAt ? new Date(bed.currentBooking.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Recent",
          });
        }
      });
    });
    setActivityLog(logs.slice(0, 8));
  }, [floors]);

  const sortedFloors = useMemo(() =>
    [...floors].sort((a, b) => a.floorNumber - b.floorNumber), [floors]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width - 0.5;
    const cy = (e.clientY - rect.top) / rect.height - 0.5;
    setParallax({ x: cx * 8, y: cy * 5 });
  }, []);

  const handleBedHover = useCallback((bed: any, e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) { setHoveredPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); }
    setHoveredBed(bed);
  }, []);

  const drillToFloor = (idx: number) => {
    setActiveFloorIdx(idx);
    setActiveRoomId(null);
    setDrillLevel("floor");
    setZoom(1.1);
  };

  const drillToRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setDrillLevel("room");
    setZoom(1.3);
  };

  const navigateBack = () => {
    if (drillLevel === "room") {
      setActiveRoomId(null);
      setDrillLevel("floor");
      setZoom(1.1);
    } else if (drillLevel === "floor") {
      setActiveFloorIdx(null);
      setDrillLevel("building");
      setZoom(0.85);
    }
  };

  const navigateHome = () => {
    setActiveFloorIdx(null);
    setActiveRoomId(null);
    setDrillLevel("building");
    setZoom(0.85);
  };

  const toggleFullscreen = useCallback(() => {
    if (!outerRef.current) return;
    if (!document.fullscreenElement) {
      outerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const activeFloor = activeFloorIdx !== null ? sortedFloors[activeFloorIdx] : null;
  const activeRoom = activeFloor?.rooms?.find((r: any) => r.id === activeRoomId) || null;

  const breadcrumbs = useMemo(() => {
    const bc: { label: string; action: () => void }[] = [{ label: propertyName, action: navigateHome }];
    if (activeFloor) bc.push({ label: activeFloor.name || `Floor ${activeFloor.floorNumber}`, action: () => { setActiveRoomId(null); setDrillLevel("floor"); setZoom(1.1); } });
    if (activeRoom) bc.push({ label: `Room ${activeRoom.roomNumber}`, action: () => {} });
    return bc;
  }, [propertyName, activeFloor, activeRoom]);

  return (
    <div ref={outerRef} className={cn("relative rounded-2xl overflow-hidden transition-all duration-500", isFullscreen && "rounded-none")} style={{ background: "linear-gradient(135deg, #060a14 0%, #0c1222 30%, #0a0f1e 60%, #080d18 100%)" }} data-testid="iso-3d-container">
      <SharedCharDefs />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="iso-ambient-orb absolute top-[15%] left-[8%] w-[500px] h-[500px] bg-cyan-500/[0.04] rounded-full blur-[100px]" />
        <div className="iso-ambient-orb absolute bottom-[5%] right-[12%] w-[400px] h-[400px] bg-indigo-500/[0.04] rounded-full blur-[100px]" style={{ animationDelay: "3s" }} />
        <div className="iso-ambient-orb absolute top-[50%] left-[50%] w-[300px] h-[300px] bg-amber-500/[0.03] rounded-full blur-[80px]" style={{ animationDelay: "6s" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.025) 1px, transparent 0)", backgroundSize: "48px 48px" }} />
        <div className="iso-scanline absolute inset-0 pointer-events-none" />
      </div>

      <div className="relative p-4 sm:p-6" style={{ minHeight: isFullscreen ? "100vh" : "700px" }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 iso-logo-pulse">
                <span className="text-sm font-black text-white">H²</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0c1222] iso-status-dot" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {breadcrumbs.map((bc, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-white/20" />}
                    <button onClick={bc.action} className={cn("text-sm font-semibold transition-colors", i === breadcrumbs.length - 1 ? "text-white cursor-default" : "text-white/50 hover:text-white/80")}>{bc.label}</button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 font-medium tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block iso-status-dot" />
                Live · {stats.totalBeds || 0} beds monitored
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {drillLevel !== "building" && (
              <button onClick={navigateBack} className="iso-ctrl-btn" data-testid="btn-back" aria-label="Go back">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {drillLevel !== "building" && (
              <button onClick={navigateHome} className="iso-ctrl-btn" data-testid="btn-home" aria-label="Go to building view">
                <Home className="w-4 h-4" />
              </button>
            )}
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} className="iso-ctrl-btn" data-testid="btn-zoom-out" aria-label="Zoom out"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-[10px] text-white/30 font-mono min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2.0, z + 0.15))} className="iso-ctrl-btn" data-testid="btn-zoom-in" aria-label="Zoom in"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={() => { setZoom(drillLevel === "building" ? 0.85 : drillLevel === "floor" ? 1.1 : 1.3); }} className="iso-ctrl-btn" data-testid="btn-zoom-reset" aria-label="Reset zoom"><RotateCcw className="w-4 h-4" /></button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button onClick={toggleFullscreen} className="iso-ctrl-btn" data-testid="btn-fullscreen" aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5">
          <div ref={containerRef} className="relative flex items-center justify-center overflow-hidden" style={{ minHeight: isFullscreen ? "calc(100vh - 140px)" : "600px" }} onMouseMove={handleMouseMove} onMouseLeave={() => setParallax({ x: 0, y: 0 })}>

            {hoveredBed && (
              <div className="absolute z-[100] pointer-events-none iso-hover-card-enter" style={{ left: Math.min(hoveredPos.x + 16, (containerRef.current?.clientWidth || 400) - 260), top: Math.max(hoveredPos.y - 100, 10) }}>
                <div className="relative overflow-hidden rounded-xl border border-white/10" style={{ background: "linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(8,12,24,0.98) 100%)", backdropFilter: "blur(24px)", minWidth: "240px" }}>
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: hoveredBed.status === "available" ? "linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)" : hoveredBed.status === "occupied" ? "linear-gradient(90deg, transparent, rgba(59,130,246,0.6), transparent)" : hoveredBed.status === "reserved" ? "linear-gradient(90deg, transparent, rgba(245,158,11,0.6), transparent)" : "linear-gradient(90deg, transparent, rgba(220,38,38,0.6), transparent)" }} />
                  <div className="p-3.5">
                    <div className="flex items-center gap-2.5 mb-3">
                      {hoveredBed.currentBooking && (hoveredBed.status === "occupied" || hoveredBed.status === "reserved") && (
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <BedCharacter3D gender={getGender(hoveredBed)} status={hoveredBed.status} size="sm" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm tracking-tight">{hoveredBed.bedNumber}</span>
                          <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                            hoveredBed.status === "available" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" :
                            hoveredBed.status === "occupied" ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" :
                            hoveredBed.status === "reserved" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" :
                            "bg-red-500/15 text-red-400 border border-red-500/30"
                          )}>{ISO_BED_GLOW[hoveredBed.status]?.label || hoveredBed.status}</span>
                        </div>
                      </div>
                      <div className={cn("w-2.5 h-2.5 rounded-full iso-status-dot", STATUS_COLORS[hoveredBed.status])} />
                    </div>
                    {hoveredBed.currentBooking && (
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-slate-500" />
                          <span className="text-white/90 font-medium">{hoveredBed.currentBooking.walkInName || hoveredBed.currentBooking.residentDetails?.residentName || "Guest"}</span>
                          {(hoveredBed.currentBooking.residentDetails?.gender || hoveredBed.currentBooking.gender) && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5 uppercase font-semibold">
                              {(hoveredBed.currentBooking.residentDetails?.gender || hoveredBed.currentBooking.gender || "").slice(0, 1)}
                            </span>
                          )}
                        </div>
                        {hoveredBed.currentBooking.bookingCode && (
                          <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3 text-slate-500" />
                            <span className="text-white/70 font-mono text-[10px]">{hoveredBed.currentBooking.bookingCode}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          {hoveredBed.currentBooking.checkInDate && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-emerald-500/70" />
                              <span className="text-white/60 text-[10px]">{hoveredBed.currentBooking.checkInDate}</span>
                            </div>
                          )}
                          {hoveredBed.currentBooking.checkOutDate && (
                            <div className="flex items-center gap-1.5">
                              <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
                              <span className="text-white/60 text-[10px]">{hoveredBed.currentBooking.checkOutDate}</span>
                            </div>
                          )}
                        </div>
                        {hoveredBed.currentBooking.totalFee && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-slate-500">Payment</span>
                              <span className={cn("text-[10px] font-semibold", hoveredBed.currentBooking.status === "confirmed" ? "text-emerald-400" : "text-amber-400")}>
                                {hoveredBed.currentBooking.status === "confirmed" ? "Paid" : "Pending"}
                              </span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: hoveredBed.currentBooking.status === "confirmed" ? "100%" : "40%", background: "linear-gradient(90deg, rgba(16,185,129,0.8), rgba(6,182,212,0.8))" }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {hoveredBed.status === "blocked" && hoveredBed.blockedReason && (
                      <p className="text-[10px] text-red-400/80 mt-1.5 flex items-center gap-1"><Ban className="w-3 h-3" /> {hoveredBed.blockedReason}</p>
                    )}
                    <p className="text-[8px] text-slate-600 mt-2.5 flex items-center gap-1"><Eye className="w-2.5 h-2.5" /> Click for details</p>
                  </div>
                </div>
              </div>
            )}

            <div className="transition-all duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]" style={{ transform: `scale(${zoom}) translate(${parallax.x}px, ${parallax.y}px)`, transformOrigin: "center center", opacity: mounted ? 1 : 0 }}>

              {drillLevel === "building" && (
                <div className="relative iso-building-enter" style={{ transform: "rotateX(55deg) rotateZ(-45deg)", transformStyle: "preserve-3d" }}>
                  <div className="absolute rounded-xl" style={{ width: `${Math.max(sortedFloors.length * 80 + 400, 440)}px`, height: `${Math.max(sortedFloors.length * 80 + 400, 440)}px`, background: "linear-gradient(135deg, rgba(15,23,42,0.6) 0%, rgba(30,41,59,0.2) 100%)", border: "1px solid rgba(255,255,255,0.04)", transform: "translateZ(-8px)", left: "-60px", top: "-40px", boxShadow: "0 0 80px rgba(0,0,0,0.6), inset 0 0 60px rgba(6,10,20,0.5)" }} />

                  {sortedFloors.map((floor, floorIdx) => {
                    const floorRooms = floor.rooms || [];
                    const allBeds = [...(floor.beds || []), ...floorRooms.flatMap((r: any) => r.beds || [])];
                    const availCount = allBeds.filter(b => b.status === "available").length;
                    const floorHeight = floorIdx * 120;

                    return (
                      <div key={floor.id} className="absolute iso-floor-enter cursor-pointer" style={{ transform: `translateZ(${floorHeight}px)`, transformStyle: "preserve-3d", animationDelay: `${floorIdx * 150}ms` }} onClick={() => drillToFloor(floorIdx)}>
                        <div className="relative rounded-xl overflow-hidden group iso-floor-hover" style={{ width: "360px", minHeight: "100px", background: "linear-gradient(135deg, rgba(20,30,52,0.95) 0%, rgba(12,18,34,0.92) 100%)", border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.04)", backdropFilter: "blur(20px)" }}>
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl iso-floor-edge" style={{ background: `linear-gradient(to bottom, rgba(251,191,36,0.8), rgba(251,191,36,0))` }} />

                          <div className="p-3">
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/25 flex items-center justify-center group-hover:from-amber-500/25 group-hover:to-amber-600/15 transition-all duration-500">
                                  <span className="text-xs font-black text-amber-400">F{floor.floorNumber}</span>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-white/90 leading-tight">{floor.name}</p>
                                  <p className="text-[9px] text-slate-500">{floorRooms.length} rooms · {allBeds.length} beds</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">{availCount} open</span>
                                <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-amber-400/60 group-hover:translate-x-0.5 transition-all duration-300" />
                              </div>
                            </div>

                            <div className="space-y-1.5 max-h-[200px] overflow-y-auto iso-scrollbar pr-1">
                              {(floor.beds || []).length > 0 && floorRooms.length === 0 && (
                                <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <BedDouble className="w-3 h-3 text-cyan-400/70" />
                                    <span className="text-[10px] font-medium text-slate-300">All Beds</span>
                                    <span className="text-[8px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-400/80 border border-cyan-500/20">{(floor.beds || []).length} beds</span>
                                  </div>
                                  <div className="flex gap-1 flex-wrap">
                                    {(floor.beds || []).slice(0, 24).map((bed: any) => {
                                      const bGlow = ISO_BED_GLOW[bed.status] || ISO_BED_GLOW.maintenance;
                                      return (
                                        <div key={bed.id} className={cn("w-4 h-4 rounded-sm border", bGlow.border, bed.status === "available" && "iso-pulse-green", bed.status === "occupied" && "iso-glow-blue")} style={{ background: `linear-gradient(135deg, ${bed.status === "available" ? "rgba(16,185,129,0.35), rgba(16,185,129,0.15)" : bed.status === "occupied" ? "rgba(59,130,246,0.35), rgba(59,130,246,0.15)" : bed.status === "reserved" ? "rgba(245,158,11,0.35), rgba(245,158,11,0.15)" : bed.status === "blocked" ? "rgba(220,38,38,0.35), rgba(220,38,38,0.15)" : "rgba(100,116,139,0.35), rgba(100,116,139,0.15)"})` }} />
                                      );
                                    })}
                                    {(floor.beds || []).length > 24 && <span className="text-[8px] text-slate-500 self-center ml-1">+{(floor.beds || []).length - 24}</span>}
                                  </div>
                                </div>
                              )}
                              {floorRooms.map((room: any) => {
                                const roomBeds = room.beds || [];
                                return (
                                  <div key={room.id} className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <DoorOpen className="w-3 h-3 text-indigo-400/70" />
                                      <span className="text-[10px] font-medium text-slate-300">{room.roomNumber}</span>
                                      {room.typology && <span className="text-[8px] px-1 py-0.5 rounded bg-indigo-500/10 text-indigo-400/80 border border-indigo-500/20">{room.typology}</span>}
                                    </div>
                                    <div className="flex gap-1.5 flex-wrap">
                                      {roomBeds.map((bed: any) => {
                                        const bGlow = ISO_BED_GLOW[bed.status] || ISO_BED_GLOW.maintenance;
                                        const hasBooking = !!bed.currentBooking;
                                        const showChar = hasBooking && (bed.status === "occupied" || bed.status === "reserved");
                                        const gender = getGender(bed);
                                        return (
                                          <div key={bed.id} className="relative group/bed">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); onBedClick(bed.id); }}
                                              onMouseEnter={(e) => handleBedHover(bed, e)}
                                              onMouseLeave={() => setHoveredBed(null)}
                                              className={cn("relative rounded-lg transition-all duration-300 cursor-pointer border hover:scale-110 hover:z-10 overflow-hidden", bGlow.border, hasBooking && "iso-bed-glow-active")}
                                              style={{
                                                width: "52px", height: "46px",
                                                background: `linear-gradient(145deg, ${bed.status === "available" ? "rgba(16,185,129,0.15), rgba(16,185,129,0.06)" : bed.status === "occupied" ? "rgba(59,130,246,0.15), rgba(59,130,246,0.06)" : bed.status === "reserved" ? "rgba(245,158,11,0.15), rgba(245,158,11,0.06)" : bed.status === "blocked" ? "rgba(220,38,38,0.15), rgba(220,38,38,0.06)" : "rgba(100,116,139,0.15), rgba(100,116,139,0.06)"})`
                                              }}
                                              data-testid={`iso-bed-${bed.id}`}
                                            >
                                              {showChar ? (
                                                <div className="flex flex-col items-center justify-center h-full">
                                                  <BedCharacter3D gender={gender} status={bed.status} size="sm" />
                                                  <span className={cn("text-[5px] font-bold leading-none mt-[-2px]", bGlow.text)}>{bed.bedNumber.length > 5 ? bed.bedNumber.slice(-4) : bed.bedNumber}</span>
                                                </div>
                                              ) : (
                                                <div className="flex flex-col items-center justify-center h-full px-0.5">
                                                  {bed.status === "blocked" ? <Ban className="w-3 h-3 text-red-400/60 iso-blocked-pulse" /> : bed.status === "available" ? <BedDouble className="w-3.5 h-3.5 text-emerald-400/50" /> : <BedDouble className={cn("w-3 h-3", bGlow.text)} />}
                                                  <span className={cn("text-[6px] font-semibold leading-tight truncate max-w-full mt-0.5", bGlow.text)}>{bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}</span>
                                                </div>
                                              )}
                                              {showChar && (
                                                <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: bed.status === "reserved" ? "linear-gradient(90deg, transparent, rgba(245,158,11,0.6), transparent)" : "linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)" }} />
                                              )}
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 h-[4px]" style={{ background: "linear-gradient(90deg, rgba(251,191,36,0.3), rgba(251,191,36,0.08), rgba(251,191,36,0.3))" }} />
                        </div>

                        <div className="absolute top-0 rounded-r-lg" style={{ left: "100%", width: "8px", height: "100%", background: "linear-gradient(180deg, rgba(20,30,52,0.6) 0%, rgba(10,15,28,0.8) 100%)", borderRight: "1px solid rgba(255,255,255,0.03)", transform: "rotateY(90deg)", transformOrigin: "left" }} />
                        <div className="absolute bottom-0 left-0 right-0 h-[8px] rounded-b-lg" style={{ background: "linear-gradient(135deg, rgba(15,23,42,0.6) 0%, rgba(10,15,28,0.8) 100%)", borderBottom: "1px solid rgba(255,255,255,0.03)", transform: "rotateX(90deg)", transformOrigin: "bottom" }} />
                      </div>
                    );
                  })}

                  <div className="absolute" style={{ transform: `translateZ(${sortedFloors.length * 120 + 15}px)`, transformStyle: "preserve-3d" }}>
                    <div className="relative" style={{ width: "360px" }}>
                      <div className="rounded-t-xl overflow-hidden" style={{ height: "55px", background: "linear-gradient(135deg, rgba(20,30,52,0.95) 0%, rgba(12,18,34,0.92) 100%)", border: "1px solid rgba(251,191,36,0.25)", borderBottom: "none" }}>
                        <div className="flex items-center justify-center h-full gap-3 px-5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 iso-logo-pulse">
                            <span className="text-[11px] font-black text-white">H²</span>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-white tracking-wider uppercase">{propertyName.length > 22 ? propertyName.slice(0, 22) + "…" : propertyName}</p>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-[2px] bg-gradient-to-r from-amber-500 to-transparent" />
                              <span className="text-[7px] text-amber-400/50 uppercase tracking-[0.2em]">Roof Garden</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="h-[2px] iso-neon-line" />
                    </div>
                  </div>
                </div>
              )}

              {drillLevel === "floor" && activeFloor && (
                <div className="iso-drill-enter w-full max-w-3xl mx-auto">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
                      <span className="text-sm font-black text-amber-400">F{activeFloor.floorNumber}</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{activeFloor.name}</h3>
                      <p className="text-[10px] text-slate-500">
                        {(activeFloor.rooms || []).length > 0 ? `${(activeFloor.rooms || []).length} rooms · Click a room to expand beds` : `${(activeFloor.beds || []).length} beds · Click a bed for details`}
                      </p>
                    </div>
                  </div>

                  {(activeFloor.rooms || []).length === 0 && (activeFloor.beds || []).length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {(activeFloor.beds || []).map((bed: any, bIdx: number) => (
                          <div key={bed.id} className="iso-bed-card-enter" style={{ animationDelay: `${Math.min(bIdx, 20) * 30}ms` }}>
                            <BedScene3D
                              bed={bed} size="md"
                              onClick={() => onBedClick(bed.id)}
                              onHover={(e) => handleBedHover(bed, e)}
                              onLeave={() => setHoveredBed(null)}
                              onAllocate={() => onAllocate(bed.id)}
                              onDeallocate={() => onDeallocate(bed.id)}
                            />
                          </div>
                      ))}
                    </div>
                  )}

                  {(activeFloor.rooms || []).length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(activeFloor.rooms || []).map((room: any, rIdx: number) => {
                        const roomBeds = room.beds || [];
                        const avail = roomBeds.filter((b: any) => b.status === "available").length;
                        const occ = roomBeds.filter((b: any) => b.status === "occupied" || b.status === "reserved").length;
                        return (
                          <button key={room.id} onClick={() => drillToRoom(room.id)} className="iso-glass-card p-4 text-left group cursor-pointer iso-room-enter" style={{ animationDelay: `${rIdx * 80}ms` }} data-testid={`iso-room-card-${room.id}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <DoorOpen className="w-4 h-4 text-indigo-400/80" />
                                <span className="text-sm font-semibold text-white/90">Room {room.roomNumber}</span>
                                {room.typology && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400/70 border border-indigo-500/20 font-medium">{room.typology}</span>}
                              </div>
                              <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-amber-400/60 group-hover:translate-x-0.5 transition-all duration-300" />
                            </div>
                            <div className="flex gap-1.5 flex-wrap mb-3">
                              {roomBeds.slice(0, 8).map((bed: any) => (
                                <div key={bed.id} className={cn("w-5 h-5 rounded-md border iso-bed-mini", ISO_BED_GLOW[bed.status]?.border || "border-slate-500/30")} style={{ background: `linear-gradient(135deg, ${bed.status === "available" ? "rgba(16,185,129,0.3), rgba(16,185,129,0.15)" : bed.status === "occupied" ? "rgba(59,130,246,0.3), rgba(59,130,246,0.15)" : bed.status === "reserved" ? "rgba(245,158,11,0.3), rgba(245,158,11,0.15)" : bed.status === "blocked" ? "rgba(220,38,38,0.3), rgba(220,38,38,0.15)" : "rgba(100,116,139,0.3), rgba(100,116,139,0.15)"})` }} />
                              ))}
                              {roomBeds.length > 8 && <span className="text-[9px] text-slate-500 self-center">+{roomBeds.length - 8}</span>}
                            </div>
                            <div className="flex gap-2">
                              <span className="text-[9px] text-emerald-400/80 font-medium">{avail} available</span>
                              <span className="text-[9px] text-slate-600">·</span>
                              <span className="text-[9px] text-blue-400/80 font-medium">{occ} booked</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {drillLevel === "room" && activeRoom && (
                <div className="iso-drill-enter w-full max-w-3xl mx-auto">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 border border-indigo-500/30 flex items-center justify-center">
                      <DoorOpen className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        Room {activeRoom.roomNumber}
                        {activeRoom.typology && <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400/80 border border-indigo-500/20 font-semibold">{activeRoom.typology}</span>}
                      </h3>
                      <p className="text-[10px] text-slate-500">{(activeRoom.beds || []).length} beds · {activeFloor?.name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {(activeRoom.beds || []).map((bed: any, bIdx: number) => (
                        <div key={bed.id} className="iso-bed-card-enter" style={{ animationDelay: `${bIdx * 60}ms` }}>
                          <BedScene3D
                            bed={bed} size="lg"
                            onClick={() => onBedClick(bed.id)}
                            onHover={(e) => handleBedHover(bed, e)}
                            onLeave={() => setHoveredBed(null)}
                            onAllocate={() => onAllocate(bed.id)}
                            onDeallocate={() => onDeallocate(bed.id)}
                          />
                        </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {drillLevel === "building" && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 space-y-1.5">
                {sortedFloors.map((floor, idx) => {
                  const floorRooms = floor.rooms || [];
                  const allBeds = [...(floor.beds || []), ...floorRooms.flatMap((r: any) => r.beds || [])];
                  const pct = allBeds.length ? Math.round((allBeds.filter(b => b.status === "available").length / allBeds.length) * 100) : 0;
                  return (
                    <button key={floor.id} onClick={() => drillToFloor(idx)} className="iso-glass-card flex items-center gap-2 px-2.5 py-1.5 min-w-[130px] text-left group" data-testid={`iso-floor-btn-${floor.id}`}>
                      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover:text-amber-400 group-hover:bg-amber-500/10 transition-all">F{floor.floorNumber}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-medium text-white/70 truncate">{floor.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex-1 h-[3px] bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[7px] text-slate-600 font-mono">{pct}%</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="iso-glass-card p-4">
              <h3 className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] mb-3 flex items-center gap-2"><LayoutGrid className="w-3.5 h-3.5 text-amber-400/70" /> Overview</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total", value: stats.totalBeds || 0, color: "text-white", glow: "from-slate-500/10 to-slate-600/5", border: "border-slate-500/15" },
                  { label: "Open", value: stats.available || 0, color: "text-emerald-400", glow: "from-emerald-500/10 to-emerald-600/5", border: "border-emerald-500/15" },
                  { label: "Booked", value: stats.occupied || 0, color: "text-blue-400", glow: "from-blue-500/10 to-blue-600/5", border: "border-blue-500/15" },
                  { label: "Blocked", value: stats.blocked || 0, color: "text-red-400", glow: "from-red-500/10 to-red-600/5", border: "border-red-500/15" },
                ].map(item => (
                  <div key={item.label} className={cn("rounded-lg p-2 bg-gradient-to-br border", item.glow, item.border)}>
                    <p className="text-[8px] text-slate-500 uppercase tracking-wider">{item.label}</p>
                    <p className={cn("text-xl font-black", item.color)}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="iso-glass-card p-4">
              <h3 className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] mb-3 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-cyan-400/70" /> Status Legend</h3>
              <div className="space-y-2.5">
                {Object.entries(ISO_BED_GLOW).map(([status, style]) => (
                  <div key={status} className="flex items-center gap-2.5">
                    {(status === "occupied" || status === "reserved") ? (
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <BedCharacter3D gender={status === "occupied" ? "male" : "female"} status={status} size="sm" />
                      </div>
                    ) : (
                      <div className={cn("w-7 h-7 rounded-lg border flex items-center justify-center", style.border, status === "available" && "iso-pulse-green", status === "blocked" && "iso-warn-red")} style={{ background: `linear-gradient(135deg, ${status === "available" ? "rgba(16,185,129,0.2), rgba(16,185,129,0.08)" : status === "blocked" ? "rgba(220,38,38,0.2), rgba(220,38,38,0.08)" : "rgba(100,116,139,0.2), rgba(100,116,139,0.08)"})` }}>
                        {status === "available" && <BedDouble className="w-3.5 h-3.5 text-emerald-400/60" />}
                        {status === "blocked" && <Ban className="w-3.5 h-3.5 text-red-400/60" />}
                        {status === "maintenance" && <AlertTriangle className="w-3.5 h-3.5 text-slate-400/60" />}
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] text-slate-300 font-medium block">{style.label}</span>
                      <span className="text-[8px] text-slate-600">{status === "available" ? "Empty bed, green glow" : status === "occupied" ? "Character + blue light" : status === "reserved" ? "Character + gold aura" : status === "blocked" ? "Red warning" : "Under repair"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="iso-glass-card p-4">
              <h3 className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] mb-3 flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-indigo-400/70" /> Activity</h3>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto iso-scrollbar">
                {activityLog.length === 0 ? (
                  <p className="text-[10px] text-slate-600 text-center py-4">No recent activity</p>
                ) : (
                  activityLog.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 py-1 border-b border-white/[0.03] last:border-0">
                      <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", log.status === "available" ? "bg-emerald-500" : log.status === "occupied" ? "bg-blue-500" : log.status === "reserved" ? "bg-amber-500" : "bg-red-500")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-white/70 font-medium truncate"><span className="text-amber-400/70">{log.bedNumber}</span> · {log.guest}</p>
                        <p className="text-[8px] text-slate-600">{log.floor} · {log.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .iso-ctrl-btn {
          width: 32px; height: 32px; border-radius: 10px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.4); transition: all 0.3s cubic-bezier(0.25,0.46,0.45,0.94);
        }
        .iso-ctrl-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); border-color: rgba(255,255,255,0.15); transform: translateY(-1px); }

        .iso-glass-card {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; backdrop-filter: blur(20px);
          transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94);
        }
        .iso-glass-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }

        .iso-mini-badge {
          font-size: 9px; padding: 1px 6px; border-radius: 6px; font-weight: 700;
          border: 1px solid; line-height: 1.4;
        }

        .iso-neon-line {
          background: linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.5) 30%, rgba(6,182,212,0.4) 70%, transparent 100%);
          animation: neonSweep 4s ease-in-out infinite;
        }
        @keyframes neonSweep {
          0%, 100% { opacity: 0.5; } 50% { opacity: 1; }
        }

        @keyframes ambientFloat { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(20px, -15px) scale(1.05); } }
        .iso-ambient-orb { animation: ambientFloat 12s ease-in-out infinite; }

        .iso-scanline { background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.003) 2px, rgba(255,255,255,0.003) 4px); }

        @keyframes buildingEnter { from { opacity: 0; transform: rotateX(55deg) rotateZ(-45deg) scale(0.85) translateY(40px); } to { opacity: 1; transform: rotateX(55deg) rotateZ(-45deg) scale(1) translateY(0); } }
        .iso-building-enter { animation: buildingEnter 0.8s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }

        @keyframes floorEnter { from { opacity: 0; transform: translateZ(var(--tz, 0)) translateY(20px); } to { opacity: 1; transform: translateZ(var(--tz, 0)) translateY(0); } }
        .iso-floor-enter { animation: floorEnter 0.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards; opacity: 0; }
        .iso-floor-hover { transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94); }
        .iso-floor-hover:hover { box-shadow: 0 8px 40px rgba(251,191,36,0.15), 0 0 1px rgba(251,191,36,0.3), inset 0 1px 0 rgba(255,255,255,0.06) !important; border-color: rgba(251,191,36,0.25) !important; transform: translateY(-2px); }
        .iso-floor-edge { transition: all 0.4s; }
        .iso-floor-hover:hover .iso-floor-edge { box-shadow: 0 0 12px rgba(251,191,36,0.3); }

        @keyframes drillEnter { from { opacity: 0; transform: scale(0.92) translateY(24px); filter: blur(4px); } to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); } }
        .iso-drill-enter { animation: drillEnter 0.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }

        @keyframes roomEnter { from { opacity: 0; transform: translateY(16px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .iso-room-enter { animation: roomEnter 0.5s cubic-bezier(0.25,0.46,0.45,0.94) forwards; opacity: 0; }

        @keyframes bedCardEnter { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .iso-bed-card-enter { animation: bedCardEnter 0.4s cubic-bezier(0.25,0.46,0.45,0.94) forwards; opacity: 0; }

        @keyframes hoverCardEnter { from { opacity: 0; transform: translateY(8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .iso-hover-card-enter { animation: hoverCardEnter 0.2s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }

        @keyframes pulseGreen { 0%, 100% { box-shadow: 0 0 4px rgba(16,185,129,0.3); } 50% { box-shadow: 0 0 12px rgba(16,185,129,0.6); } }
        .iso-pulse-green { animation: pulseGreen 2.5s ease-in-out infinite; }

        @keyframes glowBlue { 0%, 100% { box-shadow: 0 0 6px rgba(59,130,246,0.4); } }
        .iso-glow-blue { box-shadow: 0 0 8px rgba(59,130,246,0.5); }

        @keyframes shineGold { 0% { box-shadow: 0 0 4px rgba(245,158,11,0.3); } 50% { box-shadow: 0 0 14px rgba(245,158,11,0.6); } 100% { box-shadow: 0 0 4px rgba(245,158,11,0.3); } }
        .iso-shine-gold { animation: shineGold 3s ease-in-out infinite; }

        @keyframes warnRed { 0%, 100% { box-shadow: 0 0 4px rgba(220,38,38,0.3); } 50% { box-shadow: 0 0 10px rgba(220,38,38,0.5); } }
        .iso-warn-red { animation: warnRed 2s ease-in-out infinite; }

        @keyframes floatLabel { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        .iso-float-label { animation: floatLabel 4s ease-in-out infinite; }

        @keyframes bedGlowPulse { 0%, 100% { box-shadow: 0 0 6px var(--bed-glow, rgba(59,130,246,0.2)); } 50% { box-shadow: 0 0 14px var(--bed-glow, rgba(59,130,246,0.4)); } }
        .iso-bed-glow-active { animation: bedGlowPulse 3s ease-in-out infinite; }

        .iso-bed-glow-occupied { box-shadow: 0 0 16px rgba(59,130,246,0.15); }
        .iso-bed-glow-reserved { box-shadow: 0 0 16px rgba(245,158,11,0.15); }
        .iso-bed-glow-blocked { box-shadow: 0 0 16px rgba(220,38,38,0.15); }

        @keyframes logoPulse { 0%, 100% { box-shadow: 0 0 15px rgba(251,191,36,0.2); } 50% { box-shadow: 0 0 25px rgba(251,191,36,0.4); } }
        .iso-logo-pulse { animation: logoPulse 4s ease-in-out infinite; }

        @keyframes statusDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .iso-status-dot { animation: statusDot 2s ease-in-out infinite; }

        .iso-scrollbar::-webkit-scrollbar { width: 2px; }
        .iso-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.01); }
        .iso-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }

        .iso-bed-mini { transition: all 0.3s; }
        .iso-bed-mini:hover { transform: scale(1.3); }

        /* 3D Character Animations */
        .iso-character-container { position: relative; display: flex; align-items: center; justify-content: center; }

        @keyframes charBreathe {
          0%, 100% { transform: scaleY(1) translateY(0); }
          40% { transform: scaleY(1.015) translateY(-0.3px); }
          70% { transform: scaleY(0.99) translateY(0.2px); }
        }
        .iso-character-breathe { animation: charBreathe 4s ease-in-out infinite; transform-origin: bottom center; }

        @keyframes charIdle {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(0.3px) rotate(0.3deg); }
          50% { transform: translateX(-0.2px) rotate(-0.2deg); }
          75% { transform: translateX(0.4px) rotate(0.15deg); }
        }
        .iso-character-idle { animation: charIdle 6s ease-in-out infinite; transform-origin: bottom center; }

        @keyframes auraPulse {
          0%, 100% { opacity: 0.4; rx: 14; ry: 3; }
          50% { opacity: 0.8; rx: 16; ry: 3.5; }
        }
        .iso-aura-pulse { animation: auraPulse 3s ease-in-out infinite; }

        @keyframes armPhoneMove {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(-3deg); }
          60% { transform: rotate(2deg); }
        }
        .iso-arm-left-phone { animation: armPhoneMove 5s ease-in-out infinite; transform-origin: top center; }

        @keyframes armRelax {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(0.5px); }
        }
        .iso-arm-right { animation: armRelax 4.5s ease-in-out infinite; }
        .iso-arm-left { animation: armRelax 5s ease-in-out infinite 0.5s; }

        @keyframes legShift {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(1deg); }
        }
        .iso-leg-right { animation: legShift 7s ease-in-out infinite; transform-origin: top center; }

        @keyframes phoneGlow {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; filter: brightness(1.3); }
        }
        .iso-phone { animation: phoneGlow 3s ease-in-out infinite; }

        /* Bed Scene Styles */
        .iso-bed-scene { transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94); }
        .iso-bed-scene:hover { transform: translateY(-3px) scale(1.03); }

        @keyframes availGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(16,185,129,0.15), inset 0 0 12px rgba(16,185,129,0.05); }
          50% { box-shadow: 0 0 16px rgba(16,185,129,0.3), inset 0 0 20px rgba(16,185,129,0.1); }
        }
        .iso-bed-avail-glow { animation: availGlow 3s ease-in-out infinite; }

        @keyframes bookedScene {
          0%, 100% { box-shadow: 0 0 10px rgba(59,130,246,0.15), 0 4px 20px rgba(59,130,246,0.08); }
          50% { box-shadow: 0 0 18px rgba(59,130,246,0.25), 0 4px 28px rgba(59,130,246,0.12); }
        }
        .iso-bed-booked-scene { animation: bookedScene 4s ease-in-out infinite; }

        @keyframes checkinScene {
          0%, 100% { box-shadow: 0 0 10px rgba(245,158,11,0.15), 0 4px 20px rgba(245,158,11,0.08); }
          50% { box-shadow: 0 0 20px rgba(245,158,11,0.3), 0 4px 30px rgba(245,158,11,0.15); }
        }
        .iso-bed-checkin-scene { animation: checkinScene 3.5s ease-in-out infinite; }

        @keyframes blockedPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .iso-blocked-pulse { animation: blockedPulse 2s ease-in-out infinite; }

        .iso-bed-blocked-scene { box-shadow: 0 0 12px rgba(220,38,38,0.15); }
        .iso-bed-blocked-scene:hover { box-shadow: 0 0 20px rgba(220,38,38,0.25); }

        @keyframes emptyBedFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .iso-empty-bed-icon { animation: emptyBedFloat 4s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .iso-character-breathe, .iso-character-idle, .iso-aura-pulse,
          .iso-arm-left-phone, .iso-arm-right, .iso-arm-left, .iso-leg-right,
          .iso-phone, .iso-bed-avail-glow, .iso-bed-booked-scene,
          .iso-bed-checkin-scene, .iso-blocked-pulse, .iso-empty-bed-icon,
          .iso-ambient-orb, .iso-scanline { animation: none !important; }
          .iso-bed-scene:hover { transform: none; }
          .iso-bed-mini:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${color}`} data-testid={`stat-${label.toLowerCase()}`}>
      {label}: <span className="font-bold">{value}</span>
    </div>
  );
}

function RoomCardTree({ room, onBedClick, onAllocate, onDeallocate }: {
  room: any;
  onBedClick: (bedId: string) => void;
  onAllocate: (bedId: string) => void;
  onDeallocate: (bedId: string) => void;
}) {
  const roomBeds = room.beds || [];
  const isCombo = room.typology?.includes("+");
  const allAvail = roomBeds.every((b: any) => b.status === "available");
  const allOccupied = roomBeds.every((b: any) => b.status === "occupied");
  const roomBorderColor = allOccupied ? "border-rose-200 bg-rose-50/30" : allAvail ? "border-emerald-200 bg-emerald-50/20" : "border-amber-200 bg-amber-50/20";
  const roomType = room.roomType;

  const sections = isCombo ? room.typology.split("+").map((p: string, i: number) => ({
    label: String.fromCharCode(65 + i),
    bedCount: parseInt(p),
    beds: roomBeds.filter((b: any) => b.bedNumber.includes(`${room.roomNumber}${String.fromCharCode(65 + i)}`)),
  })) : null;

  return (
    <div className={cn("border rounded-lg p-3 transition-colors", roomBorderColor)} data-testid={`tree-room-${room.id}`}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <DoorOpen className="w-4 h-4 text-indigo-600" />
        <span className="font-semibold text-sm text-slate-800">Room {room.roomNumber}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{room.typology}</Badge>
        {roomType && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{roomType.customName || roomType.name}</Badge>}
        {room.hasSharedWashroom && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 gap-0.5">
            <Bath className="w-2.5 h-2.5" />Shared WC
          </Badge>
        )}
      </div>

      {isCombo && sections ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sections.map((section: any) => (
            <div key={section.label} className="bg-white/80 rounded border border-slate-200 p-2">
              <p className="text-[10px] font-medium text-slate-500 mb-1.5">
                {room.roomNumber}{section.label} — {section.bedCount} bed{section.bedCount > 1 ? "s" : ""}
              </p>
              <div className="flex gap-2 flex-wrap">
                {section.beds.map((bed: any) => (
                  <BedCellTree key={bed.id} bed={bed} onBedClick={onBedClick} onAllocate={() => onAllocate(bed.id)} onDeallocate={() => onDeallocate(bed.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {roomBeds.map((bed: any) => (
            <BedCellTree key={bed.id} bed={bed} onBedClick={onBedClick} onAllocate={() => onAllocate(bed.id)} onDeallocate={() => onDeallocate(bed.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function BedCellTree({ bed, onBedClick, onAllocate, onDeallocate }: {
  bed: any;
  onBedClick: (bedId: string) => void;
  onAllocate: () => void;
  onDeallocate: () => void;
}) {
  const hasBooking = !!bed.currentBooking;
  const isBlocked = bed.status === "blocked";
  const isAvailable = bed.status === "available";
  const isOccupied = bed.status === "occupied";

  const booking = bed.currentBooking;
  const guestName = booking?.walkInName || booking?.residentDetails?.residentName || "Guest";
  const bookingCode = booking?.bookingCode || "";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onBedClick(bed.id)}
            className={cn(
              "rounded-lg flex flex-col items-center justify-center text-white text-xs font-medium transition-all hover:scale-105 cursor-pointer relative group",
              "w-16 h-16",
              STATUS_COLORS[bed.status],
              hasBooking && "ring-2 ring-blue-400 ring-offset-1"
            )}
            data-testid={`tree-bed-${bed.id}`}
          >
            {isBlocked ? <Ban className="w-4 h-4 mb-0.5" /> : <BedDouble className="w-4 h-4 mb-0.5" />}
            <span className="text-[9px] leading-tight truncate max-w-full px-0.5">{bed.bedNumber}</span>
            {hasBooking && (
              <span className="text-[7px] bg-blue-600 px-1 rounded absolute -bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap">{bookingCode.slice(-6) || "Booked"}</span>
            )}
            {isBlocked && (
              <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-red-800 text-[7px] text-white px-1 rounded whitespace-nowrap">BLOCKED</span>
            )}

            <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
              {isAvailable && !hasBooking && (
                <button onClick={(e) => { e.stopPropagation(); onAllocate(); }}
                  className="w-4 h-4 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center"
                  title="Allocate booking" aria-label="Allocate booking to this bed"
                >
                  <Link2 className="w-2.5 h-2.5 text-white" />
                </button>
              )}
              {isOccupied && hasBooking && (
                <button onClick={(e) => { e.stopPropagation(); onDeallocate(); }}
                  className="w-4 h-4 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center"
                  title="Deallocate" aria-label="Deallocate booking from this bed"
                >
                  <Unlock className="w-2.5 h-2.5 text-white" />
                </button>
              )}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-60">
          <p className="font-semibold">{bed.bedNumber} — {bed.status}</p>
          {hasBooking && (
            <div className="text-xs mt-1 space-y-0.5">
              <p><span className="font-medium">Guest:</span> {guestName}</p>
              <p><span className="font-medium">Booking:</span> {bookingCode}</p>
              <p><span className="font-medium">Status:</span> {booking.status}</p>
            </div>
          )}
          {isBlocked && bed.blockedReason && <p className="text-xs mt-1">Reason: {bed.blockedReason}</p>}
          <p className="text-[10px] text-slate-400 mt-1">Click for full details</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BedDetailDrawer({ open, onClose, bedDetails, loading, onAllocate, onDeallocate }: {
  open: boolean;
  onClose: () => void;
  bedDetails: any;
  loading: boolean;
  onAllocate: (bedId: string) => void;
  onDeallocate: (bedId: string) => void;
}) {
  if (!open) return null;

  const bed = bedDetails?.bed;
  const guest = bedDetails?.guestDetails;
  const activeBooking = bedDetails?.activeBooking;
  const bookingHistory = bedDetails?.bookingHistory || [];
  const allocations = bedDetails?.allocations || [];
  const blockLogs = bedDetails?.blockLogs || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-indigo-600" />
            Bed Details — {bed?.bedNumber || "Loading..."}
          </DialogTitle>
          <DialogDescription>Full booking history, guest details, and activity timeline</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-slate-500">Loading bed details...</span>
          </div>
        ) : bed ? (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-5 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoCard icon={<Layers className="w-4 h-4 text-amber-600" />} label="Floor" value={bed.floor?.name || "N/A"} />
                <InfoCard icon={<DoorOpen className="w-4 h-4 text-indigo-600" />} label="Room" value={bed.room?.roomNumber || "Unassigned"} />
                <InfoCard icon={<Building2 className="w-4 h-4 text-slate-600" />} label="Property" value={bed.property?.name || "N/A"} />
                <InfoCard icon={<Shield className="w-4 h-4 text-slate-600" />} label="Status"
                  value={<Badge className={cn("text-[10px]", STATUS_BG[bed.status])}>{bed.status}</Badge>}
                />
              </div>

              <div className="flex gap-2">
                {bed.status === "available" && !activeBooking && (
                  <Button size="sm" onClick={() => onAllocate(bed.id)} data-testid="button-allocate-from-detail">
                    <Link2 className="w-3 h-3 mr-1" />Allocate Booking
                  </Button>
                )}
                {bed.status === "occupied" && activeBooking && (
                  <Button size="sm" variant="outline" className="text-orange-600 border-orange-200" onClick={() => onDeallocate(bed.id)} data-testid="button-deallocate-from-detail">
                    <Unlock className="w-3 h-3 mr-1" />Deallocate
                  </Button>
                )}
              </div>

              {guest && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                      <User className="w-4 h-4" />Current Occupant
                    </h3>
                    <div className="p-3 bg-slate-50 rounded-lg border space-y-2">
                      <div className="flex items-center gap-3">
                        {guest.photo ? (
                          <img src={guest.photo} alt={guest.name} className="w-10 h-10 rounded-full object-cover border" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                            {guest.name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{guest.name}</p>
                          <p className="text-xs text-slate-500">{guest.type === "student" ? "Student" : guest.type === "lead" ? "Lead" : "Walk-in"}</p>
                        </div>
                      </div>
                      {guest.phone && <DetailRow icon={<Phone className="w-3 h-3" />} text={guest.phone} />}
                      {guest.email && <DetailRow icon={<Mail className="w-3 h-3" />} text={guest.email} />}
                      {guest.college && <DetailRow icon={<GraduationCap className="w-3 h-3" />} text={guest.college} />}
                    </div>
                  </div>
                </>
              )}

              {activeBooking && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4" />Active Booking
                    </h3>
                    <BookingCard booking={activeBooking} />
                  </div>
                </>
              )}

              {bookingHistory.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                      <History className="w-4 h-4" />Booking History ({bookingHistory.length})
                    </h3>
                    <div className="space-y-2">
                      {bookingHistory.map((b: any) => (
                        <BookingCard key={b.id} booking={b} compact />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {allocations.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4" />Allocation Timeline ({allocations.length})
                    </h3>
                    <div className="space-y-2">
                      {allocations.map((a: any) => (
                        <div key={a.id} className="flex items-start gap-3 text-xs p-2 bg-slate-50 rounded-lg border">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${a.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                          <div className="flex-1">
                            <p className="font-medium text-slate-700">{a.action === "allocate" ? "Allocated" : a.action === "deallocate" ? "Deallocated" : "Transferred"}</p>
                            <p className="text-slate-500">
                              {new Date(a.allocatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              {a.deallocatedAt && <> → {new Date(a.deallocatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</>}
                            </p>
                            {a.notes && <p className="text-slate-400 mt-0.5">{a.notes}</p>}
                            {a.allocatedBy && <p className="text-slate-400">By: {a.allocatedBy}</p>}
                          </div>
                          <Badge variant={a.isActive ? "default" : "secondary"} className="text-[10px]">
                            {a.isActive ? "Active" : "Past"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {blockLogs.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                      <Ban className="w-4 h-4" />Block/Unblock History ({blockLogs.length})
                    </h3>
                    <div className="space-y-2">
                      {blockLogs.map((log: any) => (
                        <div key={log.id} className="flex items-start gap-3 text-xs p-2 bg-slate-50 rounded-lg border">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${log.action === "block" ? "bg-red-500" : "bg-emerald-500"}`} />
                          <div className="flex-1">
                            <p className="font-medium text-slate-700">{log.action === "block" ? "Blocked" : "Unblocked"}</p>
                            {log.category && <p className="text-slate-500">Category: {log.category}</p>}
                            {log.reason && <p className="text-slate-500">Reason: {log.reason}</p>}
                            {log.note && <p className="text-slate-400">{log.note}</p>}
                            <p className="text-slate-400">{new Date(log.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BookingCard({ booking, compact }: { booking: any; compact?: boolean }) {
  const totalPaid = booking.totalPaid || booking.payments?.filter((p: any) => p.status === "success").reduce((s: number, p: any) => s + (p.amount || 0), 0) || 0;
  const totalDue = (booking.totalFee || 0) - totalPaid;
  const paidPercent = booking.totalFee ? Math.round((totalPaid / booking.totalFee) * 100) : 0;

  return (
    <div className={cn("p-3 rounded-lg border", compact ? "bg-white" : "bg-slate-50")} data-testid={`booking-card-${booking.id}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge className={cn("text-[10px]", BOOKING_STATUS_COLORS[booking.status] || "bg-slate-100 text-slate-700")}>
            {booking.status?.replace(/_/g, " ")}
          </Badge>
          <span className="font-mono text-xs font-semibold text-slate-600">{booking.bookingCode || booking.id.slice(0, 8)}</span>
        </div>
        <span className="text-[10px] text-slate-400">
          {new Date(booking.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          {booking.checkInDate && (
            <DetailRow icon={<Calendar className="w-3 h-3" />} text={`In: ${booking.checkInDate}`} />
          )}
          {booking.checkOutDate && (
            <DetailRow icon={<Calendar className="w-3 h-3" />} text={`Out: ${booking.checkOutDate}`} />
          )}
          <DetailRow icon={<IndianRupee className="w-3 h-3" />} text={`Total: ₹${(booking.totalFee || 0).toLocaleString()}`} />
          <DetailRow icon={<CreditCard className="w-3 h-3" />} text={`Paid: ₹${totalPaid.toLocaleString()}`} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(paidPercent, 100)}%` }} />
        </div>
        <span className={cn("text-[10px] font-medium", totalDue > 0 ? "text-amber-600" : "text-emerald-600")}>
          {paidPercent}% paid
        </span>
      </div>

      {!compact && booking.installments?.length > 0 && (
        <div className="mt-2 space-y-1">
          {booking.installments.map((inst: any) => (
            <div key={inst.id} className="flex items-center justify-between text-[10px] text-slate-500">
              <span>{inst.name}</span>
              <span className="flex items-center gap-1">
                ₹{(inst.amount || 0).toLocaleString()}
                {inst.paid ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Clock className="w-3 h-3 text-amber-400" />}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="p-2.5 bg-white rounded-lg border flex items-center gap-2">
      {icon}
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
        <div className="text-sm font-medium text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function DetailRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-slate-600">
      {icon}
      <span>{text}</span>
    </div>
  );
}
