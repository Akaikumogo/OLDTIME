import { Empty, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CalendarDays } from 'lucide-react';
import {
  ATTENDANCE_STATUS_COLORS,
  ATTENDANCE_STATUS_LABELS
} from '@/features/dashboard/constants';
import type { DashboardDailyRow } from '@/features/dashboard/types';
import { formatDisplayDate } from '@/utils/date';
import { secondsBetweenClockTimes, secondsToHuman } from '@/utils/time';

type DailyAttendanceTableProps = {
  rows: DashboardDailyRow[];
  onRowClick: (row: DashboardDailyRow) => void;
};

export function DailyAttendanceTable({ rows, onRowClick }: DailyAttendanceTableProps) {
  const columns: ColumnsType<DashboardDailyRow> = [
    {
      title: 'Xodim',
      dataIndex: ['employee', 'full_name'],
      fixed: 'left',
      render: (_value, row) => (
        <button
          type="button"
          onClick={() => onRowClick(row)}
          className="text-left font-semibold text-slate-900 hover:text-blue-600 dark:text-white"
        >
          {row.employee.full_name}
        </button>
      )
    },
    {
      title: 'Sana',
      dataIndex: 'date',
      width: 120,
      render: (value: string) => formatDisplayDate(value)
    },
    {
      title: 'Keldi',
      dataIndex: 'first_entry',
      width: 110,
      render: (value?: string | null) => value || '-'
    },
    {
      title: 'Ketdi',
      dataIndex: 'last_exit',
      width: 110,
      render: (value?: string | null) => value || '-'
    },
    {
      title: 'Ishxonada',
      width: 130,
      render: (_, row) =>
        secondsToHuman(
          row.segments
            .filter((segment) => segment.type === 'work')
            .reduce(
              (sum, segment) =>
                sum + secondsBetweenClockTimes(segment.start, segment.end),
              0
            )
        )
    },
    {
      title: 'Kompyuter',
      width: 130,
      render: (_, row) => secondsToHuman(row.computer_seconds)
    },
    {
      title: 'Status',
      dataIndex: 'statuses',
      render: (statuses: string[]) => (
        <div className="flex flex-wrap gap-1">
          {(statuses.length ? statuses : ['entry']).slice(0, 3).map((status) => (
            <Tag key={status} color={ATTENDANCE_STATUS_COLORS[status] || 'default'}>
              {ATTENDANCE_STATUS_LABELS[status] || status}
            </Tag>
          ))}
        </div>
      )
    },
    {
      title: 'Top ilovalar',
      dataIndex: 'top_apps',
      render: (apps?: string[]) => apps?.join(', ') || '-'
    }
  ];

  return (
    <Table
      title={() => (
        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
          <CalendarDays size={18} />
          <span>Xodimlar jadvali</span>
        </div>
      )}
      rowKey="id"
      columns={columns}
      dataSource={rows}
      scroll={{ x: 1050 }}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      locale={{ emptyText: <Empty description="Bugungi davomat topilmadi" /> }}
      onRow={(row) => ({
        onClick: () => onRowClick(row)
      })}
    />
  );
}
