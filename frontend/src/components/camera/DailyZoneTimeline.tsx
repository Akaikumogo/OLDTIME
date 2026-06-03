import { Empty, Skeleton, Tag, Tooltip } from 'antd';
import { Clock } from 'lucide-react';
import type {
  EmployeeDailyTimeline,
  ZoneType
} from '@/services/api';
import { isoToMinutes, secondsToHuman } from '@/utils/time';

const DAY_MINUTES = 24 * 60;

// Zona turi bo'yicha rang (timeline bar uchun tailwind klasslari)
const zoneBarClass: Record<ZoneType, string> = {
  WORK_ROOM: 'bg-emerald-500',
  REST_ZONE: 'bg-amber-400',
  CORRIDOR: 'bg-sky-500',
  MEETING_ROOM: 'bg-violet-500',
  ENTRANCE: 'bg-cyan-500',
  EXIT: 'bg-rose-500',
  UNKNOWN: 'bg-slate-400'
};

const zoneTagColor: Record<ZoneType, string> = {
  WORK_ROOM: 'green',
  REST_ZONE: 'orange',
  CORRIDOR: 'blue',
  MEETING_ROOM: 'purple',
  ENTRANCE: 'cyan',
  EXIT: 'red',
  UNKNOWN: 'default'
};

type DailyZoneTimelineProps = {
  data: EmployeeDailyTimeline | null;
  loading?: boolean;
};

export function DailyZoneTimeline({ data, loading }: DailyZoneTimelineProps) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 5 }} />;
  }

  if (!data || data.segments.length === 0) {
    return <Empty description="Bugun kamera orqali ko'rinmagan" />;
  }

  const hours = Array.from({ length: 25 }, (_, index) => index);

  return (
    <div className="space-y-4">
      {/* 24 soatlik vaqt chizig'i */}
      <div className="overflow-x-auto pb-1">
        <div style={{ minWidth: '760px' }}>
          <div className="mb-1 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
            {hours
              .filter((hour) => hour % 2 === 0)
              .map((hour) => (
                <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
              ))}
          </div>
          <div className="relative h-10 rounded-lg bg-slate-100 dark:bg-slate-900/70">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute bottom-0 top-0 border-l border-slate-300/50 dark:border-slate-700/60"
                style={{ left: `${(hour / 24) * 100}%` }}
              />
            ))}

            {data.segments.map((segment, index) => {
              const start = isoToMinutes(segment.start_at);
              const end = isoToMinutes(segment.end_at);
              if (start === null || end === null) return null;
              // Bitta detection segment ham ko'rinishi uchun minimal kenglik
              const width = Math.max((end - start) / DAY_MINUTES, 0.004);

              return (
                <Tooltip
                  key={`${segment.zone_id}-${segment.start_at}-${index}`}
                  title={
                    <div className="text-xs">
                      <div className="font-semibold">{segment.zone_name}</div>
                      <div>
                        {segment.start_clock} - {segment.end_clock}
                      </div>
                      <div>{secondsToHuman(segment.duration_seconds)}</div>
                      {segment.camera_name ? (
                        <div className="opacity-80">📷 {segment.camera_name}</div>
                      ) : null}
                    </div>
                  }
                >
                  <div
                    className={`absolute top-1.5 h-7 rounded ${zoneBarClass[segment.zone_type] || 'bg-slate-400'}`}
                    style={{
                      left: `${(start / DAY_MINUTES) * 100}%`,
                      width: `${width * 100}%`
                    }}
                  />
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>

      {/* Zona bo'yicha jami vaqt */}
      <div className="flex flex-wrap gap-2">
        {data.zone_totals.map((zone) => (
          <Tag
            key={zone.zone_id}
            color={zoneTagColor[zone.zone_type] || 'default'}
            className="m-0 rounded-md px-2 py-1"
          >
            {zone.zone_name}: {secondsToHuman(zone.total_seconds)}
          </Tag>
        ))}
      </div>

      {/* Segmentlar ro'yxati: soat nechchida qaysi zonada */}
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {data.segments.map((segment, index) => (
          <div
            key={`row-${segment.zone_id}-${segment.start_at}-${index}`}
            className="flex items-center gap-3 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-slate-400">
              <Clock size={13} />
              {segment.start_clock} – {segment.end_clock}
            </span>
            <Tag
              color={zoneTagColor[segment.zone_type] || 'default'}
              className="m-0"
            >
              {segment.zone_name}
            </Tag>
            {segment.room_name ? (
              <span className="text-xs text-slate-400">{segment.room_name}</span>
            ) : null}
            <span className="ml-auto font-medium text-slate-700 dark:text-slate-200">
              {secondsToHuman(segment.duration_seconds)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
