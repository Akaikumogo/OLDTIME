import { Empty, Input, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
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

type PresenceFilter = 'all' | 'inside' | 'entered' | 'exited' | 'incomplete';

export function DailyAttendanceTable({ rows, onRowClick }: DailyAttendanceTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [presenceFilter, setPresenceFilter] = useState<PresenceFilter>('all');

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !normalizedSearch ||
        row.employee.full_name.toLowerCase().includes(normalizedSearch);
      const matchesStatus =
        !statusFilter || row.statuses.includes(statusFilter);
      const hasEntry = Boolean(row.first_entry);
      const hasExit = Boolean(row.last_exit);
      const matchesPresence =
        presenceFilter === 'all' ||
        (presenceFilter === 'inside' && hasEntry && !hasExit) ||
        (presenceFilter === 'entered' && hasEntry) ||
        (presenceFilter === 'exited' && hasExit) ||
        (presenceFilter === 'incomplete' && hasEntry !== hasExit);
      return matchesSearch && matchesStatus && matchesPresence;
    });
  }, [presenceFilter, rows, search, statusFilter]);

  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    rows.forEach((row) => row.statuses.forEach((status) => statuses.add(status)));
    return Array.from(statuses).map((status) => ({
      value: status,
      label: ATTENDANCE_STATUS_LABELS[status] || status
    }));
  }, [rows]);

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
        <div className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <CalendarDays size={18} />
              <span>Xodimlarning kirish-chiqish jadvali</span>
              <Tag>{filteredRows.length} ta</Tag>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Input.Search
                placeholder="Xodim qidirish"
                allowClear
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select
                placeholder="Status"
                allowClear
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusOptions}
              />
              <Select
                value={presenceFilter}
                onChange={setPresenceFilter}
                options={[
                  { value: 'all', label: 'Hammasi' },
                  { value: 'inside', label: 'Ichkarida' },
                  { value: 'entered', label: 'Kirganlar' },
                  { value: 'exited', label: 'Chiqqanlar' },
                  { value: 'incomplete', label: "To'liq emas" }
                ]}
              />
            </div>
          </div>
        </div>
      )}
      rowKey="id"
      columns={columns}
      dataSource={filteredRows}
      scroll={{ x: 1050 }}
      pagination={{ pageSize: 20, showSizeChanger: true }}
      locale={{ emptyText: <Empty description="Davomat ma'lumoti topilmadi" /> }}
      onRow={(row) => ({
        onClick: () => onRowClick(row)
      })}
    />
  );
}
