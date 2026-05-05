export const dashboardQueryKeys = {
  employees: (dateFrom: string) => ['dashboard', 'employees', dateFrom] as const,
  dailyAttendance: (dateFrom: string, dateTo: string) =>
    ['dashboard', 'daily-attendance', dateFrom, dateTo] as const,
  computerAnalytics: (dateFrom: string, dateTo: string) =>
    ['dashboard', 'computer-analytics', dateFrom, dateTo] as const,
  employeeTimeline: (employeeId: string | null, date: string) =>
    ['dashboard', 'employee-timeline', employeeId, date] as const
};
