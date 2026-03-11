import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { X, Eye, EyeOff, Mail, Lock, User, Phone, Check, AlertCircle } from "lucide-react";
import hsquareLogo from "@/assets/hsquare-logo.jpg";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  actionLabel?: string;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(query.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }, []);
  return prefersReducedMotion;
};

const useMouseParallax = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      mouseX.set((clientX - innerWidth / 2) / innerWidth);
      mouseY.set((clientY - innerHeight / 2) / innerHeight);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return { mouseX, mouseY };
};

const FloatingBlob = ({ 
  color, 
  size, 
  initialX, 
  initialY, 
  duration,
  delay = 0,
  mouseX,
  mouseY,
  parallaxStrength = 10,
  reducedMotion = false
}: {
  color: string;
  size: number;
  initialX: number;
  initialY: number;
  duration: number;
  delay?: number;
  mouseX: any;
  mouseY: any;
  parallaxStrength?: number;
  reducedMotion?: boolean;
}) => {
  const x = useTransform(mouseX, [-0.5, 0.5], [-parallaxStrength, parallaxStrength]);
  const y = useTransform(mouseY, [-0.5, 0.5], [-parallaxStrength, parallaxStrength]);

  if (reducedMotion) {
    return (
      <div
        className="absolute rounded-full blur-3xl opacity-25"
        style={{
          background: color,
          width: size,
          height: size,
          left: `${initialX}%`,
          top: `${initialY}%`,
          transform: "translate(-50%, -50%)",
        }}
      />
    );
  }

  return (
    <motion.div
      className="absolute rounded-full blur-3xl will-change-transform"
      style={{
        background: color,
        width: size,
        height: size,
        left: `${initialX}%`,
        top: `${initialY}%`,
        x,
        y,
        opacity: 0.25,
        mixBlendMode: "multiply",
      }}
      animate={{
        translateX: [0, 30, -20, 40, 0],
        translateY: [0, -40, 20, -30, 0],
        scale: [1, 1.05, 0.98, 1.03, 1],
        rotate: [0, 5, -3, 8, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatType: "mirror",
        ease: "easeInOut",
      }}
    />
  );
};

const blobs = [
  { color: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)", size: 500, x: 15, y: 20, duration: 25, parallaxStrength: 15 },
  { color: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)", size: 450, x: 85, y: 15, duration: 30, parallaxStrength: 20 },
  { color: "linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)", size: 400, x: 75, y: 80, duration: 28, parallaxStrength: 12 },
  { color: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)", size: 350, x: 20, y: 75, duration: 22, parallaxStrength: 18 },
  { color: "linear-gradient(135deg, #10b981 0%, #14b8a6 100%)", size: 300, x: 50, y: 50, duration: 26, parallaxStrength: 10 },
];

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" as const }
  },
  shake: {
    x: [0, -8, 8, -8, 8, 0],
    transition: { duration: 0.4 }
  }
};

const inputVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.3 }
  }),
};

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string; password?: string }>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [shakeForm, setShakeForm] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const { login, signup } = useAuth();
  const reducedMotion = useReducedMotion();
  const { mouseX, mouseY } = useMouseParallax();

  const isLogin = mode === "login";

  const handleCapsLock = useCallback((e: KeyboardEvent) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleCapsLock);
      window.addEventListener("keyup", handleCapsLock);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleCapsLock);
      window.removeEventListener("keyup", handleCapsLock);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleCapsLock]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!isLogin && name.length < 3) {
      newErrors.name = "Name must be at least 3 characters";
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!isLogin) {
      if (!phone || phone.length < 10 || !/^[0-9]+$/.test(phone)) {
        newErrors.phone = "Please enter a valid 10-digit mobile number";
      }
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (!isLogin) {
      if (password.length < 8) {
        newErrors.password = "Password must be at least 8 characters";
      } else if (!/[A-Z]/.test(password)) {
        newErrors.password = "Password must contain an uppercase letter";
      } else if (!/[0-9]/.test(password)) {
        newErrors.password = "Password must contain a number";
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 500);
    }
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await login(email, password);
      } else {
        result = await signup(name, email, phone, password);
      }

      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
          setShowSuccess(false);
          resetForm();
        }, 1200);
      } else {
        setError(result.error || "Something went wrong");
        setShakeForm(true);
        setTimeout(() => setShakeForm(false), 500);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      setForgotError("Please enter a valid email address");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotSent(true);
      } else {
        setForgotError(data.message || "Something went wrong");
      }
    } catch {
      setForgotError("Network error. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setPhone("");
    setError("");
    setErrors({});
    setShowSuccess(false);
  };

  const switchMode = (newMode: "login" | "signup") => {
    resetForm();
    setMode(newMode);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            data-testid="auth-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 overflow-hidden"
            onClick={onClose}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/40" />
            
            {blobs.map((blob, i) => (
              <FloatingBlob
                key={i}
                color={blob.color}
                size={blob.size}
                initialX={blob.x}
                initialY={blob.y}
                duration={blob.duration}
                delay={i * 0.5}
                mouseX={mouseX}
                mouseY={mouseY}
                parallaxStrength={blob.parallaxStrength}
                reducedMotion={reducedMotion}
              />
            ))}
          </motion.div>
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              data-testid="auth-modal"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative w-full max-w-[440px] pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={reducedMotion ? {} : {
                  y: [0, -6, 0],
                }}
                transition={{
                  duration: 10,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }}
              >
                <AnimatePresence>
                  {showSuccess && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-xl rounded-3xl"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="text-center"
                      >
                        <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
                          <Check className="w-10 h-10 text-white" strokeWidth={3} />
                        </div>
                        <p className="text-xl font-semibold text-gray-800">Welcome back!</p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  variants={cardVariants}
                  initial="hidden"
                  animate={shakeForm ? "shake" : "visible"}
                  className="relative bg-white/70 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-black/10 border border-white/50 p-8 md:p-10 max-h-[85vh] overflow-y-auto"
                >
                  <button
                    data-testid="button-close-auth-modal"
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2.5 rounded-full bg-white/80 hover:bg-white shadow-lg shadow-black/5 transition-all duration-200 z-20 group"
                  >
                    <X className="h-4 w-4 text-gray-500 group-hover:text-gray-700 transition-colors" />
                  </button>

                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-center mb-8"
                  >
                    <img 
                      src={hsquareLogo} 
                      alt="Hsquare Living" 
                      className="h-16 w-auto mx-auto mb-4 rounded-2xl shadow-lg"
                    />
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                      {getGreeting()}! 👋
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isLogin ? "Sign in to continue your journey" : "Create your account to get started"}
                    </p>
                  </motion.div>

                  <div className="flex rounded-xl bg-gray-100/80 p-1 mb-6 shadow-inner">
                    {["login", "signup"].map((m) => (
                      <button
                        key={m}
                        data-testid={`tab-${m}`}
                        onClick={() => switchMode(m as "login" | "signup")}
                        className={`relative flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                          mode === m
                            ? "text-gray-900"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {mode === m && (
                          <motion.div
                            layoutId="modal-auth-tab-indicator"
                            className="absolute inset-0 bg-white rounded-lg shadow-sm"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                          />
                        )}
                        <span className="relative z-10">
                          {m === "login" ? "Sign In" : "Create Account"}
                        </span>
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <AnimatePresence mode="popLayout">
                      {!isLogin && (
                        <motion.div
                          key="name-field"
                          variants={inputVariants}
                          initial="hidden"
                          animate="visible"
                          exit={{ opacity: 0, height: 0 }}
                          custom={0}
                          className="space-y-2"
                        >
                          <Label htmlFor="modal-name" className="text-sm font-medium text-gray-700">Full Name</Label>
                          <div className="relative">
                            <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focusedField === 'name' ? 'text-primary' : 'text-gray-400'}`} />
                            <Input
                              id="modal-name"
                              data-testid="input-auth-name"
                              placeholder="John Doe"
                              className={`pl-11 h-12 rounded-xl border-2 transition-all duration-300 bg-white/80 backdrop-blur-sm ${
                                errors.name ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : 
                                focusedField === 'name' ? "border-primary ring-4 ring-primary/10 shadow-lg shadow-primary/5" : "border-gray-200 hover:border-gray-300"
                              }`}
                              value={name}
                              onFocus={() => setFocusedField('name')}
                              onBlur={() => setFocusedField(null)}
                              onChange={(e) => {
                                setName(e.target.value);
                                if (errors.name) setErrors({ ...errors, name: undefined });
                              }}
                            />
                          </div>
                          {errors.name && (
                            <motion.p 
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-xs text-red-500 flex items-center gap-1"
                            >
                              <AlertCircle className="w-3 h-3" />
                              {errors.name}
                            </motion.p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div
                      variants={inputVariants}
                      initial="hidden"
                      animate="visible"
                      custom={isLogin ? 0 : 1}
                      className="space-y-2"
                    >
                      <Label htmlFor="modal-email" className="text-sm font-medium text-gray-700">Email</Label>
                      <div className="relative">
                        <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focusedField === 'email' ? 'text-primary' : 'text-gray-400'}`} />
                        <Input
                          id="modal-email"
                          data-testid="input-auth-email"
                          type="email"
                          placeholder="you@example.com"
                          className={`pl-11 h-12 rounded-xl border-2 transition-all duration-300 bg-white/80 backdrop-blur-sm ${
                            errors.email ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : 
                            focusedField === 'email' ? "border-primary ring-4 ring-primary/10 shadow-lg shadow-primary/5" : "border-gray-200 hover:border-gray-300"
                          }`}
                          value={email}
                          onFocus={() => setFocusedField('email')}
                          onBlur={() => setFocusedField(null)}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (errors.email) setErrors({ ...errors, email: undefined });
                          }}
                        />
                      </div>
                      {errors.email && (
                        <motion.p 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 flex items-center gap-1"
                        >
                          <AlertCircle className="w-3 h-3" />
                          {errors.email}
                        </motion.p>
                      )}
                    </motion.div>

                    <AnimatePresence mode="popLayout">
                      {!isLogin && (
                        <motion.div
                          key="phone-field"
                          variants={inputVariants}
                          initial="hidden"
                          animate="visible"
                          exit={{ opacity: 0, height: 0 }}
                          custom={2}
                          className="space-y-2"
                        >
                          <Label htmlFor="modal-phone" className="text-sm font-medium text-gray-700">Mobile Number</Label>
                          <div className="relative">
                            <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focusedField === 'phone' ? 'text-primary' : 'text-gray-400'}`} />
                            <Input
                              id="modal-phone"
                              data-testid="input-auth-phone"
                              type="tel"
                              placeholder="9876543210"
                              className={`pl-11 h-12 rounded-xl border-2 transition-all duration-300 bg-white/80 backdrop-blur-sm ${
                                errors.phone ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : 
                                focusedField === 'phone' ? "border-primary ring-4 ring-primary/10 shadow-lg shadow-primary/5" : "border-gray-200 hover:border-gray-300"
                              }`}
                              value={phone}
                              onFocus={() => setFocusedField('phone')}
                              onBlur={() => setFocusedField(null)}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                                setPhone(value);
                                if (errors.phone) setErrors({ ...errors, phone: undefined });
                              }}
                            />
                          </div>
                          {errors.phone && (
                            <motion.p 
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-xs text-red-500 flex items-center gap-1"
                            >
                              <AlertCircle className="w-3 h-3" />
                              {errors.phone}
                            </motion.p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div
                      variants={inputVariants}
                      initial="hidden"
                      animate="visible"
                      custom={isLogin ? 1 : 3}
                      className="space-y-2"
                    >
                      <Label htmlFor="modal-password" className="text-sm font-medium text-gray-700">Password</Label>
                      <div className="relative">
                        <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focusedField === 'password' ? 'text-primary' : 'text-gray-400'}`} />
                        <Input
                          id="modal-password"
                          data-testid="input-auth-password"
                          type={showPassword ? "text" : "password"}
                          placeholder={isLogin ? "Enter your password" : "Min 8 chars, 1 uppercase, 1 number"}
                          className={`pl-11 pr-11 h-12 rounded-xl border-2 transition-all duration-300 bg-white/80 backdrop-blur-sm ${
                            errors.password ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : 
                            focusedField === 'password' ? "border-primary ring-4 ring-primary/10 shadow-lg shadow-primary/5" : "border-gray-200 hover:border-gray-300"
                          }`}
                          value={password}
                          onFocus={() => setFocusedField('password')}
                          onBlur={() => setFocusedField(null)}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errors.password) setErrors({ ...errors, password: undefined });
                          }}
                        />
                        <button
                          type="button"
                          data-testid="button-toggle-password"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <motion.p 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-xs text-red-500 flex items-center gap-1"
                        >
                          <AlertCircle className="w-3 h-3" />
                          {errors.password}
                        </motion.p>
                      )}
                      <AnimatePresence>
                        {capsLockOn && focusedField === "password" && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-xs text-amber-600 flex items-center gap-1"
                          >
                            <AlertCircle className="w-3 h-3" />
                            Caps Lock is on
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    {isLogin && (
                      <div className="flex items-center justify-end -mt-2">
                        <button
                          type="button"
                          className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                          onClick={() => { setShowForgotPassword(true); setForgotEmail(email); setForgotSent(false); setForgotError(""); }}
                          data-testid="button-forgot-password-modal"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center gap-2"
                          data-testid="text-auth-error"
                        >
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Button
                        data-testid="button-auth-submit"
                        type="submit"
                        disabled={isLoading || showSuccess}
                        className="w-full h-12 bg-gradient-to-r from-purple-600 via-purple-600 to-indigo-600 hover:from-purple-700 hover:via-purple-700 hover:to-indigo-700 text-white rounded-xl text-base font-semibold shadow-lg shadow-purple-500/30 transition-all duration-300 disabled:opacity-70"
                      >
                        {isLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {[0, 1, 2].map((i) => (
                                <motion.div
                                  key={i}
                                  className="w-1.5 h-1.5 bg-white rounded-full"
                                  animate={{ y: [0, -6, 0] }}
                                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                                />
                              ))}
                            </div>
                            <span>{isLogin ? "Signing in" : "Creating account"}</span>
                          </div>
                        ) : (
                          <span>{isLogin ? "Sign In" : "Create Account"}</span>
                        )}
                      </Button>
                    </motion.div>
                  </form>

                  <p className="text-center text-xs text-gray-500 mt-6">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                      type="button"
                      onClick={() => switchMode(isLogin ? "signup" : "login")}
                      className="text-primary font-medium hover:underline"
                    >
                      {isLogin ? "Create one" : "Sign in"}
                    </button>
                  </p>

                  <button
                    data-testid="button-maybe-later"
                    onClick={onClose}
                    className="w-full mt-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Maybe later
                  </button>

                  <AnimatePresence>
                    {showForgotPassword && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-3xl flex items-center justify-center p-8 z-50 overflow-hidden"
                      >
                        <div className="w-full max-w-sm space-y-5">
                          {forgotSent ? (
                            <div className="text-center space-y-4">
                              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-green-500/30">
                                <Mail className="w-8 h-8 text-white" />
                              </div>
                              <h3 className="text-xl font-bold text-gray-800">Check your email</h3>
                              <p className="text-sm text-gray-600">
                                If an account exists for <strong>{forgotEmail}</strong>, we've sent a password reset link. The link expires in 10 minutes.
                              </p>
                              <Button
                                onClick={() => { setShowForgotPassword(false); setForgotSent(false); }}
                                className="w-full h-11 rounded-xl"
                              >
                                Back to Sign In
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="text-center space-y-2">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/30">
                                  <Lock className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800">Reset password</h3>
                                <p className="text-sm text-gray-500">Enter your email and we'll send you a reset link</p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="forgot-email-modal" className="text-sm font-medium text-gray-700">Email</Label>
                                <div className="relative">
                                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                  <Input
                                    id="forgot-email-modal"
                                    type="email"
                                    placeholder="you@example.com"
                                    className="pl-11 h-12 rounded-xl border-2 border-gray-200 bg-white/80"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    data-testid="input-forgot-email-modal"
                                  />
                                </div>
                              </div>
                              {forgotError && (
                                <p className="text-xs text-red-500 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {forgotError}
                                </p>
                              )}
                              <Button
                                onClick={handleForgotPassword}
                                disabled={forgotLoading}
                                className="w-full h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/30"
                                data-testid="button-send-reset-modal"
                              >
                                {forgotLoading ? "Sending..." : "Send Reset Link"}
                              </Button>
                              <button
                                type="button"
                                onClick={() => setShowForgotPassword(false)}
                                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
                                data-testid="button-back-to-login-modal"
                              >
                                Back to Sign In
                              </button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
