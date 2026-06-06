import { useState, useMemo } from "react";
import { Search, Download, MessageCircle, Printer } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { generateReceiptPDF } from "@/services/receipt";

export default function ReceiptsPage() {
  const { payments, students, getPaymentsForStudent, profile, getPaidForStudent } = useData();
  const [search, setSearch] = useState("");

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const enriched = useMemo(() => {
    return payments
      .map((p) => ({ ...p, student: studentMap.get(p.studentId) }))
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }, [payments, studentMap]);

  const filtered = useMemo(() => {
    if (!search) return enriched;
    const q = search.toLowerCase();
    return enriched.filter(
      (p) =>
        p.receiptNumber.toLowerCase().includes(q) ||
        (p.student?.name || "").toLowerCase().includes(q) ||
        (p.student?.mobile || "").includes(q)
    );
  }, [enriched, search]);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  const downloadReceipt = (payment: typeof enriched[0]) => {
    if (!payment.student || !profile) return;
    const allStudentPayments = getPaymentsForStudent(payment.studentId)
      .filter((p) => p.paymentDate <= payment.paymentDate);
    const totalPaid = allStudentPayments.reduce((s, p) => s + p.amountPaid, 0);
    generateReceiptPDF(payment, payment.student, profile, totalPaid);
  };

  const shareWhatsApp = (payment: typeof enriched[0]) => {
    if (!payment.student || !profile) return;
    const totalPaid = getPaidForStudent(payment.studentId);
    const remaining = Math.max(0, (payment.student.totalFee || 0) - totalPaid);
    const msg = encodeURIComponent(
      `*Receipt: ${payment.receiptNumber}*\n*${profile.name}*\n\nStudent: ${payment.student.name}\nClass: ${payment.student.className} | ${payment.student.batch}\nAmount Paid: ₹${payment.amountPaid.toLocaleString("en-IN")}\nDate: ${formatDate(payment.paymentDate)}\nRemaining Balance: ₹${remaining.toLocaleString("en-IN")}\n\nThank you for your payment.`
    );
    window.open(`https://wa.me/91${payment.student.mobile}?text=${msg}`, "_blank");
  };

  return (
    <AppLayout title="Receipts">
      {/* Toolbar */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by receipt number or student name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-receipts"
          />
        </div>
      </div>

      <div className="mb-4 text-sm text-muted-foreground">
        {filtered.length} receipt{filtered.length !== 1 ? "s" : ""}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <CardContent className="text-center py-12 text-muted-foreground">
            {payments.length === 0
              ? "No receipts yet. Record a payment to generate a receipt."
              : "No receipts match your search."}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Receipt No</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Student</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Class / Batch</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Type</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Date</th>
                  <th className="px-4 py-3 text-center text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => (
                  <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    data-testid={`row-receipt-${payment.id}`}>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-primary">{payment.receiptNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{payment.student?.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{payment.student?.parentName}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {payment.student?.className} · {payment.student?.batch}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant={payment.paymentType === "full" ? "default" : "secondary"}>
                        {payment.paymentType === "full" ? "Full" : "Partial"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      ₹{payment.amountPaid.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {formatDate(payment.paymentDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => downloadReceipt(payment)}
                          title="Download PDF Receipt"
                          data-testid={`button-download-receipt-${payment.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-600"
                          onClick={() => shareWhatsApp(payment)}
                          title="Share via WhatsApp"
                          data-testid={`button-whatsapp-receipt-${payment.id}`}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Click the download icon to save a PDF receipt. Click the WhatsApp icon to share the receipt details.
      </p>
    </AppLayout>
  );
}
