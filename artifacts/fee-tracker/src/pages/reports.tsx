import { useState, useMemo } from "react";
import { Download, TrendingUp, Users, AlertTriangle } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { exportMonthlyReport, exportStudentWiseReport, exportPendingReport } from "@/services/excel";

export default function ReportsPage() {
  const { students, payments, profile } = useData();

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  // Monthly report data
  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((p) => {
      const month = p.paymentDate.slice(0, 7);
      map.set(month, (map.get(month) || 0) + p.amountPaid);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, amount]) => ({
        month: new Date(month + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
        amount,
      }));
  }, [payments]);

  // Student-wise data
  const studentWiseData = useMemo(() => {
    return students.map((s) => {
      const paid = payments.filter((p) => p.studentId === s.id).reduce((sum, p) => sum + p.amountPaid, 0);
      return { ...s, paid, remaining: Math.max(0, s.totalFee - paid) };
    }).sort((a, b) => b.remaining - a.remaining);
  }, [students, payments]);

  // Pending data
  const pendingData = useMemo(() => {
    return studentWiseData.filter((s) => s.remaining > 0);
  }, [studentWiseData]);

  const coachingName = profile?.name || "My Coaching";

  return (
    <AppLayout title="Reports">
      <Tabs defaultValue="monthly">
        <TabsList className="mb-6">
          <TabsTrigger value="monthly" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Monthly
          </TabsTrigger>
          <TabsTrigger value="student-wise" className="gap-2">
            <Users className="w-4 h-4" />
            Student-wise
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Pending Fees
          </TabsTrigger>
        </TabsList>

        {/* Monthly Report */}
        <TabsContent value="monthly">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Monthly Collection Report</h3>
              <p className="text-sm text-muted-foreground">
                {monthlyData.length} month{monthlyData.length !== 1 ? "s" : ""} · Total: {formatCurrency(payments.reduce((s, p) => s + p.amountPaid, 0))}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportMonthlyReport(payments, students, coachingName)} data-testid="button-export-monthly">
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>

          {monthlyData.length > 0 && (
            <Card className="mb-6">
              <CardContent className="pt-5">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)"
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v: number) => [formatCurrency(v), "Collected"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
                    />
                    <Bar dataKey="amount" fill="hsl(231 48% 48%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            {monthlyData.length === 0 ? (
              <CardContent className="text-center py-10 text-muted-foreground">No payment data yet.</CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Month</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Collected</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((row) => {
                      const txns = payments.filter((p) => {
                        const m = new Date(p.paymentDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
                        return m === row.month;
                      }).length;
                      return (
                        <tr key={row.month} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{row.month}</td>
                          <td className="px-4 py-3 text-right font-semibold text-green-600">{formatCurrency(row.amount)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{txns}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Student-wise Report */}
        <TabsContent value="student-wise">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Student-wise Fee Report</h3>
              <p className="text-sm text-muted-foreground">{students.length} students</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportStudentWiseReport(students, payments, coachingName)} data-testid="button-export-student-wise">
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>

          <Card>
            {studentWiseData.length === 0 ? (
              <CardContent className="text-center py-10 text-muted-foreground">No student data yet.</CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Student</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Class / Batch</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Total Fee</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Paid</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Remaining</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentWiseData.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                        data-testid={`row-student-report-${s.id}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.parentName}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{s.className} · {s.batch}</td>
                        <td className="px-4 py-3 text-right">₹{s.totalFee.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-right text-green-600 font-medium">₹{s.paid.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <span className={s.remaining > 0 ? "text-red-500" : "text-green-600"}>
                            ₹{s.remaining.toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Pending Fees */}
        <TabsContent value="pending">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Pending Fees Report</h3>
              <p className="text-sm text-muted-foreground">
                {pendingData.length} student{pendingData.length !== 1 ? "s" : ""} with outstanding balance ·
                Total: {formatCurrency(pendingData.reduce((s, st) => s + st.remaining, 0))}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportPendingReport(students, payments, coachingName)} data-testid="button-export-pending">
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          </div>

          <Card>
            {pendingData.length === 0 ? (
              <CardContent className="text-center py-10 text-green-600 font-medium">
                All fees are collected.
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium">Student</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Class / Batch</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Total Fee</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Paid</th>
                      <th className="text-right px-4 py-3 text-muted-foreground font-medium">Pending</th>
                      <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Mobile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingData.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                        data-testid={`row-pending-${s.id}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.parentName}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{s.className} · {s.batch}</td>
                        <td className="px-4 py-3 text-right">₹{s.totalFee.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-right text-green-600">₹{s.paid.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-500">₹{s.remaining.toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{s.mobile}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
