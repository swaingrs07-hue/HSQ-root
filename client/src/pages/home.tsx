import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import heroLobby from "@/assets/hero-lobby.jpg";
import heroRoom from "@/assets/hero-room.jpg";
import heroTerrace from "@/assets/hero-terrace.jpg";
import heroDining from "@/assets/hero-dining.jpg";
import amenityGym from "@/assets/amenity-gym.jpg";
import amenityStudy from "@/assets/amenity-study.jpg";
import hsquareLogo from "@assets/Hsquare_Logo_File-07_1771351647884.png";
import {
  ArrowRight, ChevronLeft, ChevronRight, Wifi, Shield, Coffee, Users,
  Play, Star, MapPin, Calendar, Building2, Sparkles, Clock, Phone,
  ChevronDown, Award, Utensils, Dumbbell, BookOpen, Heart, ExternalLink,
  ArrowUp, GraduationCap, Navigation, Smartphone, Bell, Wallet, QrCode
} from "lucide-react";
import { motion, AnimatePresence, useTransform, useMotionValue, useSpring, useInView } from "framer-motion";
import { PropertyTourModal } from "@/components/property-tour-modal";
import { SmartSearch } from "@/components/smart-search";
import { getProperties } from "@/lib/api";
import { ParticleBackground } from "@/components/particle-background";

function useMouseTilt(intensity = 15) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [intensity, -intensity]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-intensity, intensity]), { stiffness: 300, damping: 30 });
  const glowX = useSpring(useTransform(x, [-0.5, 0.5], [0, 100]), { stiffness: 200, damping: 25 });
  const glowY = useSpring(useTransform(y, [-0.5, 0.5], [0, 100]), { stiffness: 200, damping: 25 });
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [x, y]);
  const onMouseLeave = useCallback(() => { x.set(0); y.set(0); }, [x, y]);
  return { rotateX, rotateY, glowX, glowY, onMouseMove, onMouseLeave };
}

function TiltCard({ children, className = "", intensity = 12, glowColor = "rgba(245,158,11,0.15)", ...props }: {
  children: React.ReactNode; className?: string; intensity?: number; glowColor?: string;
  [key: string]: any;
}) {
  const { rotateX, rotateY, glowX, glowY, onMouseMove, onMouseLeave } = useMouseTilt(intensity);
  const prefersReduced = useRef(typeof window !== 'undefined' && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  if (prefersReduced.current) {
    return <div className={className} {...props}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      style={{ perspective: 1000, transformStyle: "preserve-3d" as any }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      {...props}
    >
      <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" as any }} className="relative h-full">
        {children}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: useTransform([glowX, glowY], ([gx, gy]) => `radial-gradient(circle at ${gx}% ${gy}%, ${glowColor} 0%, transparent 60%)`) }}
        />
      </motion.div>
    </motion.div>
  );
}

function Floating3DShape({ type, size, color, delay, x, y, duration = 20 }: {
  type: "cube" | "ring" | "sphere" | "diamond" | "hexagon";
  size: number; color: string; delay: number; x: string; y: string; duration?: number;
}) {
  const shapes: Record<string, React.ReactNode> = {
    cube: (
      <div style={{ width: size, height: size, transformStyle: "preserve-3d" as any }} className="relative">
        <div className="absolute inset-0 border rounded-lg" style={{ borderColor: color, background: `${color}15`, transform: "translateZ(0px)" }} />
        <div className="absolute inset-0 border rounded-lg" style={{ borderColor: color, background: `${color}08`, transform: `rotateY(90deg) translateZ(${size/2}px)`, width: size, height: size }} />
      </div>
    ),
    ring: (
      <div className="rounded-full border-2" style={{ width: size, height: size, borderColor: color, boxShadow: `0 0 ${size/2}px ${color}40, inset 0 0 ${size/3}px ${color}20` }} />
    ),
    sphere: (
      <div className="rounded-full" style={{ width: size, height: size, background: `radial-gradient(circle at 30% 30%, ${color}60, ${color}10, transparent)`, boxShadow: `0 0 ${size}px ${color}30` }} />
    ),
    diamond: (
      <div style={{ width: size, height: size, transform: "rotate(45deg)", border: `2px solid ${color}`, background: `${color}10`, boxShadow: `0 0 ${size/2}px ${color}30` }} />
    ),
    hexagon: (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <polygon points="50,2 95,25 95,75 50,98 5,75 5,25" fill={`${color}10`} stroke={color} strokeWidth="1.5" />
      </svg>
    ),
  };

  return (
    <motion.div
      className="absolute pointer-events-none z-[3]"
      style={{ left: x, top: y }}
      animate={{
        y: [0, -30, 0, 20, 0],
        x: [0, 15, -10, 5, 0],
        rotateX: [0, 360],
        rotateY: [0, 360],
        rotateZ: [0, 180],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <motion.div
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: duration / 2, delay, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformStyle: "preserve-3d" as any }}
      >
        {shapes[type]}
      </motion.div>
    </motion.div>
  );
}

function ImmersiveScene({ children, className = "", variant = "default" }: {
  children: React.ReactNode; className?: string;
  variant?: "default" | "fog" | "grid" | "aurora" | "depth";
  [key: string]: any;
}) {
  const backgrounds: Record<string, React.ReactNode> = {
    default: null,
    fog: (
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at 50% 100%, rgba(120,80,200,0.12) 0%, transparent 60%)",
      }} />
    ),
    grid: (
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at 50% 80%, rgba(245,158,11,0.1) 0%, transparent 50%)",
      }} />
    ),
    aurora: (
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at 30% 50%, rgba(0,255,200,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(120,0,255,0.06) 0%, transparent 50%)",
      }} />
    ),
    depth: (
      <div className="absolute inset-0" style={{
        boxShadow: "inset 0 0 200px 60px rgba(0,0,0,0.5)",
      }} />
    ),
  };

  return (
    <section className={`relative ${className}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {backgrounds[variant]}
      </div>
      {children}
    </section>
  );
}


function CinematicText({ children, className = "", delay = 0, gradient = false }: {
  children: string; className?: string; delay?: number; gradient?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <span ref={ref} className={`inline ${className}`}>
      {children.split("").map((char, i) =>
        char === " " ? (
          <span key={i}>{"\u00A0"}</span>
        ) : (
          <motion.span
            key={i}
            className={`inline-block ${gradient ? "bg-gradient-to-r from-emerald-400 via-amber-400 to-violet-400 bg-clip-text text-transparent" : ""}`}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{
              duration: 0.5,
              delay: delay + i * 0.04,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {char}
          </motion.span>
        )
      )}
    </span>
  );
}

function ShimmerText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative ${className}`}>
      {children}
      <motion.span
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-clip-text"
        style={{ backgroundSize: "200% 100%" }}
        animate={{ backgroundPosition: ["200% 0%", "-200% 0%"] }}
        transition={{ duration: 4, repeat: Infinity, repeatDelay: 3, ease: "linear" }}
      />
    </span>
  );
}

