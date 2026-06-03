import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Alert, Drawer, Empty, Spin, Tag } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, MapPin, Radio } from 'lucide-react';
import apiService from '@/services/api';
import { formatDateTime, getTodayISO } from '@/utils/date';
import { EmployeeCameraGrid } from './EmployeeCameraGrid';
import { ProductivityBreakdown } from './ProductivityBreakdown';
import { ZoneTimeline } from './ZoneTimeline';
import { DailyZoneTimeline } from './DailyZoneTimeline';

type EmployeeLiveLocationPanelProps = {
  employeeId: string | null;
  open: boolean;
  onClose: () => void;
};

export function EmployeeLiveLocationPanel({
  employeeId,
  open,
  onClose
}: EmployeeLiveLocationPanelProps) {
  const queryClient = useQueryClient();
  const today = getTodayISO();

  const liveQuery = useQuery({
    queryKey: ['employee-live-location', employeeId],
    queryFn: () => apiService.getEmployeeLiveLocation(employeeId || ''),
    enabled: open && Boolean(employeeId),
    refetchInterval: 5_000
  });

  const timelineQuery = useQuery({
    queryKey: ['employee-location-timeline', employeeId],
    queryFn: () => apiService.getEmployeeLocationTimeline(employeeId || '', 80),
    enabled: open && Boolean(employeeId),
    refetchInterval: 15_000
  });

  const productivityQuery = useQuery({
    queryKey: ['employee-camera-productivity', employeeId, today],
    queryFn: () =>
      apiService.getEmployeeCameraProductivity({
        employee_id: employeeId || '',
        date_from: today,
        date_to: today
      }),
    enabled: open && Boolean(employeeId),
    refetchInterval: 30_000
  });

  const dailyTimelineQuery = useQuery({
    queryKey: ['employee-daily-timeline', employeeId, today],
    queryFn: () => apiService.getEmployeeDailyTimeline(employeeId || '', today),
    enabled: open && Boolean(employeeId),
    refetchInterval: 30_000
  });

  useEffect(() => {
    if (!open || !employeeId) return undefined;
    const socket = new WebSocket(apiService.getEmployeeLocationWebSocketUrl());
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { employee_id?: string };
        if (payload.employee_id !== employeeId) return;
        void queryClient.invalidateQueries({
          queryKey: ['employee-live-location', employeeId]
        });
        void queryClient.invalidateQueries({
          queryKey: ['employee-camera-views', employeeId]
        });
        void queryClient.invalidateQueries({
          queryKey: ['employee-location-timeline', employeeId]
        });
        void queryClient.invalidateQueries({
          queryKey: ['employee-daily-timeline', employeeId]
        });
      } catch {
        /* ignore invalid websocket payloads */
      }
    };
    return () => socket.close();
  }, [employeeId, open, queryClient]);

  const live = liveQuery.data ?? null;
  const title = live?.employee.full_name || 'Xodim live camera';

  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      width={980}
      destroyOnHidden
    >
      {!employeeId ? (
        <Empty description="Xodim tanlanmagan" />
      ) : liveQuery.isLoading ? (
        <div className="flex min-h-[360px] items-center justify-center">
          <Spin />
        </div>
      ) : liveQuery.error ? (
        <Alert
          type="warning"
          showIcon
          message="Live location yuklanmadi"
          description={
            liveQuery.error instanceof Error ? liveQuery.error.message : 'API xato'
          }
        />
      ) : live ? (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <StateCard
              icon={<Radio size={18} />}
              label="Active camera"
              value={live.active_camera?.name || '-'}
            />
            <StateCard
              icon={<MapPin size={18} />}
              label="Zone"
              value={live.active_zone?.name || '-'}
            />
            <StateCard
              icon={<Activity size={18} />}
              label="Status"
              value={live.inferred ? 'Inferred' : live.is_visible ? 'Visible' : 'Not visible'}
            />
            <StateCard
              icon={<MapPin size={18} />}
              label="Last seen"
              value={live.last_seen_at ? formatDateTime(live.last_seen_at) : '-'}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {live.assigned_room ? <Tag color="blue">{live.assigned_room.name}</Tag> : null}
            {live.assigned_cameras.map((camera) => (
              <Tag key={camera.id} color={camera.is_primary ? 'green' : 'default'}>
                {camera.name}
              </Tag>
            ))}
          </div>

          <EmployeeCameraGrid employeeId={employeeId} liveLocation={live} />

          <ProductivityBreakdown data={productivityQuery.data ?? null} />

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-1 text-base font-semibold text-slate-950 dark:text-white">
              Bugun qayerda bo'ldi
            </h3>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Soat nechchida qaysi zonada bo'lgani (kamera detektsiyalari asosida)
            </p>
            <DailyZoneTimeline
              data={dailyTimelineQuery.data ?? null}
              loading={dailyTimelineQuery.isLoading}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="mb-4 text-base font-semibold text-slate-950 dark:text-white">
              Movement timeline
            </h3>
            <ZoneTimeline items={timelineQuery.data ?? []} />
          </div>
        </div>
      ) : (
        <Empty description="Live location topilmadi" />
      )}
    </Drawer>
  );
}

function StateCard({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="text-xs uppercase">{label}</span>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-slate-950 dark:text-white">
        {value}
      </p>
    </div>
  );
}
