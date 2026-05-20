import { Empty, Tag, Timeline } from 'antd';
import type { LocationTimelineItem } from '@/services/api';
import { formatDateTime } from '@/utils/date';
import { secondsToHuman } from '@/utils/time';

const zoneColor: Record<string, string> = {
  WORK_ROOM: 'green',
  REST_ZONE: 'orange',
  CORRIDOR: 'blue',
  MEETING_ROOM: 'purple',
  ENTRANCE: 'cyan',
  EXIT: 'red',
  UNKNOWN: 'default'
};

export function ZoneTimeline({ items }: { items: LocationTimelineItem[] }) {
  if (items.length === 0) {
    return <Empty description="Harakat tarixi topilmadi" />;
  }

  return (
    <Timeline
      items={items.map((item) => ({
        color: zoneColor[item.zone_type] || 'gray',
        children: (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900 dark:text-white">
                {item.camera_name}
              </span>
              <Tag color={zoneColor[item.zone_type] || 'default'}>
                {item.zone_name}
              </Tag>
              <Tag>{item.detection_type}</Tag>
              <Tag>{Math.round(item.confidence * 100)}%</Tag>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatDateTime(item.seen_at)}
              {typeof item.duration_seconds === 'number'
                ? ` - ${secondsToHuman(item.duration_seconds)}`
                : ''}
            </p>
          </div>
        )
      }))}
    />
  );
}
