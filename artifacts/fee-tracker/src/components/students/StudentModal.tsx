import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Student } from "@/services/data";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  parentName: z.string().min(2, "Parent name is required"),
  mobile: z.string().min(10, "Enter a valid 10-digit mobile number").max(15),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  batch: z.string().min(1, "Batch is required"),
  className: z.string().min(1, "Class is required"),
  totalFee: z.coerce.number().min(1, "Fee must be greater than 0"),
  admissionDate: z.string().min(1, "Admission date is required"),
  status: z.enum(["active", "inactive"]),
});

type FormValues = z.infer<typeof schema>;

interface StudentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: FormValues) => void;
  student?: Student | null;
}

const BATCHES = ["Morning", "Afternoon", "Evening", "Weekend"];
const CLASSES = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "Other"];

export default function StudentModal({ open, onClose, onSubmit, student }: StudentModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", parentName: "", mobile: "", email: "", address: "",
      batch: "Morning", className: "Class 10", totalFee: 0,
      admissionDate: new Date().toISOString().slice(0, 10),
      status: "active",
    },
  });

  useEffect(() => {
    if (student) {
      form.reset({
        name: student.name,
        parentName: student.parentName,
        mobile: student.mobile,
        email: student.email || "",
        address: student.address || "",
        batch: student.batch,
        className: student.className,
        totalFee: student.totalFee,
        admissionDate: student.admissionDate,
        status: student.status,
      });
    } else {
      form.reset({
        name: "", parentName: "", mobile: "", email: "", address: "",
        batch: "Morning", className: "Class 10", totalFee: 0,
        admissionDate: new Date().toISOString().slice(0, 10),
        status: "active",
      });
    }
  }, [student, form, open]);

  const handleSubmit = (values: FormValues) => {
    onSubmit(values);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{student ? "Edit Student" : "Add New Student"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Student Name</FormLabel>
                  <FormControl><Input placeholder="Full name" {...field} data-testid="input-student-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="parentName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent / Guardian Name</FormLabel>
                  <FormControl><Input placeholder="Parent name" {...field} data-testid="input-parent-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="mobile" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile Number</FormLabel>
                  <FormControl><Input placeholder="10-digit mobile" {...field} data-testid="input-mobile" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl><Input type="email" placeholder="email@example.com" {...field} data-testid="input-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="admissionDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Admission Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-admission-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="batch" render={({ field }) => (
                <FormItem>
                  <FormLabel>Batch</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-batch">
                        <SelectValue placeholder="Select batch" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BATCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="className" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-class">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CLASSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="totalFee" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Course Fee (₹)</FormLabel>
                  <FormControl><Input type="number" min="0" placeholder="12000" {...field} data-testid="input-total-fee" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Address (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Home address" rows={2} {...field} data-testid="input-address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-student">Cancel</Button>
              <Button type="submit" data-testid="button-save-student">
                {student ? "Save Changes" : "Add Student"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
