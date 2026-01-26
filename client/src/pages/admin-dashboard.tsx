import { useState } from "react";
import { PROPERTIES } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Home, Users, DollarSign, FileText, Lock, Unlock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MOCK_STUDENTS = [
  { id: 1, name: "Rahul Sharma", property: "Hsquare Heights", room: "Single", status: "Active", payment: "Paid", due: 0 },
  { id: 2, name: "Priya Singh", property: "Hsquare Residency", room: "Shared", status: "Pending", payment: "Partial", due: 50000 },
  { id: 3, name: "Amit Kumar", property: "Hsquare Heights", room: "Shared", status: "Active", payment: "Paid", due: 0 },
];

const REVENUE_DATA = [
  { name: 'Jan', revenue: 400000 },
  { name: 'Feb', revenue: 300000 },
  { name: 'Mar', revenue: 200000 },
  { name: 'Apr', revenue: 278000 },
  { name: 'May', revenue: 189000 },
  { name: 'Jun', revenue: 239000 },
  { name: 'Jul', revenue: 349000 },
];

export default function AdminDashboard() {
  const { toast } = useToast();
  const [discountModalOpen, setDiscountModalOpen] = useState(false);

  const handleApplyDiscount = () => {
    toast({ title: "Discount Applied", description: "The override has been logged and applied." });
    setDiscountModalOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-muted/10">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r hidden md:block">
        <div className="p-6">
          <h2 className="text-2xl font-heading font-bold text-primary">Admin</h2>
        </div>
        <nav className="space-y-1 px-4">
          <Button variant="ghost" className="w-full justify-start font-medium bg-sidebar-accent text-sidebar-accent-foreground"><Home className="mr-2 h-4 w-4" /> Dashboard</Button>
          <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground"><Users className="mr-2 h-4 w-4" /> Students</Button>
          <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground"><Home className="mr-2 h-4 w-4" /> Properties</Button>
          <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground"><DollarSign className="mr-2 h-4 w-4" /> Payments</Button>
          <Button variant="ghost" className="w-full justify-start font-medium text-muted-foreground"><FileText className="mr-2 h-4 w-4" /> Agreements</Button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-heading font-bold">Dashboard Overview</h1>
          <div className="flex gap-2">
            <Button variant="outline">Download Report</Button>
            <Dialog open={discountModalOpen} onOpenChange={setDiscountModalOpen}>
              <DialogTrigger asChild>
                <Button>Apply Discount Override</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Apply Custom Discount</DialogTitle>
                  <DialogDescription>
                    This action will override the calculated fee for a specific student. Action will be logged.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Student ID</Label>
                    <Input id="student-id" className="col-span-3" placeholder="Enter ID" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Type</Label>
                    <Select>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Flat Amount" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                        <SelectItem value="percent">Percentage (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Value</Label>
                    <Input id="value" className="col-span-3" placeholder="5000" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Reason</Label>
                    <Input id="reason" className="col-span-3" placeholder="Scholarship / Referral" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleApplyDiscount}>Apply Override</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Total Students", value: "1,240", change: "+12%" },
            { label: "Occupancy Rate", value: "88%", change: "+2%" },
            { label: "Revenue (YTD)", value: "₹2.4Cr", change: "+18%" },
            { label: "Pending Payments", value: "₹12L", change: "-5%" },
          ].map((stat, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground text-green-600 mt-1">{stat.change} from last month</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Recent Admissions</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={REVENUE_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                      <Tooltip />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { user: "Admin", action: "Approved discount for S. Gupta", time: "2m ago" },
                      { user: "System", action: "Generated Agreement #AG-293", time: "15m ago" },
                      { user: "Rahul S.", action: "Completed payment ₹1,00,000", time: "1h ago" },
                      { user: "System", action: "Sent payment reminder to 12 students", time: "3h ago" },
                    ].map((activity, i) => (
                      <div key={i} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0">
                        <div>
                          <p className="text-sm font-medium">{activity.action}</p>
                          <p className="text-xs text-muted-foreground">{activity.user}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="students">
            <Card>
              <CardHeader>
                 <CardTitle>Student List</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MOCK_STUDENTS.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.property}</TableCell>
                        <TableCell>{student.room}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{student.payment}</span>
                            {student.due > 0 && <span className="text-xs text-red-500">Due: ₹{student.due}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={student.status === "Active" ? "default" : "secondary"}>
                            {student.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">View</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
           <TabsContent value="inventory">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PROPERTIES.map(prop => (
                 <Card key={prop.id}>
                  <CardHeader>
                    <CardTitle className="flex justify-between">
                      {prop.name}
                      <Badge variant="outline">{prop.location}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {prop.roomTypes.map(room => (
                         <div key={room.id} className="flex items-center justify-between border p-3 rounded-lg">
                           <div className="flex items-center gap-3">
                             <img src={room.image} className="w-12 h-12 rounded object-cover" />
                             <div>
                               <p className="font-bold">{room.name}</p>
                               <p className="text-sm text-muted-foreground">{room.available} beds available</p>
                             </div>
                           </div>
                           <div className="flex gap-2">
                             <Button size="icon" variant="outline" title="Lock Room">
                               <Lock className="w-4 h-4" />
                             </Button>
                             <Button size="icon" variant="outline" title="Release Room">
                               <Unlock className="w-4 h-4" />
                             </Button>
                           </div>
                         </div>
                      ))}
                    </div>
                  </CardContent>
                 </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
