import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Target, TrendingUp, TrendingDown, Building2, Bed, ArrowUpRight,
  Settings2, Calendar, Filter, BarChart3, Trophy, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, Save, X, RotateCcw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend, Cell,
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

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
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
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getAchievementColor(percent: number): string {
  if (percent >= 90) return "text-emerald-400";
  if (percent >= 50) return "text-amber-400";
  return "text-rose-400";
}

function getAchievementBg(percent: number): string {
  if (percent >= 90) return "bg-gradient-to-r from-emerald-500 to-emerald-400";
  if (percent >= 50) return "bg-gradient-to-r from-amber-500 to-amber-400";
  return "bg-gradient-to-r from-rose-500 to-rose-400";
}

function getAchievementBadge(percent: number): { label: string; color: string } {
  if (percent >= 90) return { label: "On Track", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
  if (percent >= 50) return { label: "Near Target", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
  return { label: "Below Target", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" };
}

const DarkTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#1a1a2e]/95 backdrop-blur-xl p-3.5 rounded-xl border border-white/10 shadow-2xl"
      >
        <p className="text-xs font-medium text-white/50 mb-1.5">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === "number" ? (entry.name.includes("₹") || entry.dataKey?.includes("Amount") || entry.dataKey?.includes("target") || entry.dataKey?.includes("achieved")
              ? formatCurrency(entry.value) : entry.value.toLocaleString()) : entry.value}
          </p>
        ))}
      </motion.div>
    );
  }
  return null;
};

