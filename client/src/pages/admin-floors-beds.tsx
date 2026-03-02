import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Building2, Plus, Trash2, Loader2, Layers, BedDouble, Wand2, ChevronDown, ChevronUp, DoorOpen, Bath, Ban, Unlock, ShieldAlert } from "lucide-react";
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

interface Property { id: string; name: string; }
interface Bed {
  id: string; propertyId: string; floorId: string; roomId?: string | null;
  roomTypeId: string; bedNumber: string;
  status: "available" | "occupied" | "reserved" | "maintenance" | "blocked";
  monthlyPrice?: number | null;
  blockedReason?: string | null;
  blockedCategory?: string | null;
  blockedAt?: string | null;
  blockedBy?: string | null;
  unblockedAt?: string | null;
  unblockedBy?: string | null;
}
interface Room {
  id: string; propertyId: string; floorId: string; roomTypeId: string;
  roomNumber: string; typology: string; hasSharedWashroom: boolean;
  totalBeds: number; status: string; monthlyPrice?: number | null;
  beds: Bed[];
}
interface Floor {
  id: string; propertyId: string; floorNumber: number; name: string;
  totalBeds: number; availableBeds: number;
  beds: Bed[]; rooms: Room[];
}
interface RoomType {
  id: string; name: string; customName?: string | null;
  propertyId: string; occupancy?: number; basePrice?: number;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-500",
  occupied: "bg-rose-500",
  reserved: "bg-amber-400",
  maintenance: "bg-slate-400",
  blocked: "bg-red-700",
};
const STATUS_LABELS: Record<string, string> = {
  available: "Available", occupied: "Occupied", reserved: "Reserved", maintenance: "Maintenance", blocked: "Blocked",
};

const BLOCK_CATEGORIES = [
  "Maintenance",
  "Deep Cleaning",
  "Reserved for VIP",
  "Renovation",
  "Payment Issue",
  "Other",
];

const TYPOLOGY_OPTIONS = [
  { value: "1 Bed", label: "1 Bed (Single)" },
  { value: "2 Bed", label: "2 Bed (Double)" },
  { value: "3 Bed", label: "3 Bed (Triple)" },
  { value: "1+2", label: "1+2 Combo (3 beds, 2 sections)" },
  { value: "2+1", label: "2+1 Combo (3 beds, 2 sections)" },
  { value: "1+3", label: "1+3 Combo (4 beds, 2 sections)" },
  { value: "2+2", label: "2+2 Combo (4 beds, 2 sections)" },
  { value: "1+1+2", label: "1+1+2 Combo (4 beds, 3 sections)" },
  { value: "4 Bed", label: "4 Bed (Quad)" },
  { value: "5 Bed", label: "5 Bed" },
  { value: "6 Bed", label: "6 Bed" },
];

