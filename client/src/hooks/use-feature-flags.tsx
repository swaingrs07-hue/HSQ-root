import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";

export type FeatureFlagMap = Record<string, boolean>;

const FLAGS_KEY = ["/api/feature-flags"] as const;

/**
 * Read all feature flags. Public endpoint (no auth required) so the gate can
 * run before the user is loaded. Cached for 60s to avoid re-fetching on every
 * route change.
 */
export function useFeatureFlags() {
  const { data, isLoading, error } = useQuery<FeatureFlagMap>({
    queryKey: FLAGS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/feature-flags", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load feature flags");
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const flags: FeatureFlagMap = data || {};
  return {
    flags,
    isLoading,
    error,
    isHotelsPublic: !!flags.hotels_public,
    // bookings_enabled defaults true — false means only admins/staff can book
    isBookingsEnabled: flags.bookings_enabled !== false,
    // show_floor_selection defaults false — only shown to public users when superadmin enables it
    isFloorSelectionPublic: !!flags.show_floor_selection,
  };
}

/**
 * Superadmin-only mutation to toggle a feature flag.
 */
export function useSetFeatureFlag() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const res = await fetch(`/api/feature-flags/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to update flag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FLAGS_KEY });
    },
  });
}
