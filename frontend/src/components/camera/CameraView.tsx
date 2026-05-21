import { useMemo, useRef, useState } from 'react';
import { Button, Empty, Tooltip, message } from 'antd';
import {
  Camera as CameraIcon,
  Expand,
  Mic,
  MicOff,
  Radio,
  Volume2,
  VolumeX
} from 'lucide-react';
import apiService, {
  BACKEND_ORIGIN,
  type Camera,
  type CameraMini,
  type EmployeeLiveLocation
} from '@/services/api';
import { formatDateTime } from '@/utils/date';
import { CameraStatusBadge } from './CameraStatusBadge';

type CameraLike = Camera | CameraMini;

type CameraViewProps = {
  camera?: CameraLike | null;
  title: string;
  location?: EmployeeLiveLocation | null;
};

function tokenizedUrl(path: string) {
  const token =
    localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  const base = path.startsWith('http') ? path : `${BACKEND_ORIGIN}${path}`;
  const url = new URL(base);
  url.searchParams.set('format', 'mp4');
  if (token) {
    url.searchParams.set('token', token);
  }
  return url.toString();
}

function getRoomName(camera: CameraLike) {
  return 'room_name' in camera ? camera.room_name : null;
}

export function CameraView({ camera, title, location }: CameraViewProps) {
  const [videoError, setVideoError] = useState(false);
  const [listening, setListening] = useState(false);
  const [talking, setTalking] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const streamSrc = useMemo(() => {
    if (!camera?.stream_url) return null;
    return tokenizedUrl(camera.stream_url);
  }, [camera?.stream_url]);

  const detectionLabel = location
    ? location.inferred
      ? 'Inferred'
      : location.is_visible
        ? 'Visible'
        : 'Not visible'
    : '-';

  const stopMic = () => {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
  };

  const toggleTalk = async () => {
    if (!camera || !camera.has_speaker) return;
    setBusy(true);
    try {
      if (talking) {
        await apiService.talkCamera(camera.id, 'stop');
        stopMic();
        setTalking(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      await apiService.talkCamera(camera.id, 'start');
      setTalking(true);
    } catch (error) {
      stopMic();
      message.error(
        error instanceof Error
          ? error.message
          : 'Mikrofon yoki talkback ishga tushmadi'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSnapshot = async () => {
    if (!camera) return;
    setBusy(true);
    try {
      const result = await apiService.snapshotCamera(camera.id);
      message.info(result.snapshot_url || result.message);
    } finally {
      setBusy(false);
    }
  };

  const handleFullscreen = async () => {
    await containerRef.current?.requestFullscreen?.();
  };

  if (!camera) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <Empty description={`${title} topilmadi`} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-3 dark:border-slate-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-blue-600" />
            <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
              {title}
            </h3>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {camera.name} - {camera.zone_name}
            {getRoomName(camera) ? ` - ${getRoomName(camera)}` : ''}
          </p>
        </div>
        <CameraStatusBadge status={camera.status} />
      </div>

      <div className="relative aspect-video bg-slate-950">
        {streamSrc && !videoError ? (
          <video
            key={`${camera.id}-${streamSrc}`}
            src={streamSrc}
            className="h-full w-full object-cover"
            autoPlay
            playsInline
            muted={!listening}
            controls={false}
            onError={() => setVideoError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-300">
            <CameraIcon size={34} />
            <span className="text-sm">Media gateway ulanmagan</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-4">
        <Info label="Detection" value={detectionLabel} />
        <Info
          label="Last seen"
          value={location?.last_seen_at ? formatDateTime(location.last_seen_at) : '-'}
        />
        <Info
          label="Confidence"
          value={
            typeof location?.confidence === 'number'
              ? `${Math.round(location.confidence * 100)}%`
              : '-'
          }
        />
        <Info label="IP" value={camera.ip} />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
        <Tooltip title={camera.has_audio ? 'Audio listen' : 'Audio yoq'}>
          <Button
            size="small"
            icon={listening ? <Volume2 size={15} /> : <VolumeX size={15} />}
            disabled={!camera.has_audio}
            onClick={() => setListening((value) => !value)}
          />
        </Tooltip>
        <Tooltip title={camera.has_speaker ? 'Talkback' : 'Speaker yoq'}>
          <Button
            size="small"
            danger={talking}
            loading={busy && camera.has_speaker}
            icon={talking ? <MicOff size={15} /> : <Mic size={15} />}
            disabled={!camera.has_speaker}
            onClick={() => void toggleTalk()}
          />
        </Tooltip>
        <Tooltip title="Snapshot">
          <Button
            size="small"
            loading={busy}
            icon={<CameraIcon size={15} />}
            onClick={() => void handleSnapshot()}
          />
        </Tooltip>
        <Tooltip title="Fullscreen">
          <Button
            size="small"
            icon={<Expand size={15} />}
            onClick={() => void handleFullscreen()}
          />
        </Tooltip>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase text-slate-400">{label}</p>
      <p className="truncate font-medium text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}