async function apiFetch(url: string, options?: RequestInit) {
  const token = getAuthToken();
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options?.headers },
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
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [autoGenOpen, setAutoGenOpen] = useState(false);
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [newFloor, setNewFloor] = useState({ floorNumber: 1, name: "", totalBeds: 0, availableBeds: 0 });
  const [newRoom, setNewRoom] = useState({ roomNumber: "", roomTypeId: "", typology: "1 Bed", hasSharedWashroom: false, monthlyPrice: "" });
  const [roomTypeSearch, setRoomTypeSearch] = useState("");
  const [roomTypeDropdownOpen, setRoomTypeDropdownOpen] = useState(false);
  const [autoGen, setAutoGen] = useState({ numberOfFloors: 3, bedsPerFloor: 10 });

  const { data: properties, isLoading: propertiesLoading } = useQuery<Property[]>({ queryKey: ["/api/properties"] });

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

  const invalidateFloors = () => queryClient.invalidateQueries({ queryKey: ["/api/properties", selectedPropertyId, "floors"] });

  const createFloorMutation = useMutation({
    mutationFn: (data: { floorNumber: number; name: string; totalBeds: number; availableBeds: number }) =>
      apiFetch(`/api/admin/properties/${selectedPropertyId}/floors`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { invalidateFloors(); toast({ title: "Floor Created" }); setAddFloorOpen(false); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteFloorMutation = useMutation({
    mutationFn: (floorId: string) => apiFetch(`/api/admin/floors/${floorId}`, { method: "DELETE" }),
    onSuccess: () => { invalidateFloors(); toast({ title: "Floor Deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createRoomMutation = useMutation({
    mutationFn: (data: { floorId: string; roomNumber: string; roomTypeId: string; typology: string; hasSharedWashroom: boolean; monthlyPrice?: number | null }) =>
      apiFetch(`/api/admin/properties/${selectedPropertyId}/floors/${data.floorId}/rooms`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      invalidateFloors();
      toast({ title: "Room Created", description: "Room and beds have been generated." });
      setAddRoomOpen(false);
      setNewRoom({ roomNumber: "", roomTypeId: "", typology: "1 Bed", hasSharedWashroom: false, monthlyPrice: "" });
      setRoomTypeSearch("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRoomMutation = useMutation({
    mutationFn: (roomId: string) => apiFetch(`/api/admin/rooms/${roomId}`, { method: "DELETE" }),
    onSuccess: () => { invalidateFloors(); toast({ title: "Room Deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateBedMutation = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      apiFetch(`/api/admin/beds/${bedId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => invalidateFloors(),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteBedMutation = useMutation({
    mutationFn: (bedId: string) => apiFetch(`/api/admin/beds/${bedId}`, { method: "DELETE" }),
    onSuccess: () => { invalidateFloors(); toast({ title: "Bed Removed" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const blockBedMutation = useMutation({
    mutationFn: ({ bedId, reason, category }: { bedId: string; reason: string; category: string }) =>
      apiFetch(`/api/admin/beds/${bedId}/block`, { method: "POST", body: JSON.stringify({ reason, category }) }),
    onSuccess: () => { invalidateFloors(); toast({ title: "Bed Blocked", description: "Bed has been blocked and is no longer bookable." }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unblockBedMutation = useMutation({
    mutationFn: ({ bedId, note }: { bedId: string; note?: string }) =>
      apiFetch(`/api/admin/beds/${bedId}/unblock`, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: () => { invalidateFloors(); toast({ title: "Bed Unblocked", description: "Bed is now available for booking." }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const autoGenerateMutation = useMutation({
    mutationFn: (data: { numberOfFloors: number; bedsPerFloor: number }) =>
      apiFetch(`/api/admin/properties/${selectedPropertyId}/auto-generate-floors`, { method: "POST", body: JSON.stringify({ floorCount: data.numberOfFloors }) }),
    onSuccess: () => { invalidateFloors(); toast({ title: "Auto-Generated", description: "Floors, rooms, and beds created from room types." }); setAutoGenOpen(false); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleFloor = (floorId: string) => {
    setExpandedFloors(prev => {
      const next = new Set(prev);
      if (next.has(floorId)) next.delete(floorId); else next.add(floorId);
      return next;
    });
  };

  if (propertiesLoading) {
    return <div className="flex items-center justify-center h-64" data-testid="loading-spinner"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const totalBeds = floors.reduce((sum, f) => sum + (f.beds?.length || 0), 0);
  const availableBeds = floors.reduce((sum, f) => sum + (f.beds?.filter(b => b.status === "available").length || 0), 0);
  const occupiedBeds = floors.reduce((sum, f) => sum + (f.beds?.filter(b => b.status === "occupied").length || 0), 0);
  const totalRooms = floors.reduce((sum, f) => sum + (f.rooms?.length || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" data-testid="text-page-title">
            <Layers className="w-7 h-7" />
            Floors, Rooms & Beds
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage floor layouts, room typology, and bed assignments</p>
        </div>
        <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
          <SelectTrigger className="w-full sm:w-64" data-testid="select-property">
            <SelectValue placeholder="Select Property" />
          </SelectTrigger>
          <SelectContent>
            {properties?.map((property) => (
              <SelectItem key={property.id} value={property.id} data-testid={`option-property-${property.id}`}>
                <div className="flex items-center gap-2"><Building2 className="w-4 h-4" />{property.name}</div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedPropertyId ? (
        <Card><CardContent className="py-12 text-center"><Building2 className="w-12 h-12 mx-auto text-slate-300 mb-4" /><p className="text-slate-500" data-testid="text-no-property">Select a property to manage</p></CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-slate-800" data-testid="text-total-floors">{floors.length}</p><p className="text-xs text-slate-500">Floors</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-indigo-600" data-testid="text-total-rooms">{totalRooms}</p><p className="text-xs text-slate-500">Rooms</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-slate-800" data-testid="text-total-beds">{totalBeds}</p><p className="text-xs text-slate-500">Beds</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600" data-testid="text-available-beds">{availableBeds}</p><p className="text-xs text-slate-500">Available</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-rose-600" data-testid="text-occupied-beds">{occupiedBeds}</p><p className="text-xs text-slate-500">Occupied</p></CardContent></Card>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
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
                  <Button variant="outline" data-testid="button-auto-generate"><Wand2 className="w-4 h-4 mr-2" />Auto-Generate</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Auto-Generate Floors, Rooms & Beds</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-slate-500">Generate floors with rooms and beds based on existing room types. Each room type's occupancy determines the typology (e.g., occupancy 2 = "2 Bed" room).</p>
                    <div className="space-y-2">
                      <Label>Number of Floors</Label>
                      <Input type="number" min={1} max={50} value={autoGen.numberOfFloors} onChange={(e) => setAutoGen(prev => ({ ...prev, numberOfFloors: parseInt(e.target.value) || 1 }))} data-testid="input-auto-gen-floors" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAutoGenOpen(false)}>Cancel</Button>
                    <Button onClick={() => autoGenerateMutation.mutate(autoGen)} disabled={autoGenerateMutation.isPending} data-testid="button-confirm-auto-generate">
                      {autoGenerateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Generate
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={addFloorOpen} onOpenChange={setAddFloorOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-floor"><Plus className="w-4 h-4 mr-2" />Add Floor</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add New Floor</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Floor Number</Label>
                      <Input type="number" min={0} value={newFloor.floorNumber} onChange={(e) => setNewFloor(prev => ({ ...prev, floorNumber: parseInt(e.target.value) || 0 }))} data-testid="input-floor-number" />
                    </div>
                    <div className="space-y-2">
                      <Label>Floor Name</Label>
                      <Input placeholder="e.g., Ground Floor, 1st Floor" value={newFloor.name} onChange={(e) => setNewFloor(prev => ({ ...prev, name: e.target.value }))} data-testid="input-floor-name" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddFloorOpen(false)}>Cancel</Button>
                    <Button onClick={() => { if (!newFloor.name) { toast({ title: "Enter a floor name", variant: "destructive" }); return; } createFloorMutation.mutate(newFloor); }} disabled={createFloorMutation.isPending} data-testid="button-confirm-add-floor">
                      {createFloorMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Floor
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {floorsLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : floors.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Layers className="w-12 h-12 mx-auto text-slate-300 mb-4" /><p className="text-slate-500 mb-2" data-testid="text-no-floors">No floors configured yet</p><p className="text-sm text-slate-400">Add floors manually or use Auto-Generate to create from room types</p></CardContent></Card>
          ) : (
            <div className="space-y-4">
              {floors.map((floor) => {
                const isExpanded = expandedFloors.has(floor.id);
                const floorRooms = floor.rooms || [];
                const floorBeds = floor.beds || [];
                const orphanBeds = floorBeds.filter(b => !b.roomId);

                return (
                  <Card key={floor.id} data-testid={`card-floor-${floor.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <button className="flex items-center gap-3 text-left flex-1" onClick={() => toggleFloor(floor.id)} data-testid={`button-toggle-floor-${floor.id}`}>
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                          <div>
                            <CardTitle className="text-base font-semibold">
                              {floor.name}
                              <span className="text-sm font-normal text-slate-400 ml-2">(Floor {floor.floorNumber})</span>
                            </CardTitle>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {floorRooms.length} rooms · {floorBeds.length} beds · <span className="text-emerald-600">{floorBeds.filter(b => b.status === "available").length} available</span>
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedFloorId(floor.id); setAddRoomOpen(true); }} data-testid={`button-add-room-${floor.id}`}>
                            <DoorOpen className="w-3 h-3 mr-1" />Add Room
                          </Button>
                          <Button size="sm" variant="ghost" className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => { if (confirm("Delete this floor and all its rooms/beds?")) deleteFloorMutation.mutate(floor.id); }}
                            data-testid={`button-delete-floor-${floor.id}`}
                          ><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="pt-2">
                        {floorRooms.length === 0 && orphanBeds.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed rounded-lg">
                            No rooms on this floor. Click "Add Room" to create one with custom typology.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {floorRooms.map((room) => (
                              <RoomCard key={room.id} room={room} roomTypes={roomTypes || []}
                                onDeleteRoom={() => { if (confirm(`Delete room ${room.roomNumber} and all its beds?`)) deleteRoomMutation.mutate(room.id); }}
                                onUpdateBed={(bedId, status) => updateBedMutation.mutate({ bedId, status })}
                                onDeleteBed={(bedId) => { if (confirm("Remove this bed?")) deleteBedMutation.mutate(bedId); }}
                                onBlockBed={(bedId, reason, category) => blockBedMutation.mutate({ bedId, reason, category })}
                                onUnblockBed={(bedId, note) => unblockBedMutation.mutate({ bedId, note })}
                              />
                            ))}
                            {orphanBeds.length > 0 && (
                              <div className="border border-slate-200 rounded-lg p-3">
                                <p className="text-xs font-medium text-slate-500 mb-2">Unassigned Beds ({orphanBeds.length})</p>
                                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
                                  {orphanBeds.map((bed) => (
                                    <BedCell key={bed.id} bed={bed}
                                      onUpdateStatus={(status) => updateBedMutation.mutate({ bedId: bed.id, status })}
                                      onDelete={() => { if (confirm(`Remove bed ${bed.bedNumber}?`)) deleteBedMutation.mutate(bed.id); }}
                                      onBlock={(reason, category) => blockBedMutation.mutate({ bedId: bed.id, reason, category })}
                                      onUnblock={(note) => unblockBedMutation.mutate({ bedId: bed.id, note })}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          <Dialog open={addRoomOpen} onOpenChange={setAddRoomOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Add Room to Floor</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Room Number</Label>
                    <Input placeholder="e.g., 101, 210" value={newRoom.roomNumber} onChange={(e) => setNewRoom(prev => ({ ...prev, roomNumber: e.target.value }))} data-testid="input-room-number" />
                  </div>
                  <div className="space-y-2 relative">
                    <Label>Room Type</Label>
                    <div className="relative">
                      <Input
                        placeholder="Type to search or select..."
                        value={roomTypeSearch}
                        onChange={(e) => {
                          setRoomTypeSearch(e.target.value);
                          setRoomTypeDropdownOpen(true);
                          if (!e.target.value) setNewRoom(prev => ({ ...prev, roomTypeId: "" }));
                        }}
                        onFocus={() => setRoomTypeDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setRoomTypeDropdownOpen(false), 200)}
                        data-testid="input-room-type"
                      />
                      {newRoom.roomTypeId && (
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                          onClick={() => { setNewRoom(prev => ({ ...prev, roomTypeId: "" })); setRoomTypeSearch(""); }}
                          type="button"
                        >×</button>
                      )}
                    </div>
                    {roomTypeDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                        {(roomTypes || [])
                          .filter(rt => {
                            if (!roomTypeSearch) return true;
                            const label = (rt.customName || rt.name).toLowerCase();
                            return label.includes(roomTypeSearch.toLowerCase());
                          })
                          .map(rt => (
                            <button
                              key={rt.id}
                              type="button"
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition-colors",
                                newRoom.roomTypeId === rt.id && "bg-amber-50 font-medium text-amber-700"
                              )}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setNewRoom(prev => ({ ...prev, roomTypeId: rt.id }));
                                setRoomTypeSearch(rt.customName || rt.name);
                                setRoomTypeDropdownOpen(false);
                              }}
                              data-testid={`option-room-type-${rt.id}`}
                            >
                              <span>{rt.customName || rt.name}</span>
                              <span className="text-xs text-slate-400 ml-2">₹{rt.basePrice?.toLocaleString()}/mo · {rt.occupancy} occ</span>
                            </button>
                          ))}
                        {(roomTypes || []).filter(rt => {
                          if (!roomTypeSearch) return true;
                          return (rt.customName || rt.name).toLowerCase().includes(roomTypeSearch.toLowerCase());
                        }).length === 0 && (
                          <p className="px-3 py-2 text-sm text-slate-400">No matching room types</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Room Typology (Bed Configuration)</Label>
                  <Select value={newRoom.typology} onValueChange={(val) => setNewRoom(prev => ({ ...prev, typology: val }))}>
                    <SelectTrigger data-testid="select-typology"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPOLOGY_OPTIONS.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-400">
                    {newRoom.typology.includes("+") ? (
                      <>Combo room: sections {newRoom.typology.split("+").map((p, i) => `${newRoom.roomNumber || "XXX"}${String.fromCharCode(65+i)} (${p} bed${parseInt(p)>1?"s":""})`).join(", ")} with shared washroom</>
                    ) : (
                      <>Room {newRoom.roomNumber || "XXX"} will have {parseInt(newRoom.typology) || 1} bed{(parseInt(newRoom.typology) || 1) > 1 ? "s" : ""}</>
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Shared Washroom</Label>
                    <p className="text-xs text-slate-400">Common washroom in the lobby</p>
                  </div>
                  <Switch checked={newRoom.hasSharedWashroom} onCheckedChange={(v) => setNewRoom(prev => ({ ...prev, hasSharedWashroom: v }))} data-testid="switch-shared-washroom" />
                </div>

                <div className="space-y-2">
                  <Label>Monthly Price (per bed, optional)</Label>
                  <Input type="number" placeholder="Auto from room type" value={newRoom.monthlyPrice} onChange={(e) => setNewRoom(prev => ({ ...prev, monthlyPrice: e.target.value }))} data-testid="input-room-price" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddRoomOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (!newRoom.roomNumber || !newRoom.roomTypeId) {
                      toast({ title: "Please fill room number and type", variant: "destructive" });
                      return;
                    }
                    createRoomMutation.mutate({
                      floorId: selectedFloorId,
                      roomNumber: newRoom.roomNumber,
                      roomTypeId: newRoom.roomTypeId,
                      typology: newRoom.typology,
                      hasSharedWashroom: newRoom.hasSharedWashroom,
                      monthlyPrice: newRoom.monthlyPrice ? parseInt(newRoom.monthlyPrice) : null,
                    });
                  }}
                  disabled={createRoomMutation.isPending}
                  data-testid="button-confirm-add-room"
                >
                  {createRoomMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Room
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function RoomCard({ room, roomTypes, onDeleteRoom, onUpdateBed, onDeleteBed, onBlockBed, onUnblockBed }: {
  room: Room; roomTypes: RoomType[];
  onDeleteRoom: () => void;
  onUpdateBed: (bedId: string, status: string) => void;
  onDeleteBed: (bedId: string) => void;
  onBlockBed: (bedId: string, reason: string, category: string) => void;
  onUnblockBed: (bedId: string, note?: string) => void;
}) {
  const rt = roomTypes.find(r => r.id === room.roomTypeId);
  const isCombo = room.typology.includes("+");
  const allAvailable = room.beds.every(b => b.status === "available");
  const allOccupied = room.beds.every(b => b.status === "occupied");
  const roomStatusColor = allOccupied ? "border-rose-300 bg-rose-50/50" : allAvailable ? "border-emerald-300 bg-emerald-50/30" : "border-amber-300 bg-amber-50/30";

  const sections = isCombo ? room.typology.split("+").map((p, i) => ({
    label: String.fromCharCode(65 + i),
    bedCount: parseInt(p),
    beds: room.beds.filter(b => b.bedNumber.includes(`${room.roomNumber}${String.fromCharCode(65 + i)}`)),
  })) : null;

  return (
    <div className={cn("border rounded-lg p-3 transition-colors", roomStatusColor)} data-testid={`room-card-${room.id}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DoorOpen className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-sm text-slate-800">Room {room.roomNumber}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{room.typology}</Badge>
          {rt && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{rt.customName || rt.name}</Badge>}
          {room.hasSharedWashroom && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 gap-0.5">
              <Bath className="w-2.5 h-2.5" />Shared WC
            </Badge>
          )}
          {room.monthlyPrice && <span className="text-[10px] text-slate-400">₹{room.monthlyPrice.toLocaleString()}/mo</span>}
        </div>
        <Button size="sm" variant="ghost" className="text-rose-500 hover:text-rose-700 h-6 w-6 p-0" onClick={onDeleteRoom} data-testid={`button-delete-room-${room.id}`}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      {isCombo && sections ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sections.map((section) => (
            <div key={section.label} className="bg-white/80 rounded border border-slate-200 p-2">
              <p className="text-[10px] font-medium text-slate-500 mb-1.5">
                Section {room.roomNumber}{section.label} — {section.bedCount} bed{section.bedCount > 1 ? "s" : ""}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {section.beds.map((bed) => (
                  <BedCell key={bed.id} bed={bed} compact
                    onUpdateStatus={(status) => onUpdateBed(bed.id, status)}
                    onDelete={() => onDeleteBed(bed.id)}
                    onBlock={(reason, category) => onBlockBed(bed.id, reason, category)}
                    onUnblock={(note) => onUnblockBed(bed.id, note)}
                  />
                ))}
                {section.beds.length === 0 && <span className="text-[10px] text-slate-400">No beds</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-1.5 flex-wrap">
          {room.beds.map((bed) => (
            <BedCell key={bed.id} bed={bed}
              onUpdateStatus={(status) => onUpdateBed(bed.id, status)}
              onDelete={() => onDeleteBed(bed.id)}
              onBlock={(reason, category) => onBlockBed(bed.id, reason, category)}
              onUnblock={(note) => onUnblockBed(bed.id, note)}
            />
          ))}
          {room.beds.length === 0 && <span className="text-xs text-slate-400 py-2">No beds in this room</span>}
        </div>
      )}
    </div>
  );
}

function BedCell({ bed, compact, onUpdateStatus, onDelete, onBlock, onUnblock }: {
  bed: Bed; compact?: boolean;
  onUpdateStatus: (status: string) => void;
  onDelete: () => void;
  onBlock?: (reason: string, category: string) => void;
  onUnblock?: (note?: string) => void;
}) {
  const [blockOpen, setBlockOpen] = useState(false);
  const [unblockOpen, setUnblockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockCategory, setBlockCategory] = useState("Other");
  const [unblockNote, setUnblockNote] = useState("");

  const isBlocked = bed.status === "blocked";

  const bedContent = (
    <div className={cn(
      "rounded-lg flex flex-col items-center justify-center text-white text-xs font-medium transition-all hover:scale-105 relative",
      compact ? "w-12 h-12" : "w-14 h-14",
      STATUS_COLORS[bed.status]
    )}>
      {isBlocked && <Ban className={cn("mb-0.5", compact ? "w-3 h-3" : "w-4 h-4")} />}
      {!isBlocked && <BedDouble className={cn("mb-0.5", compact ? "w-3 h-3" : "w-4 h-4")} />}
      <span className="text-[9px] leading-tight truncate max-w-full px-0.5">{bed.bedNumber}</span>
      {isBlocked && (
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-red-800 text-[7px] text-white px-1 rounded whitespace-nowrap">BLOCKED</span>
      )}
    </div>
  );

  return (
    <div className="relative group" data-testid={`bed-${bed.id}`}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{bedContent}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-52">
            <p className="font-semibold">{bed.bedNumber} — {STATUS_LABELS[bed.status]}</p>
            {isBlocked && bed.blockedReason && (
              <p className="text-xs mt-1"><span className="font-medium">Reason:</span> {bed.blockedReason}</p>
            )}
            {isBlocked && bed.blockedCategory && (
              <p className="text-xs"><span className="font-medium">Category:</span> {bed.blockedCategory}</p>
            )}
            {isBlocked && bed.blockedBy && (
              <p className="text-xs"><span className="font-medium">By:</span> {bed.blockedBy}</p>
            )}
            {bed.monthlyPrice && <p className="text-xs">₹{bed.monthlyPrice.toLocaleString()}/mo</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-0.5">
        {!isBlocked && bed.status !== "occupied" && onBlock && (
          <button
            className="bg-red-700 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-800"
            onClick={() => setBlockOpen(true)}
            title="Block Bed"
            data-testid={`button-block-bed-${bed.id}`}
          ><Ban className="w-2.5 h-2.5" /></button>
        )}
        {isBlocked && onUnblock && (
          <button
            className="bg-emerald-600 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-emerald-700"
            onClick={() => setUnblockOpen(true)}
            title="Unblock Bed"
            data-testid={`button-unblock-bed-${bed.id}`}
          ><Unlock className="w-2.5 h-2.5" /></button>
        )}
        <button className="bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] hover:bg-rose-600" onClick={onDelete} data-testid={`button-delete-bed-${bed.id}`}>×</button>
      </div>

      {!isBlocked && (
        <Select value={bed.status} onValueChange={onUpdateStatus}>
          <SelectTrigger className="h-5 text-[9px] mt-0.5 px-1 border-slate-200" data-testid={`select-bed-status-${bed.id}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).filter(([k]) => k !== "blocked").map(([value, label]) => (
              <SelectItem key={value} value={value} className="text-xs">
                <div className="flex items-center gap-1"><span className={cn("w-2 h-2 rounded-full", STATUS_COLORS[value])} />{label}</div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isBlocked && (
        <div className="text-[8px] text-red-700 font-medium text-center mt-0.5 truncate max-w-14">{bed.blockedCategory || "Blocked"}</div>
      )}

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-red-600" />Block Bed {bed.bedNumber}</DialogTitle>
            <DialogDescription>This bed will be unavailable for booking until unblocked.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason Category</Label>
              <Select value={blockCategory} onValueChange={setBlockCategory}>
                <SelectTrigger data-testid="select-block-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOCK_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason (required, min 5 characters)</Label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Describe why this bed is being blocked..."
                rows={3}
                data-testid="input-block-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBlockOpen(false); setBlockReason(""); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (blockReason.trim().length < 5) return;
                onBlock?.(blockReason.trim(), blockCategory);
                setBlockOpen(false);
                setBlockReason("");
                setBlockCategory("Other");
              }}
              disabled={blockReason.trim().length < 5}
              data-testid="button-confirm-block"
            >
              <Ban className="w-4 h-4 mr-2" />Block Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unblockOpen} onOpenChange={setUnblockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Unlock className="w-5 h-5 text-emerald-600" />Unblock Bed {bed.bedNumber}</DialogTitle>
            <DialogDescription>This will make the bed available for booking again.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {bed.blockedReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-medium text-red-700">Blocked Reason:</p>
                <p className="text-sm text-red-600 mt-1">{bed.blockedReason}</p>
                {bed.blockedCategory && <Badge variant="outline" className="mt-1 text-[10px] border-red-300 text-red-600">{bed.blockedCategory}</Badge>}
              </div>
            )}
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea
                value={unblockNote}
                onChange={(e) => setUnblockNote(e.target.value)}
                placeholder="Add a note about why this bed is being unblocked..."
                rows={2}
                data-testid="input-unblock-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUnblockOpen(false); setUnblockNote(""); }}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                onUnblock?.(unblockNote.trim() || undefined);
                setUnblockOpen(false);
                setUnblockNote("");
              }}
              data-testid="button-confirm-unblock"
            >
              <Unlock className="w-4 h-4 mr-2" />Unblock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
