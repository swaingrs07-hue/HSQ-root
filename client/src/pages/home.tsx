import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import heroLobby from "@/assets/hero-lobby.jpg";
import heroRoom from "@/assets/hero-room.jpg";
import heroTerrace from "@/assets/hero-terrace.jpg";
import heroDining from "@/assets/hero-dining.jpg";
import amenityGym from "@/assets/amenity-gym.jpg";
import amenityStudy from "@/assets/amenity-study.jpg";
import heroStudentLiving from "@/assets/hero-student-living.png";
import hsquareLogo from "@assets/Hsquare_Logo_File-07_1771351647884.png";
import {
  ArrowRight, ChevronLeft, ChevronRight, Wifi, Shield, Coffee, Users,
  Play, Star, MapPin, Calendar, Building2, Sparkles, Clock, Phone,
  ChevronDown, Award, Utensils, Dumbbell, BookOpen, Heart, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { PropertyTourModal } from "@/components/property-tour-modal";
import { SmartSearch } from "@/components/smart-search";
import { getProperties } from "@/lib/api";

const DEFAULT_SLIDES = [
  {
    image: heroLobby,
    title: "Experience Premium Living",
    subtitle: "HSQUARELIVING, MUMBAI",
    caption: "Where comfort meets excellence in student accommodation",
  },
  {
    image: heroRoom,
    title: "Luxury Rooms & Suites",
    subtitle: "DESIGNED FOR SUCCESS",
    caption: "Thoughtfully curated spaces for focused living and studying",
  },
  {
    image: heroTerrace,
    title: "Panoramic City Views",
    subtitle: "ROOFTOP LOUNGE",
    caption: "Unwind with breathtaking views after a productive day",
  },
  {
    image: heroDining,
    title: "World-Class Dining",
    subtitle: "CULINARY EXCELLENCE",
    caption: "Nutritious gourmet meals prepared fresh daily",
  },
];

const KEN_BURNS_VARIANTS = [
  { initial: { scale: 1.0, x: "0%", y: "0%" }, animate: { scale: 1.15, x: "-2%", y: "-1%" } },
  { initial: { scale: 1.15, x: "2%", y: "1%" }, animate: { scale: 1.0, x: "0%", y: "0%" } },
  { initial: { scale: 1.0, x: "1%", y: "-1%" }, animate: { scale: 1.12, x: "-1%", y: "1%" } },
  { initial: { scale: 1.1, x: "-1%", y: "0%" }, animate: { scale: 1.0, x: "1%", y: "-1%" } },
];

const ICON_MAP: Record<string, any> = {
  Star, Wifi, Shield, Coffee, Users, Dumbbell, BookOpen, Heart, Utensils,
  Award, Clock, MapPin, Building2, Sparkles, Calendar, Phone,
};

const AMENITY_SHOWCASE = [
  { image: amenityGym, title: "Fitness Center", desc: "State-of-the-art equipment for your wellness journey", icon: Dumbbell },
  { image: amenityStudy, title: "Study Lounge", desc: "Quiet, modern spaces designed for academic excellence", icon: BookOpen },
  { image: heroRoom, title: "Premium Rooms", desc: "Elegantly furnished rooms with premium bedding", icon: Star },
  { image: heroDining, title: "Gourmet Dining", desc: "Chef-prepared meals with diverse cuisine options", icon: Utensils },
];

const STATS = [
  { value: "500+", label: "Happy Residents" },
  { value: "15+", label: "Premium Properties" },
  { value: "98%", label: "Satisfaction Rate" },
  { value: "24/7", label: "Support & Security" },
];

export default function Home() {
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying] = useState(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [heroSlides, setHeroSlides] = useState(DEFAULT_SLIDES);
  const [instagramPosts, setInstagramPosts] = useState<any[]>([]);
  const [igCurrentSlide, setIgCurrentSlide] = useState(0);
  const [igAutoPlaying, setIgAutoPlaying] = useState(true);
  const [footerPhone, setFooterPhone] = useState("+91 6372294625");
  const [dynamicAmenities, setDynamicAmenities] = useState<any[]>([]);
  const [featuredPlans, setFeaturedPlans] = useState<any[]>([]);
  const igInterval = useRef<NodeJS.Timeout | null>(null);
  const [slideDirection, setSlideDirection] = useState(1);
  const slideInterval = useRef<NodeJS.Timeout | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 600], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 600], [1, 1.1]);
  const overlayY = useTransform(scrollY, [0, 400], [0, 100]);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/hero-slides?active=true")
      .then(res => res.ok ? res.json() : [])
      .then((apiSlides: any[]) => {
        if (apiSlides.length > 0) {
          setHeroSlides(apiSlides.map(s => ({
            image: s.imageUrl,
            title: s.title,
            subtitle: s.subtitle || "",
            caption: s.caption || "",
          })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getProperties().then(data => {
      setProperties(data);
      setPropertiesLoading(false);
    }).catch(() => setPropertiesLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/footer-settings")
      .then(res => res.ok ? res.json() : null)
      .then((data: any) => {
        if (data?.phone) setFooterPhone(data.phone);
      })
      .catch(() => {});
    fetch("/api/homepage-amenities")
      .then(res => res.ok ? res.json() : [])
      .then((data: any[]) => {
        if (data.length > 0) setDynamicAmenities(data.filter((a: any) => a.isActive));
      })
      .catch(() => {});
    fetch("/api/plans/featured")
      .then(res => res.ok ? res.json() : [])
      .then((data: any[]) => {
        if (data.length > 0) setFeaturedPlans(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/instagram/posts")
      .then(res => res.ok ? res.json() : [])
      .then((posts: any[]) => {
        if (posts.length > 0) setInstagramPosts(posts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (igAutoPlaying && instagramPosts.length > 1) {
      igInterval.current = setInterval(() => {
        setIgCurrentSlide(prev => (prev + 1) % instagramPosts.length);
      }, 5000);
    }
    return () => {
      if (igInterval.current) clearInterval(igInterval.current);
    };
  }, [igAutoPlaying, instagramPosts.length]);

  const nextSlide = useCallback(() => {
    setSlideDirection(1);
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  }, [heroSlides.length]);

  const prevSlide = useCallback(() => {
    setSlideDirection(-1);
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  }, [heroSlides.length]);

  useEffect(() => {
    if (isAutoPlaying) {
      slideInterval.current = setInterval(nextSlide, 6000);
    }
    return () => {
      if (slideInterval.current) clearInterval(slideInterval.current);
    };
  }, [isAutoPlaying, nextSlide]);

  const handleSearchResults = (results: any) => {
    if (results.totalResults > 0 || results.interpretation) {
      sessionStorage.setItem("searchResults", JSON.stringify(results));
      setLocation("/properties");
    }
  };

  const scrollToContent = () => {
    window.scrollTo({ top: window.innerHeight - 80, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col">
      <section
        ref={heroRef}
        className="relative w-full h-screen overflow-hidden"
        data-testid="hero-section"
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0"
            style={{ scale: heroScale }}
          >
            <motion.img
              src={heroSlides[currentSlide].image}
              alt={heroSlides[currentSlide].title}
              className="w-full h-full object-cover will-change-transform"
              initial={KEN_BURNS_VARIANTS[currentSlide % KEN_BURNS_VARIANTS.length].initial}
              animate={KEN_BURNS_VARIANTS[currentSlide % KEN_BURNS_VARIANTS.length].animate}
              transition={{ duration: 8, ease: "linear" }}
            />
          </motion.div>
        </AnimatePresence>

        <motion.div
          className="absolute inset-0 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.65) 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent z-10" />

        <div className="absolute bottom-28 left-6 md:left-10 z-20 flex items-center gap-3 opacity-30 pointer-events-none select-none" data-testid="hero-watermark">
          <img src={hsquareLogo} alt="" className="w-10 h-10 md:w-12 md:h-12 brightness-0 invert" />
          <span className="text-white text-base md:text-lg font-heading font-bold tracking-widest uppercase">Hsquare Living</span>
        </div>

        <motion.div
          style={{ opacity: heroOpacity }}
          className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center px-4"
        >
          <motion.div
            style={{ y: overlayY }}
            className="max-w-4xl mx-auto"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="space-y-4"
              >
                <motion.p
                  className="text-amber-400 text-sm md:text-base tracking-[0.3em] uppercase font-medium"
                  initial={{ opacity: 0, letterSpacing: "0.5em" }}
                  animate={{ opacity: 1, letterSpacing: "0.3em" }}
                  transition={{ duration: 1, delay: 0.3 }}
                >
                  {heroSlides[currentSlide].subtitle}
                </motion.p>

                <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold text-white leading-tight drop-shadow-2xl">
                  {heroSlides[currentSlide].title}
                </h1>

                <p className="text-white/80 text-lg md:text-xl font-light max-w-2xl mx-auto">
                  {heroSlides[currentSlide].caption}
                </p>
              </motion.div>
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="mt-8 flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/properties">
                <Button
                  size="lg"
                  className="bg-amber-600 hover:bg-amber-700 text-white border-none text-base px-8 h-14 rounded-none font-semibold tracking-wider shadow-2xl hover:shadow-amber-500/20 transition-all uppercase"
                  data-testid="button-explore-properties"
                >
                  Explore Properties
                </Button>
              </Link>
              <Link href="/properties">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-2 border-white/40 text-white hover:bg-white/10 hover:border-white/60 text-base px-8 h-14 rounded-none font-semibold tracking-wider group uppercase"
                  data-testid="button-take-tour"
                >
                  <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Virtual Tour
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        <div className="absolute left-0 right-0 bottom-0 z-30">
          <div className="flex items-center justify-between px-4 md:px-8 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={prevSlide}
                className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-all"
                data-testid="button-hero-prev"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextSlide}
                className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-all"
                data-testid="button-hero-next"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="flex gap-2 ml-4">
                {heroSlides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setSlideDirection(i > currentSlide ? 1 : -1); setCurrentSlide(i); }}
                    className="relative h-1 rounded-full overflow-hidden transition-all duration-500"
                    style={{ width: i === currentSlide ? "2rem" : "1rem" }}
                    data-testid={`button-hero-dot-${i}`}
                  >
                    <span className={`absolute inset-0 rounded-full ${i === currentSlide ? "bg-white/30" : "bg-white/20 hover:bg-white/40"}`} />
                    {i === currentSlide && isAutoPlaying && (
                      <motion.span
                        className="absolute inset-0 rounded-full bg-amber-400 origin-left"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 6, ease: "linear" }}
                        key={`progress-${currentSlide}`}
                      />
                    )}
                    {i === currentSlide && !isAutoPlaying && (
                      <span className="absolute inset-0 rounded-full bg-amber-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={scrollToContent}
              className="hidden md:flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm tracking-wide group"
            >
              Scroll to explore
              <ChevronDown className="w-4 h-4 animate-bounce" />
            </button>
          </div>

          <div className="bg-black/40 backdrop-blur-sm border-t border-white/10">
            <div className="container mx-auto px-4 py-3 flex justify-center">
              <Link href="/properties">
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-none h-12 px-10 font-semibold tracking-wider uppercase text-sm whitespace-nowrap"
                  data-testid="button-book-now-hero"
                >
                  Book Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-heading font-bold text-amber-600 mb-1" data-testid={`stat-value-${i}`}>
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 uppercase tracking-wider font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-gradient-to-b from-white to-stone-50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-amber-600 text-sm tracking-[0.3em] uppercase font-medium mb-3">Discover</p>
            <h2 className="text-3xl md:text-5xl font-heading font-bold text-gray-900 mb-4">
              Why Choose Hsquareliving
            </h2>
            <div className="w-16 h-0.5 bg-amber-500 mx-auto mb-6" />
            <p className="text-gray-500 text-lg max-w-2xl mx-auto font-light">
              An ecosystem thoughtfully designed for students to thrive, study, and build lifelong connections.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
            {[
              { icon: Wifi, title: "High-Speed WiFi", desc: "Enterprise-grade connectivity for seamless studies and entertainment.", color: "from-blue-50 to-indigo-50" },
              { icon: Shield, title: "24/7 Security", desc: "Biometric access, CCTV surveillance, and round-the-clock security staff.", color: "from-emerald-50 to-teal-50" },
              { icon: Utensils, title: "Gourmet Meals", desc: "Chef-prepared nutritious meals with diverse cuisine options daily.", color: "from-orange-50 to-amber-50" },
              { icon: Users, title: "Vibrant Community", desc: "Events, workshops, and curated spaces to connect with brilliant peers.", color: "from-purple-50 to-pink-50" },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className={`p-8 md:p-10 border-r border-b last:border-r-0 lg:last:border-r-0 bg-gradient-to-br ${feature.color} group hover:bg-white transition-all duration-500 cursor-default`}
              >
                <div className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center text-amber-600 mb-6 group-hover:scale-110 group-hover:shadow-lg transition-all duration-500">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-heading font-bold text-lg text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28 bg-stone-50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-amber-600 text-sm tracking-[0.3em] uppercase font-medium mb-3">Our Spaces</p>
            <h2 className="text-3xl md:text-5xl font-heading font-bold text-gray-900 mb-4">
              Amenities & Facilities
            </h2>
            <div className="w-16 h-0.5 bg-amber-500 mx-auto" />
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(dynamicAmenities.length > 0
              ? dynamicAmenities.map(a => ({
                  image: a.imageUrl,
                  title: a.title,
                  desc: a.description,
                  icon: ICON_MAP[a.icon] || Star,
                }))
              : AMENITY_SHOWCASE
            ).map((amenity, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.1, duration: 0.7 }}
                className="group relative overflow-hidden cursor-pointer"
                data-testid={`amenity-card-${i}`}
              >
                <div className="aspect-[16/10] overflow-hidden">
                  <img
                    src={amenity.image}
                    alt={amenity.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-amber-500/90 flex items-center justify-center">
                      <amenity.icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-white font-heading font-bold text-xl">{amenity.title}</h3>
                  </div>
                  <p className="text-white/70 text-sm font-light ml-13 pl-13">{amenity.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {featuredPlans.length > 0 && (() => {
        const propertyIds = [...new Set(featuredPlans.map((p: any) => p.propertyId).filter(Boolean))];
        const plansByProperty: Record<string, any[]> = {};
        featuredPlans.forEach((plan: any) => {
          const key = plan.propertyId || "general";
          if (!plansByProperty[key]) plansByProperty[key] = [];
          plansByProperty[key].push(plan);
        });
        const tierDesigns = [
          {
            cardBg: "bg-gradient-to-br from-[#0a2e1f] via-[#134e31] to-[#0a3d23]",
            headerAccent: "from-emerald-400 to-teal-300",
            priceColor: "text-emerald-300",
            taglineColor: "text-emerald-400/70",
            divider: "border-emerald-800/40",
            featureIcon: "from-emerald-500/30 to-teal-500/30 text-emerald-300",
            featureText: "text-emerald-100/80",
            featureValue: "text-white font-semibold",
            btnBg: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/30",
            glow: "rgba(16,185,129,0.08)",
            decorLine: "from-transparent via-emerald-500/30 to-transparent",
            occupancyBg: "bg-emerald-900/40 border-emerald-700/30",
            occupancyText: "text-emerald-300",
          },
          {
            cardBg: "bg-gradient-to-br from-[#1a0a3e] via-[#2d1b69] to-[#1e0f4f]",
            headerAccent: "from-violet-400 to-purple-300",
            priceColor: "text-violet-300",
            taglineColor: "text-violet-400/70",
            divider: "border-violet-800/40",
            featureIcon: "from-violet-500/30 to-purple-500/30 text-violet-300",
            featureText: "text-violet-100/80",
            featureValue: "text-white font-semibold",
            btnBg: "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 shadow-violet-500/30",
            glow: "rgba(139,92,246,0.08)",
            decorLine: "from-transparent via-violet-500/30 to-transparent",
            occupancyBg: "bg-violet-900/40 border-violet-700/30",
            occupancyText: "text-violet-300",
          },
          {
            cardBg: "bg-gradient-to-br from-[#3d2400] via-[#5c3a0a] to-[#4a2d00]",
            headerAccent: "from-amber-300 to-yellow-200",
            priceColor: "text-amber-300",
            taglineColor: "text-amber-400/70",
            divider: "border-amber-700/40",
            featureIcon: "from-amber-500/30 to-yellow-500/30 text-amber-300",
            featureText: "text-amber-100/80",
            featureValue: "text-white font-semibold",
            btnBg: "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 shadow-amber-500/30",
            glow: "rgba(245,158,11,0.1)",
            decorLine: "from-transparent via-amber-500/30 to-transparent",
            occupancyBg: "bg-amber-900/40 border-amber-700/30",
            occupancyText: "text-amber-300",
          },
        ];
        return (
          <section className="py-24 md:py-32 relative overflow-hidden" data-testid="section-housing-plans">
            <div className="absolute inset-0 bg-[#0c0c0c]" />
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E\")" }} />
            <motion.div
              className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-20"
              style={{ background: "radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)" }}
              animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-[120px] opacity-20"
              style={{ background: "radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 70%)" }}
              animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />

            <div className="container mx-auto px-4 relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="text-center mb-16"
              >
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="w-16 h-[2px] bg-gradient-to-r from-amber-500 to-yellow-400 mx-auto mb-6"
                />
                <p className="text-amber-400/80 text-xs tracking-[0.4em] uppercase font-medium mb-4">Curated Living Experiences</p>
                <h2 className="text-4xl md:text-6xl font-heading font-bold text-white mb-5 tracking-tight">
                  Housing <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">Plans</span>
                </h2>
                <p className="text-white/40 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
                  Tailored tiers of comfort, service, and luxury. Choose the experience that matches your lifestyle.
                </p>
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="w-32 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto mt-8"
                />
              </motion.div>

              {propertyIds.map((propId, propIdx) => {
                const plans = plansByProperty[propId] || [];
                const propName = plans[0]?.propertyName || "Property";
                return (
                  <div key={propId} className={propIdx > 0 ? "mt-20" : ""}>
                    {propertyIds.length > 1 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        className="flex items-center justify-center gap-4 mb-10"
                      >
                        <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-r from-transparent to-white/20" />
                        <div className="flex items-center gap-2 px-5 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
                          <Building2 className="w-4 h-4 text-amber-400" />
                          <span className="text-white/70 text-xs tracking-wider uppercase font-medium">{propName}</span>
                        </div>
                        <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-l from-transparent to-white/20" />
                      </motion.div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
                      {plans.map((plan: any, idx: number) => {
                        const tier = plan.tierLevel ?? idx;
                        const d = tierDesigns[Math.min(tier, tierDesigns.length - 1)];
                        const isHighlighted = plan.isHighlighted;
                        const isTop = tier === Math.max(...plans.map((p: any) => p.tierLevel ?? 0));
                        const price = Number(plan.basePrice || 0);
                        const features = (plan.items || []).slice(0, 6);
                        return (
                          <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: idx * 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                            whileHover={{ y: -12, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                            className="relative group"
                            data-testid={`plan-card-home-${plan.id}`}
                          >
                            {isHighlighted && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="absolute -top-5 left-1/2 -translate-x-1/2 z-20"
                              >
                                <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-black text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full shadow-xl shadow-amber-500/40 flex items-center gap-1.5">
                                  <Star className="w-3.5 h-3.5 fill-current" /> Most Popular
                                </span>
                              </motion.div>
                            )}
                            {isTop && !isHighlighted && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="absolute -top-5 left-1/2 -translate-x-1/2 z-20"
                              >
                                <span className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-white text-[10px] font-black uppercase tracking-[0.2em] px-5 py-2 rounded-full shadow-xl shadow-amber-600/30 flex items-center gap-1.5">
                                  <Award className="w-3.5 h-3.5" /> Premium
                                </span>
                              </motion.div>
                            )}

                            <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: `0 0 60px 10px ${d.glow}, 0 25px 50px -12px rgba(0,0,0,0.5)` }} />

                            <div className={`${d.cardBg} rounded-3xl overflow-hidden h-full flex flex-col relative border border-white/[0.06] group-hover:border-white/[0.12] transition-all duration-500`}>
                              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${d.glow} 0%, transparent 60%)` }} />

                              <div className="px-7 pt-8 pb-6 relative">
                                <div className={`absolute top-0 left-7 right-7 h-[1px] bg-gradient-to-r ${d.decorLine}`} />
                                <h3 className={`font-heading font-bold text-2xl tracking-wide bg-gradient-to-r ${d.headerAccent} bg-clip-text text-transparent`}>
                                  {plan.name}
                                </h3>
                                {plan.tagline && (
                                  <p className={`text-sm mt-1 ${d.taglineColor} italic`}>{plan.tagline}</p>
                                )}

                                <div className="mt-5 flex items-baseline gap-2">
                                  <span className={`text-4xl font-bold tracking-tight ${d.priceColor}`}>
                                    {price > 0 ? `₹${price.toLocaleString("en-IN")}` : "Custom"}
                                  </span>
                                  {price > 0 && <span className="text-white/30 text-sm">/ year</span>}
                                </div>
                                {price > 0 && (
                                  <p className="text-white/25 text-xs mt-1">≈ ₹{Math.round(price / 12).toLocaleString("en-IN")}/month</p>
                                )}
                              </div>

                              <div className={`mx-7 h-[1px] bg-gradient-to-r ${d.decorLine}`} />

                              <div className="px-7 py-5 flex-1 flex flex-col">
                                {plan.occupancy && (
                                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs mb-4 ${d.occupancyBg}`}>
                                    <Users className={`w-3.5 h-3.5 ${d.occupancyText}`} />
                                    <span className={d.occupancyText}>{plan.occupancy}</span>
                                  </div>
                                )}

                                {features.length > 0 && (
                                  <div className="space-y-3 flex-1">
                                    {features.map((item: any) => {
                                      const val = item.featureValue || `${item.includedQty} ${item.unit}`;
                                      const isCredit = val.includes("Credit");
                                      const isUnlimited = val.toLowerCase().includes("unlimited") || val.toLowerCase().includes("priority");
                                      return (
                                        <div key={item.id} className="flex items-start gap-3">
                                          <div className={`w-5 h-5 mt-0.5 rounded-md bg-gradient-to-br ${d.featureIcon} flex items-center justify-center shrink-0`}>
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <span className={`text-sm ${d.featureText}`}>{item.label}</span>
                                            <span className={`text-sm ml-1 ${isCredit || isUnlimited ? d.featureValue + " drop-shadow-sm" : d.featureValue}`}>
                                              {val}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {(plan.items || []).length > 6 && (
                                      <p className="text-xs text-white/25 pl-8">+{(plan.items || []).length - 6} more inclusions</p>
                                    )}
                                  </div>
                                )}

                                <div className="mt-7">
                                  <Link href={plan.propertyId ? `/properties/${plan.propertyId}` : "/properties"}>
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      className={`w-full rounded-xl h-12 font-semibold tracking-[0.15em] uppercase text-sm text-white shadow-lg ${d.btnBg} relative overflow-hidden transition-all duration-300`}
                                      data-testid={`button-view-plan-${plan.id}`}
                                    >
                                      <span className="relative z-10 flex items-center justify-center gap-2">
                                        Explore & Book <ArrowRight className="w-4 h-4" />
                                      </span>
                                      <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                                        animate={{ x: ["-100%", "200%"] }}
                                        transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
                                      />
                                    </motion.button>
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {instagramPosts.length > 0 && (
        <section
          className="py-20 md:py-28 bg-gradient-to-b from-stone-50 to-white overflow-hidden"
          onMouseEnter={() => setIgAutoPlaying(false)}
          onMouseLeave={() => setIgAutoPlaying(true)}
          data-testid="instagram-feed-section"
        >
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12"
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}>
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </div>
                  <p className="text-sm tracking-[0.3em] uppercase font-medium" style={{ background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Live From Instagram</p>
                </div>
                <h2 className="text-3xl md:text-5xl font-heading font-bold text-gray-900 mb-2">
                  Life at Hsquareliving
                </h2>
                <p className="text-gray-500 font-light">Follow our journey and see what makes us special</p>
              </div>
              <a
                href="https://www.instagram.com/hsquareliving/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 md:mt-0 group flex items-center gap-2 text-sm font-semibold tracking-wider uppercase hover:opacity-80 transition-opacity"
                style={{ background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                data-testid="link-instagram-profile"
              >
                @hsquareliving <ExternalLink className="w-4 h-4 text-pink-600 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </motion.div>

            <div className="relative">
              <div className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden rounded-lg shadow-2xl">
                <AnimatePresence initial={false}>
                  <motion.div
                    key={igCurrentSlide}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="absolute inset-0"
                  >
                    <img
                      src={instagramPosts[igCurrentSlide]?.mediaUrl}
                      alt={instagramPosts[igCurrentSlide]?.caption?.slice(0, 100) || "Instagram post"}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                      <div className="max-w-3xl">
                        {instagramPosts[igCurrentSlide]?.caption && (
                          <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.6 }}
                            className="text-white/90 text-sm md:text-base leading-relaxed line-clamp-3 mb-4 font-light"
                          >
                            {instagramPosts[igCurrentSlide].caption}
                          </motion.p>
                        )}
                        <motion.a
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                          href={instagramPosts[igCurrentSlide]?.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs uppercase tracking-wider font-semibold hover:bg-white/20 transition-all rounded-none"
                          data-testid="link-instagram-post"
                        >
                          View on Instagram
                          <ExternalLink className="w-3.5 h-3.5" />
                        </motion.a>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-white text-xs font-medium tracking-wide">LIVE FEED</span>
                </div>

                <button
                  onClick={() => setIgCurrentSlide(prev => (prev - 1 + instagramPosts.length) % instagramPosts.length)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/50 transition-all"
                  data-testid="button-ig-prev"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIgCurrentSlide(prev => (prev + 1) % instagramPosts.length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/50 transition-all"
                  data-testid="button-ig-next"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 flex items-center justify-center gap-2">
                {instagramPosts.slice(0, 12).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIgCurrentSlide(i)}
                    className="relative h-1.5 rounded-full overflow-hidden transition-all duration-500"
                    style={{ width: i === igCurrentSlide ? "2rem" : "0.75rem" }}
                    data-testid={`button-ig-dot-${i}`}
                  >
                    <span className={`absolute inset-0 rounded-full ${
                      i === igCurrentSlide
                        ? "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600"
                        : "bg-gray-300 hover:bg-gray-400"
                    }`} />
                    {i === igCurrentSlide && igAutoPlaying && (
                      <motion.span
                        className="absolute inset-0 rounded-full origin-left"
                        style={{ background: "linear-gradient(90deg, #f09433, #dc2743, #bc1888)" }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 5, ease: "linear" }}
                        key={`ig-progress-${igCurrentSlide}`}
                      />
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {instagramPosts.slice(0, 8).map((post: any, i: number) => (
                  <motion.button
                    key={post.id}
                    onClick={() => setIgCurrentSlide(i)}
                    className={`aspect-square overflow-hidden rounded-sm transition-all duration-300 ${
                      i === igCurrentSlide ? "ring-2 ring-pink-500 ring-offset-2 scale-95" : "opacity-70 hover:opacity-100"
                    }`}
                    whileHover={{ scale: 1.05 }}
                    data-testid={`button-ig-thumb-${i}`}
                  >
                    <img
                      src={post.mediaUrl}
                      alt={post.caption?.slice(0, 50) || `Post ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {!propertiesLoading && properties.length > 0 && (
        <section className="py-20 md:py-28 bg-white">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12"
            >
              <div>
                <p className="text-amber-600 text-sm tracking-[0.3em] uppercase font-medium mb-3">Properties</p>
                <h2 className="text-3xl md:text-5xl font-heading font-bold text-gray-900">
                  Featured Residences
                </h2>
              </div>
              <Link href="/properties">
                <Button variant="ghost" className="text-amber-600 hover:text-amber-700 mt-4 md:mt-0 group" data-testid="link-view-all-properties">
                  View All Properties <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.slice(0, 3).map((property: any, i: number) => {
                const prices = property.roomTypes?.map((r: any) =>
                  property.bookingMode === "academic_year" ? (r.academicYearPrice || r.basePrice * 11) : r.basePrice
                ).filter((p: number) => p > 0) || [];
                const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
                const totalBeds = property.roomTypes?.reduce((sum: number, r: any) => sum + (r.availableBeds || 0), 0) || 0;
                let propertyImage = property.imageUrl;
                if (!propertyImage) {
                  try { const imgs = JSON.parse(property.tourOverviewImages || "[]"); propertyImage = imgs[0]; } catch {}
                }

                return (
                  <motion.div
                    key={property.id}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ delay: i * 0.15, duration: 0.6 }}
                    className="group"
                    data-testid={`property-card-${property.id}`}
                  >
                    <Link href={`/properties/${property.id}`}>
                      <div className="relative overflow-hidden cursor-pointer">
                        <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                          <img
                            src={propertyImage || heroStudentLiving}
                            alt={property.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="absolute top-4 left-4">
                          <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                            property.bookingMode === "academic_year"
                              ? "bg-purple-600 text-white"
                              : "bg-amber-600 text-white"
                          }`}>
                            {property.bookingMode === "academic_year" ? "Academic Year" : "Monthly Booking"}
                          </span>
                        </div>
                        {totalBeds > 0 && totalBeds < 5 && (
                          <div className="absolute top-4 right-4">
                            <span className="px-3 py-1 text-xs font-semibold bg-red-600 text-white uppercase tracking-wider">
                              Only {totalBeds} left
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="py-5">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-heading font-bold text-lg text-gray-900 group-hover:text-amber-600 transition-colors">
                              {property.name}
                            </h3>
                            <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {property.location}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-amber-600">
                              {lowestPrice > 0 ? `₹${lowestPrice.toLocaleString()}` : "—"}
                            </div>
                            <div className="text-xs text-gray-400">
                              {property.bookingMode === "academic_year" ? "per year" : "per month"}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {property.amenities?.slice(0, 4).map((am: string) => (
                            <span key={am} className="px-2 py-0.5 text-xs text-gray-500 bg-gray-100 border border-gray-200">
                              {am}
                            </span>
                          ))}
                          {property.amenities?.length > 4 && (
                            <span className="px-2 py-0.5 text-xs text-amber-600 bg-amber-50 border border-amber-200">
                              +{property.amenities.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="relative py-28 md:py-36 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroTerrace} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/70" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative z-10 container mx-auto px-4 text-center"
        >
          <p className="text-amber-400 text-sm tracking-[0.3em] uppercase font-medium mb-4">Ready to Begin</p>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-heading font-bold text-white mb-6 leading-tight">
            Your Premium Living<br />Experience Awaits
          </h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto mb-10 font-light">
            Secure your spot in minutes. Premium accommodation with flexible payment plans, starting from ₹18,000/-.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/properties">
              <Button
                size="lg"
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-none h-14 px-10 font-semibold tracking-wider uppercase text-sm shadow-2xl"
                data-testid="button-cta-book"
              >
                Book Your Stay <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white/30 text-white hover:bg-white/10 rounded-none h-14 px-10 font-semibold tracking-wider uppercase text-sm bg-transparent"
              onClick={() => window.open(`tel:${footerPhone.replace(/\s/g, "")}`)}
              data-testid="button-cta-call"
            >
              <Phone className="w-4 h-4 mr-2" />
              Contact Us
            </Button>
          </div>
        </motion.div>
      </section>

      <PropertyTourModal
        isOpen={tourModalOpen}
        onClose={() => setTourModalOpen(false)}
      />
    </div>
  );
}
