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

const IsoBedSVG = React.memo(function IsoBedSVG({ status, w = 100, h = 70 }: { status: string; w?: number; h?: number }) {
  const cfg = BED_STATUS_CFG[status] || BED_STATUS_CFG.maintenance;
  const frameColor = "#1a2744";
  const frameDark = "#111d33";
  const mattressTop = cfg.bg;
  const mattressShade = cfg.border;
  return (
    <svg width={w} height={h} viewBox="0 0 100 70" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`bedGrad-${status}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mattressTop} />
          <stop offset="100%" stopColor={mattressShade} stopOpacity="0.6" />
        </linearGradient>
        <filter id={`bedShadow-${status}`} x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor={cfg.dotColor} floodOpacity="0.25" />
        </filter>
      </defs>
      <ellipse cx="50" cy="66" rx="42" ry="3" fill="rgba(0,0,0,0.2)" />
      <rect x="4" y="56" width="6" height="10" rx="2" fill="#334155" />
      <rect x="90" y="56" width="6" height="10" rx="2" fill="#334155" />
      <rect x="4" y="52" width="6" height="10" rx="2" fill="#475569" />
      <rect x="90" y="52" width="6" height="10" rx="2" fill="#475569" />
      <rect x="2" y="24" width="96" height="34" rx="5" fill={frameColor} stroke={frameDark} strokeWidth="1" />
      <rect x="4" y="26" width="92" height="30" rx="4" fill={frameDark} />
      <rect x="6" y="28" width="88" height="26" rx="3" fill={`url(#bedGrad-${status})`} filter={`url(#bedShadow-${status})`} />
      <path d="M10 42 Q50 38 90 42" stroke={mattressShade} strokeWidth="0.8" fill="none" opacity="0.4" />
      <path d="M10 48 Q50 44 90 48" stroke={mattressShade} strokeWidth="0.5" fill="none" opacity="0.25" />
      <rect x="2" y="8" width="96" height="20" rx="5" fill={frameColor} stroke={frameDark} strokeWidth="1" />
      <rect x="4" y="10" width="44" height="16" rx="4" fill="#2a3a5c" />
      <rect x="6" y="11" width="40" height="14" rx="3" fill={mattressTop} opacity="0.7" />
      <path d="M10 14 Q26 12 42 14" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
      <path d="M10 20 Q26 18 42 20" stroke="rgba(255,255,255,0.08)" strokeWidth="1" fill="none" />
      <rect x="52" y="10" width="44" height="16" rx="4" fill="#2a3a5c" />
      <rect x="54" y="11" width="40" height="14" rx="3" fill={mattressTop} opacity="0.7" />
      <path d="M58 14 Q74 12 90 14" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" fill="none" />
      <rect x="2" y="6" width="96" height="5" rx="3" fill={frameColor} />
      <rect x="4" y="4" width="92" height="5" rx="2" fill="#2a3a5c" />
      <path d="M4 4 L96 4" stroke={cfg.border} strokeWidth="1.5" opacity="0.5" />
      <rect x="8" y="30" width="84" height="22" rx="2" fill={mattressTop} opacity="0.1" />
    </svg>
  );
});

const IsoCharacter = React.memo(function IsoCharacter({ gender, size = 32, pose = "standing" }: { gender: "male" | "female"; size?: number; pose?: "standing" | "sitting" }) {
  const isMale = gender === "male";
  const skin = isMale ? "#D4A574" : "#E8C4A0";
  const skinShade = isMale ? "#C49564" : "#D4A882";
  const hair = isMale ? "#2D1B0E" : "#1A0A00";
  const hairHl = isMale ? "#4A3520" : "#3D2816";
  const shirt = isMale ? "#3B82F6" : "#A855F7";
  const shirtDark = isMale ? "#2563EB" : "#9333EA";
  const shirtLight = isMale ? "#60A5FA" : "#C084FC";
  const pants = isMale ? "#1E293B" : "#374151";
  const pantsDark = isMale ? "#0F172A" : "#1F2937";
  const shoes = isMale ? "#1E293B" : "#7C3AED";

  if (pose === "sitting") {
    return (
      <svg width={size} height={size * 1.1} viewBox="0 0 48 54" fill="none" className="iso-char-breathe" aria-hidden="true">
        <ellipse cx="24" cy="51" rx="14" ry="2.5" fill="rgba(0,0,0,0.2)" />
        <g className="iso-char-idle">
          <rect x="14" y="38" width="8" height="8" rx="3" fill={pants} />
          <rect x="26" y="38" width="8" height="8" rx="3" fill={pants} />
          <rect x="14" y="44" width="8" height="4" rx="2" fill={pantsDark} />
          <rect x="26" y="44" width="8" height="4" rx="2" fill={pantsDark} />
          <ellipse cx="18" cy="48" rx="4" ry="2" fill={shoes} />
          <ellipse cx="30" cy="48" rx="4" ry="2" fill={shoes} />
          <rect x="12" y="22" width="24" height="18" rx="5" fill={shirt} />
          <rect x="12" y="30" width="24" height="10" rx="4" fill={shirtDark} opacity="0.4" />
          <path d="M18 28 L18 36" stroke={shirtLight} strokeWidth="0.6" opacity="0.3" />
          <path d="M24 26 L24 38" stroke={shirtLight} strokeWidth="0.4" opacity="0.2" />
          <path d="M30 28 L30 36" stroke={shirtLight} strokeWidth="0.6" opacity="0.3" />
          <rect x="6" y="25" width="7" height="13" rx="3" fill={shirt} className="iso-arm-l" />
          <rect x="35" y="25" width="7" height="13" rx="3" fill={shirt} className="iso-arm-r" />
          <ellipse cx="8" cy="38" rx="3" ry="2.5" fill={skin} />
          <ellipse cx="40" cy="38" rx="3" ry="2.5" fill={skin} />
          {!isMale && <rect x="6" y="37" width="5" height="7" rx="2" fill="#1F2937" className="iso-phone-glow" />}
          <circle cx="24" cy="14" r="8" fill={skin} />
          <ellipse cx="24" cy="16" rx="6.5" ry="5" fill={skin} />
          <circle cx="24" cy="14.5" r="7.5" fill={skin} />
          <circle cx="21" cy="14" r="1" fill="#1A0A00" />
          <circle cx="27" cy="14" r="1" fill="#1A0A00" />
          <circle cx="21.2" cy="13.6" r="0.3" fill="white" />
          <circle cx="27.2" cy="13.6" r="0.3" fill="white" />
          <path d="M22 12 Q23 11.5 24 12" stroke={hair} strokeWidth="0.5" fill="none" />
          <path d="M25 12 Q26 11.5 27 12" stroke={hair} strokeWidth="0.5" fill="none" />
          <ellipse cx="24" cy="17" rx="1.8" ry="0.8" fill={skinShade} />
          <path d="M22.5 17 Q24 18.5 25.5 17" stroke={skinShade} strokeWidth="0.5" fill="none" />
          <ellipse cx="18" cy="15.5" rx="1" ry="0.5" fill="#E8A0A0" opacity="0.3" />
          <ellipse cx="30" cy="15.5" rx="1" ry="0.5" fill="#E8A0A0" opacity="0.3" />
          {isMale ? (
            <>
              <path d="M16 12 Q16 5 24 4 Q32 5 32 12 L30.5 9 Q29 6.5 24 6 Q19 6.5 17.5 9 Z" fill={hair} />
              <path d="M18 8 Q24 6 30 8" stroke={hairHl} strokeWidth="0.8" fill="none" opacity="0.5" />
            </>
          ) : (
            <>
              <path d="M15.5 12.5 Q15.5 5 24 3.5 Q32.5 5 32.5 12.5 L31 9 Q29.5 6 24 5.5 Q18.5 6 17 9 Z" fill={hair} />
              <path d="M15.5 12.5 Q14.5 18 14.5 24 L16.5 24 Q16.5 18 17 12.5 Z" fill={hair} />
              <path d="M32.5 12.5 Q33.5 18 33.5 24 L31.5 24 Q31.5 18 31 12.5 Z" fill={hair} />
              <path d="M18 6 Q24 4 30 6" stroke={hairHl} strokeWidth="0.8" fill="none" opacity="0.4" />
            </>
          )}
          <rect x="16" y="20" width="16" height="3" rx="1.5" fill={shirt} />
        </g>
      </svg>
    );
  }

  return (
    <svg width={size} height={size * 1.4} viewBox="0 0 48 68" fill="none" className="iso-char-breathe" aria-hidden="true">
      <ellipse cx="24" cy="65" rx="12" ry="2.5" fill="rgba(0,0,0,0.25)" />
      <g className="iso-char-idle">
        <rect x="15" y="44" width="7" height="16" rx="3" fill={pants} />
        <rect x="26" y="44" width="7" height="16" rx="3" fill={pants} />
        <rect x="15" y="52" width="7" height="8" rx="2.5" fill={pantsDark} opacity="0.5" />
        <rect x="26" y="52" width="7" height="8" rx="2.5" fill={pantsDark} opacity="0.5" />
        <ellipse cx="18.5" cy="61" rx="4.5" ry="2.5" fill={shoes} />
        <ellipse cx="29.5" cy="61" rx="4.5" ry="2.5" fill={shoes} />
        <rect x="11" y="24" width="26" height="22" rx="6" fill={shirt} />
        <rect x="11" y="34" width="26" height="12" rx="4" fill={shirtDark} opacity="0.4" />
        <path d="M19 30 L19 42" stroke={shirtLight} strokeWidth="0.6" opacity="0.25" />
        <path d="M24 28 L24 44" stroke={shirtLight} strokeWidth="0.4" opacity="0.15" />
        <path d="M29 30 L29 42" stroke={shirtLight} strokeWidth="0.6" opacity="0.25" />
        <rect x="5" y="27" width="7" height="14" rx="3.5" fill={shirt} className={isMale ? "iso-arm-l" : "iso-arm-phone"} />
        <rect x="36" y="27" width="7" height="14" rx="3.5" fill={shirt} className="iso-arm-r" />
        <ellipse cx="7.5" cy="42" rx="3.5" ry="3" fill={skin} />
        <ellipse cx="40.5" cy="42" rx="3.5" ry="3" fill={skin} />
        {!isMale && <rect x="5" y="40" width="5.5" height="7" rx="2" fill="#1F2937" className="iso-phone-glow" />}
        <circle cx="24" cy="14" r="9" fill={skin} />
        <circle cx="24" cy="15" r="8.5" fill={skin} />
        <circle cx="20.5" cy="14.5" r="1.1" fill="#1A0A00" />
        <circle cx="27.5" cy="14.5" r="1.1" fill="#1A0A00" />
        <circle cx="20.8" cy="14" r="0.35" fill="white" />
        <circle cx="27.8" cy="14" r="0.35" fill="white" />
        <path d="M22.5 12.5 Q23.5 12 24.5 12.5" stroke={hair} strokeWidth="0.6" fill="none" />
        <path d="M25.5 12.5 Q26.5 12 27.5 12.5" stroke={hair} strokeWidth="0.6" fill="none" />
        <ellipse cx="24" cy="18" rx="2" ry="0.9" fill={skinShade} />
        <path d="M22.5 18 Q24 19.5 25.5 18" stroke={skinShade} strokeWidth="0.6" fill="none" />
        <ellipse cx="18" cy="16" rx="1.2" ry="0.6" fill="#E8A0A0" opacity="0.3" />
        <ellipse cx="30" cy="16" rx="1.2" ry="0.6" fill="#E8A0A0" opacity="0.3" />
        {isMale ? (
          <>
            <path d="M15 13 Q15 4.5 24 3 Q33 4.5 33 13 L31.5 10 Q30 7 24 6 Q18 7 16.5 10 Z" fill={hair} />
            <path d="M17 7.5 Q24 5.5 31 7.5" stroke={hairHl} strokeWidth="1" fill="none" opacity="0.4" />
            <path d="M15 13 L16 11 Q16 13 15 14 Z" fill={hair} opacity="0.6" />
            <path d="M33 13 L32 11 Q32 13 33 14 Z" fill={hair} opacity="0.6" />
          </>
        ) : (
          <>
            <path d="M14.5 13 Q14.5 4 24 2.5 Q33.5 4 33.5 13 L32 9.5 Q30 6 24 5 Q18 6 16 9.5 Z" fill={hair} />
            <path d="M14.5 13 Q13.5 20 13.5 28 L16 28 Q16 20 16.5 13 Z" fill={hair} />
            <path d="M33.5 13 Q34.5 20 34.5 28 L32 28 Q32 20 31.5 13 Z" fill={hair} />
            <path d="M17 6 Q24 3.5 31 6" stroke={hairHl} strokeWidth="1" fill="none" opacity="0.35" />
          </>
        )}
        <rect x="16" y="22" width="16" height="4" rx="2" fill={shirt} />
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

              {drillLevel === "building" && (() => {
                const FLOOR_W = 520;
                const SLAB_H = 14;
                const FLOOR_PAD = 16;
                const floorHeights = sortedFloors.map((floor) => {
                  const floorRooms = floor.rooms || [];
                  const bedGroups = floorRooms.length > 0 ? floorRooms : [{ id: "o", beds: floor.beds || [] }];
                  const maxBeds = Math.max(...bedGroups.map((g: any) => (g.beds || []).length), 1);
                  const rows = Math.ceil(Math.min(maxBeds, 16) / 4);
                  return 44 + rows * 72 + FLOOR_PAD;
                });
                const ROOF_H = 64;
                const totalH = floorHeights.reduce((s, h) => s + h + SLAB_H, 0) + ROOF_H + 40;

                return (
                <div className="relative iso-building-enter" style={{ width: `${FLOOR_W + 140}px`, height: `${totalH}px`, margin: "0 auto" }}>
                  {(() => {
                    let cumulY = totalH - 20;
                    return sortedFloors.map((floor, floorIdx) => {
                      const floorRooms = floor.rooms || [];
                      const allBeds = [...(floor.beds || []), ...floorRooms.flatMap((r: any) => r.beds || [])];
                      const bedGroups = floorRooms.length > 0 ? floorRooms : [{ id: "orphan", beds: floor.beds || [], roomNumber: "" }];
                      const fH = floorHeights[floorIdx];
                      cumulY -= fH + SLAB_H;
                      const yPos = cumulY;

                      return (
                        <div key={floor.id} className="absolute iso-floor-enter cursor-pointer" style={{ left: "70px", top: `${yPos}px`, width: `${FLOOR_W}px`, animationDelay: `${floorIdx * 120}ms` }} onClick={() => drillToFloor(floorIdx)}>
                          <div className="absolute -left-[75px] top-1/2 -translate-y-1/2 z-10">
                            <div className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-[0.12em] whitespace-nowrap iso-float-label" style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(251,191,36,0.08))", border: "1px solid rgba(251,191,36,0.4)", color: "#fbbf24", boxShadow: "0 4px 20px rgba(251,191,36,0.15)" }}>
                              F{floor.floorNumber}
                            </div>
                          </div>

                          <div className="absolute left-0 right-0 bottom-0 rounded-b-xl" style={{ height: `${SLAB_H}px`, background: "linear-gradient(180deg, rgba(30,45,75,0.9), rgba(18,28,50,0.95))", borderLeft: "1px solid rgba(100,140,200,0.12)", borderRight: "1px solid rgba(100,140,200,0.12)", borderBottom: "1px solid rgba(100,140,200,0.15)" }} />
                          <div className="absolute right-0 top-0 bottom-0 w-[12px] rounded-r-xl" style={{ background: "linear-gradient(90deg, rgba(18,28,50,0.6), rgba(12,20,35,0.9))", borderRight: "1px solid rgba(100,140,200,0.08)", transform: "skewY(-2deg)", transformOrigin: "top right" }} />

                          <div className="relative group iso-floor-hover rounded-xl overflow-hidden" style={{ height: `${fH}px`, background: "linear-gradient(160deg, rgba(18,28,50,0.97), rgba(12,20,38,0.95))", border: "1px solid rgba(100,140,200,0.12)", boxShadow: "0 6px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
                            <div className="absolute left-0 top-0 bottom-0 w-[4px] rounded-l-xl" style={{ background: "linear-gradient(to bottom, rgba(100,140,200,0.5), rgba(100,140,200,0.15))" }} />

                            <div className="p-3 pb-1">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
                                    F{floor.floorNumber}
                                  </div>
                                  <span className="text-[11px] font-bold text-white/80">{floor.name || `Floor ${floor.floorNumber}`}</span>
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
                                    {allBeds.filter((b: any) => b.status === "available").length} avail
                                  </span>
                                  <span className="text-[9px] text-slate-500">{allBeds.length} beds</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-amber-400/70 transition-all" />
                              </div>

                              <div className="flex gap-3 flex-wrap">
                                {bedGroups.map((group: any) => {
                                  const beds = group.beds || [];
                                  if (beds.length === 0) return null;
                                  return (
                                    <div key={group.id} className="flex-1 min-w-[160px]">
                                      {group.roomNumber && (
                                        <div className="flex items-center gap-1 mb-1.5">
                                          <DoorOpen className="w-3 h-3 text-indigo-400/60" />
                                          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(99,102,241,0.1)", color: "rgba(129,140,248,0.8)", border: "1px solid rgba(99,102,241,0.2)" }}>Room {group.roomNumber}</span>
                                        </div>
                                      )}
                                      <div className="flex gap-[6px] flex-wrap">
                                        {beds.slice(0, 16).map((bed: any) => {
                                          const cfg = BED_STATUS_CFG[bed.status] || BED_STATUS_CFG.maintenance;
                                          const hasBooking = !!bed.currentBooking && (bed.status === "occupied" || bed.status === "reserved");
                                          return (
                                            <div key={bed.id} className="relative">
                                              <button
                                                onClick={(e) => { e.stopPropagation(); onBedClick(bed.id); }}
                                                onMouseEnter={(e) => handleBedHover(bed, e)}
                                                onMouseLeave={() => setHoveredBed(null)}
                                                className="rounded-lg overflow-hidden border transition-all duration-300 hover:scale-110 hover:z-20 flex flex-col items-center justify-center"
                                                style={{ width: "68px", height: "62px", borderColor: cfg.border, background: `linear-gradient(160deg, ${cfg.bg}, rgba(15,23,42,0.4))`, boxShadow: cfg.glow }}
                                                data-testid={`iso-bed-${bed.id}`}
                                              >
                                                {hasBooking ? (
                                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                                    <IsoCharacter gender={getGender(bed)} size={28} />
                                                    <span className="text-[7px] font-bold leading-none" style={{ color: cfg.text }}>{bed.bedNumber.length > 5 ? bed.bedNumber.slice(-4) : bed.bedNumber}</span>
                                                  </div>
                                                ) : (
                                                  <div className="flex flex-col items-center justify-center gap-1">
                                                    <IsoBedSVG status={bed.status} w={48} h={34} />
                                                    <span className="text-[7px] font-bold" style={{ color: cfg.text }}>{bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}</span>
                                                  </div>
                                                )}
                                              </button>
                                              {hasBooking && (
                                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 iso-guest-label" style={{ pointerEvents: "none" }}>
                                                  <div className="px-1.5 py-0.5 rounded-md text-[7px] font-bold" style={{ background: `${cfg.dotColor}dd`, color: "white", boxShadow: `0 2px 10px ${cfg.dotColor}50` }}>
                                                    {(getGuestName(bed) || "Guest").split(" ")[0].slice(0, 8)}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                        {beds.length > 16 && <span className="text-[9px] text-slate-500 self-center ml-1">+{beds.length - 16}</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(90deg, transparent, rgba(100,140,200,0.25), transparent)" }} />
                          </div>
                        </div>
                      );
                    });
                  })()}

                  <div className="absolute" style={{ left: "70px", top: `${totalH - floorHeights.reduce((s, h) => s + h + SLAB_H, 0) - ROOF_H - 20}px`, width: `${FLOOR_W}px` }}>
                    <div className="rounded-t-2xl overflow-hidden" style={{ height: `${ROOF_H}px`, background: "linear-gradient(160deg, rgba(18,28,50,0.97), rgba(12,20,38,0.95))", border: "1px solid rgba(251,191,36,0.25)", borderBottom: "none" }}>
                      <div className="absolute top-0 left-0 right-0 h-[6px] rounded-t-2xl" style={{ background: "linear-gradient(90deg, #166534, #15803d, #22c55e, #4ade80, #22c55e, #15803d, #166534)" }} />
                      <div className="flex items-center justify-center h-full gap-4 px-5 pt-1">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/30 iso-logo-pulse">
                          <span className="text-sm font-black text-white">H²</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white tracking-wider uppercase">{propertyName.length > 22 ? propertyName.slice(0, 22) + "…" : propertyName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="w-8 h-[2px] bg-gradient-to-r from-amber-500 to-transparent" />
                            <span className="text-[8px] text-amber-400/60 uppercase tracking-[0.2em] font-semibold">Roof Garden</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="h-[3px] iso-neon-line" />
                  </div>
                </div>
                );
              })()}

              {drillLevel === "floor" && activeFloor && (
                <div className="iso-drill-enter w-full" style={{ maxWidth: "1100px", margin: "0 auto" }}>
                  <div className="flex items-center justify-between mb-5">
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

                  {(activeFloor.rooms || []).length === 0 && (activeFloor.beds || []).length > 0 && (
                    <div className="iso-room-cutaway iso-room-enter p-6 rounded-2xl" style={{ background: "linear-gradient(160deg, rgba(20,32,60,0.97), rgba(14,22,42,0.95))", border: "1px solid rgba(100,140,200,0.18)", boxShadow: "0 12px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                      <div className="iso-room-wall-left" />
                      <div className="iso-room-wall-back" />
                      <div className="iso-room-floor-shine" />
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                          <DoorOpen className="w-4 h-4 text-indigo-400/60" />
                          <span className="text-sm font-semibold text-white/80">All Beds</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
                            {(activeFloor.beds || []).filter((b: any) => b.status === "available").length} available
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                          {(activeFloor.beds || []).map((bed: any, bIdx: number) => (
                            <IsoBedScene key={bed.id} bed={bed} idx={bIdx} onBedClick={onBedClick} onAllocate={onAllocate} onDeallocate={onDeallocate} onHover={handleBedHover} onLeave={() => setHoveredBed(null)} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {(activeFloor.rooms || []).length > 0 && (
                    <div className="iso-floor-grid">
                      {(activeFloor.rooms || []).map((room: any, rIdx: number) => {
                        const roomBeds = room.beds || [];
                        const availCount = roomBeds.filter((b: any) => b.status === "available").length;
                        const bookedCount = roomBeds.filter((b: any) => b.status === "occupied" || b.status === "reserved").length;
                        return (
                          <div key={room.id} className="iso-room-cutaway iso-room-enter" style={{ animationDelay: `${rIdx * 120}ms` }}>
                            <div className="iso-room-wall-left" />
                            <div className="iso-room-wall-back" />
                            <div className="iso-room-floor-shine" />

                            <div className="relative z-10 p-5">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <div className="iso-room-label">
                                    <DoorOpen className="w-3.5 h-3.5" />
                                    <span>Room {room.roomNumber}</span>
                                  </div>
                                  {room.typology && <span className="text-[9px] px-2 py-0.5 rounded-md font-medium" style={{ background: "rgba(99,102,241,0.12)", color: "rgba(129,140,248,0.85)", border: "1px solid rgba(99,102,241,0.25)" }}>{room.typology}</span>}
                                  {room.hasSharedWashroom && <span className="text-[8px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400/70 border border-cyan-500/20">WC</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-semibold" style={{ color: "#34d399" }}>{availCount} avail</span>
                                  <span className="text-[10px] font-semibold" style={{ color: "#60a5fa" }}>{bookedCount} booked</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                                {roomBeds.map((bed: any, bIdx: number) => (
                                  <IsoBedScene key={bed.id} bed={bed} idx={bIdx} onBedClick={onBedClick} onAllocate={onAllocate} onDeallocate={onDeallocate} onHover={handleBedHover} onLeave={() => setHoveredBed(null)} />
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
        .iso-room-enter { animation: roomEnter 0.5s cubic-bezier(0.25,0.46,0.45,0.94) both; }
        @keyframes bedEnter { from { opacity: 0.2; transform: scale(0.92) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .iso-bed-enter { animation: bedEnter 0.5s cubic-bezier(0.25,0.46,0.45,0.94) both; }
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

        .iso-floor-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
          gap: 20px;
        }
        @media (max-width: 640px) { .iso-floor-grid { grid-template-columns: 1fr; } }

        .iso-room-cutaway {
          position: relative;
          border-radius: 20px;
          overflow: visible;
          background: linear-gradient(160deg, rgba(16,26,52,0.98), rgba(10,18,36,0.96));
          border: 2px solid rgba(60,90,150,0.2);
          box-shadow:
            0 16px 60px rgba(0,0,0,0.7),
            0 0 0 1px rgba(60,90,150,0.08),
            inset 0 1px 0 rgba(255,255,255,0.06),
            inset -8px 0 30px rgba(0,0,0,0.15),
            inset 0 -8px 30px rgba(0,0,0,0.1);
          transform: perspective(1200px) rotateY(-1.5deg) rotateX(1.5deg);
          transition: transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.5s ease;
        }
        .iso-room-cutaway:hover {
          transform: perspective(1200px) rotateY(0deg) rotateX(0deg) translateY(-4px);
          box-shadow:
            0 24px 80px rgba(0,0,0,0.8),
            0 0 0 1px rgba(80,120,180,0.15),
            inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .iso-room-wall-left {
          position: absolute; left: 0; top: 0; bottom: 0; width: 10px; z-index: 2;
          background: linear-gradient(to bottom, rgba(80,120,180,0.5), rgba(40,65,110,0.15));
          border-radius: 20px 0 0 20px;
          box-shadow: inset -3px 0 8px rgba(0,0,0,0.3);
        }
        .iso-room-wall-back {
          position: absolute; left: 0; right: 0; top: 0; height: 10px; z-index: 2;
          background: linear-gradient(to right, rgba(80,120,180,0.5), rgba(40,65,110,0.15));
          border-radius: 20px 20px 0 0;
          box-shadow: inset 0 -3px 8px rgba(0,0,0,0.3);
        }
        .iso-room-wall-left::after {
          content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 1px;
          background: linear-gradient(to bottom, rgba(120,160,220,0.3), transparent);
        }
        .iso-room-wall-back::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
          background: linear-gradient(to right, rgba(120,160,220,0.3), transparent);
        }
        .iso-room-floor-shine {
          position: absolute; bottom: 0; left: 0; right: 0; height: 50%;
          background: linear-gradient(to top, rgba(80,120,180,0.05), transparent);
          pointer-events: none;
        }
        .iso-room-floor-shine::before {
          content: ''; position: absolute; bottom: 10px; left: 15%; right: 15%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(120,160,220,0.1), transparent);
        }
        .iso-room-label {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 14px; border-radius: 12px;
          background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(99,102,241,0.05));
          border: 1px solid rgba(99,102,241,0.3);
          color: rgba(129,140,248,0.95);
          font-size: 13px; font-weight: 800;
          box-shadow: 0 2px 12px rgba(99,102,241,0.1);
        }

        .iso-bed-scene-wrap { perspective: 600px; }
        .iso-bed-scene {
          position: relative;
          border: none; background: none; outline: none; padding: 0;
          transition: transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94);
        }
        .iso-bed-scene:hover { transform: translateY(-6px) scale(1.03); }
        .iso-bed-halo {
          position: absolute; inset: -10px; border-radius: 50%;
          pointer-events: none; z-index: 0;
          animation: haloGlow 3s ease-in-out infinite;
        }
        @keyframes haloGlow { 0%, 100% { opacity: 0.6; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } }
        .iso-bed-platform {
          position: relative; z-index: 1;
          background: linear-gradient(160deg, rgba(18,28,55,0.95), rgba(12,20,42,0.98));
          border: 1px solid; border-radius: 16px;
          backdrop-filter: blur(8px);
          overflow: hidden;
        }
        .iso-bed-name-tag {
          display: inline-block;
          padding: 2px 10px; border-radius: 8px;
          font-size: 10px; font-weight: 800; color: white;
          letter-spacing: 0.05em;
        }
        .iso-guest-info-card {
          padding: 4px 8px; border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(4px);
          text-align: center;
        }
        .iso-bed-status-dot {
          position: absolute; top: 8px; right: 8px;
          width: 8px; height: 8px; border-radius: 50%;
          z-index: 10;
          animation: statusDot 2s ease-in-out infinite;
        }
        @keyframes bedSceneFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        .iso-bed-platform { animation: bedSceneFloat 6s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .iso-char-breathe, .iso-char-idle, .iso-arm-phone, .iso-arm-r, .iso-arm-l,
          .iso-phone-glow, .iso-bed-cell, .iso-guest-label, .iso-bed-card-float,
          .iso-ambient-orb, .iso-logo-pulse, .iso-status-dot, .iso-float-label,
          .iso-neon-line, .iso-bed-scene-wrap, .iso-bed-halo, .iso-bed-platform { animation: none !important; }
          .iso-floor-hover:hover, .iso-bed-scene:hover, .iso-room-cutaway:hover { transform: none; }
        }
      `}</style>
    </div>
  );
}

function IsoBedScene({ bed, idx, onBedClick, onAllocate, onDeallocate, onHover, onLeave }: {
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
    <div className="iso-bed-enter iso-bed-scene-wrap relative group/bed" style={{ animationDelay: `${Math.min(idx, 20) * 60}ms` }}>
      <button
        onClick={() => onBedClick(bed.id)}
        onMouseEnter={(e) => onHover(bed, e)}
        onMouseLeave={onLeave}
        className="iso-bed-scene w-full cursor-pointer"
        data-testid={`iso-bed-${bed.id}`}
      >
        <div className="iso-bed-halo" style={{ background: `radial-gradient(ellipse at center, ${cfg.dotColor}30 0%, ${cfg.dotColor}08 50%, transparent 70%)`, boxShadow: `0 0 40px ${cfg.dotColor}20, inset 0 0 20px ${cfg.dotColor}10` }} />

        <div className="iso-bed-platform" style={{ borderColor: `${cfg.border}60`, boxShadow: `0 4px 24px ${cfg.dotColor}25, 0 0 1px ${cfg.border}` }}>
          <div className="relative flex flex-col items-center justify-center py-4 px-3 min-h-[180px]">
            {showChar && (
              <>
                <div className="relative">
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-20">
                    <IsoCharacter gender={getGender(bed)} size={48} pose="sitting" />
                  </div>
                  <div className="relative z-10 mt-8">
                    <IsoBedSVG status={bed.status} w={110} h={70} />
                  </div>
                </div>
                <div className="mt-2.5 text-center">
                  <div className="iso-bed-name-tag" style={{ background: `${cfg.dotColor}dd`, boxShadow: `0 2px 12px ${cfg.dotColor}50` }}>
                    {bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}
                  </div>
                  {guestName && (
                    <div className="iso-guest-info-card mt-2">
                      <p className="text-[11px] font-bold text-white/90">{guestName.split(" ").slice(0, 2).join(" ")}</p>
                      {bed.currentBooking?.bookingCode && <p className="text-[9px] text-amber-400/80 font-mono mt-0.5">{bed.currentBooking.bookingCode}</p>}
                      {checkoutDate && <p className="text-[8px] text-white/40 mt-0.5">Check-out: {checkoutDate}</p>}
                    </div>
                  )}
                </div>
              </>
            )}

            {isAvailable && (
              <div className="flex flex-col items-center gap-3">
                <div style={{ filter: `drop-shadow(0 0 12px ${cfg.dotColor}50)` }}>
                  <IsoBedSVG status="available" w={120} h={78} />
                </div>
                <div className="iso-bed-name-tag" style={{ background: `${cfg.dotColor}cc`, boxShadow: `0 2px 10px ${cfg.dotColor}40` }}>
                  {bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}
                </div>
                <span className="text-[10px] font-bold px-4 py-1.5 rounded-full" style={{ background: `${cfg.dotColor}15`, color: cfg.text, border: `1px solid ${cfg.dotColor}30` }}>Available</span>
              </div>
            )}

            {bed.status === "reserved" && !showChar && (
              <div className="flex flex-col items-center gap-3">
                <div style={{ filter: `drop-shadow(0 0 10px ${cfg.dotColor}40)` }}>
                  <IsoBedSVG status="reserved" w={120} h={78} />
                </div>
                <div className="iso-bed-name-tag" style={{ background: `${cfg.dotColor}cc` }}>
                  {bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}
                </div>
                <span className="text-[10px] font-bold px-4 py-1.5 rounded-full" style={{ background: `${cfg.dotColor}15`, color: cfg.text }}>Reserved</span>
              </div>
            )}

            {bed.status === "blocked" && (
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <IsoBedSVG status="blocked" w={110} h={70} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Ban className="w-10 h-10 text-red-400/60" />
                  </div>
                </div>
                <div className="iso-bed-name-tag" style={{ background: `${cfg.dotColor}cc` }}>
                  {bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}
                </div>
                <span className="text-[9px] font-bold px-3 py-1 rounded uppercase" style={{ background: "rgba(220,38,38,0.15)", color: "#f87171" }}>Blocked</span>
              </div>
            )}

            {bed.status === "maintenance" && (
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <IsoBedSVG status="maintenance" w={110} h={70} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <AlertTriangle className="w-10 h-10 text-slate-400/60" />
                  </div>
                </div>
                <div className="iso-bed-name-tag" style={{ background: `${cfg.dotColor}cc` }}>
                  {bed.bedNumber.length > 6 ? bed.bedNumber.slice(-5) : bed.bedNumber}
                </div>
                <span className="text-[9px] text-slate-400">Maintenance</span>
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-[4px] rounded-b-2xl" style={{ background: `linear-gradient(90deg, transparent, ${cfg.dotColor}60, transparent)` }} />
        </div>

        <div className="iso-bed-status-dot" style={{ background: cfg.dotColor, boxShadow: `0 0 8px ${cfg.dotColor}80` }} />
      </button>

      <div className="absolute -top-2 -right-2 opacity-0 group-hover/bed:opacity-100 transition-all duration-300 flex gap-1 z-30">
        {isAvailable && !hasBooking && (
          <button onClick={(e) => { e.stopPropagation(); onAllocate(bed.id); }} className="w-6 h-6 rounded-full bg-blue-500/90 hover:bg-blue-500 flex items-center justify-center shadow-lg border border-blue-400/30" aria-label="Allocate booking"><Link2 className="w-3.5 h-3.5 text-white" /></button>
        )}
        {isOccupied && hasBooking && (
          <button onClick={(e) => { e.stopPropagation(); onDeallocate(bed.id); }} className="w-6 h-6 rounded-full bg-orange-500/90 hover:bg-orange-500 flex items-center justify-center shadow-lg border border-orange-400/30" aria-label="Deallocate booking"><Unlock className="w-3.5 h-3.5 text-white" /></button>
        )}
      </div>
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
        data-testid={`iso-bed-card-${bed.id}`}
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
