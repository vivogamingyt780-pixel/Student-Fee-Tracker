import { Users, IndianRupee, AlertCircle, TrendingUp, Download, MessageCircle } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { useData } from "@/contexts/DataContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { generateReceiptPDF } from "@/services/receipt";
import { useAuth } from "@/contexts/AuthContext";

function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string; value: string; icon: React.ElementType; color: string; subtitle?: string;
}) {
  return (
    <Card data-testid={`card-stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { stats, students, getPaymentsForStudent, profile } = useData();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return dateStr; }
  };

  const handleDownloadReceipt = (payment: typeof stats extends null ? never : (typeof stats)["recentPayments"][0]) => {
    const student = students.find((s) => s.id === payment.studentId);
    if (!student || !profile) return;
    const allPayments = getPaymentsForStudent(student.id);
    const totalPaid = allPayments.reduce((s, p) => s + p.amountPaid, 0);
    generateReceiptPDF(payment, student, profile, totalPaid);
  };

  return (
    <AppLayout title="Dashboard">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Students"
          value={String(stats?.totalStudents || 0)}
          icon={Users}
          color="bg-blue-100 text-blue-600"
          subtitle="Enrolled students"
        />
        <StatCard
          title="Total Collected"
          value={formatCurrency(stats?.totalCollected || 0)}
          icon={IndianRupee}
          color="bg-green-100 text-green-600"
          subtitle="All time"
        />
        <StatCard
          title="Pending Fees"
          value={formatCurrency(stats?.totalPending || 0)}
          icon={AlertCircle}
          color="bg-amber-100 text-amber-600"
          subtitle="Outstanding balance"
        />
        <StatCard
          title="This Month"
          value={formatCurrency(stats?.monthlyCollection || 0)}
          icon={TrendingUp}
          color="bg-indigo-100 text-indigo-600"
          subtitle="Monthly collection"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Monthly Chart */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Monthly Collection Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats?.monthlyData || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(215 16% 47%)"
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), "Collected"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid hsl(214 32% 91%)", fontSize: 12 }}
                />
                <Bar dataKey="amount" fill="hsl(231 48% 48%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fee Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Fee Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Total Fees", value: (stats?.totalCollected || 0) + (stats?.totalPending || 0), color: "text-foreground" },
              { label: "Collected", value: stats?.totalCollected || 0, color: "text-green-600" },
              { label: "Pending", value: stats?.totalPending || 0, color: "text-red-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={`text-sm font-semibold ${color}`}>{formatCurrency(value)}</span>
              </div>
            ))}

            {/* Collection rate */}
            {(stats?.totalCollected || 0) + (stats?.totalPending || 0) > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Collection Rate</span>
                  <span>
                    {Math.round(((stats?.totalCollected || 0) / ((stats?.totalCollected || 0) + (stats?.totalPending || 0))) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{
                      width: `${Math.round(((stats?.totalCollected || 0) / ((stats?.totalCollected || 0) + (stats?.totalPending || 0))) * 100)}%`
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Payments */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Recent Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!stats?.recentPayments?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No payments recorded yet. Add a student and record the first payment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium">Student</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Receipt</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden md:table-cell">Type</th>
                    <th className="text-right px-4 py-3 text-muted-foreground font-medium">Amount</th>
                    <th className="text-left px-4 py-3 text-muted-foreground font-medium hidden sm:table-cell">Date</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      data-testid={`row-payment-${payment.id}`}>
                      <td className="px-4 py-3 font-medium">{payment.studentName}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{payment.receiptNumber}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant={payment.paymentType === "full" ? "default" : "secondary"}>
                          {payment.paymentType === "full" ? "Full" : "Partial"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        ₹{payment.amountPaid.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatDate(payment.paymentDate)}</td>
                      <td className="px-4 py-3">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleDownloadReceipt(payment)}
                          title="Download Receipt"
                          data-testid={`button-download-receipt-${payment.id}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
