import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  Package, Plus, Search, Edit, Trash2, Copy, ChevronDown, ChevronUp,
  GripVertical, X, Shirt, CreditCard, UtensilsCrossed, SprayCan,
  Clock, Lock, MoreVertical, Eye, Power, IndianRupee, Tag,
  Loader2, AlertCircle, CheckCircle2
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface PackageItemData {
  id?: string;
  type: string;
  label: string;
  includedQty: number;
  unit: string;
  extraUnitPrice: number;
  rules: any;
  isOptional: boolean;
  maxQty: number | null;
  sortOrder: number;
}

interface PackageData {
  id?: string;
  name: string;
  description: string;
  priceType: string;
  basePrice: number;
  currency: string;
  taxPercent: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  items: PackageItemData[];
}

const ITEM_TYPES = [
  { value: "laundry", label: "Laundry", icon: Shirt, color: "bg-blue-100 text-blue-700" },
  { value: "ala_cart_credit", label: "Ala Carte Credit", icon: CreditCard, color: "bg-green-100 text-green-700" },
  { value: "meals", label: "Meals Plan", icon: UtensilsCrossed, color: "bg-orange-100 text-orange-700" },
  { value: "housekeeping", label: "Housekeeping", icon: SprayCan, color: "bg-purple-100 text-purple-700" },
  { value: "early_checkin", label: "Early Check-in", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  { value: "late_checkout", label: "Late Checkout", icon: Clock, color: "bg-amber-100 text-amber-700" },
  { value: "locker", label: "Locker", icon: Lock, color: "bg-slate-100 text-slate-700" },
  { value: "custom", label: "Custom", icon: Tag, color: "bg-gray-100 text-gray-700" },
];

const UNIT_OPTIONS = ["unit", "items/week", "items/month", "meals/day", "credits", "hours", "days", "per visit"];

const emptyPackage: PackageData = {
  name: "", description: "", priceType: "PER_MONTH", basePrice: 0, currency: "INR",
  taxPercent: "", validFrom: "", validTo: "", isActive: true, items: [],
};

export default function AdminPackages() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageData>(emptyPackage);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItemType, setNewItemType] = useState("laundry");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/packages", { headers });
      if (res.ok) setPackages(await res.json());
    } catch { }
    setLoading(false);
  };

  useEffect(() => { fetchPackages(); }, []);

  const filtered = packages.filter(p => {
    if (filter === "active" && !p.isActive) return false;
    if (filter === "inactive" && p.isActive) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => { setEditingPkg({ ...emptyPackage }); setEditId(null); setDialogOpen(true); };
  const openEdit = (pkg: any) => {
    setEditingPkg({
      name: pkg.name, description: pkg.description || "", priceType: pkg.priceType,
      basePrice: pkg.basePrice, currency: pkg.currency || "INR", taxPercent: pkg.taxPercent || "",
      validFrom: pkg.validFrom ? new Date(pkg.validFrom).toISOString().slice(0, 10) : "",
      validTo: pkg.validTo ? new Date(pkg.validTo).toISOString().slice(0, 10) : "",
      isActive: pkg.isActive, items: pkg.items || [],
    });
    setEditId(pkg.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingPkg.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        ...editingPkg,
        basePrice: Number(editingPkg.basePrice) || 0,
        taxPercent: editingPkg.taxPercent ? String(editingPkg.taxPercent) : null,
        validFrom: editingPkg.validFrom || null,
        validTo: editingPkg.validTo || null,
      };
      const url = editId ? `/api/admin/packages/${editId}` : "/api/admin/packages";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
      toast({ title: editId ? "Package updated" : "Package created" });
      setDialogOpen(false);
      fetchPackages();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/packages/${id}`, { method: "DELETE", headers });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to delete");
      toast({ title: "Package deleted" });
      setDeleteConfirm(null);
      fetchPackages();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/packages/${id}/duplicate`, { method: "POST", headers });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Package duplicated" });
      fetchPackages();
    } catch { toast({ title: "Error duplicating", variant: "destructive" }); }
  };

  const handleToggle = async (id: string) => {
    try {
      await fetch(`/api/admin/packages/${id}/toggle`, { method: "POST", headers });
      fetchPackages();
    } catch { }
  };

  const addItem = () => {
    const typeInfo = ITEM_TYPES.find(t => t.value === newItemType);
    const newItem: PackageItemData = {
      type: newItemType, label: typeInfo?.label || "Custom Item", includedQty: 0,
      unit: newItemType === "ala_cart_credit" ? "credits" : newItemType === "meals" ? "meals/day" : "unit",
      extraUnitPrice: 0, rules: newItemType === "meals" ? { breakfast: true, lunch: true, dinner: true, vegOnly: false } : null,
      isOptional: false, maxQty: null, sortOrder: editingPkg.items.length,
    };
    setEditingPkg(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setAddItemOpen(false);
  };

  const updateItem = (idx: number, updates: Partial<PackageItemData>) => {
    setEditingPkg(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, ...updates } : item),
    }));
  };

  const removeItem = (idx: number) => {
    setEditingPkg(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    if (idx + dir < 0 || idx + dir >= editingPkg.items.length) return;
    setEditingPkg(prev => {
      const items = [...prev.items];
      [items[idx], items[idx + dir]] = [items[idx + dir], items[idx]];
      return { ...prev, items };
    });
  };

  const getItemIcon = (type: string) => {
    const t = ITEM_TYPES.find(i => i.value === type);
    return t ? <t.icon className="h-4 w-4" /> : <Tag className="h-4 w-4" />;
  };

  const getItemColor = (type: string) => ITEM_TYPES.find(i => i.value === type)?.color || "bg-gray-100 text-gray-700";

  const totalItemsValue = editingPkg.items.reduce((s, i) => s + (i.includedQty * (i.extraUnitPrice || 0)), 0);

  return (
    <div className="space-y-6 p-1" data-testid="admin-packages-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-600" /> Package Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage service packages for bookings</p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700" data-testid="button-create-package">
          <Plus className="h-4 w-4 mr-2" /> Create Package
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search packages..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" data-testid="input-search-packages" />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className={filter === f ? "bg-indigo-600" : ""} data-testid={`filter-${f}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-dashed border-2 border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer flex items-center justify-center min-h-[200px]" onClick={openCreate} data-testid="card-create-package">
          <div className="text-center text-slate-400">
            <Plus className="h-10 w-10 mx-auto mb-2" />
            <p className="font-medium">Create New Package</p>
          </div>
        </Card>

        {loading ? Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-4 bg-slate-200 rounded w-3/4 mb-3" /><div className="h-3 bg-slate-100 rounded w-1/2 mb-4" /><div className="h-8 bg-slate-100 rounded w-1/3" /></CardContent></Card>
        )) : filtered.map(pkg => (
          <Card key={pkg.id} className={`relative overflow-hidden transition-all hover:shadow-lg ${!pkg.isActive ? "opacity-70 border-slate-200" : "border-indigo-100"}`} data-testid={`card-package-${pkg.id}`}>
            <div className={`absolute top-0 left-0 right-0 h-1 ${pkg.isActive ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-slate-300"}`} />
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate" data-testid={`text-package-name-${pkg.id}`}>{pkg.name}</h3>
                  {pkg.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{pkg.description}</p>}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid={`menu-package-${pkg.id}`}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(pkg)} data-testid={`action-edit-${pkg.id}`}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(pkg.id)} data-testid={`action-duplicate-${pkg.id}`}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggle(pkg.id)} data-testid={`action-toggle-${pkg.id}`}><Power className="h-4 w-4 mr-2" /> {pkg.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteConfirm(pkg.id)} className="text-red-600" data-testid={`action-delete-${pkg.id}`}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge className={pkg.isActive ? "bg-emerald-100 text-emerald-700 border-0" : "bg-slate-100 text-slate-500 border-0"}>
                  {pkg.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {pkg.priceType === "ONE_TIME" ? "One-Time" : pkg.priceType === "PER_DAY" ? "Per Day" : "Per Month"}
                </Badge>
              </div>

              <div className="flex items-center gap-1 text-lg font-bold text-indigo-600 mb-3">
                <IndianRupee className="h-4 w-4" />
                {Number(pkg.basePrice).toLocaleString("en-IN")}
                <span className="text-xs text-slate-400 font-normal">
                  {pkg.taxPercent ? `+ ${pkg.taxPercent}% tax` : ""}
                </span>
              </div>

              {pkg.items && pkg.items.length > 0 && (
                <div>
                  <button className="flex items-center gap-1 text-xs text-slate-500 mb-2" onClick={() => setExpandedCards(prev => { const n = new Set(prev); n.has(pkg.id) ? n.delete(pkg.id) : n.add(pkg.id); return n; })} data-testid={`toggle-items-${pkg.id}`}>
                    {expandedCards.has(pkg.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {pkg.items.length} service{pkg.items.length > 1 ? "s" : ""} included
                  </button>
                  {expandedCards.has(pkg.id) && (
                    <div className="space-y-1.5">
                      {pkg.items.map((item: any, i: number) => (
                        <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${getItemColor(item.type)}`}>
                          {getItemIcon(item.type)}
                          <span className="font-medium">{item.label}</span>
                          {item.includedQty > 0 && <span className="ml-auto text-[10px] opacity-75">{item.includedQty} {item.unit}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No packages found</p>
          <p className="text-sm mt-1">Create your first package to get started</p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" />
              {editId ? "Edit Package" : "Create Package"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Package Name *</Label>
                <Input value={editingPkg.name} onChange={e => setEditingPkg(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Premium Living Package" data-testid="input-package-name" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea value={editingPkg.description} onChange={e => setEditingPkg(p => ({ ...p, description: e.target.value }))} placeholder="Package description..." rows={2} data-testid="input-package-desc" />
              </div>
              <div className="space-y-2">
                <Label>Price Type</Label>
                <Select value={editingPkg.priceType} onValueChange={v => setEditingPkg(p => ({ ...p, priceType: v }))}>
                  <SelectTrigger data-testid="select-price-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONE_TIME">One-Time</SelectItem>
                    <SelectItem value="PER_DAY">Per Day</SelectItem>
                    <SelectItem value="PER_MONTH">Per Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Base Price (₹)</Label>
                <Input type="number" value={editingPkg.basePrice} onChange={e => setEditingPkg(p => ({ ...p, basePrice: Number(e.target.value) }))} data-testid="input-base-price" />
              </div>
              <div className="space-y-2">
                <Label>Tax %</Label>
                <Input type="number" value={editingPkg.taxPercent} onChange={e => setEditingPkg(p => ({ ...p, taxPercent: e.target.value }))} placeholder="e.g. 18" data-testid="input-tax-percent" />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={editingPkg.currency} onChange={e => setEditingPkg(p => ({ ...p, currency: e.target.value }))} data-testid="input-currency" />
              </div>
              <div className="space-y-2">
                <Label>Valid From</Label>
                <Input type="date" value={editingPkg.validFrom} onChange={e => setEditingPkg(p => ({ ...p, validFrom: e.target.value }))} data-testid="input-valid-from" />
              </div>
              <div className="space-y-2">
                <Label>Valid To</Label>
                <Input type="date" value={editingPkg.validTo} onChange={e => setEditingPkg(p => ({ ...p, validTo: e.target.value }))} data-testid="input-valid-to" />
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">Service Items ({editingPkg.items.length})</h3>
                <Button size="sm" variant="outline" onClick={() => setAddItemOpen(true)} className="border-indigo-200 text-indigo-600" data-testid="button-add-item">
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>

              {editingPkg.items.length === 0 && (
                <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center text-slate-400">
                  <Tag className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No items yet. Add services to this package.</p>
                </div>
              )}

              <div className="space-y-3">
                {editingPkg.items.map((item, idx) => (
                  <div key={idx} className="border rounded-xl p-4 bg-white shadow-sm" data-testid={`item-${idx}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-slate-300 hover:text-slate-500 disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                        <button onClick={() => moveItem(idx, 1)} disabled={idx === editingPkg.items.length - 1} className="text-slate-300 hover:text-slate-500 disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                      </div>
                      <Badge className={getItemColor(item.type)}>{getItemIcon(item.type)} <span className="ml-1">{ITEM_TYPES.find(t => t.value === item.type)?.label || item.type}</span></Badge>
                      <div className="flex-1" />
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-slate-500">Optional</Label>
                        <Switch checked={item.isOptional} onCheckedChange={v => updateItem(idx, { isOptional: v })} />
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => removeItem(idx)} data-testid={`remove-item-${idx}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input value={item.label} onChange={e => updateItem(idx, { label: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Included Qty</Label>
                        <Input type="number" value={item.includedQty} onChange={e => updateItem(idx, { includedQty: Number(e.target.value) })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit</Label>
                        <Select value={item.unit} onValueChange={v => updateItem(idx, { unit: v })}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Extra ₹/unit</Label>
                        <Input type="number" value={item.extraUnitPrice} onChange={e => updateItem(idx, { extraUnitPrice: Number(e.target.value) })} className="h-8 text-sm" />
                      </div>
                      {item.maxQty !== null && item.maxQty !== undefined && (
                        <div className="space-y-1">
                          <Label className="text-xs">Max Qty</Label>
                          <Input type="number" value={item.maxQty || ""} onChange={e => updateItem(idx, { maxQty: e.target.value ? Number(e.target.value) : null })} className="h-8 text-sm" />
                        </div>
                      )}
                      {item.type === "meals" && item.rules && (
                        <div className="col-span-2 md:col-span-4 flex flex-wrap gap-3 pt-1">
                          {["breakfast", "lunch", "dinner"].map(meal => (
                            <label key={meal} className="flex items-center gap-1.5 text-xs">
                              <input type="checkbox" checked={item.rules?.[meal] ?? false} onChange={e => updateItem(idx, { rules: { ...item.rules, [meal]: e.target.checked } })} className="rounded" />
                              {meal.charAt(0).toUpperCase() + meal.slice(1)}
                            </label>
                          ))}
                          <label className="flex items-center gap-1.5 text-xs">
                            <input type="checkbox" checked={item.rules?.vegOnly ?? false} onChange={e => updateItem(idx, { rules: { ...item.rules, vegOnly: e.target.checked } })} className="rounded" />
                            Veg Only
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4">
              <h4 className="font-semibold text-sm text-indigo-800 mb-2">Preview</h4>
              <div className="flex items-center gap-2 text-lg font-bold text-indigo-700 mb-1">
                <IndianRupee className="h-4 w-4" />
                {Number(editingPkg.basePrice).toLocaleString("en-IN")}
                <span className="text-xs font-normal text-slate-500">
                  / {editingPkg.priceType === "ONE_TIME" ? "one-time" : editingPkg.priceType === "PER_DAY" ? "day" : "month"}
                  {editingPkg.taxPercent ? ` + ${editingPkg.taxPercent}% tax` : ""}
                </span>
              </div>
              {editingPkg.items.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-slate-600">Included benefits:</p>
                  {editingPkg.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      {item.label}: {item.includedQty} {item.unit}
                      {item.isOptional && <span className="text-[10px] text-slate-400">(optional)</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700" data-testid="button-save-package">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editId ? "Update Package" : "Create Package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Service Item</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {ITEM_TYPES.map(t => (
              <button key={t.value} onClick={() => { setNewItemType(t.value); }} className={`p-4 rounded-xl border-2 text-left transition-all ${newItemType === t.value ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`} data-testid={`item-type-${t.value}`}>
                <div className={`inline-flex p-2 rounded-lg mb-2 ${t.color}`}>
                  <t.icon className="h-5 w-5" />
                </div>
                <p className="font-medium text-sm">{t.label}</p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
            <Button onClick={addItem} className="bg-indigo-600" data-testid="button-confirm-add-item">Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" /> Delete Package?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">This will permanently delete this package and all its items. Active booking attachments will prevent deletion.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} data-testid="button-confirm-delete">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}