import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
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

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();
  const { login, signup } = useAuth();
  const { toast } = useToast();
  const reducedMotion = useReducedMotion();

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
    setCapsLockOn(e.getModifierState("CapsLock"));
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
    hidden: { opacity: 0, scale: 0.98, y: 20 },
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

  const logoVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { delay: reducedMotion ? 0 : 0.1, duration: 0.5 }
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Left Hero Section - Desktop Only */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary/50" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-white/5 blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-center max-w-md"
          >
            <h1 className="text-4xl font-bold mb-4">Find Your Perfect Home</h1>
            <p className="text-lg text-white/80 leading-relaxed">
              Discover premium student accommodations designed for comfort, convenience, and community.
            </p>
          </motion.div>
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-12 flex gap-8"
          >
            {[
              { value: "500+", label: "Happy Students" },
              { value: "15+", label: "Properties" },
              { value: "4.9", label: "Rating" }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-white/70">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-gradient-to-br from-slate-50 via-white to-slate-100">
        {/* Mobile Header Gradient */}
        <div className="lg:hidden absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-primary/20 to-transparent" />
        
        <div className="w-full max-w-[420px] relative">
          {/* Logo */}
          <motion.div
            variants={logoVariants}
            initial="hidden"
            animate="visible"
            className="text-center mb-8"
          >
            <img 
              src={hsquareLogo} 
              alt="Hsquare Living" 
              className="h-20 w-auto mx-auto mb-4 rounded-2xl shadow-lg"
            />
            <p className="text-lg text-muted-foreground font-medium">
              {getGreeting()}! 👋
            </p>
          </motion.div>

          {/* Success Animation Overlay */}
          <AnimatePresence>
            {showSuccess && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-3xl"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
                    <motion.div
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                    >
                      <Check className="w-10 h-10 text-white" strokeWidth={3} />
                    </motion.div>
                  </div>
                  <p className="text-xl font-semibold text-gray-800">Welcome back!</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Auth Card */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate={shakeForm ? "shake" : "visible"}
            className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/5 border border-white/50 p-8"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {isLogin ? "Sign In" : "Create Account"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isLogin 
                  ? "Enter your credentials to continue" 
                  : "Join us to find your perfect home"}
              </p>
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
                    <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                    <div className="relative">
                      <User className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focusedField === 'name' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <Input
                        id="name"
                        placeholder="John Doe"
                        className={`pl-11 h-12 rounded-xl border-2 transition-all duration-200 bg-white/50 ${
                          errors.name ? "border-red-400 focus:border-red-500" : 
                          focusedField === 'name' ? "border-primary ring-4 ring-primary/10" : "border-gray-200 hover:border-gray-300"
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
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focusedField === 'email' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className={`pl-11 h-12 rounded-xl border-2 transition-all duration-200 bg-white/50 ${
                      errors.email ? "border-red-400 focus:border-red-500" : 
                      focusedField === 'email' ? "border-primary ring-4 ring-primary/10" : "border-gray-200 hover:border-gray-300"
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
                    <Label htmlFor="phone" className="text-sm font-medium">Mobile Number</Label>
                    <div className="relative">
                      <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focusedField === 'phone' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="9876543210"
                        className={`pl-11 h-12 rounded-xl border-2 transition-all duration-200 bg-white/50 ${
                          errors.phone ? "border-red-400 focus:border-red-500" : 
                          focusedField === 'phone' ? "border-primary ring-4 ring-primary/10" : "border-gray-200 hover:border-gray-300"
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
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focusedField === 'password' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={isLogin ? "Enter your password" : "Create a strong password"}
                    className={`pl-11 pr-11 h-12 rounded-xl border-2 transition-all duration-200 bg-white/50 ${
                      errors.password ? "border-red-400 focus:border-red-500" : 
                      focusedField === 'password' ? "border-primary ring-4 ring-primary/10" : "border-gray-200 hover:border-gray-300"
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                  <p className="text-xs text-muted-foreground">
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
                    <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
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
              >
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
                  disabled={loading || !isFormValid()}
                  data-testid="button-submit"
                >
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              className="w-2 h-2 bg-white rounded-full"
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{
                                duration: 0.8,
                                repeat: Infinity,
                                delay: i * 0.15
                              }}
                            />
                          ))}
                        </div>
                        <span>{isLogin ? "Signing in" : "Creating account"}</span>
                      </div>
                    ) : (
                      <span>{isLogin ? "Sign In" : "Create Account"}</span>
                    )}
                  </motion.div>
                </Button>
              </motion.div>
            </form>

            <motion.div
              variants={inputVariants}
              initial="hidden"
              animate="visible"
              custom={isLogin ? 4 : 5}
              className="mt-6 text-center"
            >
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  className="ml-1 text-primary hover:text-primary/80 font-semibold transition-colors"
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
            className="text-center text-xs text-muted-foreground mt-6"
          >
            By continuing, you agree to our{" "}
            <a href="#" className="text-primary hover:underline">Terms of Service</a>
            {" "}and{" "}
            <a href="#" className="text-primary hover:underline">Privacy Policy</a>
          </motion.p>
        </div>
      </div>
    </div>
  );
}
