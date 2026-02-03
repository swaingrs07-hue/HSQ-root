import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { 
  Search, 
  Filter, 
  Download, 
  Eye,
  ChevronLeft,
  ChevronRight,
  FileText,
  Activity,
  User,
  Building,
  Clock,
  ArrowRight
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const ACTION_TYPES = [
  "CREATE", "UPDATE", "DELETE", "DEACTIVATE", "ACTIVATE", 
  "ASSIGN", "UNASSIGN", "REASSIGN", "LOGIN", "LOGOUT",
  "STAGE_CHANGE", "STATUS_CHANGE"
];

const ENTITY_TYPES = [
  "USER", "SALES_EXECUTIVE", "LEAD", "REQUEST", 
  "PROPERTY", "BOOKING", "ROOM_TYPE", "PAYMENT"
];

function getActionBadgeStyle(actionType: string): string {
  switch (actionType) {
    case "CREATE": return "bg-green-100 text-green-800 border-green-200";
    case "UPDATE": return "bg-blue-100 text-blue-800 border-blue-200";
    case "DELETE": return "bg-red-100 text-red-800 border-red-200";
    case "DEACTIVATE": return "bg-orange-100 text-orange-800 border-orange-200";
    case "ACTIVATE": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "ASSIGN": return "bg-purple-100 text-purple-800 border-purple-200";
    case "UNASSIGN": return "bg-gray-100 text-gray-800 border-gray-200";
    case "REASSIGN": return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "STAGE_CHANGE": return "bg-cyan-100 text-cyan-800 border-cyan-200";
    case "STATUS_CHANGE": return "bg-amber-100 text-amber-800 border-amber-200";
    case "LOGIN": return "bg-teal-100 text-teal-800 border-teal-200";
    case "LOGOUT": return "bg-slate-100 text-slate-800 border-slate-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case "USER":
    case "SALES_EXECUTIVE":
      return <User className="w-4 h-4" />;
    case "PROPERTY":
      return <Building className="w-4 h-4" />;
    case "LEAD":
    case "REQUEST":
      return <FileText className="w-4 h-4" />;
    default:
      return <Activity className="w-4 h-4" />;
  }
}

interface ActivityLog {
  id: string;
  actorUserId: string | null;
  actorName: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  propertyId: string | null;
  propertyName: string | null;
  metadataJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  formattedMessage: string;
}

interface Actor {
  id: string;
  name: string;
  role: string;
}

function ActivityDetailDrawer({ log }: { log: ActivityLog }) {
  const metadata = log.metadataJson ? JSON.parse(log.metadataJson) : null;
  
  return (
    <div className="space-y-6 p-2">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className={`${getActionBadgeStyle(log.actionType)} border`}>
            {log.actionType}
          </Badge>
          <span className="text-sm text-gray-500">{log.entityType}</span>
        </div>
        
        <p className="text-base font-medium">{log.formattedMessage}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Time</Label>
          <p className="text-sm font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {format(new Date(log.createdAt), "PPpp")}
          </p>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Actor</Label>
          <p className="text-sm font-medium flex items-center gap-1">
            <User className="w-3 h-3" />
            {log.actorName} ({log.actorRole})
          </p>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Entity</Label>
          <p className="text-sm font-medium flex items-center gap-1">
            {getEntityIcon(log.entityType)}
            {log.entityLabel}
          </p>
        </div>
        
        {log.propertyName && (
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Property</Label>
            <p className="text-sm font-medium flex items-center gap-1">
              <Building className="w-3 h-3" />
              {log.propertyName}
            </p>
          </div>
        )}
      </div>

      {metadata && Object.keys(metadata).length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Details</Label>
          <Card className="bg-gray-50">
            <CardContent className="p-4">
              <div className="space-y-2">
                {Object.entries(metadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-600 capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {log.ipAddress && (
        <div className="space-y-2">
          <Label className="text-xs text-gray-500">Technical Info</Label>
          <div className="text-xs text-gray-500 space-y-1">
            <p>IP: {log.ipAddress}</p>
            {log.userAgent && (
              <p className="truncate" title={log.userAgent}>
                User Agent: {log.userAgent.slice(0, 50)}...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminActivityLogs() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState<string>("all");
  const [entityType, setEntityType] = useState<string>("all");
  const [actorId, setActorId] = useState<string>("all");
  const [propertyId, setPropertyId] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const limit = 20;

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (actionType !== "all") params.set("actionType", actionType);
    if (entityType !== "all") params.set("entityType", entityType);
    if (actorId !== "all") params.set("actorUserId", actorId);
    if (propertyId !== "all") params.set("propertyId", propertyId);
    if (startDate) params.set("startDate", new Date(startDate).toISOString());
    if (endDate) params.set("endDate", new Date(endDate).toISOString());
    params.set("limit", String(limit));
    params.set("offset", String(page * limit));
    return params.toString();
  };

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["activity-logs", search, actionType, entityType, actorId, propertyId, startDate, endDate, page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/activity-logs?${buildQueryParams()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    }
  });

  const { data: actors } = useQuery<Actor[]>({
    queryKey: ["activity-log-actors"],
    queryFn: async () => {
      const res = await fetch("/api/admin/activity-logs/actors/list", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch actors");
      return res.json();
    }
  });

  const { data: properties } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["properties-list"],
    queryFn: async () => {
      const res = await fetch("/api/properties", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch properties");
      return res.json();
    }
  });

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (actionType !== "all") params.set("actionType", actionType);
    if (entityType !== "all") params.set("entityType", entityType);
    if (actorId !== "all") params.set("actorUserId", actorId);
    if (propertyId !== "all") params.set("propertyId", propertyId);
    if (startDate) params.set("startDate", new Date(startDate).toISOString());
    if (endDate) params.set("endDate", new Date(endDate).toISOString());
    
    window.open(`/api/admin/activity-logs/export/csv?${params.toString()}`, "_blank");
  };

  const logs = logsData?.logs || [];
  const total = logsData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const clearFilters = () => {
    setSearch("");
    setActionType("all");
    setEntityType("all");
    setActorId("all");
    setPropertyId("all");
    setStartDate("");
    setEndDate("");
    setPage(0);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
            <p className="text-sm text-gray-500 mt-1">Track all actions and changes across the system</p>
          </div>
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <CardTitle className="text-base">Filters</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto text-xs">
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="lg:col-span-2">
                <Label className="text-xs text-gray-500">Search</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, entity..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Action Type</Label>
                <Select value={actionType} onValueChange={(v) => { setActionType(v); setPage(0); }}>
                  <SelectTrigger className="mt-1" data-testid="select-action-type">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {ACTION_TYPES.map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Entity Type</Label>
                <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(0); }}>
                  <SelectTrigger className="mt-1" data-testid="select-entity-type">
                    <SelectValue placeholder="All Entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    {ENTITY_TYPES.map(e => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Actor</Label>
                <Select value={actorId} onValueChange={(v) => { setActorId(v); setPage(0); }}>
                  <SelectTrigger className="mt-1" data-testid="select-actor">
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {actors?.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Property</Label>
                <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setPage(0); }}>
                  <SelectTrigger className="mt-1" data-testid="select-property">
                    <SelectValue placeholder="All Properties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                  className="mt-1"
                  data-testid="input-start-date"
                />
              </div>

              <div>
                <Label className="text-xs text-gray-500">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                  className="mt-1"
                  data-testid="input-end-date"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actor</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Entity</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Details</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Property</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">View</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="py-3 px-4">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500">
                        <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        No activity logs found
                      </td>
                    </tr>
                  ) : (
                    logs.map((log: ActivityLog) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50 transition-colors" data-testid={`row-activity-${log.id}`}>
                        <td className="py-3 px-4 text-sm text-gray-600 whitespace-nowrap">
                          {format(new Date(log.createdAt), "MMM d, HH:mm")}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{log.actorName}</p>
                              <p className="text-xs text-gray-500">{log.actorRole}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={`${getActionBadgeStyle(log.actionType)} border text-xs`}>
                            {log.actionType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getEntityIcon(log.entityType)}
                            <div>
                              <p className="text-sm font-medium text-gray-900">{log.entityLabel}</p>
                              <p className="text-xs text-gray-500">{log.entityType}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate" title={log.formattedMessage}>
                          {log.formattedMessage}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {log.propertyName || "-"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Sheet open={drawerOpen && selectedLog?.id === log.id} onOpenChange={(open) => {
                            setDrawerOpen(open);
                            if (!open) setSelectedLog(null);
                          }}>
                            <SheetTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSelectedLog(log); setDrawerOpen(true); }}
                                data-testid={`button-view-${log.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </SheetTrigger>
                            <SheetContent className="w-[400px] sm:w-[500px]">
                              <SheetHeader>
                                <SheetTitle>Activity Details</SheetTitle>
                              </SheetHeader>
                              <ScrollArea className="h-[calc(100vh-100px)] pr-4">
                                {selectedLog && <ActivityDetailDrawer log={selectedLog} />}
                              </ScrollArea>
                            </SheetContent>
                          </Sheet>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!logsLoading && logs.length > 0 && (
              <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                <p className="text-sm text-gray-600">
                  Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total} logs
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
