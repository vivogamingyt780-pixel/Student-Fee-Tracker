import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Student } from "@/services/data";
import { useData } from "@/contexts/DataContext";

const schema = z.object({
  studentId: z.string().min(1, "Please select a student"),
  amountPaid: z.coerce.number().min(1, "Amount must be greater than 0"),
  paymentType: z.enum(["full", "partial"]),
  paymentDate: z.string().min(1, "Payment date is required"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormValues) => void;
  preSelectedStudent?: Student | null;
}

export default function PaymentModal({ open, onClose, onSubmit, preSelectedStudent }: PaymentModalProps) {
  const { students, getPaidForStudent } = useData();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      studentId: "",
      amountPaid: 0,
      paymentType: "full",
      paymentDate: new Date().toISOString().slice(0, 10),
      dueDate: "",
      notes: "",
    },
  });

  const watchStudentId = form.watch("studentId");
  const watchPaymentType = form.watch("paymentType");

  useEffect(() => {
    if (open) {
      const initialStudentId = preSelectedStudent?.id || "";
      form.reset({
        studentId: initialStudentId,
        amountPaid: 0,
        paymentType: "full",
        paymentDate: new Date().toISOString().slice(0, 10),
        dueDate: "",
        notes: "",
      });
      if (preSelectedStudent) {
        setSelectedStudent(preSelectedStudent);
      } else {
        setSelectedStudent(null);
      }
    }
  }, [open, preSelectedStudent, form]);

  useEffect(() => {
    if (watchStudentId) {
      const student = students.find((s) => s.id === watchStudentId) || null;
      setSelectedStudent(student);

      if (student && watchPaymentType === "full") {
        const paid = getPaidForStudent(student.id);
        const remaining = Math.max(0, student.totalFee - paid);
        form.setValue("amountPaid", remaining);
      }
    }
  }, [watchStudentId, watchPaymentType, students, getPaidForStudent, form]);

  const handleSubmit = (values: FormValues) => {
    onSubmit(values);
    form.reset();
  };

  const totalFee = selectedStudent?.totalFee || 0;
  const alreadyPaid = selectedStudent ? getPaidForStudent(selectedStudent.id) : 0;
  const remaining = Math.max(0, totalFee - alreadyPaid);
  const activeStudents = students.filter((s) => s.status === "active");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField control={form.control} name="studentId" render={({ field }) => (
              <FormItem>
                <FormLabel>Student</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!!preSelectedStudent}>
                  <FormControl>
                    <SelectTrigger data-testid="select-payment-student">
                      <SelectValue placeholder="Select student" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {activeStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} — {s.className}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {selectedStudent && (
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Fee</span>
                  <span className="font-medium">₹{totalFee.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already Paid</span>
                  <span className="font-medium text-green-600">₹{alreadyPaid.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1">
                  <span className="text-muted-foreground font-medium">Remaining</span>
                  <span className={`font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
                    ₹{remaining.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}

            <FormField control={form.control} name="paymentType" render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Type</FormLabel>
                <div className="flex gap-2">
                  {(["full", "partial"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        field.onChange(type);
                        if (type === "full" && selectedStudent) {
                          form.setValue("amountPaid", remaining);
                        }
                      }}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        field.value === type
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border hover:bg-muted"
                      }`}
                      data-testid={`button-payment-type-${type}`}
                    >
                      {type === "full" ? "Full Payment" : "Partial Payment"}
                    </button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="amountPaid" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (₹)</FormLabel>
                  <FormControl><Input type="number" min="1" {...field} data-testid="input-payment-amount" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="paymentDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-payment-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {watchPaymentType === "partial" && (
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Due Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-due-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Any additional notes..." rows={2} {...field} data-testid="input-payment-notes" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-payment">Cancel</Button>
              <Button type="submit" data-testid="button-save-payment">Record Payment</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
