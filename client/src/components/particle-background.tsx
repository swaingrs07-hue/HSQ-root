import { useEffect, useRef, useCallback } from "react";

type ParticlePreset = "hero" | "section" | "sparse";

interface ParticleBackgroundProps {
  preset?: ParticlePreset;
  className?: string;
  id?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  opacityDir: number;
  color: string;
  z: number;
}

const PRESETS: Record<ParticlePreset, {
  count: number;
  mobileCount: number;
  colors: string[];
  minSize: number;
  maxSize: number;
  minSpeed: number;
  maxSpeed: number;
  minOpacity: number;
  maxOpacity: number;
  direction: "random" | "up";
  orbCount: number;
}> = {
  hero: {
    count: 18,
    mobileCount: 8,
    colors: ["255,255,255", "245,158,11", "167,139,250"],
    minSize: 0.5, maxSize: 2.5,
    minSpeed: 0.06, maxSpeed: 0.2,
    minOpacity: 0.05, maxOpacity: 0.4,
    direction: "random",
    orbCount: 1,
  },
  section: {
    count: 14,
    mobileCount: 6,
    colors: ["245,158,11", "167,139,250", "59,130,246"],
    minSize: 0.5, maxSize: 2,
    minSpeed: 0.05, maxSpeed: 0.18,
    minOpacity: 0.03, maxOpacity: 0.25,
    direction: "random",
    orbCount: 1,
  },
  sparse: {
    count: 10,
    mobileCount: 5,
    colors: ["255,255,255", "245,158,11"],
    minSize: 0.5, maxSize: 2.5,
    minSpeed: 0.03, maxSpeed: 0.12,
    minOpacity: 0.02, maxOpacity: 0.2,
    direction: "up",
    orbCount: 1,
  },
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function ParticleBackground({ preset = "hero", className = "", id }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const isVisibleRef = useRef(true);
  const configRef = useRef(PRESETS[preset]);

  const initParticles = useCallback((w: number, h: number) => {
    const cfg = configRef.current;
    const particles: Particle[] = [];
    const isMobile = w < 768;
    const count = isMobile ? cfg.mobileCount : cfg.count;

    for (let i = 0; i < count; i++) {
      const z = Math.random();
      const depthScale = 0.3 + z * 0.7;
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(cfg.minSpeed, cfg.maxSpeed) * depthScale;

      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: cfg.direction === "up" ? rand(-0.05, 0.05) : Math.cos(angle) * speed,
        vy: cfg.direction === "up" ? -rand(cfg.minSpeed, cfg.maxSpeed) * depthScale : Math.sin(angle) * speed,
        size: rand(cfg.minSize, cfg.maxSize) * depthScale,
        opacity: rand(cfg.minOpacity, cfg.maxOpacity) * depthScale,
        opacityDir: (Math.random() > 0.5 ? 1 : -1) * rand(0.001, 0.003),
        color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
        z,
      });
    }

    const orbCount = isMobile ? 1 : cfg.orbCount;
    for (let i = 0; i < orbCount; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: rand(-0.1, 0.1),
        vy: rand(-0.1, 0.1),
        size: rand(4, 7),
        opacity: rand(0.04, 0.1),
        opacityDir: rand(0.001, 0.002),
        color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
        z: 0.8,
      });
    }

    return particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const cfg = configRef.current;

    let w = 0, h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = canvas.parentElement?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = initParticles(w, h);
    };

    resize();
    let resizeTimer: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    };
    window.addEventListener("resize", debouncedResize);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    visibilityObserver.observe(canvas);

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      return () => {
        visibilityObserver.disconnect();
        window.removeEventListener("resize", debouncedResize);
      };
    }

    let frameCount = 0;

    const animate = () => {
      if (!isVisibleRef.current) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      frameCount++;
      if (frameCount % 2 !== 0) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        p.opacity += p.opacityDir;
        if (p.opacity >= cfg.maxOpacity * (0.3 + p.z * 0.7) || p.opacity <= cfg.minOpacity) {
          p.opacityDir *= -1;
        }
        p.opacity = Math.max(cfg.minOpacity, Math.min(cfg.maxOpacity, p.opacity));

        if (p.size > 3) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.color},${p.opacity * 0.3})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.opacity})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      visibilityObserver.disconnect();
      window.removeEventListener("resize", debouncedResize);
      clearTimeout(resizeTimer);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      id={id}
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    />
  );
}
