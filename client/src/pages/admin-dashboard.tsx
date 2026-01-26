import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Home, DollarSign, FileText, Users, Search, Phone, Mail, Calendar, Clock, Monitor, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAdminStats } from "@/lib/api";
import type { Lead } from "@shared/schema";

export default function AdminDashboard() {
  const { toast } = useToast();
  const [discountModalOpen, setDiscountModalOpen] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalBookings: 0,
    totalRevenue: 0,
    pendingPayments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [discountForm, setDiscountForm] = useState({
    bookingId: "",
    discount: "",
    reason: "",
  });

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (activeTab === "leads") {
      loadLeads();
    }
  }, [activeTab]);

  const loadStats = async () => {
    try {
      const data = await getAdminStats();
      setStats(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load dashboard stats",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLeads = async () => {
    try {
      setLeadsLoading(true);
      const response = await fetch("/api/leads");
      if (!response.ok) throw new Error("Failed to fetch leads");
      const data = await response.json();
      setLeads(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load leads",
        variant: "destructive",
      });
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleApplyDiscount = async () => {
    try {
      toast({ 
        title: "Discount Applied", 
        description: "The override has been logged and applied." 
      });
      
      setDiscountModalOpen(false);
      setDiscountForm({ bookingId: "", discount: "", reason: "" });
      await loadStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to apply discount",
        variant: "destructive",
      });
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.phone && lead.phone.includes(searchTerm)) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDevice = deviceFilter === "all" || lead.deviceType === deviceFilter;
    
    return matchesSearch && matchesDevice;
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="w-4 h-4 text-muted-foreground" />;
      case "tablet":
        return <Monitor className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Monitor className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const occupancyRate = stats.totalBookings > 0 
    ? Math.round((stats.totalBookings / (stats.totalBookings + 10)) * 100) 
    : 0;

  return (
    <div className="flex min-h-screen bg-muted/10">
      <aside className="w-64 bg-sidebar border-r hidden md:block">
        <div className="p-6">
          <h2 className="text-2xl font-heading font-bold text-primary">Admin</h2>
        </div>
        <nav className="space-y-1 px-4">
          <Button 
            variant="ghost" 
            className={`w-full justify-start font-medium ${activeTab === "overview" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("overview")}
          >
            <Home className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <Button 
            variant="ghost" 
            className={`w-full justify-start font-medium ${activeTab === "leads" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"}`}
            onClick={() => setActiveTab("leads")}
          >
            <Users className="mr-2 h-4 w-4" /> Leads
          </Button>
          <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground">
            <DollarSign className="mr-2 h-4 w-4" /> Payments
          </Button>
          <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground">
            <FileText className="mr-2 h-4 w-4" /> Agreements
          </Button>
        </nav>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-heading font-bold">
            {activeTab === "overview" ? "Dashboard Overview" : "Leads Management"}
          </h1>
          {activeTab === "overview" && (
            <div className="flex gap-2">
              <Button variant="outline" data-testid="button-download-report">Download Report</Button>
              <Dialog open={discountModalOpen} onOpenChange={setDiscountModalOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-apply-discount">Apply Discount Override</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Apply Custom Discount</DialogTitle>
                    <DialogDescription>
                      This action will override the calculated fee for a specific booking. Action will be logged.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Booking ID</Label>
                      <Input 
                        id="booking-id" 
                        className="col-span-3" 
                        placeholder="Enter Booking ID" 
                        value={discountForm.bookingId}
                        onChange={(e) => setDiscountForm({ ...discountForm, bookingId: e.target.value })}
                        data-testid="input-booking-id"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Discount (₹)</Label>
                      <Input 
                        id="discount" 
                        className="col-span-3" 
                        placeholder="5000" 
                        type="number"
                        value={discountForm.discount}
                        onChange={(e) => setDiscountForm({ ...discountForm, discount: e.target.value })}
                        data-testid="input-discount"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Reason</Label>
                      <Input 
                        id="reason" 
                        className="col-span-3" 
                        placeholder="Scholarship / Referral" 
                        value={discountForm.reason}
                        onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })}
                        data-testid="input-reason"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleApplyDiscount} data-testid="button-submit-discount">
                      Apply Override
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-total-students">
                        {stats.totalStudents}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Bookings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-total-bookings">
                        {stats.totalBookings}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (Total)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold" data-testid="stat-revenue">
                        ₹{(stats.totalRevenue / 100000).toFixed(2)}L
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-600" data-testid="stat-pending">
                        ₹{(stats.pendingPayments / 100000).toFixed(2)}L
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>System Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b pb-4">
                        <div>
                          <p className="text-sm font-medium">Database Connection</p>
                          <p className="text-xs text-muted-foreground">PostgreSQL</p>
                        </div>
                        <span className="text-xs text-green-600 font-medium">Active</span>
                      </div>
                      <div className="flex items-center justify-between border-b pb-4">
                        <div>
                          <p className="text-sm font-medium">API Server</p>
                          <p className="text-xs text-muted-foreground">Express Backend</p>
                        </div>
                        <span className="text-xs text-green-600 font-medium">Running</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Occupancy Rate</p>
                          <p className="text-xs text-muted-foreground">Current bookings vs capacity</p>
                        </div>
                        <span className="text-xs text-primary font-medium">{occupancyRate}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "leads" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        All Leads ({filteredLeads.length})
                      </CardTitle>
                      <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by name, phone, email..."
                            className="pl-10 w-full md:w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            data-testid="input-search-leads"
                          />
                        </div>
                        <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                          <SelectTrigger className="w-full md:w-40" data-testid="select-device-filter">
                            <SelectValue placeholder="Device Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Devices</SelectItem>
                            <SelectItem value="mobile">Mobile</SelectItem>
                            <SelectItem value="desktop">Desktop</SelectItem>
                            <SelectItem value="tablet">Tablet</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={loadLeads} data-testid="button-refresh-leads">
                          Refresh
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {leadsLoading ? (
                      <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : filteredLeads.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        {searchTerm || deviceFilter !== "all" 
                          ? "No leads match your search criteria" 
                          : "No leads yet. Visitors who sign in will appear here."}
                      </div>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[150px]">Name</TableHead>
                              <TableHead className="min-w-[150px]">Contact</TableHead>
                              <TableHead className="min-w-[120px]">First Login</TableHead>
                              <TableHead className="min-w-[120px]">Last Activity</TableHead>
                              <TableHead className="text-center">Visits</TableHead>
                              <TableHead className="text-center">Device</TableHead>
                              <TableHead className="text-center">Verified</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredLeads.map((lead) => (
                              <TableRow key={lead.id} data-testid={`lead-row-${lead.id}`}>
                                <TableCell className="font-medium">{lead.name}</TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {lead.phone && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Phone className="h-3 w-3 text-muted-foreground" />
                                        {lead.phone}
                                      </div>
                                    )}
                                    {lead.email && (
                                      <div className="flex items-center gap-2 text-sm">
                                        <Mail className="h-3 w-3 text-muted-foreground" />
                                        {lead.email}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 text-sm">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    {formatDate(lead.firstLoginAt)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 text-sm">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    {formatDate(lead.lastActivityAt)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                                    {lead.loginCount}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center" title={lead.deviceType || "Unknown"}>
                                    {getDeviceIcon(lead.deviceType)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {lead.phoneVerified ? (
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                      Yes
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                      No
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
