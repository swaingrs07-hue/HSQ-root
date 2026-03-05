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
  Plus, Search, Edit, Trash2, Copy, ChevronDown,
  X, UtensilsCrossed, CreditCard, Shirt, SprayCan, Clock, Lock,
  MoreVertical, Power, IndianRupee, Tag,
  Loader2, AlertCircle, Building2, Bike, Bus, Sparkles, Package
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

interface ServiceItemData {
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

interface ServiceData {
  propertyId: string;
  name: string;
  description: string;
  tagline: string;
  priceType: string;
  basePrice: number;
  currency: string;
  isActive: boolean;
  items: ServiceItemData[];
}

const ITEM_TYPES = [
  { value: "meals", label: "Meals", icon: UtensilsCrossed, color: "bg-orange-100 text-orange-700" },
  { value: "ala_cart_credit", label: "Alacarte Credit", icon: CreditCard, color: "bg-green-100 text-green-700" },
  { value: "shuttle", label: "Express Shuttle", icon: Bus, color: "bg-sky-100 text-sky-700" },
  { value: "ev_bike", label: "EV Bike Access", icon: Bike, color: "bg-teal-100 text-teal-700" },
  { value: "laundry", label: "Cleaning & Laundry", icon: Shirt, color: "bg-blue-100 text-blue-700" },
  { value: "housekeeping", label: "Housekeeping", icon: SprayCan, color: "bg-purple-100 text-purple-700" },
  { value: "early_checkin", label: "Early Check-in", icon: Clock, color: "bg-yellow-100 text-yellow-700" },
  { value: "late_checkout", label: "Late Checkout", icon: Clock, color: "bg-amber-100 text-amber-700" },
  { value: "locker", label: "Locker", icon: Lock, color: "bg-slate-100 text-slate-700" },
  { value: "custom", label: "Custom Service", icon: Tag, color: "bg-gray-100 text-gray-700" },
];

const UNIT_OPTIONS = ["unit", "items/week", "items/month", "meals/day", "credits", "credits/mo", "hours", "days", "per visit", "cloths", "cloths/mo"];

const MEAL_OPTIONS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "evening_snacks", label: "Evening Snacks" },
  { value: "dinner", label: "Dinner" },
];

const emptyService: ServiceData = {
  propertyId: "", name: "", description: "", tagline: "",
  priceType: "PER_MONTH", basePrice: 0, currency: "INR", isActive: true, items: [],
};

