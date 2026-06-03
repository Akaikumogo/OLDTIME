import { Drawer, Empty, Skeleton, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Activity, LogIn, LogOut, Monitor, Timer, ZoomIn, ZoomOut } from 'lucide-react';
import { StatCard } from './StatCard';
import type {
  DashboardDailyRow,
  DashboardEmployeeTimeline
} from '@/features/dashboard/types';
import { formatClockWithSeconds, formatDateTime, formatDisplayDate } from '@/utils/date';
import {
  isoToMinutes,
  minutesToClock,
  secondsToHuman,
  timeToMinutes
} from '@/utils/time';
import type { EmployeeTimelineComputerActivity } from '@/services/api';
import { useState } from 'react';

const DAY_MINUTES = 24 * 60;

type EmployeeTimelineDrawerProps = {
  open: boolean;
  date: string;
  row: DashboardDailyRow | null;
  timeline: DashboardEmployeeTimeline | null;
  loading: boolean;
  onClose: () => void;
};

type IdleGap = {
  start: number;
  end: number;
};

function buildIdleGaps(timeline: DashboardEmployeeTimeline): IdleGap[] {
  const activities = timeline.computer_activity
    .map((item) => ({
      start: isoToMinutes(item.started_at),
      end: isoToMinutes(item.ended_at)
    }))
    .filter(
      (item): item is IdleGap =>
        item.start !== null && item.end !== null && item.end > item.start
    )
    .sort((a, b) => a.start - b.start);

  return timeline.segments
    .filter((segment) => segment.type === 'work')
    .flatMap((segment) => {
      const start = timeToMinutes(segment.start);
      const end = timeToMinutes(segment.end);
      if (start === null || end === null || end <= start) return [];

      const gaps: IdleGap[] = [];
      let cursor = start;
      activities.forEach((activity) => {
        if (activity.end <= start || activity.start >= end) return;
        const activityStart = Math.max(start, activity.start);
        const activityEnd = Math.min(end, activity.end);
        if (activityStart > cursor) {
          gaps.push({ start: cursor, end: activityStart });
        }
        cursor = Math.max(cursor, activityEnd);
      });
      if (cursor < end) gaps.push({ start: cursor, end });
      return gaps.filter((gap) => gap.end - gap.start >= 5);
    });
}