interface SlideData {
  image: string;
  title: string;
  subtitle: string;
  caption: string;
  videoUrl?: string | null;
}

const DEFAULT_SLIDES: SlideData[] = [
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
  { value: "5000+", label: "Happy Residents", numericEnd: 5000, suffix: "+" },
  { value: "15+", label: "Premium Properties", numericEnd: 15, suffix: "+" },
  { value: "98%", label: "Satisfaction Rate", numericEnd: 98, suffix: "%" },
  { value: "24/7", label: "Support & Security", numericEnd: 0, suffix: "" },
];

function AnimatedCounter({ end, suffix, label }: { end: number; suffix: string; label: string }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasAnimated || end === 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start = 0;
          const duration = 2000;
          const startTime = performance.now();
          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            start = Math.floor(eased * end);
            setCount(start);
            if (progress < 1) requestAnimationFrame(animate);
            else setDone(true);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  if (end === 0) {
    return (
      <div ref={ref} className="flex flex-col items-center justify-center text-center">
        <motion.div
          className="text-5xl md:text-7xl font-heading font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/50"
          initial={{ scale: 0.5, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
          style={{ textShadow: "0 0 60px rgba(0,200,255,0.3)" }}
        >
          24/7
        </motion.div>
        <div className="text-[10px] md:text-xs text-white/30 uppercase tracking-[0.3em] font-medium mt-3">{label}</div>
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col items-center justify-center text-center">
      <motion.div
        className="text-5xl md:text-7xl font-heading font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/50"
        animate={done ? { scale: [1, 1.15, 1], filter: ["drop-shadow(0 0 0px transparent)", "drop-shadow(0 0 30px rgba(0,200,255,0.5))", "drop-shadow(0 0 0px transparent)"] } : {}}
        transition={{ duration: 0.6 }}
        style={{ textShadow: done ? "0 0 40px rgba(0,200,255,0.2)" : "none" }}
      >
        {count.toLocaleString()}{suffix}
      </motion.div>
      <div className="text-[10px] md:text-xs text-white/30 uppercase tracking-[0.3em] font-medium mt-3">{label}</div>
    </div>
  );
}

export default function Home() {
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying] = useState(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [heroSlides, setHeroSlides] = useState<SlideData[]>(DEFAULT_SLIDES);
  const [instagramPosts, setInstagramPosts] = useState<any[]>([]);
  const [igCurrentSlide, setIgCurrentSlide] = useState(0);
  const [igAutoPlaying, setIgAutoPlaying] = useState(true);
  const [footerPhone, setFooterPhone] = useState("+91 6372294625");
  const [androidDownloadUrl, setAndroidDownloadUrl] = useState("");
  const [dynamicAmenities, setDynamicAmenities] = useState<any[]>([]);
  const [featuredPlans, setFeaturedPlans] = useState<any[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const igInterval = useRef<NodeJS.Timeout | null>(null);
  const [slideDirection, setSlideDirection] = useState(1);
  const slideInterval = useRef<NodeJS.Timeout | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    fetch("/api/hero-slides?active=true")
      .then(res => res.ok ? res.json() : [])
      .then((apiSlides: any[]) => {
        if (apiSlides.length > 0) {
          const mapped = apiSlides.map(s => ({
            image: s.imageUrl,
            title: s.title,
            subtitle: s.subtitle || "",
            caption: s.caption || "",
            videoUrl: s.videoUrl || null,
          }));
          setHeroSlides(mapped);
          const videoIndex = mapped.findIndex(s => s.videoUrl);
          if (videoIndex >= 0) setCurrentSlide(videoIndex);
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
        if (data?.androidDownloadUrl) setAndroidDownloadUrl(data.androidDownloadUrl);
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

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  const browserCanPlay = useCallback((contentType: string) => {
    if (typeof window === "undefined") return true;
    const testVideo = document.createElement("video");
    return testVideo.canPlayType(contentType) !== "";
  }, []);

  const inferContentType = useCallback((url: string): string | null => {
    const lower = url.toLowerCase();
    if (lower.includes(".webm")) return "video/webm";
    if (lower.includes(".mp4")) return "video/mp4";
    if (lower.includes(".mov")) return "video/quicktime";
    if (lower.includes(".ogg") || lower.includes(".ogv")) return "video/ogg";
    return null;
  }, []);

  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const currentVideoUrl = heroSlides[currentSlide]?.videoUrl || null;
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);
  const [videoSupported, setVideoSupported] = useState(false);
  const signedUrlCache = useRef<Record<string, { url: string; expires: number; contentType?: string }>>({});

  const hasAnyVideo = heroSlides.some(s => s.videoUrl);

  useEffect(() => {
    if (!currentVideoUrl) {
      setResolvedVideoUrl(null);
      setVideoSupported(false);
      return;
    }
    const cached = signedUrlCache.current[currentVideoUrl];
    if (cached && cached.expires > Date.now()) {
      const ct = cached.contentType || inferContentType(currentVideoUrl);
      const supported = ct ? browserCanPlay(ct) : true;
      setVideoSupported(supported);
      setResolvedVideoUrl(supported ? cached.url : null);
      if (!supported) setVideoFailed(true);
      return;
    }
    let cancelled = false;
    fetch(`/api/uploads/signed-url?path=${encodeURIComponent(currentVideoUrl)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        if (data?.url) {
          signedUrlCache.current[currentVideoUrl] = {
            url: data.url,
            expires: Date.now() + 50 * 60 * 1000,
            contentType: data.contentType,
          };
          const ct = data.contentType || inferContentType(currentVideoUrl) || "";
          const supported = ct ? browserCanPlay(ct) : true;
          setVideoSupported(supported);
          if (supported) {
            setResolvedVideoUrl(data.url);
          } else {
            setResolvedVideoUrl(null);
            setVideoFailed(true);
          }
        } else {
          setVideoSupported(false);
          setVideoFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVideoSupported(false);
          setVideoFailed(true);
        }
      });
    return () => { cancelled = true; };
  }, [currentVideoUrl, browserCanPlay, inferContentType]);

  useEffect(() => {
    if (!resolvedVideoUrl || !heroVideoRef.current) return;
    const video = heroVideoRef.current;
    setVideoReady(false);
    setVideoFailed(false);

    video.src = resolvedVideoUrl;
    video.load();

    const tryPlay = () => {
      setVideoReady(true);
      const playPromise = video.play();
      if (playPromise) playPromise.catch(() => {
        video.muted = true;
        video.play().catch(() => {
          setVideoFailed(true);
        });
      });
    };

    const onCanPlay = () => tryPlay();
    const onLoadedData = () => {
      if (!videoReady) tryPlay();
    };
    const onError = () => {
      setVideoFailed(true);
      setVideoReady(false);
    };

    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("error", onError);

    const failsafeTimeout = setTimeout(() => {
      if (!videoReady) {
        if (video.readyState >= 2) {
          tryPlay();
        } else {
          setVideoFailed(true);
        }
      }
    }, 5000);

    return () => {
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("error", onError);
      clearTimeout(failsafeTimeout);
    };
  }, [resolvedVideoUrl]);

  useEffect(() => {
    if (hasAnyVideo) return;
    if (isAutoPlaying && heroSlides.length > 1) {
      slideInterval.current = setInterval(nextSlide, 6000);
    }
    return () => {
      if (slideInterval.current) clearInterval(slideInterval.current);
    };
  }, [isAutoPlaying, nextSlide, heroSlides.length, hasAnyVideo]);

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
    <div className="flex flex-col bg-[#050505]">
      <style>{`
        @keyframes shimmerGradient {
          0% { background-position: 200% 0%; }
          100% { background-position: -200% 0%; }
        }
        @keyframes floatOrb {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.1); }
        }
        @keyframes gridPulse {
          0%, 100% { opacity: 0.03; }
          50% { opacity: 0.08; }
        }
        @keyframes cameraZoom {
          0% { transform: scale(1) translateZ(0); }
          100% { transform: scale(1.5) translateZ(100px); }
        }
      `}</style>
      <section
        ref={heroRef}
        className="relative w-full h-screen overflow-hidden"
        data-testid="hero-section"
      >
        {heroSlides[currentSlide].videoUrl && videoSupported && !videoFailed ? (
          <div className="absolute inset-0 bg-black">
            <video
              ref={heroVideoRef}
              className="w-full h-full object-cover transition-opacity duration-700"
              style={{ opacity: videoReady ? 1 : 0 }}
              muted
              autoPlay
              loop
              playsInline
              preload="auto"
            />
            {!videoReady && heroSlides[currentSlide].image && (
              <img
                src={heroSlides[currentSlide].image}
                alt={heroSlides[currentSlide].title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="absolute inset-0"
              style={{}}
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
        )}

        <div className="absolute inset-0 z-[5]" style={{
          background: hasAnyVideo
            ? "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(5,5,5,1) 100%)"
            : "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.3) 60%, rgba(5,5,5,1) 100%)",
        }} />
        {!hasAnyVideo && (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/30 z-[5]" />
            <div className="absolute inset-0 z-[4] pointer-events-none" style={{
              boxShadow: "inset 0 0 200px 80px rgba(0,0,0,0.6)",
            }} />
          </>
        )}

        {!hasAnyVideo && (
          <>
            <div className="absolute inset-0 z-[8]">
              <ParticleBackground preset="hero" className="absolute inset-0" id="hero-particles" />
            </div>

            <Floating3DShape type="ring" size={50} color="#f59e0b" delay={0} x="10%" y="25%" duration={25} />
            <Floating3DShape type="diamond" size={25} color="#06b6d4" delay={2} x="85%" y="35%" duration={20} />
            <Floating3DShape type="hexagon" size={35} color="#8b5cf6" delay={4} x="75%" y="65%" duration={22} />
          </>
        )}

        <div className="absolute bottom-28 left-6 md:left-10 z-20 flex items-center gap-3 opacity-15 pointer-events-none select-none" data-testid="hero-watermark">
          <img src={hsquareLogo} alt="" className="w-10 h-10 md:w-12 md:h-12 brightness-0 invert" />
          <span className="text-white text-base md:text-lg font-heading font-bold tracking-widest uppercase">Hsquare Living</span>
        </div>

        <div
          className="absolute inset-0 z-20 flex flex-col justify-end items-center pb-12 md:pb-16 px-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/properties">
              <Button
                size="lg"
                className="text-black hover:bg-white/90 border-none text-base px-12 h-14 rounded-full font-bold tracking-wider shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.3)] transition-all uppercase text-center bg-[#ffffff8a]"
                data-testid="button-explore-properties"
              >
                Explore Properties
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/properties">
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent backdrop-blur-md border border-white/20 text-white hover:bg-white/10 hover:border-white/40 text-base px-12 h-14 rounded-full font-semibold tracking-wider group uppercase"
                data-testid="button-take-tour"
              >
                <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Virtual Tour
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="bg-emerald-500/10 backdrop-blur-md border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 text-base px-12 h-14 rounded-full font-semibold tracking-wider group uppercase"
              data-testid="button-download-app"
              onClick={() => {
                const el = document.getElementById("app-download-section");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <Smartphone className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              Resident App
            </Button>
          </motion.div>
        </div>

        <div className="absolute left-0 right-0 bottom-0 z-30">
          <div className="flex items-center justify-between px-4 md:px-8 py-4">
            <div className="flex items-center gap-3">
              {!hasAnyVideo && heroSlides.length > 1 && (
                <>
                  <button
                    onClick={prevSlide}
                    className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all backdrop-blur-sm"
                    data-testid="button-hero-prev"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all backdrop-blur-sm"
                    data-testid="button-hero-next"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="flex gap-2 ml-4">
                    {heroSlides.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setSlideDirection(i > currentSlide ? 1 : -1); setCurrentSlide(i); }}
                        className="relative h-1 rounded-full overflow-hidden transition-all duration-500"
                        style={{ width: i === currentSlide ? "2.5rem" : "0.75rem" }}
                        data-testid={`button-hero-dot-${i}`}
                      >
                        <span className={`absolute inset-0 rounded-full ${i === currentSlide ? "bg-white/20" : "bg-white/10 hover:bg-white/30"}`} />
                        {i === currentSlide && isAutoPlaying && (
                          <motion.span
                            className="absolute inset-0 rounded-full bg-white origin-left"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 6, ease: "linear" }}
                            key={`progress-${currentSlide}`}
                          />
                        )}
                        {i === currentSlide && !isAutoPlaying && (
                          <span className="absolute inset-0 rounded-full bg-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={scrollToContent}
              className="hidden md:flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-sm tracking-widest group uppercase"
            >
              Scroll to explore
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </button>
          </div>
        </div>
      </section>
      <ImmersiveScene variant="aurora" className="py-28 md:py-36 bg-[#050505]">
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {STATS.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 80, scale: 0.5 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  delay: i * 0.15,
                  duration: 0.8,
                  type: "spring",
                  stiffness: 120,
                  damping: 12,
                }}
                className="relative flex items-center justify-center"
                data-testid={`stat-value-${i}`}
              >
                <AnimatedCounter end={stat.numericEnd} suffix={stat.suffix} label={stat.label} />
              </motion.div>
            ))}
          </div>
        </div>
      </ImmersiveScene>
      <ImmersiveScene variant="grid" className="py-28 md:py-40 bg-[#050505]">
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-20">
            <motion.p
              className="text-cyan-400/80 text-xs tracking-[0.5em] uppercase font-medium mb-6"
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Discover
            </motion.p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-heading font-black text-white mb-6 tracking-tight leading-[1.15]">
              <CinematicText delay={0.1}>Why Choose</CinematicText>
              <br />
              <CinematicText delay={0.4} gradient>Hsquareliving</CinematicText>
            </h2>
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.4 }}
              className="w-24 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent mx-auto mb-8"
            />
            <motion.p
              className="text-white/30 text-lg max-w-2xl mx-auto font-light"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
            >
              An ecosystem thoughtfully designed for students to thrive, study, and build lifelong connections.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Wifi, title: "High-Speed WiFi", desc: "Enterprise-grade connectivity for seamless studies and entertainment.", accent: "from-cyan-500 to-blue-400", glow: "rgba(6,182,212,0.2)", border: "border-cyan-500/20 hover:border-cyan-500/40" },
              { icon: Shield, title: "24/7 Security", desc: "Biometric access, CCTV surveillance, and round-the-clock security staff.", accent: "from-emerald-500 to-teal-400", glow: "rgba(16,185,129,0.2)", border: "border-emerald-500/20 hover:border-emerald-500/40" },
              { icon: Utensils, title: "Gourmet Meals", desc: "Chef-prepared nutritious meals with diverse cuisine options daily.", accent: "from-amber-500 to-orange-400", glow: "rgba(245,158,11,0.2)", border: "border-amber-500/20 hover:border-amber-500/40" },
              { icon: Users, title: "Vibrant Community", desc: "Events, workshops, and curated spaces to connect with brilliant peers.", accent: "from-violet-500 to-purple-400", glow: "rgba(139,92,246,0.2)", border: "border-violet-500/20 hover:border-violet-500/40" },
            ].map((feature, i) => (
              <TiltCard
                key={i}
                intensity={12}
                glowColor={feature.glow}
                className="relative group cursor-default h-full"
              >
                <motion.div
                  initial={{ opacity: 0, y: 80, rotateX: 30 }}
                  whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{
                    delay: i * 0.12,
                    duration: 0.8,
                    type: "spring",
                    stiffness: 100,
                    damping: 14,
                  }}
                  whileHover={{ y: -12, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                  className="h-full"
                >
                  <div className={`p-6 md:p-8 rounded-2xl border ${feature.border} bg-white/[0.02] backdrop-blur-sm relative overflow-hidden transition-all duration-500 h-full flex flex-col`}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl" style={{ background: `radial-gradient(ellipse at 50% 0%, ${feature.glow} 0%, transparent 60%)` }} />

                    <motion.div
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${feature.accent} flex items-center justify-center mb-5 shadow-lg relative z-10 shrink-0`}
                      style={{ boxShadow: `0 8px 30px ${feature.glow}` }}
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <feature.icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </motion.div>
                    <h3 className="font-heading font-bold text-lg md:text-xl text-white mb-2 relative z-10 leading-tight">{feature.title}</h3>
                    <p className="text-white/30 text-sm leading-relaxed relative z-10 flex-1">{feature.desc}</p>
                  </div>
                </motion.div>
              </TiltCard>
            ))}
          </div>
        </div>
      </ImmersiveScene>
      <ImmersiveScene variant="fog" className="py-28 md:py-40 bg-[#050505]">

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-20">
            <motion.p
              className="text-violet-400/80 text-xs tracking-[0.5em] uppercase font-medium mb-6"
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Our Spaces
            </motion.p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-heading font-black text-white mb-6 tracking-tight leading-[1.15]">
              <CinematicText delay={0.1}>Amenities &</CinematicText>
              <br />
              <CinematicText delay={0.4} gradient>Facilities</CinematicText>
            </h2>
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.4 }}
              className="w-24 h-[1px] bg-gradient-to-r from-transparent via-violet-500/60 to-transparent mx-auto"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(dynamicAmenities.length > 0
              ? dynamicAmenities.map(a => ({
                  image: a.imageUrl,
                  title: a.title,
                  desc: a.description,
                  icon: ICON_MAP[a.icon] || Star,
                }))
              : AMENITY_SHOWCASE
            ).map((amenity, i) => {
              const amenityColors = [
                { accent: "from-violet-500 to-purple-400", glow: "rgba(139,92,246,0.2)", border: "border-violet-500/20 hover:border-violet-500/40" },
                { accent: "from-cyan-500 to-blue-400", glow: "rgba(6,182,212,0.2)", border: "border-cyan-500/20 hover:border-cyan-500/40" },
                { accent: "from-amber-500 to-orange-400", glow: "rgba(245,158,11,0.2)", border: "border-amber-500/20 hover:border-amber-500/40" },
                { accent: "from-emerald-500 to-teal-400", glow: "rgba(16,185,129,0.2)", border: "border-emerald-500/20 hover:border-emerald-500/40" },
              ];
              const c = amenityColors[i % amenityColors.length];
              return (
                <TiltCard
                  key={i}
                  intensity={12}
                  glowColor={c.glow}
                  className="relative group cursor-default h-full"
                  data-testid={`amenity-card-${i}`}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 80, rotateX: 30 }}
                    whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{
                      delay: i * 0.12,
                      duration: 0.8,
                      type: "spring",
                      stiffness: 100,
                      damping: 14,
                    }}
                    whileHover={{ y: -12, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                    className="h-full"
                  >
                    <div className={`p-6 md:p-8 rounded-2xl border ${c.border} bg-white/[0.02] backdrop-blur-sm relative overflow-hidden transition-all duration-500 h-full flex flex-col`}>
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl" style={{ background: `radial-gradient(ellipse at 50% 0%, ${c.glow} 0%, transparent 60%)` }} />

                      <motion.div
                        className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${c.accent} flex items-center justify-center mb-5 shadow-lg relative z-10 shrink-0`}
                        style={{ boxShadow: `0 8px 30px ${c.glow}` }}
                        whileHover={{ scale: 1.15, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                      >
                        <amenity.icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                      </motion.div>
                      <h3 className="font-heading font-bold text-lg md:text-xl text-white mb-2 relative z-10 leading-tight">{amenity.title}</h3>
                      <p className="text-white/30 text-sm leading-relaxed relative z-10 flex-1">{amenity.desc}</p>
                    </div>
                  </motion.div>
                </TiltCard>
              );
            })}
          </div>
        </div>
      </ImmersiveScene>
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
            glow: "rgba(16,185,129,0.15)",
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
            glow: "rgba(139,92,246,0.15)",
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
            glow: "rgba(245,158,11,0.18)",
            decorLine: "from-transparent via-amber-500/30 to-transparent",
            occupancyBg: "bg-amber-900/40 border-amber-700/30",
            occupancyText: "text-amber-300",
          },
        ];
        return (
          <>
            <ImmersiveScene variant="depth" className="py-28 md:py-40 bg-[#050505]" data-testid="section-housing-plans">

              <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-20">
                  <motion.p
                    className="text-emerald-400/80 text-xs tracking-[0.5em] uppercase font-medium mb-6"
                    initial={{ opacity: 0, y: -20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                  >
                    Curated Living Experiences
                  </motion.p>
                  <h2 className="text-4xl md:text-6xl lg:text-7xl font-heading font-black text-white mb-6 tracking-tight leading-[1.15]">
                    <CinematicText delay={0.1}>Housing</CinematicText>
                    {" "}
                    <CinematicText delay={0.3} gradient>Plans</CinematicText>
                  </h2>
                  <motion.p
                    className="text-white/25 max-w-xl mx-auto text-sm md:text-base leading-relaxed"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                  >
                    Tailored tiers of comfort, service, and luxury. Choose the experience that matches your lifestyle.
                  </motion.p>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.6 }}
                    className="w-32 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent mx-auto mt-8"
                  />
                </div>

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
                          <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-r from-transparent to-white/15" />
                          <div className="flex items-center gap-2 px-5 py-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-sm">
                            <Building2 className="w-4 h-4 text-amber-400" />
                            <span className="text-white/50 text-xs tracking-wider uppercase font-medium">{propName}</span>
                          </div>
                          <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-l from-transparent to-white/15" />
                        </motion.div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
                        {plans.map((plan: any, idx: number) => {
                          const tier = plan.tierLevel ?? idx;
                          const maxTier = Math.max(...plans.map((p: any) => p.tierLevel ?? 0));
                          const isTop = tier === maxTier;
                          const isHighlighted = plan.isHighlighted;
                          const designIdx = plans.length <= 2
                            ? (isHighlighted || isTop ? tierDesigns.length - 1 : 0)
                            : Math.min(tier, tierDesigns.length - 1);
                          const d = tierDesigns[designIdx];
                          const price = Number(plan.basePrice || 0);
                          const features = (plan.items || []).slice(0, 6);
                          return (
                            <TiltCard
                              key={plan.id}
                              intensity={10}
                              glowColor={d.glow}
                              className="relative group"
                              data-testid={`plan-card-home-${plan.id}`}
                            >
                            <motion.div
                              initial={{ opacity: 0, y: 40, scale: 0.95 }}
                              whileInView={{ opacity: 1, y: 0, scale: 1 }}
                              viewport={{ once: true, margin: "-50px" }}
                              transition={{ duration: 0.5, delay: idx * 0.12, ease: "easeOut" }}
                              whileHover={{ y: -12, scale: 1.02, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                              className="relative h-full"
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

                              <div className={`${d.cardBg} rounded-[28px] overflow-hidden h-full flex flex-col relative border border-white/[0.08] group-hover:border-white/[0.18] transition-all duration-500`} style={{ boxShadow: `0 8px 40px -8px ${d.glow}, 0 0 80px -20px ${d.glow}` }}>
                                <div className="absolute inset-0 rounded-[28px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${d.glow} 0%, transparent 50%)`, boxShadow: `0 0 80px 20px ${d.glow}` }} />

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
                            </TiltCard>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ImmersiveScene>
          </>
        );
      })()}
      {instagramPosts.length > 0 && (
        <>
          <ImmersiveScene variant="aurora" className="py-28 md:py-40 bg-[#050505]"
            data-testid="instagram-feed-section"
          >
            <div className="container mx-auto px-4 relative z-10"
              onMouseEnter={() => setIgAutoPlaying(false)}
              onMouseLeave={() => setIgAutoPlaying(true)}
            >
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
                className="flex flex-col md:flex-row items-start md:items-end justify-between mb-12"
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}>
                      <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    </div>
                    <p className="text-sm tracking-[0.3em] uppercase font-medium" style={{ background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Live From Instagram</p>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-heading font-black text-white mb-2">
                    Life at Hsquareliving
                  </h2>
                  <p className="text-white/30 font-light">Follow our journey and see what makes us special</p>
                </div>
                <a
                  href="https://www.instagram.com/hsquareliving/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 md:mt-0 group flex items-center gap-2 text-sm font-semibold tracking-wider uppercase hover:opacity-80 transition-opacity"
                  style={{ background: "linear-gradient(135deg, #f09433, #dc2743, #bc1888)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                  data-testid="link-instagram-profile"
                >
                  @hsquareliving <ExternalLink className="w-4 h-4 text-pink-500 group-hover:translate-x-0.5 transition-transform" />
                </a>
              </motion.div>

              <div className="relative">
                <div className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden rounded-2xl shadow-2xl border border-white/[0.06]">
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
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs uppercase tracking-wider font-semibold hover:bg-white/20 transition-all rounded-full"
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
                    aria-label="Previous Instagram post"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIgCurrentSlide(prev => (prev + 1) % instagramPosts.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/50 transition-all"
                    data-testid="button-ig-next"
                    aria-label="Next Instagram post"
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
                          : "bg-white/20 hover:bg-white/40"
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
                      className={`aspect-square overflow-hidden rounded-lg transition-all duration-300 border ${
                        i === igCurrentSlide ? "ring-2 ring-pink-500 ring-offset-2 ring-offset-[#050505] scale-95 border-pink-500/50" : "opacity-60 hover:opacity-100 border-white/[0.06]"
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
          </ImmersiveScene>
        </>
      )}
      {!propertiesLoading && properties.length > 0 && (
        <>
          <ImmersiveScene variant="grid" className="py-28 md:py-40 bg-[#050505]">

            <div className="container mx-auto px-4 relative z-10">
              <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-16">
                <div>
                  <motion.p
                    className="text-amber-400/80 text-xs tracking-[0.5em] uppercase font-medium mb-6"
                    initial={{ opacity: 0, y: -20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                  >
                    Properties
                  </motion.p>
                  <h2 className="text-4xl md:text-6xl lg:text-7xl font-heading font-black text-white tracking-tight leading-[1.15]">
                    <CinematicText delay={0.1}>Featured</CinematicText>
                    <br />
                    <CinematicText delay={0.3} gradient>Residences</CinematicText>
                  </h2>
                </div>
                <Link href="/properties">
                  <Button variant="ghost" className="text-white/40 hover:text-white hover:bg-white/5 mt-4 md:mt-0 group tracking-widest uppercase text-xs" data-testid="link-view-all-properties">
                    View All <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.slice(0, 3).map((property: any, i: number) => {
                  const prices = property.roomTypes?.map((r: any) =>
                    property.bookingMode === "academic_year" ? (r.academicYearPrice || r.basePrice * 11) : r.basePrice
                  ).filter((p: number) => p > 0) || [];
                  const lowestPrice = prices.length > 0 ? Math.min(...prices) : 0;
                  const totalBeds = property.roomTypes?.reduce((sum: number, r: any) => sum + (r.availableBeds || 0), 0) || 0;

                  const propColors = [
                    { accent: "from-amber-500 to-orange-400", glow: "rgba(245,158,11,0.2)", border: "border-amber-500/20 hover:border-amber-500/40" },
                    { accent: "from-violet-500 to-purple-400", glow: "rgba(139,92,246,0.2)", border: "border-violet-500/20 hover:border-violet-500/40" },
                    { accent: "from-cyan-500 to-blue-400", glow: "rgba(6,182,212,0.2)", border: "border-cyan-500/20 hover:border-cyan-500/40" },
                  ];
                  const pc = propColors[i % propColors.length];

                  return (
                    <TiltCard
                      key={property.id}
                      intensity={12}
                      glowColor={pc.glow}
                      className="relative group cursor-pointer h-full"
                      data-testid={`property-card-${property.id}`}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 80, rotateX: 30 }}
                        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{
                          delay: i * 0.15,
                          duration: 0.8,
                          type: "spring",
                          stiffness: 100,
                          damping: 14,
                        }}
                        whileHover={{ y: -12, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                        className="h-full"
                      >
                        <Link href={`/properties/${property.slug || property.id}`}>
                          <div className={`p-6 md:p-8 rounded-2xl border ${pc.border} bg-white/[0.02] backdrop-blur-sm relative overflow-hidden transition-all duration-500 h-full flex flex-col`}>
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl" style={{ background: `radial-gradient(ellipse at 50% 0%, ${pc.glow} 0%, transparent 60%)` }} />

                            <motion.div
                              className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${pc.accent} flex items-center justify-center mb-5 shadow-lg relative z-10 shrink-0`}
                              style={{ boxShadow: `0 8px 30px ${pc.glow}` }}
                              whileHover={{ scale: 1.15, rotate: 5 }}
                              transition={{ type: "spring", stiffness: 400, damping: 15 }}
                            >
                              <Building2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
                            </motion.div>

                            <h3 className="font-heading font-bold text-lg md:text-xl text-white mb-2 relative z-10 leading-tight group-hover:text-amber-400 transition-colors">{property.name}</h3>
                            <p className="text-white/30 text-sm flex items-center gap-1 mb-4 relative z-10">
                              <MapPin className="w-3.5 h-3.5" />
                              {property.location}
                            </p>

                            <div className="flex items-baseline gap-2 mb-4 relative z-10">
                              <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">
                                {lowestPrice > 0 ? `₹${lowestPrice.toLocaleString()}` : "—"}
                              </span>
                              <span className="text-xs text-white/25">
                                {property.bookingMode === "academic_year" ? "/ year" : "/ month"}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 relative z-10">
                              <span className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full ${
                                property.bookingMode === "academic_year"
                                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              }`}>
                                {property.bookingMode === "academic_year" ? "Academic Year" : "Monthly"}
                              </span>
                              {totalBeds > 0 && totalBeds < 5 && (
                                <span className="px-2.5 py-1 text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30 uppercase tracking-wider rounded-full">
                                  Only {totalBeds} left
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-4 relative z-10">
                              {property.amenities?.slice(0, 3).map((am: string) => (
                                <span key={am} className="px-2 py-0.5 text-xs text-white/40 bg-white/[0.04] border border-white/[0.06] rounded-full">
                                  {am}
                                </span>
                              ))}
                              {property.amenities?.length > 3 && (
                                <span className="px-2 py-0.5 text-xs text-amber-400/60 bg-amber-500/[0.06] border border-amber-500/[0.12] rounded-full">
                                  +{property.amenities.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    </TiltCard>
                  );
                })}
              </div>
            </div>
          </ImmersiveScene>
        </>
      )}
      <ImmersiveScene variant="aurora" className="py-28 md:py-40 bg-[#050505]">

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <motion.p
              className="text-cyan-400/80 text-xs tracking-[0.5em] uppercase font-medium mb-6"
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Strategically Located
            </motion.p>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-heading font-black text-white mb-6 tracking-tight leading-[1.15]">
              <CinematicText delay={0.1}>Near Top</CinematicText>
              {" "}
              <CinematicText delay={0.3} gradient>Colleges</CinematicText>
            </h2>
            <motion.p
              className="text-white/25 max-w-2xl mx-auto text-sm md:text-base leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              Our hostels and co-living spaces are minutes away from Mumbai's top educational institutions, making your daily commute effortless.
            </motion.p>
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.6 }}
              className="w-32 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent mx-auto mt-8"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="colleges-grid">
            {[
              { name: "NMIMS University", area: "Vile Parle West", distance: "5 min", color: "from-cyan-500 to-blue-500", glow: "rgba(6,182,212,0.2)", href: "/hostel-near-nmims" },
              { name: "Mithibai College", area: "Vile Parle West", distance: "5 min", color: "from-violet-500 to-purple-500", glow: "rgba(139,92,246,0.2)", href: "/hostel-near-mithibai" },
              { name: "Mukesh Patel School of Technology", area: "Vile Parle West", distance: "5 min", color: "from-amber-500 to-orange-500", glow: "rgba(245,158,11,0.2)", href: "/hostel-near-mukesh-patel" },
              { name: "Whistling Woods International", area: "Goregaon East", distance: "10 min", color: "from-emerald-500 to-green-500", glow: "rgba(16,185,129,0.2)", href: "/hostel-near-whistling-woods" },
              { name: "DJ Sanghvi College of Engineering", area: "Vile Parle West", distance: "8 min", color: "from-pink-500 to-rose-500", glow: "rgba(236,72,153,0.2)", href: "/hostel-near-dj-sanghvi" },
              { name: "NM College of Commerce", area: "Vile Parle West", distance: "5 min", color: "from-sky-500 to-cyan-500", glow: "rgba(14,165,233,0.2)", href: "/hostel-near-nm-college" },
            ].map((college, i) => (
              <motion.div
                key={college.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="group"
                data-testid={`college-card-${i}`}
              >
                <Link href={college.href}>
                <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.04] transition-all duration-500 relative overflow-hidden cursor-pointer">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl" style={{ background: `radial-gradient(ellipse at 50% 0%, ${college.glow} 0%, transparent 60%)` }} />
                  <div className="flex items-start gap-4 relative z-10">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${college.color} flex items-center justify-center shrink-0`} style={{ boxShadow: `0 4px 20px ${college.glow}` }}>
                      <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-bold text-white text-sm md:text-base leading-tight mb-1 group-hover:text-cyan-400 transition-colors">{college.name}</h3>
                      <p className="text-white/30 text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {college.area}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                      <Navigation className="w-3 h-3 text-cyan-400" />
                      <span className="text-cyan-400 text-xs font-semibold">{college.distance}</span>
                    </div>
                  </div>
                </div>
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="mt-12 text-center"
          >
            <p className="text-white/20 text-xs max-w-3xl mx-auto leading-relaxed">
              Also conveniently located near HR College, Jai Hind College, KC College, Narsee Monjee College, SP Jain, Goregaon Station, Andheri Station, and Nesco Exhibition Centre.
            </p>
          </motion.div>
        </div>
      </ImmersiveScene>

      <section className="py-20 md:py-28 bg-[#050505] relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(16,185,129,0.04) 0%, transparent 60%)" }} />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <motion.p
              className="text-emerald-400/80 text-xs tracking-[0.5em] uppercase font-medium mb-6 text-center"
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              Your Second Home in Mumbai
            </motion.p>
            <h2 className="text-3xl md:text-5xl font-heading font-black text-white mb-10 tracking-tight leading-[1.2] text-center">
              <CinematicText delay={0.1}>Premium Hostel &</CinematicText>
              {" "}
              <CinematicText delay={0.3} gradient>Co-Living in Mumbai</CinematicText>
            </h2>

            <div className="space-y-6 text-white/35 text-sm md:text-base leading-relaxed" data-testid="seo-content-block">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                Hsquare Hostel is a premium co-living and hostel brand in Mumbai offering comfortable, secure, and affordable stays for students, working professionals, and travelers. Located in prime areas like Goregaon, Juhu, and Andheri, Hsquare provides modern amenities including WiFi, housekeeping, laundry, security, and community living experiences.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                Whether you're looking for an affordable hostel in Mumbai for students near NMIMS, Mithibai College, or Mukesh Patel, or a premium hostel near Goregaon station with WiFi and food — Hsquare is your perfect second home. We offer single, double, and triple sharing hostel rooms with fully furnished interiors, daily housekeeping, and nutritious meals.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
              >
                Our co-living spaces in Andheri West and shared accommodation options come with gym access, study lounges, rooftop terraces, and 24/7 CCTV security. From short-term stays to long-term student accommodation, Hsquare offers the best hostel experience in Mumbai with flexible payment plans and a vibrant community of like-minded residents.
              </motion.p>
            </div>

            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.8 }}
              className="w-32 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent mx-auto mt-10"
            />
          </div>
        </div>
      </section>

      <section className="relative py-36 md:py-48 overflow-hidden">
        <div className="absolute inset-0">
          <motion.img
            src={heroTerrace}
            alt=""
            className="w-full h-full object-cover"
            initial={{ scale: 1.2 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 3, ease: "easeOut" }}
          />
          <div className="absolute inset-0 bg-black/90" />
          <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 250px 100px rgba(0,0,0,0.9)" }} />
        </div>
        <div className="absolute inset-0 z-[2] pointer-events-none" style={{
          background: "radial-gradient(ellipse at 30% 40%, rgba(6,182,212,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(139,92,246,0.06) 0%, transparent 50%)",
        }} />

        <div className="relative z-10 container mx-auto px-4 text-center">
          <motion.p
            className="text-cyan-400 text-xs tracking-[0.5em] uppercase font-medium mb-6"
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Ready to Begin
          </motion.p>
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-heading font-black text-white mb-8 leading-[1.15] tracking-tighter" style={{ textShadow: "0 0 80px rgba(0,0,0,0.8)" }}>
            <CinematicText delay={0.3}>Your Premium Living</CinematicText>
            <br />
            <CinematicText delay={0.6} gradient>Experience Awaits</CinematicText>
          </h2>
          <motion.p
            className="text-white/30 text-lg md:text-xl max-w-2xl mx-auto mb-14 font-light"
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            Secure your spot in minutes. Premium accommodation with flexible payment plans, starting from ₹18,000/-.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            <Link href="/properties">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Button
                  size="lg"
                  className="bg-white text-black hover:bg-white/90 rounded-full h-14 px-14 font-bold tracking-wider uppercase text-sm shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] transition-shadow"
                  data-testid="button-cta-book"
                >
                  Book Your Stay <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </motion.div>
            </Link>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent backdrop-blur-md border border-white/15 text-white hover:bg-white/10 rounded-full h-14 px-14 font-semibold tracking-wider uppercase text-sm hover:border-white/30 transition-all"
                onClick={() => window.open(`tel:${footerPhone.replace(/\s/g, "")}`)}
                data-testid="button-cta-call"
              >
                <Phone className="w-4 h-4 mr-2" />
                Contact Us
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>
      <section id="app-download-section" className="relative py-20 md:py-28 overflow-hidden" data-testid="app-download-section">
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#0a0808] to-[#050505]" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-amber-500/8 via-orange-500/5 to-rose-500/8 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm mb-6">
                <Smartphone className="w-4 h-4 text-amber-400" />
                <span className="text-xs uppercase tracking-[0.25em] text-white/60 font-medium">Mobile App</span>
              </div>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-black leading-[1.1] mb-5">
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/60">
                  Your Living Experience,{" "}
                </span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400">
                  In Your Pocket
                </span>
              </h2>

              <p className="text-white/40 text-base md:text-lg leading-relaxed mb-8 max-w-md">
                Download HsquareConnect — your smart companion for seamless hostel living. Manage everything from your phone.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { icon: Bell, label: "Instant Alerts", desc: "Stay updated" },
                  { icon: Wallet, label: "Digital Wallet", desc: "Easy payments" },
                  { icon: Utensils, label: "Meal Tracking", desc: "Daily menus" },
                  { icon: QrCode, label: "Quick Check-in", desc: "Scan & go" },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <f.icon className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white/70">{f.label}</p>
                      <p className="text-[10px] text-white/30">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-4 flex-wrap">
                <a
                  href="https://apps.apple.com/in/app/hsquareconnect-app/id6759179340"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-white text-black hover:bg-white/90 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)] group"
                  data-testid="link-app-store-hero"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <div>
                    <p className="text-[10px] leading-none opacity-60">Download on the</p>
                    <p className="text-base font-bold leading-tight">App Store</p>
                  </div>
                </a>

                {androidDownloadUrl && (
                <a
                  href={androidDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm group"
                  data-testid="link-android-download"
                >
                  <svg className="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.523 15.3414c-.5 0-.9.4-.9.9v4.3c0 .5-.4.9-.9.9h-7.8c-.5 0-.9-.4-.9-.9v-4.3c0-.5-.4-.9-.9-.9s-.9.4-.9.9v4.3c0 1.5 1.2 2.7 2.7 2.7h7.8c1.5 0 2.7-1.2 2.7-2.7v-4.3c0-.5-.4-.9-.9-.9z"/>
                    <path d="M11.323 17.6414c.1.1.3.2.5.2h.4c.2 0 .3-.1.5-.2l3.6-3.6c.4-.4.4-.9 0-1.3s-.9-.4-1.3 0l-2 2v-11.7c0-.5-.4-.9-.9-.9s-.9.4-.9.9v11.7l-2-2c-.4-.4-.9-.4-1.3 0s-.4.9 0 1.3z"/>
                  </svg>
                  <div>
                    <p className="text-[10px] leading-none text-white/50">Download for</p>
                    <p className="text-base font-bold leading-tight">Android</p>
                  </div>
                </a>
                )}

                <div className="flex items-center gap-1.5 self-center">
                  <div className="flex">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs text-white/40 ml-1">5.0 rating</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className="relative flex justify-center"
            >
              <div className="relative">
                <div className="absolute -inset-8 bg-gradient-to-br from-amber-500/20 via-transparent to-orange-500/20 rounded-[3rem] blur-2xl" />
                <div className="relative w-[260px] h-[520px] rounded-[2.5rem] bg-gradient-to-b from-stone-800 to-stone-900 border-2 border-stone-700 shadow-2xl overflow-hidden">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-b-2xl z-10" />

                  <div className="w-full h-full bg-gradient-to-b from-[#8B1A4A] via-[#6B1540] to-[#4A0E2E] flex flex-col items-center justify-center p-8">
                    <div className="w-20 h-20 rounded-2xl bg-white shadow-xl flex items-center justify-center mb-5">
                      <img src={hsquareLogo} alt="Hsquare" className="w-14 h-14 object-contain" />
                    </div>
                    <h3 className="text-white font-heading font-bold text-lg text-center mb-1">HsquareConnect</h3>
                    <p className="text-white/60 text-xs text-center mb-6">Your Smart Living Companion</p>

                    <div className="w-full space-y-2.5">
                      {["Dashboard", "My Room", "Meals", "Wallet", "Support"].map((item, i) => (
                        <div key={item} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm">
                          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-sm bg-white/40" />
                          </div>
                          <span className="text-white/80 text-xs font-medium">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/20 rounded-full blur-md" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-24 right-6 z-40 w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] transition-shadow"
            data-testid="button-scroll-top"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
      <PropertyTourModal
        isOpen={tourModalOpen}
        onClose={() => setTourModalOpen(false)}
      />
    </div>
  );
}
