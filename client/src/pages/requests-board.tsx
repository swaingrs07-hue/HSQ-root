import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Calendar as CalendarIcon,
  IndianRupee,
  ChevronDown,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { KanbanBoard, mapStageToLeadStatus, type KanbanStage } from "@/components/kanban-board";
import type { Lead } from "@shared/schema";
import { format, isWithinInterval, subDays, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";

interface Property {
  id: string;
  name: string;
}

interface SalesExecutive {
  id: string;
  name: string;
}

interface FilterState {
  searchTerm: string;
  propertyId: string;
  salesExecId: string;
  dateRange: DateRange | undefined;
  dealValueMin: string;
  dealValueMax: string;
}

const FILTER_STORAGE_KEY = "hsquare_kanban_filters";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function RequestsBoard() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [salesExecs, setSalesExecs] = useState<SalesExecutive[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>(() => {
    try {
      const saved = localStorage.getItem(FILTER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          dateRange: parsed.dateRange?.from 
            ? {
                from: new Date(parsed.dateRange.from),
                to: parsed.dateRange.to ? new Date(parsed.dateRange.to) : undefined,
              }
            : undefined,
        };
      }
    } catch {}
    return {
      searchTerm: "",
      propertyId: "all",
      salesExecId: "all",
      dateRange: undefined,
      dealValueMin: "",
      dealValueMax: "",
    };
  });
  
  const debouncedSearch = useDebounce(filters.searchTerm, 300);
  
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch {}
  }, [filters]);
  
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
      const authData = localStorage.getItem("hsquare_auth");
      const user = authData ? JSON.parse(authData)?.user : null;
      const isSalesExec = user?.role === "sales_executive";
      
      const url = isSalesExec 
        ? `/api/sales/my-leads`
        : "/api/leads";
      
      const response = await fetch(url, {
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
    const targetColumn = newStage.charAt(0).toUpperCase() + newStage.slice(1);
    
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
        title: "Request moved successfully",
        description: `Moved to ${targetColumn} stage`,
        className: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0",
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
        className: "bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0",
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

  const clearFilters = useCallback(() => {
    setFilters({
      searchTerm: "",
      propertyId: "all",
      salesExecId: "all",
      dateRange: undefined,
      dealValueMin: "",
      dealValueMax: "",
    });
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.propertyId !== "all") count++;
    if (filters.salesExecId !== "all") count++;
    if (filters.dateRange?.from || filters.dateRange?.to) count++;
    if (filters.dealValueMin || filters.dealValueMax) count++;
    return count;
  }, [filters]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        !debouncedSearch ||
        lead.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        lead.phone?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        lead.email?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        lead.propertyName?.toLowerCase().includes(debouncedSearch.toLowerCase());

      const matchesProperty =
        filters.propertyId === "all" || lead.propertyId === filters.propertyId;

      const matchesSales =
        filters.salesExecId === "all" || lead.assignedToId === filters.salesExecId;

      let matchesDate = true;
      if (filters.dateRange?.from || filters.dateRange?.to) {
        const leadDate = lead.createdAt ? new Date(lead.createdAt) : null;
        if (leadDate) {
          const from = filters.dateRange?.from ? startOfDay(filters.dateRange.from) : new Date(0);
          const to = filters.dateRange?.to ? endOfDay(filters.dateRange.to) : new Date();
          matchesDate = isWithinInterval(leadDate, { start: from, end: to });
        }
      }

      let matchesDealValue = true;
      const dealValue = lead.budgetMax || lead.budgetMin || 0;
      if (filters.dealValueMin) {
        matchesDealValue = dealValue >= parseInt(filters.dealValueMin);
      }
      if (matchesDealValue && filters.dealValueMax) {
        matchesDealValue = dealValue <= parseInt(filters.dealValueMax);
      }

      return matchesSearch && matchesProperty && matchesSales && matchesDate && matchesDealValue;
    });
  }, [leads, debouncedSearch, filters]);

  const dateRangePresets = [
    { label: "Today", days: 0 },
    { label: "Last 7 days", days: 7 },
    { label: "Last 30 days", days: 30 },
    { label: "Last 90 days", days: 90 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 shadow-sm"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-500" />
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
                value={filters.searchTerm}
                onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                className="pl-9 w-72 bg-white/80 border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500/20"
                data-testid="input-search-requests"
              />
              {filters.searchTerm && (
                <button
                  onClick={() => setFilters({ ...filters, searchTerm: "" })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`relative rounded-xl transition-all ${
                showFilters 
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700" 
                  : "hover:bg-slate-50"
              }`}
              data-testid="button-toggle-filters"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-indigo-500 text-white text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={loadLeads}
              className="rounded-xl hover:bg-slate-50"
              data-testid="button-refresh-requests"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>

            <Button
              onClick={() => setAddModalOpen(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white shadow-lg shadow-indigo-500/25 rounded-xl"
              data-testid="button-add-request"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Request
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-slate-600 whitespace-nowrap">Property:</Label>
                  <Select 
                    value={filters.propertyId} 
                    onValueChange={(v) => setFilters({ ...filters, propertyId: v })}
                  >
                    <SelectTrigger className="w-44 rounded-xl" data-testid="select-property-filter">
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
                  <Label className="text-sm text-slate-600 whitespace-nowrap">Sales Exec:</Label>
                  <Select 
                    value={filters.salesExecId} 
                    onValueChange={(v) => setFilters({ ...filters, salesExecId: v })}
                  >
                    <SelectTrigger className="w-44 rounded-xl" data-testid="select-sales-filter">
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

                <div className="flex items-center gap-2">
                  <Label className="text-sm text-slate-600 whitespace-nowrap">Date:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-52 justify-start text-left font-normal rounded-xl"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateRange?.from ? (
                          filters.dateRange?.to ? (
                            <>
                              {format(filters.dateRange.from, "MMM d")} -{" "}
                              {format(filters.dateRange.to, "MMM d")}
                            </>
                          ) : (
                            format(filters.dateRange.from, "MMM d, yyyy")
                          )
                        ) : (
                          <span className="text-slate-500">Select date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                      <div className="p-3 border-b border-slate-100">
                        <div className="flex gap-1">
                          {dateRangePresets.map((preset) => (
                            <Button
                              key={preset.label}
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() =>
                                setFilters({
                                  ...filters,
                                  dateRange: {
                                    from: preset.days === 0 ? new Date() : subDays(new Date(), preset.days),
                                    to: new Date(),
                                  },
                                })
                              }
                            >
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <Calendar
                        mode="range"
                        selected={filters.dateRange}
                        onSelect={(range) =>
                          setFilters({ ...filters, dateRange: range || { from: undefined, to: undefined } })
                        }
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm text-slate-600 whitespace-nowrap">Deal Value:</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={filters.dealValueMin}
                      onChange={(e) => setFilters({ ...filters, dealValueMin: e.target.value })}
                      className="w-24 rounded-xl"
                    />
                    <span className="text-slate-400">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={filters.dealValueMax}
                      onChange={(e) => setFilters({ ...filters, dealValueMax: e.target.value })}
                      className="w-24 rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-slate-500 hover:text-slate-700 rounded-xl"
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="overflow-x-auto">
        <KanbanBoard
          leads={filteredLeads}
          loading={loading}
          error={error || undefined}
          onStageChange={handleStageChange}
          onDelete={handleDelete}
        />
      </div>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
                <Plus className="h-4 w-4 text-white" />
              </div>
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
                  className="pl-9 rounded-xl"
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
                  className="pl-9 rounded-xl"
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
                  className="pl-9 rounded-xl"
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
                <SelectTrigger className="rounded-xl" data-testid="select-request-property">
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
                    className="pl-9 rounded-xl"
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
                    className="pl-9 rounded-xl"
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
                className="resize-none rounded-xl"
                rows={3}
                data-testid="textarea-request-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={handleAddRequest}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-xl"
              data-testid="button-submit-request"
            >
              Add Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
