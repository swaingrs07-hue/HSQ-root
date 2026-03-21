import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  User, Phone, Mail, Calendar, GraduationCap, Building2, Users,
  Eye, CheckCircle, XCircle, Clock, ArrowRight, Search, Filter,
  Camera, Utensils, FileText, ExternalLink, Copy, Check
} from "lucide-react";
import { useLocation } from "wouter";
import type { RegistrationRequest } from "@shared/schema";

type RegistrationRequestWithBooking = RegistrationRequest & { bookingCode?: string | null };

const STATUS_STYLES: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  reviewed: { label: "Reviewed", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Eye },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  booked: { label: "Booked", color: "bg-violet-100 text-violet-700 border-violet-200", icon: Check },
};

function getToken() {
  try {
    return JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token || "";
  } catch { return ""; }
}

export default function AdminRegistrations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequestWithBooking | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const { data: requests = [], isLoading } = useQuery<RegistrationRequestWithBooking[]>({
    queryKey: ["/api/admin/registration-requests"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/admin/registration-requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: string; status: string; reviewNotes?: string }) => {
      const token = getToken();
      const res = await fetch(`/api/admin/registration-requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, reviewNotes }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/registration-requests"] });
      toast({ title: "Status updated" });
      setSelectedRequest(null);
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const filtered = requests.filter(r => {
    const matchSearch = !search || r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.email.toLowerCase().includes(search.toLowerCase()) || r.phone.includes(search);
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/apply`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    toast({ title: "Registration link copied!" });
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleProceedToBooking = (req: RegistrationRequest) => {
    const params = new URLSearchParams({
      prefill: "registration",
      regId: req.id,
      name: req.fullName,
      phone: req.phone,
      email: req.email,
      gender: req.gender || "",
    });
    if (req.propertyId) params.set("propertyId", req.propertyId);
    navigate(`/booking/generate?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3" data-testid="text-page-title">
            <FileText className="w-7 h-7 text-violet-600" />
            Registration Requests
            {pendingCount > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-sm">{pendingCount} pending</Badge>
            )}
          </h1>
          <p className="text-slate-500 mt-1">Review and manage student registration submissions</p>
        </div>
        <Button
          onClick={handleCopyLink}
          data-testid="button-copy-link"
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          {copiedLink ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copiedLink ? "Link Copied!" : "Copy Registration Link"}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            data-testid="input-search"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "reviewed", "approved", "rejected", "booked"].map(s => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              data-testid={`filter-${s}`}
              className={statusFilter === s ? "bg-violet-600 hover:bg-violet-700" : ""}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-xl border border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No registration requests found</p>
          <p className="text-slate-400 text-sm mt-1">Share the registration link to receive submissions</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(req => {
            const st = STATUS_STYLES[req.status] || STATUS_STYLES.pending;
            const StatusIcon = st.icon;
            return (
              <div
                key={req.id}
                data-testid={`card-registration-${req.id}`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-slate-900" data-testid={`text-name-${req.id}`}>{req.fullName}</h3>
                        <Badge className={`${st.color} border text-xs`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {st.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{req.phone}</span>
                        <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{req.email}</span>
                        {req.instituteName && (
                          <span className="flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5" />{req.instituteName}</span>
                        )}
                        {req.propertyName && (
                          <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{req.propertyName}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Submitted {new Date(req.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {req.status === "booked" && req.bookingId && (
                          <span className="ml-2 text-violet-600 font-medium">Booking: {req.bookingCode || req.bookingId.slice(0, 8)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSelectedRequest(req); setReviewNotes(req.reviewNotes || ""); }}
                      data-testid={`button-view-${req.id}`}
                    >
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Button>
                    {req.status === "booked" && req.bookingId ? (
                      <Button
                        size="sm"
                        className="bg-violet-600 hover:bg-violet-700 text-white"
                        onClick={() => navigate(`/admin/bookings/completed?search=${encodeURIComponent(req.bookingCode || req.bookingId!)}`)}
                        data-testid={`button-view-booking-${req.id}`}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" /> View Booking {req.bookingCode ? `(${req.bookingCode})` : ""}
                      </Button>
                    ) : (req.status === "pending" || req.status === "reviewed" || req.status === "approved") ? (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleProceedToBooking(req)}
                        data-testid={`button-book-${req.id}`}
                      >
                        <ArrowRight className="w-4 h-4 mr-1" /> Proceed to Booking
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedRequest} onOpenChange={v => !v && setSelectedRequest(null)}>
        {selectedRequest && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <User className="w-5 h-5 text-violet-600" />
                {selectedRequest.fullName}
                <Badge className={`${STATUS_STYLES[selectedRequest.status]?.color || ""} border text-xs`}>
                  {STATUS_STYLES[selectedRequest.status]?.label}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                  <User className="w-4 h-4" /> Personal Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-400">Name</span><p className="font-medium text-slate-800">{selectedRequest.fullName}</p></div>
                  <div><span className="text-slate-400">Phone</span><p className="font-medium text-slate-800">{selectedRequest.phone}</p></div>
                  <div><span className="text-slate-400">Email</span><p className="font-medium text-slate-800">{selectedRequest.email}</p></div>
                  <div><span className="text-slate-400">Gender</span><p className="font-medium text-slate-800 capitalize">{selectedRequest.gender}</p></div>
                  {selectedRequest.dob && <div><span className="text-slate-400">Date of Birth</span><p className="font-medium text-slate-800">{selectedRequest.dob}</p></div>}
                  {selectedRequest.dietaryPreference && <div><span className="text-slate-400">Dietary</span><p className="font-medium text-slate-800 capitalize">{selectedRequest.dietaryPreference}</p></div>}
                </div>
              </div>

              {(selectedRequest.instituteName || selectedRequest.courseName || selectedRequest.moveInDate) && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                    <GraduationCap className="w-4 h-4" /> Academic Details
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedRequest.instituteName && <div><span className="text-slate-400">Institute</span><p className="font-medium text-slate-800">{selectedRequest.instituteName}</p></div>}
                    {selectedRequest.courseName && <div><span className="text-slate-400">Course</span><p className="font-medium text-slate-800">{selectedRequest.courseName}</p></div>}
                    {selectedRequest.moveInDate && <div><span className="text-slate-400">Move-in</span><p className="font-medium text-slate-800">{selectedRequest.moveInDate}</p></div>}
                    {selectedRequest.checkOutDate && <div><span className="text-slate-400">Check-out</span><p className="font-medium text-slate-800">{selectedRequest.checkOutDate}</p></div>}
                  </div>
                </div>
              )}

              {(selectedRequest.parentName || selectedRequest.parentPhone) && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4" /> Parent / Guardian
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedRequest.parentName && <div><span className="text-slate-400">Name</span><p className="font-medium text-slate-800">{selectedRequest.parentName}</p></div>}
                    {selectedRequest.parentRelation && <div><span className="text-slate-400">Relation</span><p className="font-medium text-slate-800 capitalize">{selectedRequest.parentRelation}</p></div>}
                    {selectedRequest.parentPhone && <div><span className="text-slate-400">Phone</span><p className="font-medium text-slate-800">{selectedRequest.parentPhone}</p></div>}
                    {selectedRequest.parentEmail && <div><span className="text-slate-400">Email</span><p className="font-medium text-slate-800">{selectedRequest.parentEmail}</p></div>}
                  </div>
                </div>
              )}

              {selectedRequest.propertyName && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4" /> Property Preference
                  </h3>
                  <p className="text-sm font-medium text-slate-800">{selectedRequest.propertyName}</p>
                </div>
              )}

              {selectedRequest.notes && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4" /> Notes
                  </h3>
                  <p className="text-sm text-slate-700">{selectedRequest.notes}</p>
                </div>
              )}

              <div className="bg-violet-50 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-violet-700 flex items-center gap-2 text-sm">Admin Review Notes</h3>
                <Textarea
                  data-testid="input-review-notes"
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="Add notes about this registration..."
                  className="bg-white border-violet-200"
                />
              </div>
            </div>

            <DialogFooter className="flex flex-wrap gap-2 pt-4">
              {selectedRequest.status !== "rejected" && (
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => updateStatus.mutate({ id: selectedRequest.id, status: "rejected", reviewNotes })}
                  data-testid="button-reject"
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
              )}
              {selectedRequest.status === "pending" && (
                <Button
                  variant="outline"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                  onClick={() => updateStatus.mutate({ id: selectedRequest.id, status: "reviewed", reviewNotes })}
                  data-testid="button-reviewed"
                >
                  <Eye className="w-4 h-4 mr-1" /> Mark Reviewed
                </Button>
              )}
              {(selectedRequest.status === "pending" || selectedRequest.status === "reviewed") && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => updateStatus.mutate({ id: selectedRequest.id, status: "approved", reviewNotes })}
                  data-testid="button-approve"
                >
                  <CheckCircle className="w-4 h-4 mr-1" /> Approve
                </Button>
              )}
              {selectedRequest.status === "booked" && selectedRequest.bookingId ? (
                <Button
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={() => navigate(`/admin/bookings/completed?search=${encodeURIComponent(selectedRequest.bookingCode || selectedRequest.bookingId!)}`)}
                  data-testid="button-view-booking-dialog"
                >
                  <ExternalLink className="w-4 h-4 mr-1" /> View Booking {selectedRequest.bookingCode ? `(${selectedRequest.bookingCode})` : ""}
                </Button>
              ) : (
                <Button
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={() => handleProceedToBooking(selectedRequest)}
                  data-testid="button-proceed-booking"
                >
                  <ArrowRight className="w-4 h-4 mr-1" /> Proceed to Booking
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}