import {
  attendanceEvents,
  computerActivity,
  computers,
  dailyAttendance,
  employees,
  workPermissions,
  type AppCategory,
  type Employee,
} from "@/lib/mock";

/** Attendance / productivity policy (would normally come from settings). */
export const POLICY = {
  expectedDailyMinutes: 9 * 60, // 09:00 → 18:00
  shiftStartHour: 9,
  shiftEndHour: 18,
  latePenaltyPerMinute: 1.0,
  earlyLeavePenaltyPerMinute: 1.0,
  // Permission counts as fully credited work time, capped at one shift / day.
  permissionDailyCapMinutes: 9 * 60,
};

const PRODUCTIVE: AppCategory[] = ["Productivity", "Development", "Design"];
const UNPRODUCTIVE: AppCategory[] = ["Other", "Browser"];

export function isProductive(c: AppCategory) {
  return PRODUCTIVE.includes(c);
}
export function isUnproductive(c: AppCategory) {
  return UNPRODUCTIVE.includes(c);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function workdaysBetween(from: Date, to: Date) {
  let n = 0;
  const cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur.getTime() <= end.getTime()) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

export type EfficiencyBreakdown = {
  employeeId: string;
  computerId: string | null;
  expectedMinutes: number;
  workedMinutes: number;
  computerActiveMinutes: number;
  productiveMinutes: number;
  unproductiveMinutes: number;
  permissionMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  latePenalty: number;
  earlyLeavePenalty: number;
  efficiency: number; // 0-100
  reasons: string[];
};

export type Range = { from: Date; to: Date };

export function defaultRange(): Range {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 13);
  return { from: startOfDay(from), to: startOfDay(to) };
}

function inRange(d: Date, r: Range) {
  const t = d.getTime();
  const end = new Date(r.to);
  end.setHours(23, 59, 59, 999);
  return t >= startOfDay(r.from).getTime() && t <= end.getTime();
}

export function computeEfficiency(employeeId: string, range: Range = defaultRange()): EfficiencyBreakdown {
  const computer = computers.find((c) => c.assignedTo === employeeId) ?? null;
  const days = Math.max(1, workdaysBetween(range.from, range.to));
  const expectedMinutes = days * POLICY.expectedDailyMinutes;

  // Attendance roll-up
  const daily = dailyAttendance.filter((d) => d.employeeId === employeeId && inRange(d.date, range));
  const workedMinutes = daily.reduce((s, d) => s + d.workedMinutes, 0);
  const lateMinutes = daily.reduce((s, d) => s + d.lateMinutes, 0);

  // Early leave: compute from out events vs shift end
  const events = attendanceEvents.filter(
    (e) => e.employeeId === employeeId && e.direction === "out" && inRange(e.at, range),
  );
  let earlyLeaveMinutes = 0;
  for (const ev of events) {
    if (ev.status !== "early_leave") continue;
    const expectedOut = new Date(ev.at);
    expectedOut.setHours(POLICY.shiftEndHour, 0, 0, 0);
    earlyLeaveMinutes += Math.max(0, Math.round((expectedOut.getTime() - ev.at.getTime()) / 60000));
  }

  // Computer activity (only sessions on the assigned computer)
  let computerActiveMinutes = 0;
  let productiveMinutes = 0;
  let unproductiveMinutes = 0;
  if (computer) {
    for (const a of computerActivity) {
      if (a.computerId !== computer.id) continue;
      if (!inRange(a.startedAt, range)) continue;
      computerActiveMinutes += a.durationMinutes;
      if (isProductive(a.category)) productiveMinutes += a.durationMinutes;
      else if (isUnproductive(a.category)) unproductiveMinutes += a.durationMinutes;
    }
  }

  // Approved permission time, capped per day
  let permissionMinutes = 0;
  for (const p of workPermissions) {
    if (p.employeeId !== employeeId) continue;
    if (p.status !== "approved") continue;
    const start = startOfDay(p.startDate);
    const end = startOfDay(p.endDate);
    const cur = new Date(start);
    while (cur.getTime() <= end.getTime()) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6 && inRange(cur, range)) {
        permissionMinutes += POLICY.permissionDailyCapMinutes;
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  const latePenalty = lateMinutes * POLICY.latePenaltyPerMinute;
  const earlyLeavePenalty = earlyLeaveMinutes * POLICY.earlyLeavePenaltyPerMinute;

  // Effective productive contribution caps at expected per day.
  const numerator = productiveMinutes + permissionMinutes - latePenalty - earlyLeavePenalty;
  const raw = (numerator / expectedMinutes) * 100;
  const efficiency = Math.max(0, Math.min(100, Math.round(raw * 10) / 10));

  const reasons: string[] = [];
  if (productiveMinutes > 0)
    reasons.push(`+${Math.round(productiveMinutes / 60)}h foydali kompyuter vaqti`);
  if (permissionMinutes > 0)
    reasons.push(`+${Math.round(permissionMinutes / 60)}h ruxsatli vaqt`);
  if (lateMinutes > 0) reasons.push(`−${lateMinutes} daqiqa kechikish jarimasi`);
  if (earlyLeaveMinutes > 0)
    reasons.push(`−${earlyLeaveMinutes} daqiqa erta ketish jarimasi`);
  if (unproductiveMinutes > 0)
    reasons.push(`Diqqat: ${Math.round(unproductiveMinutes / 60)}h foydasiz ilovalar`);
  if (reasons.length === 0) reasons.push("Hisoblash uchun ma'lumot yo'q.");

  return {
    employeeId,
    computerId: computer?.id ?? null,
    expectedMinutes,
    workedMinutes,
    computerActiveMinutes,
    productiveMinutes,
    unproductiveMinutes,
    permissionMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    latePenalty,
    earlyLeavePenalty,
    efficiency,
    reasons,
  };
}

export function computeAllEfficiencies(range: Range = defaultRange()): (EfficiencyBreakdown & {
  employee: Employee;
})[] {
  return employees
    .filter((e) => e.status === "active")
    .map((e) => ({ ...computeEfficiency(e.id, range), employee: e }));
}

export function dailyEfficiencySeries(employeeId: string, range: Range = defaultRange()) {
  const out: { day: string; efficiency: number }[] = [];
  const cur = startOfDay(range.from);
  const end = startOfDay(range.to);
  while (cur.getTime() <= end.getTime()) {
    const day = new Date(cur);
    const d = day.getDay();
    if (d !== 0 && d !== 6) {
      const next = new Date(day);
      const r = { from: day, to: next };
      const eff = computeEfficiency(employeeId, r).efficiency;
      out.push({
        day: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        efficiency: eff,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function appBreakdownFor(employeeId: string, range: Range = defaultRange()) {
  const computer = computers.find((c) => c.assignedTo === employeeId);
  if (!computer) return [];
  const map = new Map<string, { app: string; minutes: number; productive: boolean }>();
  for (const a of computerActivity) {
    if (a.computerId !== computer.id) continue;
    if (!inRange(a.startedAt, range)) continue;
    const key = a.app;
    const prev = map.get(key);
    const productive = isProductive(a.category);
    if (prev) prev.minutes += a.durationMinutes;
    else map.set(key, { app: a.app, minutes: a.durationMinutes, productive });
  }
  return Array.from(map.values()).sort((a, b) => b.minutes - a.minutes);
}
