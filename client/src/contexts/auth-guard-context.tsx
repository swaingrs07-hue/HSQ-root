import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/contexts/auth-context";

type PendingAction = {
  action: () => void;
  label: string;
};

interface AuthGuardContextType {
  requireAuth: (action: () => void, actionLabel?: string) => void;
  isModalOpen: boolean;
}

const AuthGuardContext = createContext<AuthGuardContextType | null>(null);

export function useAuthGuard() {
  const context = useContext(AuthGuardContext);
  if (!context) {
    throw new Error("useAuthGuard must be used within AuthGuardProvider");
  }
  return context;
}

export function AuthGuardProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const requireAuth = useCallback((action: () => void, actionLabel = "continue") => {
    if (isAuthenticated) {
      action();
    } else {
      setPendingAction({ action, label: actionLabel });
      setIsModalOpen(true);
    }
  }, [isAuthenticated]);

  const handleSuccess = useCallback(() => {
    if (pendingAction) {
      setTimeout(() => {
        pendingAction.action();
        setPendingAction(null);
      }, 100);
    }
  }, [pendingAction]);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    setPendingAction(null);
  }, []);

  return (
    <AuthGuardContext.Provider value={{ requireAuth, isModalOpen }}>
      {children}
      <AuthModal
        isOpen={isModalOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
        actionLabel={pendingAction?.label}
      />
    </AuthGuardContext.Provider>
  );
}
