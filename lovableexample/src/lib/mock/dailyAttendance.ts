import { attendanceEvents } from "./attendanceEvents";
import { employees } from "./employees";

export type DailyAttendance = {
  id: string;
  employeeId: string;
  date: Date; // start of day
  firstIn: Date | null;
  lastOut: Date | null;
  workedMinutes: number;
  lateMinutes: number;
  status: "present" | "late" | "absent";
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const map = new Map<string, DailyAttendance>();
for (const ev of attendanceEvents) {
  const day = startOfDay(ev.at);
  const key = `${ev.employeeId}_${day.getTime()}`;
  let rec = map.get(key);
  if (!rec) {
    rec = {
      id: key,
      employeeId: ev.employeeId,
      date: day,
      firstIn: null,
      lastOut: null,
      workedMinutes: 0,
      lateMinutes: 0,
      status: "present",
    };
    map.set(key, rec);
  }
  if (ev.direction === "in") {
    if (!rec.firstIn || ev.at < rec.firstIn) rec.firstIn = ev.at;
    if (ev.status === "late") {
      const expected = new Date(ev.at);
      expected.setHours(9, 0, 0, 0);
      rec.lateMinutes = Math.max(rec.lateMinutes, Math.round((ev.at.getTime() - expected.getTime()) / 60000));
      rec.status = "late";
    }
  } else {
    if (!rec.lastOut || ev.at > rec.lastOut) rec.lastOut = ev.at;
  }
}
for (const rec of map.values()) {
  if (rec.firstIn && rec.lastOut) {
    rec.workedMinutes = Math.max(0, Math.round((rec.lastOut.getTime() - rec.firstIn.getTime()) / 60000));
  }
}

// add absent rows for active employees with no event today (selected set)
const today = startOfDay(new Date());
for (const emp of employees) {
  if (emp.status !== "active") continue;
  const key = `${emp.id}_${today.getTime()}`;
  if (!map.has(key)) {
    map.set(key, {
      id: key,
      employeeId: emp.id,
      date: today,
      firstIn: null,
      lastOut: null,
      workedMinutes: 0,
      lateMinutes: 0,
      status: "absent",
    });
  }
}

export const dailyAttendance: DailyAttendance[] = Array.from(map.values()).sort(
  (a, b) => b.date.getTime() - a.date.getTime() || a.employeeId.localeCompare(b.employeeId),
);
