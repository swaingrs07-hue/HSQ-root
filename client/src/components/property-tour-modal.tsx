import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Building2, Bed, Sparkles, MapPin, Check, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Property {
  id: string;
  name: string;
  location: string;
  tourOverviewImages?: string | null;
  tourRoomsImages?: string | null;
  tourAmenitiesImages?: string | null;
  tourLocationImages?: string | null;
  highlights?: string[] | null;
  amenities: string[];
}

interface PropertyTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPropertyId?: string;
}

const TOUR_TABS = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "rooms", label: "Rooms", icon: Bed },
  { id: "amenities", label: "Amenities", icon: Sparkles },
  { id: "location", label: "Location", icon: MapPin },
] as const;

type TabId = typeof TOUR_TABS[number]["id"];

const STORAGE_KEY = "hsquare_tour_last_property";

const trackEvent = (eventName: string, data?: Record<string, unknown>) => {
  console.log(`[Analytics] ${eventName}`, data);
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", eventName, data);
  }
};

function parseImages(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function PropertyTourModal({ isOpen, onClose, initialPropertyId }: PropertyTourModalProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      trackEvent("tour_opened");
      loadProperties();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const loadProperties = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/properties");
      if (response.ok) {
        const data = await response.json();
        setProperties(data);
        
        const savedPropertyId = localStorage.getItem(STORAGE_KEY);
        const initialId = initialPropertyId || savedPropertyId;
        
        if (initialId && data.some((p: Property) => p.id === initialId)) {
          setSelectedPropertyId(initialId);
        } else if (data.length > 0) {
          setSelectedPropertyId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load properties:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  const getImages = useCallback((): string[] => {
    if (!selectedProperty) return [];
    switch (activeTab) {
      case "overview": return parseImages(selectedProperty.tourOverviewImages);
      case "rooms": return parseImages(selectedProperty.tourRoomsImages);
      case "amenities": return parseImages(selectedProperty.tourAmenitiesImages);
      case "location": return parseImages(selectedProperty.tourLocationImages);
      default: return [];
    }
  }, [selectedProperty, activeTab]);

  const images = getImages();

  useEffect(() => {
    if (selectedPropertyId) {
      localStorage.setItem(STORAGE_KEY, selectedPropertyId);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [activeTab, selectedPropertyId]);

  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    trackEvent("property_changed", { propertyId });
  };

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    trackEvent("tab_changed", { tab: tabId, propertyId: selectedPropertyId });
  };

  const handleClose = () => {
    trackEvent("tour_closed", { propertyId: selectedPropertyId, lastTab: activeTab });
    onClose();
  };

  const handlePrevImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    if (images.length === 0) return;
    setCurrentImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleThumbnailClick = (index: number) => {
    setCurrentImageIndex(index);
    trackEvent("tour_thumbnail_clicked", { propertyId: selectedPropertyId, tab: activeTab, index });
  };

  const handleEnquire = () => {
    trackEvent("tour_enquire_clicked", { propertyId: selectedPropertyId });
    onClose();
    window.location.href = `/properties?enquire=${selectedPropertyId}`;
  };

  const highlights = selectedProperty?.highlights?.slice(0, 5) || 
    selectedProperty?.amenities?.slice(0, 5) || [];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={handleClose}
          data-testid="tour-modal-backdrop"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative z-10 w-full h-full md:w-[95vw] md:h-[90vh] md:max-w-7xl md:rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden shadow-2xl"
        >
          <div className="absolute top-4 right-4 z-20">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
              data-testid="button-close-tour"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="h-full flex flex-col md:flex-row">
            <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
                  <SelectTrigger className="w-full sm:w-64 bg-white/10 border-white/20 text-white rounded-xl" data-testid="select-tour-property">
                    <SelectValue placeholder="Select Property" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {properties.map((property) => (
                      <SelectItem 
                        key={property.id} 
                        value={property.id}
                        className="text-white hover:bg-white/10 focus:bg-white/10"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          <span>{property.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex bg-white/5 rounded-xl p-1 overflow-x-auto">
                  {TOUR_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      data-testid={`tab-tour-${tab.id}`}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                        activeTab === tab.id
                          ? "bg-primary text-white shadow-lg"
                          : "text-white/60 hover:text-white hover:bg-white/10"
                      )}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 relative rounded-2xl overflow-hidden bg-black/50" style={{ aspectRatio: "16/9", minHeight: "200px" }}>
                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : images.length > 0 ? (
                  <>
                    <AnimatePresence mode="wait">
                      <motion.img
                        key={`${activeTab}-${currentImageIndex}`}
                        src={images[currentImageIndex]}
                        alt={`${activeTab} ${currentImageIndex + 1}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        onLoad={() => setImageLoading(false)}
                        onLoadStart={() => setImageLoading(true)}
                      />
                    </AnimatePresence>

                    {images.length > 1 && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handlePrevImage}
                          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                          data-testid="button-prev-image"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleNextImage}
                          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                          data-testid="button-next-image"
                        >
                          <ChevronRight className="w-6 h-6" />
                        </Button>
                      </>
                    )}

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-sm">
                      {currentImageIndex + 1} / {images.length}
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
                    <Camera className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Tour images coming soon</p>
                    <p className="text-sm mt-1">Check other tabs or properties</p>
                  </div>
                )}
              </div>

              {images.length > 1 && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                  {images.map((img, index) => (
                    <button
                      key={`thumb-${index}`}
                      onClick={() => handleThumbnailClick(index)}
                      data-testid={`thumbnail-${index}`}
                      className={cn(
                        "flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all",
                        currentImageIndex === index 
                          ? "border-primary ring-2 ring-primary/50" 
                          : "border-transparent hover:border-white/30"
                      )}
                    >
                      <img
                        src={img}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full md:w-80 bg-white/5 backdrop-blur-sm p-4 md:p-6 flex flex-col border-t md:border-t-0 md:border-l border-white/10">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white mb-1">
                  {selectedProperty?.name || "Select a Property"}
                </h3>
                <p className="text-white/60 text-sm flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {selectedProperty?.location || "Location"}
                </p>
              </div>

              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-3">
                  Key Highlights
                </h4>
                <ul className="space-y-2">
                  {highlights.length > 0 ? (
                    highlights.map((highlight, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-2 text-white/80"
                      >
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{highlight}</span>
                      </motion.li>
                    ))
                  ) : (
                    <li className="text-white/50 text-sm">No highlights available</li>
                  )}
                </ul>
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  onClick={handleEnquire}
                  className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl h-12 font-semibold shadow-lg shadow-primary/25"
                  data-testid="button-tour-enquire"
                >
                  Book / Enquire
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 rounded-xl h-12"
                  data-testid="button-tour-close-bottom"
                >
                  Close Tour
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
