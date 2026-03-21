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
  baseSize: number;
  pulsePhase: number;
  pulseSpeed: number;
  isOrb: boolean;
  orbGlow: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  trail: { x: number; y: number; opacity: number }[];
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
  shootingStars: boolean;
  aurora: boolean;
  grid: boolean;
  orbCount: number;
  galaxySwirl: boolean;
}> = {
  hero: {
    count: 40,
    colors: ["255,255,255", "245,158,11", "167,139,250"],
    minSize: 0.5, maxSize: 3,
    minSpeed: 0.08, maxSpeed: 0.3,
    minOpacity: 0.05, maxOpacity: 0.5,
    links: false, linkDistance: 0, linkOpacity: 0,
    direction: "random",
    grab: false, grabDistance: 0,
    shootingStars: false,
    aurora: false,
    grid: false,
    orbCount: 2,
    galaxySwirl: false,
  },
  section: {
    count: 35,
    colors: ["245,158,11", "167,139,250", "59,130,246"],
    minSize: 0.5, maxSize: 2.5,
    minSpeed: 0.08, maxSpeed: 0.25,
    minOpacity: 0.03, maxOpacity: 0.3,
    links: false, linkDistance: 0, linkOpacity: 0,
    direction: "random",
    grab: false, grabDistance: 0,
    shootingStars: true,
    aurora: false,
    grid: true,
    orbCount: 3,
    galaxySwirl: false,
  },
  sparse: {
    count: 18,
    colors: ["255,255,255", "245,158,11"],
    minSize: 0.5, maxSize: 3,
    minSpeed: 0.03, maxSpeed: 0.15,
    minOpacity: 0.02, maxOpacity: 0.2,
    links: false, linkDistance: 0, linkOpacity: 0,
    direction: "up",
    grab: false, grabDistance: 0,
    shootingStars: true,
    aurora: true,
    grid: false,
    orbCount: 2,
    galaxySwirl: false,
  },
};

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function ParticleBackground({ preset = "hero", className = "", id }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const isVisibleRef = useRef(true);
  const configRef = useRef(PRESETS[preset]);
  const timeRef = useRef(0);

  const initParticles = useCallback((w: number, h: number) => {
    const cfg = configRef.current;
    const particles: Particle[] = [];
    const isMobile = w < 768;
    const count = isMobile ? Math.floor(cfg.count * 0.5) : cfg.count;
    const centerX = w / 2;
    const centerY = h / 2;

    for (let i = 0; i < count; i++) {
      const z = Math.random();
      const depthScale = 0.3 + z * 0.7;
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(cfg.minSpeed, cfg.maxSpeed) * depthScale;

      let px: number, py: number;
      if (cfg.galaxySwirl && !isMobile) {
        const spiralAngle = (i / count) * Math.PI * 4 + Math.random() * 0.5;
        const radius = rand(50, Math.min(w, h) * 0.45);
        px = centerX + Math.cos(spiralAngle) * radius + rand(-30, 30);
        py = centerY + Math.sin(spiralAngle) * radius + rand(-30, 30);
      } else {
        px = Math.random() * w;
        py = Math.random() * h;
      }

      const baseSize = rand(cfg.minSize, cfg.maxSize) * depthScale;

      particles.push({
        x: px,
        y: py,
        vx: cfg.direction === "up" ? rand(-0.08, 0.08) : Math.cos(angle) * speed,
        vy: cfg.direction === "up" ? -rand(cfg.minSpeed, cfg.maxSpeed) * depthScale : Math.sin(angle) * speed,
        size: baseSize,
        baseSize: baseSize,
        opacity: rand(cfg.minOpacity, cfg.maxOpacity) * depthScale,
        opacityDir: (Math.random() > 0.5 ? 1 : -1) * rand(0.001, 0.003),
        color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
        z: z,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: rand(0.01, 0.03),
        isOrb: false,
        orbGlow: 0,
      });
    }

    const orbCount = isMobile ? Math.floor(cfg.orbCount * 0.5) : cfg.orbCount;
    for (let i = 0; i < orbCount; i++) {
      const z = 0.7 + Math.random() * 0.3;
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: rand(-0.15, 0.15),
        vy: rand(-0.15, 0.15),
        size: rand(4, 8),
        baseSize: rand(4, 8),
        opacity: rand(0.05, 0.15),
        opacityDir: rand(0.001, 0.002),
        color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
        z: z,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: rand(0.005, 0.015),
        isOrb: true,
        orbGlow: rand(15, 30),
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

    const spawnShootingStar = () => {
      if (shootingStarsRef.current.length >= 2) return;
      const startX = rand(-50, w * 0.6);
      const startY = rand(-50, h * 0.3);
      const angle = rand(0.3, 0.8);
      const speed = rand(4, 8);
      shootingStarsRef.current.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: rand(40, 80),
        size: rand(1.5, 3),
        trail: [],
      });
    };

    let shootingStarTimer: ReturnType<typeof setInterval> | null = null;
    if (cfg.shootingStars) {
      shootingStarTimer = setInterval(() => {
        if (Math.random() < 0.4) spawnShootingStar();
      }, 3000);
    }

    const drawAurora = (time: number) => {
      if (!cfg.aurora) return;
      const gradient = ctx.createLinearGradient(0, h * 0.3, w, h * 0.8);
      const hue1 = (time * 0.01) % 360;
      const hue2 = (hue1 + 60) % 360;
      const hue3 = (hue1 + 120) % 360;
      gradient.addColorStop(0, `hsla(${hue1}, 70%, 30%, 0.02)`);
      gradient.addColorStop(0.3, `hsla(${hue2}, 60%, 25%, 0.03)`);
      gradient.addColorStop(0.6, `hsla(${hue3}, 50%, 20%, 0.02)`);
      gradient.addColorStop(1, `hsla(${hue1}, 40%, 15%, 0.01)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 3; i++) {
        const waveY = h * (0.3 + i * 0.15) + Math.sin(time * 0.005 + i) * 40;
        const grd = ctx.createRadialGradient(
          w * (0.3 + Math.sin(time * 0.003 + i * 2) * 0.2),
          waveY,
          0,
          w * 0.5,
          waveY,
          w * 0.4
        );
        const waveHue = (hue1 + i * 40) % 360;
        grd.addColorStop(0, `hsla(${waveHue}, 60%, 40%, 0.04)`);
        grd.addColorStop(0.5, `hsla(${waveHue}, 50%, 30%, 0.02)`);
        grd.addColorStop(1, `hsla(${waveHue}, 40%, 20%, 0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      }
    };

    const drawGrid = (time: number) => {
      if (!cfg.grid) return;
      const gridSpacing = 60;
      const gridOpacity = 0.03 + Math.sin(time * 0.01) * 0.01;
      ctx.strokeStyle = `rgba(245, 158, 11, ${gridOpacity})`;
      ctx.lineWidth = 0.5;

      for (let x = 0; x < w; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    };

    const animate = () => {
      if (!isVisibleRef.current) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      timeRef.current += 1;
      const time = timeRef.current;

      ctx.clearRect(0, 0, w, h);

      drawAurora(time);
      drawGrid(time);

      const particles = particlesRef.current;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        p.opacity += p.opacityDir;
        if (p.opacity >= cfg.maxOpacity * (0.3 + p.z * 0.7) || p.opacity <= cfg.minOpacity) {
          p.opacityDir *= -1;
        }
        p.opacity = Math.max(cfg.minOpacity, Math.min(cfg.maxOpacity, p.opacity));

        p.pulsePhase += p.pulseSpeed;
        const pulse = 1 + Math.sin(p.pulsePhase) * 0.15;
        const currentSize = p.baseSize * pulse;

        if (p.isOrb) {
          const glowRadius = p.orbGlow * pulse;
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius);
          gradient.addColorStop(0, `rgba(${p.color},${p.opacity * 1.5})`);
          gradient.addColorStop(0.3, `rgba(${p.color},${p.opacity * 0.5})`);
          gradient.addColorStop(1, `rgba(${p.color},0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, currentSize * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.color},${p.opacity * 2})`;
          ctx.fill();
        } else {
          if (p.z > 0.7) {
            const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, currentSize * 3);
            glow.addColorStop(0, `rgba(${p.color},${p.opacity * 0.5})`);
            glow.addColorStop(1, `rgba(${p.color},0)`);
            ctx.beginPath();
            ctx.arc(p.x, p.y, currentSize * 3, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${p.color},${p.opacity})`;
          ctx.fill();
        }
      }

      if (cfg.links) {
        const nonOrbParticles = particles.filter(p => !p.isOrb);
        for (let i = 0; i < nonOrbParticles.length; i++) {
          for (let j = i + 1; j < nonOrbParticles.length; j++) {
            const dx = nonOrbParticles[i].x - nonOrbParticles[j].x;
            const dy = nonOrbParticles[i].y - nonOrbParticles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < cfg.linkDistance) {
              const opacity = cfg.linkOpacity * (1 - dist / cfg.linkDistance);
              ctx.beginPath();
              ctx.moveTo(nonOrbParticles[i].x, nonOrbParticles[i].y);
              ctx.lineTo(nonOrbParticles[j].x, nonOrbParticles[j].y);
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
          if (p.isOrb) continue;
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

      const stars = shootingStarsRef.current;
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.x += s.vx;
        s.y += s.vy;
        s.life++;

        s.trail.unshift({ x: s.x, y: s.y, opacity: 1 });
        if (s.trail.length > 20) s.trail.pop();

        const lifeRatio = s.life / s.maxLife;
        const headOpacity = lifeRatio < 0.1 ? lifeRatio * 10 : lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1;

        const headGlow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 4);
        headGlow.addColorStop(0, `rgba(255,255,255,${headOpacity * 0.8})`);
        headGlow.addColorStop(0.5, `rgba(245,158,11,${headOpacity * 0.3})`);
        headGlow.addColorStop(1, `rgba(245,158,11,0)`);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = headGlow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${headOpacity})`;
        ctx.fill();

        for (let t = 1; t < s.trail.length; t++) {
          const tp = s.trail[t];
          const trailOpacity = headOpacity * (1 - t / s.trail.length) * 0.6;
          const trailSize = s.size * (1 - t / s.trail.length) * 0.8;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, trailSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(245,200,100,${trailOpacity})`;
          ctx.fill();
        }

        if (s.life >= s.maxLife) {
          stars.splice(i, 1);
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      visibilityObserver.disconnect();
      window.removeEventListener("resize", resize);
      if (shootingStarTimer) clearInterval(shootingStarTimer);
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