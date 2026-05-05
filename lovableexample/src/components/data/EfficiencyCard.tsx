import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import type { EfficiencyBreakdown } from "@/lib/productivity";
import {
  Activity,
  Clock,
  Cpu,
  AlertTriangle,
  LogOut,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

function scoreTone(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export function EfficiencyCard({
  data,
  showFormula = true,
}: {
  data: EfficiencyBreakdown;
  showFormula?: boolean;
}) {
  const tone = scoreTone(data.efficiency);
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <CardTitle className="text-base">Work Efficiency</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Combined attendance, computer usage, and permissions.
            </p>
          </div>
          <div className="text-right">
            <div className={cn("text-3xl font-semibold tabular-nums", tone)}>
              {data.efficiency.toFixed(1)}%
            </div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Efficiency
            </div>
          </div>
        </div>
        <Progress value={data.efficiency} className="mt-3 h-1.5" />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Clock} label="Work time" value={formatDuration(data.workedMinutes)} />
          <Metric icon={Cpu} label="Computer active" value={formatDuration(data.computerActiveMinutes)} />
          <Metric icon={ThumbsUp} label="Productive apps" value={formatDuration(data.productiveMinutes)} tone="success" />
          <Metric icon={ThumbsDown} label="Unproductive apps" value={formatDuration(data.unproductiveMinutes)} tone="destructive" />
          <Metric icon={ShieldCheck} label="Permission time" value={formatDuration(data.permissionMinutes)} />
          <Metric icon={AlertTriangle} label="Late minutes" value={`${data.lateMinutes}m`} tone="destructive" />
          <Metric icon={LogOut} label="Early leave" value={`${data.earlyLeaveMinutes}m`} tone="destructive" />
          <Metric icon={Activity} label="Expected" value={formatDuration(data.expectedMinutes)} />
        </div>

        {showFormula && (
          <div className="grid gap-3 lg:grid-cols-2">
            <FormulaBlock
              title="Formula"
              lines={[
                "Efficiency =",
                "(",
                "  Productive computer time",
                "  + Valid permission time",
                "  − Late penalty",
                "  − Early leave penalty",
                ")",
                "/ Expected work time × 100",
              ]}
            />
            <FormulaBlock
              title="Ish samaradorligi"
              lines={[
                "Ish samaradorligi =",
                "(",
                "  foydali kompyuter vaqti",
                "  + ruxsatli vaqt",
                "  − kechikish jarimasi",
                "  − erta ketish jarimasi",
                ")",
                "/ belgilangan ish vaqti × 100",
              ]}
            />
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Why this score
          </p>
          <ul className="space-y-1 text-sm">
            {data.reasons.map((r, i) => (
              <li key={i} className="text-muted-foreground">• {r}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "success" | "destructive";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function FormulaBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <pre className="font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
{lines.join("\n")}
      </pre>
    </div>
  );
}
