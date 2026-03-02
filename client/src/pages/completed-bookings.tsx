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
  });
  const [markingPayment, setMarkingPayment] = useState(false);

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

  const openPaymentDialog = (booking: any) => {
    setPaymentForm({
      amount: booking.totalFee || 0,
      paymentMethod: "cash",
      transactionId: "",
      notes: "",
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
      const { booking: updated } = await res.json();
      setSelectedBooking({ ...selectedBooking, ...updated, status: "confirmed" });
      setShowPaymentDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/completed"] });
      toast({ title: "Payment marked as done", description: "Booking status updated to Confirmed" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setMarkingPayment(false);
    }
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

      <Dialog open={!!selectedBooking} onOpenChange={(open) => { if (!open) { setSelectedBooking(null); setIsEditing(false); } }}>
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

              {selectedBooking.residentDetails && (
                <div className="p-4 bg-pink-50 rounded-xl border border-pink-100">
                  <h4 className="text-xs font-semibold text-pink-600 uppercase mb-2">Resident Info</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {selectedBooking.residentDetails.name && (
                      <div><span className="text-slate-500">Name:</span> <span className="font-medium">{selectedBooking.residentDetails.name}</span></div>
                    )}
                    {selectedBooking.residentDetails.phone && (
                      <div><span className="text-slate-500">Phone:</span> <span className="font-medium">{selectedBooking.residentDetails.phone}</span></div>
                    )}
                    {selectedBooking.residentDetails.gender && (
                      <div><span className="text-slate-500">Gender:</span> <span className="font-medium capitalize">{selectedBooking.residentDetails.gender}</span></div>
                    )}
                    {selectedBooking.residentDetails.institute && (
                      <div><span className="text-slate-500">Institute:</span> <span className="font-medium">{selectedBooking.residentDetails.institute}</span></div>
                    )}
                    {selectedBooking.residentDetails.parentName && (
                      <div className="col-span-2"><span className="text-slate-500">Parent:</span> <span className="font-medium">{selectedBooking.residentDetails.parentName} ({selectedBooking.residentDetails.parentRelation})</span></div>
                    )}
                  </div>
                </div>
              )}

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
              Mark Payment Done
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
    </div>
  );
}
