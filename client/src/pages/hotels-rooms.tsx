import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin, Search, SlidersHorizontal } from "lucide-react";

interface RoomType {
  id: string;
  name: string;
  customName?: string | null;
  basePrice: number;
  occupancy?: number | null;
  imageUrl?: string | null;
  size?: string | null;
}

interface Property {
  id: string;
  name: string;
  slug?: string | null;
  displayName?: string | null;
  category?: string | null;
  location: string;
  imageUrl?: string | null;
  amenities?: string[];
  roomTypes?: RoomType[];
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80";

export default function HotelsRooms() {
  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState<number>(50000);
  const [location, setLocation] = useState<string>("all");

  const { data: allProperties = [], isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const hotels = useMemo(
    () => allProperties.filter((p) => p.category === "hotel"),
    [allProperties]
  );

  const locations = useMemo(() => {
    const set = new Set<string>();
    hotels.forEach((h) => h.location && set.add(h.location));
    return Array.from(set);
  }, [hotels]);

  const flattenedRooms = useMemo(() => {
    return hotels.flatMap((property) =>
      (property.roomTypes || []).map((rt) => ({
        roomTypeId: rt.id,
        propertyId: property.id,
        propertySlug: property.slug || property.id,
        propertyName: property.displayName || property.name,
        propertyLocation: property.location,
        amenities: property.amenities || [],
        name: rt.customName || rt.name,
        basePrice: rt.basePrice,
        occupancy: rt.occupancy ?? 2,
        size: rt.size,
        image: rt.imageUrl || property.imageUrl || FALLBACK_IMAGE,
      }))
    );
  }, [hotels]);

  const filtered = flattenedRooms.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.propertyName.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (location !== "all" && r.propertyLocation !== location) return false;
    if (r.basePrice > maxPrice) return false;
    return true;
  });

  return (
    <div className="pt-32 pb-24 px-6 min-h-screen" data-testid="hotels-rooms-page">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-16 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] mb-6" style={{ color: "#c5a059" }}>
            ◇ Rooms & Suites ◇
          </p>
          <h1 className="hotels-display text-white text-5xl md:text-7xl mb-6">
            Find your <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>sanctuary</span>
          </h1>
          <p className="text-white/50 max-w-xl mx-auto font-light">
            Browse our collection of curated rooms across Mumbai's finest neighbourhoods.
          </p>
        </div>

        {/* Filter Bar */}
        <div
          className="mb-16 p-5 grid md:grid-cols-[1fr_auto_auto_auto] gap-4 items-center"
          style={{
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(197,160,89,0.15)",
          }}
          data-testid="rooms-filter-bar"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search rooms or properties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-white pl-11 pr-4 py-3 outline-none border border-white/10 focus:border-amber-500/40 placeholder:text-white/30 text-sm"
              data-testid="input-rooms-search"
            />
          </div>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="bg-transparent text-white px-4 py-3 outline-none border border-white/10 text-sm cursor-pointer min-w-[180px]"
            data-testid="select-rooms-location"
          >
            <option value="all" className="bg-black">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc} className="bg-black">{loc}</option>
            ))}
          </select>
          <div className="flex items-center gap-3 text-sm text-white/70 min-w-[200px]">
            <SlidersHorizontal className="w-4 h-4" style={{ color: "#c5a059" }} />
            <span className="text-xs uppercase tracking-widest">Max ₹{maxPrice.toLocaleString("en-IN")}</span>
            <input
              type="range"
              min={1000}
              max={50000}
              step={500}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="flex-1 accent-amber-500"
              data-testid="range-max-price"
            />
          </div>
          <div className="text-xs uppercase tracking-widest text-white/50">
            <span style={{ color: "#c5a059" }}>{filtered.length}</span> rooms
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32 border border-white/10" data-testid="empty-rooms">
            <p className="text-white/40 mb-2 text-lg">No rooms match your search.</p>
            <p className="text-white/30 text-sm">Try adjusting filters or check back soon — new properties are being added.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8" data-testid="rooms-grid">
            {filtered.map((room) => (
              <Link
                key={`${room.propertyId}::${room.roomTypeId}`}
                href={`/hotels/rooms/${room.propertySlug}`}
                className="group relative block"
                data-testid={`card-room-${room.roomTypeId}`}
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.92) 100%)" }}
                  />
                  <div className="absolute top-4 left-4 px-3 py-1.5 text-[10px] uppercase tracking-widest font-semibold text-black"
                       style={{ backgroundColor: "#c5a059" }}>
                    Available
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-6">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/60 mb-3">
                      <MapPin className="w-3 h-3" />
                      {room.propertyName} · {room.propertyLocation}
                    </p>
                    <h3 className="hotels-heading text-2xl text-white mb-1">{room.name}</h3>
                    <p className="text-white/50 text-xs mb-4">
                      Sleeps {room.occupancy} {room.size ? `· ${room.size}` : ""}
                    </p>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-widest text-white/40">From</span>
                        <div className="text-2xl text-white font-bold">
                          ₹{room.basePrice.toLocaleString("en-IN")}
                          <span className="text-xs text-white/50 font-normal ml-1">/ night</span>
                        </div>
                      </div>
                      <div
                        className="w-10 h-10 flex items-center justify-center transition-all group-hover:scale-110"
                        style={{ backgroundColor: "#c5a059" }}
                      >
                        <ArrowRight className="w-4 h-4 text-black" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
