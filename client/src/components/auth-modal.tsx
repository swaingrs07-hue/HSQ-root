import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { X, Eye, EyeOff, Mail, Lock, User, Phone, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  actionLabel?: string;
}

const blobVariants = {
  animate: (i: number) => ({
    x: [0, 30 * Math.sin(i * 0.7), -20 * Math.cos(i * 0.5), 0],
    y: [0, -25 * Math.cos(i * 0.6), 35 * Math.sin(i * 0.4), 0],
    scale: [1, 1.1, 0.95, 1],
    rotate: [0, 10, -10, 0],
    transition: {
      duration: 15 + i * 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  }),
};

const blobs = [
  { color: "from-violet-500/40 to-purple-600/40", size: "w-48 h-48", position: "-top-12 -left-12" },
  { color: "from-blue-500/40 to-cyan-500/40", size: "w-40 h-40", position: "-top-8 -right-8" },
  { color: "from-pink-500/40 to-rose-500/40", size: "w-36 h-36", position: "-bottom-10 -left-6" },
  { color: "from-amber-400/40 to-orange-500/40", size: "w-32 h-32", position: "-bottom-8 -right-10" },
];

export function AuthModal({ isOpen, onClose, onSuccess, actionLabel = "continue" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { login, signup } = useAuth();

  const handleCapsLock = useCallback((e: KeyboardEvent) => {
    if (e.getModifierState) {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleCapsLock);
      window.addEventListener("keyup", handleCapsLock);
    }
    return () => {
      window.removeEventListener("keydown", handleCapsLock);
      window.removeEventListener("keyup", handleCapsLock);
    };
  }, [isOpen, handleCapsLock]);

  const validateEmail = (email: string): string => {
    if (!email) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    return "";
  };

  const validatePassword = (password: string): string => {
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const validateName = (name: string): string => {
    if (!name) return "Name is required";
    if (name.length < 2) return "Name must be at least 2 characters";
    return "";
  };

  const validatePhone = (phone: string): string => {
    if (!phone) return "Phone number is required";
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone.replace(/[\s-]/g, ""))) return "Please enter a valid 10-digit phone number";
    return "";
  };

  const validateField = (field: string, value: string) => {
    let error = "";
    switch (field) {
      case "email": error = validateEmail(value); break;
      case "password": error = validatePassword(value); break;
      case "name": error = validateName(value); break;
      case "phone": error = validatePhone(value); break;
    }
    setFieldErrors(prev => ({ ...prev, [field]: error }));
    return error;
  };

  const handleBlur = (field: string, value: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, value);
    setFocusedField(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    errors.email = validateEmail(email);
    errors.password = validatePassword(password);
    if (mode === "signup") {
      errors.name = validateName(name);
      errors.phone = validatePhone(phone);
    }
    setFieldErrors(errors);
    setTouched({ email: true, password: true, name: true, phone: true });
    return Object.values(errors).every(e => !e);
  };

  useEffect(() => {
    if (isOpen) {
      setError("");
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);

    try {
      let result;
      if (mode === "login") {
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
        }, 1000);
      } else {
        setError(result.error || "Something went wrong");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setPhone("");
    setError("");
    setFieldErrors({});
    setTouched({});
    setShowSuccess(false);
  };

  const switchMode = (newMode: "login" | "signup") => {
    resetForm();
    setMode(newMode);
  };

  const getInputClasses = (field: string) => {
    const hasError = touched[field] && fieldErrors[field];
    const isFocused = focusedField === field;
    return `pl-11 h-12 bg-white/80 border-gray-200/60 rounded-xl transition-all duration-300
      ${hasError ? "border-red-400 focus-visible:ring-red-400/30" : ""}
      ${isFocused ? "border-purple-400 ring-4 ring-purple-400/20 bg-white" : ""}
      placeholder:text-gray-400`;
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
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md"
            onClick={onClose}
          />
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              data-testid="auth-modal"
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-purple-50/50 -z-10" />
              
              {blobs.map((blob, i) => (
                <motion.div
                  key={i}
                  custom={i}
                  variants={blobVariants}
                  animate="animate"
                  className={`absolute ${blob.position} ${blob.size} rounded-full bg-gradient-to-br ${blob.color} blur-2xl opacity-60 -z-10`}
                />
              ))}

              <button
                data-testid="button-close-auth-modal"
                onClick={onClose}
                className="absolute top-4 right-4 p-2.5 rounded-full bg-white/80 hover:bg-white shadow-lg shadow-black/5 transition-all duration-200 z-20 group"
              >
                <X className="h-4 w-4 text-gray-500 group-hover:text-gray-700 transition-colors" />
              </button>

              <div className="relative px-8 pt-10 pb-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-center"
                >
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100/80 text-purple-700 text-xs font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    Sign in to {actionLabel}
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    {mode === "login" ? "Welcome back" : "Create account"}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1.5">
                    {mode === "login" 
                      ? "Enter your credentials to continue" 
                      : "Join thousands of happy students"}
                  </p>
                </motion.div>

                <div className="flex rounded-2xl bg-gray-100/80 p-1.5 mt-6 shadow-inner">
                  {["login", "signup"].map((m) => (
                    <button
                      key={m}
                      data-testid={`tab-${m}`}
                      onClick={() => switchMode(m as "login" | "signup")}
                      className={`relative flex-1 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 ${
                        mode === m
                          ? "text-gray-900"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {mode === m && (
                        <motion.div
                          layoutId="auth-tab-indicator"
                          className="absolute inset-0 bg-white rounded-xl shadow-sm"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                        />
                      )}
                      <span className="relative z-10">
                        {m === "login" ? "Sign In" : "Create Account"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-8 pb-8">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <AnimatePresence mode="wait">
                    {mode === "signup" && (
                      <motion.div
                        key="name-field"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2"
                      >
                        <Label htmlFor="modal-name" className="text-sm font-medium text-gray-700 ml-1">
                          Full Name
                        </Label>
                        <div className="relative group">
                          <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "name" ? "text-purple-500" : "text-gray-400"}`}>
                            <User className="h-4 w-4" />
                          </div>
                          <Input
                            data-testid="input-auth-name"
                            id="modal-name"
                            type="text"
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value);
                              if (touched.name) validateField("name", e.target.value);
                            }}
                            onFocus={() => setFocusedField("name")}
                            onBlur={() => handleBlur("name", name)}
                            placeholder="Enter your full name"
                            className={getInputClasses("name")}
                          />
                        </div>
                        {touched.name && fieldErrors.name && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-500 ml-1 flex items-center gap-1"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {fieldErrors.name}
                          </motion.p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <Label htmlFor="modal-email" className="text-sm font-medium text-gray-700 ml-1">
                      Email Address
                    </Label>
                    <div className="relative group">
                      <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "email" ? "text-purple-500" : "text-gray-400"}`}>
                        <Mail className="h-4 w-4" />
                      </div>
                      <Input
                        data-testid="input-auth-email"
                        id="modal-email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (touched.email) validateField("email", e.target.value);
                        }}
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => handleBlur("email", email)}
                        placeholder="Enter your email"
                        className={getInputClasses("email")}
                      />
                    </div>
                    {touched.email && fieldErrors.email && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-red-500 ml-1 flex items-center gap-1"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {fieldErrors.email}
                      </motion.p>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {mode === "signup" && (
                      <motion.div
                        key="phone-field"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-2"
                      >
                        <Label htmlFor="modal-phone" className="text-sm font-medium text-gray-700 ml-1">
                          Phone Number
                        </Label>
                        <div className="relative group">
                          <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "phone" ? "text-purple-500" : "text-gray-400"}`}>
                            <Phone className="h-4 w-4" />
                          </div>
                          <Input
                            data-testid="input-auth-phone"
                            id="modal-phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => {
                              setPhone(e.target.value);
                              if (touched.phone) validateField("phone", e.target.value);
                            }}
                            onFocus={() => setFocusedField("phone")}
                            onBlur={() => handleBlur("phone", phone)}
                            placeholder="Enter your phone number"
                            className={getInputClasses("phone")}
                          />
                        </div>
                        {touched.phone && fieldErrors.phone && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-500 ml-1 flex items-center gap-1"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {fieldErrors.phone}
                          </motion.p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <Label htmlFor="modal-password" className="text-sm font-medium text-gray-700 ml-1">
                      Password
                    </Label>
                    <div className="relative group">
                      <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 ${focusedField === "password" ? "text-purple-500" : "text-gray-400"}`}>
                        <Lock className="h-4 w-4" />
                      </div>
                      <Input
                        data-testid="input-auth-password"
                        id="modal-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (touched.password) validateField("password", e.target.value);
                        }}
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => handleBlur("password", password)}
                        placeholder="Enter your password"
                        className={`${getInputClasses("password")} pr-11`}
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
                    {touched.password && fieldErrors.password && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-red-500 ml-1 flex items-center gap-1"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {fieldErrors.password}
                      </motion.p>
                    )}
                    <AnimatePresence>
                      {capsLockOn && focusedField === "password" && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-xs text-amber-600 ml-1 flex items-center gap-1"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Caps Lock is on
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center gap-2"
                        data-testid="text-auth-error"
                      >
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="pt-2"
                  >
                    <Button
                      data-testid="button-auth-submit"
                      type="submit"
                      disabled={isLoading || showSuccess}
                      className="w-full h-12 bg-gradient-to-r from-purple-600 via-purple-600 to-indigo-600 hover:from-purple-700 hover:via-purple-700 hover:to-indigo-700 text-white rounded-xl text-base font-medium shadow-lg shadow-purple-500/25 transition-all duration-300 disabled:opacity-70"
                    >
                      {showSuccess ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle2 className="h-5 w-5" />
                          Success!
                        </motion.div>
                      ) : isLoading ? (
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
                          <span>{mode === "login" ? "Signing in" : "Creating account"}</span>
                        </div>
                      ) : (
                        <span className="flex items-center gap-2">
                          {mode === "login" ? "Sign In" : "Create Account"}
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                    </Button>
                  </motion.div>
                </form>

                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: "📍", text: "Track bookings" },
                      { icon: "⚡", text: "Fast responses" },
                      { icon: "🎁", text: "Exclusive offers" },
                    ].map((benefit, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-50/80 text-center"
                      >
                        <span className="text-lg">{benefit.icon}</span>
                        <span className="text-xs text-gray-600 font-medium">{benefit.text}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <button
                  data-testid="button-maybe-later"
                  onClick={onClose}
                  className="w-full mt-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Maybe later
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
