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

export interface UserWithPermissions {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: Record<string, boolean>;
  hasCustom: boolean;
}

// ─── Current user's own effective permissions (user override → role defaults) ─
export function useModulePermissions() {
  const { token, user } = useAuth();

  const { data, isLoading, isSuccess, isError } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/admin/user-permissions/me"],
    queryFn: async () => {
      const res = await fetch("/api/admin/user-permissions/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch permissions");
      return res.json();
    },
    enabled: !!token && !!user,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const isSuperAdmin = user?.role === "superadmin";

  const can = (module: ModuleKey): boolean => {
    if (isSuperAdmin) return true;
    // Fail-open only during the initial load; fail closed if fetch errored or returned no data
    if (isLoading) return true;
    if (!isSuccess || !data) return false;
    return data[module] !== false;
  };

  const canViewFinancials = can("view_financials");

  return { can, canViewFinancials, isLoading, isError };
}

// ─── All users with their permissions (admin settings UI only) ─
export function useAllUserPermissions() {
  const { token } = useAuth();
  return useQuery<UserWithPermissions[]>({
    queryKey: ["/api/admin/user-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/user-permissions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
    staleTime: 30 * 1000,
  });
}

// ─── Save user-specific permissions ─
export function useSetUserPermissions() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: Record<string, boolean> }) => {
      const res = await fetch(`/api/admin/user-permissions/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error("Failed to save permissions");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/user-permissions"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/user-permissions/me"] });
    },
  });
}

// ─── Reset user to role defaults (remove user-specific record) ─
export function useResetUserPermissions() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/user-permissions/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to reset permissions");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/user-permissions"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/user-permissions/me"] });
    },
  });
}

// ─── Legacy: kept for backward-compat with any remaining role-based callers ─
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
