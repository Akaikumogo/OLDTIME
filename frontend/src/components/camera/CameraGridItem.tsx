import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera as CameraIcon,
  Expand,
  RefreshCw,
  UserCheck,
  UserX,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Tooltip } from 'antd';
import {
  BACKEND_ORIGIN,
  type Camera,
  type CameraMini,
  type DetectionBbox,
  type LiveMatchedDetection,
  type LiveUnknownDetection
} from '@/services/api';
import { CameraStatusBadge } from './CameraStatusBadge';
import { formatDateTime } from '@/utils/date';

type CameraLike = Camera | CameraMini;
type StreamProfile = 'main' | 'sub';

function tokenizedUrl(path: string, profile: StreamProfile) {
  const token =
    localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  const base = path.startsWith('http') ? path : `${BACKEND_ORIGIN}${path}`;
  const url = new URL(base);
  url.searchParams.set('profile', profile);
  url.searchParams.set('format', 'mp4');
  if (token) {
    url.searchParams.set('token', token);
  }
  return url.toString();
}

function getRoomName(camera: CameraLike) {
  return 'room_name' in camera ? camera.room_name : null;
}

type BboxDrawItem = {
  bbox: DetectionBbox;
  color: string;
  label: string;
  confidence: number;
};

function drawBoxes(canvas: HTMLCanvasElement, items: BboxDrawItem[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cw = canvas.width;
  const ch = canvas.height;

  ctx.clearRect(0, 0, cw, ch);

  for (const item of items) {
    const { bbox, color, label, confidence } = item;

    if (confidence < 0.5) continue;

    const fw = bbox.fw ?? 1920;
    const fh = bbox.fh ?? 1080;

    // object-cover: uniform scale, center offset
    const scale = Math.max(cw / fw, ch / fh);
    const offsetX = (cw - fw * scale) / 2;
    const offsetY = (ch - fh * scale) / 2;

    const rx = bbox.x * scale + offsetX;
    const ry = bbox.y * scale + offsetY;
    const rw = bbox.w * scale;
    const rh = bbox.h * scale;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.shadowBlur = 0;

    const text = `${label}  ${Math.round(confidence * 100)}%`;
    const fontSize = Math.max(11, Math.min(14, rw / 7));
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textW = ctx.measureText(text).width;
    const padX = 5;
    const padY = 3;
    const labelH = fontSize + padY * 2;

    const labelY = ry > labelH + 2 ? ry - labelH - 1 : ry + 1;

    ctx.fillStyle = color;
    ctx.fillRect(rx, labelY, textW + padX * 2, labelH);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, rx + padX, labelY + fontSize + padY - 2);
  }
}

type Props = {
  camera: CameraLike;
  unknownDetections?: LiveUnknownDetection[];
  unknownDetection?: LiveUnknownDetection | null;
  unknownCount?: number;
  matchedDetections?: LiveMatchedDetection[];
  showMatched?: boolean;
  profile?: StreamProfile;
  expanded?: boolean;
  audioActive?: boolean;
  onOpen?: () => void;
  onAudioToggle?: () => void;
};

