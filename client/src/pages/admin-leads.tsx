import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Filter,
  Users,
  UserPlus,
  Building2,
  Phone,
  Mail,
  Calendar,
  IndianRupee,
  MoreHorizontal,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  TrendingUp,
  Eye,
  History,
  RefreshCw,
  X,
  Smartphone,
  Monitor,
  Tablet,
  ArrowUpDown,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { Lead } from "@shared/schema";
import { useProperty } from "@/contexts/property-context";

interface SalesExecWithCounts {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  leadCount: number;
  activeLeadCount: number;
}

interface Property {
  id: string;
  name: string;
}

interface LeadActivity {
  id: string;
  leadId: string;
  activityType: string;
  description: string;
  performedById: string;
  performedByName?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  new: { label: "New", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
  contacted: { label: "Contacted", color: "text-cyan-700", bgColor: "bg-cyan-50 border-cyan-200" },
  interested: { label: "Interested", color: "text-emerald-700", bgColor: "bg-emerald-50 border-emerald-200" },
  site_visit: { label: "Site Visit", color: "text-violet-700", bgColor: "bg-violet-50 border-violet-200" },
  visit_scheduled: { label: "Visit Scheduled", color: "text-purple-700", bgColor: "bg-purple-50 border-purple-200" },
  negotiation: { label: "Negotiating", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200" },
  converted: { label: "Converted", color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
  lost: { label: "Lost", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
  cold: { label: "Cold", color: "text-slate-600", bgColor: "bg-slate-50 border-slate-200" },
  warm: { label: "Warm", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
  hot: { label: "Hot", color: "text-rose-700", bgColor: "bg-rose-50 border-rose-200" },
  deal_closed: { label: "Deal Closed", color: "text-green-800", bgColor: "bg-green-100 border-green-300" },
};

const DEVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  mobile: Smartphone,
  desktop: Monitor,
  tablet: Tablet,
};

export default function AdminLeads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<string>("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedExecId, setSelectedExecId] = useState<string>("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedLeadForHistory, setSelectedLeadForHistory] = useState<Lead | null>(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>("lastActivityAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  const { selectedPropertyId } = useProperty();

  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads } = useQuery<Lead[]>({
    queryKey: ["/api/leads", selectedPropertyId],
    queryFn: async () => {
      const url = selectedPropertyId 
        ? `/api/leads?propertyId=${selectedPropertyId}` 
        : "/api/leads";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: rawSalesExecs = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/sales-executives"],
  });

  const salesExecs = useMemo(() => {
    return rawSalesExecs.map(exec => {
      const assignedLeads = leads.filter(l => l.assignedToId === exec.id);
      return {
        ...exec,
        leadCount: assignedLeads.length,
        activeLeadCount: assignedLeads.filter(l => !["converted", "lost", "deal_closed"].includes(l.status)).length
      } as SalesExecWithCounts;
    });
  }, [rawSalesExecs, leads]);

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const { data: leadHistory = [] } = useQuery<LeadActivity[]>({
    queryKey: [`/api/admin/leads/${selectedLeadForHistory?.id}/history`],
    enabled: !!selectedLeadForHistory?.id,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ leadId, userId }: { leadId: string; userId: string }) => {
      const res = await fetch(`/api/admin/leads/${leadId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to assign lead");
      return res.json();
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales-executives/lead-counts"] });
      setRecentlyUpdated(prev => new Set(prev).add(leadId));
      setTimeout(() => {
        setRecentlyUpdated(prev => {
          const next = new Set(prev);
          next.delete(leadId);
          return next;
        });
      }, 2000);
      toast({ title: "Lead Assigned", description: "Lead has been assigned successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assign lead", variant: "destructive" });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ leadIds, userId }: { leadIds: string[]; userId: string }) => {
      const res = await fetch("/api/admin/leads/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds, userId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to bulk assign");
      return res.json();
    },
    onSuccess: (data, { leadIds }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sales-executives/lead-counts"] });
      leadIds.forEach(id => {
        setRecentlyUpdated(prev => new Set(prev).add(id));
      });
      setTimeout(() => {
        setRecentlyUpdated(new Set());
      }, 2000);
      setSelectedLeads(new Set());
      setBulkAssignOpen(false);
      toast({
        title: "Bulk Assignment Complete",
        description: data.message,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to bulk assign leads", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setRecentlyUpdated(prev => new Set(prev).add(leadId));
      setTimeout(() => {
        setRecentlyUpdated(prev => {
          const next = new Set(prev);
          next.delete(leadId);
          return next;
        });
      }, 2000);
      toast({ title: "Status Updated", description: "Lead status has been updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    },
  });

  const filteredLeads = useMemo(() => {
    let result = [...leads];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (lead) =>
          lead.name?.toLowerCase().includes(term) ||
          lead.email?.toLowerCase().includes(term) ||
          lead.phone?.includes(term)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((lead) => lead.status === statusFilter);
    }

    if (assignmentFilter === "assigned") {
      result = result.filter((lead) => lead.assignedToId);
    } else if (assignmentFilter === "unassigned") {
      result = result.filter((lead) => !lead.assignedToId);
    }

    if (propertyFilter !== "all") {
      result = result.filter((lead) => lead.propertyId === propertyFilter);
    }

    if (deviceFilter !== "all") {
      result = result.filter((lead) => lead.deviceType === deviceFilter);
    }

    if (sourceFilter !== "all") {
      result = result.filter((lead) => lead.source === sourceFilter);
    }

    result.sort((a, b) => {
      const aVal = a[sortField as keyof Lead];
      const bVal = b[sortField as keyof Lead];
      if (!aVal && !bVal) return 0;
      if (!aVal) return sortOrder === "asc" ? 1 : -1;
      if (!bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, searchTerm, statusFilter, assignmentFilter, propertyFilter, deviceFilter, sourceFilter, sortField, sortOrder]);

  const stats = useMemo(() => {
    const total = leads.length;
    const assigned = leads.filter((l) => l.assignedToId).length;
    const unassigned = total - assigned;
    const hot = leads.filter((l) => l.priority === "hot").length;
    const converted = leads.filter((l) => l.status === "converted" || l.status === "deal_closed").length;
    return { total, assigned, unassigned, hot, converted };
  }, [leads]);

  const toggleSelectAll = useCallback(() => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map((l) => l.id)));
    }
  }, [filteredLeads, selectedLeads]);

  const toggleSelectLead = useCallback((leadId: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  }, []);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const getExecName = (userId: string | null) => {
    if (!userId) return null;
    const exec = salesExecs.find((e) => e.id === userId);
    return exec?.name || "Unknown";
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setAssignmentFilter("all");
    setPropertyFilter("all");
    setDeviceFilter("all");
    setSourceFilter("all");
  };

  const hasActiveFilters = searchTerm || statusFilter !== "all" || assignmentFilter !== "all" || propertyFilter !== "all" || deviceFilter !== "all" || sourceFilter !== "all";

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Lead Management</h1>
            <p className="text-slate-500 text-sm mt-1">Manage, assign, and track all leads</p>
          </div>
          <Button onClick={() => refetchLeads()} variant="outline" size="sm" data-testid="button-refresh-leads">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-slate-500">Total Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.assigned}</p>
                  <p className="text-xs text-slate-500">Assigned</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.unassigned}</p>
                  <p className="text-xs text-slate-500">Unassigned</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100 rounded-lg">
                  <Target className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.hot}</p>
                  <p className="text-xs text-slate-500">Hot Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.converted}</p>
                  <p className="text-xs text-slate-500">Converted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, email, phone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-leads"
                  />
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-assignment-filter">
                    <SelectValue placeholder="Assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                  <SelectTrigger className="w-[160px]" data-testid="select-property-filter">
                    <SelectValue placeholder="Property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                  <SelectTrigger className="w-[130px]" data-testid="select-device-filter">
                    <SelectValue placeholder="Device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Devices</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="desktop">Desktop</SelectItem>
                    <SelectItem value="tablet">Tablet</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-source-filter">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="google_ads">Google Ads</SelectItem>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                    <SelectItem value="phone_inquiry">Phone Inquiry</SelectItem>
                    <SelectItem value="email_campaign">Email Campaign</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <AnimatePresence>
            {selectedLeads.size > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-6 pb-4 overflow-hidden"
              >
                <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                  <span className="text-sm font-medium text-indigo-700">
                    {selectedLeads.size} lead{selectedLeads.size > 1 ? "s" : ""} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setBulkAssignOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-700"
                      data-testid="button-bulk-assign"
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Assign to Executive
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedLeads(new Set())}
                    >
                      Clear Selection
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                      <div className="flex items-center gap-1">
                        Lead <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("status")}>
                      <div className="flex items-center gap-1">
                        Status <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("lastActivityAt")}>
                      <div className="flex items-center gap-1">
                        Last Activity <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("score")}>
                      <div className="flex items-center gap-1">
                        Score <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                      </TableCell>
                    </TableRow>
                  ) : filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                        No leads found matching your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => {
                      const DeviceIcon = DEVICE_ICONS[lead.deviceType || "desktop"] || Monitor;
                      const statusConfig = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
                      const isRecent = recentlyUpdated.has(lead.id);

                      return (
                        <motion.tr
                          key={lead.id}
                          initial={false}
                          animate={{
                            backgroundColor: isRecent ? "rgb(220 252 231)" : "transparent",
                          }}
                          transition={{ duration: 0.5 }}
                          className="border-b hover:bg-slate-50"
                          data-testid={`row-lead-${lead.id}`}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedLeads.has(lead.id)}
                              onCheckedChange={() => toggleSelectLead(lead.id)}
                              data-testid={`checkbox-lead-${lead.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <DeviceIcon className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className="font-medium text-slate-800">{lead.name}</p>
                                <p className="text-xs text-slate-500">
                                  {lead.isManualEntry ? `via ${lead.entrySource || "manual"}` : lead.source}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {lead.phone && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{lead.phone}</span>
                                  {lead.phoneVerified && (
                                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                                  )}
                                </div>
                              )}
                              {lead.email && (
                                <div className="flex items-center gap-1 text-sm text-slate-500">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span className="truncate max-w-[150px]">{lead.email}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.propertyName ? (
                              <div className="flex items-center gap-1">
                                <Building2 className="w-4 h-4 text-slate-400" />
                                <span className="text-sm">{lead.propertyName}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className={`px-2 py-1 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.color} flex items-center gap-1 hover:opacity-80 transition-opacity`}
                                  data-testid={`dropdown-status-${lead.id}`}
                                >
                                  {statusConfig.label}
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                                  <DropdownMenuItem
                                    key={key}
                                    onClick={() => statusMutation.mutate({ leadId: lead.id, status: key })}
                                    className={lead.status === key ? "bg-slate-100" : ""}
                                  >
                                    {label}
                                    {lead.status === key && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell>
                            {lead.assignedToId ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <span className="text-xs font-medium text-indigo-600">
                                    {getExecName(lead.assignedToId)?.charAt(0)}
                                  </span>
                                </div>
                                <span className="text-sm">{getExecName(lead.assignedToId)}</span>
                              </div>
                            ) : (
                              <Select
                                onValueChange={(userId) => assignMutation.mutate({ leadId: lead.id, userId })}
                              >
                                <SelectTrigger className="h-8 w-[140px] text-xs" data-testid={`select-assign-${lead.id}`}>
                                  <SelectValue placeholder="Assign..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {salesExecs.filter((e) => e.isActive).map((exec) => (
                                    <SelectItem key={exec.id} value={exec.id}>
                                      <div className="flex items-center justify-between gap-2">
                                        <span>{exec.name}</span>
                                        <Badge variant="secondary" className="text-[10px]">
                                          {exec.activeLeadCount}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-slate-500">
                              <Clock className="w-3 h-3" />
                              {lead.lastActivityAt
                                ? formatDistanceToNow(new Date(lead.lastActivityAt), { addSuffix: true })
                                : "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  lead.priority === "hot"
                                    ? "bg-rose-100 text-rose-700"
                                    : lead.priority === "warm"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {lead.score}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" data-testid={`dropdown-actions-${lead.id}`}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedLeadForHistory(lead);
                                    setHistoryDialogOpen(true);
                                  }}
                                >
                                  <History className="w-4 h-4 mr-2" />
                                  View History
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {lead.assignedToId && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-amber-600">
                                      <UserPlus className="w-4 h-4 mr-2" />
                                      Reassign
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </motion.tr>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Assign Leads</DialogTitle>
            <DialogDescription>
              Assign {selectedLeads.size} selected lead{selectedLeads.size > 1 ? "s" : ""} to a sales executive
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedExecId} onValueChange={setSelectedExecId}>
              <SelectTrigger data-testid="select-bulk-exec">
                <SelectValue placeholder="Select Sales Executive" />
              </SelectTrigger>
              <SelectContent>
                {salesExecs.filter((e) => e.isActive).map((exec) => (
                  <SelectItem key={exec.id} value={exec.id}>
                    <div className="flex items-center justify-between gap-4 w-full">
                      <span>{exec.name}</span>
                      <span className="text-xs text-slate-500">
                        {exec.activeLeadCount} active leads
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedExecId) {
                  bulkAssignMutation.mutate({
                    leadIds: Array.from(selectedLeads),
                    userId: selectedExecId,
                  });
                }
              }}
              disabled={!selectedExecId || bulkAssignMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-confirm-bulk-assign"
            >
              {bulkAssignMutation.isPending ? "Assigning..." : "Assign Leads"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b">
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>
              {selectedLeadForHistory?.name} - Complete lead information
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
            <Tabs defaultValue="details" className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details & UTM</TabsTrigger>
                <TabsTrigger value="history">Activity History</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="mt-4 space-y-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Contact</p>
                    <p className="text-sm font-medium">{selectedLeadForHistory?.phone || "—"}</p>
                    <p className="text-sm text-slate-600">{selectedLeadForHistory?.email || "—"}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Source & Property</p>
                    <p className="text-sm font-medium capitalize">{selectedLeadForHistory?.source?.replace("_", " ") || "—"}</p>
                    <p className="text-sm text-slate-600">{selectedLeadForHistory?.propertyName || "No property"}</p>
                  </div>
                </div>

                {/* Message */}
                {selectedLeadForHistory?.message && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 mb-1 font-medium">Lead Message</p>
                    <p className="text-sm text-slate-700">{selectedLeadForHistory.message}</p>
                  </div>
                )}

                {/* UTM Tracking Section */}
                {(selectedLeadForHistory?.utmSource || selectedLeadForHistory?.utmCampaign || selectedLeadForHistory?.utmMedium) && (
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
                    <p className="text-xs text-purple-700 font-semibold mb-3 uppercase tracking-wide">UTM Tracking Data</p>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedLeadForHistory?.utmSource && (
                        <div>
                          <p className="text-xs text-slate-500">Source</p>
                          <p className="text-sm font-medium text-slate-800">{selectedLeadForHistory.utmSource}</p>
                        </div>
                      )}
                      {selectedLeadForHistory?.utmMedium && (
                        <div>
                          <p className="text-xs text-slate-500">Medium</p>
                          <p className="text-sm font-medium text-slate-800">{selectedLeadForHistory.utmMedium}</p>
                        </div>
                      )}
                      {selectedLeadForHistory?.utmCampaign && (
                        <div>
                          <p className="text-xs text-slate-500">Campaign</p>
                          <p className="text-sm font-medium text-slate-800">{selectedLeadForHistory.utmCampaign}</p>
                        </div>
                      )}
                      {selectedLeadForHistory?.utmTerm && (
                        <div>
                          <p className="text-xs text-slate-500">Term</p>
                          <p className="text-sm font-medium text-slate-800">{selectedLeadForHistory.utmTerm}</p>
                        </div>
                      )}
                      {selectedLeadForHistory?.utmContent && (
                        <div className="col-span-2">
                          <p className="text-xs text-slate-500">Content</p>
                          <p className="text-sm font-medium text-slate-800">{selectedLeadForHistory.utmContent}</p>
                        </div>
                      )}
                    </div>
                    {selectedLeadForHistory?.pageUrl && (
                      <div className="mt-3 pt-3 border-t border-purple-200">
                        <p className="text-xs text-slate-500">Landing Page</p>
                        <p className="text-sm font-medium text-indigo-600 break-all">{selectedLeadForHistory.pageUrl}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* No UTM data message */}
                {!selectedLeadForHistory?.utmSource && !selectedLeadForHistory?.utmCampaign && !selectedLeadForHistory?.utmMedium && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                    <p className="text-sm text-slate-500">No UTM tracking data available for this lead</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                {leadHistory.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No activity history available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leadHistory.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex gap-3 p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <History className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {activity.description}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {activity.performedByName || "System"} •{" "}
                            {format(new Date(activity.createdAt), "MMM d, yyyy h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
