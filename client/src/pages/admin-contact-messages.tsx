import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail, Phone, Clock, User, MessageSquare, CheckCircle2,
  Archive, Eye, Search, Inbox, UserPlus, Loader2, UserCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { ContactMessage } from "@shared/schema";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Mail }> = {
  new: { label: "New", color: "bg-blue-50 text-blue-700 border-blue-200", icon: Mail },
  read: { label: "Read", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Eye },
  replied: { label: "Replied", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  archived: { label: "Archived", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Archive },
};

interface SalesExec { id: string; name: string; email: string; }
interface Property { id: string; name: string; slug: string; }

interface ConvertForm {
  name: string;
  phone: string;
  email: string;
  notes: string;
  assignedToId: string;
  propertyId: string;
}

export default function AdminContactMessages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [convertMsg, setConvertMsg] = useState<ContactMessage | null>(null);
  const [convertForm, setConvertForm] = useState<ConvertForm>({
    name: "", phone: "", email: "", notes: "", assignedToId: "", propertyId: "",
  });

  const { data, isLoading } = useQuery<{ messages: ContactMessage[]; unreadCount: number }>({
    queryKey: ["/api/admin/contact-messages"],
    queryFn: async () => {
      const res = await fetch("/api/admin/contact-messages", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allUsers = [] } = useQuery<SalesExec[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const users = await res.json();
      return users.filter((u: any) => u.role === "sales_executive");
    },
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    queryFn: async () => {
      const res = await fetch("/api/properties");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/contact-messages/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-messages"] });
      toast({ title: "Status updated" });
    },
  });

  const convertToLeadMutation = useMutation({
    mutationFn: async ({ form, msgId }: { form: ConvertForm; msgId: string }) => {
      // 1. Create the lead
      const leadRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          notes: form.notes || undefined,
          assignedToId: form.assignedToId || undefined,
          propertyId: form.propertyId || undefined,
          source: "website",
          isManualEntry: true,
        }),
      });
      if (!leadRes.ok) {
        const err = await leadRes.json();
        throw new Error(err.error || "Failed to create lead");
      }
      const lead = await leadRes.json();

      // 2. Mark the contact message as converted
      const execName = form.assignedToId
        ? (allUsers.find(u => u.id === form.assignedToId)?.name || "")
        : "";
      await fetch(`/api/admin/contact-messages/${msgId}/convert`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ leadId: lead.id || lead.lead?.id || msgId, execName }),
      });

      return { lead, execName };
    },
    onSuccess: ({ execName }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-messages"] });
      toast({
        title: "Lead created",
        description: execName
          ? `Assigned to ${execName}.`
          : "Lead added without assignment.",
      });
      setConvertMsg(null);
    },
    onError: (e: Error) => {
      toast({ title: "Failed to create lead", description: e.message, variant: "destructive" });
    },
  });

  const openConvert = (msg: ContactMessage) => {
    setConvertForm({
      name: msg.name,
      phone: msg.phone || "",
      email: msg.email,
      notes: msg.message,
      assignedToId: "",
      propertyId: "",
    });
    setConvertMsg(msg);
  };

  const messages = data?.messages || [];
  const filtered = messages.filter(m => {
    if (filterStatus !== "all" && m.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.message.toLowerCase().includes(q) || (m.phone && m.phone.includes(q));
    }
    return true;
  });

  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="space-y-6 p-6" data-testid="admin-contact-messages">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2" data-testid="page-title">
            <MessageSquare className="w-6 h-6 text-amber-500" />
            Contact Messages
            {unreadCount > 0 && (
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 ml-2" data-testid="unread-count">
                {unreadCount} new
              </Badge>
            )}
          </h1>
          <p className="text-slate-500 text-sm mt-1">Messages from the contact form on your website</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, email, or message..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-white border-slate-200 text-slate-900"
            data-testid="search-messages"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "new", "read", "replied", "archived"].map(s => (
            <Button
              key={s}
              size="sm"
              variant={filterStatus === s ? "default" : "outline"}
              onClick={() => setFilterStatus(s)}
              className={filterStatus === s ? "bg-amber-600 hover:bg-amber-700 text-white" : "border-slate-200 text-slate-600 hover:text-slate-900"}
              data-testid={`filter-${s}`}
            >
              {s === "all" ? "All" : statusConfig[s]?.label || s}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-500 py-12">Loading messages...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-white border-slate-200">
          <CardContent className="py-16 text-center">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No messages found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(msg => {
            const cfg = statusConfig[msg.status] || statusConfig.new;
            const StatusIcon = cfg.icon;
            const isConverted = !!msg.convertedToLeadId;
            return (
              <Card key={msg.id} className={`bg-white border-slate-200 hover:shadow-sm transition-shadow ${msg.status === "new" ? "border-l-4 border-l-blue-500" : ""}`} data-testid={`message-card-${msg.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="text-slate-900 font-semibold text-sm" data-testid={`message-name-${msg.id}`}>{msg.name}</h3>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              <a href={`mailto:${msg.email}`} className="hover:text-amber-600">{msg.email}</a>
                            </span>
                            {msg.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                <a href={`tel:${msg.phone}`} className="hover:text-amber-600">{msg.phone}</a>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-700 text-sm mt-2 whitespace-pre-wrap" data-testid={`message-text-${msg.id}`}>{msg.message}</p>
                      <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {new Date(msg.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge className={`${cfg.color} border text-[11px]`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {cfg.label}
                      </Badge>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {msg.status === "new" && (
                          <Button size="sm" variant="ghost" className="text-xs text-slate-600 hover:text-slate-900 h-7 px-2"
                            onClick={() => updateStatusMutation.mutate({ id: msg.id, status: "read" })}
                            data-testid={`mark-read-${msg.id}`}>
                            <Eye className="w-3 h-3 mr-1" /> Read
                          </Button>
                        )}
                        {(msg.status === "new" || msg.status === "read") && (
                          <Button size="sm" variant="ghost" className="text-xs text-emerald-600 hover:text-emerald-700 h-7 px-2"
                            onClick={() => updateStatusMutation.mutate({ id: msg.id, status: "replied" })}
                            data-testid={`mark-replied-${msg.id}`}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Replied
                          </Button>
                        )}

                        {isConverted ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded px-2 h-7 font-medium"
                            data-testid={`lead-assigned-${msg.id}`}
                          >
                            <UserCheck className="w-3 h-3" />
                            {msg.convertedExecName ? `Assigned to ${msg.convertedExecName}` : "Assigned as Lead"}
                          </span>
                        ) : (
                          <Button size="sm" variant="ghost"
                            className="text-xs text-violet-600 hover:text-violet-700 h-7 px-2"
                            onClick={() => openConvert(msg)}
                            data-testid={`convert-lead-${msg.id}`}>
                            <UserPlus className="w-3 h-3 mr-1" /> Assign as Lead
                          </Button>
                        )}

                        {msg.status !== "archived" && (
                          <Button size="sm" variant="ghost" className="text-xs text-slate-500 hover:text-slate-700 h-7 px-2"
                            onClick={() => updateStatusMutation.mutate({ id: msg.id, status: "archived" })}
                            data-testid={`archive-${msg.id}`}>
                            <Archive className="w-3 h-3 mr-1" /> Archive
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Convert to Lead Dialog */}
      <Dialog open={!!convertMsg} onOpenChange={open => !open && setConvertMsg(null)}>
        <DialogContent className="sm:max-w-md" data-testid="convert-lead-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <UserPlus className="w-5 h-5 text-violet-600" />
              Assign as Lead
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Name</Label>
                <Input
                  value={convertForm.name}
                  onChange={e => setConvertForm(f => ({ ...f, name: e.target.value }))}
                  className="h-8 text-sm"
                  data-testid="lead-name-input"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Phone</Label>
                <Input
                  value={convertForm.phone}
                  onChange={e => setConvertForm(f => ({ ...f, phone: e.target.value }))}
                  className="h-8 text-sm"
                  placeholder="Phone number"
                  data-testid="lead-phone-input"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Email</Label>
              <Input
                value={convertForm.email}
                onChange={e => setConvertForm(f => ({ ...f, email: e.target.value }))}
                className="h-8 text-sm"
                data-testid="lead-email-input"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Assign to Sales Executive</Label>
              <Select
                value={convertForm.assignedToId}
                onValueChange={v => setConvertForm(f => ({ ...f, assignedToId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="h-8 text-sm" data-testid="lead-exec-select">
                  <SelectValue placeholder="Select sales executive…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Unassigned —</SelectItem>
                  {allUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Property (optional)</Label>
              <Select
                value={convertForm.propertyId}
                onValueChange={v => setConvertForm(f => ({ ...f, propertyId: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="h-8 text-sm" data-testid="lead-property-select">
                  <SelectValue placeholder="Select property…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {properties.map((p: Property) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Notes</Label>
              <Textarea
                value={convertForm.notes}
                onChange={e => setConvertForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="text-sm resize-none"
                data-testid="lead-notes-input"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConvertMsg(null)} data-testid="cancel-convert">
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white"
              disabled={!convertForm.name || !convertForm.phone || convertToLeadMutation.isPending}
              onClick={() => convertMsg && convertToLeadMutation.mutate({ form: convertForm, msgId: convertMsg.id })}
              data-testid="confirm-convert-lead"
            >
              {convertToLeadMutation.isPending ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Creating…</>
              ) : (
                <><UserPlus className="w-3 h-3 mr-1" /> Create Lead</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
