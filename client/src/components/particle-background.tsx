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
}

const PRESETS: Record<ParticlePreset, {
  count: number;
  colors: string[];
  minSize: number;
  maxSize: number;
  minSpeed: number;
  maxSpeed: number;
  minOpacity: number;
  maxOpacity: number;
  links: boolean;
  linkDistance: number;
  linkOpacity: number;
  direction: "random" | "up";
  grab: boolean;
  grabDistance: number;
}> = {
  hero: {
    count: 50,
    colors: ["255,255,255", "245,158,11", "167,139,250", "251,191,36"],
    minSize: 1, maxSize: 3,
    minSpeed: 0.15, maxSpeed: 0.6,
    minOpacity: 0.1, maxOpacity: 0.5,
    links: true, linkDistance: 130, linkOpacity: 0.08,
    direction: "random",
    grab: true, grabDistance: 150,
  },
  section: {
    count: 25,
    colors: ["245,158,11", "167,139,250"],
    minSize: 1, maxSize: 2,
    minSpeed: 0.1, maxSpeed: 0.3,
    minOpacity: 0.05, maxOpacity: 0.25,
    links: false, linkDistance: 0, linkOpacity: 0,
    direction: "random",
    grab: false, grabDistance: 0,
  },
  sparse: {
    count: 12,
    colors: ["255,255,255"],
    minSize: 1, maxSize: 2.5,
    minSpeed: 0.05, maxSpeed: 0.2,
    minOpacity: 0.03, maxOpacity: 0.15,
    links: false, linkDistance: 0, linkOpacity: 0,
    direction: "up",
    grab: false, grabDistance: 0,
  },
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function ParticleBackground({ preset = "hero", className = "", id }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const isVisibleRef = useRef(true);
  const configRef = useRef(PRESETS[preset]);

  const initParticles = useCallback((w: number, h: number) => {
    const cfg = configRef.current;
    const particles: Particle[] = [];
    const isMobile = w < 768;
    const count = isMobile ? Math.floor(cfg.count * 0.5) : cfg.count;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(cfg.minSpeed, cfg.maxSpeed);
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: cfg.direction === "up" ? rand(-0.1, 0.1) : Math.cos(angle) * speed,
        vy: cfg.direction === "up" ? -rand(cfg.minSpeed, cfg.maxSpeed) : Math.sin(angle) * speed,
        size: rand(cfg.minSize, cfg.maxSize),
        opacity: rand(cfg.minOpacity, cfg.maxOpacity),
        opacityDir: Math.random() > 0.5 ? 0.002 : -0.002,
        color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
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

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
      particlesRef.current = initParticles(rect.width, rect.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    if (cfg.grab) {
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mouseleave", handleMouseLeave);
    }

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0 }
    );
    visibilityObserver.observe(canvas);

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      return () => {
        visibilityObserver.disconnect();
        window.removeEventListener("resize", resize);
      };
    }

    const animate = () => {
      if (!isVisibleRef.current) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }
      const w = canvas.width / (Math.min(window.devicePixelRatio || 1, 2));
      const h = canvas.height / (Math.min(window.devicePixelRatio || 1, 2));
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
        if (p.opacity >= cfg.maxOpacity || p.opacity <= cfg.minOpacity) {
          p.opacityDir *= -1;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.opacity})`;
        ctx.fill();
      }

      if (cfg.links) {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < cfg.linkDistance) {
              const opacity = cfg.linkOpacity * (1 - dist / cfg.linkDistance);
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      if (cfg.grab) {
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        for (const p of particles) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < cfg.grabDistance) {
            const opacity = 0.2 * (1 - dist / cfg.grabDistance);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mx, my);
            ctx.strokeStyle = `rgba(245,158,11,${opacity})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      visibilityObserver.disconnect();
      window.removeEventListener("resize", resize);
      if (cfg.grab) {
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      id={id}
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: preset === "hero" ? "auto" : "none" }}
    />
  );
}
