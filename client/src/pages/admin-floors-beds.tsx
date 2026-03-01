import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Building2, Plus, Trash2, Loader2, Layers, BedDouble, Wand2, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function getAuthToken(): string {
  try {
    const auth = JSON.parse(localStorage.getItem("hsquare_auth") || "{}");
    return auth.token || "";
  } catch {
    return "";
  }
}

interface Property {
  id: string;
  name: string;
}

interface Bed {
  id: string;
  propertyId: string;
  floorId: string;
  roomTypeId: string;
  bedNumber: string;
  status: "available" | "occupied" | "reserved" | "maintenance";
  monthlyPrice?: number | null;
  roomType?: { id: string; name: string; customName?: string | null } | null;
}

interface Floor {
  id: string;
  propertyId: string;
  floorNumber: number;
  name: string;
  totalBeds: number;
  availableBeds: number;
  beds: Bed[];
}

interface RoomType {
  id: string;
  name: string;
  customName?: string | null;
  propertyId: string;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-500",
  occupied: "bg-rose-500",
  reserved: "bg-amber-400",
  maintenance: "bg-slate-400",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  maintenance: "Maintenance",
};

async function apiFetch(url: string, options?: RequestInit) {
  const token = getAuthToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Request failed");
  }
  return res.json();
}

