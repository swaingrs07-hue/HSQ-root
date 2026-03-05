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
  Sparkles, Check, Phone, Mail, ArrowRight, Users,
  Layers, Clock, Shield, X, Play, Pause,
  ChevronDown, Maximize2, Home, Grid3X3, Eye,
  ZoomIn, Navigation, Compass, Star, Wifi, Coffee,
  Crown, IndianRupee, CheckCircle2,
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

const TOUR_ROOMS = [
  { id: "overview", label: "Overview", icon: Compass, description: "Exterior & Common Areas" },
  { id: "rooms", label: "Rooms", icon: Bed, description: "Living Spaces" },
  { id: "amenities", label: "Amenities", icon: Sparkles, description: "Facilities & Services" },
  { id: "location", label: "Location", icon: Navigation, description: "Surroundings & Area" },
] as const;

type RoomId = typeof TOUR_ROOMS[number]["id"];

function ImmersiveTour({ property, onStartBooking }: { property: any; onStartBooking: () => void }) {
  const [activeRoom, setActiveRoom] = useState<RoomId>("overview");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showRoomNav, setShowRoomNav] = useState(true);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 });
  const [isZoomed, setIsZoomed] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getImages = useCallback((room: RoomId): string[] => {
    if (!property) return [];
    switch (room) {
      case "overview": return parseImages(property.tourOverviewImages);
      case "rooms": return parseImages(property.tourRoomsImages);
      case "amenities": return parseImages(property.tourAmenitiesImages);
      case "location": return parseImages(property.tourLocationImages);
      default: return [];
    }
  }, [property]);

  const images = getImages(activeRoom);
  const allImages = TOUR_ROOMS.flatMap(r => getImages(r.id));

  useEffect(() => {
    setCurrentIndex(0);
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 600);
  }, [activeRoom]);

  useEffect(() => {
    if (autoPlayRef.current) { clearInterval(autoPlayRef.current); autoPlayRef.current = null; }
    if (isPlaying && images.length > 1 && !isFullscreen) {
      autoPlayRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const next = (prev + 1) % images.length;
          if (next === 0) {
            const roomIdx = TOUR_ROOMS.findIndex(r => r.id === activeRoom);
            for (let i = 1; i <= TOUR_ROOMS.length; i++) {
              const checkIdx = (roomIdx + i) % TOUR_ROOMS.length;
              if (checkIdx !== roomIdx && getImages(TOUR_ROOMS[checkIdx].id).length > 0) {
                setActiveRoom(TOUR_ROOMS[checkIdx].id);
                return 0;
              }
            }
          }
          return next;
        });
      }, 5000);
    }
    return () => { if (autoPlayRef.current) { clearInterval(autoPlayRef.current); autoPlayRef.current = null; } };
  }, [isPlaying, images.length, activeRoom, isFullscreen, getImages]);

  const goTo = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(false);
  };

  const handlePrev = () => {
    if (images.length === 0) return;
    if (currentIndex === 0) {
      const roomIdx = TOUR_ROOMS.findIndex(r => r.id === activeRoom);
      for (let i = TOUR_ROOMS.length - 1; i >= 0; i--) {
        const checkIdx = (roomIdx - 1 + TOUR_ROOMS.length + i) % TOUR_ROOMS.length;
        if (checkIdx !== roomIdx) {
          const prevImages = getImages(TOUR_ROOMS[checkIdx].id);
          if (prevImages.length > 0) {
            setActiveRoom(TOUR_ROOMS[checkIdx].id);
            setCurrentIndex(prevImages.length - 1);
            setIsPlaying(false);
            return;
          }
        }
      }
    }
    goTo(currentIndex === 0 ? images.length - 1 : currentIndex - 1);
  };

  const handleNext = () => {
    if (images.length === 0) return;
    if (currentIndex === images.length - 1) {
      const roomIdx = TOUR_ROOMS.findIndex(r => r.id === activeRoom);
      for (let i = 1; i <= TOUR_ROOMS.length; i++) {
        const checkIdx = (roomIdx + i) % TOUR_ROOMS.length;
        if (checkIdx !== roomIdx && getImages(TOUR_ROOMS[checkIdx].id).length > 0) {
          setActiveRoom(TOUR_ROOMS[checkIdx].id);
          setCurrentIndex(0);
          setIsPlaying(false);
          return;
        }
      }
    }
    goTo((currentIndex + 1) % images.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchStartY.current) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      dx > 0 ? handleNext() : handlePrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !isZoomed) return;
    const rect = containerRef.current.getBoundingClientRect();
    setCursorPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handlePrev();
      else if (e.key === "ArrowRight") handleNext();
      else if (e.key === "Escape") { setIsFullscreen(false); setShowGrid(false); }
      else if (e.key === " ") { e.preventDefault(); setIsPlaying(!isPlaying); }
      else if (e.key === "f") setIsFullscreen(!isFullscreen);
      else if (e.key === "g") setShowGrid(!showGrid);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [images.length, isFullscreen, isPlaying, showGrid, currentIndex]);

  const globalIndex = TOUR_ROOMS.slice(0, TOUR_ROOMS.findIndex(r => r.id === activeRoom))
    .reduce((s, r) => s + getImages(r.id).length, 0) + currentIndex;
  const currentRoom = TOUR_ROOMS.find(r => r.id === activeRoom)!;
  const progress = allImages.length > 0 ? ((globalIndex + 1) / allImages.length) * 100 : 0;

  if (showGrid) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("bg-black/98 z-50", isFullscreen ? "fixed inset-0" : "relative")}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Grid3X3 className="w-5 h-5 text-amber-500" />
            <h3 className="text-white font-bold tracking-wider uppercase text-sm">All Tour Photos</h3>
            <span className="text-white/30 text-sm">{allImages.length} images</span>
          </div>
          <button onClick={() => setShowGrid(false)} className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all" data-testid="button-close-grid" aria-label="Close photo grid">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto" style={{ maxHeight: isFullscreen ? "calc(100vh - 60px)" : "600px" }}>
          {TOUR_ROOMS.map(room => {
            const roomImages = getImages(room.id);
            if (roomImages.length === 0) return null;
            return (
              <div key={room.id} className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <room.icon className="w-4 h-4 text-amber-500" />
                  <h4 className="text-white/80 text-sm font-medium uppercase tracking-wider">{room.label}</h4>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {roomImages.map((img, i) => (
                    <motion.button key={i} whileHover={{ scale: 1.03 }} onClick={() => { setActiveRoom(room.id); setCurrentIndex(i); setShowGrid(false); }} className="relative aspect-[4/3] overflow-hidden group rounded-lg" data-testid={`grid-image-${room.id}-${i}`}>
                      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
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

  if (isFullscreen) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 bg-black">
        <div className="absolute inset-0" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onMouseMove={handleMouseMove} ref={containerRef}>
          <AnimatePresence mode="wait">
            <motion.div key={`fs-${activeRoom}-${currentIndex}`} initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }} className="absolute inset-0">
              <motion.img src={images[currentIndex]} alt="" className="w-full h-full object-cover" style={isZoomed ? { transform: "scale(2)", transformOrigin: `${cursorPos.x}% ${cursorPos.y}%` } : {}} initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 12, ease: "linear" }} />
            </motion.div>
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70 pointer-events-none" />
        </div>

        <div className="absolute top-0 left-0 right-0 z-10">
          <div className="h-[3px] bg-white/10">
            <motion.div className="h-full bg-gradient-to-r from-amber-500 to-amber-400" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setIsFullscreen(false)} className="flex items-center gap-2 text-white/60 hover:text-white transition-all group" data-testid="button-exit-fullscreen">
                <X className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:inline group-hover:underline">Exit Tour</span>
              </button>
              <div className="h-5 w-px bg-white/20" />
              <div>
                <p className="text-white font-bold text-sm tracking-wider uppercase">{property.displayName || property.name}</p>
                <p className="text-white/40 text-xs">{currentRoom.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsZoomed(!isZoomed)} className={cn("p-2.5 rounded-full transition-all", isZoomed ? "bg-amber-500/30 text-amber-400" : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20")} aria-label={isZoomed ? "Disable zoom" : "Enable zoom"}>
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => setIsPlaying(!isPlaying)} className={cn("p-2.5 rounded-full transition-all", isPlaying ? "bg-amber-500/30 text-amber-400" : "bg-white/10 text-white/60 hover:text-white hover:bg-white/20")} aria-label={isPlaying ? "Pause autoplay" : "Start autoplay"}>
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button onClick={() => setShowGrid(true)} className="p-2.5 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all" aria-label="Show photo grid">
                <Grid3X3 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {images.length > 1 && (
          <>
            <button onClick={handlePrev} aria-label="Previous image" className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-14 h-14 rounded-full bg-black/20 backdrop-blur-xl hover:bg-black/40 flex items-center justify-center text-white/70 hover:text-white transition-all border border-white/10 hover:border-white/20 group" data-testid="button-fs-prev">
              <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <button onClick={handleNext} aria-label="Next image" className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-14 h-14 rounded-full bg-black/20 backdrop-blur-xl hover:bg-black/40 flex items-center justify-center text-white/70 hover:text-white transition-all border border-white/10 hover:border-white/20 group" data-testid="button-fs-next">
              <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="flex items-end justify-between px-6 pb-4">
            <div className="flex gap-1.5 bg-black/30 backdrop-blur-xl rounded-full p-1.5 border border-white/10">
              {TOUR_ROOMS.map(room => {
                const hasImages = getImages(room.id).length > 0;
                if (!hasImages) return null;
                return (
                  <button key={room.id} onClick={() => setActiveRoom(room.id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all", activeRoom === room.id ? "bg-amber-500/90 text-white shadow-lg shadow-amber-500/30" : "text-white/50 hover:text-white hover:bg-white/10")} data-testid={`fs-tab-${room.id}`}>
                    <room.icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{room.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/40 text-xs font-mono">{String(globalIndex + 1).padStart(2, "0")} / {String(allImages.length).padStart(2, "0")}</span>
              <Button onClick={() => { setIsFullscreen(false); onStartBooking(); }} className="bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-full px-6 h-10 text-xs tracking-wider uppercase shadow-lg shadow-amber-500/30" data-testid="button-fs-book">
                Book Now <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          </div>
          <div className="px-6 pb-6">
            <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20">
              {images.map((img, i) => (
                <button key={i} onClick={() => goTo(i)} className={cn("flex-shrink-0 h-16 overflow-hidden transition-all duration-300 border-2 rounded-lg", i === currentIndex ? "w-28 border-amber-500 opacity-100 shadow-lg shadow-amber-500/20" : "w-16 border-transparent opacity-40 hover:opacity-70")} data-testid={`fs-thumb-${i}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-0" data-testid="tour-gallery">
      <div
        ref={containerRef}
        className="relative aspect-[16/10] md:aspect-[21/9] bg-stone-950 overflow-hidden group cursor-pointer"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => images.length > 0 && setIsFullscreen(true)}
        onMouseEnter={() => setShowRoomNav(true)}
      >
        {images.length > 0 ? (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={`tour-${activeRoom}-${currentIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                className="absolute inset-0"
              >
                <motion.img
                  src={images[currentIndex]}
                  alt=""
                  className="w-full h-full object-cover"
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 10, ease: "linear" }}
                />
              </motion.div>
            </AnimatePresence>

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/50 pointer-events-none" />

            <div className="absolute top-0 left-0 right-0 z-10">
              <div className="h-[2px] bg-white/10">
                <motion.div className="h-full bg-gradient-to-r from-amber-500 to-amber-400" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
              </div>
            </div>

            <div className="absolute top-4 left-4 right-4 z-10 flex items-start justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="bg-black/30 backdrop-blur-2xl rounded-2xl px-4 py-2.5 border border-white/10">
                <div className="flex items-center gap-2">
                  <currentRoom.icon className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-white text-xs font-bold tracking-wider uppercase">{currentRoom.label}</p>
                    <p className="text-white/40 text-[10px]">{currentRoom.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }} className={cn("p-2 rounded-full transition-all", isPlaying ? "bg-amber-500/30 text-amber-400 border border-amber-500/30" : "bg-black/30 backdrop-blur-xl text-white/60 hover:text-white border border-white/10")} data-testid="button-autoplay-toggle" aria-label={isPlaying ? "Pause autoplay" : "Start autoplay"}>
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setShowGrid(true); }} className="p-2 rounded-full bg-black/30 backdrop-blur-xl text-white/60 hover:text-white border border-white/10 transition-all" data-testid="button-show-grid" aria-label="Show photo grid">
                  <Grid3X3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }} className="p-2 rounded-full bg-black/30 backdrop-blur-xl text-white/60 hover:text-white border border-white/10 transition-all" data-testid="button-fullscreen" aria-label="Enter fullscreen">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {images.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/20 backdrop-blur-xl hover:bg-black/40 flex items-center justify-center text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-all border border-white/10" data-testid="button-prev-image" aria-label="Previous image">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/20 backdrop-blur-xl hover:bg-black/40 flex items-center justify-center text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-all border border-white/10" data-testid="button-next-image" aria-label="Next image">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
              <div className="flex items-end justify-between">
                <div className="flex gap-1 bg-black/30 backdrop-blur-2xl rounded-full p-1 border border-white/10">
                  {TOUR_ROOMS.map(room => {
                    const hasImages = getImages(room.id).length > 0;
                    if (!hasImages) return null;
                    return (
                      <button key={room.id} onClick={(e) => { e.stopPropagation(); setActiveRoom(room.id); }} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all tracking-wider uppercase", activeRoom === room.id ? "bg-amber-500/90 text-white shadow-lg shadow-amber-500/20" : "text-white/40 hover:text-white/70 hover:bg-white/10")} data-testid={`tab-tour-${room.id}`}>
                        <room.icon className="w-3 h-3" />
                        <span className="hidden sm:inline">{room.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/30 text-xs font-mono tracking-wider">{String(globalIndex + 1).padStart(2, "0")} / {String(allImages.length).padStart(2, "0")}</span>
                </div>
              </div>

              {images.length > 4 && (
                <div className="flex gap-1 mt-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/20">
                  {images.map((img, i) => (
                    <button key={i} onClick={(e) => { e.stopPropagation(); goTo(i); }} className={cn("flex-shrink-0 h-12 overflow-hidden transition-all duration-300 border rounded-md", i === currentIndex ? "w-20 border-amber-500 opacity-100" : "w-12 border-white/10 opacity-30 hover:opacity-60")} data-testid={`thumbnail-${i}`}>
                      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-stone-900 to-stone-950">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-3xl" />
              <Camera className="w-20 h-20 text-stone-600 relative" />
            </div>
            <p className="text-stone-400 font-bold text-lg mt-4 tracking-wider uppercase">Tour Coming Soon</p>
            <p className="text-stone-600 text-sm mt-2">Images will be uploaded by the property manager</p>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-stone-900 via-stone-900 to-stone-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Camera className="w-4 h-4 text-amber-500" />
          <span className="text-white/80 text-sm font-medium tracking-wide">Virtual Tour</span>
          <span className="text-white/30 text-xs">{allImages.length} photos across {TOUR_ROOMS.filter(r => getImages(r.id).length > 0).length} categories</span>
        </div>
        <div className="flex items-center gap-3">
          {allImages.length > 0 && (
            <button onClick={() => setIsFullscreen(true)} className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-semibold tracking-wider uppercase transition-colors" data-testid="button-launch-tour">
              <Maximize2 className="w-3.5 h-3.5" />
              Full Experience
            </button>
          )}
          <Button onClick={onStartBooking} size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-full px-4 h-8 text-[11px] tracking-wider uppercase" data-testid="button-tour-book-now">
            Book Now <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FloorBedSelector({ property, onSelectBed }: { property: any; onSelectBed: (bed: any, floor: any, room?: any) => void }) {
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
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  if (floorsData.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl border-2 border-dashed border-stone-200 bg-gradient-to-b from-stone-50 to-white">
        <Layers className="w-14 h-14 text-stone-300 mx-auto mb-3" />
        <p className="text-stone-500 font-semibold text-lg">Floor plan not configured yet</p>
        <p className="text-sm text-stone-400 mt-1">Please select a room type below to book</p>
      </div>
    );
  }

  const statusConfig: Record<string, { bg: string; border: string; label: string; cursor: string; dot: string }> = {
    available: { bg: "bg-emerald-500 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/30", border: "border-emerald-600", label: "Available", cursor: "cursor-pointer", dot: "bg-emerald-500" },
    occupied: { bg: "bg-red-400/60", border: "border-red-500/40", label: "Occupied", cursor: "cursor-not-allowed", dot: "bg-red-400" },
    reserved: { bg: "bg-amber-400/60", border: "border-amber-500/40", label: "Reserved", cursor: "cursor-not-allowed", dot: "bg-amber-400" },
    maintenance: { bg: "bg-stone-300/60", border: "border-stone-400/40", label: "Maintenance", cursor: "cursor-not-allowed", dot: "bg-stone-400" },
    blocked: { bg: "bg-red-700/60", border: "border-red-800/40", label: "Blocked", cursor: "cursor-not-allowed", dot: "bg-red-700" },
  };

  const renderBedButton = (bed: any, floor: any, room?: any) => {
    const isSelected = selectedBedId === bed.id;
    const isHeld = bed.held && !isSelected;
    const isAvailable = bed.status === "available" && !isHeld;
    const config = isHeld 
      ? { bg: "bg-orange-400/60", border: "border-orange-500/40", label: "Booking in progress", cursor: "cursor-not-allowed", dot: "bg-orange-400" }
      : (statusConfig[bed.status] || statusConfig.maintenance);
    return (
      <motion.button
        key={bed.id}
        whileHover={isAvailable ? { scale: 1.1, y: -3 } : {}}
        whileTap={isAvailable ? { scale: 0.95 } : {}}
        onClick={() => {
          if (!isAvailable) return;
          setSelectedBedId(bed.id);
          onSelectBed(bed, floor, room);
        }}
        className={cn(
          "relative p-2 border-2 rounded-xl text-center transition-all",
          config.bg, config.border, config.cursor,
          !isAvailable && "opacity-40",
          isSelected && "!bg-amber-500 !border-amber-400 ring-2 ring-amber-500/40 ring-offset-2 ring-offset-white shadow-xl shadow-amber-500/30"
        )}
        title={`${bed.bedNumber} — ${config.label}${bed.monthlyPrice ? ` — ₹${bed.monthlyPrice}/mo` : ""}${room ? ` — Room ${room.roomNumber}` : ""}`}
        data-testid={`bed-${bed.id}`}
      >
        <Bed className="w-4 h-4 mx-auto text-white" />
        <span className="text-[9px] font-bold block text-white mt-0.5 truncate">{bed.bedNumber}</span>
        {isSelected && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-lg">
            <Check className="w-3.5 h-3.5 text-amber-600" />
          </motion.div>
        )}
      </motion.button>
    );
  };

  const totalAll = floorsData.reduce((s: number, f: any) => s + (f.beds?.length || 0), 0);
  const availAll = floorsData.reduce((s: number, f: any) => s + (f.beds?.filter((b: any) => b.status === "available").length || 0), 0);

  return (
    <div className="space-y-4" data-testid="floor-bed-selector">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-stone-50 to-amber-50/50 p-4 rounded-xl border border-stone-200">
        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500">
          {Object.entries(statusConfig).map(([key, config]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={cn("w-3 h-3 rounded-full", config.dot)} />
              {config.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold">{availAll} available</Badge>
          <span className="text-stone-400 text-xs">of {totalAll} total beds</span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-7 top-0 bottom-0 w-px bg-gradient-to-b from-amber-300 via-amber-200 to-transparent" />

        {floorsData.map((floor: any, fi: number) => {
          const isExpanded = expandedFloor === floor.id;
          const beds = floor.beds || [];
          const rooms = floor.rooms || [];
          const availBeds = beds.filter((b: any) => b.status === "available").length;
          const totalBeds = beds.length;
          const hasRooms = rooms.length > 0;
          const orphanBeds = beds.filter((b: any) => !b.roomId);
          const occupancyPct = totalBeds > 0 ? Math.round((availBeds / totalBeds) * 100) : 0;

          return (
            <motion.div
              key={floor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: fi * 0.05 }}
              className="relative pl-10 mb-3"
              data-testid={`floor-card-${floor.id}`}
            >
              <div className={cn("absolute left-5 top-5 w-5 h-5 rounded-full border-2 z-10", availBeds > 0 ? "bg-amber-500 border-amber-400" : "bg-stone-300 border-stone-200")} />

              <div className={cn("rounded-xl border overflow-hidden transition-all duration-200", isExpanded ? "border-amber-300 shadow-xl shadow-amber-500/10 bg-white" : "border-stone-200 hover:border-stone-300 bg-white hover:shadow-md")}>
                <button
                  onClick={() => setExpandedFloor(isExpanded ? null : floor.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-stone-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12">
                      <svg viewBox="0 0 48 48" className="w-full h-full">
                        <circle cx="24" cy="24" r="20" fill="none" stroke="#f5f5f4" strokeWidth="3" />
                        <circle cx="24" cy="24" r="20" fill="none" stroke={availBeds > 0 ? "#f59e0b" : "#ef4444"} strokeWidth="3" strokeDasharray={`${(availBeds / Math.max(totalBeds, 1)) * 125.6} 125.6`} strokeLinecap="round" transform="rotate(-90 24 24)" className="transition-all duration-700" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-stone-700">{floor.floorNumber}</span>
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-gray-900">{floor.name}</h4>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {hasRooms && <><span className="text-indigo-600 font-medium">{rooms.length} rooms</span> · </>}
                        <span className="text-emerald-600 font-semibold">{availBeds}</span> of {totalBeds} beds available
                        <span className="text-stone-300 ml-2">({occupancyPct}% open)</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {availBeds > 0 && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold">{availBeds} open</Badge>}
                    {availBeds === 0 && totalBeds > 0 && <Badge className="bg-red-50 text-red-600 border-red-200 text-xs font-bold">Full</Badge>}
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-5 h-5 text-stone-400" />
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (beds.length > 0 || rooms.length > 0) && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-stone-100 mt-1">
                        {hasRooms ? (
                          <div className="space-y-3 mt-3">
                            {rooms.map((room: any) => {
                              const roomBeds = room.beds || [];
                              const isCombo = room.typology?.includes("+");
                              const roomAvail = roomBeds.filter((b: any) => b.status === "available").length;
                              const allOccupied = roomBeds.length > 0 && roomAvail === 0;

                              const sections = isCombo ? room.typology.split("+").map((p: string, i: number) => ({
                                label: String.fromCharCode(65 + i),
                                bedCount: parseInt(p),
                                beds: roomBeds.filter((b: any) => b.bedNumber.includes(`${room.roomNumber}${String.fromCharCode(65 + i)}`)),
                              })) : null;

                              return (
                                <div key={room.id} className={cn(
                                  "border rounded-xl p-3 transition-all",
                                  allOccupied ? "border-red-200 bg-red-50/30" : roomAvail > 0 ? "border-stone-200 hover:border-amber-200 bg-stone-50/50 hover:bg-amber-50/30" : "border-stone-200 bg-stone-50/30"
                                )} data-testid={`room-${room.id}`}>
                                  <div className="flex items-center gap-2 mb-2.5">
                                    <span className="text-xs font-bold text-stone-700">Room {room.roomNumber}</span>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md">{room.typology}</Badge>
                                    {room.hasSharedWashroom && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-600 rounded-md">Shared WC</Badge>}
                                    <div className="flex-1" />
                                    {room.monthlyPrice && <span className="text-[10px] text-stone-400 font-medium">₹{room.monthlyPrice.toLocaleString()}/mo</span>}
                                    <Badge className={cn("text-[10px]", roomAvail > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-500 border-red-200")}>{roomAvail} open</Badge>
                                  </div>

                                  {isCombo && sections ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {sections.map((section: any) => (
                                        <div key={section.label} className="bg-white rounded-lg border border-stone-100 p-2.5">
                                          <p className="text-[10px] font-semibold text-stone-500 mb-1.5 uppercase tracking-wider">
                                            Section {section.label} — {section.bedCount} bed{section.bedCount > 1 ? "s" : ""}
                                          </p>
                                          <div className="flex gap-1.5 flex-wrap">
                                            {section.beds.map((bed: any) => renderBedButton(bed, floor, room))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex gap-1.5 flex-wrap">
                                      {roomBeds.map((bed: any) => renderBedButton(bed, floor, room))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {orphanBeds.length > 0 && (
                              <div className="mt-2">
                                <p className="text-[10px] text-stone-400 mb-1.5 font-medium uppercase tracking-wider">Other beds</p>
                                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
                                  {orphanBeds.map((bed: any) => renderBedButton(bed, floor))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5 mt-3">
                            {beds.map((bed: any) => renderBedButton(bed, floor))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function HousingPlans({ propertyId }: { propertyId: string }) {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: [`/api/properties/${propertyId}/plans`],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${propertyId}/plans`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!propertyId,
  });

  if (isLoading || plans.length === 0) return null;

  const allFeatureLabels: string[] = [];
  for (const plan of plans) {
    for (const item of plan.items || []) {
      if (!allFeatureLabels.includes(item.label)) {
        allFeatureLabels.push(item.label);
      }
    }
  }

  const getFeatureValue = (plan: any, label: string) => {
    const item = plan.items?.find((i: any) => i.label === label);
    if (!item) return null;
    return item.featureValue || (item.includedQty > 0 ? `${item.includedQty} ${item.unit}` : "Included");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      data-testid="housing-plans-section"
    >
      <h2 className="text-lg font-bold text-gray-900 tracking-wide uppercase mb-4 flex items-center gap-2">
        <Crown className="w-5 h-5 text-amber-600" />
        Housing Plans & Features
      </h2>

      <div className="hidden md:block overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-stone-900 to-stone-800">
              <th className="text-left py-4 px-5 text-stone-300 uppercase text-xs tracking-wider font-semibold min-w-[180px]">
                Lifestyle Features
              </th>
              {plans.map((plan: any) => (
                <th key={plan.id} className={`text-center py-4 px-4 min-w-[160px] relative ${plan.isHighlighted ? "bg-amber-600/20" : ""}`}>
                  {plan.isHighlighted && (
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-bold uppercase px-3 py-0.5 rounded-b-lg tracking-wider">
                      Most Popular
                    </div>
                  )}
                  <div className="text-white font-bold text-sm tracking-wide">{plan.name}</div>
                  {plan.tagline && <div className="text-stone-400 text-[10px] mt-0.5 font-medium">{plan.tagline}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-stone-100 bg-amber-50/50">
              <td className="py-3.5 px-5 font-semibold text-stone-700">Annual Fee (Standard)</td>
              {plans.map((plan: any) => (
                <td key={plan.id} className={`text-center py-3.5 px-4 ${plan.isHighlighted ? "bg-amber-50" : ""}`}>
                  <span className="text-lg font-bold text-amber-700">₹{Number(plan.basePrice).toLocaleString("en-IN")}</span>
                </td>
              ))}
            </tr>
            {plans.some((p: any) => p.occupancy) && (
              <tr className="border-b border-stone-100">
                <td className="py-3 px-5 font-medium text-stone-600">Occupancy</td>
                {plans.map((plan: any) => (
                  <td key={plan.id} className={`text-center py-3 px-4 text-stone-700 font-medium ${plan.isHighlighted ? "bg-amber-50/30" : ""}`}>
                    {plan.occupancy || "—"}
                  </td>
                ))}
              </tr>
            )}
            {plans.some((p: any) => p.locationInfo) && (
              <tr className="border-b border-stone-100">
                <td className="py-3 px-5 font-medium text-stone-600">Location</td>
                {plans.map((plan: any) => (
                  <td key={plan.id} className={`text-center py-3 px-4 text-stone-700 font-medium ${plan.isHighlighted ? "bg-amber-50/30" : ""}`}>
                    {plan.locationInfo || "—"}
                  </td>
                ))}
              </tr>
            )}
            {plans.some((p: any) => p.tagline) && (
              <tr className="border-b border-stone-100 bg-stone-50/50">
                <td className="py-3 px-5 font-medium text-stone-600">The "Vibe"</td>
                {plans.map((plan: any) => (
                  <td key={plan.id} className={`text-center py-3 px-4 font-bold ${plan.isHighlighted ? "text-amber-700 bg-amber-50/30" : "text-stone-800"}`}>
                    {plan.tagline || "—"}
                  </td>
                ))}
              </tr>
            )}
            {allFeatureLabels.map((label, idx) => (
              <tr key={label} className={`border-b border-stone-100 ${idx % 2 === 1 ? "bg-stone-50/40" : ""}`}>
                <td className="py-3 px-5 font-medium text-stone-600">{label}</td>
                {plans.map((plan: any) => {
                  const val = getFeatureValue(plan, label);
                  const isPaid = val && (val.toLowerCase().includes("paid") || val.toLowerCase().includes("pay-per"));
                  const isUnlimited = val && val.toLowerCase().includes("unlimited");
                  const isCredit = val && val.includes("Credit");
                  return (
                    <td key={plan.id} className={`text-center py-3 px-4 ${plan.isHighlighted ? "bg-amber-50/30" : ""}`}>
                      {val ? (
                        <span className={cn(
                          "font-medium",
                          isPaid ? "text-stone-400" : "",
                          isUnlimited ? "font-bold text-amber-700" : "",
                          isCredit ? "text-emerald-700 font-semibold" : "",
                          !isPaid && !isUnlimited && !isCredit ? "text-stone-700" : ""
                        )}>
                          {val}
                        </span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-4">
        {plans.map((plan: any) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={cn(
              "rounded-2xl border overflow-hidden bg-white",
              plan.isHighlighted ? "border-2 border-amber-400 shadow-lg shadow-amber-100" : "border-stone-200"
            )}
            data-testid={`plan-card-${plan.id}`}
          >
            {plan.isHighlighted && (
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white text-center text-[10px] font-bold uppercase tracking-wider py-1.5">
                <Star className="h-3 w-3 inline mr-1" /> Most Popular
              </div>
            )}
            <div className="p-5">
              <h3 className="font-bold text-lg text-stone-900">{plan.name}</h3>
              {plan.tagline && <p className="text-sm text-amber-600 font-medium">{plan.tagline}</p>}
              <div className="flex items-baseline gap-1 mt-2 mb-4">
                <span className="text-2xl font-bold text-amber-700">₹{Number(plan.basePrice).toLocaleString("en-IN")}</span>
                <span className="text-xs text-stone-400">/ year</span>
              </div>
              {plan.occupancy && (
                <div className="flex justify-between py-2 border-b border-stone-100 text-sm">
                  <span className="text-stone-500">Occupancy</span>
                  <span className="font-medium text-stone-700">{plan.occupancy}</span>
                </div>
              )}
              {plan.locationInfo && (
                <div className="flex justify-between py-2 border-b border-stone-100 text-sm">
                  <span className="text-stone-500">Location</span>
                  <span className="font-medium text-stone-700">{plan.locationInfo}</span>
                </div>
              )}
              {(plan.items || []).map((item: any) => (
                <div key={item.id} className="flex justify-between py-2 border-b border-stone-100 text-sm">
                  <span className="text-stone-500">{item.label}</span>
                  <span className="font-medium text-stone-700">{item.featureValue || `${item.includedQty} ${item.unit}`}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function PropertyBooking() {
  const [, params] = useRoute("/properties/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const propertyId = params?.id;
  const [selectedBed, setSelectedBed] = useState<any>(null);
  const [selectedFloor, setSelectedFloor] = useState<any>(null);
  const floorSectionRef = useRef<HTMLDivElement>(null);

  const { data: property, isLoading } = useQuery({
    queryKey: [`/api/properties/${propertyId}`],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${propertyId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!propertyId,
  });

  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const handleSelectBed = (bed: any, floor: any, room?: any) => {
    setSelectedBed(bed);
    setSelectedFloor(floor);
    if (room) setSelectedRoom(room);
  };

  const getBedSharingRoomType = (bed: any, room: any) => {
    if (!bed || !room || !property?.roomTypes) return null;
    const typology = room.typology || "";
    const isCombo = typology.includes("+");
    if (!isCombo) {
      return property.roomTypes.find((r: any) => r.id === bed.roomTypeId) || null;
    }
    const parts = typology.split("+").map((p: string) => parseInt(p.trim()));
    const bedNumber = bed.bedNumber || "";
    const sectionMatch = bedNumber.match(/\d+([A-Z])/);
    const sectionLetter = sectionMatch ? sectionMatch[1] : "A";
    const sectionIndex = sectionLetter.charCodeAt(0) - 65;
    const sectionBedCount = parts[sectionIndex] || parts[0] || 1;
    const matchingRt = property.roomTypes.find((r: any) => (r.occupancy || 1) === sectionBedCount);
    return matchingRt || property.roomTypes.find((r: any) => r.id === bed.roomTypeId) || null;
  };

  const scrollToFloors = () => {
    floorSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      roomNumber: selectedRoom?.roomNumber || "",
      roomId: selectedRoom?.id || "",
      floorId: selectedFloor?.id,
      floorName: selectedFloor?.name,
      roomTypology: selectedRoom?.typology || "",
    }));
    navigate("/booking/generate");
  };

  const handleBookSelectedBed = () => {
    if (!selectedBed || !property) return;
    const effectiveRoomType = getBedSharingRoomType(selectedBed, selectedRoom) 
      || property.roomTypes?.find((r: any) => r.id === selectedBed.roomTypeId);
    if (!effectiveRoomType) {
      toast({ title: "Room type not found", variant: "destructive" });
      return;
    }
    const price = property.bookingMode === "academic_year"
      ? (effectiveRoomType.academicYearPrice || effectiveRoomType.basePrice * 11)
      : effectiveRoomType.basePrice;
    handleBookRoom(
      effectiveRoomType.id,
      effectiveRoomType.customName || effectiveRoomType.name,
      price,
      effectiveRoomType.deposit || 0
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Skeleton className="h-[400px] w-full" />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-[300px] w-full rounded-xl" />
              <Skeleton className="h-8 w-48" />
              <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
            </div>
            <div><Skeleton className="h-[300px] w-full rounded-xl" /></div>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-stone-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-stone-700">Property not found</h2>
          <p className="text-stone-500 mt-2">The property you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/properties")} className="mt-6 bg-amber-600 hover:bg-amber-700 rounded-xl" data-testid="button-browse">Browse Properties</Button>
        </div>
      </div>
    );
  }

  const totalBeds = property.roomTypes?.reduce((s: number, r: any) => s + (r.totalBeds || 0), 0) || 0;
  const availableBeds = property.roomTypes?.reduce((s: number, r: any) => s + (r.availableBeds || 0), 0) || 0;
  const selectedRoomType = selectedBed 
    ? (getBedSharingRoomType(selectedBed, selectedRoom) || property.roomTypes?.find((r: any) => r.id === selectedBed.roomTypeId))
    : null;
  const lowestPrice = property.roomTypes?.reduce((min: number, r: any) => {
    const isAcademic = property.bookingMode === "academic_year";
    const price = isAcademic
      ? (r.academicYearPrice || (r.basePrice ? r.basePrice * 11 : 0))
      : (r.basePrice || 0);
    return price > 0 ? Math.min(min, price) : min;
  }, Infinity) || 0;

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="relative">
        <ImmersiveTour property={property} onStartBooking={scrollToFloors} />
      </div>

      <div className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <button onClick={() => navigate("/properties")} className="flex items-center gap-1.5 text-stone-400 hover:text-amber-600 text-xs mb-2 transition-colors uppercase tracking-wider font-medium" data-testid="button-back">
                <ChevronLeft className="w-3.5 h-3.5" /> All Properties
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight" data-testid="text-property-name">
                  {property.displayName || property.name}
                </h1>
                <Badge className="bg-amber-50 text-amber-700 border-amber-200 uppercase text-[10px] tracking-widest font-bold rounded-md">
                  {property.category}
                </Badge>
              </div>
              <p className="text-stone-500 flex items-center gap-1.5 text-sm mt-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                {property.location}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center px-5 py-3 bg-gradient-to-b from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl">
                <p className="text-xl font-bold text-amber-600">{lowestPrice > 0 && lowestPrice < Infinity ? `₹${lowestPrice.toLocaleString("en-IN")}` : "—"}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Starting {property.bookingMode === "academic_year" ? "per year" : "per month"}</p>
              </div>
              <div className="text-center px-5 py-3 bg-gradient-to-b from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl">
                <p className="text-xl font-bold text-emerald-600">{availableBeds}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Beds Available</p>
              </div>
              <div className="text-center px-5 py-3 bg-gradient-to-b from-stone-50 to-stone-100/50 border border-stone-200 rounded-xl">
                <p className="text-xl font-bold text-stone-700">{property.roomTypes?.length || 0}</p>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Room Types</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-10">
            {property.amenities?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-wide uppercase mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  Amenities & Facilities
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {property.amenities.map((am: string, i: number) => (
                    <motion.div
                      key={am}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.02 }}
                      className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm text-gray-700 hover:border-amber-300 hover:shadow-sm transition-all group"
                    >
                      <div className="w-6 h-6 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                        <Check className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      {am}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div ref={floorSectionRef}>
              <h2 className="text-lg font-bold text-gray-900 tracking-wide uppercase mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-600" />
                Select Your Floor & Bed
              </h2>
              <FloorBedSelector property={property} onSelectBed={handleSelectBed} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-wide uppercase mb-4 flex items-center gap-2">
                <Bed className="w-5 h-5 text-amber-600" />
                Room Types & Pricing
              </h2>
              <div className="space-y-3">
                {property.roomTypes?.map((room: any, i: number) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white border border-stone-200 rounded-xl p-5 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-500/5 transition-all group"
                    data-testid={`room-card-${room.id}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-lg">{room.customName || room.name}</h4>
                          {room.size && <span className="text-xs bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-md">{room.size}</span>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-stone-500">
                          <span className="flex items-center gap-1"><Bed className="w-4 h-4 text-amber-600" /> {room.occupancy || 1}-sharing</span>
                          <span className="flex items-center gap-1"><Users className="w-4 h-4 text-amber-600" /> {room.availableBeds}/{room.totalBeds} available</span>
                        </div>
                        {room.availableBeds > 0 && room.availableBeds < 5 && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-xs text-red-600 font-medium rounded-md">
                            <Clock className="w-3 h-3" /> Only {room.availableBeds} left
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {(() => {
                            const isAcademic = property.bookingMode === "academic_year";
                            const annualPrice = room.academicYearPrice || (room.basePrice ? room.basePrice * 11 : 0);
                            const monthlyPrice = isAcademic
                              ? (room.academicYearPrice ? Math.round(room.academicYearPrice / 11) : room.basePrice || 0)
                              : (room.basePrice || 0);
                            const displayPrice = isAcademic ? annualPrice : monthlyPrice;
                            return (
                              <>
                                <div className="text-2xl font-bold text-amber-600">
                                  {displayPrice > 0 ? `₹${displayPrice.toLocaleString("en-IN")}` : "—"}
                                </div>
                                <div className="text-xs text-stone-400 uppercase tracking-wider">
                                  {isAcademic ? "per year" : "per month"}
                                </div>
                                {isAcademic && monthlyPrice > 0 && (
                                  <div className="text-xs text-stone-400 mt-0.5">
                                    ≈ ₹{monthlyPrice.toLocaleString("en-IN")}/mo
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <Button
                          onClick={() => {
                            const isAcademic = property.bookingMode === "academic_year";
                            const price = isAcademic
                              ? (room.academicYearPrice || (room.basePrice ? room.basePrice * 11 : 0))
                              : (room.basePrice || 0);
                            handleBookRoom(room.id, room.customName || room.name, price, room.deposit || 0);
                          }}
                          disabled={room.availableBeds === 0}
                          className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-6 h-11 font-semibold tracking-wider uppercase text-sm"
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

            <HousingPlans propertyId={property.id} />

            {property.rules && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 tracking-wide uppercase mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-600" />
                  Rules & Policies
                </h2>
                <div className="bg-white border border-stone-200 rounded-xl p-5">
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{property.rules}</p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-stone-200 shadow-xl shadow-stone-200/50 overflow-hidden rounded-xl"
              >
                <div className="bg-gradient-to-r from-stone-900 to-stone-800 p-4 flex items-center justify-between">
                  <h3 className="text-white font-bold tracking-wider uppercase text-sm">Booking Summary</h3>
                  {selectedBed && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] rounded-md">Selected</Badge>
                  )}
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Property</p>
                      <p className="font-semibold text-gray-900 text-sm">{property.displayName || property.name}</p>
                    </div>
                  </div>

                  {selectedBed && selectedFloor && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                      <div className="border-t border-stone-100 pt-3 flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-center shrink-0">
                          <Layers className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Floor</p>
                          <p className="font-semibold text-gray-900 text-sm">{selectedFloor.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-center shrink-0">
                          <Bed className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Bed</p>
                          <p className="font-semibold text-gray-900 text-sm">#{selectedBed.bedNumber}</p>
                        </div>
                      </div>
                      {selectedRoomType && (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-50 border border-amber-100 rounded-lg flex items-center justify-center shrink-0">
                              <Home className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Room Type</p>
                              <p className="font-semibold text-gray-900 text-sm">{selectedRoomType.customName || selectedRoomType.name}</p>
                            </div>
                          </div>
                          <div className="border-t border-stone-100 pt-4 bg-gradient-to-b from-amber-50/50 to-stone-50 -mx-5 px-5 pb-0 -mb-1 rounded-b-xl">
                            <div className="flex justify-between items-baseline">
                              <span className="text-stone-500 text-sm">Total Price</span>
                              <div className="text-right">
                                {(() => {
                                  const isAcademic = property.bookingMode === "academic_year";
                                  const annualPrice = selectedRoomType.academicYearPrice || (selectedRoomType.basePrice ? selectedRoomType.basePrice * 11 : 0);
                                  const monthlyPrice = isAcademic
                                    ? (selectedRoomType.academicYearPrice ? Math.round(selectedRoomType.academicYearPrice / 11) : selectedRoomType.basePrice || 0)
                                    : (selectedRoomType.basePrice || 0);
                                  const displayPrice = isAcademic ? annualPrice : monthlyPrice;
                                  return (
                                    <>
                                      <span className="text-3xl font-bold text-amber-600">
                                        {displayPrice > 0 ? `₹${displayPrice.toLocaleString("en-IN")}` : "—"}
                                      </span>
                                      <p className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">
                                        {isAcademic ? "per year" : "per month"}
                                      </p>
                                      {isAcademic && monthlyPrice > 0 && (
                                        <p className="text-[10px] text-stone-400">
                                          ≈ ₹{monthlyPrice.toLocaleString("en-IN")}/mo
                                        </p>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      <Button onClick={handleBookSelectedBed} className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-12 font-semibold tracking-wider uppercase shadow-lg shadow-amber-600/20" data-testid="button-proceed-booking">
                        Proceed to Book <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </motion.div>
                  )}

                  {!selectedBed && (
                    <div className="text-center py-8 border-t border-stone-100">
                      <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Bed className="w-7 h-7 text-stone-300" />
                      </div>
                      <p className="text-sm text-stone-400 font-medium">No bed selected</p>
                      <p className="text-xs text-stone-300 mt-1">Select a floor & bed, or choose a room type below</p>
                    </div>
                  )}
                </div>
              </motion.div>

              <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
                <h4 className="font-bold text-xs tracking-wider uppercase text-gray-900">Contact Property</h4>
                {property.phone && (
                  <a href={`tel:${property.phone}`} className="flex items-center gap-2.5 text-sm text-stone-600 hover:text-amber-600 transition-colors">
                    <Phone className="w-4 h-4" /> {property.phone}
                  </a>
                )}
                {property.email && (
                  <a href={`mailto:${property.email}`} className="flex items-center gap-2.5 text-sm text-stone-600 hover:text-amber-600 transition-colors">
                    <Mail className="w-4 h-4" /> {property.email}
                  </a>
                )}
                {property.mapsUrl && (
                  <a href={property.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-amber-600 hover:text-amber-700 font-medium transition-colors">
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
