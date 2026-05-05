import { uid } from "./_rng";
import { departments } from "./departments";

export type Position = {
  id: string;
  title: string;
  departmentId: string;
  level: "Junior" | "Mid" | "Senior" | "Lead" | "Manager";
  openings: number;
};

const byDept: Record<string, { title: string; level: Position["level"] }[]> = {
  ENG: [
    { title: "Senior Backend Engineer", level: "Senior" },
    { title: "Frontend Engineer", level: "Mid" },
    { title: "Engineering Manager", level: "Manager" },
    { title: "DevOps Engineer", level: "Senior" },
    { title: "Junior Developer", level: "Junior" },
  ],
  PRD: [
    { title: "Product Manager", level: "Senior" },
    { title: "Associate PM", level: "Junior" },
  ],
  DSG: [
    { title: "Lead Product Designer", level: "Lead" },
    { title: "UX Researcher", level: "Mid" },
  ],
  POP: [
    { title: "Recruiter", level: "Mid" },
    { title: "HR Business Partner", level: "Senior" },
  ],
  FIN: [
    { title: "Accountant", level: "Mid" },
    { title: "Finance Lead", level: "Lead" },
  ],
  SEC: [{ title: "Security Engineer", level: "Senior" }],
  CS: [
    { title: "Customer Success Manager", level: "Senior" },
    { title: "Support Specialist", level: "Junior" },
  ],
  IT: [{ title: "IT Administrator", level: "Mid" }],
};

let i = 0;
export const positions: Position[] = departments.flatMap((d) =>
  (byDept[d.code] ?? []).map((p) => ({
    id: uid("pos", ++i),
    title: p.title,
    departmentId: d.id,
    level: p.level,
    openings: (i * 3) % 4,
  })),
);
