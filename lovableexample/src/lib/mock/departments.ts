import { uid } from "./_rng";

export type Department = {
  id: string;
  name: string;
  code: string;
  headcount: number;
  manager: string;
  createdAt: Date;
};

const DATA: Omit<Department, "id">[] = [
  { name: "Engineering", code: "ENG", headcount: 18, manager: "Sarah Chen", createdAt: new Date("2022-01-12") },
  { name: "Product", code: "PRD", headcount: 6, manager: "Marcus Hill", createdAt: new Date("2022-02-03") },
  { name: "Design", code: "DSG", headcount: 5, manager: "Lena Park", createdAt: new Date("2022-02-18") },
  { name: "People Ops", code: "POP", headcount: 4, manager: "Diana Reyes", createdAt: new Date("2022-03-09") },
  { name: "Finance", code: "FIN", headcount: 4, manager: "Omar Yusuf", createdAt: new Date("2022-03-15") },
  { name: "Security", code: "SEC", headcount: 3, manager: "Ivan Petrov", createdAt: new Date("2022-04-22") },
  { name: "Customer Success", code: "CS", headcount: 5, manager: "Priya Natarajan", createdAt: new Date("2022-05-11") },
  { name: "IT", code: "IT", headcount: 3, manager: "Kenji Watanabe", createdAt: new Date("2022-06-04") },
];

export const departments: Department[] = DATA.map((d, i) => ({ id: uid("dep", i + 1), ...d }));
