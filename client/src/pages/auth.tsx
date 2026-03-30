import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Mail, Lock, User, Eye, EyeOff, Phone, Check, AlertCircle, ArrowLeft } from "lucide-react";
import hsquareLogo from "@/assets/hsquare-logo.jpg";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();
  const { login, signup } = useAuth();
  const { toast } = useToast();

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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const initialHeight = window.visualViewport?.height || window.innerHeight;
    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      setKeyboardOpen(currentHeight < initialHeight * 0.75);
    };
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, []);

  const handleForgotPassword = async () => {
    if (!forgotEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setForgotSent(true);
      toast({ title: "Reset link sent", description: "Check your email for the password reset link." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

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
          const pendingRedirect = localStorage.getItem("post_login_redirect");
          if (pendingRedirect) {
            localStorage.removeItem("post_login_redirect");
            setLocation(pendingRedirect);
          } else {
            setLocation(result.redirectPath || "/dashboard");
          }
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

  const inputBaseClass = "pl-11 h-12 sm:h-[52px] rounded-xl border-2 transition-all duration-200 bg-white/80 text-base";
  const getInputClass = (field: string, hasError?: string) =>
    `${inputBaseClass} ${
      hasError ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" :
      focusedField === field ? "border-primary ring-4 ring-primary/10 shadow-lg shadow-primary/5" : "border-gray-200 hover:border-gray-300"
    }`;

  const iconClass = (field: string) =>
    `absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focusedField === field ? 'text-primary' : 'text-gray-400'}`;

  if (showForgotPassword) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-50">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-br from-primary/15 to-violet-500/10 blur-3xl" />
          <div className="absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] max-w-[400px] max-h-[400px] rounded-full bg-gradient-to-br from-blue-400/10 to-cyan-400/8 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-[440px] mx-4 sm:mx-auto">
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/8 border border-white/60 p-6 sm:p-8 md:p-10">
            {forgotSent ? (
              <div className="text-center space-y-4">
                <div className="mx-auto w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Check className="w-7 h-7 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Check your email</h2>
                <p className="text-sm text-gray-500">
                  We've sent a password reset link to <span className="font-medium text-gray-700">{forgotEmail}</span>. The link expires in 10 minutes.
                </p>
                <Button
                  className="w-full h-12 rounded-xl text-base font-semibold"
                  onClick={() => { setShowForgotPassword(false); setForgotSent(false); }}
                  data-testid="button-back-to-login"
                >
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6 active:scale-95"
                  onClick={() => setShowForgotPassword(false)}
                  data-testid="button-cancel-forgot"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </button>
                <div className="text-center space-y-2 mb-6">
                  <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                    <Mail className="w-7 h-7 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Forgot Password?</h2>
                  <p className="text-sm text-gray-500">Enter your email and we'll send you a reset link</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email" className="text-sm font-medium text-gray-700">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="forgot-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        className="pl-11 h-12 sm:h-[52px] rounded-xl border-2 border-gray-200 bg-white/80 text-base"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        data-testid="input-forgot-email"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full h-12 sm:h-[52px] rounded-xl bg-gradient-to-r from-primary to-primary/90 font-semibold text-base"
                    onClick={handleForgotPassword}
                    disabled={forgotLoading}
                    data-testid="button-send-reset-link"
                  >
                    {forgotLoading ? "Sending..." : "Send Reset Link"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] rounded-full bg-gradient-to-br from-primary/15 to-violet-500/10 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] max-w-[400px] max-h-[400px] rounded-full bg-gradient-to-br from-blue-400/10 to-cyan-400/8 blur-3xl" />
        <div className="hidden sm:block absolute top-[20%] right-[15%] w-[30vw] h-[30vw] max-w-[300px] max-h-[300px] rounded-full bg-gradient-to-br from-emerald-400/8 to-teal-400/6 blur-3xl" />
      </div>

      <div className={`relative z-10 w-full max-w-[440px] mx-4 sm:mx-auto transition-transform duration-300 ${keyboardOpen ? '-translate-y-8' : ''}`}>
        {showSuccess && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl animate-in fade-in duration-300">
            <div className="text-center animate-in zoom-in-75 duration-300">
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              <p className="text-xl font-semibold text-gray-800">Welcome back!</p>
            </div>
          </div>
        )}

        <div
          className={`relative bg-white/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/8 border border-white/60 p-6 sm:p-8 md:p-10 transition-transform duration-100 ${
            shakeForm ? 'animate-[shake_0.5s_ease-in-out]' : ''
          }`}
        >
          <div className={`text-center transition-all duration-300 ${keyboardOpen ? 'mb-4' : 'mb-6 sm:mb-8'}`}>
            <img 
              src={hsquareLogo} 
              alt="Hsquare Living" 
              className={`mx-auto rounded-2xl shadow-lg transition-all duration-300 ${keyboardOpen ? 'h-10 w-auto mb-2' : 'h-14 sm:h-16 w-auto mb-3 sm:mb-4'}`}
            />
            {!keyboardOpen && (
              <>
                <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
                  {getGreeting()}!
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {isLogin ? "Sign in to continue your journey" : "Create your account to get started"}
                </p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {!isLogin && (
              <div className="space-y-1.5 animate-in slide-in-from-left-4 fade-in duration-200">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</Label>
                <div className="relative">
                  <User className={iconClass('name')} />
                  <Input
                    id="name"
                    placeholder="John Doe"
                    autoComplete="name"
                    className={getInputClass('name', errors.name)}
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
                  <p className="text-xs text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="w-3 h-3" />
                    {errors.name}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
              <div className="relative">
                <Mail className={iconClass('email')} />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={getInputClass('email', errors.email)}
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
                <p className="text-xs text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </p>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-1.5 animate-in slide-in-from-left-4 fade-in duration-200">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Mobile Number</Label>
                <div className="relative">
                  <Phone className={iconClass('phone')} />
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="9876543210"
                    className={getInputClass('phone', errors.phone)}
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
                  <p className="text-xs text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertCircle className="w-3 h-3" />
                    {errors.phone}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <div className="relative">
                <Lock className={iconClass('password')} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  placeholder={isLogin ? "Enter your password" : "Create a strong password"}
                  className={`${getInputClass('password', errors.password)} pr-11`}
                  value={password}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 -m-1 active:scale-90"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password}
                </p>
              )}
              {capsLockOn && focusedField === 'password' && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Caps Lock is on
                </p>
              )}
              {!isLogin && !errors.password && (
                <p className="text-xs text-gray-500">
                  Min 8 characters, 1 uppercase, 1 number
                </p>
              )}
            </div>

            {isLogin && (
              <div className="flex items-center justify-between">
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
                  className="text-sm text-primary hover:text-primary/80 font-medium transition-colors active:scale-95"
                  onClick={() => { setShowForgotPassword(true); setForgotEmail(email); setForgotSent(false); }}
                  data-testid="button-forgot-password"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <div className="pt-1 sm:pt-2">
              <Button 
                type="submit" 
                className="w-full h-12 sm:h-[52px] text-base font-semibold rounded-xl bg-gradient-to-r from-primary via-primary to-primary/90 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/35 active:scale-[0.98] transition-all duration-200"
                disabled={loading || !isFormValid()}
                data-testid="button-submit"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isLogin ? "Signing in..." : "Creating account..."}</span>
                  </div>
                ) : (
                  <span>{isLogin ? "Sign In" : "Create Account"}</span>
                )}
              </Button>
            </div>
          </form>

          {!keyboardOpen && (
            <div className="mt-5 sm:mt-6 text-center">
              <p className="text-sm text-gray-600">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  className="ml-1.5 text-primary hover:text-primary/80 font-semibold transition-colors active:scale-95"
                  onClick={toggleMode}
                  data-testid="button-toggle-mode"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>
            </div>
          )}
        </div>

        {!keyboardOpen && (
          <p className="text-center text-xs text-gray-500 mt-5 sm:mt-6 px-4">
            By continuing, you agree to our{" "}
            <a href="/terms" className="text-primary hover:underline">Terms</a>
            {" "}and{" "}
            <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
          </p>
        )}
      </div>
    </div>
  );
}
