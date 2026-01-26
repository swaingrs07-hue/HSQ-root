import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

interface Visitor {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface Admin {
  id: string;
  email: string;
  role: string;
}

interface AuthContextType {
  visitor: Visitor | null;
  admin: Admin | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  logout: () => void;
  updateActivity: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

const PUBLIC_ROUTES = ["/login", "/admin/login"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const storedVisitor = localStorage.getItem("hsquare_visitor");
    const storedAdmin = localStorage.getItem("hsquare_admin");
    
    if (storedVisitor) {
      try {
        setVisitor(JSON.parse(storedVisitor));
      } catch {
        localStorage.removeItem("hsquare_visitor");
      }
    }
    
    if (storedAdmin) {
      try {
        setAdmin(JSON.parse(storedAdmin));
      } catch {
        localStorage.removeItem("hsquare_admin");
      }
    }
  }, []);

  useEffect(() => {
    const isPublicRoute = PUBLIC_ROUTES.some(route => location.startsWith(route));
    const isAdminRoute = location.startsWith("/admin") && location !== "/admin/login";
    
    if (!isPublicRoute) {
      if (isAdminRoute) {
        if (!admin) {
          setLocation("/admin/login");
        }
      } else {
        if (!visitor && !admin) {
          setLocation("/login");
        }
      }
    }
  }, [location, visitor, admin, setLocation]);

  useEffect(() => {
    if (visitor) {
      const interval = setInterval(() => {
        updateActivity();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [visitor]);

  const updateActivity = async () => {
    if (visitor) {
      try {
        await fetch("/api/auth/visitor/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: visitor.id }),
        });
      } catch (error) {
        console.error("Failed to update activity:", error);
      }
    }
  };

  const logout = () => {
    setVisitor(null);
    setAdmin(null);
    localStorage.removeItem("hsquare_visitor");
    localStorage.removeItem("hsquare_admin");
    setLocation("/login");
  };

  const isAuthenticated = !!(visitor || admin);
  const isAdmin = !!admin;

  return (
    <AuthContext.Provider value={{ visitor, admin, isAuthenticated, isAdmin, logout, updateActivity }}>
      {children}
    </AuthContext.Provider>
  );
}
