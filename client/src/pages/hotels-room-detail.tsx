import { Link, useRoute } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, MapPin, Wifi, Coffee, Tv, Bath, Bed, Users, Star, Calendar } from "lucide-react";

interface RoomType {
  id: string;
  name: string;
  customName?: string | null;
  basePrice: number;
  occupancy?: number | null;
  imageUrl?: string | null;
  size?: string | null;
  deposit?: number | null;
}

interface PropertyDetail {
  id: string;
  name: string;
  slug?: string | null;
  displayName?: string | null;
  category?: string | null;
  location: string;
  address?: string | null;
  city?: string | null;
  imageUrl?: string | null;
  amenities?: string[];
  highlights?: string[] | null;
  roomTypes?: RoomType[];
  galleryImages?: { id: string; imageUrl: string; caption?: string }[];
}

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1600&q=80";

const AMENITY_ICONS: Record<string, any> = {
  wifi: Wifi, "wi-fi": Wifi, internet: Wifi,
  breakfast: Coffee, coffee: Coffee, dining: Coffee,
  tv: Tv, television: Tv, "smart tv": Tv,
  bath: Bath, bathroom: Bath, shower: Bath,
};

function amenityIcon(name: string) {
  const key = name.toLowerCase();
  for (const [k, Icon] of Object.entries(AMENITY_ICONS)) {
    if (key.includes(k)) return Icon;
  }
  return Star;
}

