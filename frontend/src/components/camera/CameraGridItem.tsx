import { useMemo, useRef, useState } from 'react';
import { Expand, Volume2, VolumeX, Camera as CameraIcon, UserX } from 'lucide-react';
import { Tooltip } from 'antd';
import { BACKEND_ORIGIN, type Camera, type CameraMini, type LiveUnknownDetection } from '@/services/api';
import { CameraStatusBadge } from './CameraStatusBadge';
import { formatDateTime } from '@/utils/date';

type CameraLike = Camera | CameraMini;

function tokenizedUrl(path: string) {
  const token =
    localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  const base = path.startsWith('http') ? path : `${BACKEND_ORIGIN}${path}`;
  if (!token) return base;
  return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

function getRoomName(camera: CameraLike) {
  return 'room_name' in camera ? camera.room_name : null;
}

type Props = {
  camera: CameraLike;
  unknownDetection?: LiveUnknownDetection | null;
};

export function CameraGridItem({ camera, unknownDetection }: Props) {
  const [videoError, setVideoError] = useState(false);
  const [listening, setListening] = useState(false);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const streamSrc = useMemo(() => {
    if (!camera?.stream_url) return null;
    return tokenizedUrl(camera.stream_url);
  }, [camera.stream_url]);

  const handleFullscreen = async () => {
    await containerRef.current?.requestFullscreen?.();
  };

  const roomName = getRoomName(camera);

  return (
    <div
      ref={containerRef}
      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-[0_4px_16px_rgba(15,23,42,0.08)] dark:border-slate-800"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Video */}
      <div className="relative aspect-video w-full bg-slate-950">
        {streamSrc && !videoError ? (
          <video
            key={`grid-${camera.id}-${streamSrc}`}
            src={streamSrc}
            className="h-full w-full object-cover"
            autoPlay
            playsInline
            muted={!listening}
            controls={false}
            onError={() => setVideoError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500">
            <CameraIcon size={28} />
            <span className="text-xs">Stream yo'q</span>
          </div>
        )}

        {/* Top overlay: name + status */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white drop-shadow">
              {camera.name}
            </p>
            <p className="truncate text-[10px] text-slate-300">
              {camera.zone_name}
              {roomName ? ` · ${roomName}` : ''}
            </p>
          </div>
          <CameraStatusBadge status={camera.status} />
        </div>

        {/* Unknown person alert badge */}
        {unknownDetection ? (
          <Tooltip
            title={`Noma'lum odam — ${Math.round(unknownDetection.confidence * 100)}% ishonch · ${formatDateTime(unknownDetection.seen_at)}`}
          >
            <div className="absolute left-2 top-9 flex animate-pulse items-center gap-1 rounded-md bg-red-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-lg">
              <UserX size={11} />
              Noma'lum odam
            </div>
          </Tooltip>
        ) : null}

        {/* Bottom overlay on hover: controls */}
        <div
          className={`absolute inset-x-0 bottom-0 flex items-center justify-end gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2 transition-opacity duration-150 ${
            hovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {'has_audio' in camera && camera.has_audio ? (
            <Tooltip title={listening ? "Sesni o'chirish" : 'Sesni yoqish'}>
              <button
                className="flex h-6 w-6 items-center justify-center rounded bg-black/50 text-white hover:bg-black/80"
                onClick={() => setListening((v) => !v)}
              >
                {listening ? <Volume2 size={13} /> : <VolumeX size={13} />}
              </button>
            </Tooltip>
          ) : null}
          <Tooltip title="Fullscreen">
            <button
              className="flex h-6 w-6 items-center justify-center rounded bg-black/50 text-white hover:bg-black/80"
              onClick={() => void handleFullscreen()}
            >
              <Expand size={13} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