export function CameraGridItem({
  camera,
  unknownDetections = [],
  unknownDetection,
  unknownCount = 0,
  matchedDetections = [],
  showMatched = false,
  profile = 'main',
  expanded = false,
  audioActive = false,
  onOpen,
  onAudioToggle
}: Props) {
  const [videoError, setVideoError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [shouldStream, setShouldStream] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || expanded) {
      setShouldStream(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShouldStream(entry.isIntersecting);
      },
      { rootMargin: '480px 0px', threshold: 0.01 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded]);

  const streamSrc = useMemo(() => {
    if (!camera?.stream_url) return null;
    return tokenizedUrl(camera.stream_url, profile);
  }, [camera.stream_url, profile]);

  const activeUnknowns = unknownDetection ? [unknownDetection, ...unknownDetections.filter(u => u.id !== unknownDetection.id)] : unknownDetections;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = videoWrapRef.current;
    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const items: BboxDrawItem[] = [];

    for (const u of activeUnknowns) {
      if (u.bbox) {
        items.push({ bbox: u.bbox, color: '#ef4444', label: "Noma'lum", confidence: u.confidence });
      }
    }

    if (showMatched) {
      for (const m of matchedDetections) {
        if (m.bbox) {
          items.push({ bbox: m.bbox, color: '#22c55e', label: m.employee_name, confidence: m.confidence });
        }
      }
    }

    drawBoxes(canvas, items);
  }, [activeUnknowns, matchedDetections, showMatched]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const wrap = videoWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  const handleFullscreen = async () => {
    await containerRef.current?.requestFullscreen?.();
  };

  const roomName = getRoomName(camera);
  const unknownLabel =
    unknownCount > 1 ? `${unknownCount} noma'lum odam` : "Noma'lum odam";

  const hasBboxData = activeUnknowns.some(u => u.bbox) || (showMatched && matchedDetections.some(m => m.bbox));

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-lg border bg-slate-950 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition ${
        audioActive
          ? 'border-emerald-400 ring-2 ring-emerald-400/30'
          : 'border-slate-200 hover:border-blue-300 dark:border-slate-800 dark:hover:border-blue-800'
      } ${onOpen ? 'cursor-pointer' : ''}`}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div ref={videoWrapRef} className="relative aspect-video w-full bg-slate-950">
        {streamSrc && shouldStream && !videoError ? (
          <video
            key={`grid-${camera.id}-${streamSrc}`}
            src={streamSrc}
            className="h-full w-full object-cover"
            autoPlay
            playsInline
            muted
            preload="none"
            controls={false}
            onError={() => setVideoError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500">
            <CameraIcon size={28} />
            <span className="px-2 text-center text-xs">
              {!streamSrc
                ? "Stream URL yo'q"
                : videoError
                  ? 'Gateway ulanmadi'
                  : 'Stream kutilyapti'}
            </span>
            {videoError ? (
              <button
                className="mt-1 flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-600"
                onClick={(event) => {
                  event.stopPropagation();
                  setVideoError(false);
                }}
              >
                <RefreshCw size={10} />
                Qayta urinish
              </button>
            ) : null}
          </div>
        )}

        {hasBboxData ? (
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        ) : null}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white drop-shadow">
              {camera.name}
            </p>
            <p className="truncate text-[10px] text-slate-300">
              {camera.zone_name}
              {roomName ? ` - ${roomName}` : ''}
            </p>
          </div>
          <CameraStatusBadge status={camera.status} />
        </div>

        <div className="absolute left-2 top-9 flex flex-col gap-1">
          {unknownDetection ? (
            <Tooltip
              title={`${unknownLabel} - ${Math.round(
                unknownDetection.confidence * 100
              )}% ishonch - ${formatDateTime(unknownDetection.seen_at)}`}
            >
              <div className="flex animate-pulse items-center gap-1 rounded-md bg-red-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-lg">
                <UserX size={11} />
                {unknownLabel}
              </div>
            </Tooltip>
          ) : null}
          {showMatched && matchedDetections.map((m) => (
            <Tooltip
              key={m.id}
              title={`${m.employee_name} - ${Math.round(m.confidence * 100)}% ishonch - ${formatDateTime(m.seen_at)}`}
            >
              <div className="flex items-center gap-1 rounded-md bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-lg">
                <UserCheck size={11} />
                {m.employee_name}
              </div>
            </Tooltip>
          ))}
        </div>

        <div
          className={`absolute inset-x-0 bottom-0 flex items-center justify-end gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-2 transition-opacity duration-150 ${
            hovered || expanded || audioActive ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {'has_audio' in camera && camera.has_audio ? (
            <Tooltip title={audioActive ? 'AUDIO: ON' : 'AUDIO: OFF'}>
              <button
                className={`flex h-7 min-w-[86px] items-center justify-center gap-1 rounded px-2 text-[10px] font-semibold text-white ${
                  audioActive
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-black/55 hover:bg-black/80'
                }`}
                onClick={(event) => {
                  event.stopPropagation();
                  onAudioToggle?.();
                }}
              >
                {audioActive ? <Volume2 size={13} /> : <VolumeX size={13} />}
                <span>AUDIO {audioActive ? 'ON' : 'OFF'}</span>
              </button>
            </Tooltip>
          ) : null}
          <Tooltip title="Fullscreen">
            <button
              className="flex h-7 w-7 items-center justify-center rounded bg-black/55 text-white hover:bg-black/80"
              onClick={(event) => {
                event.stopPropagation();
                void handleFullscreen();
              }}
            >
              <Expand size={13} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-slate-800 bg-slate-900 px-2.5 py-2 text-[11px] text-slate-400">
        <span className="truncate">{camera.ip}</span>
        <span className={camera.has_audio ? 'text-emerald-300' : 'text-slate-500'}>
          {camera.has_audio ? 'Audio ready' : 'No audio'}
        </span>
      </div>
    </div>
  );
}
