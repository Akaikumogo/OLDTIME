import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/data/StatCard";
import { StatusBadge } from "@/components/data/StatusBadge";
import { EmployeeCell } from "@/components/data/EmployeeCell";
import {
  attendanceEvents,
  doors,
  employees,
  departments,
  employeeById,
} from "@/lib/mock";
import { formatTime } from "@/lib/format";
import { Users, UserCheck, Clock, DoorOpen } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — WorkPlus" },
      { name: "description", content: "Overview of attendance, doors, and workforce activity." },
      { property: "og:title", content: "Dashboard — WorkPlus" },
      { property: "og:description", content: "Overview of attendance, doors, and workforce activity." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEvents = attendanceEvents.filter((e) => e.at >= todayStart);
  const presentToday = new Set(todayEvents.filter((e) => e.direction === "in").map((e) => e.employeeId)).size;
  const lateToday = new Set(
    todayEvents.filter((e) => e.direction === "in" && e.status === "late").map((e) => e.employeeId),
  ).size;
  const doorsOnline = doors.filter((d) => d.online).length;

  // attendance trend last 14 days
  const trend = Array.from({ length: 14 }, (_, i) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (13 - i));
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const dayEvents = attendanceEvents.filter((e) => e.at >= day && e.at < next && e.direction === "in");
    const present = new Set(dayEvents.map((e) => e.employeeId)).size;
    const late = new Set(dayEvents.filter((e) => e.status === "late").map((e) => e.employeeId)).size;
    return {
      day: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      Present: present,
      Late: late,
    };
  });

  const headcount = departments.map((d) => ({
    name: d.code,
    headcount: employees.filter((e) => e.departmentId === d.id).length,
  }));

  const recent = attendanceEvents.slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live snapshot of your workforce, doors, and attendance trends."
      />
      <div className="grid gap-4 px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Employees" value={employees.length} icon={Users} delta={2.4} />
          <StatCard label="Present Today" value={presentToday} icon={UserCheck} delta={1.1} hint={`of ${employees.filter((e) => e.status === "active").length} active`} />
          <StatCard label="Late Today" value={lateToday} icon={Clock} delta={-3.2} />
          <StatCard label="Doors Online" value={`${doorsOnline}/${doors.length}`} icon={DoorOpen} delta={0} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Attendance · last 14 days</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ left: -12, right: 8, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="Present" stroke="var(--color-chart-1)" fill="url(#g1)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Late" stroke="var(--color-chart-3)" fill="url(#g2)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Department headcount</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={headcount} margin={{ left: -16, right: 4, top: 4 }}>
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
                  <Bar dataKey="headcount" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent attendance events</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recent.map((ev) => {
                const emp = employeeById(ev.employeeId);
                const door = doors.find((d) => d.id === ev.doorId);
                return (
                  <div key={ev.id} className="flex items-center gap-4 px-6 py-3">
                    <EmployeeCell
                      name={emp?.fullName ?? "—"}
                      initials={emp?.initials ?? "?"}
                      subtitle={door?.name}
                    />
                    <div className="ml-auto flex items-center gap-3">
                      <StatusBadge value={ev.direction} />
                      <StatusBadge value={ev.status} />
                      <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                        {formatTime(ev.at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
