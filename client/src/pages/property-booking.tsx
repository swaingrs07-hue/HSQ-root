import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Building2, MapPin, Bed, ChevronLeft, ChevronRight, Camera,
  Sparkles, Check, Phone, Mail, Star, ArrowRight, Users,
  IndianRupee, Layers, Clock, Shield, X, Play, Pause,
  ChevronDown, Maximize2, Home,
} from "lucide-react";

function parseImages(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const TOUR_CATEGORIES = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "rooms", label: "Rooms", icon: Bed },
  { id: "amenities", label: "Amenities", icon: Sparkles },
  { id: "location", label: "Location", icon: MapPin },
] as const;

type CategoryId = typeof TOUR_CATEGORIES[number]["id"];

function TourGallery({ property }: { property: any }) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("overview");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  const getImages = useCallback((): string[] => {
    if (!property) return [];
    switch (activeCategory) {
      case "overview": return parseImages(property.tourOverviewImages);
      case "rooms": return parseImages(property.tourRoomsImages);
      case "amenities": return parseImages(property.tourAmenitiesImages);
      case "location": return parseImages(property.tourLocationImages);
      default: return [];
    }
  }, [property, activeCategory]);

  const images = getImages();
  const allImages = [
    ...parseImages(property?.tourOverviewImages),
    ...parseImages(property?.tourRoomsImages),
    ...parseImages(property?.tourAmenitiesImages),
    ...parseImages(property?.tourLocationImages),
  ];

  useEffect(() => { setCurrentIndex(0); }, [activeCategory]);

  useEffect(() => {
    if (isAutoPlaying && images.length > 1) {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % images.length);
      }, 4000);
    }
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, [isAutoPlaying, images.length, activeCategory]);

  const handlePrev = () => { setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1)); setIsAutoPlaying(false); };
  const handleNext = () => { setCurrentIndex(prev => (prev + 1) % images.length); setIsAutoPlaying(false); };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? handleNext() : handlePrev(); }
    touchStartX.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, isFullscreen]);

  if (isFullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      >
        <Button
          variant="ghost" size="icon"
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 z-10 text-white bg-white/10 hover:bg-white/20 rounded-full"
          data-testid="button-close-fullscreen"
        >
          <X className="w-6 h-6" />
        </Button>
        <div className="w-full h-full flex items-center justify-center" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <AnimatePresence mode="wait">
            <motion.img
              key={`fs-${currentIndex}`}
              src={images[currentIndex]}
              alt=""
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="max-w-full max-h-full object-contain"
            />
          </AnimatePresence>
          {images.length > 1 && (
            <>
              <button onClick={handlePrev} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-sm transition-all">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={handleNext} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-sm transition-all">
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button key={i} onClick={() => setCurrentIndex(i)} className={cn("w-2 h-2 rounded-full transition-all", i === currentIndex ? "bg-white w-6" : "bg-white/40 hover:bg-white/60")} />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4" data-testid="tour-gallery">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-amber-600" />
          <h2 className="text-xl font-heading font-bold text-gray-900 tracking-wide uppercase">Virtual Tour</h2>
          {allImages.length > 0 && (
            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">{allImages.length} photos</Badge>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => setIsAutoPlaying(!isAutoPlaying)} className="p-2 rounded-full hover:bg-gray-100 transition-colors" data-testid="button-autoplay-toggle">
              {isAutoPlaying ? <Pause className="w-4 h-4 text-gray-500" /> : <Play className="w-4 h-4 text-gray-500" />}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-stone-100 p-1 rounded-none">
        {TOUR_CATEGORIES.map((cat) => {
          const catImages = cat.id === "overview" ? parseImages(property?.tourOverviewImages) :
            cat.id === "rooms" ? parseImages(property?.tourRoomsImages) :
            cat.id === "amenities" ? parseImages(property?.tourAmenitiesImages) :
            parseImages(property?.tourLocationImages);
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              data-testid={`tab-tour-${cat.id}`}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all flex-1 justify-center",
                activeCategory === cat.id
                  ? "bg-amber-600 text-white shadow-lg"
                  : "text-gray-500 hover:text-gray-900 hover:bg-stone-200"
              )}
            >
              <cat.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{cat.label}</span>
              {catImages.length > 0 && (
                <span className={cn("text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center", activeCategory === cat.id ? "bg-white/20" : "bg-stone-300/50")}>{catImages.length}</span>
              )}
            </button>
          );
        })}
      </div>

      <div
        className="relative aspect-[16/9] bg-stone-900 overflow-hidden group cursor-pointer"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => images.length > 0 && setIsFullscreen(true)}
      >
        {images.length > 0 ? (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeCategory}-${currentIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0"
              >
                <motion.img
                  src={images[currentIndex]}
                  alt=""
                  className="w-full h-full object-cover"
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.05 }}
                  transition={{ duration: 8, ease: "linear" }}
                />
              </motion.div>
            </AnimatePresence>

            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md hover:bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all"
                  data-testid="button-prev-image"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md hover:bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all"
                  data-testid="button-next-image"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); setIsAutoPlaying(false); }}
                    className={cn("h-1 rounded-full transition-all", i === currentIndex ? "bg-white w-8" : "bg-white/40 w-4 hover:bg-white/60")}
                  />
                ))}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
                className="p-2 rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-all"
                data-testid="button-fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-medium">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-400">
            <Camera className="w-16 h-16 mb-3 opacity-40" />
            <p className="text-lg font-medium">Tour images coming soon</p>
            <p className="text-sm mt-1">Upload images from the admin panel</p>
          </div>
        )}
      </div>

      {images.length > 4 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => { setCurrentIndex(i); setIsAutoPlaying(false); }}
              data-testid={`thumbnail-${i}`}
              className={cn(
                "flex-shrink-0 w-20 h-14 overflow-hidden transition-all border-2",
                i === currentIndex ? "border-amber-600 ring-2 ring-amber-600/30" : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FloorBedSelector({ property, onSelectBed }: { property: any; onSelectBed: (bed: any, floor: any) => void }) {
  const [expandedFloor, setExpandedFloor] = useState<string | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);

  const { data: floorsData = [], isLoading } = useQuery({
    queryKey: [`/api/properties/${property.id}/floors`],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${property.id}/floors`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!property?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (floorsData.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-stone-200">
        <Layers className="w-12 h-12 text-stone-300 mx-auto mb-3" />
        <p className="text-stone-500 font-medium">Floor plan not configured yet</p>
        <p className="text-sm text-stone-400 mt-1">Please use room selection below to book</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    available: "bg-emerald-500 border-emerald-600 hover:bg-emerald-400 cursor-pointer",
    occupied: "bg-red-400 border-red-500 cursor-not-allowed opacity-60",
    reserved: "bg-amber-400 border-amber-500 cursor-not-allowed opacity-60",
    maintenance: "bg-stone-300 border-stone-400 cursor-not-allowed opacity-40",
  };

  const statusLabels: Record<string, string> = {
    available: "Available", occupied: "Occupied", reserved: "Reserved", maintenance: "Under Maintenance",
  };

  return (
    <div className="space-y-3" data-testid="floor-bed-selector">
      <div className="flex items-center gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400" /> Occupied</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400" /> Reserved</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-stone-300" /> Maintenance</span>
      </div>

      {floorsData.map((floor: any) => {
        const isExpanded = expandedFloor === floor.id;
        const availBeds = floor.beds?.filter((b: any) => b.status === "available").length || 0;
        const totalBeds = floor.beds?.length || 0;

        return (
          <motion.div
            key={floor.id}
            className="border border-stone-200 overflow-hidden"
            data-testid={`floor-card-${floor.id}`}
          >
            <button
              onClick={() => setExpandedFloor(isExpanded ? null : floor.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-lg">
                  {floor.floorNumber}
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900">{floor.name}</h4>
                  <p className="text-xs text-stone-500">{availBeds} of {totalBeds} beds available</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {availBeds > 0 && (
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">{availBeds} open</Badge>
                )}
                <ChevronDown className={cn("w-5 h-5 text-stone-400 transition-transform", isExpanded && "rotate-180")} />
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && floor.beds && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0 border-t border-stone-100">
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 mt-3">
                      {floor.beds.map((bed: any) => {
                        const isSelected = selectedBedId === bed.id;
                        const isAvailable = bed.status === "available";
                        return (
                          <motion.button
                            key={bed.id}
                            whileHover={isAvailable ? { scale: 1.05 } : {}}
                            whileTap={isAvailable ? { scale: 0.95 } : {}}
                            onClick={() => {
                              if (!isAvailable) return;
                              setSelectedBedId(bed.id);
                              onSelectBed(bed, floor);
                            }}
                            className={cn(
                              "relative p-2 border-2 rounded-lg text-center transition-all",
                              statusColors[bed.status],
                              isSelected && "ring-2 ring-amber-500 ring-offset-2 border-amber-500 bg-amber-500"
                            )}
                            title={`${bed.bedNumber} - ${statusLabels[bed.status]}`}
                            data-testid={`bed-${bed.id}`}
                          >
                            <Bed className={cn("w-4 h-4 mx-auto mb-0.5", isSelected || isAvailable ? "text-white" : "text-white/70")} />
                            <span className={cn("text-[10px] font-medium block", isSelected || isAvailable ? "text-white" : "text-white/70")}>
                              {bed.bedNumber}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function PropertyBooking() {
  const [, params] = useRoute("/properties/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const propertyId = params?.id;
  const [selectedBed, setSelectedBed] = useState<any>(null);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);

  const { data: property, isLoading } = useQuery({
    queryKey: [`/api/properties/${propertyId}`],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${propertyId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!propertyId,
  });

  const handleSelectBed = (bed: any, floor: any) => {
    setSelectedBed(bed);
    setSelectedFloor(floor);
  };

  const handleBookRoom = (roomTypeId: string, roomName: string, price: number, deposit: number) => {
    if (!property) return;
    localStorage.setItem("selected_room", JSON.stringify({
      propertyId: property.id,
      roomTypeId,
      price,
      roomTypeName: roomName,
      propertyName: property.name,
      bookingMode: property.bookingMode || "monthly",
      deposit,
      bedId: selectedBed?.id,
      bedNumber: selectedBed?.bedNumber,
      floorName: selectedFloor?.name,
    }));
    navigate("/student/register");
  };

  const handleBookSelectedBed = () => {
    if (!selectedBed || !property) return;
    const roomType = property.roomTypes?.find((r: any) => r.id === selectedBed.roomTypeId);
    if (!roomType) {
      toast({ title: "Room type not found", variant: "destructive" });
      return;
    }
    handleBookRoom(
      roomType.id,
      roomType.customName || roomType.name,
      property.bookingMode === "academic_year" ? (roomType.academicYearPrice || roomType.basePrice * 12) : roomType.basePrice,
      roomType.deposit || 0
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-[400px] w-full mb-6" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <Building2 className="w-16 h-16 text-stone-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-stone-700">Property not found</h2>
        <p className="text-stone-500 mt-2">The property you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => navigate("/properties")} className="mt-6 bg-amber-600 hover:bg-amber-700 rounded-none">
          Browse Properties
        </Button>
      </div>
    );
  }

  const totalBeds = property.roomTypes?.reduce((s: number, r: any) => s + (r.totalBeds || 0), 0) || 0;
  const availableBeds = property.roomTypes?.reduce((s: number, r: any) => s + (r.availableBeds || 0), 0) || 0;
  const selectedRoomType = selectedBed ? property.roomTypes?.find((r: any) => r.id === selectedBed.roomTypeId) : null;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="relative h-[300px] md:h-[400px] overflow-hidden bg-stone-900">
        {parseImages(property.tourOverviewImages).length > 0 ? (
          <motion.img
            src={parseImages(property.tourOverviewImages)[0]}
            alt={property.name}
            className="w-full h-full object-cover opacity-60"
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.5 }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-stone-800 to-stone-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <button onClick={() => navigate("/properties")} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-4 transition-colors" data-testid="button-back">
              <ChevronLeft className="w-4 h-4" />
              All Properties
            </button>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-heading font-bold text-white tracking-wide" data-testid="text-property-name">
                    {property.displayName || property.name}
                  </h1>
                  <Badge className="bg-amber-600/80 text-white border-0 uppercase text-[10px] tracking-widest">
                    {property.category}
                  </Badge>
                </div>
                <p className="text-white/70 flex items-center gap-1.5 text-sm">
                  <MapPin className="w-4 h-4" />
                  {property.location}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20">
                  <p className="text-2xl font-bold text-white">{availableBeds}</p>
                  <p className="text-[10px] text-white/60 uppercase tracking-wider">Beds Available</p>
                </div>
                <div className="text-center px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20">
                  <p className="text-2xl font-bold text-white">{property.roomTypes?.length || 0}</p>
                  <p className="text-[10px] text-white/60 uppercase tracking-wider">Room Types</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-10">
            <TourGallery property={property} />

            {property.amenities?.length > 0 && (
              <div>
                <h2 className="text-xl font-heading font-bold text-gray-900 tracking-wide uppercase mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  Amenities
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {property.amenities.map((am: string, i: number) => (
                    <motion.div
                      key={am}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-2 px-3 py-2.5 bg-white border border-stone-200 text-sm text-gray-700 hover:border-amber-300 transition-colors"
                    >
                      <Check className="w-4 h-4 text-amber-600 shrink-0" />
                      {am}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-xl font-heading font-bold text-gray-900 tracking-wide uppercase mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-600" />
                Select Your Floor & Bed
              </h2>
              <FloorBedSelector property={property} onSelectBed={handleSelectBed} />
            </div>

            <div>
              <h2 className="text-xl font-heading font-bold text-gray-900 tracking-wide uppercase mb-4 flex items-center gap-2">
                <Bed className="w-5 h-5 text-amber-600" />
                Room Types & Pricing
              </h2>
              <div className="space-y-3">
                {property.roomTypes?.map((room: any, i: number) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white border border-stone-200 p-5 hover:border-amber-300 hover:shadow-md transition-all group"
                    data-testid={`room-card-${room.id}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-heading font-bold text-lg">{room.customName || room.name}</h4>
                          {room.size && <span className="text-xs bg-stone-100 border border-stone-200 px-2 py-0.5">{room.size}</span>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-stone-500">
                          <span className="flex items-center gap-1"><Bed className="w-4 h-4 text-amber-600" /> {room.occupancy || 1}-sharing</span>
                          <span className="flex items-center gap-1"><Users className="w-4 h-4 text-amber-600" /> {room.availableBeds}/{room.totalBeds} available</span>
                        </div>
                        {room.availableBeds > 0 && room.availableBeds < 5 && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
                            <Clock className="w-3 h-3" /> Only {room.availableBeds} left
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-amber-600">
                            ₹{property.bookingMode === "academic_year"
                              ? (room.academicYearPrice || room.basePrice * 12).toLocaleString()
                              : room.basePrice.toLocaleString()}
                          </div>
                          <div className="text-xs text-stone-400 uppercase tracking-wider">
                            {property.bookingMode === "academic_year" ? "per year" : "per month"}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleBookRoom(
                            room.id,
                            room.customName || room.name,
                            property.bookingMode === "academic_year" ? (room.academicYearPrice || room.basePrice * 12) : room.basePrice,
                            room.deposit || 0
                          )}
                          disabled={room.availableBeds === 0}
                          className="bg-amber-600 hover:bg-amber-700 text-white rounded-none px-6 h-11 font-semibold tracking-wider uppercase text-sm"
                          data-testid={`button-book-room-${room.id}`}
                        >
                          {room.availableBeds === 0 ? "Sold Out" : "Book Now"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {property.rules && (
              <div>
                <h2 className="text-xl font-heading font-bold text-gray-900 tracking-wide uppercase mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-600" />
                  Rules & Policies
                </h2>
                <div className="bg-white border border-stone-200 p-5">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{property.rules}</p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <div className="bg-white border border-stone-200 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-4">
                  <h3 className="text-white font-heading font-bold tracking-wide uppercase text-sm">Booking Summary</h3>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="text-xs text-stone-400 uppercase tracking-wider">Property</p>
                      <p className="font-semibold text-gray-900">{property.displayName || property.name}</p>
                    </div>
                  </div>

                  {selectedBed && selectedFloor && (
                    <>
                      <div className="border-t border-stone-100 pt-3 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-amber-600" />
                        <div>
                          <p className="text-xs text-stone-400 uppercase tracking-wider">Floor</p>
                          <p className="font-semibold text-gray-900">{selectedFloor.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Bed className="w-5 h-5 text-amber-600" />
                        <div>
                          <p className="text-xs text-stone-400 uppercase tracking-wider">Bed</p>
                          <p className="font-semibold text-gray-900">#{selectedBed.bedNumber}</p>
                        </div>
                      </div>
                      {selectedRoomType && (
                        <>
                          <div className="flex items-center gap-3">
                            <Home className="w-5 h-5 text-amber-600" />
                            <div>
                              <p className="text-xs text-stone-400 uppercase tracking-wider">Room Type</p>
                              <p className="font-semibold text-gray-900">{selectedRoomType.customName || selectedRoomType.name}</p>
                            </div>
                          </div>
                          <div className="border-t border-stone-100 pt-3">
                            <div className="flex justify-between items-center">
                              <span className="text-stone-500">Price</span>
                              <span className="text-2xl font-bold text-amber-600">
                                ₹{property.bookingMode === "academic_year"
                                  ? (selectedRoomType.academicYearPrice || selectedRoomType.basePrice * 12).toLocaleString()
                                  : selectedRoomType.basePrice.toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-stone-400 text-right uppercase tracking-wider">
                              {property.bookingMode === "academic_year" ? "per year" : "per month"}
                            </p>
                          </div>
                        </>
                      )}
                      <Button
                        onClick={handleBookSelectedBed}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-none h-12 font-semibold tracking-wider uppercase"
                        data-testid="button-proceed-booking"
                      >
                        Proceed to Book
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </>
                  )}

                  {!selectedBed && (
                    <div className="text-center py-6 border-t border-stone-100">
                      <Bed className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="text-sm text-stone-400">Select a floor & bed above, or choose a room type to proceed</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-stone-200 p-5 space-y-3">
                <h4 className="font-heading font-bold text-sm tracking-wide uppercase text-gray-900">Contact</h4>
                {property.phone && (
                  <a href={`tel:${property.phone}`} className="flex items-center gap-2 text-sm text-stone-600 hover:text-amber-600 transition-colors">
                    <Phone className="w-4 h-4" /> {property.phone}
                  </a>
                )}
                {property.email && (
                  <a href={`mailto:${property.email}`} className="flex items-center gap-2 text-sm text-stone-600 hover:text-amber-600 transition-colors">
                    <Mail className="w-4 h-4" /> {property.email}
                  </a>
                )}
                {property.mapsUrl && (
                  <a href={property.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors">
                    <MapPin className="w-4 h-4" /> View on Google Maps
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
