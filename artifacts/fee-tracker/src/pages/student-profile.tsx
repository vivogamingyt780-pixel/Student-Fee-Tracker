import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Edit2, MessageCircle, Download, Plus, Trash2, Phone } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import StudentModal from "@/components/students/StudentModal";
import PaymentModal from "@/components/payments/PaymentModal";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { generateReceiptPDF } from "@/services/receipt";
import type { Student } from "@/services/data";

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { students, editStudent, removeStudent, getPaymentsForStudent, getPaidForStudent, profile, createPayment, removePayment } = useData();

  const student = students.find((s) => s.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [deleteStudentOpen, setDeleteStudentOpen] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  if (!student) {
    return (
      <AppLayout title="Student Profile">
        <div className="text-center py-16 text-muted-foreground">
          <p>Student not found.</p>
          <Button variant="link" onClick={() => setLocation("/students")}>Back to Students</Button>
        </div>
      </AppLayout>
    );
  }

  const payments = getPaymentsForStudent(student.id).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const totalPaid = getPaidForStudent(student.id);
  const remaining = Math.max(0, student.totalFee - totalPaid);

  const formatCurrency = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  const sendWhatsApp = () => {
    const msg = encodeURIComponent(
      `Dear ${student.parentName},\n\nFee reminder for ${student.name} (${student.className} - ${student.batch}).\n\nTotal Fee: ₹${student.totalFee.toLocaleString("en-IN")}\nPaid: ₹${totalPaid.toLocaleString("en-IN")}\nPending: ₹${remaining.toLocaleString("en-IN")}\n\nPlease clear dues at the earliest.\n\nThank you.`
    );
    window.open(`https://wa.me/91${student.mobile}?text=${msg}`, "_blank");
  };

  const downloadReceipt = (payment: ReturnType<typeof getPaymentsForStudent>[0]) => {
    if (!profile) return;
    generateReceiptPDF(payment, student, profile, payments.filter(p => p.paymentDate <= payment.paymentDate).reduce((s, p) => s + p.amountPaid, 0));
  };

  const shareReceiptViaWhatsApp = (payment: ReturnType<typeof getPaymentsForStudent>[0]) => {
    const msg = encodeURIComponent(
      `*Fee Receipt*\n\n*${profile?.name || "Coaching"}*\nReceipt No: ${payment.receiptNumber}\nDate: ${formatDate(payment.paymentDate)}\n\n*Student:* ${student.name}\n*Class:* ${student.className} | ${student.batch}\n*Amount Paid:* ₹${payment.amountPaid.toLocaleString("en-IN")}\n*Payment Type:* ${payment.paymentType === "full" ? "Full" : "Partial"}\n*Remaining:* ₹${remaining.toLocaleString("en-IN")}`
    );
    window.open(`https://wa.me/91${student.mobile}?text=${msg}`, "_blank");
  };

  return (
    <AppLayout title="Student Profile">
      {/* Back */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/students")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Students
        </Button>
      </div>

      {/* Header Card */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-xl">{student.name[0]}</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-foreground">{student.name}</h2>
                  <Badge variant={student.status === "active" ? "default" : "secondary"}>
                    {student.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{student.parentName}</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <Phone className="w-3.5 h-3.5" />
                  {student.mobile}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{student.batch} • {student.className} • Admitted {formatDate(student.admissionDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50" onClick={sendWhatsApp}
                data-testid="button-send-whatsapp">
                <MessageCircle className="w-4 h-4" />
                Reminder
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)} data-testid="button-edit-student">
                <Edit2 className="w-4 h-4" />
                Edit
              </Button>
              <Button size="sm" onClick={() => setPaymentOpen(true)} className="gap-1.5" data-testid="button-add-payment">
                <Plus className="w-4 h-4" />
                Add Payment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fee Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Fee", value: student.totalFee, color: "text-foreground" },
          { label: "Amount Paid", value: totalPaid, color: "text-green-600" },
          { label: "Remaining", value: remaining, color: remaining > 0 ? "text-red-500" : "text-green-600" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{formatCurrency(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Payment History</CardTitle>
            <span className="text-xs text-muted-foreground">{payments.length} payment{payments.length !== 1 ? "s" : ""}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No payments recorded for this student.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Receipt</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Date</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Type</th>
                    <th className="text-right px-4 py-3 text-muted-foreground font-medium">Amount</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Due Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      data-testid={`row-payment-${payment.id}`}>
                      <td className="px-4 py-3 font-medium">{payment.receiptNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatDate(payment.paymentDate)}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge variant={payment.paymentType === "full" ? "default" : "secondary"}>
                          {payment.paymentType === "full" ? "Full" : "Partial"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        ₹{payment.amountPaid.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {payment.dueDate ? formatDate(payment.dueDate) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadReceipt(payment)}
                            title="Download PDF Receipt" data-testid={`button-download-${payment.id}`}>
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => shareReceiptViaWhatsApp(payment)}
                            title="Share via WhatsApp" data-testid={`button-share-${payment.id}`}>
                            <MessageCircle className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => setDeletePaymentId(payment.id)}
                            title="Delete Payment" data-testid={`button-delete-payment-${payment.id}`}>
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
        </CardContent>
      </Card>

      <StudentModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={(data) => { editStudent(student.id, data); setEditOpen(false); }}
        student={student}
      />

      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSubmit={(data) => { createPayment({ ...data, dueDate: data.dueDate || "" }); setPaymentOpen(false); }}
        preSelectedStudent={student}
      />

      <AlertDialog open={!!deletePaymentId} onOpenChange={(v) => !v && setDeletePaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this payment record. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deletePaymentId) removePayment(deletePaymentId); setDeletePaymentId(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
