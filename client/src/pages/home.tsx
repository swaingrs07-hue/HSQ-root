import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
  useMemo,
  useContext,
} from "react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
// Hero slides are sourced from real published-property photos via the API
// (server/hero-slides.ts) and SSR-injected into window.__INITIAL_HERO_SLIDES__
// (server/seo-meta.ts) — no stock fallback in the hero. The constants below
// are only used for non-hero decorative elements (amenity cards, section
// backgrounds) and are kept for now to avoid breaking secondary visuals.
const heroRoom = "/hero/hero-room.webp";
const heroTerrace = "/hero/hero-terrace.webp";
const heroDining = "/hero/hero-dining.webp";
import amenityGym from "@/assets/amenity-gym.jpg";
import amenityStudy from "@/assets/amenity-study.jpg";
import hsquareLogo from "@assets/Hsquare_Logo_File-07_1771351647884.png";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Wifi,
  Shield,
  Coffee,
  Users,
  Star,
  MapPin,
  Calendar,
  Building2,
  Sparkles,
  Clock,
  Phone,
  ChevronDown,
  Award,
  Utensils,
  Dumbbell,
  BookOpen,
  Heart,
  ExternalLink,
  ArrowUp,
  GraduationCap,
  Navigation,
  Smartphone,
  Bell,
  Wallet,
  QrCode,
  Check,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useTransform,
  useMotionValue,
  useSpring,
  useInView,
} from "framer-motion";
import { PropertyTourModal } from "@/components/property-tour-modal";
import { SmartSearch } from "@/components/smart-search";
import { getProperties } from "@/lib/api";
import { ParticleBackground } from "@/components/particle-background";
import { TubesContext, useTubesActive } from "@/contexts/tubes-context";
import { HsquareLoadingScreen } from "@/components/hsquare-loading-screen";
import { PlansHallway } from "@/components/plans-hallway";

// Module-level flag: once the HSQUARE LIVING splash has played to
// completion in this tab, never show it again — even if the user
// navigates away and comes back to "/". A full page reload resets
// this naturally because the module is re-evaluated.
let loaderSeen = false;

// True when the user is on a platform whose browser compositor handles
// `mask-image` on a playing <video> without dropping into a software
// path. Apple platforms (Mac Safari/Chrome and iOS) handle it on the
// GPU; Windows-Chrome and most Linux builds fall to a CPU compositor
// that visibly tanks framerate of the entire page (this is the same
// invariant documented in replit.md for the plans-hallway video).
// We use this to gate any per-frame mask effects applied to playing
// video elements — static images and non-playing layers are unaffected.
// SSR-safe: returns false (the safe path — skip the mask) on the
// server, so the first hydrate paint matches the client.
const IS_FAST_VIDEO_COMPOSITOR =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || "");

// Tiny inline SVG data URL used as the absolute-last-resort hero
// poster when the active slide has no image, the API hasn't
// returned a property image yet, and we still need *something*
// visible so the hero is never black behind the splash. Dark
// brand-gradient (matches the splash background) and ~400 bytes,
// so it costs nothing on the wire.
const HERO_POSTER_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080' preserveAspectRatio='xMidYMid slice'>" +
      "<defs><radialGradient id='g' cx='50%' cy='40%' r='80%'>" +
      "<stop offset='0%' stop-color='#1a0a16'/>" +
      "<stop offset='55%' stop-color='#0a0a0a'/>" +
      "<stop offset='100%' stop-color='#000'/>" +
      "</radialGradient></defs>" +
      "<rect width='1920' height='1080' fill='url(#g)'/></svg>",
  );

function useMouseTilt(intensity = 15) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(
    useTransform(y, [-0.5, 0.5], [intensity, -intensity]),
    { stiffness: 300, damping: 30 },
  );
  const rotateY = useSpring(
    useTransform(x, [-0.5, 0.5], [-intensity, intensity]),
    { stiffness: 300, damping: 30 },
  );
  const glowX = useSpring(useTransform(x, [-0.5, 0.5], [0, 100]), {
    stiffness: 200,
    damping: 25,
  });
  const glowY = useSpring(useTransform(y, [-0.5, 0.5], [0, 100]), {
    stiffness: 200,
    damping: 25,
  });
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      x.set((e.clientX - rect.left) / rect.width - 0.5);
      y.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [x, y],
  );
  const onMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);
  return { rotateX, rotateY, glowX, glowY, onMouseMove, onMouseLeave };
}

function TiltCard({
  children,
  className = "",
  intensity = 12,
  glowColor = "rgba(245,158,11,0.15)",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
  glowColor?: string;
  [key: string]: any;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });
  const prefersReduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({
        rx: -ny * intensity,
        ry: nx * intensity,
        gx: (nx + 0.5) * 100,
        gy: (ny + 0.5) * 100,
      });
    },
    [intensity],
  );

  const handleMouseLeave = useCallback(() => {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 });
  }, []);

  if (prefersReduced.current) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 1000 }}
      {...props}
    >
      <div
        className="relative h-full transition-transform duration-200 ease-out"
        style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}
      >
        {children}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, ${glowColor} 0%, transparent 60%)`,
          }}
        />
      </div>
    </div>
  );
}

function Floating3DShape({
  type,
  size,
  color,
  delay,
  x,
  y,
  duration = 20,
}: {
  type: "cube" | "ring" | "sphere" | "diamond" | "hexagon";
  size: number;
  color: string;
  delay: number;
  x: string;
  y: string;
  duration?: number;
}) {
  const shapes: Record<string, React.ReactNode> = {
    cube: (
      <div style={{ width: size, height: size }} className="relative">
        <div
          className="absolute inset-0 border rounded-lg"
          style={{ borderColor: color, background: `${color}15` }}
        />
      </div>
    ),
    ring: (
      <div
        className="rounded-full border-2"
        style={{
          width: size,
          height: size,
          borderColor: color,
          boxShadow: `0 0 ${size / 2}px ${color}40`,
        }}
      />
    ),
    sphere: (
      <div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 30% 30%, ${color}60, ${color}10, transparent)`,
        }}
      />
    ),
    diamond: (
      <div
        style={{
          width: size,
          height: size,
          transform: "rotate(45deg)",
          border: `2px solid ${color}`,
          background: `${color}10`,
        }}
      />
    ),
    hexagon: (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <polygon
          points="50,2 95,25 95,75 50,98 5,75 5,25"
          fill={`${color}10`}
          stroke={color}
          strokeWidth="1.5"
        />
      </svg>
    ),
  };

  return (
    <motion.div
      className="absolute pointer-events-none z-[3]"
      style={{ left: x, top: y, willChange: "transform, opacity" }}
      animate={{
        y: [0, -20, 0, 15, 0],
        opacity: [0.3, 0.6, 0.3],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {shapes[type]}
    </motion.div>
  );
}

function ImmersiveScene({
  children,
  className = "",
  variant = "default",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "fog" | "grid" | "aurora" | "depth";
  style?: React.CSSProperties;
  [key: string]: any;
}) {
  const backgrounds: Record<string, React.ReactNode> = {
    default: null,
    fog: (
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(120,80,200,0.12) 0%, transparent 60%)",
        }}
      />
    ),
    grid: (
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 80%, rgba(245,158,11,0.1) 0%, transparent 50%)",
        }}
      />
    ),
    aurora: (
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 50%, rgba(0,255,200,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, rgba(120,0,255,0.06) 0%, transparent 50%)",
        }}
      />
    ),
    depth: (
      <div
        className="absolute inset-0"
        style={{
          boxShadow: "inset 0 0 200px 60px rgba(0,0,0,0.5)",
        }}
      />
    ),
  };

  return (
    <section className={`relative ${className}`} style={style}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {backgrounds[variant]}
      </div>
      {children}
    </section>
  );
}

