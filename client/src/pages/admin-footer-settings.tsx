import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Save, Plus, Trash2, Loader2, Globe, Mail, Phone, MapPin, Link as LinkIcon } from "lucide-react";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterData {
  companyDescription: string;
  email: string;
  phone: string;
  location: string;
  copyrightText: string;
  quickLinks: FooterLink[];
  supportLinks: FooterLink[];
  socialInstagram?: string;
  socialFacebook?: string;
  socialTwitter?: string;
  socialLinkedin?: string;
}

export default function AdminFooterSettings() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [data, setData] = useState<FooterData>({
    companyDescription: "",
    email: "",
    phone: "",
    location: "",
    copyrightText: "",
    quickLinks: [],
    supportLinks: [],
  });

  useEffect(() => {
    fetch("/api/footer-settings")
      .then(res => res.json())
      .then((settings) => {
        setData({
          companyDescription: settings.companyDescription || "",
          email: settings.email || "",
          phone: settings.phone || "",
          location: settings.location || "",
          copyrightText: settings.copyrightText || "",
          quickLinks: settings.quickLinks || [],
          supportLinks: settings.supportLinks || [],
          socialInstagram: settings.socialInstagram || "",
          socialFacebook: settings.socialFacebook || "",
          socialTwitter: settings.socialTwitter || "",
          socialLinkedin: settings.socialLinkedin || "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/footer-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Error", description: err.error || "Failed to save footer settings", variant: "destructive" });
        setSaving(false);
        return;
      }
      const updated = await res.json();
      setData({
        companyDescription: updated.companyDescription || "",
        email: updated.email || "",
        phone: updated.phone || "",
        location: updated.location || "",
        copyrightText: updated.copyrightText || "",
        quickLinks: updated.quickLinks || [],
        supportLinks: updated.supportLinks || [],
        socialInstagram: updated.socialInstagram || "",
        socialFacebook: updated.socialFacebook || "",
        socialTwitter: updated.socialTwitter || "",
        socialLinkedin: updated.socialLinkedin || "",
      });
      setSaved(true);
      toast({ title: "Saved", description: "Footer settings updated successfully. Changes will appear on the website." });
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save:", error);
      toast({ title: "Error", description: "Failed to save footer settings", variant: "destructive" });
    }
    setSaving(false);
  };

  const updateLink = (type: "quickLinks" | "supportLinks", index: number, field: "label" | "href", value: string) => {
    setData(prev => ({
      ...prev,
      [type]: prev[type].map((link, i) => i === index ? { ...link, [field]: value } : link),
    }));
  };

  const addLink = (type: "quickLinks" | "supportLinks") => {
    setData(prev => ({ ...prev, [type]: [...prev[type], { label: "", href: "/" }] }));
  };

  const removeLink = (type: "quickLinks" | "supportLinks", index: number) => {
    setData(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
      <div className="space-y-6" data-testid="admin-footer-settings">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-heading">Footer Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">Customize the website footer content</p>
          </div>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-footer">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4" /> Company Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Company Description</label>
                <Textarea
                  value={data.companyDescription}
                  onChange={e => setData(prev => ({ ...prev, companyDescription: e.target.value }))}
                  placeholder="Short description about your company"
                  rows={3}
                  data-testid="input-company-description"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Copyright Text</label>
                <Input
                  value={data.copyrightText}
                  onChange={e => setData(prev => ({ ...prev, copyrightText: e.target.value }))}
                  placeholder="Company Pvt Ltd. All rights reserved."
                  data-testid="input-copyright"
                />
                <p className="text-xs text-muted-foreground mt-1">Year is added automatically</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4" /> Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
                <Input
                  value={data.email}
                  onChange={e => setData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="support@example.com"
                  data-testid="input-email"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</label>
                <Input
                  value={data.phone}
                  onChange={e => setData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  data-testid="input-phone"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</label>
                <Input
                  value={data.location}
                  onChange={e => setData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="City, Country"
                  data-testid="input-location"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Quick Links</span>
                <Button size="sm" variant="outline" onClick={() => addLink("quickLinks")} data-testid="button-add-quick-link">
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.quickLinks.map((link, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    value={link.label}
                    onChange={e => updateLink("quickLinks", i, "label", e.target.value)}
                    placeholder="Label"
                    className="flex-1"
                    data-testid={`input-quick-link-label-${i}`}
                  />
                  <Input
                    value={link.href}
                    onChange={e => updateLink("quickLinks", i, "href", e.target.value)}
                    placeholder="/path"
                    className="flex-1"
                    data-testid={`input-quick-link-href-${i}`}
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeLink("quickLinks", i)} className="text-destructive shrink-0" data-testid={`button-remove-quick-link-${i}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {data.quickLinks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No quick links added</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Support Links</span>
                <Button size="sm" variant="outline" onClick={() => addLink("supportLinks")} data-testid="button-add-support-link">
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.supportLinks.map((link, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    value={link.label}
                    onChange={e => updateLink("supportLinks", i, "label", e.target.value)}
                    placeholder="Label"
                    className="flex-1"
                    data-testid={`input-support-link-label-${i}`}
                  />
                  <Input
                    value={link.href}
                    onChange={e => updateLink("supportLinks", i, "href", e.target.value)}
                    placeholder="/path"
                    className="flex-1"
                    data-testid={`input-support-link-href-${i}`}
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeLink("supportLinks", i)} className="text-destructive shrink-0" data-testid={`button-remove-support-link-${i}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {data.supportLinks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No support links added</p>}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Social Media Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Instagram URL</label>
                  <Input
                    value={data.socialInstagram || ""}
                    onChange={e => setData(prev => ({ ...prev, socialInstagram: e.target.value }))}
                    placeholder="https://instagram.com/..."
                    data-testid="input-social-instagram"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Facebook URL</label>
                  <Input
                    value={data.socialFacebook || ""}
                    onChange={e => setData(prev => ({ ...prev, socialFacebook: e.target.value }))}
                    placeholder="https://facebook.com/..."
                    data-testid="input-social-facebook"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Twitter / X URL</label>
                  <Input
                    value={data.socialTwitter || ""}
                    onChange={e => setData(prev => ({ ...prev, socialTwitter: e.target.value }))}
                    placeholder="https://twitter.com/..."
                    data-testid="input-social-twitter"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">LinkedIn URL</label>
                  <Input
                    value={data.socialLinkedin || ""}
                    onChange={e => setData(prev => ({ ...prev, socialLinkedin: e.target.value }))}
                    placeholder="https://linkedin.com/..."
                    data-testid="input-social-linkedin"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
