import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  getSession,
  login as authLogin,
  logout as authLogout,
  signup as authSignup,
  type Session,
} from "@/services/auth";
import { mergeCloudData, clearSampleData } from "@/services/data";
import { isGASConfigured } from "@/services/gasApi";

interface AuthContextType {
  session:      Session | null;
  isLoading:    boolean;
  isSyncing:    boolean;   // true while fetching cloud data on login
  gasEnabled:   boolean;   // whether the app is connected to Google Sheets
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
        // Merge cloud data into localStorage BEFORE setting session so
        // DataContext's useEffect reads the merged data when userId changes.
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
    authLogout();
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isSyncing,
        gasEnabled: isGASConfigured(),
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
