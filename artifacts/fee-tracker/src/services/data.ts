export interface CoachingProfile {
  id: string;
  userId: string;
  name: string;
  ownerName: string;
  mobile: string;
  address: string;
  logoBase64?: string;
}

export interface Student {
  id: string;
  userId: string;
  name: string;
  parentName: string;
  mobile: string;
  email?: string;
  address?: string;
  batch: string;
  className: string;
  totalFee: number;
  admissionDate: string;
  status: "active" | "inactive";
  createdAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  studentId: string;
  receiptNumber: string;
  amountPaid: number;
  paymentDate: string;
  paymentType: "full" | "partial";
  dueDate?: string;
  notes?: string;
  createdAt: string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function getKey(type: string, userId: string): string {
  return `feetracker_${type}_${userId}`;
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────

export function getProfile(userId: string): CoachingProfile | null {
  try {
    const raw = localStorage.getItem(getKey("profile", userId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveProfile(userId: string, profile: CoachingProfile): CoachingProfile {
  const saved = { ...profile, userId };
  localStorage.setItem(getKey("profile", userId), JSON.stringify(saved));
  syncToGAS({ action: "profile", method: "update", userId, profile: saved });
  return saved;
}

// ─── STUDENTS ─────────────────────────────────────────────────────────────────

export function getStudents(userId: string): Student[] {
  try {
    return JSON.parse(localStorage.getItem(getKey("students", userId)) || "[]");
  } catch { return []; }
}

function saveStudents(userId: string, students: Student[]): void {
  localStorage.setItem(getKey("students", userId), JSON.stringify(students));
}

export function addStudent(userId: string, data: Omit<Student, "id" | "userId" | "createdAt">): Student {
  const students = getStudents(userId);
  const student: Student = { ...data, id: generateId(), userId, createdAt: new Date().toISOString() };
  students.push(student);
  saveStudents(userId, students);
  syncToGAS({ action: "students", method: "create", userId, student });
  return student;
}

export function updateStudent(userId: string, id: string, data: Partial<Student>): Student | null {
  const students = getStudents(userId);
  const idx = students.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  students[idx] = { ...students[idx], ...data };
  saveStudents(userId, students);
  syncToGAS({ action: "students", method: "update", userId, student: students[idx] });
  return students[idx];
}

export function deleteStudent(userId: string, id: string): void {
  const students = getStudents(userId).filter((s) => s.id !== id);
  saveStudents(userId, students);
  syncToGAS({ action: "students", method: "delete", userId, studentId: id });
}

// ─── PAYMENTS ─────────────────────────────────────────────────────────────────

export function getPayments(userId: string): Payment[] {
  try {
    return JSON.parse(localStorage.getItem(getKey("payments", userId)) || "[]");
  } catch { return []; }
}

function savePayments(userId: string, payments: Payment[]): void {
  localStorage.setItem(getKey("payments", userId), JSON.stringify(payments));
}

function nextReceiptNumber(userId: string): string {
  const counterKey = `feetracker_receipt_${userId}`;
  const current = parseInt(localStorage.getItem(counterKey) || "0", 10);
  const next = current + 1;
  localStorage.setItem(counterKey, next.toString());
  return `RCP-${String(next).padStart(4, "0")}`;
}

export function addPayment(userId: string, data: Omit<Payment, "id" | "userId" | "receiptNumber" | "createdAt">): Payment {
  const payments = getPayments(userId);
  const payment: Payment = {
    ...data,
    id: generateId(),
    userId,
    receiptNumber: nextReceiptNumber(userId),
    createdAt: new Date().toISOString(),
  };
  payments.push(payment);
  savePayments(userId, payments);
  syncToGAS({ action: "payments", method: "create", userId, payment });
  return payment;
}

export function deletePayment(userId: string, id: string): void {
  const payments = getPayments(userId).filter((p) => p.id !== id);
  savePayments(userId, payments);
  syncToGAS({ action: "payments", method: "delete", userId, paymentId: id });
}

export function getStudentPayments(userId: string, studentId: string): Payment[] {
  return getPayments(userId).filter((p) => p.studentId === studentId);
}

export function getTotalPaid(userId: string, studentId: string): number {
  return getStudentPayments(userId, studentId).reduce((sum, p) => sum + p.amountPaid, 0);
}

// ─── STATS ────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalStudents: number;
  totalCollected: number;
  totalPending: number;
  monthlyCollection: number;
  recentPayments: (Payment & { studentName: string })[];
  monthlyData: { month: string; amount: number }[];
}

export function getDashboardStats(userId: string): DashboardStats {
  const students = getStudents(userId);
  const payments = getPayments(userId);

  const totalCollected = payments.reduce((s, p) => s + p.amountPaid, 0);
  const totalFees = students.reduce((s, st) => s + st.totalFee, 0);
  const totalPending = totalFees - totalCollected;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthlyCollection = payments
    .filter((p) => p.paymentDate >= monthStart.slice(0, 10))
    .reduce((s, p) => s + p.amountPaid, 0);

  const studentMap = new Map(students.map((s) => [s.id, s.name]));
  const recentPayments = [...payments]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((p) => ({ ...p, studentName: studentMap.get(p.studentId) || "Unknown" }));

  // Monthly data for last 6 months
  const monthlyData: { month: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    const amount = payments
      .filter((p) => p.paymentDate.startsWith(monthStr))
      .reduce((s, p) => s + p.amountPaid, 0);
    monthlyData.push({ month: label, amount });
  }

  return { totalStudents: students.length, totalCollected, totalPending: Math.max(0, totalPending), monthlyCollection, recentPayments, monthlyData };
}

// ─── SAMPLE DATA SEEDER ───────────────────────────────────────────────────────

export function seedSampleData(userId: string): void {
  const existing = getStudents(userId);
  if (existing.length > 0) return; // don't seed if data already exists

  const batches = ["Morning", "Evening"];
  const classes = ["Class 9", "Class 10", "Class 11", "Class 12"];
  const sampleStudents = [
    { name: "Arjun Sharma", parentName: "Rajesh Sharma", mobile: "9876543210", batch: "Morning", className: "Class 10", totalFee: 12000 },
    { name: "Priya Patel", parentName: "Suresh Patel", mobile: "9876543211", batch: "Evening", className: "Class 11", totalFee: 15000 },
    { name: "Rahul Gupta", parentName: "Amit Gupta", mobile: "9876543212", batch: "Morning", className: "Class 9", totalFee: 10000 },
    { name: "Sneha Joshi", parentName: "Vijay Joshi", mobile: "9876543213", batch: "Evening", className: "Class 12", totalFee: 18000 },
    { name: "Karan Singh", parentName: "Harpal Singh", mobile: "9876543214", batch: "Morning", className: "Class 10", totalFee: 12000 },
  ];

  const now = new Date();
  const students: Student[] = sampleStudents.map((s, i) => ({
    ...s,
    id: generateId(),
    userId,
    email: "",
    address: "",
    admissionDate: new Date(now.getFullYear(), now.getMonth() - 2, 1 + i).toISOString().slice(0, 10),
    status: "active" as const,
    createdAt: new Date(now.getFullYear(), now.getMonth() - 2, 1 + i).toISOString(),
  }));
  saveStudents(userId, students);

  // Add some payments
  const paymentData = [
    { studentId: students[0].id, amountPaid: 6000, paymentType: "partial" as const, dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 15).toISOString().slice(0, 10) },
    { studentId: students[1].id, amountPaid: 15000, paymentType: "full" as const },
    { studentId: students[2].id, amountPaid: 5000, paymentType: "partial" as const, dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 10).toISOString().slice(0, 10) },
    { studentId: students[3].id, amountPaid: 18000, paymentType: "full" as const },
    { studentId: students[4].id, amountPaid: 4000, paymentType: "partial" as const, dueDate: new Date(now.getFullYear(), now.getMonth(), 20).toISOString().slice(0, 10) },
  ];

  const payments: Payment[] = paymentData.map((p, i) => ({
    ...p,
    id: generateId(),
    userId,
    receiptNumber: `RCP-${String(i + 1).padStart(4, "0")}`,
    paymentDate: new Date(now.getFullYear(), now.getMonth() - (i % 2 === 0 ? 1 : 0), 5 + i * 3).toISOString().slice(0, 10),
    createdAt: new Date(now.getFullYear(), now.getMonth() - (i % 2 === 0 ? 1 : 0), 5 + i * 3).toISOString(),
    notes: "",
    dueDate: p.dueDate || "",
  }));
  savePayments(userId, payments);

  // Set receipt counter
  localStorage.setItem(`feetracker_receipt_${userId}`, paymentData.length.toString());
}

// ─── BACKUP / RESTORE ─────────────────────────────────────────────────────────

export function exportBackup(userId: string): string {
  const students = getStudents(userId);
  const payments = getPayments(userId);
  const profile = getProfile(userId);
  return JSON.stringify({ exportedAt: new Date().toISOString(), userId, students, payments, profile }, null, 2);
}

export function importBackup(userId: string, jsonStr: string): { success: boolean; error?: string } {
  try {
    const data = JSON.parse(jsonStr);
    if (data.students) saveStudents(userId, data.students);
    if (data.payments) savePayments(userId, data.payments);
    if (data.profile) saveProfile(userId, data.profile);
    return { success: true };
  } catch {
    return { success: false, error: "Invalid backup file format." };
  }
}

// ─── GAS SYNC ─────────────────────────────────────────────────────────────────

export function getGASUrl(): string {
  return localStorage.getItem("feetracker_gas_url") || "";
}

export function setGASUrl(url: string): void {
  localStorage.setItem("feetracker_gas_url", url);
}

function syncToGAS(payload: Record<string, unknown>): void {
  const url = getGASUrl();
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {}); // silent fail — sync is best-effort
}

export async function testGASConnection(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data.status === "ok") return { success: true };
    return { success: false, error: "Unexpected response from server." };
  } catch {
    return { success: false, error: "Could not connect. Check the URL and try again." };
  }
}
