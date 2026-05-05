import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/data/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { attendanceEvents, departments, employees } from "@/lib/mock";
import { Download, UserCheck, UserX, Clock, Timer } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — WorkPlus" },
      { name: "description", content: "Attendance and punctuality reports across teams." },
      { property: "og:title", content: "Reports — WorkPlus" },
      { property: "og:description", content: "Attendance and punctuality reports across teams." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [dept, setDept] = useState<string>("all");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const empSet = useMemo(
    () =>
      new Set(
        employees.filter((e) => dept === "all" || e.departmentId === dept).map((e) => e.id),
      ),
    [dept],
  );

  const ev = useMemo(
    () =>
      attendanceEvents.filter(
        (e) => empSet.has(e.employeeId) && e.at >= fromDate && e.at <= toDate,
      ),
    [empSet, fromDate, toDate],
  );

  const inEvents = ev.filter((e) => e.direction === "in");
  const onTime = inEvents.filter((e) => e.status === "on_time").length;
  const late = inEvents.filter((e) => e.status === "late").length;
  const totalDays = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));

  // per-department stacked
  const perDept = departments.map((d) => {
    const ids = new Set(employees.filter((e) => e.departmentId === d.id).map((e) => e.id));
    const ins = ev.filter((e) => e.direction === "in" && ids.has(e.employeeId));
    return {
      name: d.code,
      "On time": ins.filter((e) => e.status === "on_time").length,
      Late: ins.filter((e) => e.status === "late").length,
    };
  });

  const punctuality = [
    { name: "On time", value: onTime, color: "var(--color-chart-2)" },
    { name: "Late", value: late, color: "var(--color-chart-3)" },
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Aggregated attendance metrics for the selected period."
        actions={
          <Button variant="outline">
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
        }
      />
      <div className="space-y-6 px-6 py-6">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Department</label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="On-time arrivals" value={onTime} icon={UserCheck} delta={2.1} />
          <StatCard label="Late arrivals" value={late} icon={Clock} delta={-4.5} />
          <StatCard
            label="Punctuality"
            value={`${onTime + late === 0 ? 0 : Math.round((onTime / (onTime + late)) * 100)}%`}
            icon={Timer}
          />
          <StatCard label="Days covered" value={totalDays} icon={UserX} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Attendance by department</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perDept} margin={{ left: -16, right: 4, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="On time" stackId="a" fill="var(--color-chart-2)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Late" stackId="a" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Punctuality split</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={punctuality} dataKey="value" innerRadius={55} outerRadius={88} paddingAngle={2}>
                    {punctuality.map((p) => (
                      <Cell key={p.name} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
