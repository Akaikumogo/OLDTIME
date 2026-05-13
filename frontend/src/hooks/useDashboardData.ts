import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { DASHBOARD_LIMITS } from '@/features/dashboard/constants';
import { dashboardQueryKeys } from '@/features/dashboard/queryKeys';
import type { DashboardData } from '@/features/dashboard/types';
import { useComputerAnalytics } from './useComputerAnalytics';
import { useDailyAttendance } from './useDailyAttendance';

export function useDashboardData(dateFrom: string, dateTo: string, employeeName?: string) {
  const employeesQuery = useQuery({
    queryKey: dashboardQueryKeys.employees(dateFrom),
    queryFn: () =>
      apiService.listEmployees({
        page: 1,
        limit: DASHBOARD_LIMITS.employees,
        is_active: true,
        sort: 'name',
        order: 'asc'
      }),
    refetchInterval: 30_000
  });
  const dailyAttendanceQuery = useDailyAttendance(dateFrom, dateTo, employeeName);
  const computerAnalyticsQuery = useComputerAnalytics(dateFrom, dateTo);

  const data = useMemo<DashboardData | null>(() => {
    const employees = employeesQuery.data?.data ?? [];
    const dailyRows = dailyAttendanceQuery.data?.data ?? [];
    const computerAnalytics = computerAnalyticsQuery.data ?? null;
    const arrivedEmployees = dailyRows.filter((row) => row.first_entry).length;
    const lateEmployees = dailyRows.filter((row) =>
      row.statuses.includes('late')
    ).length;
    const leftEmployees = dailyRows.filter((row) => row.last_exit).length;

    return {
      date: dateFrom,
      employees,
      dailyRows,
      computerAnalytics,
      meta: { page: 1, limit: 1, total: employees.length },
      stats: {
        activeEmployees: employeesQuery.data?.meta.total ?? employees.length,
        arrivedEmployees,
        lateEmployees,
        leftEmployees,
        totalComputerSeconds: computerAnalytics?.total_duration_seconds ?? 0,
        onlineComputers: computerAnalytics?.online_computers ?? 0
      },
      attendanceChart: [
        { name: 'Kelgan', value: arrivedEmployees },
        { name: 'Kechikdi', value: lateEmployees },
        { name: 'Ketdi', value: leftEmployees }
      ],
      topApps: computerAnalytics?.top_apps ?? []
    };
  }, [
    employeesQuery.data,
    computerAnalyticsQuery.data,
    dailyAttendanceQuery.data,
    dateFrom,
    dateTo
  ]);

  return {
    data,
    isLoading:
      employeesQuery.isLoading ||
      dailyAttendanceQuery.isLoading ||
      computerAnalyticsQuery.isLoading,
    isFetching:
      employeesQuery.isFetching ||
      dailyAttendanceQuery.isFetching ||
      computerAnalyticsQuery.isFetching,
    error:
      employeesQuery.error ||
      dailyAttendanceQuery.error ||
      computerAnalyticsQuery.error,
    refetch: () =>
      Promise.all([
        employeesQuery.refetch(),
        dailyAttendanceQuery.refetch(),
        computerAnalyticsQuery.refetch()
      ])
  };
}
