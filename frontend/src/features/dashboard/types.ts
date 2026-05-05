import type {
  AttendanceDailyRow,
  ComputerAnalytics,
  ComputerUsageStat,
  Employee,
  EmployeeTimeline
} from '@/services/api';

export type DashboardEmployee = Employee;
export type DashboardDailyRow = AttendanceDailyRow;
export type DashboardComputerAnalytics = ComputerAnalytics;
export type DashboardTopApp = ComputerUsageStat;
export type DashboardEmployeeTimeline = EmployeeTimeline;

export type DashboardStats = {
  activeEmployees: number;
  arrivedEmployees: number;
  lateEmployees: number;
  leftEmployees: number;
  totalComputerSeconds: number;
  onlineComputers: number;
};

export type DashboardChartDatum = {
  name: string;
  value: number;
};

export type DashboardData = {
  date: string;
  employees: DashboardEmployee[];
  dailyRows: DashboardDailyRow[];
  computerAnalytics: DashboardComputerAnalytics | null;
  stats: DashboardStats;
  attendanceChart: DashboardChartDatum[];
  topApps: DashboardTopApp[];
};