export default function HotelsRoomDetail() {
  const [, params] = useRoute("/hotels/rooms/:slug");
  const slug = params?.slug;
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null);

  const { data: property, isLoading } = useQuery<PropertyDetail>({
    queryKey: [`/api/properties/${slug}`],
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="pt-32 pb-24 px-6 min-h-screen flex items-center justify-center" data-testid="hotel-detail-loading">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!property || property.category !== "hotel") {
    return (
      <div className="pt-32 pb-24 px-6 min-h-screen text-center" data-testid="hotel-detail-not-found">
        <h2 className="hotels-display text-white text-4xl mb-6">Hotel not found</h2>
        <Link href="/hotels/rooms" className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to all rooms
        </Link>
      </div>
    );
  }

  const heroImg = property.imageUrl || FALLBACK_IMAGE;
  const rooms = property.roomTypes || [];
  const selectedRoom = rooms.find((r) => r.id === selectedRoomTypeId) || rooms[0];

  return (
    <div className="pt-24 pb-24 min-h-screen" data-testid="hotels-room-detail-page">
      {/* Hero */}
      <section className="relative h-[60vh] min-h-[460px] overflow-hidden">
        <img src={heroImg} alt={property.name} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,10,10,0.4) 0%, rgba(10,10,10,0.85) 100%)" }} />
        <div className="relative z-10 container mx-auto px-6 h-full flex flex-col justify-end pb-12">
          <Link href="/hotels/rooms" className="text-white/60 hover:text-white text-xs uppercase tracking-widest mb-6 inline-flex items-center gap-2 self-start" data-testid="link-back-rooms">
            <ArrowLeft className="w-3 h-3" /> All Rooms
          </Link>
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] mb-3" style={{ color: "#c5a059" }}>
            <MapPin className="w-3 h-3" /> {property.location}{property.city ? ` · ${property.city}` : ""}
          </p>
          <h1 className="hotels-display text-white text-5xl md:text-7xl mb-4" data-testid="text-property-name">
            {property.displayName || property.name}
          </h1>
          {property.address && (
            <p className="text-white/60 max-w-2xl">{property.address}</p>
          )}
        </div>
      </section>

      <div className="container mx-auto px-6 mt-16 grid lg:grid-cols-3 gap-12">
        {/* Left col: room types + amenities */}
        <div className="lg:col-span-2 space-y-16">
          {/* Room types */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] mb-4" style={{ color: "#c5a059" }}>◇ Choose Your Room</p>
            <h2 className="hotels-heading text-white text-3xl mb-8">Available Rooms</h2>
            {rooms.length === 0 ? (
              <p className="text-white/40">No room types listed yet for this property.</p>
            ) : (
              <div className="space-y-4" data-testid="room-types-list">
                {rooms.map((rt) => {
                  const isSelected = (selectedRoom?.id || rooms[0].id) === rt.id;
                  return (
                    <button
                      key={rt.id}
                      onClick={() => setSelectedRoomTypeId(rt.id)}
                      className={`w-full text-left p-6 transition-all border ${isSelected ? "border-amber-500/60 bg-amber-500/[0.03]" : "border-white/10 hover:border-white/20"}`}
                      data-testid={`button-select-room-${rt.id}`}
                    >
                      <div className="flex items-start justify-between gap-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="hotels-heading text-xl text-white">{rt.customName || rt.name}</h3>
                            {isSelected && (
                              <span className="text-[10px] uppercase tracking-widest text-black px-2 py-0.5" style={{ backgroundColor: "#c5a059" }}>Selected</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-white/50 mb-3">
                            <span className="flex items-center gap-1.5"><Bed className="w-3.5 h-3.5" /> {rt.name}</span>
                            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Sleeps {rt.occupancy ?? 2}</span>
                            {rt.size && <span>{rt.size}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-2xl font-bold text-white">₹{rt.basePrice.toLocaleString("en-IN")}</div>
                          <div className="text-[10px] uppercase tracking-widest text-white/40">/ night</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Amenities */}
          {property.amenities && property.amenities.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] mb-4" style={{ color: "#c5a059" }}>◇ Amenities</p>
              <h2 className="hotels-heading text-white text-3xl mb-8">What's Included</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {property.amenities.map((a) => {
                  const Icon = amenityIcon(a);
                  return (
                    <div key={a} className="flex items-center gap-3 p-4 border border-white/10" data-testid={`amenity-${a.toLowerCase().replace(/\s+/g, "-")}`}>
                      <Icon className="w-4 h-4 shrink-0" style={{ color: "#c5a059" }} />
                      <span className="text-sm text-white/80">{a}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Highlights */}
          {property.highlights && property.highlights.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] mb-4" style={{ color: "#c5a059" }}>◇ Highlights</p>
              <ul className="space-y-3 text-white/70">
                {property.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Star className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#c5a059" }} />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right col: sticky reserve card */}
        <aside className="lg:sticky lg:top-28 self-start">
          <div
            className="p-8"
            style={{
              background: "var(--hotels-glass-bg, rgba(255,255,255,0.03))",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(197,160,89,0.2)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
            }}
            data-testid="reserve-card"
          >
            <p className="text-[10px] uppercase tracking-[0.3em] mb-2" style={{ color: "#c5a059" }}>From</p>
            <div className="text-4xl font-black text-white mb-1">
              ₹{(selectedRoom?.basePrice || rooms[0]?.basePrice || 0).toLocaleString("en-IN")}
            </div>
            <p className="text-white/40 text-xs uppercase tracking-widest mb-8">per night</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { icon: Calendar, label: "Check In", value: "Add" },
                { icon: Calendar, label: "Check Out", value: "Add" },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="p-3 border border-white/10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3 h-3" style={{ color: "#c5a059" }} />
                      <span className="text-[9px] uppercase tracking-widest text-white/50">{f.label}</span>
                    </div>
                    <div className="text-sm text-white/80">{f.value}</div>
                  </div>
                );
              })}
            </div>

            <Link
              href={`/properties/${property.slug || property.id}`}
              className="block w-full py-4 text-center text-black uppercase text-xs tracking-[0.3em] font-semibold transition-all hover:scale-[1.02]"
              style={{ backgroundColor: "#c5a059" }}
              data-testid="button-reserve-now"
            >
              Reserve Now <ArrowRight className="w-4 h-4 inline ml-2" />
            </Link>

            <p className="mt-4 text-center text-[11px] text-white/40">
              You'll complete dates, guest info, and payment on the next step.
            </p>

            {selectedRoom?.deposit && selectedRoom.deposit > 0 && (
              <div className="mt-6 pt-6 border-t border-white/10 flex justify-between text-sm">
                <span className="text-white/50">Refundable Deposit</span>
                <span className="text-white">₹{selectedRoom.deposit.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>

          <div className="mt-6 p-6 border border-white/10 text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Need Help?</p>
            <p className="text-white text-sm mb-1">+91 98765 43210</p>
            <p className="text-white/50 text-xs">support@hsquareliving.com</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