export default function TargetAchievementTab() {
  const { toast } = useToast();
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
    name: p.propertyName.length > 15 ? p.propertyName.substring(0, 15) + "…" : p.propertyName,
    target: p.targetAmount,
    achieved: p.achievedAmount,
  }));

  const occupancyChartData = properties.map(p => ({
    name: p.propertyName.length > 15 ? p.propertyName.substring(0, 15) + "…" : p.propertyName,
    occupancy: p.occupancyPercent,
    achievement: p.achievementPercent,
  }));

  if (loading && !summary) {
    return (
      <div className="space-y-6 p-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <Skeleton className="h-4 w-24 mb-3 bg-white/10" />
              <Skeleton className="h-8 w-32 mb-2 bg-white/10" />
              <Skeleton className="h-3 w-20 bg-white/10" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
              <Skeleton className="h-48 w-full bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1" data-testid="target-achievement-tab">
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          <DarkSummaryCard
            title="Total Target"
            value={formatCurrency(summary.totalTarget)}
            icon={<Target className="w-5 h-5" />}
            gradient="from-indigo-500 to-violet-500"
            glowColor="shadow-indigo-500/20"
            subtitle={`${properties.length} properties`}
          />
          <DarkSummaryCard
            title="Total Achieved"
            value={formatCurrency(summary.totalAchieved)}
            icon={<Trophy className="w-5 h-5" />}
            gradient="from-emerald-500 to-teal-500"
            glowColor="shadow-emerald-500/20"
            subtitle={`${summary.overallAchievement}% of target`}
          />
          <DarkSummaryCard
            title="Remaining"
            value={formatCurrency(summary.totalRemaining)}
            icon={<TrendingUp className="w-5 h-5" />}
            gradient="from-amber-500 to-orange-500"
            glowColor="shadow-amber-500/20"
            subtitle="To reach target"
          />
          <DarkSummaryCard
            title="Overall Occupancy"
            value={`${summary.overallOccupancy}%`}
            icon={<Bed className="w-5 h-5" />}
            gradient="from-cyan-500 to-blue-500"
            glowColor="shadow-cyan-500/20"
            subtitle={`${summary.totalOccupied}/${summary.totalBeds} beds`}
          />
          <DarkSummaryCard
            title="Achievement Rate"
            value={`${summary.overallAchievement}%`}
            icon={<BarChart3 className="w-5 h-5" />}
            gradient={summary.overallAchievement >= 90 ? "from-emerald-500 to-teal-500" : summary.overallAchievement >= 50 ? "from-amber-500 to-orange-500" : "from-rose-500 to-red-500"}
            glowColor={summary.overallAchievement >= 90 ? "shadow-emerald-500/20" : summary.overallAchievement >= 50 ? "shadow-amber-500/20" : "shadow-rose-500/20"}
            subtitle={summary.overallAchievement >= 90 ? "On Track" : summary.overallAchievement >= 50 ? "Near Target" : "Below Target"}
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-white/40" />
              <span className="text-sm font-medium text-white/60">Filters</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-white/40 hover:text-white hover:bg-white/[0.06]"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="toggle-filters"
              >
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-white/40 hover:text-white hover:bg-white/[0.06] border border-white/[0.08]"
              onClick={() => {
                setFilterProperty("all");
                setFilterMonth("all");
                setFilterStatus("all");
              }}
              data-testid="button-reset-filters"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>

          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/[0.06]"
            >
              <div>
                <Label className="text-xs text-white/40 mb-1 block">Property</Label>
                <Select value={filterProperty} onValueChange={setFilterProperty}>
                  <SelectTrigger className="h-9 bg-white/[0.04] border-white/[0.08] text-white/80" data-testid="filter-property">
                    <SelectValue placeholder="All Properties" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/10">
                    <SelectItem value="all">All Properties</SelectItem>
                    {allProperties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-white/40 mb-1 block">Month</Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="h-9 bg-white/[0.04] border-white/[0.08] text-white/80" data-testid="filter-month">
                    <SelectValue placeholder="All Months" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/10">
                    <SelectItem value="all">All Months</SelectItem>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-white/40 mb-1 block">Booking Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9 bg-white/[0.04] border-white/[0.08] text-white/80" data-testid="filter-status">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/10">
                    {BOOKING_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {summary?.topProperty && summary?.lowestProperty && properties.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="relative bg-white/[0.03] backdrop-blur-sm border border-emerald-500/20 rounded-2xl p-5 overflow-hidden group hover:border-emerald-500/30 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.05] to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-[0.15em]">Top Performer</p>
                <p className="text-base font-bold text-white truncate mt-0.5">{summary.topProperty.propertyName}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm text-white/50">{summary.topProperty.achievementPercent}% achieved</span>
                  <span className="text-sm text-white/20">•</span>
                  <span className="text-sm text-white/50">{summary.topProperty.occupancyPercent}% occupancy</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative bg-white/[0.03] backdrop-blur-sm border border-rose-500/20 rounded-2xl p-5 overflow-hidden group hover:border-rose-500/30 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/[0.05] to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/[0.03] rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 shadow-lg shadow-rose-500/25">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-rose-400 uppercase tracking-[0.15em]">Needs Attention</p>
                <p className="text-base font-bold text-white truncate mt-0.5">{summary.lowestProperty.propertyName}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-sm text-white/50">{summary.lowestProperty.achievementPercent}% achieved</span>
                  <span className="text-sm text-white/20">•</span>
                  <span className="text-sm text-white/50">{summary.lowestProperty.occupancyPercent}% occupancy</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DarkChartCard title="Target vs Achievement" description="Property-wise comparison" loading={loading}>
          {chartBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartBarData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "rgba(255,255,255,0.4)" }} tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip content={<DarkTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 8 }} formatter={(value: string) => <span className="text-white/60 text-xs">{value}</span>} />
                <Bar dataKey="target" name="Target" fill="#818cf8" radius={[6, 6, 0, 0]} animationDuration={1200} />
                <Bar dataKey="achieved" name="Achieved" fill="#34d399" radius={[6, 6, 0, 0]} animationBegin={200} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-white/30">No data available</div>
          )}
        </DarkChartCard>

        <DarkChartCard title="Occupancy & Achievement %" description="Property-wise percentages" loading={loading}>
          {occupancyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={occupancyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "rgba(255,255,255,0.4)" }} domain={[0, 100]} />
                <Tooltip content={<DarkTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 8 }} formatter={(value: string) => <span className="text-white/60 text-xs">{value}</span>} />
                <Bar dataKey="occupancy" name="Occupancy %" fill="#22d3ee" radius={[6, 6, 0, 0]} animationDuration={1200} />
                <Bar dataKey="achievement" name="Achievement %" fill="#a78bfa" radius={[6, 6, 0, 0]} animationBegin={200} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-white/30">No data available</div>
          )}
        </DarkChartCard>

        <DarkChartCard title="Monthly Achievement Trend" description="Revenue trend over last 12 months" className="lg:col-span-2" loading={loading}>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="darkTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "rgba(255,255,255,0.4)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "rgba(255,255,255,0.4)" }} tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                <Tooltip content={<DarkTooltip />} />
                <Area type="monotone" dataKey="totalAchieved" name="Revenue" stroke="#818cf8" strokeWidth={3} fill="url(#darkTrendGradient)" animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-white/30">No trend data available</div>
          )}
        </DarkChartCard>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Property-wise Details</h3>
            <span className="text-xs font-medium text-white/40 bg-white/[0.06] px-2.5 py-1 rounded-full">
              {properties.length} {properties.length === 1 ? "property" : "properties"}
            </span>
          </div>
          <div>
            {properties.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-10 w-10 text-white/20 mb-3" />
                <p className="text-sm text-white/40">No properties found</p>
                <p className="text-xs text-white/25 mt-1">Adjust your filters or add properties</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {properties.map((prop, index) => (
                  <DarkPropertyRow
                    key={prop.propertyId}
                    property={prop}
                    index={index}
                    onEdit={() => {
                      setEditingProperty(prop);
                      setEditForm({
                        targetOccupancyPercent: prop.targetOccupancyPercent,
                        customTargetOverride: prop.hasCustomTarget ? String(prop.targetAmount) : "",
                        notes: prop.notes || "",
                      });
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <Dialog open={!!editingProperty} onOpenChange={(open) => { if (!open) setEditingProperty(null); }}>
        <DialogContent className="sm:max-w-md bg-[#0f0f1a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Settings2 className="h-5 w-5 text-indigo-400" />
              Set Target — {editingProperty?.propertyName}
            </DialogTitle>
            <DialogDescription className="text-white/40">
              Configure target occupancy and optional custom target override for this property.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div>
              <Label className="text-sm text-white/60">Target Occupancy %</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.targetOccupancyPercent}
                  onChange={(e) => setEditForm({ ...editForm, targetOccupancyPercent: parseInt(e.target.value) || 0 })}
                  className="w-24 bg-white/[0.04] border-white/[0.08] text-white"
                  data-testid="input-target-occupancy"
                />
                <span className="text-sm text-white/40">%</span>
                <span className="text-xs text-white/30 ml-2">
                  Auto target: {editingProperty ? formatCurrency(Math.round(editingProperty.autoTarget * (editForm.targetOccupancyPercent / (editingProperty.targetOccupancyPercent || 100)))) : "—"}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-sm text-white/60">Custom Target Override (₹)</Label>
              <Input
                type="number"
                value={editForm.customTargetOverride}
                onChange={(e) => setEditForm({ ...editForm, customTargetOverride: e.target.value })}
                placeholder="Leave empty for auto-calculated"
                className="mt-1 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20"
                data-testid="input-custom-target"
              />
              <p className="text-xs text-white/25 mt-1">Overrides the auto-calculated target if set</p>
            </div>
            <div>
              <Label className="text-sm text-white/60">Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Optional notes about this target"
                className="mt-1 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20"
                data-testid="input-target-notes"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setEditingProperty(null)} disabled={saving} className="text-white/60 hover:text-white hover:bg-white/[0.06]">
              Cancel
            </Button>
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

function DarkSummaryCard({ title, value, icon, gradient, glowColor, subtitle }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
  glowColor: string;
  subtitle: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={`relative bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5 overflow-hidden group hover:border-white/[0.12] transition-all duration-300 hover:shadow-xl ${glowColor}`}
    >
      <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${gradient} opacity-[0.07] rounded-full blur-2xl group-hover:opacity-[0.12] transition-opacity duration-500`} />
      <div className="relative flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.15em]">{title}</p>
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
          <p className="text-xs text-white/30">{subtitle}</p>
        </div>
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg ${glowColor} group-hover:scale-110 transition-transform duration-300`}>
          <span className="text-white">{icon}</span>
        </div>
      </div>
    </motion.div>
  );
}

function DarkChartCard({ title, description, children, loading, className }: {
  title: string;
  description?: string;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={className}
    >
      <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.1] transition-all duration-300">
        <div className="px-6 py-4 border-b border-white/[0.04]">
          <h4 className="text-base font-semibold text-white">{title}</h4>
          {description && <p className="text-xs text-white/30 mt-0.5">{description}</p>}
        </div>
        <div className="px-4 py-4">
          {loading ? (
            <div className="space-y-3">
              <div className="flex items-end gap-2 h-48">
                {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
                  <Skeleton key={i} className="flex-1 rounded-t-lg bg-white/[0.06]" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.4 }}>
              {children}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DarkPropertyRow({ property, index, onEdit }: {
  property: PropertyTargetData;
  index: number;
  onEdit: () => void;
}) {
  const badge = getAchievementBadge(property.achievementPercent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="px-6 py-4 hover:bg-white/[0.02] transition-colors"
      data-testid={`property-target-row-${property.propertyId}`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${property.achievementPercent >= 90 ? "from-emerald-500 to-teal-500" : property.achievementPercent >= 50 ? "from-amber-500 to-orange-500" : "from-rose-500 to-red-500"} shadow-lg`}>
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white truncate" data-testid={`property-name-${property.propertyId}`}>{property.propertyName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${badge.color}`} data-testid={`achievement-badge-${property.propertyId}`}>
                {badge.label}
              </span>
              {property.hasCustomTarget && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                  Custom Target
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1 text-xs text-white/40 hover:text-indigo-400 hover:bg-white/[0.04]"
          onClick={onEdit}
          data-testid={`button-edit-target-${property.propertyId}`}
        >
          <Settings2 className="h-3.5 w-3.5" /> Set Target
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-2 text-sm mb-3">
        <DarkMetricCell label="Total Beds" value={property.totalBeds} />
        <DarkMetricCell label="Occupied" value={property.occupiedBeds} color={property.occupiedBeds > 0 ? "text-emerald-400" : undefined} />
        <DarkMetricCell label="Vacant" value={property.vacantBeds} color={property.vacantBeds > 0 ? "text-amber-400" : undefined} />
        <DarkMetricCell label="Avg Bed Price" value={formatCurrency(property.avgBedPrice)} />
        <DarkMetricCell label="Occupancy" value={`${property.occupancyPercent}%`} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm mb-3">
        <DarkMetricCell label="Target" value={formatCurrency(property.targetAmount)} color="text-indigo-400" />
        <DarkMetricCell label="Achieved" value={formatCurrency(property.achievedAmount)} color="text-emerald-400" />
        <DarkMetricCell label="Remaining" value={formatCurrency(property.remainingAmount)} color={property.remainingAmount > 0 ? "text-rose-400" : "text-emerald-400"} />
        <DarkMetricCell label="Achievement" value={`${property.achievementPercent}%`} color={getAchievementColor(property.achievementPercent)} />
      </div>

      <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${getAchievementBg(property.achievementPercent)}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(property.achievementPercent, 100)}%` }}
          transition={{ delay: 0.3 + index * 0.05, duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </motion.div>
  );
}

function DarkMetricCell({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-[11px] text-white/30 uppercase tracking-wider">{label}</p>
      <p className={`font-semibold ${color || "text-white/80"}`}>{value}</p>
    </div>
  );
}
