import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { MapPin, Save, Palette, Eye, Loader2, Triangle, GitBranch, Network, Plus, Trash2, ChevronDown, ChevronUp, Layers } from "lucide-react";

interface ConnectionGroup {
  id?: string;
  name: string;
  connectedPropertyIds: string[];
  pattern: string;
  lineColor: string;
  fillColor: string;
  fillOpacity: number;
  lineWidth: number;
  glowEnabled: boolean;
  animationEnabled: boolean;
}

interface MapSettingsResponse {
  groups?: ConnectionGroup[];
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

const DEFAULT_GROUP: ConnectionGroup = {
  name: "Connection 1",
  connectedPropertyIds: [],
  pattern: "triangle",
  lineColor: "#34d399",
  fillColor: "#34d399",
  fillOpacity: 0.15,
  lineWidth: 2.5,
  glowEnabled: true,
  animationEnabled: true,
};

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

  const { data: settings, isLoading } = useQuery<MapSettingsResponse>({
    queryKey: ["/api/map-settings"],
    queryFn: async () => {
      const res = await fetch("/api/map-settings");
      return res.json();
    },
  });

  const [groups, setGroups] = useState<ConnectionGroup[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<number>(0);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      if (settings.groups && settings.groups.length > 0) {
        setGroups(settings.groups);
      } else if (settings.connectedPropertyIds?.length > 0) {
        setGroups([{
          id: undefined,
          name: "Connection 1",
          connectedPropertyIds: settings.connectedPropertyIds,
          pattern: settings.pattern,
          lineColor: settings.lineColor,
          fillColor: settings.fillColor,
          fillOpacity: settings.fillOpacity,
          lineWidth: settings.lineWidth,
          glowEnabled: settings.glowEnabled,
          animationEnabled: settings.animationEnabled,
        }]);
      } else {
        setGroups([{ ...DEFAULT_GROUP }]);
      }
      setInitialized(true);
    }
  }, [settings, initialized]);

  const updateGroup = (index: number, updates: Partial<ConnectionGroup>) => {
    setGroups(prev => prev.map((g, i) => i === index ? { ...g, ...updates } : g));
  };

  const toggleProperty = (groupIndex: number, propertyId: string) => {
    const group = groups[groupIndex];
    const ids = group.connectedPropertyIds || [];
    if (ids.includes(propertyId)) {
      updateGroup(groupIndex, { connectedPropertyIds: ids.filter(id => id !== propertyId) });
    } else {
      updateGroup(groupIndex, { connectedPropertyIds: [...ids, propertyId] });
    }
  };

  const addGroup = () => {
    const num = groups.length + 1;
    const colorIndex = num % COLOR_PRESETS.length;
    setGroups(prev => [...prev, {
      ...DEFAULT_GROUP,
      name: `Connection ${num}`,
      lineColor: COLOR_PRESETS[colorIndex].value,
      fillColor: COLOR_PRESETS[colorIndex].value,
    }]);
    setExpandedGroup(groups.length);
  };

  const removeGroup = (index: number) => {
    if (groups.length <= 1) return;
    setGroups(prev => prev.filter((_, i) => i !== index));
    if (expandedGroup >= index && expandedGroup > 0) {
      setExpandedGroup(expandedGroup - 1);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (data: { groups: ConnectionGroup[] }) => {
      const res = await fetch("/api/admin/map-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/map-settings"] });
      if (data.groups) {
        setGroups(data.groups);
      }
      toast({ title: "Map settings saved", description: "Your map design changes are now live." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save map settings", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ groups });
  };

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="admin-map-design">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="page-title">Map Design</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure connection patterns on the homepage map. Add multiple groups to create different connections.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addGroup} data-testid="button-add-group">
            <Plus className="w-4 h-4 mr-2" />
            Add Connection
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save All
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, index) => {
            const isExpanded = expandedGroup === index;
            const selectedCount = group.connectedPropertyIds.length;

            return (
              <Card key={index} className={`transition-all ${isExpanded ? "ring-2 ring-primary/20" : ""}`} data-testid={`connection-group-${index}`}>
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg"
                  onClick={() => setExpandedGroup(isExpanded ? -1 : index)}
                  data-testid={`group-header-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: group.lineColor }}
                    />
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium text-sm">{group.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {selectedCount} properties · {PATTERN_OPTIONS.find(p => p.value === group.pattern)?.label || group.pattern}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {groups.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeGroup(index); }}
                        data-testid={`button-remove-group-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="pt-0 space-y-6">
                    <div>
                      <Label className="text-xs font-medium mb-2 block">Group Name</Label>
                      <Input
                        value={group.name}
                        onChange={(e) => updateGroup(index, { name: e.target.value })}
                        placeholder="Connection name"
                        className="max-w-sm"
                        data-testid={`input-group-name-${index}`}
                      />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      <div>
                        <h3 className="flex items-center gap-2 font-medium text-sm mb-3">
                          <MapPin className="w-4 h-4 text-emerald-500" />
                          Select Properties ({selectedCount} selected)
                        </h3>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {properties.map((property) => {
                            const name = property.displayName || property.name;
                            const isSelected = group.connectedPropertyIds.includes(property.id);
                            const hasCoords = property.mapLatitude && property.mapLongitude;
                            return (
                              <label
                                key={property.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                  isSelected
                                    ? "border-emerald-500/40 bg-emerald-500/5"
                                    : "border-border hover:border-muted-foreground/30"
                                } ${!hasCoords ? "opacity-50 cursor-not-allowed" : ""}`}
                                data-testid={`property-toggle-${index}-${property.id}`}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleProperty(index, property.id)}
                                  disabled={!hasCoords}
                                  className="shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm">{name}</p>
                                    {hasCoords && (
                                      <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{property.location}</p>
                                </div>
                                {!hasCoords && (
                                  <span className="shrink-0 text-[11px] text-amber-500 whitespace-nowrap">No coordinates</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                        {selectedCount < 2 && (
                          <p className="text-sm text-amber-500 mt-3">Select at least 2 properties to form a connection.</p>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h3 className="flex items-center gap-2 font-medium text-sm mb-3">
                            <Network className="w-4 h-4 text-violet-500" />
                            Connection Pattern
                          </h3>
                          <div className="space-y-2">
                            {PATTERN_OPTIONS.map((option) => {
                              const isActive = group.pattern === option.value;
                              return (
                                <button
                                  key={option.value}
                                  onClick={() => updateGroup(index, { pattern: option.value })}
                                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                                    isActive
                                      ? "border-violet-500/40 bg-violet-500/5"
                                      : "border-border hover:border-muted-foreground/30"
                                  }`}
                                  data-testid={`pattern-${index}-${option.value}`}
                                >
                                  <option.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-violet-400" : "text-muted-foreground"}`} />
                                  <div className="min-w-0">
                                    <span className="font-medium text-sm block">{option.label}</span>
                                    <span className="text-xs text-muted-foreground">{option.desc}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <h3 className="flex items-center gap-2 font-medium text-sm mb-3">
                              <Palette className="w-4 h-4 text-cyan-500" />
                              Styling
                            </h3>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-xs font-medium mb-2 block">Color</Label>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                  {COLOR_PRESETS.map((preset) => (
                                    <button
                                      key={preset.value}
                                      onClick={() => updateGroup(index, { lineColor: preset.value, fillColor: preset.value })}
                                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                                        group.lineColor === preset.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                                      }`}
                                      style={{ backgroundColor: preset.value }}
                                      title={preset.name}
                                      data-testid={`color-${index}-${preset.name.toLowerCase()}`}
                                    />
                                  ))}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="color"
                                    value={group.lineColor}
                                    onChange={(e) => updateGroup(index, { lineColor: e.target.value, fillColor: e.target.value })}
                                    className="w-9 h-8 p-0.5 border rounded cursor-pointer"
                                    data-testid={`input-color-${index}`}
                                  />
                                  <Input
                                    type="text"
                                    value={group.lineColor}
                                    onChange={(e) => updateGroup(index, { lineColor: e.target.value, fillColor: e.target.value })}
                                    className="flex-1 text-xs font-mono"
                                    data-testid={`input-color-text-${index}`}
                                  />
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs font-medium mb-2 block">Width: {group.lineWidth}px</Label>
                                <Slider
                                  value={[group.lineWidth]}
                                  onValueChange={([v]) => updateGroup(index, { lineWidth: v })}
                                  min={1}
                                  max={6}
                                  step={0.5}
                                  data-testid={`slider-width-${index}`}
                                />
                              </div>
                              {group.pattern === "triangle" && (
                                <div>
                                  <Label className="text-xs font-medium mb-2 block">Fill: {Math.round(group.fillOpacity * 100)}%</Label>
                                  <Slider
                                    value={[group.fillOpacity]}
                                    onValueChange={([v]) => updateGroup(index, { fillOpacity: v })}
                                    min={0}
                                    max={0.5}
                                    step={0.01}
                                    data-testid={`slider-fill-${index}`}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <h3 className="flex items-center gap-2 font-medium text-sm mb-3">
                              <Eye className="w-4 h-4 text-amber-500" />
                              Effects
                            </h3>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <Label className="text-sm font-medium">Glow</Label>
                                  <p className="text-xs text-muted-foreground">Soft glow around lines</p>
                                </div>
                                <Switch
                                  checked={group.glowEnabled}
                                  onCheckedChange={(v) => updateGroup(index, { glowEnabled: v })}
                                  className="shrink-0"
                                  data-testid={`switch-glow-${index}`}
                                />
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <Label className="text-sm font-medium">Particle</Label>
                                  <p className="text-xs text-muted-foreground">Moving dot along lines</p>
                                </div>
                                <Switch
                                  checked={group.animationEnabled}
                                  onCheckedChange={(v) => updateGroup(index, { animationEnabled: v })}
                                  className="shrink-0"
                                  data-testid={`switch-animation-${index}`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}

          <Card className="border-dashed">
            <CardContent className="pt-5">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-xs font-medium">
                  <Eye className="w-3.5 h-3.5" />
                  Live Preview
                </div>
                <p className="text-xs text-muted-foreground">
                  Save changes and visit the properties page to see all connection groups rendered on the map.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
