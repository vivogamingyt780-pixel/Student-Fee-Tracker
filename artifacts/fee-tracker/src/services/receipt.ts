import jsPDF from "jspdf";
import type { Student, Payment, CoachingProfile } from "./data";

function formatCurrency(amount: number): string {
  // Use "Rs." instead of the rupee symbol (U+20B9) — jsPDF's built-in Helvetica
  // font is Latin-1 only; U+20B9 maps to 0xB9 (superscript-one) which renders
  // as a stray "1" before every amount (e.g. 15,000 → 115,000).
  return "Rs. " + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return dateStr; }
}

export function generateReceiptPDF(
  payment: Payment,
  student: Student,
  profile: CoachingProfile,
  totalPaid: number
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const pw = doc.internal.pageSize.getWidth();
  const remaining = student.totalFee - totalPaid;

  // ─── Header ──────────────────────────────────────────────────────────────────
  // Logo placeholder or coaching name
  if (profile.logoBase64) {
    try {
      doc.addImage(profile.logoBase64, "JPEG", 10, 8, 22, 22);
    } catch { /* skip logo if invalid */ }
  }

  const textStartX = profile.logoBase64 ? 36 : 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(40, 50, 120);
  doc.text(profile.name || "Coaching Center", textStartX, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  if (profile.ownerName) doc.text(`Owner: ${profile.ownerName}`, textStartX, 21);
  if (profile.mobile) doc.text(`Mobile: ${profile.mobile}`, textStartX, 26);
  if (profile.address) {
    const lines = doc.splitTextToSize(profile.address, 90);
    doc.text(lines, textStartX, 31);
  }

  // ─── Divider ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(40, 50, 120);
  doc.setLineWidth(0.8);
  doc.line(10, 38, pw - 10, 38);

  // ─── Receipt Title ───────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(40, 50, 120);
  doc.text("PAYMENT RECEIPT", pw / 2, 46, { align: "center" });

  // ─── Receipt Info ────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(`Receipt No: ${payment.receiptNumber}`, 10, 54);
  doc.text(`Date: ${formatDate(payment.paymentDate)}`, pw - 10, 54, { align: "right" });

  // ─── Divider ─────────────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(10, 57, pw - 10, 57);

  // ─── Student Info ────────────────────────────────────────────────────────────
  const infoY = 64;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("Student Details", 10, infoY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const rows = [
    ["Student Name", student.name],
    ["Parent Name", student.parentName],
    ["Class / Batch", `${student.className} — ${student.batch}`],
    ["Mobile", student.mobile],
  ];
  rows.forEach(([label, val], i) => {
    doc.setTextColor(100, 100, 100);
    doc.text(label + ":", 10, infoY + 7 + i * 6);
    doc.setTextColor(30, 30, 30);
    doc.text(val, 55, infoY + 7 + i * 6);
  });

  // ─── Fee Summary Box ─────────────────────────────────────────────────────────
  const boxY = infoY + 35;
  doc.setDrawColor(180, 185, 220);
  doc.setFillColor(245, 247, 255);
  doc.roundedRect(10, boxY, pw - 20, 44, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 50, 120);
  doc.text("Fee Summary", 16, boxY + 7);

  const feeRows = [
    ["Total Course Fee", formatCurrency(student.totalFee)],
    ["Previously Paid", formatCurrency(totalPaid - payment.amountPaid)],
    ["This Payment", formatCurrency(payment.amountPaid)],
    ["Payment Type", payment.paymentType === "full" ? "Full Payment" : "Partial Payment"],
    ["Remaining Balance", formatCurrency(Math.max(0, remaining))],
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  feeRows.forEach(([label, val], i) => {
    const y = boxY + 14 + i * 6;
    const isLast = i === feeRows.length - 1;
    const isPayment = label === "This Payment";
    if (isPayment) {
      doc.setTextColor(20, 120, 50);
      doc.setFont("helvetica", "bold");
    } else if (isLast) {
      doc.setTextColor(180, 30, 30);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setTextColor(70, 70, 70);
      doc.setFont("helvetica", "normal");
    }
    doc.text(label + ":", 16, y);
    doc.text(val, pw - 16, y, { align: "right" });
  });

  // Due date if partial
  if (payment.paymentType === "partial" && payment.dueDate) {
    const dueY = boxY + 44 + 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 80, 0);
    doc.text(`Next due date: ${formatDate(payment.dueDate)}`, pw / 2, dueY, { align: "center" });
  }

  // ─── Notes ───────────────────────────────────────────────────────────────────
  if (payment.notes) {
    const notesY = boxY + 55;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    const noteLines = doc.splitTextToSize(`Note: ${payment.notes}`, pw - 20);
    doc.text(noteLines, 10, notesY);
  }

  // ─── Signature ───────────────────────────────────────────────────────────────
  const sigY = doc.internal.pageSize.getHeight() - 22;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(10, sigY, 55, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text("Authorized Signature", 10, sigY + 5);

  // Student acknowledgement
  doc.line(pw - 55, sigY, pw - 10, sigY);
  doc.text("Student / Parent Signature", pw - 55, sigY + 5);

  // ─── Footer ──────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text("This is a computer-generated receipt.", pw / 2, doc.internal.pageSize.getHeight() - 6, { align: "center" });

  doc.save(`${payment.receiptNumber}_${student.name.replace(/\s+/g, "_")}.pdf`);
}
