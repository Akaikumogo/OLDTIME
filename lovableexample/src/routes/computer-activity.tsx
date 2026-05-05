import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { computerActivity, computers, employeeById } from "@/lib/mock";
import { OnlineDot } from "@/components/common/OnlineDot";
import { formatDuration, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/computer-activity")({
  head: () => ({
    meta: [
      { title: "Computer Activity — WorkPlus" },
      { name: "description", content: "Per-workstation app usage timeline and breakdown." },
      { property: "og:title", content: "Computer Activity — WorkPlus" },
      { property: "og:description", content: "Per-workstation app usage timeline and breakdown." },
    ],
  }),
  component: ComputerActivityPage,
});

const CATEGORY_COLOR: Record<string, string> = {
  Development: "bg-chart-1",
  Design: "bg-chart-4",
  Communication: "bg-chart-2",
  Browser: "bg-chart-3",
  Productivity: "bg-primary",
  Other: "bg-muted-foreground",
};

function ComputerActivityPage() {
  const [selected, setSelected] = useState<string>(computers[0]!.id);
  const [query, setQuery] = useState("");

  const list = useMemo(
    () =>
      computers.filter((c) => {
        if (!query) return true;
        const emp = c.assignedTo ? employeeById(c.assignedTo) : null;
        return (
          c.hostname.toLowerCase().includes(query.toLowerCase()) ||
          (emp?.fullName.toLowerCase().includes(query.toLowerCase()) ?? false)
        );
      }),
    [query],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayActivity = useMemo(
    () =>
      computerActivity
        .filter((a) => a.computerId === selected && a.startedAt >= today && a.startedAt < tomorrow)
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime()),
    [selected, today, tomorrow],
  );

  // app rollup last 7 days
  const rollup = useMemo(() => {
    const map = new Map<string, { app: string; category: string; minutes: number; sessions: number; last: Date }>();
    for (const a of computerActivity) {
      if (a.computerId !== selected) continue;
      const cur = map.get(a.app) ?? { app: a.app, category: a.category, minutes: 0, sessions: 0, last: a.startedAt };
      cur.minutes += a.durationMinutes;
      cur.sessions += 1;
      if (a.startedAt > cur.last) cur.last = a.startedAt;
      map.set(a.app, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
  }, [selected]);

  const selectedComputer = computers.find((c) => c.id === selected)!;
  const selectedEmp = selectedComputer.assignedTo ? employeeById(selectedComputer.assignedTo) : null;

  return (
    <div>
      <PageHeader title="Computer Activity" description="Live workstation usage and app sessions." />
      <div className="grid gap-4 px-6 py-6 lg:grid-cols-[300px_1fr]">
        <Card className="p-0">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search computers..."
                className="h-9 pl-8"
              />
            </div>
          </div>
          <div className="max-h-[640px] divide-y divide-border overflow-y-auto">
            {list.map((c) => {
              const emp = c.assignedTo ? employeeById(c.assignedTo) : null;
              const active = c.id === selected;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
                    active && "bg-accent",
                  )}
                >
                  <OnlineDot online={c.online} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs font-medium">{c.hostname}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {emp?.fullName ?? "Unassigned"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-sm font-semibold">{selectedComputer.hostname}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedEmp?.fullName ?? "Unassigned"} · {selectedComputer.os} · {selectedComputer.ip}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <OnlineDot online={selectedComputer.online} />
                {selectedComputer.online ? "Online" : "Offline"}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Today's activity</h3>
              <span className="text-xs text-muted-foreground">
                {formatDuration(todayActivity.reduce((s, a) => s + a.durationMinutes, 0))}
              </span>
            </div>
            {todayActivity.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No activity recorded today.</p>
            ) : (
              <div className="space-y-2">
                {todayActivity.map((a) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                      {formatTime(a.startedAt)}
                    </span>
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", CATEGORY_COLOR[a.category])} />
                    <span className="flex-1 truncate text-sm">{a.app}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatDuration(a.durationMinutes)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-0">
            <div className="border-b border-border px-5 py-3">
              <h3 className="text-sm font-semibold">App usage · last 7 days</h3>
            </div>
            <div className="divide-y divide-border">
              {rollup.slice(0, 12).map((r) => {
                const max = rollup[0]!.minutes;
                const pct = (r.minutes / max) * 100;
                return (
                  <div key={r.app} className="grid grid-cols-[1fr_120px] items-center gap-3 px-5 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", CATEGORY_COLOR[r.category])} />
                        <span className="text-sm font-medium">{r.app}</span>
                        <span className="text-[11px] text-muted-foreground">{r.category}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium tabular-nums">{formatDuration(r.minutes)}</div>
                      <div className="text-[11px] text-muted-foreground">{r.sessions} sessions</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
