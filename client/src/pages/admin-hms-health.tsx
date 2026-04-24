import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Stethoscope,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Search,
  Wallet,
  Globe,
  Shield,
  Activity,
  Copy,
  Clock,
} from "lucide-react";

interface InboundEndpoint {
  method: string;
  path: string;
  label: string;
  url: string;
  lastHit: { timestamp: string; status: number | null; source: "audit_log" | "in_memory" } | null;
  lastHitPersistent: string | null;
}
interface HmsHit {
  timestamp: string;
  method: string | null;
  route: string | null;
  path?: string | null;
  status: number | null;
  durationMs: number | null;
  ip?: string | null;
  identifier?: string | null;
  bookingRef?: string | null;
  hasApiKey?: boolean;
  query?: Record<string, string>;
}
interface StatusResponse {
  ok: boolean;
  config: {
    hasApiKey: boolean;
    hasLoginCreds: boolean;
    apiBaseUrl: string;
    appPublicUrl: string | null;
  };
  request: {
    host: string | null;
    protocol: string;
    canonicalBase: string;
  };
  outbound: {
    ok: boolean;
    status?: number;
    error?: string;
    latencyMs?: number;
    tested?: string;
    mode?: "api_key" | "login" | "none";
  };
  token: {
    source: "api_key" | "cached_jwt" | "none";
    ageMinutes: number | null;
    expiresInMinutes: number | null;
  };
  canonicality: {
    expectedApex: string;
    appPublicHost: string | null;
    requestHost: string | null;
    requestIsWww: boolean;
    appPublicIsWww: boolean;
    requestMatchesApex: boolean;
    appPublicMatchesApex: boolean;
    isCanonical: boolean;
    warnings: string[];
  };
  inboundEndpoints: InboundEndpoint[];
  activityLog: { total: number; capacity: number };
}
interface PingAuthResponse {
  ok: boolean;
  mode?: "api_key" | "login";
  status?: number;
  latencyMs?: number;
  tokenLength?: number;
  ageMinutes?: number;
  expiresInMinutes?: number;
  message?: string;
  error?: string;
}

