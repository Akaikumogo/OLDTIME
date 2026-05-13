import { useState, useEffect } from 'react';
import { Alert, Button, Empty, Result, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Clock3,
  LogIn,
  LogOut,
  Monitor,
  RefreshCw,
  Users
} from 'lucide-react';
import { motion } from 'motion/react';
import { DashboardChart } from '@/components/dashboard/DashboardChart';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { DailyAttendanceTable } from '@/components/dashboard/DailyAttendanceTable';
import { EmployeeTimelineDrawer } from '@/components/dashboard/EmployeeTimelineDrawer';
import { StatCard } from '@/components/dashboard/StatCard';
import { TopAppsCard } from '@/components/dashboard/TopAppsCard';
import { DateRangeFilter, useDateRange, type DateRangePreset } from '@/components/filters/DateRangeFilter';
import type { DashboardDailyRow } from '@/features/dashboard/types';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEmployeeTimeline } from '@/hooks/useEmployeeTimeline';
import { formatDisplayDate } from '@/utils/date';
import { secondsToHuman } from '@/utils/time';

type LateOccurrence = {
  id: string;
  employeeName: string;
  date: string;
  time: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Dashboard maʼlumotlarini yuklashda xato yuz berdi';
}

const Home = () => {
  const [selectedRow, setSelectedRow] = useState<DashboardDailyRow | null>(null);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('today');
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { from: dateFrom, to: dateTo } = useDateRange(dateRangePreset);
  const dashboard = useDashboardData(dateFrom, dateTo, debouncedSearch || undefined);
  const timeline = useEmployeeTimeline(selectedRow?.employee.id ?? null, dateFrom);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(attendanceSearch), 400);
    return () => clearTimeout(timer);
  }, [attendanceSearch]);

  const data = dashboard.data;
  const lateOccurrences: LateOccurrence[] =
    data?.dailyRows
      .filter((row) => row.statuses.includes('late'))
      .map((row) => {
        const lateMarker = row.markers.find((marker) => marker.status === 'late');
        return {
          id: `${row.employee.id}-${row.date}-${lateMarker?.full_time || row.first_entry_full || row.first_entry || ''}`,
          employeeName: row.employee.full_name,
          date: row.date,
          time: lateMarker?.time || row.first_entry || '-'
        };
      }) ?? [];

  const lateColumns: ColumnsType<LateOccurrence> = [
    {
      title: 'Xodim',
      dataIndex: 'employeeName',
      render: (name: string) => (
        <span className="font-medium text-slate-900 dark:text-white">{name}</span>
      )
    },
    {
      title: 'Sana',
      dataIndex: 'date',
      width: 140,
      render: (date: string) => formatDisplayDate(date)
    },
    {
      title: 'Kelgan vaqti',
      dataIndex: 'time',
      width: 140
    },
    {
      title: 'Holat',
      width: 110,
      render: () => <Tag color="red">Kechikdi</Tag>
    }
  ];
  const isEmpty =
    !dashboard.isLoading &&
    !dashboard.error &&
    (!data || (data.dailyRows.length === 0 && data.employees.length === 0));

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-300">
            {formatDisplayDate(dateFrom)} {dateFrom !== dateTo ? `- ${formatDisplayDate(dateTo)}` : ''}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
            Davomat va ish faolligi analitikasi
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Kelganlar, kechikkanlar, ketganlar va kompyuter faolligi real API
            maʼlumotlari asosida.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DateRangeFilter value={dateRangePreset} onChange={setDateRangePreset} />
          <Button
            icon={<RefreshCw size={16} />}
            loading={dashboard.isFetching}
            onClick={() => void dashboard.refetch()}
          >
            Yangilash
          </Button>
        </div>
      </div>

      {dashboard.isLoading ? (
        <DashboardSkeleton />
      ) : dashboard.error ? (
        <Result
          status="warning"
          title="Dashboard yuklanmadi"
          subTitle={getErrorMessage(dashboard.error)}
          extra={
            <Button type="primary" onClick={() => void dashboard.refetch()}>
              Qayta urinish
            </Button>
          }
        />
      ) : isEmpty ? (
        <Empty description="Dashboard uchun maʼlumot topilmadi" />
      ) : data ? (
        <motion.div
          className="space-y-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
        >
          {dashboard.error ? (
            <Alert
              type="error"
              showIcon
              message="API xato"
              description={getErrorMessage(dashboard.error)}
            />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard
              icon={Users}
              label="Aktiv xodimlar"
              value={data.stats.activeEmployees}
              hint="/employees"
              tone="bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200"
            />
            <StatCard
              icon={LogIn}
              label="Bugun kelganlar"
              value={data.stats.arrivedEmployees}
              hint="/attendance-events/daily"
              tone="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
            />
            <StatCard
              icon={Clock3}
              label="Kechikkanlar"
              value={data.stats.lateEmployees}
              hint="statuses ichida late"
              tone="bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-200"
            />
            <StatCard
              icon={LogOut}
              label="Ketganlar"
              value={data.stats.leftEmployees}
              hint="last_exit mavjud"
              tone="bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <StatCard
              icon={Monitor}
              label="Kompyuter vaqti"
              value={secondsToHuman(data.stats.totalComputerSeconds)}
              hint={`${data.stats.onlineComputers} online kompyuter`}
              tone="bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <DashboardChart data={data.attendanceChart} />
            <TopAppsCard apps={data.topApps} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                  Kechikkanlar
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Tanlangan davrda har bir kechikish alohida qator.
                </p>
              </div>
              <Tag color={lateOccurrences.length ? 'red' : 'green'}>
                {lateOccurrences.length} ta
              </Tag>
            </div>
            <Table
              rowKey="id"
              size="middle"
              columns={lateColumns}
              dataSource={lateOccurrences}
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              locale={{
                emptyText: (
                  <div className="flex min-h-[180px] items-center justify-center">
                    <Empty description="Bu davrda kechikish topilmadi" />
                  </div>
                )
              }}
            />
          </div>

          <DailyAttendanceTable
            rows={data.dailyRows}
            onRowClick={(row) => setSelectedRow(row)}
            search={attendanceSearch}
            onSearchChange={setAttendanceSearch}
            loading={dashboard.isFetching}
          />
        </motion.div>
      ) : null}

      <EmployeeTimelineDrawer
        open={Boolean(selectedRow)}
        date={dateFrom}
        row={selectedRow}
        timeline={timeline.data ?? null}
        loading={timeline.isFetching}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
};

export default Home;
