import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useProperty } from "@/contexts/property-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, TrendingUp, Target, UserCheck, ArrowUp, ArrowDown, Building2, Calendar, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface LeadAnalytics {
  totalLeads: number;
  leadsBySource: { source: string; count: number }[];
  leadsByStatus: { status: string; count: number }[];
  conversionRate: number;
  leadsByMonth: { month: string; count: number }[];
  conversionsByMonth: { month: string; conversions: number; total: number; rate: number }[];
  conversionsBySource: { source: string; total: number; conversions: number; rate: number }[];
  leadsByDevice: { device: string; count: number }[];
  recentLeads: any[];
}

interface PropertyFunnel {
  propertyId: string;
  propertyName: string;
  totalLeads: number;
  stages: { status: string; count: number; percentage: number }[];
  conversionRate: number;
}

interface LeadScoreAnalytics {
  totalLeads: number;
  averageScore: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  topProperty?: { propertyId: string; propertyName: string; avgScore: number };
}

const STAGE_ORDER = ["new", "interested", "site_visit", "negotiation", "converted", "lost"];

const PRIORITY_COLORS: Record<string, string> = {
  hot: "#EF4444",
  warm: "#F59E0B",
  cold: "#60A5FA",
};

const PRIORITY_LABELS: Record<string, string> = {
  hot: "🔥 Hot",
  warm: "🟡 Warm",
  cold: "❄️ Cold",
};
const STAGE_COLORS: Record<string, string> = {
  new: "#9CA3AF",
  interested: "#3B82F6",
  site_visit: "#F97316",
  negotiation: "#8B5CF6",
  converted: "#22C55E",
  lost: "#EF4444",
};

const COLORS = [
  "hsl(345, 72%, 41%)",
  "hsl(345, 72%, 55%)",
  "hsl(345, 50%, 65%)",
  "hsl(200, 70%, 50%)",
  "hsl(150, 60%, 45%)",
  "hsl(45, 80%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(30, 80%, 55%)",
  "hsl(180, 60%, 45%)",
];

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  social_media: "Social Media",
  google_ads: "Google Ads",
  walk_in: "Walk-in",
  call: "Phone Call",
  phone_call: "Phone Call",
  phone_inquiry: "Phone Inquiry",
  email_campaign: "Email Campaign",
  event: "Event",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  site_visit: "Site Visit",
  negotiation: "Negotiation",
  converted: "Converted",
  lost: "Lost",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-purple-100 text-purple-700",
  interested: "bg-amber-100 text-amber-700",
  site_visit: "bg-cyan-100 text-cyan-700",
  negotiation: "bg-orange-100 text-orange-700",
  converted: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return format(date, "MMM yyyy");
}

