import { uid, pick, int, chance, resetSeed } from "./_rng";
import { departments } from "./departments";
import { positions } from "./positions";

export type EmployeeStatus = "active" | "on_leave" | "inactive";

export type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  positionId: string;
  status: EmployeeStatus;
  hiredAt: Date;
  lastSeen: Date;
  initials: string;
};

const FIRST = [
  "Sarah", "Marcus", "Lena", "Diana", "Omar", "Ivan", "Priya", "Kenji",
  "Aisha", "Liam", "Emma", "Noah", "Olivia", "Wei", "Chen", "Rohan",
  "Yuki", "Sofia", "Daniel", "Hana", "Mateo", "Zara", "Ethan", "Maya",
  "Jonas", "Camila", "Hugo", "Amelia", "Leo", "Isla", "Arjun", "Nadia",
  "Tomas", "Freya", "Felix", "Anya", "Idris", "Mei", "Pavel", "Lara",
  "Sami", "Nora", "Vikram", "Eva", "Ravi", "Ines", "Elias", "Talia",
];
const LAST = [
  "Chen", "Hill", "Park", "Reyes", "Yusuf", "Petrov", "Natarajan", "Watanabe",
  "Khan", "O'Connor", "Müller", "Rossi", "Garcia", "Singh", "Tanaka", "Andersen",
  "Brown", "Davis", "Volkov", "Sato", "Costa", "Romano", "Lopez", "Kim",
  "Nguyen", "Ahmadi", "Schneider", "Vega", "Ibrahim", "Larsen", "Bauer", "Cohen",
  "Patel", "Dubois", "Almeida", "Hoffmann", "Jensen", "Karimov", "Holm", "Ferrari",
  "Kowalski", "Mendes", "Walsh", "Nakamura", "Bauer", "Sanchez", "Petit", "Iqbal",
];

resetSeed(42);

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

const seenNames = new Set<string>();
export const employees: Employee[] = Array.from({ length: 48 }, (_, i) => {
  let firstName = FIRST[i % FIRST.length]!;
  let lastName = LAST[(i * 7) % LAST.length]!;
  let key = `${firstName} ${lastName}`;
  let attempt = 0;
  while (seenNames.has(key) && attempt < 10) {
    lastName = LAST[(i * 7 + attempt + 1) % LAST.length]!;
    key = `${firstName} ${lastName}`;
    attempt++;
  }
  seenNames.add(key);

  const dept = pick(departments);
  const deptPositions = positions.filter((p) => p.departmentId === dept.id);
  const position = deptPositions.length ? pick(deptPositions) : pick(positions);

  const status: EmployeeStatus = chance(0.85) ? "active" : chance(0.5) ? "on_leave" : "inactive";

  const hiredAt = new Date(2021, int(0, 11), int(1, 28));
  const lastSeen = new Date(Date.now() - int(0, 72) * 60 * 60 * 1000);

  return {
    id: uid("emp", i + 1),
    firstName,
    lastName,
    fullName: key,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z]/g, "")}@workplus.io`,
    phone: `+1 (555) ${String(int(100, 999))}-${String(int(1000, 9999))}`,
    departmentId: dept.id,
    positionId: position.id,
    status,
    hiredAt,
    lastSeen,
    initials: `${firstName[0]}${lastName[0]}`.toUpperCase(),
  };
});

export function employeeById(id: string) {
  return employees.find((e) => e.id === id);
}
