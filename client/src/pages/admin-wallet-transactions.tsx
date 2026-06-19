import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Cpu,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface WalletTransaction {
  id: string;
  bookingId: string;
  bookingCode: string;
  bookingStatus: string;
  studentName: string;
  propertyName: string;
  credit: number;
  debit: number;
  refType: string | null;
  creditType: string | null;
  note: string | null;
  performedBy: string | null;
  performedByName: string;
  performedByRole: string | null;
  createdAt: string;
}

const PAGE_SIZE = 50;

const TYPE_LABELS: Record<string, string> = {
  manual_topup: "Top Up",
  manual_debit: "Manual Debit",
  alacarte_order: "CRM Order",
  package_credit: "Package Credit",
  package_credit_renewal: "Credit Renewal",
  wallet_topup: "Wallet Top Up",
  balance_correction: "Correction",
  old_batch: "Batch (Old)",
  new_batch: "Batch (New)",
  monthly_release: "Monthly Release",
};

const TYPE_COLORS: Record<string, string> = {
  manual_topup: "bg-emerald-100 text-emerald-800 border-emerald-200",
  manual_debit: "bg-red-100 text-red-800 border-red-200",
  alacarte_order: "bg-orange-100 text-orange-800 border-orange-200",
  package_credit: "bg-blue-100 text-blue-800 border-blue-200",
  package_credit_renewal: "bg-indigo-100 text-indigo-800 border-indigo-200",
  wallet_topup: "bg-teal-100 text-teal-800 border-teal-200",
  balance_correction: "bg-yellow-100 text-yellow-800 border-yellow-200",
  monthly_release: "bg-purple-100 text-purple-800 border-purple-200",
};

function typeLabel(refType: string | null) {
  if (!refType) return "—";
  return TYPE_LABELS[refType] ?? refType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function typeColor(refType: string | null) {
  return TYPE_COLORS[refType ?? ""] ?? "bg-slate-100 text-slate-700 border-slate-200";
}

function PerformerBadge({ name, role }: { name: string; role: string | null }) {
  if (name === "CRM" || name === "HMS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs font-medium text-orange-700">
        <Cpu className="h-3 w-3" />
        {name}
      </span>
    );
  }
  if (name === "System") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
        <Cpu className="h-3 w-3" />
        System
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-medium text-indigo-700">
      <User className="h-3 w-3" />
      <span>{name}</span>
      {role && (
        <span className="text-indigo-400 font-normal capitalize">· {role.replace(/_/g, " ")}</span>
      )}
    </span>
  );
}

