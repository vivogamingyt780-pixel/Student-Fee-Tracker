import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  getSession,
  login as authLogin,
  logout as authLogout,
  signup as authSignup,
  type Session,
} from "@/services/auth";
import { mergeCloudData, clearSampleData, syncCurrentStateToGAS } from "@/services/data";

interface AuthContextType {
  session:   Session | null;
  isLoading: boolean;
  /** True while an async GAS call is in progress (login / signup). */
  isSyncing: boolean;
  login:   (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup:  (username: string, password: string, coachingName: string) => Promise<{ success: boolean; error?: string }>;
  logout:  () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,   setSession]   = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (s) {
      setSession(s);
      clearSampleData(s.userId);
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    setIsSyncing(true);
    try {
      const result = await authLogin(username, password);
      if (result.success && result.session) {
        // Merge GAS data into localStorage BEFORE setting the session so that
        // DataContext's useEffect reads the fresh cloud data when userId changes.
        if (result.cloudData) {
          mergeCloudData(result.session.userId, result.cloudData);
        }
        setSession(result.session);
        clearSampleData(result.session.userId);
      }
      return { success: result.success, error: result.error };
    } finally {
      setIsSyncing(false);
    }
  };

  const signup = async (username: string, password: string, coachingName: string) => {
    setIsSyncing(true);
    try {
      const result = await authSignup(username, password, coachingName);
      if (result.success && result.session) {
        setSession(result.session);
      }
      return { success: result.success, error: result.error };
    } finally {
      setIsSyncing(false);
    }
  };

  const logout = () => {
    if (session) {
      // Best-effort bulk sync before clearing the session — catches any
      // per-mutation fire-and-forget calls that may not have completed yet.
      syncCurrentStateToGAS(session.userId);
    }
    authLogout();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, isSyncing, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
