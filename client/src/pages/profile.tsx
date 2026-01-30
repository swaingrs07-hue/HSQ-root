import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Shield, Calendar, Key, Save, Camera, Upload, X, Check, Loader2, Phone } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

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
                  data-testid="button-change-password"
                  className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  Change Password
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Shield className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-700">Two-Factor Authentication</p>
                    <p className="text-sm text-slate-500">Add an extra layer of security</p>
                  </div>
                </div>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  Not Enabled
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
