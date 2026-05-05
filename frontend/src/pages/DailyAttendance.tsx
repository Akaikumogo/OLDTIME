import { useState } from 'react';
import { Button, Empty, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { DateFilter } from '@/components/filters/DateFilter';
import { formatDisplayDate } from '@/utils/date';

const DailyAttendance = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['daily-attendance', page, limit, selectedDate],
    queryFn: () =>
      apiService.listAttendanceEvents({
        page,
        limit,
        date_from: selectedDate,
        date_to: selectedDate
      })
  });

  const columns: ColumnsType<any> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      render: (id: string) => <span className="font-mono text-xs">{id.slice(0, 8)}...</span>
    },
    {
      title: 'Xodim',
      dataIndex: ['employee', 'full_name'],
      render: (name: string) => name || '-'
    },
    {
      title: 'Bo\'lim',
      dataIndex: ['employee', 'department', 'name'],
      render: (name: string) => name || '-'
    },
    {
      title: 'Sana',
      dataIndex: 'date',
      width: 120,
      render: (date: string) => formatDisplayDate(date)
    },
    {
      title: 'Kirish',
      dataIndex: 'first_entry',
      width: 100,
      render: (time: string | null) => time || '-'
    },
    {
      title: 'Chiqish',
      dataIndex: 'last_exit',
      width: 100,
      render: (time: string | null) => time || '-'
    },
    {
      title: 'Ish vaqti',
      dataIndex: 'work_seconds',
      width: 100,
      render: (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
      }
    },
    {
      title: 'Holat',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          present: 'green',
          absent: 'red',
          late: 'orange',
          half_day: 'gold'
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      }
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            Kunlik davomat
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kunlik davomat hisoboti
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DateFilter
            value={selectedDate}
            onChange={setSelectedDate}
            placeholder="Sana"
            allowClear
          />
          <Button
            icon={<RefreshCw size={16} />}
            loading={isLoading}
            onClick={() => void refetch()}
          >
            Yangilash
          </Button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data?.data ?? []}
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: limit,
            total: data?.meta.total ?? 0,
            showSizeChanger: true,
            onChange: (newPage, newLimit) => {
              setPage(newPage);
              setLimit(newLimit);
            }
          }}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description="Davomat topilmadi" /> }}
        />
      </motion.div>
    </div>
  );
};

export default DailyAttendance;
