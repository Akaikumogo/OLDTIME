import { useState } from 'react';
import { Button, Empty, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { DateFilter } from '@/components/filters/DateFilter';
import { formatDateTime } from '@/utils/date';

const ComputerActivity = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['computer-activity', page, limit, dateFrom, dateTo],
    queryFn: () =>
      apiService.listComputerActivity({
        page,
        limit,
        date_from: dateFrom,
        date_to: dateTo
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
      title: 'Kompyuter',
      dataIndex: ['computer', 'name'],
      render: (name: string) => name || '-'
    },
    {
      title: 'Xodim',
      dataIndex: ['employee', 'full_name'],
      render: (name: string) => name || '-'
    },
    {
      title: 'Dastur',
      dataIndex: 'app_name',
      width: 150,
      ellipsis: true
    },
    {
      title: 'Oyna',
      dataIndex: 'window_title',
      width: 200,
      ellipsis: true
    },
    {
      title: 'URL',
      dataIndex: 'url',
      width: 150,
      ellipsis: true,
      render: (url: string | null) => url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          {url}
        </a>
      ) : '-'
    },
    {
      title: 'Boshlash',
      dataIndex: 'started_at',
      width: 160,
      render: (date: string) => formatDateTime(date)
    },
    {
      title: 'Tugash',
      dataIndex: 'ended_at',
      width: 160,
      render: (date: string) => formatDateTime(date)
    },
    {
      title: 'Davomiylik',
      dataIndex: 'duration_seconds',
      width: 100,
      render: (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${mins}m`;
      }
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            Kompyuter faoliyati
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kompyuter dasturlaridan foydalanish tarixi
          </p>
        </div>

        <div className="flex items-center gap-3">
          <DateFilter
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="Dan"
            allowClear
          />
          <DateFilter
            value={dateTo}
            onChange={setDateTo}
            placeholder="Gacha"
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
          scroll={{ x: 1200 }}
          locale={{ emptyText: <Empty description="Faoliyat topilmadi" /> }}
        />
      </motion.div>
    </div>
  );
};

export default ComputerActivity;
