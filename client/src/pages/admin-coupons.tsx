import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Ticket,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  IndianRupee,
  Users,
  Percent,
  Tag,
  Calendar,
  Copy,
  Sparkles,
} from "lucide-react";

type CouponStatus = "active" | "paused" | "expired" | "exhausted";
type CouponDiscountType = "percent" | "flat";

interface CouponStats {
  redemptions: number;
  totalDiscount: number;
  totalRevenue: number;
}

interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minBookingValue: number;
  maxDiscount: number | null;
  validFrom: string;
  validUntil: string | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usageCount: number;
  applicablePropertyIds: string[] | null;
  applicableRoomTypeIds: string[] | null;
  firstBookingOnly: boolean;
  status: CouponStatus;
  createdAt: string;
  updatedAt: string;
  stats?: CouponStats;
}

interface FormState {
  code: string;
  name: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: string;
  minBookingValue: string;
  maxDiscount: string;
  validFrom: string;
  validUntil: string;
  usageLimit: string;
  perUserLimit: string;
  firstBookingOnly: boolean;
  status: CouponStatus;
}

const emptyForm: FormState = {
  code: "",
  name: "",
  description: "",
  discountType: "percent",
  discountValue: "",
  minBookingValue: "0",
  maxDiscount: "",
  validFrom: "",
  validUntil: "",
  usageLimit: "",
  perUserLimit: "1",
  firstBookingOnly: false,
  status: "active",
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function statusVariant(status: CouponStatus): { bg: string; text: string; label: string } {
  switch (status) {
    case "active":
      return { bg: "bg-emerald-100", text: "text-emerald-800", label: "Active" };
    case "paused":
      return { bg: "bg-amber-100", text: "text-amber-800", label: "Paused" };
    case "expired":
      return { bg: "bg-slate-200", text: "text-slate-700", label: "Expired" };
    case "exhausted":
      return { bg: "bg-rose-100", text: "text-rose-800", label: "Exhausted" };
  }
}

function toFormState(c: Coupon): FormState {
  return {
    code: c.code,
    name: c.name,
    description: c.description ?? "",
    discountType: c.discountType,
    discountValue: String(c.discountValue),
    minBookingValue: String(c.minBookingValue ?? 0),
    maxDiscount: c.maxDiscount === null ? "" : String(c.maxDiscount),
    validFrom: c.validFrom ? c.validFrom.slice(0, 10) : "",
    validUntil: c.validUntil ? c.validUntil.slice(0, 10) : "",
    usageLimit: c.usageLimit === null ? "" : String(c.usageLimit),
    perUserLimit: c.perUserLimit === null ? "" : String(c.perUserLimit),
    firstBookingOnly: c.firstBookingOnly,
    status: c.status,
  };
}

function buildPayload(f: FormState) {
  const validFrom = f.validFrom ? new Date(f.validFrom).toISOString() : new Date().toISOString();
  return {
    code: f.code.trim().toUpperCase(),
    name: f.name.trim(),
    description: f.description.trim() || null,
    discountType: f.discountType,
    discountValue: Number(f.discountValue) || 0,
    minBookingValue: Number(f.minBookingValue) || 0,
    maxDiscount: f.maxDiscount.trim() === "" ? null : Number(f.maxDiscount),
    validFrom,
    validUntil: f.validUntil ? new Date(f.validUntil).toISOString() : null,
    usageLimit: f.usageLimit.trim() === "" ? null : Number(f.usageLimit),
    perUserLimit: f.perUserLimit.trim() === "" ? null : Number(f.perUserLimit),
    firstBookingOnly: f.firstBookingOnly,
    status: f.status,
  };
}

export default function AdminCoupons() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CouponStatus>("all");
  const [confirmDelete, setConfirmDelete] = useState<Coupon | null>(null);

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/admin/coupons"],
  });

  const createMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildPayload>) => {
      const res = await apiRequest("POST", "/api/admin/coupons", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Coupon created" });
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "Could not create", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/coupons/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Coupon updated" });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: "Could not update", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/coupons/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      toast({ title: "Coupon deleted" });
      setConfirmDelete(null);
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e?.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm(toFormState(c));
    setDialogOpen(true);
  };

  const submit = () => {
    if (!form.code.trim() || !form.name.trim() || !form.discountValue) {
      toast({ title: "Missing fields", description: "Code, name and discount value are required", variant: "destructive" });
      return;
    }
    if (form.discountType === "percent" && (Number(form.discountValue) <= 0 || Number(form.discountValue) > 100)) {
      toast({ title: "Invalid percent", description: "Percent discount must be 1-100", variant: "destructive" });
      return;
    }
    const payload = buildPayload(form);
    if (editing) updateMutation.mutate({ id: editing.id, payload });
    else createMutation.mutate(payload);
  };

  const filtered = useMemo(() => {
    return coupons.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });
  }, [coupons, search, statusFilter]);

  // Top-line metrics across the entire program
  const metrics = useMemo(() => {
    const active = coupons.filter((c) => c.status === "active").length;
    let totalRedemptions = 0;
    let totalDiscount = 0;
    let totalRevenue = 0;
    coupons.forEach((c) => {
      if (c.stats) {
        totalRedemptions += c.stats.redemptions;
        totalDiscount += c.stats.totalDiscount;
        totalRevenue += c.stats.totalRevenue;
      }
    });
    return { active, totalRedemptions, totalDiscount, totalRevenue };
  }, [coupons]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground" data-testid="text-eyebrow">
            Promotion Engine
          </p>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="heading-coupons">
            <Ticket className="h-7 w-7 text-indigo-600" />
            Coupons
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create promotional codes (HSQ100, NEWUSER50) with expiry, usage limits and revenue tracking.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2" data-testid="button-new-coupon">
          <Plus className="h-4 w-4" /> New Coupon
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> Active
            </div>
            <div className="text-2xl font-bold mt-1" data-testid="metric-active">
              {metrics.active}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Users className="h-3.5 w-3.5" /> Redemptions
            </div>
            <div className="text-2xl font-bold mt-1" data-testid="metric-redemptions">
              {metrics.totalRedemptions}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <IndianRupee className="h-3.5 w-3.5" /> Discount Given
            </div>
            <div className="text-2xl font-bold mt-1" data-testid="metric-discount">
              {inr(metrics.totalDiscount)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <TrendingUp className="h-3.5 w-3.5" /> Revenue Driven
            </div>
            <div className="text-2xl font-bold mt-1" data-testid="metric-revenue">
              {inr(metrics.totalRevenue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + table */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="text-lg">All coupons</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Input
              placeholder="Search code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
              data-testid="input-search"
            />
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="exhausted">Exhausted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading coupons…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Ticket className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No coupons yet. Click "New Coupon" to create your first promo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const variant = statusVariant(c.status);
                    return (
                      <TableRow key={c.id} data-testid={`row-coupon-${c.id}`}>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(c.code);
                              toast({ title: "Copied", description: c.code });
                            }}
                            className="inline-flex items-center gap-1 font-mono text-sm font-semibold hover:text-indigo-600"
                            data-testid={`text-code-${c.id}`}
                          >
                            {c.code}
                            <Copy className="h-3 w-3 opacity-50" />
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{c.name}</div>
                          {c.firstBookingOnly && (
                            <div className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold mt-0.5">
                              First booking only
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            {c.discountType === "percent" ? (
                              <>
                                <Percent className="h-3 w-3 text-indigo-500" />
                                {c.discountValue}%
                              </>
                            ) : (
                              <>
                                <IndianRupee className="h-3 w-3 text-indigo-500" />
                                {c.discountValue}
                              </>
                            )}
                          </div>
                          {c.maxDiscount && c.discountType === "percent" && (
                            <div className="text-[10px] text-muted-foreground">max {inr(c.maxDiscount)}</div>
                          )}
                          {c.minBookingValue > 0 && (
                            <div className="text-[10px] text-muted-foreground">min {inr(c.minBookingValue)}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {c.usageCount}
                            {c.usageLimit ? ` / ${c.usageLimit}` : ""}
                          </div>
                          {c.perUserLimit && (
                            <div className="text-[10px] text-muted-foreground">{c.perUserLimit}/user</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {c.validUntil ? `until ${new Date(c.validUntil).toLocaleDateString()}` : "no expiry"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <div>{c.stats?.redemptions ?? 0} bookings</div>
                            <div className="text-emerald-600 font-medium">+{inr(c.stats?.totalRevenue ?? 0)}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${variant.bg} ${variant.text} border-0`}>{variant.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(c)}
                              data-testid={`button-edit-${c.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setConfirmDelete(c)}
                              data-testid={`button-delete-${c.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-indigo-600" />
              {editing ? "Edit Coupon" : "New Coupon"}
            </DialogTitle>
            <DialogDescription>
              Set up a promo code with discount, expiry and usage rules. Codes are uppercased automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="md:col-span-1">
              <Label htmlFor="coupon-code">Code *</Label>
              <Input
                id="coupon-code"
                placeholder="HSQ100"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="font-mono uppercase"
                data-testid="input-code"
              />
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="coupon-name">Name *</Label>
              <Input
                id="coupon-name"
                placeholder="₹100 off first stay"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="input-name"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="coupon-desc">Description</Label>
              <Textarea
                id="coupon-desc"
                placeholder="Show this on the coupon apply box"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                data-testid="input-description"
              />
            </div>

            <div>
              <Label>Discount Type *</Label>
              <Select
                value={form.discountType}
                onValueChange={(v: any) => setForm({ ...form, discountType: v })}
              >
                <SelectTrigger data-testid="select-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percent (%)</SelectItem>
                  <SelectItem value="flat">Flat (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="coupon-value">
                Discount Value * {form.discountType === "percent" ? "(1-100)" : "(₹)"}
              </Label>
              <Input
                id="coupon-value"
                type="number"
                placeholder={form.discountType === "percent" ? "10" : "500"}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                data-testid="input-discount-value"
              />
            </div>

            <div>
              <Label htmlFor="coupon-min">Min Booking Value (₹)</Label>
              <Input
                id="coupon-min"
                type="number"
                placeholder="0"
                value={form.minBookingValue}
                onChange={(e) => setForm({ ...form, minBookingValue: e.target.value })}
                data-testid="input-min-booking"
              />
            </div>
            <div>
              <Label htmlFor="coupon-max">Max Discount Cap (₹)</Label>
              <Input
                id="coupon-max"
                type="number"
                placeholder="Only for % type"
                value={form.maxDiscount}
                onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                disabled={form.discountType !== "percent"}
                data-testid="input-max-discount"
              />
            </div>

            <div>
              <Label htmlFor="coupon-from">Valid From</Label>
              <Input
                id="coupon-from"
                type="date"
                value={form.validFrom}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                data-testid="input-valid-from"
              />
            </div>
            <div>
              <Label htmlFor="coupon-until">Valid Until</Label>
              <Input
                id="coupon-until"
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                data-testid="input-valid-until"
              />
            </div>

            <div>
              <Label htmlFor="coupon-usage">Total Usage Limit</Label>
              <Input
                id="coupon-usage"
                type="number"
                placeholder="Blank = unlimited"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                data-testid="input-usage-limit"
              />
            </div>
            <div>
              <Label htmlFor="coupon-peruser">Per User Limit</Label>
              <Input
                id="coupon-peruser"
                type="number"
                placeholder="1"
                value={form.perUserLimit}
                onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                data-testid="input-per-user-limit"
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="exhausted">Exhausted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3 pb-2">
              <Switch
                id="first-only"
                checked={form.firstBookingOnly}
                onCheckedChange={(v) => setForm({ ...form, firstBookingOnly: v })}
                data-testid="switch-first-booking"
              />
              <Label htmlFor="first-only" className="text-sm cursor-pointer">First booking only</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {editing ? "Save Changes" : "Create Coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete coupon?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-mono font-semibold">{confirmDelete?.code}</span>.
              Past redemption records remain for reporting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
