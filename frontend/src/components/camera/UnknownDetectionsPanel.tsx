import { useState } from 'react';
import { Button, Drawer, Empty, Select, Spin, Tooltip, message } from 'antd';
import { UserX } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiService, {
  BACKEND_ORIGIN,
  type Camera,
  type Employee,
  type UnknownDetectionItem
} from '@/services/api';
import { formatDateTime } from '@/utils/date';

type Props = {
  cameras: Camera[];
};

function snapshotUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BACKEND_ORIGIN}/${path.replace(/^\//, '')}`;
}

function DetectionCard({
  item,
  employeeOptions,
  isPending,
  onAssign,
}: {
  item: UnknownDetectionItem;
  employeeOptions: { value: string; label: string }[];
  isPending: boolean;
  onAssign: (detectionId: string, employeeId: string) => void;
}) {
  const photo = snapshotUrl(item.snapshot_path);
  const conf = Math.round(item.confidence * 100);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      {/* Photo / placeholder */}
      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-800">
        {photo ? (
          <img src={photo} alt="snapshot" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400">
            <UserX size={36} />
            <span className="text-xs">Rasm yo&apos;q</span>
          </div>
        )}
        {/* Confidence badge */}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${
            conf >= 80 ? 'bg-red-500' : conf >= 60 ? 'bg-orange-400' : 'bg-slate-500'
          }`}
        >
          {conf}%
        </span>
        {/* Live / history badge */}
        {!item.disappeared_at ? (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
        ) : null}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
            {item.camera_name}
          </span>
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800">
            {item.track_id}
          </span>
        </div>
        <div className="text-[11px] text-slate-500">
          {item.zone_name}{item.room_name ? ` · ${item.room_name}` : ''}
        </div>
        <div className="text-[11px] text-slate-400">{formatDateTime(item.seen_at)}</div>

        {/* Assign */}
        <Select
          showSearch
          placeholder="Xodim biriktirish..."
          size="small"
          className="mt-1 w-full"
          optionFilterProp="label"
          options={employeeOptions}
          loading={isPending}
          onSelect={(employeeId: string) => onAssign(item.id, employeeId)}
        />
      </div>
    </div>
  );
}

export function UnknownDetectionsPanel({ cameras }: Props) {
  const [open, setOpen] = useState(false);
  const [cameraId, setCameraId] = useState<string | undefined>();
  const [activeOnly, setActiveOnly] = useState(true);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['unknown-detections', cameraId, activeOnly],
    queryFn: () =>
      apiService.listUnknownDetections({
        camera_id: cameraId,
        active_only: activeOnly,
        page: 1,
        limit: 200
      }),
    enabled: open,
    refetchInterval: open ? 8_000 : false
  });

  const employeesQuery = useQuery({
    queryKey: ['employees-for-unknown-links'],
    queryFn: () =>
      apiService.listEmployees({ page: 1, limit: 500, is_active: true, sort: 'name', order: 'asc' }),
    enabled: open
  });

  const linkMutation = useMutation({
    mutationFn: ({ detectionId, employeeId }: { detectionId: string; employeeId: string }) =>
      apiService.linkUnknownDetectionToEmployee(detectionId, employeeId),
    onSuccess: () => {
      message.success("Noma'lum track xodimga biriktirildi");
      void queryClient.invalidateQueries({ queryKey: ['unknown-detections'] });
      void queryClient.invalidateQueries({ queryKey: ['cameras-live-unknown-detections'] });
      void queryClient.invalidateQueries({ queryKey: ['cameras-live-matched-detections'] });
    }
  });

  const items = query.data?.data ?? [];
  const liveCount = items.filter(i => !i.disappeared_at).length;
  const employeeOptions = (employeesQuery.data?.data ?? []).map((e: Employee) => ({
    value: e.id,
    label: e.full_name
  }));

  return (
    <>
      <Tooltip title="Kameradagi noma'lum odamlar">
        <Button
          icon={<UserX size={15} />}
          onClick={() => setOpen(true)}
          danger={liveCount > 0}
        >
          Begonalar{liveCount > 0 ? ` (${liveCount})` : ''}
        </Button>
      </Tooltip>

      <Drawer
        title={
          <div className="flex items-center gap-2">
            <UserX size={18} className="text-red-500" />
            <span>Noma&apos;lum odamlar</span>
            {liveCount > 0 && (
              <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                {liveCount} live
              </span>
            )}
          </div>
        }
        width={700}
        open={open}
        onClose={() => setOpen(false)}
        styles={{ body: { padding: 16 } }}
      >
        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Select
            placeholder="Barcha kameralar"
            allowClear
            style={{ width: 200 }}
            value={cameraId}
            onChange={(v) => setCameraId(v)}
            options={cameras.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            style={{ width: 170 }}
            value={activeOnly ? 'active' : 'all'}
            onChange={(v) => setActiveOnly(v === 'active')}
            options={[
              { value: 'active', label: 'Hali kamerada' },
              { value: 'all', label: 'Hammasi (tarix)' }
            ]}
          />
        </div>

        {query.isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spin />
          </div>
        ) : items.length === 0 ? (
          <Empty description="Noma'lum odamlar topilmadi" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((item) => (
              <DetectionCard
                key={item.id}
                item={item}
                employeeOptions={employeeOptions}
                isPending={linkMutation.isPending}
                onAssign={(detectionId, employeeId) =>
                  linkMutation.mutate({ detectionId, employeeId })
                }
              />
            ))}
          </div>
        )}
      </Drawer>
    </>
  );
}
