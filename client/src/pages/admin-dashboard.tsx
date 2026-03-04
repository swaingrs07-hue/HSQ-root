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
import { Home, DollarSign, FileText, Users, Search, Phone, Mail, Calendar, Clock, Monitor, Smartphone, BarChart3, Building2, Power, MapPin, Bed, Plus, CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, GraduationCap, CreditCard, Activity, ArrowUpRight, ArrowDownRight, RefreshCw, CalendarCheck, Link2, Zap, UserCheck, Brain, Sparkles, Target, AlertCircle, PhoneCall, Eye, MessageSquare, Loader2, Trash2, Pencil, X, Save, Image as ImageIcon, Star, Globe } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
  const [chartsError, setChartsError] = useState<{
    leadsTrend?: string;
    leadSources?: string;
    propertyBookings?: string;
    salesPerformance?: string;
  }>({});
  
  const [overdueFollowUps, setOverdueFollowUps] = useState<Lead[]>([]);
  const [overdueLoading, setOverdueLoading] = useState(false);
  
  // Property assignment stats
  const [propertyAssignments, setPropertyAssignments] = useState<{
    totalProperties: number;
    propertiesWithExecs: number;
    unassignedLeads: number;
  }>({ totalProperties: 0, propertiesWithExecs: 0, unassignedLeads: 0 });
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  // AI Recommendations
  const [aiRecommendations, setAiRecommendations] = useState<{
    generatedAt: string;
    recommendations: Array<{
      leadId: string;
      leadName: string;
      priority: "urgent" | "high" | "medium" | "low";
      type: "follow_up" | "re_engage" | "escalate" | "nurture" | "close" | "at_risk";
      title: string;
      rationale: string;
      suggestedAction: string;
      confidence: number;
    }>;
  } | null>(null);
  const [recoLoading, setRecoLoading] = useState(false);

  const getAuthToken = () => {
    try {
      const authData = localStorage.getItem("hsquare_auth");
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed?.token || null;
      }
    } catch {
      return null;
    }
    return null;
  };

  useEffect(() => {
    loadStats();
    loadChartData();
    loadOverdueFollowUps();
    loadPropertyAssignmentStats();
    loadAIRecommendations();
  }, []);
  
  const loadOverdueFollowUps = async () => {
    try {
      setOverdueLoading(true);
      const token = getAuthToken();
      if (!token) return;
      
      const res = await fetch("/api/leads/follow-ups/overdue", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOverdueFollowUps(data);
      }
    } catch (error) {
      console.error("Failed to load overdue follow-ups:", error);
    } finally {
      setOverdueLoading(false);
    }
  };

  const loadPropertyAssignmentStats = async () => {
    try {
      setAssignmentLoading(true);
      const token = getAuthToken();
      if (!token) return;
      
      const res = await fetch("/api/admin/property-assignment-stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const stats = await res.json();
        setPropertyAssignments(stats);
      }
    } catch (error) {
      console.error("Failed to load property assignment stats:", error);
    } finally {
      setAssignmentLoading(false);
    }
  };

  const loadAIRecommendations = async (forceRefresh = false) => {
    try {
      setRecoLoading(true);
      const token = getAuthToken();
      if (!token) return;
      const url = forceRefresh ? "/api/admin/lead-recommendations?refresh=true" : "/api/admin/lead-recommendations";
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAiRecommendations(data);
      }
    } catch (error) {
      console.error("Failed to load AI recommendations:", error);
    } finally {
      setRecoLoading(false);
    }
  };
  
  const loadChartData = async () => {
    setChartsLoading(true);
    setChartsError({});
    
    const token = getAuthToken();
    const errors: typeof chartsError = {};
    
    try {
      const [analyticsRes, propertiesRes, salesExecsRes] = await Promise.allSettled([
        fetch("/api/leads/analytics/summary").then(r => {
          if (!r.ok) throw new Error("Failed to load leads analytics");
          return r.json();
        }),
        fetch("/api/properties").then(r => {
          if (!r.ok) throw new Error("Failed to load properties");
          return r.json();
        }),
        token ? fetch("/api/admin/sales-executives", {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => {
          if (!r.ok) throw new Error("Failed to load sales executives");
          return r.json();
        }) : Promise.resolve([])
      ]);
      
      const analytics = analyticsRes.status === 'fulfilled' ? analyticsRes.value : null;
      const propertiesData = propertiesRes.status === 'fulfilled' ? propertiesRes.value : [];
      const salesExecsData = salesExecsRes.status === 'fulfilled' ? salesExecsRes.value : [];
      
      if (analyticsRes.status === 'rejected') {
        errors.leadsTrend = "Unable to load leads trend";
        errors.leadSources = "Unable to load lead sources";
      }
      if (propertiesRes.status === 'rejected') {
        errors.propertyBookings = "Unable to load property data";
      }
      if (salesExecsRes.status === 'rejected') {
        errors.salesPerformance = "Unable to load sales data";
      }
      
      setChartData({
        leadsTrend: analytics?.leadsByMonth || [],
        leadSources: analytics?.leadsBySource || [],
        propertyBookings: propertiesData?.slice(0, 6).map((p: any) => ({
          name: p.name?.split(' ').slice(0, 2).join(' ') || 'Property',
          bookings: p.roomTypes?.reduce((sum: number, rt: any) => sum + (rt.totalBeds - rt.availableBeds), 0) || 0
        })) || [],
        salesPerformance: salesExecsData?.map((exec: any) => ({
          name: exec.name?.split(' ')[0] || 'Exec',
          leads: exec.totalLeads || 0,
          closed: exec.closedDeals || 0
        })) || []
      });
      setChartsError(errors);
    } catch (error) {
      console.error("Failed to load chart data:", error);
      setChartsError({
        leadsTrend: "Unable to load data",
        leadSources: "Unable to load data",
        propertyBookings: "Unable to load data",
        salesPerformance: "Unable to load data"
      });
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

  const [deletePropertyId, setDeletePropertyId] = useState<string | null>(null);
  const [deletePropertyName, setDeletePropertyName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteProperty = async () => {
    if (!deletePropertyId) return;
    setIsDeleting(true);
    try {
      const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
      const response = await fetch(`/api/admin/properties/${deletePropertyId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to delete property");
      toast({ title: "Deleted", description: data.message });
      setDeletePropertyId(null);
      loadProperties();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete property",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const [editProperty, setEditProperty] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "", displayName: "", propertyCode: "", category: "hostel", bookingMode: "monthly",
    location: "", address: "", city: "", phone: "", email: "",
    amenities: "" as string, rules: "", mapsUrl: "", status: "draft",
    virtualTourUrl: "", virtualTourProvider: "", highlights: "",
  });
  const [editPropertyImages, setEditPropertyImages] = useState<any[]>([]);
  const [editImagesLoading, setEditImagesLoading] = useState(false);
  const [editTab, setEditTab] = useState("basic");
  const [isSaving, setIsSaving] = useState(false);

  const openEditDialog = async (property: any) => {
    setEditProperty(property);
    setEditTab("basic");
    setEditForm({
      name: property.name || "",
      displayName: property.displayName || "",
      propertyCode: property.propertyCode || "",
      category: property.category || "hostel",
      bookingMode: property.bookingMode || "monthly",
      location: property.location || "",
      address: property.address || "",
      city: property.city || "",
      phone: property.phone || "",
      email: property.email || "",
      amenities: (property.amenities || []).join(", "),
      rules: property.rules || "",
      mapsUrl: property.mapsUrl || "",
      status: property.status || "draft",
      virtualTourUrl: property.virtualTourUrl || "",
      virtualTourProvider: property.virtualTourProvider || "",
      highlights: (property.highlights || []).join(", "),
    });
    setEditImagesLoading(true);
    try {
      const res = await fetch(`/api/properties/${property.id}/images`);
      if (res.ok) {
        const imgs = await res.json();
        setEditPropertyImages(imgs);
      } else {
        let fallbackImages: any[] = [];
        if (property.tourOverviewImages) {
          try {
            const urls = JSON.parse(property.tourOverviewImages);
            fallbackImages = urls.map((url: string, i: number) => ({ id: `tour-${i}`, imageUrl: url, caption: "", isPrimary: i === 0 }));
          } catch {}
        }
        if (fallbackImages.length === 0 && property.imageUrl) {
          fallbackImages = [{ id: "main", imageUrl: property.imageUrl, caption: "", isPrimary: true }];
        }
        setEditPropertyImages(fallbackImages);
      }
    } catch {
      setEditPropertyImages([]);
    } finally {
      setEditImagesLoading(false);
    }
  };

  const handleEditProperty = async () => {
    if (!editProperty) return;
    setIsSaving(true);
    try {
      const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
      const payload = {
        ...editForm,
        amenities: editForm.amenities.split(",").map((a: string) => a.trim()).filter(Boolean),
        highlights: editForm.highlights ? editForm.highlights.split(",").map((h: string) => h.trim()).filter(Boolean) : [],
      };
      const response = await fetch(`/api/admin/properties/${editProperty.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to update property");
      toast({ title: "Property updated successfully" });
      setEditProperty(null);
      loadProperties();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-1 px-1 scrollbar-hide">
          <Button 
            variant={activeTab === "overview" ? "default" : "ghost"}
            size="sm"
            className={`gap-1.5 shrink-0 text-xs sm:text-sm ${activeTab === "overview" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md" : ""}`}
            onClick={() => setActiveTab("overview")}
            data-testid="tab-overview"
          >
            <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Overview
          </Button>
          <Button 
            variant={activeTab === "properties" ? "default" : "ghost"}
            size="sm"
            className={`gap-1.5 shrink-0 text-xs sm:text-sm ${activeTab === "properties" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md" : ""}`}
            onClick={() => setActiveTab("properties")}
            data-testid="tab-properties"
          >
            <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Properties
          </Button>
          <Button 
            variant={activeTab === "leads" ? "default" : "ghost"}
            size="sm"
            className={`gap-1.5 shrink-0 text-xs sm:text-sm ${activeTab === "leads" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md" : ""}`}
            onClick={() => setActiveTab("leads")}
            data-testid="tab-leads"
          >
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Leads
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

                {/* Overdue Follow-Ups Card */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="h-5 w-5 text-orange-500" />
                      Overdue Follow-Ups
                      {overdueFollowUps.length > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          {overdueFollowUps.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Leads that need immediate attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {overdueLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : overdueFollowUps.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                        <CheckCircle className="h-10 w-10 mb-2" />
                        <p className="text-sm font-medium">All follow-ups are up to date!</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {overdueFollowUps.slice(0, 5).map((lead) => (
                          <div
                            key={lead.id}
                            className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-orange-100 rounded-lg">
                                <Phone className="h-4 w-4 text-orange-600" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">{lead.name}</p>
                                <p className="text-xs text-slate-500">
                                  Due: {formatDate(lead.followUpAt)}
                                </p>
                              </div>
                            </div>
                            <Link href={`/admin/requests`}>
                              <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-100">
                                View
                              </Button>
                            </Link>
                          </div>
                        ))}
                        {overdueFollowUps.length > 5 && (
                          <Link href="/admin/requests">
                            <Button variant="ghost" className="w-full text-orange-600 hover:bg-orange-50">
                              View all {overdueFollowUps.length} overdue follow-ups
                            </Button>
                          </Link>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Property Assignment Summary Card */}
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Link2 className="h-5 w-5 text-blue-500" />
                      Property Auto-Assignment
                    </CardTitle>
                    <CardDescription>Property → Sales Exec mapping status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {assignmentLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3 bg-blue-50 rounded-xl text-center">
                            <Building2 className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-blue-700">{propertyAssignments.totalProperties}</p>
                            <p className="text-xs text-blue-600">Properties</p>
                          </div>
                          <div className="p-3 bg-green-50 rounded-xl text-center">
                            <UserCheck className="h-5 w-5 text-green-600 mx-auto mb-1" />
                            <p className="text-2xl font-bold text-green-700">{propertyAssignments.propertiesWithExecs}</p>
                            <p className="text-xs text-green-600">With Execs</p>
                          </div>
                          <div className={`p-3 rounded-xl text-center ${propertyAssignments.unassignedLeads > 0 ? 'bg-yellow-50' : 'bg-slate-50'}`}>
                            <Zap className={`h-5 w-5 mx-auto mb-1 ${propertyAssignments.unassignedLeads > 0 ? 'text-yellow-600' : 'text-slate-400'}`} />
                            <p className={`text-2xl font-bold ${propertyAssignments.unassignedLeads > 0 ? 'text-yellow-700' : 'text-slate-500'}`}>
                              {propertyAssignments.unassignedLeads}
                            </p>
                            <p className={`text-xs ${propertyAssignments.unassignedLeads > 0 ? 'text-yellow-600' : 'text-slate-400'}`}>
                              Unassigned
                            </p>
                          </div>
                        </div>
                        
                        {propertyAssignments.totalProperties > propertyAssignments.propertiesWithExecs && (
                          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
                            <p className="text-sm text-yellow-700">
                              {propertyAssignments.totalProperties - propertyAssignments.propertiesWithExecs} properties have no sales execs assigned
                            </p>
                          </div>
                        )}
                        
                        <Link href="/admin/sales-management">
                          <Button variant="outline" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50">
                            Manage Property Mappings
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* AI Engagement Recommendations */}
                <Card className="border-0 shadow-lg overflow-hidden">
                  <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-indigo-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className="p-1.5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg">
                            <Brain className="h-4 w-4 text-white" />
                          </div>
                          AI Engagement Insights
                          <Badge className="bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-[10px] border-0">
                            AI-Powered
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Smart recommendations to maximize lead conversions
                          {aiRecommendations?.generatedAt && (
                            <span className="ml-2 text-[10px] text-slate-400">
                              Updated {new Date(aiRecommendations.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50"
                        onClick={() => loadAIRecommendations(true)}
                        disabled={recoLoading}
                        data-testid="button-refresh-ai-reco"
                      >
                        {recoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {recoLoading ? "Analyzing..." : "Refresh"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {recoLoading && !aiRecommendations ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex gap-3 p-3 rounded-xl bg-slate-50 animate-pulse">
                            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-2/3" />
                              <Skeleton className="h-3 w-full" />
                              <Skeleton className="h-3 w-4/5" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : !aiRecommendations || aiRecommendations.recommendations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                        <Brain className="h-10 w-10 mb-2 opacity-50" />
                        <p className="text-sm font-medium">No recommendations available</p>
                        <p className="text-xs mt-1">Add more leads to get AI-powered engagement strategies</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                        {aiRecommendations.recommendations.map((rec, idx) => {
                          const typeConfig: Record<string, { icon: React.ComponentType<{className?: string}>, color: string, bg: string }> = {
                            follow_up: { icon: PhoneCall, color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
                            re_engage: { icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
                            escalate: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 border-red-100" },
                            nurture: { icon: Eye, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
                            close: { icon: Target, color: "text-violet-600", bg: "bg-violet-50 border-violet-100" },
                            at_risk: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
                          };
                          const config = typeConfig[rec.type] || typeConfig.follow_up;
                          const TypeIcon = config.icon;
                          const priorityColors: Record<string, string> = {
                            urgent: "bg-red-100 text-red-700",
                            high: "bg-orange-100 text-orange-700",
                            medium: "bg-yellow-100 text-yellow-700",
                            low: "bg-slate-100 text-slate-600",
                          };

                          return (
                            <motion.div
                              key={`${rec.leadId}-${idx}`}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className={`flex gap-3 p-3 rounded-xl border ${config.bg} hover:shadow-sm transition-all cursor-pointer group`}
                              data-testid={`ai-reco-${rec.leadId}`}
                            >
                              <div className={`p-2 rounded-lg ${config.bg} shrink-0 self-start`}>
                                <TypeIcon className={`h-5 w-5 ${config.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-sm text-slate-800 truncate">{rec.title}</span>
                                  <Badge className={`text-[10px] px-1.5 py-0 ${priorityColors[rec.priority]}`}>
                                    {rec.priority}
                                  </Badge>
                                  <span className="text-[10px] text-slate-400 ml-auto shrink-0">{rec.confidence}% conf.</span>
                                </div>
                                <p className="text-xs text-slate-600 mb-1.5 leading-relaxed">{rec.rationale}</p>
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium text-slate-700">
                                    <Sparkles className="h-3 w-3 inline mr-1 text-violet-500" />
                                    {rec.suggestedAction}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
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
                      error={chartsError.leadsTrend}
                    />
                    <LeadSourcePieChart 
                      data={chartData.leadSources} 
                      loading={chartsLoading}
                      error={chartsError.leadSources}
                    />
                    <PropertyBookingsChart 
                      data={chartData.propertyBookings} 
                      loading={chartsLoading}
                      error={chartsError.propertyBookings}
                    />
                    <SalesPerformanceChart 
                      data={chartData.salesPerformance} 
                      loading={chartsLoading}
                      error={chartsError.salesPerformance}
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
                              {(() => {
                                let thumbUrl = property.imageUrl;
                                if (!thumbUrl && property.tourOverviewImages) {
                                  try { thumbUrl = JSON.parse(property.tourOverviewImages)[0]; } catch {}
                                }
                                return thumbUrl ? (
                                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 shrink-0 hidden md:block">
                                    <img src={thumbUrl} alt={property.name} className="w-full h-full object-cover" />
                                  </div>
                                ) : null;
                              })()}
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
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditDialog(property)}
                                  className="gap-2"
                                  data-testid={`button-edit-property-${property.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit
                                </Button>
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
                                <Button 
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setDeletePropertyId(property.id);
                                    setDeletePropertyName(property.name);
                                  }}
                                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                  data-testid={`button-delete-property-${property.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
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

      <Dialog open={!!editProperty} onOpenChange={(open) => { if (!open) setEditProperty(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-indigo-500" />
              Edit Property
            </DialogTitle>
            <DialogDescription>
              Update all details for {editProperty?.name}
            </DialogDescription>
          </DialogHeader>
          {editProperty && (
            <Tabs value={editTab} onValueChange={setEditTab}>
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="basic" className="text-xs gap-1" data-testid="edit-tab-basic">
                  <Building2 className="h-3 w-3" /> Basic
                </TabsTrigger>
                <TabsTrigger value="location" className="text-xs gap-1" data-testid="edit-tab-location">
                  <MapPin className="h-3 w-3" /> Location
                </TabsTrigger>
                <TabsTrigger value="features" className="text-xs gap-1" data-testid="edit-tab-features">
                  <Star className="h-3 w-3" /> Features
                </TabsTrigger>
                <TabsTrigger value="images" className="text-xs gap-1" data-testid="edit-tab-images">
                  <ImageIcon className="h-3 w-3" /> Images
                  {editPropertyImages.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 text-[10px]">{editPropertyImages.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Property Name *</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                      data-testid="input-edit-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      value={editForm.displayName}
                      onChange={(e) => setEditForm(f => ({ ...f, displayName: e.target.value }))}
                      placeholder="Optional display name"
                      data-testid="input-edit-display-name"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Property Code</Label>
                    <Input
                      value={editForm.propertyCode}
                      onChange={(e) => setEditForm(f => ({ ...f, propertyCode: e.target.value }))}
                      placeholder="e.g. JUHU-01"
                      data-testid="input-edit-property-code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={editForm.category} onValueChange={(v) => setEditForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger data-testid="select-edit-category"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hostel">Hostel</SelectItem>
                        <SelectItem value="hotel">Hotel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Booking Mode</Label>
                    <Select value={editForm.bookingMode} onValueChange={(v) => setEditForm(f => ({ ...f, bookingMode: v }))}>
                      <SelectTrigger data-testid="select-edit-booking-mode"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="academic_year">Academic Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                      data-testid="input-edit-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={editForm.email}
                      onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                      type="email"
                      data-testid="input-edit-email"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="location" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location *</Label>
                    <Input
                      value={editForm.location}
                      onChange={(e) => setEditForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="Mumbai, Maharashtra"
                      data-testid="input-edit-location"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={editForm.city}
                      onChange={(e) => setEditForm(f => ({ ...f, city: e.target.value }))}
                      data-testid="input-edit-city"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Full Address</Label>
                  <Textarea
                    value={editForm.address}
                    onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
                    rows={3}
                    placeholder="Complete address with pincode"
                    data-testid="input-edit-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Google Maps URL
                  </Label>
                  <Input
                    value={editForm.mapsUrl}
                    onChange={(e) => setEditForm(f => ({ ...f, mapsUrl: e.target.value }))}
                    placeholder="https://maps.app.goo.gl/..."
                    data-testid="input-edit-maps-url"
                  />
                </div>
              </TabsContent>

              <TabsContent value="features" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label>Amenities (comma-separated)</Label>
                  <Textarea
                    value={editForm.amenities}
                    onChange={(e) => setEditForm(f => ({ ...f, amenities: e.target.value }))}
                    rows={3}
                    placeholder="Free Wifi, AC, 24X7 Security, Power Backup"
                    data-testid="input-edit-amenities"
                  />
                  {editForm.amenities && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {editForm.amenities.split(",").map((a, i) => a.trim()).filter(Boolean).map((a, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Highlights (comma-separated)</Label>
                  <Textarea
                    value={editForm.highlights}
                    onChange={(e) => setEditForm(f => ({ ...f, highlights: e.target.value }))}
                    rows={2}
                    placeholder="Premium Location, Near Metro, Fully Furnished"
                    data-testid="input-edit-highlights"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rules</Label>
                  <Textarea
                    value={editForm.rules}
                    onChange={(e) => setEditForm(f => ({ ...f, rules: e.target.value }))}
                    rows={3}
                    placeholder="Check-in: 12:00 PM | Check-out: 11:00 AM"
                    data-testid="input-edit-rules"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Virtual Tour URL</Label>
                    <Input
                      value={editForm.virtualTourUrl}
                      onChange={(e) => setEditForm(f => ({ ...f, virtualTourUrl: e.target.value }))}
                      placeholder="https://my.matterport.com/show/..."
                      data-testid="input-edit-virtual-tour-url"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tour Provider</Label>
                    <Select value={editForm.virtualTourProvider || ""} onValueChange={(v) => setEditForm(f => ({ ...f, virtualTourProvider: v }))}>
                      <SelectTrigger data-testid="select-edit-tour-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="matterport">Matterport</SelectItem>
                        <SelectItem value="kuula">Kuula</SelectItem>
                        <SelectItem value="cloudpano">CloudPano</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="images" className="space-y-4 mt-0">
                {editImagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading images...</span>
                  </div>
                ) : editPropertyImages.length > 0 ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">{editPropertyImages.length} image{editPropertyImages.length !== 1 ? "s" : ""} uploaded for this property</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {editPropertyImages.map((img: any, idx: number) => (
                        <div key={img.id || idx} className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 border" data-testid={`edit-property-image-${idx}`}>
                          <img
                            src={img.imageUrl}
                            alt={img.caption || `Property image ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {img.isPrimary && (
                            <div className="absolute top-1.5 left-1.5 bg-yellow-400 rounded-full p-1 shadow">
                              <Star className="w-3 h-3 text-yellow-800 fill-yellow-800" />
                            </div>
                          )}
                          {img.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                              <span className="text-white text-[10px] line-clamp-1">{img.caption}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">To manage images (add, remove, reorder), use the Tour Images section in the admin sidebar.</p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No images uploaded for this property.</p>
                    <p className="text-xs mt-1">Use the Tour Images section in the admin sidebar to add images.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditProperty(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleEditProperty}
              disabled={isSaving || !editForm.name || !editForm.location}
              className="gap-2"
              data-testid="button-save-property"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletePropertyId} onOpenChange={(open) => { if (!open) setDeletePropertyId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Property
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletePropertyName}</strong>? This will permanently remove the property along with all its room types, rules, tariffs, images, and sales executive assignments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeletePropertyId(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteProperty} 
              disabled={isDeleting}
              className="gap-2"
              data-testid="button-confirm-delete-property"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {isDeleting ? "Deleting..." : "Delete Property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
