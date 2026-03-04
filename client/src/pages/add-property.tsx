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
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  AlertTriangle,
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Basic Details", icon: Building2 },
  { id: 2, title: "Location", icon: MapPin },
  { id: 3, title: "Room Types", icon: Bed },
  { id: 4, title: "Images", icon: ImageIcon },
  { id: 5, title: "Review & Publish", icon: FileCheck },
];

const propertyFormSchema = z.object({
  name: z.string().min(1, "Property name is required"),
  propertyCode: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(6, "Valid pincode required").max(6),
  description: z.string().optional(),
  category: z.enum(["hotel", "hostel"]),
  bookingMode: z.enum(["academic_year", "monthly"]),
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
    academicYearPrice: z.number().min(0).optional(),
    deposit: z.number().min(0).optional(),
    size: z.string().optional(),
  })).min(1, "At least one room type is required"),
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

async function compressImage(file: File, maxSizeBytes: number = MAX_FILE_SIZE, maxDimension: number = 3840): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      const supportsWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp");
      const outputMime = supportsWebp ? "image/webp" : "image/jpeg";
      const outputExt = supportsWebp ? ".webp" : ".jpg";

      const tryQuality = (quality: number) => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Compression failed")); return; }
          if (blob.size <= maxSizeBytes || quality <= 0.5) {
            if (blob.size > maxSizeBytes) {
              reject(new Error(`Image still ${(blob.size / 1024 / 1024).toFixed(1)}MB after max compression`));
              return;
            }
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            resolve(new File([blob], `${baseName}${outputExt}`, { type: outputMime, lastModified: Date.now() }));
          } else {
            tryQuality(quality - 0.05);
          }
        }, outputMime, quality);
      };
      tryQuality(0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

export default function AddProperty() {
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [basicDetailsTab, setBasicDetailsTab] = useState<"amenities" | "facilities">("amenities");
  const [newRule, setNewRule] = useState("");
  const [newAmenityId, setNewAmenityId] = useState("");
  const [showAddAmenityModal, setShowAddAmenityModal] = useState(false);
  const [newAmenityName, setNewAmenityName] = useState("");
  const [newAmenityIcon, setNewAmenityIcon] = useState("");
  const [newAmenityType, setNewAmenityType] = useState<"amenity" | "facility">("amenity");
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
      propertyCode: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      description: "",
      category: "hostel",
      bookingMode: "monthly",
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
        academicYearPrice: 0,
        deposit: 0,
        size: "",
      }],
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
          type: newAmenityType,
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
      setNewAmenityType("amenity");
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

      let processedFile = file;
      if (file.size > MAX_FILE_SIZE) {
        try {
          toast({
            title: "Compressing Image",
            description: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — auto-resizing to high quality...`,
          });
          processedFile = await compressImage(file);
        } catch {
          toast({
            title: "Compression Failed",
            description: `Could not auto-resize ${file.name}. Try a smaller file.`,
            variant: "destructive",
          });
          continue;
        }
      }

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const isPrimary = uploadedImages.length === 0;

      setUploadedImages(prev => [...prev, {
        id: tempId,
        url: URL.createObjectURL(processedFile),
        caption: file.name.replace(/\.[^/.]+$/, ""),
        isPrimary,
        order: prev.length,
        uploading: true,
        progress: 0,
      }]);

      try {
        const objectPath = await uploadFile(processedFile);
        
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

  useEffect(() => {
    syncImagesToForm();
  }, [uploadedImages, syncImagesToForm]);

  useEffect(() => {
    if (currentStep === 5) {
      runValidationCheck();
    }
  }, [currentStep]);

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
        bookingMode: data.bookingMode,
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
        description: `${data.name} has been ${variables.status === "published" ? "published" : "saved as draft"}.`,
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

  const fieldStepMap: Record<string, { step: number; stepName: string; label: string }> = {
    name: { step: 1, stepName: "Basic Details", label: "Property Name" },
    propertyCode: { step: 1, stepName: "Basic Details", label: "Property Code" },
    description: { step: 1, stepName: "Basic Details", label: "Description" },
    category: { step: 1, stepName: "Basic Details", label: "Category" },
    bookingMode: { step: 1, stepName: "Basic Details", label: "Booking Mode" },
    amenities: { step: 1, stepName: "Basic Details", label: "Amenities" },
    rules: { step: 1, stepName: "Basic Details", label: "Rules" },
    address: { step: 2, stepName: "Location", label: "Address" },
    city: { step: 2, stepName: "Location", label: "City" },
    state: { step: 2, stepName: "Location", label: "State" },
    pincode: { step: 2, stepName: "Location", label: "Pincode" },
    googleMapsUrl: { step: 2, stepName: "Location", label: "Google Maps URL" },
    nearbyLocations: { step: 2, stepName: "Location", label: "Nearby Locations" },
    roomTypes: { step: 3, stepName: "Room Types", label: "Room Types" },
    images: { step: 4, stepName: "Images", label: "Images" },
  };

  const [validationErrors, setValidationErrors] = useState<Array<{ field: string; message: string; step: number; stepName: string }>>([]);

  const collectValidationErrors = () => {
    const errors = form.formState.errors;
    const collected: Array<{ field: string; message: string; step: number; stepName: string }> = [];

    const processError = (key: string, error: any, parentLabel?: string) => {
      if (!error) return;
      const mapping = fieldStepMap[key];
      const stepNum = mapping?.step || 1;
      const stepName = mapping?.stepName || "Basic Details";
      const label = parentLabel || mapping?.label || key;

      if (error.root && typeof error.root === "object" && "message" in error.root) {
        collected.push({
          field: label,
          message: error.root.message as string,
          step: stepNum,
          stepName,
        });
      }

      if (Array.isArray(error)) {
        error.forEach((itemErr: any, index: number) => {
          if (itemErr) {
            for (const [subKey, subErr] of Object.entries(itemErr)) {
              if (subErr && typeof subErr === "object" && "message" in (subErr as any)) {
                collected.push({
                  field: `${label} #${index + 1} → ${subKey}`,
                  message: (subErr as any).message,
                  step: stepNum,
                  stepName,
                });
              }
            }
          }
        });
      } else if (typeof error === "object" && "message" in error && error.message) {
        collected.push({
          field: label,
          message: error.message as string,
          step: stepNum,
          stepName,
        });
      } else if (typeof error === "object" && !("message" in error) && !("root" in error)) {
        for (const [subKey, subErr] of Object.entries(error)) {
          if (subErr && typeof subErr === "object" && "message" in (subErr as any)) {
            collected.push({
              field: `${label} → ${subKey}`,
              message: (subErr as any).message,
              step: stepNum,
              stepName,
            });
          }
        }
      }
    };

    for (const [key, error] of Object.entries(errors)) {
      processError(key, error);
    }

    return collected;
  };

  const getStepsWithErrors = (): Set<number> => {
    return new Set(validationErrors.map(e => e.step));
  };

  const runValidationCheck = async () => {
    const isValid = await form.trigger();
    const errors: Array<{ field: string; message: string; step: number; stepName: string }> = [];

    if (!isValid) {
      const collected = collectValidationErrors();
      if (collected.length > 0) {
        errors.push(...collected);
      } else {
        const rawErrors = form.formState.errors;
        const fallbackKeys = Object.keys(rawErrors);
        fallbackKeys.forEach(key => {
          const mapping = fieldStepMap[key];
          errors.push({
            field: mapping?.label || key,
            message: (rawErrors as any)[key]?.message || "This field is required",
            step: mapping?.step || 1,
            stepName: mapping?.stepName || "Basic Details",
          });
        });
      }
    }

    const validImages = uploadedImages.filter(img => !img.uploading && !img.error);
    if (validImages.length === 0) {
      errors.push({
        field: "Images",
        message: "Upload at least one image before publishing",
        step: 4,
        stepName: "Images",
      });
    }

    const data = form.getValues();
    const bookingMode = data.bookingMode;
    const invalidRooms = data.roomTypes.filter(room => {
      if (bookingMode === "academic_year") {
        return !room.academicYearPrice || room.academicYearPrice <= 0;
      }
      return !room.basePrice || room.basePrice <= 0;
    });
    if (invalidRooms.length > 0) {
      errors.push({
        field: "Room Pricing",
        message: bookingMode === "academic_year"
          ? "Set Academic Year Price for all room types"
          : "Set Base Price (₹/month) for all room types",
        step: 3,
        stepName: "Room Types",
      });
    }

    setValidationErrors(errors);
    return { isValid: errors.length === 0, errors };
  };

  const handleSubmit = async (status: "draft" | "published") => {
    const { isValid, errors } = await runValidationCheck();
    if (!isValid && status === "published") {
      const stepsWithErrors = [...new Set(errors.map(e => `Step ${e.step}: ${e.stepName}`))];
      const fieldList = errors.slice(0, 5).map(e => e.field).join(", ");
      const moreCount = errors.length > 5 ? ` and ${errors.length - 5} more` : "";

      toast({
        title: `${errors.length} Validation ${errors.length === 1 ? "Error" : "Errors"}`,
        description: errors.length > 0
          ? `Fix: ${fieldList}${moreCount}. Check ${stepsWithErrors.join(", ")}.`
          : "Please fill in all required fields. See the Review step for details.",
        variant: "destructive",
      });
      setCurrentStep(5);
      return;
    }

    setIsSubmitting(true);
    const data = form.getValues();
    createProperty.mutate({ ...data, status });
    setIsSubmitting(false);
  };

  const nextStep = async () => {
    if (currentStep === 4) {
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
  const isNextDisabled = currentStep === 4 && uploadedImages.filter(img => !img.uploading && !img.error).length === 0;

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
            const stepsWithErrors = getStepsWithErrors();
            const hasError = stepsWithErrors.has(step.id);
            const errorCount = validationErrors.filter(e => e.step === step.id).length;
            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-[hsl(345,72%,41%)] text-white"
                    : hasError
                    ? "bg-red-50 text-red-700 border border-red-300"
                    : isCompleted
                    ? "bg-green-100 text-green-700 border border-green-300"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                data-testid={`step-${step.id}`}
              >
                {hasError && !isActive ? (
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                ) : isCompleted && !hasError ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                <span className="font-medium">{step.title}</span>
                {hasError && errorCount > 0 && (
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full px-1 ${
                    isActive ? "bg-white text-red-600" : "bg-red-500 text-white"
                  }`} data-testid={`step-error-badge-${step.id}`}>
                    {errorCount}
                  </span>
                )}
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <Label htmlFor="propertyCode">Property Code (for HMS)</Label>
                        <Input
                          id="propertyCode"
                          {...form.register("propertyCode")}
                          placeholder="e.g., JUHU, GOREGAON"
                          className="mt-1"
                          data-testid="input-property-code"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Used for linking with external HMS system</p>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <Label className="text-base font-semibold mb-4 block">Booking Mode *</Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        Choose how students can book rooms at this property
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                            form.watch("bookingMode") === "academic_year"
                              ? "border-[hsl(345,72%,41%)] bg-[hsl(345,72%,41%)]/5"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => form.setValue("bookingMode", "academic_year")}
                          data-testid="radio-academic-year"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              form.watch("bookingMode") === "academic_year"
                                ? "border-[hsl(345,72%,41%)]"
                                : "border-gray-300"
                            }`}>
                              {form.watch("bookingMode") === "academic_year" && (
                                <div className="w-3 h-3 rounded-full bg-[hsl(345,72%,41%)]" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">Academic Year Only</p>
                              <p className="text-sm text-muted-foreground">Fixed annual pricing (e.g., 2024-25)</p>
                            </div>
                          </div>
                        </div>
                        <div
                          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                            form.watch("bookingMode") === "monthly"
                              ? "border-[hsl(345,72%,41%)] bg-[hsl(345,72%,41%)]/5"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => form.setValue("bookingMode", "monthly")}
                          data-testid="radio-monthly"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              form.watch("bookingMode") === "monthly"
                                ? "border-[hsl(345,72%,41%)]"
                                : "border-gray-300"
                            }`}>
                              {form.watch("bookingMode") === "monthly" && (
                                <div className="w-3 h-3 rounded-full bg-[hsl(345,72%,41%)]" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">Monthly Booking</p>
                              <p className="text-sm text-muted-foreground">Flexible month-wise pricing</p>
                            </div>
                          </div>
                        </div>
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
                      <div className="flex border-b mb-4">
                        <button
                          type="button"
                          onClick={() => setBasicDetailsTab("amenities")}
                          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            basicDetailsTab === "amenities"
                              ? "border-[hsl(345,72%,41%)] text-[hsl(345,72%,41%)]"
                              : "border-transparent text-gray-500 hover:text-gray-700"
                          }`}
                          data-testid="tab-amenities"
                        >
                          Amenities
                          {(() => {
                            const amenityIds = new Set(globalAmenities.filter((a: any) => (a.type || "amenity") === "amenity").map((a: any) => a.id));
                            const count = amenityFields.filter(f => amenityIds.has(f.amenityId)).length;
                            return count > 0 ? <span className="ml-1.5 bg-[hsl(345,72%,41%)]/10 text-[hsl(345,72%,41%)] text-xs px-1.5 py-0.5 rounded-full">{count}</span> : null;
                          })()}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBasicDetailsTab("facilities")}
                          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            basicDetailsTab === "facilities"
                              ? "border-[hsl(345,72%,41%)] text-[hsl(345,72%,41%)]"
                              : "border-transparent text-gray-500 hover:text-gray-700"
                          }`}
                          data-testid="tab-facilities"
                        >
                          Facilities & Rules
                          {(() => {
                            const facilityIds = new Set(globalAmenities.filter((a: any) => a.type === "facility").map((a: any) => a.id));
                            const facilityCount = amenityFields.filter(f => facilityIds.has(f.amenityId)).length;
                            const totalCount = facilityCount + ruleFields.length;
                            return totalCount > 0 ? <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{totalCount}</span> : null;
                          })()}
                        </button>
                      </div>

                      {basicDetailsTab === "amenities" && (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-500">Select amenities available at this property</p>
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className="w-full justify-between" data-testid="button-select-amenities">
                                <span className="text-muted-foreground">Click to select amenities</span>
                                <Check className="w-4 h-4 ml-2" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-80" align="start">
                              <ScrollArea className="h-[300px] p-2">
                                {(() => {
                                  const availableAmenities = globalAmenities.filter((a: any) => (a.type || "amenity") === "amenity" && !amenityFields.some(f => f.amenityId === a.id));
                                  const categories = Array.from(new Set(availableAmenities.map((a: any) => a.category || "Other"))) as string[];
                                  if (availableAmenities.length === 0) {
                                    return <p className="text-sm text-muted-foreground p-2">All amenities selected</p>;
                                  }
                                  return categories.map((category: string) => (
                                    <div key={category} className="mb-3">
                                      <p className="font-semibold text-primary text-sm mb-2 px-2">{category}</p>
                                      {availableAmenities
                                        .filter((a: any) => (a.category || "Other") === category)
                                        .map((amenity: any) => (
                                          <div
                                            key={amenity.id}
                                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer"
                                            onClick={() => {
                                              appendAmenity({ amenityId: amenity.id, name: amenity.name });
                                            }}
                                            data-testid={`checkbox-amenity-${amenity.id}`}
                                          >
                                            <div className="w-4 h-4 border rounded flex items-center justify-center">
                                              <Plus className="w-3 h-3 text-muted-foreground" />
                                            </div>
                                            <span className="text-sm">{amenity.icon} {amenity.name}</span>
                                          </div>
                                        ))}
                                    </div>
                                  ));
                                })()}
                              </ScrollArea>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <div className="flex flex-wrap gap-2 mt-4">
                            {(() => {
                              const amenityTypeIds = new Set(globalAmenities.filter((a: any) => (a.type || "amenity") === "amenity").map((a: any) => a.id));
                              const filtered = amenityFields.filter(f => amenityTypeIds.has(f.amenityId));
                              if (filtered.length === 0) {
                                return <p className="text-gray-400 text-sm">No amenities selected. Select from dropdown or add new.</p>;
                              }
                              return filtered.map((field) => {
                                const idx = amenityFields.findIndex(f => f.id === field.id);
                                return (
                                  <div
                                    key={field.id}
                                    className="flex items-center gap-2 bg-[hsl(345,72%,41%)]/10 text-[hsl(345,72%,41%)] px-3 py-1.5 rounded-full border border-[hsl(345,72%,41%)]/20"
                                  >
                                    <span className="text-sm font-medium">{field.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeAmenity(idx)}
                                      className="hover:text-red-600 transition-colors"
                                      data-testid={`button-remove-amenity-${idx}`}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      {basicDetailsTab === "facilities" && (
                        <div className="space-y-6">
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-sm text-gray-500">Select facilities available at this property</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => { setNewAmenityType("facility"); setShowAddAmenityModal(true); }}
                                data-testid="button-open-add-facility-modal"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add New Facility
                              </Button>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between" data-testid="button-select-facilities">
                                  <span className="text-muted-foreground">Click to select facilities</span>
                                  <Check className="w-4 h-4 ml-2" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-80" align="start">
                                <ScrollArea className="h-[300px] p-2">
                                  {(() => {
                                    const availableFacilities = globalAmenities.filter((a: any) => a.type === "facility" && !amenityFields.some(f => f.amenityId === a.id));
                                    const categories = Array.from(new Set(availableFacilities.map((a: any) => a.category || "Other"))) as string[];
                                    if (availableFacilities.length === 0) {
                                      return <p className="text-sm text-muted-foreground p-2">All facilities selected</p>;
                                    }
                                    return categories.map((category: string) => (
                                      <div key={category} className="mb-3">
                                        <p className="font-semibold text-primary text-sm mb-2 px-2">{category}</p>
                                        {availableFacilities
                                          .filter((a: any) => (a.category || "Other") === category)
                                          .map((facility: any) => (
                                            <div
                                              key={facility.id}
                                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer"
                                              onClick={() => {
                                                appendAmenity({ amenityId: facility.id, name: facility.name });
                                              }}
                                              data-testid={`checkbox-facility-${facility.id}`}
                                            >
                                              <div className="w-4 h-4 border rounded flex items-center justify-center">
                                                <Plus className="w-3 h-3 text-muted-foreground" />
                                              </div>
                                              <span className="text-sm">{facility.icon} {facility.name}</span>
                                            </div>
                                          ))}
                                      </div>
                                    ));
                                  })()}
                                </ScrollArea>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <div className="flex flex-wrap gap-2 mt-4">
                              {(() => {
                                const facilityTypeIds = new Set(globalAmenities.filter((a: any) => a.type === "facility").map((a: any) => a.id));
                                const filtered = amenityFields.filter(f => facilityTypeIds.has(f.amenityId));
                                if (filtered.length === 0) {
                                  return <p className="text-gray-400 text-sm">No facilities selected. Select from dropdown or add new.</p>;
                                }
                                return filtered.map((field) => {
                                  const idx = amenityFields.findIndex(f => f.id === field.id);
                                  return (
                                    <div
                                      key={field.id}
                                      className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-200"
                                    >
                                      <span className="text-sm font-medium">{field.name}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeAmenity(idx)}
                                        className="hover:text-red-600 transition-colors"
                                        data-testid={`button-remove-facility-${idx}`}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>

                          <div className="border-t pt-4">
                            <h4 className="font-medium text-sm mb-3">Property Rules</h4>
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
                              {ruleFields.length === 0 ? (
                                <p className="text-gray-400 text-sm">No rules added yet. Type a rule above and click + to add.</p>
                              ) : (
                                ruleFields.map((field, index) => (
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
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}
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
                          academicYearPrice: 0,
                          deposit: 0,
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

                              {form.watch("bookingMode") === "monthly" ? (
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
                              ) : (
                                <div>
                                  <Label>Academic Year Price (₹/year) *</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    {...form.register(`roomTypes.${index}.academicYearPrice`, { valueAsNumber: true })}
                                    className="mt-1"
                                    data-testid={`input-academic-price-${index}`}
                                  />
                                </div>
                              )}

                              <div>
                                <Label>Deposit (₹)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  {...form.register(`roomTypes.${index}.deposit`, { valueAsNumber: true })}
                                  className="mt-1"
                                  data-testid={`input-deposit-${index}`}
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
                        Supported: JPG, PNG, WEBP (large files auto-resized)
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

                {currentStep === 5 && (
                  <div className="space-y-6">
                    <h2 className="text-xl font-semibold">Review & Publish</h2>

                    {validationErrors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-5" data-testid="validation-error-summary">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold text-red-800">
                                {validationErrors.length} {validationErrors.length === 1 ? "issue" : "issues"} to fix before publishing
                              </h3>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => runValidationCheck()}
                                className="text-xs border-red-200 text-red-700 hover:bg-red-100"
                                data-testid="button-revalidate"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Re-check
                              </Button>
                            </div>
                            <div className="space-y-3">
                              {Object.entries(
                                validationErrors.reduce((acc, err) => {
                                  const key = `Step ${err.step}: ${err.stepName}`;
                                  if (!acc[key]) acc[key] = { step: err.step, errors: [] };
                                  acc[key].errors.push(err);
                                  return acc;
                                }, {} as Record<string, { step: number; errors: typeof validationErrors }>)
                              ).map(([stepLabel, { step, errors }]) => (
                                <div key={stepLabel} className="bg-white/60 rounded-lg p-3 border border-red-100">
                                  <button
                                    type="button"
                                    onClick={() => setCurrentStep(step)}
                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-900 mb-1.5"
                                    data-testid={`link-goto-step-${step}`}
                                  >
                                    <ArrowLeft className="h-3 w-3" />
                                    {stepLabel}
                                    <span className="text-[10px] font-normal text-red-400 ml-1">(click to go)</span>
                                  </button>
                                  <ul className="space-y-1 ml-5">
                                    {errors.map((e, i) => (
                                      <li key={i} className="text-sm text-red-600 flex items-start gap-1.5">
                                        <X className="w-3 h-3 mt-0.5 shrink-0" />
                                        <span><strong>{e.field}</strong>: {e.message}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {validationErrors.length === 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-5" data-testid="validation-success">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                            <Check className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-green-800">All validations passed</h3>
                            <p className="text-sm text-green-600 mt-0.5">Your property is ready to publish or save as draft.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Property Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p><strong>Name:</strong> {form.watch("name") || "-"}</p>
                          <p><strong>Category:</strong> {form.watch("category")}</p>
                          <p>
                            <strong>Booking Mode:</strong>{" "}
                            <span className={form.watch("bookingMode") === "academic_year" ? "text-purple-600 font-medium" : "text-blue-600 font-medium"}>
                              {form.watch("bookingMode") === "academic_year" ? "Academic Year Only" : "Monthly Booking"}
                            </span>
                          </p>
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
                                  <th className="text-right py-2">
                                    {form.watch("bookingMode") === "monthly" ? "Price/Month" : "Price/Year"}
                                  </th>
                                  <th className="text-right py-2">Deposit</th>
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
                                    <td className="text-right py-2">
                                      ₹{form.watch("bookingMode") === "monthly" 
                                        ? form.watch(`roomTypes.${index}.basePrice`)?.toLocaleString()
                                        : form.watch(`roomTypes.${index}.academicYearPrice`)?.toLocaleString()}
                                    </td>
                                    <td className="text-right py-2">₹{form.watch(`roomTypes.${index}.deposit`)?.toLocaleString() || 0}</td>
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
      <Dialog open={showAddAmenityModal} onOpenChange={(open) => { setShowAddAmenityModal(open); if (!open) setNewAmenityType(basicDetailsTab === "facilities" ? "facility" : "amenity"); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New {basicDetailsTab === "facilities" ? "Facility" : "Amenity"}</DialogTitle>
            <DialogDescription>
              Create a new {basicDetailsTab === "facilities" ? "facility" : "amenity"} that will be available for all properties.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Type</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={newAmenityType === "amenity" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewAmenityType("amenity")}
                  className={newAmenityType === "amenity" ? "bg-[hsl(345,72%,41%)] hover:bg-[hsl(345,72%,35%)]" : ""}
                  data-testid="button-type-amenity"
                >
                  Amenity
                </Button>
                <Button
                  type="button"
                  variant={newAmenityType === "facility" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewAmenityType("facility")}
                  className={newAmenityType === "facility" ? "bg-blue-600 hover:bg-blue-700" : ""}
                  data-testid="button-type-facility"
                >
                  Facility
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="amenity-name">{newAmenityType === "facility" ? "Facility" : "Amenity"} Name *</Label>
              <Input
                id="amenity-name"
                value={newAmenityName}
                onChange={(e) => setNewAmenityName(e.target.value)}
                placeholder={newAmenityType === "facility" ? "e.g., Fire Extinguishers" : "e.g., Swimming Pool"}
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
