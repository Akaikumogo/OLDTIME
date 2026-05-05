import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { dailyAttendance, employeeById } from "@/lib/mock";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/data/StatusBadge";
import { formatDuration, formatTime } from "@/lib/format";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/daily-attendance")({
  head: () => ({
    meta: [
      { title: "Daily Attendance — WorkPlus" },
      { name: "description", content: "Visualize daily entry and exit times per employee." },
      { property: "og:title", content: "Daily Attendance — WorkPlus" },
      { property: "og:description", content: "Visualize daily entry and exit times per employee." },
    ],
  }),
  component: DailyAttendancePage,
});

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 22;
const TOTAL_MIN = (DAY_END_HOUR - DAY_START_HOUR) * 60;

function pct(date: Date) {
  const m = (date.getHours() - DAY_START_HOUR) * 60 + date.getMinutes();
  return Math.max(0, Math.min(100, (m / TOTAL_MIN) * 100));
}

function DailyAttendancePage() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });

  const day = useMemo(() => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [date]);

  const rows = useMemo(
    () => dailyAttendance.filter((r) => r.date.getTime() === day.getTime()),
    [day],
  );

  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i);

  return (
    <div>
      <PageHeader
        title="Daily Attendance"
        description="Timeline of when employees entered and left the workplace."
        actions={
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-44"
          />
        }
      />
      <div className="px-6 py-6">
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-[220px_1fr_120px] border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div>Employee</div>
            <div className="relative">
              <div className="flex justify-between">
                {hours.filter((_, i) => i % 2 === 0).map((h) => (
                  <span key={h} className="tabular-nums">{String(h).padStart(2, "0")}:00</span>
                ))}
              </div>
            </div>
            <div className="text-right">Worked</div>
          </div>

          <div className="divide-y divide-border">
            {rows.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No attendance recorded for this day.
              </div>
            )}
            {rows.slice(0, 30).map((r) => {
              const emp = employeeById(r.employeeId);
              const inPct = r.firstIn ? pct(r.firstIn) : 0;
              const outPct = r.lastOut ? pct(r.lastOut) : 0;
              const width = Math.max(0, outPct - inPct);
              return (
                <div key={r.id} className="grid grid-cols-[220px_1fr_120px] items-center px-4 py-3">
                  <div className="flex items-center gap-2.5 pr-4">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                        {emp?.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{emp?.fullName}</div>
                      <StatusBadge value={r.status} className="mt-0.5" />
                    </div>
                  </div>

                  <div className="relative h-7 rounded-md bg-muted/60">
                    {/* hour grid */}
                    {hours.map((h, i) => (
                      <div
                        key={h}
                        className="absolute top-0 bottom-0 border-l border-border/50"
                        style={{ left: `${(i / (hours.length - 1)) * 100}%` }}
                      />
                    ))}
                    {/* expected window 9-18 */}
                    <div
                      className="absolute top-0 bottom-0 border-x border-dashed border-primary/30"
                      style={{ left: `${pct(new Date(day.getTime() + 9 * 3600000))}%`, width: `${pct(new Date(day.getTime() + 18 * 3600000)) - pct(new Date(day.getTime() + 9 * 3600000))}%` }}
                    />
                    {/* worked bar */}
                    {r.firstIn && r.lastOut && (
                      <div
                        className={`absolute top-1.5 bottom-1.5 rounded-sm ${
                          r.status === "late" ? "bg-warning" : "bg-success"
                        }`}
                        style={{ left: `${inPct}%`, width: `${width}%` }}
                        title={`${formatTime(r.firstIn)} – ${formatTime(r.lastOut)}`}
                      />
                    )}
                  </div>

                  <div className="pl-4 text-right">
                    <div className="text-sm font-medium tabular-nums">
                      {formatDuration(r.workedMinutes)}
                    </div>
                    {r.lateMinutes > 0 && (
                      <div className="text-[11px] text-warning-foreground/80">+{r.lateMinutes}m late</div>
                    )}
                    {r.firstIn && (
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {formatTime(r.firstIn)} – {formatTime(r.lastOut)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
