import { Alert, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import apiService, { type EmployeeLiveLocation } from '@/services/api';
import { CameraView } from './CameraView';

type EmployeeCameraGridProps = {
  employeeId: string;
  liveLocation?: EmployeeLiveLocation | null;
};

export function EmployeeCameraGrid({
  employeeId,
  liveLocation
}: EmployeeCameraGridProps) {
  const query = useQuery({
    queryKey: ['employee-camera-views', employeeId],
    queryFn: () => apiService.getEmployeeCameraViews(employeeId),
    enabled: Boolean(employeeId),
    refetchInterval: 5_000
  });

  if (query.isLoading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center">
        <Spin />
      </div>
    );
  }

  if (query.error) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Camera view yuklanmadi"
        description={
          query.error instanceof Error ? query.error.message : 'API xato'
        }
      />
    );
  }

  const views = query.data;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <CameraView
        title="Active camera"
        camera={views?.active_camera ?? null}
        location={liveLocation}
      />
      <CameraView
        title="Assigned room camera"
        camera={views?.assigned_room_camera ?? null}
        location={liveLocation}
      />
    </div>
  );
}
