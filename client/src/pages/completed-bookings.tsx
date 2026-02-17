import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
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
    default:
      return <Badge variant="secondary" data-testid={`status-${status}`}>{status}</Badge>;
  }
}

export default function CompletedBookings() {
  const { user } = useAuth();
  const { selectedPropertyId } = useProperty();
  const isSalesExec = user?.role === "sales_executive";
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["/api/bookings/completed"],
    queryFn: async () => {
      const res = await fetch("/api/bookings/completed", { credentials: "include" });
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
            {isSalesExec ? "My Completed Bookings" : "Completed Bookings"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSalesExec
              ? "View bookings from your won leads"
              : "All confirmed, active, and completed bookings"}
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
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
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
              {searchQuery ? "Try a different search term" : "No completed bookings yet"}
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

      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-indigo-500" />
              Booking Details
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && (
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
