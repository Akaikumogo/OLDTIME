import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Empty,
  Modal,
  Segmented,
  Select,
  Spin,
  Tag,
  Tooltip,
  message
} from 'antd';
import {
  Activity,
  Camera,
  LayoutGrid,
  RefreshCw,
  Server,
  SlidersHorizontal,
  UserX,
  Volume2,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiService, {
  BACKEND_ORIGIN,
  type Camera as CameraType,
  type LiveUnknownDetection,
  type Zone
} from '@/services/api';
import { CameraGridItem } from '@/components/camera/CameraGridItem';
import { CameraStatusBadge } from '@/components/camera/CameraStatusBadge';
import { UnknownDetectionsPanel } from '@/components/camera/UnknownDetectionsPanel';
import { formatDateTime } from '@/utils/date';

const COLS_OPTIONS = [
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 6, label: '6' }
];

const GRID_CLASS: Record<number, string> = {
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  6: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6'
};

type StreamProfile = 'main' | 'sub';

const STREAM_PROFILE_OPTIONS: { value: StreamProfile; label: string }[] = [
  { value: 'main', label: 'Main' },
  { value: 'sub', label: 'Sub' }
];

function tokenizedMediaUrl(path?: string | null) {
  if (!path) return null;
  const token =
    localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  const base = path.startsWith('http') ? path : `${BACKEND_ORIGIN}${path}`;
  const url = new URL(base);
  if (token) {
    url.searchParams.set('token', token);
  }
  return url.toString();
}

function cameraLocation(camera: CameraType) {
  return [camera.zone_name, camera.room_name].filter(Boolean).join(' / ') || '-';
}

