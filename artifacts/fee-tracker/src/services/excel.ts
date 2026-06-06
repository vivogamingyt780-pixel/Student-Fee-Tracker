import * as XLSX from "xlsx";
import type { Student, Payment } from "./data";

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN");
  } catch { return dateStr; }
}

export function exportMonthlyReport(payments: Payment[], students: Student[], coachingName: string): void {
  const studentMap = new Map(students.map((s) => [s.id, s]));

  // Group by month
  const monthly = new Map<string, { payments: Payment[]; total: number }>();
  payments.forEach((p) => {
    const month = p.paymentDate.slice(0, 7);
    const entry = monthly.get(month) || { payments: [], total: 0 };
    entry.payments.push(p);
    entry.total += p.amountPaid;
    monthly.set(month, entry);
  });

  const rows: unknown[][] = [
    [`${coachingName} — Monthly Collection Report`],
    [`Generated: ${new Date().toLocaleDateString("en-IN")}`],
    [],
    ["Month", "Receipt No", "Student Name", "Class", "Batch", "Payment Type", "Amount Paid", "Date"],
  ];

  Array.from(monthly.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([, { payments: mps }]) => {
      mps.forEach((p) => {
        const student = studentMap.get(p.studentId);
        rows.push([
          p.paymentDate.slice(0, 7),
          p.receiptNumber,
          student?.name || "Unknown",
          student?.className || "",
          student?.batch || "",
          p.paymentType === "full" ? "Full" : "Partial",
          p.amountPaid,
          formatDate(p.paymentDate),
        ]);
      });
    });

  downloadXLSX(rows, "Monthly_Report");
}

export function exportStudentWiseReport(students: Student[], payments: Payment[], coachingName: string): void {
  const rows: unknown[][] = [
    [`${coachingName} — Student-wise Fee Report`],
    [`Generated: ${new Date().toLocaleDateString("en-IN")}`],
    [],
    ["Student Name", "Parent Name", "Mobile", "Class", "Batch", "Total Fee", "Amount Paid", "Remaining", "Status", "Admission Date"],
  ];

  students.forEach((s) => {
    const paid = payments.filter((p) => p.studentId === s.id).reduce((sum, p) => sum + p.amountPaid, 0);
    const remaining = Math.max(0, s.totalFee - paid);
    rows.push([
      s.name,
      s.parentName,
      s.mobile,
      s.className,
      s.batch,
      s.totalFee,
      paid,
      remaining,
      s.status === "active" ? "Active" : "Inactive",
      formatDate(s.admissionDate),
    ]);
  });

  downloadXLSX(rows, "Student_Report");
}

export function exportPendingReport(students: Student[], payments: Payment[], coachingName: string): void {
  const rows: unknown[][] = [
    [`${coachingName} — Pending Fees Report`],
    [`Generated: ${new Date().toLocaleDateString("en-IN")}`],
    [],
    ["Student Name", "Parent Name", "Mobile", "Class", "Batch", "Total Fee", "Amount Paid", "Pending Amount", "Last Payment Date", "Status"],
  ];

  students.forEach((s) => {
    const studentPayments = payments.filter((p) => p.studentId === s.id);
    const paid = studentPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const remaining = Math.max(0, s.totalFee - paid);
    if (remaining <= 0) return; // only pending

    const lastPayment = studentPayments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))[0];
    rows.push([
      s.name,
      s.parentName,
      s.mobile,
      s.className,
      s.batch,
      s.totalFee,
      paid,
      remaining,
      lastPayment ? formatDate(lastPayment.paymentDate) : "No payment yet",
      s.status === "active" ? "Active" : "Inactive",
    ]);
  });

  downloadXLSX(rows, "Pending_Fees_Report");
}

function downloadXLSX(rows: unknown[][], filename: string): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Style header row (basic column widths)
  ws["!cols"] = Array(10).fill({ wch: 18 });

  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
