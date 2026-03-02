import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Building2, Link2, Unlink, RefreshCw, Loader2, CheckCircle2,
  AlertCircle, ExternalLink, Search, Shield
} from "lucide-react";

interface Property {
  id: string;
  name: string;
  propertyCode: string | null;
  hmsPropertyId: number | null;
  hmsPropertyName: string | null;
  hmsLinked: boolean;
  city: string;
  status: string;
}

interface HmsProperty {
  id: number;
  name: string;
  propertyCode?: string;
}

export default function AdminHmsSync() {
  const { token } = useAuth();
  const { toast } = useToast();

  const [properties, setProperties] = useState<Property[]>([]);
  const [hmsProperties, setHmsProperties] = useState<HmsProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [hmsLoading, setHmsLoading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedHmsId, setSelectedHmsId] = useState<string>("");
  const [selectedHmsName, setSelectedHmsName] = useState<string>("");
  const [propertyCode, setPropertyCode] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, any>>({});

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/properties", { headers });
      if (res.ok) {
        const data = await res.json();
        setProperties(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
  };

  const fetchHmsProperties = async () => {
    setHmsLoading(true);
    try {
      const res = await fetch("/api/admin/hms/properties", { headers });
      if (res.ok) {
        const data = await res.json();
        setHmsProperties(Array.isArray(data) ? data : []);
      } else {
        toast({ title: "Failed to fetch HMS properties", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error connecting to HMS", variant: "destructive" });
    }
    setHmsLoading(false);
  };

  useEffect(() => { fetchProperties(); }, []);

  const openLinkDialog = (property: Property) => {
    setSelectedProperty(property);
    setPropertyCode(property.propertyCode || "");
    setSelectedHmsId(property.hmsPropertyId?.toString() || "");
    setSelectedHmsName(property.hmsPropertyName || "");
    setLinkDialogOpen(true);
    if (hmsProperties.length === 0) fetchHmsProperties();
  };

  const handleLink = async () => {
    if (!selectedProperty || !selectedHmsId) return;
    setActionLoading(selectedProperty.id);
    try {
      const hms = hmsProperties.find(h => h.id === Number(selectedHmsId));
      const res = await fetch(`/api/admin/properties/${selectedProperty.id}/link-hms`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          hmsPropertyId: Number(selectedHmsId),
          hmsPropertyName: hms?.name || selectedHmsName,
          propertyCode: propertyCode || null,
        }),
      });
      if (res.ok) {
        toast({ title: "Property linked to HMS" });
        setLinkDialogOpen(false);
        fetchProperties();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Failed to link", description: err.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleUnlink = async (property: Property) => {
    setActionLoading(property.id);
    try {
      const res = await fetch(`/api/admin/properties/${property.id}/unlink-hms`, {
        method: "POST",
        headers,
      });
      if (res.ok) {
        toast({ title: "Property unlinked from HMS" });
        fetchProperties();
      } else {
        toast({ title: "Failed to unlink", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error unlinking", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const handleVerify = async (property: Property) => {
    setActionLoading(`verify-${property.id}`);
    try {
      const res = await fetch(`/api/admin/properties/${property.id}/verify-hms`, { headers });
      if (res.ok) {
        const data = await res.json();
        setVerifyResults(prev => ({ ...prev, [property.id]: data }));
        toast({ title: data.linked ? "HMS link verified" : "HMS link not found" });
      } else {
        toast({ title: "Verification failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error verifying", variant: "destructive" });
    }
    setActionLoading(null);
  };

  const linkedProperties = properties.filter(p => p.hmsLinked);
  const unlinkedProperties = properties.filter(p => !p.hmsLinked);

  return (
    <div className="space-y-6" data-testid="page-hms-sync">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2" data-testid="text-page-title">
            <Link2 className="h-7 w-7 text-indigo-600" />
            HMS Property Sync
          </h1>
          <p className="text-slate-500 mt-1">Link your properties to the external Hostel Management System for season close sync</p>
        </div>
        <Button onClick={fetchHmsProperties} disabled={hmsLoading} variant="outline" data-testid="button-refresh-hms">
          {hmsLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Refresh HMS
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-properties">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100">
              <Building2 className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{properties.length}</p>
              <p className="text-sm text-slate-500">Total Properties</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-linked-count">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{linkedProperties.length}</p>
              <p className="text-sm text-slate-500">HMS Linked</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-unlinked-count">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{unlinkedProperties.length}</p>
              <p className="text-sm text-slate-500">Not Linked</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {linkedProperties.length > 0 && (
        <Card data-testid="card-linked-properties">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Linked Properties ({linkedProperties.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {linkedProperties.map(property => (
                <div key={property.id} className="flex items-center justify-between p-4 border rounded-lg bg-emerald-50/50" data-testid={`row-linked-${property.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-emerald-100">
                      <Building2 className="h-5 w-5 text-emerald-700" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{property.name}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        {property.propertyCode && (
                          <Badge variant="outline" className="text-xs">{property.propertyCode}</Badge>
                        )}
                        <span className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          HMS: {property.hmsPropertyName} (ID: {property.hmsPropertyId})
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {verifyResults[property.id] && (
                      <Badge className={verifyResults[property.id].linked ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>
                        {verifyResults[property.id].linked ? "Verified" : "Not Found"}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerify(property)}
                      disabled={actionLoading === `verify-${property.id}`}
                      data-testid={`button-verify-${property.id}`}
                    >
                      {actionLoading === `verify-${property.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openLinkDialog(property)}
                      data-testid={`button-relink-${property.id}`}
                    >
                      <Link2 className="h-3.5 w-3.5 mr-1" /> Re-link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleUnlink(property)}
                      disabled={actionLoading === property.id}
                      data-testid={`button-unlink-${property.id}`}
                    >
                      {actionLoading === property.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5 mr-1" />}
                      Unlink
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {unlinkedProperties.length > 0 && (
        <Card data-testid="card-unlinked-properties">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Unlinked Properties ({unlinkedProperties.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unlinkedProperties.map(property => (
                <div key={property.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`row-unlinked-${property.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-slate-100">
                      <Building2 className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{property.name}</h4>
                      <p className="text-sm text-slate-500">{property.city}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openLinkDialog(property)}
                    className="bg-indigo-600 hover:bg-indigo-700"
                    data-testid={`button-link-${property.id}`}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1" /> Link to HMS
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )}

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-link-hms">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-indigo-600" />
              Link to HMS — {selectedProperty?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Property Code</Label>
              <Input
                value={propertyCode}
                onChange={e => setPropertyCode(e.target.value)}
                placeholder="e.g., JUHU"
                data-testid="input-property-code"
              />
              <p className="text-xs text-muted-foreground">Optional code used for matching with HMS</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>HMS Property</Label>
                <Button size="sm" variant="ghost" onClick={fetchHmsProperties} disabled={hmsLoading} data-testid="button-fetch-hms">
                  {hmsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </Button>
              </div>
              {hmsProperties.length > 0 ? (
                <Select value={selectedHmsId} onValueChange={v => {
                  setSelectedHmsId(v);
                  const hms = hmsProperties.find(h => h.id === Number(v));
                  if (hms) setSelectedHmsName(hms.name);
                }}>
                  <SelectTrigger data-testid="select-hms-property">
                    <SelectValue placeholder="Select HMS property" />
                  </SelectTrigger>
                  <SelectContent>
                    {hmsProperties.map(h => (
                      <SelectItem key={h.id} value={h.id.toString()}>
                        {h.name} (ID: {h.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-slate-500 p-3 border rounded-lg bg-slate-50 text-center">
                  {hmsLoading ? "Loading HMS properties..." : "Click refresh to load HMS properties"}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)} data-testid="button-cancel-link">Cancel</Button>
            <Button
              onClick={handleLink}
              disabled={!selectedHmsId || actionLoading === selectedProperty?.id}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-confirm-link"
            >
              {actionLoading === selectedProperty?.id && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Link Property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
