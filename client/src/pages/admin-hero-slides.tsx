import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, Edit2, GripVertical, Image as ImageIcon,
  Upload, Eye, EyeOff, ArrowUp, ArrowDown, Loader2, X
} from "lucide-react";

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string | null;
  caption: string | null;
  imageUrl: string;
  videoUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export default function AdminHeroSlides() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    caption: "",
    imageUrl: "",
    videoUrl: "",
    isActive: true,
  });
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const { data: slides = [], isLoading } = useQuery<HeroSlide[]>({
    queryKey: ["/api/hero-slides"],
    queryFn: async () => {
      const res = await fetch("/api/hero-slides", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch slides");
      return res.json();
    },
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/hero-slides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data,
          sortOrder: slides.length,
        }),
      });
      if (!res.ok) throw new Error("Failed to create slide");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hero-slides"] });
      resetForm();
      setIsAddOpen(false);
      toast({ title: "Slide added successfully" });
    },
    onError: () => toast({ title: "Failed to add slide", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof form> }) => {
      const res = await fetch(`/api/hero-slides/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update slide");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hero-slides"] });
      setEditingSlide(null);
      resetForm();
      toast({ title: "Slide updated successfully" });
    },
    onError: () => toast({ title: "Failed to update slide", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/hero-slides/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete slide");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hero-slides"] });
      toast({ title: "Slide deleted" });
    },
    onError: () => toast({ title: "Failed to delete slide", variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (slideIds: string[]) => {
      const res = await fetch("/api/hero-slides/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slideIds }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hero-slides"] });
    },
  });

  const resetForm = () => {
    setForm({ title: "", subtitle: "", caption: "", imageUrl: "", videoUrl: "", isActive: true });
    setPreviewUrl(null);
  };

  const compressImage = (file: File, maxWidth = 1920, quality = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const compressed = new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" });
            resolve(compressed);
          },
          "image/webp",
          quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleUploadImage = async (file: File) => {
    setUploading(true);
    try {
      const originalSize = file.size;
      const compressed = await compressImage(file);
      const savedPercent = Math.round((1 - compressed.size / originalSize) * 100);

      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: compressed.name,
          size: compressed.size,
          contentType: compressed.type,
        }),
      });

      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        body: compressed,
        headers: { "Content-Type": compressed.type },
      });

      if (!uploadRes.ok) throw new Error("Failed to upload file");

      setForm((prev) => ({ ...prev, imageUrl: objectPath }));
      setPreviewUrl(URL.createObjectURL(compressed));
      toast({
        title: "Image uploaded & compressed",
        description: `${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024 / 1024).toFixed(1)}MB (${savedPercent}% smaller)`,
      });
    } catch (error) {
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "Please select an image file", variant: "destructive" });
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: "Image must be under 20MB", variant: "destructive" });
        return;
      }
      handleUploadImage(file);
    }
  };

  const moveSlide = (index: number, direction: "up" | "down") => {
    const newSlides = [...slides];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newSlides.length) return;
    [newSlides[index], newSlides[swapIndex]] = [newSlides[swapIndex], newSlides[index]];
    reorderMutation.mutate(newSlides.map((s) => s.id));
  };

  const openEditDialog = (slide: HeroSlide) => {
    setEditingSlide(slide);
    setForm({
      title: slide.title,
      subtitle: slide.subtitle || "",
      caption: slide.caption || "",
      imageUrl: slide.imageUrl,
      videoUrl: slide.videoUrl || "",
      isActive: slide.isActive,
    });
    setPreviewUrl(slide.imageUrl);
  };

  const handleSubmit = () => {
    if (!form.title || !form.imageUrl) {
      toast({ title: "Title and image are required", variant: "destructive" });
      return;
    }
    const submitData = {
      ...form,
      videoUrl: form.videoUrl || null,
    };
    if (editingSlide) {
      updateMutation.mutate({ id: editingSlide.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const SlideForm = () => (
    <div className="overflow-y-auto max-h-[70vh] pr-1 -mr-1 space-y-5">
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-slate-700">Slide Image</Label>
        <div className="relative">
          {previewUrl ? (
            <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 aspect-video bg-slate-100">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <button
                type="button"
                onClick={() => { setPreviewUrl(null); setForm(prev => ({ ...prev, imageUrl: "" })); }}
                className="absolute top-3 right-3 p-1.5 bg-white/90 rounded-full shadow-md hover:bg-white transition-colors"
                data-testid="button-remove-image"
              >
                <X className="w-4 h-4 text-slate-700" />
              </button>
            </div>
          ) : (
            <label
              className="flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400 cursor-pointer transition-all group"
              data-testid="dropzone-hero-image"
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-hero-image"
              />
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-sm text-slate-500">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center p-4">
                  <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <Upload className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Click to upload image</p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP up to 20MB</p>
                    <p className="text-xs text-slate-400">Auto-compressed to WebP for fast loading</p>
                    <p className="text-xs text-slate-400">Recommended: 1920x1080 (16:9)</p>
                  </div>
                </div>
              )}
            </label>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-slate-700">Background Video (Optional)</Label>
        <p className="text-xs text-slate-400">Upload an mp4/webm video for a cinematic background. Image above is used as poster/fallback.</p>
        {form.videoUrl ? (
          <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 aspect-video bg-black">
            <video
              src={form.videoUrl}
              className="w-full h-full object-cover"
              muted
              autoPlay
              loop
              playsInline
            />
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, videoUrl: "" }))}
              className="absolute top-3 right-3 p-1.5 bg-white/90 rounded-full shadow-md hover:bg-white transition-colors"
              data-testid="button-remove-video"
            >
              <X className="w-4 h-4 text-slate-700" />
            </button>
            <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 rounded text-white text-xs backdrop-blur-sm">Video</div>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400 cursor-pointer transition-all group"
            data-testid="dropzone-hero-video"
          >
            <input
              type="file"
              accept="video/mp4,video/webm"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 200 * 1024 * 1024) {
                  toast({ title: "Video must be under 200MB", variant: "destructive" });
                  return;
                }
                setUploadingVideo(true);
                try {
                  const urlRes = await fetch("/api/uploads/request-url", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      name: file.name,
                      size: file.size,
                      contentType: file.type,
                    }),
                  });
                  if (!urlRes.ok) throw new Error("Failed to get upload URL");
                  const { uploadURL, objectPath } = await urlRes.json();
                  const uploadRes = await fetch(uploadURL, {
                    method: "PUT",
                    body: file,
                    headers: { "Content-Type": file.type },
                  });
                  if (!uploadRes.ok) throw new Error("Failed to upload video");
                  setForm(prev => ({ ...prev, videoUrl: objectPath }));
                  toast({ title: "Video uploaded successfully" });
                } catch {
                  toast({ title: "Failed to upload video", variant: "destructive" });
                } finally {
                  setUploadingVideo(false);
                }
              }}
              data-testid="input-hero-video"
            />
            {uploadingVideo ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-500">Uploading video...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <Upload className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-sm font-medium text-slate-700">Click to upload video</p>
                <p className="text-xs text-slate-400">MP4 or WebM, up to 200MB</p>
              </div>
            )}
          </label>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Title *</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Experience Premium Living"
            className="h-11"
            data-testid="input-slide-title"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Subtitle</Label>
          <Input
            value={form.subtitle}
            onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
            placeholder="HSQUARELIVING, MUMBAI"
            className="h-11"
            data-testid="input-slide-subtitle"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-slate-700">Caption</Label>
        <Textarea
          value={form.caption}
          onChange={(e) => setForm((prev) => ({ ...prev, caption: e.target.value }))}
          placeholder="Where comfort meets excellence in student accommodation"
          rows={2}
          data-testid="input-slide-caption"
        />
      </div>

      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
        <Switch
          checked={form.isActive}
          onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
          data-testid="switch-slide-active"
        />
        <Label className="text-sm text-slate-600">
          {form.isActive ? "Active - Visible on homepage" : "Inactive - Hidden from homepage"}
        </Label>
      </div>

      <div className="flex gap-3 justify-end pt-2 sticky bottom-0 bg-white pb-1">
        <Button
          variant="outline"
          onClick={() => {
            setIsAddOpen(false);
            setEditingSlide(null);
            resetForm();
          }}
          data-testid="button-cancel-slide"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!form.title || !form.imageUrl || createMutation.isPending || updateMutation.isPending}
          className="bg-indigo-600 hover:bg-indigo-700"
          data-testid="button-save-slide"
        >
          {(createMutation.isPending || updateMutation.isPending) && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {editingSlide ? "Update Slide" : "Add Slide"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="admin-hero-slides">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Hero Slideshow</h1>
          <p className="text-slate-500 text-sm mt-1">
            Manage the homepage hero carousel images, titles and captions
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-add-slide"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Slide
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="text-lg font-bold">Add New Slide</DialogTitle>
            </DialogHeader>
            <SlideForm />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : slides.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No slides yet</h3>
            <p className="text-slate-500 text-sm max-w-sm mb-4">
              Add hero slides to create a beautiful carousel on your homepage. Default slides will be used until you add custom ones.
            </p>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setIsAddOpen(true)}
              data-testid="button-add-first-slide"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Slide
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {slides.map((slide, index) => (
            <Card
              key={slide.id}
              className={`overflow-hidden transition-all ${
                !slide.isActive ? "opacity-60 border-dashed" : "border-slate-200"
              }`}
              data-testid={`slide-card-${slide.id}`}
            >
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  <div className="flex flex-col items-center justify-center px-2 bg-slate-50 border-r border-slate-200 gap-1">
                    <button
                      onClick={() => moveSlide(index, "up")}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                      data-testid={`button-move-up-${slide.id}`}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <GripVertical className="w-4 h-4 text-slate-300" />
                    <button
                      onClick={() => moveSlide(index, "down")}
                      disabled={index === slides.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                      data-testid={`button-move-down-${slide.id}`}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="w-40 md:w-56 h-28 md:h-32 flex-shrink-0 bg-slate-100 relative overflow-hidden">
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        slide.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-500"
                      }`}>
                        {slide.isActive ? "Active" : "Hidden"}
                      </span>
                      {slide.videoUrl && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          Video
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                    <div>
                      <h3 className="font-semibold text-slate-800 text-base truncate">{slide.title}</h3>
                      {slide.subtitle && (
                        <p className="text-xs text-amber-600 uppercase tracking-wider mt-0.5 truncate">
                          {slide.subtitle}
                        </p>
                      )}
                      {slide.caption && (
                        <p className="text-sm text-slate-500 mt-1 truncate">{slide.caption}</p>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      Position: {index + 1} of {slides.length}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-4 border-l border-slate-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateMutation.mutate({
                        id: slide.id,
                        data: { isActive: !slide.isActive }
                      })}
                      className="h-9 w-9"
                      title={slide.isActive ? "Hide" : "Show"}
                      data-testid={`button-toggle-${slide.id}`}
                    >
                      {slide.isActive ? (
                        <Eye className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-400" />
                      )}
                    </Button>
                    <Dialog
                      open={editingSlide?.id === slide.id}
                      onOpenChange={(open) => {
                        if (open) openEditDialog(slide);
                        else { setEditingSlide(null); resetForm(); }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          data-testid={`button-edit-${slide.id}`}
                        >
                          <Edit2 className="w-4 h-4 text-slate-500" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
                        <DialogHeader className="flex-shrink-0">
                          <DialogTitle className="text-lg font-bold">Edit Slide</DialogTitle>
                        </DialogHeader>
                        <SlideForm />
                      </DialogContent>
                    </Dialog>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Delete this slide?")) {
                          deleteMutation.mutate(slide.id);
                        }
                      }}
                      className="h-9 w-9 hover:bg-rose-50"
                      data-testid={`button-delete-${slide.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-3">
            <ImageIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Tips for great hero slides</p>
              <ul className="mt-1.5 space-y-1 text-amber-700/80 text-xs list-disc list-inside">
                <li>Use high-resolution images (1920x1080 or larger) for best quality</li>
                <li>Landscape orientation (16:9) works best for the hero carousel</li>
                <li>Keep titles short and impactful — they overlay on the image</li>
                <li>Drag slides to reorder. Active slides appear on the homepage automatically.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
