import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import {
  LayoutDashboard, IndianRupee, BedDouble, Calendar, Sparkles,
  Users, AlertCircle, CheckCircle2, Clock, ArrowRight, Plus,
  Building2, TrendingUp, Filter,
} from "lucide-react";

interface DashboardStats {
  todayCheckIns: number;
  todayCheckOuts: number;
  occupancyPercent: number;
  monthRevenue: number;
  totalRooms: number;
  occupiedRooms: number;
  pendingHousekeeping: number;
  activeBookings: number;
}

interface HousekeepingTask {
  id: string;
  propertyId: string;
  roomId?: string | null;
  roomLabel?: string | null;
  taskType: string;
  status: string;
  priority: string;
  assignedTo?: string | null;
  scheduledFor?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface Property {
  id: string;
  name: string;
  slug?: string | null;
  category?: string | null;
  location: string;
}

interface Booking {
  id: string;
  bookingCode?: string | null;
  customerType?: string | null;
  walkInName?: string | null;
  propertyId: string;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  totalFee: number;
  status: string;
  createdAt: string;
}

const STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
};

const PRIORITY_PILL: Record<string, string> = {
  low: "text-zinc-400",
  normal: "text-white/70",
  high: "text-amber-400",
  urgent: "text-red-400",
};

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export default function HotelsDashboard() {
  const { user, token, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const isAdminLevel = user && ["admin", "superadmin", "hotel_admin"].includes(user.role);
  const isStaff = user?.role === "hotel_staff";
  const hasAccess = isAdminLevel || isStaff;

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
    else if (!isLoading && user && !hasAccess) navigate("/hotels");
  }, [user, isLoading, hasAccess, navigate]);

  if (isLoading || !user) {
    return (
      <div className="pt-32 pb-24 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!hasAccess) return null;

  return isAdminLevel ? (
    <AdminView token={token} userId={user.id} />
  ) : (
    <StaffView token={token} userId={user.id} />
  );
}

/* ============ Admin View ============ */
function AdminView({ token, userId }: { token: string | null; userId: string }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "bookings" | "rooms" | "housekeeping">("overview");
  const [showCreateTask, setShowCreateTask] = useState(false);

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/hotels/dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/hotels/dashboard-stats", { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });
  const hotels = properties.filter((p) => p.category === "hotel");

  const { data: tasks = [] } = useQuery<HousekeepingTask[]>({
    queryKey: ["/api/housekeeping/tasks"],
    queryFn: async () => {
      const res = await fetch("/api/housekeeping/tasks", { headers: authHeaders(token) });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["/api/bookings/completed"],
    queryFn: async () => {
      const res = await fetch("/api/bookings/completed", { headers: authHeaders(token) });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.bookings || [];
    },
    enabled: !!token,
  });

  const hotelBookings = bookings.filter((b) => hotels.some((h) => h.id === b.propertyId)).slice(0, 25);

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24 px-4 sm:px-6 min-h-screen" data-testid="hotels-admin-view">
      <div className="container mx-auto">
        <div className="mb-8 sm:mb-10 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end justify-between gap-4 sm:gap-6">
          <div>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] mb-2 sm:mb-3" style={{ color: "#c5a059" }}>◇ Hotels Operations</p>
            <h1 className="hotels-display text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl">Admin Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 text-[11px] uppercase tracking-widest w-full sm:w-auto">
            <Link href="/hotels" className="px-4 sm:px-5 py-2.5 border border-white/15 text-white/70 hover:text-white flex-1 sm:flex-none text-center">Guest View</Link>
            <button
              onClick={() => setShowCreateTask(true)}
              className="px-4 sm:px-5 py-2.5 text-black font-semibold inline-flex items-center justify-center gap-2 flex-1 sm:flex-none"
              style={{ backgroundColor: "#c5a059" }}
              data-testid="button-new-housekeeping-task"
            >
              <Plus className="w-3 h-3" /> New Task
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10" data-testid="stat-cards">
          <StatCard icon={Calendar} label="Today's Check-Ins" value={stats?.todayCheckIns ?? 0} testId="stat-checkins" />
          <StatCard icon={BedDouble} label="Occupancy" value={`${stats?.occupancyPercent ?? 0}%`} sub={`${stats?.occupiedRooms ?? 0} / ${stats?.totalRooms ?? 0} rooms`} testId="stat-occupancy" />
          <StatCard icon={IndianRupee} label="Revenue (30d)" value={`₹${(stats?.monthRevenue ?? 0).toLocaleString("en-IN")}`} testId="stat-revenue" />
          <StatCard icon={Sparkles} label="Pending Cleaning" value={stats?.pendingHousekeeping ?? 0} testId="stat-pending-housekeeping" />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6 sm:mb-8 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 scrollbar-hide">
          {(["overview", "bookings", "rooms", "housekeeping"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 sm:px-6 py-3 text-[11px] sm:text-xs uppercase tracking-widest transition-colors whitespace-nowrap ${
                activeTab === tab ? "text-white border-b-2" : "text-white/40 hover:text-white/70"
              }`}
              style={activeTab === tab ? { borderColor: "#c5a059" } : {}}
              data-testid={`tab-${tab}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <OverviewPanel hotels={hotels} bookings={hotelBookings} tasks={tasks} />
        )}
        {activeTab === "bookings" && (
          <BookingsPanel bookings={hotelBookings} hotels={hotels} />
        )}
        {activeTab === "rooms" && (
          <RoomsPanel hotels={hotels} />
        )}
        {activeTab === "housekeeping" && (
          <HousekeepingPanel tasks={tasks} hotels={hotels} token={token} mineOnly={false} userId={userId} />
        )}
      </div>

      {showCreateTask && (
        <CreateTaskModal token={token} hotels={hotels} userId={userId} onClose={() => setShowCreateTask(false)} />
      )}
    </div>
  );
}

/* ============ Staff View ============ */
function StaffView({ token, userId }: { token: string | null; userId: string }) {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/hotels/dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/hotels/dashboard-stats", { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!token,
  });

  const { data: tasks = [] } = useQuery<HousekeepingTask[]>({
    queryKey: ["/api/housekeeping/tasks", "mine"],
    queryFn: async () => {
      const res = await fetch(`/api/housekeeping/tasks?assignedTo=${userId}`, { headers: authHeaders(token) });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const { data: properties = [] } = useQuery<Property[]>({ queryKey: ["/api/properties"] });
  const hotels = properties.filter((p) => p.category === "hotel");

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24 px-4 sm:px-6 min-h-screen" data-testid="hotels-staff-view">
      <div className="container mx-auto">
        <div className="mb-8 sm:mb-10 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end justify-between gap-4 sm:gap-6">
          <div>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] mb-2 sm:mb-3" style={{ color: "#c5a059" }}>◇ Today's Shift</p>
            <h1 className="hotels-display text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl">Staff Dashboard</h1>
          </div>
          <Link href="/hotels" className="px-4 sm:px-5 py-2.5 border border-white/15 text-white/70 hover:text-white text-[11px] uppercase tracking-widest w-full sm:w-auto text-center">
            Guest View
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
          <StatCard icon={Calendar} label="My Check-Ins Today" value={stats?.todayCheckIns ?? 0} />
          <StatCard icon={Clock} label="My Check-Outs Today" value={stats?.todayCheckOuts ?? 0} />
          <StatCard icon={Sparkles} label="My Tasks Today" value={tasks.filter((t) => t.status !== "completed").length} />
          <StatCard icon={CheckCircle2} label="Completed" value={tasks.filter((t) => t.status === "completed").length} />
        </div>

        <h2 className="hotels-heading text-white text-xl sm:text-2xl mb-4 sm:mb-6">My Housekeeping Tasks</h2>
        <HousekeepingPanel tasks={tasks} hotels={hotels} token={token} mineOnly userId={userId} />
      </div>
    </div>
  );
}

