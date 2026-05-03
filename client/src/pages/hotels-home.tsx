import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Play, Star, MapPin, Wifi, Coffee, Sparkles, Calendar, Users, Mail, Phone, Clock, Search } from "lucide-react";

/* Cinematic looping background for the hero. CDN-hosted MP4
   (autoplay-friendly: muted + playsInline + loop). Falls back to
   a luxury hotel poster image while the video loads. */
const STUDIO_HERO_VIDEO = "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4";
const STUDIO_HERO_POSTER = "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2400&q=80";

/* Press credits shown in the hero "Featured by" bar. Real luxury
   hospitality benchmarks — italic Instrument Serif, restrained spacing. */
const STUDIO_PRESS = ["Condé Nast Traveler", "Travel + Leisure", "Vogue", "Forbes Travel Guide", "Tatler"];

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
  const [, navigate] = useLocation();

  // Booking quick-search state
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [checkIn, setCheckIn] = useState<string>(today);
  const [checkOut, setCheckOut] = useState<string>(tomorrow);
  const [guests, setGuests] = useState<number>(2);
  const [searchLocation, setSearchLocation] = useState<string>("all");

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

  const hotelLocations = useMemo(() => {
    const set = new Set<string>();
    hotels.forEach((h) => h.location && set.add(h.location));
    return Array.from(set);
  }, [hotels]);

  const handleBookingSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (searchLocation && searchLocation !== "all") params.set("location", searchLocation);
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    if (guests) params.set("guests", String(guests));
    const qs = params.toString();
    navigate(qs ? `/hotels/rooms?${qs}` : "/hotels/rooms");
  };
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

  /* The functional booking quick-search bar shown inside the hero.
     Real inputs that submit to /hotels/rooms with query params for
     location/dates/guests. */
  const bookingBar = (
        <form
          onSubmit={handleBookingSearch}
          className="absolute left-1/2 -translate-x-1/2 bottom-12 sm:bottom-16 lg:bottom-20 z-30 w-full max-w-6xl px-4 sm:px-6"
          data-testid="hero-booking-bar"
        >
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-px overflow-hidden rounded-sm"
            style={{
              background: "rgba(197,160,89,0.4)",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              border: "1px solid rgba(197,160,89,0.45)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            }}
          >
            {/* Check In */}
            <label className="flex flex-col justify-center px-5 py-3.5 min-h-[78px] bg-black/85 hover:bg-black/75 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-1.5">
                <Calendar className="w-3 h-3" style={{ color: "#c5a059" }} />
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">Check In</span>
              </div>
              <input
                type="date"
                value={checkIn}
                min={today}
                onChange={(e) => setCheckIn(e.target.value)}
                className="w-full bg-transparent text-sm text-white font-medium outline-none cursor-pointer [color-scheme:dark]"
                data-testid="input-checkin"
              />
            </label>
            <label className="flex flex-col justify-center px-5 py-3.5 min-h-[78px] bg-black/85 hover:bg-black/75 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-1.5">
                <Calendar className="w-3 h-3" style={{ color: "#c5a059" }} />
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">Check Out</span>
              </div>
              <input
                type="date"
                value={checkOut}
                min={checkIn || today}
                onChange={(e) => setCheckOut(e.target.value)}
                className="w-full bg-transparent text-sm text-white font-medium outline-none cursor-pointer [color-scheme:dark]"
                data-testid="input-checkout"
              />
            </label>
            <label className="flex flex-col justify-center px-5 py-3.5 min-h-[78px] bg-black/85 hover:bg-black/75 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-1.5">
                <Users className="w-3 h-3" style={{ color: "#c5a059" }} />
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">Guests</span>
              </div>
              <select
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="w-full bg-transparent text-sm text-white font-medium outline-none cursor-pointer appearance-none"
                data-testid="select-guests"
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n} className="bg-black text-white">
                    {n} {n === 1 ? "Adult" : "Adults"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col justify-center px-5 py-3.5 min-h-[78px] bg-black/85 hover:bg-black/75 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-1.5">
                <MapPin className="w-3 h-3" style={{ color: "#c5a059" }} />
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">Location</span>
              </div>
              <select
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                className="w-full bg-transparent text-sm text-white font-medium outline-none cursor-pointer appearance-none truncate"
                data-testid="select-location"
              >
                <option value="all" className="bg-black text-white">Any Location</option>
                {hotelLocations.map((loc) => (
                  <option key={loc} value={loc} className="bg-black text-white">
                    {loc}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="w-full lg:w-auto min-h-[78px] px-8 py-4 text-black font-semibold text-xs uppercase tracking-[0.25em] inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#c5a059" }}
              data-testid="button-search-rooms"
            >
              <Search className="w-4 h-4" />
              <span>Search</span>
            </button>
          </div>
        </form>
  );

  /* Cinematic hero — video bg, liquid-glass pills, italic Instrument
     Serif headline, and a "Featured by" press bar. Used for both Day
     and Night themes. (Originally the studio-theme variant; restored
     as the only hero per user request.) */
  const classicHero = (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black"
      data-testid="hotels-hero"
    >
      {/* Cinematic video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        poster={STUDIO_HERO_POSTER}
        className="absolute inset-0 w-full h-full object-cover z-0"
        data-testid="video-studio-hero"
      >
        <source src={STUDIO_HERO_VIDEO} type="video/mp4" />
      </video>
      {/* Vignette + bottom-fade for legible over-image text */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.85) 100%)",
        }}
      />
      <div
        className="absolute left-0 right-0 bottom-0 h-72 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, transparent, var(--hotels-page-bg, #050505))" }}
      />

      <div className="relative z-20 container mx-auto px-4 sm:px-6 pt-32 pb-[28rem] sm:pb-[30rem] lg:pb-72 text-center">
        <div className="hotels-fade-in flex flex-col items-center">
          {/* Liquid-glass badge pill */}
          <div
            className="liquid-glass inline-flex items-center gap-2 rounded-full px-1.5 py-1 mb-6 sm:mb-8"
            data-testid="badge-studio-eyebrow"
          >
            <span className="bg-white text-black rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
              New
            </span>
            <span className="px-3 text-[12px] sm:text-[13px] text-white/85" style={{ fontFamily: '"Barlow", sans-serif' }}>
              Introducing AI-curated stays
            </span>
          </div>

          <h1
            className="hotels-display text-white text-5xl sm:text-7xl md:text-8xl lg:text-[7.5rem] xl:text-[9rem] mb-6 max-w-5xl"
            data-testid="text-hotel-headline"
          >
            The stay your{" "}
            <span style={{ color: "#c5a059" }}>story</span>
            <br />
            deserves
          </h1>
          <p
            className="text-white/75 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed"
            style={{ fontFamily: '"Barlow", sans-serif', fontWeight: 300 }}
          >
            Cinematic interiors. Effortless service. Quietly refined hospitality —
            reimagined for the way you travel today.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <Link
              href="/hotels/rooms"
              className="liquid-glass-strong inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-white text-[12px] uppercase tracking-[0.22em] font-medium hover:scale-[1.03] transition-transform"
              data-testid="button-hero-reserve"
            >
              Reserve Your Stay <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              href="/hotels/experience"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-white/90 hover:text-white text-[12px] uppercase tracking-[0.22em] font-medium transition-colors"
              data-testid="button-hero-watch-film"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Watch the Film
            </Link>
          </div>

          {/* Featured-by press bar — Instrument Serif italic credits */}
          <div className="mt-16 sm:mt-20 flex flex-col items-center gap-5 sm:gap-6" data-testid="studio-press-bar">
            <div className="liquid-glass inline-flex items-center rounded-full px-4 py-1.5">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/70" style={{ fontFamily: '"Barlow", sans-serif' }}>
                Featured by
              </span>
            </div>
            <div
              className="flex flex-wrap items-center justify-center gap-x-10 sm:gap-x-14 gap-y-3"
              style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic" }}
            >
              {STUDIO_PRESS.map((name) => (
                <span
                  key={name}
                  className="text-xl sm:text-2xl md:text-3xl text-white/80"
                  data-testid={`text-press-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {bookingBar}
    </section>
  );

  return (
    <div data-testid="hotels-home-page">
      {classicHero}

      {/* EXPERIENCE / SPLIT */}
      <section id="experience" className="py-16 md:py-24 lg:py-32 px-4 sm:px-6" data-testid="section-experience">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 md:gap-16 lg:gap-24 items-center">
            <div className="relative">
              <div className="aspect-[4/5] overflow-hidden">
                <img src={EXPERIENCE_IMAGE} alt="Experience" className="w-full h-full object-cover" loading="lazy" />
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
              className="hotels-glass-btn group relative inline-flex items-center gap-3 px-12 py-5 text-[11px] uppercase tracking-[0.32em] font-medium overflow-hidden"
              data-testid="button-view-all-rooms"
            >
              <span className="hotels-glass-btn__shine" aria-hidden />
              <span className="relative z-10">View All Rooms</span>
              <ArrowRight className="relative z-10 w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" />
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

      {/* CONTACT */}
      <section id="contact" className="py-16 md:py-24 lg:py-32 px-4 sm:px-6" data-testid="section-contact">
        <div className="container mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-4 sm:mb-6" style={{ color: "#c5a059" }}>
              ◇ Get in Touch ◇
            </p>
            <h2 className="hotels-display text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-4 sm:mb-6">
              Let's <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>connect</span>
            </h2>
            <p className="text-white/50 max-w-xl mx-auto font-light text-sm sm:text-base">
              Our concierge team is available around the clock to plan your stay, arrange transfers, or
              answer any question — big or small.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            <a
              href="mailto:support@hsquareliving.com"
              className="p-6 sm:p-8 border border-white/10 hover:border-amber-500/30 transition-colors group"
              style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}
              data-testid="contact-email"
            >
              <Mail className="w-6 h-6 mb-4" style={{ color: "#c5a059" }} />
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Email</p>
              <p className="text-white text-base sm:text-lg break-all group-hover:text-amber-300 transition-colors">
                support@hsquareliving.com
              </p>
            </a>

            <a
              href="tel:+919876543210"
              className="p-6 sm:p-8 border border-white/10 hover:border-amber-500/30 transition-colors group"
              style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}
              data-testid="contact-phone"
            >
              <Phone className="w-6 h-6 mb-4" style={{ color: "#c5a059" }} />
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Phone</p>
              <p className="text-white text-base sm:text-lg group-hover:text-amber-300 transition-colors">
                +91 98765 43210
              </p>
            </a>

            <div
              className="p-6 sm:p-8 border border-white/10 sm:col-span-2 lg:col-span-1"
              style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}
              data-testid="contact-address"
            >
              <MapPin className="w-6 h-6 mb-4" style={{ color: "#c5a059" }} />
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Visit</p>
              <p className="text-white text-base sm:text-lg leading-relaxed">
                Mumbai, India
              </p>
              <p className="text-white/50 text-xs mt-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Concierge available 24/7
              </p>
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
