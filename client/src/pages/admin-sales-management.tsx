import { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Users, Building2, UserPlus, ArrowLeft, Trash2, Edit, Target, UserCheck, AlertCircle, Loader2, MapPin, Link2, MoreVertical, UserMinus, Power, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Sales Management Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto py-8 px-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              {this.state.error?.message || "An unexpected error occurred. Please refresh the page."}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => window.location.reload()}>Refresh Page</Button>
            <Link href="/admin">
              <Button variant="outline" className="ml-2">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface SalesExecutive {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  assignedProperties: { id: string; name: string }[];
  totalLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  closedDeals: number;
}

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  location: string;
  active: boolean;
}

interface Lead {
  id: string;
  studentName: string;
  email: string;
  phone: string;
  propertyId: string | null;
  propertyName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  status: string;
  priority: string;
  leadScore: number;
  createdAt: string;
}

function AdminSalesManagementContent() {
  const { toast } = useToast();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("executives");
  const [salesExecs, setSalesExecs] = useState<SalesExecutive[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignPropertyDialogOpen, setAssignPropertyDialogOpen] = useState(false);
  const [assignLeadDialogOpen, setAssignLeadDialogOpen] = useState(false);
  const [selectedExec, setSelectedExec] = useState<SalesExecutive | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const [newExecForm, setNewExecForm] = useState({
    email: "",
    password: "",
    name: "",
    phone: ""
  });

  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [selectedExecId, setSelectedExecId] = useState<string>("");
  
  // Property Mapping state
  const [propertyMappings, setPropertyMappings] = useState<{property: Property, assignedExecs: SalesExecutive[]}[]>([]);
  const [selectedPropertyForMapping, setSelectedPropertyForMapping] = useState<string>("");
  const [selectedExecForMapping, setSelectedExecForMapping] = useState<string>("");
  const [mappingLoading, setMappingLoading] = useState(false);
  const [addMappingDialogOpen, setAddMappingDialogOpen] = useState(false);
  
  // Deactivation/Reassignment state
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [execToDeactivate, setExecToDeactivate] = useState<SalesExecutive | null>(null);
  const [reassignToExecId, setReassignToExecId] = useState<string>("");
  const [deactivating, setDeactivating] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [execToEdit, setExecToEdit] = useState<SalesExecutive | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "" });

  const getAuthToken = () => token || "";

  useEffect(() => {
    loadSalesExecs();
    loadProperties();
  }, []);

  useEffect(() => {
    if (activeTab === "leads") {
      loadUnassignedLeads();
    }
    if (activeTab === "property-mapping") {
      loadPropertyMappings();
    }
  }, [activeTab]);

  const loadSalesExecs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/admin/sales-executives", {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch sales executives");
      }
      const data = await response.json();
      console.log("Sales executives loaded:", data);
      setSalesExecs(data || []);
    } catch (error: any) {
      console.error("Failed to load sales executives:", error);
      const errorMessage = error.message || "Failed to load sales executives";
      setError(errorMessage);
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadProperties = async () => {
    try {
      const response = await fetch("/api/admin/properties", {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) throw new Error("Failed to fetch properties");
      const data = await response.json();
      setProperties(data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load properties", variant: "destructive" });
    }
  };

  const loadUnassignedLeads = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/leads", {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) throw new Error("Failed to fetch leads");
      const data = await response.json();
      setLeads(data.filter((lead: Lead) => !lead.assignedToId));
    } catch (error) {
      toast({ title: "Error", description: "Failed to load leads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadPropertyMappings = async () => {
    try {
      setMappingLoading(true);
      const mappings: {property: Property, assignedExecs: SalesExecutive[]}[] = [];
      
      for (const property of properties) {
        const response = await fetch(`/api/admin/properties/${property.id}/sales-execs`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` }
        });
        if (response.ok) {
          const execs = await response.json();
          mappings.push({ property, assignedExecs: execs });
        }
      }
      
      setPropertyMappings(mappings);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load property mappings", variant: "destructive" });
    } finally {
      setMappingLoading(false);
    }
  };

  const addPropertyMapping = async () => {
    if (!selectedPropertyForMapping || !selectedExecForMapping) {
      toast({ title: "Error", description: "Please select both property and sales executive", variant: "destructive" });
      return;
    }
    
    try {
      const response = await fetch("/api/admin/property-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          propertyId: selectedPropertyForMapping,
          salesExecId: selectedExecForMapping
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add mapping");
      }
      
      toast({ title: "Success", description: "Property assigned to sales executive" });
      setAddMappingDialogOpen(false);
      setSelectedPropertyForMapping("");
      setSelectedExecForMapping("");
      loadPropertyMappings();
      loadSalesExecs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const removePropertyMapping = async (propertyId: string, salesExecId: string) => {
    try {
      const response = await fetch(`/api/admin/property-assignments/${propertyId}/${salesExecId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      
      if (!response.ok) throw new Error("Failed to remove mapping");
      
      toast({ title: "Success", description: "Property assignment removed" });
      loadPropertyMappings();
      loadSalesExecs();
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove assignment", variant: "destructive" });
    }
  };

  const createSalesExecutive = async () => {
    // Validate required fields
    if (!newExecForm.name.trim()) {
      toast({ title: "Error", description: "Full name is required", variant: "destructive" });
      return;
    }
    if (!newExecForm.email.trim()) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    if (!newExecForm.phone.trim()) {
      toast({ title: "Error", description: "Phone number is required", variant: "destructive" });
      return;
    }
    if (!newExecForm.password || newExecForm.password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    
    try {
      const response = await fetch("/api/admin/sales-executives", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(newExecForm)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create sales executive");
      }
      toast({ title: "Success", description: "Sales executive created successfully" });
      setCreateDialogOpen(false);
      setNewExecForm({ email: "", password: "", name: "", phone: "" });
      loadSalesExecs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const assignProperties = async () => {
    if (!selectedExec) return;
    try {
      const currentlyAssigned = selectedExec.assignedProperties?.map((p: any) => p.id) || [];
      const toAdd = selectedPropertyIds.filter((id: string) => !currentlyAssigned.includes(id));
      const toRemove = currentlyAssigned.filter((id: string) => !selectedPropertyIds.includes(id));
      
      // Add new assignments
      for (const propertyId of toAdd) {
        await fetch("/api/admin/property-assignments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`
          },
          body: JSON.stringify({ userId: selectedExec.id, propertyId })
        });
      }
      
      // Remove deselected assignments
      for (const propertyId of toRemove) {
        await fetch(`/api/admin/property-assignments/${selectedExec.id}/${propertyId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${getAuthToken()}` }
        });
      }
      
      const changes = [];
      if (toAdd.length > 0) changes.push(`${toAdd.length} added`);
      if (toRemove.length > 0) changes.push(`${toRemove.length} removed`);
      
      toast({ title: "Success", description: changes.length > 0 ? `Properties updated: ${changes.join(", ")}` : "No changes made" });
      setAssignPropertyDialogOpen(false);
      setSelectedPropertyIds([]);
      loadSalesExecs();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update properties", variant: "destructive" });
    }
  };

  const removePropertyAssignment = async (userId: string, propertyId: string) => {
    try {
      await fetch(`/api/admin/property-assignments/${userId}/${propertyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      toast({ title: "Success", description: "Property assignment removed" });
      loadSalesExecs();
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove assignment", variant: "destructive" });
    }
  };

  const assignLeadToExec = async () => {
    if (!selectedLead || !selectedExecId) return;
    try {
      const response = await fetch(`/api/admin/leads/${selectedLead.id}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ userId: selectedExecId })
      });
      if (!response.ok) throw new Error("Failed to assign lead");
      toast({ title: "Success", description: "Lead assigned successfully" });
      setAssignLeadDialogOpen(false);
      setSelectedExecId("");
      loadUnassignedLeads();
      loadSalesExecs();
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign lead", variant: "destructive" });
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "hot": return <Badge className="bg-red-500 text-white">Hot</Badge>;
      case "warm": return <Badge className="bg-orange-500 text-white">Warm</Badge>;
      default: return <Badge className="bg-blue-500 text-white">Cold</Badge>;
    }
  };
  
  // Deactivate sales executive
  const openDeactivateDialog = (exec: SalesExecutive) => {
    setExecToDeactivate(exec);
    setReassignToExecId("");
    setDeactivateDialogOpen(true);
  };
  
  const deactivateSalesExec = async () => {
    if (!execToDeactivate) return;
    
    try {
      setDeactivating(true);
      
      // If exec has leads and reassign target selected, reassign first
      if ((execToDeactivate.totalLeads || 0) > 0 && reassignToExecId) {
        const reassignRes = await fetch(`/api/admin/sales-executives/${execToDeactivate.id}/reassign-all`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`
          },
          body: JSON.stringify({ toUserId: reassignToExecId })
        });
        if (!reassignRes.ok) throw new Error("Failed to reassign leads");
      }
      
      // Deactivate the exec
      const res = await fetch(`/api/admin/sales-executives/${execToDeactivate.id}/deactivate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      
      if (!res.ok) throw new Error("Failed to deactivate");
      
      toast({ title: "Success", description: `${execToDeactivate.name} has been deactivated` });
      setDeactivateDialogOpen(false);
      setExecToDeactivate(null);
      loadSalesExecs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to deactivate", variant: "destructive" });
    } finally {
      setDeactivating(false);
    }
  };
  
  // Reactivate sales executive
  const reactivateSalesExec = async (exec: SalesExecutive) => {
    try {
      const res = await fetch(`/api/admin/sales-executives/${exec.id}/reactivate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      if (!res.ok) throw new Error("Failed to reactivate");
      toast({ title: "Success", description: `${exec.name} has been reactivated` });
      loadSalesExecs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reactivate", variant: "destructive" });
    }
  };
  
  // Edit sales executive
  const openEditDialog = (exec: SalesExecutive) => {
    setExecToEdit(exec);
    setEditForm({ name: exec.name, email: exec.email, phone: exec.phone || "" });
    setEditDialogOpen(true);
  };
  
  const updateSalesExec = async () => {
    if (!execToEdit) return;
    try {
      const res = await fetch(`/api/admin/sales-executives/${execToEdit.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "Success", description: "Sales executive updated" });
      setEditDialogOpen(false);
      setExecToEdit(null);
      loadSalesExecs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update", variant: "destructive" });
    }
  };

  if (loading && salesExecs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button onClick={() => loadSalesExecs()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Team Management</h1>
          <p className="text-sm text-slate-500">Manage sales executives, property assignments, and lead distribution</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-exec">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Sales Executive
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Sales Executive</DialogTitle>
              <DialogDescription>Add a new sales executive to your team</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  data-testid="input-exec-fullname"
                  value={newExecForm.name}
                  onChange={(e) => setNewExecForm({ ...newExecForm, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  data-testid="input-exec-email"
                  value={newExecForm.email}
                  onChange={(e) => setNewExecForm({ ...newExecForm, email: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  data-testid="input-exec-phone"
                  value={newExecForm.phone}
                  onChange={(e) => setNewExecForm({ ...newExecForm, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  data-testid="input-exec-password"
                  value={newExecForm.password}
                  onChange={(e) => setNewExecForm({ ...newExecForm, password: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel-create-exec">Cancel</Button>
              <Button onClick={createSalesExecutive} data-testid="button-submit-create-exec">Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="p-5 bg-gradient-to-br from-indigo-500 to-indigo-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm font-medium">Total Sales Execs</p>
                <p className="text-3xl font-bold text-white mt-1" data-testid="text-total-execs">{salesExecs.length}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="p-5 bg-gradient-to-br from-emerald-500 to-emerald-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Active Execs</p>
                <p className="text-3xl font-bold text-white mt-1" data-testid="text-active-execs">
                  {salesExecs.filter(e => e.isActive).length}
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <UserCheck className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="p-5 bg-gradient-to-br from-violet-500 to-violet-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-violet-100 text-sm font-medium">Total Leads</p>
                <p className="text-3xl font-bold text-white mt-1" data-testid="text-total-leads">
                  {salesExecs.reduce((sum, e) => sum + (e.totalLeads ?? 0), 0)}
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Target className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-0 shadow-md overflow-hidden">
          <div className="p-5 bg-gradient-to-br from-amber-500 to-amber-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Closed Deals</p>
                <p className="text-3xl font-bold text-white mt-1" data-testid="text-closed-deals">
                  {salesExecs.reduce((sum, e) => sum + (e.closedDeals ?? 0), 0)}
                </p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Target className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger 
            value="executives" 
            data-testid="tab-executives"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4"
          >
            <Users className="h-4 w-4 mr-2" />
            Sales Executives
          </TabsTrigger>
          <TabsTrigger 
            value="leads" 
            data-testid="tab-leads"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4"
          >
            <Target className="h-4 w-4 mr-2" />
            Lead Assignment
          </TabsTrigger>
          <TabsTrigger 
            value="property-mapping" 
            data-testid="tab-property-mapping"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg px-4"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Property Mapping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executives" className="mt-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b pb-4">
              <CardTitle className="text-lg font-semibold">Sales Executives</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-center py-8">Loading...</p>
              ) : salesExecs.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No sales executives yet. Create one to get started.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Assigned Properties</TableHead>
                      <TableHead>Leads</TableHead>
                      <TableHead>Hot/Warm/Cold</TableHead>
                      <TableHead>Closed</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesExecs.map((exec) => (
                      <TableRow key={exec.id} data-testid={`row-exec-${exec.id}`}>
                        <TableCell className="font-medium">{exec.name}</TableCell>
                        <TableCell>{exec.email}</TableCell>
                        <TableCell>{exec.phone || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(exec.assignedProperties || []).map((prop) => (
                              <Badge key={prop.id} variant="outline" className="flex items-center gap-1">
                                {prop.name}
                                <button
                                  onClick={() => removePropertyAssignment(exec.id, prop.id)}
                                  className="ml-1 hover:text-red-500"
                                  data-testid={`button-remove-property-${prop.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                            {(!exec.assignedProperties || exec.assignedProperties.length === 0) && (
                              <span className="text-muted-foreground text-sm">No properties</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{exec.totalLeads ?? 0}</TableCell>
                        <TableCell>
                          <span className="text-red-500 font-medium">{exec.hotLeads ?? 0}</span>
                          {" / "}
                          <span className="text-orange-500 font-medium">{exec.warmLeads ?? 0}</span>
                          {" / "}
                          <span className="text-blue-500 font-medium">{exec.coldLeads ?? 0}</span>
                        </TableCell>
                        <TableCell className="text-green-600 font-medium">{exec.closedDeals ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant={exec.isActive ? "default" : "secondary"}>
                            {exec.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-actions-${exec.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(exec)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedExec(exec);
                                setSelectedPropertyIds(exec.assignedProperties?.map((p: any) => p.id) || []);
                                setAssignPropertyDialogOpen(true);
                              }}>
                                <Building2 className="h-4 w-4 mr-2" />
                                Assign Properties
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {exec.isActive ? (
                                <DropdownMenuItem 
                                  onClick={() => openDeactivateDialog(exec)}
                                  className="text-orange-600"
                                >
                                  <Power className="h-4 w-4 mr-2" />
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => reactivateSalesExec(exec)}
                                  className="text-green-600"
                                >
                                  <Power className="h-4 w-4 mr-2" />
                                  Reactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b pb-4">
              <CardTitle className="text-lg font-semibold">Unassigned Leads</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <p className="text-center py-8">Loading...</p>
              ) : leads.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No leads available.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                        <TableCell className="font-medium">{lead.studentName}</TableCell>
                        <TableCell>{lead.email}</TableCell>
                        <TableCell>{lead.phone}</TableCell>
                        <TableCell>{lead.propertyName || "-"}</TableCell>
                        <TableCell>
                          {lead.assignedToName ? (
                            <Badge variant="outline">{lead.assignedToName}</Badge>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>{getPriorityBadge(lead.priority)}</TableCell>
                        <TableCell>{lead.leadScore}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{lead.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLead(lead);
                              setAssignLeadDialogOpen(true);
                            }}
                            data-testid={`button-assign-lead-${lead.id}`}
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="property-mapping" className="mt-4">
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Property → Sales Executive Mapping</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Auto-assigns new leads to sales executives based on property. Uses load balancing (assigns to exec with fewest active leads).
                  </p>
                </div>
                <Button onClick={() => setAddMappingDialogOpen(true)} data-testid="button-add-mapping">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Mapping
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {mappingLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : propertyMappings.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No property mappings configured. Add mappings to enable auto-assignment.</p>
              ) : (
                <div className="divide-y">
                  {propertyMappings.map(({ property, assignedExecs }) => (
                    <div key={property.id} className="p-4" data-testid={`mapping-property-${property.id}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-medium">{property.name}</h4>
                            <p className="text-sm text-muted-foreground">{property.city}, {property.location}</p>
                          </div>
                        </div>
                        <Badge variant={property.active ? "default" : "secondary"}>
                          {property.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      
                      <div className="mt-4 ml-13">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Assigned Sales Executives:</p>
                        {assignedExecs.length === 0 ? (
                          <p className="text-sm text-yellow-600 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            No executives assigned - leads will be marked as unassigned
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {assignedExecs.map((exec) => (
                              <Badge 
                                key={exec.id} 
                                variant="outline" 
                                className="flex items-center gap-2 py-1 px-3"
                                data-testid={`mapping-exec-${exec.id}`}
                              >
                                <UserCheck className="h-3 w-3" />
                                {exec.name}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 ml-1 hover:bg-red-100"
                                  onClick={() => removePropertyMapping(property.id, exec.id)}
                                  data-testid={`button-remove-mapping-${property.id}-${exec.id}`}
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Property Mapping Dialog */}
      <Dialog open={addMappingDialogOpen} onOpenChange={setAddMappingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Property Mapping</DialogTitle>
            <DialogDescription>
              Assign a sales executive to handle leads from a specific property.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Property</Label>
              <Select value={selectedPropertyForMapping} onValueChange={setSelectedPropertyForMapping}>
                <SelectTrigger data-testid="select-property-for-mapping">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.filter(p => p.active).map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name} - {property.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sales Executive</Label>
              <Select value={selectedExecForMapping} onValueChange={setSelectedExecForMapping}>
                <SelectTrigger data-testid="select-exec-for-mapping">
                  <SelectValue placeholder="Select sales executive" />
                </SelectTrigger>
                <SelectContent>
                  {salesExecs.filter(e => e.isActive).map((exec) => (
                    <SelectItem key={exec.id} value={exec.id}>
                      {exec.name} ({exec.totalLeads} leads)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMappingDialogOpen(false)} data-testid="button-cancel-mapping">
              Cancel
            </Button>
            <Button onClick={addPropertyMapping} data-testid="button-confirm-mapping">
              Add Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignPropertyDialogOpen} onOpenChange={setAssignPropertyDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle>Assign Properties to {selectedExec?.name}</DialogTitle>
            <DialogDescription>Select properties to assign to this sales executive</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 min-h-0">
            {properties.filter(p => p.active).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mb-2 opacity-50" />
                <p>No properties available</p>
              </div>
            ) : (
              properties.filter(p => p.active).map((property) => {
                const isCurrentlyAssigned = selectedExec?.assignedProperties?.some(ap => ap.id === property.id) ?? false;
                const isSelected = selectedPropertyIds.includes(property.id);
                return (
                  <div key={property.id} className="flex items-center space-x-3 py-3 px-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <Checkbox
                      id={property.id}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPropertyIds([...selectedPropertyIds, property.id]);
                        } else {
                          setSelectedPropertyIds(selectedPropertyIds.filter(id => id !== property.id));
                        }
                      }}
                      data-testid={`checkbox-property-${property.id}`}
                    />
                    <Label htmlFor={property.id} className="flex-1 cursor-pointer">
                      <div className="font-medium">{property.name}</div>
                      <div className="text-sm text-muted-foreground">{property.location || property.city || property.address}</div>
                    </Label>
                    {isCurrentlyAssigned && <Badge variant="outline" className="shrink-0 text-green-600 border-green-200">Assigned</Badge>}
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter className="border-t px-6 py-4 shrink-0 bg-white">
            <Button variant="outline" onClick={() => setAssignPropertyDialogOpen(false)} data-testid="button-cancel-assign-properties">Cancel</Button>
            <Button 
              onClick={assignProperties} 
              className="bg-pink-500 hover:bg-pink-600"
              data-testid="button-confirm-assign-properties"
            >
              Save Changes {selectedPropertyIds.length > 0 && `(${selectedPropertyIds.length} selected)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignLeadDialogOpen} onOpenChange={setAssignLeadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lead</DialogTitle>
            <DialogDescription>
              Assign {selectedLead?.studentName} to a sales executive
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="exec-select">Sales Executive</Label>
            <Select value={selectedExecId} onValueChange={setSelectedExecId}>
              <SelectTrigger id="exec-select" data-testid="select-exec-for-lead">
                <SelectValue placeholder="Select sales executive" />
              </SelectTrigger>
              <SelectContent>
                {salesExecs.filter(e => e.isActive).map((exec) => (
                  <SelectItem key={exec.id} value={exec.id}>
                    {exec.name} ({exec.totalLeads} leads)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignLeadDialogOpen(false)} data-testid="button-cancel-assign-lead">Cancel</Button>
            <Button onClick={assignLeadToExec} disabled={!selectedExecId} data-testid="button-confirm-assign-lead">
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Sales Executive Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Deactivate {execToDeactivate?.name}
            </DialogTitle>
            <DialogDescription>
              This will remove them from assignment dropdowns and boards.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {(execToDeactivate?.totalLeads || 0) > 0 && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800">This user has {execToDeactivate?.totalLeads} leads</AlertTitle>
                <AlertDescription className="text-orange-700">
                  Reassign these leads to another sales executive before deactivating.
                </AlertDescription>
              </Alert>
            )}
            
            {(execToDeactivate?.totalLeads || 0) > 0 && (
              <div>
                <Label htmlFor="reassign-exec">Reassign Leads To</Label>
                <Select value={reassignToExecId} onValueChange={setReassignToExecId}>
                  <SelectTrigger id="reassign-exec" data-testid="select-reassign-exec">
                    <SelectValue placeholder="Select sales executive" />
                  </SelectTrigger>
                  <SelectContent>
                    {salesExecs.filter(e => e.isActive && e.id !== execToDeactivate?.id).map((exec) => (
                      <SelectItem key={exec.id} value={exec.id}>
                        {exec.name} ({exec.totalLeads} leads)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)} data-testid="button-cancel-deactivate">
              Cancel
            </Button>
            <Button 
              onClick={deactivateSalesExec} 
              disabled={deactivating || ((execToDeactivate?.totalLeads || 0) > 0 && !reassignToExecId)}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="button-confirm-deactivate"
            >
              {deactivating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {(execToDeactivate?.totalLeads || 0) > 0 ? "Reassign & Deactivate" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Sales Executive Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sales Executive</DialogTitle>
            <DialogDescription>Update sales executive details</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input 
                id="edit-name" 
                value={editForm.name} 
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                data-testid="input-edit-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input 
                id="edit-email" 
                type="email"
                value={editForm.email} 
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                data-testid="input-edit-email"
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input 
                id="edit-phone" 
                value={editForm.phone} 
                onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                data-testid="input-edit-phone"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={updateSalesExec} data-testid="button-confirm-edit">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminSalesManagement() {
  return (
    <ErrorBoundary>
      <AdminSalesManagementContent />
    </ErrorBoundary>
  );
}
