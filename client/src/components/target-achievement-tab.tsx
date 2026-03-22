import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Target, TrendingUp, Building2, Bed,
  Settings2, Filter, BarChart3, Trophy, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, Save, RotateCcw,
  Sun, Moon, Maximize2, Minimize2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from "recharts";

interface PropertyTargetData {
  propertyId: string;
  propertyName: string;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  bookedBeds: number;
  avgBedPrice: number;
  targetAmount: number;
  autoTarget: number;
  achievedAmount: number;
  remainingAmount: number;
  achievementPercent: number;
  occupancyPercent: number;
  targetOccupancyPercent: number;
  hasCustomTarget: boolean;
  notes: string | null;
}

interface Summary {
  totalTarget: number;
  totalAchieved: number;
  totalRemaining: number;
  totalBeds: number;
  totalOccupied: number;
  overallOccupancy: number;
  overallAchievement: number;
  topProperty: PropertyTargetData | null;
  lowestProperty: PropertyTargetData | null;
}

interface TrendData {
  month: string;
  totalAchieved: number;
  bookingCount: number;
}

type ThemeMode = "dark" | "light";

const MONTHS = [
  { value: "1", label: "January" }, { value: "2", label: "February" },
  { value: "3", label: "March" }, { value: "4", label: "April" },
  { value: "5", label: "May" }, { value: "6", label: "June" },
  { value: "7", label: "July" }, { value: "8", label: "August" },
  { value: "9", label: "September" }, { value: "10", label: "October" },
  { value: "11", label: "November" }, { value: "12", label: "December" },
];

const BOOKING_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "confirmed", label: "Confirmed" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "pending_approval", label: "Pending Approval" },
];

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `\u20B9${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `\u20B9${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `\u20B9${(amount / 1000).toFixed(1)}K`;
  return `\u20B9${amount.toLocaleString("en-IN")}`;
}

const t = (mode: ThemeMode) => {
  const dark = mode === "dark";
  return {
    bg: dark ? "bg-[#050505]" : "bg-slate-50",
    cardBg: dark ? "bg-white/[0.03] backdrop-blur-sm" : "bg-white shadow-lg",
    cardBorder: dark ? "border-white/[0.06]" : "border-slate-200/80",
    cardHoverBorder: dark ? "hover:border-white/[0.12]" : "hover:border-slate-300",
    textPrimary: dark ? "text-white" : "text-slate-800",
    textSecondary: dark ? "text-white/60" : "text-slate-500",
    textMuted: dark ? "text-white/40" : "text-slate-400",
    textFaint: dark ? "text-white/30" : "text-slate-300",
    textLabel: dark ? "text-white/30" : "text-slate-400",
    divider: dark ? "divide-white/[0.04]" : "divide-slate-100",
    borderSubtle: dark ? "border-white/[0.04]" : "border-slate-100",
    hoverRow: dark ? "hover:bg-white/[0.02]" : "hover:bg-slate-50/80",
    filterBg: dark ? "bg-white/[0.04] border-white/[0.08] text-white/80" : "bg-white border-slate-200 text-slate-700",
    selectContent: dark ? "bg-[#1a1a2e] border-white/10" : "bg-white border-slate-200",
    progressBg: dark ? "bg-white/[0.06]" : "bg-slate-100",
    skeletonBg: dark ? "bg-white/10" : "bg-slate-200",
    tooltipBg: dark ? "bg-[#1a1a2e]/95 border-white/10" : "bg-white/95 border-slate-200",
    tooltipText: dark ? "text-white/50" : "text-slate-500",
    chartGrid: dark ? "rgba(255,255,255,0.06)" : "#e2e8f0",
    chartTick: dark ? "rgba(255,255,255,0.4)" : "#64748b",
    legendText: dark ? "text-white/60" : "text-slate-500",
    dialogBg: dark ? "bg-[#0f0f1a] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900",
    dialogInputBg: dark ? "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20" : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400",
    dialogLabel: dark ? "text-white/60" : "text-slate-600",
    dialogDesc: dark ? "text-white/40" : "text-slate-500",
    dialogHint: dark ? "text-white/25" : "text-slate-400",
    btnGhost: dark ? "text-white/40 hover:text-white hover:bg-white/[0.06]" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
    btnOutline: dark ? "text-white/40 hover:text-white hover:bg-white/[0.06] border-white/[0.08]" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-slate-200",
    emeraldAccent: dark ? "text-emerald-400" : "text-emerald-600",
    amberAccent: dark ? "text-amber-400" : "text-amber-600",
    roseAccent: dark ? "text-rose-400" : "text-rose-600",
    indigoAccent: dark ? "text-indigo-400" : "text-indigo-600",
    emeraldBadge: dark ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200",
    amberBadge: dark ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-200",
    roseBadge: dark ? "bg-rose-500/20 text-rose-400 border-rose-500/30" : "bg-rose-50 text-rose-700 border-rose-200",
    indigoBadge: dark ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-indigo-50 text-indigo-700 border-indigo-200",
    topCardBorder: dark ? "border-emerald-500/20 hover:border-emerald-500/30" : "border-emerald-200 hover:border-emerald-300",
    topCardOverlay: dark ? "from-emerald-500/[0.05]" : "from-emerald-500/[0.04]",
    bottomCardBorder: dark ? "border-rose-500/20 hover:border-rose-500/30" : "border-rose-200 hover:border-rose-300",
    bottomCardOverlay: dark ? "from-rose-500/[0.05]" : "from-rose-500/[0.04]",
    glowOpacity: dark ? "opacity-[0.07] group-hover:opacity-[0.12]" : "opacity-[0.04] group-hover:opacity-[0.08]",
  };
};

