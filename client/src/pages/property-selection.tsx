import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, Wifi, Wind, Shield, Car, Coffee, Utensils, Dumbbell, Tv, Droplets, ChevronRight, Bed, Users, SlidersHorizontal, X, Building2, IndianRupee } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getProperties } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import propertyExterior from "@/assets/property-exterior.png";

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
    <Card className="overflow-hidden border-none shadow-lg">
      <Skeleton className="h-56 w-full" />
      <CardContent className="p-6 space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex justify-between items-center pt-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function AmenityChip({ name }: { name: string }) {
  const Icon = amenityIcons[name] || Shield;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 text-primary/80 rounded-full text-xs font-medium border border-primary/10 hover:bg-primary/10 transition-colors">
      <Icon className="w-3 h-3" />
      {name}
    </span>
  );
}

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
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadProperties();
  }, []);

  // Track property view for lead analytics
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
        // Silent fail - don't interrupt user experience
        console.error("Failed to track property view:", error);
      }
    }
  };

  // Handle property selection with tracking
  const handlePropertySelect = (property: any) => {
    setSelectedProperty(property);
    trackPropertyView(property);
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
    let result = [...properties];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.location.toLowerCase().includes(query) ||
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
        const minA = getLowestPrice(a.roomTypes, a.bookingMode);
        const minB = getLowestPrice(b.roomTypes, b.bookingMode);
        const effectiveA = a.bookingMode === "academic_year" ? minA / 12 : minA;
        const effectiveB = b.bookingMode === "academic_year" ? minB / 12 : minB;
        return effectiveA - effectiveB;
      });
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => {
        const minA = getLowestPrice(a.roomTypes, a.bookingMode);
        const minB = getLowestPrice(b.roomTypes, b.bookingMode);
        const effectiveA = a.bookingMode === "academic_year" ? minA / 12 : minA;
        const effectiveB = b.bookingMode === "academic_year" ? minB / 12 : minB;
        return effectiveB - effectiveA;
      });
    } else if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [properties, searchQuery, priceFilter, roomTypeFilter, sortBy]);

  const handleSelectRoom = (propId: string, roomId: string, price: number, roomName: string, propName: string, bookingMode: string, deposit: number = 0) => {
    localStorage.setItem("selected_room", JSON.stringify({ propId, roomId, price, roomName, propName, bookingMode, deposit }));
    setLocation("/payment-plans");
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
      const prices = roomTypes.map((r) => r.academicYearPrice || r.basePrice * 12).filter((p) => p > 0);
      return prices.length > 0 ? Math.min(...prices) : 0;
    }
    return Math.min(...roomTypes.map((r) => r.basePrice).filter((p) => p > 0));
  };

  const clearFilters = () => {
    setSearchQuery("");
    setPriceFilter("all");
    setRoomTypeFilter("all");
    setSortBy("default");
  };

  const hasActiveFilters = searchQuery || priceFilter !== "all" || roomTypeFilter !== "all" || sortBy !== "default";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="bg-primary/5 border-b border-primary/10">
        <div className="container mx-auto px-4 py-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-primary mb-4">
              Find Your Perfect Stay
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Discover premium student accommodations with world-class amenities and comfortable living spaces.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-8 max-w-4xl mx-auto"
          >
            <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search by property name or location..."
                    className="pl-12 h-12 text-base border-gray-200 focus:border-primary"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-property"
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-12 px-6 gap-2"
                  onClick={() => setShowFilters(!showFilters)}
                  data-testid="button-toggle-filters"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-1 w-2 h-2 bg-primary rounded-full" />
                  )}
                </Button>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-4 mt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">Price Range</label>
                        <Select value={priceFilter} onValueChange={setPriceFilter}>
                          <SelectTrigger data-testid="select-price-filter">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRICE_RANGES.map((range) => (
                              <SelectItem key={range.value} value={range.value}>
                                {range.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">Room Type</label>
                        <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                          <SelectTrigger data-testid="select-room-type-filter">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROOM_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">Sort By</label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                          <SelectTrigger data-testid="select-sort-by">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SORT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {hasActiveFilters && (
                      <div className="mt-4 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
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

      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <PropertyCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Building2 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-muted-foreground mb-2">No properties found</h3>
            <p className="text-muted-foreground mb-6">Try adjusting your search or filter criteria</p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear all filters
              </Button>
            )}
          </motion.div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-8">
              <p className="text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{filteredProperties.length}</span> {filteredProperties.length === 1 ? "property" : "properties"}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredProperties.map((prop, index) => {
                const availability = getAvailabilityStatus(prop.roomTypes);
                const lowestPrice = getLowestPrice(prop.roomTypes, prop.bookingMode);
                const displayAmenities = prop.amenities?.slice(0, 6) || [];

                return (
                  <motion.div
                    key={prop.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -8 }}
                    className="group"
                  >
                    <Card 
                      className="overflow-hidden border-none shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer h-full flex flex-col"
                      onClick={() => handlePropertySelect(prop)}
                      data-testid={`property-card-${prop.id}`}
                    >
                      <div className="relative h-56 overflow-hidden">
                        <img
                          src={prop.imageUrl || propertyExterior}
                          alt={prop.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        
                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full text-sm font-medium text-gray-700 shadow-sm">
                            <MapPin className="w-4 h-4 text-primary" />
                            {prop.location}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm ${
                            prop.bookingMode === "academic_year" 
                              ? "bg-purple-500 text-white" 
                              : "bg-blue-500 text-white"
                          }`}>
                            {prop.bookingMode === "academic_year" ? "Academic Year" : "Monthly"}
                          </span>
                        </div>

                        <div className="absolute top-4 right-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                            availability.available 
                              ? "bg-green-500 text-white" 
                              : "bg-red-500 text-white"
                          }`}>
                            {availability.text}
                          </span>
                        </div>

                        <div className="absolute bottom-4 left-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-white/70 text-sm">from</span>
                            <span className="text-white text-2xl font-bold">₹{lowestPrice.toLocaleString()}</span>
                            <span className="text-white/70 text-sm">
                              {prop.bookingMode === "academic_year" ? "/year" : "/month"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <CardContent className="p-6 flex-1 flex flex-col">
                        <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-primary transition-colors">
                          {prop.name}
                        </h3>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {displayAmenities.map((am: string) => (
                            <AmenityChip key={am} name={am} />
                          ))}
                          {prop.amenities?.length > 6 && (
                            <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                              +{prop.amenities.length - 6} more
                            </span>
                          )}
                        </div>

                        <div className="mt-auto pt-4 border-t flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Bed className="w-4 h-4" />
                            <span>{prop.roomTypes?.length || 0} room types</span>
                          </div>
                          <Button 
                            size="sm" 
                            className="gap-1 group-hover:gap-2 transition-all"
                            data-testid={`button-view-rooms-${prop.id}`}
                          >
                            View Rooms <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedProperty(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative h-64 md:h-80">
                <img
                  src={selectedProperty.imageUrl || propertyExterior}
                  alt={selectedProperty.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="absolute top-4 right-4 p-2 bg-white/90 rounded-full hover:bg-white transition-colors"
                  data-testid="button-close-property-detail"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
                    <MapPin className="w-4 h-4" />
                    {selectedProperty.location}
                    <span className={`ml-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      selectedProperty.bookingMode === "academic_year" 
                        ? "bg-purple-500 text-white" 
                        : "bg-blue-500 text-white"
                    }`}>
                      {selectedProperty.bookingMode === "academic_year" ? "Academic Year Booking" : "Monthly Booking"}
                    </span>
                  </div>
                  <h2 className="text-3xl font-bold text-white">{selectedProperty.name}</h2>
                </div>
              </div>

              <div className="p-6 md:p-8">
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProperty.amenities?.map((am: string) => (
                      <AmenityChip key={am} name={am} />
                    ))}
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">Available Rooms</h3>
                  <div className="space-y-4">
                    {selectedProperty.roomTypes?.map((room: any) => (
                      <div
                        key={room.id}
                        className="border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Bed className="w-4 h-4 text-primary" />
                            <span className="font-semibold text-lg">{room.name}</span>
                            {room.size && (
                              <Badge variant="secondary" className="text-xs">{room.size}</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {room.availableBeds} of {room.totalBeds} beds available
                          </div>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary">
                              ₹{selectedProperty.bookingMode === "academic_year" 
                                ? (room.academicYearPrice || room.basePrice * 12).toLocaleString()
                                : room.basePrice.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {selectedProperty.bookingMode === "academic_year" ? "/year" : "/month"}
                            </div>
                            {room.deposit > 0 && (
                              <div className="text-xs text-muted-foreground">+ ₹{room.deposit.toLocaleString()} deposit</div>
                            )}
                          </div>
                          <Button
                            onClick={() => handleSelectRoom(
                              selectedProperty.id,
                              room.id,
                              selectedProperty.bookingMode === "academic_year" 
                                ? (room.academicYearPrice || room.basePrice * 12)
                                : room.basePrice,
                              room.name,
                              selectedProperty.name,
                              selectedProperty.bookingMode || "monthly",
                              room.deposit || 0
                            )}
                            disabled={room.availableBeds === 0}
                            className="flex-1 sm:flex-none"
                            data-testid={`button-book-room-${room.id}`}
                          >
                            {room.availableBeds === 0 ? "Sold Out" : "Book Now"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedProperty.rules && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">Property Rules</h3>
                    <p className="text-muted-foreground text-sm whitespace-pre-line">
                      {selectedProperty.rules}
                    </p>
                  </div>
                )}

                {selectedProperty.address && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-4">Location</h3>
                    <p className="text-muted-foreground text-sm mb-3">{selectedProperty.address}</p>
                    {selectedProperty.mapsUrl && (
                      <a
                        href={selectedProperty.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-sm hover:underline inline-flex items-center gap-1"
                      >
                        <MapPin className="w-4 h-4" /> View on Google Maps
                      </a>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
                  <Button variant="outline" className="flex-1" onClick={() => setSelectedProperty(null)}>
                    Close
                  </Button>
                  <Button className="flex-1" onClick={() => {
                    if (selectedProperty.phone) {
                      window.open(`tel:${selectedProperty.phone}`, "_self");
                    }
                  }}>
                    Request Callback
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
