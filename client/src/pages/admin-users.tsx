import { useState, useEffect, useCallback, useMemo, Component, ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Search, Users, UserPlus, Shield, Building2, MoreVertical, Edit, Power, AlertTriangle, Filter, X, RefreshCw, Trash2, ArrowRightLeft, GraduationCap, UserCircle2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

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

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <Alert variant="destructive" className="max-w-md mx-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{this.state.error?.message}</AlertDescription>
          </Alert>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
            variant="outline"
            className="mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "superadmin" | "manager" | "staff" | "sales_executive" | "frontdesk" | "student" | "user";
  isActive: boolean;
  createdAt: string;
  assignedProperties?: any[];
  totalLeads?: number;
  canShiftBed?: boolean;
}

type PanelKey = "staff" | "users";

const STAFF_ROLES = ["admin", "superadmin", "manager", "sales_executive", "frontdesk", "staff"] as const;
const USER_ROLES = ["user", "student"] as const;

function isStaffRole(role: string): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

function AdminUsersContent() {
  const { token, user: currentUser } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<PanelKey>("staff");

  // Per-panel filter state (kept independent so switching tabs doesn't leak state)
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>("all");
  const [staffStatusFilter, setStaffStatusFilter] = useState<string>("all");
  const [usersSearch, setUsersSearch] = useState("");
  const [usersRoleFilter, setUsersRoleFilter] = useState<string>("all");
  const [usersStatusFilter, setUsersStatusFilter] = useState<string>("all");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [createForm, setCreateForm] = useState({ name: "", email: "", phone: "", password: "", role: "sales_executive" });
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", role: "" });

  const [dependencies, setDependencies] = useState<{
    leads: number;
    activeLeads: number;
    properties: number;
  } | null>(null);
  const [isLastAdmin, setIsLastAdmin] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [reassignLeads, setReassignLeads] = useState(true);
  const [reassignProperties, setReassignProperties] = useState(true);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Classify users into staff vs end-user buckets
  const staffUsers = useMemo(() => users.filter(u => isStaffRole(u.role)), [users]);
  const endUsers = useMemo(() => users.filter(u => !isStaffRole(u.role)), [users]);

  const applyFilters = (
    list: User[],
    search: string,
    roleFilter: string,
    statusFilter: string,
  ) => list.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      (user.phone && user.phone.includes(search));
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? user.isActive : !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredStaff = useMemo(
    () => applyFilters(staffUsers, staffSearch, staffRoleFilter, staffStatusFilter),
    [staffUsers, staffSearch, staffRoleFilter, staffStatusFilter],
  );
  const filteredEndUsers = useMemo(
    () => applyFilters(endUsers, usersSearch, usersRoleFilter, usersStatusFilter),
    [endUsers, usersSearch, usersRoleFilter, usersStatusFilter],
  );

  const staffStats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      total: staffUsers.length,
      active: staffUsers.filter(u => u.isActive).length,
      admins: staffUsers.filter(u => u.role === "admin" || u.role === "superadmin").length,
      salesExecs: staffUsers.filter(u => u.role === "sales_executive").length,
    };
  }, [staffUsers]);

  const usersStats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const newThisMonth = endUsers.filter(u => {
      const createdAt = u.createdAt ? new Date(u.createdAt) : null;
      return createdAt && createdAt >= thirtyDaysAgo;
    }).length;
    return {
      total: endUsers.length,
      active: endUsers.filter(u => u.isActive).length,
      students: endUsers.filter(u => u.role === "student").length,
      newThisMonth,
    };
  }, [endUsers]);

  const openCreateDialog = () => {
    setCreateForm({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: activePanel === "staff" ? "sales_executive" : "user",
    });
    setCreateDialogOpen(true);
  };

  const createUser = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    try {
      setCreating(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(createForm)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create user");
      }
      toast({ title: "Success", description: "User created successfully" });
      setCreateDialogOpen(false);
      setCreateForm({ name: "", email: "", phone: "", password: "", role: activePanel === "staff" ? "sales_executive" : "user" });
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const updateUser = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });
      if (!res.ok) throw new Error("Failed to update user");
      toast({ title: "Success", description: "User updated" });
      setEditDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const toggleUserStatus = async () => {
    if (!selectedUser) return;
    try {
      setDeactivating(true);
      const endpoint = selectedUser.isActive ? "deactivate" : "reactivate";
      const res = await fetch(`/api/admin/users/${selectedUser.id}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Failed to ${endpoint} user`);
      toast({ title: "Success", description: `User ${selectedUser.isActive ? "deactivated" : "reactivated"}` });
      setDeactivateDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeactivating(false);
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setEditForm({ name: user.name, email: user.email, phone: user.phone || "", role: user.role });
    setEditDialogOpen(true);
  };

  const openDeactivateDialog = (user: User) => {
    setSelectedUser(user);
    setDeactivateDialogOpen(true);
  };

  const checkDependencies = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/dependencies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to check dependencies");
      return await res.json();
    } catch (error) {
      console.error("Error checking dependencies:", error);
      return null;
    }
  };

  const openReassignDialog = async (user: User) => {
    setSelectedUser(user);
    setTargetUserId("");
    setReassignLeads(true);
    setReassignProperties(true);
    setDependencies(null);
    setReassignDialogOpen(true);
    const deps = await checkDependencies(user.id);
    if (deps) {
      setDependencies(deps.dependencies);
      setIsLastAdmin(deps.isLastAdmin);
      setCanDelete(deps.canDelete);
    }
  };

  const openDeleteDialog = async (user: User) => {
    setSelectedUser(user);
    setDeleteConfirmText("");
    setDependencies(null);
    setIsLastAdmin(false);
    setCanDelete(false);
    setDeleteDialogOpen(true);
    const deps = await checkDependencies(user.id);
    if (deps) {
      setDependencies(deps.dependencies);
      setIsLastAdmin(deps.isLastAdmin);
      setCanDelete(deps.canDelete);
    }
  };

  const reassignUserItems = async () => {
    if (!selectedUser || !targetUserId) return;
    try {
      setReassigning(true);
      const res = await fetch(`/api/admin/users/${selectedUser.id}/reassign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ toUserId: targetUserId, reassignLeads, reassignProperties })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reassign");
      }
      const result = await res.json();
      toast({ title: "Success", description: result.message });
      setReassignDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setReassigning(false);
    }
  };

  const deleteUser = async () => {
    if (!selectedUser) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ confirmText: deleteConfirmText })
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.requireConfirm) {
          toast({ title: "Confirmation Required", description: "Type DELETE to confirm admin deletion", variant: "destructive" });
          return;
        }
        throw new Error(err.error || "Failed to delete");
      }
      toast({ title: "Success", description: "User removed successfully" });
      setDeleteDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const activeUsers = users.filter(u => u.isActive && u.id !== selectedUser?.id && u.id !== currentUser?.id);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "superadmin":
        return <Badge className="bg-rose-600 text-white"><Shield className="h-3 w-3 mr-1" /> Superadmin</Badge>;
      case "admin":
        return <Badge className="bg-purple-500 text-white"><Shield className="h-3 w-3 mr-1" /> Admin</Badge>;
      case "manager":
        return <Badge className="bg-amber-500 text-white"><Shield className="h-3 w-3 mr-1" /> Manager</Badge>;
      case "sales_executive":
        return <Badge className="bg-blue-500 text-white"><Users className="h-3 w-3 mr-1" /> Sales</Badge>;
      case "frontdesk":
        return <Badge className="bg-teal-500 text-white">Frontdesk</Badge>;
      case "staff":
        return <Badge className="bg-slate-500 text-white">Staff</Badge>;
      case "student":
        return <Badge className="bg-emerald-500 text-white"><GraduationCap className="h-3 w-3 mr-1" /> Student</Badge>;
      default:
        return <Badge variant="secondary"><UserCircle2 className="h-3 w-3 mr-1" /> User</Badge>;
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const toggleShiftBedAccess = async (userId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/shift-bed-access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ canShiftBed: enabled }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, canShiftBed: enabled } : u));
      toast({
        title: enabled ? "Shift Bed access granted" : "Shift Bed access revoked",
        description: enabled
          ? "This staff member can now shift resident beds."
          : "This staff member can no longer shift beds.",
      });
    } catch {
      toast({ title: "Error", description: "Could not update Shift Bed access", variant: "destructive" });
    }
  };

  const isSuperAdmin = currentUser?.role === "superadmin";

  const renderUserRow = (user: User, panel: PanelKey) => (
    <TableRow key={user.id} className="hover:bg-slate-50/50" data-testid={`row-${panel}-${user.id}`}>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell className="text-slate-600">{user.email}</TableCell>
      <TableCell className="text-slate-600">{user.phone || "-"}</TableCell>
      <TableCell>{getRoleBadge(user.role)}</TableCell>
      <TableCell>
        <Badge variant={user.isActive ? "default" : "secondary"}>
          {user.isActive ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      {panel === "staff" && isSuperAdmin && (
        <TableCell>
          {["superadmin", "admin", "frontdesk"].includes(user.role) ? (
            <span className="text-xs text-slate-400 italic">By role</span>
          ) : (
            <div className="flex items-center gap-2">
              <Switch
                checked={!!user.canShiftBed}
                onCheckedChange={(val) => toggleShiftBedAccess(user.id, val)}
                data-testid={`switch-shift-bed-${user.id}`}
              />
              <span className={`text-xs font-medium ${user.canShiftBed ? "text-emerald-600" : "text-slate-400"}`}>
                {user.canShiftBed ? "On" : "Off"}
              </span>
            </div>
          )}
        </TableCell>
      )}
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" data-testid={`button-${panel}-actions-${user.id}`}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(user)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            {user.id !== currentUser?.id && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => openDeactivateDialog(user)}
                  className={user.isActive ? "text-orange-600" : "text-green-600"}
                >
                  <Power className="h-4 w-4 mr-2" />
                  {user.isActive ? "Deactivate" : "Reactivate"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openReassignDialog(user)}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Reassign Items
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => openDeleteDialog(user)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove User
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );

  const renderEmptyRow = (search: string, role: string, status: string, defaultMsg: string, colSpan = 6) => (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center py-8 text-slate-500">
        {search || role !== "all" || status !== "all"
          ? "No matches for your filters"
          : defaultMsg}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
          <p className="text-slate-500">Manage staff and end-user accounts in separate views</p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="bg-indigo-600 hover:bg-indigo-700"
          data-testid="button-create-user"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add {activePanel === "staff" ? "Staff" : "User"}
        </Button>
      </div>

      <Tabs value={activePanel} onValueChange={(v) => setActivePanel(v as PanelKey)}>
        <TabsList>
          <TabsTrigger value="staff" data-testid="tab-staff">
            <Shield className="h-4 w-4 mr-2" /> Staff ({staffStats.total})
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <UserCircle2 className="h-4 w-4 mr-2" /> Users ({usersStats.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white" data-testid="stat-staff-total">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100">
                    <Users className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{staffStats.total}</p>
                    <p className="text-sm text-slate-500">Total Staff</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white" data-testid="stat-staff-active">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <Power className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-700">{staffStats.active}</p>
                    <p className="text-sm text-slate-500">Active Staff</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-white" data-testid="stat-staff-admins">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Shield className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-700">{staffStats.admins}</p>
                    <p className="text-sm text-slate-500">Admins</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white" data-testid="stat-staff-sales">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{staffStats.salesExecs}</p>
                    <p className="text-sm text-slate-500">Sales Team</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-lg">Staff Members</CardTitle>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search staff..."
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      className="pl-9 w-full sm:w-64"
                      data-testid="input-search-staff"
                    />
                  </div>
                  <Select value={staffRoleFilter} onValueChange={setStaffRoleFilter}>
                    <SelectTrigger className="w-full sm:w-40" data-testid="select-staff-role-filter">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="superadmin">Superadmin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="sales_executive">Sales</SelectItem>
                      <SelectItem value="frontdesk">Frontdesk</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={staffStatusFilter} onValueChange={setStaffStatusFilter}>
                    <SelectTrigger className="w-full sm:w-36" data-testid="select-staff-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    {isSuperAdmin && <TableHead className="w-28">Shift Bed</TableHead>}
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.length === 0
                    ? renderEmptyRow(staffSearch, staffRoleFilter, staffStatusFilter, "No staff members yet", isSuperAdmin ? 7 : 6)
                    : filteredStaff.map((u) => renderUserRow(u, "staff"))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white" data-testid="stat-users-total">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100">
                    <Users className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{usersStats.total}</p>
                    <p className="text-sm text-slate-500">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white" data-testid="stat-users-active">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <Power className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-700">{usersStats.active}</p>
                    <p className="text-sm text-slate-500">Active Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white" data-testid="stat-users-students">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <GraduationCap className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-700">{usersStats.students}</p>
                    <p className="text-sm text-slate-500">Students</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white" data-testid="stat-users-new">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <UserPlus className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-700">{usersStats.newThisMonth}</p>
                    <p className="text-sm text-slate-500">New This Month</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-lg">End Users</CardTitle>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search users..."
                      value={usersSearch}
                      onChange={(e) => setUsersSearch(e.target.value)}
                      className="pl-9 w-full sm:w-64"
                      data-testid="input-search-users"
                    />
                  </div>
                  <Select value={usersRoleFilter} onValueChange={setUsersRoleFilter}>
                    <SelectTrigger className="w-full sm:w-40" data-testid="select-users-role-filter">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={usersStatusFilter} onValueChange={setUsersStatusFilter}>
                    <SelectTrigger className="w-full sm:w-36" data-testid="select-users-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEndUsers.length === 0
                    ? renderEmptyRow(usersSearch, usersRoleFilter, usersStatusFilter, "No users yet")
                    : filteredEndUsers.map((u) => renderUserRow(u, "users"))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New {activePanel === "staff" ? "Staff Member" : "User"}</DialogTitle>
            <DialogDescription>
              {activePanel === "staff"
                ? "Create a new internal team member account"
                : "Create a new end-user account"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                placeholder="Full name"
                data-testid="input-create-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                placeholder="email@example.com"
                data-testid="input-create-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Phone</Label>
              <Input
                id="create-phone"
                value={createForm.phone}
                onChange={(e) => setCreateForm({...createForm, phone: e.target.value})}
                placeholder="+91 9876543210"
                data-testid="input-create-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-password">Password *</Label>
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                placeholder="Enter password"
                data-testid="input-create-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-role">Role *</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm({...createForm, role: v})}>
                <SelectTrigger id="create-role" data-testid="select-create-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {currentUser?.role === "superadmin" && <SelectItem value="superadmin">Superadmin</SelectItem>}
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sales_executive">Sales Executive</SelectItem>
                  <SelectItem value="frontdesk">Frontdesk</SelectItem>
                  <SelectItem value="user">Regular User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button onClick={createUser} disabled={creating} data-testid="button-confirm-create">
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details for {selectedUser?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                data-testid="input-edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}>
                <SelectTrigger id="edit-role" data-testid="select-edit-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {currentUser?.role === "superadmin" && <SelectItem value="superadmin">Superadmin</SelectItem>}
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sales_executive">Sales Executive</SelectItem>
                  <SelectItem value="frontdesk">Frontdesk</SelectItem>
                  <SelectItem value="user">Regular User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={updateUser} data-testid="button-confirm-edit">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={selectedUser?.isActive ? "h-5 w-5 text-orange-500" : "h-5 w-5 text-green-500"} />
              {selectedUser?.isActive ? "Deactivate" : "Reactivate"} {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.isActive
                ? "This user will no longer be able to log in or perform any actions."
                : "This user will regain access to their account."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)} data-testid="button-cancel-status">
              Cancel
            </Button>
            <Button
              onClick={toggleUserStatus}
              disabled={deactivating}
              className={selectedUser?.isActive ? "bg-orange-500 hover:bg-orange-600" : "bg-green-500 hover:bg-green-600"}
              data-testid="button-confirm-status"
            >
              {deactivating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedUser?.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-blue-500" />
              Reassign Items from {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              Transfer leads and property assignments to another team member before removing this user.
            </DialogDescription>
          </DialogHeader>
          {!dependencies && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-500">Loading assignments...</span>
            </div>
          )}
          {dependencies && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <p className="text-2xl font-bold text-slate-900">{dependencies.leads}</p>
                  <p className="text-sm text-slate-500">Total Leads</p>
                </Card>
                <Card className="p-4">
                  <p className="text-2xl font-bold text-slate-900">{dependencies.properties}</p>
                  <p className="text-sm text-slate-500">Properties</p>
                </Card>
              </div>

              {(dependencies.leads > 0 || dependencies.properties > 0) && (
                <>
                  <div className="space-y-2">
                    <Label>Reassign to</Label>
                    <Select value={targetUserId} onValueChange={setTargetUserId}>
                      <SelectTrigger data-testid="select-reassign-target">
                        <SelectValue placeholder="Select a team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="reassign-leads"
                        checked={reassignLeads}
                        onCheckedChange={(checked) => setReassignLeads(checked as boolean)}
                      />
                      <Label htmlFor="reassign-leads" className="text-sm">
                        Reassign all leads ({dependencies.leads})
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="reassign-properties"
                        checked={reassignProperties}
                        onCheckedChange={(checked) => setReassignProperties(checked as boolean)}
                      />
                      <Label htmlFor="reassign-properties" className="text-sm">
                        Reassign property assignments ({dependencies.properties})
                      </Label>
                    </div>
                  </div>
                </>
              )}

              {dependencies.leads === 0 && dependencies.properties === 0 && (
                <Alert>
                  <AlertDescription>This user has no active assignments to reassign.</AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={reassignUserItems}
              disabled={reassigning || !targetUserId || (dependencies?.leads === 0 && dependencies?.properties === 0)}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-confirm-reassign"
            >
              {reassigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Remove {selectedUser?.name}
            </DialogTitle>
            <DialogDescription>
              This will permanently remove the user from the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!dependencies && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-500">Checking dependencies...</span>
              </div>
            )}

            {dependencies && isLastAdmin && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Cannot Remove</AlertTitle>
                <AlertDescription>This is the last admin account and cannot be deleted.</AlertDescription>
              </Alert>
            )}

            {dependencies && !canDelete && !isLastAdmin && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Active Assignments</AlertTitle>
                <AlertDescription>
                  This user has {dependencies.leads} leads and {dependencies.properties} property assignments.
                  Please reassign these items before removing the user.
                </AlertDescription>
              </Alert>
            )}

            {dependencies && canDelete && !isLastAdmin && (
              <>
                <p className="text-sm text-slate-600">
                  Are you sure you want to remove this user? This action cannot be undone.
                </p>
                {(selectedUser?.role === "admin" || selectedUser?.role === "superadmin") && (
                  <div className="space-y-2">
                    <Label className="text-sm text-red-600 font-medium">
                      Type DELETE to confirm admin removal
                    </Label>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      data-testid="input-delete-confirm"
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={deleteUser}
              disabled={
                deleting ||
                isLastAdmin ||
                !canDelete ||
                ((selectedUser?.role === "admin" || selectedUser?.role === "superadmin") && deleteConfirmText !== "DELETE")
              }
              variant="destructive"
              data-testid="button-confirm-delete"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminUsers() {
  return (
    <ErrorBoundary>
      <AdminUsersContent />
    </ErrorBoundary>
  );
}
