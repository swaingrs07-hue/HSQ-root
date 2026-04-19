import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Mail, Phone, Clock, User, MessageSquare, CheckCircle2,
  Archive, Eye, Search, Inbox
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

export default function AdminContactMessages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = JSON.parse(localStorage.getItem("hsquare_auth") || "{}").token;
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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
        <div className="flex gap-2">
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
                      <div className="flex gap-1">
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
    </div>
  );
}
