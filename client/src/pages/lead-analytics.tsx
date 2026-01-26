import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, Target, UserCheck, ArrowUp, ArrowDown } from "lucide-react";
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
  leadsByDevice: { device: string; count: number }[];
  recentLeads: any[];
}

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
  
  const { data: analytics, isLoading, error } = useQuery<LeadAnalytics>({
    queryKey: ["/api/leads/analytics/summary"],
    queryFn: async () => {
      const res = await fetch("/api/leads/analytics/summary", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds for real-time updates
    refetchOnWindowFocus: true,
    enabled: !!token,
  });

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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900" data-testid="page-title">Lead Analytics</h1>
            <p className="text-gray-500 mt-1">Track lead sources and conversion performance</p>
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
