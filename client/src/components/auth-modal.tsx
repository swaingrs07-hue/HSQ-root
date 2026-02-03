import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { X, Eye, EyeOff, Mail, Lock, User, Phone, Loader2, CheckCircle2, Sparkles } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  actionLabel?: string;
}

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
  const { login, signup } = useAuth();

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
        onSuccess?.();
        onClose();
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
  };

  const switchMode = (newMode: "login" | "signup") => {
    resetForm();
    setMode(newMode);
  };

  const benefits = [
    "Track your bookings easily",
    "Get faster responses",
    "Exclusive offers & updates",
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            data-testid="auth-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:items-center">
            <motion.div
              data-testid="auth-modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden md:rounded-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                data-testid="button-close-auth-modal"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>

              <div className="bg-gradient-to-br from-purple-600 to-indigo-700 px-6 py-8 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-medium opacity-90">Sign in to {actionLabel}</span>
                </div>
                <h2 className="text-2xl font-bold">
                  {mode === "login" ? "Welcome back!" : "Create your account"}
                </h2>
                <p className="text-sm opacity-80 mt-1">
                  {mode === "login" 
                    ? "Sign in to continue your journey" 
                    : "Join thousands of happy students"}
                </p>
              </div>

              <div className="p-6">
                <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
                  <button
                    data-testid="tab-login"
                    onClick={() => switchMode("login")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      mode === "login"
                        ? "bg-white shadow text-gray-900"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    data-testid="tab-signup"
                    onClick={() => switchMode("signup")}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                      mode === "signup"
                        ? "bg-white shadow text-gray-900"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Create Account
                  </button>
                </div>

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
                        <Label htmlFor="name" className="text-sm font-medium">
                          Full Name
                        </Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            data-testid="input-auth-name"
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value);
                              if (touched.name) validateField("name", e.target.value);
                            }}
                            onBlur={() => handleBlur("name", name)}
                            placeholder="Enter your full name"
                            className={`pl-10 ${touched.name && fieldErrors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                          />
                        </div>
                        {touched.name && fieldErrors.name && (
                          <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Email Address
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        data-testid="input-auth-email"
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (touched.email) validateField("email", e.target.value);
                        }}
                        onBlur={() => handleBlur("email", email)}
                        placeholder="Enter your email"
                        className={`pl-10 ${touched.email && fieldErrors.email ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      />
                    </div>
                    {touched.email && fieldErrors.email && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
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
                        <Label htmlFor="phone" className="text-sm font-medium">
                          Phone Number
                        </Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            data-testid="input-auth-phone"
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => {
                              setPhone(e.target.value);
                              if (touched.phone) validateField("phone", e.target.value);
                            }}
                            onBlur={() => handleBlur("phone", phone)}
                            placeholder="Enter your phone number"
                            className={`pl-10 ${touched.phone && fieldErrors.phone ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                          />
                        </div>
                        {touched.phone && fieldErrors.phone && (
                          <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        data-testid="input-auth-password"
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (touched.password) validateField("password", e.target.value);
                        }}
                        onBlur={() => handleBlur("password", password)}
                        placeholder="Enter your password"
                        className={`pl-10 pr-10 ${touched.password && fieldErrors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      />
                      <button
                        type="button"
                        data-testid="button-toggle-password"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {touched.password && fieldErrors.password && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>
                    )}
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                        data-testid="text-auth-error"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    data-testid="button-auth-submit"
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-6 text-base font-medium"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {mode === "login" ? "Signing in..." : "Creating account..."}
                      </>
                    ) : (
                      mode === "login" ? "Sign In" : "Create Account"
                    )}
                  </Button>
                </form>

                <div className="mt-6 pt-6 border-t">
                  <p className="text-xs text-gray-500 text-center mb-4">Why create an account?</p>
                  <div className="space-y-2">
                    {benefits.map((benefit, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  data-testid="button-maybe-later"
                  onClick={onClose}
                  className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
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
