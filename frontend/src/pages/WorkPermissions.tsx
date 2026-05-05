import { useState } from 'react';
import { Button, Empty, Table, Tag, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { DateFilter } from '@/components/filters/DateFilter';
import { formatDisplayDate } from '@/utils/date';

const WorkPermissions = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['work-permissions', page, limit, dateFrom, dateTo, status],
    queryFn: () =>
      apiService.listWorkPermissions({
        page,
        limit,
        date_from: dateFrom,
        date_to: dateTo,
        status
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
      dataIndex: 'permission_date',
      width: 120,
      render: (date: string) => formatDisplayDate(date)
    },
    {
      title: 'Boshlash',
      dataIndex: 'start_time',
      width: 100
    },
    {
      title: 'Tugash',
      dataIndex: 'end_time',
      width: 100
    },
    {
      title: 'Turi',
      dataIndex: 'permission_type',
      width: 100,
      render: (type: string) => <Tag color="blue">{type}</Tag>
    },
    {
      title: 'Holat',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          pending: 'gold',
          approved: 'green',
          rejected: 'red'
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: 'Sabab',
      dataIndex: 'reason',
      ellipsis: true
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            Ish ruxsatlari
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ish vaqtida ruxsatlar ro'yxati
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
          <Select
            placeholder="Holat"
            allowClear
            style={{ width: 120 }}
            onChange={setStatus}
            options={[
              { value: 'pending', label: 'Kutilmoqda' },
              { value: 'approved', label: 'Tasdiqlangan' },
              { value: 'rejected', label: 'Rad etilgan' }
            ]}
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
          locale={{ emptyText: <Empty description="Ruxsatlar topilmadi" /> }}
        />
      </motion.div>
    </div>
  );
};

export default WorkPermissions;
