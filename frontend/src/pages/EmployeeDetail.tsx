import { Avatar, Button, Empty, Result, Spin, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  Monitor,
  UserCircle2,
  type LucideIcon
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import apiService, {
  BACKEND_ORIGIN,
  type AttendanceEvent,
  type ComputerActivity,
  type EmployeeTimelineComputerActivity
} from '@/services/api';
import { DateRangeFilter, useDateRange, type DateRangePreset } from '@/components/filters/DateRangeFilter';
import { useState } from 'react';
import { getTodayISO, formatDateTime, formatDisplayDate } from '@/utils/date';
import { secondsToHuman } from '@/utils/time';

const buildPhotoUrl = (raw?: string | null): string | undefined => {
  if (!raw) return undefined;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${BACKEND_ORIGIN}${raw}`;
};

const eventColumns: ColumnsType<AttendanceEvent> = [
  {
    title: 'Sana va vaqt',
    dataIndex: 'event_timestamp',
    render: (value: string) => formatDateTime(value)
  },
  {
    title: 'Eshik',
    dataIndex: ['door', 'name']
  },
  {
    title: 'Tur',
    dataIndex: ['door', 'event_type'],
    render: (value: string) => (
      <Tag color={value === 'entry' ? 'blue' : 'orange'}>
        {value === 'entry' ? 'Kirish' : 'Chiqish'}
      </Tag>
    )
  },
  {
    title: 'Holat',
    dataIndex: 'status',
    render: (value?: string | null) => value || '-'
  }
];

const activityColumns: ColumnsType<ComputerActivity> = [
  {
    title: 'Dastur',
    dataIndex: 'app_name',
    render: (value: string) => <span className="font-medium">{value}</span>
  },
  {
    title: 'Oyna',
    dataIndex: 'window_title',
    ellipsis: true,
    render: (value?: string | null) => value || '-'
  },
  {
    title: 'Boshlanish',
    dataIndex: 'started_at',
    render: (value: string) => formatDateTime(value)
  },
  {
    title: 'Vaqt',
    dataIndex: 'duration_seconds',
    render: (value: number) => secondsToHuman(value)
  }
];

const timelineActivityColumns: ColumnsType<EmployeeTimelineComputerActivity> = [
  {
    title: 'Dastur',
    dataIndex: 'app_name'
  },
  {
    title: 'Vaqt',
    dataIndex: 'duration_seconds',
    render: (value: number) => secondsToHuman(value)
  },
  {
    title: 'Kategoriya',
    dataIndex: 'category',
    render: (value: string) => <Tag>{value}</Tag>
  }
];

const EmployeeDetail = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const [rangePreset, setRangePreset] = useState<DateRangePreset>('month');
  const { from: dateFrom, to: dateTo } = useDateRange(rangePreset);
  const today = getTodayISO();

  const employeeQuery = useQuery({
    queryKey: ['employee-detail', employeeId],
    queryFn: () => apiService.getEmployee(employeeId || ''),
    enabled: Boolean(employeeId)
  });

  const eventsQuery = useQuery({
    queryKey: ['employee-detail-events', employeeId, dateFrom, dateTo],
    queryFn: () =>
      apiService.listAttendanceEvents({
        page: 1,
        limit: 200,
        employee_id: employeeId,
        date_from: dateFrom,
        date_to: dateTo,
        sort: 'event_timestamp',
        order: 'desc'
      }),
    enabled: Boolean(employeeId)
  });

  const activityQuery = useQuery({
    queryKey: ['employee-detail-computer-activity', employeeId, dateFrom, dateTo],
    queryFn: () =>
      apiService.listComputerActivity({
        page: 1,
        limit: 200,
        employee_id: employeeId,
        date_from: dateFrom,
        date_to: dateTo
      }),
    enabled: Boolean(employeeId)
  });

  const timelineQuery = useQuery({
    queryKey: ['employee-detail-timeline', employeeId, today],
    queryFn: () => apiService.getEmployeeTimeline({ employee_id: employeeId || '', date: today }),
    enabled: Boolean(employeeId)
  });

  if (!employeeId) {
    return <Result status="404" title="Xodim topilmadi" />;
  }

  if (employeeQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin />
      </div>
    );
  }

  const employee = employeeQuery.data;
  if (!employee) {
    return <Result status="404" title="Xodim topilmadi" />;
  }

  const events = eventsQuery.data?.data ?? [];
  const activities = activityQuery.data?.data ?? [];
  const timeline = timelineQuery.data;
  const lateEvents = events.filter((event) => event.status === 'late');
  const totalComputerSeconds = activities.reduce(
    (sum, activity) => sum + activity.duration_seconds,
    0
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex max-w-none flex-col gap-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/employees')}>
            Xodimlar
          </Button>
          <DateRangeFilter value={rangePreset} onChange={setRangePreset} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Avatar
                size={84}
                src={buildPhotoUrl(employee.photo_url)}
                icon={<UserCircle2 size={48} />}
                style={!employee.photo_url ? { backgroundColor: '#3B82F6' } : undefined}
              />
              <div>
                <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
                  {employee.full_name}
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {employee.employee_code ? <Tag>#{employee.employee_code}</Tag> : null}
                  <Tag color={employee.is_active ? 'green' : 'red'}>
                    {employee.is_active ? 'Aktiv' : 'Noaktiv'}
                  </Tag>
                  <Tag color="blue">{employee.department?.name}</Tag>
                  <Tag color="green">{employee.position?.name}</Tag>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric icon={CalendarDays} label="Eventlar" value={events.length} />
              <Metric icon={Clock3} label="Kechikish" value={lateEvents.length} />
              <Metric icon={Monitor} label="Kompyuter" value={secondsToHuman(totalComputerSeconds)} />
              <Metric icon={BriefcaseBusiness} label="Bugun" value={timeline?.summary?.first_entry || '-'} />
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950">
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">
              Bugungi holat
            </h3>
            <div className="mt-4 grid gap-3">
              <Info label="Kelgan" value={timeline?.summary?.first_entry || '-'} />
              <Info label="Ketgan" value={timeline?.summary?.last_exit || '-'} />
              <Info label="Ish vaqti" value={secondsToHuman(timeline?.summary?.work_seconds)} />
              <Info label="Kompyuter vaqti" value={secondsToHuman(timeline?.summary?.computer_seconds)} />
            </div>
            <div className="mt-5">
              <Table
                rowKey="id"
                size="small"
                columns={timelineActivityColumns}
                dataSource={timeline?.computer_activity ?? []}
                pagination={false}
                locale={{ emptyText: <Empty description="Bugun activity yo'q" /> }}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                Davomat hodisalari
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {formatDisplayDate(dateFrom)} - {formatDisplayDate(dateTo)}
              </p>
            </div>
            <Table
              rowKey="id"
              columns={eventColumns}
              dataSource={events}
              loading={eventsQuery.isFetching}
              pagination={{ pageSize: 8 }}
              locale={{ emptyText: <Empty description="Eventlar topilmadi" /> }}
            />
          </section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">
              Kompyuter faoliyati
            </h3>
          </div>
          <Table
            rowKey="id"
            columns={activityColumns}
            dataSource={activities}
            loading={activityQuery.isFetching}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description="Kompyuter activity topilmadi" /> }}
          />
        </section>
      </div>
    </div>
  );
};

type MetricProps = {
  icon: LucideIcon;
  label: string;
  value: string | number;
};

function Metric({ icon: Icon, label, value }: MetricProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      <Icon size={16} className="text-slate-500" />
      <div className="mt-2 text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="font-medium text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

export default EmployeeDetail;