export default function AdminWalletTransactions() {
  const { user, token } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [page, setPage] = useState(0);

  const isSuperAdmin = user?.role === "superadmin";

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <ShieldCheck className="h-12 w-12 text-slate-300" />
        <p className="text-slate-500 text-sm">Access restricted to Superadmin only.</p>
        <Button variant="outline" onClick={() => setLocation("/admin")}>Go to Dashboard</Button>
      </div>
    );
  }

  const { data, isLoading, refetch, isFetching } = useQuery<{ transactions: WalletTransaction[]; total: number }>({
    queryKey: ["/api/admin/wallet-transactions", page, PAGE_SIZE],
    queryFn: async () => {
      const res = await fetch(`/api/admin/wallet-transactions?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load transactions");
      return res.json();
    },
    enabled: isSuperAdmin && !!token,
    staleTime: 30_000,
  });

  const allTx = data?.transactions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filtered = allTx.filter(tx => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      tx.bookingCode.toLowerCase().includes(q) ||
      tx.studentName.toLowerCase().includes(q) ||
      tx.propertyName.toLowerCase().includes(q) ||
      (tx.note ?? "").toLowerCase().includes(q) ||
      tx.performedByName.toLowerCase().includes(q);
    const matchesType = filterType === "all" || tx.refType === filterType;
    return matchesSearch && matchesType;
  });

  const totalCredit = filtered.reduce((s, t) => s + (t.credit || 0), 0);
  const totalDebit = filtered.reduce((s, t) => s + (t.debit || 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Wallet Ledger</h1>
            <p className="text-xs text-slate-500">All wallet transactions across bookings · Superadmin only</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-wallet-tx"
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
          <p className="text-xs text-slate-500 font-medium">Total Records</p>
          <p className="text-2xl font-bold text-slate-800">{total.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
          <p className="text-xs text-slate-500 font-medium">Showing</p>
          <p className="text-2xl font-bold text-slate-800">{filtered.length.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 space-y-1">
          <p className="text-xs text-emerald-600 font-medium flex items-center gap-1"><TrendingUp className="h-3 w-3" />Total Credits (view)</p>
          <p className="text-2xl font-bold text-emerald-700">₹{totalCredit.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 space-y-1">
          <p className="text-xs text-red-500 font-medium flex items-center gap-1"><TrendingDown className="h-3 w-3" />Total Debits (view)</p>
          <p className="text-2xl font-bold text-red-600">₹{totalDebit.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search by booking code, student, property, note, staff…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            data-testid="input-search-wallet-tx"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(0); }}>
            <SelectTrigger className="h-9 w-48 text-sm" data-testid="select-filter-type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="manual_topup">Top Up</SelectItem>
              <SelectItem value="manual_debit">Manual Debit</SelectItem>
              <SelectItem value="alacarte_order">CRM Order</SelectItem>
              <SelectItem value="package_credit">Package Credit</SelectItem>
              <SelectItem value="monthly_release">Monthly Release</SelectItem>
              <SelectItem value="balance_correction">Correction</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date & Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Booking</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Performed By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 text-sm">
                    <Wallet className="h-10 w-10 mx-auto mb-3 text-slate-200" />
                    No transactions found
                  </td>
                </tr>
              ) : (
                filtered.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`row-wallet-tx-${tx.id}`}>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                      {tx.createdAt ? format(new Date(tx.createdAt), "dd MMM yyyy") : "—"}
                      <div className="text-slate-400">{tx.createdAt ? format(new Date(tx.createdAt), "hh:mm a") : ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-slate-800 text-xs">{tx.bookingCode}</div>
                      <div className="text-slate-400 text-xs">{tx.propertyName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 max-w-[140px] truncate">{tx.studentName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${typeColor(tx.refType)}`}>
                        {typeLabel(tx.refType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      {tx.credit > 0 ? (
                        <span className="text-emerald-600 flex items-center justify-end gap-1">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          +₹{tx.credit.toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span className="text-red-500 flex items-center justify-end gap-1">
                          <ArrowDownRight className="h-3.5 w-3.5" />
                          −₹{tx.debit.toLocaleString("en-IN")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PerformerBadge name={tx.performedByName} role={tx.performedByRole} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate" title={tx.note ?? ""}>
                      {tx.note || <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              <Wallet className="h-10 w-10 mx-auto mb-3 text-slate-200" />
              No transactions found
            </div>
          ) : (
            filtered.map(tx => (
              <div key={tx.id} className="p-4 space-y-2" data-testid={`card-wallet-tx-${tx.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono font-semibold text-slate-800 text-xs">{tx.bookingCode}</span>
                    <span className="text-slate-400 text-xs ml-2">{tx.propertyName}</span>
                    <div className="font-medium text-slate-700 text-sm mt-0.5">{tx.studentName}</div>
                  </div>
                  <div className="text-right shrink-0">
                    {tx.credit > 0 ? (
                      <span className="text-emerald-600 font-bold text-sm flex items-center gap-0.5 justify-end">
                        <ArrowUpRight className="h-3.5 w-3.5" />+₹{tx.credit.toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="text-red-500 font-bold text-sm flex items-center gap-0.5 justify-end">
                        <ArrowDownRight className="h-3.5 w-3.5" />−₹{tx.debit.toLocaleString("en-IN")}
                      </span>
                    )}
                    <div className="text-xs text-slate-400 mt-0.5">
                      {tx.createdAt ? format(new Date(tx.createdAt), "dd MMM yy, hh:mm a") : ""}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${typeColor(tx.refType)}`}>
                    {typeLabel(tx.refType)}
                  </span>
                  <PerformerBadge name={tx.performedByName} role={tx.performedByRole} />
                </div>
                {tx.note && (
                  <p className="text-xs text-slate-500 italic">{tx.note}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs text-slate-500">
              Page {page + 1} of {totalPages} · {total.toLocaleString("en-IN")} total records
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isFetching}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
