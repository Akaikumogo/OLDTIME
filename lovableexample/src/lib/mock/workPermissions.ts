import { uid, pick, int, chance, resetSeed } from "./_rng";
import { employees } from "./employees";

export type PermissionType = "leave" | "remote" | "overtime" | "business_trip";
export type PermissionStatus = "pending" | "approved" | "rejected";

export type WorkPermission = {
  id: string;
  employeeId: string;
  type: PermissionType;
  reason: string;
  startDate: Date;
  endDate: Date;
  status: PermissionStatus;
  approver: string;
  submittedAt: Date;
};

const REASONS: Record<PermissionType, string[]> = {
  leave: ["Family event", "Annual vacation", "Medical appointment", "Personal day", "Wedding"],
  remote: ["Working from home", "Repair at home", "Out-of-town family", "Childcare"],
  overtime: ["Release deadline", "Incident response", "Client demo prep", "Quarter close"],
  business_trip: ["Client meeting in NYC", "Conference in Berlin", "Vendor visit", "Team offsite"],
};

resetSeed(99);

const APPROVERS = ["Alex Karimov", "Sarah Chen", "Marcus Hill", "Diana Reyes"];

export const workPermissions: WorkPermission[] = Array.from({ length: 36 }, (_, i) => {
  const emp = pick(employees);
  const type = pick(["leave", "remote", "overtime", "business_trip"] as PermissionType[]);
  const status: PermissionStatus = chance(0.55) ? "approved" : chance(0.6) ? "pending" : "rejected";
  const start = new Date();
  start.setDate(start.getDate() + int(-20, 14));
  const end = new Date(start);
  end.setDate(end.getDate() + int(0, type === "leave" ? 7 : 2));
  return {
    id: uid("prm", i + 1),
    employeeId: emp.id,
    type,
    reason: pick(REASONS[type]),
    startDate: start,
    endDate: end,
    status,
    approver: pick(APPROVERS),
    submittedAt: new Date(start.getTime() - int(1, 10) * 86400000),
  };
}).sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
