import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Upload, Image as ImageIcon, Loader2, Check, Eye } from "lucide-react";
import hsquareLogoDefault from "@/assets/hsquare-logo-full.png";

export default function AdminLogoControl() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const isMainAdmin = user?.email === "gyan@hsquareliving.com";

  const { data: logoSettings } = useQuery<{ headerLogo?: string; footerLogo?: string; adminLogo?: string }>({
    queryKey: ["/api/admin/logo-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/logo-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!token && isMainAdmin,
  });

  const uploadFile = async (file: File): Promise<string> => {
    const urlRes = await fetch("/api/uploads/request-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
    });
    if (!urlRes.ok) throw new Error("Failed to get upload URL");
    const { uploadURL, objectPath } = await urlRes.json();
    const uploadRes = await fetch(uploadURL, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!uploadRes.ok) throw new Error("Failed to upload file");
    return objectPath;
  };

  const saveMutation = useMutation({
    mutationFn: async (settings: { headerLogo?: string; footerLogo?: string; adminLogo?: string }) => {
      const res = await fetch("/api/admin/logo-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save logo settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logo-settings"] });
      toast({ title: "Logo Updated", description: "Logo settings saved successfully." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "headerLogo" | "footerLogo" | "adminLogo") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const objectPath = await uploadFile(file);
      saveMutation.mutate({ ...logoSettings, [type]: objectPath });
    } catch (err) {
      toast({ title: "Upload Failed", description: "Could not upload the logo.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!isMainAdmin) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold mb-4">Access Denied</h2>
        <p className="text-gray-600">Only the main administrator can access logo controls.</p>
      </div>
    );
  }

  const currentHeaderLogo = logoSettings?.headerLogo || hsquareLogoDefault;
  const currentFooterLogo = logoSettings?.footerLogo || logoSettings?.headerLogo || hsquareLogoDefault;
  const currentAdminLogo = logoSettings?.adminLogo || logoSettings?.headerLogo || hsquareLogoDefault;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800" data-testid="text-logo-control-title">Logo Control Panel</h1>
        <p className="text-slate-500 mt-1">Manage your brand logos across the platform. Changes apply everywhere instantly.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-header-logo">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="w-5 h-5 text-indigo-500" />
              Header Logo (Public Site)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-100 rounded-xl p-6 flex items-center justify-center min-h-[100px]">
              <img
                src={currentHeaderLogo}
                alt="Header Logo Preview"
                className="h-14 w-auto object-contain"
                data-testid="img-header-logo-preview"
              />
            </div>
            <div>
              <Label htmlFor="header-logo-upload" className="text-sm text-slate-600">Upload New Header Logo</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="header-logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e, "headerLogo")}
                  disabled={uploading}
                  className="flex-1"
                  data-testid="input-header-logo-upload"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Recommended: PNG with transparent background, at least 400px wide</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-footer-logo">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="w-5 h-5 text-emerald-500" />
              Footer Logo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-stone-900 rounded-xl p-6 flex items-center justify-center min-h-[100px]">
              <img
                src={currentFooterLogo}
                alt="Footer Logo Preview"
                className="h-14 w-auto object-contain brightness-0 invert"
                data-testid="img-footer-logo-preview"
              />
            </div>
            <div>
              <Label htmlFor="footer-logo-upload" className="text-sm text-slate-600">Upload New Footer Logo</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="footer-logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e, "footerLogo")}
                  disabled={uploading}
                  className="flex-1"
                  data-testid="input-footer-logo-upload"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Uses header logo by default. Upload separately for dark backgrounds.</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-admin-logo">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="w-5 h-5 text-purple-500" />
              Admin Sidebar Logo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white border rounded-xl p-6 flex items-center justify-center min-h-[100px]">
              <img
                src={currentAdminLogo}
                alt="Admin Logo Preview"
                className="h-12 w-auto object-contain"
                data-testid="img-admin-logo-preview"
              />
            </div>
            <div>
              <Label htmlFor="admin-logo-upload" className="text-sm text-slate-600">Upload New Admin Logo</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="admin-logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e, "adminLogo")}
                  disabled={uploading}
                  className="flex-1"
                  data-testid="input-admin-logo-upload"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Uses header logo by default. Upload separately for admin sidebar.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-slate-600">Header logo: {logoSettings?.headerLogo ? "Custom uploaded" : "Default (built-in)"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-slate-600">Footer logo: {logoSettings?.footerLogo ? "Custom uploaded" : "Using header logo"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-slate-600">Admin logo: {logoSettings?.adminLogo ? "Custom uploaded" : "Using header logo"}</span>
            </div>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}