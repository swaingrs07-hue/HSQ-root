import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Play, Star, MapPin, Wifi, Coffee, Sparkles, Calendar, Users, Mail, Phone, Clock, Search, Zap, BarChart3, Shield, Quote } from "lucide-react";
import { ScrollReactSequence } from "@/components/scroll-react-sequence";

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
  /* Glassmorphism booking card — lives in the right column of the hero
     grid. 2x2 grid of fields (Check In / Check Out / Guests / Location)
     plus a full-width gold Search button. */
  const bookingBar = (
        <form
          onSubmit={handleBookingSearch}
          className="w-full max-w-md lg:max-w-lg ml-auto"
          data-testid="hero-booking-bar"
        >
          <div
            className="rounded-2xl p-5 sm:p-6 backdrop-blur-2xl"
            style={{
              background: "rgba(15,15,15,0.45)",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow:
                "0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <div className="mb-4 sm:mb-5">
              <span
                className="text-[10px] uppercase tracking-[0.3em]"
                style={{ color: "#c5a059", fontFamily: '"Barlow", sans-serif' }}
              >
                Reserve Your Stay
              </span>
              <h3
                className="hotels-display text-white text-2xl sm:text-3xl mt-1"
                data-testid="text-booking-card-title"
              >
                Plan your escape
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Check In */}
              <label
                className="flex flex-col justify-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3 h-3" style={{ color: "#c5a059" }} />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/60">Check In</span>
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
              {/* Check Out */}
              <label
                className="flex flex-col justify-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3 h-3" style={{ color: "#c5a059" }} />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/60">Check Out</span>
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
              {/* Guests */}
              <label
                className="flex flex-col justify-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3 h-3" style={{ color: "#c5a059" }} />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/60">Guests</span>
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
              {/* Location */}
              <label
                className="flex flex-col justify-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3 h-3" style={{ color: "#c5a059" }} />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-white/60">Location</span>
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
            </div>

            <button
              type="submit"
              className="mt-4 w-full min-h-[52px] px-6 py-3.5 rounded-lg text-black font-semibold text-xs uppercase tracking-[0.25em] inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#c5a059" }}
              data-testid="button-search-rooms"
            >
              <Search className="w-4 h-4" />
              <span>Search Stays</span>
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

      <div className="relative z-20 container mx-auto px-4 sm:px-6 pt-24 sm:pt-32 pb-20 lg:pb-32">
        <div className="hotels-fade-in grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-12 items-center">
          {/* LEFT: headline + subhead + CTAs */}
          <div className="text-center lg:text-left flex flex-col items-center lg:items-start">
            <h1
              className="hotels-display text-white text-[2.5rem] leading-[1] sm:text-6xl md:text-7xl lg:text-[6rem] xl:text-[7.5rem] mb-5 sm:mb-6 max-w-3xl px-2 lg:px-0"
              data-testid="text-hotel-headline"
            >
              The stay your{" "}
              <span style={{ color: "#c5a059" }}>story</span>
              <br />
              deserves
            </h1>
            <p
              className="text-white/75 text-sm sm:text-base md:text-lg max-w-xs sm:max-w-xl mb-6 sm:mb-8 leading-relaxed px-2 lg:px-0"
              style={{ fontFamily: '"Barlow", sans-serif', fontWeight: 300 }}
            >
              Cinematic interiors. Effortless service. Quietly refined hospitality —
              reimagined for the way you travel today.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start items-stretch sm:items-center w-full sm:w-auto px-4 sm:px-0">
              <Link
                href="/hotels/rooms"
                className="liquid-glass-strong inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-white text-[11px] sm:text-[12px] uppercase tracking-[0.22em] font-medium hover:scale-[1.03] transition-transform"
                data-testid="button-hero-reserve"
              >
                Reserve Your Stay <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link
                href="/hotels/experience"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-white/90 hover:text-white text-[11px] sm:text-[12px] uppercase tracking-[0.22em] font-medium transition-colors"
                data-testid="button-hero-watch-film"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Watch the Film
              </Link>
            </div>

            {/* Featured-by press bar — Instrument Serif italic credits.
                Hidden on small phones to keep the hero clean. */}
            <div className="hidden sm:flex mt-10 lg:mt-14 flex-col items-center lg:items-start gap-4 sm:gap-5" data-testid="studio-press-bar">
              <div className="liquid-glass inline-flex items-center rounded-full px-4 py-1.5">
                <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/70" style={{ fontFamily: '"Barlow", sans-serif' }}>
                  Featured by
                </span>
              </div>
              <div
                className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 sm:gap-x-8 lg:gap-x-10 gap-y-2 sm:gap-y-3"
                style={{ fontFamily: '"Instrument Serif", serif', fontStyle: "italic" }}
              >
                {STUDIO_PRESS.map((name) => (
                  <span
                    key={name}
                    className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/80 whitespace-nowrap"
                    data-testid={`text-press-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: glassmorphism booking card */}
          <div className="w-full flex justify-center lg:justify-end">
            {bookingBar}
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div data-testid="hotels-home-page">
      {classicHero}

      {/* SCROLL-DRIVEN CINEMATIC FRAME SEQUENCE — sits directly under the hero.
          240 JPGs scrubbed against scroll position. Copy editable by superadmin
          via Admin → Settings → General → "Hotels Cinematic Section". */}
      <ScrollReactSequence />

      {/* HOW IT WORKS — cinematic video background, liquid-glass content */}
      <section
        id="experience"
        className="relative py-24 md:py-32 lg:py-40 px-4 sm:px-6 overflow-hidden"
        data-testid="section-experience"
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          poster={STUDIO_HERO_POSTER}
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-60"
        >
          <source src={STUDIO_HERO_VIDEO} type="video/mp4" />
        </video>
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, var(--hotels-page-bg, #050505) 0%, transparent 18%, transparent 82%, var(--hotels-page-bg, #050505) 100%)",
          }}
        />
        <div className="absolute inset-0 z-10 pointer-events-none bg-black/40" />

        <div className="relative z-20 container mx-auto text-center max-w-4xl">
          <div className="liquid-glass inline-flex items-center rounded-full px-4 py-1.5 mb-6">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/80">
              How It Works
            </span>
          </div>
          <h2 className="hotels-display text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 leading-[0.95]">
            You dream it. <br className="sm:hidden" />
            <span style={{ color: "#c5a059" }}>We host it.</span>
          </h2>
          <p className="text-white/70 text-sm sm:text-base md:text-lg max-w-xl mx-auto mb-8 leading-relaxed font-light px-2">
            Tell us your dates and your taste. Our concierge handles the rest —
            tailored rooms, in-house dining, transfers, and quiet luxury at every
            turn.
          </p>
          <Link
            href="/hotels/rooms"
            className="liquid-glass-strong inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-white text-[12px] uppercase tracking-[0.22em] font-medium hover:scale-[1.03] transition-transform"
            data-testid="button-howitworks-cta"
          >
            Start Your Stay <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* FEATURES CHESS — alternating image/text rows in liquid-glass frames */}
      <section className="py-16 md:py-24 lg:py-32 px-4 sm:px-6" data-testid="section-features-chess">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 md:mb-16">
            <div className="liquid-glass inline-flex items-center rounded-full px-4 py-1.5 mb-5">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/80">
                Capabilities
              </span>
            </div>
            <h2 className="hotels-display text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[0.95]">
              Quiet luxury. <span style={{ color: "#c5a059" }}>Zero compromise.</span>
            </h2>
          </div>

          {/* Row 1: text left, image right */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center mb-12 md:mb-20">
            <div className="order-2 lg:order-1">
              <h3 className="hotels-display text-white text-3xl sm:text-4xl md:text-5xl mb-5 leading-[0.95]">
                Designed to delight. <span style={{ color: "#c5a059" }}>Built to repeat.</span>
              </h3>
              <p className="text-white/65 text-sm sm:text-base mb-7 leading-relaxed font-light">
                Every room is curated, not configured. Hand-finished joinery, calm
                tonal palettes, considered lighting — quiet detail that returns
                guests night after night.
              </p>
              <Link
                href="/hotels/rooms"
                className="liquid-glass-strong inline-flex items-center gap-2 rounded-full px-6 py-3 text-white text-[11px] sm:text-[12px] uppercase tracking-[0.22em] font-medium hover:scale-[1.03] transition-transform"
                data-testid="button-features-row1"
              >
                Explore Rooms <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="liquid-glass rounded-2xl overflow-hidden order-1 lg:order-2">
              <div className="aspect-[4/3]">
                <img
                  src={EXPERIENCE_IMAGE}
                  alt="Curated rooms"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          {/* Row 2: image left, text right */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="liquid-glass rounded-2xl overflow-hidden">
              <div className="aspect-[4/3]">
                <img
                  src={DINING_IMAGE}
                  alt="In-house dining"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div>
              <h3 className="hotels-display text-white text-3xl sm:text-4xl md:text-5xl mb-5 leading-[0.95]">
                A kitchen that <span style={{ color: "#c5a059" }}>knows the season.</span>
              </h3>
              <p className="text-white/65 text-sm sm:text-base mb-7 leading-relaxed font-light">
                Slow breakfasts, all-day kitchens, evening cocktails — crafted
                in-house by chefs who source from the closest farms. Reservations
                open daily, exclusive to in-house guests.
              </p>
              <Link
                href="/hotels/rooms"
                className="liquid-glass-strong inline-flex items-center gap-2 rounded-full px-6 py-3 text-white text-[11px] sm:text-[12px] uppercase tracking-[0.22em] font-medium hover:scale-[1.03] transition-transform"
                data-testid="button-features-row2"
              >
                See the Menu <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED ROOMS */}
      <section className="py-16 md:py-24 lg:py-32 px-4 sm:px-6" style={{ backgroundColor: "var(--hotels-section-bg, #080808)" }} data-testid="section-rooms">
        <div className="container mx-auto">
          <div className="text-center mb-12 md:mb-16 lg:mb-24">
            <div className="liquid-glass inline-flex items-center rounded-full px-4 py-1.5 mb-5">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/80">
                Rooms &amp; Suites
              </span>
            </div>
            <h2 className="hotels-display text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[0.95]">
              Sanctuary, <span style={{ color: "#c5a059" }}>elevated</span>
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

      {/* WHY US — 4 liquid-glass feature cards */}
      <section id="why-us" className="py-16 md:py-24 lg:py-32 px-4 sm:px-6" data-testid="section-why-us">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 md:mb-16">
            <div className="liquid-glass inline-flex items-center rounded-full px-4 py-1.5 mb-5">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/80">
                Why Us
              </span>
            </div>
            <h2 className="hotels-display text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[0.95]">
              The difference is <span style={{ color: "#c5a059" }}>everything.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {[
              { icon: Zap, title: "Days, Not Weeks", desc: "Confirmed in minutes. Checked in on arrival. No friction, no waiting." },
              { icon: Sparkles, title: "Obsessively Crafted", desc: "Every room considered. Every finish refined. Detail you can feel." },
              { icon: BarChart3, title: "Built to Convert", desc: "Returning guests, glowing reviews. Hospitality measured in repeat stays." },
              { icon: Shield, title: "Secure by Default", desc: "Encrypted payments, verified identity, 24/7 on-site staff. Always." },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="liquid-glass rounded-2xl p-6 sm:p-7"
                  data-testid={`card-why-us-${f.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                >
                  <div className="liquid-glass-strong rounded-full w-10 h-10 flex items-center justify-center mb-5">
                    <Icon className="w-4 h-4" style={{ color: "#c5a059" }} />
                  </div>
                  <h4 className="hotels-heading text-white text-xl sm:text-2xl mb-2">{f.title}</h4>
                  <p className="text-white/60 text-xs sm:text-sm leading-relaxed font-light">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* STATS — desaturated cinematic video bg, single liquid-glass card */}
      <section className="relative py-20 md:py-28 lg:py-32 px-4 sm:px-6 overflow-hidden" data-testid="section-stats">
        <video
          autoPlay
          loop
          muted
          playsInline
          poster={STUDIO_HERO_POSTER}
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-40"
          style={{ filter: "saturate(0)" }}
        >
          <source src={STUDIO_HERO_VIDEO} type="video/mp4" />
        </video>
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, var(--hotels-page-bg, #050505) 0%, transparent 22%, transparent 78%, var(--hotels-page-bg, #050505) 100%)",
          }}
        />
        <div className="absolute inset-0 z-10 pointer-events-none bg-black/35" />

        <div className="relative z-20 container mx-auto max-w-6xl">
          <div className="liquid-glass rounded-3xl p-8 sm:p-12 md:p-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6 text-center">
              {[
                { value: "200+", label: "Rooms launched" },
                { value: "98%", label: "Guest satisfaction" },
                { value: "4.9", label: "Average review" },
                { value: "24/7", label: "Concierge on-site" },
              ].map((s) => (
                <div key={s.label} data-testid={`stat-${s.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                  <div className="hotels-display text-white text-4xl sm:text-5xl md:text-6xl mb-2 leading-none" style={{ color: "#c5a059" }}>
                    {s.value}
                  </div>
                  <div className="text-white/60 text-[10px] sm:text-xs uppercase tracking-[0.2em] font-light">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS — 3 liquid-glass cards */}
      <section className="py-16 md:py-24 lg:py-32 px-4 sm:px-6" data-testid="section-testimonials">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 md:mb-16">
            <div className="liquid-glass inline-flex items-center rounded-full px-4 py-1.5 mb-5">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-white/80">
                What They Say
              </span>
            </div>
            <h2 className="hotels-display text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[0.95]">
              Don't take our word <span style={{ color: "#c5a059" }}>for it.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {[
              {
                quote: "Quietly the best stay I've had in Mumbai. The room felt designed for me — not for everyone.",
                name: "Sarah Chen",
                role: "Founder, Luminary",
              },
              {
                quote: "Concierge handled the airport, the dinner reservation, even a last-minute meeting room. Effortless.",
                name: "Marcus Webb",
                role: "Head of Growth, Arcline",
              },
              {
                quote: "It feels less like a hotel and more like a home you didn't know you had. We'll be back.",
                name: "Elena Voss",
                role: "Brand Director, Helix",
              },
            ].map((t, i) => (
              <div
                key={t.name}
                className="liquid-glass rounded-2xl p-7 sm:p-8 flex flex-col"
                data-testid={`card-testimonial-${i}`}
              >
                <Quote className="w-5 h-5 mb-4" style={{ color: "#c5a059" }} />
                <p className="text-white/80 text-sm sm:text-base font-light italic leading-relaxed mb-6 flex-1">
                  {t.quote}
                </p>
                <div>
                  <p className="text-white text-sm font-medium">{t.name}</p>
                  <p className="text-white/50 text-xs font-light">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + FOOTER — cinematic video bg, big italic CTA, footer bar */}
      <section
        className="relative pt-20 md:pt-28 lg:pt-32 pb-10 px-4 sm:px-6 overflow-hidden"
        data-testid="section-cta"
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          poster={STUDIO_HERO_POSTER}
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-50"
        >
          <source src={STUDIO_HERO_VIDEO} type="video/mp4" />
        </video>
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, var(--hotels-page-bg, #050505) 0%, transparent 18%, transparent 65%, var(--hotels-page-bg, #050505) 100%)",
          }}
        />
        <div className="absolute inset-0 z-10 pointer-events-none bg-black/45" />

        {/* Watermark wordmark */}
        <h2
          className="hotels-display absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-white/[0.04] pointer-events-none select-none z-10"
          style={{ fontSize: "clamp(60px, 18vw, 280px)", lineHeight: 0.8 }}
          aria-hidden
        >
          HSQUARE
        </h2>

        <div className="relative z-20 container mx-auto text-center max-w-4xl">
          <h2 className="hotels-display text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 leading-[0.95]">
            Your next stay <br className="sm:hidden" />
            <span style={{ color: "#c5a059" }}>starts here.</span>
          </h2>
          <p className="text-white/70 text-sm sm:text-base md:text-lg max-w-xl mx-auto mb-8 leading-relaxed font-light px-2">
            Pick your room. Pick your dates. We handle the rest. No commitment,
            no pressure — just possibilities.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center px-4 sm:px-0">
            <Link
              href="/hotels/rooms"
              className="liquid-glass-strong inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-white text-[11px] sm:text-[12px] uppercase tracking-[0.22em] font-medium hover:scale-[1.03] transition-transform"
              data-testid="button-cta-reserve"
            >
              Reserve Your Stay <ArrowUpRight className="w-4 h-4" />
            </Link>
            <a
              href="mailto:support@hsquareliving.com"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white text-black px-6 py-3 text-[11px] sm:text-[12px] uppercase tracking-[0.22em] font-medium hover:opacity-90 transition-opacity"
              data-testid="button-cta-contact"
            >
              Talk to Concierge
            </a>
          </div>
        </div>

        {/* Footer bar */}
        <div className="relative z-20 container mx-auto mt-24 sm:mt-32 pt-6 sm:pt-8 border-t border-white/10">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-white/40">
            <p data-testid="text-footer-copy">© 2026 Hsquare Hotels. All rights reserved.</p>
            <div className="flex items-center gap-5 sm:gap-6">
              <a href="mailto:support@hsquareliving.com" className="hover:text-white transition-colors flex items-center gap-1.5" data-testid="link-footer-email">
                <Mail className="w-3 h-3" /> Email
              </a>
              <a href="tel:+919876543210" className="hover:text-white transition-colors flex items-center gap-1.5" data-testid="link-footer-phone">
                <Phone className="w-3 h-3" /> +91 98765 43210
              </a>
              <span className="flex items-center gap-1.5" data-testid="text-footer-location">
                <MapPin className="w-3 h-3" /> Mumbai
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
