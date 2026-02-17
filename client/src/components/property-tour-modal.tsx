import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Building2, Bed, Sparkles, MapPin, Check, Camera, Phone, Mail, IndianRupee, FileText, ArrowLeft, CheckCircle2, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

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
  const [imageLoading, setImageLoading] = useState(false);
  const [modalView, setModalView] = useState<ModalView>("tour");
  const [submitting, setSubmitting] = useState(false);
  const [enquiryForm, setEnquiryForm] = useState({
    name: "",
    phone: "",
    email: "",
    propertyId: "",
    minBudget: "",
    maxBudget: "",
    notes: "",
  });
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      trackEvent("tour_opened");
      loadProperties();
      document.body.style.overflow = "hidden";
      setModalView("tour");
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
    setModalView("tour");
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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    
    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        handleNextImage();
      } else {
        handlePrevImage();
      }
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleBookEnquireClick = () => {
    trackEvent("tour_book_enquire_clicked", { propertyId: selectedPropertyId });
    setModalView("choice");
  };

  const handleBookClick = () => {
    trackEvent("tour_book_clicked", { propertyId: selectedPropertyId });
    onClose();
    window.location.href = `/properties?book=${selectedPropertyId}`;
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
      const response = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enquiryForm),
      });
      const data = await response.json();
      if (response.ok) {
        trackEvent("tour_enquiry_submitted", { propertyId: selectedPropertyId });
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

          <div className="h-full flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
            <div className="flex-1 flex flex-col p-4 md:p-6 min-h-0 md:overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-4 mb-4 flex-shrink-0">
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

                <div className="flex bg-white/5 rounded-xl p-1 overflow-x-auto flex-shrink-0">
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

              <div 
                className="flex-1 relative rounded-2xl overflow-hidden bg-black/50 touch-pan-y min-h-[200px] md:min-h-0"
                style={{ aspectRatio: "16/9" }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
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
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2 flex-shrink-0">
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

            <div className="w-full md:w-80 bg-white/5 backdrop-blur-sm p-4 md:p-6 flex flex-col border-t md:border-t-0 md:border-l border-white/10 md:overflow-y-auto flex-shrink-0">
              <AnimatePresence mode="wait">
                {modalView === "tour" && (
                  <motion.div
                    key="tour-sidebar"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col h-full"
                  >
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
                        onClick={handleBookEnquireClick}
                        className="w-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl h-12 font-semibold shadow-lg shadow-rose-500/25"
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
                  </motion.div>
                )}

                {modalView === "choice" && (
                  <motion.div
                    key="choice-sidebar"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col h-full"
                  >
                    <button
                      onClick={() => setModalView("tour")}
                      className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors"
                      data-testid="button-back-to-tour"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to tour
                    </button>

                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-white mb-1">
                        What would you like to do?
                      </h3>
                      <p className="text-white/60 text-sm">
                        Choose an option for {selectedProperty?.name}
                      </p>
                    </div>

                    <div className="flex-1 space-y-4">
                      <button
                        onClick={handleBookClick}
                        className="w-full p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group text-left"
                        data-testid="button-choice-book"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          </div>
                          <h4 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">Book Now</h4>
                        </div>
                        <p className="text-white/50 text-sm pl-[52px]">
                          Proceed to room selection and complete your booking
                        </p>
                      </button>

                      <button
                        onClick={handleEnquireClick}
                        className="w-full p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group text-left"
                        data-testid="button-choice-enquire"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          <h4 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">Enquire</h4>
                        </div>
                        <p className="text-white/50 text-sm pl-[52px]">
                          Send us your details and our team will contact you
                        </p>
                      </button>
                    </div>
                  </motion.div>
                )}

                {modalView === "enquiry" && (
                  <motion.div
                    key="enquiry-sidebar"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col h-full"
                  >
                    <button
                      onClick={() => setModalView("choice")}
                      className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-4 transition-colors"
                      data-testid="button-back-to-choice"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>

                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-white mb-0.5">
                        Submit Enquiry
                      </h3>
                      <p className="text-white/50 text-xs">
                        Fill in your details and we'll get back to you
                      </p>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                      <div>
                        <Label className="text-white/80 text-xs mb-1 block">Name *</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                          <Input
                            placeholder="Your name"
                            value={enquiryForm.name}
                            onChange={(e) => setEnquiryForm(prev => ({ ...prev, name: e.target.value }))}
                            className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10"
                            data-testid="input-enquiry-name"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-white/80 text-xs mb-1 block">Phone *</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                          <Input
                            placeholder="Phone number"
                            value={enquiryForm.phone}
                            onChange={(e) => setEnquiryForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10"
                            data-testid="input-enquiry-phone"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-white/80 text-xs mb-1 block">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                          <Input
                            placeholder="Email address"
                            value={enquiryForm.email}
                            onChange={(e) => setEnquiryForm(prev => ({ ...prev, email: e.target.value }))}
                            className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10"
                            data-testid="input-enquiry-email"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-white/80 text-xs mb-1 block">Property</Label>
                        <Select value={enquiryForm.propertyId} onValueChange={(val) => setEnquiryForm(prev => ({ ...prev, propertyId: val }))}>
                          <SelectTrigger className="bg-white/10 border-white/20 text-white rounded-xl h-10" data-testid="select-enquiry-property">
                            <SelectValue placeholder="Select property" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            {properties.map((property) => (
                              <SelectItem key={property.id} value={property.id} className="text-white hover:bg-white/10 focus:bg-white/10">
                                {property.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-white/80 text-xs mb-1 block">Min Budget</Label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                            <Input
                              placeholder="10,000"
                              value={enquiryForm.minBudget}
                              onChange={(e) => setEnquiryForm(prev => ({ ...prev, minBudget: e.target.value }))}
                              className="pl-8 bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10"
                              data-testid="input-enquiry-min-budget"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-white/80 text-xs mb-1 block">Max Budget</Label>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                            <Input
                              placeholder="25,000"
                              value={enquiryForm.maxBudget}
                              onChange={(e) => setEnquiryForm(prev => ({ ...prev, maxBudget: e.target.value }))}
                              className="pl-8 bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl h-10"
                              data-testid="input-enquiry-max-budget"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-white/80 text-xs mb-1 block">Notes</Label>
                        <Textarea
                          placeholder="Additional notes..."
                          value={enquiryForm.notes}
                          onChange={(e) => setEnquiryForm(prev => ({ ...prev, notes: e.target.value }))}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl min-h-[70px] resize-none"
                          data-testid="input-enquiry-notes"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex-shrink-0">
                      <Button
                        onClick={handleEnquirySubmit}
                        disabled={submitting}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl h-11 font-semibold shadow-lg"
                        data-testid="button-submit-enquiry"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Enquiry"
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}

                {modalView === "success" && (
                  <motion.div
                    key="success-sidebar"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-col items-center justify-center h-full text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.1 }}
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center mb-4"
                    >
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-white mb-2">Enquiry Submitted!</h3>
                    <p className="text-white/60 text-sm mb-6 max-w-xs">
                      Thank you for your interest. Our team will contact you shortly.
                    </p>
                    <div className="space-y-3 w-full">
                      <Button
                        onClick={() => setModalView("tour")}
                        className="w-full bg-white/10 hover:bg-white/20 text-white rounded-xl h-11"
                        data-testid="button-back-to-tour-success"
                      >
                        Continue Tour
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleClose}
                        className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 rounded-xl h-11"
                        data-testid="button-close-success"
                      >
                        Close
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