function getAchievementColor(percent: number, mode: ThemeMode): string {
  const s = t(mode);
  if (percent >= 90) return s.emeraldAccent;
  if (percent >= 50) return s.amberAccent;
  return s.roseAccent;
}

function getAchievementBg(percent: number): string {
  if (percent >= 90) return "bg-gradient-to-r from-emerald-500 to-emerald-400";
  if (percent >= 50) return "bg-gradient-to-r from-amber-500 to-amber-400";
  return "bg-gradient-to-r from-rose-500 to-rose-400";
}

function getAchievementBadge(percent: number, mode: ThemeMode): { label: string; color: string } {
  const s = t(mode);
  if (percent >= 90) return { label: "On Track", color: s.emeraldBadge };
  if (percent >= 50) return { label: "Near Target", color: s.amberBadge };
  return { label: "Below Target", color: s.roseBadge };
}

export default function TargetAchievementTab() {
  const { toast } = useToast();
  const [mode, setMode] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem("target_tab_theme") as ThemeMode) || "dark"; } catch { return "dark"; }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyTargetData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [allProperties, setAllProperties] = useState<{ id: string; name: string }[]>([]);
  const [filterProperty, setFilterProperty] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyTargetData | null>(null);
  const [editForm, setEditForm] = useState({ targetOccupancyPercent: 100, customTargetOverride: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const s = t(mode);

  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    try { localStorage.setItem("target_tab_theme", next); } catch {}
  };

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const getAuthHeaders = (): Record<string, string> => {
    const authData = localStorage.getItem("hsquare_auth");
    if (authData) {
      try {
        const { token } = JSON.parse(authData);
        if (token) return { Authorization: `Bearer ${token}` };
      } catch {}
    }
    return {};
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const params = new URLSearchParams();
      if (filterProperty !== "all") params.set("propertyId", filterProperty);
      if (filterMonth !== "all") params.set("month", filterMonth);
      if (filterStatus !== "all") params.set("bookingStatus", filterStatus);

      const [targetRes, trendRes] = await Promise.all([
        fetch(`/api/admin/targets?${params}`, { headers }).then(r => r.json()),
        fetch(`/api/admin/targets/trends?${filterProperty !== "all" ? `propertyId=${filterProperty}` : ""}`, { headers }).then(r => r.json()),
      ]);

      setProperties(targetRes.properties || []);
      setSummary(targetRes.summary || null);
      setTrends(trendRes || []);

      if (allProperties.length === 0 && targetRes.properties) {
        setAllProperties(targetRes.properties.map((p: PropertyTargetData) => ({ id: p.propertyId, name: p.propertyName })));
      }
    } catch (err) {
      console.error("Error fetching target data:", err);
      toast({ title: "Error", description: "Failed to load target data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterProperty, filterMonth, filterStatus]);

  const handleSaveTarget = async () => {
    if (!editingProperty) return;
    setSaving(true);
    try {
      const body: any = {
        targetOccupancyPercent: editForm.targetOccupancyPercent,
        notes: editForm.notes || null,
      };
      if (editForm.customTargetOverride) {
        body.customTargetOverride = parseInt(editForm.customTargetOverride);
      } else {
        body.customTargetOverride = null;
      }

      await fetch(`/api/admin/targets/${editingProperty.propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      toast({ title: "Target Updated", description: `Target for ${editingProperty.propertyName} has been updated.` });
      setEditingProperty(null);
      fetchData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to update target", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const chartBarData = properties.map(p => ({
    name: p.propertyName.length > 15 ? p.propertyName.substring(0, 15) + "\u2026" : p.propertyName,
    target: p.targetAmount,
    achieved: p.achievedAmount,
  }));

  const occupancyChartData = properties.map(p => ({
    name: p.propertyName.length > 15 ? p.propertyName.substring(0, 15) + "\u2026" : p.propertyName,
    occupancy: p.occupancyPercent,
    achievement: p.achievementPercent,
  }));

  const ThemedTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`${s.tooltipBg} backdrop-blur-xl p-3.5 rounded-xl border shadow-2xl`}
        >
          <p className={`text-xs font-medium ${s.tooltipText} mb-1.5`}>{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === "number" ? (entry.dataKey?.includes("target") || entry.dataKey?.includes("achieved") || entry.dataKey === "totalAchieved"
                ? formatCurrency(entry.value) : entry.value.toLocaleString()) : entry.value}
            </p>
          ))}
        </motion.div>
      );
    }
    return null;
  };

  if (loading && !summary) {
    return (
      <div ref={containerRef} className={`${s.bg} space-y-6 p-4 rounded-2xl ${isFullscreen ? "overflow-y-auto" : ""}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`${s.cardBg} border ${s.cardBorder} rounded-2xl p-5`}>
              <Skeleton className={`h-4 w-24 mb-3 ${s.skeletonBg}`} />
              <Skeleton className={`h-8 w-32 mb-2 ${s.skeletonBg}`} />
              <Skeleton className={`h-3 w-20 ${s.skeletonBg}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${s.bg} space-y-6 p-4 rounded-2xl transition-colors duration-300 ${isFullscreen ? "overflow-y-auto" : ""}`}
      data-testid="target-achievement-tab"
    >
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          className={`gap-2 ${s.btnOutline} border rounded-lg h-8 px-3 text-xs`}
          onClick={toggleMode}
          data-testid="toggle-theme-mode"
        >
          {mode === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {mode === "dark" ? "Light" : "Dark"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`gap-2 ${s.btnOutline} border rounded-lg h-8 px-3 text-xs`}
          onClick={toggleFullscreen}
          data-testid="toggle-fullscreen"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          {isFullscreen ? "Exit" : "Fullscreen"}
        </Button>
      </div>

      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          <SummaryCard mode={mode} title="Total Target" value={formatCurrency(summary.totalTarget)} icon={<Target className="w-5 h-5" />} gradient="from-indigo-500 to-violet-500" glowColor="shadow-indigo-500/20" subtitle={`${properties.length} properties`} />
          <SummaryCard mode={mode} title="Total Achieved" value={formatCurrency(summary.totalAchieved)} icon={<Trophy className="w-5 h-5" />} gradient="from-emerald-500 to-teal-500" glowColor="shadow-emerald-500/20" subtitle={`${summary.overallAchievement}% of target`} />
          <SummaryCard mode={mode} title="Remaining" value={formatCurrency(summary.totalRemaining)} icon={<TrendingUp className="w-5 h-5" />} gradient="from-amber-500 to-orange-500" glowColor="shadow-amber-500/20" subtitle="To reach target" />
          <SummaryCard mode={mode} title="Overall Occupancy" value={`${summary.overallOccupancy}%`} icon={<Bed className="w-5 h-5" />} gradient="from-cyan-500 to-blue-500" glowColor="shadow-cyan-500/20" subtitle={`${summary.totalOccupied}/${summary.totalBeds} beds`} />
          <SummaryCard mode={mode} title="Achievement Rate" value={`${summary.overallAchievement}%`} icon={<BarChart3 className="w-5 h-5" />}
            gradient={summary.overallAchievement >= 90 ? "from-emerald-500 to-teal-500" : summary.overallAchievement >= 50 ? "from-amber-500 to-orange-500" : "from-rose-500 to-red-500"}
            glowColor={summary.overallAchievement >= 90 ? "shadow-emerald-500/20" : summary.overallAchievement >= 50 ? "shadow-amber-500/20" : "shadow-rose-500/20"}
            subtitle={summary.overallAchievement >= 90 ? "On Track" : summary.overallAchievement >= 50 ? "Near Target" : "Below Target"}
          />
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <div className={`${s.cardBg} border ${s.cardBorder} rounded-2xl p-4`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className={`h-4 w-4 ${s.textMuted}`} />
              <span className={`text-sm font-medium ${s.textSecondary}`}>Filters</span>
              <Button variant="ghost" size="sm" className={`h-7 px-2 ${s.btnGhost}`} onClick={() => setShowFilters(!showFilters)} data-testid="toggle-filters">
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <Button variant="ghost" size="sm" className={`gap-1.5 ${s.btnOutline} border`} onClick={() => { setFilterProperty("all"); setFilterMonth("all"); setFilterStatus("all"); }} data-testid="button-reset-filters">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className={`grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t ${s.borderSubtle}`}>
              <div>
                <Label className={`text-xs ${s.textMuted} mb-1 block`}>Property</Label>
                <Select value={filterProperty} onValueChange={setFilterProperty}>
                  <SelectTrigger className={`h-9 ${s.filterBg}`} data-testid="filter-property"><SelectValue placeholder="All Properties" /></SelectTrigger>
                  <SelectContent className={s.selectContent}>
                    <SelectItem value="all">All Properties</SelectItem>
                    {allProperties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={`text-xs ${s.textMuted} mb-1 block`}>Month</Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className={`h-9 ${s.filterBg}`} data-testid="filter-month"><SelectValue placeholder="All Months" /></SelectTrigger>
                  <SelectContent className={s.selectContent}>
                    <SelectItem value="all">All Months</SelectItem>
                    {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={`text-xs ${s.textMuted} mb-1 block`}>Booking Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className={`h-9 ${s.filterBg}`} data-testid="filter-status"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                  <SelectContent className={s.selectContent}>
                    {BOOKING_STATUSES.map(st => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {summary?.topProperty && summary?.lowestProperty && properties.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`relative ${s.cardBg} border ${s.topCardBorder} rounded-2xl p-5 overflow-hidden group transition-all duration-300`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${s.topCardOverlay} to-transparent pointer-events-none`} />
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold ${s.emeraldAccent} uppercase tracking-[0.15em]`}>Top Performer</p>
                <p className={`text-base font-bold ${s.textPrimary} truncate mt-0.5`}>{summary.topProperty.propertyName}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-sm ${s.textSecondary}`}>{summary.topProperty.achievementPercent}% achieved</span>
                  <span className={`text-sm ${s.textFaint}`}>&bull;</span>
                  <span className={`text-sm ${s.textSecondary}`}>{summary.topProperty.occupancyPercent}% occupancy</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`relative ${s.cardBg} border ${s.bottomCardBorder} rounded-2xl p-5 overflow-hidden group transition-all duration-300`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${s.bottomCardOverlay} to-transparent pointer-events-none`} />
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/[0.03] rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 shadow-lg shadow-rose-500/25">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold ${s.roseAccent} uppercase tracking-[0.15em]`}>Needs Attention</p>
                <p className={`text-base font-bold ${s.textPrimary} truncate mt-0.5`}>{summary.lowestProperty.propertyName}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-sm ${s.textSecondary}`}>{summary.lowestProperty.achievementPercent}% achieved</span>
                  <span className={`text-sm ${s.textFaint}`}>&bull;</span>
                  <span className={`text-sm ${s.textSecondary}`}>{summary.lowestProperty.occupancyPercent}% occupancy</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard mode={mode} title="Target vs Achievement" description="Property-wise comparison" loading={loading}>
          {chartBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartBarData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={s.chartGrid} vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: s.chartTick }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: s.chartTick }} tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip content={<ThemedTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 8 }} formatter={(value: string) => <span className={`${s.legendText} text-xs`}>{value}</span>} />
                <Bar dataKey="target" name="Target" fill="#818cf8" radius={[6, 6, 0, 0]} animationDuration={1200} />
                <Bar dataKey="achieved" name="Achieved" fill="#34d399" radius={[6, 6, 0, 0]} animationBegin={200} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={`flex items-center justify-center h-48 text-sm ${s.textFaint}`}>No data available</div>
          )}
        </ChartCard>

        <ChartCard mode={mode} title="Occupancy & Achievement %" description="Property-wise percentages" loading={loading}>
          {occupancyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={occupancyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={s.chartGrid} vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: s.chartTick }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: s.chartTick }} domain={[0, 100]} />
                <Tooltip content={<ThemedTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 8 }} formatter={(value: string) => <span className={`${s.legendText} text-xs`}>{value}</span>} />
                <Bar dataKey="occupancy" name="Occupancy %" fill="#22d3ee" radius={[6, 6, 0, 0]} animationDuration={1200} />
                <Bar dataKey="achievement" name="Achievement %" fill="#a78bfa" radius={[6, 6, 0, 0]} animationBegin={200} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={`flex items-center justify-center h-48 text-sm ${s.textFaint}`}>No data available</div>
          )}
        </ChartCard>

        <ChartCard mode={mode} title="Monthly Achievement Trend" description="Revenue trend over last 12 months" className="lg:col-span-2" loading={loading}>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={mode === "dark" ? 0.4 : 0.3} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={s.chartGrid} vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: s.chartTick }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: s.chartTick }} tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                <Tooltip content={<ThemedTooltip />} />
                <Area type="monotone" dataKey="totalAchieved" name="Revenue" stroke="#818cf8" strokeWidth={3} fill="url(#trendGrad)" animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={`flex items-center justify-center h-48 text-sm ${s.textFaint}`}>No trend data available</div>
          )}
        </ChartCard>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
        <div className={`${s.cardBg} border ${s.cardBorder} rounded-2xl overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${s.borderSubtle} flex items-center justify-between`}>
            <h3 className={`text-lg font-semibold ${s.textPrimary}`}>Property-wise Details</h3>
            <span className={`text-xs font-medium ${s.textMuted} ${mode === "dark" ? "bg-white/[0.06]" : "bg-slate-100"} px-2.5 py-1 rounded-full`}>
              {properties.length} {properties.length === 1 ? "property" : "properties"}
            </span>
          </div>
          <div>
            {properties.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className={`h-10 w-10 ${s.textFaint} mb-3`} />
                <p className={`text-sm ${s.textMuted}`}>No properties found</p>
                <p className={`text-xs ${s.textFaint} mt-1`}>Adjust your filters or add properties</p>
              </div>
            ) : (
              <div className={`${s.divider} divide-y`}>
                {properties.map((prop, index) => (
                  <PropertyRow key={prop.propertyId} property={prop} index={index} mode={mode} onEdit={() => {
                    setEditingProperty(prop);
                    setEditForm({ targetOccupancyPercent: prop.targetOccupancyPercent, customTargetOverride: prop.hasCustomTarget ? String(prop.targetAmount) : "", notes: prop.notes || "" });
                  }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <Dialog open={!!editingProperty} onOpenChange={(open) => { if (!open) setEditingProperty(null); }}>
        <DialogContent className={`sm:max-w-md ${s.dialogBg}`}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${s.textPrimary}`}>
              <Settings2 className={`h-5 w-5 ${s.indigoAccent}`} />
              Set Target — {editingProperty?.propertyName}
            </DialogTitle>
            <DialogDescription className={s.dialogDesc}>
              Configure target occupancy and optional custom target override for this property.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div>
              <Label className={`text-sm ${s.dialogLabel}`}>Target Occupancy %</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" min={0} max={100} value={editForm.targetOccupancyPercent}
                  onChange={(e) => setEditForm({ ...editForm, targetOccupancyPercent: parseInt(e.target.value) || 0 })}
                  className={`w-24 ${s.dialogInputBg}`} data-testid="input-target-occupancy" />
                <span className={`text-sm ${s.textMuted}`}>%</span>
                <span className={`text-xs ${s.dialogHint} ml-2`}>
                  Auto target: {editingProperty ? formatCurrency(Math.round(editingProperty.autoTarget * (editForm.targetOccupancyPercent / (editingProperty.targetOccupancyPercent || 100)))) : "\u2014"}
                </span>
              </div>
            </div>
            <div>
              <Label className={`text-sm ${s.dialogLabel}`}>Custom Target Override (\u20B9)</Label>
              <Input type="number" value={editForm.customTargetOverride}
                onChange={(e) => setEditForm({ ...editForm, customTargetOverride: e.target.value })}
                placeholder="Leave empty for auto-calculated"
                className={`mt-1 ${s.dialogInputBg}`} data-testid="input-custom-target" />
              <p className={`text-xs ${s.dialogHint} mt-1`}>Overrides the auto-calculated target if set</p>
            </div>
            <div>
              <Label className={`text-sm ${s.dialogLabel}`}>Notes</Label>
              <Input value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Optional notes about this target"
                className={`mt-1 ${s.dialogInputBg}`} data-testid="input-target-notes" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setEditingProperty(null)} disabled={saving} className={s.btnGhost}>Cancel</Button>
            <Button onClick={handleSaveTarget} disabled={saving} className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white border-0" data-testid="button-save-target">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save Target"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ mode, title, value, icon, gradient, glowColor, subtitle }: {
  mode: ThemeMode; title: string; value: string; icon: React.ReactNode; gradient: string; glowColor: string; subtitle: string;
}) {
  const s = t(mode);
  return (
    <motion.div whileHover={{ y: -2, scale: 1.01 }} transition={{ duration: 0.2 }}
      className={`relative ${s.cardBg} border ${s.cardBorder} rounded-2xl p-5 overflow-hidden group ${s.cardHoverBorder} transition-all duration-300 hover:shadow-xl ${glowColor}`}>
      <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${gradient} ${s.glowOpacity} rounded-full blur-2xl transition-opacity duration-500`} />
      <div className="relative flex items-start justify-between">
        <div className="space-y-1.5">
          <p className={`text-[11px] font-semibold ${s.textMuted} uppercase tracking-[0.15em]`}>{title}</p>
          <p className={`text-2xl font-bold ${s.textPrimary} tracking-tight`}>{value}</p>
          <p className={`text-xs ${s.textLabel}`}>{subtitle}</p>
        </div>
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg ${glowColor} group-hover:scale-110 transition-transform duration-300`}>
          <span className="text-white">{icon}</span>
        </div>
      </div>
    </motion.div>
  );
}

function ChartCard({ mode, title, description, children, loading, className }: {
  mode: ThemeMode; title: string; description?: string; children: React.ReactNode; loading?: boolean; className?: string;
}) {
  const s = t(mode);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className={className}>
      <div className={`${s.cardBg} border ${s.cardBorder} rounded-2xl overflow-hidden ${s.cardHoverBorder} transition-all duration-300`}>
        <div className={`px-6 py-4 border-b ${s.borderSubtle}`}>
          <h4 className={`text-base font-semibold ${s.textPrimary}`}>{title}</h4>
          {description && <p className={`text-xs ${s.textLabel} mt-0.5`}>{description}</p>}
        </div>
        <div className="px-4 py-4">
          {loading ? (
            <div className="flex items-end gap-2 h-48">
              {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
                <Skeleton key={i} className={`flex-1 rounded-t-lg ${s.skeletonBg}`} style={{ height: `${h}%` }} />
              ))}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}>{children}</motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PropertyRow({ property, index, mode, onEdit }: {
  property: PropertyTargetData; index: number; mode: ThemeMode; onEdit: () => void;
}) {
  const s = t(mode);
  const badge = getAchievementBadge(property.achievementPercent, mode);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`px-6 py-4 ${s.hoverRow} transition-colors`} data-testid={`property-target-row-${property.propertyId}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${property.achievementPercent >= 90 ? "from-emerald-500 to-teal-500" : property.achievementPercent >= 50 ? "from-amber-500 to-orange-500" : "from-rose-500 to-red-500"} shadow-lg`}>
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className={`font-semibold ${s.textPrimary} truncate`} data-testid={`property-name-${property.propertyId}`}>{property.propertyName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${badge.color}`} data-testid={`achievement-badge-${property.propertyId}`}>{badge.label}</span>
              {property.hasCustomTarget && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${s.indigoBadge}`}>Custom Target</span>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className={`shrink-0 gap-1 text-xs ${s.textMuted} hover:${s.indigoAccent} ${s.btnGhost}`} onClick={onEdit} data-testid={`button-edit-target-${property.propertyId}`}>
          <Settings2 className="h-3.5 w-3.5" /> Set Target
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-2 text-sm mb-3">
        <MetricCell mode={mode} label="Total Beds" value={property.totalBeds} />
        <MetricCell mode={mode} label="Occupied" value={property.occupiedBeds} color={property.occupiedBeds > 0 ? t(mode).emeraldAccent : undefined} />
        <MetricCell mode={mode} label="Vacant" value={property.vacantBeds} color={property.vacantBeds > 0 ? t(mode).amberAccent : undefined} />
        <MetricCell mode={mode} label="Avg Bed Price" value={formatCurrency(property.avgBedPrice)} />
        <MetricCell mode={mode} label="Occupancy" value={`${property.occupancyPercent}%`} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm mb-3">
        <MetricCell mode={mode} label="Target" value={formatCurrency(property.targetAmount)} color={t(mode).indigoAccent} />
        <MetricCell mode={mode} label="Achieved" value={formatCurrency(property.achievedAmount)} color={t(mode).emeraldAccent} />
        <MetricCell mode={mode} label="Remaining" value={formatCurrency(property.remainingAmount)} color={property.remainingAmount > 0 ? t(mode).roseAccent : t(mode).emeraldAccent} />
        <MetricCell mode={mode} label="Achievement" value={`${property.achievementPercent}%`} color={getAchievementColor(property.achievementPercent, mode)} />
      </div>

      <div className={`w-full ${s.progressBg} rounded-full h-2 overflow-hidden`}>
        <motion.div className={`h-full rounded-full ${getAchievementBg(property.achievementPercent)}`}
          initial={{ width: 0 }} animate={{ width: `${Math.min(property.achievementPercent, 100)}%` }}
          transition={{ delay: 0.3 + index * 0.05, duration: 0.8, ease: "easeOut" }} />
      </div>
    </motion.div>
  );
}

function MetricCell({ mode, label, value, color }: { mode: ThemeMode; label: string; value: string | number; color?: string }) {
  const s = t(mode);
  return (
    <div>
      <p className={`text-[11px] ${s.textLabel} uppercase tracking-wider`}>{label}</p>
      <p className={`font-semibold ${color || (mode === "dark" ? "text-white/80" : "text-slate-700")}`}>{value}</p>
    </div>
  );
}
