import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
  LayoutGrid, Box, ZoomIn, ZoomOut, RotateCcw, Maximize2, List
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
  const [zoom, setZoom] = useState(1);
  const [hoveredBed, setHoveredBed] = useState<any>(null);
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });
  const [selectedFloorIdx, setSelectedFloorIdx] = useState<number | null>(null);
  const [activityLog, setActivityLog] = useState<any[]>([]);

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
    [...floors].sort((a, b) => a.floorNumber - b.floorNumber),
    [floors]
  );

  const handleBedHover = useCallback((bed: any, e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setHoveredPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    setHoveredBed(bed);
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #0a0e1a 0%, #111827 40%, #0f172a 100%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[10%] right-[15%] w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute top-[40%] right-[30%] w-64 h-64 bg-amber-500/3 rounded-full blur-3xl" />
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
          backgroundSize: "40px 40px"
        }} />
      </div>

      <div className="relative p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#111827] animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">{propertyName}</h2>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Status: Active · Real-time Monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all"
              data-testid="btn-zoom-out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-white/40 font-mono min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(1.8, z + 0.15))}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all"
              data-testid="btn-zoom-in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => setZoom(1)}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all"
              data-testid="btn-zoom-reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          <div ref={containerRef} className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
            {hoveredBed && (
              <div
                className="absolute z-[100] pointer-events-none"
                style={{ left: hoveredPos.x + 16, top: hoveredPos.y - 10 }}
              >
                <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl min-w-[180px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full", STATUS_COLORS[hoveredBed.status])} />
                    <span className="text-white font-semibold text-sm">{hoveredBed.bedNumber}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                      hoveredBed.status === "available" ? "bg-emerald-500/20 text-emerald-400" :
                      hoveredBed.status === "occupied" ? "bg-blue-500/20 text-blue-400" :
                      hoveredBed.status === "reserved" ? "bg-amber-500/20 text-amber-400" :
                      "bg-red-500/20 text-red-400"
                    )}>{ISO_BED_GLOW[hoveredBed.status]?.label || hoveredBed.status}</span>
                  </div>
                  {hoveredBed.currentBooking && (
                    <div className="space-y-1 text-xs">
                      <p className="text-slate-300"><span className="text-slate-500">Guest:</span> {hoveredBed.currentBooking.walkInName || hoveredBed.currentBooking.residentDetails?.residentName || "Guest"}</p>
                      {hoveredBed.currentBooking.checkOutDate && (
                        <p className="text-slate-300"><span className="text-slate-500">Out:</span> {hoveredBed.currentBooking.checkOutDate}</p>
                      )}
                      {hoveredBed.currentBooking.bookingCode && (
                        <p className="text-slate-300"><span className="text-slate-500">Code:</span> {hoveredBed.currentBooking.bookingCode}</p>
                      )}
                    </div>
                  )}
                  {hoveredBed.status === "blocked" && hoveredBed.blockedReason && (
                    <p className="text-xs text-red-400 mt-1">{hoveredBed.blockedReason}</p>
                  )}
                  <p className="text-[10px] text-slate-600 mt-2">Click to view details</p>
                </div>
              </div>
            )}

            <div
              className="transition-transform duration-500 ease-out"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
              }}
            >
              <div
                className="relative"
                style={{
                  transform: "rotateX(55deg) rotateZ(-45deg)",
                  transformStyle: "preserve-3d",
                  perspective: "1200px",
                }}
              >
                <div
                  className="absolute rounded-xl"
                  style={{
                    width: `${Math.max(sortedFloors.length * 60 + 360, 400)}px`,
                    height: `${Math.max(sortedFloors.length * 60 + 360, 400)}px`,
                    background: "linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(30,41,59,0.4) 100%)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    transform: "translateZ(-5px)",
                    left: "-40px",
                    top: "-20px",
                    boxShadow: "0 0 60px rgba(0,0,0,0.5)",
                  }}
                />

                {sortedFloors.map((floor, floorIdx) => {
                  const floorRooms = floor.rooms || [];
                  const allBeds = [...(floor.beds || []), ...floorRooms.flatMap((r: any) => r.beds || [])];
                  const isHighlighted = selectedFloorIdx === null || selectedFloorIdx === floorIdx;
                  const floorHeight = floorIdx * 110;

                  return (
                    <div
                      key={floor.id}
                      className="absolute transition-all duration-700 ease-out cursor-pointer"
                      style={{
                        transform: `translateZ(${floorHeight}px)`,
                        transformStyle: "preserve-3d",
                        opacity: isHighlighted ? 1 : 0.3,
                        filter: isHighlighted ? "none" : "blur(1px)",
                      }}
                      onClick={() => setSelectedFloorIdx(prev => prev === floorIdx ? null : floorIdx)}
                    >
                      <div
                        className="relative rounded-xl overflow-hidden"
                        style={{
                          width: "320px",
                          height: "260px",
                          background: "linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.9) 100%)",
                          border: `1px solid ${isHighlighted ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.08)"}`,
                          boxShadow: isHighlighted
                            ? "0 4px 30px rgba(251,191,36,0.15), inset 0 1px 0 rgba(255,255,255,0.05)"
                            : "0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
                          backdropFilter: "blur(20px)",
                        }}
                      >
                        <div className="absolute -left-[2px] top-0 bottom-0 w-[3px] rounded-full" style={{
                          background: `linear-gradient(to bottom, rgba(251,191,36,${isHighlighted ? 0.8 : 0.2}), rgba(251,191,36,0))`,
                        }} />

                        <div className="p-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center">
                                <span className="text-xs font-bold text-amber-400">F{floor.floorNumber}</span>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-white/90 leading-tight">{floor.name}</p>
                                <p className="text-[9px] text-slate-500">{floorRooms.length} rooms · {allBeds.length} beds</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                {allBeds.filter(b => b.status === "available").length} open
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2 max-h-[195px] overflow-y-auto custom-scrollbar pr-1">
                            {floorRooms.map((room: any) => {
                              const roomBeds = room.beds || [];
                              return (
                                <div key={room.id} className="rounded-lg p-2" style={{
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid rgba(255,255,255,0.06)",
                                }}>
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <DoorOpen className="w-3 h-3 text-indigo-400/70" />
                                    <span className="text-[10px] font-medium text-slate-300">{room.roomNumber}</span>
                                    {room.typology && (
                                      <span className="text-[8px] px-1 py-0.5 rounded bg-indigo-500/10 text-indigo-400/80 border border-indigo-500/20">{room.typology}</span>
                                    )}
                                  </div>
                                  <div className="flex gap-1.5 flex-wrap">
                                    {roomBeds.map((bed: any) => (
                                      <IsometricBed
                                        key={bed.id}
                                        bed={bed}
                                        onClick={() => onBedClick(bed.id)}
                                        onHover={(e) => handleBedHover(bed, e)}
                                        onLeave={() => setHoveredBed(null)}
                                        onAllocate={() => onAllocate(bed.id)}
                                        onDeallocate={() => onDeallocate(bed.id)}
                                      />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 h-[6px]" style={{
                          background: "linear-gradient(90deg, rgba(251,191,36,0.4), rgba(251,191,36,0.1), rgba(251,191,36,0.4))",
                          transform: "translateZ(-2px)",
                        }} />
                      </div>

                      <div
                        className="absolute top-0 rounded-r-lg"
                        style={{
                          left: "100%",
                          width: "6px",
                          height: "260px",
                          background: "linear-gradient(180deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.9) 100%)",
                          borderRight: "1px solid rgba(255,255,255,0.05)",
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                          transform: "rotateY(90deg)",
                          transformOrigin: "left",
                        }}
                      />
                    </div>
                  );
                })}

                <div
                  className="absolute"
                  style={{
                    transform: `translateZ(${sortedFloors.length * 110 + 15}px)`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div className="relative" style={{ width: "320px" }}>
                    <div className="rounded-t-xl overflow-hidden" style={{
                      height: "50px",
                      background: "linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.9) 100%)",
                      border: "1px solid rgba(251,191,36,0.3)",
                      borderBottom: "none",
                    }}>
                      <div className="flex items-center justify-center h-full gap-3 px-4">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                          <span className="text-[10px] font-black text-white">H²</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white tracking-wide uppercase">{propertyName.length > 20 ? propertyName.slice(0, 20) + "..." : propertyName}</p>
                          <div className="flex items-center gap-1">
                            <div className="w-4 h-[2px] bg-gradient-to-r from-amber-500 to-transparent" />
                            <span className="text-[7px] text-amber-400/60 uppercase tracking-widest">Roof Garden</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="h-[3px]" style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)" }} />
                  </div>
                </div>

                <div className="absolute" style={{
                  transform: `translateZ(${sortedFloors.length * 110 + 70}px)`,
                  width: "320px",
                }}>
                  <div className="flex items-center justify-center gap-4">
                    {[
                      { icon: "📡", label: "Antenna" },
                      { icon: "🌿", label: "Garden" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-full" style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}>
                        <span className="text-xs">{item.icon}</span>
                        <span className="text-[8px] text-slate-500">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute left-4 top-1/2 -translate-y-1/2 space-y-2">
              {sortedFloors.map((floor, idx) => {
                const floorRooms = floor.rooms || [];
                const allBeds = [...(floor.beds || []), ...floorRooms.flatMap((r: any) => r.beds || [])];
                const availCount = allBeds.filter(b => b.status === "available").length;
                const totalBedCount = allBeds.length;
                const pct = totalBedCount ? Math.round((availCount / totalBedCount) * 100) : 0;

                return (
                  <button
                    key={floor.id}
                    onClick={() => setSelectedFloorIdx(prev => prev === idx ? null : idx)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all min-w-[140px]",
                      selectedFloorIdx === idx
                        ? "bg-amber-500/10 border border-amber-500/30"
                        : "bg-white/5 border border-white/10 hover:bg-white/8 hover:border-white/15"
                    )}
                    data-testid={`iso-floor-btn-${floor.id}`}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                      selectedFloorIdx === idx ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-slate-400"
                    )}>
                      F{floor.floorNumber}
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-medium text-white/80 truncate">{floor.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[8px] text-slate-500">{pct}%</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl p-4" style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
            }}>
              <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                <LayoutGrid className="w-3.5 h-3.5 text-amber-400" /> Overview
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Total Beds", value: stats.totalBeds || 0, color: "text-white", bg: "from-slate-500/20 to-slate-600/10", border: "border-slate-500/20" },
                  { label: "Available", value: stats.available || 0, color: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-600/10", border: "border-emerald-500/20" },
                  { label: "Booked", value: stats.occupied || 0, color: "text-blue-400", bg: "from-blue-500/20 to-blue-600/10", border: "border-blue-500/20" },
                  { label: "Blocked", value: stats.blocked || 0, color: "text-red-400", bg: "from-red-500/20 to-red-600/10", border: "border-red-500/20" },
                ].map(item => (
                  <div key={item.label} className={cn("rounded-lg p-2.5 bg-gradient-to-br border", item.bg, item.border)}>
                    <p className="text-[9px] text-slate-400 uppercase tracking-wider">{item.label}</p>
                    <p className={cn("text-lg font-bold", item.color)}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
            }}>
              <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Legend
              </h3>
              <div className="space-y-2">
                {Object.entries(ISO_BED_GLOW).map(([status, style]) => (
                  <div key={status} className="flex items-center gap-2.5">
                    <div className={cn("w-4 h-4 rounded-md bg-gradient-to-br border", style.bg, style.border, style.glow)} style={{ boxShadow: undefined }} />
                    <span className="text-xs text-slate-300 capitalize">{style.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
            }}>
              <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-indigo-400" /> Real-time Activity
              </h3>
              <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                {activityLog.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No recent activity</p>
                ) : (
                  activityLog.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                      <div className={cn("w-2 h-2 rounded-full mt-1 shrink-0",
                        log.status === "available" ? "bg-emerald-500" :
                        log.status === "occupied" ? "bg-blue-500" :
                        log.status === "reserved" ? "bg-amber-500" : "bg-red-500"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-white/80 font-medium truncate">
                          <span className="text-amber-400/80">{log.bedNumber}</span> · {log.guest}
                        </p>
                        <p className="text-[9px] text-slate-500">{log.floor} · {log.time}</p>
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
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }

        @keyframes bedPulse {
          0%, 100% { box-shadow: 0 0 8px var(--glow-color); }
          50% { box-shadow: 0 0 16px var(--glow-color); }
        }
        .bed-glow {
          animation: bedPulse 3s ease-in-out infinite;
        }

        @keyframes floatLabel {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
        .float-label {
          animation: floatLabel 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function IsometricBed({ bed, onClick, onHover, onLeave, onAllocate, onDeallocate }: {
  bed: any;
  onClick: () => void;
  onHover: (e: React.MouseEvent) => void;
  onLeave: () => void;
  onAllocate: () => void;
  onDeallocate: () => void;
}) {
  const style = ISO_BED_GLOW[bed.status] || ISO_BED_GLOW.maintenance;
  const hasBooking = !!bed.currentBooking;
  const isAvailable = bed.status === "available";
  const isOccupied = bed.status === "occupied";
  const guestName = bed.currentBooking?.walkInName || bed.currentBooking?.residentDetails?.residentName || "";
  const shortName = guestName ? (guestName.split(" ")[0].slice(0, 6) + (guestName.split(" ")[1] ? " " + guestName.split(" ")[1][0] + "." : "")) : "";
  const checkOut = bed.currentBooking?.checkOutDate || "";
  const shortCheckout = checkOut ? `Out: ${checkOut.split("-").slice(1).reverse().join("/")}` : "";

  return (
    <div className="relative group" style={{ transform: "translateZ(0)" }}>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        className={cn(
          "relative rounded-lg transition-all duration-300 cursor-pointer border",
          "hover:scale-110 hover:z-10",
          style.border,
          hasBooking ? "bed-glow" : ""
        )}
        style={{
          width: "52px",
          height: "38px",
          background: `linear-gradient(135deg, ${
            bed.status === "available" ? "rgba(16,185,129,0.25), rgba(16,185,129,0.15)" :
            bed.status === "occupied" ? "rgba(59,130,246,0.25), rgba(59,130,246,0.15)" :
            bed.status === "reserved" ? "rgba(245,158,11,0.25), rgba(245,158,11,0.15)" :
            bed.status === "blocked" ? "rgba(220,38,38,0.25), rgba(220,38,38,0.15)" :
            "rgba(100,116,139,0.25), rgba(100,116,139,0.15)"
          })`,
          ["--glow-color" as any]:
            bed.status === "available" ? "rgba(16,185,129,0.3)" :
            bed.status === "occupied" ? "rgba(59,130,246,0.3)" :
            bed.status === "reserved" ? "rgba(245,158,11,0.3)" :
            bed.status === "blocked" ? "rgba(220,38,38,0.3)" :
            "rgba(100,116,139,0.2)",
        }}
        data-testid={`iso-bed-${bed.id}`}
      >
        <div className="flex flex-col items-center justify-center h-full px-1">
          <BedDouble className={cn("w-3 h-3", style.text)} />
          <span className={cn("text-[7px] font-semibold leading-tight truncate max-w-full", style.text)}>
            {bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}
          </span>
        </div>

        {hasBooking && shortName && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 float-label pointer-events-none z-20">
            <div className="bg-slate-900/90 backdrop-blur border border-white/10 rounded px-1.5 py-0.5 whitespace-nowrap">
              <span className="text-[7px] font-medium text-white/90">{shortName}</span>
            </div>
          </div>
        )}

        {hasBooking && shortCheckout && (
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-20">
            <span className="text-[6px] text-slate-500 whitespace-nowrap">{shortCheckout}</span>
          </div>
        )}

        {bed.status === "blocked" && (
          <div className="absolute -top-1.5 -right-1.5 z-20">
            <div className="w-3.5 h-3.5 rounded-full bg-red-600 border border-red-400/50 flex items-center justify-center">
              <Ban className="w-2 h-2 text-white" />
            </div>
          </div>
        )}
      </button>

      <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 z-30" style={{ transform: "translateZ(2px)" }}>
        {isAvailable && !hasBooking && (
          <button onClick={(e) => { e.stopPropagation(); onAllocate(); }}
            className="w-4 h-4 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center shadow-lg"
            title="Allocate booking"
          >
            <Link2 className="w-2.5 h-2.5 text-white" />
          </button>
        )}
        {isOccupied && hasBooking && (
          <button onClick={(e) => { e.stopPropagation(); onDeallocate(); }}
            className="w-4 h-4 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center shadow-lg"
            title="Deallocate"
          >
            <Unlock className="w-2.5 h-2.5 text-white" />
          </button>
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
                  title="Allocate booking"
                >
                  <Link2 className="w-2.5 h-2.5 text-white" />
                </button>
              )}
              {isOccupied && hasBooking && (
                <button onClick={(e) => { e.stopPropagation(); onDeallocate(); }}
                  className="w-4 h-4 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center"
                  title="Deallocate"
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