export default function CameraMonitoring() {
  const [cols, setCols] = useState(3);
  const [streamProfile, setStreamProfile] = useState<StreamProfile>('main');
  const [zoneId, setZoneId] = useState<string | undefined>();
  const [roomId, setRoomId] = useState<string | undefined>();
  const [selectedCameraId, setSelectedCameraId] = useState<string | undefined>();
  const [activeAudioCameraId, setActiveAudioCameraId] = useState<string | undefined>();

  const camerasQuery = useQuery({
    queryKey: ['camera-monitoring-list', zoneId, roomId],
    queryFn: () =>
      apiService.listCameras({ limit: 200, zone_id: zoneId, room_id: roomId }),
    refetchInterval: 30_000
  });

  const liveUnknownQuery = useQuery({
    queryKey: ['live-unknown-detections'],
    queryFn: () => apiService.getLiveUnknownDetections(),
    refetchInterval: 5_000
  });

  const mediaGatewayQuery = useQuery({
    queryKey: ['camera-media-gateway-status'],
    queryFn: () => apiService.getCameraMediaGatewayStatus(),
    refetchInterval: 15_000
  });

  const zonesQuery = useQuery({
    queryKey: ['zones-for-camera-monitoring'],
    queryFn: () => apiService.listZones()
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms-for-camera-monitoring'],
    queryFn: () => apiService.listRooms()
  });

  const cameras: CameraType[] = camerasQuery.data?.data ?? [];
  const cameraById = useMemo(() => {
    return new Map(cameras.map((cameraItem) => [cameraItem.id, cameraItem]));
  }, [cameras]);

  const unknownByCamera = useMemo(() => {
    const map = new Map<string, LiveUnknownDetection>();
    for (const item of liveUnknownQuery.data ?? []) {
      map.set(item.camera_id, item);
    }
    return map;
  }, [liveUnknownQuery.data]);

  const cameraStats = useMemo(() => {
    return cameras.reduce(
      (acc, cameraItem) => {
        acc.total += 1;
        if (cameraItem.status === 'online') acc.online += 1;
        if (cameraItem.status === 'offline' || cameraItem.status === 'error') {
          acc.offline += 1;
        }
        if (cameraItem.has_audio) acc.audio += 1;
        return acc;
      },
      { total: 0, online: 0, offline: 0, audio: 0 }
    );
  }, [cameras]);

  const gatewayStatus = mediaGatewayQuery.data?.status ?? 'offline';
  const liveUnknowns = liveUnknownQuery.data ?? [];
  const selectedCamera = selectedCameraId ? cameraById.get(selectedCameraId) : null;
  const activeAudioCamera = activeAudioCameraId
    ? cameraById.get(activeAudioCameraId)
    : null;
  const activeAudioSrc = useMemo(
    () => tokenizedMediaUrl(activeAudioCamera?.audio_url),
    [activeAudioCamera?.audio_url]
  );

  const toggleAudio = (cameraItem: CameraType) => {
    if (!cameraItem.has_audio) return;
    setActiveAudioCameraId((current) =>
      current === cameraItem.id ? undefined : cameraItem.id
    );
  };

  const refreshAll = () => {
    void camerasQuery.refetch();
    void liveUnknownQuery.refetch();
    void mediaGatewayQuery.refetch();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50/70 dark:bg-slate-950">
      {activeAudioCamera && activeAudioSrc ? (
        <audio
          key={`camera-audio-${activeAudioCamera.id}-${activeAudioSrc}`}
          src={activeAudioSrc}
          autoPlay
          onError={() => {
            message.error('Kamera audiosi ochilmadi');
            setActiveAudioCameraId(undefined);
          }}
        />
      ) : null}

      <header className="border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Camera size={18} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                  Kamera monitoringi
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live camera wall, audio listen va unknown detection nazorati
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tooltip
              title={
                mediaGatewayQuery.data?.gateway_url ||
                mediaGatewayQuery.data?.message ||
                'Media gateway'
              }
            >
              <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                <Server size={14} />
                <Badge
                  status={gatewayStatus === 'online' ? 'success' : 'error'}
                  text={gatewayStatus === 'online' ? 'Gateway online' : 'Gateway offline'}
                />
              </div>
            </Tooltip>
            <Button
              icon={<RefreshCw size={15} />}
              loading={
                camerasQuery.isFetching ||
                liveUnknownQuery.isFetching ||
                mediaGatewayQuery.isFetching
              }
              onClick={refreshAll}
            >
              Yangilash
            </Button>
            <UnknownDetectionsPanel cameras={cameras} />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricTile icon={LayoutGrid} label="Jami kamera" value={cameraStats.total} />
          <MetricTile
            icon={Wifi}
            label="Online"
            value={cameraStats.online}
            tone="text-emerald-600"
          />
          <MetricTile
            icon={WifiOff}
            label="Offline"
            value={cameraStats.offline}
            tone="text-red-600"
          />
          <MetricTile
            icon={Volume2}
            label="Audio bor"
            value={cameraStats.audio}
            tone="text-blue-600"
          />
          <MetricTile
            icon={UserX}
            label="Live unknown"
            value={liveUnknowns.length}
            tone={liveUnknowns.length ? 'text-red-600' : 'text-slate-700'}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <SlidersHorizontal size={14} />
            Filtrlar
          </div>
          <Select
            placeholder="Zona"
            allowClear
            style={{ width: 180 }}
            value={zoneId}
            onChange={(value) => {
              setZoneId(value);
              setRoomId(undefined);
            }}
            loading={zonesQuery.isFetching}
            options={(zonesQuery.data ?? []).map((zone: Zone) => ({
              value: zone.id,
              label: zone.name
            }))}
          />
          <Select
            placeholder="Xona"
            allowClear
            style={{ width: 180 }}
            value={roomId}
            onChange={setRoomId}
            loading={roomsQuery.isFetching}
            options={(roomsQuery.data ?? []).map((room) => ({
              value: room.id,
              label: room.name
            }))}
          />
          <Segmented
            value={streamProfile}
            onChange={(value) => setStreamProfile(value as StreamProfile)}
            options={STREAM_PROFILE_OPTIONS}
          />
          <Segmented
            value={cols}
            onChange={(value) => setCols(Number(value))}
            options={COLS_OPTIONS}
          />
          {activeAudioCamera ? (
            <Tag color="green" className="m-0 flex h-8 items-center">
              AUDIO: {activeAudioCamera.name}
            </Tag>
          ) : (
            <Tag className="m-0 flex h-8 items-center">AUDIO: OFF</Tag>
          )}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-h-0 overflow-y-auto p-4">
          {gatewayStatus !== 'online' ? (
            <Alert
              className="mb-4"
              type="warning"
              showIcon
              message="Media gateway offline"
              description="Video va audio stream ishlashi uchun go2rtc gateway online bo'lishi kerak."
            />
          ) : null}

          {camerasQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Spin size="large" />
            </div>
          ) : cameras.length === 0 ? (
            <Empty description="Kameralar topilmadi" className="mt-20" />
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>
                  {cameras.length} ta kamera -{' '}
                  {streamProfile === 'main' ? 'main stream' : 'sub stream'}
                </span>
                <span>
                  Polling: {liveUnknownQuery.isFetching ? 'sync' : 'ready'}
                </span>
              </div>
              <div className={`grid gap-3 ${GRID_CLASS[cols] ?? GRID_CLASS[3]}`}>
                {cameras.map((cameraItem) => (
                  <CameraGridItem
                    key={cameraItem.id}
                    camera={cameraItem}
                    profile={streamProfile}
                    unknownDetection={unknownByCamera.get(cameraItem.id) ?? null}
                    audioActive={activeAudioCameraId === cameraItem.id}
                    onAudioToggle={() => toggleAudio(cameraItem)}
                    onOpen={() => setSelectedCameraId(cameraItem.id)}
                  />
                ))}
              </div>
            </>
          )}
        </main>

        <aside className="hidden min-h-0 border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 xl:block">
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
                    Live unknown
                  </h3>
                  <p className="text-xs text-slate-500">Aniqlanmagan odamlar</p>
                </div>
                <Activity size={16} className="text-blue-600" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {liveUnknowns.length === 0 ? (
                <div className="flex h-40 items-center justify-center">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Hozircha unknown yo'q"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {liveUnknowns.map((item) => {
                    const cameraItem = cameraById.get(item.camera_id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left hover:border-red-300 hover:bg-red-50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-red-900 dark:hover:bg-red-950/20"
                        onClick={() => setSelectedCameraId(item.camera_id)}
                      >
                        <div className="flex items-start gap-2">
                          <UserX size={16} className="mt-0.5 shrink-0 text-red-500" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                              {cameraItem?.name ?? item.camera_id}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {cameraItem ? cameraLocation(cameraItem) : item.detection_type}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <Tag color="red" className="m-0">
                                {Math.round(item.confidence * 100)}%
                              </Tag>
                              <Tag className="m-0">{formatDateTime(item.seen_at)}</Tag>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <Modal
        width={1120}
        centered
        open={Boolean(selectedCamera)}
        footer={null}
        onCancel={() => setSelectedCameraId(undefined)}
        title={
          selectedCamera ? (
            <div className="flex items-center gap-3">
              <Camera size={18} className="text-blue-600" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selectedCamera.name}</p>
                <p className="truncate text-xs font-normal text-slate-500">
                  {cameraLocation(selectedCamera)} - {selectedCamera.ip}
                </p>
              </div>
            </div>
          ) : null
        }
        destroyOnClose
      >
        {selectedCamera ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <CameraGridItem
              camera={selectedCamera}
              profile={streamProfile}
              expanded
              unknownDetection={unknownByCamera.get(selectedCamera.id) ?? null}
              audioActive={activeAudioCameraId === selectedCamera.id}
              onAudioToggle={() => toggleAudio(selectedCamera)}
            />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-500">
                  Kamera holati
                </span>
                <CameraStatusBadge status={selectedCamera.status} />
              </div>
              <InfoRow label="IP" value={selectedCamera.ip} />
              <InfoRow label="Zona / xona" value={cameraLocation(selectedCamera)} />
              <InfoRow
                label="Audio"
                value={selectedCamera.has_audio ? 'RTSP audio ready' : 'Audio yoq'}
              />
              <InfoRow
                label="Stream"
                value={streamProfile === 'main' ? 'Main stream' : 'Sub stream'}
              />
              <Button
                className="mt-4 w-full"
                type={activeAudioCameraId === selectedCamera.id ? 'primary' : 'default'}
                icon={<Volume2 size={15} />}
                disabled={!selectedCamera.has_audio}
                onClick={() => toggleAudio(selectedCamera)}
              >
                {activeAudioCameraId === selectedCamera.id ? 'Audio ON' : 'Audio yoqish'}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

type MetricTileProps = {
  icon: typeof LayoutGrid;
  label: string;
  value: number | string;
  tone?: string;
};

function MetricTile({ icon: Icon, label, value, tone = 'text-slate-700' }: MetricTileProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase text-slate-500">{label}</p>
          <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
        </div>
        <Icon size={18} className={tone} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-200 py-2 text-sm last:border-b-0 dark:border-slate-800">
      <p className="text-[11px] uppercase text-slate-500">{label}</p>
      <p className="mt-0.5 break-words font-medium text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