function CinematicText({
  children,
  className = "",
  delay = 0,
  gradient = false,
}: {
  children: string;
  className?: string;
  delay?: number;
  gradient?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  const words = children.split(" ");

  return (
    <span ref={ref} className={`inline ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className={`inline-block ${gradient ? "bg-gradient-to-r from-emerald-400 via-amber-400 to-violet-400 bg-clip-text text-transparent" : ""}`}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{
            duration: 0.4,
            delay: delay + i * 0.08,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {word}
          {i < words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}

function ShimmerText({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`relative ${className}`}>
      {children}
      <motion.span
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent bg-clip-text"
        style={{ backgroundSize: "200% 100%" }}
        animate={{ backgroundPosition: ["200% 0%", "-200% 0%"] }}
        transition={{
          duration: 4,
          repeat: Infinity,
          repeatDelay: 3,
          ease: "linear",
        }}
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

// Empty fallback — hero slides come from real published-property photos
// via the SSR-injected window.__INITIAL_HERO_SLIDES__ or /api/hero-slides.
const DEFAULT_SLIDES: SlideData[] = [];

const KEN_BURNS_VARIANTS = [
  {
    initial: { scale: 1.0, x: "0%", y: "0%" },
    animate: { scale: 1.15, x: "-2%", y: "-1%" },
  },
  {
    initial: { scale: 1.15, x: "2%", y: "1%" },
    animate: { scale: 1.0, x: "0%", y: "0%" },
  },
  {
    initial: { scale: 1.0, x: "1%", y: "-1%" },
    animate: { scale: 1.12, x: "-1%", y: "1%" },
  },
  {
    initial: { scale: 1.1, x: "-1%", y: "0%" },
    animate: { scale: 1.0, x: "1%", y: "-1%" },
  },
];

const ICON_MAP: Record<string, any> = {
  Star,
  Wifi,
  Shield,
  Coffee,
  Users,
  Dumbbell,
  BookOpen,
  Heart,
  Utensils,
  Award,
  Clock,
  MapPin,
  Building2,
  Sparkles,
  Calendar,
  Phone,
};

const AMENITY_SHOWCASE = [
  {
    image: amenityGym,
    title: "Fitness Center",
    desc: "State-of-the-art equipment for your wellness journey",
    icon: Dumbbell,
  },
  {
    image: amenityStudy,
    title: "Study Lounge",
    desc: "Quiet, modern spaces designed for academic excellence",
    icon: BookOpen,
  },
  {
    image: heroRoom,
    title: "Premium Rooms",
    desc: "Elegantly furnished rooms with premium bedding",
    icon: Star,
  },
  {
    image: heroDining,
    title: "Gourmet Dining",
    desc: "Chef-prepared meals with diverse cuisine options",
    icon: Utensils,
  },
];

const STATS = [
  { value: "5000+", label: "Happy Residents", numericEnd: 5000, suffix: "+" },
  { value: "15+", label: "Premium Properties", numericEnd: 15, suffix: "+" },
  { value: "98%", label: "Satisfaction Rate", numericEnd: 98, suffix: "%" },
  { value: "24/7", label: "Support & Security", numericEnd: 0, suffix: "" },
];

function AnimatedCounter({
  end,
  suffix,
  label,
}: {
  end: number;
  suffix: string;
  label: string;
}) {
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
      { threshold: 0.5 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  if (end === 0) {
    return (
      <div
        ref={ref}
        className="flex flex-col items-center justify-center text-center"
      >
        <motion.div
          className="text-5xl md:text-7xl font-heading font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/50"
          initial={{ scale: 0.5, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 15,
            delay: 0.3,
          }}
          style={{ textShadow: "0 0 60px rgba(0,200,255,0.3)" }}
        >
          24/7
        </motion.div>
        <div className="text-[10px] md:text-xs text-white/30 uppercase tracking-[0.3em] font-medium mt-3">
          {label}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="flex flex-col items-center justify-center text-center"
    >
      <motion.div
        className="text-5xl md:text-7xl font-heading font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/50"
        animate={
          done
            ? {
                scale: [1, 1.15, 1],
                filter: [
                  "drop-shadow(0 0 0px transparent)",
                  "drop-shadow(0 0 30px rgba(0,200,255,0.5))",
                  "drop-shadow(0 0 0px transparent)",
                ],
              }
            : {}
        }
        transition={{ duration: 0.6 }}
        style={{ textShadow: done ? "0 0 40px rgba(0,200,255,0.2)" : "none" }}
      >
        {count.toLocaleString()}
        {suffix}
      </motion.div>
      <div className="text-[10px] md:text-xs text-white/30 uppercase tracking-[0.3em] font-medium mt-3">
        {label}
      </div>
    </div>
  );
}

export default function Home() {
  // Tubes are mounted once at the Layout level so they persist across
  // navigation. We just read the active flag here and use it for the
  // existing hero conditional rendering.
  const tubesActive = useTubesActive();
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying] = useState(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [heroSlides, setHeroSlides] = useState<SlideData[]>(() => {
    if (typeof window !== "undefined") {
      const initial = (window as Window & {
        __INITIAL_HERO_SLIDES__?: Array<{
          imageUrl: string;
          title: string;
          subtitle?: string;
          caption?: string;
          videoUrl?: string | null;
        }>;
      }).__INITIAL_HERO_SLIDES__;
      if (Array.isArray(initial) && initial.length > 0) {
        return initial.map((s) => ({
          image: s.imageUrl,
          title: s.title,
          subtitle: s.subtitle || "",
          caption: s.caption || "",
          videoUrl: s.videoUrl || null,
        }));
      }
    }
    return DEFAULT_SLIDES;
  });
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
      .then((res) => (res.ok ? res.json() : []))
      .then((apiSlides: any[]) => {
        if (apiSlides.length > 0) {
          const mapped = apiSlides.map((s) => ({
            image: s.imageUrl,
            title: s.title,
            subtitle: s.subtitle || "",
            caption: s.caption || "",
            videoUrl: s.videoUrl || null,
          }));
          setHeroSlides(mapped);
          const videoIndex = mapped.findIndex((s) => s.videoUrl);
          if (videoIndex >= 0) setCurrentSlide(videoIndex);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getProperties()
      .then((data) => {
        setProperties(data);
        setPropertiesLoading(false);
      })
      .catch(() => setPropertiesLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/footer-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: any) => {
        if (data?.phone) setFooterPhone(data.phone);
        if (data?.androidDownloadUrl)
          setAndroidDownloadUrl(data.androidDownloadUrl);
      })
      .catch(() => {});
    fetch("/api/homepage-amenities")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        if (data.length > 0)
          setDynamicAmenities(data.filter((a: any) => a.isActive));
      })
      .catch(() => {});
    fetch("/api/plans/featured")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        if (data.length > 0) setFeaturedPlans(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/instagram/posts")
      .then((res) => (res.ok ? res.json() : []))
      .then((posts: any[]) => {
        if (posts.length > 0) setInstagramPosts(posts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (igAutoPlaying && instagramPosts.length > 1) {
      igInterval.current = setInterval(() => {
        setIgCurrentSlide((prev) => (prev + 1) % instagramPosts.length);
      }, 5000);
    }
    return () => {
      if (igInterval.current) clearInterval(igInterval.current);
    };
  }, [igAutoPlaying, instagramPosts.length]);

  const nextSlide = useCallback(() => {
    if (heroSlides.length === 0) return;
    setSlideDirection(1);
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  }, [heroSlides.length]);

  const prevSlide = useCallback(() => {
    if (heroSlides.length === 0) return;
    setSlideDirection(-1);
    setCurrentSlide(
      (prev) => (prev - 1 + heroSlides.length) % heroSlides.length,
    );
  }, [heroSlides.length]);

  // Keep currentSlide in bounds whenever heroSlides changes (e.g. API
  // refresh returns a different number of slides than SSR seeded).
  useEffect(() => {
    if (heroSlides.length === 0) {
      if (currentSlide !== 0) setCurrentSlide(0);
      return;
    }
    if (currentSlide >= heroSlides.length) {
      setCurrentSlide(0);
    }
  }, [heroSlides.length, currentSlide]);

  const activeSlide = heroSlides[currentSlide];

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  // Detect prefers-reduced-motion and small viewports so we can skip the
  // GPU-heavy compositing tricks (tube cut-out, backdrop blur) under the
  // hero video on the slowest devices. We re-evaluate viewport on resize
  // so rotating a phone or resizing the window switches modes correctly.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  const [isSmallViewport, setIsSmallViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setIsSmallViewport(window.innerWidth < 768);
    window.addEventListener("resize", handler, { passive: true });
    return () => window.removeEventListener("resize", handler);
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
  const signedUrlCache = useRef<
    Record<string, { url: string; expires: number; contentType?: string }>
  >({});
  // In-flight dedupe: when both the parallel prewarm effect and the
  // active-slide resolver want the same signed URL, share a single
  // promise instead of firing two parallel fetches for the same
  // object path.
  const signedUrlInFlight = useRef<
    Record<
      string,
      Promise<{ url: string; contentType?: string } | null> | undefined
    >
  >({});

  const fetchSignedUrl = useCallback(
    async (
      objectPath: string,
    ): Promise<{ url: string; contentType?: string } | null> => {
      const cached = signedUrlCache.current[objectPath];
      if (cached && cached.expires > Date.now()) {
        return { url: cached.url, contentType: cached.contentType };
      }
      const existing = signedUrlInFlight.current[objectPath];
      if (existing) return existing;
      const promise = (async () => {
        try {
          const r = await fetch(
            `/api/uploads/signed-url?path=${encodeURIComponent(objectPath)}`,
          );
          if (!r.ok) return null;
          const data = await r.json();
          if (!data?.url) return null;
          signedUrlCache.current[objectPath] = {
            url: data.url,
            expires: Date.now() + 50 * 60 * 1000,
            contentType: data.contentType,
          };
          return { url: data.url, contentType: data.contentType };
        } catch {
          return null;
        } finally {
          delete signedUrlInFlight.current[objectPath];
        }
      })();
      signedUrlInFlight.current[objectPath] = promise;
      return promise;
    },
    [],
  );

  const hasAnyVideo = heroSlides.some((s) => s.videoUrl);

  // Parallel signed-URL pre-warm: as soon as we have any hero slides
  // with a videoUrl, kick off (capped) parallel fetches for ALL of
  // them and prime the cache. By the time the user's active slide
  // changes, the resolved URL is already there — no serial waterfall
  // before video.src can even be set. Cap is 3 concurrent fetches
  // so we don't hammer the signed-url endpoint if a future hero has
  // many video slides.
  useEffect(() => {
    const slideUrls = heroSlides
      .map((s) => s.videoUrl)
      .filter((u): u is string => !!u);
    if (slideUrls.length === 0) return;
    let cancelled = false;
    // Active slide first so its URL gets prioritized.
    const queue = [
      ...slideUrls.filter((u) => u === currentVideoUrl),
      ...slideUrls.filter((u) => u !== currentVideoUrl),
    ];
    let inFlight = 0;
    const pump = () => {
      if (cancelled) return;
      while (inFlight < 3 && queue.length > 0) {
        const url = queue.shift()!;
        const cached = signedUrlCache.current[url];
        if (cached && cached.expires > Date.now()) continue;
        inFlight += 1;
        fetchSignedUrl(url)
          .then((res) => {
            if (cancelled || !res) return;
            console.debug("[hero-video] signed-url-prewarmed", url);
          })
          .finally(() => {
            inFlight -= 1;
            pump();
          });
      }
    };
    pump();
    return () => {
      cancelled = true;
    };
  // currentVideoUrl is intentionally read but excluded from deps —
  // we only re-run the prefetch when the slide LIST changes; the
  // active-slide effect below handles per-slide resolution and will
  // hit the warmed cache.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroSlides]);

  useEffect(() => {
    if (!currentVideoUrl) {
      setResolvedVideoUrl(null);
      setVideoSupported(false);
      return;
    }
    console.debug("[hero-video] slide-picked", currentVideoUrl);
    const cached = signedUrlCache.current[currentVideoUrl];
    if (cached && cached.expires > Date.now()) {
      const ct = cached.contentType || inferContentType(currentVideoUrl);
      const supported = ct ? browserCanPlay(ct) : true;
      console.debug("[hero-video] signed-url-cache-hit", { supported, ct });
      setVideoSupported(supported);
      setResolvedVideoUrl(supported ? cached.url : null);
      if (!supported) {
        console.debug("[hero-video] fallback-shown unsupported-codec", ct);
        setVideoFailed(true);
      }
      return;
    }
    let cancelled = false;
    fetchSignedUrl(currentVideoUrl)
      .then((res) => {
        if (cancelled) return;
        if (res?.url) {
          const ct =
            res.contentType || inferContentType(currentVideoUrl) || "";
          const supported = ct ? browserCanPlay(ct) : true;
          console.debug("[hero-video] signed-url-ok", { supported, ct });
          setVideoSupported(supported);
          if (supported) {
            setResolvedVideoUrl(res.url);
          } else {
            console.debug(
              "[hero-video] fallback-shown unsupported-codec",
              ct,
            );
            setResolvedVideoUrl(null);
            setVideoFailed(true);
          }
        } else {
          console.debug("[hero-video] signed-url-fail empty-response");
          setVideoSupported(false);
          setVideoFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentVideoUrl, browserCanPlay, inferContentType, fetchSignedUrl]);

  // Track when the video became playable (canplay fired). The
  // playback-quality watchdog uses this to skip the first 4s of
  // decoder warm-up, where dropped frames are normal and don't
  // indicate a real playback problem.
  const videoPlaybackStartRef = useRef<number | null>(null);

  // Ref the load-time playback path (`tryPlay` below, which is
  // recreated only when src changes) consults so it can see the
  // latest viewport state without being recreated on every scroll.
  // The actual heroInViewport state is declared further down in the
  // function (after this effect, because of the ordering of the load
  // pipeline), so we seed the ref with the same default the state
  // uses (`true` — pessimistic; if the user is already scrolled past
  // the IntersectionObserver corrects it on first observation) and
  // mirror real updates via a separate effect attached at the state
  // declaration site. This closes the race the architect caught: a
  // `canplay` arriving AFTER the user has already scrolled past the
  // hero would otherwise call `play()` and defeat the dedicated
  // pause effect, because that effect's deps wouldn't fire again.
  const heroInViewportRef = useRef(true);

  useEffect(() => {
    if (!resolvedVideoUrl || !heroVideoRef.current) return;
    const video = heroVideoRef.current;
    setVideoReady(false);
    setVideoFailed(false);
    videoPlaybackStartRef.current = null;

    const tryPlay = () => {
      if (videoPlaybackStartRef.current === null) {
        videoPlaybackStartRef.current = performance.now();
      }
      // Always flip videoReady so the cross-fade and loader hand-off
      // complete on schedule even if the hero happens to be off-screen
      // — the user wouldn't see the video frame anyway.
      setVideoReady(true);
      // Don't start decoding off-screen or in a hidden tab. The
      // dedicated pause/resume effect below owns playback for those
      // cases — when the hero scrolls back into view (or the tab
      // returns to visible) it will call play() at that point. Without
      // this gate, a `canplay` arriving after the user has scrolled
      // past the hero would restart decode and quietly defeat the
      // off-screen pause that exists to save GPU on Windows laptops.
      if (!heroInViewportRef.current) {
        console.debug("[hero-video] canplay -> deferred (off-screen)");
        return;
      }
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        console.debug("[hero-video] canplay -> deferred (hidden tab)");
        return;
      }
      console.debug("[hero-video] canplay -> play()");
      const playPromise = video.play();
      if (playPromise)
        playPromise.catch(() => {
          video.muted = true;
          video.play().catch((err) => {
            console.debug(
              "[hero-video] fallback-shown play-rejected",
              err?.message || err,
            );
            setVideoFailed(true);
          });
        });
    };

    // First-load smoothness on Windows-Chrome: wait for
    // `canplaythrough` (readyState 4 = HAVE_ENOUGH_DATA, browser
    // estimates it can play through to the end without re-buffering)
    // instead of `canplay` / `loadeddata` (readyState 2-3 = only the
    // current frame or one frame ahead is decoded). The earlier
    // events fire the moment the browser can show ONE frame, so the
    // video starts playing while the rest of the MP4 is still
    // streaming over the network — visible as the first-load stutter
    // users reported on Windows. canplaythrough holds the poster a
    // beat longer but guarantees the first play() is smooth.
    //
    // Safety: the progressive failsafe below still calls tryPlay()
    // when `readyState >= 2` after the 12s soft cap, so a slow
    // network that never reaches HAVE_ENOUGH_DATA can't hang the
    // hero — we fall back to the old "play as soon as we can" path.
    const onCanPlayThrough = () => tryPlay();
    const onError = () => {
      console.debug(
        "[hero-video] fallback-shown video-error",
        "code=",
        video.error?.code,
        "msg=",
        video.error?.message,
      );
      setVideoFailed(true);
      setVideoReady(false);
    };

    // Listeners MUST be attached BEFORE setting src and calling
    // load(), otherwise an immediate (sync or microtask) error
    // event from setting an invalid/expired src can fire before
    // we get a chance to listen — leaving video.error set with
    // nobody to react to it. The Task #143 e2e test caught
    // exactly this regression.
    video.addEventListener("canplaythrough", onCanPlayThrough);
    video.addEventListener("error", onError);

    video.src = resolvedVideoUrl;
    video.load();
    // We deliberately DO NOT call video.play() here. The autoPlay
    // attribute on the <video> element handles initial playback
    // once the browser has buffered enough metadata. Calling
    // play() manually right after load() races with autoPlay and
    // can produce spurious aborted-play errors on some
    // browsers / playwright environments.

    // Progressive failsafe (Task #143-tuned, then hardened after
    // the architect review caught a hang risk):
    //   - First check at 12s. We used to flip videoFailed
    //     unconditionally, but with preload="metadata" the
    //     browser legitimately takes longer to reach
    //     HAVE_CURRENT_DATA on slow networks — and a poster is
    //     always visible during the wait so there's no UX cost
    //     to being patient.
    //   - If still not ready and video has had no real error,
    //     keep checking every 4s. Each check tries to detect
    //     forward progress (buffered length growing) and gives
    //     up if there has been no progress across 2 consecutive
    //     idle checks (~8s of true silence after the 12s
    //     initial wait).
    //   - Hard cap at 30s total — if we're still not ready by
    //     then, fall back to the static image regardless. This
    //     prevents the "video mode but never ready" hang the
    //     architect warned about.
    const SOFT_CAP_MS = 12000;
    const HARD_CAP_MS = 30000;
    const POLL_MS = 4000;
    const startedAt = performance.now();
    let lastBufferedEnd = -1;
    let idleChecks = 0;
    const failsafeId = window.setInterval(() => {
      if (videoReady) {
        window.clearInterval(failsafeId);
        return;
      }
      const elapsed = performance.now() - startedAt;
      if (elapsed < SOFT_CAP_MS) return;
      if (video.error) {
        console.debug(
          "[hero-video] failsafe-fired fallback-shown video-error",
          "code=",
          video.error.code,
          "msg=",
          video.error.message,
        );
        setVideoFailed(true);
        window.clearInterval(failsafeId);
        return;
      }
      if (video.readyState >= 2) {
        console.debug("[hero-video] failsafe-fired readyState>=2");
        tryPlay();
        window.clearInterval(failsafeId);
        return;
      }
      // NETWORK_NO_SOURCE === 3 — browser gave up on the URL.
      if (video.networkState === 3) {
        console.debug("[hero-video] failsafe-fired fallback-shown no-source");
        setVideoFailed(true);
        window.clearInterval(failsafeId);
        return;
      }
      // Hard cap: don't let the user sit on a poster forever.
      if (elapsed >= HARD_CAP_MS) {
        console.debug(
          "[hero-video] failsafe-fired fallback-shown hard-cap",
          "readyState=",
          video.readyState,
          "networkState=",
          video.networkState,
        );
        setVideoFailed(true);
        window.clearInterval(failsafeId);
        return;
      }
      // Progress check: is the browser still pulling bytes?
      let bufferedEnd = 0;
      try {
        if (video.buffered && video.buffered.length > 0) {
          bufferedEnd = video.buffered.end(video.buffered.length - 1);
        }
      } catch {
        // ignore
      }
      if (bufferedEnd > lastBufferedEnd) {
        lastBufferedEnd = bufferedEnd;
        idleChecks = 0;
      } else {
        idleChecks += 1;
      }
      if (idleChecks >= 2) {
        console.debug(
          "[hero-video] failsafe-fired fallback-shown no-progress",
          "bufferedEnd=",
          bufferedEnd,
        );
        setVideoFailed(true);
        window.clearInterval(failsafeId);
        return;
      }
      console.debug(
        "[hero-video] failsafe-fired keep-waiting",
        "elapsed=",
        Math.round(elapsed),
        "readyState=",
        video.readyState,
        "bufferedEnd=",
        bufferedEnd,
      );
    }, POLL_MS);

    return () => {
      video.removeEventListener("canplaythrough", onCanPlayThrough);
      video.removeEventListener("error", onError);
      window.clearInterval(failsafeId);
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

  // Track whether the hero section has been fully covered by the next
  // section (the card-swipe in Task #147). When false, the hero is still
  // visible (or partially visible) — the hero <video> should keep playing
  // and the existing tube-pause logic should keep the global tubes
  // paused. When true, the hero is invisible behind the next section so
  // we let the video pause and the tubes resume.
  //
  // We can't observe the hero element with an IntersectionObserver any
  // more, because in Task #147 the hero became `position: sticky` and
  // therefore always reports `isIntersecting: true` (it's pinned to the
  // top of the viewport for the entire scroll length of the page). So we
  // derive the off-screen signal from window.scrollY in a passive scroll
  // handler — once scrollY exceeds one viewport-height of scroll the
  // next section has fully covered the sticky hero.
  //
  // The same scroll handler also drives the `--tubes-reveal-opacity`
  // CSS variable consumed by the global tubes/veil layers in layout.tsx,
  // so the iridescent tubes fade in only after the card-swipe completes
  // (matching the user's reference screenshot for Task #147 where the
  // tubes "activate" from the Why Choose section). The CSS-variable
  // approach means scroll updates do not trigger React re-renders.
  //
  // Reduced-motion users get the old IntersectionObserver behaviour and
  // the tubes stay at full brightness throughout (no scroll-tied fade).
  const [heroFullyCovered, setHeroFullyCovered] = useState(false);
  const heroInViewport = !heroFullyCovered;
  const tubesCtx = useContext(TubesContext);
  // Once the iridescent tubes have been revealed for the first time on
  // this homepage mount, latch them ON. The hero card-swipe threshold
  // is sub-pixel jittery on a slow scroll, and three things flip on
  // the same frame at that threshold (tubes opacity, stats bg, hero
  // visibility) — pre-latch the user occasionally saw the tubes pop
  // 0->1->0->1 right at the boundary, which read as a flicker. After
  // the latch lands, the scroll handler still toggles `heroFullyCovered`
  // both ways (so the hero `visibility` and stats bg keep working as
  // before), but the tubes-reveal opacity is one-shot: 0 until the
  // first reveal, 1 forever after, until this page unmounts. The hero
  // is sticky and z-indexed above the tubes layer, so latching tubes
  // on while the user scrolls back up to the hero is visually safe —
  // the hero still covers the tubes when in view.
  const tubesLatchedOnRef = useRef(false);
  // Pin a stable reference to the setter so we can use IT (not the
  // whole tubesCtx object) as the effect dependency below. The
  // provider in layout.tsx memoizes the context value, but using the
  // specific callback as the dep is safer and more explicit — it
  // guarantees the scroll effect doesn't tear down on every Layout
  // re-render even if the memoization upstream is ever broken.
  const setTubesRevealOpacity = tubesCtx.setRevealOpacity;
  const setTubesPauseRequested = tubesCtx.setPauseRequested;
  // Prevent first-paint flash of the iridescent tubes on the home
  // route. The CSS variable defaults to `1` in layout.tsx, so without
  // this synchronous pre-paint write the tubes would be momentarily
  // visible behind the hero between mount and the scroll effect below
  // running. useLayoutEffect runs after DOM mutations but before the
  // browser paints, so the tubes start hidden from the very first
  // frame on this route. Reduced-motion users still see this hide
  // because the dedicated reduced-motion branch below also starts at
  // 0 and only flips to 1 once the hero scrolls out of view.
  useLayoutEffect(() => {
    setTubesRevealOpacity?.(0);
  }, [setTubesRevealOpacity]);
  // Tag the document so the scoped CSS transition on the tubes/veil
  // layers (in index.css) only applies while the homepage is mounted.
  // Without this tag, every route navigation would briefly fade the
  // tubes in/out — we only want the soft fade for the homepage's
  // first-reveal moment described in Task #150.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-page", "home");
    return () => {
      // Defensive: only clear if we still own the value. If a future
      // route also sets data-page (and remounts before our cleanup
      // runs in dev / strict mode), we don't want to clobber its tag.
      if (document.documentElement.getAttribute("data-page") === "home") {
        document.documentElement.removeAttribute("data-page");
      }
      // True-unmount-only opacity reset. The branch effects below also
      // run a cleanup, but theirs fires on every prefersReducedMotion /
      // isSmallViewport change too (live resize across the 768px
      // breakpoint, OS reduced-motion toggle), and resetting to 1 in
      // that case can briefly flash the tubes if the latch hasn't
      // fired yet. This data-page effect has no deps so its cleanup
      // ONLY runs on real unmount — so it's the safe place to put the
      // "make sure other routes see tubes immediately" guarantee.
      setTubesRevealOpacity?.(1);
    };
    // setTubesRevealOpacity is memoized in the layout provider via
    // useCallback (stable for the component lifetime), so we omit it
    // from deps to keep this effect strictly mount/unmount-only. The
    // closure captures the mount-time setter, which is fine because
    // it never changes identity in practice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (prefersReducedMotion || isSmallViewport) {
      // Reduced-motion AND small (<768px) viewports: skip the sticky
      // pin and the scroll-tied tube fade-in, but still keep the tubes
      // hidden while the hero is in view. Use an IntersectionObserver
      // on the hero element (which is `relative`, not `sticky`, in
      // this branch) and hard-switch the tubes opacity at the hero
      // boundary — 0 while hero intersects, 1 once the hero has
      // scrolled out — instead of fading. This satisfies the same
      // "tubes activate from below the hero" goal without any
      // scroll-tied animation.
      //
      // Mobile (Task #148): on Android Chrome / iOS Safari the URL
      // bar collapse/expand resizes window.innerHeight mid-scroll,
      // which made the scroll-tied branch (below) drift the tubes
      // opacity AND re-pin the sticky 100vh hero at a new size — both
      // visible jumps. IntersectionObserver doesn't care about vh
      // changes (it observes the element's geometry against the
      // visual viewport), so handing mobile to this branch eliminates
      // both jumps. The tubes still appear "from below the hero",
      // just as a hard cut instead of a fade.
      const el = heroRef.current;
      if (!el || typeof IntersectionObserver === "undefined") {
        // Without IntersectionObserver we can't track the hero, so
        // fall back to leaving the tubes at full brightness so the
        // user still sees the iridescent background somewhere.
        setTubesRevealOpacity?.(1);
        return;
      }
      // Initial state: hero is in view at mount, so tubes start hidden.
      // Skip this if the latch already fired (e.g. user resized between
      // breakpoints after the tubes were revealed) — we don't want to
      // briefly hide already-revealed tubes.
      if (!tubesLatchedOnRef.current) {
        setTubesRevealOpacity?.(0);
      }
      const obs = new IntersectionObserver(
        (entries) => {
          const e = entries[0];
          if (!e) return;
          const covered = !e.isIntersecting;
          setHeroFullyCovered(covered);
          // One-shot latch (Task #150): once the hero leaves the
          // viewport for the first time on this homepage mount, set
          // tubes opacity to 1 and never set it back to 0. The hero
          // is sticky and z-indexed above the tubes, so when the user
          // scrolls back up the hero still covers the tubes — keeping
          // the tubes latched on costs nothing visually and eliminates
          // the flicker that the user reported at the stats section.
          if (covered && !tubesLatchedOnRef.current) {
            tubesLatchedOnRef.current = true;
            setTubesRevealOpacity?.(1);
          }
          // Imperative DOM write (no React commit lag) so the hero is
          // hidden on the same frame the IO callback fires. The React
          // state above will re-render with the matching inline style
          // shortly after; both write the same value so no flicker.
          if (heroRef.current) {
            heroRef.current.style.visibility = covered ? "hidden" : "visible";
          }
        },
        { threshold: 0 },
      );
      obs.observe(el);
      return () => {
        obs.disconnect();
        // Only reset tubes opacity here if the latch already fired.
        // The "ensure tubes are on for other routes" reset on TRUE
        // unmount lives in the data-page useEffect above; this
        // cleanup also fires on prefersReducedMotion / isSmallViewport
        // changes (live resize crossing the 768px breakpoint), and we
        // don't want to flash the tubes from 0 -> 1 mid-scroll if the
        // user just resized while still on the hero.
        if (tubesLatchedOnRef.current) {
          setTubesRevealOpacity?.(1);
        }
        if (heroRef.current) {
          heroRef.current.style.visibility = "visible";
        }
      };
    }

    let ticking = false;
    let lastFullyCovered = false;
    const root = document.documentElement;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight || 1;
      const sy = window.scrollY || 0;
      // raw progress is scrollY measured in viewport-heights:
      //   0     = hero in full view, no scroll
      //   1.0   = hero just fully covered by the stats section
      //   1.3+  = past the card-swipe by a comfortable margin
      const raw = sy / vh;

      // ===== Compositor-driven CSS variables (Task #149) =====
      //
      // The handoff is now a short ramp window driven entirely from
      // CSS custom properties on `documentElement`. We do NOT set
      // React state on every scroll tick — re-rendering the homepage
      // tree at 60Hz is what made the three writes (hero hide, stats
      // bg flip, tubes opacity flip) land on different commit/paint
      // frames on Windows-Chrome and produced the visible flash /
      // black band the user reported. By writing CSS variables
      // instead, the stats bg, hero opacity, and tubes opacity all
      // derive from the same scroll value via CSS calc() and are
      // committed by the compositor on the same paint frame as the
      // scroll itself.
      //
      // Phase 1 — Hero hide (`--hero-handoff-cover`, step at raw=1.0)
      //   The hero <section> uses `opacity: calc(1 - var(...))`.
      //   Opacity changes don't invalidate layout and are committed
      //   by the compositor without a main-thread paint, so the hide
      //   lands on the exact frame the scroll crosses the threshold.
      //   No hysteresis is needed in CSS: setting "0" or "1"
      //   repeatedly is a no-op write, so sub-pixel jitter at the
      //   threshold cannot thrash anything.
      const heroCoveredCss = raw >= 1.0 ? "1" : "0";
      root.style.setProperty("--hero-handoff-cover", heroCoveredCss);

      // Phase 2 — Post-cover ramp (`--hero-handoff-post-cover`, 0..1
      // across raw 1.005 → 1.05). Drives the stats bg crossfade
      // (rgba alpha 1.0 → 0.4). The ramp deliberately starts ~0.5vh
      // AFTER the hero hides, so for at least one paint frame the
      // stats card sits fully opaque over the (now opacity:0) hero
      // before its own bg starts going translucent. The tubes are
      // not ramped here — they're driven by the one-shot LATCH
      // below (Task #150), which fires the moment fullyCovered first
      // becomes true. The latch fires at raw>=1.0 while the stats bg
      // crossfade hasn't started yet (raw<1.005), so the brightness
      // pop of the tubes appearing is masked behind a still-opaque
      // stats card on the same paint frame. By the time the stats bg
      // has reached its translucent end-state, the tubes have already
      // been latched on and softly faded by the scoped CSS transition
      // in index.css — the whole sequence reads as a single seamless
      // handoff with no flash on Windows-Chrome (Task #149).
      const postCover = Math.max(0, Math.min(1, (raw - 1.005) / 0.045));
      root.style.setProperty("--hero-handoff-post-cover", String(postCover));

      // ===== React state for non-visual consumers =====
      //
      // heroFullyCovered drives the hero <video> pause/resume and the
      // setTubesPauseRequested signal — neither is a per-frame visual
      // state, so a frame or two of React commit lag is invisible.
      // We keep the hysteresis (enter at 1.0, leave at 0.985) so the
      // video play state doesn't thrash from sub-pixel scroll jitter.
      const enterThreshold = 1.0;
      const leaveThreshold = 0.985;
      const fullyCovered = lastFullyCovered
        ? raw >= leaveThreshold
        : raw >= enterThreshold;
      if (fullyCovered !== lastFullyCovered) {
        lastFullyCovered = fullyCovered;
        setHeroFullyCovered(fullyCovered);
        // Imperative pointer-events flip so the (now invisible) hero
        // stops capturing clicks the moment it's hidden, without
        // waiting for the React commit. Using a direct style write
        // (not a CSS variable) avoids the React types complaining
        // about `pointerEvents: 'var(...)'`.
        if (heroRef.current) {
          heroRef.current.style.pointerEvents = fullyCovered
            ? "none"
            : "auto";
        }
      }
      // Tubes opacity LATCH (Task #150). Tubes stay at 0 for the
      // entire hero + card-swipe (progress 0..1.0) so the swipe reads
      // as a clean opaque card sliding over the hero — no iridescent
      // tubes leaking onto either layer. Once the stats card has
      // fully covered the hero for the first time we LATCH the tubes
      // to full brightness and never write a value below 1 again on
      // this mount. Without the latch the user occasionally saw the
      // tubes flicker 0->1->0->1 right at the threshold during slow
      // / jittery scrolls. The hero is sticky and z-indexed above
      // the tubes layer, so even if the user scrolls back up to view
      // the hero the latched-on tubes are still hidden behind it
      // visually. A scoped CSS transition (in index.css, gated on
      // `:root[data-page="home"]`) softens the latched 0->1 jump into
      // a brief fade so it reads as a reveal rather than a pop.
      // Note (Task #149): the brightness pop of this latched 0->1
      // also lands while the stats section is still fully opaque
      // (the post-cover stats-bg crossfade above only starts at
      // raw=1.005, ~0.5vh after the latch fires at raw=1.0), so the
      // pop is masked behind an opaque card on the same paint frame.
      if (fullyCovered && !tubesLatchedOnRef.current) {
        tubesLatchedOnRef.current = true;
        setTubesRevealOpacity?.(1);
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      // Only reset tubes opacity here if the latch already fired
      // (Task #150). The "ensure tubes are on for other routes"
      // reset on TRUE unmount lives in the data-page useEffect
      // above; this cleanup also fires on prefersReducedMotion /
      // isSmallViewport changes (live resize crossing the 768px
      // breakpoint), and we don't want to flash the tubes 0 -> 1
      // mid-scroll if the user resized between branches before the
      // first reveal.
      if (tubesLatchedOnRef.current) {
        setTubesRevealOpacity?.(1);
      }
      // Clear the handoff CSS vars (Task #149) unconditionally so
      // other routes — and a possible remount of this effect on the
      // IO branch (after a resize across 768px or a reduced-motion
      // toggle) — don't inherit a stale "covered" state that would
      // leave the hero invisible.
      root.style.removeProperty("--hero-handoff-cover");
      root.style.removeProperty("--hero-handoff-post-cover");
      // Defensive: also reset hero pointer-events AND visibility in
      // case this branch was active (sticky desktop) and we're
      // tearing down because the viewport just crossed the
      // small/large breakpoint or the user toggled
      // prefers-reduced-motion. Without this, the IO branch could
      // mount onto a hero element still carrying the imperative
      // pointer-events:none from a previous fully-covered scroll
      // state, or the visibility:hidden from earlier code paths.
      if (heroRef.current) {
        heroRef.current.style.pointerEvents = "auto";
        heroRef.current.style.visibility = "visible";
      }
    };
  }, [prefersReducedMotion, isSmallViewport, setTubesRevealOpacity]);

  // Mirror heroInViewport into the ref consumed by `tryPlay` (declared
  // earlier in the file, where the load pipeline lives). See the long
  // comment at the heroInViewportRef declaration for the full rationale.
  useEffect(() => {
    heroInViewportRef.current = heroInViewport;
  }, [heroInViewport]);

  // Whenever a hero video slide is the active slide AND the hero is
  // visible, ask the global iridescent tube background to pause its
  // WebGL render loop. This frees the GPU so the <video> element
  // doesn't compete with the WebGL canvas for decoding bandwidth and
  // is the biggest practical win for hero-video smoothness on
  // mid-range hardware.
  const heroVideoActive = !!(
    activeSlide?.videoUrl &&
    videoSupported &&
    !videoFailed
  );
  // Reuse the stable `setTubesPauseRequested` reference pulled from
  // tubesCtx earlier. Depending on the function reference (not the
  // whole context object) prevents the effect from tearing down on
  // every Layout re-render.
  useEffect(() => {
    if (!setTubesPauseRequested) return;
    const shouldPause = heroVideoActive && heroInViewport;
    setTubesPauseRequested(shouldPause);
    return () => {
      setTubesPauseRequested(false);
    };
  }, [heroVideoActive, heroInViewport, setTubesPauseRequested]);

  // Pause/resume the hero <video> based on viewport AND tab visibility.
  // The browser will happily keep decoding 24fps of H.264 forever even
  // when the element isn't visible, which on a Windows laptop with an
  // integrated GPU is a meaningful per-frame cost stacked on top of
  // everything else further down the page.
  //
  // Three things have to be true for the video to be playing:
  //   1) the active slide is a video slide (heroVideoActive)
  //   2) the hero is on-screen (heroInViewport)
  //   3) the tab is visible (document.visibilityState === 'visible')
  //
  // We also depend on `videoReady` so this effect re-fires the moment
  // canplay arrives — covering the case where the video became ready
  // while the user was already viewing the hero (tryPlay deferred its
  // own play() and we own the resume here) — and we attach a
  // visibilitychange listener so tab hide/show alone is enough to
  // pause/resume even without any other state change.
  useEffect(() => {
    if (!heroVideoActive) return;
    if (!videoReady) return;
    const v = heroVideoRef.current;
    if (!v) return;

    const updatePlayState = () => {
      const shouldPlay =
        heroInViewport &&
        (typeof document === "undefined" ||
          document.visibilityState === "visible");
      if (shouldPlay) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    };

    updatePlayState();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", updatePlayState);
      return () => {
        document.removeEventListener("visibilitychange", updatePlayState);
      };
    }
  }, [heroVideoActive, heroInViewport, videoReady]);

  // Once the video has been ready and playing for a brief settle
  // window, fully unmount the placeholder <img>. Until now we kept
  // it cross-fading at opacity 0, but the browser was still
  // compositing two full-screen layers per frame — a measurable
  // hit on integrated GPUs. We re-mount it on every slide change
  // so the next video's first frame still fades in over a poster.
  const [placeholderHidden, setPlaceholderHidden] = useState(false);
  useEffect(() => {
    setPlaceholderHidden(false);
  }, [currentSlide]);
  useEffect(() => {
    if (!videoReady) {
      setPlaceholderHidden(false);
      return;
    }
    // Match the placeholder's transition-opacity duration-500
    // (was 800ms): if we waited 300ms past the visible fade we
    // ended up with a window where the placeholder was opacity:0
    // but still mounted (so its mask was inert) AND the video
    // mask was still gated off (waiting for placeholderHidden) —
    // so the bottom of the hero showed a hard edge for ~300ms
    // before the feather reappeared. Aligning to 500ms hands the
    // mask off cleanly the instant the placeholder is gone.
    const t = window.setTimeout(() => setPlaceholderHidden(true), 500);
    return () => window.clearTimeout(t);
  }, [videoReady, currentSlide]);

  // Quality-degradation safety net: if the browser reports that the
  // hero <video> is dropping a meaningful share of frames over
  // consecutive 2s windows, treat the video as failed and let the
  // existing static-image fallback take over. This catches cases the
  // codec / canPlayType pre-flight can't predict (decoder backpressure
  // on slow CPUs, thermal throttling on phones, contended GPUs, etc.)
  // and prevents users from ever sitting through visible stutter.
  //
  // Tunables (after Task #143 — was firing prematurely during decoder
  // warm-up which read to users as "the video hangs"):
  //   - WARMUP_MS: skip the first 4s after canplay; warm-up + tube
  //     pause coordination + font swap legitimately drop frames here.
  //   - droppedDelta > 40 AND droppedDelta/totalDelta > 0.15: was
  //     > 20 AND > 0.10. Less twitchy on integrated GPUs.
  //   - badWindows >= 3 (was 2): require sustained badness so a
  //     single GC pause or tab-switch glitch can't hide the video.
  useEffect(() => {
    if (!videoReady || videoFailed) return;
    const video = heroVideoRef.current;
    if (!video || typeof video.getVideoPlaybackQuality !== "function") return;
    const WARMUP_MS = 4000;
    let lastDropped = 0;
    let lastTotal = 0;
    let badWindows = 0;
    try {
      const q = video.getVideoPlaybackQuality();
      lastDropped = q.droppedVideoFrames;
      lastTotal = q.totalVideoFrames;
    } catch {
      return;
    }
    const id = window.setInterval(() => {
      const playbackStart = videoPlaybackStartRef.current;
      const inWarmup =
        playbackStart === null ||
        performance.now() - playbackStart < WARMUP_MS;
      try {
        const q = video.getVideoPlaybackQuality();
        if (inWarmup) {
          // Reset the baseline during warm-up so warm-up drops
          // never count against the post-warm-up windows.
          lastDropped = q.droppedVideoFrames;
          lastTotal = q.totalVideoFrames;
          return;
        }
        const droppedDelta = q.droppedVideoFrames - lastDropped;
        const totalDelta = q.totalVideoFrames - lastTotal;
        lastDropped = q.droppedVideoFrames;
        lastTotal = q.totalVideoFrames;
        const tooManyDropped =
          totalDelta > 0 &&
          droppedDelta > 40 &&
          droppedDelta / totalDelta > 0.15;
        if (tooManyDropped) {
          badWindows += 1;
        } else {
          badWindows = 0;
        }
        if (badWindows >= 3) {
          console.debug("[hero-video] quality-watchdog-fired", {
            droppedDelta,
            totalDelta,
            rate: droppedDelta / totalDelta,
          });
          console.debug("[hero-video] fallback-shown quality-watchdog");
          setVideoFailed(true);
        }
      } catch {
        // ignore — never let a poll error break the hero
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [videoReady, videoFailed, currentSlide]);

  // Compute the poster source for the hero video. Always returns a
  // visible image so the hero is never black behind the splash —
  // even when the active slide has no image_url and the API hasn't
  // returned a property image yet. Order:
  //   1) the active slide's own image (admin-set hero photo)
  //   2) the first published property's hero image (we already have
  //      it loaded for the rest of the homepage, costs nothing)
  //   3) a baked-in dark-gradient SVG (HERO_POSTER_FALLBACK)
  const heroPosterSrc = useMemo<string>(() => {
    if (activeSlide?.image) return activeSlide.image;
    const first = properties[0];
    if (first?.imageUrl) return first.imageUrl as string;
    return HERO_POSTER_FALLBACK;
  }, [activeSlide?.image, properties]);

  const handleSearchResults = (results: any) => {
    if (results.totalResults > 0 || results.interpretation) {
      sessionStorage.setItem("searchResults", JSON.stringify(results));
      setLocation("/properties");
    }
  };

  const scrollToContent = () => {
    window.scrollTo({ top: window.innerHeight - 80, behavior: "smooth" });
  };

  // Animated HSQUARE LIVING splash overlay. We show it once per browser
  // tab session (tracked at module level so SPA navigation back to "/"
  // does not replay the splash) and use it to mask the real load time
  // of the hero: background WebGL tubes initialising + signed-URL
  // fetch + the first hero video reaching `canplay`. The overlay
  // enforces its own 2s minimum hold and 10s safety cap, so the worst
  // case is bounded even if a signal never arrives. Once the exit
  // animation has played, `loaderSeen` flips and the splash never
  // returns for the lifetime of this tab.
  const [loaderDone, setLoaderDone] = useState(() => loaderSeen);
  const handleLoaderDone = useCallback(() => {
    loaderSeen = true;
    setLoaderDone(true);
  }, []);
  // Hero is ready when:
  //  - there is no slide to display at all, OR
  //  - the active slide has no video, OR
  //  - the video has finished its async preflight and we know it has
  //    failed (either signed-URL fetch failed, codec unsupported, or
  //    the <video> element fired error), OR
  //  - the <video> element fired canplay / loadeddata.
  // We deliberately do NOT treat the initial videoSupported=false as
  // "settled", because that flag defaults to false BEFORE preflight
  // completes — using it would let the loader exit before the video
  // is actually ready. videoFailed becomes true in all real "we can't
  // play" branches, which is what we want here.
  const heroVideoSettled =
    !activeSlide ||
    !activeSlide.videoUrl ||
    videoFailed ||
    videoReady;
  const loaderReady = heroVideoSettled && tubesCtx.ready;

  // Once the splash overlay has exited, bump the hero <video>'s
  // `preload` attribute from "metadata" to "auto" so the browser
  // greedily buffers ahead. We start with "metadata" so the first
  // load doesn't contend with splash assets / Tubes WebGL init /
  // fonts on the critical path (the original Task #143 reasoning),
  // but the moment the splash is gone that contention window is
  // over and aggressive buffering is exactly what makes
  // `canplaythrough` arrive quickly on Windows-Chrome — turning the
  // first hero playback from "stutter, then smooth" into "smooth
  // from the first frame". This is a hint to the user agent: we
  // do NOT call load() again, so any in-flight playback is never
  // interrupted.
  useEffect(() => {
    if (!loaderDone) return;
    const v = heroVideoRef.current;
    if (!v) return;
    if (v.preload !== "auto") {
      v.preload = "auto";
    }
  }, [loaderDone, resolvedVideoUrl]);

  return (
    <div className="flex flex-col relative">
      {!loaderDone && (
        <HsquareLoadingScreen
          ready={loaderReady}
          onComplete={handleLoaderDone}
        />
      )}
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
        className={`w-full h-screen overflow-hidden ${
          prefersReducedMotion || isSmallViewport ? "relative" : "sticky top-0"
        }`}
        style={
          prefersReducedMotion || isSmallViewport
            ? undefined
            : {
                // Once the next section has fully covered the sticky
                // hero, hide it entirely so subsequent translucent
                // sections (Why Choose, etc.) show the iridescent
                // tubes through them instead of the hero video peeking
                // out from behind. Without this, sticky pins the hero
                // for the full page height (Task #147 fix).
                //
                // Task #149: hide via opacity (compositor-only) rather
                // than `visibility: hidden`. `visibility` is a main-
                // thread property and forces a paint invalidation; on
                // Windows-Chrome that paint can land a frame after the
                // scroll-driven stats translation, producing the
                // visible flash / black band the user reported.
                // Opacity is committed by the GPU compositor on the
                // same frame the scroll position crosses the
                // threshold. The CSS variable is driven by the scroll
                // handler above so this style does NOT cause a React
                // re-render per scroll tick. `translateZ(0)` keeps
                // the section on its own GPU layer; `willChange:
                // opacity` hints the compositor to keep that layer
                // ready to fade. Pointer-events are flipped
                // imperatively in the scroll handler.
                //
                // Mobile (Task #148): small viewports take the
                // `relative` branch above instead of sticky, so this
                // toggle isn't needed there — the hero simply scrolls
                // out of view naturally and any translucent sections
                // below paint over the now off-screen hero in
                // document flow, not over a pinned overlay.
                opacity: "calc(1 - var(--hero-handoff-cover, 0))",
                transform: "translateZ(0)",
                willChange: "opacity",
              }
        }
        data-testid="hero-section"
      >
        {!activeSlide ? (
          // Empty-state fallback: no published-property images and no admin
          // slides yet. Render a dark gradient hero so the page never crashes
          // and users still see a polished header instead of a blank section.
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a]">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-6">
                <div className="text-xs tracking-[0.4em] text-white/50 mb-3">HSQUARE LIVING</div>
                <div className="text-3xl md:text-5xl font-semibold text-white">
                  Premium Student Living in Mumbai
                </div>
              </div>
            </div>
          </div>
        ) : activeSlide.videoUrl &&
          videoSupported &&
          !videoFailed ? (
          // The hero video used to be rendered on a solid bg-black
          // backdrop with the iridescent tube background completely
          // hidden — so on every device the hero felt cut off from
          // the rest of the page (no signature glow). We now use a
          // transparent backdrop and apply a soft alpha mask to the
          // video itself so the centre of the frame stays fully
          // opaque (the cityscape / bridge / wherever the user is
          // looking reads crisp, exactly as before) while the bottom
          // 18% feathers to transparent. The global tube canvas
          // sitting underneath the hero (z-0 in Layout) shows
          // through this feathered band as an iridescent halo
          // glow under the CTA buttons.
          //
          // Performance: the tubes are still paused while the hero
          // video is the active slide (see the heroVideoActive
          // useEffect above) so the WebGL render loop is NOT
          // competing with the video decoder for GPU bandwidth on
          // mid-range Windows / Android hardware — that's the same
          // optimisation that was already there. Pausing freezes
          // the canvas on its last rendered frame, which for slow-
          // moving iridescent tubes still reads as the same glow.
          // The instant the user scrolls past the hero, the tubes
          // resume animating as before.
          //
          // Cost: one alpha-blended band across the bottom of the
          // hero. That's a single composite op, not a per-pixel
          // shader, so the same Windows laptops that struggled
          // with the old "tubes-under-video" approach are not
          // re-affected here.
          <div className="absolute inset-0">
            <video
              ref={heroVideoRef}
              poster={heroPosterSrc}
              className="w-full h-full object-cover transition-opacity duration-500"
              style={{
                opacity: videoReady ? 1 : 0,
                transform: "translateZ(0)",
                willChange: "transform",
                backfaceVisibility: "hidden",
                // The feathered alpha mask is the per-frame composite
                // cost we want to defer until the video is the only
                // visible hero layer. Until placeholderHidden flips
                // (500ms after canplay, aligned with the placeholder's
                // transition-opacity duration-500), the placeholder
                // <img> below owns the visible feather and the video
                // plays full-bleed underneath, which means weak GPUs
                // composite ONE alpha-blended layer instead of two
                // during the cross-fade window.
                // The bottom-feather mask reveals the iridescent tubes
                // through the video's lower 30%. On Apple platforms
                // this is GPU-cheap. On Windows-Chrome (and most Linux
                // builds) `mask-image` on a *playing* <video> forces
                // the compositor onto a software path that visibly
                // tanks framerate of the entire page — the same
                // invariant documented in replit.md for the
                // plans-hallway backdrop video. So we only apply the
                // mask on platforms whose compositor can sustain it.
                // Windows users lose the bottom feather aesthetic but
                // gain smooth 60fps hero playback; the existing dark
                // bottom gradient overlay (rendered just below in the
                // tree) still hands the hero off into the page softly.
                ...(placeholderHidden && IS_FAST_VIDEO_COMPOSITOR
                  ? {
                      WebkitMaskImage:
                        "linear-gradient(180deg, black 0%, black 70%, transparent 100%)",
                      maskImage:
                        "linear-gradient(180deg, black 0%, black 70%, transparent 100%)",
                    }
                  : {}),
              }}
              muted
              autoPlay
              loop
              playsInline
              // preload="metadata" (was "auto"): "auto" greedily
              // downloads the entire MP4 in parallel with the slide
              // API, the Tubes WebGL init, fonts, and splash
              // assets — on real hardware that contention stalls
              // the page and reads as a hang. "metadata" lets the
              // browser fetch enough to know dimensions/duration,
              // then progressively buffer once playback starts.
              preload="metadata"
              disablePictureInPicture
              disableRemotePlayback
            />
            {!placeholderHidden && (
              // Cross-fade the placeholder image while the video warms
              // up, then fully unmount it 500ms after the video is
              // playing (matches transition-opacity duration-500 on
              // this <img> so the mask handoff to the <video> happens
              // the instant the placeholder is no longer visible).
              // Keeping it mounted at opacity 0 forever
              // forces the browser to composite two full-screen layers
              // every frame, which contributed to hero-video stutter
              // on integrated GPUs. We re-mount it on every slide
              // change so the next video's first frame still fades in
              // over a poster. The same feathered mask is applied so
              // the cross-fade has no visible hard edge at the bottom
              // — both layers reveal the tubes underneath identically.
              //
              // After Task #143: this <img> is rendered for EVERY
              // hero-video slide, even when activeSlide.image is
              // empty, by falling back to the first published
              // property image and finally to a baked-in dark
              // gradient SVG. That guarantees the hero is never
              // black behind the splash on a fresh load.
              <img
                src={heroPosterSrc}
                alt={activeSlide.title || "Hsquare Living"}
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                fetchPriority="high"
                loading="eager"
                decoding="async"
                style={{
                  opacity: videoReady ? 0 : 1,
                  pointerEvents: "none",
                  WebkitMaskImage:
                    "linear-gradient(180deg, black 0%, black 70%, transparent 100%)",
                  maskImage:
                    "linear-gradient(180deg, black 0%, black 70%, transparent 100%)",
                }}
                aria-hidden={videoReady}
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
              style={
                tubesActive
                  ? {
                      WebkitMaskImage:
                        "linear-gradient(180deg, black 0%, black 78%, rgba(0,0,0,0.45) 92%, transparent 100%)",
                      maskImage:
                        "linear-gradient(180deg, black 0%, black 78%, rgba(0,0,0,0.45) 92%, transparent 100%)",
                    }
                  : {}
              }
            >
              <motion.img
                src={activeSlide.image || heroPosterSrc}
                alt={activeSlide.title}
                className="w-full h-full object-cover will-change-transform"
                {...(currentSlide === 0
                  ? { fetchPriority: "high", loading: "eager", decoding: "async" }
                  : { loading: "lazy", decoding: "async" })}
                initial={
                  KEN_BURNS_VARIANTS[currentSlide % KEN_BURNS_VARIANTS.length]
                    .initial
                }
                animate={
                  KEN_BURNS_VARIANTS[currentSlide % KEN_BURNS_VARIANTS.length]
                    .animate
                }
                transition={{ duration: 8, ease: "linear" }}
                style={undefined}
              />
            </motion.div>
          </AnimatePresence>
        )}

        <div
          className="absolute inset-0 z-[5]"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 25%, transparent 75%, rgba(5,5,5,0.45) 92%, rgba(5,5,5,0) 100%)",
          }}
        />
        {/* Soft hand-off from the bottom of the hero into the rest of the
            page (where the iridescent tube background continues). On image
            slides we still use a frosted backdrop-filter blur so the tubes
            bleed up with a haze. On video slides we skip the blur entirely
            (it forced the GPU to re-blur a moving frame every paint and was
            the main source of hero-video stutter) and use a plain colored
            gradient instead — the design still gets a smooth dark fade
            into the page below, just without the per-frame blur cost.
            Reduced-motion and small mobile viewports always get the cheap
            gradient path so playback stays smooth on the slowest devices. */}
        {tubesActive && (() => {
          const heroIsVideo =
            !!activeSlide?.videoUrl && videoSupported && !videoFailed;
          const skipBlur =
            heroIsVideo || prefersReducedMotion || isSmallViewport;
          if (skipBlur) {
            // On video slides the hero <video> already feathers its
            // bottom 30% to transparent (see the mask above) so the
            // global iridescent tubes are meant to glow through this
            // band as a halo behind the CTAs. The old bridge gradient
            // here was nearly opaque at the bottom (rgba(5,5,5,0.95))
            // which painted right over that halo and hid the tubes.
            // We lighten it heavily on video slides — the top 60%
            // stays fully transparent so tubes read at full
            // brightness behind the buttons, and only the very
            // bottom edge has a soft dark wash for a clean handoff
            // into the next section. This is still a single colour
            // gradient (no per-frame blur), so the same mid-range
            // Windows / Android laptops that benefited from the
            // original skipBlur path are not impacted.
            return (
              <div
                className="absolute inset-x-0 bottom-0 h-40 md:h-56 z-[6] pointer-events-none"
                aria-hidden="true"
                data-testid="hero-tube-blur-bridge"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(5,5,5,0) 0%, rgba(5,5,5,0) 60%, rgba(5,5,5,0.35) 85%, rgba(5,5,5,0.7) 100%)",
                }}
              />
            );
          }
          return (
            <div
              className="absolute inset-x-0 bottom-0 h-40 md:h-56 z-[6] pointer-events-none"
              aria-hidden="true"
              data-testid="hero-tube-blur-bridge"
              style={{
                backdropFilter: "blur(28px) saturate(120%)",
                WebkitBackdropFilter: "blur(28px) saturate(120%)",
                WebkitMaskImage:
                  "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 55%, black 100%)",
                maskImage:
                  "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 55%, black 100%)",
              }}
            />
          );
        })()}

        {!hasAnyVideo && !tubesActive && (
          <>
            <div className="absolute inset-0 z-[8]">
              <ParticleBackground
                preset="hero"
                className="absolute inset-0"
                id="hero-particles"
              />
            </div>

            <Floating3DShape
              type="ring"
              size={50}
              color="#f59e0b"
              delay={0}
              x="10%"
              y="25%"
              duration={25}
            />
            <Floating3DShape
              type="diamond"
              size={25}
              color="#06b6d4"
              delay={2}
              x="85%"
              y="35%"
              duration={20}
            />
            <Floating3DShape
              type="hexagon"
              size={35}
              color="#8b5cf6"
              delay={4}
              x="75%"
              y="65%"
              duration={22}
            />
          </>
        )}

        <div
          className="absolute bottom-28 left-6 md:left-10 z-20 flex items-center gap-3 opacity-15 pointer-events-none select-none"
          data-testid="hero-watermark"
        >
          <img
            src={hsquareLogo}
            alt=""
            className="w-10 h-10 md:w-12 md:h-12 brightness-0 invert"
          />
          <span className="text-white text-base md:text-lg font-heading font-bold tracking-widest uppercase">
            Hsquare Living
          </span>
        </div>

        <div className="absolute inset-0 z-20 flex flex-col justify-end items-center pb-12 md:pb-16 px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link href="/properties">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent backdrop-blur-md border border-white/20 text-white hover:bg-white/10 hover:border-white/40 text-base px-12 h-14 rounded-full font-semibold tracking-wider group uppercase"
                  data-testid="button-explore-properties"
                >
                  Explore Properties
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="bg-emerald-500/10 backdrop-blur-md border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 text-base px-12 h-14 rounded-full font-semibold tracking-wider group uppercase"
                data-testid="button-download-app"
                onClick={() => {
                  const el = document.getElementById("app-download-section");
                  if (el)
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
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
                      className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all"
                      data-testid="button-hero-prev"
                      aria-label="Previous slide"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextSlide}
                      className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all"
                      data-testid="button-hero-next"
                      aria-label="Next slide"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <div className="flex gap-2 ml-4">
                      {heroSlides.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSlideDirection(i > currentSlide ? 1 : -1);
                            setCurrentSlide(i);
                          }}
                          className="relative h-1 rounded-full overflow-hidden transition-all duration-500"
                          style={{
                            width: i === currentSlide ? "2.5rem" : "0.75rem",
                          }}
                          data-testid={`button-hero-dot-${i}`}
                        >
                          <span
                            className={`absolute inset-0 rounded-full ${i === currentSlide ? "bg-white/20" : "bg-white/10 hover:bg-white/30"}`}
                          />
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
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </button>
            </div>
          </div>
      </section>
      {/* Card-swipe overlay (Task #147): every section after the sticky
          hero lives inside this `relative z-10` wrapper so they paint
          ABOVE the sticky hero (which is z:auto) and ABOVE the global
          tubes layer (fixed z:0 in layout.tsx). The first section
          (stats) uses an opaque background AND min-h-screen so it
          fully covers the hero during the swipe — without min-h-screen
          a short stats section would let the sticky hero peek out
          above and below it. Subsequent sections keep their existing
          translucent backgrounds so the iridescent tubes glow through
          them once the swipe is done; the hero fades to opacity 0
          (Task #149, see hero <section> style) so it doesn't show
          through those translucent areas. */}
      {/* Task #150 fix: this wrapper is intentionally TRANSPARENT.
          A previous revision painted `bg-[#050505]` here as a "safety
          floor" against a hypothetical sub-pixel gap at the hero
          handoff frame, but the wrapper sits at z-10 ABOVE the global
          tubes layer (fixed z:0 in layout.tsx) and would mask the
          tubes for the entire post-hero region — Why Choose, Cards,
          Pricing, Testimonials, etc. The stats section just below
          already serves as the safety: it's `min-h-screen` and its
          own background crossfades from `rgba(5,5,5,1)` (fully opaque)
          at raw progress 0..1.0 to `rgba(5,5,5,0.4)` only after the
          hero has been hidden, so it fully covers the hero on the
          same paint frame as the opacity flip. After the swipe, every
          subsequent section keeps its own `bg-[#050505]/40` so the
          tubes glow through at 60%. */}
      <div className="relative z-10">
      <ImmersiveScene
        variant="aurora"
        className="pt-12 pb-16 md:pt-16 md:pb-24 min-h-screen flex items-end"
        // Stats section background is driven by the same scroll-tied
        // CSS variable as the hero opacity and the tubes ramp (Task
        // #149). It stays at full alpha 1.0 throughout the entire
        // card-swipe (raw progress 0..1.0) so the swipe reads as a
        // clean opaque card sliding up over the hero — no iridescent
        // tubes leaking onto either layer. Once the hero has been
        // hidden (raw >= 1.0) the alpha crossfades from 1.0 → 0.4
        // across the next ~4.5vh of scroll, in lockstep with the
        // tubes opacity ramping in behind it. Because both writes
        // come from the same CSS var on the same paint frame, they
        // can never disagree on screen the way they did when each was
        // a separate React state flip on Windows-Chrome.
        style={{
          backgroundColor:
            "rgba(5, 5, 5, calc(1 - var(--hero-handoff-post-cover, 0) * 0.6))",
        }}
      >
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
                <AnimatedCounter
                  end={stat.numericEnd}
                  suffix={stat.suffix}
                  label={stat.label}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </ImmersiveScene>
      <ImmersiveScene variant="grid" className="pt-12 pb-28 md:pt-16 md:pb-40 bg-[#050505]/40">
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
              <CinematicText delay={0.4} gradient>
                Hsquareliving
              </CinematicText>
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
              An ecosystem thoughtfully designed for students to thrive, study,
              and build lifelong connections.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Wifi,
                title: "High-Speed WiFi",
                desc: "Enterprise-grade connectivity for seamless studies and entertainment.",
                accent: "from-cyan-500 to-blue-400",
                glow: "rgba(6,182,212,0.2)",
                border: "border-cyan-500/20 hover:border-cyan-500/40",
              },
              {
                icon: Shield,
                title: "24/7 Security",
                desc: "Biometric access, CCTV surveillance, and round-the-clock security staff.",
                accent: "from-emerald-500 to-teal-400",
                glow: "rgba(16,185,129,0.2)",
                border: "border-emerald-500/20 hover:border-emerald-500/40",
              },
              {
                icon: Utensils,
                title: "Gourmet Meals",
                desc: "Chef-prepared nutritious meals with diverse cuisine options daily.",
                accent: "from-amber-500 to-orange-400",
                glow: "rgba(245,158,11,0.2)",
                border: "border-amber-500/20 hover:border-amber-500/40",
              },
              {
                icon: Users,
                title: "Vibrant Community",
                desc: "Events, workshops, and curated spaces to connect with brilliant peers.",
                accent: "from-violet-500 to-purple-400",
                glow: "rgba(139,92,246,0.2)",
                border: "border-violet-500/20 hover:border-violet-500/40",
              },
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
                  whileHover={{
                    y: -12,
                    transition: { type: "spring", stiffness: 300, damping: 20 },
                  }}
                  className="h-full"
                >
                  <div
                    className={`p-6 md:p-8 rounded-2xl border ${feature.border} bg-white/[0.02] relative overflow-hidden transition-all duration-500 h-full flex flex-col`}
                  >
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl"
                      style={{
                        background: `radial-gradient(ellipse at 50% 0%, ${feature.glow} 0%, transparent 60%)`,
                      }}
                    />

                    <motion.div
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${feature.accent} flex items-center justify-center mb-5 shadow-lg relative z-10 shrink-0`}
                      style={{ boxShadow: `0 8px 30px ${feature.glow}` }}
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                      }}
                    >
                      <feature.icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                    </motion.div>
                    <h3 className="font-heading font-bold text-lg md:text-xl text-white mb-2 relative z-10 leading-tight">
                      {feature.title}
                    </h3>
                    <p className="text-white/30 text-sm leading-relaxed relative z-10 flex-1">
                      {feature.desc}
                    </p>
                  </div>
                </motion.div>
              </TiltCard>
            ))}
          </div>
        </div>
      </ImmersiveScene>
      <ImmersiveScene variant="fog" className="py-28 md:py-40 bg-[#050505]/40">
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
              <CinematicText delay={0.4} gradient>
                Facilities
              </CinematicText>
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
              ? dynamicAmenities.map((a) => ({
                  image: a.imageUrl,
                  title: a.title,
                  desc: a.description,
                  icon: ICON_MAP[a.icon] || Star,
                }))
              : AMENITY_SHOWCASE
            ).map((amenity, i) => {
              const amenityColors = [
                {
                  accent: "from-violet-500 to-purple-400",
                  glow: "rgba(139,92,246,0.2)",
                  border: "border-violet-500/20 hover:border-violet-500/40",
                },
                {
                  accent: "from-cyan-500 to-blue-400",
                  glow: "rgba(6,182,212,0.2)",
                  border: "border-cyan-500/20 hover:border-cyan-500/40",
                },
                {
                  accent: "from-amber-500 to-orange-400",
                  glow: "rgba(245,158,11,0.2)",
                  border: "border-amber-500/20 hover:border-amber-500/40",
                },
                {
                  accent: "from-emerald-500 to-teal-400",
                  glow: "rgba(16,185,129,0.2)",
                  border: "border-emerald-500/20 hover:border-emerald-500/40",
                },
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
                    whileHover={{
                      y: -12,
                      transition: {
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      },
                    }}
                    className="h-full"
                  >
                    <div
                      className={`p-6 md:p-8 rounded-2xl border ${c.border} bg-white/[0.02] relative overflow-hidden transition-all duration-500 h-full flex flex-col`}
                    >
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl"
                        style={{
                          background: `radial-gradient(ellipse at 50% 0%, ${c.glow} 0%, transparent 60%)`,
                        }}
                      />

                      <motion.div
                        className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${c.accent} flex items-center justify-center mb-5 shadow-lg relative z-10 shrink-0`}
                        style={{ boxShadow: `0 8px 30px ${c.glow}` }}
                        whileHover={{ scale: 1.15, rotate: 5 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 15,
                        }}
                      >
                        <amenity.icon className="w-6 h-6 md:w-7 md:h-7 text-white" />
                      </motion.div>
                      <h3 className="font-heading font-bold text-lg md:text-xl text-white mb-2 relative z-10 leading-tight">
                        {amenity.title}
                      </h3>
                      <p className="text-white/30 text-sm leading-relaxed relative z-10 flex-1">
                        {amenity.desc}
                      </p>
                    </div>
                  </motion.div>
                </TiltCard>
              );
            })}
          </div>
        </div>
      </ImmersiveScene>
      {featuredPlans.length > 0 && (
        <>
          {(() => {
          const _tierDesigns_unused = [
            {
              cardBg:
                "bg-gradient-to-br from-[#0a2e1f] via-[#134e31] to-[#0a3d23]",
              headerAccent: "from-emerald-400 to-teal-300",
              priceColor: "text-emerald-300",
              taglineColor: "text-emerald-400/70",
              divider: "border-emerald-800/40",
              featureIcon:
                "from-emerald-500/30 to-teal-500/30 text-emerald-300",
              featureText: "text-emerald-100/80",
              featureValue: "text-white font-semibold",
              btnBg:
                "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/30",
              glow: "rgba(16,185,129,0.15)",
              decorLine: "from-transparent via-emerald-500/30 to-transparent",
              occupancyBg: "bg-emerald-900/40 border-emerald-700/30",
              occupancyText: "text-emerald-300",
            },
            {
              cardBg:
                "bg-gradient-to-br from-[#1a0a3e] via-[#2d1b69] to-[#1e0f4f]",
              headerAccent: "from-violet-400 to-purple-300",
              priceColor: "text-violet-300",
              taglineColor: "text-violet-400/70",
              divider: "border-violet-800/40",
              featureIcon:
                "from-violet-500/30 to-purple-500/30 text-violet-300",
              featureText: "text-violet-100/80",
              featureValue: "text-white font-semibold",
              btnBg:
                "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 shadow-violet-500/30",
              glow: "rgba(139,92,246,0.15)",
              decorLine: "from-transparent via-violet-500/30 to-transparent",
              occupancyBg: "bg-violet-900/40 border-violet-700/30",
              occupancyText: "text-violet-300",
            },
            {
              cardBg:
                "bg-gradient-to-br from-[#3d2400] via-[#5c3a0a] to-[#4a2d00]",
              headerAccent: "from-amber-300 to-yellow-200",
              priceColor: "text-amber-300",
              taglineColor: "text-amber-400/70",
              divider: "border-amber-700/40",
              featureIcon: "from-amber-500/30 to-yellow-500/30 text-amber-300",
              featureText: "text-amber-100/80",
              featureValue: "text-white font-semibold",
              btnBg:
                "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 shadow-amber-500/30",
              glow: "rgba(245,158,11,0.18)",
              decorLine: "from-transparent via-amber-500/30 to-transparent",
              occupancyBg: "bg-amber-900/40 border-amber-700/30",
              occupancyText: "text-amber-300",
            },
          ];
          return (
            <>
              <ImmersiveScene
                variant="depth"
                className="py-28 md:py-40 bg-[#050505]/40"
                data-testid="section-housing-plans"
              >
                <div className="container mx-auto px-4 relative z-10">
                  <div className="text-center mb-12 md:mb-16">
                    <motion.p
                      className="text-xs tracking-[0.5em] uppercase font-medium mb-6"
                      style={{ color: "rgba(212,175,55,0.85)" }}
                      initial={{ opacity: 0, y: -20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                    >
                      The Living Archive
                    </motion.p>
                    <h2 className="text-4xl md:text-6xl lg:text-7xl font-heading font-black text-white mb-6 tracking-tight leading-[1.15]">
                      <CinematicText delay={0.1}>Housing</CinematicText>{" "}
                      <CinematicText delay={0.3} gradient>
                        Plans
                      </CinematicText>
                    </h2>
                    <motion.p
                      className="text-white/30 max-w-xl mx-auto text-sm md:text-base leading-relaxed"
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5 }}
                    >
                      Walk through our curated archive. Each frame is a complete
                      living experience — tap one to step inside.
                    </motion.p>
                    <motion.div
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.6 }}
                      className="w-32 h-[1px] mx-auto mt-8"
                      style={{
                        background:
                          "linear-gradient(to right, transparent, rgba(212,175,55,0.5), transparent)",
                      }}
                    />
                  </div>

                  {void _tierDesigns_unused}
                </div>
              </ImmersiveScene>
              <PlansHallway
                plans={featuredPlans as any[]}
                properties={properties}
                onExplore={(target) => setLocation(target)}
              />
            </>
          );
        })()}
        </>
      )}
      {instagramPosts.length > 0 && (
        <>
          <ImmersiveScene
            variant="aurora"
            className="py-28 md:py-40 bg-[#050505]/40"
            data-testid="instagram-feed-section"
          >
            <div
              className="container mx-auto px-4 relative z-10"
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
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                      }}
                    >
                      <svg
                        className="w-5 h-5 text-white"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                    </div>
                    <p
                      className="text-sm tracking-[0.3em] uppercase font-medium"
                      style={{
                        background:
                          "linear-gradient(135deg, #f09433, #dc2743, #bc1888)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      Live From Instagram
                    </p>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-heading font-black text-white mb-2">
                    Life at Hsquareliving
                  </h2>
                  <p className="text-white/30 font-light">
                    Follow our journey and see what makes us special
                  </p>
                </div>
                <a
                  href="https://www.instagram.com/hsquareliving/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 md:mt-0 group flex items-center gap-2 text-sm font-semibold tracking-wider uppercase hover:opacity-80 transition-opacity"
                  style={{
                    background:
                      "linear-gradient(135deg, #f09433, #dc2743, #bc1888)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                  data-testid="link-instagram-profile"
                >
                  @hsquareliving{" "}
                  <ExternalLink className="w-4 h-4 text-pink-500 group-hover:translate-x-0.5 transition-transform" />
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
                        alt={
                          instagramPosts[igCurrentSlide]?.caption?.slice(
                            0,
                            100,
                          ) || "Instagram post"
                        }
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
                    <span className="text-white text-xs font-medium tracking-wide">
                      LIVE FEED
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      setIgCurrentSlide(
                        (prev) =>
                          (prev - 1 + instagramPosts.length) %
                          instagramPosts.length,
                      )
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/30 border border-white/20 flex items-center justify-center text-white hover:bg-black/50 transition-all"
                    data-testid="button-ig-prev"
                    aria-label="Previous Instagram post"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() =>
                      setIgCurrentSlide(
                        (prev) => (prev + 1) % instagramPosts.length,
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/30 border border-white/20 flex items-center justify-center text-white hover:bg-black/50 transition-all"
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
                      style={{
                        width: i === igCurrentSlide ? "2rem" : "0.75rem",
                      }}
                      data-testid={`button-ig-dot-${i}`}
                    >
                      <span
                        className={`absolute inset-0 rounded-full ${
                          i === igCurrentSlide
                            ? "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600"
                            : "bg-white/20 hover:bg-white/40"
                        }`}
                      />
                      {i === igCurrentSlide && igAutoPlaying && (
                        <motion.span
                          className="absolute inset-0 rounded-full origin-left"
                          style={{
                            background:
                              "linear-gradient(90deg, #f09433, #dc2743, #bc1888)",
                          }}
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
                        i === igCurrentSlide
                          ? "ring-2 ring-pink-500 ring-offset-2 ring-offset-[#050505] scale-95 border-pink-500/50"
                          : "opacity-60 hover:opacity-100 border-white/[0.06]"
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
          <ImmersiveScene
            variant="grid"
            className="py-28 md:py-40 bg-[#050505]/40"
          >
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
                    <CinematicText delay={0.3} gradient>
                      Residences
                    </CinematicText>
                  </h2>
                </div>
                <Link href="/properties">
                  <Button
                    variant="ghost"
                    className="text-white/40 hover:text-white hover:bg-white/5 mt-4 md:mt-0 group tracking-widest uppercase text-xs"
                    data-testid="link-view-all-properties"
                  >
                    View All{" "}
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.slice(0, 3).map((property: any, i: number) => {
                  const prices =
                    property.roomTypes
                      ?.map((r: any) =>
                        property.bookingMode === "academic_year"
                          ? r.academicYearPrice || r.basePrice * 11
                          : r.basePrice,
                      )
                      .filter((p: number) => p > 0) || [];
                  const lowestPrice =
                    prices.length > 0 ? Math.min(...prices) : 0;
                  const totalBeds =
                    property.roomTypes?.reduce(
                      (sum: number, r: any) => sum + (r.availableBeds || 0),
                      0,
                    ) || 0;

                  const propColors = [
                    {
                      accent: "from-amber-500 to-orange-400",
                      glow: "rgba(245,158,11,0.2)",
                      border: "border-amber-500/20 hover:border-amber-500/40",
                    },
                    {
                      accent: "from-violet-500 to-purple-400",
                      glow: "rgba(139,92,246,0.2)",
                      border: "border-violet-500/20 hover:border-violet-500/40",
                    },
                    {
                      accent: "from-cyan-500 to-blue-400",
                      glow: "rgba(6,182,212,0.2)",
                      border: "border-cyan-500/20 hover:border-cyan-500/40",
                    },
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
                        whileHover={{
                          y: -12,
                          transition: {
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                          },
                        }}
                        className="h-full"
                      >
                        <Link
                          href={`/properties/${property.slug || property.id}`}
                        >
                          <div
                            className={`p-6 md:p-8 rounded-2xl border ${pc.border} bg-white/[0.02] relative overflow-hidden transition-all duration-500 h-full flex flex-col`}
                          >
                            <div
                              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl"
                              style={{
                                background: `radial-gradient(ellipse at 50% 0%, ${pc.glow} 0%, transparent 60%)`,
                              }}
                            />

                            <motion.div
                              className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${pc.accent} flex items-center justify-center mb-5 shadow-lg relative z-10 shrink-0`}
                              style={{ boxShadow: `0 8px 30px ${pc.glow}` }}
                              whileHover={{ scale: 1.15, rotate: 5 }}
                              transition={{
                                type: "spring",
                                stiffness: 400,
                                damping: 15,
                              }}
                            >
                              <Building2 className="w-6 h-6 md:w-7 md:h-7 text-white" />
                            </motion.div>

                            <h3 className="font-heading font-bold text-lg md:text-xl text-white mb-2 relative z-10 leading-tight group-hover:text-amber-400 transition-colors">
                              {property.name}
                            </h3>
                            <p className="text-white/30 text-sm flex items-center gap-1 mb-4 relative z-10">
                              <MapPin className="w-3.5 h-3.5" />
                              {property.location}
                            </p>

                            <div className="flex items-baseline gap-2 mb-4 relative z-10">
                              <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">
                                {lowestPrice > 0
                                  ? `₹${lowestPrice.toLocaleString()}`
                                  : "—"}
                              </span>
                              <span className="text-xs text-white/25">
                                {property.bookingMode === "academic_year"
                                  ? "/ year"
                                  : "/ month"}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 relative z-10">
                              <span
                                className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full ${
                                  property.bookingMode === "academic_year"
                                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                {property.bookingMode === "academic_year"
                                  ? "Academic Year"
                                  : "Monthly"}
                              </span>
                              {totalBeds > 0 && totalBeds < 5 && (
                                <span className="px-2.5 py-1 text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30 uppercase tracking-wider rounded-full">
                                  Only {totalBeds} left
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-4 relative z-10">
                              {property.amenities
                                ?.slice(0, 3)
                                .map((am: string) => (
                                  <span
                                    key={am}
                                    className="px-2 py-0.5 text-xs text-white/40 bg-white/[0.04] border border-white/[0.06] rounded-full"
                                  >
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
      <ImmersiveScene
        variant="aurora"
        className="py-28 md:py-40 bg-[#050505]/40"
      >
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
              <CinematicText delay={0.1}>Near Top</CinematicText>{" "}
              <CinematicText delay={0.3} gradient>
                Colleges
              </CinematicText>
            </h2>
            <motion.p
              className="text-white/25 max-w-2xl mx-auto text-sm md:text-base leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              Our hostels and co-living spaces are minutes away from Mumbai's
              top educational institutions, making your daily commute
              effortless.
            </motion.p>
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.6 }}
              className="w-32 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent mx-auto mt-8"
            />
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            data-testid="colleges-grid"
          >
            {[
              {
                name: "NMIMS University",
                area: "Vile Parle West",
                distance: "5 min",
                color: "from-cyan-500 to-blue-500",
                glow: "rgba(6,182,212,0.2)",
                href: "/hostel-near-nmims",
              },
              {
                name: "Mithibai College",
                area: "Vile Parle West",
                distance: "5 min",
                color: "from-violet-500 to-purple-500",
                glow: "rgba(139,92,246,0.2)",
                href: "/hostel-near-mithibai",
              },
              {
                name: "Mukesh Patel School of Technology",
                area: "Vile Parle West",
                distance: "5 min",
                color: "from-amber-500 to-orange-500",
                glow: "rgba(245,158,11,0.2)",
                href: "/hostel-near-mukesh-patel",
              },
              {
                name: "Whistling Woods International",
                area: "Goregaon East",
                distance: "10 min",
                color: "from-emerald-500 to-green-500",
                glow: "rgba(16,185,129,0.2)",
                href: "/hostel-near-whistling-woods",
              },
              {
                name: "DJ Sanghvi College of Engineering",
                area: "Vile Parle West",
                distance: "8 min",
                color: "from-pink-500 to-rose-500",
                glow: "rgba(236,72,153,0.2)",
                href: "/hostel-near-dj-sanghvi",
              },
              {
                name: "NM College of Commerce",
                area: "Vile Parle West",
                distance: "5 min",
                color: "from-sky-500 to-cyan-500",
                glow: "rgba(14,165,233,0.2)",
                href: "/hostel-near-nm-college",
              },
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
                  <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-500 relative overflow-hidden cursor-pointer">
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-2xl"
                      style={{
                        background: `radial-gradient(ellipse at 50% 0%, ${college.glow} 0%, transparent 60%)`,
                      }}
                    />
                    <div className="flex items-start gap-4 relative z-10">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${college.color} flex items-center justify-center shrink-0`}
                        style={{ boxShadow: `0 4px 20px ${college.glow}` }}
                      >
                        <GraduationCap className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-heading font-bold text-white text-sm md:text-base leading-tight mb-1 group-hover:text-cyan-400 transition-colors">
                          {college.name}
                        </h3>
                        <p className="text-white/30 text-xs flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {college.area}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                        <Navigation className="w-3 h-3 text-cyan-400" />
                        <span className="text-cyan-400 text-xs font-semibold">
                          {college.distance}
                        </span>
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
              Also conveniently located near HR College, Jai Hind College, KC
              College, Narsee Monjee College, SP Jain, Goregaon Station, Andheri
              Station, and Nesco Exhibition Centre.
            </p>
          </motion.div>
        </div>
      </ImmersiveScene>

      <section className="py-20 md:py-28 bg-[#050505]/40 relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(16,185,129,0.04) 0%, transparent 60%)",
          }}
        />
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
              <CinematicText delay={0.1}>Premium Hostel &</CinematicText>{" "}
              <CinematicText delay={0.3} gradient>
                Co-Living in Mumbai
              </CinematicText>
            </h2>

            <div
              className="space-y-6 text-white/35 text-sm md:text-base leading-relaxed"
              data-testid="seo-content-block"
            >
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                Hsquare Hostel is a premium co-living and hostel brand in Mumbai
                offering comfortable, secure, and affordable stays for students,
                working professionals, and travelers. Located in prime areas
                like Goregaon, Juhu, and Andheri, Hsquare provides modern
                amenities including WiFi, housekeeping, laundry, security, and
                community living experiences.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                Whether you're looking for an affordable hostel in Mumbai for
                students near NMIMS, Mithibai College, or Mukesh Patel, or a
                premium hostel near Goregaon station with WiFi and food —
                Hsquare is your perfect second home. We offer single, double,
                and triple sharing hostel rooms with fully furnished interiors,
                daily housekeeping, and nutritious meals.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
              >
                Our co-living spaces in Andheri West and shared accommodation
                options come with gym access, study lounges, rooftop terraces,
                and 24/7 CCTV security. From short-term stays to long-term
                student accommodation, Hsquare offers the best hostel experience
                in Mumbai with flexible payment plans and a vibrant community of
                like-minded residents.
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
            className="w-full h-full object-cover opacity-30"
            initial={{ scale: 1.2 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 3, ease: "easeOut" }}
          />
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-0"
            style={{ boxShadow: "inset 0 0 250px 100px rgba(0,0,0,0.6)" }}
          />
        </div>
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 30% 40%, rgba(6,182,212,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(139,92,246,0.06) 0%, transparent 50%)",
          }}
        />

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
          <h2
            className="text-5xl md:text-7xl lg:text-8xl font-heading font-black text-white mb-8 leading-[1.15] tracking-tighter"
            style={{ textShadow: "0 0 80px rgba(0,0,0,0.8)" }}
          >
            <CinematicText delay={0.3}>Your Premium Living</CinematicText>
            <br />
            <CinematicText delay={0.6} gradient>
              Experience Awaits
            </CinematicText>
          </h2>
          <motion.p
            className="text-white/30 text-lg md:text-xl max-w-2xl mx-auto mb-14 font-light"
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            Secure your spot in minutes. Premium accommodation with flexible
            payment plans, starting from ₹18,000/-.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            <Link href="/properties">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
              >
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
                onClick={() =>
                  window.open(`tel:${footerPhone.replace(/\s/g, "")}`)
                }
                data-testid="button-cta-call"
              >
                <Phone className="w-4 h-4 mr-2" />
                Contact Us
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>
      <section
        id="app-download-section"
        className="relative py-20 md:py-28 overflow-hidden"
        data-testid="app-download-section"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/50 via-[#0a0808]/50 to-[#050505]/50" />
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
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] mb-6">
                <Smartphone className="w-4 h-4 text-amber-400" />
                <span className="text-xs uppercase tracking-[0.25em] text-white/60 font-medium">
                  Mobile App
                </span>
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
                Download HsquareConnect — your smart companion for seamless
                hostel living. Manage everything from your phone.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {[
                  { icon: Bell, label: "Instant Alerts", desc: "Stay updated" },
                  {
                    icon: Wallet,
                    label: "Digital Wallet",
                    desc: "Easy payments",
                  },
                  {
                    icon: Utensils,
                    label: "Meal Tracking",
                    desc: "Daily menus",
                  },
                  { icon: QrCode, label: "Quick Check-in", desc: "Scan & go" },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <f.icon className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white/70">
                        {f.label}
                      </p>
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
                  <svg
                    className="w-7 h-7"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div>
                    <p className="text-[10px] leading-none opacity-60">
                      Download on the
                    </p>
                    <p className="text-base font-bold leading-tight">
                      App Store
                    </p>
                  </div>
                </a>

                {androidDownloadUrl && (
                  <a
                    href={androidDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-white/[0.06] border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 group"
                    data-testid="link-android-download"
                  >
                    <svg
                      className="w-7 h-7 text-emerald-400"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.523 15.3414c-.5 0-.9.4-.9.9v4.3c0 .5-.4.9-.9.9h-7.8c-.5 0-.9-.4-.9-.9v-4.3c0-.5-.4-.9-.9-.9s-.9.4-.9.9v4.3c0 1.5 1.2 2.7 2.7 2.7h7.8c1.5 0 2.7-1.2 2.7-2.7v-4.3c0-.5-.4-.9-.9-.9z" />
                      <path d="M11.323 17.6414c.1.1.3.2.5.2h.4c.2 0 .3-.1.5-.2l3.6-3.6c.4-.4.4-.9 0-1.3s-.9-.4-1.3 0l-2 2v-11.7c0-.5-.4-.9-.9-.9s-.9.4-.9.9v11.7l-2-2c-.4-.4-.9-.4-1.3 0s-.4.9 0 1.3z" />
                    </svg>
                    <div>
                      <p className="text-[10px] leading-none text-white/50">
                        Download for
                      </p>
                      <p className="text-base font-bold leading-tight">
                        Android
                      </p>
                    </div>
                  </a>
                )}

                <div className="flex items-center gap-1.5 self-center">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className="w-3.5 h-3.5 text-amber-400 fill-amber-400"
                      />
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
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.2,
              }}
              className="relative flex justify-center"
            >
              <div className="relative">
                <div className="absolute -inset-8 bg-gradient-to-br from-amber-500/20 via-transparent to-orange-500/20 rounded-[3rem] blur-2xl" />
                <div className="relative w-[260px] h-[520px] rounded-[2.5rem] bg-gradient-to-b from-stone-800 to-stone-900 border-2 border-stone-700 shadow-2xl overflow-hidden">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-b-2xl z-10" />

                  <div className="w-full h-full bg-gradient-to-b from-[#8B1A4A] via-[#6B1540] to-[#4A0E2E] flex flex-col items-center justify-center p-8">
                    <div className="w-20 h-20 rounded-2xl bg-white shadow-xl flex items-center justify-center mb-5">
                      <img
                        src={hsquareLogo}
                        alt="Hsquare"
                        className="w-14 h-14 object-contain"
                      />
                    </div>
                    <h3 className="text-white font-heading font-bold text-lg text-center mb-1">
                      HsquareConnect
                    </h3>
                    <p className="text-white/60 text-xs text-center mb-6">
                      Your Smart Living Companion
                    </p>

                    <div className="w-full space-y-2.5">
                      {[
                        "Dashboard",
                        "My Room",
                        "Meals",
                        "Wallet",
                        "Support",
                      ].map((item, i) => (
                        <div
                          key={item}
                          className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/10"
                        >
                          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-sm bg-white/40" />
                          </div>
                          <span className="text-white/80 text-xs font-medium">
                            {item}
                          </span>
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
      </div>

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
