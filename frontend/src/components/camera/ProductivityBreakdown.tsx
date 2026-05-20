import { Progress, Statistic } from 'antd';
import type { CameraProductivityBreakdown } from '@/services/api';
import { secondsToHuman } from '@/utils/time';

const metricLabels: Array<{
  key: keyof CameraProductivityBreakdown;
  label: string;
  tone: string;
}> = [
  {
    key: 'assigned_room_visible_seconds',
    label: 'Assigned room',
    tone: 'text-emerald-600'
  },
  {
    key: 'work_zone_visible_seconds',
    label: 'Work zone',
    tone: 'text-blue-600'
  },
  {
    key: 'rest_zone_seconds',
    label: 'Rest zone',
    tone: 'text-orange-600'
  },
  {
    key: 'corridor_seconds',
    label: 'Corridor',
    tone: 'text-cyan-600'
  },
  {
    key: 'unknown_seconds',
    label: 'Unknown',
    tone: 'text-slate-500'
  },
  {
    key: 'not_visible_seconds',
    label: 'Not visible',
    tone: 'text-red-600'
  }
];

export function ProductivityBreakdown({
  data
}: {
  data?: CameraProductivityBreakdown | null;
}) {
  const total =
    metricLabels.reduce((sum, item) => sum + Number(data?.[item.key] || 0), 0) ||
    1;
  const score = Math.round(Number(data?.productivity_score || 0));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">
            Camera productivity
          </h3>
        </div>
        <Statistic title="Score" value={score} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {metricLabels.map((item) => {
          const seconds = Number(data?.[item.key] || 0);
          const percent = Math.round((seconds / total) * 100);
          return (
            <div key={item.key} className="rounded-lg bg-slate-50 p-3 dark:bg-black/35">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-medium ${item.tone}`}>
                  {item.label}
                </span>
                <span className="text-xs text-slate-500">{secondsToHuman(seconds)}</span>
              </div>
              <Progress percent={percent} size="small" showInfo={false} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
