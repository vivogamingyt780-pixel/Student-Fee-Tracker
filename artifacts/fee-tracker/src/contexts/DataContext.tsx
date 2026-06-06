import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  getStudents, addStudent, updateStudent, deleteStudent,
  getPayments, addPayment, deletePayment, getStudentPayments, getTotalPaid,
  getDashboardStats, getProfile, saveProfile, exportBackup, importBackup,
  type Student, type Payment, type CoachingProfile, type DashboardStats,
} from "@/services/data";
import { useAuth } from "./AuthContext";

interface DataContextType {
  // Students
  students: Student[];
  refreshStudents: () => void;
  createStudent: (data: Omit<Student, "id" | "userId" | "createdAt">) => Student;
  editStudent: (id: string, data: Partial<Student>) => Student | null;
  removeStudent: (id: string) => void;

  // Payments
  payments: Payment[];
  refreshPayments: () => void;
  createPayment: (data: Omit<Payment, "id" | "userId" | "receiptNumber" | "createdAt">) => Payment;
  removePayment: (id: string) => void;
  getPaymentsForStudent: (studentId: string) => Payment[];
  getPaidForStudent: (studentId: string) => number;

  // Stats
  stats: DashboardStats | null;
  refreshStats: () => void;

  // Profile
  profile: CoachingProfile | null;
  refreshProfile: () => void;
  updateProfile: (p: CoachingProfile) => CoachingProfile;

  // Backup
  backup: () => string;
  restore: (json: string) => { success: boolean; error?: string };

  refreshAll: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.userId || "";

  const [students, setStudents] = useState<Student[]>(() => (userId ? getStudents(userId) : []));
  const [payments, setPayments] = useState<Payment[]>(() => (userId ? getPayments(userId) : []));
  const [stats, setStats] = useState<DashboardStats | null>(() => (userId ? getDashboardStats(userId) : null));
  const [profile, setProfile] = useState<CoachingProfile | null>(() => (userId ? getProfile(userId) : null));

  const refreshStudents = useCallback(() => { if (userId) setStudents(getStudents(userId)); }, [userId]);
  const refreshPayments = useCallback(() => { if (userId) setPayments(getPayments(userId)); }, [userId]);
  const refreshStats = useCallback(() => { if (userId) setStats(getDashboardStats(userId)); }, [userId]);
  const refreshProfile = useCallback(() => { if (userId) setProfile(getProfile(userId)); }, [userId]);

  const refreshAll = useCallback(() => {
    refreshStudents();
    refreshPayments();
    refreshStats();
    refreshProfile();
  }, [refreshStudents, refreshPayments, refreshStats, refreshProfile]);

  const createStudent = useCallback((data: Omit<Student, "id" | "userId" | "createdAt">) => {
    const s = addStudent(userId, data);
    refreshStudents();
    refreshStats();
    return s;
  }, [userId, refreshStudents, refreshStats]);

  const editStudent = useCallback((id: string, data: Partial<Student>) => {
    const s = updateStudent(userId, id, data);
    refreshStudents();
    refreshStats();
    return s;
  }, [userId, refreshStudents, refreshStats]);

  const removeStudent = useCallback((id: string) => {
    deleteStudent(userId, id);
    refreshStudents();
    refreshStats();
  }, [userId, refreshStudents, refreshStats]);

  const createPayment = useCallback((data: Omit<Payment, "id" | "userId" | "receiptNumber" | "createdAt">) => {
    const p = addPayment(userId, data);
    refreshPayments();
    refreshStats();
    return p;
  }, [userId, refreshPayments, refreshStats]);

  const removePayment = useCallback((id: string) => {
    deletePayment(userId, id);
    refreshPayments();
    refreshStats();
  }, [userId, refreshPayments, refreshStats]);

  const getPaymentsForStudent = useCallback((studentId: string) =>
    getStudentPayments(userId, studentId), [userId]);

  const getPaidForStudent = useCallback((studentId: string) =>
    getTotalPaid(userId, studentId), [userId]);

  const updateProfile = useCallback((p: CoachingProfile) => {
    const saved = saveProfile(userId, p);
    setProfile(saved);
    return saved;
  }, [userId]);

  const backup = useCallback(() => exportBackup(userId), [userId]);

  const restore = useCallback((json: string) => {
    const result = importBackup(userId, json);
    if (result.success) refreshAll();
    return result;
  }, [userId, refreshAll]);

  return (
    <DataContext.Provider value={{
      students, refreshStudents, createStudent, editStudent, removeStudent,
      payments, refreshPayments, createPayment, removePayment,
      getPaymentsForStudent, getPaidForStudent,
      stats, refreshStats,
      profile, refreshProfile, updateProfile,
      backup, restore, refreshAll,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
