import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { dashboardQueryKeys } from '@/features/dashboard/queryKeys';

export function useEmployeeTimeline(employeeId: string | null, date: string) {
  return useQuery({
    queryKey: dashboardQueryKeys.employeeTimeline(employeeId, date),
    queryFn: () => {
      if (!employeeId) throw new Error('Employee id is required');
      return apiService.getEmployeeTimeline({ employee_id: employeeId, date });
    },
    enabled: Boolean(employeeId)
  });
}
