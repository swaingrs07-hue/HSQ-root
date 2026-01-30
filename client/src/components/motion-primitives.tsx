import { motion, HTMLMotionProps, Variants, Transition } from "framer-motion";
import { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

const springTransition: Transition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 25,
};

const easeTransition: Transition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
};

export const MotionCard = forwardRef<
  HTMLDivElement,
  HTMLMotionProps<"div"> & { children: ReactNode }
>(({ children, className, ...props }, ref) => (
  <motion.div
    ref={ref}
    className={cn("rounded-xl", className)}
    whileHover={{ 
      y: -4, 
      boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.15)",
    }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
    {...props}
  >
    {children}
  </motion.div>
));
MotionCard.displayName = "MotionCard";

export const MotionButton = forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<"button"> & { children: ReactNode }
>(({ children, className, ...props }, ref) => (
  <motion.button
    ref={ref}
    className={className}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.95 }}
    transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
    {...props}
  >
    {children}
  </motion.button>
));
MotionButton.displayName = "MotionButton";

export const MotionListItem = forwardRef<
  HTMLDivElement,
  HTMLMotionProps<"div"> & { children: ReactNode; index?: number }
>(({ children, className, index = 0, ...props }, ref) => (
  <motion.div
    ref={ref}
    className={className}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ delay: index * 0.05, duration: 0.3 }}
    {...props}
  >
    {children}
  </motion.div>
));
MotionListItem.displayName = "MotionListItem";

export function FadeInView({ 
  children, 
  delay = 0,
  direction = "up",
  className 
}: { 
  children: ReactNode; 
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  className?: string;
}) {
  const directionMap = {
    up: { y: 30, x: 0 },
    down: { y: -30, x: 0 },
    left: { x: 30, y: 0 },
    right: { x: -30, y: 0 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directionMap[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredList({ 
  children, 
  staggerDelay = 0.08,
  className 
}: { 
  children: ReactNode;
  staggerDelay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: staggerDelay },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggeredItem({ 
  children,
  className 
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PageTransition({ 
  children,
  className 
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScaleOnHover({ 
  children,
  scale = 1.03,
  className 
}: { 
  children: ReactNode;
  scale?: number;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring" as const, stiffness: 400, damping: 25 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCounter({ 
  value, 
  prefix = "",
  suffix = "",
  duration = 1.5,
  className 
}: { 
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {prefix}
      </motion.span>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {value.toLocaleString()}
      </motion.span>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {suffix}
      </motion.span>
    </motion.span>
  );
}

export function PulseRing({ 
  children,
  color = "indigo",
  className 
}: { 
  children: ReactNode;
  color?: "indigo" | "emerald" | "amber" | "rose";
  className?: string;
}) {
  const colors = {
    indigo: "rgba(99, 102, 241, 0.3)",
    emerald: "rgba(16, 185, 129, 0.3)",
    amber: "rgba(245, 158, 11, 0.3)",
    rose: "rgba(244, 63, 94, 0.3)",
  };

  return (
    <motion.div
      className={cn("relative", className)}
      whileHover={{
        boxShadow: `0 0 0 4px ${colors[color]}`,
      }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

export function ShimmerEffect({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn(
        "absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent",
        className
      )}
      animate={{ translateX: ["100%", "-100%"] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        repeatDelay: 1,
        ease: "linear",
      }}
    />
  );
}

export function SkeletonLoader({ 
  className,
  variant = "default" 
}: { 
  className?: string;
  variant?: "default" | "card" | "text" | "avatar";
}) {
  const variants = {
    default: "h-4 w-full rounded",
    card: "h-32 w-full rounded-xl",
    text: "h-4 w-3/4 rounded",
    avatar: "h-10 w-10 rounded-full",
  };

  return (
    <div className={cn("relative overflow-hidden bg-slate-200", variants[variant], className)}>
      <ShimmerEffect />
    </div>
  );
}

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-current"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}
