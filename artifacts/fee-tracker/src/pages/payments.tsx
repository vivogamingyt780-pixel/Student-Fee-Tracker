import { useState, useMemo } from "react";
import { Plus, Search, Download, MessageCircle, Trash2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import PaymentModal from "@/components/payments/PaymentModal";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { generateReceiptPDF } from "@/services/receipt";

export default function PaymentsPage() {
  const { payments, students, createPayment, removePayment, getPaymentsForStudent, profile, getPaidForStudent } = useData();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  const enriched = useMemo(() => {
    return payments
      .map((p) => ({ ...p, student: studentMap.get(p.studentId) }))
      .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  }, [payments, studentMap]);

  const filtered = useMemo(() => {
    return enriched.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || (p.student?.name || "").toLowerCase().includes(q)
        || p.receiptNumber.toLowerCase().includes(q)
        || (p.student?.mobile || "").includes(q);
      const matchType = typeFilter === "all" || p.paymentType === typeFilter;
      return matchSearch && matchType;
    });
  }, [enriched, search, typeFilter]);

  const totalFiltered = useMemo(() => filtered.reduce((s, p) => s + p.amountPaid, 0), [filtered]);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  const downloadReceipt = (payment: typeof enriched[0]) => {
    if (!payment.student || !profile) return;
    const allStudentPayments = getPaymentsForStudent(payment.studentId);
    const paidUpTo = allStudentPayments
      .filter(p => p.paymentDate <= payment.paymentDate)
      .reduce((s, p) => s + p.amountPaid, 0);
    generateReceiptPDF(payment, payment.student, profile, paidUpTo);
  };

  const shareWhatsApp = (payment: typeof enriched[0]) => {
    if (!payment.student || !profile) return;
    const totalPaid = getPaidForStudent(payment.studentId);
    const remaining = Math.max(0, (payment.student.totalFee || 0) - totalPaid);
    const msg = encodeURIComponent(
      `*Fee Receipt — ${profile.name}*\n\nReceipt: ${payment.receiptNumber}\nDate: ${formatDate(payment.paymentDate)}\n\nStudent: ${payment.student.name}\nAmount Paid: ₹${payment.amountPaid.toLocaleString("en-IN")}\nRemaining: ₹${remaining.toLocaleString("en-IN")}`
    );
    window.open(`https://wa.me/91${payment.student.mobile}?text=${msg}`, "_blank");
  };

  return (
    <AppLayout title="Payments">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by student, receipt number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-payments"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-filter-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="full">Full Payment</SelectItem>
            <SelectItem value="partial">Partial Payment</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setModalOpen(true)} data-testid="button-add-payment">
          <Plus className="w-4 h-4 mr-2" />
          Record Payment
        </Button>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="text-muted-foreground">{filtered.length} payment{filtered.length !== 1 ? "s" : ""}</span>
        <span className="text-foreground font-medium">Total: ₹{totalFiltered.toLocaleString("en-IN")}</span>
      </div>

      {/* Table */}
      <Card>
        {filtered.length === 0 ? (
          <CardContent className="text-center py-12 text-muted-foreground">
            {payments.length === 0
              ? "No payments recorded yet. Click 'Record Payment' to add the first payment."
              : "No payments match your search."}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Receipt</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Student</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Type</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Due Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => (
                  <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    data-testid={`row-payment-${payment.id}`}>
                    <td className="px-4 py-3 font-medium text-primary">{payment.receiptNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{payment.student?.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{payment.student?.className} · {payment.student?.batch}</div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant={payment.paymentType === "full" ? "default" : "secondary"}>
                        {payment.paymentType === "full" ? "Full" : "Partial"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      ₹{payment.amountPaid.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(payment.paymentDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {payment.dueDate ? formatDate(payment.dueDate) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadReceipt(payment)}
                          title="Download Receipt" data-testid={`button-download-${payment.id}`}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => shareWhatsApp(payment)}
                          title="Share via WhatsApp" data-testid={`button-whatsapp-${payment.id}`}>
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteId(payment.id)}
                          title="Delete" data-testid={`button-delete-payment-${payment.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
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

      <PaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={(data) => { createPayment({ ...data, dueDate: data.dueDate || "" }); setModalOpen(false); }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this payment record. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { removePayment(deleteId); setDeleteId(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
