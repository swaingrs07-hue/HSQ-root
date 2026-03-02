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
  ChevronLeft, Home, Plus, Check, Settings
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

const BED_STATUS_CFG: Record<string, { glow: string; border: string; bg: string; text: string; label: string; dotColor: string }> = {
  available: { glow: "0 0 18px rgba(16,185,129,0.5)", border: "rgba(16,185,129,0.5)", bg: "rgba(16,185,129,0.12)", text: "#34d399", label: "Available", dotColor: "#10b981" },
  occupied: { glow: "0 0 18px rgba(59,130,246,0.5)", border: "rgba(59,130,246,0.5)", bg: "rgba(59,130,246,0.12)", text: "#60a5fa", label: "Booked", dotColor: "#3b82f6" },
  reserved: { glow: "0 0 22px rgba(245,158,11,0.6)", border: "rgba(245,158,11,0.5)", bg: "rgba(245,158,11,0.15)", text: "#fbbf24", label: "Checked-in", dotColor: "#f59e0b" },
  maintenance: { glow: "0 0 12px rgba(100,116,139,0.3)", border: "rgba(100,116,139,0.3)", bg: "rgba(100,116,139,0.1)", text: "#94a3b8", label: "Maintenance", dotColor: "#64748b" },
  blocked: { glow: "0 0 18px rgba(220,38,38,0.5)", border: "rgba(220,38,38,0.5)", bg: "rgba(220,38,38,0.12)", text: "#f87171", label: "Blocked", dotColor: "#ef4444" },
};

function getGender(bed: any): "male" | "female" {
  const g = bed.currentBooking?.residentDetails?.gender || bed.currentBooking?.gender || "";
  return g.toLowerCase() === "female" ? "female" : "male";
}

function getGuestName(bed: any): string {
  return bed.currentBooking?.walkInName || bed.currentBooking?.residentDetails?.residentName || "";
}

function getCheckoutDate(bed: any): string {
  const d = bed.currentBooking?.checkOutDate;
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch { return d; }
}

const IsoBedSVG = React.memo(function IsoBedSVG({ status, w = 56, h = 28 }: { status: string; w?: number; h?: number }) {
  const cfg = BED_STATUS_CFG[status] || BED_STATUS_CFG.maintenance;
  return (
    <svg width={w} height={h} viewBox="0 0 56 28" fill="none" aria-hidden="true">
      <rect x="2" y="8" width="52" height="18" rx="3" fill="#1e293b" stroke={cfg.border} strokeWidth="1.2" />
      <rect x="4" y="3" width="22" height="10" rx="2" fill="#334155" />
      <rect x="6" y="5" width="18" height="6" rx="1.5" fill={cfg.bg} stroke={cfg.border} strokeWidth="0.5" />
      <rect x="4" y="12" width="48" height="12" rx="2" fill={cfg.bg} />
      <rect x="2" y="24" width="4" height="3" rx="1" fill="#475569" />
      <rect x="50" y="24" width="4" height="3" rx="1" fill="#475569" />
    </svg>
  );
});

const IsoCharacter = React.memo(function IsoCharacter({ gender, size = 32 }: { gender: "male" | "female"; size?: number }) {
  const isMale = gender === "male";
  const skin = "#D4A574";
  const hair = isMale ? "#2D1B0E" : "#1A0A00";
  const shirt = isMale ? "#3B82F6" : "#A855F7";
  const shirtDark = isMale ? "#2563EB" : "#9333EA";
  const pants = isMale ? "#1E293B" : "#374151";
  const r = size / 40;

  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 40 52" fill="none" className="iso-char-breathe" aria-hidden="true">
      <ellipse cx="20" cy="49" rx="10" ry="2.5" fill="rgba(0,0,0,0.25)" />
      <g className="iso-char-idle">
        <rect x="13" y="34" width="6" height="12" rx="2.5" fill={pants} />
        <rect x="21" y="34" width="6" height="12" rx="2.5" fill={pants} />
        <rect x="10" y="20" width="20" height="16" rx="4" fill={shirt} />
        <rect x="10" y="26" width="20" height="10" rx="3" fill={shirtDark} opacity="0.5" />
        <rect x="6" y="22" width="5" height="11" rx="2.5" fill={shirt} className={isMale ? "iso-arm-l" : "iso-arm-phone"} />
        <rect x="29" y="22" width="5" height="11" rx="2.5" fill={shirt} className="iso-arm-r" />
        {!isMale && <rect x="6.5" y="32" width="4" height="5.5" rx="1.5" fill="#1F2937" className="iso-phone-glow" />}
        <circle cx="20" cy="14" r="6.5" fill={skin} />
        <circle cx="17.5" cy="13.5" r="0.7" fill="#1A0A00" />
        <circle cx="22.5" cy="13.5" r="0.7" fill="#1A0A00" />
        <ellipse cx="20" cy="16" rx="1.2" ry="0.5" fill="#C49564" />
        {isMale ? (
          <path d="M13.5 12 Q13.5 7.5 20 6.5 Q26.5 7.5 26.5 12 L25.5 10.5 Q24.5 8 20 7.5 Q15.5 8 14.5 10.5 Z" fill={hair} />
        ) : (
          <>
            <path d="M13 12.5 Q13 7 20 6 Q27 7 27 12.5 L26 10 Q25 7.5 20 7 Q15 7.5 14 10 Z" fill={hair} />
            <path d="M13 12.5 Q12 16 12 20 L13.5 20 Q13.5 16 14 12.5 Z" fill={hair} />
            <path d="M27 12.5 Q28 16 28 20 L26.5 20 Q26.5 16 26 12.5 Z" fill={hair} />
          </>
        )}
      </g>
    </svg>
  );
});

