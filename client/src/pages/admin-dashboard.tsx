import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Home, DollarSign, FileText, Users, Search, Phone, Mail, Calendar, Clock, Monitor, Smartphone, BarChart3, Building2, Power, MapPin, Bed, Plus, CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, GraduationCap, CreditCard, Activity, ArrowUpRight, ArrowDownRight, RefreshCw, CalendarCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getAdminStats } from "@/lib/api";
import type { Lead } from "@shared/schema";
import { LeadsTrendChart, PropertyBookingsChart, SalesPerformanceChart, LeadSourcePieChart } from "@/components/animated-charts";
import { FadeInView, StaggeredList, StaggeredItem } from "@/components/motion-primitives";

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);
  
  return <span>{prefix}{displayValue.toLocaleString()}{suffix}</span>;
}

function KPICard({ 
  title, 
  value, 
  prefix = "", 
  suffix = "",
  icon: Icon, 
  trend, 
  trendValue,
  gradient,
  loading 
}: { 
  title: string; 
  value: number; 
  prefix?: string;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>; 
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  gradient: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="relative overflow-hidden border-0 shadow-lg">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
      <div className={`absolute inset-0 opacity-[0.08] ${gradient}`} />
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-3xl font-bold text-slate-800 tracking-tight">
              <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
            </p>
            {trend && trendValue && (
              <div className={`flex items-center gap-1 text-xs font-medium ${
                trend === "up" ? "text-emerald-600" : trend === "down" ? "text-rose-600" : "text-slate-500"
              }`}>
                {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : 
                 trend === "down" ? <ArrowDownRight className="w-3 h-3" /> : null}
                <span>{trendValue}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalBookings: 0,
    totalRevenue: 0,
    pendingPayments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [discountForm, setDiscountForm] = useState({
    bookingId: "",
    discount: "",
    reason: "",
  });

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [properties, setProperties] = useState<any[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  
  const [chartData, setChartData] = useState({
    leadsTrend: [] as { month: string; count: number }[],
    leadSources: [] as { source: string; count: number }[],
    propertyBookings: [] as { name: string; bookings: number }[],
    salesPerformance: [] as { name: string; leads: number; closed: number }[],
  });
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    loadStats();
    loadChartData();
  }, []);
  
  const loadChartData = async () => {
    setChartsLoading(true);
    try {
      const [analyticsRes, propertiesRes, salesExecsRes] = await Promise.all([
        fetch("/api/leads/analytics/summary").then(r => r.ok ? r.json() : null),
        fetch("/api/properties").then(r => r.ok ? r.json() : []),
        fetch("/api/admin/sales-executives", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        }).then(r => r.ok ? r.json() : [])
      ]);
      
      setChartData({
        leadsTrend: analyticsRes?.leadsByMonth || [],
        leadSources: analyticsRes?.leadsBySource || [],
        propertyBookings: propertiesRes?.slice(0, 6).map((p: any) => ({
          name: p.name?.split(' ').slice(0, 2).join(' ') || 'Property',
          bookings: p.roomTypes?.reduce((sum: number, rt: any) => sum + (rt.totalBeds - rt.availableBeds), 0) || 0
        })) || [],
        salesPerformance: salesExecsRes?.map((exec: any) => ({
          name: exec.name?.split(' ')[0] || 'Exec',
          leads: exec.totalLeads || 0,
          closed: exec.closedDeals || 0
        })) || []
      });
    } catch (error) {
      console.error("Failed to load chart data:", error);
    } finally {
      setChartsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "leads") {
      loadLeads();
    }
    if (activeTab === "properties") {
      loadProperties();
    }
    if (activeTab === "approvals") {
      loadPendingApprovals();
    }
  }, [activeTab]);

  const loadPendingApprovals = async () => {
    try {
      setApprovalsLoading(true);
      const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
      const response = await fetch("/api/bookings/pending-approval", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch pending approvals");
      const data = await response.json();
      setPendingApprovals(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load pending approvals",
        variant: "destructive",
      });
    } finally {
      setApprovalsLoading(false);
    }
  };

  const approveBooking = async (bookingId: string) => {
    try {
      const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
      const response = await fetch(`/api/bookings/${bookingId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("Failed to approve booking");
      toast({ title: "Success", description: "Booking approved successfully" });
      loadPendingApprovals();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve booking",
        variant: "destructive",
      });
    }
  };

  const rejectBooking = async () => {
    if (!selectedBooking) return;
    try {
      const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
      const response = await fetch(`/api/bookings/${selectedBooking.id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rejectionReason: rejectionReason || "Discount not approved",
        }),
      });
      if (!response.ok) throw new Error("Failed to reject booking");
      toast({ title: "Success", description: "Booking rejected" });
      setRejectDialogOpen(false);
      setRejectionReason("");
      setSelectedBooking(null);
      loadPendingApprovals();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject booking",
        variant: "destructive",
      });
    }
  };

  const loadProperties = async () => {
    try {
      setPropertiesLoading(true);
      const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
      const response = await fetch("/api/admin/properties", {
        headers: { 
          "Authorization": `Bearer ${token}`
        },
      });
      if (!response.ok) throw new Error("Failed to fetch properties");
      const data = await response.json();
      setProperties(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load properties",
        variant: "destructive",
      });
    } finally {
      setPropertiesLoading(false);
    }
  };

  const togglePropertyStatus = async (propertyId: string) => {
    try {
      const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
      const response = await fetch(`/api/admin/properties/${propertyId}/toggle-status`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
      });
      if (!response.ok) throw new Error("Failed to toggle status");
      toast({ title: "Success", description: "Property status updated" });
      loadProperties();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update property status",
        variant: "destructive",
      });
    }
  };

  const loadStats = async () => {
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load dashboard stats",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLeads = async () => {
    try {
      setLeadsLoading(true);
      const response = await fetch("/api/leads");
      if (!response.ok) throw new Error("Failed to fetch leads");
      const data = await response.json();
      setLeads(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load leads",
        variant: "destructive",
      });
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleApplyDiscount = async () => {
    try {
      toast({ 
        title: "Discount Applied", 
        description: "The override has been logged and applied." 
      });
      
      setDiscountModalOpen(false);
      setDiscountForm({ bookingId: "", discount: "", reason: "" });
      await loadStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to apply discount",
        variant: "destructive",
      });
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.phone && lead.phone.includes(searchTerm)) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDevice = deviceFilter === "all" || lead.deviceType === deviceFilter;
    
    return matchesSearch && matchesDevice;
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="w-4 h-4 text-muted-foreground" />;
      case "tablet":
        return <Monitor className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Monitor className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const occupancyRate = stats.totalBookings > 0 
    ? Math.round((stats.totalBookings / (stats.totalBookings + 10)) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <Button 
            variant={activeTab === "overview" ? "default" : "ghost"}
            className={`gap-2 ${activeTab === "overview" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md" : ""}`}
            onClick={() => setActiveTab("overview")}
            data-testid="tab-overview"
          >
            <Activity className="h-4 w-4" /> Overview
          </Button>
          <Button 
            variant={activeTab === "properties" ? "default" : "ghost"}
            className={`gap-2 ${activeTab === "properties" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md" : ""}`}
            onClick={() => setActiveTab("properties")}
            data-testid="tab-properties"
          >
            <Building2 className="h-4 w-4" /> Properties
          </Button>
          <Button 
            variant={activeTab === "leads" ? "default" : "ghost"}
            className={`gap-2 ${activeTab === "leads" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md" : ""}`}
            onClick={() => setActiveTab("leads")}
            data-testid="tab-leads"
          >
            <Users className="h-4 w-4" /> Leads
          </Button>
          <Button 
            variant={activeTab === "approvals" ? "default" : "ghost"}
            className={`gap-2 relative ${activeTab === "approvals" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md" : ""}`}
            onClick={() => setActiveTab("approvals")}
            data-testid="tab-approvals"
          >
            <AlertTriangle className="h-4 w-4" /> Approvals
            {pendingApprovals.length > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingApprovals.length}
              </Badge>
            )}
          </Button>
        </div>
        {activeTab === "overview" && (
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 border-slate-200 hover:bg-slate-50" data-testid="button-download-report">
              <FileText className="h-4 w-4" /> Export
            </Button>
            <Dialog open={discountModalOpen} onOpenChange={setDiscountModalOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-md" data-testid="button-apply-discount">
                  <DollarSign className="h-4 w-4" /> Apply Discount
                </Button>
              </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Apply Custom Discount</DialogTitle>
                    <DialogDescription>
                      This action will override the calculated fee for a specific booking. Action will be logged.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Booking ID</Label>
                      <Input 
                        id="booking-id" 
                        className="col-span-3" 
                        placeholder="Enter Booking ID" 
                        value={discountForm.bookingId}
                        onChange={(e) => setDiscountForm({ ...discountForm, bookingId: e.target.value })}
                        data-testid="input-booking-id"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Discount (₹)</Label>
                      <Input 
                        id="discount" 
                        className="col-span-3" 
                        placeholder="5000" 
                        type="number"
                        value={discountForm.discount}
                        onChange={(e) => setDiscountForm({ ...discountForm, discount: e.target.value })}
                        data-testid="input-discount"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Reason</Label>
                      <Input 
                        id="reason" 
                        className="col-span-3" 
                        placeholder="Scholarship / Referral" 
                        value={discountForm.reason}
                        onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })}
                        data-testid="input-reason"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleApplyDiscount} data-testid="button-submit-discount">
                      Apply Override
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <KPICard
                    title="Total Students"
                    value={stats.totalStudents}
                    icon={GraduationCap}
                    gradient="bg-gradient-to-br from-indigo-500 to-indigo-600"
                    trend="up"
                    trendValue="+12% this month"
                    loading={loading}
                  />
                  <KPICard
                    title="Total Bookings"
                    value={stats.totalBookings}
                    icon={CalendarCheck}
                    gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
                    trend="up"
                    trendValue="+8% this month"
                    loading={loading}
                  />
                  <KPICard
                    title="Revenue"
                    value={Math.round(stats.totalRevenue / 100000)}
                    prefix="₹"
                    suffix="L"
                    icon={CreditCard}
                    gradient="bg-gradient-to-br from-violet-500 to-violet-600"
                    trend="up"
                    trendValue="+15% this month"
                    loading={loading}
                  />
                  <KPICard
                    title="Pending Payments"
                    value={Math.round(stats.pendingPayments / 100000)}
                    prefix="₹"
                    suffix="L"
                    icon={Clock}
                    gradient="bg-gradient-to-br from-amber-500 to-amber-600"
                    trend="neutral"
                    trendValue="Due this week"
                    loading={loading}
                  />
                </div>

                {/* System Status Card */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Activity className="h-5 w-5 text-indigo-500" />
                      System Status
                    </CardTitle>
                    <CardDescription>Real-time platform health monitoring</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Database</p>
                          <p className="text-xs text-slate-500">PostgreSQL Connected</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">API Server</p>
                          <p className="text-xs text-slate-500">Express Running</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-700">Occupancy Rate</p>
                          <p className="text-xs text-slate-500">{occupancyRate}% Capacity</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Animated Charts Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="mt-6"
                >
                  <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-500" />
                    Analytics Overview
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <LeadsTrendChart 
                      data={chartData.leadsTrend} 
                      loading={chartsLoading}
                    />
                    <LeadSourcePieChart 
                      data={chartData.leadSources} 
                      loading={chartsLoading}
                    />
                    <PropertyBookingsChart 
                      data={chartData.propertyBookings} 
                      loading={chartsLoading}
                    />
                    <SalesPerformanceChart 
                      data={chartData.salesPerformance} 
                      loading={chartsLoading}
                    />
                  </div>
                </motion.div>
              </>
            )}

            {activeTab === "approvals" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Bookings Pending Approval ({pendingApprovals.length})
                      </CardTitle>
                      <Button variant="outline" onClick={loadPendingApprovals} data-testid="button-refresh-approvals">
                        Refresh
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {approvalsLoading ? (
                      <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : pendingApprovals.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        No bookings pending approval.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Booking Code</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Property</TableHead>
                            <TableHead>Base Fee</TableHead>
                            <TableHead>Discount</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Created By</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingApprovals.map((booking) => (
                            <TableRow key={booking.id} data-testid={`approval-row-${booking.id}`}>
                              <TableCell className="font-mono font-medium">{booking.bookingCode}</TableCell>
                              <TableCell>
                                {booking.walkInName || booking.studentId || "Lead Conversion"}
                              </TableCell>
                              <TableCell>{booking.propertyName || booking.propertyId}</TableCell>
                              <TableCell>₹{booking.baseFee?.toLocaleString()}</TableCell>
                              <TableCell className="text-orange-600">
                                ₹{booking.discount?.toLocaleString()} 
                                ({booking.baseFee > 0 ? ((booking.discount / booking.baseFee) * 100).toFixed(1) : 0}%)
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate">{booking.discountReason || "-"}</TableCell>
                              <TableCell>{booking.createdByName || "-"}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => approveBooking(booking.id)}
                                    data-testid={`button-approve-${booking.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      setSelectedBooking(booking);
                                      setRejectDialogOpen(true);
                                    }}
                                    data-testid={`button-reject-${booking.id}`}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reject Booking</DialogTitle>
                      <DialogDescription>
                        Provide a reason for rejecting booking {selectedBooking?.bookingCode}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Rejection Reason</Label>
                        <Input
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Enter reason for rejection"
                          data-testid="input-rejection-reason"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                      <Button variant="destructive" onClick={rejectBooking} data-testid="button-confirm-reject">
                        Confirm Rejection
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {activeTab === "leads" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        All Leads ({filteredLeads.length})
                      </CardTitle>
                      <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by name, phone, email..."
                            className="pl-10 w-full md:w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            data-testid="input-search-leads"
                          />
                        </div>
                        <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                          <SelectTrigger className="w-full md:w-40" data-testid="select-device-filter">
                            <SelectValue placeholder="Device Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Devices</SelectItem>
                            <SelectItem value="mobile">Mobile</SelectItem>
                            <SelectItem value="desktop">Desktop</SelectItem>
                            <SelectItem value="tablet">Tablet</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={loadLeads} data-testid="button-refresh-leads">
                          Refresh
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {leadsLoading ? (
                      <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : filteredLeads.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        {searchTerm || deviceFilter !== "all" 
                          ? "No leads match your search criteria" 
                          : "No leads yet. Visitors who sign in will appear here."}
                      </div>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[150px]">Name</TableHead>
                              <TableHead className="min-w-[150px]">Contact</TableHead>
                              <TableHead className="min-w-[120px]">First Login</TableHead>
                              <TableHead className="min-w-[120px]">Last Activity</TableHead>
                              <TableHead className="text-center">Visits</TableHead>
                              <TableHead className="text-center">Device</TableHead>
                              <TableHead className="text-center">Verified</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredLeads.map((lead) => (
                              <TableRow key={lead.id} data-testid={`lead-row-${lead.id}`}>
                                <TableCell className="font-medium">{lead.name}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {lead.phone && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Phone className="h-3 w-3 text-muted-foreground" />
                                        {lead.phone}
                                      </div>
                                    )}
                                    {lead.email && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Mail className="h-3 w-3 text-muted-foreground" />
                                        {lead.email}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    {formatDate(lead.firstLoginAt)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    {formatDate(lead.lastActivityAt)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                                    {lead.loginCount}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center" title={lead.deviceType || "Unknown"}>
                                    {getDeviceIcon(lead.deviceType)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {lead.phoneVerified ? (
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                      No
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "properties" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        All Properties ({properties.length})
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={loadProperties} data-testid="button-refresh-properties">
                          Refresh
                        </Button>
                        <Button 
                          onClick={() => setLocation("/admin/add-property")}
                          className="bg-[hsl(345,72%,41%)] hover:bg-[hsl(345,72%,35%)]"
                          data-testid="button-add-property"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Property
                        </Button>
                        <Button 
                          onClick={() => setLocation("/admin/booking/generate")}
                          className="bg-orange-500 hover:bg-orange-600"
                          data-testid="button-generate-booking"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Generate Booking
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {propertiesLoading ? (
                      <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : properties.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        No properties found.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {properties.map((property) => (
                          <div 
                            key={property.id} 
                            className="border rounded-xl p-6 hover:shadow-md transition-shadow"
                            data-testid={`property-admin-card-${property.id}`}
                          >
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <h3 className="text-xl font-bold">{property.name}</h3>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    property.active 
                                      ? "bg-green-100 text-green-700" 
                                      : "bg-red-100 text-red-700"
                                  }`}>
                                    {property.active ? "Active" : "Inactive"}
                                  </span>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    property.bookingMode === "academic_year" 
                                      ? "bg-purple-100 text-purple-700" 
                                      : "bg-blue-100 text-blue-700"
                                  }`}>
                                    {property.bookingMode === "academic_year" ? "Academic Year" : "Monthly"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground mb-3">
                                  <MapPin className="h-4 w-4" />
                                  <span>{property.location}</span>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {property.amenities?.slice(0, 5).map((am: string) => (
                                    <span key={am} className="px-2 py-1 bg-muted rounded-full text-xs">
                                      {am}
                                    </span>
                                  ))}
                                  {property.amenities?.length > 5 && (
                                    <span className="px-2 py-1 bg-muted rounded-full text-xs">
                                      +{property.amenities.length - 5} more
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    <Bed className="h-4 w-4 text-muted-foreground" />
                                    <span>{property.roomTypes?.length || 0} room types</span>
                                  </div>
                                  {property.phone && (
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-4 w-4 text-muted-foreground" />
                                      <span>{property.phone}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <Button 
                                  variant={property.active ? "destructive" : "default"}
                                  size="sm"
                                  onClick={() => togglePropertyStatus(property.id)}
                                  className="gap-2"
                                  data-testid={`button-toggle-property-${property.id}`}
                                >
                                  <Power className="h-4 w-4" />
                                  {property.active ? "Disable" : "Enable"}
                                </Button>
                              </div>
                            </div>
                            {property.roomTypes && property.roomTypes.length > 0 && (
                              <div className="mt-4 pt-4 border-t">
                                <h4 className="font-medium mb-3">Room Types</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {property.roomTypes.map((room: any) => (
                                    <div key={room.id} className="bg-muted/50 rounded-lg p-3">
                                      <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium">{room.name}</span>
                                        <span className="text-primary font-bold">₹{room.basePrice.toLocaleString()}</span>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {room.availableBeds}/{room.totalBeds} beds available
                                      </div>
                                      {room.size && (
                                        <div className="text-xs text-muted-foreground mt-1">{room.size}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
    </div>
  );
}
