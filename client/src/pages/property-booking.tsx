import { useState, useEffect, useCallback, useRef, useMemo, Component, type ReactNode, type ErrorInfo } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

class PropertyBookingErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[PropertyBooking] React render error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-white/50 text-sm mb-4">
              {this.state.error?.message || "An unexpected error occurred while loading this page."}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-6 py-2 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  Building2, MapPin, Bed, ChevronLeft, ChevronRight, Camera,
  Sparkles, Check, Phone, Mail, ArrowRight, Users,
  Layers, Clock, Shield, X, Play, Pause,
  ChevronDown, Maximize2, Home, Grid3X3, Eye,
  ZoomIn, Navigation, Compass, Star, Wifi, Coffee,
  Crown, IndianRupee, CheckCircle2,
} from "lucide-react";
import { ParticleBackground } from "@/components/particle-background";

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
        className="relative aspect-[16/10] md:aspect-[21/9] bg-[#050505] overflow-hidden group cursor-pointer"
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

            <div className="absolute top-[72px] left-0 right-0 z-[5]">
              <div className="h-[2px] bg-white/10">
                <motion.div className="h-full bg-gradient-to-r from-amber-500 to-amber-400" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
              </div>
            </div>

            <div className="absolute top-20 left-4 right-4 z-[5] flex items-start justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#050505]">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-3xl" />
              <Camera className="w-20 h-20 text-white/20 relative" />
            </div>
            <p className="text-white/40 font-bold text-lg mt-4 tracking-wider uppercase">Tour Coming Soon</p>
            <p className="text-white/20 text-sm mt-2">Images will be uploaded by the property manager</p>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a] to-white/[0.03] px-4 py-3 flex items-center justify-between">
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

const PLAN_TIER_PALETTES = [
  {
    bg: "bg-gradient-to-br from-emerald-400 via-teal-400 to-emerald-500",
    border: "border-emerald-300",
    shadow: "shadow-lg shadow-emerald-400/40",
    ring: "ring-2 ring-emerald-300/60 ring-offset-1 ring-offset-white",
    text: "text-emerald-900",
    iconText: "text-emerald-900",
    badgeBg: "bg-gradient-to-r from-emerald-500 to-teal-500",
    badgeText: "text-white",
    overlay: "rgba(16,185,129,0.3)",
    label: "Essential",
    crownColor: "from-emerald-500 to-teal-600",
    bannerBg: "bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50",
    bannerBorder: "border-emerald-300 shadow-emerald-200/30",
    bannerSubText: "text-emerald-600",
    roomBorder: "border-emerald-300 bg-emerald-50/40 shadow-md shadow-emerald-200/30",
  },
  {
    bg: "bg-gradient-to-br from-violet-400 via-purple-400 to-violet-500",
    border: "border-violet-300",
    shadow: "shadow-lg shadow-violet-400/40",
    ring: "ring-2 ring-violet-300/60 ring-offset-1 ring-offset-white",
    text: "text-violet-900",
    iconText: "text-violet-900",
    badgeBg: "bg-gradient-to-r from-violet-500 to-purple-500",
    badgeText: "text-white",
    overlay: "rgba(139,92,246,0.3)",
    label: "Popular",
    crownColor: "from-violet-500 to-purple-600",
    bannerBg: "bg-gradient-to-r from-violet-50 via-purple-50 to-violet-50",
    bannerBorder: "border-violet-300 shadow-violet-200/30",
    bannerSubText: "text-violet-600",
    roomBorder: "border-violet-300 bg-violet-50/40 shadow-md shadow-violet-200/30",
  },
  {
    bg: "bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500",
    border: "border-amber-300",
    shadow: "shadow-lg shadow-amber-400/40",
    ring: "ring-2 ring-amber-300/60 ring-offset-1 ring-offset-white",
    text: "text-amber-900",
    iconText: "text-amber-900",
    badgeBg: "bg-gradient-to-r from-amber-500 to-yellow-500",
    badgeText: "text-white",
    overlay: "rgba(251,191,36,0.3)",
    label: "Premium",
    crownColor: "from-amber-500 to-yellow-600",
    bannerBg: "bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50",
    bannerBorder: "border-amber-300 shadow-amber-200/30",
    bannerSubText: "text-amber-600",
    roomBorder: "border-amber-300 bg-amber-50/40 shadow-md shadow-amber-200/30",
  },
];

function getBedTierColors(tierLevel: number, maxTier: number = 2) {
  if (maxTier <= 0) maxTier = 2;
  const idx = maxTier <= 2
    ? tierLevel
    : tierLevel >= maxTier ? 2 : tierLevel >= Math.floor(maxTier / 2) ? 1 : 0;
  return PLAN_TIER_PALETTES[Math.min(Math.max(idx, 0), PLAN_TIER_PALETTES.length - 1)];
}