function AttendanceTimeline({ timeline }: { timeline: DashboardEmployeeTimeline }) {
  const [zoomLevel, setZoomLevel] = useState(0);

  const zoomConfigs = [
    { label: '2h', interval: 120 },
    { label: '1h', interval: 60 }
  ];

  const handleZoomIn = () => {
    if (zoomLevel < zoomConfigs.length - 1) {
      setZoomLevel(zoomLevel + 1);
    }
  };

  const handleZoomOut = () => {
    if (zoomLevel > 0) {
      setZoomLevel(zoomLevel - 1);
    }
  };

  const currentConfig = zoomConfigs[zoomLevel];
  const hours = Array.from({ length: 25 }, (_, index) => index);
  const idleGaps = buildIdleGaps(timeline);

  const showMinutes = currentConfig.interval === 60;

  const minWidth = showMinutes ? 2000 : 860;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Zoom: {currentConfig.label}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel === 0}
            className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel === zoomConfigs.length - 1}
            className="rounded p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto pb-2" onWheel={(e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            handleZoomIn();
          } else {
            handleZoomOut();
          }
        }
      }}>
        <div style={{ minWidth: `${minWidth}px` }}>
          <div className="mb-2 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
            {showMinutes
              ? Array.from({ length: 24 * 60 }, (_, index) => index)
                  .filter((minute) => minute % currentConfig.interval === 0)
                  .map((minute) => {
                    const hour = Math.floor(minute / 60);
                    const min = minute % 60;
                    return (
                      <span key={minute}>
                        {String(hour).padStart(2, '0')}:{String(min).padStart(2, '0')}
                      </span>
                    );
                  })
              : hours
                  .filter((hour) => hour * 60 % currentConfig.interval === 0)
                  .map((hour) => (
                    <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
                  ))}
          </div>
          <div className="relative h-24 rounded-lg bg-slate-100 dark:bg-slate-900/70">
            {showMinutes
              ? Array.from({ length: 24 * 60 }, (_, index) => index)
                  .filter((minute) => minute % currentConfig.interval === 0)
                  .map((minute) => (
                    <div
                      key={minute}
                      className="absolute bottom-0 top-0 border-l border-slate-300/60 dark:border-slate-700/70"
                      style={{ left: `${(minute / DAY_MINUTES) * 100}%` }}
                    />
                  ))
              : hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute bottom-0 top-0 border-l border-slate-300/60 dark:border-slate-700/70"
                    style={{ left: `${(hour / 24) * 100}%` }}
                  />
                ))}

            {timeline.segments.map((segment, index) => {
              const start = timeToMinutes(segment.start);
              const end = timeToMinutes(segment.end);
              if (start === null || end === null || end <= start) return null;
              const isWork = segment.type === 'work';

              return (
                <Tooltip
                  key={`${segment.type}-${segment.start}-${index}`}
                  title={`${segment.label}: ${segment.start} - ${segment.end}${segment.reason ? ` (${segment.reason})` : ''}`}
                >
                  <div
                    className={`absolute top-9 h-8 rounded ${
                      isWork ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                    style={{
                      left: `${(start / DAY_MINUTES) * 100}%`,
                      width: `${((end - start) / DAY_MINUTES) * 100}%`
                    }}
                  />
                </Tooltip>
              );
            })}

            {idleGaps.map((gap, index) => (
              <Tooltip
                key={`${gap.start}-${index}`}
                title={`Kompyuterda ish yo'q: ${minutesToClock(gap.start)} - ${minutesToClock(gap.end)}`}
              >
                <div
                  className="absolute top-9 h-8 rounded bg-amber-400/90"
                  style={{
                    left: `${(gap.start / DAY_MINUTES) * 100}%`,
                    width: `${((gap.end - gap.start) / DAY_MINUTES) * 100}%`
                  }}
                />
              </Tooltip>
            ))}

            {timeline.markers.map((marker, index) => {
              const position = marker.time.includes('T') ? isoToMinutes(marker.time) : timeToMinutes(marker.time);
              if (position === null) return null;
              const isEntry = marker.type === 'entry';
              return (
                <Tooltip
                  key={`${marker.time}-${index}`}
                  title={`${marker.label}: ${marker.time} (${marker.door_name})`}
                >
                  <div
                    className="absolute top-2 flex -translate-x-1/2 flex-col items-center"
                    style={{ left: `${(position / DAY_MINUTES) * 100}%` }}
                  >
                    <div
                      className={`h-5 w-1 rounded-full ${
                        isEntry ? 'bg-emerald-700' : 'bg-red-600'
                      }`}
                    />
                    <span className="mt-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 shadow dark:bg-slate-800 dark:text-slate-100">
                      {marker.time.includes('T') ? marker.time.split('T')[1].slice(0, 5) : marker.time}
                    </span>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          Yashil: ishxonada bo'lgan vaqt
        </div>
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Sariq: ish vaqtida kompyuter faolligi yo'q
        </div>
        <div className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          Belgilar: kirish va chiqish vaqtlari
        </div>
      </div>
    </div>
  );
}

function TopAppsSummary({ timeline }: { timeline: DashboardEmployeeTimeline }) {
  const apps = timeline.computer_activity.reduce<Map<string, number>>((map, item) => {
    map.set(item.app_name, (map.get(item.app_name) ?? 0) + item.duration_seconds);
    return map;
  }, new Map());

  const rows = Array.from(apps.entries())
    .map(([name, seconds]) => ({ name, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);

  if (rows.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Top ilovalar yo'q" />;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {rows.map((item) => (
        <Tag key={item.name} color="blue" className="m-0 rounded-md px-2 py-1">
          {item.name}: {secondsToHuman(item.seconds)}
        </Tag>
      ))}
    </div>
  );
}

const activityColumns: ColumnsType<EmployeeTimelineComputerActivity> = [
  { title: 'Ilova', dataIndex: 'app_name', width: 130 },
  {
    title: 'Oyna',
    dataIndex: 'window_title',
    render: (value?: string | null) => value || '-'
  },
  {
    title: 'URL',
    dataIndex: 'url',
    render: (value?: string | null) =>
      value ? (
        <a href={value} target="_blank" rel="noreferrer" className="break-all">
          {value}
        </a>
      ) : (
        '-'
      )
  },
  {
    title: 'Boshlanish',
    dataIndex: 'started_at',
    width: 150,
    render: (value: string) => formatDateTime(value)
  },
  {
    title: 'Tugash',
    dataIndex: 'ended_at',
    width: 150,
    render: (value: string) => formatDateTime(value)
  },
  {
    title: 'Davomiylik',
    dataIndex: 'duration_seconds',
    width: 120,
    render: (value: number) => secondsToHuman(value)
  }
];

export function EmployeeTimelineDrawer({
  open,
  date,
  row,
  timeline,
  loading,
  onClose
}: EmployeeTimelineDrawerProps) {
  const title = timeline?.employee.full_name || row?.employee.full_name || 'Xodim';

  return (
    <Drawer
      open={open}
      title={title}
      width={920}
      onClose={onClose}
      destroyOnHidden
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : timeline ? (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-300">
              {formatDisplayDate(date)}
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
              Bugungi timeline
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={LogIn}
              label="Birinchi kirish"
              value={formatClockWithSeconds(timeline.summary?.first_entry)}
              tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
            />
            <StatCard
              icon={LogOut}
              label="Oxirgi chiqish"
              value={formatClockWithSeconds(timeline.summary?.last_exit)}
              tone="bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-200"
            />
            <StatCard
              icon={Timer}
              label="Ishxonada"
              value={secondsToHuman(timeline.summary?.work_seconds)}
              tone="bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200"
            />
            <StatCard
              icon={Monitor}
              label="Kompyuter"
              value={secondsToHuman(timeline.summary?.computer_seconds)}
              tone="bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200"
            />
          </div>

          <section className="space-y-3">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              Attendance timeline
            </h4>
            <AttendanceTimeline timeline={timeline} />
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Activity size={18} />
              <span>Top apps summary</span>
            </div>
            <TopAppsSummary timeline={timeline} />
          </section>

          <section className="space-y-3">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              Computer activity
            </h4>
            <Table
              size="small"
              rowKey="id"
              columns={activityColumns}
              dataSource={timeline.computer_activity}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 900 }}
              locale={{
                emptyText: <Empty description="Kompyuter faolligi topilmadi" />
              }}
            />
          </section>
        </div>
      ) : (
        <Empty description="Timeline ma'lumoti topilmadi" />
      )}
    </Drawer>
  );
}
