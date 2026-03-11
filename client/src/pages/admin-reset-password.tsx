import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Eye, EyeOff, Check, AlertCircle } from "lucide-react";
import hsquareLogo from "@/assets/hsquare-logo.jpg";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token") || "";
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid reset link. Please request a new one.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setSuccess(true);
      toast({ title: "Password reset successfully" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-10 max-w-md w-full text-center space-y-4"
        >
          <div className="mx-auto w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Invalid Reset Link</h2>
          <p className="text-sm text-gray-500">This password reset link is invalid or has expired. Please request a new one.</p>
          <Button className="w-full h-11 rounded-xl" onClick={() => setLocation("/admin/login")} data-testid="button-go-login">
            Go to Login
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-purple-50/30 to-blue-50/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-10 max-w-md w-full"
      >
        {success ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Password Reset</h2>
            <p className="text-sm text-gray-500">Your password has been reset successfully. You can now log in with your new password.</p>
            <Button className="w-full h-11 rounded-xl" onClick={() => setLocation("/admin/login")} data-testid="button-go-login-success">
              Sign In
            </Button>
          </div>
        ) : (
          <>
            <div className="text-center space-y-3 mb-6">
              <img src={hsquareLogo} alt="Hsquare Living" className="h-14 w-auto mx-auto rounded-2xl shadow-lg" />
              <h2 className="text-xl font-bold text-gray-900">Set New Password</h2>
              <p className="text-sm text-gray-500">Enter your new password below</p>
            </div>
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium text-gray-700">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    className="pl-11 pr-11 h-12 rounded-xl border-2 border-gray-200 bg-white/80"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-gray-700">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    className="pl-11 h-12 rounded-xl border-2 border-gray-200 bg-white/80"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>
              {error && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </motion.p>
              )}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/90 font-semibold text-base"
                disabled={loading || !password || !confirmPassword}
                data-testid="button-reset-password"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                onClick={() => setLocation("/admin/login")}
              >
                Back to Sign In
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
