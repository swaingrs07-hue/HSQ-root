import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Search, Eye, Loader2, User, Building2, Calendar, Hash, ChevronRight } from "lucide-react";
import { Link } from "wouter";

function statusColor(status: string) {
  switch (status) {
    case "pending": return "bg-amber-100 text-amber-700 border-amber-200";
    case "approved": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "rejected": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function StatusIcon({ status }: { status: string }) {
  if (status === "approved") return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  if (status === "rejected") return <XCircle className="h-4 w-4 text-red-600" />;
  return <Clock className="h-4 w-4 text-amber-600" />;
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtCurr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function AdminCancellations() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [overrideRefund, setOverrideRefund] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const authHeader = { Authorization: `Bearer ${token}` };

  const loadRequests = async (status?: string) => {
    setLoading(true);
    try {
      const qs = status && status !== "all" ? `?status=${status}` : "";
      const res = await fetch(`/api/admin/cancellation-requests${qs}`, { headers: authHeader });
      if (res.ok) setRequests(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadRequests(statusFilter); }, [statusFilter, token]);

  const filtered = requests.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (r.bookingCode || "").toLowerCase().includes(q) ||
      (r.studentName || "").toLowerCase().includes(q) ||
      (r.propertyName || "").toLowerCase().includes(q);
  });

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const body: any = { note: approveNote };
      if (overrideRefund.trim()) body.overrideRefundAmount = Number(overrideRefund);
      const res = await fetch(`/api/admin/cancellation-requests/${selected.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      toast({ title: "Cancellation Approved", description: "The booking has been cancelled and the student notified." });
      setApproveDialogOpen(false);
      setSelected(null);
      loadRequests(statusFilter);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!selected || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/cancellation-requests/${selected.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ rejectionReason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject");
      toast({ title: "Request Rejected", description: "The student has been notified." });
      setRejectDialogOpen(false);
      setSelected(null);
      loadRequests(statusFilter);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setActionLoading(false);
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <XCircle className="h-6 w-6 text-rose-500" />
            Cancellation Requests
            {pendingCount > 0 && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 ml-1">{pendingCount} pending</Badge>
            )}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Review and process student cancellation requests</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadRequests(statusFilter)} data-testid="button-refresh-cancellations">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by booking code, student or property…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-cancellations"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-64 mb-1" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <XCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No cancellation requests found</p>
            <p className="text-slate-400 text-sm mt-1">
              {statusFilter !== "all" ? `No ${statusFilter} requests at this time.` : "No requests have been submitted yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req: any) => {
            const bd = req.refundBreakdown as any;
            return (
              <Card key={req.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelected(req)} data-testid={`card-cancel-req-${req.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="font-mono font-bold text-slate-700 text-sm" data-testid={`text-booking-code-${req.id}`}>{req.bookingCode || "N/A"}</span>
                        <Badge className={`${statusColor(req.status)} text-[10px] px-2 py-0.5 capitalize flex items-center gap-1`}>
                          <StatusIcon status={req.status} />
                          {req.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-slate-500">
                          {req.initiatedBy === "admin" ? "Admin-initiated" : "Student request"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-600 mb-1 flex-wrap">
                        <span className="flex items-center gap-1"><User className="h-3.5 w-3.5 text-slate-400" /> {req.studentName || "—"}</span>
                        <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-slate-400" /> {req.propertyName || "—"}</span>
                        {req.checkInDate && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Check-in: {new Date(req.checkInDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-1"><span className="font-medium text-slate-600">Reason:</span> {req.reason}</p>
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      {bd && (
                        <>
                          <p className="text-xs text-slate-500">Refundable</p>
                          <p className="font-bold text-emerald-600 text-sm">{fmtCurr(req.overrideRefundAmount ?? bd?.refundable ?? 0)}</p>
                          {(bd?.forfeited ?? 0) > 0 && <p className="text-xs text-rose-500">{fmtCurr(bd.forfeited)} forfeited</p>}
                        </>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1">{formatDate(req.createdAt)}</p>
                      <ChevronRight className="h-4 w-4 text-slate-300 ml-auto" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-rose-500" />
                Cancellation Request — {selected.bookingCode}
              </DialogTitle>
              <DialogDescription>
                Review the request details before approving or rejecting.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-slate-500 text-xs mb-1">Student</p>
                  <p className="font-semibold text-slate-700">{selected.studentName || "—"}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-slate-500 text-xs mb-1">Property</p>
                  <p className="font-semibold text-slate-700">{selected.propertyName || "—"}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-slate-500 text-xs mb-1">Status</p>
                  <Badge className={`${statusColor(selected.status)} capitalize text-xs`}>{selected.status}</Badge>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-slate-500 text-xs mb-1">Initiated By</p>
                  <p className="font-semibold text-slate-700 capitalize">{selected.initiatedBy}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-slate-500 text-xs mb-1">Reason for Cancellation</p>
                <p className="text-slate-700">{selected.reason}</p>
              </div>

              {selected.proofImageUrl && (
                <div>
                  <p className="text-slate-500 text-xs mb-2">Proof / Supporting Document</p>
                  <a href={selected.proofImageUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">View Document</a>
                </div>
              )}

              {(() => {
                const bd = selected.refundBreakdown as any;
                const ps = selected.policySnapshot as any;
                if (!bd) return null;
                return (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Refund Breakdown</p>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Paid</span>
                        <span className="font-medium">{fmtCurr(bd.totalPaid)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Forfeited</span>
                        <span className="font-medium text-rose-600">{fmtCurr(bd.forfeited)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-100 pt-2">
                        <span className="font-semibold text-slate-600">Refundable</span>
                        <span className="font-bold text-emerald-600">{fmtCurr(selected.overrideRefundAmount ?? bd.refundable)}</span>
                      </div>
                      {ps?.label && <p className="text-xs text-slate-400 mt-1">Policy: {ps.label}</p>}
                    </div>
                  </div>
                );
              })()}

              {selected.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-xs font-semibold mb-1">Rejection Reason</p>
                  <p className="text-red-600 text-sm">{selected.rejectionReason}</p>
                </div>
              )}

              {selected.processedAt && (
                <p className="text-xs text-slate-400">Processed: {formatDate(selected.processedAt)}</p>
              )}
            </div>

            {selected.status === "pending" && (
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setSelected(null); }}
                  data-testid="button-close-detail"
                >
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { setRejectReason(""); setRejectDialogOpen(true); }}
                  data-testid="button-open-reject"
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button
                  onClick={() => { setOverrideRefund(""); setApproveNote(""); setApproveDialogOpen(true); }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  data-testid="button-open-approve"
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                </Button>
              </DialogFooter>
            )}
            {selected.status !== "pending" && (
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle className="h-5 w-5" /> Approve Cancellation
            </DialogTitle>
            <DialogDescription>
              This will cancel the booking and notify the student. The refund amount below is from the policy engine.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const bd = selected?.refundBreakdown as any;
              return bd && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-emerald-700">Calculated Refund</span>
                    <span className="font-bold text-emerald-700">{fmtCurr(bd.refundable)}</span>
                  </div>
                  <p className="text-emerald-600 text-xs">{bd.policyLabel}</p>
                </div>
              );
            })()}
            <div className="space-y-1">
              <Label>Override Refund Amount (₹) — leave blank to use calculated amount</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 5000"
                value={overrideRefund}
                onChange={e => setOverrideRefund(e.target.value)}
                data-testid="input-override-refund"
              />
            </div>
            <div className="space-y-1">
              <Label>Internal Note (optional)</Label>
              <Textarea
                value={approveNote}
                onChange={e => setApproveNote(e.target.value)}
                placeholder="Any notes for the audit log…"
                rows={2}
                data-testid="textarea-approve-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleApprove}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              data-testid="button-confirm-approve"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-5 w-5" /> Reject Cancellation
            </DialogTitle>
            <DialogDescription>
              The booking will remain active. The student will be notified with your reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Rejection Reason *</Label>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Explain why this request is being rejected…"
              rows={3}
              data-testid="textarea-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !rejectReason.trim()}
              data-testid="button-confirm-reject"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
