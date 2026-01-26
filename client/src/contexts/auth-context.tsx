import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

export type UserRole = "user" | "admin" | "manager" | "staff" | "sales_executive";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phoneVerified?: boolean;
  role: UserRole;
  isActive: boolean;
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
const STORAGE_KEY = "hsquare_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    
    const isPublicRoute = PUBLIC_ROUTES.some(route => location.startsWith(route));
    const isAdminRoute = location.startsWith("/admin");
    const isOperationsRoute = location.startsWith("/operations");
    const isSalesRoute = location.startsWith("/sales");
    
    if (!isPublicRoute && !user) {
      setLocation("/auth");
      return;
    }

    if (user && isAdminRoute && user.role !== "admin") {
      setLocation(getRedirectPath());
      return;
    }

    if (user && isOperationsRoute && !["admin", "manager", "staff"].includes(user.role)) {
      setLocation(getRedirectPath());
      return;
    }

    if (user && isSalesRoute && !["admin", "sales_executive"].includes(user.role)) {
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
    setLocation("/auth");
  }

  function getRedirectPath(): string {
    if (!user) return "/auth";
    switch (user.role) {
      case "admin":
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
  const isAdmin = user?.role === "admin";

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
    }}>
      {children}
    </AuthContext.Provider>
  );
}
