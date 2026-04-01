import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export type UserRole = "user" | "admin" | "superadmin" | "manager" | "staff" | "sales_executive" | "receptionist";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phoneVerified?: boolean;
  role: UserRole;
  avatarUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; redirectPath?: string }>;
  signup: (name: string, email: string, phone: string, password: string) => Promise<{ success: boolean; error?: string; redirectPath?: string }>;
  logout: () => void;
  getRedirectPath: () => string;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

const PUBLIC_ROUTES = ["/login", "/auth", "/admin/login"];
const BROWSABLE_ROUTES = ["/", "/properties", "/search", "/about", "/contact"];
const STORAGE_KEY = "hsquare_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    
    const isAuthRoute = PUBLIC_ROUTES.some(route => location.startsWith(route));
    const isBrowsableRoute = BROWSABLE_ROUTES.some(route => 
      location === route || location.startsWith(route + "/")
    );
    const isAdminRoute = location.startsWith("/admin");
    const isOperationsRoute = location.startsWith("/operations");
    const isSalesRoute = location.startsWith("/sales");
    const isDashboardRoute = location.startsWith("/dashboard");
    const isBookingsRoute = location.startsWith("/bookings");
    const isProfileRoute = location.startsWith("/profile");
    
    const isProtectedRoute = isAdminRoute || isOperationsRoute || isSalesRoute || isDashboardRoute || isBookingsRoute || isProfileRoute;
    
    const hasPendingRedirect = !!localStorage.getItem("post_login_redirect");
    if (!user && isAuthRoute && !hasPendingRedirect) {
      setLocation("/");
      return;
    }
    
    // Redirect to auth only for protected routes when not logged in
    if (!isAuthRoute && !isBrowsableRoute && isProtectedRoute && !user) {
      setLocation("/auth");
      return;
    }

    if (user && (user.role === "admin" || user.role === "superadmin") && isAuthRoute) {
      setLocation("/admin");
      return;
    }

    if (user && user.role === "receptionist" && isAuthRoute) {
      setLocation("/admin");
      return;
    }

    if (user && user.role === "receptionist" && (location.includes("/add-property") || location.includes("/settings") || location.includes("/users") || location.includes("/hero-slides") || location.includes("/footer-settings") || location.includes("/logo-control") || location.includes("/amenities") || location.includes("/data-export") || location.includes("/hms-sync") || location.includes("/packages") || location.includes("/addon-services") || location.includes("/seasons") || location.includes("/leads") || location.includes("/lead-analytics") || location.includes("/sales-management") || location.includes("/activity-logs") || location.includes("/ai-chatbot") || location.includes("/virtual-tour"))) {
      setLocation("/admin");
      return;
    }

    if (user && isAdminRoute && user.role !== "admin" && user.role !== "superadmin" && user.role !== "receptionist") {
      setLocation(getRedirectPath());
      return;
    }

    if (user && isOperationsRoute && !["admin", "superadmin", "manager", "staff"].includes(user.role)) {
      setLocation(getRedirectPath());
      return;
    }

    if (user && isSalesRoute && !["admin", "superadmin", "sales_executive"].includes(user.role)) {
      setLocation(getRedirectPath());
    }
  }, [location, user, isLoading, setLocation]);

  async function initializeAuth() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setIsLoading(false);
        return;
      }

      const { token: storedToken } = JSON.parse(stored);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setToken(storedToken);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<{ success: boolean; error?: string; redirectPath?: string }> {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Login failed" };
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: data.token }));

      return { success: true, redirectPath: data.redirectPath };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  async function signup(name: string, email: string, phone: string, password: string): Promise<{ success: boolean; error?: string; redirectPath?: string }> {
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || "Signup failed" };
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: data.token }));

      return { success: true, redirectPath: data.redirectPath };
    } catch (error) {
      console.error("Signup error:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
    queryClient.clear();
    setLocation("/auth");
  }

  async function refetchUser(): Promise<void> {
    if (!token) return;
    try {
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error("Error refetching user:", error);
    }
  }

  function getRedirectPath(): string {
    if (!user) return "/auth";
    switch (user.role) {
      case "superadmin":
      case "admin":
      case "receptionist":
        return "/admin";
      case "manager":
      case "staff":
        return "/operations";
      case "sales_executive":
        return "/sales";
      case "user":
      default:
        return "/dashboard";
    }
  }

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user,
      token,
      isAuthenticated, 
      isAdmin, 
      isLoading, 
      login,
      signup,
      logout,
      getRedirectPath,
      refetchUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
