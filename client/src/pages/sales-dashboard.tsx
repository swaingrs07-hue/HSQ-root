import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Target, Phone, PhoneCall, Calendar, Clock, TrendingUp, XCircle, AlertTriangle, Plus, Eye, MessageSquare, Building2, CalendarPlus, Download, Mail } from "lucide-react";
import { buildGoogleCalendarUrl, downloadICS } from "@/lib/calendar-utils";
import { useAuth } from "@/contexts/auth-context";
import { useProperty } from "@/contexts/property-context";
import { format, parseISO, isAfter, isBefore, addDays } from "date-fns";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  alternatePhone?: string;
  propertyId: string | null;
  propertyName: string | null;
  status: string;
  priority: string;
  leadScore: number;
  source: string;
  budgetMin?: number;
  budgetMax?: number;
  followUpAt: string | null;
  followUpNotes: string | null;
  isLocked: boolean;
  createdAt: string;
  createdByName?: string | null;
  assignedToName?: string | null;
  convertedByName?: string | null;
  linkedBooking?: { status: string; confirmedByName: string | null; confirmedAt: string | null } | null;
}

interface Property {
  id: string;
  name: string;
}

export default function SalesDashboard() {
  const { toast } = useToast();
  const { user, token } = useAuth();
  const { selectedPropertyId } = useProperty();
  const [activeTab, setActiveTab] = useState("all");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    hot: 0,
    warm: 0,
    cold: 0,
    closed: 0,
    lost: 0,
    upcomingFollowUps: 0,
    overdueFollowUps: 0
  });

  const [createLeadDialogOpen, setCreateLeadDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadDetailDialogOpen, setLeadDetailDialogOpen] = useState(false);
  const [updateStatusDialogOpen, setUpdateStatusDialogOpen] = useState(false);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [remarkDialogOpen, setRemarkDialogOpen] = useState(false);
  const [leadDetail, setLeadDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [newLeadForm, setNewLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    alternatePhone: "",
    propertyId: "",
    entrySource: "walk_in" as string,
    budgetMin: "",
    budgetMax: "",
    notes: ""
  });

  const [statusForm, setStatusForm] = useState({
    status: "",
    lostReason: "",
    lostNotes: ""
  });

  const [followUpForm, setFollowUpForm] = useState({
    followUpAt: "",
    notes: ""
  });

  const [remarkText, setRemarkText] = useState("");

  const getAuthToken = () => token || "";

  useEffect(() => {
    loadLeads();
    loadProperties();
  }, [selectedPropertyId]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      let url = "/api/sales/leads";
      if (selectedPropertyId) {
        url = `${url}?propertyId=${selectedPropertyId}`;
      }
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) throw new Error("Failed to fetch leads");
      const data = await response.json();
      setLeads(data);
      calculateStats(data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load leads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadProperties = async () => {
    try {
      const response = await fetch("/api/sales/properties", {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) throw new Error("Failed to fetch properties");
      const data = await response.json();
      setProperties(data);
    } catch (error) {
      console.error("Failed to load properties:", error);
    }
  };

  const calculateStats = (leadsList: Lead[]) => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);

    setStats({
      total: leadsList.length,
      hot: leadsList.filter(l => l.priority === "hot").length,
      warm: leadsList.filter(l => l.priority === "warm").length,
      cold: leadsList.filter(l => l.priority === "cold").length,
      closed: leadsList.filter(l => l.status === "closed" || l.status === "deal_closed").length,
      lost: leadsList.filter(l => l.status === "lost").length,
      upcomingFollowUps: leadsList.filter(l => 
        l.followUpAt && isAfter(parseISO(l.followUpAt), now) && isBefore(parseISO(l.followUpAt), weekFromNow)
      ).length,
      overdueFollowUps: leadsList.filter(l => 
        l.followUpAt && isBefore(parseISO(l.followUpAt), now) && l.status !== "closed" && l.status !== "deal_closed" && l.status !== "lost"
      ).length
    });
  };

  const createLead = async () => {
    try {
      const response = await fetch("/api/sales/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          name: newLeadForm.name,
          phone: newLeadForm.phone,
          email: newLeadForm.email || undefined,
          propertyId: newLeadForm.propertyId || undefined,
          entrySource: newLeadForm.entrySource,
          budgetMin: newLeadForm.budgetMin ? parseInt(newLeadForm.budgetMin) : undefined,
          budgetMax: newLeadForm.budgetMax ? parseInt(newLeadForm.budgetMax) : undefined,
          notes: newLeadForm.notes || undefined
        })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create lead");
      }
      toast({ title: "Success", description: "Lead created successfully" });
      setCreateLeadDialogOpen(false);
      setNewLeadForm({
        name: "",
        email: "",
        phone: "",
        alternatePhone: "",
        propertyId: "",
        entrySource: "walk_in",
        budgetMin: "",
        budgetMax: "",
        notes: ""
      });
      loadLeads();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const loadLeadDetail = async (leadId: string) => {
    setLeadDetail(null);
    setLoadingDetail(true);
    setLeadDetailDialogOpen(true);
    try {
      const response = await fetch(`/api/sales/leads/${leadId}/details`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) throw new Error("Failed to fetch lead details");
      const data = await response.json();
      setLeadDetail(data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load lead details", variant: "destructive" });
      setLeadDetailDialogOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const updateLeadStatus = async () => {
    if (!selectedLead) return;
    try {
      const response = await fetch(`/api/sales/leads/${selectedLead.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(statusForm)
      });
      if (!response.ok) throw new Error("Failed to update status");
      toast({ title: "Success", description: "Lead status updated" });
      setUpdateStatusDialogOpen(false);
      loadLeads();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const setFollowUp = async () => {
    if (!selectedLead) return;
    try {
      const response = await fetch(`/api/sales/leads/${selectedLead.id}/follow-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(followUpForm)
      });
      if (!response.ok) throw new Error("Failed to set follow-up");
      toast({ title: "Success", description: "Follow-up scheduled" });
      setFollowUpDialogOpen(false);
      loadLeads();
    } catch (error) {
      toast({ title: "Error", description: "Failed to set follow-up", variant: "destructive" });
    }
  };

  const addRemark = async () => {
    if (!selectedLead || !remarkText.trim()) return;
    try {
      const response = await fetch(`/api/sales/leads/${selectedLead.id}/remarks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ remark: remarkText })
      });
      if (!response.ok) throw new Error("Failed to add remark");
      toast({ title: "Success", description: "Remark added" });
      setRemarkDialogOpen(false);
      setRemarkText("");
    } catch (error) {
      toast({ title: "Error", description: "Failed to add remark", variant: "destructive" });
    }
  };

  const getFilteredLeads = () => {
    const now = new Date();
    const weekFromNow = addDays(now, 7);

    switch (activeTab) {
      case "hot": return leads.filter(l => l.priority === "hot");
      case "warm": return leads.filter(l => l.priority === "warm");
      case "cold": return leads.filter(l => l.priority === "cold");
      case "upcoming": return leads.filter(l => 
        l.followUpAt && isAfter(parseISO(l.followUpAt), now) && isBefore(parseISO(l.followUpAt), weekFromNow)
      );
      case "overdue": return leads.filter(l => 
        l.followUpAt && isBefore(parseISO(l.followUpAt), now) && l.status !== "closed" && l.status !== "deal_closed" && l.status !== "lost"
      );
      default: return leads;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "hot": return <Badge className="bg-red-500 text-white">Hot</Badge>;
      case "warm": return <Badge className="bg-orange-500 text-white">Warm</Badge>;
      default: return <Badge className="bg-blue-500 text-white">Cold</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      new: { color: "bg-blue-100 text-blue-800", label: "New" },
      contacted: { color: "bg-purple-100 text-purple-800", label: "Contacted" },
      site_visit_scheduled: { color: "bg-yellow-100 text-yellow-800", label: "Visit Scheduled" },
      site_visit_completed: { color: "bg-green-100 text-green-800", label: "Visit Done" },
      booking_initiated: { color: "bg-indigo-100 text-indigo-800", label: "Booking Started" },
      deal_closed: { color: "bg-green-500 text-white", label: "Closed" },
      lost: { color: "bg-red-100 text-red-800", label: "Lost" }
    };
    const s = statusMap[status] || { color: "bg-gray-100 text-gray-800", label: status };
    return <Badge className={s.color}>{s.label}</Badge>;
  };

  const getSourceLabel = (source: string) => {
    const sources: Record<string, string> = {
      walk_in: "Walk-in",
      phone_call: "Phone Call",
      whatsapp: "WhatsApp",
      website: "Website",
      referral: "Referral",
      social_media: "Social Media",
      other: "Other"
    };
    return sources[source] || source;
  };

  return (
    <div className="container mx-auto py-4 md:py-8 px-3 md:px-4 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 md:mb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-bold">Sales Dashboard</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Welcome back, {user?.name || "Sales Executive"}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => window.location.href = "/booking/generate"}
            className="bg-orange-500 hover:bg-orange-600 text-xs sm:text-sm h-8 md:h-9"
            size="sm"
            data-testid="button-generate-booking"
          >
            <Plus className="mr-1 sm:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Generate</span> Booking
          </Button>
          <Dialog open={createLeadDialogOpen} onOpenChange={setCreateLeadDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-lead" size="sm" className="text-xs sm:text-sm h-8 md:h-9">
                <Plus className="mr-1 sm:mr-2 h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Add New</span> Lead
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Lead</DialogTitle>
              <DialogDescription>Enter lead details for manual entry</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="leadName">Student Name *</Label>
                  <Input
                    id="leadName"
                    data-testid="input-lead-name"
                    value={newLeadForm.name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="input-lead-email"
                    value={newLeadForm.email}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    data-testid="input-lead-phone"
                    value={newLeadForm.phone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alternatePhone">Alternate Phone</Label>
                  <Input
                    id="alternatePhone"
                    data-testid="input-lead-alt-phone"
                    value={newLeadForm.alternatePhone}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, alternatePhone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="source">Source</Label>
                  <Select value={newLeadForm.entrySource} onValueChange={(v) => setNewLeadForm({ ...newLeadForm, entrySource: v })}>
                    <SelectTrigger data-testid="select-lead-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk_in">Walk-in</SelectItem>
                      <SelectItem value="phone_call">Phone Call</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="property">Property</Label>
                  <Select value={newLeadForm.propertyId} onValueChange={(v) => setNewLeadForm({ ...newLeadForm, propertyId: v })}>
                    <SelectTrigger data-testid="select-lead-property">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((prop) => (
                        <SelectItem key={prop.id} value={prop.id}>{prop.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="budgetMin">Budget Min (₹)</Label>
                  <Input
                    id="budgetMin"
                    type="number"
                    data-testid="input-lead-budget-min"
                    value={newLeadForm.budgetMin}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, budgetMin: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="budgetMax">Budget Max (₹)</Label>
                  <Input
                    id="budgetMax"
                    type="number"
                    data-testid="input-lead-budget-max"
                    value={newLeadForm.budgetMax}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, budgetMax: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  data-testid="input-lead-notes"
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateLeadDialogOpen(false)} data-testid="button-cancel-create-lead">Cancel</Button>
              <Button onClick={createLead} data-testid="button-submit-create-lead">Create Lead</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-3 mb-5 md:mb-8">
        {[
          { key: "all", label: "Total", value: stats.total, color: "", hoverBorder: "hover:border-primary" },
          { key: "hot", label: "Hot", value: stats.hot, color: "text-red-500", hoverBorder: "hover:border-red-500" },
          { key: "warm", label: "Warm", value: stats.warm, color: "text-orange-500", hoverBorder: "hover:border-orange-500" },
          { key: "cold", label: "Cold", value: stats.cold, color: "text-blue-500", hoverBorder: "hover:border-blue-500" },
          { key: "closed", label: "Closed", value: stats.closed, color: "text-green-500", hoverBorder: "" },
          { key: "lost", label: "Lost", value: stats.lost, color: "text-red-400", hoverBorder: "" },
          { key: "upcoming", label: "Upcoming", value: stats.upcomingFollowUps, color: "text-yellow-600", hoverBorder: "hover:border-yellow-500" },
          { key: "overdue", label: "Overdue", value: stats.overdueFollowUps, color: "text-red-700", hoverBorder: "hover:border-red-700" },
        ].map((stat) => (
          <Card
            key={stat.key}
            className={`cursor-pointer transition-all ${stat.hoverBorder} ${activeTab === stat.key ? "border-primary ring-1 ring-primary/30 shadow-sm" : ""}`}
            onClick={() => stat.hoverBorder && setActiveTab(stat.key)}
            data-testid={`card-stat-${stat.key}`}
          >
            <div className="px-2.5 py-2 md:px-4 md:py-3">
              <p className={`text-[10px] md:text-sm font-medium ${stat.color} leading-tight`}>{stat.label}</p>
              <p className={`text-lg md:text-2xl font-bold ${stat.color} mt-0.5`} data-testid={`text-stats-${stat.key === "all" ? "total" : stat.key}`}>{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 md:pb-4 px-3.5 md:px-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Target className="h-4 w-4 md:h-5 md:w-5" />
            {activeTab === "all" ? "All Leads" : 
             activeTab === "hot" ? "Hot Leads" :
             activeTab === "warm" ? "Warm Leads" :
             activeTab === "cold" ? "Cold Leads" :
             activeTab === "upcoming" ? "Upcoming Follow-ups" :
             "Overdue Follow-ups"}
            <Badge variant="secondary" className="ml-auto text-xs">{getFilteredLeads().length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 md:px-6 pt-0">
          {loading ? (
            <p className="text-center py-8">Loading...</p>
          ) : getFilteredLeads().length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No leads found</p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Follow-up</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredLeads().map((lead) => (
                      <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                        <TableCell>
                          <div className="font-medium">{lead.name}</div>
                          {lead.createdByName && (
                            <p className="text-[10px] text-indigo-400 font-medium" data-testid={`text-lead-by-${lead.id}`}>
                              Lead by {lead.createdByName}
                            </p>
                          )}
                          {lead.convertedByName && (
                            <p className="text-[10px] text-green-400 font-medium" data-testid={`text-converted-by-${lead.id}`}>
                              Booking by {lead.convertedByName}
                            </p>
                          )}
                          {lead.linkedBooking?.confirmedByName && (
                            <p className="text-[10px] text-emerald-400 font-medium" data-testid={`text-confirmed-by-${lead.id}`}>
                              Confirmed by {lead.linkedBooking.confirmedByName}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{lead.phone}</div>
                          <div className="text-xs text-muted-foreground">{lead.email}</div>
                        </TableCell>
                        <TableCell>{lead.propertyName || "-"}</TableCell>
                        <TableCell>{getSourceLabel(lead.source)}</TableCell>
                        <TableCell>{getPriorityBadge(lead.priority)}</TableCell>
                        <TableCell>{lead.leadScore}</TableCell>
                        <TableCell>{getStatusBadge(lead.status)}</TableCell>
                        <TableCell>
                          {lead.followUpAt ? (
                            <div className={`text-sm ${isBefore(parseISO(lead.followUpAt), new Date()) ? "text-red-500" : ""}`}>
                              {format(parseISO(lead.followUpAt), "MMM d, h:mm a")}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedLead(lead); loadLeadDetail(lead.id); }} title="View Details" data-testid={`button-view-lead-${lead.id}`}><Eye className="h-4 w-4" /></Button>
                            {!lead.isLocked && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => { setSelectedLead(lead); setStatusForm({ status: lead.status, lostReason: "", lostNotes: "" }); setUpdateStatusDialogOpen(true); }} title="Update Status" data-testid={`button-status-lead-${lead.id}`}><TrendingUp className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setSelectedLead(lead); setFollowUpForm({ followUpAt: "", notes: "" }); setFollowUpDialogOpen(true); }} title="Schedule Follow-up" data-testid={`button-followup-lead-${lead.id}`}><Calendar className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => { setSelectedLead(lead); setRemarkDialogOpen(true); }} title="Add Remark" data-testid={`button-remark-lead-${lead.id}`}><MessageSquare className="h-4 w-4" /></Button>
                              </>
                            )}
                            {lead.isLocked && <Badge variant="outline" className="text-xs">Locked</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-2.5">
                {getFilteredLeads().map((lead) => (
                  <div
                    key={lead.id}
                    className="border rounded-xl p-3.5 space-y-2.5 bg-card shadow-sm active:bg-accent/50 transition-colors"
                    data-testid={`card-lead-${lead.id}`}
                    onClick={() => { setSelectedLead(lead); loadLeadDetail(lead.id); }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-[15px] truncate">{lead.name}</p>
                          {lead.isLocked && <Badge variant="outline" className="text-[9px] px-1.5 py-0">Locked</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground truncate">{lead.phone}</span>
                          {lead.email && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground truncate">{lead.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end flex-shrink-0">
                        {getPriorityBadge(lead.priority)}
                        {getStatusBadge(lead.status)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-xs font-medium bg-green-50 dark:bg-green-950 text-green-600 rounded-lg px-2.5 py-1.5" data-testid={`button-call-${lead.id}`}>
                        <PhoneCall className="h-3.5 w-3.5" /> Call
                      </a>
                      <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '').replace(/^0+/, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg px-2.5 py-1.5" data-testid={`button-whatsapp-${lead.id}`}>
                        <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                      {lead.email && lead.email !== "noemail@gmail.com" && (
                        <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-lg px-2.5 py-1.5" data-testid={`button-email-${lead.id}`}>
                          <Mail className="h-3.5 w-3.5" /> Email
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {lead.propertyName && (
                        <span className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md px-2 py-0.5">
                          <Building2 className="h-3 w-3" />
                          {lead.propertyName}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{getSourceLabel(lead.source)}</span>
                      {lead.leadScore > 0 && (
                        <span className="text-xs font-medium text-amber-600">Score: {lead.leadScore}</span>
                      )}
                    </div>

                    {(lead.createdByName || lead.convertedByName || lead.linkedBooking?.confirmedByName) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {lead.createdByName && (
                          <span className="text-[10px] text-indigo-500 font-medium">Lead by {lead.createdByName}</span>
                        )}
                        {lead.convertedByName && (
                          <span className="text-[10px] text-green-500 font-medium">Booking by {lead.convertedByName}</span>
                        )}
                        {lead.linkedBooking?.confirmedByName && (
                          <span className="text-[10px] text-emerald-500 font-medium">Confirmed by {lead.linkedBooking.confirmedByName}</span>
                        )}
                      </div>
                    )}

                    {lead.followUpAt && (
                      <div className={`text-xs flex items-center gap-1.5 px-2 py-1 rounded-md ${isBefore(parseISO(lead.followUpAt), new Date()) ? "bg-red-50 dark:bg-red-950 text-red-600" : "bg-slate-50 dark:bg-slate-800 text-muted-foreground"}`}>
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span>{format(parseISO(lead.followUpAt), "MMM d, h:mm a")}</span>
                        {isBefore(parseISO(lead.followUpAt), new Date()) && <span className="font-semibold ml-auto">Overdue</span>}
                      </div>
                    )}

                    {!lead.isLocked && (
                      <div className="flex gap-1 pt-1.5 border-t" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs flex-1 rounded-lg" onClick={() => { setSelectedLead(lead); setStatusForm({ status: lead.status, lostReason: "", lostNotes: "" }); setUpdateStatusDialogOpen(true); }} data-testid={`button-status-lead-m-${lead.id}`}>
                          <TrendingUp className="h-3.5 w-3.5 mr-1" /> Status
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs flex-1 rounded-lg" onClick={() => { setSelectedLead(lead); setFollowUpForm({ followUpAt: "", notes: "" }); setFollowUpDialogOpen(true); }} data-testid={`button-followup-lead-m-${lead.id}`}>
                          <Calendar className="h-3.5 w-3.5 mr-1" /> Follow-up
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-xs flex-1 rounded-lg" onClick={() => { setSelectedLead(lead); setRemarkDialogOpen(true); }} data-testid={`button-remark-lead-m-${lead.id}`}>
                          <MessageSquare className="h-3.5 w-3.5 mr-1" /> Remark
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={leadDetailDialogOpen} onOpenChange={setLeadDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details: {selectedLead?.name}</DialogTitle>
          </DialogHeader>
          {loadingDetail && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          {leadDetail && !loadingDetail && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p>{leadDetail.lead.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p>{leadDetail.lead.phone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Property</Label>
                  <p>{leadDetail.property?.name || "Not selected"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Budget Range</Label>
                  <p>
                    {leadDetail.lead.budgetMin || leadDetail.lead.budgetMax
                      ? `₹${leadDetail.lead.budgetMin?.toLocaleString() || "0"} - ₹${leadDetail.lead.budgetMax?.toLocaleString() || "No limit"}`
                      : "Not specified"}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block">Activity Timeline</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {leadDetail.activities?.length > 0 ? (
                    leadDetail.activities.map((activity: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-2 bg-muted rounded">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                        <div className="flex-1">
                          <p className="text-sm">{activity.activityType.replace(/_/g, " ")}</p>
                          {activity.details && <p className="text-xs text-muted-foreground">{activity.details}</p>}
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(activity.createdAt), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No activities yet</p>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block">Remarks</Label>
                <div className="space-y-2 max-h-[150px] overflow-y-auto">
                  {leadDetail.remarks?.length > 0 ? (
                    leadDetail.remarks.map((remark: any, idx: number) => (
                      <div key={idx} className="p-2 bg-muted rounded">
                        <p className="text-sm">{remark.remark}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(remark.createdAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No remarks yet</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={updateStatusDialogOpen} onOpenChange={setUpdateStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Lead Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={statusForm.status} onValueChange={(v) => setStatusForm({ ...statusForm, status: v })}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="site_visit_scheduled">Site Visit Scheduled</SelectItem>
                  <SelectItem value="site_visit_completed">Site Visit Completed</SelectItem>
                  <SelectItem value="booking_initiated">Booking Initiated</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {statusForm.status === "lost" && (
              <>
                <div className="grid gap-2">
                  <Label>Lost Reason</Label>
                  <Select value={statusForm.lostReason} onValueChange={(v) => setStatusForm({ ...statusForm, lostReason: v })}>
                    <SelectTrigger data-testid="select-lost-reason">
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="budget">Budget Issues</SelectItem>
                      <SelectItem value="location">Location Not Suitable</SelectItem>
                      <SelectItem value="competitor">Chose Competitor</SelectItem>
                      <SelectItem value="not_interested">Not Interested</SelectItem>
                      <SelectItem value="no_response">No Response</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea
                    data-testid="input-lost-notes"
                    value={statusForm.lostNotes}
                    onChange={(e) => setStatusForm({ ...statusForm, lostNotes: e.target.value })}
                    placeholder="Additional details..."
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateStatusDialogOpen(false)} data-testid="button-cancel-status">Cancel</Button>
            <Button onClick={updateLeadStatus} data-testid="button-confirm-status">Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Follow-up Date & Time</Label>
              <Input
                type="datetime-local"
                data-testid="input-followup-date"
                value={followUpForm.followUpAt}
                onChange={(e) => setFollowUpForm({ ...followUpForm, followUpAt: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                data-testid="input-followup-notes"
                value={followUpForm.notes}
                onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                placeholder="What to discuss..."
              />
            </div>
          </div>
          {selectedLead?.followUpAt && (
            <div className="flex items-center gap-2 px-1 pb-2">
              <span className="text-xs text-muted-foreground">Add existing follow-up to calendar:</span>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-google-calendar-followup"
                onClick={() => {
                  const start = new Date(selectedLead.followUpAt!);
                  const end = new Date(start.getTime() + 30 * 60000);
                  const url = buildGoogleCalendarUrl(
                    `Follow-up: ${selectedLead.name}`,
                    start.toISOString(),
                    end.toISOString(),
                    `Follow-up with ${selectedLead.name}\nPhone: ${selectedLead.phone || 'N/A'}\nEmail: ${selectedLead.email || 'N/A'}\nNotes: ${selectedLead.followUpNotes || ''}`
                  );
                  window.open(url, '_blank');
                }}
              >
                <CalendarPlus className="w-3.5 h-3.5 mr-1.5" />
                Google Calendar
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-ics-followup"
                onClick={() => downloadICS('follow_up', selectedLead.id)}
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                .ics
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFollowUpDialogOpen(false)} data-testid="button-cancel-followup">Cancel</Button>
            <Button onClick={setFollowUp} data-testid="button-confirm-followup">Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={remarkDialogOpen} onOpenChange={setRemarkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Remark</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              data-testid="input-remark"
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder="Enter your remark..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemarkDialogOpen(false)} data-testid="button-cancel-remark">Cancel</Button>
            <Button onClick={addRemark} data-testid="button-confirm-remark">Add Remark</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
