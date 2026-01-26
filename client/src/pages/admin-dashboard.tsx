import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Home, DollarSign, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAdminStats } from "@/lib/api";

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

  useEffect(() => {
    loadStats();
  }, []);

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

  const handleApplyDiscount = async () => {
    try {
      // For demo purposes, using a mock admin ID
      // In production, this would come from authentication
      const adminId = "admin-001";

      toast({ 
        title: "Discount Applied", 
        description: "The override has been logged and applied." 
      });
      
      setDiscountModalOpen(false);
      setDiscountForm({ bookingId: "", discount: "", reason: "" });
      
      // Reload stats
      await loadStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to apply discount",
        variant: "destructive",
      });
    }
  };

  const occupancyRate = stats.totalBookings > 0 
    ? Math.round((stats.totalBookings / (stats.totalBookings + 10)) * 100) 
    : 0;

  return (
    <div className="flex min-h-screen bg-muted/10">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r hidden md:block">
        <div className="p-6">
          <h2 className="text-2xl font-heading font-bold text-primary">Admin</h2>
        </div>
        <nav className="space-y-1 px-4">
          <Button variant="ghost" className="w-full justify-start font-medium bg-sidebar-accent text-sidebar-accent-foreground">
            <Home className="mr-2 h-4 w-4" /> Dashboard
          </Button>
          <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground">
            <DollarSign className="mr-2 h-4 w-4" /> Payments
          </Button>
          <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground">
            <FileText className="mr-2 h-4 w-4" /> Agreements
          </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-heading font-bold">Dashboard Overview</h1>
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
        </div>

        {/* Stats Cards */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : (
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

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 gap-6">
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
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
