import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, ImagePlus, Trash2, Save, Loader2, GripVertical, Eye, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";

function getAuthToken(): string {
  try {
    const auth = JSON.parse(localStorage.getItem("hsquare_auth") || "{}");
    return auth.token || "";
  } catch {
    return "";
  }
}

interface Property {
  id: string;
  name: string;
  tourOverviewImages?: string | null;
  tourRoomsImages?: string | null;
  tourAmenitiesImages?: string | null;
  tourLocationImages?: string | null;
}

type TourCategory = "overview" | "rooms" | "amenities" | "location";

const TOUR_CATEGORIES: { id: TourCategory; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "🏠" },
  { id: "rooms", label: "Rooms", icon: "🛏️" },
  { id: "amenities", label: "Amenities", icon: "✨" },
  { id: "location", label: "Location", icon: "📍" },
];

function parseImages(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AdminPropertyTourImages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<TourCategory>("overview");
  const [categoryImages, setCategoryImages] = useState<Record<TourCategory, string[]>>({
    overview: [],
    rooms: [],
    amenities: [],
    location: [],
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: properties, isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const selectedProperty = properties?.find(p => p.id === selectedPropertyId);

  useEffect(() => {
    if (properties && properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  useEffect(() => {
    if (selectedProperty) {
      setCategoryImages({
        overview: parseImages(selectedProperty.tourOverviewImages),
        rooms: parseImages(selectedProperty.tourRoomsImages),
        amenities: parseImages(selectedProperty.tourAmenitiesImages),
        location: parseImages(selectedProperty.tourLocationImages),
      });
      setHasChanges(false);
    }
  }, [selectedProperty]);

  const updateMutation = useMutation({
    mutationFn: async ({ category, images }: { category: TourCategory; images: string[] }) => {
      const token = getAuthToken();
      const response = await fetch(`/api/admin/properties/${selectedPropertyId}/tour-images`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category, images }),
      });
      if (!response.ok) {
        throw new Error("Failed to save images");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({
        title: "Images Updated",
        description: `Tour images for ${activeCategory} have been saved.`,
      });
      setHasChanges(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update tour images. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddImage = useCallback((imageUrl: string) => {
    setCategoryImages(prev => ({
      ...prev,
      [activeCategory]: [...prev[activeCategory], imageUrl],
    }));
    setHasChanges(true);
  }, [activeCategory]);

  const handleRemoveImage = (index: number) => {
    setCategoryImages(prev => ({
      ...prev,
      [activeCategory]: prev[activeCategory].filter((_, i) => i !== index),
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (!selectedPropertyId) return;
    updateMutation.mutate({
      category: activeCategory,
      images: categoryImages[activeCategory],
    });
  };

  const currentImages = categoryImages[activeCategory];

  if (propertiesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Camera className="w-7 h-7" />
            Property Tour Images
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage tour images for each property category</p>
        </div>
        
        <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
          <SelectTrigger className="w-full sm:w-64" data-testid="select-property">
            <SelectValue placeholder="Select Property" />
          </SelectTrigger>
          <SelectContent>
            {properties?.map((property) => (
              <SelectItem key={property.id} value={property.id} data-testid={`option-property-${property.id}`}>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {property.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedPropertyId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Select a property to manage tour images</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">
              {selectedProperty?.name} - Tour Images
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as TourCategory)}>
              <TabsList className="grid w-full grid-cols-4">
                {TOUR_CATEGORIES.map((cat) => (
                  <TabsTrigger 
                    key={cat.id} 
                    value={cat.id}
                    data-testid={`tab-${cat.id}`}
                    className="flex items-center gap-2"
                  >
                    <span>{cat.icon}</span>
                    <span className="hidden sm:inline">{cat.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {TOUR_CATEGORIES.map((cat) => (
                <TabsContent key={cat.id} value={cat.id} className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-slate-700">{cat.label} Images</h3>
                      <p className="text-sm text-slate-500">
                        {categoryImages[cat.id].length} image{categoryImages[cat.id].length !== 1 ? "s" : ""} uploaded
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ObjectUploader
                        maxNumberOfFiles={10}
                        maxFileSize={8388608}
                        onGetUploadParameters={async (file) => {
                          const res = await fetch("/api/uploads/request-url", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name: file.name,
                              size: file.size,
                              contentType: file.type,
                            }),
                          });
                          const data = await res.json();
                          (file as any).objectPath = data.objectPath;
                          return {
                            method: "PUT",
                            url: data.uploadURL,
                            headers: { "Content-Type": file.type as string },
                          };
                        }}
                        onComplete={(result) => {
                          result.successful?.forEach((file) => {
                            const objectPath = (file as any).objectPath;
                            if (objectPath) {
                              handleAddImage(objectPath);
                            }
                          });
                        }}
                        buttonClassName="bg-primary hover:bg-primary/90"
                      >
                        <ImagePlus className="w-4 h-4 mr-2" />
                        Add Images
                      </ObjectUploader>
                      
                      {hasChanges && cat.id === activeCategory && (
                        <Button 
                          onClick={handleSave}
                          disabled={updateMutation.isPending}
                          data-testid="button-save-images"
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Save Changes
                        </Button>
                      )}
                    </div>
                  </div>

                  {categoryImages[cat.id].length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
                      <Camera className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                      <p className="text-slate-500 mb-2">No images uploaded for {cat.label}</p>
                      <p className="text-sm text-slate-400">Click "Add Images" to upload tour images</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {categoryImages[cat.id].map((imageUrl, index) => (
                        <div 
                          key={`${imageUrl}-${index}`}
                          className="group relative aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200 hover:border-primary transition-colors"
                        >
                          <img
                            src={imageUrl}
                            alt={`${cat.label} ${index + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => window.open(imageUrl, "_blank")}
                                data-testid={`button-view-image-${index}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemoveImage(index)}
                                data-testid={`button-remove-image-${index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
