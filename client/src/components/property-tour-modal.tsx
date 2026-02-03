import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, Volume2, VolumeX, Maximize, Building2, Bed, Sparkles, MapPin, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Property {
  id: string;
  name: string;
  location: string;
  overviewVideoUrl?: string | null;
  roomsVideoUrl?: string | null;
  amenitiesVideoUrl?: string | null;
  locationVideoUrl?: string | null;
  tourPosterUrl?: string | null;
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

export function PropertyTourModal({ isOpen, onClose, initialPropertyId }: PropertyTourModalProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const getVideoUrl = useCallback(() => {
    if (!selectedProperty) return null;
    switch (activeTab) {
      case "overview": return selectedProperty.overviewVideoUrl;
      case "rooms": return selectedProperty.roomsVideoUrl;
      case "amenities": return selectedProperty.amenitiesVideoUrl;
      case "location": return selectedProperty.locationVideoUrl;
      default: return null;
    }
  }, [selectedProperty, activeTab]);

  const videoUrl = getVideoUrl();

  useEffect(() => {
    if (selectedPropertyId) {
      localStorage.setItem(STORAGE_KEY, selectedPropertyId);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [videoUrl]);

  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    trackEvent("property_changed", { propertyId });
  };

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    trackEvent("tab_changed", { tab: tabId, propertyId: selectedPropertyId });
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
        trackEvent("video_played", { propertyId: selectedPropertyId, tab: activeTab });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleEnquire = () => {
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
          onClick={onClose}
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
              onClick={onClose}
              className="rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="h-full flex flex-col md:flex-row">
            <div className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
                  <SelectTrigger className="w-full sm:w-64 bg-white/10 border-white/20 text-white rounded-xl">
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

              <div className="flex-1 relative rounded-2xl overflow-hidden bg-black/50 min-h-[200px]">
                {loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : videoUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-contain"
                      poster={selectedProperty?.tourPosterUrl || undefined}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      muted={isMuted}
                      playsInline
                    >
                      <source src={videoUrl} type="video/mp4" />
                    </video>

                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePlayPause}
                            className="rounded-full bg-white/20 hover:bg-white/30 text-white"
                          >
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMuted(!isMuted)}
                            className="rounded-full bg-white/20 hover:bg-white/30 text-white"
                          >
                            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleFullscreen}
                          className="rounded-full bg-white/20 hover:bg-white/30 text-white"
                        >
                          <Maximize className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60">
                    <Play className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No video available for this section</p>
                    <p className="text-sm mt-1">Check other tabs or properties</p>
                  </div>
                )}
              </div>
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
                >
                  Book / Enquire
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 rounded-xl h-12"
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
