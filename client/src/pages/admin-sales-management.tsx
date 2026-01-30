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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Users, Building2, UserPlus, ArrowLeft, Trash2, Edit, Target, UserCheck, AlertCircle, Loader2 } from "lucide-react";
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
  isActive: boolean;
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

  const getAuthToken = () => token || "";

  useEffect(() => {
    loadSalesExecs();
    loadProperties();
  }, []);

  useEffect(() => {
    if (activeTab === "leads") {
      loadUnassignedLeads();
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
      for (const propertyId of selectedPropertyIds) {
        await fetch("/api/admin/property-assignments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`
          },
          body: JSON.stringify({ userId: selectedExec.id, propertyId })
        });
      }
      toast({ title: "Success", description: "Properties assigned successfully" });
      setAssignPropertyDialogOpen(false);
      setSelectedPropertyIds([]);
      loadSalesExecs();
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign properties", variant: "destructive" });
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sales Execs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-execs">{salesExecs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Execs</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-execs">
              {salesExecs.filter(e => e.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-leads">
              {salesExecs.reduce((sum, e) => sum + (e.totalLeads ?? 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Closed Deals</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-closed-deals">
              {salesExecs.reduce((sum, e) => sum + (e.closedDeals ?? 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="executives" data-testid="tab-executives">
            <Users className="h-4 w-4 mr-2" />
            Sales Executives
          </TabsTrigger>
          <TabsTrigger value="leads" data-testid="tab-leads">
            <Target className="h-4 w-4 mr-2" />
            Lead Assignment
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executives">
          <Card>
            <CardHeader>
              <CardTitle>Sales Executives</CardTitle>
            </CardHeader>
            <CardContent>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedExec(exec);
                              setAssignPropertyDialogOpen(true);
                            }}
                            data-testid={`button-assign-properties-${exec.id}`}
                          >
                            <Building2 className="h-4 w-4 mr-1" />
                            Assign
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

        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <CardTitle>Unassigned Leads</CardTitle>
            </CardHeader>
            <CardContent>
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
      </Tabs>

      <Dialog open={assignPropertyDialogOpen} onOpenChange={setAssignPropertyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Properties to {selectedExec?.name}</DialogTitle>
            <DialogDescription>Select properties to assign to this sales executive</DialogDescription>
          </DialogHeader>
          <div className="max-h-[300px] overflow-y-auto py-4">
            {properties.filter(p => p.isActive).map((property) => {
              const isAssigned = selectedExec?.assignedProperties.some(ap => ap.id === property.id);
              return (
                <div key={property.id} className="flex items-center space-x-2 py-2">
                  <Checkbox
                    id={property.id}
                    disabled={isAssigned}
                    checked={isAssigned || selectedPropertyIds.includes(property.id)}
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
                    <div>{property.name}</div>
                    <div className="text-sm text-muted-foreground">{property.city}</div>
                  </Label>
                  {isAssigned && <Badge variant="secondary">Assigned</Badge>}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignPropertyDialogOpen(false)} data-testid="button-cancel-assign-properties">Cancel</Button>
            <Button onClick={assignProperties} disabled={selectedPropertyIds.length === 0} data-testid="button-confirm-assign-properties">
              Assign Selected
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
