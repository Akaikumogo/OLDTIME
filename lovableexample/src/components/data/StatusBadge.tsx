import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const TONE: Record<Tone, string> = {
  success: "bg-success/12 text-success border-success/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/12 text-info border-info/20",
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
};

const MAP: Record<string, Tone> = {
  // attendance
  on_time: "success",
  late: "warning",
  early_leave: "danger",
  overtime: "info",
  // generic
  active: "success",
  online: "success",
  approved: "success",
  present: "success",
  inactive: "neutral",
  offline: "danger",
  rejected: "danger",
  absent: "danger",
  suspended: "danger",
  pending: "warning",
  invited: "info",
  on_leave: "info",
  // permission types
  leave: "info",
  remote: "primary",
  business_trip: "primary",
  // door types
  entry: "success",
  exit: "info",
  bidirectional: "primary",
  // direction
  in: "success",
  out: "info",
  // admin roles
  Owner: "primary",
  Admin: "info",
  Manager: "neutral",
  Viewer: "neutral",
};

const LABELS: Record<string, string> = {
  on_time: "On time",
  early_leave: "Early leave",
  on_leave: "On leave",
  business_trip: "Business trip",
  in: "Entry",
  out: "Exit",
};

export function StatusBadge({
  value,
  tone,
  className,
}: {
  value: string;
  tone?: Tone;
  className?: string;
}) {
  const t = tone ?? MAP[value] ?? "neutral";
  const label = LABELS[value] ?? value.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize tracking-wide",
        TONE[t],
        className,
      )}
    >
      {label}
    </span>
  );
}
