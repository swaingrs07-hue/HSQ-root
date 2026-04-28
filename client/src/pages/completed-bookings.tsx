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
import { format, differenceInDays, differenceInMonths, differenceInCalendarMonths } from "date-fns";
import { jsPDF } from "jspdf";
import { HSQUARE_LOGO_BASE64 } from "@/lib/logo-base64";
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
  Bus,
  Bike,
  SprayCan,
  Lock,
  Tag,
  Crown,
  Gem,
  Upload,
  ImageIcon,
  Camera,
  RefreshCw,
  Send,
  ArrowRightLeft,
  Share2,
  Users,
  Activity,
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

interface ResidentDetails {
  photoPath?: string;
  photoUrl?: string;
  photo?: string;
  name?: string;
  phone?: string;
  email?: string;
  dob?: string;
  gender?: string;
  institute?: string;
  course?: string;
  moveInDate?: string;
  checkOutDate?: string;
  dietaryPreference?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  parentRelation?: string;
  accommodationType?: string;
  roomNo?: string;
  bedNo?: string;
  [key: string]: unknown;
}

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
  createdByName?: string;
  residentDetails?: ResidentDetails;
}

function getBookingPhotoUrl(rd?: ResidentDetails): string | null {
  const raw = rd?.photoPath || rd?.photoUrl || rd?.photo;
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/objects/") || raw.startsWith("/")) return raw;
  return null;
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
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isReceptionist = user?.role === "receptionist";
  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") || "";
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewFilter, setViewFilter] = useState<"all" | "active" | "completed" | "with_addons">("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [deleteBooking, setDeleteBooking] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [sendingParentEmail, setSendingParentEmail] = useState(false);
  const [sendingWelcomeEmail, setSendingWelcomeEmail] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;
  const [syncingHMS, setSyncingHMS] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    paymentMethod: "cash",
    transactionId: "",
    notes: "",
    installmentId: null as string | null,
    installmentName: "",
    screenshotPath: "",
    screenshotPreview: "",
    screenshotPaths: [] as string[],
    screenshotPreviews: [] as string[],
  });
  const [markingPayment, setMarkingPayment] = useState(false);
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
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
  const [editingPriceBpId, setEditingPriceBpId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>("");
  const [addonPayBpId, setAddonPayBpId] = useState<string | null>(null);
  const [addonPayAmount, setAddonPayAmount] = useState<string>("");
  const [addonPayMethod, setAddonPayMethod] = useState<string>("upi");
  const [addonPayReference, setAddonPayReference] = useState<string>("");

  // Single source of truth for "what price should we use for this booking-package?"
  // Honors admin override, then snapshot-at-attach, then current package base price.
  const getBookingPackagePrice = (bp: any) => {
    const snapRaw = bp?.priceSnapshot?.totalPrice;
    const baseRaw = bp?.package?.basePrice;
    const override = bp?.displayPriceOverride != null ? Number(bp.displayPriceOverride) : null;
    const snapshot = snapRaw != null ? Number(snapRaw) : null;
    const base = baseRaw != null ? Number(baseRaw) : null;
    const effective = Number(override ?? snapshot ?? base ?? 0);
    const original = Number(snapshot ?? base ?? 0);
    return { override, snapshot, base, effective, original, isOverridden: override != null };
  };
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

  const updateBookingPackage = async (
    bpId: string,
    patch: {
      includeInTotal?: boolean;
      displayPriceOverride?: number | null;
      paidStatus?: "pending" | "paid";
      paidAmount?: number | null;
      paymentMethod?: string | null;
      paymentReference?: string | null;
    },
  ) => {
    if (!selectedBooking) return;
    setBookingPackages((prev: any) => {
      if (!prev?.bookingPackages) return prev;
      return {
        ...prev,
        bookingPackages: prev.bookingPackages.map((bp: any) =>
          bp.id === bpId ? { ...bp, ...patch } : bp,
        ),
      };
    });
    try {
      const token = getAuthToken();
      const res = await fetch(
        `/api/admin/bookings/${selectedBooking.id}/packages/${bpId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(patch),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Update failed");
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      fetchBookingPackages(selectedBooking.id);
    }
  };

  const [syncingCredits, setSyncingCredits] = useState(false);
  const syncWalletCredits = async () => {
    if (!selectedBooking) return;
    setSyncingCredits(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/wallet/sync-package-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.totalCredited > 0) {
        toast({ title: `Wallet credited: ${data.totalCredited} credits synced from package` });
        fetchBookingPackages(selectedBooking.id);
      } else if (res.ok) {
        toast({ title: "No missing credits found", description: "Wallet is already up to date" });
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to sync credits", variant: "destructive" });
    } finally {
      setSyncingCredits(false);
    }
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
    const rd = booking.residentDetails || {};
    setEditForm({
      customerName: booking.customerName || "",
      customerPhone: booking.customerPhone || "",
      customerEmail: booking.customerEmail || "",
      status: booking.status || "draft",
      referrer: booking.referrer || "",
      dob: rd.dob || "",
      gender: rd.gender || "",
      institute: rd.institute || "",
      course: rd.course || "",
      moveInDate: rd.moveInDate || "",
      checkOutDate: rd.checkOutDate || "",
      dietaryPreference: rd.dietaryPreference || "",
      parentName: rd.parentName || "",
      parentPhone: rd.parentPhone || "",
      parentEmail: rd.parentEmail || "",
      parentRelation: rd.parentRelation || "",
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
      const { dob, gender, institute, course, moveInDate, checkOutDate, dietaryPreference, parentName, parentPhone, parentEmail, parentRelation, ...bookingFields } = editForm;
      const payload = {
        ...bookingFields,
        residentDetails: { dob, gender, institute, course, moveInDate, checkOutDate, dietaryPreference, parentName, parentPhone, parentEmail, parentRelation },
      };
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
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

  const uploadProfilePhoto = async (file: File) => {
    if (!selectedBooking) return;
    setProfilePhotoUploading(true);
    try {
      const authData = localStorage.getItem("hsquare_auth");
      const token = authData ? JSON.parse(authData)?.token : null;
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();
      const uploadRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadRes.ok) throw new Error("Failed to upload photo");

      const existingRd = selectedBooking.residentDetails || {};
      const payload = {
        residentDetails: { ...existingRd, photoPath: objectPath },
      };
      const saveRes = await fetch(`/api/admin/bookings/${selectedBooking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!saveRes.ok) throw new Error("Failed to save photo");
      const updated = await saveRes.json();
      setSelectedBooking({ ...selectedBooking, ...updated, residentDetails: { ...existingRd, photoPath: objectPath } });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/completed"] });
      toast({ title: "Profile photo updated" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setProfilePhotoUploading(false);
    }
  };

  const openPaymentDialog = (booking: any, installment?: any) => {
    let selectedInst = installment;
    if (!selectedInst && booking.installments?.length) {
      const payments = booking.payments || [];
      selectedInst = booking.installments.find((inst: any) => {
        if (inst.paid) return false;
        const instPayments = payments.filter((p: any) => p.installmentId === inst.id && p.status === "success");
        const totalPaid = instPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        return totalPaid < (inst.amount || 0);
      });
    }

    let prefillAmount = booking.totalFee || 0;
    if (selectedInst) {
      if (selectedInst._remaining != null) {
        prefillAmount = selectedInst._remaining;
      } else {
        const payments = booking.payments || [];
        const instPayments = payments.filter((p: any) => p.installmentId === selectedInst.id && p.status === "success");
        const totalPaid = instPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        prefillAmount = Math.max(0, (selectedInst.amount || 0) - totalPaid);
      }
    }

    setPaymentForm({
      amount: prefillAmount,
      paymentMethod: "upi",
      transactionId: "",
      notes: selectedInst ? `Payment for ${selectedInst.name}` : "",
      installmentId: selectedInst?.id || null,
      installmentName: selectedInst?.name || "",
      screenshotPath: "",
      screenshotPreview: "",
      screenshotPaths: [],
      screenshotPreviews: [],
    });
    setShowPaymentDialog(true);
  };

  const handlePaymentScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const validFiles = files.filter(file => {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Invalid file", description: `${file.name} is not an image file.`, variant: "destructive" });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: `${file.name} must be under 10MB.`, variant: "destructive" });
        return false;
      }
      return true;
    });
    if (!validFiles.length) return;
    setScreenshotUploading(true);
    try {
      const authData = localStorage.getItem("hsquare_auth");
      const token = authData ? JSON.parse(authData)?.token : null;
      const newPaths: string[] = [];
      const newPreviews: string[] = [];
      for (const file of validFiles) {
        const res = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        });
        if (!res.ok) throw new Error("Failed to get upload URL");
        const { uploadURL, objectPath } = await res.json();
        const uploadRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!uploadRes.ok) throw new Error(`Upload failed for ${file.name}`);
        newPaths.push(objectPath);
        newPreviews.push(URL.createObjectURL(file));
      }
      setPaymentForm(prev => ({
        ...prev,
        screenshotPath: [...prev.screenshotPaths, ...newPaths][0] || "",
        screenshotPaths: [...prev.screenshotPaths, ...newPaths],
        screenshotPreview: [...prev.screenshotPreviews, ...newPreviews][0] || "",
        screenshotPreviews: [...prev.screenshotPreviews, ...newPreviews],
      }));
      toast({ title: `${validFiles.length} screenshot${validFiles.length > 1 ? "s" : ""} uploaded` });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setScreenshotUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const markPaymentDone = async () => {
    if (!selectedBooking) return;
    setMarkingPayment(true);
    try {
      const authData = localStorage.getItem("hsquare_auth");
      const token = authData ? JSON.parse(authData)?.token : null;
      const formData = {
        ...paymentForm,
        screenshotPath: paymentForm.screenshotPaths.length > 1
          ? JSON.stringify(paymentForm.screenshotPaths)
          : paymentForm.screenshotPaths[0] || "",
      };
      const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/mark-payment-done`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to mark payment");
      }
      const { booking: updated, installment: updatedInst, payment: newPayment, balanceInstallment } = await res.json();
      if (updatedInst && selectedBooking.installments) {
        let updatedInstallments = selectedBooking.installments.map((inst: any) =>
          inst.id === updatedInst.id ? { ...inst, ...updatedInst } : inst
        );
        if (balanceInstallment) {
          updatedInstallments = [...updatedInstallments, balanceInstallment];
        }
        const updatedPayments = [...(selectedBooking.payments || []), newPayment].filter(Boolean);
        setSelectedBooking({ ...selectedBooking, ...updated, status: updated.status, installments: updatedInstallments, payments: updatedPayments });
      } else {
        const updatedPayments = [...(selectedBooking.payments || []), newPayment].filter(Boolean);
        setSelectedBooking({ ...selectedBooking, ...updated, status: updated.status || "confirmed", payments: updatedPayments });
      }
      setShowPaymentDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/completed"] });
      const desc = paymentForm.installmentName
        ? `₹${paymentForm.amount.toLocaleString("en-IN")} for ${paymentForm.installmentName} recorded`
        : `₹${paymentForm.amount.toLocaleString("en-IN")} payment recorded`;
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

    const logoDataUrl = `data:image/png;base64,${HSQUARE_LOGO_BASE64}`;
    const addWatermark = () => {
      doc.saveGraphicsState();
      (doc as any).setGState(new (doc as any).GState({ opacity: 0.04 }));
      doc.addImage(logoDataUrl, "PNG", (pw - 80) / 2, (ph - 80) / 2, 80, 80);
      doc.restoreGraphicsState();
    };
    const checkPage = (needed: number) => {
      if (y + needed > ph - 30) { doc.addPage(); y = 20; addWatermark(); }
    };

    addWatermark();

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pw, 50, "F");
    doc.addImage(logoDataUrl, "PNG", (pw - 22) / 2, 4, 22, 22);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("HSQUARE LIVING", pw / 2, 34, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Harmony in Living | Premium Student Accommodation", pw / 2, 40, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("BOOKING RECEIPT", pw / 2, 48, { align: "center" });

    y = 62;
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
    drawRow("Room Type", booking.residentDetails?.accommodationType || booking.roomTypeName || "N/A");
    drawRow("Stay Plan", booking.stayPlanType === "academic_year" ? "Academic Year" : booking.stayPlanType === "monthly" ? "Monthly" : booking.stayPlanType ? fmtLabel(booking.stayPlanType) : "");
    if (booking.academicYearPeriod) drawRow("Period", booking.academicYearPeriod);
    drawRow("Duration", booking.durationMonths ? `${booking.durationMonths} months` : "");
    drawRow("Check-in", booking.checkInDate ? format(new Date(booking.checkInDate), "dd MMM yyyy") : "");
    drawRow("Check-out", booking.checkOutDate ? format(new Date(booking.checkOutDate), "dd MMM yyyy") : "");
    drawRow("Deposit", booking.deposit ? `Rs. ${Number(booking.deposit).toLocaleString("en-IN")}` : "");

    const pdfHousingPlan = bookingPackages?.bookingPackages?.find((bp: any) => bp.package?.category === "housing_plan" && bp.status === "ACTIVE");
    if (pdfHousingPlan) {
      const hpPkg = pdfHousingPlan.package;
      const hpTier = hpPkg?.tierLevel ?? 0;
      const hpTierLabel = hpTier >= 2 ? "PREMIUM" : hpTier >= 1 ? "CLASSIC" : "ESSENTIAL";
      const hpColor = hpTier >= 2 ? [180, 130, 40] : hpTier >= 1 ? [100, 110, 130] : [110, 80, 180];
      y += 6;
      checkPage(40);
      doc.setFillColor(hpColor[0], hpColor[1], hpColor[2]);
      doc.roundedRect(m, y - 4, cw, 12, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`HOUSING PLAN — ${hpTierLabel}`, m + 5, y + 4);
      doc.text(hpPkg?.name || "Plan", pw - m - 5, y + 4, { align: "right" });
      y += 16;
      doc.setTextColor(30, 30, 30);
      if (hpPkg?.tagline) {
        drawRow("Tagline", hpPkg.tagline);
      }
      const planPrice = pdfHousingPlan.priceSnapshot?.totalPrice || pdfHousingPlan.basePrice || 0;
      if (planPrice > 0) {
        drawRow("Plan Price", `Rs. ${Number(planPrice).toLocaleString("en-IN")}${pdfHousingPlan.priceSnapshot?.totalPrice ? " (total)" : ""}`);
      }
      if (hpPkg?.items && hpPkg.items.length > 0) {
        hpPkg.items.forEach((item: any) => {
          const val = item.featureValue || "Included";
          drawRow(item.label || item.name, val);
        });
      }
    }

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
    if ((booking.deposit || 0) > 0) drawRow("Security Deposit", `Rs. ${Number(booking.deposit).toLocaleString("en-IN")}`);
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
        const dueDateStr = inst.dueDate ? ` (Due: ${inst.dueDate})` : "";
        drawRow(`${inst.name}${dueDateStr}`, `Rs. ${(inst.amount || 0).toLocaleString("en-IN")} — ${inst.paid ? "PAID" : "PENDING"}`);
      });
    }

    if ((booking.payments || []).length > 0) {
      y += 6;
      drawHeader("PAYMENT HISTORY");
      booking.payments.forEach((p: any) => {
        const pDate = p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy") : "N/A";
        const methodLabel = p.paymentMethod ? ` via ${p.paymentMethod.toUpperCase()}` : "";
        drawRow(`${pDate} (${(p.status || "pending").toUpperCase()})${methodLabel}`, `Rs. ${(p.amount || 0).toLocaleString("en-IN")}`);
        if (p.razorpayPaymentId) {
          drawRow(`  UTR/Txn: ${p.razorpayPaymentId}`, "");
        }
      });
    }

    const pdfIncludedServices: any[] = Array.isArray(booking.propertyIncludedServices) ? booking.propertyIncludedServices : [];
    if (pdfIncludedServices.length > 0) {
      y += 6;
      drawHeader("INCLUDED SERVICES");
      const PDF_MEAL_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", evening_snacks: "Evening Snacks", dinner: "Dinner" };
      pdfIncludedServices.forEach((svc: any) => {
        if (svc.type === "meals" && svc.schedule) {
          const getMealNames = (dayRules: any) => {
            if (!dayRules) return "";
            const meals = Array.isArray(dayRules.meals) ? dayRules.meals : [];
            const count = dayRules.count ?? meals.length;
            const names = meals.map((m: string) => PDF_MEAL_LABELS[m] || m).join(", ");
            return `${count} meals${names ? ` (${names})` : ""}`;
          };
          const wd = getMealNames(svc.schedule.weekday);
          const sat = getMealNames(svc.schedule.saturday);
          const sun = getMealNames(svc.schedule.sunday);
          drawRow(svc.label, `Mon-Fri: ${wd}`);
          if (sat !== wd) drawRow("", `Saturday: ${sat}`);
          if (sun !== wd) drawRow("", `Sunday: ${sun}`);
        } else {
          drawRow(svc.label, svc.description || "Included");
        }
      });
    }

    const pdfBookingPkgs = bookingPackages?.bookingPackages || [];
    const pdfAddonPkgs = pdfBookingPkgs.filter((bp: any) => bp.package?.category === "addon_service");
    if (pdfAddonPkgs.length > 0) {
      y += 6;
      drawHeader("ADD-ON SERVICES");
      const PDF_MEAL_LABELS2: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", evening_snacks: "Evening Snacks", dinner: "Dinner" };
      pdfAddonPkgs.forEach((bp: any) => {
        const pkg = bp.package;
        const statusStr = bp.status === "ACTIVE" ? "Active" : "Ended";
        const addonTotalPrice = bp.priceSnapshot?.totalPrice || pkg?.basePrice;
        const priceStr = addonTotalPrice ? `Rs. ${Number(addonTotalPrice).toLocaleString("en-IN")}` : "";
        drawRow(pkg?.name || "Add-On", `${priceStr} — ${statusStr}`);
        const mealItem = pkg?.items?.find((i: any) => i.type === "meals" && i.rules);
        if (mealItem) {
          const getMealNames2 = (dayRules: any) => {
            if (!dayRules) return "";
            const meals = Array.isArray(dayRules.meals) ? dayRules.meals : [];
            const count = dayRules.count ?? meals.length;
            const names = meals.map((m: string) => PDF_MEAL_LABELS2[m] || m).join(", ");
            return `${count} meals${names ? ` (${names})` : ""}`;
          };
          const r = mealItem.rules;
          const wd = getMealNames2(r.weekday);
          const sat = getMealNames2(r.saturday);
          const sun = getMealNames2(r.sunday);
          drawRow("  Schedule", `Mon-Fri: ${wd}`);
          if (sat !== wd) drawRow("", `Saturday: ${sat}`);
          if (sun !== wd) drawRow("", `Sunday: ${sun}`);
        }
      });
    }

    const mic = booking.propertyMoveInCharges;
    const micTotal = mic ? ((mic.serviceLegalCharges || 0) || ((mic.policeVerification || 0) + (mic.agreement || 0))) : 0;
    if (micTotal > 0) {
      y += 6;
      checkPage(30);
      drawHeader("SERVICE & LEGAL CHARGES");
      drawRow("Service & Legal Charges", `Rs. ${micTotal.toLocaleString("en-IN")}`);
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "italic");
      doc.text("Included in total booking amount", m + 5, y); y += 6;
    }

    y += 6;
    checkPage(80);
    drawHeader("TERMS & CONDITIONS");
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("1. Booking Confirmation", m + 5, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.text("- A booking is considered confirmed upon receipt of the booking amount.", m + 8, y); y += 4.5;
    doc.text("- Confirmation will be sent to the email address provided in the booking form.", m + 8, y); y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("2. Booking Amount", m + 5, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.text("- The booking amount is a non-refundable deposit that secures your reservation.", m + 8, y); y += 4.5;
    doc.text("- This amount will be deducted from your total stay charges upon check-in.", m + 8, y); y += 4.5;
    doc.text("- In case of cancellation or no-show, the booking amount will be forfeited.", m + 8, y); y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("3. Payment", m + 5, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.text("- The remaining balance of your stay is payable upon check-in.", m + 8, y); y += 4.5;
    doc.text("- Accepted payment methods will be communicated during the booking process or upon arrival.", m + 8, y); y += 4.5;
    doc.text("- No refund of rent in case you move out abruptly without completion of your tenure.", m + 8, y); y += 8;

    checkPage(20);
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

  const _parseDayMs = (s: any): number | null => {
    if (!s || typeof s !== "string") return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const _todayStart = new Date();
  _todayStart.setHours(0, 0, 0, 0);
  const _todayMs = _todayStart.getTime();
  const isActiveBooking = (b: any) => {
    if (b.status === "cancelled" || b.status === "rejected" || b.status === "completed") return false;
    const moveIn = _parseDayMs(b.residentDetails?.moveInDate);
    const checkOut = _parseDayMs(b.residentDetails?.checkOutDate);
    if (moveIn === null) return false;
    if (_todayMs < moveIn) return false;
    if (checkOut !== null && _todayMs >= checkOut) return false;
    return true;
  };
  const isCompletedBooking = (b: any) => {
    if (b.status === "cancelled" || b.status === "rejected") return false;
    if (b.status === "completed") return true;
    const checkOut = _parseDayMs(b.residentDetails?.checkOutDate);
    return checkOut !== null && checkOut < _todayMs;
  };

  const baseFiltered = bookings.filter((b: any) => {
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

  let filtered = baseFiltered.filter((b: any) => {
    if (viewFilter === "active" && !isActiveBooking(b)) return false;
    if (viewFilter === "completed" && !isCompletedBooking(b)) return false;
    if (viewFilter === "with_addons" && !((b.addonRevenue || 0) > 0)) return false;
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
  const totalCollected = filtered.reduce((sum: number, b: any) => {
    const paid = (b.payments || []).filter((p: any) => p.status === "success").reduce((s: number, p: any) => s + (p.amount || 0), 0);
    return sum + paid;
  }, 0);
  const totalPending = Math.max(0, totalRevenue - totalCollected);
  const collectionPct = totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 100) : 0;
  const pendingPct = totalRevenue > 0 ? Math.round((totalPending / totalRevenue) * 100) : 0;
  const averageBooking = filtered.length > 0 ? Math.round(totalRevenue / filtered.length) : 0;

  const totalAddonRevenue = filtered.reduce((s: number, b: any) => s + (b.addonRevenue || 0), 0);
  const totalAddonCollected = filtered.reduce((s: number, b: any) => s + (b.addonCollected || 0), 0);
  const totalAddonPending = Math.max(0, totalAddonRevenue - totalAddonCollected);
  const bookingsWithAddons = filtered.filter((b: any) => (b.addonRevenue || 0) > 0).length;
  const addonCollectedPct = totalAddonRevenue > 0 ? Math.round((totalAddonCollected / totalAddonRevenue) * 100) : 0;

  const activeCount = baseFiltered.filter(isActiveBooking).length;
  const completedCount = baseFiltered.filter(isCompletedBooking).length;
  const totalCount = baseFiltered.length;
  const totalBookingAmount = filtered.reduce((sum: number, b: any) => {
    const inst = (b.installments || []).find((i: any) =>
      typeof i?.name === "string" && i.name.toLowerCase().includes("booking amount")
    );
    return sum + (inst?.amount || 0);
  }, 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > totalPages) {
    setTimeout(() => setCurrentPage(totalPages), 0);
  }
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedBookings = filtered.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          role="button"
          onClick={() => { setViewFilter("all"); setCurrentPage(1); }}
          className={`relative overflow-hidden border-slate-200 shadow-sm bg-gradient-to-br from-slate-50 via-white to-white cursor-pointer transition hover:shadow-md ${viewFilter === "all" ? "ring-2 ring-slate-400" : ""}`}
          data-testid="card-filter-all"
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-100 ring-1 ring-slate-200/60 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-slate-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Bookings</p>
                <p className="text-2xl font-bold text-slate-900 mt-1" data-testid="text-total-bookings">
                  {totalCount}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">All filtered bookings</p>
                <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-500">Booking Amount</span>
                  <span
                    className="text-sm font-semibold text-emerald-700 truncate"
                    data-testid="text-total-bookings-amount"
                    title={`₹${totalBookingAmount.toLocaleString("en-IN")}`}
                  >
                    ₹{totalBookingAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          role="button"
          onClick={() => { setViewFilter(viewFilter === "active" ? "all" : "active"); setCurrentPage(1); }}
          className={`relative overflow-hidden border-slate-200 shadow-sm bg-gradient-to-br from-blue-50 via-white to-white cursor-pointer transition hover:shadow-md ${viewFilter === "active" ? "ring-2 ring-blue-400" : ""}`}
          data-testid="card-filter-active"
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-100 ring-1 ring-blue-200/60 flex items-center justify-center shrink-0">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active</p>
                <p className="text-2xl font-bold text-blue-700 mt-1" data-testid="text-active-bookings">
                  {activeCount}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Currently staying</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          role="button"
          onClick={() => { setViewFilter(viewFilter === "completed" ? "all" : "completed"); setCurrentPage(1); }}
          className={`relative overflow-hidden border-slate-200 shadow-sm bg-gradient-to-br from-purple-50 via-white to-white cursor-pointer transition hover:shadow-md ${viewFilter === "completed" ? "ring-2 ring-purple-400" : ""}`}
          data-testid="card-filter-completed"
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-100 ring-1 ring-purple-200/60 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Completed</p>
                <p className="text-2xl font-bold text-purple-700 mt-1" data-testid="text-completed-bookings">
                  {completedCount}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Past check-out</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="relative overflow-hidden border-slate-200 shadow-sm bg-gradient-to-br from-emerald-50 via-white to-white">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 ring-1 ring-emerald-200/60 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Booking Value</p>
                <p
                  className="text-2xl font-bold text-slate-900 truncate mt-1"
                  data-testid="text-total-revenue"
                  title={`₹${totalRevenue.toLocaleString("en-IN")}`}
                >
                  ₹{totalRevenue.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {filtered.length} booking{filtered.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-slate-200 shadow-sm bg-gradient-to-br from-green-50 via-white to-white">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-green-100 ring-1 ring-green-200/60 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Till Collected</p>
                <p
                  className="text-2xl font-bold text-green-700 truncate mt-1"
                  data-testid="text-total-collected"
                  title={`₹${totalCollected.toLocaleString("en-IN")}`}
                >
                  ₹{totalCollected.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">{collectionPct}% of total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-slate-200 shadow-sm bg-gradient-to-br from-amber-50 via-white to-white">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-100 ring-1 ring-amber-200/60 flex items-center justify-center shrink-0">
                <ClipboardCheck className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending</p>
                <p
                  className="text-2xl font-bold text-amber-700 truncate mt-1"
                  data-testid="text-total-pending"
                  title={`₹${totalPending.toLocaleString("en-IN")}`}
                >
                  ₹{totalPending.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">{pendingPct}% remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-slate-200 shadow-sm bg-gradient-to-br from-indigo-50 via-white to-white">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-100 ring-1 ring-indigo-200/60 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Booking Value</p>
                <p
                  className="text-2xl font-bold text-indigo-700 truncate mt-1"
                  data-testid="text-average-booking"
                  title={`₹${averageBooking.toLocaleString("en-IN")}`}
                >
                  ₹{averageBooking.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Across {filtered.length} booking{filtered.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          role="button"
          onClick={() => { setViewFilter(viewFilter === "with_addons" ? "all" : "with_addons"); setCurrentPage(1); }}
          className={`relative overflow-hidden border-slate-200 shadow-sm bg-gradient-to-br from-orange-50 via-white to-white cursor-pointer transition hover:shadow-md ${viewFilter === "with_addons" ? "ring-2 ring-orange-400" : ""}`}
          data-testid="card-addon-revenue"
        >
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-orange-100 ring-1 ring-orange-200/60 flex items-center justify-center shrink-0">
                <UtensilsCrossed className="h-5 w-5 text-orange-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Add-On Revenue</p>
                <p
                  className="text-2xl font-bold text-orange-700 truncate mt-1"
                  data-testid="text-addon-revenue"
                  title={`₹${totalAddonRevenue.toLocaleString("en-IN")}`}
                >
                  ₹{totalAddonRevenue.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {bookingsWithAddons} booking{bookingsWithAddons === 1 ? "" : "s"} with add-ons
                </p>
                <div className="mt-2 pt-2 border-t border-orange-200/60 grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500">Collected</p>
                    <p
                      className="text-xs font-semibold text-emerald-700 truncate"
                      data-testid="text-addon-collected"
                      title={`₹${totalAddonCollected.toLocaleString("en-IN")}`}
                    >
                      ₹{totalAddonCollected.toLocaleString("en-IN")}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">({addonCollectedPct}%)</span>
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500">Pending</p>
                    <p
                      className="text-xs font-semibold text-amber-700 truncate"
                      data-testid="text-addon-pending"
                      title={`₹${totalAddonPending.toLocaleString("en-IN")}`}
                    >
                      ₹{totalAddonPending.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
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
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
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
          {isAdmin && filtered.length > 0 && (
            <div className="flex items-center gap-3 px-2 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  checked={bulkSelectedIds.size === filtered.length && filtered.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setBulkSelectedIds(new Set(filtered.map((b: any) => b.id)));
                    } else {
                      setBulkSelectedIds(new Set());
                    }
                  }}
                  data-testid="checkbox-select-all"
                />
                Select All ({filtered.length})
              </label>
              {bulkSelectedIds.size > 0 && (
                <>
                  <span className="text-sm text-indigo-600 font-medium">{bulkSelectedIds.size} selected</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
                    disabled={bulkSyncing}
                    data-testid="btn-bulk-resync-hms"
                    onClick={async () => {
                      const ids = Array.from(bulkSelectedIds);
                      setBulkSyncing(true);
                      setBulkSyncProgress({ done: 0, total: ids.length, errors: 0 });
                      let errors = 0;
                      for (let i = 0; i < ids.length; i++) {
                        try {
                          const token = getAuthToken();
                          const resp = await fetch(`/api/admin/bookings/${ids[i]}/resync-hms`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (!resp.ok) errors++;
                        } catch {
                          errors++;
                        }
                        setBulkSyncProgress({ done: i + 1, total: ids.length, errors });
                      }
                      setBulkSyncing(false);
                      setBulkSelectedIds(new Set());
                      toast({
                        title: "Bulk HMS Sync Complete",
                        description: `${ids.length - errors} synced successfully${errors > 0 ? `, ${errors} failed` : ""}`,
                        variant: errors > 0 ? "destructive" : "default",
                      });
                    }}
                  >
                    {bulkSyncing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Syncing {bulkSyncProgress.done}/{bulkSyncProgress.total}...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Re-sync {bulkSelectedIds.size} to HMS
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
          {paginatedBookings.map((booking: any) => {
            const plan = booking.housingPlanInfo;
            const pt = plan?.tierLevel ?? null;
            const hasTier = plan != null && pt != null;
            const cardTierBorder = hasTier
              ? pt >= 2 ? "border-amber-200 hover:border-amber-300" : pt >= 1 ? "border-slate-300 hover:border-slate-400" : "border-violet-200 hover:border-violet-300"
              : "border-slate-200";
            const cardTierGradient = hasTier
              ? pt >= 2 ? "from-amber-500 via-yellow-400 to-orange-500" : pt >= 1 ? "from-slate-400 via-gray-300 to-slate-500" : "from-violet-500 via-purple-400 to-indigo-500"
              : "from-indigo-500 to-purple-600";
            const tierBadgeStyle = hasTier
              ? pt >= 2 ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white" : pt >= 1 ? "bg-gradient-to-r from-slate-500 to-gray-500 text-white" : "bg-gradient-to-r from-violet-500 to-purple-500 text-white"
              : "";
            const TierIcon = hasTier ? (pt >= 2 ? Crown : pt >= 1 ? Gem : Star) : null;
            const tierAccentText = hasTier
              ? pt >= 2 ? "text-amber-600" : pt >= 1 ? "text-slate-500" : "text-violet-600"
              : "";

            return (
              <Card
                key={booking.id}
                className={`${cardTierBorder} shadow-sm hover:shadow-md transition-all cursor-pointer ${hasTier ? "relative overflow-hidden" : ""}`}
                onClick={() => { setSelectedBooking(booking); fetchBookingPackages(booking.id); }}
                data-testid={`card-booking-${booking.id}`}
              >
                {hasTier && (
                  <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${cardTierGradient}`} />
                )}
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 mt-1 shrink-0"
                          checked={bulkSelectedIds.has(booking.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            setBulkSelectedIds(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(booking.id);
                              else next.delete(booking.id);
                              return next;
                            });
                          }}
                          data-testid={`checkbox-booking-${booking.id}`}
                        />
                      )}
                      {(() => {
                        const photoSrc = getBookingPhotoUrl(booking.residentDetails);
                        const fallbackEl = (
                          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${cardTierGradient} flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm`}>
                            {hasTier && TierIcon ? <TierIcon className="h-5 w-5" /> : (booking.customerName?.charAt(0)?.toUpperCase() || "?")}
                          </div>
                        );
                        if (photoSrc) {
                          return (
                            <div className="relative w-11 h-11 shrink-0">
                              <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${cardTierGradient} flex items-center justify-center text-white font-bold text-sm shadow-sm animate-pulse`}>
                                {hasTier && TierIcon ? <TierIcon className="h-5 w-5" /> : (booking.customerName?.charAt(0)?.toUpperCase() || "?")}
                              </div>
                              <img
                                src={photoSrc}
                                alt={booking.customerName || ""}
                                className="absolute inset-0 w-11 h-11 rounded-full object-cover shadow-sm opacity-0 transition-opacity duration-300"
                                loading="lazy"
                                decoding="async"
                                data-testid={`img-avatar-${booking.id}`}
                                onLoad={(e) => {
                                  e.currentTarget.classList.remove("opacity-0");
                                  e.currentTarget.classList.add("opacity-100");
                                }}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            </div>
                          );
                        }
                        return fallbackEl;
                      })()}
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
                          {hasTier && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${tierBadgeStyle}`} data-testid={`badge-plan-${booking.id}`}>
                              {TierIcon && <TierIcon className="h-3 w-3" />}
                              {plan.planName}
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
                            {booking.residentDetails?.accommodationType || booking.roomTypeName || "N/A"}
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
                          {isAdmin && booking.createdByName && (
                            <span className="flex items-center gap-1 text-indigo-500" data-testid={`text-booked-by-${booking.id}`}>
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              Booked by {booking.createdByName}
                            </span>
                          )}
                          {booking.referrer && (
                            <span className="flex items-center gap-1 text-indigo-500" data-testid={`text-referrer-${booking.id}`}>
                              <Share2 className="h-3.5 w-3.5" />
                              Ref: {booking.referrer}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                          {(booking.addonRevenue || 0) > 0 ? (
                            <>
                              <p
                                className="text-[11px] text-slate-500 leading-tight"
                                data-testid={`text-base-amount-${booking.id}`}
                                title="Booking fee"
                              >
                                ₹{(booking.totalFee || 0).toLocaleString("en-IN")}
                              </p>
                              <p
                                className="text-[11px] text-orange-600 leading-tight"
                                data-testid={`text-addon-amount-${booking.id}`}
                                title={`${booking.addonCount || 0} add-on${(booking.addonCount || 0) === 1 ? "" : "s"}`}
                              >
                                + ₹{(booking.addonRevenue || 0).toLocaleString("en-IN")} add-ons
                              </p>
                              <p
                                className={`text-lg font-bold ${hasTier ? tierAccentText : "text-slate-900"}`}
                                data-testid={`text-amount-${booking.id}`}
                                title="Grand total"
                              >
                                ₹{((booking.totalFee || 0) + (booking.addonRevenue || 0)).toLocaleString("en-IN")}
                              </p>
                            </>
                          ) : (
                            <p className={`text-lg font-bold ${hasTier ? tierAccentText : "text-slate-900"}`} data-testid={`text-amount-${booking.id}`}>
                              ₹{(booking.totalFee || 0).toLocaleString("en-IN")}
                            </p>
                          )}
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
                          fetchBookingPackages(booking.id);
                        }}
                        data-testid={`button-view-${booking.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 pb-2" data-testid="pagination-controls">
              <p className="text-sm text-slate-500">
                Showing {(safeCurrentPage - 1) * PAGE_SIZE + 1}–{Math.min(safeCurrentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(1)}
                  data-testid="button-page-first"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  data-testid="button-page-prev"
                >
                  Prev
                </Button>
                <span className="px-3 py-1 text-sm font-medium text-slate-700">
                  {safeCurrentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  data-testid="button-page-next"
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  data-testid="button-page-last"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
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
              {(isAdmin || isReceptionist) && selectedBooking && !isEditing && (
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
                  {(() => {
                    const photoSrc = getBookingPhotoUrl(selectedBooking.residentDetails);
                    const avatarContent = photoSrc ? (
                      <>
                        <img
                          src={photoSrc}
                          alt={selectedBooking.customerName || ""}
                          className="w-12 h-12 rounded-full object-cover shadow-sm"
                          data-testid="img-booking-avatar"
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.style.display = "none";
                            const fallback = img.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.classList.remove("hidden");
                          }}
                        />
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg hidden">
                          {selectedBooking.customerName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      </>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {selectedBooking.customerName?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    );
                    return (
                      <label className="relative group cursor-pointer" data-testid="btn-upload-profile-photo">
                        {avatarContent}
                        <div className="absolute inset-0 w-12 h-12 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {profilePhotoUploading ? (
                            <Loader2 className="h-4 w-4 text-white animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4 text-white" />
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={profilePhotoUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadProfilePhoto(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    );
                  })()}
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
                    {selectedBooking.residentDetails?.accommodationType || selectedBooking.roomTypeName || "N/A"}
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

              {(() => {
                const housingPlan = bookingPackages?.bookingPackages?.find((bp: any) => bp.package?.category === "housing_plan" && bp.status === "ACTIVE");
                if (!housingPlan) return null;
                const pkg = housingPlan.package;
                const tier = pkg?.tierLevel ?? 0;
                const planColors = tier >= 2
                  ? { bg: "from-amber-50 via-yellow-50 to-orange-50", border: "border-amber-200", accent: "text-amber-700", badge: "bg-gradient-to-r from-amber-500 to-yellow-500 text-white", icon: "text-amber-500", glow: "shadow-amber-100" }
                  : tier >= 1
                  ? { bg: "from-slate-50 via-gray-50 to-slate-100", border: "border-slate-300", accent: "text-slate-700", badge: "bg-gradient-to-r from-slate-500 to-gray-500 text-white", icon: "text-slate-500", glow: "shadow-slate-100" }
                  : { bg: "from-violet-50 via-purple-50 to-indigo-50", border: "border-violet-200", accent: "text-violet-700", badge: "bg-gradient-to-r from-violet-500 to-purple-500 text-white", icon: "text-violet-500", glow: "shadow-violet-100" };
                const tierLabel = tier >= 2 ? "PREMIUM" : tier >= 1 ? "CLASSIC" : "ESSENTIAL";
                return (
                  <div className={`p-4 bg-gradient-to-br ${planColors.bg} rounded-xl border ${planColors.border} ${planColors.glow} shadow-sm`} data-testid="booking-plan-card">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className={`text-xs font-semibold ${planColors.accent} uppercase flex items-center gap-1.5`}>
                        <Sparkles className="h-3.5 w-3.5" /> Housing Plan
                      </h4>
                      <Badge className={`${planColors.badge} text-[10px] px-2 py-0.5 border-0 font-bold`}>{tierLabel}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl ${planColors.badge} flex items-center justify-center`}>
                        <Star className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className={`font-bold text-base ${planColors.accent}`}>{pkg?.name || "Housing Plan"}</p>
                        {pkg?.tagline && <p className="text-[11px] text-slate-500">{pkg.tagline}</p>}
                      </div>
                      {(housingPlan.priceSnapshot?.totalPrice > 0 || pkg?.basePrice > 0) && (
                        <div className="ml-auto text-right">
                          <p className={`font-bold text-lg ${planColors.accent}`}>₹{Number(housingPlan.priceSnapshot?.totalPrice || pkg?.basePrice || 0).toLocaleString("en-IN")}</p>
                          <p className="text-[10px] text-slate-400">{housingPlan.priceSnapshot?.totalPrice ? "total" : (pkg?.priceType === "PER_MONTH" ? "/mo" : "/year")}</p>
                        </div>
                      )}
                    </div>
                    {pkg?.items && pkg.items.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        {pkg.items.map((item: any) => (
                          <div key={item.id} className="flex items-center gap-1.5 text-xs text-slate-600 bg-white/60 rounded-lg px-2 py-1.5">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                            <span className="truncate">{item.label || item.name}</span>
                            {item.featureValue && <span className="ml-auto text-[10px] text-slate-400 shrink-0">{item.featureValue}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const baseTotal = Number(selectedBooking.totalFee || 0);
                const activeAddons = (bookingPackages?.bookingPackages || []).filter(
                  (bp: any) => bp.status === "ACTIVE" && bp.package?.category === "addon_service",
                );
                const includedAddonTotal = activeAddons.reduce((s: number, bp: any) => {
                  if (bp.includeInTotal === false) return s;
                  const { effective } = getBookingPackagePrice(bp);
                  return s + (effective > 0 ? effective : 0);
                }, 0);
                const excludedAddonTotal = activeAddons.reduce((s: number, bp: any) => {
                  if (bp.includeInTotal !== false) return s;
                  const { effective } = getBookingPackagePrice(bp);
                  return s + (effective > 0 ? effective : 0);
                }, 0);
                const grand = baseTotal + includedAddonTotal;
                const hasAddonInfo = includedAddonTotal > 0 || excludedAddonTotal > 0;
                return (
                  <div className="p-4 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl border border-indigo-100" data-testid="payment-summary-widget">
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
                        <p className="text-sm font-bold text-slate-800">₹{baseTotal.toLocaleString("en-IN")}</p>
                      </div>
                    </div>
                    {hasAddonInfo && (
                      <div className="mt-3 pt-3 border-t border-indigo-200 space-y-1.5">
                        {includedAddonTotal > 0 && (
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>+ Add-ons (included)</span>
                            <span className="font-medium text-indigo-700" data-testid="text-payment-addons-included">
                              ₹{includedAddonTotal.toLocaleString("en-IN")}
                            </span>
                          </div>
                        )}
                        {excludedAddonTotal > 0 && (
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Add-ons (excluded)</span>
                            <span className="line-through" data-testid="text-payment-addons-excluded">
                              ₹{excludedAddonTotal.toLocaleString("en-IN")}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1.5 border-t border-indigo-100">
                          <span className="text-xs font-semibold text-slate-700">Grand Total</span>
                          <span className="text-lg font-bold text-indigo-700" data-testid="text-payment-grand-total">
                            ₹{grand.toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

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
                {isAdmin && selectedBooking.createdByName && (
                  <span className="flex items-center gap-1.5 text-indigo-600" data-testid="text-detail-booked-by">
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    Booked by {selectedBooking.createdByName}
                  </span>
                )}
              </div>

              {selectedBooking.referrer && (
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center gap-2" data-testid="referral-info">
                  <Share2 className="h-4 w-4 text-indigo-500 shrink-0" />
                  <span className="text-sm font-medium text-indigo-700">Referral:</span>
                  <span className="text-sm text-slate-700">{selectedBooking.referrer}</span>
                </div>
              )}

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
                    {(isAdmin || isReceptionist) && (
                      <div className="col-span-2">
                        <BedShiftSelector
                          booking={selectedBooking}
                          onShifted={(updated) => {
                            setSelectedBooking({ ...selectedBooking, ...updated });
                            queryClient.invalidateQueries({ queryKey: ["/api/bookings/completed"] });
                          }}
                        />
                      </div>
                    )}
                    <EditableMoveInDate
                      bookingId={selectedBooking.id}
                      currentValue={selectedBooking.residentDetails.moveInDate}
                      onUpdated={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/admin/bookings"] });
                      }}
                    />
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
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-blue-600 uppercase">Emergency / Parent Contact</h4>
                    {(isAdmin || isReceptionist) && selectedBooking.residentDetails.parentEmail && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-100"
                        disabled={sendingParentEmail}
                        data-testid="btn-send-parent-email"
                        onClick={async () => {
                          setSendingParentEmail(true);
                          try {
                            const token = getAuthToken();
                            const resp = await fetch(`/api/admin/bookings/${selectedBooking.id}/send-parent-email`, {
                              method: "POST",
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            const result = await resp.json();
                            if (resp.ok) {
                              toast({ title: "Email sent", description: result.message });
                            } else {
                              toast({ title: "Failed", description: result.error, variant: "destructive" });
                            }
                          } catch {
                            toast({ title: "Error", description: "Failed to send email", variant: "destructive" });
                          } finally {
                            setSendingParentEmail(false);
                          }
                        }}
                      >
                        {sendingParentEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Send Parent Email
                      </Button>
                    )}
                  </div>
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
                  <div className="space-y-3">
                    {selectedBooking.installments.map((inst: any, idx: number) => {
                      const instPayments = (selectedBooking.payments || []).filter((p: any) => p.installmentId === inst.id && p.status === "success");
                      const totalPaid = instPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                      const remaining = Math.max(0, (inst.amount || 0) - totalPaid);
                      const isFullyPaid = inst.paid || totalPaid >= (inst.amount || 0);
                      const isPartiallyPaid = totalPaid > 0 && !isFullyPaid;
                      const canPay = !isFullyPaid && (isAdmin || isReceptionist || isSalesExec);

                      return (
                      <div
                        key={inst.id || idx}
                        className={`text-sm p-2.5 rounded-lg ${canPay ? "cursor-pointer hover:bg-amber-100/60 transition-colors" : ""} ${isFullyPaid ? "bg-emerald-50/50" : isPartiallyPaid ? "bg-blue-50/50" : ""}`}
                        onClick={() => { if (canPay) openPaymentDialog(selectedBooking, { ...inst, _remaining: remaining }); }}
                        data-testid={`installment-row-${idx}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-700">{inst.name}</p>
                            <p className="text-xs text-slate-500">{inst.dueDate || "N/A"}</p>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div>
                              <p className="font-semibold text-slate-800">₹{(inst.amount || 0).toLocaleString("en-IN")}</p>
                              <Badge variant="outline" className={`text-[10px] ${isFullyPaid ? "text-emerald-600 border-emerald-200" : isPartiallyPaid ? "text-blue-600 border-blue-200" : "text-amber-600 border-amber-200"}`}>
                                {isFullyPaid ? "PAID" : isPartiallyPaid ? "PARTIAL" : "PENDING"}
                              </Badge>
                            </div>
                            {canPay && (
                              <Banknote className="w-4 h-4 text-amber-500" />
                            )}
                          </div>
                        </div>

                        {(isPartiallyPaid || isFullyPaid) && totalPaid > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-emerald-600 font-medium">Paid: ₹{totalPaid.toLocaleString("en-IN")}</span>
                              {!isFullyPaid && <span className="text-amber-600 font-medium">Balance: ₹{remaining.toLocaleString("en-IN")}</span>}
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${isFullyPaid ? "bg-emerald-500" : "bg-blue-500"}`}
                                style={{ width: `${Math.min(100, (totalPaid / (inst.amount || 1)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {instPayments.length > 0 && (
                          <div className="mt-2 space-y-1.5 pl-1 border-l-2 border-emerald-200 ml-1">
                            {instPayments.map((p: any, pIdx: number) => {
                              let screenshots: string[] = [];
                              if (p.screenshotPath) {
                                try { const parsed = JSON.parse(p.screenshotPath); screenshots = Array.isArray(parsed) ? parsed : [p.screenshotPath]; } catch { screenshots = [p.screenshotPath]; }
                              }
                              return (
                                <div key={p.id || pIdx} className="text-[11px]">
                                  <div className="flex items-center gap-2 flex-wrap text-slate-500">
                                    <span className="font-medium text-emerald-700">₹{(p.amount || 0).toLocaleString("en-IN")}</span>
                                    <span>{p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy, hh:mm a") : ""}</span>
                                    {p.paymentMethod && (
                                      <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium uppercase text-[10px]">{p.paymentMethod}</span>
                                    )}
                                    {p.razorpayPaymentId && (
                                      <span className="font-mono text-[10px]">UTR: {p.razorpayPaymentId}</span>
                                    )}
                                  </div>
                                  {screenshots.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {screenshots.map((url: string, sIdx: number) => (
                                        <a key={sIdx} href={url} target="_blank" rel="noopener noreferrer">
                                          <div className="flex items-center gap-1.5 p-1.5 bg-white rounded border border-emerald-200 hover:border-emerald-400 transition-colors cursor-pointer">
                                            <img src={url} alt={`Screenshot ${sIdx + 1}`} className="w-8 h-8 object-cover rounded" />
                                            <span className="text-[10px] text-emerald-600 font-medium">View</span>
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {isFullyPaid && instPayments.length === 0 && inst.paidAt && (
                          <p className="mt-1 text-[11px] text-slate-500 pl-2">Paid on {format(new Date(inst.paidAt), "dd MMM yyyy, hh:mm a")}</p>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const payableAddons = (bookingPackages?.bookingPackages || []).filter((bp: any) => {
                  if (bp.package?.category !== "addon_service") return false;
                  if (bp.includeInTotal === false) return false;
                  const { effective } = getBookingPackagePrice(bp);
                  return effective > 0;
                });
                if (payableAddons.length === 0) return null;
                return (
                  <div className="p-4 bg-orange-50 rounded-xl border border-orange-100" data-testid="addon-payments-section">
                    <h4 className="text-xs font-semibold text-orange-600 uppercase mb-3 flex items-center gap-1.5">
                      <UtensilsCrossed className="h-3.5 w-3.5" /> Add-On Payments
                    </h4>
                    <div className="space-y-3">
                      {payableAddons.map((bp: any) => {
                        const { effective } = getBookingPackagePrice(bp);
                        const isPaid = bp.paidStatus === "paid";
                        const paidAmount = Number(bp.paidAmount || 0);
                        const isEditing = addonPayBpId === bp.id;
                        const canEdit = isAdmin || isReceptionist;
                        return (
                          <div
                            key={bp.id}
                            className={`text-sm p-2.5 rounded-lg ${isPaid ? "bg-emerald-50/60" : "bg-white"}`}
                            data-testid={`addon-payment-row-${bp.id}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-slate-700 truncate">{bp.package?.name || "Add-On"}</p>
                                <p className="text-[11px] text-slate-500">
                                  {bp.startDate ? format(new Date(bp.startDate), "dd MMM yy") : ""}
                                  {bp.endDate ? ` — ${format(new Date(bp.endDate), "dd MMM yy")}` : " — Ongoing"}
                                </p>
                              </div>
                              <div className="text-right flex items-center gap-2 shrink-0">
                                <div>
                                  <p className="font-semibold text-slate-800">₹{effective.toLocaleString("en-IN")}</p>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${isPaid ? "text-emerald-600 border-emerald-200" : "text-amber-600 border-amber-200"}`}
                                    data-testid={`addon-payment-status-${bp.id}`}
                                  >
                                    {isPaid ? "PAID" : "PENDING"}
                                  </Badge>
                                </div>
                                {canEdit && !isPaid && !isEditing && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] border-orange-300 text-orange-700 hover:bg-orange-100"
                                    onClick={() => {
                                      setAddonPayBpId(bp.id);
                                      setAddonPayAmount(String(effective));
                                      setAddonPayMethod("upi");
                                      setAddonPayReference("");
                                    }}
                                    data-testid={`button-mark-paid-${bp.id}`}
                                  >
                                    <Banknote className="w-3 h-3 mr-1" />
                                    Mark Paid
                                  </Button>
                                )}
                                {canEdit && isPaid && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[11px] text-slate-500 hover:text-red-600"
                                    onClick={() => {
                                      if (!confirm("Mark this add-on payment as Pending again?")) return;
                                      updateBookingPackage(bp.id, { paidStatus: "pending" });
                                    }}
                                    data-testid={`button-unmark-paid-${bp.id}`}
                                  >
                                    Reset
                                  </Button>
                                )}
                              </div>
                            </div>

                            {isEditing && (
                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] text-slate-500">Amount (₹)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    step="1"
                                    value={addonPayAmount}
                                    onChange={(e) => setAddonPayAmount(e.target.value)}
                                    className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs focus:border-orange-400 focus:outline-none"
                                    data-testid={`input-addon-paid-amount-${bp.id}`}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-500">Method</label>
                                  <select
                                    value={addonPayMethod}
                                    onChange={(e) => setAddonPayMethod(e.target.value)}
                                    className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs focus:border-orange-400 focus:outline-none"
                                    data-testid={`select-addon-paid-method-${bp.id}`}
                                  >
                                    <option value="upi">UPI</option>
                                    <option value="card">Card</option>
                                    <option value="cash">Cash</option>
                                    <option value="bank">Bank</option>
                                    <option value="other">Other</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-500">Reference (UTR / note)</label>
                                  <input
                                    type="text"
                                    value={addonPayReference}
                                    onChange={(e) => setAddonPayReference(e.target.value)}
                                    placeholder="optional"
                                    className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-xs focus:border-orange-400 focus:outline-none"
                                    data-testid={`input-addon-paid-reference-${bp.id}`}
                                  />
                                </div>
                                <div className="sm:col-span-3 flex items-center gap-2 justify-end mt-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-[11px]"
                                    onClick={() => setAddonPayBpId(null)}
                                    data-testid={`button-cancel-addon-paid-${bp.id}`}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={async () => {
                                      const amt = Number(addonPayAmount);
                                      if (!Number.isFinite(amt) || amt < 0) {
                                        toast({ title: "Enter a valid amount", variant: "destructive" });
                                        return;
                                      }
                                      await updateBookingPackage(bp.id, {
                                        paidStatus: "paid",
                                        paidAmount: amt,
                                        paymentMethod: addonPayMethod,
                                        paymentReference: addonPayReference || null,
                                      });
                                      setAddonPayBpId(null);
                                    }}
                                    data-testid={`button-save-addon-paid-${bp.id}`}
                                  >
                                    <Check className="w-3 h-3 mr-1" />
                                    Save
                                  </Button>
                                </div>
                              </div>
                            )}

                            {isPaid && !isEditing && (
                              <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-slate-600 pl-1 border-l-2 border-emerald-200 ml-1">
                                <span className="font-medium text-emerald-700">₹{paidAmount.toLocaleString("en-IN")} paid</span>
                                {bp.paidAt && (
                                  <span className="text-slate-500">{format(new Date(bp.paidAt), "dd MMM yyyy, hh:mm a")}</span>
                                )}
                                {bp.paymentMethod && (
                                  <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium uppercase text-[10px]">{bp.paymentMethod}</span>
                                )}
                                {bp.paymentReference && (
                                  <span className="font-mono text-[10px] text-slate-500">Ref: {bp.paymentReference}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {(selectedBooking.payments || []).length > 0 && (() => {
                const orphanedPayments = (selectedBooking.payments || []).filter((p: any) => !p.installmentId && p.status === "success");
                const hasInstallments = (selectedBooking.installments || []).length > 0;
                return (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <h4 className="text-xs font-semibold text-emerald-600 uppercase mb-3">Payment History</h4>
                  {orphanedPayments.length > 0 && hasInstallments && isAdmin && (
                    <div className="mb-3 p-2.5 bg-amber-100 border border-amber-300 rounded-lg">
                      <p className="text-xs text-amber-800 font-medium mb-1.5">{orphanedPayments.length} payment(s) not linked to any installment</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 border-amber-400 text-amber-700 hover:bg-amber-200"
                        onClick={async () => {
                          try {
                            const authData = localStorage.getItem("hsquare_auth");
                            const token = authData ? JSON.parse(authData)?.token : null;
                            const res = await fetch(`/api/admin/bookings/${selectedBooking.id}/fix-orphaned-payments`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            });
                            const data = await res.json();
                            if (res.ok) {
                              toast({ title: "Fixed", description: data.message });
                              queryClient.invalidateQueries({ queryKey: ["/api/bookings/completed"] });
                              setSelectedBooking(null);
                            } else {
                              toast({ title: "Error", description: data.error, variant: "destructive" });
                            }
                          } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                          }
                        }}
                        data-testid="btn-fix-orphaned-payments"
                      >
                        Link to Installments
                      </Button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {selectedBooking.payments.map((p: any, idx: number) => (
                      <div key={p.id || idx} className="text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-700">₹{(p.amount || 0).toLocaleString("en-IN")}</p>
                            <p className="text-xs text-slate-500">{p.createdAt ? format(new Date(p.createdAt), "dd MMM yyyy, hh:mm a") : "N/A"}</p>
                            {(p.paymentMethod || p.razorpayPaymentId) && (
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {p.paymentMethod && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium uppercase">{p.paymentMethod}</span>
                                )}
                                {p.razorpayPaymentId && (
                                  <span className="text-[10px] text-slate-500 font-mono">UTR: {p.razorpayPaymentId}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${p.status === "success" ? "text-emerald-600 border-emerald-200" : p.status === "failed" ? "text-red-600 border-red-200" : "text-amber-600 border-amber-200"}`}>
                            {(p.status || "pending").toUpperCase()}
                          </Badge>
                        </div>
                        {p.screenshotPath && (() => {
                          let screenshots: string[] = [];
                          try {
                            const parsed = JSON.parse(p.screenshotPath);
                            if (Array.isArray(parsed)) screenshots = parsed;
                            else screenshots = [p.screenshotPath];
                          } catch {
                            screenshots = [p.screenshotPath];
                          }
                          return (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {screenshots.map((url: string, sIdx: number) => (
                                <a key={sIdx} href={url} target="_blank" rel="noopener noreferrer">
                                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-emerald-200 hover:border-emerald-400 transition-colors cursor-pointer">
                                    <img
                                      src={url}
                                      alt={`Payment screenshot ${sIdx + 1}`}
                                      className="w-12 h-12 object-cover rounded border border-slate-200"
                                      data-testid={`img-payment-screenshot-${idx}-${sIdx}`}
                                    />
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                                        <ImageIcon className="h-3 w-3" /> {screenshots.length > 1 ? `Screenshot ${sIdx + 1}` : "Payment Screenshot"}
                                      </p>
                                      <p className="text-[10px] text-slate-400">Tap to view</p>
                                    </div>
                                  </div>
                                </a>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
                );
              })()}

              {(() => {
                const includedServices: any[] = Array.isArray(selectedBooking.propertyIncludedServices) ? selectedBooking.propertyIncludedServices : [];
                if (includedServices.length === 0) return null;
                const SERVICE_ICONS: Record<string, any> = { meals: UtensilsCrossed, shuttle: Bus, ev_bike: Bike, laundry: Shirt, housekeeping: SprayCan, locker: Lock, custom: Tag };
                const MEAL_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", evening_snacks: "Evening Snacks", dinner: "Dinner" };
                const allActivePkgs = bookingPackages?.bookingPackages?.filter((bp: any) => bp.status === "ACTIVE") || [];
                const activePkg = allActivePkgs.find((bp: any) => bp.package?.category === "housing_plan");
                return (
                  <div className="p-4 bg-teal-50 rounded-xl border border-teal-100" data-testid="included-services-section">
                    <h4 className="text-xs font-semibold text-teal-600 uppercase mb-3 flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" /> Included Services
                    </h4>
                    <div className="space-y-2.5">
                      {includedServices.map((svc: any, idx: number) => {
                        const Icon = SERVICE_ICONS[svc.type] || Tag;
                        const pkgSvcItem = activePkg?.package?.items?.find((i: any) => i.type === svc.type);
                        let pkgSvcFeature = pkgSvcItem?.featureValue;
                        let pkgMealCount = svc.type === "meals" && pkgSvcItem ? (pkgSvcItem.includedQty || 0) : 0;
                        
                        const addonPkgs = allActivePkgs.filter((bp: any) => bp.package?.category === "addon_service");
                        for (const addonBp of addonPkgs) {
                          const addonItem = addonBp.package?.items?.find((i: any) => i.type === svc.type);
                          if (addonItem) {
                            if (svc.type === "meals") {
                              const addonCount = addonItem.includedQty || 0;
                              if (addonCount > pkgMealCount) {
                                pkgMealCount = addonCount;
                                pkgSvcFeature = addonItem.featureValue || pkgSvcFeature;
                              }
                            } else {
                              pkgSvcFeature = addonItem.featureValue || pkgSvcFeature;
                            }
                          }
                        }
                        return (
                          <div key={idx} className="bg-white rounded-lg border border-teal-100 p-2.5" data-testid={`included-svc-${idx}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-6 h-6 rounded bg-teal-100 flex items-center justify-center">
                                <Icon className="h-3.5 w-3.5 text-teal-600" />
                              </div>
                              <span className="font-semibold text-xs text-slate-800">{svc.label}</span>
                              {pkgSvcFeature && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">{pkgSvcFeature}</span>
                              )}
                            </div>
                            {svc.type !== "meals" && pkgSvcFeature && (
                              <p className="text-[11px] text-slate-700 ml-8 font-medium">{pkgSvcFeature}</p>
                            )}
                            {svc.type !== "meals" && !pkgSvcFeature && svc.description && <p className="text-[10px] text-slate-500 ml-8 mb-1">{svc.description}</p>}
                            {svc.type === "meals" && svc.schedule && (() => {
                              const ALL_MEALS = ["breakfast", "lunch", "evening_snacks", "dinner"];
                              const getMealInfo = (dayRules: any, targetCount: number) => {
                                if (!dayRules) return { count: targetCount || 0, names: [] as string[] };
                                if (typeof dayRules === "number") return { count: Math.max(dayRules, targetCount), names: [] as string[] };
                                let meals = Array.isArray(dayRules.meals) ? [...dayRules.meals] : [];
                                const baseCount = dayRules.count ?? meals.length;
                                if (targetCount > 0 && targetCount > baseCount) {
                                  const missing = ALL_MEALS.filter(m => !meals.includes(m));
                                  const toAdd = missing.slice(0, targetCount - baseCount);
                                  meals = [...meals, ...toAdd];
                                  meals.sort((a, b) => ALL_MEALS.indexOf(a) - ALL_MEALS.indexOf(b));
                                }
                                const finalCount = Math.max(baseCount, targetCount > 0 ? targetCount : baseCount);
                                return { count: finalCount, names: meals.map((m: string) => MEAL_LABELS[m] || m) };
                              };
                              const wd = getMealInfo(svc.schedule.weekday, pkgMealCount);
                              const sat = getMealInfo(svc.schedule.saturday, pkgMealCount);
                              const sun = getMealInfo(svc.schedule.sunday, pkgMealCount);
                              return (
                                <div className="ml-8 space-y-0.5">
                                  <div className="flex items-start gap-1.5 text-[10px]">
                                    <span className="text-slate-500 font-medium w-12 shrink-0">Mon–Fri</span>
                                    <span className="text-slate-700">{wd.count} meals{wd.names.length > 0 ? ` — ${wd.names.join(", ")}` : ""}</span>
                                  </div>
                                  {(sat.count !== wd.count || sat.names.join(",") !== wd.names.join(",")) && (
                                    <div className="flex items-start gap-1.5 text-[10px]">
                                      <span className="text-slate-500 font-medium w-12 shrink-0">Sat</span>
                                      <span className="text-slate-700">{sat.count} meals{sat.names.length > 0 ? ` — ${sat.names.join(", ")}` : ""}</span>
                                    </div>
                                  )}
                                  {(sun.count !== wd.count || sun.names.join(",") !== wd.names.join(",")) && (
                                    <div className="flex items-start gap-1.5 text-[10px]">
                                      <span className="text-slate-500 font-medium w-12 shrink-0">Sun</span>
                                      <span className="text-slate-700">{sun.count} meals{sun.names.length > 0 ? ` — ${sun.names.join(", ")}` : ""}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {(isAdmin || isReceptionist) && (
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
                                const priceInfo = getBookingPackagePrice(bp);
                                const effectivePrice = priceInfo.effective;
                                const originalPrice = priceInfo.original;
                                const hasPrice = effectivePrice > 0 || originalPrice > 0;
                                const isEditingPrice = editingPriceBpId === bp.id;
                                const includeInTotal = bp.includeInTotal !== false;
                                const isOverridden = priceInfo.isOverridden;
                                return (
                                  <div key={bp.id} className={`border rounded-lg p-3 ${borderColor}`} data-testid={`booking-package-${bp.id}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {isAddon && <UtensilsCrossed className="h-3.5 w-3.5 text-orange-500" />}
                                          <p className="font-semibold text-sm text-slate-800">{pkg?.name || "Package"}</p>
                                          {hasPrice && !isEditingPrice && (
                                            <span className={`text-xs font-bold ${isAddon ? "text-orange-600" : "text-emerald-600"}`} data-testid={`text-bp-price-${bp.id}`}>
                                              ₹{Number(effectivePrice).toLocaleString("en-IN")}
                                            </span>
                                          )}
                                          {hasPrice && !isEditingPrice && isOverridden && (
                                            <span className="text-[9px] text-slate-400 line-through" title="Original price">
                                              ₹{Number(originalPrice).toLocaleString("en-IN")}
                                            </span>
                                          )}
                                          {isAddon && hasPrice && !isEditingPrice && bp.status === "ACTIVE" && (
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-5 w-5 text-slate-400 hover:text-indigo-600"
                                              title="Edit displayed price"
                                              onClick={() => {
                                                setEditingPriceBpId(bp.id);
                                                setEditingPriceValue(String(effectivePrice ?? ""));
                                              }}
                                              data-testid={`button-edit-price-${bp.id}`}
                                            >
                                              <Pencil className="h-2.5 w-2.5" />
                                            </Button>
                                          )}
                                          {isAddon && hasPrice && isEditingPrice && (
                                            <span className="inline-flex items-center gap-1">
                                              <span className="text-xs text-slate-500">₹</span>
                                              <input
                                                type="number"
                                                min={0}
                                                step="1"
                                                inputMode="numeric"
                                                value={editingPriceValue}
                                                onChange={(e) => setEditingPriceValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    const v = editingPriceValue.trim();
                                                    const num = v === "" ? null : Number(v);
                                                    if (num !== null && (!Number.isFinite(num) || num < 0)) {
                                                      toast({ title: "Enter a valid amount", variant: "destructive" });
                                                      return;
                                                    }
                                                    updateBookingPackage(bp.id, { displayPriceOverride: num });
                                                    setEditingPriceBpId(null);
                                                  } else if (e.key === "Escape") {
                                                    setEditingPriceBpId(null);
                                                  }
                                                }}
                                                autoFocus
                                                className="h-6 w-24 rounded border border-indigo-200 bg-white px-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                                                data-testid={`input-edit-price-${bp.id}`}
                                              />
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-5 w-5 text-emerald-600"
                                                title="Save"
                                                onClick={() => {
                                                  const v = editingPriceValue.trim();
                                                  const num = v === "" ? null : Number(v);
                                                  if (num !== null && (!Number.isFinite(num) || num < 0)) {
                                                    toast({ title: "Enter a valid amount", variant: "destructive" });
                                                    return;
                                                  }
                                                  updateBookingPackage(bp.id, { displayPriceOverride: num });
                                                  setEditingPriceBpId(null);
                                                }}
                                                data-testid={`button-save-price-${bp.id}`}
                                              >
                                                <Check className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-5 w-5 text-slate-400"
                                                title="Cancel"
                                                onClick={() => setEditingPriceBpId(null)}
                                                data-testid={`button-cancel-price-${bp.id}`}
                                              >
                                                <X className="h-3 w-3" />
                                              </Button>
                                              {isOverridden && (
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  className="h-5 px-1.5 text-[10px] text-slate-500 hover:text-slate-700"
                                                  title="Reset to original price"
                                                  onClick={() => {
                                                    updateBookingPackage(bp.id, { displayPriceOverride: null });
                                                    setEditingPriceBpId(null);
                                                  }}
                                                  data-testid={`button-reset-price-${bp.id}`}
                                                >
                                                  Reset
                                                </Button>
                                              )}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {isAddon && <Badge className="bg-orange-100 text-orange-600 border-0 text-[9px] px-1.5 py-0">Add-On</Badge>}
                                          <p className="text-[10px] text-slate-500">
                                            {bp.startDate ? format(new Date(bp.startDate), "dd MMM yy") : ""} — {bp.endDate ? format(new Date(bp.endDate), "dd MMM yy") : "Ongoing"}
                                          </p>
                                          {isAddon && hasPrice && bp.status === "ACTIVE" && (
                                            <label className="inline-flex items-center gap-1 cursor-pointer select-none ml-1" title="Include this amount in the booking total">
                                              <input
                                                type="checkbox"
                                                checked={includeInTotal}
                                                onChange={(e) => updateBookingPackage(bp.id, { includeInTotal: e.target.checked })}
                                                className="h-3 w-3 rounded border-slate-300 text-indigo-600 focus:ring-1 focus:ring-indigo-500"
                                                data-testid={`checkbox-include-total-${bp.id}`}
                                              />
                                              <span className={`text-[10px] ${includeInTotal ? "text-indigo-600 font-medium" : "text-slate-400"}`}>
                                                {includeInTotal ? "In total" : "Excluded"}
                                              </span>
                                            </label>
                                          )}
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
                                            {isAddon && (
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => detachPackage(bp.id)} data-testid={`detach-${bp.id}`}>
                                                <X className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {isAddon && (() => {
                                      const mealItem = pkg?.items?.find((i: any) => i.type === "meals" && i.rules);
                                      if (!mealItem) return null;
                                      const r = mealItem.rules;
                                      const MEAL_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", evening_snacks: "Evening Snacks", dinner: "Dinner" };
                                      const getMealInfo = (dayRules: any) => {
                                        if (!dayRules) return { count: 0, names: [] as string[] };
                                        if (typeof dayRules === "number") return { count: dayRules, names: [] };
                                        const meals = Array.isArray(dayRules.meals) ? dayRules.meals : [];
                                        return { count: dayRules.count ?? meals.length, names: meals.map((m: string) => MEAL_LABELS[m] || m) };
                                      };
                                      const wd = getMealInfo(r.weekday);
                                      const sat = getMealInfo(r.saturday);
                                      const sun = getMealInfo(r.sunday);
                                      return (
                                        <div className="mb-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
                                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-orange-700 mb-1.5">
                                            <UtensilsCrossed className="w-3 h-3" /> Meal Schedule
                                          </div>
                                          <div className="space-y-1">
                                            <div className="flex items-start gap-1.5 text-[10px]">
                                              <span className="text-slate-500 font-medium w-12 shrink-0">Mon–Fri</span>
                                              <span className="text-slate-700">{wd.count} meals{wd.names.length > 0 ? ` — ${wd.names.join(", ")}` : ""}</span>
                                            </div>
                                            {(sat.count !== wd.count || sat.names.join(",") !== wd.names.join(",")) && (
                                              <div className="flex items-start gap-1.5 text-[10px]">
                                                <span className="text-slate-500 font-medium w-12 shrink-0">Sat</span>
                                                <span className="text-slate-700">{sat.count} meals{sat.names.length > 0 ? ` — ${sat.names.join(", ")}` : ""}</span>
                                              </div>
                                            )}
                                            {(sun.count !== wd.count || sun.names.join(",") !== wd.names.join(",")) && (
                                              <div className="flex items-start gap-1.5 text-[10px]">
                                                <span className="text-slate-500 font-medium w-12 shrink-0">Sun</span>
                                                <span className="text-slate-700">{sun.count} meals{sun.names.length > 0 ? ` — ${sun.names.join(", ")}` : ""}</span>
                                              </div>
                                            )}
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

                          {(() => {
                            const activeAddons = (bookingPackages?.bookingPackages || []).filter(
                              (bp: any) => bp.status === "ACTIVE" && bp.package?.category === "addon_service",
                            );
                            const priced = activeAddons.map((bp: any) => {
                              const { effective } = getBookingPackagePrice(bp);
                              return { bp, price: effective, included: bp.includeInTotal !== false };
                            }).filter((x: any) => x.price > 0);
                            const baseFee = Number(selectedBooking?.totalFee ?? ((selectedBooking?.baseFee ?? 0) - (selectedBooking?.discount ?? 0)));
                            if (priced.length === 0) return null;
                            const includedTotal = priced.filter((x: any) => x.included).reduce((s: number, x: any) => s + x.price, 0);
                            const excludedTotal = priced.filter((x: any) => !x.included).reduce((s: number, x: any) => s + x.price, 0);
                            const grand = baseFee + includedTotal;
                            return (
                              <div className="rounded-lg border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-3 space-y-1.5" data-testid="packages-grand-total">
                                <div className="flex items-center justify-between text-[11px] text-slate-600">
                                  <span>Booking fee</span>
                                  <span className="font-medium">₹{baseFee.toLocaleString("en-IN")}</span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-600">
                                  <span>Add-ons (included)</span>
                                  <span className="font-medium text-indigo-700">+ ₹{includedTotal.toLocaleString("en-IN")}</span>
                                </div>
                                {excludedTotal > 0 && (
                                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                                    <span>Add-ons (excluded)</span>
                                    <span className="line-through">₹{excludedTotal.toLocaleString("en-IN")}</span>
                                  </div>
                                )}
                                <div className="border-t border-indigo-200 pt-1.5 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-700">Grand Total</span>
                                  <span className="text-base font-bold text-indigo-700" data-testid="text-grand-total">₹{grand.toLocaleString("en-IN")}</span>
                                </div>
                              </div>
                            );
                          })()}

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
                                {bookingPackages.wallet.balance === 0 && bookingPackages?.bookingPackages?.some((bp: any) => bp.status === "ACTIVE") && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-blue-200 text-blue-600" onClick={syncWalletCredits} disabled={syncingCredits} data-testid="button-sync-credits">
                                    {syncingCredits ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                    <span className="ml-1">Sync</span>
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 gap-1 text-indigo-600 border-indigo-200 text-xs" onClick={() => { setAttachDialog(true); setAttachForm({ packageId: "", startDate: selectedBooking?.checkInDate ? new Date(selectedBooking.checkInDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10), endDate: selectedBooking?.checkOutDate ? new Date(selectedBooking.checkOutDate).toISOString().slice(0, 10) : "" }); }} data-testid="button-attach-package">
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
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-teal-600 border-teal-200 hover:bg-teal-50"
                  disabled={sendingWelcomeEmail}
                  data-testid="btn-resend-welcome-email"
                  onClick={async () => {
                    setSendingWelcomeEmail(true);
                    try {
                      const token = getAuthToken();
                      const resp = await fetch(`/api/admin/bookings/${selectedBooking.id}/resend-welcome-email`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const result = await resp.json();
                      if (resp.ok) {
                        toast({ title: "Welcome email sent", description: result.message });
                      } else {
                        toast({ title: "Failed", description: result.error, variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "Error", description: "Failed to send welcome email", variant: "destructive" });
                    } finally {
                      setSendingWelcomeEmail(false);
                    }
                  }}
                >
                  {sendingWelcomeEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Resend Welcome Email
                </Button>
              )}

              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
                  disabled={syncingHMS}
                  data-testid="btn-resync-hms"
                  onClick={async () => {
                    setSyncingHMS(true);
                    try {
                      const token = getAuthToken();
                      const resp = await fetch(`/api/admin/bookings/${selectedBooking.id}/resync-hms`, {
                        method: "POST",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const result = await resp.json();
                      if (resp.ok) {
                        toast({ title: "HMS Sync Complete", description: result.message });
                      } else {
                        toast({ title: "Sync Failed", description: result.error, variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "Error", description: "Failed to sync to HMS", variant: "destructive" });
                    } finally {
                      setSyncingHMS(false);
                    }
                  }}
                >
                  {syncingHMS ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Re-sync to HMS
                </Button>
              )}

              {(isAdmin || isReceptionist || isSalesExec) && (
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  {(() => {
                    const bookingPayments = selectedBooking.payments || [];
                    const hasUnpaidInstalments = (selectedBooking.installments || []).some((inst: any) => {
                      if (inst.paid) return false;
                      const instPayments = bookingPayments.filter((p: any) => p.installmentId === inst.id && p.status === "success");
                      const totalPaid = instPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
                      return totalPaid < (inst.amount || 0);
                    });
                    const showPayBtn = selectedBooking.status === "pending_payment" || selectedBooking.status === "draft" || selectedBooking.status === "confirmed" || selectedBooking.status === "active" || hasUnpaidInstalments;
                    return showPayBtn && selectedBooking.status !== "cancelled" && selectedBooking.status !== "completed" ? (
                    <Button
                      size="sm"
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => openPaymentDialog(selectedBooking)}
                      data-testid="button-mark-payment"
                    >
                      <Banknote className="h-4 w-4" />
                      Mark Payment Done
                    </Button>
                    ) : null;
                  })()}
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
                <div className="flex items-center gap-4 pb-2">
                  {(() => {
                    const photoSrc = getBookingPhotoUrl(selectedBooking.residentDetails);
                    return (
                      <label className="relative group cursor-pointer shrink-0" data-testid="btn-edit-profile-photo">
                        {photoSrc ? (
                          <img src={photoSrc} alt="" className="w-16 h-16 rounded-full object-cover shadow-sm border-2 border-indigo-200" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl border-2 border-indigo-200">
                            {selectedBooking.customerName?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                        )}
                        <div className="absolute inset-0 w-16 h-16 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {profilePhotoUploading ? (
                            <Loader2 className="h-5 w-5 text-white animate-spin" />
                          ) : (
                            <Camera className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={profilePhotoUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadProfilePhoto(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    );
                  })()}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{selectedBooking.customerName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Click photo to upload new image</p>
                  </div>
                </div>
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
                <div>
                  <Label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <Share2 className="h-3 w-3" /> Referrer
                  </Label>
                  <Input
                    value={editForm.referrer}
                    onChange={(e) => setEditForm(prev => ({ ...prev, referrer: e.target.value }))}
                    placeholder="e.g. Ganesh Sir (+91 79 7221 4683)"
                    data-testid="input-edit-referrer"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Date of Birth</Label>
                    <Input
                      type="date"
                      value={editForm.dob}
                      onChange={(e) => setEditForm(prev => ({ ...prev, dob: e.target.value }))}
                      data-testid="input-edit-dob"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Gender</Label>
                    <select
                      value={editForm.gender}
                      onChange={(e) => setEditForm(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      data-testid="select-edit-gender"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Institute</Label>
                    <Input
                      value={editForm.institute}
                      onChange={(e) => setEditForm(prev => ({ ...prev, institute: e.target.value }))}
                      data-testid="input-edit-institute"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Course</Label>
                    <Input
                      value={editForm.course}
                      onChange={(e) => setEditForm(prev => ({ ...prev, course: e.target.value }))}
                      data-testid="input-edit-course"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Move-in Date</Label>
                    <Input
                      type="date"
                      value={editForm.moveInDate}
                      onChange={(e) => setEditForm(prev => ({ ...prev, moveInDate: e.target.value }))}
                      data-testid="input-edit-movein"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Check-out Date</Label>
                    <Input
                      type="date"
                      value={editForm.checkOutDate}
                      onChange={(e) => setEditForm(prev => ({ ...prev, checkOutDate: e.target.value }))}
                      data-testid="input-edit-checkout"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500">Dietary Preference</Label>
                  <select
                    value={editForm.dietaryPreference}
                    onChange={(e) => setEditForm(prev => ({ ...prev, dietaryPreference: e.target.value }))}
                    className="w-full mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    data-testid="select-edit-diet"
                  >
                    <option value="">Select</option>
                    <option value="veg">Vegetarian</option>
                    <option value="non_veg">Non-Vegetarian</option>
                    <option value="jain">Jain</option>
                    <option value="vegan">Vegan</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-3">Parent / Guardian Details</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-medium text-slate-500">Parent Name</Label>
                        <Input
                          value={editForm.parentName}
                          onChange={(e) => setEditForm(prev => ({ ...prev, parentName: e.target.value }))}
                          data-testid="input-edit-parent-name"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500">Relation</Label>
                        <select
                          value={editForm.parentRelation}
                          onChange={(e) => setEditForm(prev => ({ ...prev, parentRelation: e.target.value }))}
                          className="w-full mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                          data-testid="select-edit-parent-relation"
                        >
                          <option value="">Select</option>
                          <option value="father">Father</option>
                          <option value="mother">Mother</option>
                          <option value="guardian">Guardian</option>
                          <option value="sibling">Sibling</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-medium text-slate-500">Parent Phone</Label>
                        <Input
                          value={editForm.parentPhone}
                          onChange={(e) => setEditForm(prev => ({ ...prev, parentPhone: e.target.value }))}
                          data-testid="input-edit-parent-phone"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-500">Parent Email</Label>
                        <Input
                          value={editForm.parentEmail}
                          onChange={(e) => setEditForm(prev => ({ ...prev, parentEmail: e.target.value }))}
                          data-testid="input-edit-parent-email"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Base Fee (₹)</Label>
                    <p className="text-sm font-semibold text-slate-800 mt-1 px-3 py-2 bg-slate-50 rounded-md border border-slate-200" data-testid="display-edit-basefee">₹{(selectedBooking.baseFee || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-500">Discount (₹)</Label>
                    <p className="text-sm font-semibold text-slate-800 mt-1 px-3 py-2 bg-slate-50 rounded-md border border-slate-200" data-testid="display-edit-discount">{selectedBooking.discount != null ? `₹${selectedBooking.discount.toLocaleString("en-IN")}` : "—"}</p>
                  </div>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <p className="text-xs text-slate-500">Total Fee</p>
                  <p className="text-lg font-bold text-indigo-700">₹{(selectedBooking.totalFee || ((selectedBooking.baseFee || 0) - (selectedBooking.discount || 0))).toLocaleString("en-IN")}</p>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
            {paymentForm.paymentMethod !== "cash" && (
              <div>
                <Label className="text-xs font-medium text-slate-500">Transaction ID / UTR <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g., UPI ref, cheque number, receipt ID"
                  value={paymentForm.transactionId}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, transactionId: e.target.value }))}
                  className={!paymentForm.transactionId.trim() ? "border-red-200 focus:border-red-400 focus:ring-red-200" : ""}
                  data-testid="input-transaction-id"
                />
                {!paymentForm.transactionId.trim() && (
                  <p className="text-[11px] text-red-400 mt-1">UTR / Transaction ID is required</p>
                )}
              </div>
            )}
            <div>
              <Label className="text-xs font-medium text-slate-500">
                {paymentForm.paymentMethod === "cash" ? "Cash Receipt Photo" : "Payment Screenshots"} <span className="text-red-500">*</span>
              </Label>
              {paymentForm.paymentMethod === "cash" && (
                <p className="text-[11px] text-amber-600 mt-0.5 mb-1">Photo of cash receipt is mandatory for cash payments</p>
              )}
              {paymentForm.screenshotPreviews.length > 0 && (
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {paymentForm.screenshotPreviews.map((preview, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={preview}
                        alt={`Payment screenshot ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-slate-200 bg-slate-50"
                        data-testid={`img-payment-screenshot-preview-${idx}`}
                      />
                      <button
                        type="button"
                        onClick={() => setPaymentForm(prev => {
                          const newPaths = prev.screenshotPaths.filter((_, i) => i !== idx);
                          const newPreviews = prev.screenshotPreviews.filter((_, i) => i !== idx);
                          return { ...prev, screenshotPaths: newPaths, screenshotPreviews: newPreviews, screenshotPath: newPaths[0] || "", screenshotPreview: newPreviews[0] || "" };
                        })}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-screenshot-${idx}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className={`mt-1.5 flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${screenshotUploading ? "border-slate-200 bg-slate-50" : paymentForm.paymentMethod === "cash" && paymentForm.screenshotPaths.length === 0 ? "border-amber-300 bg-amber-50/50 hover:border-amber-400 hover:bg-amber-50" : "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 hover:bg-emerald-50"}`}>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePaymentScreenshot} disabled={screenshotUploading} data-testid="input-payment-screenshot" />
                {screenshotUploading ? (
                  <Loader2 className="h-5 w-5 text-slate-400 animate-spin" />
                ) : (
                  <Upload className={`h-5 w-5 ${paymentForm.paymentMethod === "cash" && paymentForm.screenshotPaths.length === 0 ? "text-amber-500" : "text-emerald-500"}`} />
                )}
                <span className="text-xs font-medium text-slate-500">{screenshotUploading ? "Uploading..." : paymentForm.screenshotPaths.length > 0 ? "Add more photos" : paymentForm.paymentMethod === "cash" ? "Upload cash receipt photo" : "Upload payment screenshots"}</span>
                <span className="text-[10px] text-slate-400">JPG, PNG under 10MB (multiple allowed)</span>
              </label>
              {paymentForm.screenshotPaths.length === 0 && !screenshotUploading && (
                <p className="text-[11px] text-red-400 mt-1">{paymentForm.paymentMethod === "cash" ? "Cash receipt photo is required" : "Payment screenshot is required"}</p>
              )}
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
                disabled={markingPayment || (paymentForm.paymentMethod !== "cash" && !paymentForm.transactionId.trim()) || paymentForm.screenshotPaths.length === 0 || screenshotUploading}
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
              const MEAL_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", evening_snacks: "Evening Snacks", dinner: "Dinner" };
              const getMealInfo = (dayRules: any) => {
                if (!dayRules) return { count: 0, names: [] as string[] };
                if (typeof dayRules === "number") return { count: dayRules, names: [] };
                const meals = Array.isArray(dayRules.meals) ? dayRules.meals : [];
                return { count: dayRules.count ?? meals.length, names: meals.map((m: string) => MEAL_LABELS[m] || m) };
              };
              const wd = getMealInfo(r.weekday);
              const sat = getMealInfo(r.saturday);
              const sun = getMealInfo(r.sunday);
              return (
                <div className="p-2.5 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-orange-700 mb-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5" /> Meal Schedule
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-start gap-2 text-[11px]">
                      <span className="text-slate-500 font-medium w-14 shrink-0">Mon–Fri</span>
                      <span className="text-slate-700">{wd.count} meals{wd.names.length > 0 ? ` — ${wd.names.join(", ")}` : ""}</span>
                    </div>
                    {(sat.count !== wd.count || sat.names.join(",") !== wd.names.join(",")) && (
                      <div className="flex items-start gap-2 text-[11px]">
                        <span className="text-slate-500 font-medium w-14 shrink-0">Saturday</span>
                        <span className="text-slate-700">{sat.count} meals{sat.names.length > 0 ? ` — ${sat.names.join(", ")}` : ""}</span>
                      </div>
                    )}
                    {(sun.count !== wd.count || sun.names.join(",") !== wd.names.join(",")) && (
                      <div className="flex items-start gap-2 text-[11px]">
                        <span className="text-slate-500 font-medium w-14 shrink-0">Sunday</span>
                        <span className="text-slate-700">{sun.count} meals{sun.names.length > 0 ? ` — ${sun.names.join(", ")}` : ""}</span>
                      </div>
                    )}
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
            {(() => {
              const selectedPkg = allPackages.find(p => p.id === attachForm.packageId);
              if (!selectedPkg || !attachForm.startDate || !attachForm.endDate) return null;
              const start = new Date(attachForm.startDate);
              const end = new Date(attachForm.endDate);
              if (end <= start) return null;
              const base = Number(selectedPkg.basePrice) || 0;
              const pType = selectedPkg.priceType || "PER_MONTH";
              let total = base;
              let durationLabel = "";
              if (pType === "ONE_TIME") {
                total = base;
                durationLabel = "One-time";
              } else if (pType === "PER_DAY") {
                const days = differenceInDays(end, start);
                total = base * days;
                durationLabel = `${days} day${days !== 1 ? "s" : ""}`;
              } else if (pType === "PER_MONTH") {
                const months = differenceInCalendarMonths(end, start) || 1;
                total = base * months;
                durationLabel = `${months} month${months !== 1 ? "s" : ""}`;
              } else if (pType === "PER_YEAR") {
                const months = differenceInCalendarMonths(end, start) || 1;
                const monthlyRate = base / 11;
                total = monthlyRate * months;
                if (months >= 11 && months % 11 === 0) {
                  const years = months / 11;
                  durationLabel = `${years} academic year${years !== 1 ? "s" : ""} (${months} months)`;
                } else {
                  durationLabel = `${months} month${months !== 1 ? "s" : ""}`;
                }
              }
              return (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-slate-500">Duration: {durationLabel}</p>
                      <p className="text-[11px] text-slate-400">
                        {pType === "PER_YEAR" 
                          ? `₹${Math.round(base / 11).toLocaleString("en-IN")}/mo × ${durationLabel}`
                          : `₹${base.toLocaleString("en-IN")} × ${durationLabel}`
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Total Price</p>
                      <p className="text-lg font-bold text-slate-800" data-testid="text-calculated-price">₹{Math.round(total).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                </div>
              );
            })()}
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

function EditableMoveInDate({ bookingId, currentValue, onUpdated }: { bookingId: string; currentValue?: string; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!value) return;
    setSaving(true);
    try {
      const authData = localStorage.getItem("hsquare_auth");
      const token = authData ? JSON.parse(authData)?.token : null;
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ residentDetails: { moveInDate: value } }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "Move-in date updated" });
      setEditing(false);
      onUpdated();
    } catch (err) {
      toast({ title: "Error updating move-in date", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="col-span-2 flex items-center gap-2">
        <span className="text-slate-500 text-sm whitespace-nowrap">Move-in Date:</span>
        <Input
          type="date"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="h-7 text-sm w-36"
          data-testid="input-move-in-date"
        />
        <button onClick={handleSave} disabled={saving} className="text-green-600 hover:text-green-800" data-testid="button-save-move-in">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button onClick={() => { setEditing(false); setValue(currentValue || ""); }} className="text-slate-400 hover:text-slate-600" data-testid="button-cancel-move-in">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500">Move-in Date:</span>{" "}
      <span className="font-medium">{currentValue || "—"}</span>
      <button onClick={() => { setValue(currentValue || ""); setEditing(true); }} className="text-indigo-400 hover:text-indigo-600 ml-1" data-testid="button-edit-move-in">
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

interface AvailableBed {
  id: string;
  bedNumber: string;
  floorId: string;
  floorName: string;
  floorNumber: number;
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName?: string;
  linkedPackages: string[];
}

function BedShiftSelector({ booking, onShifted }: { booking: any; onShifted: (updated: any) => void }) {
  const [open, setOpen] = useState(false);
  const [beds, setBeds] = useState<AvailableBed[]>([]);
  const [totalInType, setTotalInType] = useState(0);
  const [occupiedInType, setOccupiedInType] = useState(0);
  const [unallocatableInType, setUnallocatableInType] = useState(0);
  const [loading, setLoading] = useState(false);
  const [shifting, setShifting] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>(booking.roomTypeId || "");
  const [roomTypes, setRoomTypes] = useState<{ id: string; name: string }[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";

  const getAuthToken = () => {
    const authData = localStorage.getItem("hsquare_auth");
    return authData ? JSON.parse(authData)?.token : null;
  };

  const fetchRoomTypes = async () => {
    if (!booking.propertyId) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/properties/${booking.propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.roomTypes) {
          setRoomTypes(data.roomTypes.map((rt: { id: string; name: string; customName?: string }) => ({
            id: rt.id,
            name: rt.customName || rt.name,
          })));
        }
      }
    } catch {
      // Room types fetch failed, superadmin dropdown won't show options
    }
  };

  const fetchAvailableBeds = async (roomTypeId: string) => {
    if (!booking.propertyId) return;
    setLoading(true);
    try {
      const token = getAuthToken();
      const url = `/api/properties/${booking.propertyId}/available-beds?roomTypeId=${roomTypeId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const bedList: AvailableBed[] = Array.isArray(data) ? data : (data.beds || []);
        const total = Array.isArray(data) ? bedList.length : (data.totalInType ?? bedList.length);
        const occupied = Array.isArray(data) ? 0 : (data.occupiedInType ?? 0);
        const unallocatable = Array.isArray(data) ? 0 : (data.unallocatableInType ?? 0);
        setBeds(bedList.filter((b: AvailableBed) => b.id !== booking.bedId));
        setTotalInType(total);
        setOccupiedInType(occupied);
        setUnallocatableInType(unallocatable);
      } else {
        const err = await res.json().catch(() => ({ error: "Failed to load beds" }));
        toast({ title: "Error", description: err.error || "Failed to load available beds", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to load available beds", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleOpen = async () => {
    setOpen(true);
    setSelectedBedId(null);
    setLoading(true);
    // Always fetch ALL room types for the property (including inactive ones and
    // ones with bedCountAtProperty) so admin & receptionist can switch to a
    // valid type when the booking's stored roomTypeId is stale or has zero beds
    // (e.g. migrated/legacy bookings whose room type was renamed or removed).
    let availableTypes: { id: string; name: string; bedCount: number }[] = [];
    if (booking.propertyId) {
      try {
        const token = getAuthToken();
        // Prefer the admin-only endpoint that returns all room types + bed counts
        const adminRes = await fetch(`/api/admin/properties/${booking.propertyId}/room-types`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (adminRes.ok) {
          const data = await adminRes.json();
          availableTypes = (Array.isArray(data) ? data : []).map((rt: { id: string; name: string; customName?: string; bedCountAtProperty?: number }) => ({
            id: rt.id,
            name: rt.customName || rt.name,
            bedCount: rt.bedCountAtProperty ?? 0,
          }));
        } else {
          // Fallback to public endpoint (no bed counts available)
          const res = await fetch(`/api/properties/${booking.propertyId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.roomTypes) {
              availableTypes = data.roomTypes.map((rt: { id: string; name: string; customName?: string }) => ({
                id: rt.id,
                name: rt.customName || rt.name,
                bedCount: 0,
              }));
            }
          }
        }
        setRoomTypes(availableTypes.map(rt => ({ id: rt.id, name: rt.name })));
      } catch {
        // ignore
      }
    }
    // Pick a default that actually has beds. Order of preference:
    //   1. Booking's stored roomTypeId if it exists AND has beds
    //   2. The first room type with bedCount > 0
    //   3. Booking's stored roomTypeId (so user at least sees the empty state with type selected)
    const stored = booking.roomTypeId
      ? availableTypes.find(rt => rt.id === booking.roomTypeId)
      : undefined;
    const firstWithBeds = availableTypes.find(rt => rt.bedCount > 0);
    const defaultType =
      (stored && stored.bedCount > 0 ? stored.id : undefined) ||
      firstWithBeds?.id ||
      booking.roomTypeId ||
      availableTypes[0]?.id ||
      "";
    setSelectedRoomTypeId(defaultType);
    if (defaultType) {
      fetchAvailableBeds(defaultType);
    } else {
      setLoading(false);
    }
  };

  const handleRoomTypeChange = (newRoomTypeId: string) => {
    setSelectedRoomTypeId(newRoomTypeId);
    setSelectedBedId(null);
    fetchAvailableBeds(newRoomTypeId);
  };

  const handleShift = async () => {
    if (!selectedBedId) return;
    setShifting(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/admin/bookings/${booking.id}/shift-bed`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newBedId: selectedBedId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to shift bed");
      }
      const updated = await res.json();
      toast({ title: "Bed shifted successfully", description: "HMS sync triggered" });
      setOpen(false);
      onShifted(updated);
    } catch (error: any) {
      toast({ title: "Bed shift failed", description: error.message, variant: "destructive" });
    }
    setShifting(false);
  };

  const selectedBed = beds.find(b => b.id === selectedBedId);

  const isCrossType = selectedRoomTypeId !== booking.roomTypeId;
  const bookingTypeIsStale = roomTypes.length > 0 && !!booking.roomTypeId && !roomTypes.some(rt => rt.id === booking.roomTypeId);
  const crossTypeBlockedForRole = isCrossType && !isSuperAdmin && !bookingTypeIsStale;

  const grouped = beds.reduce<Record<string, AvailableBed[]>>((acc, bed) => {
    const key = `${bed.floorName}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(bed);
    return acc;
  }, {});

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="h-7 text-xs gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
        data-testid="button-shift-bed"
      >
        <ArrowRightLeft className="h-3 w-3" />
        Shift Bed
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Shift Bed / Room Transfer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg text-sm">
              <div className="font-medium text-slate-700 mb-1">Current Assignment</div>
              <div className="text-slate-500">
                Room: <span className="font-medium text-slate-800">{booking.residentDetails?.roomNo || "—"}</span>
                {" | "}
                Bed: <span className="font-medium text-slate-800">{booking.residentDetails?.bedNo || "—"}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {booking.roomTypeName} &middot; {booking.propertyName}
              </div>
            </div>

            {roomTypes.length > 0 && (
              <div className="space-y-1" data-testid="room-type-selector">
                <label className="text-xs font-medium text-slate-600">Room Type</label>
                <select
                  value={selectedRoomTypeId}
                  onChange={(e) => handleRoomTypeChange(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none"
                  data-testid="select-room-type"
                >
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}{rt.id === booking.roomTypeId ? " (current)" : ""}
                    </option>
                  ))}
                </select>
                {isCrossType && isSuperAdmin && (
                  <div className="text-[11px] text-amber-600 font-medium px-1">
                    Cross-type shift — booking room type will be updated
                  </div>
                )}
                {isCrossType && !isSuperAdmin && (
                  <div className="text-[11px] text-amber-600 font-medium px-1">
                    Different room type — only a superadmin can confirm a cross-type shift
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-400">Loading available beds...</span>
              </div>
            ) : beds.length === 0 ? (
              <div className="text-center py-6 px-4 space-y-2" data-testid="empty-no-beds">
                <div className="text-sm font-medium text-slate-600">
                  No available beds in this room type
                </div>
                {totalInType > 0 ? (
                  <div className="text-xs text-slate-400">
                    {occupiedInType} of {totalInType} beds in this room type are currently occupied
                    {unallocatableInType > 0 && `, ${unallocatableInType} blocked / under maintenance`}.
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">
                    This property has no beds set up under this room type.
                  </div>
                )}
                {!isSuperAdmin && (
                  <div className="text-xs text-amber-600">
                    Ask a superadmin to do a cross-room-type shift if needed.
                  </div>
                )}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-3">
                {Object.entries(grouped).map(([groupName, groupBeds]) => (
                  <div key={groupName}>
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1.5 sticky top-0 bg-white py-1">
                      {groupName}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {groupBeds.map(bed => (
                        <button
                          key={bed.id}
                          onClick={() => setSelectedBedId(bed.id)}
                          className={`p-2 rounded-lg border text-left text-xs transition-all ${
                            selectedBedId === bed.id
                              ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                          data-testid={`bed-option-${bed.id}`}
                        >
                          <div className="font-medium text-slate-700">
                            Bed {bed.bedNumber}
                          </div>
                          <div className="text-slate-400">
                            Room {bed.roomNumber} &middot; F{bed.floorNumber}
                          </div>
                          {isCrossType && bed.roomTypeName && (
                            <div className="mt-0.5 text-[10px] text-amber-600 font-medium">
                              {bed.roomTypeName}
                            </div>
                          )}
                          {bed.linkedPackages.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {bed.linkedPackages.map((pkg, i) => (
                                <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium" data-testid={`badge-package-${bed.id}`}>
                                  <Tag className="h-2.5 w-2.5" />
                                  {pkg}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedBed && (
              <div className={`p-3 rounded-lg text-sm border ${selectedBed.roomTypeId !== booking.roomTypeId ? "bg-amber-50 border-amber-200" : "bg-indigo-50 border-indigo-100"}`}>
                <div className={`font-medium ${selectedBed.roomTypeId !== booking.roomTypeId ? "text-amber-700" : "text-indigo-700"}`}>Transfer to:</div>
                <div className={selectedBed.roomTypeId !== booking.roomTypeId ? "text-amber-600" : "text-indigo-600"}>
                  {selectedBed.floorName} &rarr; Room {selectedBed.roomNumber} &rarr; Bed {selectedBed.bedNumber}
                </div>
                {selectedBed.roomTypeId !== booking.roomTypeId && selectedBed.roomTypeName && (
                  <div className="text-xs text-amber-700 mt-1 font-medium">
                    Room type will change: {booking.roomTypeName} &rarr; {selectedBed.roomTypeName}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} data-testid="button-cancel-shift">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleShift}
                disabled={!selectedBedId || shifting || crossTypeBlockedForRole}
                className="bg-indigo-600 hover:bg-indigo-700"
                data-testid="button-confirm-shift"
              >
                {shifting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />}
                Confirm Shift
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
