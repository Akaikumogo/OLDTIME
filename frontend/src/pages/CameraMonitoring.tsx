import { useMemo, useState } from 'react';
import { Button, Empty, Select, Spin } from 'antd';
import { LayoutGrid, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiService, { type Camera, type Zone } from '@/services/api';
import { CameraGridItem } from '@/components/camera/CameraGridItem';
import { UnknownDetectionsPanel } from '@/components/camera/UnknownDetectionsPanel';

const COLS_OPTIONS = [
  { value: 2, label: '2 ustun' },
  { value: 3, label: '3 ustun' },
  { value: 4, label: '4 ustun' },
  { value: 6, label: '6 ustun' },
];

const GRID_CLASS: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
};

type StreamProfile = 'main' | 'sub';

const STREAM_PROFILE_OPTIONS: { value: StreamProfile; label: string }[] = [
  { value: 'main', label: 'Sifatli' },
  { value: 'sub', label: 'Tezkor' },
];

export default function CameraMonitoring() {
  const [cols, setCols] = useState(3);
  const [streamProfile, setStreamProfile] = useState<StreamProfile>('main');
  const [zoneId, setZoneId] = useState<string | undefined>();
  const [roomId, setRoomId] = useState<string | undefined>();

  const camerasQuery = useQuery({
    queryKey: ['camera-monitoring-list', zoneId, roomId],
    queryFn: () =>
      apiService.listCameras({ limit: 200, zone_id: zoneId, room_id: roomId }),
    refetchInterval: 30_000,
  });

  const liveUnknownQuery = useQuery({
    queryKey: ['live-unknown-detections'],
    queryFn: () => apiService.getLiveUnknownDetections(),
    refetchInterval: 5_000,
  });

  const unknownByCamera = useMemo(() => {
    const map = new Map<string, NonNullable<typeof liveUnknownQuery.data>[number]>();
    for (const item of liveUnknownQuery.data ?? []) {
      map.set(item.camera_id, item);
    }
    return map;
  }, [liveUnknownQuery.data]);

  const zonesQuery = useQuery({
    queryKey: ['zones-for-camera-monitoring'],
    queryFn: () => apiService.listZones(),
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms-for-camera-monitoring'],
    queryFn: () => apiService.listRooms(),
  });

  const cameras: Camera[] = camerasQuery.data?.data ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950">
        <LayoutGrid size={18} className="text-blue-600" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Kamera monitoringi
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select
            placeholder="Zona"
            allowClear
            style={{ width: 160 }}
            value={zoneId}
            onChange={(v) => { setZoneId(v); setRoomId(undefined); }}
            loading={zonesQuery.isFetching}
            options={(zonesQuery.data ?? []).map((z: Zone) => ({
              value: z.id,
              label: z.name,
            }))}
          />
          <Select
            placeholder="Xona"
            allowClear
            style={{ width: 160 }}
            value={roomId}
            onChange={setRoomId}
            loading={roomsQuery.isFetching}
            options={(roomsQuery.data ?? []).map((r) => ({
              value: r.id,
              label: r.name,
            }))}
          />
          <Select
            style={{ width: 120 }}
            value={cols}
            onChange={setCols}
            options={COLS_OPTIONS}
          />
          <Select
            style={{ width: 120 }}
            value={streamProfile}
            onChange={setStreamProfile}
            options={STREAM_PROFILE_OPTIONS}
          />
          <Button
            icon={<RefreshCw size={15} />}
            loading={camerasQuery.isFetching}
            onClick={() => void camerasQuery.refetch()}
          >
            Yangilash
          </Button>
          <UnknownDetectionsPanel cameras={cameras} />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {camerasQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spin size="large" />
          </div>
        ) : cameras.length === 0 ? (
          <Empty description="Kameralar topilmadi" className="mt-20" />
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-400">
              {cameras.length} ta kamera
            </p>
            <div className={`grid gap-3 ${GRID_CLASS[cols] ?? GRID_CLASS[3]}`}>
              {cameras.map((camera) => (
                <CameraGridItem
                  key={camera.id}
                  camera={camera}
                  profile={streamProfile}
                  unknownDetection={unknownByCamera.get(camera.id) ?? null}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
