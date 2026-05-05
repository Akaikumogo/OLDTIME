import { uid, pick, int, chance, resetSeed } from "./_rng";
import { employees } from "./employees";
import { doors } from "./doors";

export type AttendanceStatus = "on_time" | "late" | "early_leave" | "overtime";
export type AttendanceEvent = {
  id: string;
  employeeId: string;
  doorId: string;
  direction: "in" | "out";
  at: Date;
  status: AttendanceStatus;
};

resetSeed(7);

export const attendanceEvents: AttendanceEvent[] = [];
let counter = 0;

const now = new Date();
for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - dayOffset);
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

  for (const emp of employees) {
    if (emp.status !== "active") continue;
    if (isWeekend && chance(0.85)) continue;
    if (chance(0.06)) continue; // absent

    const inLate = chance(0.18);
    const inMin = inLate ? int(15, 65) : -int(0, 15);
    const inAt = new Date(day);
    inAt.setHours(9, inMin, int(0, 59), 0);

    const outEarly = chance(0.08);
    const outOver = !outEarly && chance(0.18);
    const outMin = outEarly ? -int(15, 90) : outOver ? int(20, 120) : int(-10, 10);
    const outAt = new Date(day);
    outAt.setHours(18, outMin, int(0, 59), 0);

    const door = pick(doors);
    attendanceEvents.push({
      id: uid("evt", ++counter),
      employeeId: emp.id,
      doorId: door.id,
      direction: "in",
      at: inAt,
      status: inLate ? "late" : "on_time",
    });
    attendanceEvents.push({
      id: uid("evt", ++counter),
      employeeId: emp.id,
      doorId: door.id,
      direction: "out",
      at: outAt,
      status: outEarly ? "early_leave" : outOver ? "overtime" : "on_time",
    });
  }
}

attendanceEvents.sort((a, b) => b.at.getTime() - a.at.getTime());
