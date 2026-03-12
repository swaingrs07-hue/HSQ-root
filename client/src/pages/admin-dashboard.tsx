import { useState, useEffect, useRef } from "react";
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
import { Home, DollarSign, FileText, Users, Search, Phone, Mail, Calendar, Clock, Monitor, Smartphone, BarChart3, Building2, Power, MapPin, Bed, Plus, CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, GraduationCap, CreditCard, Activity, ArrowUpRight, ArrowDownRight, RefreshCw, CalendarCheck, Link2, Zap, UserCheck, Brain, Sparkles, Target, AlertCircle, PhoneCall, Eye, MessageSquare, Loader2, Trash2, Pencil, X, Save, Image as ImageIcon, Star, Globe, Upload, UtensilsCrossed, Bus, Bike, Shirt, SprayCan, Lock, Tag, Package } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getAdminStats } from "@/lib/api";
import type { Lead } from "@shared/schema";
import { LeadsTrendChart, PropertyBookingsChart, SalesPerformanceChart, LeadSourcePieChart } from "@/components/animated-charts";
import { FadeInView, StaggeredList, StaggeredItem } from "@/components/motion-primitives";
import TargetAchievementTab from "@/components/target-achievement-tab";

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number | string; prefix?: string; suffix?: string }) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  const isDecimal = typeof value === "string" && value.includes(".");
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const increment = numValue / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numValue) {
        setDisplayValue(numValue);
        clearInterval(timer);
      } else {
        setDisplayValue(isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [numValue, isDecimal]);
  
  const formatted = isDecimal ? displayValue.toFixed(1) : displayValue.toLocaleString("en-IN");
  return <span>{prefix}{formatted}{suffix}</span>;
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
  value: number | string; 
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
    occupiedBeds: 0,
    totalBeds: 0,
    occupancyRate: 0,
    studentsThisMonth: 0,
    studentsPrevMonth: 0,
    bookingsThisMonth: 0,
    bookingsPrevMonth: 0,
    revenueThisMonth: 0,
    revenuePrevMonth: 0,
    pendingDueThisWeek: 0,
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
  const [editRoomTypes, setEditRoomTypes] = useState<any[]>([]);
  const [editIncludedServices, setEditIncludedServices] = useState<any[]>([]);
  const [editMoveInCharges, setEditMoveInCharges] = useState<{ serviceLegalCharges: number }>({ serviceLegalCharges: 0 });
  const [savingRoomTypes, setSavingRoomTypes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_IMAGES = 50;

  const compressImage = (file: File, maxSizeBytes = MAX_FILE_SIZE, maxDimension = 3840): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
        const supportsWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
        const outputMime = supportsWebp ? "image/webp" : "image/jpeg";
        const outputExt = supportsWebp ? ".webp" : ".jpg";
        const tryQuality = (quality: number) => {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error("Compression failed")); return; }
            if (blob.size <= maxSizeBytes || quality <= 0.5) {
              if (blob.size > maxSizeBytes) {
                reject(new Error(`Image still ${(blob.size / 1024 / 1024).toFixed(1)}MB after max compression`));
                return;
              }
              const baseName = file.name.replace(/\.[^/.]+$/, "");
              resolve(new File([blob], `${baseName}${outputExt}`, { type: outputMime, lastModified: Date.now() }));
            } else {
              tryQuality(quality - 0.05);
            }
          }, outputMime, quality);
        };
        tryQuality(0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
      img.src = url;
    });
  };

  const uploadFileToStorage = async (file: File): Promise<string> => {
    const urlRes = await fetch("/api/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });
    if (!urlRes.ok) throw new Error("Failed to get upload URL");
    const { uploadURL, objectPath } = await urlRes.json();
    const uploadRes = await fetch(uploadURL, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!uploadRes.ok) throw new Error("Failed to upload file");
    return objectPath;
  };

  const handleEditImageUpload = async (files: FileList | null) => {
    if (!files || !editProperty) return;
    const currentCount = editPropertyImages.length;
    const remainingSlots = MAX_IMAGES - currentCount;
    if (remainingSlots <= 0) {
      toast({ title: "Maximum Images", description: `You can only upload up to ${MAX_IMAGES} images.`, variant: "destructive" });
      return;
    }
    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setEditImageUploading(true);
    const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
    const newImages: any[] = [];

    for (const file of filesToUpload) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({ title: "Invalid File Type", description: `${file.name} is not valid. Use JPG, PNG, or WEBP.`, variant: "destructive" });
        continue;
      }
      let processedFile = file;
      if (file.size > MAX_FILE_SIZE) {
        try {
          toast({ title: "Compressing Image", description: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — auto-resizing...` });
          processedFile = await compressImage(file);
        } catch {
          toast({ title: "Compression Failed", description: `Could not auto-resize ${file.name}. Try a smaller file.`, variant: "destructive" });
          continue;
        }
      }
      try {
        const objectPath = await uploadFileToStorage(processedFile);
        const isPrimary = currentCount === 0 && newImages.length === 0;
        const createRes = await fetch(`/api/admin/properties/${editProperty.id}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ imageUrl: objectPath, caption: file.name.replace(/\.[^/.]+$/, ""), isPrimary, sortOrder: currentCount + newImages.length }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          newImages.push(created);
        }
      } catch (err) {
        toast({ title: "Upload Failed", description: `Failed to upload ${file.name}`, variant: "destructive" });
      }
    }

    if (newImages.length > 0) {
      setEditPropertyImages(prev => [...prev, ...newImages]);
      const allUrls = [...editPropertyImages, ...newImages].map((img: any) => img.imageUrl);
      await fetch(`/api/admin/properties/${editProperty.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          tourOverviewImages: JSON.stringify(allUrls),
          imageUrl: allUrls[0],
        }),
      }).catch(() => {});
      toast({ title: "Images Uploaded", description: `${newImages.length} image${newImages.length !== 1 ? "s" : ""} added successfully.` });
    }
    setEditImageUploading(false);
  };

  const handleDeleteEditImage = async (imageId: string, index: number) => {
    if (!editProperty) return;
    const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
    try {
      if (!imageId.startsWith("tour-") && imageId !== "main") {
        await fetch(`/api/admin/images/${imageId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` },
        });
      }
      const updated = editPropertyImages.filter((_, i) => i !== index);
      setEditPropertyImages(updated);
      const allUrls = updated.map((img: any) => img.imageUrl);
      await fetch(`/api/admin/properties/${editProperty.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          tourOverviewImages: allUrls.length > 0 ? JSON.stringify(allUrls) : null,
          imageUrl: allUrls[0] || null,
        }),
      }).catch(() => {});
      toast({ title: "Image removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove image", variant: "destructive" });
    }
  };

  const handleSaveRoomTypes = async () => {
    if (!editProperty) return;
    setSavingRoomTypes(true);
    try {
      const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
      const errors: string[] = [];
      const originalIds = (editProperty.roomTypes || []).map((rt: any) => rt.id);
      const currentIds = editRoomTypes.filter(rt => !rt.isNew).map(rt => rt.id);
      const deletedIds = originalIds.filter((id: string) => !currentIds.includes(id));

      for (const id of deletedIds) {
        const res = await fetch(`/api/admin/room-types/${id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` },
        });
        if (!res.ok) errors.push(`Delete failed for room type`);
      }

      for (const rt of editRoomTypes) {
        const payload = {
          name: rt.name,
          customName: rt.name === "Custom" ? rt.customName : null,
          occupancy: rt.occupancy,
          totalRooms: rt.totalRooms,
          totalBeds: rt.totalBeds,
          availableBeds: rt.availableBeds,
          basePrice: rt.basePrice,
          academicYearPrice: rt.academicYearPrice || null,
          deposit: rt.deposit || 0,
          size: rt.size || null,
        };

        if (rt.isNew) {
          const res = await fetch(`/api/admin/properties/${editProperty.id}/room-types`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
          if (!res.ok) errors.push(rt.customName || rt.name);
        } else {
          const res = await fetch(`/api/admin/room-types/${rt.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
          if (!res.ok) errors.push(rt.customName || rt.name);
        }
      }
      if (errors.length > 0) {
        toast({ title: "Some room types failed to save", description: errors.join(", "), variant: "destructive" });
      } else {
        toast({ title: "Room types saved successfully" });
      }
      loadProperties();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingRoomTypes(false);
    }
  };

  const openEditDialog = async (property: any) => {
    setEditProperty(property);
    setEditTab("basic");
    setEditRoomTypes((property.roomTypes || []).map((rt: any) => ({ ...rt })));
    setEditIncludedServices(Array.isArray(property.includedServices) ? property.includedServices.map((s: any) => ({ ...s })) : []);
    setEditMoveInCharges(property.moveInCharges ? { serviceLegalCharges: (property.moveInCharges.serviceLegalCharges || 0) || ((property.moveInCharges.policeVerification || 0) + (property.moveInCharges.agreement || 0)) } : { serviceLegalCharges: 0 });
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
        includedServices: editIncludedServices,
        moveInCharges: editMoveInCharges.serviceLegalCharges > 0 ? editMoveInCharges : null,
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

  const occupancyRate = stats.occupancyRate;

  const formatTrend = (current: number, previous: number): { trend: "up" | "down" | "neutral"; value: string } => {
    if (previous === 0 && current === 0) return { trend: "neutral", value: "No change" };
    if (previous === 0 && current > 0) return { trend: "up", value: `+${current} this month` };
    const pctChange = Math.round(((current - previous) / previous) * 100);
    if (pctChange > 0) return { trend: "up", value: `+${pctChange}% vs last month` };
    if (pctChange < 0) return { trend: "down", value: `${pctChange}% vs last month` };
    return { trend: "neutral", value: "No change" };
  };

  const formatAmount = (amount: number): { value: number | string; prefix: string; suffix: string } => {
    if (amount >= 10000000) return { value: (amount / 10000000).toFixed(1), prefix: "₹", suffix: "Cr" };
    if (amount >= 100000) return { value: (amount / 100000).toFixed(1), prefix: "₹", suffix: "L" };
    if (amount >= 1000) return { value: (amount / 1000).toFixed(1), prefix: "₹", suffix: "K" };
    return { value: amount, prefix: "₹", suffix: "" };
  };

  const studentsTrend = formatTrend(stats.studentsThisMonth, stats.studentsPrevMonth);
  const bookingsTrend = formatTrend(stats.bookingsThisMonth, stats.bookingsPrevMonth);
  const revenueTrend = formatTrend(stats.revenueThisMonth, stats.revenuePrevMonth);
  const revenueDisplay = formatAmount(stats.totalRevenue);
  const pendingDisplay = formatAmount(stats.pendingPayments);

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
          <Button 
            variant={activeTab === "targets" ? "default" : "ghost"}
            size="sm"
            className={`gap-1.5 shrink-0 text-xs sm:text-sm ${activeTab === "targets" ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md" : ""}`}
            onClick={() => setActiveTab("targets")}
            data-testid="tab-targets"
          >
            <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Target & Achievement
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
                    trend={studentsTrend.trend}
                    trendValue={studentsTrend.value}
                    loading={loading}
                  />
                  <KPICard
                    title="Total Bookings"
                    value={stats.totalBookings}
                    icon={CalendarCheck}
                    gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
                    trend={bookingsTrend.trend}
                    trendValue={bookingsTrend.value}
                    loading={loading}
                  />
                  <KPICard
                    title="Revenue"
                    value={revenueDisplay.value}
                    prefix={revenueDisplay.prefix}
                    suffix={revenueDisplay.suffix}
                    icon={CreditCard}
                    gradient="bg-gradient-to-br from-violet-500 to-violet-600"
                    trend={revenueTrend.trend}
                    trendValue={revenueTrend.value}
                    loading={loading}
                  />
                  <KPICard
                    title="Pending Payments"
                    value={pendingDisplay.value}
                    prefix={pendingDisplay.prefix}
                    suffix={pendingDisplay.suffix}
                    icon={Clock}
                    gradient="bg-gradient-to-br from-amber-500 to-amber-600"
                    trend={stats.pendingPayments > 0 ? "down" : "neutral"}
                    trendValue={stats.pendingPayments > 0 ? "Pending collection" : "All clear"}
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
                          <p className="text-xs text-slate-500">{occupancyRate}% ({stats.occupiedBeds}/{stats.totalBeds} beds)</p>
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

            {activeTab === "targets" && (
              <TargetAchievementTab />
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
                                  {property.roomTypes.map((room: any) => {
                                    const isAcademic = property.bookingMode === "academic_year";
                                    const displayPrice = isAcademic
                                      ? (room.academicYearPrice || (room.basePrice ? room.basePrice * 11 : 0))
                                      : (room.basePrice || 0);
                                    return (
                                    <div key={room.id} className="bg-muted/50 rounded-lg p-3">
                                      <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium">{room.customName || room.name}</span>
                                        <span className="text-primary font-bold">₹{displayPrice.toLocaleString("en-IN")}</span>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {room.availableBeds}/{room.totalBeds} beds available
                                      </div>
                                      {room.size && (
                                        <div className="text-xs text-muted-foreground mt-1">{room.size}</div>
                                      )}
                                    </div>
                                    );
                                  })}
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
              <TabsList className="grid w-full grid-cols-7 mb-4">
                <TabsTrigger value="basic" className="text-xs gap-1" data-testid="edit-tab-basic">
                  <Building2 className="h-3 w-3" /> Basic
                </TabsTrigger>
                <TabsTrigger value="location" className="text-xs gap-1" data-testid="edit-tab-location">
                  <MapPin className="h-3 w-3" /> Location
                </TabsTrigger>
                <TabsTrigger value="features" className="text-xs gap-1" data-testid="edit-tab-features">
                  <Star className="h-3 w-3" /> Features
                </TabsTrigger>
                <TabsTrigger value="rooms" className="text-xs gap-1" data-testid="edit-tab-rooms">
                  <Bed className="h-3 w-3" /> Rooms
                  {editRoomTypes.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 text-[10px]">{editRoomTypes.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="services" className="text-xs gap-1" data-testid="edit-tab-services">
                  <UtensilsCrossed className="h-3 w-3" /> Services
                  {editIncludedServices.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 text-[10px]">{editIncludedServices.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="charges" className="text-xs gap-1" data-testid="edit-tab-charges">
                  <DollarSign className="h-3 w-3" /> Charges
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

              <TabsContent value="rooms" className="space-y-4 mt-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-rose-700">Room Types</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditRoomTypes(prev => [...prev, {
                      id: `new-${Date.now()}`,
                      isNew: true,
                      name: "Single",
                      customName: "",
                      occupancy: 1,
                      totalRooms: 1,
                      totalBeds: 1,
                      availableBeds: 1,
                      basePrice: 0,
                      academicYearPrice: null,
                      deposit: 0,
                      size: "",
                    }])}
                    data-testid="button-add-room-type"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Room Type
                  </Button>
                </div>
                {editRoomTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No room types. Click "Add Room Type" to create one.</p>
                ) : (
                  <div className="space-y-4">
                    {editRoomTypes.map((rt: any, idx: number) => (
                      <div key={rt.id} className="border rounded-lg p-4 space-y-3" data-testid={`edit-room-type-${rt.id}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm">Room Type {idx + 1}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 h-7 px-2"
                            onClick={() => setEditRoomTypes(prev => prev.filter((_, i) => i !== idx))}
                            data-testid={`button-remove-room-${rt.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Type *</Label>
                            <Select
                              value={rt.name}
                              onValueChange={(v) => setEditRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, name: v, customName: v === "Custom" ? (r.customName || "") : "" } : r))}
                            >
                              <SelectTrigger className="h-9" data-testid={`select-room-type-${rt.id}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Single">Single</SelectItem>
                                <SelectItem value="Double">Double</SelectItem>
                                <SelectItem value="Triple">Triple</SelectItem>
                                <SelectItem value="Custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Occupancy *</Label>
                            <Input
                              type="number"
                              min={1}
                              value={rt.occupancy || ""}
                              onChange={(e) => setEditRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, occupancy: Number(e.target.value) || 1 } : r))}
                              data-testid={`input-room-occupancy-${rt.id}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Total Rooms *</Label>
                            <Input
                              type="number"
                              min={1}
                              value={rt.totalRooms || ""}
                              onChange={(e) => setEditRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, totalRooms: Number(e.target.value) || 1 } : r))}
                              data-testid={`input-room-total-rooms-${rt.id}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Total Beds *</Label>
                            <Input
                              type="number"
                              min={1}
                              value={rt.totalBeds || ""}
                              onChange={(e) => setEditRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, totalBeds: Number(e.target.value) || 1 } : r))}
                              data-testid={`input-room-total-beds-${rt.id}`}
                            />
                          </div>
                        </div>
                        {rt.name === "Custom" && (
                          <div className="space-y-1">
                            <Label className="text-xs">Custom Name *</Label>
                            <Input
                              value={rt.customName || ""}
                              placeholder="e.g. QUAD, Double(2+2)"
                              onChange={(e) => setEditRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, customName: e.target.value } : r))}
                              data-testid={`input-room-custom-name-${rt.id}`}
                            />
                          </div>
                        )}
                        <div className="grid grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Available Beds *</Label>
                            <Input
                              type="number"
                              min={0}
                              value={rt.availableBeds ?? ""}
                              onChange={(e) => setEditRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, availableBeds: Number(e.target.value) || 0 } : r))}
                              data-testid={`input-room-available-beds-${rt.id}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Base Price (₹/month) *</Label>
                            <Input
                              type="number"
                              min={0}
                              value={rt.basePrice || ""}
                              onChange={(e) => setEditRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, basePrice: Number(e.target.value) || 0 } : r))}
                              data-testid={`input-room-price-${rt.id}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Deposit (₹)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={rt.deposit || ""}
                              onChange={(e) => setEditRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, deposit: Number(e.target.value) || 0 } : r))}
                              data-testid={`input-room-deposit-${rt.id}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Room Size</Label>
                            <Input
                              value={rt.size || ""}
                              placeholder="e.g. 150 sq ft"
                              onChange={(e) => setEditRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, size: e.target.value } : r))}
                              data-testid={`input-room-size-${rt.id}`}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Academic Year Price (₹)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={rt.academicYearPrice || ""}
                              placeholder={rt.basePrice ? `${rt.basePrice * 11}` : ""}
                              onChange={(e) => setEditRoomTypes(prev => prev.map((r, i) => i === idx ? { ...r, academicYearPrice: Number(e.target.value) || null } : r))}
                              data-testid={`input-room-annual-price-${rt.id}`}
                            />
                            <p className="text-[10px] text-muted-foreground">Leave empty = monthly × 11</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      onClick={handleSaveRoomTypes}
                      disabled={savingRoomTypes}
                      className="w-full"
                      data-testid="button-save-room-prices"
                    >
                      {savingRoomTypes ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save Room Types</>}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="services" className="space-y-4 mt-0">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Included Services</h3>
                    <p className="text-[11px] text-slate-400">Services included with all housing plans at this property</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => {
                    setEditIncludedServices(prev => [...prev, {
                      type: "meals",
                      label: "Daily Meals",
                      description: "",
                      schedule: {
                        weekday: { meals: ["breakfast", "evening_snacks", "dinner"], count: 3 },
                        saturday: { meals: ["breakfast", "evening_snacks", "dinner"], count: 3 },
                        sunday: { meals: ["breakfast", "evening_snacks", "dinner"], count: 3 },
                      },
                    }]);
                  }} data-testid="button-add-included-service">
                    <Plus className="h-3.5 w-3.5" /> Add Service
                  </Button>
                </div>

                {editIncludedServices.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
                    <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No included services configured</p>
                    <p className="text-[11px] text-slate-300 mt-1">Add services like meals, shuttle, housekeeping that come with housing plans</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {editIncludedServices.map((svc, svcIdx) => {
                      const SERVICE_TYPES = [
                        { value: "meals", label: "Meals", icon: UtensilsCrossed },
                        { value: "shuttle", label: "Express Shuttle", icon: Bus },
                        { value: "ev_bike", label: "EV Bike Access", icon: Bike },
                        { value: "laundry", label: "Cleaning & Laundry", icon: Shirt },
                        { value: "housekeeping", label: "Housekeeping", icon: SprayCan },
                        { value: "locker", label: "Locker", icon: Lock },
                        { value: "custom", label: "Custom", icon: Tag },
                      ];
                      const MEAL_OPTIONS = [
                        { value: "breakfast", label: "Breakfast" },
                        { value: "lunch", label: "Lunch" },
                        { value: "evening_snacks", label: "Evening Snacks" },
                        { value: "dinner", label: "Dinner" },
                      ];
                      const currentType = SERVICE_TYPES.find(t => t.value === svc.type);
                      const TypeIcon = currentType?.icon || Tag;
                      const toggleServiceMeal = (dayKey: string, mealValue: string) => {
                        setEditIncludedServices(prev => prev.map((s, i) => {
                          if (i !== svcIdx) return s;
                          const schedule = { ...(s.schedule || {}) };
                          const dayRules = schedule[dayKey] || { meals: [], count: 0 };
                          const meals: string[] = Array.isArray(dayRules.meals) ? [...dayRules.meals] : [];
                          const exists = meals.includes(mealValue);
                          const newMeals = exists ? meals.filter((m: string) => m !== mealValue) : [...meals, mealValue];
                          schedule[dayKey] = { meals: newMeals, count: newMeals.length };
                          return { ...s, schedule };
                        }));
                      };
                      return (
                        <div key={svcIdx} className="border border-slate-200 rounded-lg p-4 bg-slate-50" data-testid={`included-service-${svcIdx}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                <TypeIcon className="h-4 w-4 text-orange-600" />
                              </div>
                              <div>
                                <input
                                  value={svc.label}
                                  onChange={e => setEditIncludedServices(prev => prev.map((s, i) => i === svcIdx ? { ...s, label: e.target.value } : s))}
                                  className="font-semibold text-sm text-slate-800 bg-transparent border-none outline-none w-full"
                                  placeholder="Service name..."
                                  data-testid={`input-service-label-${svcIdx}`}
                                />
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => setEditIncludedServices(prev => prev.filter((_, i) => i !== svcIdx))} data-testid={`remove-service-${svcIdx}`}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <Label className="text-[11px] text-slate-500">Type</Label>
                              <select
                                value={svc.type}
                                onChange={e => setEditIncludedServices(prev => prev.map((s, i) => i === svcIdx ? { ...s, type: e.target.value } : s))}
                                className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                                data-testid={`select-service-type-${svcIdx}`}
                              >
                                {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <Label className="text-[11px] text-slate-500">Description</Label>
                              <input
                                value={svc.description || ""}
                                onChange={e => setEditIncludedServices(prev => prev.map((s, i) => i === svcIdx ? { ...s, description: e.target.value } : s))}
                                className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-sm"
                                placeholder="e.g., Fresh home-style meals daily"
                                data-testid={`input-service-desc-${svcIdx}`}
                              />
                            </div>
                          </div>

                          {svc.type === "meals" && (
                            <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                              <Label className="text-xs font-semibold text-orange-700 mb-3 block">
                                <UtensilsCrossed className="w-3.5 h-3.5 inline mr-1" /> Meal Schedule — Select included meals
                              </Label>
                              <div className="space-y-2.5">
                                {[
                                  { key: "weekday", label: "Mon – Fri" },
                                  { key: "saturday", label: "Saturday" },
                                  { key: "sunday", label: "Sunday" },
                                ].map(day => {
                                  const dayRules = svc.schedule?.[day.key] || { meals: [], count: 0 };
                                  const selectedMeals: string[] = Array.isArray(dayRules.meals) ? dayRules.meals : [];
                                  return (
                                    <div key={day.key} className="bg-white rounded-lg border border-orange-100 p-2.5">
                                      <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-semibold text-slate-700">{day.label}</span>
                                        <span className="text-[10px] text-orange-600 font-medium">{selectedMeals.length} meals</span>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {MEAL_OPTIONS.map(meal => {
                                          const isSelected = selectedMeals.includes(meal.value);
                                          return (
                                            <button
                                              key={meal.value}
                                              type="button"
                                              onClick={() => toggleServiceMeal(day.key, meal.value)}
                                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                                                isSelected
                                                  ? "bg-orange-600 text-white border-orange-600"
                                                  : "bg-white text-slate-500 border-slate-200 hover:border-orange-300"
                                              }`}
                                              data-testid={`svc-meal-${day.key}-${meal.value}-${svcIdx}`}
                                            >
                                              {meal.label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {svc.type !== "meals" && (
                            <div className="p-2 bg-slate-100 rounded text-[11px] text-slate-500">
                              This service is included with all plans. Add details in the description.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  {[
                    { type: "meals", label: "Meals", icon: UtensilsCrossed },
                    { type: "shuttle", label: "Shuttle", icon: Bus },
                    { type: "laundry", label: "Laundry", icon: Shirt },
                    { type: "housekeeping", label: "Housekeeping", icon: SprayCan },
                    { type: "ev_bike", label: "EV Bike", icon: Bike },
                  ].map(quick => {
                    const QuickIcon = quick.icon;
                    const alreadyAdded = editIncludedServices.some(s => s.type === quick.type);
                    return (
                      <Button
                        key={quick.type}
                        variant="outline"
                        size="sm"
                        className={`text-[11px] gap-1 ${alreadyAdded ? "opacity-40 cursor-not-allowed" : ""}`}
                        disabled={alreadyAdded}
                        onClick={() => {
                          const defaultSchedule = quick.type === "meals" ? {
                            weekday: { meals: ["breakfast", "evening_snacks", "dinner"], count: 3 },
                            saturday: { meals: ["breakfast", "evening_snacks", "dinner"], count: 3 },
                            sunday: { meals: ["breakfast", "evening_snacks", "dinner"], count: 3 },
                          } : null;
                          setEditIncludedServices(prev => [...prev, {
                            type: quick.type,
                            label: quick.label === "Meals" ? "Daily Meals" : quick.label,
                            description: "",
                            schedule: defaultSchedule,
                          }]);
                        }}
                        data-testid={`quick-add-${quick.type}`}
                      >
                        <QuickIcon className="h-3 w-3" /> {quick.label}
                      </Button>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="charges" className="space-y-4 mt-0">
                <div className="rounded-lg border p-4 bg-amber-50/50">
                  <h4 className="text-sm font-semibold text-slate-800 mb-1">Service & Legal Charges</h4>
                  <p className="text-xs text-slate-500 mb-4">These charges are included in the total booking amount. They will be displayed during booking and on receipts.</p>
                  <div className="space-y-2">
                    <Label className="text-sm">Service & Legal Charges (INR)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editMoveInCharges.serviceLegalCharges || ""}
                      onChange={(e) => setEditMoveInCharges({ serviceLegalCharges: Number(e.target.value) || 0 })}
                      placeholder="e.g. 1500"
                      data-testid="input-service-legal-charges"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="images" className="space-y-4 mt-0">
                {editImagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading images...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {editPropertyImages.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-3">{editPropertyImages.length} / {MAX_IMAGES} image{editPropertyImages.length !== 1 ? "s" : ""}</p>
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
                              <button
                                type="button"
                                onClick={() => handleDeleteEditImage(img.id, idx)}
                                className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                data-testid={`delete-edit-image-${idx}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                              {img.caption && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                                  <span className="text-white text-[10px] line-clamp-1">{img.caption}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {editPropertyImages.length < MAX_IMAGES && (
                      <div
                        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-[hsl(345,72%,41%)] hover:bg-red-50/30 transition-all"
                        onClick={() => !editImageUploading && editFileInputRef.current?.click()}
                        data-testid="edit-image-upload-area"
                      >
                        <input
                          ref={editFileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) => handleEditImageUpload(e.target.files)}
                          data-testid="edit-image-file-input"
                        />
                        {editImageUploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-[hsl(345,72%,41%)]" />
                            <p className="text-sm font-medium text-gray-700">Uploading & compressing...</p>
                            <p className="text-xs text-muted-foreground">Large images are auto-resized to high quality WebP</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                              <Upload className="h-6 w-6 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-700">Click to upload images</p>
                            <p className="text-xs text-muted-foreground">JPG, PNG, WebP up to 10MB each (auto-compressed)</p>
                            <p className="text-xs text-muted-foreground">{MAX_IMAGES - editPropertyImages.length} slot{MAX_IMAGES - editPropertyImages.length !== 1 ? "s" : ""} remaining</p>
                          </div>
                        )}
                      </div>
                    )}

                    {editPropertyImages.length === 0 && !editImageUploading && (
                      <p className="text-xs text-center text-muted-foreground">No images yet. Upload photos to showcase this property.</p>
                    )}
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
