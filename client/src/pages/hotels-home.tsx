import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Star, MapPin, Wifi, Coffee, Sparkles, Calendar, Users } from "lucide-react";

interface Property {
  id: string;
  name: string;
  slug?: string | null;
  displayName?: string | null;
  category?: string | null;
  location: string;
  imageUrl?: string | null;
  amenities?: string[];
  highlights?: string[] | null;
  roomTypes?: { id: string; name: string; basePrice: number; imageUrl?: string | null }[];
}

const HERO_IMAGE = "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2400&q=80";
const EXPERIENCE_IMAGE = "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1600&q=80";
const DINING_IMAGE = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80";

const FALLBACK_ROOMS = [
  {
    id: "fallback-1",
    name: "Deluxe Suite",
    propertyName: "Hsquare Goregaon",
    image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
    price: 8500,
    elevated: false,
  },
  {
    id: "fallback-2",
    name: "Signature King",
    propertyName: "Hsquare Andheri",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
    price: 12500,
    elevated: true,
  },
  {
    id: "fallback-3",
    name: "Garden View",
    propertyName: "Hsquare Juhu",
    image: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80",
    price: 9200,
    elevated: false,
  },
];

export default function HotelsHome() {
  const heroRef = useRef<HTMLDivElement>(null);
  const [parallax, setParallax] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setParallax(Math.min(y * 0.4, 200));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { data: allProperties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const hotels = allProperties.filter((p) => p.category === "hotel");
  const featuredRooms = hotels
    .flatMap((p) =>
      (p.roomTypes || []).slice(0, 1).map((rt) => ({
        id: `${p.id}::${rt.id}`,
        name: rt.name,
        propertyName: p.displayName || p.name,
        image: rt.imageUrl || p.imageUrl || FALLBACK_ROOMS[0].image,
        price: rt.basePrice,
        propertySlug: p.slug || p.id,
      }))
    )
    .slice(0, 3);

  const displayRooms = featuredRooms.length >= 3
    ? featuredRooms.map((r, i) => ({ ...r, elevated: i === 1 }))
    : FALLBACK_ROOMS;

  return (
    <div data-testid="hotels-home-page">
      {/* HERO */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        data-testid="hotels-hero"
      >
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${HERO_IMAGE})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            transform: `translateY(${parallax}px) scale(1.1)`,
            willChange: "transform",
          }}
        />
        <div
          className="absolute inset-0 z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.4) 35%, rgba(10,10,10,0.85) 100%)",
          }}
        />

        <div className="relative z-20 container mx-auto px-4 sm:px-6 pt-24 pb-16 text-center">
          <div className="hotels-fade-in">
            <p
              className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-4 sm:mb-6"
              style={{ color: "#c5a059" }}
              data-testid="text-hotel-tagline"
            >
              ◇ Beyond Exceptional Hospitality ◇
            </p>
            <h1 className="hotels-display text-white text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl mb-6 sm:mb-8" data-testid="text-hotel-headline">
              A New Chapter
              <br />
              <span style={{ fontStyle: "italic", fontWeight: 300, color: "#c5a059" }}>of Luxury</span>
            </h1>
            <p className="text-white/70 text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 sm:mb-12 font-light leading-relaxed px-2">
              Curated stays for travellers who value craft, calm, and detail. Step into a sanctuary designed
              around you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
              <Link
                href="/hotels/rooms"
                className="w-full sm:w-auto px-8 sm:px-10 py-4 text-black uppercase text-xs tracking-[0.25em] sm:tracking-[0.3em] font-semibold transition-all duration-300 hover:scale-[1.05] inline-flex items-center justify-center gap-3"
                style={{ backgroundColor: "#c5a059", boxShadow: "0 12px 36px rgba(197,160,89,0.4)" }}
                data-testid="button-hero-reserve"
              >
                Reserve Your Stay <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#experience"
                className="w-full sm:w-auto px-8 sm:px-10 py-4 uppercase text-xs tracking-[0.25em] sm:tracking-[0.3em] text-white border border-white/30 hover:bg-white/5 transition-colors text-center"
                data-testid="button-hero-discover"
              >
                Discover More
              </a>
            </div>
          </div>
        </div>

      </section>

      {/* Booking quick-search bar — sits BELOW the hero so it never overlaps the
          Reserve / Discover buttons. Each field is a real Link to /hotels/rooms
          so clicking any of them takes you to the search page. */}
      <div className="container mx-auto px-4 sm:px-6 -mt-8 sm:-mt-12 mb-8 relative z-30">
        <div
          className="grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden"
          style={{
            background: "var(--hotels-glass-bg, rgba(255,255,255,0.06))",
            backdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid rgba(197,160,89,0.25)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          }}
          data-testid="hero-booking-bar"
        >
          {[
            { icon: Calendar, label: "Check In", value: "Add Date" },
            { icon: Calendar, label: "Check Out", value: "Add Date" },
            { icon: Users, label: "Guests", value: "2 Adults" },
            { icon: MapPin, label: "Property", value: "Any Location" },
          ].map((field) => {
            const Icon = field.icon;
            return (
              <Link
                key={field.label}
                href="/hotels/rooms"
                className="block px-5 py-4 bg-black/30 hover:bg-black/40 transition-colors cursor-pointer"
                data-testid={`booking-bar-${field.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3 h-3" style={{ color: "#c5a059" }} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">{field.label}</span>
                </div>
                <div className="text-sm text-white/90 font-medium">{field.value}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* EXPERIENCE / SPLIT */}
      <section id="experience" className="py-16 md:py-24 lg:py-32 px-4 sm:px-6" data-testid="section-experience">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 md:gap-16 lg:gap-24 items-center">
            <div className="relative">
              <div className="aspect-[4/5] overflow-hidden">
                <img src={EXPERIENCE_IMAGE} alt="Experience" className="w-full h-full object-cover" loading="lazy" />
              </div>
              <div
                className="absolute -bottom-6 -right-4 sm:-bottom-8 sm:-right-8 px-5 py-4 sm:px-8 sm:py-6"
                style={{ backgroundColor: "#c5a059" }}
              >
                <div className="text-black">
                  <div className="text-3xl sm:text-4xl font-black">15+</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] mt-1">Years of Craft</div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-4 sm:mb-6" style={{ color: "#c5a059" }}>
                ◇ The Experience
              </p>
              <h2 className="hotels-display text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 sm:mb-8">
                Where Every <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>Detail</span>
                <br />
                Speaks Louder
              </h2>
              <p className="text-white/60 text-base sm:text-lg leading-relaxed mb-8 sm:mb-10 font-light">
                From the moment you arrive, every corner whispers intention. Hand-finished joinery, calm tonal
                palettes, slow-poured coffees, and rooms with a view that invites you to stay a little longer.
              </p>
              <div className="grid grid-cols-2 gap-6 sm:gap-8">
                {[
                  { icon: Sparkles, title: "Bespoke Service", desc: "24/7 attentive concierge" },
                  { icon: Coffee, title: "Curated Dining", desc: "Seasonal kitchen, slow coffee" },
                  { icon: Wifi, title: "Effortless Stay", desc: "Hyper-fast wifi, smart rooms" },
                  { icon: Star, title: "Award-Winning", desc: "Top 5 boutique stays in Mumbai" },
                ].map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.title} className="border-l border-white/10 pl-4">
                      <Icon className="w-5 h-5 mb-3" style={{ color: "#c5a059" }} />
                      <h4 className="text-white font-semibold text-sm mb-1">{f.title}</h4>
                      <p className="text-white/50 text-xs">{f.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED ROOMS */}
      <section className="py-16 md:py-24 lg:py-32 px-4 sm:px-6" style={{ backgroundColor: "var(--hotels-section-bg, #080808)" }} data-testid="section-rooms">
        <div className="container mx-auto">
          <div className="text-center mb-12 md:mb-16 lg:mb-24">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-4 sm:mb-6" style={{ color: "#c5a059" }}>
              ◇ Rooms & Suites ◇
            </p>
            <h2 className="hotels-display text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
              Sanctuary, <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>elevated</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-6 items-end">
            {displayRooms.map((room, idx) => {
              const elevated = (room as any).elevated;
              const propertySlug = (room as any).propertySlug;
              return (
                <div
                  key={room.id}
                  className={`group relative ${elevated ? "md:-mt-12" : ""}`}
                  data-testid={`card-featured-room-${idx}`}
                >
                  <Link href={propertySlug ? `/hotels/rooms/${propertySlug}` : "/hotels/rooms"}>
                    <div className="relative aspect-[3/4] overflow-hidden">
                      <img
                        src={room.image}
                        alt={room.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                      />
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.85) 100%)",
                        }}
                      />
                      <div className="absolute top-5 right-5 px-3 py-1 text-[10px] uppercase tracking-widest text-black font-semibold" style={{ backgroundColor: "#c5a059" }}>
                        {elevated ? "Signature" : "Available"}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-6">
                        <p className="text-[10px] uppercase tracking-[0.25em] text-white/50 mb-2">
                          {(room as any).propertyName}
                        </p>
                        <h3 className="hotels-heading text-2xl text-white mb-3">{room.name}</h3>
                        <div className="flex items-end justify-between">
                          <div>
                            <span className="text-[10px] uppercase tracking-widest text-white/40">From</span>
                            <div className="text-2xl text-white font-bold">
                              ₹{room.price.toLocaleString("en-IN")}
                              <span className="text-xs text-white/50 font-normal ml-1">/ night</span>
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" style={{ color: "#c5a059" }} />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-center">
            <Link
              href="/hotels/rooms"
              className="inline-flex items-center gap-3 px-10 py-4 text-xs uppercase tracking-[0.3em] text-white border border-white/30 hover:bg-white/5 transition-colors font-medium"
              data-testid="button-view-all-rooms"
            >
              View All Rooms <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* DINING / SECONDARY VISUAL */}
      <section id="dining" className="py-16 md:py-24 lg:py-32 px-4 sm:px-6" data-testid="section-dining">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-5 gap-12 md:gap-16 items-center">
            <div className="lg:col-span-2 lg:order-2">
              <div className="aspect-[4/5] overflow-hidden">
                <img src={DINING_IMAGE} alt="Dining" className="w-full h-full object-cover" loading="lazy" />
              </div>
            </div>
            <div className="lg:col-span-3 lg:order-1">
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-4 sm:mb-6" style={{ color: "#c5a059" }}>
                ◇ Dining
              </p>
              <h2 className="hotels-display text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 sm:mb-8">
                A kitchen that
                <br />
                <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>knows the season</span>
              </h2>
              <p className="text-white/60 text-base sm:text-lg leading-relaxed mb-8 font-light max-w-xl">
                Slow breakfasts, all-day kitchens, and evening cocktails crafted in-house by chefs who source
                from the closest farms. Reservations open daily.
              </p>
              <div className="flex gap-6 text-sm">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-white mb-1">7AM</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Breakfast Opens</div>
                </div>
                <div className="border-l border-white/10 pl-6">
                  <div className="text-2xl sm:text-3xl font-bold text-white mb-1">11PM</div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Bar Closes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MASSIVE CTA */}
      <section className="relative py-20 md:py-28 lg:py-32 px-4 sm:px-6 overflow-hidden" style={{ backgroundColor: "var(--hotels-section-bg, #080808)" }} data-testid="section-cta">
        <h2
          className="hotels-display absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-white/[0.03] pointer-events-none select-none"
          style={{ fontSize: "clamp(60px, 18vw, 280px)", lineHeight: 0.8 }}
          aria-hidden
        >
          HSQUARE
        </h2>
        <div className="relative z-10 container mx-auto text-center">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-6 sm:mb-8" style={{ color: "#c5a059" }}>
            ◇ Begin Your Stay ◇
          </p>
          <h2 className="hotels-display text-white text-4xl sm:text-5xl md:text-6xl lg:text-8xl mb-8 sm:mb-10">
            Reserve in
            <br />
            <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>under a minute</span>
          </h2>
          <Link
            href="/hotels/rooms"
            className="inline-flex items-center gap-3 px-8 sm:px-12 py-4 sm:py-5 text-black uppercase text-xs tracking-[0.25em] sm:tracking-[0.3em] font-semibold transition-all duration-300 hover:scale-[1.05]"
            style={{ backgroundColor: "#c5a059", boxShadow: "0 16px 48px rgba(197,160,89,0.4)" }}
            data-testid="button-cta-reserve"
          >
            Reserve Your Stay <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
