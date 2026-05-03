import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";

export type SiteContentMap = Record<string, unknown>;

const KEY = ["/api/site-content"] as const;

/**
 * Read all site content. Public endpoint; cached for 60s.
 * Use `getContent(key, fallback)` for type-safe access with defaults.
 */
export function useSiteContent() {
  const { data, isLoading, error } = useQuery<SiteContentMap>({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch("/api/site-content", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load site content");
      return res.json();
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const content: SiteContentMap = data || {};

  function getContent<T>(key: string, fallback: T): T {
    const v = content[key];
    if (v == null) return fallback;
    if (typeof fallback === "object" && fallback !== null && !Array.isArray(fallback)) {
      return { ...(fallback as object), ...(v as object) } as T;
    }
    return v as T;
  }

  return { content, getContent, isLoading, error };
}

/** Superadmin-only mutation to set a site-content value (any JSON). */
export function useSetSiteContent() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const res = await fetch(`/api/site-content/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || "Failed to update content");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
