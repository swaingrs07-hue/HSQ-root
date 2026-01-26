import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
    imageUrl: z.string().url("Valid URL required"),
    caption: z.string().optional(),
    isPrimary: z.boolean().optional(),
    roomTypeIndex: z.number().optional(),
  })).optional(),
});

type PropertyFormData = z.infer<typeof propertyFormSchema>;

const defaultRoomType = {
  name: "Single" as const,
  customName: "",
  occupancy: 1,
  totalRooms: 1,
  totalBeds: 1,
  availableBeds: 1,
  basePrice: 0,
  size: "",
};

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

export default function AddProperty() {
  const [, setLocation] = useLocation();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newRule, setNewRule] = useState("");
  const [newAmenityId, setNewAmenityId] = useState("");

  const { data: globalAmenities = [] } = useQuery({
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

  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control: form.control,
    name: "images",
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

  const createProperty = useMutation({
    mutationFn: async (data: PropertyFormData & { status: "draft" | "published" }) => {
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
        images: data.images || [],
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

    setIsSubmitting(true);
    const data = form.getValues();
    createProperty.mutate({ ...data, status });
    setIsSubmitting(false);
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

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

                    <div className="border-t pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Amenities</h3>
                      </div>
                      <div className="flex gap-2 mb-4">
                        <Select value={newAmenityId} onValueChange={setNewAmenityId}>
                          <SelectTrigger className="flex-1" data-testid="select-amenity">
                            <SelectValue placeholder="Select amenity to add" />
                          </SelectTrigger>
                          <SelectContent>
                            {globalAmenities
                              .filter((a: any) => !amenityFields.some(f => f.amenityId === a.id))
                              .map((amenity: any) => (
                                <SelectItem key={amenity.id} value={amenity.id}>
                                  {amenity.icon} {amenity.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" onClick={handleAddAmenity} className="bg-[hsl(345,72%,41%)] hover:bg-[hsl(345,72%,35%)]" data-testid="button-add-amenity">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {amenityFields.map((field, index) => (
                          <div
                            key={field.id}
                            className="flex items-center gap-2 bg-[hsl(345,72%,41%)]/10 text-[hsl(345,72%,41%)] px-3 py-1 rounded-full"
                          >
                            <span className="text-sm font-medium">{field.name}</span>
                            <button
                              type="button"
                              onClick={() => removeAmenity(index)}
                              className="hover:text-red-500"
                              data-testid={`button-remove-amenity-${index}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
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
                          <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                            <div>
                              <Label>Place Name *</Label>
                              <Input
                                {...form.register(`nearbyLocations.${index}.placeName`)}
                                placeholder="e.g., MIT College"
                                className="mt-1"
                                data-testid={`input-nearby-name-${index}`}
                              />
                            </div>
                            <div>
                              <Label>Distance *</Label>
                              <Input
                                {...form.register(`nearbyLocations.${index}.distance`)}
                                placeholder="e.g., 500m"
                                className="mt-1"
                                data-testid={`input-nearby-distance-${index}`}
                              />
                            </div>
                            <div>
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
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => removeNearby(index)}
                                data-testid={`button-remove-nearby-${index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        {nearbyFields.length === 0 && (
                          <p className="text-gray-500 text-sm text-center py-4">
                            No nearby locations added yet. Click "Add Location" to add one.
                          </p>
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
                        onClick={() => appendRoomType({ ...defaultRoomType })}
                        className="bg-[hsl(345,72%,41%)] hover:bg-[hsl(345,72%,35%)]"
                        data-testid="button-add-room"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Room Type
                      </Button>
                    </div>

                    <div className="space-y-6">
                      {roomTypeFields.map((field, index) => (
                        <Card key={field.id} className="border-2">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">Room Type {index + 1}</CardTitle>
                              {roomTypeFields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => removeRoomType(index)}
                                  data-testid={`button-remove-room-${index}`}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Remove
                                </Button>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label>Room Type *</Label>
                                <Select
                                  value={form.watch(`roomTypes.${index}.name`)}
                                  onValueChange={(value) => form.setValue(`roomTypes.${index}.name`, value as any)}
                                >
                                  <SelectTrigger className="mt-1" data-testid={`select-room-type-${index}`}>
                                    <SelectValue placeholder="Select room type" />
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
                              <div>
                                <Label>Custom Name (optional)</Label>
                                <Input
                                  {...form.register(`roomTypes.${index}.customName`)}
                                  placeholder="e.g., Premium Deluxe"
                                  className="mt-1"
                                  data-testid={`input-room-custom-name-${index}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <Label>Occupancy (persons) *</Label>
                                <Input
                                  type="number"
                                  {...form.register(`roomTypes.${index}.occupancy`, { valueAsNumber: true })}
                                  min={1}
                                  className="mt-1"
                                  data-testid={`input-room-occupancy-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Total Rooms *</Label>
                                <Input
                                  type="number"
                                  {...form.register(`roomTypes.${index}.totalRooms`, { valueAsNumber: true })}
                                  min={1}
                                  className="mt-1"
                                  data-testid={`input-room-total-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Room Size (e.g., 120 sqft)</Label>
                                <Input
                                  {...form.register(`roomTypes.${index}.size`)}
                                  placeholder="e.g., 120 sqft"
                                  className="mt-1"
                                  data-testid={`input-room-size-${index}`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label>Total Beds *</Label>
                                <Input
                                  type="number"
                                  {...form.register(`roomTypes.${index}.totalBeds`, { valueAsNumber: true })}
                                  min={1}
                                  className="mt-1"
                                  data-testid={`input-room-total-beds-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Available Beds *</Label>
                                <Input
                                  type="number"
                                  {...form.register(`roomTypes.${index}.availableBeds`, { valueAsNumber: true })}
                                  min={0}
                                  className="mt-1"
                                  data-testid={`input-room-available-beds-${index}`}
                                />
                              </div>
                            </div>

                            <div>
                              <Label>Base Price (₹/month) *</Label>
                              <Input
                                type="number"
                                {...form.register(`roomTypes.${index}.basePrice`, { valueAsNumber: true })}
                                min={0}
                                className="mt-1"
                                data-testid={`input-room-price-${index}`}
                              />
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
                          academicYear: "2025-26", 
                          monthlyPrice: 0, 
                          deposit: 0, 
                          discount: 0, 
                          discountLabel: "" 
                        })}
                        data-testid="button-add-tariff"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Academic Year Tariff
                      </Button>
                    </div>

                    <div className="bg-[hsl(345,72%,41%)]/5 border border-[hsl(345,72%,41%)]/20 rounded-lg p-4">
                      <p className="text-sm">
                        <strong>Note:</strong> Room-level pricing is set in the Room Types step. 
                        Use this section to add special academic year tariffs with discounts if applicable.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {tariffFields.map((field, index) => (
                        <Card key={field.id}>
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                              <div>
                                <Label>Academic Year *</Label>
                                <Input
                                  {...form.register(`tariffs.${index}.academicYear`)}
                                  placeholder="e.g., 2025-26"
                                  className="mt-1"
                                  data-testid={`input-tariff-year-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Monthly Price (₹)</Label>
                                <Input
                                  type="number"
                                  {...form.register(`tariffs.${index}.monthlyPrice`, { valueAsNumber: true })}
                                  min={0}
                                  className="mt-1"
                                  data-testid={`input-tariff-price-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Deposit (₹)</Label>
                                <Input
                                  type="number"
                                  {...form.register(`tariffs.${index}.deposit`, { valueAsNumber: true })}
                                  min={0}
                                  className="mt-1"
                                  data-testid={`input-tariff-deposit-${index}`}
                                />
                              </div>
                              <div>
                                <Label>Discount (%)</Label>
                                <Input
                                  type="number"
                                  {...form.register(`tariffs.${index}.discount`, { valueAsNumber: true })}
                                  min={0}
                                  max={100}
                                  className="mt-1"
                                  data-testid={`input-tariff-discount-${index}`}
                                />
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <Label>Discount Label</Label>
                                  <Input
                                    {...form.register(`tariffs.${index}.discountLabel`)}
                                    placeholder="e.g., Early Bird"
                                    className="mt-1"
                                    data-testid={`input-tariff-label-${index}`}
                                  />
                                </div>
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
                        <p className="text-gray-500 text-center py-8">
                          No special tariffs added. Room prices will be used as default pricing.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {currentStep === 5 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold">Property Images</h2>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => appendImage({ imageUrl: "", caption: "", isPrimary: imageFields.length === 0 })}
                        data-testid="button-add-image"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Image URL
                      </Button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-700">
                        <strong>Tip:</strong> Add image URLs from cloud storage (Google Drive, Imgur, etc.). 
                        The first image marked as "Primary" will be shown as the main property image.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {imageFields.map((field, index) => (
                        <Card key={field.id}>
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                              <div className="md:col-span-5">
                                <Label>Image URL *</Label>
                                <Input
                                  {...form.register(`images.${index}.imageUrl`)}
                                  placeholder="https://..."
                                  className="mt-1"
                                  data-testid={`input-image-url-${index}`}
                                />
                              </div>
                              <div className="md:col-span-3">
                                <Label>Caption</Label>
                                <Input
                                  {...form.register(`images.${index}.caption`)}
                                  placeholder="e.g., Building Exterior"
                                  className="mt-1"
                                  data-testid={`input-image-caption-${index}`}
                                />
                              </div>
                              <div className="md:col-span-2 flex items-center gap-2">
                                <Switch
                                  checked={form.watch(`images.${index}.isPrimary`) || false}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      imageFields.forEach((_, i) => {
                                        form.setValue(`images.${i}.isPrimary`, i === index);
                                      });
                                    } else {
                                      form.setValue(`images.${index}.isPrimary`, false);
                                    }
                                  }}
                                  data-testid={`switch-image-primary-${index}`}
                                />
                                <Label className="text-sm">Primary</Label>
                              </div>
                              <div className="md:col-span-2 flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => removeImage(index)}
                                  data-testid={`button-remove-image-${index}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            {form.watch(`images.${index}.imageUrl`) && (
                              <div className="mt-4">
                                <img
                                  src={form.watch(`images.${index}.imageUrl`)}
                                  alt={form.watch(`images.${index}.caption`) || "Preview"}
                                  className="h-24 w-auto rounded-lg object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}

                      {imageFields.length === 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                          <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                          <p className="text-gray-500">No images added yet.</p>
                          <p className="text-gray-400 text-sm">Click "Add Image URL" to add property photos.</p>
                        </div>
                      )}
                    </div>
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
                          <p><strong>Images:</strong> {imageFields.length}</p>
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
    </div>
  );
}
