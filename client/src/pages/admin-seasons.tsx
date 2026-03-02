import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calendar, Plus, Edit, Trash2, Play, Square, ChevronDown, ChevronUp,
  Loader2, AlertCircle, CheckCircle2, Users, FileText, RotateCcw,
  ClipboardList, Zap, Clock, ArrowRight, RefreshCw, Building
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";

interface Season {
  id: string;
  name: string;
  propertyId: string | null;
  startDate: string;
  endDate: string;
  graceDays: number;
  status: "UPCOMING" | "ACTIVE" | "ENDED";
  nextSeasonId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Property {
  id: string;
  name: string;
  propertyCode: string | null;
  hmsPropertyId: number | null;
  hmsPropertyName: string | null;
  hmsLinked: boolean;
}

interface ResidentStatus {
  id: string;
  bookingId: string;
  seasonId: string;
  status: "RETAINED" | "NOT_RETAINED" | "PENDING";
  graceUntil: string | null;
  decisionReason: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  bookingCode: string | null;
  walkInName: string | null;
  walkInPhone: string | null;
  propertyId: string | null;
  roomTypeId: string | null;
  bookingStatus: string | null;
  bedId: string | null;
  floorId: string | null;
  roomId: string | null;
  residentDetails: any;
  studentId: string | null;
  studentFullName: string | null;
  studentPhone: string | null;
  studentCollege: string | null;
  studentCourse: string | null;
  studentYear: string | null;
  studentAddress: string | null;
  studentCity: string | null;
  studentEmergencyName: string | null;
  studentEmergencyPhone: string | null;
  studentEmergencyRelation: string | null;
  propertyName: string | null;
}

interface CloseJob {
  id: string;
  seasonId: string;
  nextSeasonId: string | null;
  status: "PREVIEW" | "APPLIED" | "FAILED";
  generatedAt: string;
  appliedAt: string | null;
  appliedBy: string | null;
  syncStatus: string | null;
  syncRetries: number;
  errorMessage: string | null;
  items?: CloseJobItem[];
}

interface CloseJobItem {
  id: string;
  bookingId: string;
  residentName: string;
  roomInfo: string | null;
  finalStatus: "RETAINED" | "NOT_RETAINED" | "PENDING";
  graceUntil: string | null;
  note: string | null;
}

interface SeasonFormData {
  name: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  graceDays: number;
  nextSeasonId: string;
}

const emptyForm: SeasonFormData = {
  name: "", propertyId: "", startDate: "", endDate: "", graceDays: 30, nextSeasonId: "",
};

const statusColors: Record<string, string> = {
  UPCOMING: "bg-blue-100 text-blue-700 border-blue-200",
  ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ENDED: "bg-slate-100 text-slate-500 border-slate-200",
};

const residentStatusColors: Record<string, string> = {
  RETAINED: "bg-emerald-100 text-emerald-700",
  NOT_RETAINED: "bg-rose-100 text-rose-700",
  PENDING: "bg-amber-100 text-amber-700",
};

const jobStatusColors: Record<string, string> = {
  PREVIEW: "bg-blue-100 text-blue-700",
  APPLIED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-rose-100 text-rose-700",
};

export default function AdminSeasons() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SeasonFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);
  const [residents, setResidents] = useState<ResidentStatus[]>([]);
  const [residentsLoading, setResidentsLoading] = useState(false);
  const [selectedResidents, setSelectedResidents] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("RETAINED");
  const [closeJobs, setCloseJobs] = useState<CloseJob[]>([]);
  const [activeJob, setActiveJob] = useState<CloseJob | null>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [showEndFlow, setShowEndFlow] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchSeasons = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seasons", { headers });
      if (res.ok) setSeasons(await res.json());
    } catch {}
    setLoading(false);
  };

  const fetchProperties = async () => {
    try {
      const res = await fetch("/api/admin/properties", { headers });
      if (res.ok) {
        const data = await res.json();
        setProperties(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  useEffect(() => { fetchSeasons(); fetchProperties(); }, []);

  const fetchResidents = async (seasonId: string) => {
    setResidentsLoading(true);
    try {
      const res = await fetch(`/api/admin/seasons/${seasonId}/residents`, { headers });
      if (res.ok) {
        const data = await res.json();
        setResidents(Array.isArray(data) ? data : []);
      }
    } catch {}
    setResidentsLoading(false);
  };

  const fetchCloseJobs = async (seasonId: string) => {
    try {
      const res = await fetch(`/api/admin/seasons/${seasonId}/close-jobs`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCloseJobs(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  const toggleExpand = (seasonId: string) => {
    if (expandedSeason === seasonId) {
      setExpandedSeason(null);
      setResidents([]);
      setShowEndFlow(null);
      setActiveJob(null);
    } else {
      setExpandedSeason(seasonId);
      setSelectedResidents(new Set());
      fetchResidents(seasonId);
    }
  };

  const openCreate = () => { setForm({ ...emptyForm }); setEditId(null); setDialogOpen(true); };
  const openEdit = (s: Season) => {
    setForm({
      name: s.name,
      propertyId: s.propertyId || "",
      startDate: s.startDate ? new Date(s.startDate).toISOString().slice(0, 10) : "",
      endDate: s.endDate ? new Date(s.endDate).toISOString().slice(0, 10) : "",
      graceDays: s.graceDays,
      nextSeasonId: s.nextSeasonId || "",
    });
    setEditId(s.id);
    setDialogOpen(true);
  };

  const getPropertyName = (propertyId: string | null) => {
    if (!propertyId) return "All Properties";
    return properties.find(p => p.id === propertyId)?.name || "Unknown Property";
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!form.startDate || !form.endDate) { toast({ title: "Dates required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        propertyId: form.propertyId || null,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        graceDays: Number(form.graceDays) || 30,
        nextSeasonId: form.nextSeasonId || null,
        status: "UPCOMING",
      };
      const url = editId ? `/api/admin/seasons/${editId}` : "/api/admin/seasons";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to save"); }
      toast({ title: editId ? "Season updated" : "Season created" });
      setDialogOpen(false);
      fetchSeasons();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/seasons/${id}`, { method: "DELETE", headers });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to delete"); }
      toast({ title: "Season deleted" });
      fetchSeasons();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleActivate = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/seasons/${id}/activate`, { method: "POST", headers });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to activate"); }
      toast({ title: "Season activated" });
      fetchSeasons();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleEnd = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/seasons/${id}/end`, { method: "POST", headers });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to end season"); }
      toast({ title: "Season ended" });
      fetchSeasons();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleUpdateResident = async (residentId: string, status: string, reason?: string) => {
    try {
      const res = await fetch(`/api/admin/seasons/residents/${residentId}`, {
        method: "PUT", headers,
        body: JSON.stringify({ status, decisionReason: reason || null }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "Status updated" });
      if (expandedSeason) fetchResidents(expandedSeason);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedResidents.size === 0) return;
    if (!expandedSeason) return;
    try {
      const res = await fetch(`/api/admin/seasons/${expandedSeason}/bulk-update-residents`, {
        method: "POST", headers,
        body: JSON.stringify({ residentIds: Array.from(selectedResidents), status: bulkStatus }),
      });
      if (!res.ok) throw new Error("Failed to bulk update");
      toast({ title: `${selectedResidents.size} residents updated` });
      setSelectedResidents(new Set());
      fetchResidents(expandedSeason);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const parseJobResponse = (data: any): CloseJob => {
    const job = data.job || data;
    if (data.items) job.items = data.items;
    return job;
  };

  const handleGenerateCloseJob = async (seasonId: string) => {
    setJobLoading(true);
    try {
      const res = await fetch(`/api/admin/seasons/${seasonId}/generate-close-job`, { method: "POST", headers });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to generate"); }
      const data = await res.json();
      setActiveJob(parseJobResponse(data));
      toast({ title: "Close report generated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setJobLoading(false);
  };

  const handleApplyJob = async (jobId: string) => {
    setJobLoading(true);
    try {
      const res = await fetch(`/api/admin/seasons/close-jobs/${jobId}/apply`, { method: "POST", headers });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Failed to apply"); }
      const data = await res.json();
      setActiveJob(parseJobResponse(data));
      toast({ title: "Close job applied & synced" });
      fetchSeasons();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setJobLoading(false);
  };

  const handleRetrySync = async (jobId: string) => {
    setJobLoading(true);
    try {
      const res = await fetch(`/api/admin/seasons/close-jobs/${jobId}/retry-sync`, { method: "POST", headers });
      if (!res.ok) throw new Error("Failed to retry");
      const data = await res.json();
      setActiveJob(parseJobResponse(data));
      toast({ title: "Sync retried" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setJobLoading(false);
  };

  const fetchJobDetails = async (jobId: string) => {
    setJobLoading(true);
    try {
      const res = await fetch(`/api/admin/seasons/close-jobs/${jobId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setActiveJob(parseJobResponse(data));
      }
    } catch {}
    setJobLoading(false);
  };

  const openEndFlow = (seasonId: string) => {
    setShowEndFlow(seasonId);
    setActiveJob(null);
    fetchCloseJobs(seasonId);
  };

  const getResidentName = (r: ResidentStatus) => {
    if (r.studentFullName) return r.studentFullName;
    const details = r.residentDetails as any;
    if (details?.fullName) return details.fullName;
    if (details?.name) return details.name;
    if (r.walkInName) return r.walkInName;
    if (r.bookingCode) return r.bookingCode;
    return "Unknown";
  };

  const getResidentPhone = (r: ResidentStatus) => {
    if (r.studentPhone) return r.studentPhone;
    const details = r.residentDetails as any;
    if (details?.phone) return details.phone;
    if (r.walkInPhone) return r.walkInPhone;
    return null;
  };

  const getResidentCollege = (r: ResidentStatus) => {
    if (r.studentCollege) return r.studentCollege;
    const details = r.residentDetails as any;
    if (details?.institute) return details.institute;
    return null;
  };

  const getRoomInfo = (r: ResidentStatus) => {
    const details = r.residentDetails as any;
    const parts: string[] = [];
    if (r.propertyName) parts.push(r.propertyName);
    if (details?.roomNo) parts.push(`Room ${details.roomNo}`);
    if (details?.bedNo) parts.push(`Bed ${details.bedNo}`);
    else if (r.bedId) parts.push(`Bed allocated`);
    return parts.join(" • ") || "N/A";
  };

  const groupedItems = (items: CloseJobItem[]) => {
    const groups: Record<string, CloseJobItem[]> = { RETAINED: [], NOT_RETAINED: [], PENDING: [] };
    items.forEach(item => {
      if (groups[item.finalStatus]) groups[item.finalStatus].push(item);
      else {
        if (!groups["UNMAPPED"]) groups["UNMAPPED"] = [];
        groups["UNMAPPED"].push(item);
      }
    });
    return groups;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getSeasonName = (id: string | null) => {
    if (!id) return "None";
    return seasons.find(s => s.id === id)?.name || id;
  };

  return (
    <div className="space-y-6 p-1" data-testid="admin-seasons-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2" data-testid="text-page-title">
            <Calendar className="h-6 w-6 text-indigo-600" /> Seasons
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage academic seasons, resident retention, and end-of-season workflows</p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700" data-testid="button-create-season">
          <Plus className="h-4 w-4 mr-2" /> Create Season
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20" data-testid="loading-seasons">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : seasons.length === 0 ? (
        <div className="text-center py-16 text-slate-400" data-testid="empty-seasons">
          <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No seasons created yet</p>
          <p className="text-sm mt-1">Create your first season to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {seasons.map(season => (
            <Card key={season.id} className="overflow-hidden" data-testid={`card-season-${season.id}`}>
              <CardContent className="p-0">
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-xl ${season.status === "ACTIVE" ? "bg-emerald-50" : season.status === "UPCOMING" ? "bg-blue-50" : "bg-slate-50"}`}>
                      <Calendar className={`h-6 w-6 ${season.status === "ACTIVE" ? "text-emerald-600" : season.status === "UPCOMING" ? "text-blue-600" : "text-slate-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-bold text-lg text-slate-900" data-testid={`text-season-name-${season.id}`}>{season.name}</h3>
                        <Badge className={`${statusColors[season.status]} border`} data-testid={`badge-season-status-${season.id}`}>
                          {season.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1 font-medium text-slate-600" data-testid={`text-season-property-${season.id}`}>
                          <Building className="h-3.5 w-3.5" /> {getPropertyName(season.propertyId)}
                        </span>
                        <span data-testid={`text-season-dates-${season.id}`}>
                          {formatDate(season.startDate)} — {formatDate(season.endDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {season.graceDays} grace days
                        </span>
                        {season.nextSeasonId && (
                          <span className="flex items-center gap-1">
                            <ArrowRight className="h-3.5 w-3.5" /> Next: {getSeasonName(season.nextSeasonId)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {season.status === "UPCOMING" && (
                      <>
                        <Button
                          size="sm" variant="outline"
                          onClick={() => handleActivate(season.id)}
                          disabled={actionLoading === season.id}
                          data-testid={`button-activate-${season.id}`}
                        >
                          {actionLoading === season.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                          Activate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(season)} data-testid={`button-edit-${season.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="text-rose-500 hover:text-rose-700"
                          onClick={() => handleDelete(season.id)}
                          disabled={actionLoading === season.id}
                          data-testid={`button-delete-${season.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {season.status === "ACTIVE" && (
                      <>
                        <Button size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleEnd(season.id)} disabled={actionLoading === season.id} data-testid={`button-end-${season.id}`}>
                          {actionLoading === season.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Square className="h-4 w-4 mr-1" />}
                          End Season
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(season)} data-testid={`button-edit-${season.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => toggleExpand(season.id)} data-testid={`button-expand-${season.id}`}>
                      {expandedSeason === season.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {expandedSeason === season.id && (
                  <div className="border-t bg-slate-50/50">
                    <div className="p-5 space-y-6">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Button size="sm" variant={showEndFlow !== season.id ? "default" : "outline"} onClick={() => { setShowEndFlow(null); fetchResidents(season.id); }} data-testid={`tab-residents-${season.id}`}>
                          <Users className="h-4 w-4 mr-1" /> Residents
                        </Button>
                        <Button size="sm" variant={showEndFlow === season.id ? "default" : "outline"} onClick={() => openEndFlow(season.id)} data-testid={`tab-end-flow-${season.id}`}>
                          <FileText className="h-4 w-4 mr-1" /> End Season Flow
                        </Button>
                      </div>

                      {showEndFlow !== season.id ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Users className="h-4 w-4" /> Resident Status
                              </h4>
                              <Button size="sm" variant="outline" data-testid={`button-sync-residents-${season.id}`}
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/admin/seasons/${season.id}/sync-residents`, { method: "POST", headers });
                                    if (!res.ok) throw new Error("Failed");
                                    const data = await res.json();
                                    toast({ title: `Synced residents`, description: `${data.added} new residents linked, ${data.total} total` });
                                    fetchResidents(season.id);
                                  } catch (e: any) {
                                    toast({ title: "Error", description: e.message, variant: "destructive" });
                                  }
                                }}
                              >
                                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync Residents
                              </Button>
                            </div>
                            {selectedResidents.size > 0 && (
                              <div className="flex items-center gap-2" data-testid="bulk-actions">
                                <span className="text-sm text-slate-500">{selectedResidents.size} selected</span>
                                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                                  <SelectTrigger className="w-36 h-8" data-testid="select-bulk-status">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="RETAINED">Retained</SelectItem>
                                    <SelectItem value="NOT_RETAINED">Not Retained</SelectItem>
                                    <SelectItem value="PENDING">Pending</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button size="sm" onClick={handleBulkUpdate} data-testid="button-bulk-update">
                                  <Zap className="h-3.5 w-3.5 mr-1" /> Apply
                                </Button>
                              </div>
                            )}
                          </div>

                          {residentsLoading ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                            </div>
                          ) : residents.length === 0 ? (
                            <div className="text-center py-8 text-slate-400">
                              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                              <p className="text-sm">No residents found for this season</p>
                            </div>
                          ) : (
                            <div className="border rounded-lg overflow-hidden bg-white">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-10">
                                      <Checkbox
                                        checked={selectedResidents.size === residents.length && residents.length > 0}
                                        onCheckedChange={(checked) => {
                                          if (checked) setSelectedResidents(new Set(residents.map(r => r.id)));
                                          else setSelectedResidents(new Set());
                                        }}
                                        data-testid="checkbox-select-all"
                                      />
                                    </TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Room Info</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Grace Until</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {residents.map(r => (
                                    <TableRow key={r.id} data-testid={`row-resident-${r.id}`}>
                                      <TableCell>
                                        <Checkbox
                                          checked={selectedResidents.has(r.id)}
                                          onCheckedChange={(checked) => {
                                            const next = new Set(selectedResidents);
                                            if (checked) next.add(r.id); else next.delete(r.id);
                                            setSelectedResidents(next);
                                          }}
                                          data-testid={`checkbox-resident-${r.id}`}
                                        />
                                      </TableCell>
                                      <TableCell data-testid={`text-resident-name-${r.id}`}>
                                        <div className="font-medium">{getResidentName(r)}</div>
                                        {getResidentPhone(r) && <div className="text-xs text-slate-400">{getResidentPhone(r)}</div>}
                                        {getResidentCollege(r) && <div className="text-xs text-slate-400">{getResidentCollege(r)}</div>}
                                      </TableCell>
                                      <TableCell className="text-sm text-slate-500" data-testid={`text-room-info-${r.id}`}>
                                        <div>{getRoomInfo(r)}</div>
                                        {r.bookingCode && <div className="text-xs text-slate-400">{r.bookingCode}</div>}
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={r.status}
                                          onValueChange={(val) => handleUpdateResident(r.id, val, r.decisionReason || undefined)}
                                        >
                                          <SelectTrigger className="w-32 h-8" data-testid={`select-status-${r.id}`}>
                                            <Badge className={`${residentStatusColors[r.status]} text-xs border-0`}>
                                              {r.status.replace("_", " ")}
                                            </Badge>
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="RETAINED">Retained</SelectItem>
                                            <SelectItem value="NOT_RETAINED">Not Retained</SelectItem>
                                            <SelectItem value="PENDING">Pending</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell className="text-sm" data-testid={`text-grace-${r.id}`}>
                                        {r.graceUntil ? formatDate(r.graceUntil) : "—"}
                                      </TableCell>
                                      <TableCell className="text-sm text-slate-500" data-testid={`text-reason-${r.id}`}>
                                        {r.decisionReason || "—"}
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          size="sm" variant="ghost"
                                          onClick={() => {
                                            const reason = prompt("Enter reason/note:", r.decisionReason || "");
                                            if (reason !== null) handleUpdateResident(r.id, r.status, reason);
                                          }}
                                          data-testid={`button-edit-reason-${r.id}`}
                                        >
                                          <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                              <ClipboardList className="h-4 w-4" /> End Season Flow
                            </h4>
                            <Button
                              size="sm"
                              onClick={() => handleGenerateCloseJob(season.id)}
                              disabled={jobLoading}
                              className="bg-indigo-600 hover:bg-indigo-700"
                              data-testid={`button-generate-close-report-${season.id}`}
                            >
                              {jobLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                              Generate Close Report
                            </Button>
                          </div>

                          {activeJob && (
                            <Card className="border-indigo-200 bg-indigo-50/30" data-testid={`card-job-${activeJob.id}`}>
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    Close Report
                                    <Badge className={`${jobStatusColors[activeJob.status]} text-xs border-0`} data-testid={`badge-job-status-${activeJob.id}`}>
                                      {activeJob.status}
                                    </Badge>
                                    {activeJob.syncStatus && (
                                      <Badge variant="outline" className="text-xs" data-testid={`badge-sync-status-${activeJob.id}`}>
                                        Sync: {activeJob.syncStatus}
                                      </Badge>
                                    )}
                                  </CardTitle>
                                  <div className="flex gap-2">
                                    {activeJob.status === "PREVIEW" && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleApplyJob(activeJob.id)}
                                        disabled={jobLoading}
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                        data-testid={`button-apply-job-${activeJob.id}`}
                                      >
                                        {jobLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                        Apply & Sync
                                      </Button>
                                    )}
                                    {(activeJob.status === "FAILED" || activeJob.syncStatus === "failed") && (
                                      <Button
                                        size="sm" variant="outline"
                                        onClick={() => handleRetrySync(activeJob.id)}
                                        disabled={jobLoading}
                                        data-testid={`button-retry-sync-${activeJob.id}`}
                                      >
                                        {jobLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                                        Retry Sync ({activeJob.syncRetries})
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Generated: {formatDate(activeJob.generatedAt)}
                                  {activeJob.appliedAt && <> • Applied: {formatDate(activeJob.appliedAt)}</>}
                                </div>
                                {activeJob.errorMessage && (
                                  <div className="mt-2 p-2 bg-rose-50 text-rose-700 text-xs rounded-lg flex items-start gap-2" data-testid="text-error-message">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    {activeJob.errorMessage}
                                  </div>
                                )}
                              </CardHeader>
                              <CardContent>
                                {activeJob.items && activeJob.items.length > 0 ? (
                                  <div className="space-y-4">
                                    {Object.entries(groupedItems(activeJob.items)).map(([status, items]) => {
                                      if (items.length === 0) return null;
                                      return (
                                        <div key={status} data-testid={`group-${status.toLowerCase()}`}>
                                          <div className="flex items-center gap-2 mb-2">
                                            <Badge className={`${residentStatusColors[status] || "bg-slate-100 text-slate-600"} text-xs border-0`}>
                                              {status.replace("_", " ")}
                                            </Badge>
                                            <span className="text-xs text-slate-500">{items.length} resident{items.length > 1 ? "s" : ""}</span>
                                          </div>
                                          <div className="border rounded-lg overflow-hidden bg-white">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead>Resident</TableHead>
                                                  <TableHead>Room</TableHead>
                                                  <TableHead>Grace Until</TableHead>
                                                  <TableHead>Note</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {items.map(item => (
                                                  <TableRow key={item.id} data-testid={`row-job-item-${item.id}`}>
                                                    <TableCell className="font-medium" data-testid={`text-item-name-${item.id}`}>{item.residentName}</TableCell>
                                                    <TableCell className="text-sm text-slate-500">{item.roomInfo || "—"}</TableCell>
                                                    <TableCell className="text-sm">{item.graceUntil ? formatDate(item.graceUntil) : "—"}</TableCell>
                                                    <TableCell className="text-sm text-slate-500">{item.note || "—"}</TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-center text-sm text-slate-400 py-4">No items in this report</p>
                                )}
                              </CardContent>
                            </Card>
                          )}

                          {closeJobs.length > 0 && (
                            <div>
                              <h5 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Job History
                              </h5>
                              <div className="space-y-2">
                                {closeJobs.map(job => (
                                  <div
                                    key={job.id}
                                    className="flex items-center justify-between p-3 bg-white border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                                    onClick={() => fetchJobDetails(job.id)}
                                    data-testid={`job-history-${job.id}`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <Badge className={`${jobStatusColors[job.status]} text-xs border-0`}>{job.status}</Badge>
                                      <span className="text-sm text-slate-600">Generated {formatDate(job.generatedAt)}</span>
                                      {job.syncStatus && (
                                        <Badge variant="outline" className="text-xs">
                                          Sync: {job.syncStatus} {job.syncRetries > 0 && `(${job.syncRetries} retries)`}
                                        </Badge>
                                      )}
                                    </div>
                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-season-form">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              {editId ? "Edit Season" : "Create Season"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Season Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 2025-2026"
                data-testid="input-season-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Property *</Label>
              <Select value={form.propertyId || "all"} onValueChange={v => setForm(f => ({ ...f, propertyId: v === "all" ? "" : v }))}>
                <SelectTrigger data-testid="select-property">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties (Global)</SelectItem>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.hmsLinked ? "✓ HMS" : ""} {p.propertyCode ? `(${p.propertyCode})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  data-testid="input-end-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Grace Days</Label>
              <Input
                type="number"
                value={form.graceDays}
                onChange={e => setForm(f => ({ ...f, graceDays: Number(e.target.value) }))}
                data-testid="input-grace-days"
              />
            </div>
            <div className="space-y-2">
              <Label>Next Season (optional)</Label>
              <Select value={form.nextSeasonId} onValueChange={v => setForm(f => ({ ...f, nextSeasonId: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="select-next-season">
                  <SelectValue placeholder="Select next season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {seasons.filter(s => s.id !== editId).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-season">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700" data-testid="button-save-season">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}