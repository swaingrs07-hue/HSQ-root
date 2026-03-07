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
import { ChartCard } from "@/components/animated-charts";

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
  if (percent >= 90) return "text-emerald-600";
  if (percent >= 50) return "text-amber-600";
  return "text-rose-600";
}

function getAchievementBg(percent: number): string {
  if (percent >= 90) return "bg-emerald-500";
  if (percent >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

function getAchievementBadge(percent: number): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (percent >= 90) return { label: "On Track", variant: "default" };
  if (percent >= 50) return { label: "Near Target", variant: "secondary" };
  return { label: "Below Target", variant: "destructive" };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-slate-200"
      >
        <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterProperty !== "all") params.set("propertyId", filterProperty);
      if (filterMonth !== "all") params.set("month", filterMonth);
      if (filterStatus !== "all") params.set("bookingStatus", filterStatus);

      const [targetRes, trendRes] = await Promise.all([
        fetch(`/api/admin/targets?${params}`, { credentials: "include" }).then(r => r.json()),
        fetch(`/api/admin/targets/trends?${filterProperty !== "all" ? `propertyId=${filterProperty}` : ""}`, { credentials: "include" }).then(r => r.json()),
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
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="border-0 shadow-lg">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-0 shadow-lg">
              <CardContent className="p-6">
                <Skeleton className="h-48 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="target-achievement-tab">
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          <SummaryCard
            title="Total Target"
            value={formatCurrency(summary.totalTarget)}
            icon={<Target className="w-5 h-5 text-white" />}
            gradient="from-indigo-500 to-indigo-600"
            subtitle={`${properties.length} properties`}
          />
          <SummaryCard
            title="Total Achieved"
            value={formatCurrency(summary.totalAchieved)}
            icon={<Trophy className="w-5 h-5 text-white" />}
            gradient="from-emerald-500 to-emerald-600"
            subtitle={`${summary.overallAchievement}% of target`}
          />
          <SummaryCard
            title="Remaining"
            value={formatCurrency(summary.totalRemaining)}
            icon={<TrendingUp className="w-5 h-5 text-white" />}
            gradient="from-amber-500 to-amber-600"
            subtitle="To reach target"
          />
          <SummaryCard
            title="Overall Occupancy"
            value={`${summary.overallOccupancy}%`}
            icon={<Bed className="w-5 h-5 text-white" />}
            gradient="from-cyan-500 to-cyan-600"
            subtitle={`${summary.totalOccupied}/${summary.totalBeds} beds`}
          />
          <SummaryCard
            title="Achievement Rate"
            value={`${summary.overallAchievement}%`}
            icon={<BarChart3 className="w-5 h-5 text-white" />}
            gradient={summary.overallAchievement >= 90 ? "from-emerald-500 to-emerald-600" : summary.overallAchievement >= 50 ? "from-amber-500 to-amber-600" : "from-rose-500 to-rose-600"}
            subtitle={summary.overallAchievement >= 90 ? "On Track" : summary.overallAchievement >= 50 ? "Near Target" : "Below Target"}
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Filters</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setShowFilters(!showFilters)}
                  data-testid="toggle-filters"
                >
                  {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                setFilterProperty("all");
                setFilterMonth("all");
                setFilterStatus("all");
              }} data-testid="button-reset-filters">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>

            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100"
              >
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Property</Label>
                  <Select value={filterProperty} onValueChange={setFilterProperty}>
                    <SelectTrigger className="h-9" data-testid="filter-property">
                      <SelectValue placeholder="All Properties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {allProperties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Month</Label>
                  <Select value={filterMonth} onValueChange={setFilterMonth}>
                    <SelectTrigger className="h-9" data-testid="filter-month">
                      <SelectValue placeholder="All Months" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      {MONTHS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Booking Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-9" data-testid="filter-status">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      {BOOKING_STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {summary?.topProperty && summary?.lowestProperty && properties.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
            <CardContent className="p-5 relative">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Top Performer</p>
                  <p className="text-base font-semibold text-slate-800 truncate mt-0.5">{summary.topProperty.propertyName}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm text-slate-500">{summary.topProperty.achievementPercent}% achieved</span>
                    <span className="text-sm text-slate-400">•</span>
                    <span className="text-sm text-slate-500">{summary.topProperty.occupancyPercent}% occupancy</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent pointer-events-none" />
            <CardContent className="p-5 relative">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 shadow-lg">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-rose-600 uppercase tracking-wider">Needs Attention</p>
                  <p className="text-base font-semibold text-slate-800 truncate mt-0.5">{summary.lowestProperty.propertyName}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm text-slate-500">{summary.lowestProperty.achievementPercent}% achieved</span>
                    <span className="text-sm text-slate-400">•</span>
                    <span className="text-sm text-slate-500">{summary.lowestProperty.occupancyPercent}% occupancy</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Target vs Achievement" description="Property-wise comparison" loading={loading}>
          {chartBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartBarData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 8 }} />
                <Bar dataKey="target" name="Target" fill="#6366f1" radius={[4, 4, 0, 0]} animationDuration={1200} />
                <Bar dataKey="achieved" name="Achieved" fill="#10b981" radius={[4, 4, 0, 0]} animationBegin={200} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-slate-500">No data available</div>
          )}
        </ChartCard>

        <ChartCard title="Occupancy & Achievement %" description="Property-wise percentages" loading={loading}>
          {occupancyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={occupancyChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 8 }} />
                <Bar dataKey="occupancy" name="Occupancy %" fill="#06b6d4" radius={[4, 4, 0, 0]} animationDuration={1200} />
                <Bar dataKey="achievement" name="Achievement %" fill="#8b5cf6" radius={[4, 4, 0, 0]} animationBegin={200} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-slate-500">No data available</div>
          )}
        </ChartCard>

        <ChartCard title="Monthly Achievement Trend" description="Revenue trend over last 12 months" className="lg:col-span-2" loading={loading}>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="totalAchieved" name="Revenue" stroke="#6366f1" strokeWidth={3} fill="url(#trendGradient)" animationDuration={1500} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-slate-500">No trend data available</div>
          )}
        </ChartCard>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-800">Property-wise Details</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {properties.length} {properties.length === 1 ? "property" : "properties"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {properties.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">No properties found</p>
                <p className="text-xs text-slate-400 mt-1">Adjust your filters or add properties</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {properties.map((prop, index) => (
                  <PropertyTargetRow
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
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={!!editingProperty} onOpenChange={(open) => { if (!open) setEditingProperty(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-indigo-600" />
              Set Target — {editingProperty?.propertyName}
            </DialogTitle>
            <DialogDescription>
              Configure target occupancy and optional custom target override for this property.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div>
              <Label className="text-sm text-slate-700">Target Occupancy %</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.targetOccupancyPercent}
                  onChange={(e) => setEditForm({ ...editForm, targetOccupancyPercent: parseInt(e.target.value) || 0 })}
                  className="w-24"
                  data-testid="input-target-occupancy"
                />
                <span className="text-sm text-slate-500">%</span>
                <span className="text-xs text-slate-400 ml-2">
                  Auto target: {editingProperty ? formatCurrency(Math.round(editingProperty.autoTarget * (editForm.targetOccupancyPercent / (editingProperty.targetOccupancyPercent || 100)))) : "—"}
                </span>
              </div>
            </div>
            <div>
              <Label className="text-sm text-slate-700">Custom Target Override (₹)</Label>
              <Input
                type="number"
                value={editForm.customTargetOverride}
                onChange={(e) => setEditForm({ ...editForm, customTargetOverride: e.target.value })}
                placeholder="Leave empty for auto-calculated"
                className="mt-1"
                data-testid="input-custom-target"
              />
              <p className="text-xs text-slate-400 mt-1">Overrides the auto-calculated target if set</p>
            </div>
            <div>
              <Label className="text-sm text-slate-700">Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Optional notes about this target"
                className="mt-1"
                data-testid="input-target-notes"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditingProperty(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveTarget} disabled={saving} className="gap-2" data-testid="button-save-target">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save Target"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ title, value, icon, gradient, subtitle }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
  subtitle: string;
}) {
  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group overflow-hidden">
      <div className={`absolute inset-0 opacity-[0.06] bg-gradient-to-br ${gradient}`} />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-slate-800 tracking-tight">{value}</p>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PropertyTargetRow({ property, index, onEdit }: {
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
      className="px-6 py-4 hover:bg-slate-50/50 transition-colors"
      data-testid={`property-target-row-${property.propertyId}`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${property.achievementPercent >= 90 ? "from-emerald-500 to-emerald-600" : property.achievementPercent >= 50 ? "from-amber-500 to-amber-600" : "from-rose-500 to-rose-600"}`}>
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate" data-testid={`property-name-${property.propertyId}`}>{property.propertyName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0" data-testid={`achievement-badge-${property.propertyId}`}>
                {badge.label}
              </Badge>
              {property.hasCustomTarget && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-indigo-200 text-indigo-600">
                  Custom Target
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs text-slate-500 hover:text-indigo-600" onClick={onEdit} data-testid={`button-edit-target-${property.propertyId}`}>
          <Settings2 className="h-3.5 w-3.5" /> Set Target
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-2 text-sm mb-3">
        <MetricCell label="Total Beds" value={property.totalBeds} />
        <MetricCell label="Occupied" value={property.occupiedBeds} color={property.occupiedBeds > 0 ? "text-emerald-600" : undefined} />
        <MetricCell label="Vacant" value={property.vacantBeds} color={property.vacantBeds > 0 ? "text-amber-600" : undefined} />
        <MetricCell label="Avg Bed Price" value={formatCurrency(property.avgBedPrice)} />
        <MetricCell label="Occupancy" value={`${property.occupancyPercent}%`} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm mb-3">
        <MetricCell label="Target" value={formatCurrency(property.targetAmount)} color="text-indigo-600" />
        <MetricCell label="Achieved" value={formatCurrency(property.achievedAmount)} color="text-emerald-600" />
        <MetricCell label="Remaining" value={formatCurrency(property.remainingAmount)} color={property.remainingAmount > 0 ? "text-rose-600" : "text-emerald-600"} />
        <MetricCell label="Achievement" value={`${property.achievementPercent}%`} color={getAchievementColor(property.achievementPercent)} />
      </div>

      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
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

function MetricCell({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`font-semibold ${color || "text-slate-700"}`}>{value}</p>
    </div>
  );
}
