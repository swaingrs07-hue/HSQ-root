import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Wifi, Wind, Shield, Car, Coffee, Utensils, Dumbbell, Tv, Droplets,
  ChevronRight, Bed, Users, X, Building2, IndianRupee, Sparkles, ChevronLeft,
  Star, Heart, Phone, Calendar, Clock, Check, ArrowRight, Filter, Grid3X3, LayoutList,
  Maximize2, Share2, ExternalLink, Award
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { getProperties } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useAuthGuard } from "@/contexts/auth-guard-context";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import propertyExterior from "@/assets/property-exterior.png";
import heroStudentLiving from "@/assets/hero-student-living.png";
import { SmartSearch } from "@/components/smart-search";
import { ParticleBackground } from "@/components/particle-background";
import { ConnectivityShowcase } from "@/components/connectivity-showcase";

const amenityIcons: Record<string, any> = {
  "Free Wifi": Wifi,
  "AC": Wind,
  "24X7 Security": Shield,
  "Free Parking": Car,
  "Coffee Maker": Coffee,
  "Room Service": Utensils,
  "Gym": Dumbbell,
  "LCD TV": Tv,
  "DTH Channels": Tv,
  "Daily Housekeeping": Droplets,
};

const PRICE_RANGES = [
  { label: "All Prices", value: "all" },
  { label: "Under ₹4,000", value: "0-4000" },
  { label: "₹4,000 - ₹5,000", value: "4000-5000" },
  { label: "Above ₹5,000", value: "5000+" },
];

const ROOM_TYPES = [
  { label: "All Room Types", value: "all" },
  { label: "Standard", value: "Standard" },
  { label: "Deluxe", value: "Deluxe" },
  { label: "Suite", value: "Suite" },
];

const SORT_OPTIONS = [
  { label: "Default", value: "default" },
  { label: "Price: Low to High", value: "price-asc" },
  { label: "Price: High to Low", value: "price-desc" },
  { label: "Newest First", value: "newest" },
];

function PropertyCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.08]">
      <Skeleton className="aspect-[4/3] w-full bg-white/[0.05]" />
      <div className="p-6 space-y-3">
        <Skeleton className="h-5 w-3/4 bg-white/[0.05]" />
        <Skeleton className="h-4 w-1/2 bg-white/[0.05]" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 bg-white/[0.05]" />
          <Skeleton className="h-6 w-16 bg-white/[0.05]" />
        </div>
      </div>
    </div>
  );
}

interface NlpSearchResult {
  properties: any[];
  filters: any;
  interpretation: string;
  totalResults: number;
}

