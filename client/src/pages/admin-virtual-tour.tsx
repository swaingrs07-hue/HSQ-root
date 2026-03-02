import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Globe,
  Save,
  ExternalLink,
  Trash2,
  Building2,
  Eye,
  Link2,
  CheckCircle2,
  Loader2,
  Info,
} from "lucide-react";

const TOUR_PROVIDERS = [
  { value: "matterport", label: "Matterport", placeholder: "https://my.matterport.com/show/?m=..." },
  { value: "kuula", label: "Kuula", placeholder: "https://kuula.co/share/..." },
  { value: "cloudpano", label: "CloudPano", placeholder: "https://app.cloudpano.com/tours/..." },
  { value: "panoraven", label: "Panoraven", placeholder: "https://panoraven.com/en/embed/..." },
  { value: "google_streetview", label: "Google Street View", placeholder: "https://www.google.com/maps/embed?..." },
  { value: "custom", label: "Custom / Other", placeholder: "https://your-3d-tour-provider.com/..." },
];

export default function AdminVirtualTour() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, { url: string; provider: string }>>({});

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["/api/properties"],
    queryFn: async () => {
      const res = await fetch("/api/properties");
      if (!res.ok) throw new Error("Failed to fetch properties");
      return res.json();
    },
  });

  const getEditData = (property: any) => {
    if (editData[property.id]) return editData[property.id];
    return {
      url: property.virtualTourUrl || "",
      provider: property.virtualTourProvider || "matterport",
    };
  };

  const updateEditData = (propertyId: string, field: string, value: string) => {
    setEditData(prev => ({
      ...prev,
      [propertyId]: {
        ...getEditData(properties.find((p: any) => p.id === propertyId)),
        [field]: value,
      },
    }));
  };

  const saveTour = async (propertyId: string) => {
    const data = getEditData(properties.find((p: any) => p.id === propertyId));
    setSavingId(propertyId);
    try {
      const authData = localStorage.getItem("hsquare_auth");
      const token = authData ? JSON.parse(authData)?.token : null;
      const res = await fetch(`/api/admin/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          virtualTourUrl: data.url || null,
          virtualTourProvider: data.provider || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({ title: "3D Tour saved successfully" });
      setEditData(prev => {
        const next = { ...prev };
        delete next[propertyId];
        return next;
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const removeTour = async (propertyId: string) => {
    setSavingId(propertyId);
    try {
      const authData = localStorage.getItem("hsquare_auth");
      const token = authData ? JSON.parse(authData)?.token : null;
      const res = await fetch(`/api/admin/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ virtualTourUrl: null, virtualTourProvider: null }),
      });
      if (!res.ok) throw new Error("Failed to remove tour");
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({ title: "3D Tour removed" });
      setEditData(prev => {
        const next = { ...prev };
        delete next[propertyId];
        return next;
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const getEmbedUrl = (url: string, provider: string) => {
    if (!url) return "";
    if (provider === "matterport" && !url.includes("&play=1")) {
      return url + (url.includes("?") ? "&" : "?") + "play=1";
    }
    return url;
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2" data-testid="text-page-title">
            <Globe className="h-7 w-7 text-indigo-600" />
            3D Virtual Tour Uploads
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Add 3D virtual tour links for each property (Matterport, Kuula, Google Street View, etc.)
          </p>
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">How to add a 3D tour</p>
          <ol className="list-decimal ml-4 space-y-1 text-blue-600">
            <li>Create your 3D tour on a platform like Matterport, Kuula, or CloudPano</li>
            <li>Get the embed/share link from your tour provider</li>
            <li>Paste the link below and select the provider</li>
            <li>The tour will be embedded on your property's detail page</li>
          </ol>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-32" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {properties.map((property: any) => {
            const data = getEditData(property);
            const hasTour = !!property.virtualTourUrl;
            const hasChanges = editData[property.id] !== undefined;
            const providerInfo = TOUR_PROVIDERS.find(p => p.value === data.provider) || TOUR_PROVIDERS[0];

            return (
              <Card key={property.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900" data-testid={`text-property-name-${property.id}`}>{property.name}</h3>
                          <p className="text-xs text-slate-400">{property.location || property.city}</p>
                        </div>
                      </div>
                      {hasTour ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Tour Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-slate-500">No Tour</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-1">
                        <Label className="text-xs font-medium text-slate-500">Tour Provider</Label>
                        <select
                          value={data.provider}
                          onChange={(e) => updateEditData(property.id, "provider", e.target.value)}
                          className="w-full mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                          data-testid={`select-provider-${property.id}`}
                        >
                          {TOUR_PROVIDERS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs font-medium text-slate-500">Tour Embed URL</Label>
                        <div className="flex gap-2 mt-1">
                          <div className="relative flex-1">
                            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              placeholder={providerInfo.placeholder}
                              value={data.url}
                              onChange={(e) => updateEditData(property.id, "url", e.target.value)}
                              className="pl-9"
                              data-testid={`input-tour-url-${property.id}`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => saveTour(property.id)}
                        disabled={savingId === property.id || !data.url}
                        data-testid={`button-save-tour-${property.id}`}
                      >
                        {savingId === property.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save Tour
                      </Button>
                      {data.url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setPreviewId(previewId === property.id ? null : property.id)}
                          data-testid={`button-preview-tour-${property.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {previewId === property.id ? "Hide Preview" : "Preview"}
                        </Button>
                      )}
                      {data.url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => window.open(data.url, "_blank")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </Button>
                      )}
                      {hasTour && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
                          onClick={() => removeTour(property.id)}
                          disabled={savingId === property.id}
                          data-testid={`button-remove-tour-${property.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  {previewId === property.id && data.url && (
                    <div className="bg-slate-950 p-4">
                      <div className="aspect-video rounded-lg overflow-hidden border border-slate-700">
                        <iframe
                          src={getEmbedUrl(data.url, data.provider)}
                          className="w-full h-full"
                          allow="fullscreen; autoplay; vr"
                          allowFullScreen
                          title={`3D Tour - ${property.name}`}
                          data-testid={`iframe-tour-${property.id}`}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-2 text-center">
                        Preview of 3D virtual tour for {property.name}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
