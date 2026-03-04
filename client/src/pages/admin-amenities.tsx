import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import {
  Plus, Trash2, Pencil, GripVertical, Star, Wifi, Shield, Coffee, Users,
  Dumbbell, BookOpen, Heart, Utensils, Award, Clock, MapPin, Building2,
  Sparkles, Calendar, Phone, Upload, Loader2, Image as ImageIcon, Eye, EyeOff,
} from "lucide-react";

const ICON_OPTIONS = [
  { value: "Star", label: "Star", icon: Star },
  { value: "Dumbbell", label: "Fitness/Gym", icon: Dumbbell },
  { value: "BookOpen", label: "Study/Library", icon: BookOpen },
  { value: "Utensils", label: "Dining/Food", icon: Utensils },
  { value: "Wifi", label: "WiFi/Internet", icon: Wifi },
  { value: "Shield", label: "Security", icon: Shield },
  { value: "Coffee", label: "Cafe/Lounge", icon: Coffee },
  { value: "Users", label: "Community", icon: Users },
  { value: "Heart", label: "Wellness", icon: Heart },
  { value: "Award", label: "Premium", icon: Award },
  { value: "Clock", label: "24/7 Service", icon: Clock },
  { value: "MapPin", label: "Location", icon: MapPin },
  { value: "Building2", label: "Building", icon: Building2 },
  { value: "Sparkles", label: "Special", icon: Sparkles },
  { value: "Calendar", label: "Events", icon: Calendar },
  { value: "Phone", label: "Support", icon: Phone },
];

const ICON_MAP: Record<string, any> = {
  Star, Wifi, Shield, Coffee, Users, Dumbbell, BookOpen, Heart, Utensils,
  Award, Clock, MapPin, Building2, Sparkles, Calendar, Phone,
};

interface AmenityForm {
  title: string;
  description: string;
  imageUrl: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: AmenityForm = {
  title: "",
  description: "",
  imageUrl: "",
  icon: "Star",
  sortOrder: 0,
  isActive: true,
};

export default function AdminAmenities() {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AmenityForm>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  const { data: amenities = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/homepage-amenities"],
    queryFn: async () => {
      const res = await fetch("/api/homepage-amenities");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AmenityForm) => {
      const res = await fetch("/api/admin/homepage-amenities", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homepage-amenities"] });
      toast({ title: "Amenity added" });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AmenityForm }) => {
      const res = await fetch(`/api/admin/homepage-amenities/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homepage-amenities"] });
      toast({ title: "Amenity updated" });
      setDialogOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/homepage-amenities/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homepage-amenities"] });
      toast({ title: "Amenity removed" });
    },
  });

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setForm(prev => ({ ...prev, imageUrl: data.url }));
      toast({ title: "Image uploaded" });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: amenities.length });
    setDialogOpen(true);
  };

  const openEdit = (amenity: any) => {
    setEditingId(amenity.id);
    setForm({
      title: amenity.title,
      description: amenity.description,
      imageUrl: amenity.imageUrl,
      icon: amenity.icon,
      sortOrder: amenity.sortOrder,
      isActive: amenity.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title || !form.imageUrl) {
      toast({ title: "Title and image are required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const IconComp = ICON_MAP[form.icon] || Star;

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "Manrope, sans-serif" }} data-testid="text-page-title">
              Amenities & Facilities
            </h1>
            <p className="text-gray-500 text-sm mt-1">Manage the amenities shown on the homepage</p>
          </div>
          <Button onClick={openCreate} data-testid="button-add-amenity">
            <Plus className="w-4 h-4 mr-2" />
            Add Amenity
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : amenities.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No amenities yet</h3>
              <p className="text-gray-400 text-sm mb-6">Add amenities to display on the homepage "Amenities & Facilities" section</p>
              <Button onClick={openCreate} variant="outline" data-testid="button-add-first-amenity">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Amenity
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {amenities.map((amenity: any) => {
              const AIcon = ICON_MAP[amenity.icon] || Star;
              return (
                <Card key={amenity.id} className={`overflow-hidden ${!amenity.isActive ? "opacity-60" : ""}`} data-testid={`amenity-card-${amenity.id}`}>
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={amenity.imageUrl}
                      alt={amenity.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-amber-500/90 flex items-center justify-center">
                          <AIcon className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="text-white font-bold text-lg">{amenity.title}</h3>
                      </div>
                      <p className="text-white/70 text-sm">{amenity.description}</p>
                    </div>
                    {!amenity.isActive && (
                      <div className="absolute top-2 left-2 bg-gray-900/80 text-white text-xs px-2 py-1 rounded">
                        Hidden
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-gray-900/60 text-white text-xs px-2 py-1 rounded">
                      Order: {amenity.sortOrder}
                    </div>
                  </div>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {amenity.isActive ? (
                        <><Eye className="w-3.5 h-3.5" /> Visible</>
                      ) : (
                        <><EyeOff className="w-3.5 h-3.5" /> Hidden</>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(amenity)} data-testid={`button-edit-${amenity.id}`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (confirm("Delete this amenity?")) deleteMutation.mutate(amenity.id);
                        }}
                        data-testid={`button-delete-${amenity.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Amenity" : "Add Amenity"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Fitness Center"
                  data-testid="input-amenity-title"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., State-of-the-art equipment for your wellness journey"
                  rows={2}
                  data-testid="input-amenity-description"
                />
              </div>
              <div>
                <Label>Icon</Label>
                <Select value={form.icon} onValueChange={v => setForm(prev => ({ ...prev, icon: v }))}>
                  <SelectTrigger data-testid="select-amenity-icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          <opt.icon className="w-4 h-4" />
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Image *</Label>
                {form.imageUrl ? (
                  <div className="relative mt-1">
                    <img src={form.imageUrl} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-2 right-2"
                      onClick={() => setForm(prev => ({ ...prev, imageUrl: "" }))}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition-colors">
                      {uploading ? (
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      ) : (
                        <>
                          <Upload className="w-6 h-6 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-500">Click to upload image</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(f);
                        }}
                        data-testid="input-amenity-image"
                      />
                    </label>
                    <div className="mt-2">
                      <Label className="text-xs text-gray-400">Or paste image URL:</Label>
                      <Input
                        placeholder="https://..."
                        onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                        className="mt-1"
                        data-testid="input-amenity-image-url"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    value={form.sortOrder}
                    onChange={e => setForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                    data-testid="input-amenity-sort"
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={v => setForm(prev => ({ ...prev, isActive: v }))}
                    data-testid="switch-amenity-active"
                  />
                  <Label>{form.isActive ? "Visible" : "Hidden"}</Label>
                </div>
              </div>
              {form.imageUrl && form.title && (
                <div className="border rounded-lg overflow-hidden">
                  <p className="text-xs text-gray-400 px-3 py-1 bg-gray-50">Preview</p>
                  <div className="relative aspect-[16/10]">
                    <img src={form.imageUrl} alt={form.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-amber-500/90 flex items-center justify-center">
                          <IconComp className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="text-white font-bold">{form.title}</h3>
                      </div>
                      {form.description && <p className="text-white/70 text-sm">{form.description}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-amenity"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? "Update" : "Add"} Amenity
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}