import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { MapPin, Save, Palette, Eye, Loader2, Triangle, GitBranch, Network } from "lucide-react";

interface MapSettingsData {
  connectedPropertyIds: string[];
  pattern: string;
  lineColor: string;
  fillColor: string;
  fillOpacity: number;
  lineWidth: number;
  glowEnabled: boolean;
  animationEnabled: boolean;
}

interface PropertyItem {
  id: string;
  name: string;
  displayName?: string;
  location: string;
  mapLatitude?: string | null;
  mapLongitude?: string | null;
}

const PATTERN_OPTIONS = [
  { value: "triangle", label: "Triangle (Closed Shape)", icon: Triangle, desc: "Connects selected properties in a closed polygon with fill" },
  { value: "chain", label: "Chain (Sequential Line)", icon: GitBranch, desc: "Connects properties in nearest-neighbor order" },
  { value: "network", label: "Network (All Connected)", icon: Network, desc: "Every selected property connects to every other" },
];

const COLOR_PRESETS = [
  { name: "Emerald", value: "#34d399" },
  { name: "Cyan", value: "#67e8f9" },
  { name: "Amber", value: "#fbbf24" },
  { name: "Violet", value: "#a78bfa" },
  { name: "Rose", value: "#fb7185" },
  { name: "Blue", value: "#60a5fa" },
];

