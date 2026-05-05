import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { dashboardQueryKeys } from '@/features/dashboard/queryKeys';

export function useComputerAnalytics(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.computerAnalytics(dateFrom, dateTo),
    queryFn: () =>
      apiService.getComputerAnalytics({
        date_from: dateFrom,
        date_to: dateTo
      })
  });
}
