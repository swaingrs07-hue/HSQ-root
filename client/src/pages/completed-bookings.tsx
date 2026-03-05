import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import {
  Search,
  CheckCircle2,
  Building2,
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Eye,
  Download,
  Filter,
  IndianRupee,
  BedDouble,
  ClipboardCheck,
  TrendingUp,
  Users,
  ArrowUpDown,
  Trash2,
  AlertTriangle,
  Pencil,
  Save,
  X,
  Banknote,
  Check,
  Package,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Wallet,
  UtensilsCrossed,
  Shirt,
  ArrowUpRight,
  Star,
  History,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/auth-context";
import { useProperty } from "@/contexts/property-context";

interface CompletedBooking {
  id: string;
  bookingCode?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  propertyId: string;
  propertyName: string;
  roomTypeName: string;
  occupancy: number;
  baseFee: number;
  discount: number;
  totalFee: number;
  status: string;
  createdAt: string;
  salesExecName?: string;
  assignedSalesExecId?: string;
  residentDetails?: any;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200" data-testid={`status-${status}`}>Confirmed</Badge>;
    case "active":
      return <Badge className="bg-green-100 text-green-700 border-green-200" data-testid={`status-${status}`}>Active</Badge>;
    case "completed":
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200" data-testid={`status-${status}`}>Completed</Badge>;
    case "pending_payment":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200" data-testid={`status-${status}`}>Pending Payment</Badge>;
    case "pending_approval":
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200" data-testid={`status-${status}`}>Pending Approval</Badge>;
    case "draft":
      return <Badge className="bg-slate-100 text-slate-700 border-slate-200" data-testid={`status-${status}`}>Draft</Badge>;
    case "cancelled":
      return <Badge className="bg-red-100 text-red-700 border-red-200" data-testid={`status-${status}`}>Cancelled</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-700 border-red-200" data-testid={`status-${status}`}>Rejected</Badge>;
    default:
      return <Badge variant="secondary" data-testid={`status-${status}`}>{status}</Badge>;
  }
}

