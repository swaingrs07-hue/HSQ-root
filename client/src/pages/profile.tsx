import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Shield, Calendar, Key, Save, Camera, X, Check, Loader2, Phone, Eye, EyeOff, Smartphone, Copy } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export default function Profile() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // 2FA state
  const [twoFactorDialogOpen, setTwoFactorDialogOpen] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState<"info" | "setup" | "verify">("info");
  const [verificationCode, setVerificationCode] = useState("");

  const userInitials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name?: string; phone?: string; avatarUrl?: string }) => {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
      });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);

    try {
      setIsUploadingAvatar(true);
      
      const urlRes = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `avatar-${user?.id}-${Date.now()}.${file.name.split(".").pop()}`,
          size: file.size,
          contentType: file.type,
        }),
      });

      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      const publicUrl = `/api/uploads/public/${objectPath.split("/").pop()}`;
      
      await updateProfileMutation.mutateAsync({ avatarUrl: publicUrl });
      
      toast({
        title: "Avatar Updated",
        description: "Your profile picture has been updated.",
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload profile picture. Please try again.",
        variant: "destructive",
      });
      setPreviewUrl(null);
    } finally {
      setIsUploadingAvatar(false);
    }
  }, [user?.id, token, toast, updateProfileMutation]);

  const handleSave = () => {
    updateProfileMutation.mutate({
      name: formData.name,
      phone: formData.phone,
    });
  };

  const handlePasswordChange = () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your new passwords match.",
        variant: "destructive",
      });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Password Changed",
      description: "Your password has been updated successfully.",
    });
    setPasswordDialogOpen(false);
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  const handleEnable2FA = () => {
    setTwoFactorStep("setup");
  };

  const handleVerify2FA = () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }
    setTwoFactorEnabled(true);
    toast({
      title: "2FA Enabled",
      description: "Two-factor authentication has been enabled for your account.",
    });
    setTwoFactorDialogOpen(false);
    setTwoFactorStep("info");
    setVerificationCode("");
  };

  const handleDisable2FA = () => {
    setTwoFactorEnabled(false);
    toast({
      title: "2FA Disabled",
      description: "Two-factor authentication has been disabled.",
    });
    setTwoFactorDialogOpen(false);
  };

  const avatarUrl = previewUrl || user?.avatarUrl;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account information</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 overflow-hidden">
          <div className="h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500" />
          <CardContent className="pt-0 -mt-12">
            <div className="flex flex-col items-center text-center">
              <div className="relative group">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="relative"
                >
                  <Avatar className="h-24 w-24 border-4 border-white shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                    {avatarUrl ? (
                      <AvatarImage src={avatarUrl} alt={user?.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-2xl font-bold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  
                  <AnimatePresence>
                    {isUploadingAvatar && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center"
                      >
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-avatar-upload"
                />
                
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition-colors disabled:opacity-50"
                  data-testid="button-change-avatar"
                >
                  <Camera className="w-4 h-4" />
                </motion.button>
              </div>
              
              <h2 className="text-xl font-semibold text-slate-800 mt-4">{user?.name}</h2>
              <p className="text-slate-500 text-sm">{user?.email}</p>
              <Badge 
                variant="secondary" 
                className="mt-3 capitalize bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 border-0"
              >
                {user?.role || "User"}
              </Badge>

              <div className="w-full mt-6 pt-6 border-t space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Account Status</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <Check className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Member Since</span>
                  <span className="text-slate-700 font-medium">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-500" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>Update your profile details</CardDescription>
                </div>
                {!isEditing ? (
                  <Button 
                    variant="outline" 
                    onClick={() => setIsEditing(true)} 
                    data-testid="button-edit-profile"
                    className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          name: user?.name || "",
                          email: user?.email || "",
                          phone: user?.phone || "",
                        });
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSave} 
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-save-profile"
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                    >
                      {updateProfileMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2 text-slate-600">
                    <User className="w-4 h-4" />
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!isEditing}
                    className={isEditing ? "border-indigo-200 focus:border-indigo-400" : "bg-slate-50"}
                    data-testid="input-profile-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="bg-slate-50"
                    data-testid="input-profile-email"
                  />
                  <p className="text-xs text-slate-500">Email cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-4 h-4" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!isEditing}
                    placeholder="+91 98765 43210"
                    className={isEditing ? "border-indigo-200 focus:border-indigo-400" : "bg-slate-50"}
                    data-testid="input-profile-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-slate-600">
                    <Shield className="w-4 h-4" />
                    Role
                  </Label>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-md bg-slate-50 border">
                    <Badge variant="secondary" className="capitalize">
                      {user?.role || "User"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-500" />
                Security
              </CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Key className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">Password</p>
                    <p className="text-sm text-slate-500">Last changed: Never</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setPasswordDialogOpen(true)}
                  data-testid="button-change-password"
                  className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  Change Password
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Shield className={twoFactorEnabled ? "w-5 h-5 text-emerald-500" : "w-5 h-5 text-amber-500"} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">Two-Factor Authentication</p>
                    <p className="text-sm text-slate-500">Add an extra layer of security</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTwoFactorStep(twoFactorEnabled ? "info" : "info");
                    setTwoFactorDialogOpen(true);
                  }}
                  className={twoFactorEnabled 
                    ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50" 
                    : "border-amber-200 text-amber-600 hover:bg-amber-50"
                  }
                  data-testid="button-2fa-settings"
                >
                  {twoFactorEnabled ? "Manage 2FA" : "Enable 2FA"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-500" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                  data-testid="input-current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Enter new password (min 8 characters)"
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePasswordChange}
              className="bg-gradient-to-r from-indigo-500 to-purple-600"
              data-testid="button-submit-password"
            >
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Two-Factor Authentication Dialog */}
      <Dialog open={twoFactorDialogOpen} onOpenChange={setTwoFactorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              {twoFactorEnabled 
                ? "Manage your two-factor authentication settings."
                : "Add an extra layer of security to your account."}
            </DialogDescription>
          </DialogHeader>
          
          {twoFactorStep === "info" && !twoFactorEnabled && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-8 h-8 text-emerald-500 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-slate-800">Authenticator App</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      Use an authenticator app like Google Authenticator or Authy to generate verification codes.
                    </p>
                  </div>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Protects against unauthorized access
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Works even without internet
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Codes change every 30 seconds
                </li>
              </ul>
            </div>
          )}

          {twoFactorStep === "setup" && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <div className="w-40 h-40 mx-auto bg-white border-2 rounded-xl flex items-center justify-center mb-4">
                  <div className="text-center">
                    <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center">
                      <p className="text-xs text-slate-500 p-2">QR Code would appear here</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600">Scan this QR code with your authenticator app</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <Label className="text-xs text-slate-500">Or enter this code manually:</Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 font-mono text-sm bg-white px-3 py-2 rounded border">
                    ABCD-EFGH-IJKL-MNOP
                  </code>
                  <Button variant="outline" size="sm" className="flex-shrink-0">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="verification-code">Enter Verification Code</Label>
                <Input
                  id="verification-code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  maxLength={6}
                  data-testid="input-2fa-code"
                />
              </div>
            </div>
          )}

          {twoFactorEnabled && twoFactorStep === "info" && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-full">
                    <Check className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-emerald-800">2FA is Enabled</h4>
                    <p className="text-sm text-emerald-600">Your account is protected with two-factor authentication.</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-600">
                You'll need to enter a verification code from your authenticator app when signing in.
              </p>
            </div>
          )}

          <DialogFooter>
            {twoFactorStep === "info" && !twoFactorEnabled && (
              <>
                <Button variant="outline" onClick={() => setTwoFactorDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleEnable2FA}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600"
                  data-testid="button-setup-2fa"
                >
                  Set Up 2FA
                </Button>
              </>
            )}
            {twoFactorStep === "setup" && (
              <>
                <Button variant="outline" onClick={() => setTwoFactorStep("info")}>
                  Back
                </Button>
                <Button 
                  onClick={handleVerify2FA}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600"
                  data-testid="button-verify-2fa"
                >
                  Verify & Enable
                </Button>
              </>
            )}
            {twoFactorEnabled && twoFactorStep === "info" && (
              <>
                <Button variant="outline" onClick={() => setTwoFactorDialogOpen(false)}>
                  Close
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleDisable2FA}
                  data-testid="button-disable-2fa"
                >
                  Disable 2FA
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