function MultiPlanBedOverlay({ plans }: { plans: Array<{ tierLevel: number }> }) {
  const sortedPlans = [...plans].sort((a, b) => (a.tierLevel ?? 0) - (b.tierLevel ?? 0));
  const bgGradients = [
    "linear-gradient(135deg, rgba(16,185,129,0.55) 0%, rgba(20,184,166,0.55) 100%)",
    "linear-gradient(135deg, rgba(139,92,246,0.55) 0%, rgba(168,85,247,0.55) 100%)",
    "linear-gradient(135deg, rgba(251,191,36,0.55) 0%, rgba(250,204,21,0.55) 100%)",
  ];
  const borderColors = ["rgba(16,185,129,0.4)", "rgba(139,92,246,0.4)", "rgba(251,191,36,0.4)"];
  const n = sortedPlans.length;
  const planBgs = sortedPlans.map((_, i) => bgGradients[Math.min(i, bgGradients.length - 1)]);
  const planBorders = sortedPlans.map((_, i) => borderColors[Math.min(i, borderColors.length - 1)]);
  const duration = n * 2.5;

  const bgKeyframes = [...planBgs, planBgs[0]];
  const borderKeyframes = [...planBorders, planBorders[0]];

  return (
    <>
      <motion.div
        className="absolute inset-0 rounded-[10px] pointer-events-none"
        animate={{ background: bgKeyframes, opacity: [0.7, 0.9, 0.7] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-[-2px] rounded-xl pointer-events-none"
        style={{ border: "2px solid transparent" }}
        animate={{ borderColor: borderKeyframes }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-md z-10 border border-white/80"
        animate={{ background: bgKeyframes, opacity: [0.7, 1, 0.7] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      >
        <Crown className="w-3 h-3 text-white/90" />
      </motion.div>
    </>
  );
}

function MultiPlanRoomBadge({ plans }: { plans: Array<{ name: string; tierLevel: number }> }) {
  const sorted = [...plans].sort((a, b) => (a.tierLevel ?? 0) - (b.tierLevel ?? 0));
  const allColors = sorted.map(p => PLAN_TIER_PALETTES[Math.min(Math.max(p.tierLevel ?? 0, 0), PLAN_TIER_PALETTES.length - 1)]);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {sorted.map((plan, i) => {
        const c = allColors[i];
        return (
          <Badge key={plan.name} className={cn("text-[9px] px-1.5 py-0 rounded-md border-0 whitespace-nowrap", c.badgeBg, c.badgeText)}>
            <Crown className="w-2.5 h-2.5 mr-0.5" /> {plan.name}
          </Badge>
        );
      })}
    </div>
  );
}

function FloorBedSelector({ property, onSelectBed, filterRoomTypeId, autoExpand, selectedPlan }: { property: any; onSelectBed: (bed: any, floor: any, room?: any) => void; filterRoomTypeId?: string | null; autoExpand?: string | null; selectedPlan?: any }) {
  const [expandedFloor, setExpandedFloor] = useState<string | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const prevAutoExpandRef = useRef<string | null>(null);

  const { data: floorsData = [], isLoading } = useQuery({
    queryKey: [`/api/properties/${property.id}/floors`],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${property.id}/floors`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!property?.id,
  });

  const { data: propertyPlans = [] } = useQuery({
    queryKey: [`/api/properties/${property.id}/plans`],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${property.id}/plans`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!property?.id,
  });

  const roomTypePlanMap = useMemo(() => {
    const map: Record<string, { name: string; tierLevel: number; id: string }> = {};
    for (const plan of propertyPlans) {
      const allLinkedIds: string[] = Array.isArray(plan.linkedRoomTypeIds) ? plan.linkedRoomTypeIds : (plan.roomTypeId ? [plan.roomTypeId] : []);
      for (const rtId of allLinkedIds) {
        if (!map[rtId]) {
          map[rtId] = { name: plan.name, tierLevel: plan.tierLevel ?? 0, id: plan.id };
        }
      }
    }
    return map;
  }, [propertyPlans]);

  const roomTypeMultiPlanMap = useMemo(() => {
    const map: Record<string, Array<{ name: string; tierLevel: number; id: string }>> = {};
    for (const plan of propertyPlans) {
      const allLinkedIds: string[] = Array.isArray(plan.linkedRoomTypeIds) ? plan.linkedRoomTypeIds : (plan.roomTypeId ? [plan.roomTypeId] : []);
      for (const rtId of allLinkedIds) {
        if (!map[rtId]) map[rtId] = [];
        map[rtId].push({ name: plan.name, tierLevel: plan.tierLevel ?? 0, id: plan.id });
      }
    }
    return map;
  }, [propertyPlans]);

  useEffect(() => {
    if (!autoExpand || floorsData.length === 0) return;
    if (prevAutoExpandRef.current === autoExpand) return;
    prevAutoExpandRef.current = autoExpand;

    let targetFloor: any = null;

    if (filterRoomTypeId) {
      targetFloor = floorsData.find((f: any) =>
        (f.rooms || []).some((r: any) => r.roomTypeId === filterRoomTypeId && (r.beds || []).some((b: any) => b.status === "available")) ||
        (f.beds || []).some((b: any) => b.roomTypeId === filterRoomTypeId && b.status === "available")
      );
    }

    if (!targetFloor) {
      targetFloor = floorsData.find((f: any) =>
        (f.rooms || []).some((r: any) => (r.beds || []).some((b: any) => b.status === "available")) ||
        (f.beds || []).some((b: any) => b.status === "available")
      );
    }

    if (targetFloor) {
      setExpandedFloor(targetFloor.id);
    }
  }, [autoExpand, filterRoomTypeId, floorsData]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
      </div>
    );
  }

  if (floorsData.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl border-2 border-dashed border-white/[0.08] bg-white/[0.02]">
        <Layers className="w-14 h-14 text-white/20 mx-auto mb-3" />
        <p className="text-white/50 font-semibold text-lg">Floor plan not configured yet</p>
        <p className="text-sm text-white/30 mt-1">Please select a room type below to book</p>
      </div>
    );
  }

  const statusConfig: Record<string, { bg: string; border: string; label: string; cursor: string; dot: string }> = {
    available: { bg: "bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/40", border: "border-emerald-500/80", label: "Available", cursor: "cursor-pointer", dot: "bg-emerald-500" },
    occupied: { bg: "bg-gradient-to-br from-red-300/60 to-red-500/60", border: "border-red-400/40", label: "Occupied", cursor: "cursor-not-allowed", dot: "bg-red-400" },
    reserved: { bg: "bg-gradient-to-br from-amber-300/60 to-amber-500/60", border: "border-amber-400/40", label: "Reserved", cursor: "cursor-not-allowed", dot: "bg-amber-400" },
    maintenance: { bg: "bg-gradient-to-br from-stone-200/60 to-stone-400/60", border: "border-stone-300/40", label: "Maintenance", cursor: "cursor-not-allowed", dot: "bg-stone-400" },
    blocked: { bg: "bg-gradient-to-br from-red-600/60 to-red-800/60", border: "border-red-700/40", label: "Blocked", cursor: "cursor-not-allowed", dot: "bg-red-700" },
  };

  const activeTierColors = selectedPlan ? getBedTierColors(selectedPlan.tierLevel ?? 0) : null;

  const renderBedButton = (bed: any, floor: any, room?: any) => {
    const isSelected = selectedBedId === bed.id;
    const isHeld = bed.held && !isSelected;
    const isAvailable = bed.status === "available" && !isHeld;
    const matchesPlanFilter = !filterRoomTypeId || bed.roomTypeId === filterRoomTypeId;
    const isPlanHighlighted = isAvailable && filterRoomTypeId && matchesPlanFilter;
    const isDimmedByPlan = isAvailable && filterRoomTypeId && !matchesPlanFilter;

    const bedPlanInfo = bed.roomTypeId ? roomTypePlanMap[bed.roomTypeId] : null;
    const bedPlanColors = bedPlanInfo ? getBedTierColors(bedPlanInfo.tierLevel) : null;
    const hasPassivePlan = isAvailable && !filterRoomTypeId && bedPlanInfo && bedPlanColors;
    const multiPlans = bed.roomTypeId ? (roomTypeMultiPlanMap[bed.roomTypeId] || []) : [];
    const hasMultiPlan = isAvailable && !filterRoomTypeId && multiPlans.length > 1;

    const tierColors = isPlanHighlighted ? activeTierColors : (hasPassivePlan && !hasMultiPlan ? bedPlanColors : null);

    const config = isHeld 
      ? { bg: "bg-gradient-to-br from-orange-300/60 to-orange-500/60", border: "border-orange-400/40", label: "Booking in progress", cursor: "cursor-not-allowed", dot: "bg-orange-400" }
      : (statusConfig[bed.status] || statusConfig.maintenance);
    return (
      <motion.button
        key={bed.id}
        whileHover={(isAvailable && matchesPlanFilter) ? { scale: 1.15, y: -6, transition: { type: "spring", stiffness: 400, damping: 15 } } : {}}
        whileTap={(isAvailable && matchesPlanFilter) ? { scale: 0.93 } : {}}
        onClick={() => {
          if (!isAvailable || !matchesPlanFilter) return;
          setSelectedBedId(bed.id);
          onSelectBed(bed, floor, room);
        }}
        className={cn(
          "relative p-2 border-2 rounded-xl text-center transition-all duration-300",
          isPlanHighlighted && tierColors
            ? cn(tierColors.bg, tierColors.border, tierColors.shadow, tierColors.ring)
            : hasMultiPlan
              ? "border-transparent shadow-lg"
              : hasPassivePlan && bedPlanColors
                ? cn(bedPlanColors.bg, bedPlanColors.border, "shadow-md", bedPlanColors.shadow)
                : isDimmedByPlan
                  ? "bg-white/[0.04] border-white/[0.04] opacity-30 grayscale cursor-not-allowed"
                  : cn(config.bg, config.border),
          (isAvailable && matchesPlanFilter) ? "cursor-pointer" : (!isDimmedByPlan && config.cursor),
          !isAvailable && !isDimmedByPlan && !hasPassivePlan && !hasMultiPlan && "opacity-40",
          isSelected && "!bg-gradient-to-br !from-amber-500 !to-amber-700 !border-amber-400 ring-3 ring-amber-400/60 ring-offset-2 ring-offset-[#050505] shadow-xl shadow-amber-500/50"
        )}
        title={`${bed.bedNumber} — ${config.label}${isDimmedByPlan ? " (not included in selected plan)" : ""}${isPlanHighlighted && selectedPlan ? ` — ${selectedPlan.name}` : hasMultiPlan ? ` — ${multiPlans.map(p => p.name).join(", ")}` : hasPassivePlan && bedPlanInfo ? ` — ${bedPlanInfo.name}` : ""}${bed.monthlyPrice ? ` — ₹${bed.monthlyPrice}/mo` : ""}${room ? ` — Room ${room.roomNumber}` : ""}`}
        data-testid={`bed-${bed.id}`}
      >
        {isPlanHighlighted && !isSelected && tierColors && (
          <>
            <motion.div
              className={cn("absolute -top-2 -right-2 w-5 h-5 bg-gradient-to-br rounded-full flex items-center justify-center shadow-lg z-10 border border-white", tierColors.crownColor)}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Crown className="w-3 h-3 text-white" />
            </motion.div>
            <motion.div
              className="absolute inset-0 rounded-[10px] pointer-events-none"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: `linear-gradient(135deg, ${tierColors.overlay} 0%, transparent 50%, ${tierColors.overlay} 100%)` }}
            />
          </>
        )}
        {hasMultiPlan && !isSelected && !isPlanHighlighted && (
          <MultiPlanBedOverlay plans={multiPlans} />
        )}
        {hasPassivePlan && !hasMultiPlan && !isSelected && !isPlanHighlighted && bedPlanColors && (
          <div className="absolute inset-0 rounded-[10px] bg-gradient-to-t from-white/10 to-white/20 pointer-events-none" />
        )}
        {isAvailable && !isSelected && !isPlanHighlighted && !isDimmedByPlan && !hasPassivePlan && (
          <div className="absolute inset-0 rounded-[10px] bg-gradient-to-t from-white/10 to-white/25 pointer-events-none" />
        )}
        <Bed className={cn("w-4 h-4 mx-auto drop-shadow-sm relative z-[1]", (isPlanHighlighted || (hasPassivePlan && !hasMultiPlan)) && tierColors ? tierColors.iconText : hasMultiPlan ? "text-white" : isSelected ? "text-white" : "text-white/90")} />
        <span className={cn("text-[9px] font-bold block mt-0.5 truncate drop-shadow-sm relative z-[1]", (isPlanHighlighted || (hasPassivePlan && !hasMultiPlan)) && tierColors ? tierColors.text : hasMultiPlan ? "text-white" : isSelected ? "text-white" : "text-white/90")}>{bed.bedNumber}</span>
        {isSelected && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white/90 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30 z-10"
          >
            <Check className="w-3.5 h-3.5 text-amber-600" />
          </motion.div>
        )}
        {isAvailable && matchesPlanFilter && !isPlanHighlighted && !hasPassivePlan && (
          <div className="absolute inset-0 rounded-[10px] opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        )}
      </motion.button>
    );
  };

  const totalAll = floorsData.reduce((s: number, f: any) => s + (f.beds?.length || 0), 0);
  const availAll = floorsData.reduce((s: number, f: any) => s + (f.beds?.filter((b: any) => b.status === "available").length || 0), 0);

  return (
    <div className="space-y-4" data-testid="floor-bed-selector">
      {selectedPlan && activeTierColors && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className={cn("flex items-center gap-3 rounded-xl p-3.5 shadow-md border-2", activeTierColors.bannerBg, activeTierColors.bannerBorder)}
        >
          <motion.div
            className={cn("w-9 h-9 bg-gradient-to-br rounded-lg flex items-center justify-center shadow-lg", activeTierColors.crownColor)}
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Crown className="w-5 h-5 text-white" />
          </motion.div>
          <div className="flex-1">
            <p className={cn("text-sm font-bold", activeTierColors.text)}>{selectedPlan.name}</p>
            <p className={cn("text-xs", activeTierColors.bannerSubText)}>
              {filterRoomTypeId 
                ? `Highlighted beds belong to ${selectedPlan.roomTypeName || "this plan's room type"}. Select one to book.`
                : "All beds are available for this plan. Select any bed to book."}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            {filterRoomTypeId && (
              <>
                <span className="flex items-center gap-1"><span className={cn("w-3 h-3 rounded", activeTierColors.bg, activeTierColors.border)} /> {selectedPlan.name}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white/20" /> Other</span>
              </>
            )}
          </div>
        </motion.div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.03] p-4 rounded-xl border border-white/[0.08]">
        <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
          {Object.entries(statusConfig).map(([key, config]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={cn("w-3 h-3 rounded-full shadow-sm", config.dot)} />
              {config.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-bold">{availAll} available</Badge>
          <span className="text-white/30 text-xs">of {totalAll} total beds</span>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-7 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/60 via-amber-500/20 to-transparent" />

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
              <div className={cn("absolute left-5 top-5 w-5 h-5 rounded-full border-2 z-10", availBeds > 0 ? "bg-amber-500 border-amber-400" : "bg-white/20 border-white/10")} />

              <div className={cn("rounded-xl border overflow-hidden transition-all duration-200", isExpanded ? "border-amber-500/30 shadow-xl shadow-amber-500/10 bg-white/[0.04]" : "border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.04]")}>
                <button
                  onClick={() => setExpandedFloor(isExpanded ? null : floor.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12">
                      <svg viewBox="0 0 48 48" className="w-full h-full">
                        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                        <circle cx="24" cy="24" r="20" fill="none" stroke={availBeds > 0 ? "#f59e0b" : "#ef4444"} strokeWidth="3" strokeDasharray={`${(availBeds / Math.max(totalBeds, 1)) * 125.6} 125.6`} strokeLinecap="round" transform="rotate(-90 24 24)" className="transition-all duration-700" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/80">{floor.floorNumber}</span>
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-white">{floor.name}</h4>
                      <p className="text-xs text-white/40 mt-0.5">
                        {hasRooms && <><span className="text-indigo-400 font-medium">{rooms.length} rooms</span> · </>}
                        <span className="text-emerald-400 font-semibold">{availBeds}</span> of {totalBeds} beds available
                        <span className="text-white/20 ml-2">({occupancyPct}% open)</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {availBeds > 0 && <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs font-bold">{availBeds} open</Badge>}
                    {availBeds === 0 && totalBeds > 0 && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs font-bold">Full</Badge>}
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-5 h-5 text-white/40" />
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (beds.length > 0 || rooms.length > 0) && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-white/[0.06] mt-1">
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

                              const roomMatchesPlan = filterRoomTypeId && room.roomTypeId === filterRoomTypeId;
                              const roomDimmedByPlan = filterRoomTypeId && room.roomTypeId !== filterRoomTypeId;
                              const roomPlanInfo = room.roomTypeId ? roomTypePlanMap[room.roomTypeId] : null;
                              const roomPlanColors = roomPlanInfo ? getBedTierColors(roomPlanInfo.tierLevel) : null;
                              const hasPassiveRoomPlan = !filterRoomTypeId && roomPlanInfo && roomPlanColors;
                              const roomMultiPlans = room.roomTypeId ? (roomTypeMultiPlanMap[room.roomTypeId] || []) : [];
                              const hasMultiRoomPlan = !filterRoomTypeId && roomMultiPlans.length > 1;

                              return (
                                <div key={room.id} className={cn(
                                  "border rounded-xl p-3 transition-all",
                                  roomMatchesPlan && activeTierColors
                                    ? cn("border-2", activeTierColors.roomBorder)
                                    : roomDimmedByPlan
                                      ? "border-white/[0.06] bg-white/[0.01] opacity-40"
                                      : hasPassiveRoomPlan && !hasMultiRoomPlan
                                        ? cn("border-2", roomPlanColors.roomBorder)
                                        : hasMultiRoomPlan
                                          ? "border-2 border-white/[0.1] bg-white/[0.02]"
                                          : allOccupied ? "border-red-500/20 bg-red-500/5" : roomAvail > 0 ? "border-white/[0.08] hover:border-amber-500/20 bg-white/[0.02] hover:bg-amber-500/5" : "border-white/[0.06] bg-white/[0.01]"
                                )} data-testid={`room-${room.id}`}>
                                  <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                                    <span className="text-xs font-bold text-white/80">Room {room.roomNumber}</span>
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md">{room.typology}</Badge>
                                    {room.hasSharedWashroom && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-200 text-blue-600 rounded-md">Shared WC</Badge>}
                                    {roomMatchesPlan && selectedPlan && activeTierColors ? (
                                      <Badge className={cn("text-[10px] px-1.5 py-0 rounded-md border-0", activeTierColors.badgeBg, activeTierColors.badgeText)}>
                                        <Crown className="w-2.5 h-2.5 mr-0.5" /> {selectedPlan.name}
                                      </Badge>
                                    ) : hasMultiRoomPlan ? (
                                      <MultiPlanRoomBadge plans={roomMultiPlans} />
                                    ) : hasPassiveRoomPlan && roomPlanColors ? (
                                      <Badge className={cn("text-[10px] px-1.5 py-0 rounded-md border-0", roomPlanColors.badgeBg, roomPlanColors.badgeText)}>
                                        <Crown className="w-2.5 h-2.5 mr-0.5" /> {roomPlanInfo.name}
                                      </Badge>
                                    ) : null}
                                    <div className="flex-1" />
                                    {room.monthlyPrice && <span className="text-[10px] text-white/30 font-medium">₹{room.monthlyPrice.toLocaleString()}/mo</span>}
                                    <Badge className={cn("text-[10px]", roomAvail > 0 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>{roomAvail} open</Badge>
                                  </div>

                                  {isCombo && sections ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {sections.map((section: any) => (
                                        <div key={section.label} className="bg-white/[0.03] rounded-lg border border-white/[0.06] p-2.5">
                                          <p className="text-[10px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">
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
                                <p className="text-[10px] text-white/30 mb-1.5 font-medium uppercase tracking-wider">Other beds</p>
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

function getTierStyle(tierLevel: number, _totalTiers: number) {
  const tierStyles: Record<number, { accent: string; glow: string; text: string; badge: string; border: string; ring: string; shimmer: string; bg: string; cardBg: string; btnGradient: string; btnHover: string; priceColor: string; headerBg: string; icon: string; featureText: string; labelText: string; divider: string; checkColor: string }> = {
    0: { accent: "from-stone-400 to-stone-500", glow: "shadow-stone-600/40", text: "text-stone-300", badge: "bg-gradient-to-r from-stone-600 to-stone-500", border: "border-stone-500", ring: "ring-stone-500/20", shimmer: "from-stone-600/0 via-stone-400/20 to-stone-600/0", bg: "bg-stone-800/60", cardBg: "bg-gradient-to-br from-stone-800 via-stone-700 to-stone-800", btnGradient: "bg-gradient-to-r from-stone-500 to-stone-400", btnHover: "hover:from-stone-400 hover:to-stone-300", priceColor: "text-stone-100", headerBg: "bg-stone-800", icon: "text-stone-400", featureText: "text-stone-200", labelText: "text-stone-400", divider: "border-stone-600/50", checkColor: "text-stone-400" },
    1: { accent: "from-violet-400 to-purple-500", glow: "shadow-violet-600/50", text: "text-violet-300", badge: "bg-gradient-to-r from-violet-600 to-purple-500", border: "border-violet-500", ring: "ring-violet-400/30", shimmer: "from-violet-500/0 via-violet-300/25 to-violet-500/0", bg: "bg-violet-800/60", cardBg: "bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900", btnGradient: "bg-gradient-to-r from-violet-500 to-purple-500", btnHover: "hover:from-violet-400 hover:to-purple-400", priceColor: "text-violet-200", headerBg: "bg-violet-900", icon: "text-violet-400", featureText: "text-violet-100", labelText: "text-violet-300/70", divider: "border-violet-600/40", checkColor: "text-violet-400" },
    2: { accent: "from-amber-400 via-yellow-300 to-amber-500", glow: "shadow-amber-500/50", text: "text-amber-300", badge: "bg-gradient-to-r from-amber-500 to-yellow-500", border: "border-amber-500", ring: "ring-amber-400/30", shimmer: "from-amber-500/0 via-amber-300/30 to-amber-500/0", bg: "bg-amber-800/60", cardBg: "bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900", btnGradient: "bg-gradient-to-r from-amber-500 to-yellow-500", btnHover: "hover:from-amber-400 hover:to-yellow-400", priceColor: "text-amber-200", headerBg: "bg-amber-900", icon: "text-amber-400", featureText: "text-amber-100", labelText: "text-amber-300/70", divider: "border-amber-600/40", checkColor: "text-amber-400" },
    3: { accent: "from-emerald-400 to-teal-500", glow: "shadow-emerald-500/50", text: "text-emerald-300", badge: "bg-gradient-to-r from-emerald-600 to-teal-500", border: "border-emerald-500", ring: "ring-emerald-400/30", shimmer: "from-emerald-500/0 via-emerald-300/25 to-emerald-500/0", bg: "bg-emerald-800/60", cardBg: "bg-gradient-to-br from-emerald-900 via-teal-800 to-green-900", btnGradient: "bg-gradient-to-r from-emerald-500 to-teal-500", btnHover: "hover:from-emerald-400 hover:to-teal-400", priceColor: "text-emerald-200", headerBg: "bg-emerald-900", icon: "text-emerald-400", featureText: "text-emerald-100", labelText: "text-emerald-300/70", divider: "border-emerald-600/40", checkColor: "text-emerald-400" },
    4: { accent: "from-rose-400 to-pink-500", glow: "shadow-rose-500/50", text: "text-rose-300", badge: "bg-gradient-to-r from-rose-600 to-pink-500", border: "border-rose-500", ring: "ring-rose-400/30", shimmer: "from-rose-500/0 via-rose-300/25 to-rose-500/0", bg: "bg-rose-800/60", cardBg: "bg-gradient-to-br from-rose-900 via-pink-800 to-red-900", btnGradient: "bg-gradient-to-r from-rose-500 to-pink-500", btnHover: "hover:from-rose-400 hover:to-pink-400", priceColor: "text-rose-200", headerBg: "bg-rose-900", icon: "text-rose-400", featureText: "text-rose-100", labelText: "text-rose-300/70", divider: "border-rose-600/40", checkColor: "text-rose-400" },
    5: { accent: "from-cyan-400 to-sky-500", glow: "shadow-cyan-500/50", text: "text-cyan-300", badge: "bg-gradient-to-r from-cyan-600 to-sky-500", border: "border-cyan-500", ring: "ring-cyan-400/30", shimmer: "from-cyan-500/0 via-cyan-300/25 to-cyan-500/0", bg: "bg-cyan-800/60", cardBg: "bg-gradient-to-br from-cyan-900 via-sky-800 to-blue-900", btnGradient: "bg-gradient-to-r from-cyan-500 to-sky-500", btnHover: "hover:from-cyan-400 hover:to-sky-400", priceColor: "text-cyan-200", headerBg: "bg-cyan-900", icon: "text-cyan-400", featureText: "text-cyan-100", labelText: "text-cyan-300/70", divider: "border-cyan-600/40", checkColor: "text-cyan-400" },
    6: { accent: "from-orange-400 to-red-500", glow: "shadow-orange-500/50", text: "text-orange-300", badge: "bg-gradient-to-r from-orange-600 to-red-500", border: "border-orange-500", ring: "ring-orange-400/30", shimmer: "from-orange-500/0 via-orange-300/25 to-orange-500/0", bg: "bg-orange-800/60", cardBg: "bg-gradient-to-br from-orange-900 via-red-800 to-amber-900", btnGradient: "bg-gradient-to-r from-orange-500 to-red-500", btnHover: "hover:from-orange-400 hover:to-red-400", priceColor: "text-orange-200", headerBg: "bg-orange-900", icon: "text-orange-400", featureText: "text-orange-100", labelText: "text-orange-300/70", divider: "border-orange-600/40", checkColor: "text-orange-400" },
    7: { accent: "from-indigo-400 to-blue-500", glow: "shadow-indigo-500/50", text: "text-indigo-300", badge: "bg-gradient-to-r from-indigo-600 to-blue-500", border: "border-indigo-500", ring: "ring-indigo-400/30", shimmer: "from-indigo-500/0 via-indigo-300/25 to-indigo-500/0", bg: "bg-indigo-800/60", cardBg: "bg-gradient-to-br from-indigo-900 via-blue-800 to-slate-900", btnGradient: "bg-gradient-to-r from-indigo-500 to-blue-500", btnHover: "hover:from-indigo-400 hover:to-blue-400", priceColor: "text-indigo-200", headerBg: "bg-indigo-900", icon: "text-indigo-400", featureText: "text-indigo-100", labelText: "text-indigo-300/70", divider: "border-indigo-600/40", checkColor: "text-indigo-400" },
    8: { accent: "from-fuchsia-400 to-purple-500", glow: "shadow-fuchsia-500/50", text: "text-fuchsia-300", badge: "bg-gradient-to-r from-fuchsia-600 to-purple-500", border: "border-fuchsia-500", ring: "ring-fuchsia-400/30", shimmer: "from-fuchsia-500/0 via-fuchsia-300/25 to-fuchsia-500/0", bg: "bg-fuchsia-800/60", cardBg: "bg-gradient-to-br from-fuchsia-900 via-purple-800 to-pink-900", btnGradient: "bg-gradient-to-r from-fuchsia-500 to-purple-500", btnHover: "hover:from-fuchsia-400 hover:to-purple-400", priceColor: "text-fuchsia-200", headerBg: "bg-fuchsia-900", icon: "text-fuchsia-400", featureText: "text-fuchsia-100", labelText: "text-fuchsia-300/70", divider: "border-fuchsia-600/40", checkColor: "text-fuchsia-400" },
    9: { accent: "from-lime-400 to-green-500", glow: "shadow-lime-500/50", text: "text-lime-300", badge: "bg-gradient-to-r from-lime-600 to-green-500", border: "border-lime-500", ring: "ring-lime-400/30", shimmer: "from-lime-500/0 via-lime-300/25 to-lime-500/0", bg: "bg-lime-800/60", cardBg: "bg-gradient-to-br from-lime-900 via-green-800 to-emerald-900", btnGradient: "bg-gradient-to-r from-lime-500 to-green-500", btnHover: "hover:from-lime-400 hover:to-green-400", priceColor: "text-lime-200", headerBg: "bg-lime-900", icon: "text-lime-400", featureText: "text-lime-100", labelText: "text-lime-300/70", divider: "border-lime-600/40", checkColor: "text-lime-400" },
    10: { accent: "from-yellow-400 to-amber-500", glow: "shadow-yellow-500/50", text: "text-yellow-300", badge: "bg-gradient-to-r from-yellow-600 to-amber-500", border: "border-yellow-500", ring: "ring-yellow-400/30", shimmer: "from-yellow-500/0 via-yellow-300/25 to-yellow-500/0", bg: "bg-yellow-800/60", cardBg: "bg-gradient-to-br from-yellow-900 via-amber-800 to-orange-900", btnGradient: "bg-gradient-to-r from-yellow-500 to-amber-500", btnHover: "hover:from-yellow-400 hover:to-amber-400", priceColor: "text-yellow-200", headerBg: "bg-yellow-900", icon: "text-yellow-400", featureText: "text-yellow-100", labelText: "text-yellow-300/70", divider: "border-yellow-600/40", checkColor: "text-yellow-400" },
    11: { accent: "from-teal-400 to-emerald-500", glow: "shadow-teal-500/50", text: "text-teal-300", badge: "bg-gradient-to-r from-teal-600 to-emerald-500", border: "border-teal-500", ring: "ring-teal-400/30", shimmer: "from-teal-500/0 via-teal-300/25 to-teal-500/0", bg: "bg-teal-800/60", cardBg: "bg-gradient-to-br from-teal-900 via-emerald-800 to-cyan-900", btnGradient: "bg-gradient-to-r from-teal-500 to-emerald-500", btnHover: "hover:from-teal-400 hover:to-emerald-400", priceColor: "text-teal-200", headerBg: "bg-teal-900", icon: "text-teal-400", featureText: "text-teal-100", labelText: "text-teal-300/70", divider: "border-teal-600/40", checkColor: "text-teal-400" },
    12: { accent: "from-pink-400 to-rose-500", glow: "shadow-pink-500/50", text: "text-pink-300", badge: "bg-gradient-to-r from-pink-600 to-rose-500", border: "border-pink-500", ring: "ring-pink-400/30", shimmer: "from-pink-500/0 via-pink-300/25 to-pink-500/0", bg: "bg-pink-800/60", cardBg: "bg-gradient-to-br from-pink-900 via-rose-800 to-red-900", btnGradient: "bg-gradient-to-r from-pink-500 to-rose-500", btnHover: "hover:from-pink-400 hover:to-rose-400", priceColor: "text-pink-200", headerBg: "bg-pink-900", icon: "text-pink-400", featureText: "text-pink-100", labelText: "text-pink-300/70", divider: "border-pink-600/40", checkColor: "text-pink-400" },
    13: { accent: "from-sky-400 to-indigo-500", glow: "shadow-sky-500/50", text: "text-sky-300", badge: "bg-gradient-to-r from-sky-600 to-indigo-500", border: "border-sky-500", ring: "ring-sky-400/30", shimmer: "from-sky-500/0 via-sky-300/25 to-sky-500/0", bg: "bg-sky-800/60", cardBg: "bg-gradient-to-br from-sky-900 via-indigo-800 to-blue-900", btnGradient: "bg-gradient-to-r from-sky-500 to-indigo-500", btnHover: "hover:from-sky-400 hover:to-indigo-400", priceColor: "text-sky-200", headerBg: "bg-sky-900", icon: "text-sky-400", featureText: "text-sky-100", labelText: "text-sky-300/70", divider: "border-sky-600/40", checkColor: "text-sky-400" },
    14: { accent: "from-red-400 to-orange-500", glow: "shadow-red-500/50", text: "text-red-300", badge: "bg-gradient-to-r from-red-600 to-orange-500", border: "border-red-500", ring: "ring-red-400/30", shimmer: "from-red-500/0 via-red-300/25 to-red-500/0", bg: "bg-red-800/60", cardBg: "bg-gradient-to-br from-red-900 via-orange-800 to-amber-900", btnGradient: "bg-gradient-to-r from-red-500 to-orange-500", btnHover: "hover:from-red-400 hover:to-orange-400", priceColor: "text-red-200", headerBg: "bg-red-900", icon: "text-red-400", featureText: "text-red-100", labelText: "text-red-300/70", divider: "border-red-600/40", checkColor: "text-red-400" },
  };
  const tier = Math.max(0, Math.min(14, tierLevel ?? 0));
  return tierStyles[tier] || tierStyles[0];
}

function HousingPlans({ propertyId, onSelectPlan }: { propertyId: string; onSelectPlan: (plan: any) => void }) {
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

  const maxTier = Math.max(...plans.map((p: any) => p.tierLevel ?? 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      data-testid="housing-plans-section"
    >
      <h2 className="text-lg font-bold text-white tracking-wide uppercase mb-4 flex items-center gap-2">
        <Crown className="w-5 h-5 text-amber-500" />
        Housing Plans & Features
      </h2>

      <div className="hidden md:flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10" style={{ scrollbarWidth: "thin" }}>
        {plans.map((plan: any, pi: number) => {
          const style = getTierStyle(plan.tierLevel ?? 0, maxTier);
          const tierNum = plan.tierLevel ?? 0;
          const isTop = tierNum >= maxTier;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: pi * 0.08 }}
              className={cn(
                "rounded-xl border overflow-hidden relative flex flex-col flex-shrink-0",
                plans.length <= 3 ? "flex-1 min-w-[200px]" : "min-w-[220px] w-[260px]",
                style.border, style.cardBg, style.glow
              )}
              data-testid={`plan-card-${plan.id}`}
            >
              <motion.div
                className={cn("absolute inset-0 bg-gradient-to-r pointer-events-none rounded-xl", style.shimmer)}
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
              />
              {plan.isHighlighted && (
                <div className={cn("text-white text-center text-[9px] font-bold uppercase tracking-wider py-1 relative flex items-center justify-center gap-1", style.badge)}>
                  <Sparkles className="h-3 w-3" /> Most Popular
                </div>
              )}
              {isTop && !plan.isHighlighted && (
                <div className={cn("text-white text-center text-[9px] font-bold uppercase tracking-wider py-1 relative flex items-center justify-center gap-1", style.badge)}>
                  <Crown className="h-3 w-3" /> Premium
                </div>
              )}
              <div className="p-3.5 relative flex-1 flex flex-col">
                <h3 className="font-bold text-sm text-white tracking-wide">{plan.name}</h3>
                {plan.tagline && <p className={cn("text-[11px] font-medium italic", style.text)}>{plan.tagline}</p>}
                <div className="flex items-baseline gap-1 mt-1.5 mb-1">
                  <span className={cn("text-xl font-bold", style.priceColor)}>₹{Number(plan.basePrice).toLocaleString("en-IN")}</span>
                  <span className={cn("text-[10px]", style.labelText)}>/ year</span>
                </div>
                <div className={cn("text-[10px] mb-2.5", style.labelText)}>
                  ≈ ₹{Math.round(Number(plan.basePrice) / 12).toLocaleString("en-IN")}/month
                </div>
                {plan.occupancy && (
                  <div className={cn("flex items-center gap-1.5 py-1.5 border-b text-xs", style.divider)}>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", style.bg, style.text)}>{plan.occupancy}</span>
                  </div>
                )}
                <div className="flex-1 space-y-0">
                  {(plan.items || []).map((item: any) => {
                    const val = item.featureValue || `${item.includedQty} ${item.unit}`;
                    const isCredit = val.includes("Credit") || val.includes("credit");
                    const isUnlimited = val.toLowerCase().includes("unlimited");
                    return (
                      <div key={item.id} className={cn("flex items-start gap-1.5 py-1.5 border-b text-xs", style.divider)}>
                        <CheckCircle2 className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", style.checkColor)} />
                        <span className={style.labelText}>{item.label}</span>
                        <span className={cn(
                          "ml-auto font-semibold whitespace-nowrap",
                          isCredit ? "text-emerald-400" : isUnlimited ? style.text : style.featureText
                        )}>{val}</span>
                      </div>
                    );
                  })}
                </div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="mt-3">
                  <Button
                    onClick={() => onSelectPlan(plan)}
                    className={cn(
                      "w-full rounded-lg h-9 font-semibold tracking-wider uppercase text-xs text-white shadow-lg relative overflow-hidden",
                      style.btnGradient, style.btnHover, style.glow
                    )}
                    data-testid={`button-book-plan-${plan.id}`}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-1.5">
                      Explore & Book <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                    <motion.div
                      className={cn("absolute inset-0 bg-gradient-to-r opacity-60", style.shimmer)}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                    />
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="md:hidden space-y-3">
        {plans.map((plan: any, pi: number) => {
          const style = getTierStyle(plan.tierLevel ?? 0, maxTier);
          const tierNum = plan.tierLevel ?? 0;
          const isTop = tierNum >= maxTier;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: pi * 0.1 }}
              className={cn(
                "rounded-xl border overflow-hidden relative",
                style.border, style.cardBg, style.glow
              )}
              data-testid={`plan-card-${plan.id}`}
            >
              <motion.div
                className={cn("absolute inset-0 bg-gradient-to-r pointer-events-none rounded-xl", style.shimmer)}
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
              />
              {plan.isHighlighted && (
                <div className={cn("text-white text-center text-[9px] font-bold uppercase tracking-wider py-1 relative flex items-center justify-center gap-1", style.badge)}>
                  <Sparkles className="h-3 w-3" /> Most Popular
                </div>
              )}
              {isTop && !plan.isHighlighted && (
                <div className={cn("text-white text-center text-[9px] font-bold uppercase tracking-wider py-1 relative flex items-center justify-center gap-1", style.badge)}>
                  <Crown className="h-3 w-3" /> Premium
                </div>
              )}
              <div className="p-3.5 relative">
                <h3 className="font-bold text-sm text-white tracking-wide">{plan.name}</h3>
                {plan.tagline && <p className={cn("text-[11px] font-medium italic", style.text)}>{plan.tagline}</p>}
                <div className="flex items-baseline gap-1 mt-1.5 mb-1">
                  <span className={cn("text-xl font-bold", style.priceColor)}>₹{Number(plan.basePrice).toLocaleString("en-IN")}</span>
                  <span className={cn("text-[10px]", style.labelText)}>/ year</span>
                </div>
                <div className={cn("text-[10px] mb-2", style.labelText)}>
                  ≈ ₹{Math.round(Number(plan.basePrice) / 12).toLocaleString("en-IN")}/month
                </div>
                {plan.occupancy && (
                  <div className={cn("flex items-center gap-1.5 py-1.5 border-b text-xs", style.divider)}>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", style.bg, style.text)}>{plan.occupancy}</span>
                  </div>
                )}
                {(plan.items || []).map((item: any) => {
                  const val = item.featureValue || `${item.includedQty} ${item.unit}`;
                  const isCredit = val.includes("Credit") || val.includes("credit");
                  const isUnlimited = val.toLowerCase().includes("unlimited");
                  return (
                    <div key={item.id} className={cn("flex items-start gap-1.5 py-1.5 border-b text-xs", style.divider)}>
                      <CheckCircle2 className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", style.checkColor)} />
                      <span className={style.labelText}>{item.label}</span>
                      <span className={cn(
                        "ml-auto font-semibold whitespace-nowrap",
                        isCredit ? "text-emerald-400" : isUnlimited ? style.text : style.featureText
                      )}>{val}</span>
                    </div>
                  );
                })}
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-3">
                  <Button
                    onClick={() => onSelectPlan(plan)}
                    className={cn(
                      "w-full rounded-lg h-9 font-semibold tracking-wider uppercase text-xs text-white shadow-lg relative overflow-hidden",
                      style.btnGradient, style.btnHover, style.glow
                    )}
                    data-testid={`button-book-plan-${plan.id}`}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-1.5">
                      Explore & Book <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                    <motion.div
                      className={cn("absolute inset-0 bg-gradient-to-r opacity-60", style.shimmer)}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
                    />
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function PropertyBookingWrapper() {
  return (
    <PropertyBookingErrorBoundary>
      <PropertyBooking />
    </PropertyBookingErrorBoundary>
  );
}

function PropertyBooking() {
  const [, params] = useRoute("/properties/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, token } = useAuth();
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
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [autoDetectedPlan, setAutoDetectedPlan] = useState<any>(null);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [planPickerOptions, setPlanPickerOptions] = useState<any[]>([]);

  const { data: propertyPlansParent = [] } = useQuery({
    queryKey: [`/api/properties/${propertyId}/plans`],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${propertyId}/plans`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!propertyId,
  });

  const handleSelectBed = (bed: any, floor: any, room?: any) => {
    setSelectedBed(bed);
    setSelectedFloor(floor);
    if (room) setSelectedRoom(room);
    if (!selectedPlan && bed.roomTypeId && propertyPlansParent.length > 0) {
      const effectiveRT = getBedSharingRoomType(bed, room || selectedRoom);
      const rtId = effectiveRT?.id || bed.roomTypeId;
      const matchingPlans = propertyPlansParent.filter((p: any) => {
        const linkedRooms: string[] = Array.isArray(p.linkedRoomIds) ? p.linkedRoomIds : [];
        if (linkedRooms.length > 0) {
          return room?.id ? linkedRooms.includes(room.id) : false;
        }
        const allLinked = Array.isArray(p.linkedRoomTypeIds) ? p.linkedRoomTypeIds : (p.roomTypeId ? [p.roomTypeId] : []);
        return allLinked.includes(rtId) || p.roomTypeId === rtId;
      });
      if (matchingPlans.length === 1) {
        setAutoDetectedPlan(matchingPlans[0]);
        setPlanPickerOptions([]);
      } else if (matchingPlans.length > 1) {
        setAutoDetectedPlan(null);
        setPlanPickerOptions(matchingPlans);
        setPlanPickerOpen(true);
      } else {
        setAutoDetectedPlan(null);
        setPlanPickerOptions([]);
      }
    } else if (selectedPlan) {
      setPlanPickerOptions([]);
    }
  };

  const getBedSharingRoomType = (bed: any, room: any) => {
    if (!bed || !property?.roomTypes) return null;
    if (room?.typology && room.typology.includes("+")) {
      const parts = room.typology.split("+").map((p: string) => parseInt(p));
      const sectionIndex = parts.findIndex((_: number, i: number) => {
        const sectionLetter = String.fromCharCode(65 + i);
        return bed.bedNumber?.includes(`${room.roomNumber}${sectionLetter}`);
      });
      if (sectionIndex >= 0) {
        const sectionBedCount = parts[sectionIndex];
        const maxSection = Math.max(...parts);
        const baseRoomType = property.roomTypes.find((r: any) => r.id === bed.roomTypeId);
        if (sectionBedCount === maxSection) {
          return baseRoomType || null;
        }
        const matchByOccupancy = property.roomTypes.find((r: any) =>
          r.id !== bed.roomTypeId && (r.occupancy === sectionBedCount || r.occupancy === sectionBedCount)
        );
        if (matchByOccupancy) return matchByOccupancy;
        const nameMap: Record<number, string> = { 1: "single", 2: "double", 3: "triple", 4: "quad" };
        const targetName = nameMap[sectionBedCount];
        if (targetName) {
          const matchByName = property.roomTypes.find((r: any) =>
            r.id !== bed.roomTypeId && (
              r.name?.toLowerCase() === targetName ||
              r.customName?.toLowerCase()?.includes(targetName)
            )
          );
          if (matchByName) return matchByName;
        }
        return baseRoomType || null;
      }
    }
    return property.roomTypes.find((r: any) => r.id === bed.roomTypeId) || null;
  };

  const scrollToFloors = () => {
    setTimeout(() => {
      if (floorSectionRef.current) {
        const el = floorSectionRef.current;
        const top = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }, 300);
  };

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setAutoDetectedPlan(null);
    toast({
      title: `${plan.name} selected`,
      description: "Now select a bed to complete your booking with this plan.",
    });
    scrollToFloors();
  };

  const effectivePlan = selectedPlan || autoDetectedPlan;

  const handleBookRoom = (roomTypeId: string, roomName: string, price: number, deposit: number) => {
    if (!property) return;
    const roomData = {
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
      selectedPlanId: effectivePlan?.id || null,
      selectedPlanName: effectivePlan?.name || null,
    };
    localStorage.setItem("selected_room", JSON.stringify(roomData));
    if (!token && !user) {
      localStorage.setItem("post_login_redirect", "/booking/generate");
      toast({ title: "Sign in required", description: "Please sign in to proceed with your booking." });
      window.location.href = "/login";
      return;
    }
    navigate("/booking/generate");
  };

  const getMatchingPlansForBed = useCallback((bed: any, room: any) => {
    if (!bed?.roomTypeId || !property?.roomTypes || propertyPlansParent.length === 0) return [];
    const effectiveRT = getBedSharingRoomType(bed, room);
    const rtId = effectiveRT?.id || bed.roomTypeId;
    return propertyPlansParent.filter((p: any) => {
      const linkedRooms: string[] = Array.isArray(p.linkedRoomIds) ? p.linkedRoomIds : [];
      if (linkedRooms.length > 0) {
        return room?.id ? linkedRooms.includes(room.id) : false;
      }
      const allLinked = Array.isArray(p.linkedRoomTypeIds) ? p.linkedRoomTypeIds : (p.roomTypeId ? [p.roomTypeId] : []);
      return allLinked.includes(rtId) || p.roomTypeId === rtId;
    });
  }, [property, propertyPlansParent]);

  const handleBookSelectedBed = () => {
    if (!selectedBed || !property) return;
    const bedPlans = getMatchingPlansForBed(selectedBed, selectedRoom);
    if (bedPlans.length > 1 && !effectivePlan) {
      setPlanPickerOptions(bedPlans);
      setPlanPickerOpen(true);
      toast({ title: "Please select a plan", description: "This bed has multiple plans available. Choose one to proceed.", variant: "destructive" });
      return;
    }
    const effectiveRoomType = getBedSharingRoomType(selectedBed, selectedRoom) 
      || property.roomTypes?.find((r: any) => r.id === selectedBed.roomTypeId);
    if (!effectiveRoomType) {
      toast({ title: "Room type not found", variant: "destructive" });
      return;
    }
    const planPrice = effectivePlan ? Number(effectivePlan.basePrice || 0) : 0;
    const rtPrice = property.bookingMode === "academic_year"
      ? (effectiveRoomType.academicYearPrice || effectiveRoomType.basePrice * 11)
      : effectiveRoomType.basePrice;
    const price = planPrice > 0 ? planPrice : rtPrice;
    handleBookRoom(
      effectiveRoomType.id,
      effectiveRoomType.customName || effectiveRoomType.name,
      price,
      effectiveRoomType.deposit || 0
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505]">
        <Skeleton className="h-[400px] w-full bg-white/[0.05]" />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-8 w-48 bg-white/[0.05]" />
              <Skeleton className="h-[300px] w-full rounded-xl bg-white/[0.05]" />
              <Skeleton className="h-8 w-48 bg-white/[0.05]" />
              <div className="grid grid-cols-3 gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl bg-white/[0.05]" />)}</div>
            </div>
            <div><Skeleton className="h-[300px] w-full rounded-xl bg-white/[0.05]" /></div>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">Property not found</h2>
          <p className="text-white/50 mt-2">The property you're looking for doesn't exist or has been removed.</p>
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
    <div className="min-h-screen bg-[#050505] relative">
      <ParticleBackground preset="sparse" />
      <div className="relative">
        <ImmersiveTour property={property} onStartBooking={scrollToFloors} />
      </div>

      <div className="relative bg-white/[0.03] backdrop-blur-sm border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <button onClick={() => navigate("/properties")} className="flex items-center gap-1.5 text-white/40 hover:text-amber-400 text-xs mb-2 transition-colors uppercase tracking-wider font-medium" data-testid="button-back">
                <ChevronLeft className="w-3.5 h-3.5" /> All Properties
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight" data-testid="text-property-name">
                  {property.displayName || property.name}
                </h1>
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 uppercase text-[10px] tracking-widest font-bold rounded-md">
                  {property.category}
                </Badge>
              </div>
              <p className="text-white/50 flex items-center gap-1.5 text-sm mt-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                {property.location}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center px-5 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xl font-bold text-amber-400">{lowestPrice > 0 && lowestPrice < Infinity ? `₹${lowestPrice.toLocaleString("en-IN")}` : "—"}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Starting {property.bookingMode === "academic_year" ? "per year" : "per month"}</p>
              </div>
              <div className="text-center px-5 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-xl font-bold text-emerald-400">{availableBeds}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Beds Available</p>
              </div>
              <div className="text-center px-5 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                <p className="text-xl font-bold text-white/80">{property.roomTypes?.length || 0}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Room Types</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-10">
            {property.amenities?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide uppercase mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
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
                      className="flex items-center gap-2.5 px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white/70 hover:border-amber-500/20 hover:bg-amber-500/5 transition-all group"
                    >
                      <div className="w-6 h-6 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                        <Check className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      {am}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <div ref={floorSectionRef} style={{ scrollMarginTop: "80px" }}>
              <h2 className="text-lg font-bold text-white tracking-wide uppercase mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-500" />
                Select Your Floor & Bed
              </h2>
              <FloorBedSelector property={property} onSelectBed={handleSelectBed} filterRoomTypeId={selectedPlan?.roomTypeId || null} autoExpand={selectedPlan?.id || null} selectedPlan={selectedPlan} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white tracking-wide uppercase mb-4 flex items-center gap-2">
                <Bed className="w-5 h-5 text-amber-500" />
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
                    className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 hover:border-amber-500/20 hover:bg-white/[0.05] transition-all group backdrop-blur-sm"
                    data-testid={`room-card-${room.id}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-bold text-lg text-white">{room.customName || room.name}</h4>
                          {room.size && <span className="text-xs bg-white/[0.06] border border-white/[0.08] text-white/50 px-2 py-0.5 rounded-md">{room.size}</span>}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-white/50">
                          <span className="flex items-center gap-1"><Bed className="w-4 h-4 text-amber-500" /> {room.occupancy || 1}-sharing</span>
                          <span className="flex items-center gap-1"><Users className="w-4 h-4 text-amber-500" /> {room.availableBeds}/{room.totalBeds} available</span>
                        </div>
                        {room.availableBeds > 0 && room.availableBeds < 5 && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium rounded-md">
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
                                <div className="text-2xl font-bold text-amber-400">
                                  {displayPrice > 0 ? `₹${displayPrice.toLocaleString("en-IN")}` : "—"}
                                </div>
                                <div className="text-xs text-white/40 uppercase tracking-wider">
                                  {isAcademic ? "per year" : "per month"}
                                </div>
                                {isAcademic && monthlyPrice > 0 && (
                                  <div className="text-xs text-white/30 mt-0.5">
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

            <HousingPlans propertyId={property.id} onSelectPlan={handleSelectPlan} />

            {property.rules && (
              <div>
                <h2 className="text-lg font-bold text-white tracking-wide uppercase mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-500" />
                  Rules & Policies
                </h2>
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 backdrop-blur-sm">
                  <p className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed">{property.rules}</p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/50 overflow-hidden rounded-xl"
              >
                <div className="bg-gradient-to-r from-white/[0.06] to-white/[0.03] p-4 flex items-center justify-between border-b border-white/[0.06]">
                  <h3 className="text-white font-bold tracking-wider uppercase text-sm">Booking Summary</h3>
                  {selectedBed && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] rounded-md">Selected</Badge>
                  )}
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Property</p>
                      <p className="font-semibold text-white text-sm">{property.displayName || property.name}</p>
                    </div>
                  </div>

                  {selectedBed && selectedFloor && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
                      <div className="border-t border-white/[0.06] pt-3 flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                          <Layers className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Floor</p>
                          <p className="font-semibold text-white text-sm">{selectedFloor.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                          <Bed className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Bed</p>
                          <p className="font-semibold text-white text-sm">#{selectedBed.bedNumber}</p>
                        </div>
                      </div>
                      {selectedRoomType && (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center shrink-0">
                              <Home className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Room Type</p>
                              <p className="font-semibold text-white text-sm">{(() => {
                                const rtName = selectedRoomType.customName || selectedRoomType.name;
                                if (selectedRoom?.typology?.includes("+") && selectedRoomType.id !== selectedBed?.roomTypeId) {
                                  return rtName;
                                }
                                const typo = selectedRoom?.typology;
                                if (!typo || typo === "1 Bed" || rtName.includes(typo)) return rtName;
                                return `${rtName}(${typo})`;
                              })()}</p>
                            </div>
                          </div>

                          {effectivePlan && (() => {
                            try {
                            const planTierColors = getBedTierColors(effectivePlan.tierLevel ?? 0);
                            const planPrice = Number(effectivePlan.basePrice || 0);
                            return (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn("border-2 rounded-xl p-3 relative overflow-hidden", planTierColors.roomBorder)}
                                data-testid="summary-active-plan"
                              >
                                <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ background: `linear-gradient(135deg, ${planTierColors.overlay} 0%, transparent 60%)` }} />
                                <div className="relative">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", planTierColors.badgeBg)}>
                                      <Crown className={cn("w-4 h-4", planTierColors.badgeText)} />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-[9px] text-white/40 uppercase tracking-wider font-medium">Active Plan</p>
                                      <p className={cn("font-bold text-sm", planTierColors.text)}>{effectivePlan.name}</p>
                                    </div>
                                    {selectedPlan && (
                                      <button
                                        onClick={() => {
                                          setSelectedPlan(null);
                                          setAutoDetectedPlan(null);
                                          if (selectedBed) {
                                            const bedPlans = getMatchingPlansForBed(selectedBed, selectedRoom);
                                            if (bedPlans.length > 1) {
                                              setPlanPickerOptions(bedPlans);
                                              setPlanPickerOpen(true);
                                            }
                                          }
                                        }}
                                        className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                                        data-testid="button-clear-plan"
                                      >
                                        <X className="w-3 h-3 text-white/50" />
                                      </button>
                                    )}
                                  </div>
                                  {effectivePlan.tagline && (
                                    <p className="text-[10px] text-white/40 italic mb-2">{effectivePlan.tagline}</p>
                                  )}
                                  {planPrice > 0 && (
                                    <div className="flex items-baseline gap-1.5 mb-1">
                                      <span className={cn("text-lg font-bold", planTierColors.text)}>₹{planPrice.toLocaleString("en-IN")}</span>
                                      <span className="text-[10px] text-white/40">/ year</span>
                                    </div>
                                  )}
                                  {(effectivePlan.items || []).length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1">
                                      {(effectivePlan.items || []).slice(0, 3).map((item: any) => (
                                        <div key={item.id} className="flex items-center gap-1.5 text-[10px]">
                                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                          <span className="text-white/50">{item.label}: <span className="font-medium text-white/70">{item.featureValue || `${item.includedQty} ${item.unit}`}</span></span>
                                        </div>
                                      ))}
                                      {(effectivePlan.items || []).length > 3 && (
                                        <p className="text-[9px] text-white/30">+{(effectivePlan.items || []).length - 3} more features</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                            } catch (e) { console.error("[PropertyBooking] Plan render error:", e); return null; }
                          })()}

                          <div className={cn(
                            "border-t border-white/[0.06] pt-4 -mx-5 px-5 pb-0 -mb-1 rounded-b-xl",
                            effectivePlan ? "bg-gradient-to-b from-white/[0.03] to-transparent" : "bg-gradient-to-b from-amber-500/5 to-transparent"
                          )}>
                            <div className="flex justify-between items-baseline">
                              <span className="text-white/50 text-sm">Total Price</span>
                              <div className="text-right">
                                {(() => {
                                  try {
                                  const isAcademic = property?.bookingMode === "academic_year";
                                  const planPrice = effectivePlan ? Number(effectivePlan.basePrice || 0) : 0;
                                  const rtAnnualPrice = selectedRoomType?.academicYearPrice || (selectedRoomType?.basePrice ? selectedRoomType.basePrice * 11 : 0);
                                  const rtMonthlyPrice = isAcademic
                                    ? (selectedRoomType?.academicYearPrice ? Math.round(selectedRoomType.academicYearPrice / 11) : selectedRoomType?.basePrice || 0)
                                    : (selectedRoomType?.basePrice || 0);
                                  const showPlanPrice = effectivePlan && planPrice > 0;
                                  const displayPrice = showPlanPrice ? planPrice : (isAcademic ? rtAnnualPrice : rtMonthlyPrice);
                                  const priceLabel = showPlanPrice ? "per year" : (isAcademic ? "per year" : "per month");
                                  const monthlyEquiv = showPlanPrice ? Math.round(planPrice / 12) : (isAcademic && rtMonthlyPrice > 0 ? rtMonthlyPrice : 0);
                                  return (
                                    <>
                                      <span className={cn("text-3xl font-bold", effectivePlan ? "text-white" : "text-amber-400")}>
                                        {displayPrice > 0 ? `₹${displayPrice.toLocaleString("en-IN")}` : "—"}
                                      </span>
                                      <p className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">
                                        {priceLabel}
                                      </p>
                                      {monthlyEquiv > 0 && (
                                        <p className="text-[10px] text-white/30">
                                          ≈ ₹{monthlyEquiv.toLocaleString("en-IN")}/mo
                                        </p>
                                      )}
                                    </>
                                  );
                                  } catch (e) { console.error("[PropertyBooking] Price render error:", e); return <span className="text-white/40">—</span>; }
                                })()}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {planPickerOptions.length > 1 && !effectivePlan && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                          <p className="text-xs font-semibold text-amber-400 mb-2">Multiple plans available for this bed</p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPlanPickerOpen(true)}
                            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            data-testid="button-choose-plan"
                          >
                            <Crown className="w-4 h-4 mr-1.5" /> Choose a Plan
                          </Button>
                        </div>
                      )}
                      <Button onClick={handleBookSelectedBed} className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl h-12 font-semibold tracking-wider uppercase shadow-lg shadow-amber-600/30" data-testid="button-proceed-booking">
                        Proceed to Book <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </motion.div>
                  )}

                  {!selectedBed && (
                    <div className="text-center py-6 border-t border-white/[0.06]">
                      {selectedPlan ? (
                        <div className="space-y-3">
                          <div className="w-14 h-14 bg-amber-500/10 border-2 border-amber-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                            <Bed className="w-7 h-7 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-amber-400">Select a bed to continue</p>
                            <p className="text-xs text-white/30 mt-1">
                              {selectedPlan.roomTypeId
                                ? `Pick a highlighted ${selectedPlan.roomTypeName || ""} bed from the floor above`
                                : "Pick any available bed from the floors above"}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => floorSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                            className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            data-testid="button-scroll-to-beds"
                          >
                            <ArrowRight className="w-3 h-3 mr-1 rotate-[-90deg]" />
                            Scroll to beds
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="w-14 h-14 bg-white/[0.05] rounded-full flex items-center justify-center mx-auto mb-3">
                            <Bed className="w-7 h-7 text-white/20" />
                          </div>
                          <p className="text-sm text-white/40 font-medium">No bed selected</p>
                          <p className="text-xs text-white/20 mt-1">Select a floor & bed, or choose a room type below</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              <Dialog open={planPickerOpen} onOpenChange={setPlanPickerOpen}>
                <DialogContent className="max-w-md bg-[#0a0a0a] border-white/[0.08]">
                  <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-white">Choose a Plan</DialogTitle>
                    <DialogDescription className="text-sm text-white/50 mt-1">This bed has multiple plans available. Select one to continue.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 mt-2">
                    {[...planPickerOptions]
                      .sort((a: any, b: any) => (a.tierLevel ?? 0) - (b.tierLevel ?? 0))
                      .map((plan: any) => {
                        const colors = getBedTierColors(plan.tierLevel ?? 0);
                        const planPrice = Number(plan.basePrice || 0);
                        const isAcademic = property?.bookingMode === "academic_year";
                        return (
                          <motion.button
                            key={plan.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setSelectedPlan(plan);
                              setAutoDetectedPlan(null);
                              setPlanPickerOpen(false);
                              if (selectedBed && property) {
                                const effectiveRoomType = getBedSharingRoomType(selectedBed, selectedRoom)
                                  || property.roomTypes?.find((r: any) => r.id === selectedBed.roomTypeId);
                                if (effectiveRoomType) {
                                  const planPrice = Number(plan.basePrice || 0);
                                  const rtPrice = property.bookingMode === "academic_year"
                                    ? (effectiveRoomType.academicYearPrice || effectiveRoomType.basePrice * 11)
                                    : effectiveRoomType.basePrice;
                                  const price = planPrice > 0 ? planPrice : rtPrice;
                                  localStorage.setItem("selected_room", JSON.stringify({
                                    propertyId: property.id,
                                    roomTypeId: effectiveRoomType.id,
                                    price,
                                    roomTypeName: effectiveRoomType.customName || effectiveRoomType.name,
                                    propertyName: property.name,
                                    bookingMode: property.bookingMode || "monthly",
                                    deposit: effectiveRoomType.deposit || 0,
                                    bedId: selectedBed.id,
                                    bedNumber: selectedBed.bedNumber,
                                    roomNumber: selectedRoom?.roomNumber || "",
                                    roomId: selectedRoom?.id || "",
                                    floorId: selectedFloor?.id,
                                    floorName: selectedFloor?.name,
                                    roomTypology: selectedRoom?.typology || "",
                                    selectedPlanId: plan.id,
                                    selectedPlanName: plan.name,
                                  }));
                                  navigate("/booking/generate");
                                  return;
                                }
                              }
                              toast({ title: `${plan.name} selected`, description: "Now select a bed to complete your booking." });
                            }}
                            className={cn(
                              "w-full text-left border-2 rounded-xl p-4 transition-all hover:shadow-md relative overflow-hidden bg-white/[0.02]",
                              colors.roomBorder
                            )}
                            data-testid={`plan-picker-${plan.id}`}
                          >
                            <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{ background: `linear-gradient(135deg, ${colors.overlay} 0%, transparent 60%)` }} />
                            <div className="relative flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", colors.badgeBg)}>
                                  <Crown className={cn("w-5 h-5", colors.badgeText)} />
                                </div>
                                <div className="min-w-0">
                                  <p className={cn("font-bold text-sm", colors.text)}>{plan.name}</p>
                                  {plan.tagline && <p className="text-[10px] text-white/40 truncate">{plan.tagline}</p>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {planPrice > 0 && (
                                  <>
                                    <p className={cn("text-lg font-bold", colors.text)}>₹{planPrice.toLocaleString("en-IN")}</p>
                                    <p className="text-[10px] text-white/40">{isAcademic ? "per year" : "per month"}</p>
                                  </>
                                )}
                              </div>
                            </div>
                            {(plan.items || []).length > 0 && (
                              <div className="mt-2 pt-2 border-t border-white/[0.06] flex flex-wrap gap-x-3 gap-y-1">
                                {(plan.items || []).slice(0, 4).map((item: any) => (
                                  <span key={item.id} className="text-[10px] text-white/50 flex items-center gap-1">
                                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                    {item.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </motion.button>
                        );
                      })}
                  </div>
                </DialogContent>
              </Dialog>

              <div className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] rounded-xl p-5 space-y-3">
                <h4 className="font-bold text-xs tracking-wider uppercase text-white">Contact Property</h4>
                {property.phone && (
                  <a href={`tel:${property.phone}`} className="flex items-center gap-2.5 text-sm text-white/50 hover:text-amber-400 transition-colors">
                    <Phone className="w-4 h-4" /> {property.phone}
                  </a>
                )}
                {property.email && (
                  <a href={`mailto:${property.email}`} className="flex items-center gap-2.5 text-sm text-white/50 hover:text-amber-400 transition-colors">
                    <Mail className="w-4 h-4" /> {property.email}
                  </a>
                )}
                {property.mapsUrl && (
                  <a href={property.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors">
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