function GallerySection({ property, images, galleryIndex, setGalleryIndex }: {
  property: any;
  images: string[];
  galleryIndex: number;
  setGalleryIndex: (fn: number | ((prev: number) => number)) => void;
}) {
  return (
    <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.img
          key={galleryIndex}
          src={images[galleryIndex]}
          alt={property.name}
          className="w-full h-full object-cover"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30" />

      {images.length > 1 && (
        <>
          <button
            onClick={() => setGalleryIndex((prev: number) => prev > 0 ? prev - 1 : images.length - 1)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white/30 transition-all"
            data-testid="button-gallery-prev"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => setGalleryIndex((prev: number) => (prev + 1) % images.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white/30 transition-all"
            data-testid="button-gallery-next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_: string, i: number) => (
              <button
                key={i}
                onClick={() => setGalleryIndex(i)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === galleryIndex ? "w-6 bg-amber-400" : "w-2 bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
        <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
          <MapPin className="w-4 h-4" />
          {property.location}
          <span className="mx-2 text-white/30">|</span>
          <span className={`px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
            property.bookingMode === "academic_year"
              ? "bg-purple-600/80 text-white"
              : "bg-amber-600/80 text-white"
          }`}>
            {property.bookingMode === "academic_year" ? "Academic Year" : "Monthly Booking"}
          </span>
        </div>
        <h2 className="text-3xl md:text-4xl font-heading font-bold text-white tracking-tight">{property.name}</h2>
      </div>
    </div>
  );
}

const DETAIL_TABS = ["Overview", "Rooms", "Amenities", "Location"] as const;
type DetailTab = typeof DETAIL_TABS[number];

export default function PropertySelection() {
  const [, setLocation] = useLocation();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priceFilter, setPriceFilter] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("default");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [nlpSearchResults, setNlpSearchResults] = useState<NlpSearchResult | null>(null);
  const [useNlpSearch, setUseNlpSearch] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>("Overview");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { requireAuth } = useAuthGuard();
  const { isBookingsEnabled } = useFeatureFlags();
  const staffRoles = new Set(["admin", "superadmin", "manager", "staff", "sales_executive", "receptionist", "hotel_admin", "hotel_staff"]);
  const isStaff = !!(user?.role && staffRoles.has(user.role));
  const bookingsPaused = !isBookingsEnabled && !isStaff;
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProperties();
    const savedSearch = sessionStorage.getItem("searchResults");
    if (savedSearch) {
      try {
        const results = JSON.parse(savedSearch);
        setNlpSearchResults(results);
        setUseNlpSearch(true);
        sessionStorage.removeItem("searchResults");
      } catch (e) {
        console.error("Failed to parse search results:", e);
      }
    }
  }, []);

  const trackPropertyView = async (property: any) => {
    if (user?.email) {
      try {
        await fetch("/api/leads/track-property-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            name: user.name,
            propertyId: property.id,
            propertyName: property.name,
          }),
        });
      } catch (error) {
        console.error("Failed to track property view:", error);
      }
    }
  };

  const handlePropertySelect = (property: any) => {
    trackPropertyView(property);
    setLocation(`/properties/${property.slug || property.id}`);
  };

  const closePropertyDetail = () => {
    setSelectedProperty(null);
    document.body.style.overflow = "";
  };

  const loadProperties = async () => {
    try {
      const data = await getProperties();
      setProperties(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load properties",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProperties = useMemo(() => {
    if (useNlpSearch && nlpSearchResults && nlpSearchResults.properties.length > 0) {
      return nlpSearchResults.properties.map(nlpProp => {
        const fullProp = properties.find(p => p.id === nlpProp.id);
        return fullProp || nlpProp;
      }).filter(Boolean);
    }
    let result = [...properties];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.location?.toLowerCase().includes(query) ||
          (p.address && p.address.toLowerCase().includes(query))
      );
    }
    if (priceFilter !== "all") {
      result = result.filter((p) => {
        const minPrice = getLowestPrice(p.roomTypes, p.bookingMode);
        const effectiveMonthlyPrice = p.bookingMode === "academic_year" ? minPrice / 12 : minPrice;
        if (priceFilter === "0-4000") return effectiveMonthlyPrice < 4000;
        if (priceFilter === "4000-5000") return effectiveMonthlyPrice >= 4000 && effectiveMonthlyPrice <= 5000;
        if (priceFilter === "5000+") return effectiveMonthlyPrice > 5000;
        return true;
      });
    }
    if (roomTypeFilter !== "all") {
      result = result.filter((p) =>
        p.roomTypes?.some((r: any) => r.name === roomTypeFilter)
      );
    }
    if (sortBy === "price-asc") {
      result.sort((a, b) => {
        const effectiveA = a.bookingMode === "academic_year" ? getLowestPrice(a.roomTypes, a.bookingMode) / 12 : getLowestPrice(a.roomTypes, a.bookingMode);
        const effectiveB = b.bookingMode === "academic_year" ? getLowestPrice(b.roomTypes, b.bookingMode) / 12 : getLowestPrice(b.roomTypes, b.bookingMode);
        return effectiveA - effectiveB;
      });
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => {
        const effectiveA = a.bookingMode === "academic_year" ? getLowestPrice(a.roomTypes, a.bookingMode) / 12 : getLowestPrice(a.roomTypes, a.bookingMode);
        const effectiveB = b.bookingMode === "academic_year" ? getLowestPrice(b.roomTypes, b.bookingMode) / 12 : getLowestPrice(b.roomTypes, b.bookingMode);
        return effectiveB - effectiveA;
      });
    } else if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return result;
  }, [properties, searchQuery, priceFilter, roomTypeFilter, sortBy, useNlpSearch, nlpSearchResults]);

  const handleSelectRoom = (propId: string, roomId: string, price: number, roomName: string, propName: string, bookingMode: string, deposit: number = 0) => {
    requireAuth(() => {
      localStorage.setItem("selected_room", JSON.stringify({ propId, roomId, price, roomName, propName, bookingMode, deposit }));
      setLocation("/payment-plans");
    }, "book this room");
  };

  const getAvailabilityStatus = (roomTypes: any[]) => {
    if (!roomTypes || roomTypes.length === 0) return { available: false, text: "No rooms" };
    const totalAvailable = roomTypes.reduce((sum, r) => sum + (r.availableBeds || 0), 0);
    if (totalAvailable === 0) return { available: false, text: "Fully Booked" };
    if (totalAvailable < 5) return { available: true, text: `Only ${totalAvailable} left!` };
    return { available: true, text: "Available" };
  };

  const getLowestPrice = (roomTypes: any[], bookingMode: string = "monthly") => {
    if (!roomTypes || roomTypes.length === 0) return 0;
    if (bookingMode === "academic_year") {
      const prices = roomTypes.map((r) => r.academicYearPrice || r.basePrice * 11).filter((p) => p > 0);
      return prices.length > 0 ? Math.min(...prices) : 0;
    }
    const monthlyPrices = roomTypes.map((r) => r.basePrice).filter((p) => p > 0);
    return monthlyPrices.length > 0 ? Math.min(...monthlyPrices) : 0;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setPriceFilter("all");
    setRoomTypeFilter("all");
    setSortBy("default");
  };

  const hasActiveFilters = !!(searchQuery || priceFilter !== "all" || roomTypeFilter !== "all" || sortBy !== "default");

  const getPropertyGalleryImages = (property: any) => {
    const images: string[] = [];
    if (property.imageUrl) images.push(property.imageUrl);
    try {
      if (property.tourOverviewImages) images.push(...JSON.parse(property.tourOverviewImages));
      if (property.tourRoomsImages) images.push(...JSON.parse(property.tourRoomsImages));
      if (property.tourAmenitiesImages) images.push(...JSON.parse(property.tourAmenitiesImages));
    } catch {}
    if (images.length === 0) images.push(propertyExterior);
    return Array.from(new Set(images));
  };

  return (
    <div className="min-h-screen bg-transparent">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .dark-card-glow {
          background: rgba(255,255,255,0.02);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .prop-card-dark {
          background: rgba(255,255,255,0.02);
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .prop-card-dark:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 60px rgba(245,158,11,0.08), 0 8px 24px rgba(0,0,0,0.3);
          border-color: rgba(245,158,11,0.25);
        }
      `}</style>

      <div className="relative overflow-hidden">
        <ParticleBackground preset="hero" className="z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-transparent to-[#050505] z-[2]" />

        <div className="relative z-10 container mx-auto px-4 py-14 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <motion.span 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-sm font-semibold tracking-wider uppercase mb-5 border border-amber-500/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Our Properties
            </motion.span>
            <h1 className="text-5xl md:text-7xl font-heading font-black text-white mb-5 leading-tight" data-testid="heading-properties">
              Find Your{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-amber-400 to-violet-400 bg-clip-text text-transparent">
                Perfect Stay
              </span>
            </h1>
            <div className="w-16 h-1 bg-gradient-to-r from-amber-400 to-amber-600 mx-auto mb-6 rounded-full" />
            <p className="text-white/50 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
              Discover premium student accommodations with world-class amenities and thoughtfully designed living spaces.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-10 max-w-4xl mx-auto"
          >
            <div className="dark-card-glow rounded-2xl p-5 md:p-6">
              <SmartSearch
                onSearchResults={(results) => {
                  setNlpSearchResults(results);
                  setUseNlpSearch(true);
                }}
                placeholder="Search with AI — Try 'rooms under 15000 in Juhu with AC'"
                showFiltersButton={true}
                onFiltersClick={() => setShowFilters(!showFilters)}
                externalFiltersActive={hasActiveFilters}
              />

              {useNlpSearch && nlpSearchResults && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-white/50 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    {nlpSearchResults.interpretation}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUseNlpSearch(false);
                      setNlpSearchResults(null);
                    }}
                    className="text-xs text-white/50 hover:text-white hover:bg-white/[0.05]"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear AI Search
                  </Button>
                </div>
              )}

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 mt-4 border-t border-white/[0.08] grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Price Range</label>
                        <Select value={priceFilter} onValueChange={setPriceFilter}>
                          <SelectTrigger data-testid="select-price-filter" className="border-white/[0.1] bg-white/[0.03] text-white hover:bg-white/[0.05]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1a1a] border-white/[0.1]">
                            {PRICE_RANGES.map((range) => (
                              <SelectItem key={range.value} value={range.value} className="text-white/70 focus:bg-white/[0.08] focus:text-white">{range.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Room Type</label>
                        <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                          <SelectTrigger data-testid="select-room-type-filter" className="border-white/[0.1] bg-white/[0.03] text-white hover:bg-white/[0.05]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1a1a] border-white/[0.1]">
                            {ROOM_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value} className="text-white/70 focus:bg-white/[0.08] focus:text-white">{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 block">Sort By</label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger data-testid="select-sort-by" className="border-white/[0.1] bg-white/[0.03] text-white hover:bg-white/[0.05]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1a1a] border-white/[0.1]">
                            {SORT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="text-white/70 focus:bg-white/[0.08] focus:text-white">{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {hasActiveFilters && (
                      <div className="mt-4 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-white/40 hover:text-white hover:bg-white/[0.05]">
                          <X className="w-4 h-4 mr-1" /> Clear all filters
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {!loading && properties.length >= 2 && (
        <ConnectivityShowcase properties={properties} />
      )}

      <div className="relative container mx-auto px-4 py-12 md:py-20">
        <ParticleBackground preset="sparse" className="z-0" />
        {loading ? (
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative z-10 text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-10 h-10 text-white/20" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No properties found</h3>
            <p className="text-white/40 mb-6">Try adjusting your search or filter criteria</p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="border-white/[0.1] text-white/60 hover:bg-white/[0.05] hover:text-white">
                Clear all filters
              </Button>
            )}
          </motion.div>
        ) : (
          <>
            <div className="relative z-10 flex justify-between items-center mb-8">
              <p className="text-white/40 text-sm">
                Showing <span className="font-semibold text-white">{filteredProperties.length}</span> {filteredProperties.length === 1 ? "property" : "properties"}
              </p>
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProperties.map((prop, index) => {
                const availability = getAvailabilityStatus(prop.roomTypes);
                const lowestPrice = getLowestPrice(prop.roomTypes, prop.bookingMode);
                const displayAmenities = prop.amenities?.slice(0, 4) || [];
                let cardImage = prop.imageUrl;
                if (!cardImage) {
                  try { const imgs = JSON.parse(prop.tourOverviewImages || "[]"); cardImage = imgs[0]; } catch {}
                }

                return (
                  <motion.div
                    key={prop.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08, duration: 0.5 }}
                    className="group cursor-pointer prop-card-dark"
                    onClick={() => handlePropertySelect(prop)}
                    data-testid={`property-card-${prop.id}`}
                  >
                    <div className="relative overflow-hidden rounded-t-[20px]">
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={cardImage || propertyExterior}
                          alt={prop.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                          loading="lazy"
                        />
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                      <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-amber-400" />
                        </div>
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          prop.bookingMode === "academic_year"
                            ? "bg-purple-600/90 text-white backdrop-blur-sm"
                            : "bg-amber-600/90 text-white backdrop-blur-sm"
                        }`}>
                          {prop.bookingMode === "academic_year" ? "Academic Year" : "Monthly"}
                        </span>
                        {(() => {
                          const gp = (prop as any).genderPolicy as
                            | "co-ed"
                            | "male"
                            | "female"
                            | null
                            | undefined;
                          if (!gp) return null;
                          const cfg =
                            gp === "co-ed"
                              ? { label: "Co-ed", cls: "bg-violet-600/90 text-white" }
                              : gp === "male"
                                ? { label: "Boys only", cls: "bg-sky-600/90 text-white" }
                                : gp === "female"
                                  ? { label: "Girls only", cls: "bg-pink-600/90 text-white" }
                                  : null;
                          if (!cfg) return null;
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-sm ${cfg.cls}`}
                              data-testid={`badge-gender-${prop.id}`}
                            >
                              <Users className="w-3 h-3" />
                              {cfg.label}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="absolute top-4 right-4">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-sm ${
                          availability.available
                            ? availability.text.includes("Only") ? "bg-orange-500/90 text-white" : "bg-emerald-600/90 text-white"
                            : "bg-red-600/90 text-white"
                        }`}>
                          {availability.text}
                        </span>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-heading font-bold text-lg text-white group-hover:text-amber-400 transition-colors truncate">
                            {prop.name}
                          </h3>
                          <p className="text-white/30 text-sm flex items-center gap-1.5 mt-1.5">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-cyan-400/60" />
                            <span className="truncate">{prop.location}</span>
                          </p>
                        </div>
                        <div className="text-right ml-3 flex-shrink-0">
                          <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-amber-400 bg-clip-text text-transparent">
                            {lowestPrice > 0 ? `₹${lowestPrice.toLocaleString("en-IN")}` : "—"}
                          </div>
                          <div className="text-xs text-white/30">
                            {prop.bookingMode === "academic_year" ? "per year" : "per month"}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
                        {displayAmenities.map((am: string) => {
                          const Icon = amenityIcons[am] || Shield;
                          return (
                            <span key={am} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-white/40 bg-white/[0.03] rounded-full border border-white/[0.08]">
                              <Icon className="w-3 h-3 text-white/30" />
                              {am}
                            </span>
                          );
                        })}
                        {prop.amenities?.length > 4 && (
                          <span className="px-2.5 py-1 text-xs text-amber-400 bg-amber-500/10 rounded-full border border-amber-500/20 font-medium">
                            +{prop.amenities.length - 4}
                          </span>
                        )}
                      </div>

                      <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-white/30">
                          <Bed className="w-3.5 h-3.5" />
                          <span>{prop.roomTypes?.length || 0} room types</span>
                        </div>
                        <span className="text-amber-400 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                          Explore <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={closePropertyDetail}
          >
            <motion.div
              ref={detailRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-full md:w-[85vw] lg:w-[75vw] xl:w-[65vw] bg-[#0a0a0a] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <GallerySection
                  property={selectedProperty}
                  images={getPropertyGalleryImages(selectedProperty)}
                  galleryIndex={galleryIndex}
                  setGalleryIndex={setGalleryIndex}
                />

                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                  <button
                    onClick={() => setIsLiked(!isLiked)}
                    className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center hover:bg-white/30 transition-all"
                    data-testid="button-like-property"
                  >
                    <Heart className={`w-5 h-5 transition-colors ${isLiked ? "fill-red-500 text-red-500" : "text-white"}`} />
                  </button>
                  <button
                    onClick={closePropertyDetail}
                    className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white/30 transition-all"
                    data-testid="button-close-property-detail"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/[0.08]">
                  <div className="flex items-center px-6 md:px-10">
                    {DETAIL_TABS.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveDetailTab(tab)}
                        className={`px-4 md:px-6 py-4 text-sm font-medium relative transition-colors ${
                          activeDetailTab === tab
                            ? "text-amber-400"
                            : "text-white/40 hover:text-white/60"
                        }`}
                        data-testid={`tab-${tab.toLowerCase()}`}
                      >
                        {tab}
                        {activeDetailTab === tab && (
                          <motion.div
                            layoutId="activeDetailTab"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-6 md:px-10 py-8">
                  <AnimatePresence mode="wait">
                    {activeDetailTab === "Overview" && (
                      <motion.div
                        key="overview"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-8"
                      >
                        <div>
                          <h3 className="text-lg font-heading font-bold text-white mb-3">About This Property</h3>
                          <p className="text-white/50 leading-relaxed font-light">
                            {selectedProperty.description || `Welcome to ${selectedProperty.name}, a premium student accommodation located in the heart of ${selectedProperty.location}. Experience luxury living with top-tier amenities, 24/7 security, and a vibrant community of like-minded students.`}
                          </p>
                        </div>

                        {selectedProperty.highlights && selectedProperty.highlights.length > 0 && (
                          <div>
                            <h3 className="text-lg font-heading font-bold text-white mb-4">Highlights</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {selectedProperty.highlights.map((highlight: string, i: number) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                    <Check className="w-4 h-4 text-amber-400" />
                                  </div>
                                  <span className="text-sm text-white/70">{highlight}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl text-center">
                            <Bed className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                            <div className="text-lg font-bold text-white">{selectedProperty.roomTypes?.length || 0}</div>
                            <div className="text-xs text-white/40 uppercase tracking-wider">Room Types</div>
                          </div>
                          {isStaff && (
                            <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl text-center">
                              <Users className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                              <div className="text-lg font-bold text-white">
                                {selectedProperty.roomTypes?.reduce((sum: number, r: any) => sum + (r.availableBeds || 0), 0) || 0}
                              </div>
                              <div className="text-xs text-white/40 uppercase tracking-wider">Beds Available</div>
                            </div>
                          )}
                          <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl text-center">
                            <Shield className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                            <div className="text-lg font-bold text-white">24/7</div>
                            <div className="text-xs text-white/40 uppercase tracking-wider">Security</div>
                          </div>
                          <div className="p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl text-center">
                            <Award className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                            <div className="text-lg font-bold text-white">4.8</div>
                            <div className="text-xs text-white/40 uppercase tracking-wider">Rating</div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-heading font-bold text-white mb-4">Top Amenities</h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedProperty.amenities?.slice(0, 8).map((am: string) => {
                              const Icon = amenityIcons[am] || Shield;
                              return (
                                <span key={am} className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/[0.08] text-sm text-white/60 hover:border-amber-500/30 hover:bg-amber-500/10 transition-colors cursor-default rounded-lg">
                                  <Icon className="w-4 h-4 text-amber-400" />
                                  {am}
                                </span>
                              );
                            })}
                            {selectedProperty.amenities?.length > 8 && (
                              <button
                                onClick={() => setActiveDetailTab("Amenities")}
                                className="inline-flex items-center gap-1 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 hover:bg-amber-500/20 transition-colors rounded-lg"
                              >
                                +{selectedProperty.amenities.length - 8} more <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {activeDetailTab === "Rooms" && (
                      <motion.div
                        key="rooms"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-heading font-bold text-white">Available Rooms</h3>
                          {isStaff && (
                            <span className="text-sm text-white/40">
                              {selectedProperty.roomTypes?.reduce((sum: number, r: any) => sum + (r.availableBeds || 0), 0) || 0} beds available
                            </span>
                          )}
                        </div>

                        <div className="space-y-4">
                          {selectedProperty.roomTypes?.map((room: any, i: number) => (
                            <motion.div
                              key={room.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300 group"
                              data-testid={`room-card-${room.id}`}
                            >
                              <div className="p-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h4 className="font-heading font-bold text-lg text-white">{room.customName || room.name}</h4>
                                      {room.size && (
                                        <span className="px-2 py-0.5 text-xs bg-white/[0.05] text-white/40 border border-white/[0.08] rounded">{room.size}</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-white/40">
                                      <span className="flex items-center gap-1">
                                        <Bed className="w-4 h-4 text-amber-400" />
                                        {room.occupancy || 1}-sharing
                                      </span>
                                      {isStaff && (
                                        <span className="flex items-center gap-1">
                                          <Users className="w-4 h-4 text-amber-400" />
                                          {room.availableBeds} of {room.totalBeds} available
                                        </span>
                                      )}
                                    </div>

                                    {(() => {
                                      const LOW_STOCK_THRESHOLD = 5;
                                      const isLow = room.availableBeds > 0 && room.availableBeds < LOW_STOCK_THRESHOLD;
                                      if (!isLow) return null;
                                      if (user) {
                                        return (
                                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400 font-medium">
                                            <Clock className="w-3 h-3" />
                                            Only {room.availableBeds} left — Book now!
                                          </div>
                                        );
                                      }
                                      return (
                                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400 font-medium">
                                          <Clock className="w-3 h-3" />
                                          High demand — limited spots remaining
                                        </div>
                                      );
                                    })()}

                                    {room.amenities && room.amenities.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-3">
                                        {room.amenities.slice(0, 5).map((am: string) => (
                                          <span key={am} className="px-2 py-0.5 text-xs text-white/30 bg-white/[0.03] border border-white/[0.06] rounded">{am}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-6 md:flex-col md:items-end md:gap-3">
                                    <div className="text-right">
                                      {(() => {
                                        const isAcademic = selectedProperty.bookingMode === "academic_year";
                                        const annualPrice = room.academicYearPrice || (room.basePrice ? room.basePrice * 11 : 0);
                                        const monthlyPrice = isAcademic
                                          ? (room.academicYearPrice ? Math.round(room.academicYearPrice / 11) : room.basePrice || 0)
                                          : (room.basePrice || 0);
                                        const displayPrice = isAcademic ? annualPrice : monthlyPrice;
                                        return (
                                          <>
                                            <div className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-amber-400 bg-clip-text text-transparent">
                                              {displayPrice > 0 ? `₹${displayPrice.toLocaleString("en-IN")}` : "—"}
                                            </div>
                                            <div className="text-xs text-white/30 uppercase tracking-wider">
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
                                      {room.deposit > 0 && (
                                        <div className="text-xs text-white/30 mt-1">+ ₹{room.deposit.toLocaleString()} deposit</div>
                                      )}
                                    </div>
                                    <Button
                                      onClick={() => {
                                        const isAcademic = selectedProperty.bookingMode === "academic_year";
                                        const price = isAcademic
                                          ? (room.academicYearPrice || (room.basePrice ? room.basePrice * 11 : 0))
                                          : (room.basePrice || 0);
                                        handleSelectRoom(
                                          selectedProperty.id,
                                          room.id,
                                          price,
                                          room.name,
                                          selectedProperty.name,
                                          selectedProperty.bookingMode || "monthly",
                                          room.deposit || 0,
                                        );
                                      }}
                                      disabled={room.availableBeds === 0 || bookingsPaused}
                                      className={bookingsPaused ? "bg-slate-600/60 text-white/50 rounded-lg px-8 h-11 font-semibold tracking-wider uppercase text-sm cursor-not-allowed" : "bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-8 h-11 font-semibold tracking-wider uppercase text-sm"}
                                      data-testid={`button-book-room-${room.id}`}
                                      title={bookingsPaused ? "Online bookings are temporarily paused" : undefined}
                                    >
                                      {room.availableBeds === 0 ? "Sold Out" : bookingsPaused ? "Booking Paused" : "Book Now"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {activeDetailTab === "Amenities" && (
                      <motion.div
                        key="amenities"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <h3 className="text-lg font-heading font-bold text-white">All Amenities</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {selectedProperty.amenities?.map((am: string, i: number) => {
                            const Icon = amenityIcons[am] || Shield;
                            return (
                              <motion.div
                                key={am}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl hover:border-amber-500/30 hover:bg-amber-500/10 transition-all group cursor-default"
                              >
                                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors flex-shrink-0">
                                  <Icon className="w-5 h-5 text-amber-400" />
                                </div>
                                <span className="text-sm text-white/70 font-medium">{am}</span>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}

                    {activeDetailTab === "Location" && (
                      <motion.div
                        key="location"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <h3 className="text-lg font-heading font-bold text-white">Location & Address</h3>
                        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                              <MapPin className="w-6 h-6 text-amber-400" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-white mb-1">{selectedProperty.name}</h4>
                              <p className="text-white/50 text-sm mb-1">{selectedProperty.location}</p>
                              {selectedProperty.address && (
                                <p className="text-white/30 text-sm">{selectedProperty.address}</p>
                              )}
                            </div>
                          </div>
                          {selectedProperty.mapsUrl && (
                            <a
                              href={selectedProperty.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors rounded-lg"
                            >
                              <ExternalLink className="w-4 h-4" />
                              View on Google Maps
                            </a>
                          )}
                        </div>

                        {selectedProperty.rules && (
                          <div>
                            <h3 className="text-lg font-heading font-bold text-white mb-3">Property Rules</h3>
                            <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6">
                              <p className="text-white/50 text-sm whitespace-pre-line leading-relaxed">{selectedProperty.rules}</p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-10 pt-6 border-t border-white/[0.08]">
                    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-white/40 mb-1">Starting from</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-amber-400 bg-clip-text text-transparent">
                            ₹{getLowestPrice(selectedProperty.roomTypes, selectedProperty.bookingMode).toLocaleString()}
                          </span>
                          <span className="text-white/30 text-sm">
                            {selectedProperty.bookingMode === "academic_year" ? "per year" : "per month"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-3 w-full md:w-auto">
                        <Button
                          variant="outline"
                          className="flex-1 md:flex-none rounded-lg h-12 px-6 border-white/[0.1] text-white/60 hover:bg-white/[0.05] hover:text-white"
                          onClick={() => {
                            requireAuth(() => {
                              if (selectedProperty.phone) {
                                window.open(`tel:${selectedProperty.phone}`, "_self");
                              }
                            }, "request a callback");
                          }}
                          data-testid="button-request-callback"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Contact Us
                        </Button>
                        <Button
                          className="flex-1 md:flex-none bg-amber-600 hover:bg-amber-700 text-white rounded-lg h-12 px-8 font-semibold tracking-wider uppercase text-sm"
                          onClick={() => setActiveDetailTab("Rooms")}
                          data-testid="button-view-rooms"
                        >
                          View Rooms <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
