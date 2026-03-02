import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
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
  X, Shirt, CreditCard, UtensilsCrossed, SprayCan,
  Clock, Lock, MoreVertical, Power, IndianRupee, Tag,
  Loader2, AlertCircle, CheckCircle2, Building2, Star, Bike, Bus, Sparkles
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface PackageItemData {
  id?: string;
  type: string;
  label: string;
  featureValue: string;
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
  propertyId: string;
  name: string;
  description: string;
  tagline: string;
  priceType: string;
  basePrice: number;
  currency: string;
  taxPercent: string;
  tierLevel: number;
  isHighlighted: boolean;
  occupancy: string;
  locationInfo: string;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  items: PackageItemData[];
}

const ITEM_TYPES = [
  { value: "meals", label: "Daily Meals", icon: UtensilsCrossed, color: "bg-orange-100 text-orange-700" },
  { value: "ala_cart_credit", label: "Alacarte Kitchen", icon: CreditCard, color: "bg-green-100 text-green-700" },
  { value: "shuttle", label: "Express Shuttle", icon: Bus, color: "bg-sky-100 text-sky-700" },
  { value: "ev_bike", label: "EV Bike Access", icon: Bike, color: "bg-teal-100 text-teal-700" },
  { value: "laundry", label: "Cleaning & Laundry", icon: Shirt, color: "bg-blue-100 text-blue-700" },
  { value: "housekeeping", label: "Housekeeping", icon: SprayCan, color: "bg-purple-100 text-purple-700" },
  { value: "early_checkin", label: "Early Check-in", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  { value: "late_checkout", label: "Late Checkout", icon: Clock, color: "bg-amber-100 text-amber-700" },
  { value: "locker", label: "Locker", icon: Lock, color: "bg-slate-100 text-slate-700" },
  { value: "custom", label: "Custom Feature", icon: Tag, color: "bg-gray-100 text-gray-700" },
];

const UNIT_OPTIONS = ["unit", "items/week", "items/month", "meals/day", "credits", "credits/mo", "hours", "days", "per visit", "cloths", "cloths/mo"];

const emptyPackage: PackageData = {
  propertyId: "", name: "", description: "", tagline: "", priceType: "PER_MONTH", basePrice: 0,
  currency: "INR", taxPercent: "", tierLevel: 0, isHighlighted: false,
  occupancy: "", locationInfo: "", validFrom: "", validTo: "", isActive: true, items: [],
};

export default function AdminPackages() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [packages, setPackages] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageData>(emptyPackage);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItemType, setNewItemType] = useState("meals");
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

  const fetchProperties = async () => {
    try {
      const res = await fetch("/api/properties");
      if (res.ok) setProperties(await res.json());
    } catch { }
  };

  useEffect(() => { fetchPackages(); fetchProperties(); }, []);

  const filtered = packages.filter(p => {
    if (filter === "active" && !p.isActive) return false;
    if (filter === "inactive" && p.isActive) return false;
    if (propertyFilter !== "all" && p.propertyId !== propertyFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getPropertyName = (pid: string | null) => {
    if (!pid) return "Global";
    return properties.find(p => p.id === pid)?.name || "Unknown";
  };

  const openCreate = () => { setEditingPkg({ ...emptyPackage }); setEditId(null); setDialogOpen(true); };
  const openEdit = (pkg: any) => {
    setEditingPkg({
      propertyId: pkg.propertyId || "",
      name: pkg.name, description: pkg.description || "", tagline: pkg.tagline || "",
      priceType: pkg.priceType, basePrice: pkg.basePrice, currency: pkg.currency || "INR",
      taxPercent: pkg.taxPercent || "", tierLevel: pkg.tierLevel || 0,
      isHighlighted: pkg.isHighlighted || false, occupancy: pkg.occupancy || "",
      locationInfo: pkg.locationInfo || "",
      validFrom: pkg.validFrom ? new Date(pkg.validFrom).toISOString().slice(0, 10) : "",
      validTo: pkg.validTo ? new Date(pkg.validTo).toISOString().slice(0, 10) : "",
      isActive: pkg.isActive, items: (pkg.items || []).map((it: any) => ({ ...it, featureValue: it.featureValue || "" })),
    });
    setEditId(pkg.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingPkg.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!editingPkg.propertyId) { toast({ title: "Please select a property", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const body = {
        ...editingPkg,
        basePrice: Number(editingPkg.basePrice) || 0,
        taxPercent: editingPkg.taxPercent ? String(editingPkg.taxPercent) : null,
        tierLevel: Number(editingPkg.tierLevel) || 0,
        validFrom: editingPkg.validFrom || null,
        validTo: editingPkg.validTo || null,
      };
      const url = editId ? `/api/admin/packages/${editId}` : "/api/admin/packages";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
      toast({ title: editId ? "Plan updated" : "Plan created" });
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
      toast({ title: "Plan deleted" });
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
      toast({ title: "Plan duplicated" });
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
      type: newItemType, label: typeInfo?.label || "Custom Feature", featureValue: "",
      includedQty: 0,
      unit: newItemType === "ala_cart_credit" ? "credits/mo" : newItemType === "meals" ? "meals/day" : newItemType === "laundry" ? "cloths" : "unit",
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

  const groupedByProperty = filtered.reduce((acc: Record<string, any[]>, pkg) => {
    const key = pkg.propertyId || "global";
    if (!acc[key]) acc[key] = [];
    acc[key].push(pkg);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-1" data-testid="admin-packages-page">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-indigo-600" /> Housing Plans
          </h1>
          <p className="text-sm text-slate-500 mt-1">Create property-specific service tiers shown to users</p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700" data-testid="button-create-package">
          <Plus className="h-4 w-4 mr-2" /> Create Plan
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search plans..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" data-testid="input-search-packages" />
        </div>
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-48" data-testid="filter-property">
            <Building2 className="h-4 w-4 mr-2 text-slate-400" />
            <SelectValue placeholder="All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map(f => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className={filter === f ? "bg-indigo-600" : ""} data-testid={`filter-${f}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {Object.entries(groupedByProperty).map(([propId, plans]) => {
        const sortedPlans = [...plans].sort((a, b) => (a.tierLevel || 0) - (b.tierLevel || 0));
        return (
          <div key={propId} className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-500" />
              <h2 className="font-semibold text-slate-800">{getPropertyName(propId === "global" ? null : propId)}</h2>
              <Badge variant="outline" className="text-xs">{plans.length} plan{plans.length > 1 ? "s" : ""}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedPlans.map(pkg => (
                <Card key={pkg.id} className={`relative overflow-hidden transition-all hover:shadow-lg ${pkg.isHighlighted ? "border-2 border-indigo-400 shadow-indigo-100 shadow-md" : !pkg.isActive ? "opacity-70 border-slate-200" : "border-slate-200"}`} data-testid={`card-package-${pkg.id}`}>
                  {pkg.isHighlighted && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-center text-[10px] font-bold uppercase tracking-wider py-1">
                      <Star className="h-3 w-3 inline mr-1" /> Most Popular
                    </div>
                  )}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${!pkg.isHighlighted ? (pkg.isActive ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-slate-300") : ""}`} />
                  <CardContent className={`p-5 ${pkg.isHighlighted ? "pt-8" : ""}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate" data-testid={`text-package-name-${pkg.id}`}>{pkg.name}</h3>
                        {pkg.tagline && <p className="text-xs text-indigo-600 font-medium mt-0.5">{pkg.tagline}</p>}
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
                      {pkg.occupancy && <Badge variant="outline" className="text-xs">{pkg.occupancy}</Badge>}
                      <Badge variant="outline" className="text-xs">Tier {pkg.tierLevel || 0}</Badge>
                    </div>

                    <div className="flex items-center gap-1 text-lg font-bold text-indigo-600 mb-3">
                      <IndianRupee className="h-4 w-4" />
                      {Number(pkg.basePrice).toLocaleString("en-IN")}
                      <span className="text-xs text-slate-400 font-normal">
                        / {pkg.priceType === "ONE_TIME" ? "one-time" : pkg.priceType === "PER_DAY" ? "day" : "year"}
                      </span>
                    </div>

                    {pkg.locationInfo && <p className="text-xs text-slate-500 mb-2">{pkg.locationInfo}</p>}

                    {pkg.items && pkg.items.length > 0 && (
                      <div>
                        <button className="flex items-center gap-1 text-xs text-slate-500 mb-2" onClick={() => setExpandedCards(prev => { const n = new Set(prev); n.has(pkg.id) ? n.delete(pkg.id) : n.add(pkg.id); return n; })} data-testid={`toggle-items-${pkg.id}`}>
                          {expandedCards.has(pkg.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {pkg.items.length} feature{pkg.items.length > 1 ? "s" : ""} included
                        </button>
                        {expandedCards.has(pkg.id) && (
                          <div className="space-y-1.5">
                            {pkg.items.map((item: any, i: number) => (
                              <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs bg-slate-50">
                                <span className="flex items-center gap-1.5">
                                  <span className={`inline-flex p-1 rounded ${getItemColor(item.type)}`}>{getItemIcon(item.type)}</span>
                                  <span className="font-medium text-slate-700">{item.label}</span>
                                </span>
                                <span className="font-semibold text-slate-800 text-right">{item.featureValue || `${item.includedQty} ${item.unit}`}</span>
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
          </div>
        );
      })}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No plans found</p>
          <p className="text-sm mt-1">Create your first housing plan for a property</p>
        </div>
      )}

      <Card className="border-dashed border-2 border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer flex items-center justify-center min-h-[120px]" onClick={openCreate} data-testid="card-create-package">
        <div className="text-center text-slate-400">
          <Plus className="h-10 w-10 mx-auto mb-2" />
          <p className="font-medium">Create New Plan</p>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-indigo-600" />
              {editId ? "Edit Plan" : "Create Plan"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
              <h3 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-1.5"><Building2 className="h-4 w-4" /> Property & Tier</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Property *</Label>
                  <Select value={editingPkg.propertyId} onValueChange={v => setEditingPkg(p => ({ ...p, propertyId: v }))}>
                    <SelectTrigger data-testid="select-property"><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>
                      {properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Plan Name *</Label>
                  <Input value={editingPkg.name} onChange={e => setEditingPkg(p => ({ ...p, name: e.target.value }))} placeholder="e.g. THE HIGHLANDER" data-testid="input-package-name" />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input value={editingPkg.tagline} onChange={e => setEditingPkg(p => ({ ...p, tagline: e.target.value }))} placeholder="e.g. The Essentials, Most Popular" data-testid="input-tagline" />
                </div>
                <div className="space-y-2">
                  <Label>Tier Level (display order)</Label>
                  <Input type="number" value={editingPkg.tierLevel} onChange={e => setEditingPkg(p => ({ ...p, tierLevel: Number(e.target.value) }))} placeholder="0, 1, 2..." data-testid="input-tier-level" />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch checked={editingPkg.isHighlighted} onCheckedChange={v => setEditingPkg(p => ({ ...p, isHighlighted: v }))} data-testid="switch-highlighted" />
                  <Label className="text-sm flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-amber-500" /> Highlight as "Most Popular"</Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea value={editingPkg.description} onChange={e => setEditingPkg(p => ({ ...p, description: e.target.value }))} placeholder="Plan description..." rows={2} data-testid="input-package-desc" />
              </div>
              <div className="space-y-2">
                <Label>Annual / Base Fee (₹)</Label>
                <Input type="number" value={editingPkg.basePrice} onChange={e => setEditingPkg(p => ({ ...p, basePrice: Number(e.target.value) }))} data-testid="input-base-price" />
              </div>
              <div className="space-y-2">
                <Label>Price Type</Label>
                <Select value={editingPkg.priceType} onValueChange={v => setEditingPkg(p => ({ ...p, priceType: v }))}>
                  <SelectTrigger data-testid="select-price-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONE_TIME">One-Time</SelectItem>
                    <SelectItem value="PER_DAY">Per Day</SelectItem>
                    <SelectItem value="PER_MONTH">Per Month / Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Occupancy</Label>
                <Input value={editingPkg.occupancy} onChange={e => setEditingPkg(p => ({ ...p, occupancy: e.target.value }))} placeholder="e.g. Triple Sharing" data-testid="input-occupancy" />
              </div>
              <div className="space-y-2">
                <Label>Location / Floors</Label>
                <Input value={editingPkg.locationInfo} onChange={e => setEditingPkg(p => ({ ...p, locationInfo: e.target.value }))} placeholder="e.g. Floors 2 - 6" data-testid="input-location-info" />
              </div>
              <div className="space-y-2">
                <Label>Tax %</Label>
                <Input type="number" value={editingPkg.taxPercent} onChange={e => setEditingPkg(p => ({ ...p, taxPercent: e.target.value }))} placeholder="e.g. 18" data-testid="input-tax-percent" />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={editingPkg.currency} onChange={e => setEditingPkg(p => ({ ...p, currency: e.target.value }))} data-testid="input-currency" />
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">Lifestyle Features ({editingPkg.items.length})</h3>
                <Button size="sm" variant="outline" onClick={() => setAddItemOpen(true)} className="border-indigo-200 text-indigo-600" data-testid="button-add-item">
                  <Plus className="h-4 w-4 mr-1" /> Add Feature
                </Button>
              </div>

              {editingPkg.items.length === 0 && (
                <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center text-slate-400">
                  <Sparkles className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No features yet. Add lifestyle features to this plan.</p>
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
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => removeItem(idx)} data-testid={`remove-item-${idx}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input value={item.label} onChange={e => updateItem(idx, { label: e.target.value })} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs">Display Value (shown to users)</Label>
                        <Input value={item.featureValue} onChange={e => updateItem(idx, { featureValue: e.target.value })} className="h-8 text-sm" placeholder="e.g. 3 Meals + High Tea, ₹3,000/mo Credit, 48 cloths" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Included Qty (tracking)</Label>
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
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4">
              <h4 className="font-semibold text-sm text-indigo-800 mb-2 flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Preview</h4>
              <p className="text-lg font-bold text-slate-900">{editingPkg.name || "Plan Name"}</p>
              {editingPkg.tagline && <p className="text-sm text-indigo-600 font-medium">{editingPkg.tagline}</p>}
              <div className="flex items-center gap-1 text-2xl font-bold text-indigo-700 mt-2 mb-1">
                <IndianRupee className="h-5 w-5" />
                {Number(editingPkg.basePrice).toLocaleString("en-IN")}
              </div>
              {editingPkg.occupancy && <p className="text-xs text-slate-500">{editingPkg.occupancy} | {editingPkg.locationInfo}</p>}
              {editingPkg.items.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {editingPkg.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        {item.label}
                      </span>
                      <span className="font-semibold text-slate-800">{item.featureValue || `${item.includedQty} ${item.unit}`}</span>
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
              {editId ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Lifestyle Feature</DialogTitle>
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
            <Button onClick={addItem} className="bg-indigo-600" data-testid="button-confirm-add-item">Add Feature</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" /> Delete Plan?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">This will permanently delete this plan and all its features. Active booking attachments will prevent deletion.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} data-testid="button-confirm-delete">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
