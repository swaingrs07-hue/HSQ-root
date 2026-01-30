import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  RefreshCw,
  Filter,
  Plus,
  X,
  Building2,
  User,
  Phone,
  Mail,
  Calendar,
  IndianRupee,
} from "lucide-react";
import { KanbanBoard, mapStageToLeadStatus, type KanbanStage } from "@/components/kanban-board";
import type { Lead } from "@shared/schema";

interface Property {
  id: string;
  name: string;
}

interface SalesExecutive {
  id: string;
  name: string;
}

export default function RequestsBoard() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [salesFilter, setSalesFilter] = useState<string>("all");
  const [properties, setProperties] = useState<Property[]>([]);
  const [salesExecs, setSalesExecs] = useState<SalesExecutive[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  const [newRequest, setNewRequest] = useState({
    name: "",
    phone: "",
    email: "",
    propertyId: "",
    budgetMin: "",
    budgetMax: "",
    notes: "",
    source: "website",
  });

  const getAuthToken = useCallback(() => {
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
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const response = await fetch("/api/leads", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Failed to load requests");
      const data = await response.json();
      setLeads(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  const loadFilters = useCallback(async () => {
    try {
      const token = getAuthToken();
      const [propsRes, execsRes] = await Promise.allSettled([
        fetch("/api/properties").then((r) => (r.ok ? r.json() : [])),
        token
          ? fetch("/api/admin/sales-executives", {
              headers: { Authorization: `Bearer ${token}` },
            }).then((r) => (r.ok ? r.json() : []))
          : Promise.resolve([]),
      ]);

      if (propsRes.status === "fulfilled") {
        setProperties(propsRes.value || []);
      }
      if (execsRes.status === "fulfilled") {
        setSalesExecs(execsRes.value || []);
      }
    } catch (err) {
      console.error("Failed to load filters:", err);
    }
  }, [getAuthToken]);

  useEffect(() => {
    loadLeads();
    loadFilters();
  }, [loadLeads, loadFilters]);

  const handleStageChange = async (
    leadId: string,
    newStage: KanbanStage,
    oldStage: KanbanStage
  ) => {
    const newStatus = mapStageToLeadStatus(newStage);
    
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId ? { ...lead, status: newStatus as any } : lead
      )
    );

    try {
      const token = getAuthToken();
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error("Failed to update status");

      toast({
        title: "Request moved",
        description: `Moved to ${newStage} stage`,
      });
    } catch (err) {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId
            ? { ...lead, status: mapStageToLeadStatus(oldStage) as any }
            : lead
        )
      );
      toast({
        title: "Failed to move request",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleAddRequest = async () => {
    if (!newRequest.name || !newRequest.phone) {
      toast({
        title: "Missing information",
        description: "Name and phone are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = getAuthToken();
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...newRequest,
          budgetMin: newRequest.budgetMin ? parseInt(newRequest.budgetMin) : null,
          budgetMax: newRequest.budgetMax ? parseInt(newRequest.budgetMax) : null,
          isManualEntry: true,
        }),
      });

      if (!response.ok) throw new Error("Failed to create request");

      toast({
        title: "Request created",
        description: "New request has been added to the board",
      });

      setAddModalOpen(false);
      setNewRequest({
        name: "",
        phone: "",
        email: "",
        propertyId: "",
        budgetMin: "",
        budgetMax: "",
        notes: "",
        source: "website",
      });
      loadLeads();
    } catch (err) {
      toast({
        title: "Failed to create request",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleView = (lead: Lead) => {
    setSelectedLead(lead);
    setViewModalOpen(true);
  };

  const handleDelete = async (lead: Lead) => {
    if (!confirm("Are you sure you want to delete this request?")) return;

    try {
      const token = getAuthToken();
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error("Failed to delete");

      toast({
        title: "Request deleted",
        description: "The request has been removed",
      });
      loadLeads();
    } catch (err) {
      toast({
        title: "Failed to delete request",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      !searchTerm ||
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.propertyName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProperty =
      propertyFilter === "all" || lead.propertyId === propertyFilter;

    const matchesSales =
      salesFilter === "all" || lead.assignedToId === salesFilter;

    return matchesSearch && matchesProperty && matchesSales;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Requests Board
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage your leads pipeline with drag-and-drop
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search requests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64 bg-slate-50 border-slate-200"
                data-testid="input-search-requests"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-indigo-50 border-indigo-300" : ""}
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={loadLeads}
              data-testid="button-refresh-requests"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>

            <Button
              onClick={() => setAddModalOpen(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-lg shadow-indigo-500/25"
              data-testid="button-add-request"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Request
            </Button>
          </div>
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100"
          >
            <div className="flex items-center gap-2">
              <Label className="text-sm text-slate-600">Property:</Label>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-48" data-testid="select-property-filter">
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm text-slate-600">Sales Exec:</Label>
              <Select value={salesFilter} onValueChange={setSalesFilter}>
                <SelectTrigger className="w-48" data-testid="select-sales-filter">
                  <SelectValue placeholder="All Sales Execs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales Execs</SelectItem>
                  {salesExecs.map((exec) => (
                    <SelectItem key={exec.id} value={exec.id}>
                      {exec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPropertyFilter("all");
                setSalesFilter("all");
                setSearchTerm("");
              }}
              data-testid="button-clear-filters"
            >
              Clear Filters
            </Button>
          </motion.div>
        )}
      </motion.div>

      <div className="overflow-x-auto">
        <KanbanBoard
          leads={filteredLeads}
          loading={loading}
          error={error || undefined}
          onStageChange={handleStageChange}
          onView={handleView}
          onEdit={handleView}
          onDelete={handleDelete}
        />
      </div>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-500" />
              Add New Request
            </DialogTitle>
            <DialogDescription>
              Create a new lead request to add to the pipeline
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="name"
                  placeholder="Customer name"
                  value={newRequest.name}
                  onChange={(e) =>
                    setNewRequest({ ...newRequest, name: e.target.value })
                  }
                  className="pl-9"
                  data-testid="input-request-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="phone"
                  placeholder="Phone number"
                  value={newRequest.phone}
                  onChange={(e) =>
                    setNewRequest({ ...newRequest, phone: e.target.value })
                  }
                  className="pl-9"
                  data-testid="input-request-phone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  placeholder="Email address"
                  type="email"
                  value={newRequest.email}
                  onChange={(e) =>
                    setNewRequest({ ...newRequest, email: e.target.value })
                  }
                  className="pl-9"
                  data-testid="input-request-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="property">Property</Label>
              <Select
                value={newRequest.propertyId}
                onValueChange={(v) =>
                  setNewRequest({ ...newRequest, propertyId: v })
                }
              >
                <SelectTrigger data-testid="select-request-property">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="budgetMin">Min Budget</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="budgetMin"
                    placeholder="10,000"
                    type="number"
                    value={newRequest.budgetMin}
                    onChange={(e) =>
                      setNewRequest({ ...newRequest, budgetMin: e.target.value })
                    }
                    className="pl-9"
                    data-testid="input-request-budget-min"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="budgetMax">Max Budget</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="budgetMax"
                    placeholder="25,000"
                    type="number"
                    value={newRequest.budgetMax}
                    onChange={(e) =>
                      setNewRequest({ ...newRequest, budgetMax: e.target.value })
                    }
                    className="pl-9"
                    data-testid="input-request-budget-max"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={newRequest.notes}
                onChange={(e) =>
                  setNewRequest({ ...newRequest, notes: e.target.value })
                }
                className="resize-none"
                rows={3}
                data-testid="textarea-request-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddRequest}
              className="bg-indigo-500 hover:bg-indigo-600"
              data-testid="button-submit-request"
            >
              Add Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-500" />
              Request Details
            </DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Name</Label>
                  <p className="font-medium text-slate-800">{selectedLead.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Status</Label>
                  <Badge variant="secondary" className="mt-1">
                    {selectedLead.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Phone</Label>
                  <p className="text-slate-700">{selectedLead.phone || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Email</Label>
                  <p className="text-slate-700">{selectedLead.email || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Property</Label>
                  <p className="text-slate-700">{selectedLead.propertyName || "-"}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Source</Label>
                  <p className="text-slate-700">{selectedLead.source}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Budget</Label>
                  <p className="text-slate-700">
                    {selectedLead.budgetMin || selectedLead.budgetMax
                      ? `₹${(selectedLead.budgetMin || 0).toLocaleString("en-IN")} - ₹${(
                          selectedLead.budgetMax || 0
                        ).toLocaleString("en-IN")}`
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Priority</Label>
                  <Badge
                    variant="outline"
                    className={`mt-1 ${
                      selectedLead.priority === "hot"
                        ? "border-red-300 text-red-600"
                        : selectedLead.priority === "warm"
                        ? "border-amber-300 text-amber-600"
                        : "border-slate-300 text-slate-600"
                    }`}
                  >
                    {selectedLead.priority}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-slate-500">Created</Label>
                  <p className="text-slate-700">
                    {new Date(selectedLead.createdAt).toLocaleString("en-IN")}
                  </p>
                </div>
                {selectedLead.notes && (
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-500">Notes</Label>
                    <p className="text-slate-700 text-sm">{selectedLead.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
