import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  Settings2,
  BookOpen,
  MessageSquare,
  Shield,
  UserCheck,
  BarChart3,
  Plus,
  Trash2,
  Edit2,
  Save,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  FileText,
  Users,
  TrendingUp,
  Power,
  Phone,
  Mail,
  User,
  Building2,
  IndianRupee,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

type ChatbotSettings = {
  id: string;
  enabled: boolean;
  botName: string;
  greetingMessage: string;
  tone: string;
  defaultLanguage: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  outsideHoursMessage: string;
  leadCaptureEnabled: boolean;
  requiredFields: string[];
  optionalFields: string[];
  escalationTriggers: string[];
  escalationEmail: string | null;
  maxMessagesBeforeEscalation: number;
  blockedKeywords: string[];
  updatedAt: string;
};

type CapturedLead = {
  id: string;
  createdAt: string;
  leadId: string;
  name: string;
  email?: string;
  phone?: string;
  propertyId?: string;
  budgetMin?: number;
  budgetMax?: number;
  message?: string;
};

type KnowledgeEntry = {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
  status: "draft" | "published";
  priority: number;
  createdAt: string;
  updatedAt: string;
};

type Conversation = {
  id: string;
  sessionId: string;
  visitorName: string | null;
  visitorEmail: string | null;
  visitorPhone: string | null;
  device: string;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  outcome: string | null;
  flagStatus: string | null;
  propertyId: string | null;
};