export default function AdminFloorsBeds() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const [addFloorOpen, setAddFloorOpen] = useState(false);
  const [addBedOpen, setAddBedOpen] = useState(false);
  const [autoGenOpen, setAutoGenOpen] = useState(false);
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [newFloor, setNewFloor] = useState({ floorNumber: 1, name: "", totalBeds: 0, availableBeds: 0 });
  const [newBed, setNewBed] = useState({ bedNumber: "", roomTypeId: "", status: "available" as string });
  const [autoGen, setAutoGen] = useState({ numberOfFloors: 3, bedsPerFloor: 10 });

  const { data: properties, isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  useEffect(() => {
    if (properties && properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  const { data: floorsData, isLoading: floorsLoading } = useQuery<Floor[]>({
    queryKey: ["/api/properties", selectedPropertyId, "floors"],
    queryFn: () => apiFetch(`/api/properties/${selectedPropertyId}/floors`),
    enabled: !!selectedPropertyId,
  });

  const { data: roomTypes } = useQuery<RoomType[]>({
    queryKey: ["/api/properties", selectedPropertyId, "room-types"],
    queryFn: async () => {
      const res = await fetch(`/api/properties/${selectedPropertyId}/room-types`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPropertyId,
  });

  const floors = floorsData || [];

  const createFloorMutation = useMutation({
    mutationFn: (data: { floorNumber: number; name: string; totalBeds: number; availableBeds: number }) =>
      apiFetch(`/api/admin/properties/${selectedPropertyId}/floors`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", selectedPropertyId, "floors"] });
      toast({ title: "Floor Created", description: "New floor has been added." });
      setAddFloorOpen(false);
      setNewFloor({ floorNumber: (floors.length || 0) + 1, name: "", totalBeds: 0, availableBeds: 0 });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteFloorMutation = useMutation({
    mutationFn: (floorId: string) => apiFetch(`/api/admin/floors/${floorId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", selectedPropertyId, "floors"] });
      toast({ title: "Floor Deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createBedsMutation = useMutation({
    mutationFn: ({ floorId, beds }: { floorId: string; beds: { bedNumber: string; roomTypeId: string; status: string }[] }) =>
      apiFetch(`/api/admin/properties/${selectedPropertyId}/floors/${floorId}/beds`, { method: "POST", body: JSON.stringify({ beds }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", selectedPropertyId, "floors"] });
      toast({ title: "Bed Added" });
      setAddBedOpen(false);
      setNewBed({ bedNumber: "", roomTypeId: "", status: "available" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateBedMutation = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      apiFetch(`/api/admin/beds/${bedId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", selectedPropertyId, "floors"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteBedMutation = useMutation({
    mutationFn: (bedId: string) => apiFetch(`/api/admin/beds/${bedId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", selectedPropertyId, "floors"] });
      toast({ title: "Bed Removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const autoGenerateMutation = useMutation({
    mutationFn: (data: { numberOfFloors: number; bedsPerFloor: number }) =>
      apiFetch(`/api/admin/properties/${selectedPropertyId}/auto-generate-floors`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", selectedPropertyId, "floors"] });
      toast({ title: "Auto-Generated", description: "Floors and beds have been created from room types." });
      setAutoGenOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleFloor = (floorId: string) => {
    setExpandedFloors(prev => {
      const next = new Set(prev);
      if (next.has(floorId)) next.delete(floorId);
      else next.add(floorId);
      return next;
    });
  };

  const handleAddFloor = () => {
    if (!newFloor.name) {
      toast({ title: "Validation", description: "Please enter a floor name.", variant: "destructive" });
      return;
    }
    createFloorMutation.mutate(newFloor);
  };

  const handleAddBed = () => {
    if (!newBed.bedNumber || !newBed.roomTypeId || !selectedFloorId) {
      toast({ title: "Validation", description: "Please fill all bed details.", variant: "destructive" });
      return;
    }
    createBedsMutation.mutate({ floorId: selectedFloorId, beds: [newBed] });
  };

  if (propertiesLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-spinner">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalBeds = floors.reduce((sum, f) => sum + (f.beds?.length || 0), 0);
  const availableBeds = floors.reduce((sum, f) => sum + (f.beds?.filter(b => b.status === "available").length || 0), 0);
  const occupiedBeds = floors.reduce((sum, f) => sum + (f.beds?.filter(b => b.status === "occupied").length || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" data-testid="text-page-title">
            <Layers className="w-7 h-7" />
            Floors & Beds Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage floors and bed assignments per property</p>
        </div>

        <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
          <SelectTrigger className="w-full sm:w-64" data-testid="select-property">
            <SelectValue placeholder="Select Property" />
          </SelectTrigger>
          <SelectContent>
            {properties?.map((property) => (
              <SelectItem key={property.id} value={property.id} data-testid={`option-property-${property.id}`}>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {property.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedPropertyId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500" data-testid="text-no-property">Select a property to manage floors and beds</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-800" data-testid="text-total-floors">{floors.length}</p>
                <p className="text-xs text-slate-500">Floors</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-slate-800" data-testid="text-total-beds">{totalBeds}</p>
                <p className="text-xs text-slate-500">Total Beds</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600" data-testid="text-available-beds">{availableBeds}</p>
                <p className="text-xs text-slate-500">Available</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-rose-600" data-testid="text-occupied-beds">{occupiedBeds}</p>
                <p className="text-xs text-slate-500">Occupied</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Available
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block ml-2" /> Occupied
                <span className="w-3 h-3 rounded-full bg-amber-400 inline-block ml-2" /> Reserved
                <span className="w-3 h-3 rounded-full bg-slate-400 inline-block ml-2" /> Maintenance
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={autoGenOpen} onOpenChange={setAutoGenOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-auto-generate">
                    <Wand2 className="w-4 h-4 mr-2" />
                    Auto-Generate
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Auto-Generate Floors & Beds</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-slate-500">Generate floors and beds based on existing room types for this property.</p>
                    <div className="space-y-2">
                      <Label>Number of Floors</Label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={autoGen.numberOfFloors}
                        onChange={(e) => setAutoGen(prev => ({ ...prev, numberOfFloors: parseInt(e.target.value) || 1 }))}
                        data-testid="input-auto-gen-floors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Beds Per Floor</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={autoGen.bedsPerFloor}
                        onChange={(e) => setAutoGen(prev => ({ ...prev, bedsPerFloor: parseInt(e.target.value) || 1 }))}
                        data-testid="input-auto-gen-beds"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAutoGenOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => autoGenerateMutation.mutate(autoGen)}
                      disabled={autoGenerateMutation.isPending}
                      data-testid="button-confirm-auto-generate"
                    >
                      {autoGenerateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Generate
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={addFloorOpen} onOpenChange={setAddFloorOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-floor">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Floor
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Floor</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Floor Number</Label>
                      <Input
                        type="number"
                        min={0}
                        value={newFloor.floorNumber}
                        onChange={(e) => setNewFloor(prev => ({ ...prev, floorNumber: parseInt(e.target.value) || 0 }))}
                        data-testid="input-floor-number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Floor Name</Label>
                      <Input
                        placeholder="e.g., Ground Floor, First Floor"
                        value={newFloor.name}
                        onChange={(e) => setNewFloor(prev => ({ ...prev, name: e.target.value }))}
                        data-testid="input-floor-name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Total Beds</Label>
                        <Input
                          type="number"
                          min={0}
                          value={newFloor.totalBeds}
                          onChange={(e) => setNewFloor(prev => ({ ...prev, totalBeds: parseInt(e.target.value) || 0 }))}
                          data-testid="input-floor-total-beds"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Available Beds</Label>
                        <Input
                          type="number"
                          min={0}
                          value={newFloor.availableBeds}
                          onChange={(e) => setNewFloor(prev => ({ ...prev, availableBeds: parseInt(e.target.value) || 0 }))}
                          data-testid="input-floor-available-beds"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddFloorOpen(false)}>Cancel</Button>
                    <Button
                      onClick={handleAddFloor}
                      disabled={createFloorMutation.isPending}
                      data-testid="button-confirm-add-floor"
                    >
                      {createFloorMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Add Floor
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {floorsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : floors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Layers className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 mb-2" data-testid="text-no-floors">No floors configured yet</p>
                <p className="text-sm text-slate-400">Add floors manually or use Auto-Generate to create from room types</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {floors.map((floor) => {
                const isExpanded = expandedFloors.has(floor.id);
                const floorBeds = floor.beds || [];
                return (
                  <Card key={floor.id} data-testid={`card-floor-${floor.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <button
                          className="flex items-center gap-3 text-left flex-1"
                          onClick={() => toggleFloor(floor.id)}
                          data-testid={`button-toggle-floor-${floor.id}`}
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                          <div>
                            <CardTitle className="text-base font-semibold">
                              {floor.name}
                              <span className="text-sm font-normal text-slate-400 ml-2">(Floor {floor.floorNumber})</span>
                            </CardTitle>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {floorBeds.length} beds · {floorBeds.filter(b => b.status === "available").length} available
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedFloorId(floor.id);
                              setAddBedOpen(true);
                            }}
                            data-testid={`button-add-bed-${floor.id}`}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Bed
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => {
                              if (confirm("Delete this floor and all its beds?")) {
                                deleteFloorMutation.mutate(floor.id);
                              }
                            }}
                            data-testid={`button-delete-floor-${floor.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded && (
                      <CardContent>
                        {floorBeds.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed rounded-lg">
                            No beds on this floor
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                            {floorBeds.map((bed) => (
                              <div
                                key={bed.id}
                                className="relative group"
                                data-testid={`bed-${bed.id}`}
                              >
                                <div
                                  className={cn(
                                    "aspect-square rounded-lg flex flex-col items-center justify-center text-white text-xs font-medium cursor-pointer transition-all hover:scale-105 hover:shadow-md",
                                    STATUS_COLORS[bed.status]
                                  )}
                                >
                                  <BedDouble className="w-4 h-4 mb-0.5" />
                                  <span className="text-[10px] leading-tight">{bed.bedNumber}</span>
                                </div>
                                <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                  <button
                                    className="bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] hover:bg-rose-600"
                                    onClick={() => {
                                      if (confirm(`Remove bed ${bed.bedNumber}?`)) {
                                        deleteBedMutation.mutate(bed.id);
                                      }
                                    }}
                                    data-testid={`button-delete-bed-${bed.id}`}
                                  >
                                    ×
                                  </button>
                                </div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                  <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-lg">
                                    {bed.bedNumber} · {STATUS_LABELS[bed.status]}
                                    {bed.roomType && ` · ${bed.roomType.customName || bed.roomType.name}`}
                                  </div>
                                </div>
                                <Select
                                  value={bed.status}
                                  onValueChange={(val) => updateBedMutation.mutate({ bedId: bed.id, status: val })}
                                >
                                  <SelectTrigger className="h-6 text-[10px] mt-1 px-1 border-slate-200" data-testid={`select-bed-status-${bed.id}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                      <SelectItem key={value} value={value} className="text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <span className={cn("w-2 h-2 rounded-full", STATUS_COLORS[value])} />
                                          {label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          <Dialog open={addBedOpen} onOpenChange={setAddBedOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Bed</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Bed Number / Label</Label>
                  <Input
                    placeholder="e.g., A1, B2, 101"
                    value={newBed.bedNumber}
                    onChange={(e) => setNewBed(prev => ({ ...prev, bedNumber: e.target.value }))}
                    data-testid="input-bed-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Room Type</Label>
                  <Select value={newBed.roomTypeId} onValueChange={(val) => setNewBed(prev => ({ ...prev, roomTypeId: val }))}>
                    <SelectTrigger data-testid="select-bed-room-type">
                      <SelectValue placeholder="Select room type" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomTypes?.map((rt) => (
                        <SelectItem key={rt.id} value={rt.id}>
                          {rt.customName || rt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={newBed.status} onValueChange={(val) => setNewBed(prev => ({ ...prev, status: val }))}>
                    <SelectTrigger data-testid="select-new-bed-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", STATUS_COLORS[value])} />
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddBedOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleAddBed}
                  disabled={createBedsMutation.isPending}
                  data-testid="button-confirm-add-bed"
                >
                  {createBedsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add Bed
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