/* ============ Stat Card ============ */
function StatCard({ icon: Icon, label, value, sub, testId }: { icon: any; label: string; value: string | number; sub?: string; testId?: string }) {
  return (
    <div
      className="p-4 sm:p-6 border border-white/10 hover:border-amber-500/30 transition-colors"
      style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: "#c5a059" }} />
      </div>
      <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 break-words">{value}</div>
      <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/50 leading-tight">{label}</div>
      {sub && <div className="text-[10px] sm:text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  );
}

/* ============ Overview Panel ============ */
function OverviewPanel({ hotels, bookings, tasks }: { hotels: Property[]; bookings: Booking[]; tasks: HousekeepingTask[] }) {
  const recentBookings = bookings.slice(0, 5);
  const urgentTasks = tasks.filter((t) => t.status !== "completed" && (t.priority === "high" || t.priority === "urgent")).slice(0, 5);

  return (
    <div className="grid lg:grid-cols-2 gap-4 sm:gap-6" data-testid="overview-panel">
      <div className="p-4 sm:p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h3 className="hotels-heading text-base sm:text-lg text-white">Recent Bookings</h3>
          <Link href="#" className="text-[10px] uppercase tracking-widest text-amber-400">View all</Link>
        </div>
        {recentBookings.length === 0 ? (
          <p className="text-white/40 text-sm">No recent hotel bookings.</p>
        ) : (
          <div className="space-y-3">
            {recentBookings.map((b) => {
              const property = hotels.find((h) => h.id === b.propertyId);
              return (
                <div key={b.id} className="flex items-center justify-between p-3 border border-white/5">
                  <div className="min-w-0">
                    <div className="text-white text-sm truncate">{b.walkInName || b.bookingCode || "Booking"}</div>
                    <div className="text-white/40 text-xs">{property?.name || "—"} · {b.checkInDate || "TBD"}</div>
                  </div>
                  <div className="text-amber-400 text-sm font-semibold whitespace-nowrap">₹{b.totalFee.toLocaleString("en-IN")}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h3 className="hotels-heading text-base sm:text-lg text-white">Urgent Tasks</h3>
          <span className="text-[10px] uppercase tracking-widest text-amber-400">{urgentTasks.length} flagged</span>
        </div>
        {urgentTasks.length === 0 ? (
          <p className="text-white/40 text-sm">All clear — no urgent tasks pending.</p>
        ) : (
          <div className="space-y-3">
            {urgentTasks.map((t) => {
              const property = hotels.find((h) => h.id === t.propertyId);
              return (
                <div key={t.id} className="flex items-center justify-between p-3 border border-white/5">
                  <div>
                    <div className="text-white text-sm capitalize">{t.taskType.replace("_", " ")} · {t.roomLabel || "Room"}</div>
                    <div className="text-white/40 text-xs">{property?.name || "—"}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-widest ${PRIORITY_PILL[t.priority]}`}>{t.priority}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ Bookings Panel ============ */
function BookingsPanel({ bookings, hotels }: { bookings: Booking[]; hotels: Property[] }) {
  if (bookings.length === 0) {
    return <p className="text-white/40 text-center py-16">No hotel bookings yet.</p>;
  }
  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden md:block border border-white/10 overflow-x-auto" data-testid="bookings-panel">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-white/40 border-b border-white/10">
              <th className="text-left p-4">Guest</th>
              <th className="text-left p-4">Property</th>
              <th className="text-left p-4">Check In</th>
              <th className="text-left p-4">Check Out</th>
              <th className="text-right p-4">Amount</th>
              <th className="text-left p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const property = hotels.find((h) => h.id === b.propertyId);
              return (
                <tr key={b.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4 text-white text-sm">{b.walkInName || b.bookingCode || "—"}</td>
                  <td className="p-4 text-white/70 text-sm">{property?.name || "—"}</td>
                  <td className="p-4 text-white/60 text-sm">{b.checkInDate || "TBD"}</td>
                  <td className="p-4 text-white/60 text-sm">{b.checkOutDate || "TBD"}</td>
                  <td className="p-4 text-amber-400 text-sm font-semibold text-right">₹{b.totalFee.toLocaleString("en-IN")}</td>
                  <td className="p-4"><span className="text-[10px] uppercase tracking-widest text-white/60 px-2 py-1 border border-white/10">{b.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3" data-testid="bookings-panel-mobile">
        {bookings.map((b) => {
          const property = hotels.find((h) => h.id === b.propertyId);
          return (
            <div key={b.id} className="border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="text-white font-medium text-sm truncate">{b.walkInName || b.bookingCode || "—"}</div>
                  <div className="text-white/50 text-xs truncate">{property?.name || "—"}</div>
                </div>
                <span className="text-[9px] uppercase tracking-widest text-white/60 px-2 py-1 border border-white/10 whitespace-nowrap">{b.status}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="text-white/50">
                  <span className="text-white/40">In:</span> {b.checkInDate || "TBD"}
                  <span className="mx-2">·</span>
                  <span className="text-white/40">Out:</span> {b.checkOutDate || "TBD"}
                </div>
                <div className="text-amber-400 font-semibold whitespace-nowrap">₹{b.totalFee.toLocaleString("en-IN")}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ============ Rooms Panel ============ */
function RoomsPanel({ hotels }: { hotels: Property[] }) {
  if (hotels.length === 0) {
    return (
      <div className="text-center py-16 border border-white/10" data-testid="rooms-empty">
        <Building2 className="w-12 h-12 mx-auto mb-4 text-white/20" />
        <p className="text-white/50 mb-2">No hotel properties yet.</p>
        <p className="text-white/30 text-sm mb-6">Add a property and set its category to "hotel" to see it here.</p>
        <Link href="/admin/add-property" className="inline-block px-6 py-3 text-black text-xs uppercase tracking-widest font-semibold" style={{ backgroundColor: "#c5a059" }}>
          Add Property
        </Link>
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 gap-3 sm:gap-4" data-testid="rooms-panel">
      {hotels.map((h) => (
        <div key={h.id} className="p-4 sm:p-6 border border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="text-white font-semibold mb-1 truncate">{h.name}</h4>
            <p className="text-white/40 text-xs truncate">{h.location}</p>
          </div>
          <Link href={`/admin/floors-beds`} className="text-amber-400 text-[10px] uppercase tracking-widest inline-flex items-center gap-2 whitespace-nowrap shrink-0">
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ))}
    </div>
  );
}

/* ============ Housekeeping Panel ============ */
function HousekeepingPanel({
  tasks, hotels, token, mineOnly, userId,
}: { tasks: HousekeepingTask[]; hotels: Property[]; token: string | null; mineOnly: boolean; userId: string }) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const updateTask = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/housekeeping/tasks/${id}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      // Invalidate both the admin list and the staff-scoped "mine" query
      queryClient.invalidateQueries({ queryKey: ["/api/housekeeping/tasks"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/hotels/dashboard-stats"] });
    },
  });

  const filtered = tasks.filter((t) => filterStatus === "all" || t.status === filterStatus);

  return (
    <div data-testid="housekeeping-panel">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-2">
          <Filter className="w-3 h-3" /> Filter
        </span>
        {(["all", "pending", "in_progress", "completed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 text-[10px] uppercase tracking-widest border transition-colors ${
              filterStatus === s ? "text-white border-amber-500/50 bg-amber-500/10" : "text-white/50 border-white/10 hover:text-white"
            }`}
            data-testid={`filter-status-${s}`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-white/10">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-white/20" />
          <p className="text-white/50">{mineOnly ? "No tasks assigned to you." : "No tasks."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const property = hotels.find((h) => h.id === t.propertyId);
            return (
              <div
                key={t.id}
                className="p-4 sm:p-5 border border-white/10 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 sm:gap-4 md:items-center"
                data-testid={`task-${t.id}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                    <h4 className="text-white font-medium capitalize">{t.taskType.replace("_", " ")}</h4>
                    <span className={`text-[9px] uppercase tracking-widest ${PRIORITY_PILL[t.priority]}`}>· {t.priority}</span>
                  </div>
                  <p className="text-white/50 text-xs break-words">
                    {property?.name || "—"} · Room {t.roomLabel || "—"}
                    {t.scheduledFor ? ` · ${new Date(t.scheduledFor).toLocaleDateString()}` : ""}
                  </p>
                  {t.notes && <p className="text-white/40 text-xs mt-1 italic break-words">"{t.notes}"</p>}
                </div>
                <div className="flex items-center justify-between md:justify-start gap-3 md:contents">
                  <span className={`px-3 py-1 text-[10px] uppercase tracking-widest border ${STATUS_PILL[t.status] || ""} whitespace-nowrap`}>
                    {t.status.replace("_", " ")}
                  </span>
                  <div className="flex gap-2">
                    {t.status === "pending" && (
                      <button
                        onClick={() => updateTask.mutate({ id: t.id, status: "in_progress" })}
                        className="px-3 sm:px-4 py-2 text-[10px] uppercase tracking-widest text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 whitespace-nowrap"
                        data-testid={`button-start-${t.id}`}
                      >
                        Start
                      </button>
                    )}
                    {t.status === "in_progress" && (
                      <button
                        onClick={() => updateTask.mutate({ id: t.id, status: "completed" })}
                        className="px-3 sm:px-4 py-2 text-[10px] uppercase tracking-widest text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 whitespace-nowrap"
                        data-testid={`button-complete-${t.id}`}
                      >
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============ Create Task Modal ============ */
interface StaffMember {
  id: string;
  name: string;
  email?: string | null;
}

function CreateTaskModal({
  token, hotels, userId, onClose,
}: { token: string | null; hotels: Property[]; userId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [propertyId, setPropertyId] = useState(hotels[0]?.id || "");
  const [roomLabel, setRoomLabel] = useState("");
  const [taskType, setTaskType] = useState("cleaning");
  const [priority, setPriority] = useState("normal");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Fetch hotel staff so admins can assign the task at creation time.
  const { data: staff = [], isLoading: staffLoading } = useQuery<StaffMember[]>({
    queryKey: ["/api/hotels/staff"],
    queryFn: async () => {
      const res = await fetch("/api/hotels/staff", { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Failed to load staff");
      return res.json();
    },
    enabled: !!token,
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/housekeeping/tasks", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          propertyId,
          roomLabel: roomLabel || null,
          taskType,
          priority,
          assignedTo: assignedTo || null,
          notes: notes || null,
          createdBy: userId,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/housekeeping/tasks"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["/api/hotels/dashboard-stats"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4 sm:px-6 py-6 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#0a0a0a] border border-white/10 max-w-md w-full p-6 sm:p-8 my-auto max-h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="create-task-modal"
      >
        <h3 className="hotels-heading text-xl sm:text-2xl text-white mb-5 sm:mb-6">New Housekeeping Task</h3>
        <div className="space-y-4">
          <Field label="Property">
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="w-full bg-transparent text-white p-3 border border-white/10 outline-none" data-testid="select-task-property">
              {hotels.length === 0 && <option value="">No hotel properties available</option>}
              {hotels.map((h) => (
                <option key={h.id} value={h.id} className="bg-black">{h.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Room Label">
            <input value={roomLabel} onChange={(e) => setRoomLabel(e.target.value)} placeholder="e.g. 204" className="w-full bg-transparent text-white p-3 border border-white/10 outline-none placeholder:text-white/30" data-testid="input-task-room" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="w-full bg-transparent text-white p-3 border border-white/10 outline-none" data-testid="select-task-type">
                {["cleaning", "turnover", "deep_clean", "maintenance", "inspection", "linen_change"].map((t) => (
                  <option key={t} value={t} className="bg-black capitalize">{t.replace("_", " ")}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full bg-transparent text-white p-3 border border-white/10 outline-none" data-testid="select-task-priority">
                {["low", "normal", "high", "urgent"].map((p) => (
                  <option key={p} value={p} className="bg-black capitalize">{p}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Assign To">
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full bg-transparent text-white p-3 border border-white/10 outline-none"
              data-testid="select-task-assignee"
              disabled={staffLoading}
            >
              <option value="" className="bg-black">
                {staffLoading ? "Loading staff..." : "Unassigned"}
              </option>
              {staff.map((s) => (
                <option key={s.id} value={s.id} className="bg-black">
                  {s.name}{s.email ? ` (${s.email})` : ""}
                </option>
              ))}
            </select>
            {!staffLoading && staff.length === 0 && (
              <p className="text-[10px] text-white/40 mt-1.5">
                No hotel staff users yet. Add a user with role "hotel_staff" to assign tasks.
              </p>
            )}
          </Field>
          <Field label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-transparent text-white p-3 border border-white/10 outline-none resize-none placeholder:text-white/30" placeholder="Any specific instructions..." data-testid="textarea-task-notes" />
          </Field>
          {createTask.isError && (
            <p className="text-red-400 text-xs flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> Could not create task.</p>
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 py-3 border border-white/10 text-white/70 text-xs uppercase tracking-widest" data-testid="button-cancel-task">
            Cancel
          </button>
          <button
            onClick={() => createTask.mutate()}
            disabled={!propertyId || createTask.isPending}
            className="flex-1 py-3 text-black font-semibold text-xs uppercase tracking-widest disabled:opacity-50"
            style={{ backgroundColor: "#c5a059" }}
            data-testid="button-save-task"
          >
            {createTask.isPending ? "Creating..." : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-2">{label}</label>
      {children}
    </div>
  );
}
