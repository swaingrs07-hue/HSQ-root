import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import hsquareLogo from "@/assets/hsquare-logo-full.png";

const CONFIG = {
  totalDuration: 6000,
  searchPhase: 2400,
  lockPhase: 1200,
  revealPhase: 1200,
  holdPhase: 1200,
  colors: {
    primary: "#f59e0b",
    secondary: "#06b6d4",
    accent: "#8b5cf6",
    bg: "#050505",
  },
};

interface Point { x: number; y: number; }

export function CinematicIntro({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const [phase, setPhase] = useState<"playing" | "fadeout">("playing");
  const [visible, setVisible] = useState(true);
  const startTime = useRef(0);
  const rafId = useRef(0);

  const prefersReduced = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReduced) {
      onComplete();
      setVisible(false);
      return;
    }

    const img = new Image();
    img.src = hsquareLogo;
    img.onload = () => { logoRef.current = img; };

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let logoCenter: Point = { x: w * 0.5, y: h * 0.45 };
    let logoW = Math.min(280, w * 0.5);
    let logoH = logoW * 0.35;
    let searchPath: Point[] = [];

    function buildGeometry() {
      logoCenter = { x: w * 0.5, y: h * 0.45 };
      logoW = Math.min(280, w * 0.5);
      logoH = logoW * 0.35;
      searchPath = [];
      const steps = 120;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const spiralR = 0.15 + t * 0.3;
        const angle = t * Math.PI * 6;
        searchPath.push({
          x: w * (0.5 + Math.cos(angle) * spiralR * (1 - t * 0.6)),
          y: h * (0.5 + Math.sin(angle) * spiralR * 0.6 * (1 - t * 0.6)),
        });
      }
    }

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = w + "px";
      canvas!.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGeometry();
    }
    resize();
    window.addEventListener("resize", resize);

    const dustParticles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number; }[] = [];
    for (let i = 0; i < 60; i++) {
      dustParticles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 1.5 + 0.5, alpha: Math.random() * 0.3,
      });
    }

    startTime.current = performance.now();

    function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function easeOut(t: number) { return 1 - Math.pow(1 - t, 3); }
    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
    function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

    function drawBackground(t: number) {
      ctx!.fillStyle = CONFIG.colors.bg;
      ctx!.fillRect(0, 0, w, h);

      const grd = ctx!.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.7);
      grd.addColorStop(0, "rgba(245,158,11,0.03)");
      grd.addColorStop(0.5, "rgba(6,182,212,0.02)");
      grd.addColorStop(1, "transparent");
      ctx!.fillStyle = grd;
      ctx!.fillRect(0, 0, w, h);

      ctx!.strokeStyle = "rgba(255,255,255,0.015)";
      ctx!.lineWidth = 0.5;
      const gridSize = 60;
      for (let x = 0; x < w; x += gridSize) {
        ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, h); ctx!.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(w, y); ctx!.stroke();
      }

      for (const p of dustParticles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,255,255,${p.alpha * (0.5 + Math.sin(t * 2 + p.x) * 0.5)})`;
        ctx!.fill();
      }
    }

    function drawScanLines(t: number) {
      const scanY = (t * 400) % h;
      const grd = ctx!.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      grd.addColorStop(0, "transparent");
      grd.addColorStop(0.5, "rgba(6,182,212,0.04)");
      grd.addColorStop(1, "transparent");
      ctx!.fillStyle = grd;
      ctx!.fillRect(0, scanY - 40, w, 80);

      for (let y = 0; y < h; y += 3) {
        ctx!.fillStyle = `rgba(0,0,0,${0.03 + Math.sin(y * 0.5 + t) * 0.01})`;
        ctx!.fillRect(0, y, w, 1);
      }
    }

    function drawCrosshair(cx: number, cy: number, progress: number, lockAmount: number) {
      const baseSize = 40 - lockAmount * 15;
      const rotation = progress * Math.PI * 4;

      ctx!.save();
      ctx!.translate(cx, cy);

      const outerR = baseSize + Math.sin(progress * 8) * 3;
      ctx!.strokeStyle = `rgba(245,158,11,${0.6 + lockAmount * 0.4})`;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.arc(0, 0, outerR, 0, Math.PI * 2);
      ctx!.stroke();

      ctx!.save();
      ctx!.rotate(rotation);
      ctx!.strokeStyle = `rgba(6,182,212,${0.4 + lockAmount * 0.3})`;
      ctx!.lineWidth = 1;
      ctx!.setLineDash([4, 6]);
      ctx!.beginPath();
      ctx!.arc(0, 0, outerR * 0.65, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.setLineDash([]);
      ctx!.restore();

      ctx!.save();
      ctx!.rotate(-rotation * 0.7);
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i;
        const arcStart = angle - 0.3;
        const arcEnd = angle + 0.3;
        ctx!.strokeStyle = `rgba(245,158,11,${0.5 + lockAmount * 0.5})`;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.arc(0, 0, outerR + 8, arcStart, arcEnd);
        ctx!.stroke();
      }
      ctx!.restore();

      const gap = 4;
      const lineLen = 12 + lockAmount * 4;
      ctx!.strokeStyle = `rgba(255,255,255,${0.7 + lockAmount * 0.3})`;
      ctx!.lineWidth = 1.5;
      ctx!.shadowColor = CONFIG.colors.primary;
      ctx!.shadowBlur = 6 + lockAmount * 10;

      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dx, dy] of dirs) {
        ctx!.beginPath();
        ctx!.moveTo(dx * (outerR + gap), dy * (outerR + gap));
        ctx!.lineTo(dx * (outerR + gap + lineLen), dy * (outerR + gap + lineLen));
        ctx!.stroke();
      }
      ctx!.shadowBlur = 0;

      if (lockAmount > 0.2) {
        const cornerR = outerR * 1.3 * (1 - lockAmount * 0.3);
        ctx!.strokeStyle = `rgba(245,158,11,${lockAmount * 0.6})`;
        ctx!.lineWidth = 1.5;
        const cornerLen = 10;
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (const [sx, sy] of corners) {
          ctx!.beginPath();
          ctx!.moveTo(sx * cornerR, sy * (cornerR - cornerLen));
          ctx!.lineTo(sx * cornerR, sy * cornerR);
          ctx!.lineTo(sx * (cornerR - cornerLen), sy * cornerR);
          ctx!.stroke();
        }
      }

      ctx!.fillStyle = `rgba(245,158,11,${0.5 + lockAmount * 0.5})`;
      ctx!.beginPath();
      ctx!.arc(0, 0, 2 + lockAmount, 0, Math.PI * 2);
      ctx!.fill();

      if (lockAmount > 0.5) {
        const pulseR = outerR * (1 + (1 - lockAmount) * 2);
        ctx!.strokeStyle = `rgba(245,158,11,${(1 - lockAmount) * 0.4})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(0, 0, pulseR, 0, Math.PI * 2);
        ctx!.stroke();
      }

      ctx!.restore();
    }

    function drawHUD(progress: number, lockAmount: number) {
      ctx!.font = "10px monospace";
      ctx!.fillStyle = `rgba(6,182,212,${0.3 + lockAmount * 0.3})`;

      const status = lockAmount > 0.8 ? "TARGET LOCKED" : lockAmount > 0.2 ? "ACQUIRING..." : "SCANNING";
      ctx!.fillText(status, 20, h - 40);

      ctx!.fillText(`SYS ${(progress * 100).toFixed(0)}%`, 20, h - 25);

      const coords = lockAmount > 0.5 ? "24.1°N  72.8°E" : `${(Math.random() * 90).toFixed(1)}°N  ${(Math.random() * 180).toFixed(1)}°E`;
      ctx!.fillText(coords, w - 130, h - 40);

      if (lockAmount > 0.3) {
        ctx!.fillStyle = `rgba(245,158,11,${lockAmount * 0.5})`;
        ctx!.fillText("HSQUARE // HARMONY IN LIVING", w - 220, h - 25);
      }

      const barW = 100;
      const barH = 3;
      const barX = 20;
      const barY = h - 55;
      ctx!.fillStyle = "rgba(255,255,255,0.1)";
      ctx!.fillRect(barX, barY, barW, barH);
      ctx!.fillStyle = `rgba(245,158,11,${0.5 + lockAmount * 0.5})`;
      ctx!.fillRect(barX, barY, barW * progress, barH);
    }

    function drawLogoReveal(revealProgress: number) {
      const logo = logoRef.current;
      if (!logo) return;

      const lx = logoCenter.x - logoW / 2;
      const ly = logoCenter.y - logoH / 2;

      if (revealProgress > 0) {
        ctx!.save();
        ctx!.globalAlpha = clamp(revealProgress * 1.5, 0, 1);

        const glowR = logoW * 0.8;
        const glow = ctx!.createRadialGradient(logoCenter.x, logoCenter.y, 0, logoCenter.x, logoCenter.y, glowR);
        glow.addColorStop(0, `rgba(245,158,11,${0.2 * revealProgress})`);
        glow.addColorStop(0.4, `rgba(6,182,212,${0.08 * revealProgress})`);
        glow.addColorStop(1, "transparent");
        ctx!.fillStyle = glow;
        ctx!.fillRect(logoCenter.x - glowR, logoCenter.y - glowR, glowR * 2, glowR * 2);

        ctx!.drawImage(logo, lx, ly, logoW, logoH);

        if (revealProgress > 0.3) {
          const shimmerX = lx + logoW * ((revealProgress - 0.3) / 0.7) * 1.5 - logoW * 0.25;
          const shimmerGrd = ctx!.createLinearGradient(shimmerX - 30, 0, shimmerX + 30, 0);
          shimmerGrd.addColorStop(0, "transparent");
          shimmerGrd.addColorStop(0.5, `rgba(255,255,255,${0.15 * revealProgress})`);
          shimmerGrd.addColorStop(1, "transparent");
          ctx!.fillStyle = shimmerGrd;
          ctx!.fillRect(lx, ly, logoW, logoH);
        }

        ctx!.restore();
      } else {
        ctx!.save();
        ctx!.globalAlpha = 0.08;
        ctx!.filter = "blur(8px) brightness(0.3)";
        ctx!.drawImage(logo, lx, ly, logoW, logoH);
        ctx!.filter = "none";
        ctx!.restore();
      }
    }

    function drawLensFlare(cx: number, cy: number, intensity: number) {
      if (intensity < 0.01) return;
      const flare = ctx!.createRadialGradient(cx, cy, 0, cx, cy, 120 * intensity);
      flare.addColorStop(0, `rgba(245,158,11,${0.15 * intensity})`);
      flare.addColorStop(0.3, `rgba(255,220,150,${0.05 * intensity})`);
      flare.addColorStop(1, "transparent");
      ctx!.fillStyle = flare;
      ctx!.fillRect(cx - 150, cy - 150, 300, 300);

      ctx!.strokeStyle = `rgba(245,158,11,${0.1 * intensity})`;
      ctx!.lineWidth = 0.5;
      const streakLen = 80 * intensity;
      ctx!.beginPath(); ctx!.moveTo(cx - streakLen, cy); ctx!.lineTo(cx + streakLen, cy); ctx!.stroke();
      ctx!.beginPath(); ctx!.moveTo(cx, cy - streakLen * 0.3); ctx!.lineTo(cx, cy + streakLen * 0.3); ctx!.stroke();
    }

    function render(now: number) {
      const elapsed = now - startTime.current;
      const totalT = clamp(elapsed / CONFIG.totalDuration, 0, 1);

      const { searchPhase, lockPhase, revealPhase, totalDuration } = CONFIG;
      const searchEnd = searchPhase / totalDuration;
      const lockEnd = (searchPhase + lockPhase) / totalDuration;
      const revealEnd = (searchPhase + lockPhase + revealPhase) / totalDuration;

      ctx!.clearRect(0, 0, w, h);

      drawBackground(totalT * 10);
      drawScanLines(totalT * 10);

      let crosshairPos: Point;
      let lockAmount = 0;
      let revealProgress = 0;

      if (totalT < searchEnd) {
        const searchT = totalT / searchEnd;
        const pathIdx = Math.floor(easeInOut(searchT) * (searchPath.length - 1));
        crosshairPos = searchPath[Math.min(pathIdx, searchPath.length - 1)];
        lockAmount = 0;
      } else if (totalT < lockEnd) {
        const lockT = (totalT - searchEnd) / (lockEnd - searchEnd);
        lockAmount = easeOut(lockT);
        const lastSearch = searchPath[searchPath.length - 1];
        crosshairPos = {
          x: lerp(lastSearch.x, logoCenter.x, easeOut(lockT)),
          y: lerp(lastSearch.y, logoCenter.y, easeOut(lockT)),
        };
      } else if (totalT < revealEnd) {
        const revealT = (totalT - lockEnd) / (revealEnd - lockEnd);
        crosshairPos = logoCenter;
        lockAmount = 1;
        revealProgress = easeOut(revealT);
      } else {
        crosshairPos = logoCenter;
        lockAmount = 1;
        revealProgress = 1;
        const holdT = (totalT - revealEnd) / (1 - revealEnd);
        lockAmount = Math.max(0, 1 - holdT * 2);
      }

      drawLogoReveal(revealProgress);

      if (lockAmount > 0 || totalT < lockEnd) {
        drawCrosshair(crosshairPos.x, crosshairPos.y, totalT, lockAmount);
      }

      drawLensFlare(crosshairPos.x, crosshairPos.y, lockAmount * 0.8);
      drawHUD(totalT, lockAmount);

      if (lockAmount > 0.8 && revealProgress < 0.5) {
        ctx!.fillStyle = `rgba(255,255,255,${(1 - revealProgress * 2) * 0.03 * (0.5 + Math.sin(totalT * 40) * 0.5)})`;
        ctx!.fillRect(0, 0, w, h);
      }

      if (elapsed < CONFIG.totalDuration) {
        rafId.current = requestAnimationFrame(render);
      } else {
        setPhase("fadeout");
        fadeTimeoutId = window.setTimeout(() => {
          setVisible(false);
          onComplete();
        }, 800);
      }
    }

    let fadeTimeoutId: number | undefined;
    rafId.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId.current);
      if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
      window.removeEventListener("resize", resize);
    };
  }, [onComplete, prefersReduced]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[200]"
          initial={{ opacity: 1 }}
          animate={{ opacity: phase === "fadeout" ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          style={{ background: CONFIG.colors.bg }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{ width: "100%", height: "100%" }}
          />

          {phase === "fadeout" && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              style={{
                background: `radial-gradient(ellipse at center, rgba(245,158,11,0.08) 0%, transparent 60%)`,
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
