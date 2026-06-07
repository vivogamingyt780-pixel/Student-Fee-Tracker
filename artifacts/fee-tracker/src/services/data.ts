/**
 * Data service — localStorage is used as a session cache only.
 * Every mutation is immediately reflected in localStorage (for instant UI response)
 * and simultaneously fired to Google Sheets via GAS (fire-and-forget).
 *
 * On login, GAS returns the authoritative data set which overwrites the cache.
 * On logout, a bulk sync flushes any pending changes to GAS.
 */

import {
  gasSyncStudent,
  gasDeleteStudent,
  gasSyncPayment,
  gasDeletePayment,
  gasSyncProfile,
  gasSyncAll,
} from "./gasApi";

export interface CoachingProfile {
  id:          string;
  userId:      string;
  name:        string;
  ownerName:   string;
  mobile:      string;
  address:     string;
  logoBase64?: string;
}

export interface Student {
  id:            string;
  userId:        string;
  name:          string;
  parentName:    string;
  mobile:        string;
  email?:        string;
  address?:      string;
  batch:         string;
  className:     string;
  totalFee:      number;
  admissionDate: string;
  status:        "active" | "inactive";
  createdAt:     string;
}

export interface Payment {
  id:            string;
  userId:        string;
  studentId:     string;
  receiptNumber: string;
  amountPaid:    number;
  paymentDate:   string;
  paymentType:   "full" | "partial";
  dueDate?:      string;
  notes?:        string;
  createdAt:     string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getKey(type: string, userId: string): string {
  return `feetracker_${type}_${userId}`;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function getProfile(userId: string): CoachingProfile | null {
  try {
    const raw = localStorage.getItem(getKey("profile", userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfileLocal(userId: string, profile: CoachingProfile): void {
  localStorage.setItem(getKey("profile", userId), JSON.stringify({ ...profile, userId }));
}

export function saveProfile(userId: string, profile: CoachingProfile): CoachingProfile {
  const saved = { ...profile, userId };
  saveProfileLocal(userId, saved);
  gasSyncProfile(userId, saved as unknown as Record<string, unknown>);
  return saved;
}

// ─── Students ─────────────────────────────────────────────────────────────────

export function getStudents(userId: string): Student[] {
  try {
    return JSON.parse(localStorage.getItem(getKey("students", userId)) || "[]");
  } catch {
    return [];
  }
}

export function saveStudentsLocal(userId: string, students: Student[]): void {
  localStorage.setItem(getKey("students", userId), JSON.stringify(students));
}

export function addStudent(
  userId: string,
  data: Omit<Student, "id" | "userId" | "createdAt">,
): Student {
  const students = getStudents(userId);
  const student: Student = { ...data, id: generateId(), userId, createdAt: new Date().toISOString() };
  students.push(student);
  saveStudentsLocal(userId, students);
  gasSyncStudent(userId, "create", student);
  return student;
}

export function updateStudent(
  userId: string,
  id:     string,
  data:   Partial<Student>,
): Student | null {
  const students = getStudents(userId);
  const idx      = students.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  students[idx] = { ...students[idx], ...data };
  saveStudentsLocal(userId, students);
  gasSyncStudent(userId, "update", students[idx]);
  return students[idx];
}

export function deleteStudent(userId: string, id: string): void {
  const students = getStudents(userId).filter((s) => s.id !== id);
  saveStudentsLocal(userId, students);
  gasDeleteStudent(userId, id);
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export function getPayments(userId: string): Payment[] {
  try {
    return JSON.parse(localStorage.getItem(getKey("payments", userId)) || "[]");
  } catch {
    return [];
  }
}

export function savePaymentsLocal(userId: string, payments: Payment[]): void {
  localStorage.setItem(getKey("payments", userId), JSON.stringify(payments));
}

function nextReceiptNumber(userId: string): string {
  const counterKey = `feetracker_receipt_${userId}`;
  const current    = parseInt(localStorage.getItem(counterKey) || "0", 10);
  const next       = current + 1;
  localStorage.setItem(counterKey, next.toString());
  return `RCP-${String(next).padStart(4, "0")}`;
}

export function addPayment(
  userId: string,
  data:   Omit<Payment, "id" | "userId" | "receiptNumber" | "createdAt">,
): Payment {
  const payments = getPayments(userId);
  const payment: Payment = {
    ...data,
    id:            generateId(),
    userId,
    receiptNumber: nextReceiptNumber(userId),
    createdAt:     new Date().toISOString(),
  };
  payments.push(payment);
  savePaymentsLocal(userId, payments);
  gasSyncPayment(userId, payment);
  return payment;
}

export function deletePayment(userId: string, id: string): void {
  const payments = getPayments(userId).filter((p) => p.id !== id);
  savePaymentsLocal(userId, payments);
  gasDeletePayment(userId, id);
}

export function getStudentPayments(userId: string, studentId: string): Payment[] {
  return getPayments(userId).filter((p) => p.studentId === studentId);
}

export function getTotalPaid(userId: string, studentId: string): number {
  return getStudentPayments(userId, studentId).reduce((sum, p) => sum + p.amountPaid, 0);
}

// ─── Bulk sync ────────────────────────────────────────────────────────────────

/**
 * Pushes the complete current state of this user's data to GAS in one request.
 * Called on logout so any per-mutation syncs that failed are caught.
 */
export function syncCurrentStateToGAS(userId: string): void {
  const students = getStudents(userId);
  const payments = getPayments(userId);
  const profile  = getProfile(userId);
  gasSyncAll(
    userId,
    students,
    payments,
    profile as (Record<string, unknown> & { logoBase64?: string }) | null,
  );
}

// ─── Merge cloud data (called on login) ───────────────────────────────────────

export function mergeCloudData(
  userId: string,
  cloudData: { students: unknown[]; payments: unknown[]; profile: unknown },
): void {
  if (Array.isArray(cloudData.students) && cloudData.students.length > 0) {
    const students = (cloudData.students as Record<string, unknown>[]).map((s) => ({
      id:            String(s.id            ?? ""),
      userId:        String(s.userId        ?? userId),
      name:          String(s.name          ?? ""),
      parentName:    String(s.parentName    ?? ""),
      mobile:        String(s.mobile        ?? ""),
      email:         String(s.email         ?? ""),
      address:       String(s.address       ?? ""),
      batch:         String(s.batch         ?? ""),
      className:     String(s.className     ?? ""),
      totalFee:      Number(s.totalFee      ?? 0),
      admissionDate: String(s.admissionDate ?? ""),
      status:        String(s.status        ?? "active") === "active" ? "active" : "inactive",
      createdAt:     String(s.createdAt     ?? new Date().toISOString()),
    })) as Student[];
    saveStudentsLocal(userId, students);
  }

  if (Array.isArray(cloudData.payments) && cloudData.payments.length > 0) {
    const payments = (cloudData.payments as Record<string, unknown>[]).map((p) => ({
      id:            String(p.id            ?? ""),
      userId:        String(p.userId        ?? userId),
      studentId:     String(p.studentId     ?? ""),
      receiptNumber: String(p.receiptNumber ?? ""),
      amountPaid:    Number(p.amountPaid    ?? 0),
      paymentDate:   String(p.paymentDate   ?? ""),
      paymentType:   String(p.paymentType   ?? "full") === "full" ? "full" : "partial",
      dueDate:       String(p.dueDate       ?? ""),
      notes:         String(p.notes         ?? ""),
      createdAt:     String(p.createdAt     ?? new Date().toISOString()),
    })) as Payment[];
    savePaymentsLocal(userId, payments);

    // Keep receipt counter in sync with the highest receipt number from GAS
    const max = payments.reduce((best, p) => {
      const n = parseInt(p.receiptNumber.replace(/\D/g, ""), 10) || 0;
      return Math.max(best, n);
    }, 0);
    const counterKey = `feetracker_receipt_${userId}`;
    const stored     = parseInt(localStorage.getItem(counterKey) || "0", 10);
    if (max > stored) localStorage.setItem(counterKey, max.toString());
  }

  if (cloudData.profile && typeof cloudData.profile === "object") {
    const p        = cloudData.profile as Record<string, unknown>;
    const existing = getProfile(userId);
    // Preserve the locally-stored logo (logos are not synced to GAS — too large)
    const merged: CoachingProfile = {
      id:         String(p.id        ?? existing?.id        ?? ""),
      userId,
      name:       String(p.name      ?? existing?.name      ?? ""),
      ownerName:  String(p.ownerName ?? existing?.ownerName ?? ""),
      mobile:     String(p.mobile    ?? existing?.mobile    ?? ""),
      address:    String(p.address   ?? existing?.address   ?? ""),
      logoBase64: existing?.logoBase64 ?? "",
    };
    saveProfileLocal(userId, merged);
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalStudents:     number;
  totalCollected:    number;
  totalPending:      number;
  monthlyCollection: number;
  recentPayments:    (Payment & { studentName: string })[];
  monthlyData:       { month: string; amount: number }[];
}

export function getDashboardStats(userId: string): DashboardStats {
  const students = getStudents(userId);
  const payments = getPayments(userId);

  const totalCollected    = payments.reduce((s, p) => s + p.amountPaid, 0);
  const totalFees         = students.reduce((s, st) => s + st.totalFee, 0);
  const totalPending      = totalFees - totalCollected;

  const now               = new Date();
  const monthStart        = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthlyCollection = payments
    .filter((p) => p.paymentDate >= monthStart.slice(0, 10))
    .reduce((s, p) => s + p.amountPaid, 0);

  const studentMap     = new Map(students.map((s) => [s.id, s.name]));
  const recentPayments = [...payments]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((p) => ({ ...p, studentName: studentMap.get(p.studentId) || "Unknown" }));

  const monthlyData: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d        = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label    = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    const amount   = payments
      .filter((p) => p.paymentDate.startsWith(monthStr))
      .reduce((s, p) => s + p.amountPaid, 0);
    monthlyData.push({ month: label, amount });
  }

  return {
    totalStudents:  students.length,
    totalCollected,
    totalPending:   Math.max(0, totalPending),
    monthlyCollection,
    recentPayments,
    monthlyData,
  };
}

// ─── Clear sample data ────────────────────────────────────────────────────────

const SAMPLE_NAMES = ["Arjun Sharma", "Priya Patel", "Rahul Gupta", "Sneha Joshi", "Karan Singh"];

export function clearSampleData(userId: string): void {
  const students       = getStudents(userId);
  const sampleStudents = students.filter((s) => SAMPLE_NAMES.includes(s.name));
  if (sampleStudents.length === 0) return;

  const sampleIds = new Set(sampleStudents.map((s) => s.id));
  saveStudentsLocal(userId, students.filter((s) => !sampleIds.has(s.id)));
  savePaymentsLocal(userId, getPayments(userId).filter((p) => !sampleIds.has(p.studentId)));
}

// ─── Backup / Restore ─────────────────────────────────────────────────────────

export function exportBackup(userId: string): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      userId,
      students:   getStudents(userId),
      payments:   getPayments(userId),
      profile:    getProfile(userId),
    },
    null,
    2,
  );
}

export function importBackup(
  userId:  string,
  jsonStr: string,
): { success: boolean; error?: string } {
  try {
    const data = JSON.parse(jsonStr);
    if (data.students) saveStudentsLocal(userId, data.students);
    if (data.payments) savePaymentsLocal(userId, data.payments);
    if (data.profile)  saveProfileLocal(userId, data.profile);
    return { success: true };
  } catch {
    return { success: false, error: "Invalid backup file format." };
  }
}