export default function AdminAddonServices() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<ServiceData>({ ...emptyService });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItemType, setNewItemType] = useState("meals");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/packages?category=addon_service", { headers });
      if (res.ok) setServices(await res.json());
    } catch { }
    setLoading(false);
  };

  const fetchProperties = async () => {
    try {
      const res = await fetch("/api/admin/properties", { headers });
      if (res.ok) setProperties(await res.json());
    } catch { }
  };

  useEffect(() => { fetchServices(); fetchProperties(); }, []);

  const handleSave = async () => {
    if (!editingService.name.trim()) {
      toast({ title: "Service name is required", variant: "destructive" });
      return;
    }
    if (!editingService.propertyId) {
      toast({ title: "Property is required for add-on services", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...editingService,
        category: "addon_service",
        tierLevel: 0,
        isHighlighted: false,
      };
      const url = editId ? `/api/admin/packages/${editId}` : "/api/admin/packages";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
      toast({ title: editId ? "Service updated" : "Service created" });
      setEditOpen(false);
      setEditId(null);
      fetchServices();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, force = false) => {
    try {
      const url = force ? `/api/admin/packages/${id}?force=true` : `/api/admin/packages/${id}`;
      const res = await fetch(url, { method: "DELETE", headers });
      const data = await res.json();
      if (!res.ok) {
        if (data.attachmentCount && !force) {
          setDeleteConfirm(null);
          if (confirm(`This service has ${data.attachmentCount} active booking attachment(s). Force delete?`)) {
            return handleDelete(id, true);
          }
          return;
        }
        throw new Error(data.error || "Failed to delete");
      }
      toast({ title: "Service deleted" });
      setDeleteConfirm(null);
      fetchServices();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/packages/${id}/duplicate`, { method: "POST", headers });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Service duplicated" });
      fetchServices();
    } catch { toast({ title: "Error duplicating", variant: "destructive" }); }
  };

  const handleToggle = async (id: string) => {
    try {
      await fetch(`/api/admin/packages/${id}/toggle`, { method: "POST", headers });
      fetchServices();
    } catch { }
  };

  const openCreate = () => {
    setEditId(null);
    setEditingService({ ...emptyService });
    setEditOpen(true);
  };

  const openEdit = (svc: any) => {
    setEditId(svc.id);
    setEditingService({
      propertyId: svc.propertyId || "",
      name: svc.name || "",
      description: svc.description || "",
      tagline: svc.tagline || "",
      priceType: svc.priceType || "PER_MONTH",
      basePrice: svc.basePrice || 0,
      currency: svc.currency || "INR",
      isActive: svc.isActive !== false,
      items: (svc.items || []).map((item: any) => ({
        ...item,
        featureValue: item.featureValue || "",
        rules: item.rules || null,
      })),
    });
    setEditOpen(true);
  };

  const addItem = () => {
    const typeInfo = ITEM_TYPES.find(t => t.value === newItemType);
    const defaultRules = newItemType === "meals" ? {
      weekday: { meals: ["breakfast", "evening_snacks", "dinner"], count: 3 },
      saturday: { meals: ["breakfast", "evening_snacks", "dinner"], count: 3 },
      sunday: { meals: ["breakfast", "evening_snacks", "dinner"], count: 3 },
    } : null;
    setEditingService(p => ({
      ...p,
      items: [...p.items, {
        type: newItemType,
        label: typeInfo?.label || newItemType,
        featureValue: "",
        includedQty: newItemType === "meals" ? 3 : 0,
        unit: newItemType === "meals" ? "meals/day" : "unit",
        extraUnitPrice: 0,
        rules: defaultRules,
        isOptional: false,
        maxQty: null,
        sortOrder: p.items.length,
      }],
    }));
    setAddItemOpen(false);
  };

  const removeItem = (idx: number) => {
    setEditingService(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setEditingService(p => ({
      ...p,
      items: p.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const updateItemRules = (idx: number, ruleKey: string, ruleValue: any) => {
    setEditingService(p => ({
      ...p,
      items: p.items.map((item, i) => i === idx ? { ...item, rules: { ...(item.rules || {}), [ruleKey]: ruleValue } } : item),
    }));
  };

  const toggleMeal = (idx: number, dayKey: string, mealValue: string) => {
    setEditingService(p => ({
      ...p,
      items: p.items.map((item, i) => {
        if (i !== idx) return item;
        const rules = { ...(item.rules || {}) };
        const dayRules = rules[dayKey] || { meals: [], count: 0 };
        const meals = Array.isArray(dayRules.meals) ? [...dayRules.meals] : [];
        const exists = meals.includes(mealValue);
        const newMeals = exists ? meals.filter((m: string) => m !== mealValue) : [...meals, mealValue];
        rules[dayKey] = { meals: newMeals, count: newMeals.length };
        return { ...item, rules, includedQty: rules.weekday?.count ?? item.includedQty };
      }),
    }));
  };

  const getItemIcon = (type: string) => {
    const t = ITEM_TYPES.find(i => i.value === type);
    if (!t) return <Tag className="w-3.5 h-3.5" />;
    const Icon = t.icon;
    return <Icon className="w-3.5 h-3.5" />;
  };
  const getItemColor = (type: string) => ITEM_TYPES.find(i => i.value === type)?.color || "bg-gray-100 text-gray-700";

  const getMealNames = (dayRules: any): string[] => {
    if (!dayRules) return [];
    if (typeof dayRules === "number") return [];
    if (dayRules.meals && Array.isArray(dayRules.meals)) {
      return dayRules.meals.map((m: string) => MEAL_OPTIONS.find(o => o.value === m)?.label || m);
    }
    return [];
  };

  const getMealCount = (dayRules: any): number => {
    if (!dayRules) return 0;
    if (typeof dayRules === "number") return dayRules;
    return dayRules.count ?? (dayRules.meals?.length ?? 0);
  };

  const getMealScheduleSummary = (items: any[]) => {
    const mealItem = items.find((i: any) => i.type === "meals" && i.rules);
    if (!mealItem || !mealItem.rules) return null;
    const rules = mealItem.rules;
    const wdNames = getMealNames(rules.weekday);
    const satNames = getMealNames(rules.saturday);
    const sunNames = getMealNames(rules.sunday);
    if (wdNames.length > 0) {
      const wdStr = wdNames.join(", ");
      const satStr = satNames.join(", ");
      const sunStr = sunNames.join(", ");
      if (wdStr === satStr && satStr === sunStr) return `${wdNames.length} meals/day — ${wdStr}`;
      return null;
    }
    const wd = typeof rules.weekday === "number" ? rules.weekday : (rules.weekday?.count ?? mealItem.includedQty ?? 0);
    const sat = typeof rules.saturday === "number" ? rules.saturday : (rules.saturday?.count ?? wd);
    const sun = typeof rules.sunday === "number" ? rules.sunday : (rules.sunday?.count ?? wd);
    if (wd === sat && sat === sun) return `${wd} meals/day`;
    return `Mon–Fri: ${wd} meals | Sat: ${sat} | Sun: ${sun}`;
  };

  const priceLabel = (type: string) => {
    if (type === "ONE_TIME") return "one-time";
    if (type === "PER_DAY") return "/ day";
    if (type === "PER_YEAR") return "/ year";
    return "/ month";
  };

  const filtered = services.filter(s => {
    if (filter === "active" && !s.isActive) return false;
    if (filter === "inactive" && s.isActive) return false;
    if (propertyFilter !== "all" && s.propertyId !== propertyFilter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getPropertyName = (id: string) => {
    const p = properties.find((p: any) => p.id === id);
    return p?.displayName || p?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="h-6 w-6 text-orange-600" /> Add-On Services
          </h1>
          <p className="text-sm text-slate-500 mt-1">Property-specific services like meal plans, laundry, shuttle</p>
        </div>
        <Button onClick={openCreate} className="bg-orange-600 hover:bg-orange-700 gap-1.5" data-testid="button-create-service">
          <Plus className="h-4 w-4" /> Create Service
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search services..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-services" />
        </div>
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-property-filter">
            <Building2 className="h-4 w-4 mr-1.5 text-slate-400" />
            <SelectValue placeholder="All Properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>{p.displayName || p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(["all", "active", "inactive"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} data-testid={`filter-${f}`} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
          <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No add-on services found</p>
          <p className="text-sm text-slate-400 mt-1">Create property-specific services like meal plans or laundry packages</p>
          <Button onClick={openCreate} variant="outline" className="mt-4 gap-1.5"><Plus className="h-4 w-4" /> Create Service</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(svc => (
            <Card key={svc.id} className={`overflow-hidden transition-all hover:shadow-md ${!svc.isActive ? "opacity-60" : ""}`} data-testid={`service-card-${svc.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-lg truncate">{svc.name}</h3>
                    {svc.tagline && <p className="text-xs text-slate-400 mt-0.5 truncate">{svc.tagline}</p>}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" data-testid={`menu-service-${svc.id}`}><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(svc)} data-testid={`edit-service-${svc.id}`}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(svc.id)} data-testid={`duplicate-service-${svc.id}`}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggle(svc.id)} data-testid={`toggle-service-${svc.id}`}><Power className="h-4 w-4 mr-2" /> {svc.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => setDeleteConfirm(svc.id)} data-testid={`delete-service-${svc.id}`}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <Badge variant="outline" className={`text-[10px] ${svc.isActive ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-slate-400 border-slate-200"}`}>
                    {svc.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50">
                    <Building2 className="w-3 h-3 mr-1" /> {getPropertyName(svc.propertyId)}
                  </Badge>
                </div>

                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-bold text-orange-600" data-testid={`price-service-${svc.id}`}>₹{(svc.basePrice || 0).toLocaleString("en-IN")}</span>
                  <span className="text-xs text-slate-400">{priceLabel(svc.priceType)}</span>
                </div>

                {(() => {
                  const mealItem = (svc.items || []).find((i: any) => i.type === "meals" && i.rules);
                  if (!mealItem) return null;
                  const rules = mealItem.rules;
                  const wdNames = getMealNames(rules.weekday);
                  const satNames = getMealNames(rules.saturday);
                  const sunNames = getMealNames(rules.sunday);
                  const wdCount = getMealCount(rules.weekday);
                  const satCount = getMealCount(rules.saturday);
                  const sunCount = getMealCount(rules.sunday);
                  const hasNamedMeals = wdNames.length > 0;
                  return (
                    <div className="mb-3 p-2.5 bg-orange-50 rounded-lg border border-orange-100">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-700 mb-2">
                        <UtensilsCrossed className="w-3.5 h-3.5" /> Meal Schedule
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-start gap-2 text-[11px]">
                          <span className="text-slate-500 font-medium w-14 shrink-0">Mon–Fri</span>
                          <span className="text-slate-700">{hasNamedMeals ? `${wdCount} meals — ${wdNames.join(", ")}` : `${wdCount} meals`}</span>
                        </div>
                        {(satCount !== wdCount || satNames.join(",") !== wdNames.join(",")) && (
                          <div className="flex items-start gap-2 text-[11px]">
                            <span className="text-slate-500 font-medium w-14 shrink-0">Saturday</span>
                            <span className="text-slate-700">{hasNamedMeals ? `${satCount} meals — ${satNames.join(", ")}` : `${satCount} meals`}</span>
                          </div>
                        )}
                        {(sunCount !== wdCount || sunNames.join(",") !== wdNames.join(",")) && (
                          <div className="flex items-start gap-2 text-[11px]">
                            <span className="text-slate-500 font-medium w-14 shrink-0">Sunday</span>
                            <span className="text-slate-700">{hasNamedMeals ? `${sunCount} meals — ${sunNames.join(", ")}` : `${sunCount} meals`}</span>
                          </div>
                        )}
                        {satCount === wdCount && sunCount === wdCount && satNames.join(",") === wdNames.join(",") && sunNames.join(",") === wdNames.join(",") && (
                          <div className="text-[10px] text-slate-400">Same schedule every day</div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {(svc.items || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {svc.items.map((item: any, idx: number) => (
                      <Badge key={idx} className={`text-[10px] ${getItemColor(item.type)}`}>
                        {getItemIcon(item.type)} <span className="ml-1">{item.label}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              {editId ? "Edit Add-On Service" : "Create Add-On Service"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Property <span className="text-red-500">*</span></Label>
                <Select value={editingService.propertyId} onValueChange={v => setEditingService(p => ({ ...p, propertyId: v }))}>
                  <SelectTrigger data-testid="select-service-property">
                    <SelectValue placeholder="Select property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.displayName || p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Service Name <span className="text-red-500">*</span></Label>
                <Input value={editingService.name} onChange={e => setEditingService(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Lunch Plan, 3-Meal Daily Plan" data-testid="input-service-name" />
              </div>
              <div>
                <Label>Tagline</Label>
                <Input value={editingService.tagline} onChange={e => setEditingService(p => ({ ...p, tagline: e.target.value }))} placeholder="e.g., Fresh meals daily" data-testid="input-service-tagline" />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea value={editingService.description} onChange={e => setEditingService(p => ({ ...p, description: e.target.value }))} placeholder="Describe the service..." rows={2} data-testid="input-service-description" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price (₹)</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input type="number" className="pl-9" value={editingService.basePrice} onChange={e => setEditingService(p => ({ ...p, basePrice: parseInt(e.target.value) || 0 }))} data-testid="input-service-price" />
                </div>
              </div>
              <div>
                <Label>Price Type</Label>
                <Select value={editingService.priceType} onValueChange={v => setEditingService(p => ({ ...p, priceType: v }))}>
                  <SelectTrigger data-testid="select-price-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_MONTH">Per Month</SelectItem>
                    <SelectItem value="PER_YEAR">Per Year</SelectItem>
                    <SelectItem value="ONE_TIME">One Time</SelectItem>
                    <SelectItem value="PER_DAY">Per Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={editingService.isActive} onCheckedChange={v => setEditingService(p => ({ ...p, isActive: v }))} data-testid="switch-service-active" />
              <Label className="text-sm">Active</Label>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Service Features</Label>
                <Button variant="outline" size="sm" onClick={() => setAddItemOpen(true)} className="gap-1" data-testid="button-add-feature">
                  <Plus className="h-3.5 w-3.5" /> Add Feature
                </Button>
              </div>

              {editingService.items.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg">
                  <p className="text-sm text-slate-400">No features added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {editingService.items.map((item, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                      <div className="flex items-center justify-between mb-3">
                        <Badge className={getItemColor(item.type)}>
                          {getItemIcon(item.type)} <span className="ml-1">{ITEM_TYPES.find(t => t.value === item.type)?.label || item.type}</span>
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => removeItem(idx)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Label</Label>
                          <Input value={item.label} onChange={e => updateItem(idx, "label", e.target.value)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Display Value</Label>
                          <Input value={item.featureValue} onChange={e => updateItem(idx, "featureValue", e.target.value)} placeholder="e.g., Veg & Non-Veg" className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Included Qty</Label>
                          <Input type="number" value={item.includedQty} onChange={e => updateItem(idx, "includedQty", parseInt(e.target.value) || 0)} className="h-8 text-sm" />
                        </div>
                        <div>
                          <Label className="text-xs">Unit</Label>
                          <select value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)} className="w-full h-8 rounded-md border border-slate-200 bg-white px-2 text-sm">
                            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Extra Unit Price (₹)</Label>
                          <Input type="number" value={item.extraUnitPrice} onChange={e => updateItem(idx, "extraUnitPrice", parseInt(e.target.value) || 0)} className="h-8 text-sm" />
                        </div>
                      </div>

                      {item.type === "meals" && (
                        <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                          <Label className="text-xs font-semibold text-orange-700 mb-3 block">
                            <UtensilsCrossed className="w-3.5 h-3.5 inline mr-1" /> Meal Schedule — Select meals for each day
                          </Label>
                          <div className="space-y-3">
                            {[
                              { key: "weekday", label: "Mon – Fri" },
                              { key: "saturday", label: "Saturday" },
                              { key: "sunday", label: "Sunday" },
                            ].map(day => {
                              const dayRules = item.rules?.[day.key];
                              const selectedMeals: string[] = Array.isArray(dayRules?.meals) ? dayRules.meals : [];
                              return (
                                <div key={day.key} className="bg-white rounded-lg border border-orange-100 p-2.5">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[11px] font-semibold text-slate-700">{day.label}</span>
                                    <span className="text-[10px] text-orange-600 font-medium">{selectedMeals.length} meals</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {MEAL_OPTIONS.map(meal => {
                                      const isSelected = selectedMeals.includes(meal.value);
                                      return (
                                        <button
                                          key={meal.value}
                                          type="button"
                                          onClick={() => toggleMeal(idx, day.key, meal.value)}
                                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                                            isSelected
                                              ? "bg-orange-600 text-white border-orange-600"
                                              : "bg-white text-slate-500 border-slate-200 hover:border-orange-300"
                                          }`}
                                          data-testid={`meal-${day.key}-${meal.value}-${idx}`}
                                        >
                                          {meal.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2">Select which meals are included each day. E.g., add Lunch only on Sat & Sun for 4 meals on weekends.</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700 gap-1.5" data-testid="button-save-service">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editId ? "Update Service" : "Create Service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Feature Type</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {ITEM_TYPES.map(t => (
              <button key={t.value} onClick={() => setNewItemType(t.value)}
                className={`p-3 rounded-lg border text-left transition-colors text-sm ${newItemType === t.value ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:bg-slate-50"}`}
                data-testid={`item-type-${t.value}`}
              >
                <t.icon className="h-4 w-4 mb-1" />
                {t.label}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
            <Button onClick={addItem} className="bg-orange-600" data-testid="button-confirm-add-feature">Add Feature</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" /> Delete Service?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">This will permanently delete this add-on service and all its features.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} data-testid="button-confirm-delete-service">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
