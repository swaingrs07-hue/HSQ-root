import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

interface Property {
  id: string;
  name: string;
  location: string;
  city?: string;
  status: string;
  active: boolean;
}

interface PropertyContextType {
  selectedPropertyId: string | null;
  selectedProperty: Property | null;
  properties: Property[];
  isLoading: boolean;
  recentPropertyIds: string[];
  pinnedPropertyIds: string[];
  setSelectedProperty: (propertyId: string | null) => void;
  togglePinProperty: (propertyId: string) => void;
  clearSelection: () => void;
}

const PropertyContext = createContext<PropertyContextType | null>(null);

const STORAGE_KEY = "hsquare_selected_property";
const RECENT_KEY = "hsquare_recent_properties";
const PINNED_KEY = "hsquare_pinned_properties";
const MAX_RECENT = 5;

export function PropertyProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, token } = useAuth();
  
  const isSalesExec = user?.role === "sales_executive";
  const isReceptionist = user?.role === "receptionist";
  const needsAuthFetch = isSalesExec || isReceptionist;
  const propertiesEndpoint = isSalesExec
    ? "/api/sales/properties"
    : isReceptionist
      ? "/api/staff/properties"
      : "/api/properties";
  
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && stored !== "null" ? stored : null;
  });
  
  const [recentPropertyIds, setRecentPropertyIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  
  const [pinnedPropertyIds, setPinnedPropertyIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(PINNED_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: [propertiesEndpoint, user?.id || "anonymous"],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      if (needsAuthFetch && token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(propertiesEndpoint, { headers });
      if (!res.ok) throw new Error("Failed to fetch properties");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !needsAuthFetch || !!token,
  });

  const selectedProperty = selectedPropertyId
    ? properties.find((p) => p.id === selectedPropertyId) || null
    : null;

  useEffect(() => {
    if (selectedPropertyId && properties.length > 0 && !properties.find((p) => p.id === selectedPropertyId)) {
      setSelectedPropertyId(null);
      localStorage.setItem(STORAGE_KEY, "null");
    }
  }, [selectedPropertyId, properties]);

  const setSelectedProperty = useCallback((propertyId: string | null) => {
    const previousId = selectedPropertyId;
    setSelectedPropertyId(propertyId);
    localStorage.setItem(STORAGE_KEY, propertyId || "null");

    if (propertyId && propertyId !== previousId) {
      setRecentPropertyIds((prev) => {
        const updated = [propertyId, ...prev.filter((id) => id !== propertyId)].slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
        return updated;
      });
    }

    queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/sales-executives"] });
    queryClient.invalidateQueries({ queryKey: ["/api/leads/analytics"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });

    const property = propertyId ? properties.find((p) => p.id === propertyId) : null;
    toast({
      title: propertyId ? `Switched to ${property?.name || "Property"}` : "Viewing All Properties",
      duration: 2000,
    });
  }, [selectedPropertyId, properties, queryClient, toast]);

  const togglePinProperty = useCallback((propertyId: string) => {
    setPinnedPropertyIds((prev) => {
      const updated = prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId];
      localStorage.setItem(PINNED_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedProperty(null);
  }, [setSelectedProperty]);

  return (
    <PropertyContext.Provider
      value={{
        selectedPropertyId,
        selectedProperty,
        properties,
        isLoading,
        recentPropertyIds,
        pinnedPropertyIds,
        setSelectedProperty,
        togglePinProperty,
        clearSelection,
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error("useProperty must be used within a PropertyProvider");
  }
  return context;
}
