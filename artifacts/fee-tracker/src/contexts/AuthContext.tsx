import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getSession, login as authLogin, logout as authLogout, signup as authSignup, type Session } from "@/services/auth";
import { seedSampleData } from "@/services/data";

interface AuthContextType {
  session: Session | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (username: string, password: string, coachingName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (s) {
      setSession(s);
      seedSampleData(s.userId);
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const result = authLogin(username, password);
    if (result.success && result.session) {
      setSession(result.session);
      seedSampleData(result.session.userId);
    }
    return result;
  };

  const signup = async (username: string, password: string, coachingName: string) => {
    const result = authSignup(username, password, coachingName);
    if (result.success && result.session) {
      setSession(result.session);
      seedSampleData(result.session.userId);
    }
    return result;
  };

  const logout = () => {
    authLogout();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
