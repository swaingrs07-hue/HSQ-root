import { useState, useEffect } from "react";
import { useProperty } from "@/contexts/property-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Building2, Plus, Trash2, Loader2, Layers, BedDouble, Wand2, ChevronDown, ChevronUp, DoorOpen, Bath, Ban, Unlock, ShieldAlert, Tag, Package, Check, X } from "lucide-react";
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
interface Property { id: string; name: string; roomTypes?: RoomType[]; }

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
  { value: "1 Bed", label: "1 Bed (Single)", group: "standard" },
  { value: "2 Bed", label: "2 Bed (Double)", group: "standard" },
  { value: "3 Bed", label: "3 Bed (Triple)", group: "standard" },
  { value: "4 Bed", label: "4 Bed (Quad)", group: "standard" },
  { value: "5 Bed", label: "5 Bed", group: "standard" },
  { value: "6 Bed", label: "6 Bed", group: "standard" },
  { value: "1+2", label: "1+2 Combo (3 beds, 2 sections)", group: "combo" },
  { value: "2+1", label: "2+1 Combo (3 beds, 2 sections)", group: "combo" },
  { value: "1+3", label: "1+3 Combo (4 beds, 2 sections)", group: "combo" },
  { value: "2+2", label: "2+2 Combo (4 beds, 2 sections)", group: "combo" },
  { value: "2+3", label: "2+3 Combo (5 beds, 2 sections)", group: "combo" },
  { value: "3+2", label: "3+2 Combo (5 beds, 2 sections)", group: "combo" },
  { value: "1+1+2", label: "1+1+2 Combo (4 beds, 3 sections)", group: "combo" },
  { value: "1+2+2", label: "1+2+2 Combo (5 beds, 3 sections)", group: "combo" },
  { value: "2+2+2", label: "2+2+2 Combo (6 beds, 3 sections)", group: "combo" },
  { value: "custom", label: "Custom Configuration...", group: "custom" },
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
  const { selectedPropertyId } = useProperty();
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const [addFloorOpen, setAddFloorOpen] = useState(false);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [autoGenOpen, setAutoGenOpen] = useState(false);
  const [selectedFloorId, setSelectedFloorId] = useState<string>("");
  const [newFloor, setNewFloor] = useState({ floorNumber: 1, name: "", totalBeds: 0, availableBeds: 0 });
  const [newRoom, setNewRoom] = useState({ roomNumber: "", roomTypeId: "", typology: "1 Bed", hasSharedWashroom: false, monthlyPrice: "" });
  const [customTypology, setCustomTypology] = useState("");
  const [isCustomTypology, setIsCustomTypology] = useState(false);
  const [roomTypeSearch, setRoomTypeSearch] = useState("");
  const [roomTypeDropdownOpen, setRoomTypeDropdownOpen] = useState(false);
  const [autoGen, setAutoGen] = useState({ numberOfFloors: 3, bedsPerFloor: 10 });
  const [planAssignOpen, setPlanAssignOpen] = useState(false);
  const [planAssignRoomTypeId, setPlanAssignRoomTypeId] = useState<string>("");
  const [planAssignRoomTypeName, setPlanAssignRoomTypeName] = useState<string>("");
  const [planAssignRoomId, setPlanAssignRoomId] = useState<string>("");
  const [planAssignRoomNumber, setPlanAssignRoomNumber] = useState<string>("");
  const [assigningPlanId, setAssigningPlanId] = useState<string | null>(null);

  const { data: properties, isLoading: propertiesLoading } = useQuery<Property[]>({ queryKey: ["/api/properties"] });


  const { data: floorsData, isLoading: floorsLoading } = useQuery<Floor[]>({
    queryKey: ["/api/properties", selectedPropertyId, "floors"],
    queryFn: () => apiFetch(`/api/properties/${selectedPropertyId}/floors`),
    enabled: !!selectedPropertyId,
  });

  const roomTypes = (properties || []).find(p => p.id === selectedPropertyId)?.roomTypes as RoomType[] | undefined;

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
      setCustomTypology("");
      setIsCustomTypology(false);
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

  const { data: propertyPackages, refetch: refetchPackages } = useQuery<any[]>({
    queryKey: ["/api/admin/packages", selectedPropertyId],
    queryFn: () => apiFetch(`/api/admin/packages`),
    enabled: !!selectedPropertyId,
    select: (data: any[]) => data.filter((p: any) => !p.propertyId || p.propertyId === selectedPropertyId),
  });

  const assignPlanMutation = useMutation({
    mutationFn: ({ packageId, linkRoomTypeId, unlinkRoomTypeId, linkRoomId, unlinkRoomId }: { packageId: string; linkRoomTypeId?: string; unlinkRoomTypeId?: string; linkRoomId?: string; unlinkRoomId?: string }) =>
      apiFetch(`/api/admin/packages/${packageId}`, {
        method: "PUT",
        body: JSON.stringify({ linkRoomTypeId, unlinkRoomTypeId, linkRoomId, unlinkRoomId }),
      }),
    onSuccess: () => {
      refetchPackages();
      toast({ title: "Plan Updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openPlanAssign = (roomTypeId: string, roomTypeName: string, roomId?: string, roomNumber?: string) => {
    setPlanAssignRoomTypeId(roomTypeId);
    setPlanAssignRoomTypeName(roomTypeName);
    setPlanAssignRoomId(roomId || "");
    setPlanAssignRoomNumber(roomNumber || "");
    setPlanAssignOpen(true);
  };

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
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" data-testid="text-page-title">
          <Layers className="w-7 h-7" />
          Floors, Rooms & Beds
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage floor layouts, room typology, and bed assignments</p>
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
                                linkedPlans={propertyPackages}
                                onAssignPlan={openPlanAssign}
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
                    <Label>Room Number(s)</Label>
                    <Input placeholder="e.g., 101 or 201,202,203" value={newRoom.roomNumber} onChange={(e) => setNewRoom(prev => ({ ...prev, roomNumber: e.target.value }))} data-testid="input-room-number" />
                    {newRoom.roomNumber.includes(",") && (
                      <p className="text-xs text-emerald-600 mt-1">
                        Will create {newRoom.roomNumber.split(",").filter(s => s.trim()).length} separate rooms with the same configuration
                      </p>
                    )}
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
                    {roomTypeDropdownOpen && (() => {
                      const q = roomTypeSearch.toLowerCase().trim();
                      const filtered = (roomTypes || []).filter(rt => {
                        if (!q) return true;
                        const name = rt.name.toLowerCase();
                        const custom = (rt.customName || "").toLowerCase();
                        return name.includes(q) || custom.includes(q);
                      });
                      const rtLabel = (rt: RoomType) => rt.customName ? `${rt.name} — ${rt.customName}` : rt.name;
                      return (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                          {filtered.map(rt => (
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
                                setRoomTypeSearch(rtLabel(rt));
                                setRoomTypeDropdownOpen(false);
                              }}
                              data-testid={`option-room-type-${rt.id}`}
                            >
                              <span>{rtLabel(rt)}</span>
                              <span className="text-xs text-slate-400 ml-2">₹{rt.basePrice?.toLocaleString()}/mo · {rt.occupancy} occ</span>
                            </button>
                          ))}
                          {filtered.length === 0 && (
                            <p className="px-3 py-2 text-sm text-slate-400">No matching room types</p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Room Typology (Bed Configuration)</Label>
                  <Select
                    value={isCustomTypology ? "custom" : newRoom.typology}
                    onValueChange={(val) => {
                      if (val === "custom") {
                        setIsCustomTypology(true);
                        setCustomTypology("");
                      } else {
                        setIsCustomTypology(false);
                        setCustomTypology("");
                        setNewRoom(prev => ({ ...prev, typology: val }));
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-typology">
                      <SelectValue placeholder="Select configuration">
                        {isCustomTypology
                          ? (customTypology ? `Custom: ${customTypology}` : "Custom Configuration...")
                          : TYPOLOGY_OPTIONS.find(t => t.value === newRoom.typology)?.label || newRoom.typology}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Standard Rooms</SelectLabel>
                        {TYPOLOGY_OPTIONS.filter(t => t.group === "standard").map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-1">Combo Rooms (Sections)</SelectLabel>
                        {TYPOLOGY_OPTIONS.filter(t => t.group === "combo").map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-1">Advanced</SelectLabel>
                        <SelectItem value="custom">Custom Configuration...</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  {isCustomTypology && (
                    <div className="space-y-1.5 pl-3 border-l-2 border-amber-400">
                      <Label className="text-xs">Custom Typology Pattern</Label>
                      <Input
                        placeholder="e.g. 3+3 or 1+2+3 or 7 Bed"
                        value={customTypology}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomTypology(val);
                          if (val.trim()) {
                            setNewRoom(prev => ({ ...prev, typology: val.trim() }));
                          }
                        }}
                        data-testid="input-custom-typology"
                        className="h-9"
                      />
                      <p className="text-[11px] text-slate-400">
                        Use <code className="bg-slate-100 px-1 rounded text-[10px]">N+N</code> for combo (e.g. <code className="bg-slate-100 px-1 rounded text-[10px]">3+3</code> = 6 beds, 2 sections) or <code className="bg-slate-100 px-1 rounded text-[10px]">N Bed</code> for simple (e.g. <code className="bg-slate-100 px-1 rounded text-[10px]">8 Bed</code>).
                      </p>
                    </div>
                  )}

                  {!isCustomTypology && (
                    <p className="text-xs text-slate-400">
                      {newRoom.typology.includes("+") ? (
                        <>Combo room: sections {newRoom.typology.split("+").map((p, i) => `${newRoom.roomNumber || "XXX"}${String.fromCharCode(65+i)} (${p} bed${parseInt(p)>1?"s":""})`).join(", ")} with shared washroom</>
                      ) : (
                        <>Room {newRoom.roomNumber || "XXX"} will have {parseInt(newRoom.typology) || 1} bed{(parseInt(newRoom.typology) || 1) > 1 ? "s" : ""}</>
                      )}
                    </p>
                  )}

                  {isCustomTypology && customTypology.trim() && (
                    <p className="text-xs text-slate-400">
                      {customTypology.includes("+") ? (
                        <>Combo room: sections {customTypology.split("+").map((p, i) => `${newRoom.roomNumber || "XXX"}${String.fromCharCode(65+i)} (${p.trim()} bed${parseInt(p.trim())>1?"s":""})`).join(", ")} with shared washroom</>
                      ) : (
                        <>Room {newRoom.roomNumber || "XXX"} will have {parseInt(customTypology) || customTypology} bed{(parseInt(customTypology) || 0) > 1 ? "s" : ""}</>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Shared Washroom</Label>
                    <p className="text-xs text-slate-400">Common washroom in the lobby</p>
                  </div>
                  <Switch checked={newRoom.hasSharedWashroom} onCheckedChange={(v) => setNewRoom(prev => ({ ...prev, hasSharedWashroom: v }))} data-testid="switch-shared-washroom" />
                </div>

              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddRoomOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (!newRoom.roomNumber) {
                      toast({ title: "Please fill room number", variant: "destructive" });
                      return;
                    }
                    if (isCustomTypology && !customTypology.trim()) {
                      toast({ title: "Please enter custom typology", description: "e.g. 3+3 or 1+2+3 or 7 Bed", variant: "destructive" });
                      return;
                    }
                    let resolvedTypeId = newRoom.roomTypeId;
                    if (!resolvedTypeId && roomTypeSearch.trim()) {
                      const q = roomTypeSearch.trim().toLowerCase();
                      const match = (roomTypes || []).find(rt => {
                        const name = rt.name.toLowerCase();
                        const custom = (rt.customName || "").toLowerCase();
                        const fullLabel = rt.customName ? `${rt.name} — ${rt.customName}`.toLowerCase() : name;
                        return name === q || custom === q || fullLabel === q;
                      });
                      if (match) resolvedTypeId = match.id;
                    }
                    if (!resolvedTypeId) {
                      const available = (roomTypes || []).map(rt => rt.customName ? `${rt.name} — ${rt.customName}` : rt.name).join(", ");
                      toast({ title: "Please select a valid room type", description: roomTypeSearch ? `"${roomTypeSearch}" doesn't match. Available: ${available}` : "Click the Room Type field and pick one.", variant: "destructive" });
                      return;
                    }
                    createRoomMutation.mutate({
                      floorId: selectedFloorId,
                      roomNumber: newRoom.roomNumber,
                      roomTypeId: resolvedTypeId,
                      typology: newRoom.typology,
                      hasSharedWashroom: newRoom.hasSharedWashroom,
                      monthlyPrice: null,
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

      <Dialog open={planAssignOpen} onOpenChange={(open) => { setPlanAssignOpen(open); if (!open) setAssigningPlanId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-violet-600" /> Assign Plan to Room
            </DialogTitle>
            <DialogDescription>
              Link housing plans to <span className="font-semibold">Room {planAssignRoomNumber || planAssignRoomTypeName}</span>. Plans linked to a specific room will only show on that room.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto py-2">
            {propertyPackages && propertyPackages.filter(p => p.isActive).length > 0 ? (
              propertyPackages.filter(p => p.isActive).map((pkg: any) => {
                const allLinkedRoomIds: string[] = Array.isArray(pkg.linkedRoomIds) ? pkg.linkedRoomIds : [];
                const allLinkedTypeIds: string[] = Array.isArray(pkg.linkedRoomTypeIds) ? pkg.linkedRoomTypeIds : (pkg.roomTypeId ? [pkg.roomTypeId] : []);
                const isRoomLinked = planAssignRoomId ? allLinkedRoomIds.includes(planAssignRoomId) : false;
                const isTypeLinked = allLinkedTypeIds.includes(planAssignRoomTypeId);
                const isLinked = isRoomLinked || isTypeLinked;
                const otherLinkedIds = allLinkedTypeIds.filter(id => id !== planAssignRoomTypeId);
                const otherRtNames = otherLinkedIds.map(id => {
                  const rt = roomTypes?.find(r => r.id === id);
                  return rt?.customName || rt?.name || "Unknown";
                });
                return (
                  <div
                    key={pkg.id}
                    className={cn(
                      "flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors",
                      isLinked ? "bg-violet-50 border-violet-300" : "bg-white border-slate-200 hover:border-violet-300"
                    )}
                    data-testid={`plan-assign-row-${pkg.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-800 truncate">{pkg.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">Tier {pkg.tierLevel ?? 0}</Badge>
                        {isRoomLinked && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700 border-0 shrink-0">
                            <Check className="w-2.5 h-2.5 mr-0.5" />This Room
                          </Badge>
                        )}
                        {isTypeLinked && !isRoomLinked && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-500 border-0 shrink-0">
                            All {planAssignRoomTypeName}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">₹{Number(pkg.basePrice).toLocaleString("en-IN")}</span>
                        {otherRtNames.length > 0 && (
                          <span className="text-[10px] text-slate-400">
                            Also linked to {otherRtNames.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex gap-1">
                      {isRoomLinked ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => assignPlanMutation.mutate({ packageId: pkg.id, unlinkRoomId: planAssignRoomId })}
                          disabled={assignPlanMutation.isPending}
                          data-testid={`button-unlink-plan-${pkg.id}`}
                        >
                          <X className="w-3 h-3" />Unlink
                        </Button>
                      ) : isTypeLinked ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => assignPlanMutation.mutate({ packageId: pkg.id, unlinkRoomTypeId: planAssignRoomTypeId })}
                          disabled={assignPlanMutation.isPending}
                          data-testid={`button-unlink-plan-${pkg.id}`}
                        >
                          <X className="w-3 h-3" />Unlink All
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-violet-600 border-violet-200 hover:bg-violet-50"
                            onClick={() => planAssignRoomId ? assignPlanMutation.mutate({ packageId: pkg.id, linkRoomId: planAssignRoomId }) : assignPlanMutation.mutate({ packageId: pkg.id, linkRoomTypeId: planAssignRoomTypeId })}
                            disabled={assignPlanMutation.isPending}
                            data-testid={`button-link-plan-${pkg.id}`}
                          >
                            <Tag className="w-3 h-3" />This Room
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-slate-500 border-slate-200 hover:bg-slate-50"
                            onClick={() => assignPlanMutation.mutate({ packageId: pkg.id, linkRoomTypeId: planAssignRoomTypeId })}
                            disabled={assignPlanMutation.isPending}
                            data-testid={`button-link-all-${pkg.id}`}
                          >
                            All {planAssignRoomTypeName}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                No active plans found for this property.
                <br />
                <span className="text-xs">Create plans in the Packages page first.</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoomCard({ room, roomTypes, onDeleteRoom, onUpdateBed, onDeleteBed, onBlockBed, onUnblockBed, linkedPlans, onAssignPlan }: {
  room: Room; roomTypes: RoomType[];
  onDeleteRoom: () => void;
  onUpdateBed: (bedId: string, status: string) => void;
  onDeleteBed: (bedId: string) => void;
  onBlockBed: (bedId: string, reason: string, category: string) => void;
  onUnblockBed: (bedId: string, note?: string) => void;
  linkedPlans?: any[];
  onAssignPlan?: (roomTypeId: string, roomTypeName: string, roomId?: string, roomNumber?: string) => void;
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

  const plansForThisRoom = linkedPlans?.filter((p: any) => {
    const allLinkedRoomIds: string[] = Array.isArray(p.linkedRoomIds) ? p.linkedRoomIds : [];
    if (allLinkedRoomIds.length > 0) {
      return allLinkedRoomIds.includes(room.id);
    }
    const allLinkedIds: string[] = Array.isArray(p.linkedRoomTypeIds) ? p.linkedRoomTypeIds : (p.roomTypeId ? [p.roomTypeId] : []);
    return allLinkedIds.includes(room.roomTypeId);
  }) || [];

  return (
    <div className={cn("border rounded-lg p-3 transition-colors", roomStatusColor)} data-testid={`room-card-${room.id}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
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
          {plansForThisRoom.length > 0 ? (
            plansForThisRoom.map((p: any) => (
              <Badge key={p.id} className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700 border-violet-200 gap-0.5 cursor-pointer hover:bg-violet-200"
                onClick={() => onAssignPlan?.(room.roomTypeId, rt?.customName || rt?.name || "Room Type", room.id, room.roomNumber)}
                data-testid={`badge-plan-${p.id}`}
              >
                <Package className="w-2.5 h-2.5" />{p.name}
              </Badge>
            ))
          ) : (
            <button
              className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-violet-600 transition-colors border border-dashed border-slate-300 hover:border-violet-400 rounded px-1.5 py-0.5"
              onClick={() => onAssignPlan?.(room.roomTypeId, rt?.customName || rt?.name || "Room Type", room.id, room.roomNumber)}
              data-testid={`button-assign-plan-${room.id}`}
            >
              <Tag className="w-2.5 h-2.5" />Assign Plan
            </button>
          )}
        </div>
        <Button size="sm" variant="ghost" className="text-rose-500 hover:text-rose-700 h-6 w-6 p-0 shrink-0" onClick={onDeleteRoom} data-testid={`button-delete-room-${room.id}`}>
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
