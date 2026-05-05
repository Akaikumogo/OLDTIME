import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/data/StatCard";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { computerActivity, computers, departments, employees } from "@/lib/mock";
import { Activity, Cpu, Timer, AppWindow } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { EfficiencyRanking } from "@/components/data/EfficiencyRanking";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — WorkPlus" },
      { name: "description", content: "Workstation usage analytics, top apps, and peak hours." },
      { property: "og:title", content: "Analytics — WorkPlus" },
      { property: "og:description", content: "Workstation usage analytics, top apps, and peak hours." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const totalMinutes = computerActivity.reduce((s, a) => s + a.durationMinutes, 0);
  const totalSessions = computerActivity.length;
  const avgSession = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

  const topApps = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of computerActivity) {
      map.set(a.app, (map.get(a.app) ?? 0) + a.durationMinutes);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([app, minutes]) => ({ app, hours: +(minutes / 60).toFixed(1) }));
  }, []);

  const dailyActive = useMemo(() => {
    const buckets = new Map<string, Set<string>>();
    for (const a of computerActivity) {
      const key = a.startedAt.toISOString().slice(0, 10);
      const set = buckets.get(key) ?? new Set();
      set.add(a.computerId);
      buckets.set(key, set);
    }
    return Array.from(buckets.entries())
      .sort()
      .map(([day, set]) => ({
        day: new Date(day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        active: set.size,
      }));
  }, []);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of computerActivity) {
      map.set(a.category, (map.get(a.category) ?? 0) + a.durationMinutes);
    }
    const colors = [
      "var(--color-chart-1)",
      "var(--color-chart-2)",
      "var(--color-chart-3)",
      "var(--color-chart-4)",
      "var(--color-chart-5)",
      "var(--color-muted-foreground)",
    ];
    return Array.from(map.entries()).map(([name, minutes], i) => ({
      name,
      value: Math.round(minutes / 60),
      color: colors[i % colors.length]!,
    }));
  }, []);

  const peakHours = useMemo(() => {
    const buckets = new Array(24).fill(0) as number[];
    for (const a of computerActivity) {
      buckets[a.startedAt.getHours()]! += a.durationMinutes;
    }
    return buckets
      .map((m, h) => ({ hour: `${String(h).padStart(2, "0")}:00`, hours: +(m / 60).toFixed(1) }))
      .filter((b) => b.hours > 0);
  }, []);

  const productivityByDept = useMemo(() => {
    const empMap = new Map(employees.map((e) => [e.id, e.departmentId] as const));
    const cmpMap = new Map(computers.map((c) => [c.id, c.assignedTo] as const));
    const map = new Map<string, number>();
    for (const a of computerActivity) {
      const eId = cmpMap.get(a.computerId) ?? null;
      if (!eId) continue;
      const dId = empMap.get(eId);
      if (!dId) continue;
      map.set(dId, (map.get(dId) ?? 0) + a.durationMinutes);
    }
    return departments.map((d) => ({
      name: d.code,
      hours: Math.round((map.get(d.id) ?? 0) / 60),
    }));
  }, []);

  return (
    <div>
      <PageHeader title="Analytics" description="Productivity, app usage, and engagement insights." />
      <div className="space-y-6 px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tracked time" value={formatDuration(totalMinutes)} icon={Timer} delta={5.4} />
          <StatCard label="Avg. session" value={`${avgSession}m`} icon={Activity} delta={1.2} />
          <StatCard label="Active computers" value={computers.filter((c) => c.online).length} icon={Cpu} />
          <StatCard label="Tracked apps" value={topApps.length * 2} icon={AppWindow} hint="across all workstations" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Top applications · hours</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topApps} layout="vertical" margin={{ left: 8, right: 16, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="app" type="category" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="hours" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Active computers · daily</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyActive} margin={{ left: -16, right: 8, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="active" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Peak hours · tracked hours</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHours} margin={{ left: -16, right: 4, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} interval={1} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="hours" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Category breakdown</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {categoryBreakdown.map((c) => (
                      <Cell key={c.name} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Tracked hours by department</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivityByDept} margin={{ left: -16, right: 4, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="hours" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <EfficiencyRanking />
      </div>
    </div>
  );
}
