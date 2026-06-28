import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";

export type ModuleKey =
  | "dashboard" | "requests" | "registrations" | "team" | "sales_management"
  | "leads" | "bookings" | "all_bookings" | "cancellations" | "calendar"
  | "reports" | "activity_log" | "tour_images" | "virtual_tour" | "floors_beds"
  | "booking_tree" | "housing_plans" | "coupons" | "addon_services" | "seasons"
  | "hms_sync" | "hero_slides" | "amenities" | "map_design" | "footer"
  | "ai_chatbot" | "contact_messages" | "data_export" | "settings"
  | "view_financials";

export type AllModulePermissions = Record<string, Record<string, boolean>>;

export function useModulePermissions() {
  const { token, user } = useAuth();

  const { data, isLoading } = useQuery<AllModulePermissions>({
    queryKey: ["/api/admin/module-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/module-permissions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!token && !!user && ["admin","superadmin","manager","frontdesk","staff","sales_executive"].includes(user.role || ""),
    staleTime: 60 * 1000,
  });

  const role = user?.role || "";
  const isSuperAdmin = role === "superadmin";

  // Superadmin always has access to everything
  const perms: Record<string, boolean> = isSuperAdmin
    ? {}
    : (data?.[role] || {});

  const can = (module: ModuleKey): boolean => {
    if (isSuperAdmin) return true;
    // If no permissions loaded yet, default to true (fail open = don't flash-hide)
    if (!data || !data[role]) return true;
    return perms[module] !== false;
  };

  const canViewFinancials = can("view_financials");

  return { can, canViewFinancials, allPermissions: data || {}, isLoading };
}

export function useSetModulePermissions() {
  const { token } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ role, permissions }: { role: string; permissions: Record<string, boolean> }) => {
      const res = await fetch(`/api/admin/module-permissions/${role}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error("Failed to update permissions");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/module-permissions"] });
    },
  });
}
