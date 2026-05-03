import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Building2, Users, IndianRupee, Ticket, UserCog, BarChart3, Settings as SettingsIcon,
  Plus, Edit, ExternalLink, Download, Film, Upload, X, ToggleLeft, ToggleRight,
  TrendingUp, Calendar, BedDouble, CheckCircle2,
} from "lucide-react";
import { useFeatureFlags, useSetFeatureFlag } from "@/hooks/use-feature-flags";
import { useSiteContent, useSetSiteContent } from "@/hooks/use-site-content";
import { ObjectUploader } from "@/components/ObjectUploader";

interface Property {
  id: string;
  name: string;
  slug?: string | null;
  category?: string | null;
  location: string;
  pricePerMonth?: number;
  totalRooms?: number;
  isActive?: boolean;
}

interface Booking {
  id: string;
  bookingCode?: string | null;
  customerType?: string | null;
  walkInName?: string | null;
  walkInEmail?: string | null;
  walkInPhone?: string | null;
  studentId?: string | null;
  userId?: string | null;
  propertyId: string;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  totalFee: number;
  status: string;
  createdAt: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  fullName?: string | null;
  role: string;
  isActive?: boolean;
  assignedPropertyIds?: string[] | null;
  createdAt?: string;
}

interface Coupon {
  id: string;
  code: string;
  name: string;
  discountType: "percent" | "flat";
  discountValue: number;
  validFrom: string;
  validUntil: string | null;
  usageLimit: number | null;
  usageCount: number;
  applicablePropertyIds: string[] | null;
  status: "active" | "paused" | "expired" | "exhausted";
}

interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  status: string;
  paymentMethod?: string | null;
  razorpayPaymentId?: string | null;
  createdAt: string;
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