export default function CompletedBookings() {
  const { user } = useAuth();
  const { selectedPropertyId } = useProperty();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSalesExec = user?.role === "sales_executive";
  const isAdmin = user?.role === "admin";
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [deleteBooking, setDeleteBooking] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paymentMethod: "cash",
    transactionId: "",
    notes: "",
    installmentId: null as string | null,
    installmentName: "",
  });
  const [markingPayment, setMarkingPayment] = useState(false);
  const [bookingPackages, setBookingPackages] = useState<any>(null);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const [allPackages, setAllPackages] = useState<any[]>([]);
  const [attachDialog, setAttachDialog] = useState(false);
  const [attachTab, setAttachTab] = useState<"housing" | "addon">("housing");
  const [attachForm, setAttachForm] = useState({ packageId: "", startDate: "", endDate: "" });
  const [usageDialog, setUsageDialog] = useState<any>(null);
  const [usageForm, setUsageForm] = useState({ itemType: "", qtyUsed: 1, note: "" });
  const [walletDialog, setWalletDialog] = useState(false);
  const [walletForm, setWalletForm] = useState({ type: "topup" as "topup" | "debit", amount: 0, note: "" });
  const [upgradeDialog, setUpgradeDialog] = useState(false);
  const [upgradeOptions, setUpgradeOptions] = useState<any>(null);
  const [loadingUpgradeOptions, setLoadingUpgradeOptions] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedUpgradeId, setSelectedUpgradeId] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [upgradeHistory, setUpgradeHistory] = useState<any[]>([]);
  const [showUpgradeHistory, setShowUpgradeHistory] = useState(false);

  const getAuthToken = () => {
    const authData = localStorage.getItem("hsquare_auth");
    return authData ? JSON.parse(authData)?.token : null;
  };

  const fetchBookingPackages = async (bookingId: string) => {
    setLoadingPackages(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/bookings/${bookingId}/packages`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setBookingPackages(await res.json());
    } catch { }
    setLoadingPackages(false);
  };

  const fetchAllPackages = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch("/api/admin/packages", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setAllPackages(await res.json());
    } catch { }
  };

  const fetchUpgradeOptions = async (bookingId: string) => {
    setLoadingUpgradeOptions(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/bookings/${bookingId}/packages/upgrade-options`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUpgradeOptions(data);
      } else {
        const err = await res.json();
        toast({ title: "No upgrade options", description: err.error || "No active package to upgrade", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load upgrade options", variant: "destructive" });
    }
    setLoadingUpgradeOptions(false);
  };

  const fetchUpgradeHistory = async (bookingId: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/bookings/${bookingId}/packages/upgrade-history`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setUpgradeHistory(await res.json());
    } catch { }
  };

  const performUpgrade = async () => {
    if (!selectedBooking || !selectedUpgradeId) return;
    setUpgrading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/packages/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetPackageId: selectedUpgradeId, reason: upgradeReason || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Package upgraded successfully" });
      setUpgradeDialog(false);
      setSelectedUpgradeId(null);
      setUpgradeReason("");
      fetchBookingPackages(selectedBooking.id);
      fetchUpgradeHistory(selectedBooking.id);
    } catch (error: any) {
      toast({ title: "Upgrade failed", description: error.message, variant: "destructive" });
    }
    setUpgrading(false);
  };

  const attachPackage = async () => {
    if (!selectedBooking || !attachForm.packageId || !attachForm.startDate) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/packages/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(attachForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Package attached" });
      setAttachDialog(false);
      fetchBookingPackages(selectedBooking.id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const detachPackage = async (bpId: string) => {
    if (!selectedBooking) return;
    try {
      const token = getAuthToken();
      await fetch(`/api/admin/bookings/${selectedBooking.id}/packages/detach`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingPackageId: bpId }),
      });
      toast({ title: "Package ended" });
      fetchBookingPackages(selectedBooking.id);
    } catch { }
  };

  const recordUsage = async () => {
    if (!selectedBooking || !usageDialog || !usageForm.itemType) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/packages/usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingPackageId: usageDialog.id, ...usageForm }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Usage recorded" });
      setUsageDialog(null);
      setUsageForm({ itemType: "", qtyUsed: 1, note: "" });
      fetchBookingPackages(selectedBooking.id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleWallet = async () => {
    if (!selectedBooking || walletForm.amount <= 0) return;
    try {
      const token = getAuthToken();
      const endpoint = walletForm.type === "topup" ? "topup" : "debit";
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/wallet/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: walletForm.amount, note: walletForm.note }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: walletForm.type === "topup" ? "Wallet topped up" : "Wallet debited" });
      setWalletDialog(false);
      setWalletForm({ type: "topup", amount: 0, note: "" });
      fetchBookingPackages(selectedBooking.id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const startEditing = (booking: any) => {
    setEditForm({
      customerName: booking.customerName || "",
      customerPhone: booking.customerPhone || "",
      customerEmail: booking.customerEmail || "",
      baseFee: booking.baseFee || 0,
      discount: booking.discount || 0,
      status: booking.status || "draft",
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const saveEdits = async () => {
    if (!selectedBooking) return;
    setSaving(true);
    try {
      const authData = localStorage.getItem("hsquare_auth");
      const token = authData ? JSON.parse(authData)?.token : null;
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save changes");
      }
      const updated = await res.json();
      setSelectedBooking({ ...selectedBooking, ...updated });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/completed"] });
      toast({ title: "Booking updated successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openPaymentDialog = (booking: any, installment?: any) => {
    setPaymentForm({
      amount: installment ? installment.amount : (booking.totalFee || 0),
      paymentMethod: "upi",
      transactionId: "",
      notes: installment ? `Payment for ${installment.name}` : "",
      installmentId: installment?.id || null,
      installmentName: installment?.name || "",
    });
    setShowPaymentDialog(true);
  };

  const markPaymentDone = async () => {
    if (!selectedBooking) return;
    setMarkingPayment(true);
    try {
      const authData = localStorage.getItem("hsquare_auth");
      const token = authData ? JSON.parse(authData)?.token : null;
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/mark-payment-done`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(paymentForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to mark payment");
      }
      const { booking: updated, installment: updatedInst } = await res.json();
      if (updatedInst && selectedBooking.installments) {
        const updatedInstallments = selectedBooking.installments.map((inst: any) =>
          inst.id === updatedInst.id ? { ...inst, paid: true, paidAt: updatedInst.paidAt } : inst
        );
        setSelectedBooking({ ...selectedBooking, ...updated, status: updated.status, installments: updatedInstallments });
      } else {
        setSelectedBooking({ ...selectedBooking, ...updated, status: updated.status || "confirmed" });
      }
      setShowPaymentDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/completed"] });
      const desc = paymentForm.installmentName
        ? `₹${paymentForm.amount.toLocaleString("en-IN")} for ${paymentForm.installmentName} recorded`
        : "Booking status updated to Confirmed";
      toast({ title: "Payment marked as done", description: desc });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setMarkingPayment(false);
    }
  };

  const fmtLabel = (s: string) => (s || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  const downloadAdminReceipt = (booking: any) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 18;
    const cw = pw - m * 2;
    let y = 20;

    const checkPage = (needed: number) => {
      if (y + needed > ph - 30) { doc.addPage(); y = 20; }
    };

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pw, 45, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("HSQUARELIVING", pw / 2, 20, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Pvt Ltd | Premium Student Accommodation", pw / 2, 28, { align: "center" });
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("BOOKING RECEIPT", pw / 2, 40, { align: "center" });

    y = 58;
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.roundedRect(m, y - 6, cw, 26, 3, 3);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("BOOKING CODE", m + 6, y);
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(booking.bookingCode || "N/A", m + 6, y + 12);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("DATE", pw - m - 6, y, { align: "right" });
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    const createdDate = booking.createdAt ? format(new Date(booking.createdAt), "dd MMMM yyyy") : "N/A";
    doc.text(createdDate, pw - m - 6, y + 12, { align: "right" });

    y += 36;

    const drawHeader = (title: string) => {
      checkPage(20);
      doc.setFillColor(245, 245, 250);
      doc.roundedRect(m, y - 4, cw, 10, 2, 2, "F");
      doc.setTextColor(79, 70, 229);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(title, m + 5, y + 3);
      y += 14;
    };
    const drawRow = (label: string, value: string, bold = false) => {
      if (!value || value === "N/A" || value === "" || value === "undefined") return;
      checkPage(12);
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(label, m + 5, y);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const maxW = cw - 80;
      const lines = doc.splitTextToSize(value, maxW);
      doc.text(lines, pw - m - 5, y, { align: "right" });
      y += 8 * Math.max(lines.length, 1);
    };

    drawHeader("BOOKING DETAILS");
    drawRow("Status", fmtLabel(booking.status || "draft"), true);
    drawRow("Customer", booking.customerName || "N/A");
    drawRow("Property", booking.propertyName || "N/A");
    if (booking.propertyLocation) drawRow("Location", booking.propertyLocation);
    drawRow("Room Type", `${booking.roomTypeName || "N/A"} · ${booking.occupancy || ""}-sharing`);
    drawRow("Stay Plan", booking.stayPlanType === "academic_year" ? "Academic Year" : booking.stayPlanType === "monthly" ? "Monthly" : booking.stayPlanType ? fmtLabel(booking.stayPlanType) : "");
    if (booking.academicYearPeriod) drawRow("Period", booking.academicYearPeriod);
    drawRow("Duration", booking.durationMonths ? `${booking.durationMonths} months` : "");
    drawRow("Check-in", booking.checkInDate ? format(new Date(booking.checkInDate), "dd MMM yyyy") : "");
    drawRow("Check-out", booking.checkOutDate ? format(new Date(booking.checkOutDate), "dd MMM yyyy") : "");
    drawRow("Deposit", booking.deposit ? `Rs. ${Number(booking.deposit).toLocaleString("en-IN")}` : "");

    const rd = booking.residentDetails;
    if (rd && (rd.name || rd.phone || rd.email)) {
      y += 4;
      drawHeader("RESIDENT DETAILS");
      drawRow("Name", rd.name || "");
      drawRow("Phone", rd.phone || "");
      drawRow("Email", rd.email || "");
      drawRow("Gender", fmtLabel(rd.gender || ""));
      drawRow("Date of Birth", rd.dob || "");
      drawRow("Room No.", rd.roomNo || "");
      drawRow("Bed No.", rd.bedNo || "");
      drawRow("Move-in Date", rd.moveInDate || "");
      drawRow("Check-out Date", rd.checkOutDate || "");
      drawRow("Accommodation", fmtLabel(rd.accommodationType || ""));
      drawRow("Dietary Preference", fmtLabel(rd.dietaryPreference || ""));
      drawRow("Institute", rd.institute || "");
      drawRow("Course", rd.course || "");
    }

    if (rd && (rd.parentName || rd.parentPhone)) {
      y += 4;
      drawHeader("EMERGENCY CONTACT");
      drawRow("Name", rd.parentName || "");
      drawRow("Relation", fmtLabel(rd.parentRelation || ""));
      drawRow("Phone", rd.parentPhone || "");
      drawRow("Email", rd.parentEmail || "");
    }

    y += 4;
    drawHeader("FEE BREAKDOWN");
    drawRow("Base Fee", `Rs. ${(booking.baseFee || 0).toLocaleString("en-IN")}`);
    if ((booking.discount || 0) > 0) drawRow("Discount", `- Rs. ${booking.discount.toLocaleString("en-IN")}`);
    drawRow("Total Fee", `Rs. ${(booking.totalFee || 0).toLocaleString("en-IN")}`, true);

    const totalPaid = (booking.payments || []).filter((p: any) => p.status === "success").reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const balance = (booking.totalFee || 0) - totalPaid;
    checkPage(20);
    y += 4;
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.8);
    doc.line(m + 5, y, pw - m - 5, y);
    y += 10;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Amount Paid", m + 5, y);
    doc.setTextColor(16, 185, 129);
    doc.text(`Rs. ${totalPaid.toLocaleString("en-IN")}`, pw - m - 5, y, { align: "right" });
    if (balance > 0) {
      y += 10;
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11);
      doc.text("Balance Due", m + 5, y);
      doc.setTextColor(245, 158, 11);
      doc.text(`Rs. ${balance.toLocaleString("en-IN")}`, pw - m - 5, y, { align: "right" });
    }

    if ((booking.installments || []).length > 0) {
      y += 10;
      drawHeader("INSTALLMENTS");
      booking.installments.forEach((inst: any) => {
        drawRow(inst.name, `Rs. ${(inst.amount || 0).toLocaleString("en-IN")} — ${inst.paid ? "PAID" : "PENDING"}`);
      });
    }

    if ((booking.payments || []).length > 0) {
      y += 6;
      drawHeader("PAYMENT HISTORY");
      booking.payments.forEach((p: any) => {
        const pDate = p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy") : "N/A";
        drawRow(`${pDate} (${(p.status || "pending").toUpperCase()})`, `Rs. ${(p.amount || 0).toLocaleString("en-IN")}`);
      });
    }

    checkPage(30);
    y += 10;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(m, y, pw - m, y);
    y += 10;
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Computer-generated receipt. No signature required.", pw / 2, y, { align: "center" });
    y += 7;
    doc.text("Thank you for choosing Hsquareliving!", pw / 2, y, { align: "center" });

    doc.save(`receipt-${booking.bookingCode || "booking"}.pdf`);
  };

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["/api/bookings/completed"],
    queryFn: async () => {
      const authData = localStorage.getItem("hsquare_auth");
      const token = authData ? JSON.parse(authData)?.token : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/bookings/completed", { headers });
      if (!res.ok) throw new Error("Failed to fetch bookings");
      return res.json();
    },
  });

  let filtered = bookings.filter((b: any) => {
    if (selectedPropertyId && b.propertyId !== selectedPropertyId) return false;
    if (statusFilter !== "all" && b.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.customerName?.toLowerCase().includes(q) ||
        b.bookingCode?.toLowerCase().includes(q) ||
        b.customerPhone?.includes(q) ||
        b.propertyName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  filtered.sort((a: any, b: any) => {
    if (sortBy === "date") {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    }
    return sortOrder === "desc" ? (b.totalFee || 0) - (a.totalFee || 0) : (a.totalFee || 0) - (b.totalFee || 0);
  });

  const totalRevenue = filtered.reduce((sum: number, b: any) => sum + (b.totalFee || 0), 0);
  const confirmedCount = filtered.filter((b: any) => b.status === "confirmed").length;
  const activeCount = filtered.filter((b: any) => b.status === "active").length;
  const completedCount = filtered.filter((b: any) => b.status === "completed").length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2" data-testid="text-page-title">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
            {isSalesExec ? "My Bookings" : "All Bookings"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSalesExec
              ? "View bookings from your leads"
              : "All bookings across all properties and statuses"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <ClipboardCheck className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total</p>
                <p className="text-xl font-bold text-slate-900" data-testid="text-total-bookings">{filtered.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Revenue</p>
                <p className="text-xl font-bold text-slate-900" data-testid="text-total-revenue">
                  ₹{totalRevenue.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active</p>
                <p className="text-xl font-bold text-slate-900" data-testid="text-active-count">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed</p>
                <p className="text-xl font-bold text-slate-900" data-testid="text-completed-count">{completedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, booking code, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <Filter className="h-4 w-4 mr-2 text-slate-400" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_payment">Pending Payment</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            setSortOrder(sortOrder === "desc" ? "asc" : "desc");
          }}
          data-testid="button-sort"
        >
          <ArrowUpDown className="h-4 w-4" />
          {sortBy === "date" ? "Date" : "Amount"} {sortOrder === "desc" ? "↓" : "↑"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortBy(sortBy === "date" ? "amount" : "date")}
          data-testid="button-toggle-sort"
        >
          Sort by {sortBy === "date" ? "Amount" : "Date"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-lg font-semibold text-slate-600">No Bookings Found</h3>
            <p className="text-sm text-slate-400 mt-1">
              {searchQuery ? "Try a different search term" : "No bookings yet. Generate a booking from the Bookings page."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((booking: any) => (
            <Card
              key={booking.id}
              className="border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedBooking(booking)}
              data-testid={`card-booking-${booking.id}`}
            >
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {booking.customerName?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900" data-testid={`text-customer-name-${booking.id}`}>
                          {booking.customerName}
                        </h3>
                        {getStatusBadge(booking.status)}
                        {booking.bookingCode && (
                          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded" data-testid={`text-booking-code-${booking.id}`}>
                            {booking.bookingCode}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {booking.propertyName}
                        </span>
                        <span className="flex items-center gap-1">
                          <BedDouble className="h-3.5 w-3.5" />
                          {booking.roomTypeName} · {booking.occupancy}-sharing
                        </span>
                        {booking.customerPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {booking.customerPhone}
                          </span>
                        )}
                        {!isSalesExec && booking.salesExecName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {booking.salesExecName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900" data-testid={`text-amount-${booking.id}`}>
                        ₹{(booking.totalFee || 0).toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-slate-400">
                        {booking.createdAt ? format(new Date(booking.createdAt), "dd MMM yyyy") : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBooking(booking);
                      }}
                      data-testid={`button-view-${booking.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedBooking} onOpenChange={(open) => { if (!open) { setSelectedBooking(null); setIsEditing(false); setShowPackages(false); setBookingPackages(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-500" />
                {isEditing ? "Edit Booking" : "Booking Details"}
              </span>
              {isAdmin && selectedBooking && !isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  onClick={() => startEditing(selectedBooking)}
                  data-testid="button-edit-booking"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && !isEditing && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {selectedBooking.customerName?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900" data-testid="text-detail-customer">{selectedBooking.customerName}</h3>
                    {selectedBooking.bookingCode && (
                      <p className="text-xs font-mono text-slate-400">{selectedBooking.bookingCode}</p>
                    )}
                  </div>
                </div>
                {getStatusBadge(selectedBooking.status)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-medium text-slate-500 uppercase mb-1">Property</p>
                  <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                    {selectedBooking.propertyName}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs font-medium text-slate-500 uppercase mb-1">Room Type</p>
                  <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <BedDouble className="h-3.5 w-3.5 text-indigo-500" />
                    {selectedBooking.roomTypeName} · {selectedBooking.occupancy}-sharing
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedBooking.customerPhone && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-medium text-slate-500 uppercase mb-1">Phone</p>
                    <p className="text-sm text-slate-800 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {selectedBooking.customerPhone}
                    </p>
                  </div>
                )}
                {selectedBooking.customerEmail && (
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-medium text-slate-500 uppercase mb-1">Email</p>
                    <p className="text-sm text-slate-800 flex items-center gap-1.5 truncate">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      {selectedBooking.customerEmail}
                    </p>
                  </div>
                )}
              </div>

              {(selectedBooking.stayPlanType || selectedBooking.durationMonths || selectedBooking.checkInDate || selectedBooking.checkOutDate || selectedBooking.deposit) && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <h4 className="text-xs font-semibold text-emerald-600 uppercase mb-3 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Stay Plan Details
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <AdminDetailRow label="Stay Plan" value={selectedBooking.stayPlanType === "academic_year" ? "Academic Year" : selectedBooking.stayPlanType === "monthly" ? "Monthly" : selectedBooking.stayPlanType} capitalize />
                    {selectedBooking.academicYearPeriod && <AdminDetailRow label="Period" value={selectedBooking.academicYearPeriod} />}
                    <AdminDetailRow label="Duration" value={selectedBooking.durationMonths ? `${selectedBooking.durationMonths} months` : undefined} />
                    <AdminDetailRow label="Check-in" value={selectedBooking.checkInDate ? format(new Date(selectedBooking.checkInDate), "dd MMM yyyy") : undefined} />
                    <AdminDetailRow label="Check-out" value={selectedBooking.checkOutDate ? format(new Date(selectedBooking.checkOutDate), "dd MMM yyyy") : undefined} />
                    <AdminDetailRow label="Deposit" value={selectedBooking.deposit ? `₹${Number(selectedBooking.deposit).toLocaleString("en-IN")}` : undefined} />
                  </div>
                </div>
              )}

              <div className="p-4 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl border border-indigo-100">
                <h4 className="text-xs font-semibold text-indigo-600 uppercase mb-3 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Payment Summary
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Base Fee</p>
                    <p className="text-sm font-bold text-slate-800">₹{(selectedBooking.baseFee || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Discount</p>
                    <p className="text-sm font-bold text-green-600">
                      {selectedBooking.discount ? `₹${selectedBooking.discount.toLocaleString("en-IN")}` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-lg font-bold text-indigo-700">₹{(selectedBooking.totalFee || 0).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {selectedBooking.createdAt ? format(new Date(selectedBooking.createdAt), "dd MMM yyyy, hh:mm a") : "N/A"}
                </span>
                {!isSalesExec && selectedBooking.salesExecName && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {selectedBooking.salesExecName}
                  </span>
                )}
              </div>

              {selectedBooking.residentDetails && (selectedBooking.residentDetails.name || selectedBooking.residentDetails.phone || selectedBooking.residentDetails.email) && (
                <div className="p-4 bg-pink-50 rounded-xl border border-pink-100">
                  <h4 className="text-xs font-semibold text-pink-600 uppercase mb-3">Resident Details</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <AdminDetailRow label="Name" value={selectedBooking.residentDetails.name} />
                    <AdminDetailRow label="Phone" value={selectedBooking.residentDetails.phone} />
                    <AdminDetailRow label="Email" value={selectedBooking.residentDetails.email} />
                    <AdminDetailRow label="Gender" value={selectedBooking.residentDetails.gender} capitalize />
                    <AdminDetailRow label="Date of Birth" value={selectedBooking.residentDetails.dob} />
                    <AdminDetailRow label="Room No." value={selectedBooking.residentDetails.roomNo} />
                    <AdminDetailRow label="Bed No." value={selectedBooking.residentDetails.bedNo} />
                    <AdminDetailRow label="Move-in Date" value={selectedBooking.residentDetails.moveInDate} />
                    <AdminDetailRow label="Check-out" value={selectedBooking.residentDetails.checkOutDate} />
                    <AdminDetailRow label="Accommodation" value={selectedBooking.residentDetails.accommodationType} capitalize />
                    <AdminDetailRow label="Diet" value={selectedBooking.residentDetails.dietaryPreference} capitalize />
                    <AdminDetailRow label="Institute" value={selectedBooking.residentDetails.institute} />
                    <AdminDetailRow label="Course" value={selectedBooking.residentDetails.course} />
                  </div>
                </div>
              )}

              {selectedBooking.residentDetails && (selectedBooking.residentDetails.parentName || selectedBooking.residentDetails.parentPhone) && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <h4 className="text-xs font-semibold text-blue-600 uppercase mb-3">Emergency / Parent Contact</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <AdminDetailRow label="Name" value={selectedBooking.residentDetails.parentName} />
                    <AdminDetailRow label="Relation" value={selectedBooking.residentDetails.parentRelation} capitalize />
                    <AdminDetailRow label="Phone" value={selectedBooking.residentDetails.parentPhone} />
                    <AdminDetailRow label="Email" value={selectedBooking.residentDetails.parentEmail} />
                  </div>
                </div>
              )}

              {(selectedBooking.installments || []).length > 0 && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <h4 className="text-xs font-semibold text-amber-600 uppercase mb-3">Installments</h4>
                  <div className="space-y-2">
                    {selectedBooking.installments.map((inst: any, idx: number) => (
                      <div
                        key={inst.id || idx}
                        className={`flex items-center justify-between text-sm p-2 rounded-lg -mx-1 ${!inst.paid && isAdmin ? "cursor-pointer hover:bg-amber-100/60 transition-colors" : ""}`}
                        onClick={() => {
                          if (!inst.paid && isAdmin) openPaymentDialog(selectedBooking, inst);
                        }}
                        data-testid={`installment-row-${idx}`}
                      >
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-slate-700">{inst.name}</p>
                            <p className="text-xs text-slate-500">{inst.dueDate || "N/A"}</p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-slate-800">₹{(inst.amount || 0).toLocaleString("en-IN")}</p>
                            <Badge variant="outline" className={`text-[10px] ${inst.paid ? "text-emerald-600 border-emerald-200" : "text-amber-600 border-amber-200"}`}>
                              {inst.paid ? "PAID" : "PENDING"}
                            </Badge>
                          </div>
                          {!inst.paid && isAdmin && (
                            <Banknote className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(selectedBooking.payments || []).length > 0 && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <h4 className="text-xs font-semibold text-emerald-600 uppercase mb-3">Payment History</h4>
                  <div className="space-y-2">
                    {selectedBooking.payments.map((p: any, idx: number) => (
                      <div key={p.id || idx} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-slate-700">₹{(p.amount || 0).toLocaleString("en-IN")}</p>
                          <p className="text-xs text-slate-500">{p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy, hh:mm a") : "N/A"}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${p.status === "success" ? "text-emerald-600 border-emerald-200" : p.status === "failed" ? "text-red-600 border-red-200" : "text-amber-600 border-amber-200"}`}>
                          {(p.status || "pending").toUpperCase()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="border border-indigo-100 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    onClick={() => {
                      if (!showPackages) {
                        fetchBookingPackages(selectedBooking.id);
                        fetchAllPackages();
                        fetchUpgradeHistory(selectedBooking.id);
                      }
                      setShowPackages(!showPackages);
                    }}
                    data-testid="toggle-booking-packages"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
                      <Package className="h-4 w-4" /> Packages & Services
                    </span>
                    {showPackages ? <ChevronUp className="h-4 w-4 text-indigo-500" /> : <ChevronDown className="h-4 w-4 text-indigo-500" />}
                  </button>

                  {showPackages && (
                    <div className="p-3 space-y-3 bg-white">
                      {loadingPackages ? (
                        <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>
                      ) : (
                        <>
                          {bookingPackages?.bookingPackages?.length > 0 ? (
                            <div className="space-y-2">
                              {bookingPackages.bookingPackages.map((bp: any) => {
                                const pkg = bp.package;
                                const usageByType: Record<string, number> = {};
                                (bp.usage || []).forEach((u: any) => { usageByType[u.itemType] = (usageByType[u.itemType] || 0) + u.qtyUsed; });
                                const isAddon = pkg?.category === "addon_service";
                                const borderColor = bp.status === "ACTIVE"
                                  ? (isAddon ? "border-orange-200 bg-orange-50/50" : "border-emerald-200 bg-emerald-50/50")
                                  : "border-slate-200 bg-slate-50 opacity-70";
                                const badgeColor = bp.status === "ACTIVE"
                                  ? (isAddon ? "bg-orange-100 text-orange-700 border-0 text-[10px]" : "bg-emerald-100 text-emerald-700 border-0 text-[10px]")
                                  : "bg-slate-100 text-slate-500 border-0 text-[10px]";
                                return (
                                  <div key={bp.id} className={`border rounded-lg p-3 ${borderColor}`} data-testid={`booking-package-${bp.id}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div>
                                        <div className="flex items-center gap-1.5">
                                          {isAddon && <UtensilsCrossed className="h-3.5 w-3.5 text-orange-500" />}
                                          <p className="font-semibold text-sm text-slate-800">{pkg?.name || "Package"}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          {isAddon && <Badge className="bg-orange-100 text-orange-600 border-0 text-[9px] px-1.5 py-0">Add-On</Badge>}
                                          <p className="text-[10px] text-slate-500">
                                            {bp.startDate ? format(new Date(bp.startDate), "dd MMM yy") : ""} — {bp.endDate ? format(new Date(bp.endDate), "dd MMM yy") : "Ongoing"}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Badge className={badgeColor}>
                                          {bp.status}
                                        </Badge>
                                        {bp.status === "ACTIVE" && (
                                          <>
                                            {!isAddon && (
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-indigo-500" title="Upgrade Plan" onClick={() => { fetchUpgradeOptions(selectedBooking.id); setUpgradeDialog(true); setSelectedUpgradeId(null); setUpgradeReason(""); }} data-testid={`upgrade-${bp.id}`}>
                                                <ArrowUpRight className="h-3 w-3" />
                                              </Button>
                                            )}
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setUsageDialog(bp); setUsageForm({ itemType: pkg?.items?.[0]?.type || "", qtyUsed: 1, note: "" }); }} data-testid={`usage-${bp.id}`}>
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => detachPackage(bp.id)} data-testid={`detach-${bp.id}`}>
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {isAddon && (() => {
                                      const mealItem = pkg?.items?.find((i: any) => i.type === "meals" && i.rules);
                                      if (!mealItem) return null;
                                      const r = mealItem.rules;
                                      const wd = r.weekday ?? mealItem.includedQty ?? 0;
                                      const sat = r.saturday ?? wd;
                                      const sun = r.sunday ?? wd;
                                      return (
                                        <div className="mb-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
                                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-orange-700 mb-1">
                                            <UtensilsCrossed className="w-3 h-3" /> Meal Schedule
                                          </div>
                                          <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                                            <div className="bg-white rounded px-1.5 py-1 text-center border border-orange-100">
                                              <div className="font-bold text-slate-800">{wd} meals</div>
                                              <div className="text-[9px] text-slate-400">Mon–Fri</div>
                                            </div>
                                            <div className="bg-white rounded px-1.5 py-1 text-center border border-orange-100">
                                              <div className="font-bold text-slate-800">{sat} meals</div>
                                              <div className="text-[9px] text-slate-400">Saturday</div>
                                            </div>
                                            <div className="bg-white rounded px-1.5 py-1 text-center border border-orange-100">
                                              <div className="font-bold text-slate-800">{sun} meals</div>
                                              <div className="text-[9px] text-slate-400">Sunday</div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                    {pkg?.items?.map((item: any, idx: number) => {
                                      const used = usageByType[item.type] || 0;
                                      const included = item.includedQty || 0;
                                      const pct = included > 0 ? Math.min(100, (used / included) * 100) : 0;
                                      return (
                                        <div key={idx} className="mb-1.5">
                                          <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-slate-600">{item.label}</span>
                                            <span className="text-slate-500">{used}/{included} {item.unit}</span>
                                          </div>
                                          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-0.5">
                                            <div className={`h-1.5 rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 text-center py-2">No packages attached</p>
                          )}

                          {bookingPackages?.wallet && (
                            <div className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                              <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-amber-600" />
                                <span className="text-xs font-medium text-amber-800">Wallet Balance</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-amber-700">₹{(bookingPackages.wallet.balance || 0).toLocaleString("en-IN")}</span>
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-amber-200 text-amber-700" onClick={() => { setWalletDialog(true); setWalletForm({ type: "topup", amount: 0, note: "" }); }} data-testid="button-wallet">
                                  Manage
                                </Button>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 gap-1 text-indigo-600 border-indigo-200 text-xs" onClick={() => { setAttachDialog(true); setAttachForm({ packageId: "", startDate: new Date().toISOString().slice(0, 10), endDate: "" }); }} data-testid="button-attach-package">
                              <Plus className="h-3 w-3" /> Attach Package
                            </Button>
                            {bookingPackages?.bookingPackages?.some((bp: any) => bp.status === "ACTIVE") && (
                              <Button size="sm" variant="outline" className="flex-1 gap-1 text-emerald-600 border-emerald-200 text-xs" onClick={() => { fetchUpgradeOptions(selectedBooking.id); setUpgradeDialog(true); setSelectedUpgradeId(null); setUpgradeReason(""); }} data-testid="button-upgrade-package">
                                <ArrowUpRight className="h-3 w-3" /> Upgrade Plan
                              </Button>
                            )}
                          </div>

                          {upgradeHistory.length > 0 && (
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                              <button
                                className="w-full flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 transition-colors text-xs"
                                onClick={() => setShowUpgradeHistory(!showUpgradeHistory)}
                                data-testid="toggle-upgrade-history"
                              >
                                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                                  <History className="h-3 w-3" /> Upgrade History ({upgradeHistory.length})
                                </span>
                                {showUpgradeHistory ? <ChevronUp className="h-3 w-3 text-slate-400" /> : <ChevronDown className="h-3 w-3 text-slate-400" />}
                              </button>
                              {showUpgradeHistory && (
                                <div className="p-2 space-y-1.5">
                                  {upgradeHistory.map((uh: any) => (
                                    <div key={uh.id} className="flex items-center gap-2 text-[10px] p-1.5 bg-slate-50 rounded" data-testid={`upgrade-history-${uh.id}`}>
                                      <ArrowUpRight className="h-3 w-3 text-emerald-500 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <span className="font-medium text-slate-700">{uh.fromPackageName}</span>
                                        <span className="text-slate-400 mx-1">→</span>
                                        <span className="font-medium text-emerald-700">{uh.toPackageName}</span>
                                        <span className="text-slate-400 ml-1">+₹{Number(uh.priceDifference || 0).toLocaleString("en-IN")}</span>
                                      </div>
                                      <span className="text-slate-400 shrink-0">{uh.createdAt ? format(new Date(uh.createdAt), "dd MMM") : ""}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                onClick={() => downloadAdminReceipt(selectedBooking)}
                data-testid="button-admin-download-pdf"
              >
                <Download className="h-4 w-4" />
                Download Receipt (PDF)
              </Button>

              {isAdmin && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  {(selectedBooking.status === "pending_payment" || selectedBooking.status === "draft") && (
                    <Button
                      size="sm"
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => openPaymentDialog(selectedBooking)}
                      data-testid="button-mark-payment"
                    >
                      <Banknote className="h-4 w-4" />
                      Mark Payment Done
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      setDeleteBooking(selectedBooking);
                    }}
                    data-testid="button-delete-booking"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Booking
                  </Button>
                </div>
              )}
            </div>
          )}

          {selectedBooking && isEditing && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-slate-500">Customer Name</Label>
                  <Input
                    value={editForm.customerName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, customerName: e.target.value }))}
                    data-testid="input-edit-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Phone</Label>
                    <Input
                      value={editForm.customerPhone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                      data-testid="input-edit-phone"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Email</Label>
                    <Input
                      value={editForm.customerEmail}
                      onChange={(e) => setEditForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                      data-testid="input-edit-email"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Base Fee (₹)</Label>
                    <Input
                      type="number"
                      value={editForm.baseFee}
                      onChange={(e) => setEditForm(prev => ({ ...prev, baseFee: parseInt(e.target.value) || 0 }))}
                      data-testid="input-edit-basefee"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Discount (₹)</Label>
                    <Input
                      type="number"
                      value={editForm.discount}
                      onChange={(e) => setEditForm(prev => ({ ...prev, discount: parseInt(e.target.value) || 0 }))}
                      data-testid="input-edit-discount"
                    />
                  </div>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <p className="text-xs text-slate-500">Calculated Total</p>
                  <p className="text-lg font-bold text-indigo-700">₹{((editForm.baseFee || 0) - (editForm.discount || 0)).toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500">Status</Label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    data-testid="select-edit-status"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending_payment">Pending Payment</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                  onClick={saveEdits}
                  disabled={saving}
                  data-testid="button-save-edit"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              {paymentForm.installmentName ? `Pay: ${paymentForm.installmentName}` : "Mark Payment Done"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
              <p className="text-xs text-slate-500">Booking</p>
              <p className="font-semibold text-slate-800">{selectedBooking?.customerName}</p>
              <p className="text-xs text-slate-400">{selectedBooking?.bookingCode}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500">Amount (₹)</Label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                data-testid="input-payment-amount"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500">Payment Method</Label>
              <select
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                data-testid="select-payment-method"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer / NEFT / RTGS</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card (Debit/Credit)</option>
                <option value="online">Online Payment</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500">Transaction ID / Reference</Label>
              <Input
                placeholder="e.g., UPI ref, cheque number, receipt ID"
                value={paymentForm.transactionId}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, transactionId: e.target.value }))}
                data-testid="input-transaction-id"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-500">Notes (Optional)</Label>
              <Textarea
                placeholder="Any additional notes about this payment..."
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                data-testid="input-payment-notes"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setShowPaymentDialog(false)}
                disabled={markingPayment}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onClick={markPaymentDone}
                disabled={markingPayment}
                data-testid="button-confirm-payment"
              >
                <Check className="h-3.5 w-3.5" />
                {markingPayment ? "Processing..." : "Confirm Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteBooking} onOpenChange={() => setDeleteBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Booking
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the booking for <strong>{deleteBooking?.customerName}</strong>
              {deleteBooking?.bookingCode ? ` (${deleteBooking.bookingCode})` : ""}? This will permanently remove the booking along with all associated payments and installments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteBooking) return;
                setDeleting(true);
                try {
                  const authData = localStorage.getItem("hsquare_auth");
                  const token = authData ? JSON.parse(authData)?.token : null;
                  const res = await fetch(`/api/admin/bookings/${deleteBooking.id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Failed to delete booking");
                  }
                  toast({ title: "Booking deleted successfully" });
                  queryClient.invalidateQueries({ queryKey: ["/api/bookings/completed"] });
                  setSelectedBooking(null);
                  setDeleteBooking(null);
                } catch (error: any) {
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                } finally {
                  setDeleting(false);
                }
              }}
              data-testid="button-confirm-delete"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {deleting ? "Deleting..." : "Delete Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={attachDialog} onOpenChange={setAttachDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-indigo-600" /> Attach Package / Service</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button onClick={() => { setAttachTab("housing"); setAttachForm(p => ({ ...p, packageId: "" })); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${attachTab === "housing" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`} data-testid="tab-housing-plans">
                Housing Plans
              </button>
              <button onClick={() => { setAttachTab("addon"); setAttachForm(p => ({ ...p, packageId: "" })); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${attachTab === "addon" ? "bg-white text-orange-700 shadow-sm" : "text-slate-500"}`} data-testid="tab-addon-services">
                Add-On Services
              </button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{attachTab === "housing" ? "Housing Plan" : "Add-On Service"}</Label>
              <Select value={attachForm.packageId} onValueChange={v => setAttachForm(p => ({ ...p, packageId: v }))}>
                <SelectTrigger data-testid="select-attach-package"><SelectValue placeholder={attachTab === "housing" ? "Select plan..." : "Select service..."} /></SelectTrigger>
                <SelectContent>
                  {allPackages
                    .filter(p => p.isActive && (attachTab === "housing" ? (p.category === "housing_plan" || !p.category) : p.category === "addon_service"))
                    .filter(p => attachTab !== "addon" || !selectedBooking?.propertyId || p.propertyId === selectedBooking.propertyId)
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — ₹{Number(p.basePrice).toLocaleString("en-IN")}
                        {attachTab === "addon" && p.propertyId ? "" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {attachTab === "addon" && attachForm.packageId && (() => {
              const selectedSvc = allPackages.find(p => p.id === attachForm.packageId);
              const mealItem = selectedSvc?.items?.find((i: any) => i.type === "meals" && i.rules);
              if (!mealItem) return null;
              const r = mealItem.rules;
              return (
                <div className="p-2.5 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-orange-700 mb-1">
                    <UtensilsCrossed className="w-3.5 h-3.5" /> Meal Schedule
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                    <div className="bg-white rounded px-2 py-1 text-center border border-orange-100">
                      <div className="font-semibold text-slate-800">{r.weekday ?? mealItem.includedQty}</div>
                      <div className="text-[9px] text-slate-400">Mon–Fri</div>
                    </div>
                    <div className="bg-white rounded px-2 py-1 text-center border border-orange-100">
                      <div className="font-semibold text-slate-800">{r.saturday ?? r.weekday ?? mealItem.includedQty}</div>
                      <div className="text-[9px] text-slate-400">Saturday</div>
                    </div>
                    <div className="bg-white rounded px-2 py-1 text-center border border-orange-100">
                      <div className="font-semibold text-slate-800">{r.sunday ?? r.weekday ?? mealItem.includedQty}</div>
                      <div className="text-[9px] text-slate-400">Sunday</div>
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={attachForm.startDate} onChange={e => setAttachForm(p => ({ ...p, startDate: e.target.value }))} data-testid="input-attach-start" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={attachForm.endDate} onChange={e => setAttachForm(p => ({ ...p, endDate: e.target.value }))} data-testid="input-attach-end" />
              </div>
            </div>
            <Button className={`w-full ${attachTab === "addon" ? "bg-orange-600 hover:bg-orange-700" : "bg-indigo-600 hover:bg-indigo-700"}`} onClick={attachPackage} data-testid="button-confirm-attach">
              Attach {attachTab === "housing" ? "Plan" : "Service"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!usageDialog} onOpenChange={() => setUsageDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-indigo-600" /> Record Usage</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Service Type</Label>
              <Select value={usageForm.itemType} onValueChange={v => setUsageForm(p => ({ ...p, itemType: v }))}>
                <SelectTrigger data-testid="select-usage-type"><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {usageDialog?.package?.items?.map((item: any) => (
                    <SelectItem key={item.type} value={item.type}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quantity Used</Label>
              <Input type="number" value={usageForm.qtyUsed} onChange={e => setUsageForm(p => ({ ...p, qtyUsed: Number(e.target.value) }))} min={1} data-testid="input-usage-qty" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note (optional)</Label>
              <Input value={usageForm.note} onChange={e => setUsageForm(p => ({ ...p, note: e.target.value }))} placeholder="e.g. 3 shirts" data-testid="input-usage-note" />
            </div>
            <Button className="w-full bg-indigo-600" onClick={recordUsage} data-testid="button-confirm-usage">Record Usage</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={upgradeDialog} onOpenChange={(open) => { setUpgradeDialog(open); if (!open) { setSelectedUpgradeId(null); setUpgradeReason(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" /> Upgrade Service Plan
            </DialogTitle>
          </DialogHeader>
          {loadingUpgradeOptions ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /></div>
          ) : upgradeOptions ? (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Current Plan</p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{upgradeOptions.currentPackage?.name}</span>
                  <span className="font-bold text-slate-700">₹{Number(upgradeOptions.currentPackage?.basePrice || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>

              {upgradeOptions.options?.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Available Upgrades</p>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-0 bg-emerald-700 text-white text-xs font-semibold">
                      <div className="p-2.5">SERVICE TIER</div>
                      <div className="p-2.5 text-center border-x border-emerald-600">UPGRADE FEE</div>
                      <div className="p-2.5">KEY UPGRADES</div>
                    </div>
                    {upgradeOptions.options.map((opt: any) => (
                      <button
                        key={opt.id}
                        className={`w-full grid grid-cols-[1fr_auto_1fr] gap-0 border-t text-sm transition-colors ${
                          selectedUpgradeId === opt.id
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-white hover:bg-slate-50 border-slate-200"
                        }`}
                        onClick={() => setSelectedUpgradeId(opt.id)}
                        data-testid={`upgrade-option-${opt.id}`}
                      >
                        <div className="p-2.5 flex items-center gap-2 text-left">
                          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedUpgradeId === opt.id ? "border-emerald-500" : "border-slate-300"}`}>
                            {selectedUpgradeId === opt.id && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
                          </div>
                          <div>
                            <span className="font-medium text-slate-800">{opt.name}</span>
                            {opt.isHighlighted && (
                              <Badge className="ml-1.5 bg-amber-100 text-amber-700 border-0 text-[9px] px-1.5 py-0">
                                <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-500" /> Recommended
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="p-2.5 text-center font-bold text-emerald-700 border-x border-slate-100 whitespace-nowrap">
                          ₹{Number(opt.priceDifference || 0).toLocaleString("en-IN")}
                        </div>
                        <div className="p-2.5 text-left text-xs text-slate-600">
                          {opt.isHighlighted && <span className="font-bold text-slate-800">Recommended: </span>}
                          {opt.upgradeDescription || opt.tagline || "Premium tier with enhanced features"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-sm">
                  No higher-tier plans available for upgrade
                </div>
              )}

              {selectedUpgradeId && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-emerald-800">Upgrade Fee</span>
                      <span className="text-lg font-bold text-emerald-700">
                        ₹{Number(upgradeOptions.options.find((o: any) => o.id === selectedUpgradeId)?.priceDifference || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Upgrade Reason (optional)</Label>
                    <Input
                      value={upgradeReason}
                      onChange={e => setUpgradeReason(e.target.value)}
                      placeholder="e.g. Student requested better room view"
                      data-testid="input-upgrade-reason"
                    />
                  </div>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
                    onClick={performUpgrade}
                    disabled={upgrading}
                    data-testid="button-confirm-upgrade"
                  >
                    {upgrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                    {upgrading ? "Upgrading..." : "Confirm Upgrade"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-sm">No active package found to upgrade</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={walletDialog} onOpenChange={setWalletDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-amber-600" /> Manage Wallet</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant={walletForm.type === "topup" ? "default" : "outline"} className={walletForm.type === "topup" ? "bg-emerald-600 flex-1" : "flex-1"} onClick={() => setWalletForm(p => ({ ...p, type: "topup" }))} data-testid="button-wallet-topup">Top Up</Button>
              <Button size="sm" variant={walletForm.type === "debit" ? "default" : "outline"} className={walletForm.type === "debit" ? "bg-red-600 flex-1" : "flex-1"} onClick={() => setWalletForm(p => ({ ...p, type: "debit" }))} data-testid="button-wallet-debit">Debit</Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Amount (₹)</Label>
              <Input type="number" value={walletForm.amount} onChange={e => setWalletForm(p => ({ ...p, amount: Number(e.target.value) }))} min={1} data-testid="input-wallet-amount" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Input value={walletForm.note} onChange={e => setWalletForm(p => ({ ...p, note: e.target.value }))} placeholder="Reason" data-testid="input-wallet-note" />
            </div>
            <Button className={`w-full ${walletForm.type === "topup" ? "bg-emerald-600" : "bg-red-600"}`} onClick={handleWallet} data-testid="button-confirm-wallet">
              {walletForm.type === "topup" ? "Add Credit" : "Debit Amount"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminDetailRow({ label, value, capitalize }: { label: string; value?: string; capitalize?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-slate-500">{label}:</span>{" "}
      <span className={`font-medium ${capitalize ? "capitalize" : ""}`}>{value}</span>
    </div>
  );
}