export default function AdminMapDesign() {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: properties = [] } = useQuery<PropertyItem[]>({
    queryKey: ["/api/properties"],
    queryFn: async () => {
      const res = await fetch("/api/properties");
      return res.json();
    },
  });

  const { data: settings, isLoading } = useQuery<MapSettingsData>({
    queryKey: ["/api/map-settings"],
    queryFn: async () => {
      const res = await fetch("/api/map-settings");
      return res.json();
    },
  });

  const [localSettings, setLocalSettings] = useState<MapSettingsData | null>(null);

  const current = localSettings || settings || {
    connectedPropertyIds: [],
    pattern: "triangle",
    lineColor: "#34d399",
    fillColor: "#34d399",
    fillOpacity: 0.15,
    lineWidth: 2.5,
    glowEnabled: true,
    animationEnabled: true,
  };

  if (settings && !localSettings) {
    setTimeout(() => setLocalSettings({ ...settings }), 0);
  }

  const updateField = <K extends keyof MapSettingsData>(key: K, value: MapSettingsData[K]) => {
    setLocalSettings(prev => prev ? { ...prev, [key]: value } : { ...current, [key]: value });
  };

  const toggleProperty = (propertyId: string) => {
    const ids = current.connectedPropertyIds || [];
    if (ids.includes(propertyId)) {
      updateField("connectedPropertyIds", ids.filter(id => id !== propertyId));
    } else {
      updateField("connectedPropertyIds", [...ids, propertyId]);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: MapSettingsData) => {
      const res = await fetch("/api/admin/map-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/map-settings"] });
      toast({ title: "Map settings saved", description: "Your map design changes are now live." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save map settings", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (localSettings) saveMutation.mutate(localSettings);
  };

  const selectedCount = current.connectedPropertyIds.length;
  const patternInfo = PATTERN_OPTIONS.find(p => p.value === current.pattern);

  return (
      <div className="space-y-6 p-4 md:p-6" data-testid="admin-map-design">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="page-title">Map Design</h1>
            <p className="text-muted-foreground text-sm mt-1">Configure which properties to connect on the homepage map and how they appear.</p>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_380px] gap-6">
            <div className="space-y-6">
              <Card data-testid="card-property-selection">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-500" />
                    Select Properties to Connect
                  </CardTitle>
                  <CardDescription>
                    Choose which properties should be connected with lines on the map. {selectedCount} selected.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {properties.map((property) => {
                      const name = property.displayName || property.name;
                      const isSelected = current.connectedPropertyIds.includes(property.id);
                      const hasCoords = property.mapLatitude && property.mapLongitude;
                      return (
                        <label
                          key={property.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "border-border hover:border-muted-foreground/30"
                          } ${!hasCoords ? "opacity-50" : ""}`}
                          data-testid={`property-toggle-${property.id}`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleProperty(property.id)}
                            disabled={!hasCoords}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{name}</p>
                            <p className="text-xs text-muted-foreground truncate">{property.location}</p>
                            {!hasCoords && (
                              <p className="text-xs text-amber-500 mt-1">No coordinates set — add lat/lng in property settings first</p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {selectedCount < 2 && (
                    <p className="text-sm text-amber-500 mt-4">Select at least 2 properties to form a connection pattern.</p>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-pattern">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="w-5 h-5 text-violet-500" />
                    Connection Pattern
                  </CardTitle>
                  <CardDescription>Choose how the selected properties connect on the map.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {PATTERN_OPTIONS.map((option) => {
                      const isActive = current.pattern === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => updateField("pattern", option.value)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all ${
                            isActive
                              ? "border-violet-500/40 bg-violet-500/5"
                              : "border-border hover:border-muted-foreground/30"
                          }`}
                          data-testid={`pattern-${option.value}`}
                        >
                          <option.icon className={`w-8 h-8 ${isActive ? "text-violet-400" : "text-muted-foreground"}`} />
                          <span className="font-medium text-sm">{option.label}</span>
                          <span className="text-[11px] text-muted-foreground leading-tight">{option.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                  {current.pattern === "triangle" && selectedCount !== 3 && selectedCount > 0 && (
                    <p className="text-sm text-amber-500 mt-4">
                      Triangle pattern works best with exactly 3 properties. You have {selectedCount} selected.
                      {selectedCount > 3 ? " Only the first 3 will form the triangle." : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card data-testid="card-styling">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5 text-cyan-500" />
                    Line Styling
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <Label className="text-xs font-medium mb-2 block">Line Color</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => {
                            updateField("lineColor", preset.value);
                            updateField("fillColor", preset.value);
                          }}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            current.lineColor === preset.value ? "border-white scale-110" : "border-transparent"
                          }`}
                          style={{ backgroundColor: preset.value }}
                          title={preset.name}
                          data-testid={`color-${preset.name.toLowerCase()}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={current.lineColor}
                        onChange={(e) => {
                          updateField("lineColor", e.target.value);
                          updateField("fillColor", e.target.value);
                        }}
                        className="w-10 h-8 p-0 border-0 cursor-pointer"
                        data-testid="input-line-color"
                      />
                      <Input
                        type="text"
                        value={current.lineColor}
                        onChange={(e) => {
                          updateField("lineColor", e.target.value);
                          updateField("fillColor", e.target.value);
                        }}
                        className="flex-1 text-xs font-mono"
                        data-testid="input-line-color-text"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-medium mb-2 block">Line Width: {current.lineWidth}px</Label>
                    <Slider
                      value={[current.lineWidth]}
                      onValueChange={([v]) => updateField("lineWidth", v)}
                      min={1}
                      max={6}
                      step={0.5}
                      data-testid="slider-line-width"
                    />
                  </div>

                  {current.pattern === "triangle" && (
                    <div>
                      <Label className="text-xs font-medium mb-2 block">Fill Opacity: {Math.round(current.fillOpacity * 100)}%</Label>
                      <Slider
                        value={[current.fillOpacity]}
                        onValueChange={([v]) => updateField("fillOpacity", v)}
                        min={0}
                        max={0.5}
                        step={0.01}
                        data-testid="slider-fill-opacity"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-effects">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-amber-500" />
                    Effects
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Glow Effect</Label>
                      <p className="text-xs text-muted-foreground">Adds a soft glow around the lines</p>
                    </div>
                    <Switch
                      checked={current.glowEnabled}
                      onCheckedChange={(v) => updateField("glowEnabled", v)}
                      data-testid="switch-glow"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Animated Particle</Label>
                      <p className="text-xs text-muted-foreground">Moving dot along the connection lines</p>
                    </div>
                    <Switch
                      checked={current.animationEnabled}
                      onCheckedChange={(v) => updateField("animationEnabled", v)}
                      data-testid="switch-animation"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-preview-info">
                <CardContent className="pt-5">
                  <div className="text-center space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-medium">
                      <Eye className="w-3.5 h-3.5" />
                      Live Preview
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Save changes and visit the homepage to see your map design live.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
  );
}
