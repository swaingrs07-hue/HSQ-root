import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Building2,
  MapPin,
  Bed,
  IndianRupee,
  Image as ImageIcon,
  FileCheck,
  Check,
  X,
  Loader2,
  Save,
  Send,
  Upload,
  Star,
  GripVertical,
  RefreshCw,
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Basic Details", icon: Building2 },
  { id: 2, title: "Location", icon: MapPin },
  { id: 3, title: "Room Types", icon: Bed },
  { id: 4, title: "Pricing & Tariffs", icon: IndianRupee },
  { id: 5, title: "Images", icon: ImageIcon },
  { id: 6, title: "Review & Publish", icon: FileCheck },
];

const propertyFormSchema = z.object({
  name: z.string().min(1, "Property name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(6, "Valid pincode required").max(6),
  description: z.string().optional(),
  category: z.enum(["hotel", "hostel"]),
  googleMapsUrl: z.string().optional(),
  amenities: z.array(z.object({
    amenityId: z.string(),
    name: z.string(),
  })).optional(),
  rules: z.array(z.object({
    rule: z.string().min(1, "Rule is required"),
  })).optional(),
  nearbyLocations: z.array(z.object({
    placeName: z.string().min(1, "Place name is required"),
    distance: z.string().min(1, "Distance is required"),
    category: z.enum(["metro", "college", "office", "hospital", "mall", "restaurant", "other"]),
  })).optional(),
  roomTypes: z.array(z.object({
    name: z.enum(["Single", "Shared", "Standard", "Deluxe", "Suite", "Double", "Triple", "Dorm", "Custom"]),
    customName: z.string().optional(),
    occupancy: z.number().min(1, "Occupancy required"),
    totalRooms: z.number().min(1, "Total rooms required"),
    totalBeds: z.number().min(1, "Total beds required"),
    availableBeds: z.number().min(0, "Available beds required"),
    basePrice: z.number().min(0, "Price required"),
    size: z.string().optional(),
  })).min(1, "At least one room type is required"),
  tariffs: z.array(z.object({
    academicYear: z.string().min(1, "Academic year required"),
    monthlyPrice: z.number().min(0),
    deposit: z.number().min(0),
    discount: z.number().min(0).max(100).optional(),
    discountLabel: z.string().optional(),
  })).optional(),
  images: z.array(z.object({
    imageUrl: z.string().min(1, "Image URL required"),
    caption: z.string().optional(),
    isPrimary: z.boolean().optional(),
    order: z.number().optional(),
  })).optional(),
});

type PropertyFormData = z.infer<typeof propertyFormSchema>;

interface UploadedImage {
  id: string;
  url: string;
  caption: string;
  isPrimary: boolean;
  order: number;
  uploading?: boolean;
  error?: string;
  progress?: number;
}

const roomTypeOptions = [
  { value: "Single", label: "Single" },
  { value: "Shared", label: "Shared" },
  { value: "Standard", label: "Standard" },
  { value: "Deluxe", label: "Deluxe" },
  { value: "Suite", label: "Suite" },
  { value: "Double", label: "Double" },
  { value: "Triple", label: "Triple" },
  { value: "Dorm", label: "Dorm" },
  { value: "Custom", label: "Custom" },
];

const nearbyCategories = [
  { value: "college", label: "College/University" },
  { value: "hospital", label: "Hospital" },
  { value: "restaurant", label: "Restaurant" },
  { value: "metro", label: "Metro/Transport" },
  { value: "mall", label: "Mall/Shopping" },
  { value: "office", label: "Office/Corporate" },
  { value: "other", label: "Other" },
];

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_IMAGES = 10;

export default function AddProperty() {
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newRule, setNewRule] = useState("");
  const [newAmenityId, setNewAmenityId] = useState("");
  const [showAddAmenityModal, setShowAddAmenityModal] = useState(false);
  const [newAmenityName, setNewAmenityName] = useState("");
  const [newAmenityIcon, setNewAmenityIcon] = useState("");
  const [isCreatingAmenity, setIsCreatingAmenity] = useState(false);
  
  // Image upload state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: globalAmenities = [], refetch: refetchAmenities } = useQuery({
    queryKey: ["/api/amenities"],
    queryFn: async () => {
      const res = await fetch("/api/amenities");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      description: "",
      category: "hostel",
      googleMapsUrl: "",
      amenities: [],
      rules: [],
      nearbyLocations: [],
      roomTypes: [{ 
        name: "Single" as const,
        customName: "",
        occupancy: 1,
        totalRooms: 1,
        totalBeds: 1,
        availableBeds: 1,
        basePrice: 0,
        size: "",
      }],
      tariffs: [],
      images: [],
    },
    mode: "onChange",
  });

  const { fields: amenityFields, append: appendAmenity, remove: removeAmenity } = useFieldArray({
    control: form.control,
    name: "amenities",
  });

  const { fields: ruleFields, append: appendRule, remove: removeRule } = useFieldArray({
    control: form.control,
    name: "rules",
  });

  const { fields: nearbyFields, append: appendNearby, remove: removeNearby } = useFieldArray({
    control: form.control,
    name: "nearbyLocations",
  });

  const { fields: roomTypeFields, append: appendRoomType, remove: removeRoomType } = useFieldArray({
    control: form.control,
    name: "roomTypes",
  });

  const { fields: tariffFields, append: appendTariff, remove: removeTariff } = useFieldArray({
    control: form.control,
    name: "tariffs",
  });

  const handleAddRule = () => {
    if (newRule.trim()) {
      appendRule({ rule: newRule.trim() });
      setNewRule("");
    }
  };

  const handleAddAmenity = () => {
    const amenity = globalAmenities.find((a: any) => a.id === newAmenityId);
    if (amenity && !amenityFields.some(f => f.amenityId === newAmenityId)) {
      appendAmenity({ amenityId: amenity.id, name: amenity.name });
      setNewAmenityId("");
    }
  };

  // Create new amenity
  const handleCreateAmenity = async () => {
    if (!newAmenityName.trim()) {
      toast({
        title: "Error",
        description: "Amenity name is required",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicates (case-insensitive)
    const exists = globalAmenities.some(
      (a: any) => a.name.toLowerCase() === newAmenityName.trim().toLowerCase()
    );
    if (exists) {
      toast({
        title: "Duplicate Amenity",
        description: "This amenity already exists",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingAmenity(true);
    try {
      const res = await fetch("/api/admin/amenities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newAmenityName.trim(),
          icon: newAmenityIcon || "✓",
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create amenity");
      }

      const newAmenity = await res.json();
      await refetchAmenities();
      
      // Auto-add the new amenity to the form
      appendAmenity({ amenityId: newAmenity.id, name: newAmenity.name });
      
      setNewAmenityName("");
      setNewAmenityIcon("");
      setShowAddAmenityModal(false);
      
      toast({
        title: "Amenity Created",
        description: `"${newAmenity.name}" has been added and selected.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingAmenity(false);
    }
  };

  // Image upload functions
  const uploadFile = async (file: File): Promise<string> => {
    // Request presigned URL
    const urlRes = await fetch("/api/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type,
      }),
    });

    if (!urlRes.ok) {
      throw new Error("Failed to get upload URL");
    }

    const { uploadURL, objectPath } = await urlRes.json();

    // Upload file directly to cloud storage
    const uploadRes = await fetch(uploadURL, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });

    if (!uploadRes.ok) {
      throw new Error("Failed to upload file");
    }

    return objectPath;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    const remainingSlots = MAX_IMAGES - uploadedImages.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Maximum Images",
        description: `You can only upload up to ${MAX_IMAGES} images.`,
        variant: "destructive",
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToUpload) {
      // Validate file type
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not a valid image. Use JPG, PNG, or WEBP.`,
          variant: "destructive",
        });
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File Too Large",
          description: `${file.name} exceeds 10MB limit.`,
          variant: "destructive",
        });
        continue;
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const isPrimary = uploadedImages.length === 0;

      // Add placeholder with loading state
      setUploadedImages(prev => [...prev, {
        id: tempId,
        url: URL.createObjectURL(file),
        caption: file.name.replace(/\.[^/.]+$/, ""),
        isPrimary,
        order: prev.length,
        uploading: true,
        progress: 0,
      }]);

      try {
        const objectPath = await uploadFile(file);
        
        // Update with actual URL
        setUploadedImages(prev => prev.map(img => 
          img.id === tempId 
            ? { ...img, url: objectPath, uploading: false, progress: 100 }
            : img
        ));
      } catch (error) {
        setUploadedImages(prev => prev.map(img => 
          img.id === tempId 
            ? { ...img, uploading: false, error: "Upload failed" }
            : img
        ));
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleSetPrimary = (id: string) => {
    setUploadedImages(prev => prev.map(img => ({
      ...img,
      isPrimary: img.id === id,
    })));
  };

  const handleRemoveImage = (id: string) => {
    setUploadedImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      // If we removed the primary, make the first one primary
      if (filtered.length > 0 && !filtered.some(img => img.isPrimary)) {
        filtered[0].isPrimary = true;
      }
      return filtered;
    });
  };

  const handleRetryUpload = async (id: string) => {
    // Find the image and retry upload
    const img = uploadedImages.find(i => i.id === id);
    if (!img || !img.error) return;

    // For retry, we would need the original file, which we don't have
    // So we just remove the failed one
    handleRemoveImage(id);
    toast({
      title: "Retry",
      description: "Please select the file again to retry upload.",
    });
  };

  const handleCaptionChange = (id: string, caption: string) => {
    setUploadedImages(prev => prev.map(img => 
      img.id === id ? { ...img, caption } : img
    ));
  };

  const handleReorder = (newOrder: UploadedImage[]) => {
    setUploadedImages(newOrder.map((img, idx) => ({ ...img, order: idx })));
  };

  // Sync uploadedImages to form
  const syncImagesToForm = useCallback(() => {
    const images = uploadedImages
      .filter(img => !img.uploading && !img.error)
      .map((img, idx) => ({
        imageUrl: img.url,
        caption: img.caption,
        isPrimary: img.isPrimary,
        order: idx,
      }));
    form.setValue("images", images);
  }, [uploadedImages, form]);

  // Sync when images change
  useEffect(() => {
    syncImagesToForm();
  }, [uploadedImages, syncImagesToForm]);

  const createProperty = useMutation({
    mutationFn: async (data: PropertyFormData & { status: "draft" | "published" }) => {
      // Sync images before submitting
      const images = uploadedImages
        .filter(img => !img.uploading && !img.error)
        .map((img, idx) => ({
          imageUrl: img.url,
          caption: img.caption,
          isPrimary: img.isPrimary,
          order: idx,
        }));

      const payload = {
        name: data.name,
        displayName: data.name,
        category: data.category,
        location: `${data.city}, ${data.state}`,
        address: `${data.address}, ${data.city}, ${data.state} - ${data.pincode}`,
        city: data.city,
        mapsUrl: data.googleMapsUrl || null,
        amenities: data.amenities?.map(a => a.name) || [],
        status: data.status,
        amenityIds: data.amenities?.map(a => a.amenityId) || [],
        rules: data.rules?.map(r => r.rule) || [],
        nearbyLocations: data.nearbyLocations || [],
        roomTypes: data.roomTypes.map(rt => ({
          name: rt.name,
          customName: rt.customName || null,
          occupancy: rt.occupancy,
          totalRooms: rt.totalRooms,
          totalBeds: rt.totalBeds,
          availableBeds: rt.availableBeds,
          basePrice: rt.basePrice,
          size: rt.size || null,
        })),
        tariffs: data.tariffs || [],
        images: images,
      };

      const res = await fetch("/api/admin/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create property");
      }

      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/properties"] });
      toast({
        title: variables.status === "published" ? "Property Published!" : "Draft Saved!",
        description: `${data.property.name} has been ${variables.status === "published" ? "published" : "saved as draft"}.`,
      });
      setLocation("/admin");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (status: "draft" | "published") => {
    const isValid = await form.trigger();
    if (!isValid && status === "published") {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields before publishing.",
        variant: "destructive",
      });
      return;
    }

    // Check for at least one image on publish
    const validImages = uploadedImages.filter(img => !img.uploading && !img.error);
    if (status === "published" && validImages.length === 0) {
      toast({
        title: "Images Required",
        description: "Please upload at least one image before publishing.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const data = form.getValues();
    createProperty.mutate({ ...data, status });
    setIsSubmitting(false);
  };

  const nextStep = () => {
    // Validate images step
    if (currentStep === 5) {
      const validImages = uploadedImages.filter(img => !img.uploading && !img.error);
      if (validImages.length === 0) {
        toast({
          title: "Images Required",
          description: "Please upload at least one image before continuing.",
          variant: "destructive",
        });
        return;
      }
    }
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Check if Next should be disabled on Images step
  const isNextDisabled = currentStep === 5 && uploadedImages.filter(img => !img.uploading && !img.error).length === 0;

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">Only administrators can add properties.</p>
          <Button onClick={() => setLocation("/admin/login")}>Login as Admin</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => setLocation("/admin")} className="mb-4" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "Manrope, sans-serif" }}>
            Add New Property
          </h1>
          <p className="text-gray-600 mt-2">Create a new property listing with all details</p>
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[hsl(345,72%,41%)] text-white"
                    : isCompleted
                    ? "bg-green-100 text-green-700 border border-green-300"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                data-testid={`step-${step.id}`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                <span className="font-medium">{step.title}</span>
              </button>
            );
          })}
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold mb-4">Basic Property Details</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="name">Property Name *</Label>
                        <Input
                          id="name"
                          {...form.register("name")}
                          placeholder="e.g., Sunrise Student Living"
                          className="mt-1"
                          data-testid="input-property-name"
                        />
                        {form.formState.errors.name && (
                          <p className="text-red-500 text-sm mt-1">{form.formState.errors.name.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="category">Category *</Label>
                        <Select
                          value={form.watch("category")}
                          onValueChange={(value) => form.setValue("category", value as "hotel" | "hostel")}
                        >
                          <SelectTrigger className="mt-1" data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hostel">Hostel</SelectItem>
                            <SelectItem value="hotel">Hotel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        {...form.register("description")}
                        placeholder="Describe the property, its features and highlights..."
                        rows={4}
                        className="mt-1"
                        data-testid="input-description"
                      />
                    </div>

                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Property Rules</h3>
                      </div>
                      <div className="flex gap-2 mb-4">
                        <Input
                          value={newRule}
                          onChange={(e) => setNewRule(e.target.value)}
                          placeholder="e.g., No smoking on premises"
                          onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddRule())}
                          data-testid="input-new-rule"
                        />
                        <Button type="button" onClick={handleAddRule} className="bg-[hsl(345,72%,41%)] hover:bg-[hsl(345,72%,35%)]" data-testid="button-add-rule">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ruleFields.map((field, index) => (
                          <div
                            key={field.id}
                            className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full"
                          >
                            <span className="text-sm">{form.watch(`rules.${index}.rule`)}</span>
                            <button
                              type="button"
                              onClick={() => removeRule(index)}
                              className="text-gray-500 hover:text-red-500"
                              data-testid={`button-remove-rule-${index}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Enhanced Amenities Section */}
                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Amenities</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddAmenityModal(true)}
                          data-testid="button-open-add-amenity-modal"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add New Amenity
                        </Button>
                      </div>
                      <div className="flex gap-2 mb-4">
                        <Select value={newAmenityId} onValueChange={setNewAmenityId}>
                          <SelectTrigger className="flex-1" data-testid="select-amenity">
                            <SelectValue placeholder="Select amenity to add" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {(() => {
                              const availableAmenities = globalAmenities.filter((a: any) => !amenityFields.some(f => f.amenityId === a.id));
                              const categories = Array.from(new Set(availableAmenities.map((a: any) => a.category || "Other"))) as string[];
                              return categories.map((category: string) => (
                                <SelectGroup key={category}>
                                  <SelectLabel className="font-semibold text-primary">{category}</SelectLabel>
                                  {availableAmenities
                                    .filter((a: any) => (a.category || "Other") === category)
                                    .map((amenity: any) => (
                                      <SelectItem key={amenity.id} value={amenity.id}>
                                        {amenity.icon} {amenity.name}
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                        <Button 
                          type="button" 
                          onClick={handleAddAmenity} 
                          className="bg-[hsl(345,72%,41%)] hover:bg-[hsl(345,72%,35%)]" 
                          disabled={!newAmenityId}
                          data-testid="button-add-amenity"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {amenityFields.length === 0 ? (
                          <p className="text-gray-400 text-sm">No amenities selected. Select from dropdown or add new.</p>
                        ) : (
                          amenityFields.map((field, index) => (
                            <div
                              key={field.id}
                              className="flex items-center gap-2 bg-[hsl(345,72%,41%)]/10 text-[hsl(345,72%,41%)] px-3 py-1.5 rounded-full border border-[hsl(345,72%,41%)]/20"
                            >
                              <span className="text-sm font-medium">{field.name}</span>
                              <button
                                type="button"
                                onClick={() => removeAmenity(index)}
                                className="hover:text-red-600 transition-colors"
                                data-testid={`button-remove-amenity-${index}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold mb-4">Location Details</h2>

                    <div>
                      <Label htmlFor="address">Full Address *</Label>
                      <Textarea
                        id="address"
                        {...form.register("address")}
                        placeholder="Street address, landmark..."
                        rows={2}
                        className="mt-1"
                        data-testid="input-address"
                      />
                      {form.formState.errors.address && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.address.message}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <Label htmlFor="city">City *</Label>
                        <Input
                          id="city"
                          {...form.register("city")}
                          placeholder="e.g., Pune"
                          className="mt-1"
                          data-testid="input-city"
                        />
                        {form.formState.errors.city && (
                          <p className="text-red-500 text-sm mt-1">{form.formState.errors.city.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="state">State *</Label>
                        <Input
                          id="state"
                          {...form.register("state")}
                          placeholder="e.g., Maharashtra"
                          className="mt-1"
                          data-testid="input-state"
                        />
                        {form.formState.errors.state && (
                          <p className="text-red-500 text-sm mt-1">{form.formState.errors.state.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="pincode">Pincode *</Label>
                        <Input
                          id="pincode"
                          {...form.register("pincode")}
                          placeholder="e.g., 411001"
                          maxLength={6}
                          className="mt-1"
                          data-testid="input-pincode"
                        />
                        {form.formState.errors.pincode && (
                          <p className="text-red-500 text-sm mt-1">{form.formState.errors.pincode.message}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="googleMapsUrl">Google Maps URL</Label>
                      <Input
                        id="googleMapsUrl"
                        {...form.register("googleMapsUrl")}
                        placeholder="https://maps.google.com/..."
                        className="mt-1"
                        data-testid="input-google-maps"
                      />
                    </div>

                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Nearby Locations</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => appendNearby({ placeName: "", distance: "", category: "other" })}
                          data-testid="button-add-nearby"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Location
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {nearbyFields.map((field, index) => (
                          <Card key={field.id}>
                            <CardContent className="pt-4">
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                                <div className="md:col-span-4">
                                  <Label>Place Name *</Label>
                                  <Input
                                    {...form.register(`nearbyLocations.${index}.placeName`)}
                                    placeholder="e.g., MIT College"
                                    className="mt-1"
                                    data-testid={`input-nearby-name-${index}`}
                                  />
                                </div>
                                <div className="md:col-span-3">
                                  <Label>Distance *</Label>
                                  <Input
                                    {...form.register(`nearbyLocations.${index}.distance`)}
                                    placeholder="e.g., 2 km"
                                    className="mt-1"
                                    data-testid={`input-nearby-distance-${index}`}
                                  />
                                </div>
                                <div className="md:col-span-4">
                                  <Label>Category</Label>
                                  <Select
                                    value={form.watch(`nearbyLocations.${index}.category`)}
                                    onValueChange={(value) => form.setValue(`nearbyLocations.${index}.category`, value as any)}
                                  >
                                    <SelectTrigger className="mt-1" data-testid={`select-nearby-category-${index}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {nearbyCategories.map((cat) => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                          {cat.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="md:col-span-1 flex items-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="text-red-500 hover:text-red-700 mt-6"
                                    onClick={() => removeNearby(index)}
                                    data-testid={`button-remove-nearby-${index}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                        {nearbyFields.length === 0 && (
                          <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                            <MapPin className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                            <p className="text-gray-500 text-sm">No nearby locations added yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Room Types</h2>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => appendRoomType({
                          name: "Single" as const,
                          customName: "",
                          occupancy: 1,
                          totalRooms: 1,
                          totalBeds: 1,
                          availableBeds: 1,
                          basePrice: 0,
                          size: "",
                        })}
                        data-testid="button-add-room-type"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Room Type
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {roomTypeFields.map((field, index) => (
                        <Card key={field.id}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">Room Type {index + 1}</CardTitle>
                              {roomTypeFields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => removeRoomType(index)}
                                  data-testid={`button-remove-room-type-${index}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div>
                                <Label>Type *</Label>
                                <Select
                                  value={form.watch(`roomTypes.${index}.name`)}
                                  onValueChange={(value) => form.setValue(`roomTypes.${index}.name`, value as any)}
                                >
                                  <SelectTrigger className="mt-1" data-testid={`select-room-type-${index}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roomTypeOptions.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {form.watch(`roomTypes.${index}.name`) === "Custom" && (
                                <div>
                                  <Label>Custom Name</Label>
                                  <Input
                                    {...form.register(`roomTypes.${index}.customName`)}
                                    placeholder="e.g., Executive Suite"
                                    className="mt-1"
                                    data-testid={`input-custom-room-name-${index}`}
                                  />
                                </div>
                              )}

                              <div>
                                <Label>Occupancy *</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  {...form.register(`roomTypes.${index}.occupancy`, { valueAsNumber: true })}
                                  className="mt-1"
                                  data-testid={`input-occupancy-${index}`}
                                />
                              </div>

                              <div>
                                <Label>Total Rooms *</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  {...form.register(`roomTypes.${index}.totalRooms`, { valueAsNumber: true })}
                                  className="mt-1"
                                  data-testid={`input-total-rooms-${index}`}
                                />
                              </div>

                              <div>
                                <Label>Total Beds *</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  {...form.register(`roomTypes.${index}.totalBeds`, { valueAsNumber: true })}
                                  className="mt-1"
                                  data-testid={`input-total-beds-${index}`}
                                />
                              </div>

                              <div>
                                <Label>Available Beds *</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  {...form.register(`roomTypes.${index}.availableBeds`, { valueAsNumber: true })}
                                  className="mt-1"
                                  data-testid={`input-available-beds-${index}`}
                                />
                              </div>

                              <div>
                                <Label>Base Price (₹/month) *</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  {...form.register(`roomTypes.${index}.basePrice`, { valueAsNumber: true })}
                                  className="mt-1"
                                  data-testid={`input-base-price-${index}`}
                                />
                              </div>

                              <div>
                                <Label>Room Size</Label>
                                <Input
                                  {...form.register(`roomTypes.${index}.size`)}
                                  placeholder="e.g., 150 sq ft"
                                  className="mt-1"
                                  data-testid={`input-room-size-${index}`}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Pricing & Tariffs</h2>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => appendTariff({
                          academicYear: "",
                          monthlyPrice: 0,
                          deposit: 0,
                          discount: 0,
                          discountLabel: "",
                        })}
                        data-testid="button-add-tariff"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Tariff
                      </Button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-700">
                        <strong>Tip:</strong> Add different tariffs for different academic years or seasons. 
                        The default booking amount is ₹1,00,000.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {tariffFields.map((field, index) => (
                        <Card key={field.id}>
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start">
                              <div className="md:col-span-2">
                                <Label>Academic Year *</Label>
                                <Input
                                  {...form.register(`tariffs.${index}.academicYear`)}
                                  placeholder="e.g., 2024-25"
                                  className="mt-1"
                                  data-testid={`input-academic-year-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Monthly Price (₹)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  {...form.register(`tariffs.${index}.monthlyPrice`, { valueAsNumber: true })}
                                  className="mt-1"
                                  data-testid={`input-monthly-price-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Deposit (₹)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  {...form.register(`tariffs.${index}.deposit`, { valueAsNumber: true })}
                                  className="mt-1"
                                  data-testid={`input-deposit-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Discount (%)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  {...form.register(`tariffs.${index}.discount`, { valueAsNumber: true })}
                                  className="mt-1"
                                  data-testid={`input-discount-${index}`}
                                />
                              </div>
                              <div className="flex items-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700 mt-6"
                                  onClick={() => removeTariff(index)}
                                  data-testid={`button-remove-tariff-${index}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {tariffFields.length === 0 && (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                          <IndianRupee className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-gray-500 text-sm">No tariffs added yet.</p>
                          <p className="text-gray-400 text-xs">Add pricing for different academic years.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Enhanced Images Step */}
                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Property Images</h2>
                      <span className="text-sm text-gray-500">
                        {uploadedImages.filter(img => !img.uploading && !img.error).length} / {MAX_IMAGES} images
                      </span>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-700">
                        <strong>Tip:</strong> Upload high-quality images (JPG, PNG, WEBP). 
                        Drag and drop or click to upload. The star-marked image will be the primary image shown on listings.
                      </p>
                    </div>

                    {/* Drag & Drop Upload Area */}
                    <div
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                        isDragging
                          ? "border-[hsl(345,72%,41%)] bg-[hsl(345,72%,41%)]/5"
                          : "border-gray-300 hover:border-gray-400"
                      } ${uploadedImages.length >= MAX_IMAGES ? "opacity-50 pointer-events-none" : ""}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => uploadedImages.length < MAX_IMAGES && fileInputRef.current?.click()}
                      data-testid="dropzone-images"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                        data-testid="input-file-upload"
                      />
                      <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? "text-[hsl(345,72%,41%)]" : "text-gray-400"}`} />
                      <p className="text-lg font-medium text-gray-700 mb-1">
                        {isDragging ? "Drop images here" : "Drag & drop images here"}
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        or click to browse from your device
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-[hsl(345,72%,41%)] text-[hsl(345,72%,41%)] hover:bg-[hsl(345,72%,41%)]/5"
                        disabled={uploadedImages.length >= MAX_IMAGES}
                        data-testid="button-browse-images"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Browse Images
                      </Button>
                      <p className="text-xs text-gray-400 mt-3">
                        Supported: JPG, PNG, WEBP (max 10MB each)
                      </p>
                    </div>

                    {/* Image Grid with Reorder */}
                    {uploadedImages.length > 0 ? (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                          <GripVertical className="w-4 h-4 inline-block mr-1" />
                          Drag to reorder images. Click the star to set as primary.
                        </p>
                        <Reorder.Group
                          axis="y"
                          values={uploadedImages}
                          onReorder={handleReorder}
                          className="space-y-3"
                        >
                          {uploadedImages.map((image) => (
                            <Reorder.Item
                              key={image.id}
                              value={image}
                              className="bg-white border rounded-lg p-4 shadow-sm cursor-grab active:cursor-grabbing"
                            >
                              <div className="flex items-center gap-4">
                                <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                
                                {/* Thumbnail */}
                                <div className="relative w-24 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                                  {image.uploading ? (
                                    <div className="flex items-center justify-center h-full">
                                      <Loader2 className="w-6 h-6 animate-spin text-[hsl(345,72%,41%)]" />
                                    </div>
                                  ) : image.error ? (
                                    <div className="flex items-center justify-center h-full bg-red-50">
                                      <X className="w-6 h-6 text-red-500" />
                                    </div>
                                  ) : (
                                    <img
                                      src={image.url.startsWith("blob:") ? image.url : image.url}
                                      alt={image.caption}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  {image.isPrimary && !image.uploading && !image.error && (
                                    <div className="absolute top-1 left-1 bg-yellow-400 rounded-full p-0.5">
                                      <Star className="w-3 h-3 text-yellow-800 fill-yellow-800" />
                                    </div>
                                  )}
                                </div>

                                {/* Caption Input */}
                                <div className="flex-1">
                                  <Input
                                    value={image.caption}
                                    onChange={(e) => handleCaptionChange(image.id, e.target.value)}
                                    placeholder="Add caption..."
                                    className="text-sm"
                                    disabled={image.uploading}
                                    data-testid={`input-image-caption-${image.id}`}
                                  />
                                  {image.error && (
                                    <p className="text-red-500 text-xs mt-1">{image.error}</p>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {image.error ? (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRetryUpload(image.id)}
                                      className="text-blue-500 hover:text-blue-700"
                                      data-testid={`button-retry-${image.id}`}
                                    >
                                      <RefreshCw className="w-4 h-4" />
                                    </Button>
                                  ) : !image.uploading && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleSetPrimary(image.id)}
                                      className={image.isPrimary ? "text-yellow-500" : "text-gray-400 hover:text-yellow-500"}
                                      title="Set as primary"
                                      data-testid={`button-set-primary-${image.id}`}
                                    >
                                      <Star className={`w-4 h-4 ${image.isPrimary ? "fill-yellow-500" : ""}`} />
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveImage(image.id)}
                                    className="text-red-500 hover:text-red-700"
                                    data-testid={`button-remove-image-${image.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500 font-medium">No images added yet</p>
                        <p className="text-gray-400 text-sm mt-1">
                          Upload at least 1 image to continue
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 6 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Review & Publish</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Property Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p><strong>Name:</strong> {form.watch("name") || "-"}</p>
                          <p><strong>Category:</strong> {form.watch("category")}</p>
                          <p><strong>City:</strong> {form.watch("city") || "-"}</p>
                          <p><strong>Address:</strong> {form.watch("address") || "-"}</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p><strong>Room Types:</strong> {roomTypeFields.length}</p>
                          <p><strong>Amenities:</strong> {amenityFields.length}</p>
                          <p><strong>Rules:</strong> {ruleFields.length}</p>
                          <p><strong>Nearby Locations:</strong> {nearbyFields.length}</p>
                          <p><strong>Images:</strong> {uploadedImages.filter(i => !i.uploading && !i.error).length}</p>
                          <p><strong>Tariffs:</strong> {tariffFields.length}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {roomTypeFields.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Room Types</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2">Type</th>
                                  <th className="text-left py-2">Custom Name</th>
                                  <th className="text-center py-2">Occupancy</th>
                                  <th className="text-center py-2">Beds</th>
                                  <th className="text-right py-2">Price/Month</th>
                                </tr>
                              </thead>
                              <tbody>
                                {roomTypeFields.map((_, index) => (
                                  <tr key={index} className="border-b last:border-0">
                                    <td className="py-2">{form.watch(`roomTypes.${index}.name`) || "-"}</td>
                                    <td className="py-2">{form.watch(`roomTypes.${index}.customName`) || "-"}</td>
                                    <td className="text-center py-2">{form.watch(`roomTypes.${index}.occupancy`)}</td>
                                    <td className="text-center py-2">
                                      {form.watch(`roomTypes.${index}.availableBeds`)} / {form.watch(`roomTypes.${index}.totalBeds`)}
                                    </td>
                                    <td className="text-right py-2">₹{form.watch(`roomTypes.${index}.basePrice`)?.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Image Preview Grid */}
                    {uploadedImages.filter(i => !i.uploading && !i.error).length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Images</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                            {uploadedImages
                              .filter(i => !i.uploading && !i.error)
                              .map((img) => (
                                <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                                  <img
                                    src={img.url}
                                    alt={img.caption}
                                    className="w-full h-full object-cover"
                                  />
                                  {img.isPrimary && (
                                    <div className="absolute top-1 left-1 bg-yellow-400 rounded-full p-0.5">
                                      <Star className="w-3 h-3 text-yellow-800 fill-yellow-800" />
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Ready to publish?</strong> Make sure all required fields are filled. 
                        You can also save as draft and publish later.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                data-testid="button-prev-step"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <div className="flex gap-3">
                {currentStep === STEPS.length && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSubmit("draft")}
                      disabled={isSubmitting || createProperty.isPending}
                      data-testid="button-save-draft"
                    >
                      {createProperty.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save as Draft
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleSubmit("published")}
                      disabled={isSubmitting || createProperty.isPending}
                      className="bg-[hsl(345,72%,41%)] hover:bg-[hsl(345,72%,35%)]"
                      data-testid="button-publish"
                    >
                      {createProperty.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Publish Property
                    </Button>
                  </>
                )}
                
                {currentStep < STEPS.length && (
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={isNextDisabled}
                    className="bg-[hsl(345,72%,41%)] hover:bg-[hsl(345,72%,35%)]"
                    data-testid="button-next-step"
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add New Amenity Modal */}
      <Dialog open={showAddAmenityModal} onOpenChange={setShowAddAmenityModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Amenity</DialogTitle>
            <DialogDescription>
              Create a new amenity that will be available for all properties.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="amenity-name">Amenity Name *</Label>
              <Input
                id="amenity-name"
                value={newAmenityName}
                onChange={(e) => setNewAmenityName(e.target.value)}
                placeholder="e.g., Swimming Pool"
                className="mt-1"
                data-testid="input-new-amenity-name"
              />
            </div>
            <div>
              <Label htmlFor="amenity-icon">Icon (Emoji)</Label>
              <Input
                id="amenity-icon"
                value={newAmenityIcon}
                onChange={(e) => setNewAmenityIcon(e.target.value)}
                placeholder="e.g., 🏊"
                className="mt-1"
                maxLength={4}
                data-testid="input-new-amenity-icon"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for default checkmark</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddAmenityModal(false)}
              data-testid="button-cancel-amenity"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateAmenity}
              disabled={isCreatingAmenity || !newAmenityName.trim()}
              className="bg-[hsl(345,72%,41%)] hover:bg-[hsl(345,72%,35%)]"
              data-testid="button-save-amenity"
            >
              {isCreatingAmenity ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Amenity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