export default function LeadAnalyticsPage() {
  const { token } = useAuth();
  const { selectedPropertyId: globalPropertyId, setSelectedProperty } = useProperty();
  const effectivePropertyId = globalPropertyId || "all";
  const [compareMode, setCompareMode] = useState(false);
  const [compareProperties, setCompareProperties] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: analytics, isLoading, error } = useQuery<LeadAnalytics>({
    queryKey: ["/api/leads/analytics/summary", dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/leads/analytics/summary${qs}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    enabled: !!token,
  });

  // Fetch all property funnels
  const { data: propertyFunnels } = useQuery<PropertyFunnel[]>({
    queryKey: ["/api/leads/funnel/all-properties"],
    queryFn: async () => {
      const res = await fetch("/api/leads/funnel/all-properties", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch property funnels");
      return res.json();
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    enabled: !!token,
  });

  // Fetch lead score analytics
  const { data: scoreAnalytics } = useQuery<LeadScoreAnalytics>({
    queryKey: ["/api/leads/scores/analytics", effectivePropertyId],
    queryFn: async () => {
      const url = effectivePropertyId === "all" 
        ? "/api/leads/scores/analytics"
        : `/api/leads/scores/analytics?propertyId=${effectivePropertyId}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch score analytics");
      return res.json();
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    enabled: !!token,
  });

  // Get selected funnel data
  const selectedFunnel = effectivePropertyId === "all" 
    ? null 
    : propertyFunnels?.find(f => f.propertyId === effectivePropertyId);

  // Prepare funnel chart data
  const getFunnelData = (funnel: PropertyFunnel | null | undefined) => {
    if (!funnel) return [];
    return STAGE_ORDER.map(status => {
      const stage = funnel.stages.find(s => s.status === status);
      return {
        status: STATUS_LABELS[status] || status,
        count: stage?.count || 0,
        percentage: stage?.percentage || 0,
        fill: STAGE_COLORS[status] || "#9CA3AF",
      };
    }).filter(s => s.count > 0 || s.status === "Converted");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-red-500">Failed to load analytics data. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sourceData = analytics?.leadsBySource.map((item, index) => ({
    name: SOURCE_LABELS[item.source] || item.source,
    value: item.count,
    fill: COLORS[index % COLORS.length],
  })) || [];

  const statusData = analytics?.leadsByStatus.map((item, index) => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: item.count,
    fill: COLORS[index % COLORS.length],
  })) || [];

  const monthlyData = analytics?.leadsByMonth.map((item) => ({
    month: formatMonth(item.month),
    leads: item.count,
  })) || [];

  const conversionData = analytics?.conversionsByMonth.map((item) => ({
    month: formatMonth(item.month),
    total: item.total,
    conversions: item.conversions,
    rate: Math.round(item.rate * 10) / 10,
  })) || [];

  const deviceData = analytics?.leadsByDevice.map((item, index) => ({
    name: item.device.charAt(0).toUpperCase() + item.device.slice(1),
    value: item.count,
    fill: COLORS[index % COLORS.length],
  })) || [];

  const conversionBySourceData = analytics?.conversionsBySource.map((item, index) => ({
    name: SOURCE_LABELS[item.source] || item.source,
    total: item.total,
    conversions: item.conversions,
    rate: Math.round(item.rate * 10) / 10,
    fill: COLORS[index % COLORS.length],
  })).sort((a, b) => b.rate - a.rate) || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">Lead Analytics</h1>
            <p className="text-gray-500 mt-1">Track lead sources and conversion performance</p>
          </div>

          {/* Date Range Filter */}
          <div className="flex flex-col gap-2 shrink-0" data-testid="date-range-filter">
            <div className="flex flex-wrap gap-1.5">
              {[
                {
                  label: "This Month",
                  onClick: () => {
                    const now = new Date();
                    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0");
                    setDateFrom(`${y}-${m}-01`); setDateTo("");
                  },
                },
                {
                  label: "Last Month",
                  onClick: () => {
                    const now = new Date();
                    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0");
                    const last = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
                    setDateFrom(`${y}-${m}-01`); setDateTo(`${y}-${m}-${String(last).padStart(2, "0")}`);
                  },
                },
                {
                  label: "This Quarter",
                  onClick: () => {
                    const now = new Date();
                    const q = Math.floor(now.getMonth() / 3);
                    const startM = String(q * 3 + 1).padStart(2, "0");
                    setDateFrom(`${now.getFullYear()}-${startM}-01`); setDateTo("");
                  },
                },
                {
                  label: "This Year",
                  onClick: () => {
                    setDateFrom(`${new Date().getFullYear()}-01-01`); setDateTo("");
                  },
                },
              ].map(({ label, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  data-testid={`quick-filter-${label.replace(/\s+/g, "-").toLowerCase()}`}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                >
                  {label}
                </button>
              ))}
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  data-testid="clear-date-filter"
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  data-testid="input-date-from"
                  className="text-[12px] text-slate-700 bg-transparent outline-none w-[120px]"
                  placeholder="From"
                />
              </div>
              <span className="text-slate-400 text-xs shrink-0">—</span>
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-sm">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  data-testid="input-date-to"
                  className="text-[12px] text-slate-700 bg-transparent outline-none w-[120px]"
                  placeholder="To"
                />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  <Calendar className="h-3 w-3" />
                  {dateFrom && dateTo
                    ? `${dateFrom} → ${dateTo}`
                    : dateFrom
                    ? `From ${dateFrom}`
                    : `Until ${dateTo}`}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="stat-total-leads">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Leads</p>
                  <p className="text-3xl font-bold text-gray-900">{analytics?.totalLeads || 0}</p>
                </div>
                <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-conversion-rate">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Conversion Rate</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {(analytics?.conversionRate || 0).toFixed(1)}%
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-converted">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Converted</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {analytics?.leadsByStatus.find((s) => s.status === "converted")?.count || 0}
                  </p>
                </div>
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserCheck className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="stat-active-leads">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Active Pipeline</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {(analytics?.totalLeads || 0) - 
                     (analytics?.leadsByStatus.find((s) => s.status === "converted")?.count || 0) -
                     (analytics?.leadsByStatus.find((s) => s.status === "lost")?.count || 0)}
                  </p>
                </div>
                <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <Target className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Property Lead Funnel Section */}
        <Card data-testid="property-funnel-section">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Property Lead Funnel
              </CardTitle>
              <CardDescription>Track lead progression for each property</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {effectivePropertyId === "all" ? (
              // All Properties Comparison View
              <div className="space-y-4">
                {propertyFunnels && propertyFunnels.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {propertyFunnels.map((funnel) => (
                      <Card key={funnel.propertyId} className="border-2 hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setSelectedProperty(funnel.propertyId)}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-sm truncate">{funnel.propertyName}</h3>
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              {funnel.conversionRate.toFixed(1)}% Conv.
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {STAGE_ORDER.map(status => {
                              const stage = funnel.stages.find(s => s.status === status);
                              if (!stage || stage.count === 0) return null;
                              return (
                                <div key={status} className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: STAGE_COLORS[status] }}
                                  />
                                  <span className="text-xs text-gray-600 flex-1">{STATUS_LABELS[status]}</span>
                                  <span className="text-xs font-medium">{stage.count}</span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Total Leads</span>
                              <span className="font-bold">{funnel.totalLeads}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-500">
                    No property leads data available. Leads are created when users view properties.
                  </div>
                )}
              </div>
            ) : selectedFunnel ? (
              // Single Property Funnel View
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">{selectedFunnel.propertyName}</h3>
                  <div className="space-y-3">
                    {STAGE_ORDER.map((status, index) => {
                      const stage = selectedFunnel.stages.find(s => s.status === status);
                      const count = stage?.count || 0;
                      const percentage = stage?.percentage || 0;
                      const maxCount = Math.max(...selectedFunnel.stages.map(s => s.count), 1);
                      
                      return (
                        <div key={status} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium" style={{ color: STAGE_COLORS[status] }}>
                              {STATUS_LABELS[status]}
                            </span>
                            <span className="text-gray-600">
                              {count} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                            <div 
                              className="h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                              style={{ 
                                width: `${Math.max((count / maxCount) * 100, count > 0 ? 10 : 0)}%`,
                                backgroundColor: STAGE_COLORS[status] 
                              }}
                            >
                              {count > 0 && (
                                <span className="text-white text-xs font-bold">{count}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-gray-500">Total Leads</p>
                        <p className="text-2xl font-bold">{selectedFunnel.totalLeads}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-gray-500">Conversion Rate</p>
                        <p className="text-2xl font-bold text-green-600">{selectedFunnel.conversionRate.toFixed(1)}%</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-gray-500 mb-2">Funnel Breakdown</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={getFunnelData(selectedFunnel)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="status" type="category" width={100} />
                          <Tooltip />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {getFunnelData(selectedFunnel).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-500">
                Select a property to view its lead funnel
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Scoring Dashboard */}
        <Card data-testid="lead-scoring-dashboard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Lead Scoring Dashboard
            </CardTitle>
            <CardDescription>Auto-scored leads by property engagement - Priority: 🔥 Hot (61-100), 🟡 Warm (31-60), ❄️ Cold (0-30)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
                <CardContent className="pt-4">
                  <p className="text-sm text-gray-500">Total Leads</p>
                  <p className="text-2xl font-bold">{scoreAnalytics?.totalLeads || 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                <CardContent className="pt-4">
                  <p className="text-sm text-gray-500">Avg Score</p>
                  <p className="text-2xl font-bold text-purple-700">{(scoreAnalytics?.averageScore || 0).toFixed(1)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-600">🔥 Hot Leads</p>
                      <p className="text-2xl font-bold text-red-700">{scoreAnalytics?.hotLeads || 0}</p>
                    </div>
                    <span className="text-2xl">🔥</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-amber-600">🟡 Warm Leads</p>
                      <p className="text-2xl font-bold text-amber-700">{scoreAnalytics?.warmLeads || 0}</p>
                    </div>
                    <span className="text-2xl">🟡</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600">❄️ Cold Leads</p>
                      <p className="text-2xl font-bold text-blue-700">{scoreAnalytics?.coldLeads || 0}</p>
                    </div>
                    <span className="text-2xl">❄️</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Priority Distribution Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium mb-4">Lead Priority Distribution</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Hot", value: scoreAnalytics?.hotLeads || 0, fill: PRIORITY_COLORS.hot },
                        { name: "Warm", value: scoreAnalytics?.warmLeads || 0, fill: PRIORITY_COLORS.warm },
                        { name: "Cold", value: scoreAnalytics?.coldLeads || 0, fill: PRIORITY_COLORS.cold },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              {scoreAnalytics?.topProperty && effectivePropertyId === "all" && (
                <div>
                  <h3 className="text-sm font-medium mb-4">Top Performing Property</h3>
                  <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                          <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-green-800">{scoreAnalytics.topProperty.propertyName}</p>
                          <p className="text-sm text-green-600">
                            Average Score: <span className="font-bold">{scoreAnalytics.topProperty.avgScore.toFixed(1)}</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="chart-lead-sources">
            <CardHeader>
              <CardTitle>Leads by Source</CardTitle>
              <CardDescription>Where your leads are coming from</CardDescription>
            </CardHeader>
            <CardContent>
              {sourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No lead source data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="chart-lead-status">
            <CardHeader>
              <CardTitle>Lead Pipeline Status</CardTitle>
              <CardDescription>Distribution across sales stages</CardDescription>
            </CardHeader>
            <CardContent>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={statusData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="value" name="Leads">
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No lead status data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="chart-conversion-by-source">
            <CardHeader>
              <CardTitle>Conversion Rate by Source</CardTitle>
              <CardDescription>Which lead sources convert best</CardDescription>
            </CardHeader>
            <CardContent>
              {conversionBySourceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={conversionBySourceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
                    <YAxis yAxisId="left" orientation="left" stroke="hsl(200, 70%, 50%)" />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(150, 60%, 45%)" unit="%" />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'rate' ? `${value}%` : value,
                        name === 'rate' ? 'Conversion Rate' : name === 'total' ? 'Total Leads' : 'Conversions'
                      ]}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="total" name="Total Leads" fill="hsl(200, 70%, 50%)" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="conversions" name="Conversions" fill="hsl(150, 60%, 45%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No conversion data by source available
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="chart-monthly-leads">
            <CardHeader>
              <CardTitle>Monthly Lead Trend</CardTitle>
              <CardDescription>New leads over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="leads"
                      stroke="hsl(345, 72%, 41%)"
                      fill="hsl(345, 72%, 41%)"
                      fillOpacity={0.2}
                      name="New Leads"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No monthly data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="chart-conversion-trend">
            <CardHeader>
              <CardTitle>Conversion Trend</CardTitle>
              <CardDescription>Monthly conversion performance</CardDescription>
            </CardHeader>
            <CardContent>
              {conversionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={conversionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" orientation="left" stroke="hsl(200, 70%, 50%)" />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(150, 60%, 45%)" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="total"
                      stroke="hsl(200, 70%, 50%)"
                      name="Total Leads"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="conversions"
                      stroke="hsl(150, 60%, 45%)"
                      name="Conversions"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No conversion data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card data-testid="chart-device-breakdown">
            <CardHeader>
              <CardTitle>Device Breakdown</CardTitle>
              <CardDescription>How visitors access the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {deviceData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={deviceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {deviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-gray-500">
                  No device data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2" data-testid="table-recent-leads">
            <CardHeader>
              <CardTitle>Recent Leads</CardTitle>
              <CardDescription>Latest prospects added to the system</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.recentLeads && analytics.recentLeads.length > 0 ? (
                <div className="space-y-4">
                  {analytics.recentLeads.slice(0, 5).map((lead: any) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-primary font-semibold">
                            {lead.name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{lead.name}</p>
                          <p className="text-sm text-gray-500">
                            {lead.email || lead.phone || "No contact info"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-700"}>
                          {STATUS_LABELS[lead.status] || lead.status}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {SOURCE_LABELS[lead.source] || lead.source}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-500">
                  No recent leads
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