function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return ok ? (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" data-testid="badge-status-ok">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      {label || "OK"}
    </Badge>
  ) : (
    <Badge className="bg-rose-100 text-rose-700 border-rose-200" data-testid="badge-status-fail">
      <XCircle className="w-3 h-3 mr-1" />
      {label || "Fail"}
    </Badge>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function AdminHmsHealth() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [phone, setPhone] = useState("");
  const [walletPhone, setWalletPhone] = useState("");
  const [walletBookingCode, setWalletBookingCode] = useState("");
  const [residentResult, setResidentResult] = useState<any>(null);
  const [walletResult, setWalletResult] = useState<any>(null);
  const [pingAuthResult, setPingAuthResult] = useState<PingAuthResponse | null>(null);

  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  // Page-level guard: only superadmin allowed.
  useEffect(() => {
    if (!user) return;
    if (user.role !== "superadmin") {
      toast({ title: "Access denied", description: "Superadmin only.", variant: "destructive" });
      setLocation("/admin");
    }
  }, [user, setLocation, toast]);

  const statusQuery = useQuery<StatusResponse>({
    queryKey: ["/api/admin/hms-health/status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/hms-health/status", { headers });
      if (!res.ok) throw new Error("Status fetch failed");
      return res.json();
    },
    enabled: user?.role === "superadmin",
    refetchInterval: 30_000,
  });

  const activityQuery = useQuery<{ ok: boolean; hits: HmsHit[]; stats: { total: number; capacity: number } }>({
    queryKey: ["/api/admin/hms-health/recent-activity"],
    queryFn: async () => {
      const res = await fetch("/api/admin/hms-health/recent-activity", { headers });
      if (!res.ok) throw new Error("Activity fetch failed");
      return res.json();
    },
    enabled: user?.role === "superadmin",
    refetchInterval: 10_000,
  });

  const residentLookup = useMutation({
    mutationFn: async (p: string) => {
      const res = await fetch("/api/admin/hms-health/lookup-resident", {
        method: "POST",
        headers,
        body: JSON.stringify({ phone: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Lookup failed");
      return data;
    },
    onSuccess: (data) => setResidentResult(data),
    onError: (e: Error) => toast({ title: "Lookup failed", description: e.message, variant: "destructive" }),
  });

  const pingAuth = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/hms-health/ping-auth", { method: "POST", headers });
      const data = (await res.json()) as PingAuthResponse;
      return data;
    },
    onSuccess: (data) => {
      setPingAuthResult(data);
      if (data.ok) {
        statusQuery.refetch();
        toast({ title: "HMS auth OK", description: data.message || "Authentication confirmed." });
      } else {
        toast({ title: "HMS auth failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    },
    onError: (e: Error) => {
      setPingAuthResult({ ok: false, error: e.message });
      toast({ title: "HMS auth failed", description: e.message, variant: "destructive" });
    },
  });

  const walletLookup = useMutation({
    mutationFn: async (body: { phone?: string; bookingCode?: string }) => {
      const res = await fetch("/api/admin/hms-health/wallet-balance", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Wallet lookup failed");
      return data;
    },
    onSuccess: (data) => setWalletResult(data),
    onError: (e: Error) => toast({ title: "Wallet lookup failed", description: e.message, variant: "destructive" }),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: text.length > 60 ? text.slice(0, 57) + "…" : text });
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-spinner">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (user.role !== "superadmin") return null;

  const status = statusQuery.data;
  const activity = activityQuery.data;
  const isCanonical = !!status?.canonicality?.isCanonical;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" data-testid="text-page-title">
            <Stethoscope className="w-7 h-7" />
            HMS Health Diagnostics
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Verify the HostelFlow integration end-to-end. Read-only — no changes are made to bookings, residents, or wallets.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            statusQuery.refetch();
            activityQuery.refetch();
          }}
          disabled={statusQuery.isFetching || activityQuery.isFetching}
          data-testid="button-refresh-all"
        >
          {statusQuery.isFetching || activityQuery.isFetching ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* ===== Connection card ===== */}
      <Card data-testid="card-connection">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Connection &amp; Outbound Auth
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusQuery.isLoading ? (
            <div className="flex items-center text-sm text-slate-500" data-testid="text-connection-loading">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Checking HMS connection…
            </div>
          ) : statusQuery.error ? (
            <p className="text-sm text-rose-600" data-testid="text-connection-error">
              Failed to load status: {(statusQuery.error as Error).message}
            </p>
          ) : status ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">API Key Configured</span>
                  <StatusBadge ok={status.config.hasApiKey} label={status.config.hasApiKey ? "Set" : "Missing"} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Login Fallback Creds</span>
                  <StatusBadge
                    ok={status.config.hasLoginCreds}
                    label={status.config.hasLoginCreds ? "Set" : "Missing"}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Outbound Ping</span>
                  <StatusBadge
                    ok={status.outbound.ok}
                    label={
                      status.outbound.ok
                        ? `OK (${status.outbound.status} · ${status.outbound.latencyMs}ms)`
                        : `Fail${status.outbound.status ? " " + status.outbound.status : ""}`
                    }
                  />
                </div>
                {status.outbound.error && (
                  <p className="text-xs text-rose-600 break-all" data-testid="text-outbound-error">
                    {status.outbound.error}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-slate-500 text-xs">HMS API Base</p>
                  <p className="font-mono text-xs break-all" data-testid="text-api-base">{status.config.apiBaseUrl}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Tested URL</p>
                  <p className="font-mono text-xs break-all text-slate-600" data-testid="text-tested-url">
                    {status.outbound.tested || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Auth Token</p>
                  <p className="text-xs" data-testid="text-token-info">
                    <span className="font-mono">{status.token.source}</span>
                    {status.token.source === "cached_jwt" && status.token.ageMinutes !== null && (
                      <>
                        {" "}· issued{" "}
                        <span className="font-medium text-slate-700">{status.token.ageMinutes}m ago</span>
                        {status.token.expiresInMinutes !== null && (
                          <>
                            {" "}· expires in{" "}
                            <span className="font-medium text-slate-700">{Math.floor(status.token.expiresInMinutes / 60)}h {status.token.expiresInMinutes % 60}m</span>
                          </>
                        )}
                      </>
                    )}
                    {status.token.source === "api_key" && (
                      <span className="text-slate-500"> · static API key (no rotation)</span>
                    )}
                    {status.token.source === "none" && (
                      <span className="text-rose-500"> · no auth configured</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => pingAuth.mutate()}
              disabled={pingAuth.isPending}
              data-testid="button-ping-auth"
            >
              {pingAuth.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Activity className="w-4 h-4 mr-2" />
              )}
              Ping HMS Auth
            </Button>
            {pingAuthResult && (
              <div
                className={`text-xs px-3 py-1.5 rounded-md border ${
                  pingAuthResult.ok
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-rose-50 border-rose-200 text-rose-700"
                }`}
                data-testid="text-ping-auth-result"
              >
                {pingAuthResult.ok ? (
                  <>
                    {pingAuthResult.message || "OK"}
                    {pingAuthResult.latencyMs != null && <> ({pingAuthResult.latencyMs}ms)</>}
                    {pingAuthResult.mode === "login" && pingAuthResult.ageMinutes != null && (
                      <> · token {pingAuthResult.ageMinutes}m old</>
                    )}
                  </>
                ) : (
                  <>{pingAuthResult.error || "Auth ping failed"}</>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== Inbound endpoints ===== */}
      <Card data-testid="card-inbound-endpoints">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            Inbound HMS Endpoints
          </CardTitle>
          <p className="text-xs text-slate-500">
            HostelFlow should call these URLs with{" "}
            <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">Authorization: Bearer &lt;HMS_API_KEY&gt;</code>.
            "Last hit" shows the most recent inbound call we've recorded since the server started.
          </p>
        </CardHeader>
        <CardContent>
          {!status ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="space-y-2">
              {status.inboundEndpoints.map((ep) => (
                <div
                  key={`${ep.method}-${ep.path}`}
                  className="flex items-start gap-3 p-3 rounded-md border border-slate-200 bg-slate-50/50"
                  data-testid={`endpoint-${ep.method.toLowerCase()}-${ep.path.replace(/[^a-z0-9]/gi, "-")}`}
                >
                  <Badge variant="outline" className="font-mono text-[10px] uppercase shrink-0">
                    {ep.method}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-medium text-sm">{ep.label}</span>
                      {ep.lastHit ? (
                        <Badge
                          className={
                            ep.lastHit.status != null && ep.lastHit.status >= 200 && ep.lastHit.status < 300
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
                              : ep.lastHit.status != null
                                ? "bg-rose-100 text-rose-700 border-rose-200 text-[10px]"
                                : "bg-slate-100 text-slate-700 border-slate-200 text-[10px]"
                          }
                          title={`Source: ${ep.lastHit.source === "audit_log" ? "audit log (persistent)" : "in-memory ring"}`}
                        >
                          <Clock className="w-2.5 h-2.5 mr-1" />
                          {ep.lastHit.status ?? "—"} · {timeAgo(ep.lastHit.timestamp)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-slate-500">
                          Never hit
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="font-mono text-xs text-slate-600 truncate flex-1">{ep.url}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => copy(ep.url)}
                        data-testid={`button-copy-${ep.path.replace(/[^a-z0-9]/gi, "-")}`}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    {ep.lastHitPersistent && (
                      <p className="text-[10px] text-slate-400 mt-1" data-testid={`text-persistent-${ep.path.replace(/[^a-z0-9]/gi, "-")}`}>
                        DB evidence of body processed: {timeAgo(ep.lastHitPersistent)} ({new Date(ep.lastHitPersistent).toLocaleString()})
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Domain Canonicality ===== */}
      <Card data-testid="card-canonicality">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            Domain Canonicality
          </CardTitle>
          <p className="text-xs text-slate-500">
            HMS should call the apex domain (no <code className="font-mono">www.</code>). If the request host or
            APP_PUBLIC_URL differs from the expected apex, redirects may be stripping the Authorization header on
            POST/PUT.
          </p>
        </CardHeader>
        <CardContent>
          {status ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">Expected Apex</p>
                  <p className="font-mono text-xs break-all" data-testid="text-expected-apex">
                    {status.canonicality.expectedApex}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">APP_PUBLIC_URL Host</p>
                  <p className="font-mono text-xs break-all" data-testid="text-app-public-url">
                    {status.canonicality.appPublicHost || <span className="text-slate-400">unset</span>}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {status.canonicality.appPublicIsWww && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">www prefix</Badge>
                    )}
                    {status.canonicality.appPublicHost && !status.canonicality.appPublicMatchesApex && (
                      <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">!= apex</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Request Host</p>
                  <p className="font-mono text-xs break-all" data-testid="text-request-host">
                    {status.request.protocol}://{status.request.host}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {status.canonicality.requestIsWww && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">www prefix</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Overall</p>
                  <StatusBadge ok={isCanonical} label={isCanonical ? "Apex match" : "Mismatch"} />
                </div>
              </div>
              {status.canonicality.warnings.length > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs space-y-1" data-testid="canonicality-warnings">
                  {status.canonicality.warnings.map((w, i) => (
                    <p key={i} className="text-amber-800">⚠ {w}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading…</p>
          )}
        </CardContent>
      </Card>

      {/* ===== Resident lookup ===== */}
      <Card data-testid="card-resident-lookup">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-600" />
            Resident Lookup (by phone)
          </CardTitle>
          <p className="text-xs text-slate-500">
            Mirrors the matching logic of <code className="font-mono">GET /api/hms/bookings</code> — returns confirmed
            and active bookings whose phone ends with the last 10 digits.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="resident-phone" className="text-xs">Phone</Label>
              <Input
                id="resident-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                data-testid="input-resident-phone"
              />
            </div>
            <Button
              onClick={() => residentLookup.mutate(phone)}
              disabled={!phone || residentLookup.isPending}
              data-testid="button-lookup-resident"
            >
              {residentLookup.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Look up
            </Button>
          </div>
          {residentResult && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs" data-testid="result-resident">
              <p className="text-slate-500 mb-2">
                {residentResult.count === 0
                  ? "No bookings matched."
                  : `${residentResult.count} match${residentResult.count === 1 ? "" : "es"} (last 10 digits: ${residentResult.last10})`}
              </p>
              {residentResult.matches?.length > 0 && (
                <div className="space-y-2">
                  {residentResult.matches.map((m: any) => {
                    const rd = m.residentDetails || {};
                    const name = m.walkInName || rd.name || rd.fullName || "Unknown";
                    return (
                      <div key={m.id} className="bg-white rounded p-2 border border-slate-200" data-testid={`row-match-${m.id}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-800">{name}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">{m.bookingCode}</Badge>
                          <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">{m.status}</Badge>
                        </div>
                        <p className="text-slate-500 mt-1">
                          {m.walkInPhone || rd.phone || "—"} · {m.customerEmail || rd.email || "no email"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Wallet balance ===== */}
      <Card data-testid="card-wallet-balance">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-600" />
            Wallet Balance Check
          </CardTitle>
          <p className="text-xs text-slate-500">
            Mirrors <code className="font-mono">GET /sync/wallet-balance</code>. Sums credits and debits from{" "}
            <code className="font-mono">wallet_ledger</code> for the matching booking.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="wallet-phone" className="text-xs">Phone</Label>
              <Input
                id="wallet-phone"
                value={walletPhone}
                onChange={(e) => setWalletPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                data-testid="input-wallet-phone"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label htmlFor="wallet-booking" className="text-xs">…or Booking Code</Label>
              <Input
                id="wallet-booking"
                value={walletBookingCode}
                onChange={(e) => setWalletBookingCode(e.target.value)}
                placeholder="e.g. HSQ-XXXXX"
                data-testid="input-wallet-booking"
              />
            </div>
            <Button
              onClick={() => walletLookup.mutate({ phone: walletPhone, bookingCode: walletBookingCode })}
              disabled={(!walletPhone && !walletBookingCode) || walletLookup.isPending}
              data-testid="button-lookup-wallet"
            >
              {walletLookup.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4 mr-2" />
              )}
              Check
            </Button>
          </div>
          {walletResult && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs" data-testid="result-wallet">
              {!walletResult.found ? (
                <p className="text-slate-500">{walletResult.message}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div>
                      <span className="font-medium text-slate-800">{walletResult.booking.guestName || "—"}</span>{" "}
                      <Badge variant="outline" className="font-mono text-[10px] ml-1">{walletResult.booking.bookingCode}</Badge>
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] ml-1">{walletResult.booking.status}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-[10px]">Balance</p>
                      <p className="text-lg font-bold text-emerald-600" data-testid="text-wallet-balance">
                        ₹{walletResult.balance}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-white rounded border border-slate-200 p-2 text-center">
                      <p className="text-[10px] text-slate-500">Credits</p>
                      <p className="font-semibold text-emerald-600">₹{walletResult.totalCredits}</p>
                    </div>
                    <div className="bg-white rounded border border-slate-200 p-2 text-center">
                      <p className="text-[10px] text-slate-500">Debits</p>
                      <p className="font-semibold text-rose-600">₹{walletResult.totalDebits}</p>
                    </div>
                    <div className="bg-white rounded border border-slate-200 p-2 text-center">
                      <p className="text-[10px] text-slate-500">Txns</p>
                      <p className="font-semibold text-slate-800">{walletResult.transactionCount}</p>
                    </div>
                  </div>
                  {walletResult.recentTransactions?.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Recent Transactions</p>
                      {walletResult.recentTransactions.map((t: any) => (
                        <div key={t.id} className="bg-white rounded p-2 border border-slate-200 flex items-center justify-between gap-2" data-testid={`row-txn-${t.id}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-slate-700 truncate">{t.note || t.refType || "—"}</p>
                            <p className="text-slate-400 text-[10px]">{new Date(t.createdAt).toLocaleString()}</p>
                          </div>
                          <span className={t.credit > 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                            {t.credit > 0 ? `+₹${t.credit}` : `-₹${t.debit}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== Recent activity ===== */}
      <Card data-testid="card-recent-activity">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            Recent Inbound HMS Calls
            {activity?.stats && (
              <Badge variant="outline" className="ml-2 text-[10px]">
                {activity.stats.total}/{activity.stats.capacity} buffered
              </Badge>
            )}
          </CardTitle>
          <p className="text-xs text-slate-500">
            Last 20 inbound HMS calls from the persistent audit log (survives restarts). Auto-refreshes every 10s.
          </p>
        </CardHeader>
        <CardContent>
          {activityQuery.isLoading ? (
            <p className="text-sm text-slate-500" data-testid="text-activity-loading">Loading…</p>
          ) : !activity?.hits?.length ? (
            <p className="text-sm text-slate-500" data-testid="text-activity-empty">
              No inbound HMS calls recorded yet. Trigger one from HostelFlow to see it here.
            </p>
          ) : (
            <div className="space-y-1">
              {activity.hits.map((h, i) => (
                <div
                  key={`${h.timestamp}-${i}`}
                  className="grid grid-cols-12 gap-2 items-center text-xs py-1.5 px-2 rounded bg-slate-50/60 border border-slate-100"
                  data-testid={`row-activity-${i}`}
                >
                  <Badge variant="outline" className="font-mono text-[10px] uppercase col-span-1 justify-center">
                    {h.method ?? "?"}
                  </Badge>
                  <code className="font-mono text-[11px] text-slate-700 truncate col-span-5">{h.path || h.route || "—"}</code>
                  <Badge
                    className={
                      h.status != null && h.status >= 200 && h.status < 300
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] col-span-1 justify-center"
                        : h.status != null && h.status >= 400
                          ? "bg-rose-100 text-rose-700 border-rose-200 text-[10px] col-span-1 justify-center"
                          : "bg-amber-100 text-amber-700 border-amber-200 text-[10px] col-span-1 justify-center"
                    }
                  >
                    {h.status ?? "—"}
                  </Badge>
                  <span className="text-slate-500 col-span-1 text-right">{h.durationMs != null ? `${h.durationMs}ms` : "—"}</span>
                  <code
                    className="font-mono text-[10px] text-slate-500 col-span-2 truncate text-right"
                    title={h.bookingRef || h.identifier || ""}
                    data-testid={`text-bookingref-${i}`}
                  >
                    {h.bookingRef || h.identifier || ""}
                  </code>
                  <span className="text-slate-500 col-span-2 text-right">{timeAgo(h.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
