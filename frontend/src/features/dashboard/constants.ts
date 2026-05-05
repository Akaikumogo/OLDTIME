export const DASHBOARD_LIMITS = {
  employees: 100,
  dailyAttendance: 200
} as const;

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  on_time: 'Vaqtida',
  late: 'Kechikdi',
  entry: 'Kirish',
  exit: 'Chiqish',
  lunch_out: 'Tushlikka chiqdi',
  lunch_return: 'Tushlikdan qaytdi',
  early_exit: 'Erta ketdi',
  on_time_exit: 'Vaqtida ketdi',
  unmatched_employee: 'Topilmadi',
  ambiguous_employee: 'Noaniq'
};

export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  on_time: 'green',
  late: 'red',
  entry: 'blue',
  exit: 'default',
  lunch_out: 'gold',
  lunch_return: 'cyan',
  early_exit: 'volcano',
  on_time_exit: 'green',
  unmatched_employee: 'magenta',
  ambiguous_employee: 'purple'
};

export const DASHBOARD_CHART_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#7c3aed'
] as const;
