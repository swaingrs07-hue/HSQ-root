import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Mail, Lock, User, Eye, EyeOff, Phone, Check, AlertCircle } from "lucide-react";
import hsquareLogo from "@/assets/hsquare-logo.jpg";

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

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();
  const { login, signup } = useAuth();
  const { toast } = useToast();
  const reducedMotion = useReducedMotion();
  const { mouseX, mouseY } = useMouseParallax();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [shakeForm, setShakeForm] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; phone?: string; password?: string }>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleCapsLock = useCallback((e: KeyboardEvent) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleCapsLock);
    window.addEventListener("keyup", handleCapsLock);
    return () => {
      window.removeEventListener("keydown", handleCapsLock);
      window.removeEventListener("keyup", handleCapsLock);
    };
  }, [handleCapsLock]);

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

  const isFormValid = (): boolean => {
    if (!email || !password) return false;
    if (!isLogin && name.length < 3) return false;
    if (!isLogin && (!phone || phone.length < 10)) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    if (!isLogin) {
      if (password.length < 8) return false;
      if (!/[A-Z]/.test(password)) return false;
      if (!/[0-9]/.test(password)) return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      const result = isLogin 
        ? await login(email, password)
        : await signup(name, email, phone, password);

      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => {
          setLocation(result.redirectPath || "/dashboard");
        }, 800);
      } else {
        setShakeForm(true);
        setTimeout(() => setShakeForm(false), 500);
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      setShakeForm(true);
      setTimeout(() => setShakeForm(false), 500);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 30 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 30 }
    },
    shake: {
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.5 }
    }
  };

  const inputVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: reducedMotion ? 0 : 0.1 + i * 0.08, duration: 0.3 }
    })
  };

  const blobs = [
    { color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", size: 400, initialX: 20, initialY: 30, duration: 20, parallaxStrength: 12 },
    { color: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", size: 350, initialX: 75, initialY: 20, duration: 25, parallaxStrength: 8 },
    { color: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)", size: 300, initialX: 60, initialY: 70, duration: 18, parallaxStrength: 14 },
    { color: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)", size: 280, initialX: 30, initialY: 80, duration: 22, parallaxStrength: 10 },
    { color: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)", size: 320, initialX: 85, initialY: 60, duration: 28, parallaxStrength: 6 },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-50">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {blobs.map((blob, index) => (
          <FloatingBlob
            key={index}
            color={blob.color}
            size={blob.size}
            initialX={blob.initialX}
            initialY={blob.initialY}
            duration={blob.duration}
            delay={index * 0.5}
            mouseX={mouseX}
            mouseY={mouseY}
            parallaxStrength={blob.parallaxStrength}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>

      {/* Floating Glass Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[440px] mx-4"
      >
        {/* Card Float Animation */}
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
          {/* Success Animation Overlay */}
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

          {/* Glass Card */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate={shakeForm ? "shake" : "visible"}
            className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-black/10 border border-white/50 p-8 md:p-10"
          >
            {/* Logo & Greeting */}
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
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</Label>
                    <div className="relative">
                      <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focusedField === 'name' ? 'text-primary' : 'text-gray-400'}`} />
                      <Input
                        id="name"
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
                        data-testid="input-name"
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
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                <div className="relative">
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focusedField === 'email' ? 'text-primary' : 'text-gray-400'}`} />
                  <Input
                    id="email"
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
                    data-testid="input-email"
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
                    <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Mobile Number</Label>
                    <div className="relative">
                      <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focusedField === 'phone' ? 'text-primary' : 'text-gray-400'}`} />
                      <Input
                        id="phone"
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
                        data-testid="input-phone"
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
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focusedField === 'password' ? 'text-primary' : 'text-gray-400'}`} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={isLogin ? "Enter your password" : "Create a strong password"}
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
                    data-testid="input-password"
                  />
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    <motion.div
                      animate={{ rotate: showPassword ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </motion.div>
                  </motion.button>
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
                {capsLockOn && focusedField === 'password' && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-amber-600 flex items-center gap-1"
                  >
                    <AlertCircle className="w-3 h-3" />
                    Caps Lock is on
                  </motion.p>
                )}
                {!isLogin && !errors.password && (
                  <p className="text-xs text-gray-500">
                    Min 8 characters, 1 uppercase, 1 number
                  </p>
                )}
              </motion.div>

              {isLogin && (
                <motion.div
                  variants={inputVariants}
                  initial="hidden"
                  animate="visible"
                  custom={2}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Switch
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={setRememberMe}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                  <button
                    type="button"
                    className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                    onClick={() => toast({ title: "Coming soon", description: "Password reset will be available soon." })}
                  >
                    Forgot password?
                  </button>
                </motion.div>
              )}

              <motion.div
                variants={inputVariants}
                initial="hidden"
                animate="visible"
                custom={isLogin ? 3 : 4}
                className="pt-2"
              >
                <motion.div
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary via-primary to-primary/90 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/35 transition-all duration-300"
                    disabled={loading || !isFormValid()}
                    data-testid="button-submit"
                  >
                    {loading ? (
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-2 h-2 bg-white rounded-full"
                              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                              transition={{
                                duration: 0.8,
                                repeat: Infinity,
                                delay: i * 0.15
                              }}
                            />
                          ))}
                        </div>
                        <span>{isLogin ? "Signing in..." : "Creating account..."}</span>
                      </div>
                    ) : (
                      <span>{isLogin ? "Sign In" : "Create Account"}</span>
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            </form>

            <motion.div
              variants={inputVariants}
              initial="hidden"
              animate="visible"
              custom={isLogin ? 4 : 5}
              className="mt-6 text-center"
            >
              <p className="text-sm text-gray-600">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  className="ml-1.5 text-primary hover:text-primary/80 font-semibold transition-colors"
                  onClick={toggleMode}
                  data-testid="button-toggle-mode"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>
            </motion.div>
          </motion.div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-xs text-gray-500 mt-6"
          >
            By continuing, you agree to our{" "}
            <a href="#" className="text-primary hover:underline">Terms</a>
            {" "}and{" "}
            <a href="#" className="text-primary hover:underline">Privacy Policy</a>
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  );
}