interface Property { id: string; name: string; roomTypes?: any[]; }

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
    queryFn: async () => { const r = await fetch("/api/properties"); return r.json(); },
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
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || "Failed to allocate"); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Bed allocated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/properties", selectedPropertyId, "booking-tree"] });
      setAllocateOpen(false); setAllocateBedId(""); setAllocateBookingId(""); setAllocateNotes("");
    },
    onError: (err: Error) => { toast({ title: "Allocation failed", description: err.message, variant: "destructive" }); },
  });

  const deallocateMutation = useMutation({
    mutationFn: async ({ bedId, notes }: { bedId: string; notes: string }) => {
      const r = await fetch(`/api/admin/beds/${bedId}/deallocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ notes }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || "Failed to deallocate"); }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Bed deallocated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/properties", selectedPropertyId, "booking-tree"] });
      setDeallocateOpen(false); setDeallocateBedId(""); setDeallocateNotes("");
    },
    onError: (err: Error) => { toast({ title: "Deallocation failed", description: err.message, variant: "destructive" }); },
  });

  const toggleFloor = (id: string) => {
    setExpandedFloors(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const openBedDetail = (bedId: string) => { setSelectedBedId(bedId); setBedDetailOpen(true); };

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
            <button onClick={() => setViewMode("3d")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all", viewMode === "3d" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")} data-testid="toggle-3d-view">
              <Box className="w-3.5 h-3.5" /> 3D View
            </button>
            <button onClick={() => setViewMode("list")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all", viewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")} data-testid="toggle-list-view">
              <List className="w-3.5 h-3.5" /> List
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-full sm:w-80">
          <Select value={selectedPropertyId} onValueChange={(val) => { setSelectedPropertyId(val); setExpandedFloors(new Set()); }}>
            <SelectTrigger className="bg-white" data-testid="select-property"><SelectValue placeholder="Select a property..." /></SelectTrigger>
            <SelectContent>{properties.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
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
        <Card><CardContent className="py-16 text-center">
          <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium" data-testid="text-select-property">Select a property to view the booking tree</p>
          <p className="text-sm text-slate-400 mt-1">Choose from the dropdown above to see floors, rooms, beds and their booking status</p>
        </CardContent></Card>
      )}

      {selectedPropertyId && treeLoading && (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /><span className="ml-3 text-slate-500">Loading booking tree...</span></div>
      )}

      {selectedPropertyId && !treeLoading && floors.length === 0 && (
        <Card><CardContent className="py-12 text-center">
          <Layers className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500" data-testid="text-no-floors">No floors configured for this property</p>
          <p className="text-sm text-slate-400 mt-1">Go to Floors & Beds management to set up the property structure</p>
        </CardContent></Card>
      )}

      {selectedPropertyId && !treeLoading && floors.length > 0 && viewMode === "3d" && (
        <Isometric3DView
          floors={floors} stats={stats} propertyName={selectedProperty?.name || "Property"}
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
                <button className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50/50 transition-colors" onClick={() => toggleFloor(floor.id)} data-testid={`toggle-floor-${floor.id}`}>
                  <div className="w-12 h-12 rounded-full border-2 border-amber-400 bg-amber-50 flex items-center justify-center text-lg font-bold text-amber-700">{floor.floorNumber}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{floor.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{floorRooms.length} room{floorRooms.length !== 1 ? "s" : ""} · <span className="text-emerald-600 font-medium">{availCount} open</span> · <span className="text-rose-600 font-medium">{occupiedCount} occupied</span>{bookedCount > 0 && <> · <span className="text-blue-600 font-medium">{bookedCount} booked</span></>}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs px-2 py-1 ${availCount > 0 ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500"}`}>{availCount} open</Badge>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </button>
                {isExpanded && (
                  <CardContent className="pt-0 pb-4 space-y-3">
                    {floorRooms.length === 0 && orphanBeds.length === 0 && <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed rounded-lg">No rooms on this floor</div>}
                    {floorRooms.map((room: any) => (<RoomCardTree key={room.id} room={room} onBedClick={openBedDetail} onAllocate={(bedId) => { setAllocateBedId(bedId); setAllocateOpen(true); }} onDeallocate={(bedId) => { setDeallocateBedId(bedId); setDeallocateOpen(true); }} />))}
                    {orphanBeds.length > 0 && (
                      <div className="border border-slate-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-slate-500 mb-2">Unassigned Beds ({orphanBeds.length})</p>
                        <div className="flex gap-2 flex-wrap">{orphanBeds.map((bed: any) => (<BedCellTree key={bed.id} bed={bed} onBedClick={openBedDetail} onAllocate={() => { setAllocateBedId(bed.id); setAllocateOpen(true); }} onDeallocate={() => { setDeallocateBedId(bed.id); setDeallocateOpen(true); }} />))}</div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <BedDetailDrawer open={bedDetailOpen} onClose={() => { setBedDetailOpen(false); setSelectedBedId(null); }} bedDetails={bedDetails} loading={bedDetailsLoading} onAllocate={(bedId) => { setBedDetailOpen(false); setAllocateBedId(bedId); setAllocateOpen(true); }} onDeallocate={(bedId) => { setBedDetailOpen(false); setDeallocateBedId(bedId); setDeallocateOpen(true); }} />

      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Allocate Bed</DialogTitle><DialogDescription>Assign a booking to this bed</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Booking</Label>
              <Select value={allocateBookingId} onValueChange={setAllocateBookingId}>
                <SelectTrigger data-testid="select-allocate-booking"><SelectValue placeholder="Choose an unassigned booking..." /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {unassignedBookings.length === 0 ? <div className="p-3 text-sm text-slate-500 text-center">No unassigned bookings</div> : unassignedBookings.map((b: any) => (<SelectItem key={b.id} value={b.id}><span className="font-medium">{b.bookingCode || b.id.slice(0, 8)}</span><span className="text-slate-400 ml-2">·</span><span className="text-slate-500 ml-2">{b.walkInName || "Student"}</span></SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Notes (optional)</Label><Textarea value={allocateNotes} onChange={(e) => setAllocateNotes(e.target.value)} placeholder="Add allocation notes..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateOpen(false)}>Cancel</Button>
            <Button onClick={() => allocateMutation.mutate({ bedId: allocateBedId, bookingId: allocateBookingId, notes: allocateNotes })} disabled={!allocateBookingId || allocateMutation.isPending} data-testid="button-confirm-allocate">
              {allocateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Allocate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deallocateOpen} onOpenChange={setDeallocateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Deallocate Bed</DialogTitle><DialogDescription>Free up this bed and remove booking assignment</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /><p className="text-sm text-amber-700 font-medium">This will set the bed back to "available"</p></div></div>
            <div className="space-y-2"><Label>Notes (optional)</Label><Textarea value={deallocateNotes} onChange={(e) => setDeallocateNotes(e.target.value)} placeholder="Reason for deallocation..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeallocateOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deallocateMutation.mutate({ bedId: deallocateBedId, notes: deallocateNotes })} disabled={deallocateMutation.isPending} data-testid="button-confirm-deallocate">
              {deallocateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Deallocate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Isometric3DView({ floors, stats, propertyName, onBedClick, onAllocate, onDeallocate }: {
  floors: any[]; stats: any; propertyName: string;
  onBedClick: (bedId: string) => void; onAllocate: (bedId: string) => void; onDeallocate: (bedId: string) => void;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.85);
  const [hoveredBed, setHoveredBed] = useState<any>(null);
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });
  const [drillLevel, setDrillLevel] = useState<"building" | "floor">("building");
  const [activeFloorIdx, setActiveFloorIdx] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  const sortedFloors = useMemo(() => [...floors].sort((a, b) => a.floorNumber - b.floorNumber), [floors]);

  const handleBedHover = useCallback((bed: any, e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) { setHoveredPos({ x: e.clientX - rect.left, y: e.clientY - rect.top }); }
    setHoveredBed(bed);
  }, []);

  const drillToFloor = (idx: number) => { setActiveFloorIdx(idx); setDrillLevel("floor"); setZoom(1.0); };
  const navigateHome = () => { setActiveFloorIdx(null); setDrillLevel("building"); setZoom(0.85); };

  const toggleFullscreen = useCallback(() => {
    if (!outerRef.current) return;
    if (!document.fullscreenElement) outerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    else document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const activeFloor = activeFloorIdx !== null ? sortedFloors[activeFloorIdx] : null;
  const allFloorBeds = useMemo(() => {
    if (!activeFloor) return [];
    return [...(activeFloor.beds || []), ...(activeFloor.rooms || []).flatMap((r: any) => r.beds || [])];
  }, [activeFloor]);

  return (
    <div ref={outerRef} className={cn("relative rounded-2xl overflow-hidden transition-all duration-500", isFullscreen && "rounded-none")} style={{ background: "linear-gradient(145deg, #0a1628 0%, #0f1d32 40%, #0c1628 100%)" }} data-testid="iso-3d-container">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] right-[15%] w-[600px] h-[600px] bg-cyan-500/[0.03] rounded-full blur-[120px] iso-ambient-orb" />
        <div className="absolute bottom-[10%] left-[10%] w-[500px] h-[500px] bg-indigo-500/[0.03] rounded-full blur-[100px] iso-ambient-orb" style={{ animationDelay: "4s" }} />
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.018) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      </div>

      <div className="relative p-4 sm:p-6" style={{ minHeight: isFullscreen ? "100vh" : "700px" }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 iso-logo-pulse">
                <span className="text-sm font-black text-white">H²</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0c1628] iso-status-dot" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={navigateHome} className={cn("text-sm font-semibold transition-colors", drillLevel === "building" ? "text-white cursor-default" : "text-white/50 hover:text-white/80")}>{propertyName}</button>
                {activeFloor && <>
                  <ChevronRight className="w-3 h-3 text-white/20" />
                  <span className="text-sm font-semibold text-white">{activeFloor.name || `Floor ${activeFloor.floorNumber}`}</span>
                </>}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 font-medium tracking-wide uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block iso-status-dot" />
                Live · {stats.totalBeds || 0} beds · Real time analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {drillLevel === "floor" && (
              <button onClick={navigateHome} className="iso-ctrl-btn" data-testid="btn-back" aria-label="Go back to building view"><ChevronLeft className="w-4 h-4" /></button>
            )}
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button onClick={() => setZoom(z => Math.max(0.4, z - 0.15))} className="iso-ctrl-btn" data-testid="btn-zoom-out" aria-label="Zoom out"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-[10px] text-white/30 font-mono min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2.0, z + 0.15))} className="iso-ctrl-btn" data-testid="btn-zoom-in" aria-label="Zoom in"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={() => setZoom(drillLevel === "building" ? 0.85 : 1.0)} className="iso-ctrl-btn" data-testid="btn-zoom-reset" aria-label="Reset zoom"><RotateCcw className="w-4 h-4" /></button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button onClick={toggleFullscreen} className="iso-ctrl-btn" data-testid="btn-fullscreen" aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
          <div ref={containerRef} className="relative flex items-center justify-center overflow-hidden" style={{ minHeight: isFullscreen ? "calc(100vh - 140px)" : "600px" }}>

            {hoveredBed && (
              <div className="absolute z-[100] pointer-events-none iso-hover-enter" style={{ left: Math.min(hoveredPos.x + 16, (containerRef.current?.clientWidth || 400) - 280), top: Math.max(hoveredPos.y - 120, 10) }}>
                <div className="relative overflow-hidden rounded-xl border border-white/10" style={{ background: "linear-gradient(145deg, rgba(15,23,42,0.96), rgba(8,12,24,0.98))", backdropFilter: "blur(24px)", minWidth: "250px" }}>
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${BED_STATUS_CFG[hoveredBed.status]?.dotColor || "#64748b"}80, transparent)` }} />
                  <div className="p-3.5">
                    <div className="flex items-center gap-2.5 mb-2">
                      {hoveredBed.currentBooking && (hoveredBed.status === "occupied" || hoveredBed.status === "reserved") && (
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <IsoCharacter gender={getGender(hoveredBed)} size={24} />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">{hoveredBed.bedNumber}</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ background: `${BED_STATUS_CFG[hoveredBed.status]?.dotColor}20`, color: BED_STATUS_CFG[hoveredBed.status]?.text, border: `1px solid ${BED_STATUS_CFG[hoveredBed.status]?.dotColor}40` }}>
                            {BED_STATUS_CFG[hoveredBed.status]?.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    {hoveredBed.currentBooking && (
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2"><User className="w-3 h-3 text-slate-500" /><span className="text-white/90 font-medium">{getGuestName(hoveredBed) || "Guest"}</span></div>
                        {hoveredBed.currentBooking.bookingCode && <div className="flex items-center gap-2"><FileText className="w-3 h-3 text-slate-500" /><span className="text-white/70 font-mono text-[10px]">{hoveredBed.currentBooking.bookingCode}</span></div>}
                        {hoveredBed.currentBooking.checkInDate && <div className="flex items-center gap-2"><Calendar className="w-3 h-3 text-emerald-500/70" /><span className="text-white/60 text-[10px]">{hoveredBed.currentBooking.checkInDate}{hoveredBed.currentBooking.checkOutDate && ` — ${hoveredBed.currentBooking.checkOutDate}`}</span></div>}
                      </div>
                    )}
                    <p className="text-[8px] text-slate-600 mt-2 flex items-center gap-1"><Eye className="w-2.5 h-2.5" /> Click for details</p>
                  </div>
                </div>
              </div>
            )}

            <div className="transition-all duration-700 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]" style={{ transform: `scale(${zoom})`, transformOrigin: "center center", opacity: mounted ? 1 : 0 }}>

              {drillLevel === "building" && (
                <div className="relative iso-building-enter" style={{ perspective: "1200px" }}>
                  <div style={{ transform: "rotateX(55deg) rotateZ(-45deg)", transformStyle: "preserve-3d" }}>
                    <div className="absolute rounded-2xl" style={{ width: `${Math.max(400, sortedFloors.length * 60 + 350)}px`, height: `${Math.max(400, sortedFloors.length * 60 + 350)}px`, background: "radial-gradient(ellipse at center, rgba(15,25,50,0.5), rgba(5,10,20,0.8))", border: "1px solid rgba(255,255,255,0.03)", transform: "translateZ(-12px)", left: "-50px", top: "-30px", boxShadow: "0 0 120px rgba(0,0,0,0.7)" }} />

                    {sortedFloors.map((floor, floorIdx) => {
                      const floorRooms = floor.rooms || [];
                      const allBeds = [...(floor.beds || []), ...floorRooms.flatMap((r: any) => r.beds || [])];
                      const zPos = floorIdx * 110;
                      const bedGroups = floorRooms.length > 0 ? floorRooms : [{ id: "orphan", beds: floor.beds || [], roomNumber: "" }];

                      return (
                        <div key={floor.id} className="absolute iso-floor-enter cursor-pointer" style={{ transform: `translateZ(${zPos}px)`, transformStyle: "preserve-3d", animationDelay: `${floorIdx * 120}ms` }} onClick={() => drillToFloor(floorIdx)}>
                          <div className="absolute -left-[85px] top-1/2 -translate-y-1/2 iso-float-label" style={{ transform: "rotateZ(45deg) rotateX(-55deg)", transformStyle: "preserve-3d" }}>
                            <div className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.15em] whitespace-nowrap" style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.05))", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", backdropFilter: "blur(8px)" }}>
                              Floor {floor.floorNumber}
                            </div>
                          </div>

                          <div className="relative group iso-floor-hover" style={{ width: "380px", minHeight: "90px", background: "linear-gradient(160deg, rgba(18,28,50,0.97), rgba(12,20,38,0.95))", border: "1px solid rgba(100,140,200,0.12)", borderRadius: "12px", boxShadow: "0 4px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)", overflow: "hidden" }}>
                            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: "linear-gradient(to bottom, rgba(100,140,200,0.4), rgba(100,140,200,0.1))", borderRadius: "12px 0 0 12px" }} />

                            <div className="p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">{floor.name || `Floor ${floor.floorNumber}`}</span>
                                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-slate-500">{allBeds.length} beds</span>
                                </div>
                                <ChevronRight className="w-3 h-3 text-white/15 group-hover:text-amber-400/60 transition-all" />
                              </div>

                              <div className="flex gap-2 flex-wrap">
                                {bedGroups.map((group: any) => {
                                  const beds = group.beds || [];
                                  if (beds.length === 0) return null;
                                  return (
                                    <div key={group.id} className="flex-1 min-w-[120px]">
                                      {group.roomNumber && (
                                        <div className="flex items-center gap-1 mb-1">
                                          <span className="text-[8px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(99,102,241,0.1)", color: "rgba(129,140,248,0.8)", border: "1px solid rgba(99,102,241,0.2)" }}>R{group.roomNumber}</span>
                                        </div>
                                      )}
                                      <div className="flex gap-[5px] flex-wrap">
                                        {beds.slice(0, 12).map((bed: any) => {
                                          const cfg = BED_STATUS_CFG[bed.status] || BED_STATUS_CFG.maintenance;
                                          const hasBooking = !!bed.currentBooking && (bed.status === "occupied" || bed.status === "reserved");
                                          return (
                                            <div key={bed.id} className="relative iso-bed-cell" style={{ width: "52px", height: "42px" }}>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); onBedClick(bed.id); }}
                                                onMouseEnter={(e) => handleBedHover(bed, e)}
                                                onMouseLeave={() => setHoveredBed(null)}
                                                className="w-full h-full rounded-lg overflow-hidden border transition-all duration-300 hover:scale-110 hover:z-10"
                                                style={{ borderColor: cfg.border, background: cfg.bg, boxShadow: cfg.glow }}
                                                data-testid={`iso-bed-${bed.id}`}
                                              >
                                                {hasBooking ? (
                                                  <div className="flex flex-col items-center justify-center h-full">
                                                    <IsoCharacter gender={getGender(bed)} size={18} />
                                                    <span className="text-[5px] font-bold leading-none" style={{ color: cfg.text }}>{bed.bedNumber.length > 5 ? bed.bedNumber.slice(-4) : bed.bedNumber}</span>
                                                  </div>
                                                ) : (
                                                  <div className="flex flex-col items-center justify-center h-full gap-0.5">
                                                    {bed.status === "blocked" ? <Ban className="w-3 h-3" style={{ color: cfg.text }} /> : bed.status === "available" ? <BedDouble className="w-3.5 h-3.5" style={{ color: `${cfg.text}99` }} /> : <AlertTriangle className="w-3 h-3" style={{ color: cfg.text }} />}
                                                    <span className="text-[6px] font-semibold" style={{ color: cfg.text }}>{bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}</span>
                                                  </div>
                                                )}
                                              </button>
                                              {hasBooking && (
                                                <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap iso-guest-label" style={{ pointerEvents: "none" }}>
                                                  <div className="px-1.5 py-0.5 rounded text-[6px] font-bold" style={{ background: `${cfg.dotColor}cc`, color: "white", boxShadow: `0 2px 8px ${cfg.dotColor}60` }}>
                                                    {(getGuestName(bed) || "Guest").split(" ")[0].slice(0, 8)}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {beds.length > 12 && <span className="text-[8px] text-slate-500 self-center ml-1">+{beds.length - 12}</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg, transparent, rgba(100,140,200,0.2), transparent)" }} />
                          </div>

                          <div className="absolute top-0 rounded-r-lg" style={{ left: "100%", width: "10px", height: "100%", background: "linear-gradient(180deg, rgba(14,22,40,0.7), rgba(8,14,28,0.9))", borderRight: "1px solid rgba(100,140,200,0.06)", transform: "rotateY(90deg)", transformOrigin: "left" }} />
                          <div className="absolute bottom-0 left-0 right-0 h-[10px] rounded-b-lg" style={{ background: "linear-gradient(135deg, rgba(14,22,40,0.7), rgba(8,14,28,0.9))", borderBottom: "1px solid rgba(100,140,200,0.06)", transform: "rotateX(90deg)", transformOrigin: "bottom" }} />
                        </div>
                      );
                    })}

                    <div className="absolute" style={{ transform: `translateZ(${sortedFloors.length * 110 + 12}px)`, transformStyle: "preserve-3d" }}>
                      <div className="relative" style={{ width: "380px" }}>
                        <div className="rounded-t-xl overflow-hidden" style={{ height: "60px", background: "linear-gradient(160deg, rgba(18,28,50,0.97), rgba(12,20,38,0.95))", border: "1px solid rgba(251,191,36,0.2)", borderBottom: "none" }}>
                          <div className="absolute top-0 left-0 right-0 h-[6px]" style={{ background: "linear-gradient(90deg, #166534, #15803d, #22c55e, #15803d, #166534)" }} />
                          <div className="flex items-center justify-center h-full gap-3 px-5 pt-1">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 iso-logo-pulse">
                              <span className="text-xs font-black text-white">H²</span>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white tracking-wider uppercase">{propertyName.length > 20 ? propertyName.slice(0, 20) + "…" : propertyName}</p>
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
                </div>
              )}

              {drillLevel === "floor" && activeFloor && (
                <div className="iso-drill-enter w-full" style={{ maxWidth: "900px", margin: "0 auto" }}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))", border: "1px solid rgba(251,191,36,0.3)" }}>
                        <span className="text-lg font-black text-amber-400">F{activeFloor.floorNumber}</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{activeFloor.name || `Floor ${activeFloor.floorNumber}`}</h3>
                        <p className="text-xs text-slate-500">{(activeFloor.rooms || []).length} rooms · {allFloorBeds.length} beds</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeFloorIdx !== null && activeFloorIdx > 0 && (
                        <button onClick={() => drillToFloor(activeFloorIdx - 1)} className="iso-ctrl-btn" aria-label="Previous floor"><ChevronLeft className="w-4 h-4" /></button>
                      )}
                      <span className="text-xs text-white/30 font-mono">Floor {(activeFloorIdx || 0) + 1}/{sortedFloors.length}</span>
                      {activeFloorIdx !== null && activeFloorIdx < sortedFloors.length - 1 && (
                        <button onClick={() => drillToFloor(activeFloorIdx + 1)} className="iso-ctrl-btn" aria-label="Next floor"><ChevronRight className="w-4 h-4" /></button>
                      )}
                    </div>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(160deg, rgba(18,28,55,0.95), rgba(12,20,42,0.98))", border: "1px solid rgba(100,140,200,0.15)", boxShadow: "0 8px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)", perspective: "800px" }}>
                    <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: "linear-gradient(to bottom, rgba(100,140,200,0.5), rgba(100,140,200,0.1))" }} />
                    <div className="absolute right-0 top-0 bottom-0 w-[4px]" style={{ background: "linear-gradient(to bottom, rgba(100,140,200,0.3), rgba(100,140,200,0.05))" }} />

                    <div className="p-5 sm:p-6">
                      {(activeFloor.rooms || []).length === 0 && (activeFloor.beds || []).length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                          {(activeFloor.beds || []).map((bed: any, bIdx: number) => (
                            <FloorBedCard key={bed.id} bed={bed} idx={bIdx} onBedClick={onBedClick} onAllocate={onAllocate} onDeallocate={onDeallocate} onHover={handleBedHover} onLeave={() => setHoveredBed(null)} />
                          ))}
                        </div>
                      )}

                      {(activeFloor.rooms || []).length > 0 && (
                        <div className="space-y-5">
                          {(activeFloor.rooms || []).map((room: any, rIdx: number) => {
                            const roomBeds = room.beds || [];
                            return (
                              <div key={room.id} className="iso-room-enter" style={{ animationDelay: `${rIdx * 100}ms` }}>
                                <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(100,140,200,0.1)" }}>
                                  <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(100,140,200,0.08)" }}>
                                    <DoorOpen className="w-4 h-4 text-indigo-400/80" />
                                    <span className="text-sm font-semibold text-white/90">Room {room.roomNumber}</span>
                                    {room.typology && <span className="text-[9px] px-2 py-0.5 rounded-md font-medium" style={{ background: "rgba(99,102,241,0.1)", color: "rgba(129,140,248,0.8)", border: "1px solid rgba(99,102,241,0.2)" }}>{room.typology}</span>}
                                    {room.hasSharedWashroom && <span className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400/70 border border-cyan-500/20">Shared WC</span>}
                                    <div className="flex-1" />
                                    <span className="text-[10px] text-emerald-400/70 font-medium">{roomBeds.filter((b: any) => b.status === "available").length} avail</span>
                                    <span className="text-[10px] text-blue-400/70 font-medium">{roomBeds.filter((b: any) => b.status === "occupied" || b.status === "reserved").length} booked</span>
                                  </div>
                                  <div className="p-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                      {roomBeds.map((bed: any, bIdx: number) => (
                                        <FloorBedCard key={bed.id} bed={bed} idx={bIdx} onBedClick={onBedClick} onAllocate={onAllocate} onDeallocate={onDeallocate} onHover={handleBedHover} onLeave={() => setHoveredBed(null)} />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="iso-glass-card p-4">
              <h3 className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] mb-3 flex items-center gap-2"><LayoutGrid className="w-3.5 h-3.5 text-amber-400/70" /> Overview</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total", value: stats.totalBeds || 0, color: "text-white", bg: "from-slate-500/10 to-slate-600/5", border: "border-slate-500/15" },
                  { label: "Open", value: stats.available || 0, color: "text-emerald-400", bg: "from-emerald-500/10 to-emerald-600/5", border: "border-emerald-500/15" },
                  { label: "Booked", value: stats.occupied || 0, color: "text-blue-400", bg: "from-blue-500/10 to-blue-600/5", border: "border-blue-500/15" },
                  { label: "Blocked", value: stats.blocked || 0, color: "text-red-400", bg: "from-red-500/10 to-red-600/5", border: "border-red-500/15" },
                ].map(item => (
                  <div key={item.label} className={cn("rounded-lg p-2 bg-gradient-to-br border", item.bg, item.border)}>
                    <p className="text-[8px] text-slate-500 uppercase tracking-wider">{item.label}</p>
                    <p className={cn("text-xl font-black", item.color)}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="iso-glass-card p-4">
              <h3 className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] mb-3 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-cyan-400/70" /> Status Legend</h3>
              <div className="space-y-2">
                {Object.entries(BED_STATUS_CFG).map(([status, cfg]) => (
                  <div key={status} className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full" style={{ background: cfg.dotColor, boxShadow: cfg.glow }} />
                    <span className="text-[10px] font-medium" style={{ color: cfg.text }}>{cfg.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {drillLevel === "building" && (
              <div className="iso-glass-card p-4">
                <h3 className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] mb-3 flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-indigo-400/70" /> Floors</h3>
                <div className="space-y-1.5">
                  {sortedFloors.map((floor, idx) => {
                    const fRooms = floor.rooms || [];
                    const fBeds = [...(floor.beds || []), ...fRooms.flatMap((r: any) => r.beds || [])];
                    const pct = fBeds.length ? Math.round((fBeds.filter((b: any) => b.status === "available").length / fBeds.length) * 100) : 0;
                    return (
                      <button key={floor.id} onClick={() => drillToFloor(idx)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all hover:bg-white/5 group text-left" data-testid={`iso-floor-btn-${floor.id}`}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                          F{floor.floorNumber}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-white/70 truncate">{floor.name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="flex-1 h-[3px] bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: pct > 50 ? "linear-gradient(90deg, #10b981, #06b6d4)" : pct > 20 ? "linear-gradient(90deg, #f59e0b, #eab308)" : "linear-gradient(90deg, #ef4444, #f97316)" }} />
                            </div>
                            <span className="text-[7px] text-slate-600 font-mono">{pct}%</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="iso-glass-card p-4">
              <h3 className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] mb-3 flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-indigo-400/70" /> Real time activity</h3>
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto iso-scrollbar">
                {(() => {
                  const logs: any[] = [];
                  floors.forEach(floor => {
                    const allBeds = [...(floor.beds || []), ...(floor.rooms || []).flatMap((r: any) => r.beds || [])];
                    allBeds.forEach(bed => {
                      if (bed.currentBooking) {
                        logs.push({ bedNumber: bed.bedNumber, guest: getGuestName(bed) || "Guest", status: bed.status, floor: floor.name, time: bed.currentBooking.createdAt ? new Date(bed.currentBooking.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Recent" });
                      }
                    });
                  });
                  return logs.length === 0 ? (
                    <p className="text-[10px] text-slate-600 text-center py-4">No recent activity</p>
                  ) : logs.slice(0, 8).map((log, i) => (
                    <div key={i} className="flex items-start gap-2 py-1 border-b border-white/[0.03] last:border-0">
                      <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0")} style={{ background: BED_STATUS_CFG[log.status]?.dotColor || "#64748b" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-white/70 font-medium truncate"><span className="text-amber-400/70">{log.bedNumber}</span> · {log.guest}</p>
                        <p className="text-[8px] text-slate-600">{log.floor} · {log.time}</p>
                      </div>
                    </div>
                  ));
                })()}
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
        .iso-glass-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; backdrop-filter: blur(20px); transition: all 0.4s; }
        .iso-glass-card:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
        .iso-scrollbar::-webkit-scrollbar { width: 2px; }
        .iso-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.01); }
        .iso-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        .iso-neon-line { background: linear-gradient(90deg, transparent, rgba(251,191,36,0.5) 30%, rgba(6,182,212,0.4) 70%, transparent); animation: neonSweep 4s ease-in-out infinite; }
        @keyframes neonSweep { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes ambientFloat { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(20px, -15px) scale(1.05); } }
        .iso-ambient-orb { animation: ambientFloat 12s ease-in-out infinite; }
        @keyframes buildingEnter { from { opacity: 0; transform: scale(0.85) translateY(40px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .iso-building-enter { animation: buildingEnter 0.8s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
        @keyframes floorEnter { from { opacity: 0; transform: translateZ(var(--tz, 0)) translateY(20px); } to { opacity: 1; transform: translateZ(var(--tz, 0)) translateY(0); } }
        .iso-floor-enter { animation: floorEnter 0.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards; opacity: 0; }
        .iso-floor-hover { transition: all 0.4s cubic-bezier(0.25,0.46,0.45,0.94); }
        .iso-floor-hover:hover { box-shadow: 0 8px 40px rgba(100,140,200,0.15), 0 0 1px rgba(100,140,200,0.3), inset 0 1px 0 rgba(255,255,255,0.06) !important; border-color: rgba(100,140,200,0.25) !important; transform: translateY(-3px); }
        @keyframes drillEnter { from { opacity: 0; transform: scale(0.92) translateY(24px); filter: blur(4px); } to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); } }
        .iso-drill-enter { animation: drillEnter 0.6s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
        @keyframes roomEnter { from { opacity: 0; transform: translateY(16px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .iso-room-enter { animation: roomEnter 0.5s cubic-bezier(0.25,0.46,0.45,0.94) forwards; opacity: 0; }
        @keyframes bedEnter { from { opacity: 0; transform: scale(0.9) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .iso-bed-enter { animation: bedEnter 0.4s cubic-bezier(0.25,0.46,0.45,0.94) forwards; opacity: 0; }
        @keyframes hoverEnter { from { opacity: 0; transform: translateY(8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .iso-hover-enter { animation: hoverEnter 0.2s cubic-bezier(0.25,0.46,0.45,0.94) forwards; }
        @keyframes floatLabel { 0%, 100% { transform: rotateZ(45deg) rotateX(-55deg) translateY(0); } 50% { transform: rotateZ(45deg) rotateX(-55deg) translateY(-2px); } }
        .iso-float-label { animation: floatLabel 4s ease-in-out infinite; }
        @keyframes logoPulse { 0%, 100% { box-shadow: 0 0 15px rgba(251,191,36,0.2); } 50% { box-shadow: 0 0 25px rgba(251,191,36,0.4); } }
        .iso-logo-pulse { animation: logoPulse 4s ease-in-out infinite; }
        @keyframes statusDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .iso-status-dot { animation: statusDot 2s ease-in-out infinite; }
        @keyframes charBreathe { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.02); } }
        .iso-char-breathe { animation: charBreathe 4s ease-in-out infinite; transform-origin: bottom center; }
        @keyframes charIdle { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(0.3px); } 75% { transform: translateX(-0.3px); } }
        .iso-char-idle { animation: charIdle 6s ease-in-out infinite; transform-origin: bottom center; }
        @keyframes armPhone { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-2deg); } }
        .iso-arm-phone { animation: armPhone 5s ease-in-out infinite; transform-origin: top center; }
        @keyframes armRelax { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(0.4px); } }
        .iso-arm-r { animation: armRelax 4.5s ease-in-out infinite; }
        .iso-arm-l { animation: armRelax 5s ease-in-out infinite 0.5s; }
        @keyframes phoneGlow { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
        .iso-phone-glow { animation: phoneGlow 3s ease-in-out infinite; }
        @keyframes bedGlow { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.15); } }
        .iso-bed-cell { animation: bedGlow 3s ease-in-out infinite; }
        .iso-bed-cell:hover { z-index: 20; }
        .iso-guest-label { animation: floatLabelSimple 3s ease-in-out infinite; }
        @keyframes floatLabelSimple { 0%, 100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-1px); } }
        @keyframes bedCardFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        .iso-bed-card-float { animation: bedCardFloat 4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .iso-char-breathe, .iso-char-idle, .iso-arm-phone, .iso-arm-r, .iso-arm-l,
          .iso-phone-glow, .iso-bed-cell, .iso-guest-label, .iso-bed-card-float,
          .iso-ambient-orb, .iso-logo-pulse, .iso-status-dot, .iso-float-label,
          .iso-neon-line { animation: none !important; }
          .iso-floor-hover:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}

function FloorBedCard({ bed, idx, onBedClick, onAllocate, onDeallocate, onHover, onLeave }: {
  bed: any; idx: number;
  onBedClick: (bedId: string) => void; onAllocate: (bedId: string) => void; onDeallocate: (bedId: string) => void;
  onHover: (bed: any, e: React.MouseEvent) => void; onLeave: () => void;
}) {
  const cfg = BED_STATUS_CFG[bed.status] || BED_STATUS_CFG.maintenance;
  const hasBooking = !!bed.currentBooking;
  const showChar = hasBooking && (bed.status === "occupied" || bed.status === "reserved");
  const guestName = getGuestName(bed);
  const checkoutDate = getCheckoutDate(bed);
  const isAvailable = bed.status === "available";
  const isOccupied = bed.status === "occupied";

  return (
    <div className="iso-bed-enter relative group/bed" style={{ animationDelay: `${Math.min(idx, 20) * 40}ms` }}>
      <button
        onClick={() => onBedClick(bed.id)}
        onMouseEnter={(e) => onHover(bed, e)}
        onMouseLeave={onLeave}
        className="w-full rounded-xl overflow-hidden border transition-all duration-300 hover:scale-[1.04] hover:-translate-y-1 cursor-pointer iso-bed-card-float"
        style={{ borderColor: cfg.border, background: `linear-gradient(160deg, ${cfg.bg}, rgba(15,23,42,0.6))`, boxShadow: cfg.glow, minHeight: "110px", animationDelay: `${idx * 200}ms` }}
        data-testid={`iso-bed-${bed.id}`}
      >
        <div className="p-2.5 flex flex-col items-center justify-center h-full min-h-[110px] relative">
          {showChar && (
            <>
              <IsoCharacter gender={getGender(bed)} size={28} />
              <div className="mt-1 text-center">
                <span className="text-[9px] font-bold block" style={{ color: cfg.text }}>{bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}</span>
                {guestName && <span className="text-[8px] text-white/50 block truncate max-w-[70px]">{guestName.split(" ")[0]}</span>}
                {checkoutDate && <span className="text-[7px] block mt-0.5" style={{ color: `${cfg.text}99` }}>Out: {checkoutDate}</span>}
              </div>
            </>
          )}
          {isAvailable && (
            <div className="flex flex-col items-center gap-1.5">
              <IsoBedSVG status="available" w={48} h={24} />
              <span className="text-[9px] font-bold" style={{ color: cfg.text }}>{bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}</span>
              <span className="text-[8px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${cfg.dotColor}20`, color: cfg.text }}>Available</span>
            </div>
          )}
          {bed.status === "blocked" && (
            <div className="flex flex-col items-center gap-1">
              <Ban className="w-5 h-5" style={{ color: cfg.text }} />
              <span className="text-[9px] font-bold" style={{ color: cfg.text }}>{bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}</span>
              <span className="text-[7px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: "rgba(220,38,38,0.2)", color: "#f87171" }}>Blocked</span>
            </div>
          )}
          {bed.status === "maintenance" && (
            <div className="flex flex-col items-center gap-1">
              <AlertTriangle className="w-5 h-5" style={{ color: cfg.text }} />
              <span className="text-[9px] font-bold" style={{ color: cfg.text }}>{bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}</span>
              <span className="text-[7px] text-slate-400">Maint.</span>
            </div>
          )}

          {showChar && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-xl" style={{ background: `linear-gradient(90deg, transparent, ${cfg.dotColor}80, transparent)` }} />
          )}
        </div>
      </button>

      <div className="absolute -top-1.5 -right-1.5 opacity-0 group-hover/bed:opacity-100 transition-all duration-300 flex gap-0.5 z-30">
        {isAvailable && !hasBooking && (
          <button onClick={(e) => { e.stopPropagation(); onAllocate(bed.id); }} className="w-5 h-5 rounded-full bg-blue-500/90 hover:bg-blue-500 flex items-center justify-center shadow-lg border border-blue-400/30" aria-label="Allocate booking"><Link2 className="w-3 h-3 text-white" /></button>
        )}
        {isOccupied && hasBooking && (
          <button onClick={(e) => { e.stopPropagation(); onDeallocate(bed.id); }} className="w-5 h-5 rounded-full bg-orange-500/90 hover:bg-orange-500 flex items-center justify-center shadow-lg border border-orange-400/30" aria-label="Deallocate booking"><Unlock className="w-3 h-3 text-white" /></button>
        )}
      </div>
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

function RoomCardTree({ room, onBedClick, onAllocate, onDeallocate }: { room: any; onBedClick: (bedId: string) => void; onAllocate: (bedId: string) => void; onDeallocate: (bedId: string) => void; }) {
  const roomBeds = room.beds || [];
  const isCombo = room.typology?.includes("+");
  const allAvail = roomBeds.every((b: any) => b.status === "available");
  const allOccupied = roomBeds.every((b: any) => b.status === "occupied");
  const roomBorderColor = allOccupied ? "border-rose-200 bg-rose-50/30" : allAvail ? "border-emerald-200 bg-emerald-50/20" : "border-amber-200 bg-amber-50/20";
  const roomType = room.roomType;
  const sections = isCombo ? room.typology.split("+").map((p: string, i: number) => ({ label: String.fromCharCode(65 + i), bedCount: parseInt(p), beds: roomBeds.filter((b: any) => b.bedNumber.includes(`${room.roomNumber}${String.fromCharCode(65 + i)}`)) })) : null;
  return (
    <div className={cn("border rounded-lg p-3 transition-colors", roomBorderColor)} data-testid={`tree-room-${room.id}`}>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <DoorOpen className="w-4 h-4 text-indigo-600" /><span className="font-semibold text-sm text-slate-800">Room {room.roomNumber}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{room.typology}</Badge>
        {roomType && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{roomType.customName || roomType.name}</Badge>}
        {room.hasSharedWashroom && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 gap-0.5"><Bath className="w-2.5 h-2.5" />Shared WC</Badge>}
      </div>
      {isCombo && sections ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{sections.map((section: any) => (
          <div key={section.label} className="bg-white/80 rounded border border-slate-200 p-2">
            <p className="text-[10px] font-medium text-slate-500 mb-1.5">{room.roomNumber}{section.label} — {section.bedCount} bed{section.bedCount > 1 ? "s" : ""}</p>
            <div className="flex gap-2 flex-wrap">{section.beds.map((bed: any) => (<BedCellTree key={bed.id} bed={bed} onBedClick={onBedClick} onAllocate={() => onAllocate(bed.id)} onDeallocate={() => onDeallocate(bed.id)} />))}</div>
          </div>
        ))}</div>
      ) : (
        <div className="flex gap-2 flex-wrap">{roomBeds.map((bed: any) => (<BedCellTree key={bed.id} bed={bed} onBedClick={onBedClick} onAllocate={() => onAllocate(bed.id)} onDeallocate={() => onDeallocate(bed.id)} />))}</div>
      )}
    </div>
  );
}

function BedCellTree({ bed, onBedClick, onAllocate, onDeallocate }: { bed: any; onBedClick: (bedId: string) => void; onAllocate: () => void; onDeallocate: () => void; }) {
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
          <button onClick={() => onBedClick(bed.id)} className={cn("rounded-lg flex flex-col items-center justify-center text-white text-xs font-medium transition-all hover:scale-105 cursor-pointer relative group", "w-16 h-16", STATUS_COLORS[bed.status], hasBooking && "ring-2 ring-blue-400 ring-offset-1")} data-testid={`tree-bed-${bed.id}`}>
            {isBlocked ? <Ban className="w-4 h-4 mb-0.5" /> : <BedDouble className="w-4 h-4 mb-0.5" />}
            <span className="text-[9px] leading-tight truncate max-w-full px-0.5">{bed.bedNumber}</span>
            {hasBooking && <span className="text-[7px] bg-blue-600 px-1 rounded absolute -bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap">{bookingCode.slice(-6) || "Booked"}</span>}
            {isBlocked && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-red-800 text-[7px] text-white px-1 rounded whitespace-nowrap">BLOCKED</span>}
            <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
              {isAvailable && !hasBooking && <button onClick={(e) => { e.stopPropagation(); onAllocate(); }} className="w-4 h-4 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center" aria-label="Allocate"><Link2 className="w-2.5 h-2.5 text-white" /></button>}
              {isOccupied && hasBooking && <button onClick={(e) => { e.stopPropagation(); onDeallocate(); }} className="w-4 h-4 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center" aria-label="Deallocate"><Unlock className="w-2.5 h-2.5 text-white" /></button>}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-60">
          <p className="font-semibold">{bed.bedNumber} — {bed.status}</p>
          {hasBooking && <div className="text-xs mt-1 space-y-0.5"><p><span className="font-medium">Guest:</span> {guestName}</p><p><span className="font-medium">Booking:</span> {bookingCode}</p><p><span className="font-medium">Status:</span> {booking.status}</p></div>}
          {isBlocked && bed.blockedReason && <p className="text-xs mt-1">Reason: {bed.blockedReason}</p>}
          <p className="text-[10px] text-slate-400 mt-1">Click for full details</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BedDetailDrawer({ open, onClose, bedDetails, loading, onAllocate, onDeallocate }: { open: boolean; onClose: () => void; bedDetails: any; loading: boolean; onAllocate: (bedId: string) => void; onDeallocate: (bedId: string) => void; }) {
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
          <DialogTitle className="flex items-center gap-2"><BedDouble className="w-5 h-5 text-indigo-600" />Bed Details — {bed?.bedNumber || "Loading..."}</DialogTitle>
          <DialogDescription>Full booking history, guest details, and activity timeline</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /><span className="ml-2 text-slate-500">Loading bed details...</span></div>
        ) : bed ? (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-5 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <InfoCard icon={<Layers className="w-4 h-4 text-amber-600" />} label="Floor" value={bed.floor?.name || "N/A"} />
                <InfoCard icon={<DoorOpen className="w-4 h-4 text-indigo-600" />} label="Room" value={bed.room?.roomNumber || "Unassigned"} />
                <InfoCard icon={<Building2 className="w-4 h-4 text-slate-600" />} label="Property" value={bed.property?.name || "N/A"} />
                <InfoCard icon={<Shield className="w-4 h-4 text-slate-600" />} label="Status" value={<Badge className={cn("text-[10px]", STATUS_BG[bed.status])}>{bed.status}</Badge>} />
              </div>
              <div className="flex gap-2">
                {bed.status === "available" && !activeBooking && <Button size="sm" onClick={() => onAllocate(bed.id)} data-testid="button-allocate-from-detail"><Link2 className="w-3 h-3 mr-1" />Allocate Booking</Button>}
                {bed.status === "occupied" && activeBooking && <Button size="sm" variant="outline" className="text-orange-600 border-orange-200" onClick={() => onDeallocate(bed.id)} data-testid="button-deallocate-from-detail"><Unlock className="w-3 h-3 mr-1" />Deallocate</Button>}
              </div>
              {guest && (<><Separator /><div><h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3"><User className="w-4 h-4" />Current Occupant</h3><div className="p-3 bg-slate-50 rounded-lg border space-y-2"><div className="flex items-center gap-3">{guest.photo ? <img src={guest.photo} alt={guest.name} className="w-10 h-10 rounded-full object-cover border" /> : <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">{guest.name?.[0]?.toUpperCase() || "?"}</div>}<div><p className="font-semibold text-slate-800 text-sm">{guest.name}</p><p className="text-xs text-slate-500">{guest.type === "student" ? "Student" : guest.type === "lead" ? "Lead" : "Walk-in"}</p></div></div>{guest.phone && <DetailRow icon={<Phone className="w-3 h-3" />} text={guest.phone} />}{guest.email && <DetailRow icon={<Mail className="w-3 h-3" />} text={guest.email} />}{guest.college && <DetailRow icon={<GraduationCap className="w-3 h-3" />} text={guest.college} />}</div></div></>)}
              {activeBooking && (<><Separator /><div><h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3"><FileText className="w-4 h-4" />Active Booking</h3><BookingCard booking={activeBooking} /></div></>)}
              {bookingHistory.length > 0 && (<><Separator /><div><h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3"><History className="w-4 h-4" />Booking History ({bookingHistory.length})</h3><div className="space-y-2">{bookingHistory.map((b: any) => (<BookingCard key={b.id} booking={b} compact />))}</div></div></>)}
              {allocations.length > 0 && (<><Separator /><div><h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3"><Activity className="w-4 h-4" />Allocation Timeline ({allocations.length})</h3><div className="space-y-2">{allocations.map((a: any) => (<div key={a.id} className="flex items-start gap-3 text-xs p-2 bg-slate-50 rounded-lg border"><div className={`w-2 h-2 rounded-full mt-1.5 ${a.isActive ? "bg-emerald-500" : "bg-slate-400"}`} /><div className="flex-1"><p className="font-medium text-slate-700">{a.action === "allocate" ? "Allocated" : a.action === "deallocate" ? "Deallocated" : "Transferred"}</p><p className="text-slate-500">{new Date(a.allocatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}{a.deallocatedAt && <> → {new Date(a.deallocatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</>}</p>{a.notes && <p className="text-slate-400 mt-0.5">{a.notes}</p>}{a.allocatedBy && <p className="text-slate-400">By: {a.allocatedBy}</p>}</div><Badge variant={a.isActive ? "default" : "secondary"} className="text-[10px]">{a.isActive ? "Active" : "Past"}</Badge></div>))}</div></div></>)}
              {blockLogs.length > 0 && (<><Separator /><div><h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3"><Ban className="w-4 h-4" />Block/Unblock History ({blockLogs.length})</h3><div className="space-y-2">{blockLogs.map((log: any) => (<div key={log.id} className="flex items-start gap-3 text-xs p-2 bg-slate-50 rounded-lg border"><div className={`w-2 h-2 rounded-full mt-1.5 ${log.action === "block" ? "bg-red-500" : "bg-emerald-500"}`} /><div className="flex-1"><p className="font-medium text-slate-700">{log.action === "block" ? "Blocked" : "Unblocked"}</p>{log.category && <p className="text-slate-500">Category: {log.category}</p>}{log.reason && <p className="text-slate-500">Reason: {log.reason}</p>}{log.note && <p className="text-slate-400">{log.note}</p>}<p className="text-slate-400">{new Date(log.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div></div>))}</div></div></>)}
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
          <Badge className={cn("text-[10px]", BOOKING_STATUS_COLORS[booking.status] || "bg-slate-100 text-slate-700")}>{booking.status?.replace(/_/g, " ")}</Badge>
          <span className="font-mono text-xs font-semibold text-slate-600">{booking.bookingCode || booking.id.slice(0, 8)}</span>
        </div>
        <span className="text-[10px] text-slate-400">{new Date(booking.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
      </div>
      {!compact && (
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          {booking.checkInDate && <DetailRow icon={<Calendar className="w-3 h-3" />} text={`In: ${booking.checkInDate}`} />}
          {booking.checkOutDate && <DetailRow icon={<Calendar className="w-3 h-3" />} text={`Out: ${booking.checkOutDate}`} />}
          <DetailRow icon={<IndianRupee className="w-3 h-3" />} text={`Total: ₹${(booking.totalFee || 0).toLocaleString()}`} />
          <DetailRow icon={<CreditCard className="w-3 h-3" />} text={`Paid: ₹${totalPaid.toLocaleString()}`} />
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(paidPercent, 100)}%` }} /></div>
        <span className={cn("text-[10px] font-medium", totalDue > 0 ? "text-amber-600" : "text-emerald-600")}>{paidPercent}% paid</span>
      </div>
      {!compact && booking.installments?.length > 0 && (
        <div className="mt-2 space-y-1">{booking.installments.map((inst: any) => (<div key={inst.id} className="flex items-center justify-between text-[10px] text-slate-500"><span>{inst.name}</span><span className="flex items-center gap-1">₹{(inst.amount || 0).toLocaleString()}{inst.paid ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Clock className="w-3 h-3 text-amber-400" />}</span></div>))}</div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="p-2.5 bg-white rounded-lg border flex items-center gap-2">{icon}<div><p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p><div className="text-sm font-medium text-slate-800">{value}</div></div></div>
  );
}

function DetailRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (<div className="flex items-center gap-1.5 text-slate-600">{icon}<span>{text}</span></div>);
}
