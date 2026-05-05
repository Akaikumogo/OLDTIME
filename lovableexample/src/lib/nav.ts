import {
  LayoutDashboard,
  ShieldCheck,
  Building2,
  Briefcase,
  Users,
  DoorOpen,
  ScanLine,
  CalendarClock,
  FileBadge,
  FileBarChart,
  Monitor,
  Activity,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  to: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { title: "Dashboard", to: "/", icon: LayoutDashboard },
  { title: "Admins", to: "/admins", icon: ShieldCheck },
  { title: "Departments", to: "/departments", icon: Building2 },
  { title: "Positions", to: "/positions", icon: Briefcase },
  { title: "Employees", to: "/employees", icon: Users },
  { title: "Doors", to: "/doors", icon: DoorOpen },
  { title: "Attendance Events", to: "/attendance-events", icon: ScanLine },
  { title: "Daily Attendance", to: "/daily-attendance", icon: CalendarClock },
  { title: "Work Permissions", to: "/work-permissions", icon: FileBadge },
  { title: "Reports", to: "/reports", icon: FileBarChart },
  { title: "Computers", to: "/computers", icon: Monitor },
  { title: "Computer Activity", to: "/computer-activity", icon: Activity },
  { title: "Analytics", to: "/analytics", icon: BarChart3 },
];

export function findNavItem(pathname: string): NavItem | undefined {
  if (pathname === "/") return navItems[0];
  return navItems.find((i) => i.to !== "/" && pathname.startsWith(i.to));
}
