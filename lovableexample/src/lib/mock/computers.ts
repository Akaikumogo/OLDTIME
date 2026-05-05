import { uid, pick, chance, int, resetSeed } from "./_rng";
import { employees } from "./employees";
import { departments } from "./departments";

export type Computer = {
  id: string;
  hostname: string;
  assignedTo: string | null; // employee id
  ip: string;
  os: "Windows 11" | "macOS 14" | "Ubuntu 22.04";
  online: boolean;
  lastHeartbeat: Date;
};

resetSeed(11);

export const computers: Computer[] = employees.slice(0, 40).map((e, i) => {
  const dept = departments.find((d) => d.id === e.departmentId)!;
  const code = dept.code.toLowerCase();
  return {
    id: uid("cmp", i + 1),
    hostname: `wp-${code}-${String(i + 1).padStart(3, "0")}`,
    assignedTo: e.id,
    ip: `10.20.${int(0, 5)}.${int(2, 250)}`,
    os: pick(["Windows 11", "macOS 14", "Ubuntu 22.04"] as const),
    online: chance(0.78),
    lastHeartbeat: new Date(Date.now() - int(0, 60 * 24) * 60000),
  };
});
