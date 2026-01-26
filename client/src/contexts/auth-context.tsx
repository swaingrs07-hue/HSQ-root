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
  isLoading: boolean;
  loginVisitor: (visitor: Visitor) => void;
  loginAdmin: (admin: Admin) => void;
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
  const [isLoading, setIsLoading] = useState(true);
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
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;
    
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
  }, [location, visitor, admin, isLoading, setLocation]);

  useEffect(() => {
    if (visitor) {
      const interval = setInterval(() => {
        updateActivity();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [visitor]);

  const loginVisitor = (visitorData: Visitor) => {
    localStorage.setItem("hsquare_visitor", JSON.stringify(visitorData));
    setVisitor(visitorData);
    setLocation("/");
  };

  const loginAdmin = (adminData: Admin) => {
    localStorage.setItem("hsquare_admin", JSON.stringify(adminData));
    setAdmin(adminData);
    setLocation("/admin");
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      visitor, 
      admin, 
      isAuthenticated, 
      isAdmin, 
      isLoading, 
      loginVisitor,
      loginAdmin,
      logout, 
      updateActivity 
    }}>
      {children}
    </AuthContext.Provider>
  );
}
