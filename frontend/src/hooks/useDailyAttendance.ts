import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { DASHBOARD_LIMITS } from '@/features/dashboard/constants';
import { dashboardQueryKeys } from '@/features/dashboard/queryKeys';

export function useDailyAttendance(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.dailyAttendance(dateFrom, dateTo),
    queryFn: () =>
      apiService.listAttendanceDaily({
        page: 1,
        limit: DASHBOARD_LIMITS.dailyAttendance,
        date_from: dateFrom,
        date_to: dateTo,
        sort: 'employee_name',
        order: 'asc'
      })
  });
}
