import { uid } from "./_rng";

export type AdminRole = "Owner" | "Admin" | "Manager" | "Viewer";
export type Admin = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: AdminRole;
  status: "active" | "invited" | "suspended";
  lastLogin: Date;
};

const data: Omit<Admin, "id">[] = [
  { name: "Alex Karimov", username: "akarimov", email: "alex@workplus.io", role: "Owner", status: "active", lastLogin: new Date(Date.now() - 1000 * 60 * 12) },
  { name: "Sarah Chen", username: "schen", email: "sarah@workplus.io", role: "Admin", status: "active", lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 2) },
  { name: "Marcus Hill", username: "mhill", email: "marcus@workplus.io", role: "Admin", status: "active", lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 6) },
  { name: "Diana Reyes", username: "dreyes", email: "diana@workplus.io", role: "Manager", status: "active", lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 26) },
  { name: "Kenji Watanabe", username: "kwatanabe", email: "kenji@workplus.io", role: "Manager", status: "active", lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 48) },
  { name: "Priya Natarajan", username: "pnatarajan", email: "priya@workplus.io", role: "Viewer", status: "invited", lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) },
  { name: "Ivan Petrov", username: "ipetrov", email: "ivan@workplus.io", role: "Admin", status: "active", lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 4) },
  { name: "Lena Park", username: "lpark", email: "lena@workplus.io", role: "Viewer", status: "suspended", lastLogin: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
];

export const admins: Admin[] = data.map((a, i) => ({ id: uid("adm", i + 1), ...a }));
