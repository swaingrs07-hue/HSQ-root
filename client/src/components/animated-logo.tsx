import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useRef, useState, useCallback } from "react";

interface AnimatedLogoProps {
  src: string;
  alt: string;
  className?: string;
}

export function AnimatedLogo({ src, alt, className }: AnimatedLogoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [lightPos, setLightPos] = useState({ x: 50, y: 50 });

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [15, -15]), { stiffness: 300, damping: 25 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-15, 15]), { stiffness: 300, damping: 25 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
    setLightPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
    setHovered(false);
    setLightPos({ x: 50, y: 50 });
  }, [mouseX, mouseY]);

  return (
    <motion.div
      ref={ref}
      className="relative cursor-pointer"
      style={{ perspective: 800 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        animate={{ y: [0, -2, 0] }}
        transition={{ y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" } }}
        className="relative"
      >
        <img
          src={src}
          alt={alt}
          className={className}
          style={{
            position: "relative",
            zIndex: 2,
            filter: hovered ? "drop-shadow(0 0 12px rgba(245,158,11,0.5))" : "drop-shadow(0 0 4px rgba(245,158,11,0.15))",
            transition: "filter 0.3s ease",
          }}
        />

        {hovered && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              zIndex: 3,
              background: `radial-gradient(circle at ${lightPos.x}% ${lightPos.y}%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 30%, transparent 60%)`,
              mixBlendMode: "overlay",
              transition: "background 0.05s linear",
            }}
          />
        )}

        <div
          className="absolute -inset-3 pointer-events-none rounded-xl"
          style={{
            zIndex: 1,
            background: hovered
              ? `radial-gradient(ellipse at ${lightPos.x}% ${lightPos.y}%, rgba(245,158,11,0.3) 0%, rgba(6,182,212,0.1) 40%, transparent 70%)`
              : "radial-gradient(ellipse at center, rgba(245,158,11,0.08) 0%, transparent 70%)",
            filter: "blur(10px)",
            opacity: hovered ? 1 : 0.4,
            transition: "opacity 0.3s ease, background 0.05s linear",
          }}
        />

        {hovered && (
          <div
            className="absolute pointer-events-none"
            style={{
              zIndex: 4,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.8)",
              boxShadow: "0 0 8px 2px rgba(245,158,11,0.6), 0 0 20px 4px rgba(245,158,11,0.3)",
              left: `${lightPos.x}%`,
              top: `${lightPos.y}%`,
              transform: "translate(-50%, -50%)",
              transition: "left 0.05s linear, top 0.05s linear",
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