export default function AdminChatbot() {
  const [activeTab, setActiveTab] = useState("overview");
  const [editingSettings, setEditingSettings] = useState<Partial<ChatbotSettings>>({});
  const [newKnowledge, setNewKnowledge] = useState<Partial<KnowledgeEntry>>({});
  const [showKnowledgeForm, setShowKnowledgeForm] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getAuthToken = () => {
    try {
      const auth = JSON.parse(localStorage.getItem("hsquare_auth") || "{}");
      return auth.token || "";
    } catch {
      return "";
    }
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json();
  };

  const { data: settings, isLoading: settingsLoading } = useQuery<ChatbotSettings>({
    queryKey: ["/api/admin/chatbot/settings"],
    queryFn: () => authFetch("/api/admin/chatbot/settings"),
  });

  const { data: stats } = useQuery<{
    conversationsToday: number;
    leadsToday: number;
    escalationsToday: number;
    avgResponseTime: string;
  }>({
    queryKey: ["/api/admin/chatbot/stats"],
    queryFn: () => authFetch("/api/admin/chatbot/stats"),
  });

  const { data: knowledge = [] } = useQuery<KnowledgeEntry[]>({
    queryKey: ["/api/admin/chatbot/knowledge"],
    queryFn: () => authFetch("/api/admin/chatbot/knowledge"),
  });

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/admin/chatbot/conversations"],
    queryFn: () => authFetch("/api/admin/chatbot/conversations"),
  });

  const { data: capturedLeads = [], isLoading: leadsLoading } = useQuery<CapturedLead[]>({
    queryKey: ["/api/admin/chatbot/captured-leads"],
    queryFn: () => authFetch("/api/admin/chatbot/captured-leads"),
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return authFetch("/api/admin/chatbot/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/settings"] });
      toast({ title: settings?.enabled ? "Chatbot disabled" : "Chatbot enabled" });
    },
    onError: () => toast({ title: "Failed to toggle chatbot", variant: "destructive" }),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<ChatbotSettings>) => {
      return authFetch("/api/admin/chatbot/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/settings"] });
      setEditingSettings({});
      toast({ title: "Settings saved successfully" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const createKnowledgeMutation = useMutation({
    mutationFn: async (data: Partial<KnowledgeEntry>) => {
      return authFetch("/api/admin/chatbot/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/knowledge"] });
      setShowKnowledgeForm(false);
      setNewKnowledge({});
      toast({ title: "Knowledge entry created" });
    },
    onError: () => toast({ title: "Failed to create entry", variant: "destructive" }),
  });

  const deleteKnowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      return authFetch(`/api/admin/chatbot/knowledge/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chatbot/knowledge"] });
      toast({ title: "Entry deleted" });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  const handleTestChatbot = async () => {
    if (!testMessage.trim()) return;
    setTestLoading(true);
    try {
      const data = await authFetch("/api/admin/chatbot/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMessage }),
      });
      setTestResponse(data.response);
      setTestMessage("");
    } catch {
      toast({ title: "Test failed", variant: "destructive" });
    } finally {
      setTestLoading(false);
    }
  };

  if (settingsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Chatbot Control Panel</h1>
            <p className="text-muted-foreground">Manage H Orbit behavior, knowledge, and conversations</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Chatbot Status</span>
            <Switch
              data-testid="switch-chatbot-toggle"
              checked={settings?.enabled ?? false}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
            <Badge variant={settings?.enabled ? "default" : "secondary"} className={settings?.enabled ? "bg-green-500" : ""}>
              {settings?.enabled ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="stat-conversations-today">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-conversations-count">{stats?.conversationsToday ?? 0}</p>
                <p className="text-sm text-muted-foreground">Conversations Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-leads-today">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-leads-count">{stats?.leadsToday ?? 0}</p>
                <p className="text-sm text-muted-foreground">Leads Captured</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-escalations-today">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-escalations-count">{stats?.escalationsToday ?? 0}</p>
                <p className="text-sm text-muted-foreground">Escalations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-response-time">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-response-time">{stats?.avgResponseTime ?? "< 2s"}</p>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-2" data-testid="tab-behavior">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Behavior</span>
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2" data-testid="tab-leads">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Lead Capture</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-2" data-testid="tab-knowledge">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Knowledge</span>
          </TabsTrigger>
          <TabsTrigger value="handoff" className="gap-2" data-testid="tab-handoff">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Handoff</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2" data-testid="tab-logs">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Chat Logs</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2" data-testid="tab-security">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Power className="h-5 w-5" />
                  Quick Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div data-testid="status-chatbot-engine" className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${settings?.enabled ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
                    <span className="font-medium">Chatbot Engine</span>
                  </div>
                  <span data-testid="text-engine-status" className={settings?.enabled ? "text-green-600" : "text-gray-500"}>
                    {settings?.enabled ? "Running" : "Stopped"}
                  </span>
                </div>
                <div data-testid="status-ai-model" className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="font-medium">AI Model</span>
                  </div>
                  <span data-testid="text-model-status" className="text-green-600">GPT-4o Connected</span>
                </div>
                <div data-testid="status-lead-capture" className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${settings?.leadCaptureEnabled ? "bg-green-500" : "bg-gray-400"}`} />
                    <span className="font-medium">Lead Capture</span>
                  </div>
                  <span data-testid="text-lead-capture-status" className={settings?.leadCaptureEnabled ? "text-green-600" : "text-gray-500"}>
                    {settings?.leadCaptureEnabled ? "Active" : "Disabled"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Test Chatbot
                </CardTitle>
                <CardDescription>Send a test message to see how the bot responds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {testResponse && (
                  <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                    <p className="text-sm text-purple-800">{testResponse}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    data-testid="input-test-message"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Type a test message..."
                    onKeyPress={(e) => e.key === "Enter" && handleTestChatbot()}
                  />
                  <Button
                    data-testid="button-send-test"
                    onClick={handleTestChatbot}
                    disabled={testLoading || !testMessage.trim()}
                  >
                    {testLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {conversations.slice(0, 5).map((conv) => (
                  <div key={conv.id} data-testid={`recent-activity-${conv.id}`} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                        <MessageSquare className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium" data-testid={`text-visitor-name-${conv.id}`}>{conv.visitorName || "Anonymous Visitor"}</p>
                        <p className="text-xs text-muted-foreground" data-testid={`text-message-count-${conv.id}`}>{conv.messageCount} messages</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs" data-testid={`badge-outcome-${conv.id}`}>
                        {conv.outcome || "ongoing"}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1" data-testid={`text-timestamp-${conv.id}`}>
                        {format(new Date(conv.startedAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No conversations yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bot Personality & Behavior</CardTitle>
              <CardDescription>Configure how H Orbit interacts with visitors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="botName">Bot Name</Label>
                  <Input
                    id="botName"
                    data-testid="input-bot-name"
                    value={editingSettings.botName ?? settings?.botName ?? ""}
                    onChange={(e) => setEditingSettings({ ...editingSettings, botName: e.target.value })}
                    placeholder="H Orbit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tone">Conversation Tone</Label>
                  <Select
                    value={editingSettings.tone ?? settings?.tone ?? "friendly"}
                    onValueChange={(value) => setEditingSettings({ ...editingSettings, tone: value })}
                  >
                    <SelectTrigger data-testid="select-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly & Casual</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="formal">Formal & Corporate</SelectItem>
                      <SelectItem value="enthusiastic">Enthusiastic & Energetic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Default Language</Label>
                  <Select
                    value={editingSettings.defaultLanguage ?? settings?.defaultLanguage ?? "en"}
                    onValueChange={(value) => setEditingSettings({ ...editingSettings, defaultLanguage: value })}
                  >
                    <SelectTrigger data-testid="select-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Working Hours</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      data-testid="input-hours-start"
                      type="time"
                      value={editingSettings.workingHoursStart ?? settings?.workingHoursStart ?? "09:00"}
                      onChange={(e) => setEditingSettings({ ...editingSettings, workingHoursStart: e.target.value })}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      data-testid="input-hours-end"
                      type="time"
                      value={editingSettings.workingHoursEnd ?? settings?.workingHoursEnd ?? "18:00"}
                      onChange={(e) => setEditingSettings({ ...editingSettings, workingHoursEnd: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="greeting">Greeting Message</Label>
                <Textarea
                  id="greeting"
                  data-testid="textarea-greeting"
                  value={editingSettings.greetingMessage ?? settings?.greetingMessage ?? ""}
                  onChange={(e) => setEditingSettings({ ...editingSettings, greetingMessage: e.target.value })}
                  placeholder="Hello! I'm H Orbit, your personal assistant..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outsideHours">Outside Hours Message</Label>
                <Textarea
                  id="outsideHours"
                  data-testid="textarea-outside-hours"
                  value={editingSettings.outsideHoursMessage ?? settings?.outsideHoursMessage ?? ""}
                  onChange={(e) => setEditingSettings({ ...editingSettings, outsideHoursMessage: e.target.value })}
                  placeholder="Thanks for reaching out! We're currently offline..."
                  rows={2}
                />
              </div>
              <Button
                data-testid="button-save-behavior"
                onClick={() => updateSettingsMutation.mutate(editingSettings)}
                disabled={Object.keys(editingSettings).length === 0 || updateSettingsMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Lead Capture Settings</CardTitle>
                <CardDescription>Configure collection preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">Enable Capture</p>
                    <p className="text-xs text-muted-foreground">Auto-collect visitor info</p>
                  </div>
                  <Switch
                    data-testid="switch-lead-capture"
                    checked={editingSettings.leadCaptureEnabled ?? settings?.leadCaptureEnabled ?? true}
                    onCheckedChange={(checked) => setEditingSettings({ ...editingSettings, leadCaptureEnabled: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Required</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {["name", "email", "phone", "property"].map((field) => (
                      <Badge key={field} className="text-xs capitalize bg-primary/10 text-primary hover:bg-primary/20">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Optional</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {["budget", "move-in", "room type"].map((field) => (
                      <Badge key={field} variant="outline" className="text-xs capitalize">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  data-testid="button-save-leads"
                  size="sm"
                  className="w-full"
                  onClick={() => updateSettingsMutation.mutate(editingSettings)}
                  disabled={Object.keys(editingSettings).length === 0 || updateSettingsMutation.isPending}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Settings
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Captured Leads</CardTitle>
                    <CardDescription>Leads collected via chatbot conversations</CardDescription>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {capturedLeads.length} total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-xl border animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-32 bg-muted rounded" />
                          <div className="h-3 w-48 bg-muted rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : capturedLeads.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-muted-foreground">No leads captured yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Leads will appear here when visitors share their details</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {capturedLeads.map((lead, index) => (
                        <motion.div
                          key={lead.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="group relative p-4 rounded-xl border bg-card hover:bg-muted/30 transition-all duration-200 hover:shadow-sm"
                          data-testid={`lead-card-${lead.id}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <h4 className="font-semibold text-sm truncate">{lead.name}</h4>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {format(new Date(lead.createdAt), "MMM d, h:mm a")}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {lead.email && (
                                  <span className="flex items-center gap-1.5">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate max-w-[180px]">{lead.email}</span>
                                  </span>
                                )}
                                {lead.phone && (
                                  <span className="flex items-center gap-1.5">
                                    <Phone className="h-3 w-3" />
                                    {lead.phone}
                                  </span>
                                )}
                              </div>
                              {(lead.budgetMin || lead.budgetMax || lead.message) && (
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {(lead.budgetMin || lead.budgetMax) && (
                                    <Badge variant="outline" className="text-xs gap-1">
                                      <IndianRupee className="h-2.5 w-2.5" />
                                      {lead.budgetMin && lead.budgetMax
                                        ? `${(lead.budgetMin / 1000)}k - ${(lead.budgetMax / 1000)}k`
                                        : lead.budgetMax
                                          ? `Up to ${(lead.budgetMax / 1000)}k`
                                          : `${(lead.budgetMin! / 1000)}k+`}
                                    </Badge>
                                  )}
                                  {lead.propertyId && (
                                    <Badge variant="secondary" className="text-xs gap-1">
                                      <Building2 className="h-2.5 w-2.5" />
                                      Property
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Knowledge Base</h2>
              <p className="text-sm text-muted-foreground">Add custom content for the chatbot to reference</p>
            </div>
            <Button data-testid="button-add-knowledge" onClick={() => setShowKnowledgeForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
          </div>

          <AnimatePresence>
            {showKnowledgeForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>New Knowledge Entry</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={newKnowledge.category ?? ""}
                          onValueChange={(value) => setNewKnowledge({ ...newKnowledge, category: value })}
                        >
                          <SelectTrigger data-testid="select-knowledge-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="property_info">Property Info</SelectItem>
                            <SelectItem value="pricing">Pricing & Fees</SelectItem>
                            <SelectItem value="amenities">Amenities</SelectItem>
                            <SelectItem value="policies">Policies</SelectItem>
                            <SelectItem value="faq">FAQ</SelectItem>
                            <SelectItem value="promotions">Promotions</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          data-testid="input-knowledge-title"
                          value={newKnowledge.title ?? ""}
                          onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                          placeholder="Entry title"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Textarea
                        data-testid="textarea-knowledge-content"
                        value={newKnowledge.content ?? ""}
                        onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                        placeholder="Detailed content for the chatbot to learn..."
                        rows={4}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        data-testid="button-save-knowledge"
                        onClick={() => createKnowledgeMutation.mutate(newKnowledge)}
                        disabled={!newKnowledge.category || !newKnowledge.title || createKnowledgeMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Entry
                      </Button>
                      <Button variant="outline" onClick={() => setShowKnowledgeForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {knowledge.map((entry) => (
              <Card key={entry.id} data-testid={`knowledge-entry-${entry.id}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" data-testid={`badge-category-${entry.id}`}>{entry.category}</Badge>
                        <Badge variant={entry.status === "published" ? "default" : "secondary"} data-testid={`badge-status-${entry.id}`}>
                          {entry.status}
                        </Badge>
                      </div>
                      <h3 className="font-semibold" data-testid={`text-knowledge-title-${entry.id}`}>{entry.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`text-knowledge-content-${entry.id}`}>{entry.content}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => deleteKnowledgeMutation.mutate(entry.id)}
                      data-testid={`button-delete-knowledge-${entry.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {knowledge.length === 0 && (
              <Card className="col-span-2">
                <CardContent className="py-12 text-center">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No knowledge entries yet. Add your first entry above.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="handoff" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Human Handoff Rules</CardTitle>
              <CardDescription>Configure when and how to escalate to human agents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Escalation Triggers</Label>
                <p className="text-sm text-muted-foreground">Phrases or keywords that trigger human handoff</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(settings?.escalationTriggers || ["speak to human", "talk to agent", "real person", "help", "urgent"]).map((trigger) => (
                    <Badge key={trigger} variant="outline">
                      {trigger}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="escalationEmail">Escalation Notification Email</Label>
                <Input
                  id="escalationEmail"
                  data-testid="input-escalation-email"
                  type="email"
                  value={editingSettings.escalationEmail ?? settings?.escalationEmail ?? ""}
                  onChange={(e) => setEditingSettings({ ...editingSettings, escalationEmail: e.target.value })}
                  placeholder="support@hsquareliving.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Messages Before Auto-Escalation</Label>
                <Input
                  data-testid="input-max-messages"
                  type="number"
                  min={5}
                  max={50}
                  value={editingSettings.maxMessagesBeforeEscalation ?? settings?.maxMessagesBeforeEscalation ?? 15}
                  onChange={(e) =>
                    setEditingSettings({ ...editingSettings, maxMessagesBeforeEscalation: parseInt(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">If conversation exceeds this many messages, offer human support</p>
              </div>
              <Button
                data-testid="button-save-handoff"
                onClick={() => updateSettingsMutation.mutate(editingSettings)}
                disabled={Object.keys(editingSettings).length === 0 || updateSettingsMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation History</CardTitle>
              <CardDescription>View and manage past chatbot conversations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {conversations.map((conv) => (
                  <div key={conv.id} data-testid={`conversation-item-${conv.id}`} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                        <MessageSquare className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{conv.visitorName || "Anonymous Visitor"}</p>
                          {conv.flagStatus && (
                            <Badge variant="destructive" className="text-xs">
                              {conv.flagStatus}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {conv.visitorEmail || "No email"} • {conv.messageCount} messages
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <Badge variant="outline">{conv.outcome || "ongoing"}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(conv.startedAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" data-testid={`button-view-conv-${conv.id}`}>
                        View
                      </Button>
                    </div>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No conversations yet</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security & Content Moderation</CardTitle>
              <CardDescription>Protect your chatbot from abuse and inappropriate content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Blocked Keywords</Label>
                <p className="text-sm text-muted-foreground">Messages containing these words will be filtered</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(settings?.blockedKeywords || []).map((keyword) => (
                    <Badge key={keyword} variant="destructive">
                      {keyword}
                    </Badge>
                  ))}
                  {(!settings?.blockedKeywords || settings.blockedKeywords.length === 0) && (
                    <p className="text-sm text-muted-foreground">No blocked keywords configured</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Rate Limiting</p>
                    <p className="text-sm text-muted-foreground">Prevent spam and abuse</p>
                  </div>
                  <Badge variant="default" className="bg-green-500">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Content Filtering</p>
                    <p className="text-sm text-muted-foreground">Block inappropriate content</p>
                  </div>
                  <Badge variant="default" className="bg-green-500">Active</Badge>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Security Notice</p>
                    <p className="text-sm text-yellow-700">
                      All conversations are encrypted and stored securely. PII data is handled according to GDPR guidelines.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