/* ============ Section Header ============ */
function SectionHeader({ icon: Icon, title, subtitle, action }: { icon: any; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5 sm:mb-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] mb-1.5" style={{ color: "#c5a059" }}>
          <Icon className="inline w-3 h-3 mr-1.5 -mt-0.5" /> {title}
        </p>
        {subtitle && <p className="text-white/50 text-xs sm:text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function GoldButton({ children, onClick, href, testId }: { children: React.ReactNode; onClick?: () => void; href?: string; testId?: string }) {
  const cls = "px-4 py-2.5 text-black font-semibold inline-flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest";
  if (href) {
    return <Link href={href} className={cls} style={{ backgroundColor: "#c5a059" }} data-testid={testId}>{children}</Link>;
  }
  return <button onClick={onClick} className={cls} style={{ backgroundColor: "#c5a059" }} data-testid={testId}>{children}</button>;
}

function GhostButton({ children, onClick, href, testId }: { children: React.ReactNode; onClick?: () => void; href?: string; testId?: string }) {
  const cls = "px-3 py-2 text-white/70 hover:text-white border border-white/15 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest transition-colors";
  if (href) {
    return <Link href={href} className={cls} data-testid={testId}>{children}</Link>;
  }
  return <button onClick={onClick} className={cls} data-testid={testId}>{children}</button>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-12 text-white/40 text-sm border border-white/5 border-dashed">{children}</div>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="border border-white/10 overflow-x-auto" style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}>
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-white/10">
            {headers.map((h) => (
              <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-widest text-white/40 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ============ Properties Panel ============ */
export function PropertiesPanel({ hotels }: { hotels: Property[] }) {
  return (
    <div data-testid="panel-properties">
      <SectionHeader
        icon={Building2}
        title="Hotel Properties"
        subtitle={`${hotels.length} ${hotels.length === 1 ? "property" : "properties"} in your hotels portfolio`}
        action={<GoldButton href="/admin/add-property?category=hotel" testId="button-new-hotel-property"><Plus className="w-3 h-3" /> New Hotel</GoldButton>}
      />
      {hotels.length === 0 ? (
        <Empty>No hotel properties yet. Click "New Hotel" to add your first.</Empty>
      ) : (
        <Table headers={["Name", "Location", "Status", "Actions"]}>
          {hotels.map((p) => (
            <tr key={p.id} className="border-b border-white/5 hover:bg-white/5" data-testid={`row-property-${p.id}`}>
              <td className="px-4 py-3 text-white">
                <div className="font-medium">{p.name}</div>
                {p.slug && <div className="text-[10px] text-white/40 font-mono mt-0.5">/{p.slug}</div>}
              </td>
              <td className="px-4 py-3 text-white/70">{p.location}</td>
              <td className="px-4 py-3">
                {p.isActive === false ? (
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400 border border-zinc-500/30 px-2 py-1">Inactive</span>
                ) : (
                  <span className="text-[10px] uppercase tracking-widest text-emerald-300 border border-emerald-500/30 px-2 py-1">Live</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <GhostButton href={`/hotels/rooms/${p.slug || p.id}`} testId={`button-view-${p.id}`}><ExternalLink className="w-3 h-3" /> View</GhostButton>
                  <GhostButton href={`/admin?editProperty=${p.id}`} testId={`button-edit-${p.id}`}><Edit className="w-3 h-3" /> Edit</GhostButton>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

/* ============ Guests Panel ============ */
export function GuestsPanel({ bookings }: { bookings: Booking[] }) {
  // Group bookings by guest (walk-in name/email or studentId/userId)
  const guests = useMemo(() => {
    const map = new Map<string, { key: string; name: string; email: string; phone: string; bookingsCount: number; totalSpent: number; lastBookingAt: string }>();
    for (const b of bookings) {
      const key = b.walkInEmail || b.walkInPhone || b.studentId || b.userId || `${b.walkInName || "Guest"}-${b.id}`;
      const name = b.walkInName || (b.studentId ? `Student ${b.studentId.slice(0, 8)}` : "Guest");
      const email = b.walkInEmail || "";
      const phone = b.walkInPhone || "";
      const existing = map.get(key);
      if (existing) {
        existing.bookingsCount += 1;
        existing.totalSpent += b.totalFee || 0;
        if (b.createdAt > existing.lastBookingAt) existing.lastBookingAt = b.createdAt;
      } else {
        map.set(key, { key, name, email, phone, bookingsCount: 1, totalSpent: b.totalFee || 0, lastBookingAt: b.createdAt });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.lastBookingAt.localeCompare(a.lastBookingAt));
  }, [bookings]);

  return (
    <div data-testid="panel-guests">
      <SectionHeader icon={Users} title="Hotel Guests" subtitle={`${guests.length} unique guests across ${bookings.length} bookings`} />
      {guests.length === 0 ? (
        <Empty>No guests yet. Bookings will populate this list automatically.</Empty>
      ) : (
        <Table headers={["Guest", "Contact", "Bookings", "Total Spent", "Last Booking"]}>
          {guests.map((g) => (
            <tr key={g.key} className="border-b border-white/5 hover:bg-white/5" data-testid={`row-guest-${g.key}`}>
              <td className="px-4 py-3 text-white font-medium">{g.name}</td>
              <td className="px-4 py-3 text-white/70 text-xs">
                {g.email && <div>{g.email}</div>}
                {g.phone && <div className="text-white/50">{g.phone}</div>}
                {!g.email && !g.phone && <span className="text-white/30">—</span>}
              </td>
              <td className="px-4 py-3 text-white/70">{g.bookingsCount}</td>
              <td className="px-4 py-3 text-white">{inr(g.totalSpent)}</td>
              <td className="px-4 py-3 text-white/50 text-xs">{fmtDate(g.lastBookingAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

/* ============ Payments Panel ============ */
export function PaymentsPanel({ token, hotelBookings }: { token: string | null; hotelBookings: Booking[] }) {
  const bookingIds = useMemo(() => new Set(hotelBookings.map((b) => b.id)), [hotelBookings]);
  const bookingMap = useMemo(() => {
    const m = new Map<string, Booking>();
    hotelBookings.forEach((b) => m.set(b.id, b));
    return m;
  }, [hotelBookings]);

  // Fetch payments for each booking. Use a single combined query that hits a list endpoint if available, otherwise per-booking.
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments", "hotels", Array.from(bookingIds).sort().join(",")],
    queryFn: async () => {
      // No /api/payments list endpoint exists; fetch per booking in parallel and flatten.
      const results = await Promise.all(
        Array.from(bookingIds).map(async (bid) => {
          const res = await fetch(`/api/bookings/${bid}/payments`, { headers: authHeaders(token) });
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        })
      );
      return results.flat();
    },
    enabled: !!token && bookingIds.size > 0,
  });

  const totalCollected = payments.filter((p) => p.status === "completed" || p.status === "success").reduce((s, p) => s + (p.amount || 0), 0);
  const pending = payments.filter((p) => p.status === "pending").reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div data-testid="panel-payments">
      <SectionHeader icon={IndianRupee} title="Payments & Revenue" subtitle="All payment records linked to hotel bookings" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <div className="p-4 border border-white/10" style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}>
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Collected</div>
          <div className="text-xl font-bold text-white" data-testid="text-payments-collected">{inr(totalCollected)}</div>
        </div>
        <div className="p-4 border border-white/10" style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}>
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Pending</div>
          <div className="text-xl font-bold text-amber-300" data-testid="text-payments-pending">{inr(pending)}</div>
        </div>
        <div className="p-4 border border-white/10" style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}>
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Transactions</div>
          <div className="text-xl font-bold text-white" data-testid="text-payments-count">{payments.length}</div>
        </div>
      </div>
      {isLoading ? (
        <div className="text-center py-8 text-white/40 text-sm">Loading payments…</div>
      ) : payments.length === 0 ? (
        <Empty>No payment records yet for hotel bookings.</Empty>
      ) : (
        <Table headers={["Date", "Booking", "Method", "Amount", "Status"]}>
          {payments.slice(0, 50).map((p) => {
            const bk = bookingMap.get(p.bookingId);
            return (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5" data-testid={`row-payment-${p.id}`}>
                <td className="px-4 py-3 text-white/70 text-xs">{fmtDate(p.createdAt)}</td>
                <td className="px-4 py-3 text-white text-xs font-mono">{bk?.bookingCode || p.bookingId.slice(0, 8)}</td>
                <td className="px-4 py-3 text-white/70 text-xs uppercase">{p.paymentMethod || "razorpay"}</td>
                <td className="px-4 py-3 text-white font-medium">{inr(p.amount)}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-1 border ${
                    p.status === "completed" || p.status === "success"
                      ? "text-emerald-300 border-emerald-500/30"
                      : p.status === "pending"
                      ? "text-amber-300 border-amber-500/30"
                      : "text-zinc-300 border-zinc-500/30"
                  }`}>{p.status}</span>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}

/* ============ Coupons Panel ============ */
export function CouponsPanel({ token, hotelIds }: { token: string | null; hotelIds: string[] }) {
  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/admin/coupons"],
    queryFn: async () => {
      const res = await fetch("/api/admin/coupons", { headers: authHeaders(token) });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  // Hotel-applicable: coupons with no property restriction OR explicit overlap with hotel ids.
  const hotelSet = new Set(hotelIds);
  const hotelCoupons = coupons.filter(
    (c) => !c.applicablePropertyIds || c.applicablePropertyIds.length === 0 || c.applicablePropertyIds.some((id) => hotelSet.has(id))
  );

  return (
    <div data-testid="panel-coupons">
      <SectionHeader
        icon={Ticket}
        title="Coupons & Promo Codes"
        subtitle={`${hotelCoupons.length} coupons applicable to hotel bookings`}
        action={<GoldButton href="/admin/coupons" testId="button-manage-coupons"><Edit className="w-3 h-3" /> Manage</GoldButton>}
      />
      {isLoading ? (
        <div className="text-center py-8 text-white/40 text-sm">Loading coupons…</div>
      ) : hotelCoupons.length === 0 ? (
        <Empty>No coupons configured. Click "Manage" to create one.</Empty>
      ) : (
        <Table headers={["Code", "Discount", "Used", "Limit", "Valid Until", "Status"]}>
          {hotelCoupons.map((c) => (
            <tr key={c.id} className="border-b border-white/5 hover:bg-white/5" data-testid={`row-coupon-${c.id}`}>
              <td className="px-4 py-3 text-white">
                <div className="font-mono font-bold tracking-wider">{c.code}</div>
                <div className="text-[10px] text-white/50 mt-0.5">{c.name}</div>
              </td>
              <td className="px-4 py-3 text-white/80">
                {c.discountType === "percent" ? `${c.discountValue}%` : inr(c.discountValue)}
              </td>
              <td className="px-4 py-3 text-white/70">{c.usageCount}</td>
              <td className="px-4 py-3 text-white/70">{c.usageLimit ?? "∞"}</td>
              <td className="px-4 py-3 text-white/50 text-xs">{c.validUntil ? fmtDate(c.validUntil) : "No expiry"}</td>
              <td className="px-4 py-3">
                <span className={`text-[10px] uppercase tracking-widest px-2 py-1 border ${
                  c.status === "active" ? "text-emerald-300 border-emerald-500/30"
                  : c.status === "paused" ? "text-amber-300 border-amber-500/30"
                  : "text-zinc-300 border-zinc-500/30"
                }`}>{c.status}</span>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

/* ============ Staff Panel ============ */
export function StaffPanel({ token, hotels }: { token: string | null; hotels: Property[] }) {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { headers: authHeaders(token) });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const hotelStaff = users.filter((u) => u.role === "hotel_admin" || u.role === "hotel_staff");
  const hotelMap = new Map(hotels.map((h) => [h.id, h]));

  const deactivate = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}/deactivate`, { method: "POST", headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}/reactivate`, { method: "POST", headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  return (
    <div data-testid="panel-staff">
      <SectionHeader
        icon={UserCog}
        title="Hotel Staff"
        subtitle={`${hotelStaff.length} hotel admins & staff members`}
        action={<GoldButton href="/admin/users" testId="button-manage-staff"><Plus className="w-3 h-3" /> Add / Manage</GoldButton>}
      />
      {isLoading ? (
        <div className="text-center py-8 text-white/40 text-sm">Loading staff…</div>
      ) : hotelStaff.length === 0 ? (
        <Empty>No hotel staff yet. Click "Add / Manage" to create accounts with the hotel_admin or hotel_staff role.</Empty>
      ) : (
        <Table headers={["Name", "Email", "Role", "Assigned Hotels", "Status", "Actions"]}>
          {hotelStaff.map((u) => {
            const assigned = (u.assignedPropertyIds || []).map((id) => hotelMap.get(id)?.name).filter(Boolean) as string[];
            return (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/5" data-testid={`row-staff-${u.id}`}>
                <td className="px-4 py-3 text-white font-medium">{u.fullName || u.username}</td>
                <td className="px-4 py-3 text-white/70 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="text-[10px] uppercase tracking-widest px-2 py-1 border border-white/15 text-white/70">
                    {u.role.replace("hotel_", "")}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/70 text-xs">
                  {assigned.length === 0 ? <span className="text-white/40">All hotels</span> : assigned.join(", ")}
                </td>
                <td className="px-4 py-3">
                  {u.isActive === false ? (
                    <span className="text-[10px] uppercase tracking-widest text-zinc-400 border border-zinc-500/30 px-2 py-1">Inactive</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest text-emerald-300 border border-emerald-500/30 px-2 py-1">Active</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.isActive === false ? (
                    <GhostButton onClick={() => reactivate.mutate(u.id)} testId={`button-reactivate-${u.id}`}>Reactivate</GhostButton>
                  ) : (
                    <GhostButton onClick={() => { if (confirm(`Deactivate ${u.fullName || u.username}?`)) deactivate.mutate(u.id); }} testId={`button-deactivate-${u.id}`}>
                      Deactivate
                    </GhostButton>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}

/* ============ Reports Panel ============ */
export function ReportsPanel({ hotelBookings, stats }: { hotelBookings: Booking[]; stats?: { occupancyPercent?: number; monthRevenue?: number; totalRooms?: number; occupiedRooms?: number } }) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const completed = hotelBookings.filter((b) => b.status === "confirmed" || b.status === "completed" || b.status === "checked_in" || b.status === "checked_out");

  const revenue30 = completed.filter((b) => now - new Date(b.createdAt).getTime() < 30 * day).reduce((s, b) => s + (b.totalFee || 0), 0);
  const revenue60 = completed.filter((b) => now - new Date(b.createdAt).getTime() < 60 * day).reduce((s, b) => s + (b.totalFee || 0), 0);
  const revenue90 = completed.filter((b) => now - new Date(b.createdAt).getTime() < 90 * day).reduce((s, b) => s + (b.totalFee || 0), 0);

  // ADR = avg booking total / nights. Estimate nights from checkIn/Out where present, default 1.
  const nightsTotal = completed.reduce((s, b) => {
    if (b.checkInDate && b.checkOutDate) {
      const n = Math.max(1, Math.round((new Date(b.checkOutDate).getTime() - new Date(b.checkInDate).getTime()) / day));
      return s + n;
    }
    return s + 1;
  }, 0);
  const grossRevenue = completed.reduce((s, b) => s + (b.totalFee || 0), 0);
  const adr = nightsTotal > 0 ? Math.round(grossRevenue / nightsTotal) : 0;
  // RevPAR = revenue / available room-nights (rooms * days in window). Use 30d window.
  const totalRooms = stats?.totalRooms || 0;
  const revpar = totalRooms > 0 ? Math.round(revenue30 / (totalRooms * 30)) : 0;

  function exportCsv() {
    const rows = [
      ["Booking Code", "Guest", "Property ID", "Check-In", "Check-Out", "Total Fee", "Status", "Created"],
      ...hotelBookings.map((b) => [
        b.bookingCode || b.id,
        b.walkInName || "Guest",
        b.propertyId,
        b.checkInDate || "",
        b.checkOutDate || "",
        String(b.totalFee || 0),
        b.status,
        b.createdAt,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hotels-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const Stat = ({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: any }) => (
    <div className="p-5 border border-white/10" style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
        <Icon className="w-4 h-4" style={{ color: "#c5a059" }} />
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  );

  return (
    <div data-testid="panel-reports">
      <SectionHeader
        icon={BarChart3}
        title="Reports & Analytics"
        subtitle="Performance metrics across all hotel properties"
        action={<GoldButton onClick={exportCsv} testId="button-export-csv"><Download className="w-3 h-3" /> Export CSV</GoldButton>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <Stat label="Occupancy" value={`${stats?.occupancyPercent ?? 0}%`} sub={`${stats?.occupiedRooms ?? 0} / ${stats?.totalRooms ?? 0} rooms`} icon={BedDouble} />
        <Stat label="ADR (Avg Daily Rate)" value={inr(adr)} sub={`across ${nightsTotal} room-nights`} icon={IndianRupee} />
        <Stat label="RevPAR (30d)" value={inr(revpar)} sub="revenue per available room" icon={TrendingUp} />
        <Stat label="Revenue · 30d" value={inr(revenue30)} icon={Calendar} />
        <Stat label="Revenue · 60d" value={inr(revenue60)} icon={Calendar} />
        <Stat label="Revenue · 90d" value={inr(revenue90)} icon={Calendar} />
      </div>
      <div className="p-5 border border-white/10" style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white text-sm font-medium">Booking Status Breakdown</h4>
          <CheckCircle2 className="w-4 h-4 text-white/40" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {["pending", "confirmed", "checked_in", "checked_out", "cancelled"].map((s) => {
            const count = hotelBookings.filter((b) => b.status === s).length;
            return (
              <div key={s} className="text-center py-3 border border-white/5">
                <div className="text-2xl font-bold text-white">{count}</div>
                <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">{s.replace("_", " ")}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============ Settings Panel ============ */
export function SettingsPanel({ userRole }: { userRole: string }) {
  const isSuper = userRole === "superadmin";
  const { flags } = useFeatureFlags();
  const setFlag = useSetFeatureFlag();
  const { getContent } = useSiteContent();
  const setContent = useSetSiteContent();

  const SCROLL_KEY = "hotels_scrollreact";
  const scroll = getContent<{ videoUrl?: string }>(SCROLL_KEY, { videoUrl: "" });
  const [videoUrl, setVideoUrl] = useState<string>(scroll.videoUrl || "");
  const [msg, setMsg] = useState<string>("");

  const hotelsPublic = !!flags.hotels_public;

  async function toggleHotelsPublic() {
    if (!isSuper) return;
    try {
      await setFlag.mutateAsync({ key: "hotels_public", enabled: !hotelsPublic });
      setMsg(`Hotels portal is now ${!hotelsPublic ? "PUBLIC" : "HIDDEN"}.`);
    } catch (e: any) {
      setMsg(`Failed: ${e?.message || "unknown error"}`);
    }
  }

  async function removeVideo() {
    setVideoUrl("");
    try {
      await setContent.mutateAsync({ key: SCROLL_KEY, value: { ...scroll, videoUrl: "" } });
      setMsg("Cinematic video removed. Default flower sequence is back.");
    } catch (e: any) {
      setMsg(`Failed: ${e?.message || "unknown error"}`);
    }
  }

  return (
    <div data-testid="panel-settings" className="max-w-3xl">
      <SectionHeader icon={SettingsIcon} title="Hotels Settings" subtitle="Configuration scoped to the hotels portal" />

      {msg && <div className="mb-4 p-3 border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs">{msg}</div>}

      {/* Public visibility */}
      <div className="p-5 border border-white/10 mb-4" style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-white font-medium mb-1">Public visibility</div>
            <p className="text-white/50 text-xs leading-relaxed">
              When ON, anyone can browse the /hotels portal. When OFF, public visitors see a "Coming Soon" page; admins and hotel staff always see the live portal.
            </p>
          </div>
          <button
            onClick={toggleHotelsPublic}
            disabled={!isSuper || setFlag.isPending}
            className="flex-shrink-0 disabled:opacity-40"
            data-testid="toggle-hotels-public"
          >
            {hotelsPublic ? (
              <ToggleRight className="w-12 h-12" style={{ color: "#c5a059" }} />
            ) : (
              <ToggleLeft className="w-12 h-12 text-white/30" />
            )}
          </button>
        </div>
        {!isSuper && <p className="text-[10px] uppercase tracking-widest text-white/30 mt-3">Superadmin only</p>}
      </div>

      {/* Cinematic video uploader */}
      <div className="p-5 border border-white/10 mb-4" style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}>
        <div className="text-white font-medium mb-1 flex items-center gap-2"><Film className="w-4 h-4" style={{ color: "#c5a059" }} /> Cinematic section background</div>
        <p className="text-white/50 text-xs leading-relaxed mb-4">
          Upload an MP4 / WebM video to replace the default flower sequence on the hotels homepage scroll-cinematic section. Recommended: 1080p, under 50 MB, plays muted on loop.
        </p>
        {videoUrl ? (
          <div className="border border-white/10 overflow-hidden bg-black mb-3">
            <video src={videoUrl} className="w-full max-h-64 object-contain bg-black" controls muted playsInline data-testid="video-preview" />
            <div className="flex items-center justify-between px-3 py-2 border-t border-white/10">
              <span className="text-xs text-white/50 truncate font-mono">{videoUrl}</span>
              <button onClick={removeVideo} disabled={!isSuper} className="text-xs text-red-300 hover:text-red-200 inline-flex items-center gap-1 disabled:opacity-40" data-testid="button-remove-video">
                <X className="w-3 h-3" /> Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-white/15 px-4 py-6 text-center mb-3">
            <Film className="w-8 h-8 mx-auto text-white/30 mb-2" />
            <p className="text-sm text-white/50">No custom video — using the default flower sequence.</p>
          </div>
        )}
        {isSuper ? (
          <ObjectUploader
            maxNumberOfFiles={1}
            maxFileSize={52428800}
            onGetUploadParameters={async (file) => {
              const res = await fetch("/api/uploads/request-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
              });
              const data = await res.json();
              (file as any).objectPath = data.objectPath;
              return {
                method: "PUT",
                url: data.uploadURL,
                headers: { "Content-Type": (file.type as string) || "video/mp4" },
              };
            }}
            onComplete={async (result) => {
              const f = result.successful?.[0];
              const objectPath = (f as any)?.objectPath;
              if (!objectPath) return;
              setVideoUrl(objectPath);
              try {
                await setContent.mutateAsync({ key: SCROLL_KEY, value: { ...scroll, videoUrl: objectPath } });
                setMsg("Video uploaded. Visitors will now see your custom video on /hotels.");
              } catch (e: any) {
                setMsg(`Saved upload, failed to update: ${e?.message || ""}`);
              }
            }}
            buttonClassName="w-full text-black font-semibold py-3 inline-flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest"
          >
            <Upload className="w-4 h-4" /> {videoUrl ? "Replace video" : "Upload video"}
          </ObjectUploader>
        ) : (
          <p className="text-[10px] uppercase tracking-widest text-white/30">Superadmin only</p>
        )}
      </div>

      {/* Theme defaults info */}
      <div className="p-5 border border-white/10" style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}>
        <div className="text-white font-medium mb-1">Theme defaults</div>
        <p className="text-white/50 text-xs leading-relaxed">
          The Hotels portal supports three themes — <span className="text-white/80">dark</span> (default luxury), <span className="text-white/80">light</span> (warm ivory), and <span className="text-white/80">studio</span> (cinematic AI-agency aesthetic). Each visitor's theme choice is saved in their browser. The default for new visitors is "dark".
        </p>
      </div>
    </div>
  );
}
