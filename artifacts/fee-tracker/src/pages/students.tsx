import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Plus, Search, Edit2, Trash2, Eye, MessageCircle, ChevronRight } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import StudentModal from "@/components/students/StudentModal";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import type { Student } from "@/services/data";
import { useData as useDataInner } from "@/contexts/DataContext";

export default function StudentsPage() {
  const { students, createStudent, editStudent, removeStudent, getPaidForStudent } = useData();
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const batches = useMemo(() => ["all", ...Array.from(new Set(students.map((s) => s.batch))).sort()], [students]);
  const classes = useMemo(() => ["all", ...Array.from(new Set(students.map((s) => s.className))).sort()], [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.mobile.includes(q) || s.parentName.toLowerCase().includes(q);
      const matchBatch = batchFilter === "all" || s.batch === batchFilter;
      const matchClass = classFilter === "all" || s.className === classFilter;
      return matchSearch && matchBatch && matchClass;
    });
  }, [students, search, batchFilter, classFilter]);

  const handleAdd = (data: Omit<Student, "id" | "userId" | "createdAt">) => {
    createStudent(data);
    setModalOpen(false);
  };

  const handleEdit = (data: Omit<Student, "id" | "userId" | "createdAt">) => {
    if (editingStudent) {
      editStudent(editingStudent.id, data);
      setEditingStudent(null);
      setModalOpen(false);
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      removeStudent(deleteId);
      setDeleteId(null);
    }
  };

  const sendWhatsApp = (student: Student) => {
    const paid = getPaidForStudent(student.id);
    const remaining = Math.max(0, student.totalFee - paid);
    const msg = encodeURIComponent(
      `Dear ${student.parentName},\n\nThis is a fee reminder for ${student.name} (${student.className} - ${student.batch}).\n\nPending Fee: ₹${remaining.toLocaleString("en-IN")}\n\nPlease clear the dues at the earliest.\n\nThank you.`
    );
    window.open(`https://wa.me/91${student.mobile}?text=${msg}`, "_blank");
  };

  return (
    <AppLayout title="Students">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, mobile, or parent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-students"
          />
        </div>
        <Select value={batchFilter} onValueChange={setBatchFilter}>
          <SelectTrigger className="w-full sm:w-36" data-testid="select-filter-batch">
            <SelectValue placeholder="Batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            {batches.filter(b => b !== "all").map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-full sm:w-36" data-testid="select-filter-class">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.filter(c => c !== "all").map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditingStudent(null); setModalOpen(true); }} data-testid="button-add-student">
          <Plus className="w-4 h-4 mr-2" />
          Add Student
        </Button>
      </div>

      {/* Summary */}
      <div className="flex gap-3 mb-4 text-sm text-muted-foreground">
        <span>{filtered.length} student{filtered.length !== 1 ? "s" : ""}</span>
        {(search || batchFilter !== "all" || classFilter !== "all") && (
          <button className="text-primary hover:underline" onClick={() => { setSearch(""); setBatchFilter("all"); setClassFilter("all"); }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <Card>
        {filtered.length === 0 ? (
          <CardContent className="text-center py-12 text-muted-foreground">
            {students.length === 0
              ? "No students yet. Add your first student to get started."
              : "No students match your search."}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Name</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Batch / Class</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Mobile</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Total Fee</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium hidden lg:table-cell">Paid</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Remaining</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student) => {
                  const paid = getPaidForStudent(student.id);
                  const remaining = Math.max(0, student.totalFee - paid);
                  return (
                    <tr key={student.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      data-testid={`row-student-${student.id}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{student.name}</div>
                        <div className="text-xs text-muted-foreground">{student.parentName}</div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="text-foreground">{student.batch}</div>
                        <div className="text-xs text-muted-foreground">{student.className}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{student.mobile}</td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">₹{student.totalFee.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium hidden lg:table-cell">
                        ₹{paid.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        <span className={remaining > 0 ? "text-red-500" : "text-green-600"}>
                          ₹{remaining.toLocaleString("en-IN")}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge variant={student.status === "active" ? "default" : "secondary"}>
                          {student.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => sendWhatsApp(student)}
                            title="Send WhatsApp Reminder" data-testid={`button-whatsapp-${student.id}`}>
                            <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingStudent(student); setModalOpen(true); }}
                            title="Edit" data-testid={`button-edit-student-${student.id}`}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteId(student.id)}
                            title="Delete" data-testid={`button-delete-student-${student.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <Link href={`/students/${student.id}`}>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="View Profile"
                              data-testid={`link-view-student-${student.id}`}>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <StudentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingStudent(null); }}
        onSubmit={editingStudent ? handleEdit : handleAdd}
        student={editingStudent}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this student and all their payment records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
