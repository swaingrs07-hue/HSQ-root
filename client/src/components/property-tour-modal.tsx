import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Building2, Bed, Sparkles, MapPin, Check, Camera, Phone, Mail, IndianRupee, FileText, ArrowLeft, CheckCircle2, Loader2, User, Play, Pause, Grid3X3, Maximize2, Eye, ZoomIn, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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
  { id: "overview", label: "Overview", icon: Building2, desc: "Exterior & Common" },
  { id: "rooms", label: "Rooms", icon: Bed, desc: "Living Spaces" },
  { id: "amenities", label: "Amenities", icon: Sparkles, desc: "Facilities" },
  { id: "location", label: "Location", icon: MapPin, desc: "Surroundings" },
] as const;

type TabId = typeof TOUR_TABS[number]["id"];
type ModalView = "tour" | "choice" | "enquiry" | "success";

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
  const [modalView, setModalView] = useState<ModalView>("tour");
  const [submitting, setSubmitting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const [enquiryForm, setEnquiryForm] = useState({
    name: "", phone: "", email: "", propertyId: "", minBudget: "", maxBudget: "", notes: "",
  });
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      trackEvent("tour_opened");
      loadProperties();
      document.body.style.overflow = "hidden";
      setModalView("tour");
      setIsPlaying(true);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
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

  const getImagesForTab = useCallback((tab: TabId): string[] => {
    if (!selectedProperty) return [];
    switch (tab) {
      case "overview": return parseImages(selectedProperty.tourOverviewImages);
      case "rooms": return parseImages(selectedProperty.tourRoomsImages);
      case "amenities": return parseImages(selectedProperty.tourAmenitiesImages);
      case "location": return parseImages(selectedProperty.tourLocationImages);
      default: return [];
    }
  }, [selectedProperty]);

  const images = getImagesForTab(activeTab);
  const allImages = TOUR_TABS.flatMap(t => getImagesForTab(t.id));
  const globalIndex = TOUR_TABS.slice(0, TOUR_TABS.findIndex(t => t.id === activeTab))
    .reduce((s, t) => s + getImagesForTab(t.id).length, 0) + currentImageIndex;
  const progress = allImages.length > 0 ? ((globalIndex + 1) / allImages.length) * 100 : 0;
  const currentTab = TOUR_TABS.find(t => t.id === activeTab)!;

  useEffect(() => {
    if (selectedPropertyId) localStorage.setItem(STORAGE_KEY, selectedPropertyId);
  }, [selectedPropertyId]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [activeTab, selectedPropertyId]);

  useEffect(() => {
    if (autoPlayRef.current) { clearInterval(autoPlayRef.current); autoPlayRef.current = null; }
    if (isPlaying && images.length > 1 && modalView === "tour") {
      autoPlayRef.current = setInterval(() => {
        setCurrentImageIndex(prev => {
          const next = (prev + 1) % images.length;
          if (next === 0) {
            const tabIdx = TOUR_TABS.findIndex(t => t.id === activeTab);
            for (let i = 1; i <= TOUR_TABS.length; i++) {
              const ci = (tabIdx + i) % TOUR_TABS.length;
              if (ci !== tabIdx && getImagesForTab(TOUR_TABS[ci].id).length > 0) {
                setActiveTab(TOUR_TABS[ci].id);
                return 0;
              }
            }
          }
          return next;
        });
      }, 5000);
    }
    return () => { if (autoPlayRef.current) { clearInterval(autoPlayRef.current); autoPlayRef.current = null; } };
  }, [isPlaying, images.length, activeTab, modalView, getImagesForTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrevImage();
      else if (e.key === "ArrowRight") handleNextImage();
      else if (e.key === "Escape") { if (showGrid) setShowGrid(false); else handleClose(); }
      else if (e.key === " ") { e.preventDefault(); setIsPlaying(p => !p); }
      else if (e.key === "g") setShowGrid(p => !p);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, showGrid, images.length, currentImageIndex]);

  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    trackEvent("property_changed", { propertyId });
  };

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setIsPlaying(false);
    trackEvent("tab_changed", { tab: tabId, propertyId: selectedPropertyId });
  };

  const handleClose = () => {
    trackEvent("tour_closed", { propertyId: selectedPropertyId, lastTab: activeTab });
    setModalView("tour");
    setIsPlaying(false);
    onClose();
  };

  const handlePrevImage = () => {
    if (images.length === 0) return;
    setIsPlaying(false);
    if (currentImageIndex === 0) {
      const tabIdx = TOUR_TABS.findIndex(t => t.id === activeTab);
      for (let i = TOUR_TABS.length - 1; i >= 0; i--) {
        const ci = (tabIdx - 1 + TOUR_TABS.length + i) % TOUR_TABS.length;
        if (ci !== tabIdx) {
          const prevImgs = getImagesForTab(TOUR_TABS[ci].id);
          if (prevImgs.length > 0) { setActiveTab(TOUR_TABS[ci].id); setCurrentImageIndex(prevImgs.length - 1); return; }
        }
      }
    }
    setCurrentImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    if (images.length === 0) return;
    setIsPlaying(false);
    if (currentImageIndex === images.length - 1) {
      const tabIdx = TOUR_TABS.findIndex(t => t.id === activeTab);
      for (let i = 1; i <= TOUR_TABS.length; i++) {
        const ci = (tabIdx + i) % TOUR_TABS.length;
        if (ci !== tabIdx && getImagesForTab(TOUR_TABS[ci].id).length > 0) { setActiveTab(TOUR_TABS[ci].id); setCurrentImageIndex(0); return; }
      }
    }
    setCurrentImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; touchEndX.current = null; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) { diff > 0 ? handleNextImage() : handlePrevImage(); }
    touchStartX.current = null; touchEndX.current = null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!imgRef.current || !isZoomed) return;
    const rect = imgRef.current.getBoundingClientRect();
    setCursorPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  };

  const handleBookClick = () => {
    trackEvent("tour_book_clicked", { propertyId: selectedPropertyId });
    onClose();
    const selectedProp = properties.find((p: any) => p.id === selectedPropertyId);
    window.location.href = `/properties/${selectedProp?.slug || selectedPropertyId}`;
  };

  const handleEnquireClick = () => {
    trackEvent("tour_enquire_clicked", { propertyId: selectedPropertyId });
    setEnquiryForm(prev => ({ ...prev, propertyId: selectedPropertyId }));
    setModalView("enquiry");
  };

  const handleEnquirySubmit = async () => {
    if (!enquiryForm.name.trim() || !enquiryForm.phone.trim()) {
      toast({ title: "Required fields", description: "Please fill in name and phone number.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(enquiryForm) });
      const data = await response.json();
      if (response.ok) {
        trackEvent("tour_enquiry_submitted", { propertyId: selectedPropertyId });
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin"] });
        setModalView("success");
        setEnquiryForm({ name: "", phone: "", email: "", propertyId: "", minBudget: "", maxBudget: "", notes: "" });
      } else {
        toast({ title: "Error", description: data.error || "Failed to submit enquiry", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const highlights = selectedProperty?.highlights?.slice(0, 6) || selectedProperty?.amenities?.slice(0, 6) || [];

  if (!isOpen) return null;

  if (showGrid) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black/98" role="dialog" aria-modal="true" aria-label="Photo library">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Grid3X3 className="w-5 h-5 text-amber-500" />
            <h3 className="text-white font-bold tracking-wider uppercase text-sm">Photo Library</h3>
            <span className="text-white/30 text-sm">{allImages.length} photos</span>
          </div>
          <button onClick={() => setShowGrid(false)} className="p-2.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all" data-testid="button-close-grid" aria-label="Close photo library">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 64px)" }}>
          {TOUR_TABS.map(tab => {
            const tabImgs = getImagesForTab(tab.id);
            if (tabImgs.length === 0) return null;
            return (
              <div key={tab.id} className="mb-10">
                <div className="flex items-center gap-2.5 mb-4">
                  <tab.icon className="w-4 h-4 text-amber-500" />
                  <h4 className="text-white/70 text-sm font-semibold uppercase tracking-widest">{tab.label}</h4>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                  <span className="text-white/20 text-xs">{tabImgs.length} photos</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {tabImgs.map((img, i) => (
                    <motion.button key={i} whileHover={{ scale: 1.02, y: -2 }} onClick={() => { setActiveTab(tab.id); setCurrentImageIndex(i); setShowGrid(false); }} className="relative aspect-[4/3] overflow-hidden group rounded-xl" data-testid={`grid-image-${tab.id}-${i}`}>
                      <img src={img} alt={`${tab.label} photo ${i + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all flex items-end justify-center pb-3">
                        <span className="flex items-center gap-1.5 text-white text-xs font-medium"><Eye className="w-3.5 h-3.5" /> View</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Virtual property tour">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={handleClose} data-testid="tour-modal-backdrop" />

        <div className="relative z-10 w-full h-full flex">
          <div className="flex-1 relative overflow-hidden" ref={imgRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onMouseMove={handleMouseMove}>

            <div className="absolute top-0 left-0 right-0 z-20 h-[3px] bg-white/5">
              <motion.div className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
            </div>

            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
                  <div className="w-16 h-16 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                </div>
              </div>
            ) : images.length > 0 ? (
              <>
                <AnimatePresence mode="wait">
                  <motion.div key={`${activeTab}-${currentImageIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }} className="absolute inset-0">
                    <motion.img
                      src={images[currentImageIndex]}
                      alt={`${activeTab} ${currentImageIndex + 1}`}
                      className="w-full h-full object-cover"
                      style={isZoomed ? { transform: "scale(2)", transformOrigin: `${cursorPos.x}% ${cursorPos.y}%`, cursor: "zoom-out" } : { cursor: "zoom-in" }}
                      onClick={() => setIsZoomed(z => !z)}
                      initial={{ scale: 1.08 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 12, ease: "linear" }}
                      loading="lazy"
                    />
                  </motion.div>
                </AnimatePresence>

                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent pointer-events-none" />

                {images.length > 1 && (
                  <>
                    <button onClick={handlePrevImage} className="absolute left-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl hover:bg-black/40 flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/10 hover:border-white/20 group" data-testid="button-prev-image" aria-label="Previous image">
                      <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <button onClick={handleNextImage} className="absolute right-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl hover:bg-black/40 flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/10 hover:border-white/20 group" data-testid="button-next-image" aria-label="Next image">
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-3xl" />
                  <Camera className="w-20 h-20 text-white/20 relative" />
                </div>
                <p className="text-white/40 font-bold text-lg mt-4 tracking-wider uppercase">Tour Coming Soon</p>
                <p className="text-white/20 text-sm mt-2">Check other tabs or properties</p>
              </div>
            )}

            <div className="absolute top-5 left-5 right-5 z-20 flex items-start justify-between">
              <div className="bg-black/30 backdrop-blur-2xl rounded-2xl px-4 py-3 border border-white/10">
                <div className="flex items-center gap-2.5">
                  <currentTab.icon className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-white text-xs font-bold tracking-widest uppercase">{currentTab.label}</p>
                    <p className="text-white/30 text-[10px]">{currentTab.desc}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setIsZoomed(z => !z)} className={cn("p-2.5 rounded-full transition-all border", isZoomed ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-black/30 backdrop-blur-xl text-white/50 hover:text-white border-white/10")} data-testid="button-zoom" aria-label={isZoomed ? "Disable zoom" : "Enable zoom"}>
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button onClick={() => setIsPlaying(p => !p)} className={cn("p-2.5 rounded-full transition-all border", isPlaying ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-black/30 backdrop-blur-xl text-white/50 hover:text-white border-white/10")} data-testid="button-autoplay" aria-label={isPlaying ? "Pause autoplay" : "Start autoplay"}>
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => setShowGrid(true)} className="p-2.5 rounded-full bg-black/30 backdrop-blur-xl text-white/50 hover:text-white border border-white/10 transition-all" data-testid="button-show-grid" aria-label="Show photo grid">
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button onClick={handleClose} className="p-2.5 rounded-full bg-black/30 backdrop-blur-xl text-white/50 hover:text-white border border-white/10 transition-all" data-testid="button-close-tour" aria-label="Close tour">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-20 p-5">
              <div className="flex items-end justify-between mb-3">
                <div className="flex gap-1 bg-black/30 backdrop-blur-2xl rounded-full p-1 border border-white/10">
                  {TOUR_TABS.map(tab => {
                    const hasImgs = getImagesForTab(tab.id).length > 0;
                    if (!hasImgs) return null;
                    return (
                      <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-semibold tracking-wider uppercase transition-all", activeTab === tab.id ? "bg-amber-500/90 text-white shadow-lg shadow-amber-500/30" : "text-white/40 hover:text-white/70 hover:bg-white/10")} data-testid={`tab-tour-${tab.id}`}>
                        <tab.icon className="w-3 h-3" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-white/25 text-xs font-mono tracking-widest">{String(globalIndex + 1).padStart(2, "0")} / {String(allImages.length).padStart(2, "0")}</span>
              </div>

              {images.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/20">
                  {images.map((img, i) => (
                    <button key={i} onClick={() => { setCurrentImageIndex(i); setIsPlaying(false); }} className={cn("flex-shrink-0 overflow-hidden transition-all duration-300 border-2 rounded-lg", i === currentImageIndex ? "w-24 h-14 border-amber-500 opacity-100 shadow-lg shadow-amber-500/20" : "w-14 h-14 border-transparent opacity-30 hover:opacity-60")} data-testid={`thumbnail-${i}`}>
                      <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:flex w-80 lg:w-96 bg-gradient-to-b from-black/80 via-black/70 to-black/80 backdrop-blur-2xl border-l border-white/10 flex-col overflow-y-auto">
            <AnimatePresence mode="wait">
              {modalView === "tour" && (
                <motion.div key="tour-sidebar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full p-6">
                  <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white rounded-xl mb-6" data-testid="select-tour-property">
                      <SelectValue placeholder="Select Property" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-800">
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id} className="text-white hover:bg-white/10 focus:bg-white/10">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-amber-500" />
                            <span>{property.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-white mb-1 tracking-tight">{selectedProperty?.name || "Select a Property"}</h3>
                    <p className="text-white/40 text-sm flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-500" />
                      {selectedProperty?.location || "Location"}
                    </p>
                  </div>

                  <div className="flex-1">
                    <h4 className="text-[10px] font-bold text-amber-500/80 uppercase tracking-[0.2em] mb-4">Key Highlights</h4>
                    <ul className="space-y-2.5">
                      {highlights.length > 0 ? highlights.map((highlight, index) => (
                        <motion.li key={index} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.08 }} className="flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mt-0.5 shrink-0">
                            <Check className="w-3 h-3 text-amber-400" />
                          </div>
                          <span className="text-white/70 text-sm leading-relaxed">{highlight}</span>
                        </motion.li>
                      )) : (
                        <li className="text-white/30 text-sm">No highlights available</li>
                      )}
                    </ul>
                  </div>

                  <div className="mt-6 space-y-3 pt-6 border-t border-white/10">
                    <Button onClick={() => setModalView("choice")} className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold rounded-xl h-12 shadow-lg shadow-amber-500/20 tracking-wider uppercase text-xs" data-testid="button-tour-enquire">
                      Book / Enquire <ArrowRight className="w-4 h-4 ml-1.5" />
                    </Button>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white/5 rounded-lg px-3 py-2.5 text-center border border-white/5">
                        <Camera className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                        <span className="text-white/40">{allImages.length} Photos</span>
                      </div>
                      <div className="bg-white/5 rounded-lg px-3 py-2.5 text-center border border-white/5">
                        <Grid3X3 className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                        <span className="text-white/40">{TOUR_TABS.filter(t => getImagesForTab(t.id).length > 0).length} Categories</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {modalView === "choice" && (
                <motion.div key="choice-sidebar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full p-6">
                  <button onClick={() => setModalView("tour")} className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs mb-6 transition-colors tracking-wider uppercase font-medium" data-testid="button-back-to-tour">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to tour
                  </button>

                  <div className="mb-8">
                    <h3 className="text-xl font-bold text-white mb-1">What would you like to do?</h3>
                    <p className="text-white/40 text-sm">Choose an option for {selectedProperty?.name}</p>
                  </div>

                  <div className="flex-1 space-y-4">
                    <button onClick={handleBookClick} className="w-full p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all group text-left" data-testid="button-choice-book">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                          <CheckCircle2 className="w-5 h-5 text-black" />
                        </div>
                        <h4 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">Book Now</h4>
                      </div>
                      <p className="text-white/40 text-sm pl-14">Select your floor, room & bed and complete booking</p>
                    </button>

                    <button onClick={handleEnquireClick} className="w-full p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group text-left" data-testid="button-choice-enquire">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">Enquire</h4>
                      </div>
                      <p className="text-white/40 text-sm pl-14">Send us your details and our team will contact you</p>
                    </button>
                  </div>
                </motion.div>
              )}

              {modalView === "enquiry" && (
                <motion.div key="enquiry-sidebar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full p-6">
                  <button onClick={() => setModalView("choice")} className="flex items-center gap-1.5 text-white/40 hover:text-white text-xs mb-4 transition-colors tracking-wider uppercase font-medium" data-testid="button-back-to-choice">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>

                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-white mb-0.5">Submit Enquiry</h3>
                    <p className="text-white/40 text-xs">Fill in your details and we'll get back to you</p>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    <div>
                      <Label className="text-white/60 text-xs mb-1 block">Name *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input placeholder="Your name" value={enquiryForm.name} onChange={(e) => setEnquiryForm(prev => ({ ...prev, name: e.target.value }))} className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-10 focus:border-amber-500/50 focus:ring-amber-500/20" data-testid="input-enquiry-name" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-white/60 text-xs mb-1 block">Phone *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input placeholder="Phone number" value={enquiryForm.phone} onChange={(e) => setEnquiryForm(prev => ({ ...prev, phone: e.target.value }))} className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-10 focus:border-amber-500/50 focus:ring-amber-500/20" data-testid="input-enquiry-phone" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-white/60 text-xs mb-1 block">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <Input placeholder="Email address" value={enquiryForm.email} onChange={(e) => setEnquiryForm(prev => ({ ...prev, email: e.target.value }))} className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-10 focus:border-amber-500/50 focus:ring-amber-500/20" data-testid="input-enquiry-email" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-white/60 text-xs mb-1 block">Property</Label>
                      <Select value={enquiryForm.propertyId} onValueChange={(val) => setEnquiryForm(prev => ({ ...prev, propertyId: val }))}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-10" data-testid="select-enquiry-property">
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-800">
                          {properties.map((property) => (
                            <SelectItem key={property.id} value={property.id} className="text-white hover:bg-white/10 focus:bg-white/10">{property.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-white/60 text-xs mb-1 block">Min Budget</Label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                          <Input placeholder="10,000" value={enquiryForm.minBudget} onChange={(e) => setEnquiryForm(prev => ({ ...prev, minBudget: e.target.value }))} className="pl-8 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-10" data-testid="input-enquiry-min-budget" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-white/60 text-xs mb-1 block">Max Budget</Label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                          <Input placeholder="25,000" value={enquiryForm.maxBudget} onChange={(e) => setEnquiryForm(prev => ({ ...prev, maxBudget: e.target.value }))} className="pl-8 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl h-10" data-testid="input-enquiry-max-budget" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="text-white/60 text-xs mb-1 block">Notes</Label>
                      <Textarea placeholder="Additional notes..." value={enquiryForm.notes} onChange={(e) => setEnquiryForm(prev => ({ ...prev, notes: e.target.value }))} className="bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-xl min-h-[70px] resize-none" data-testid="input-enquiry-notes" />
                    </div>
                  </div>

                  <div className="mt-4 flex-shrink-0">
                    <Button onClick={handleEnquirySubmit} disabled={submitting} className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl h-11 font-semibold shadow-lg" data-testid="button-submit-enquiry">
                      {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>) : "Submit Enquiry"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {modalView === "success" && (
                <motion.div key="success-sidebar" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center h-full text-center p-6">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }} className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-white mb-2">Enquiry Submitted!</h3>
                  <p className="text-white/50 text-sm mb-6 max-w-xs">Thank you for your interest. Our team will contact you shortly.</p>
                  <div className="space-y-3 w-full">
                    <Button onClick={() => setModalView("tour")} className="w-full bg-white/10 hover:bg-white/20 text-white rounded-xl h-11" data-testid="button-back-to-tour-success">Continue Tour</Button>
                    <Button variant="outline" onClick={handleClose} className="w-full bg-transparent border-white/10 text-white hover:bg-white/10 rounded-xl h-11" data-testid="button-close-success">Close</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
