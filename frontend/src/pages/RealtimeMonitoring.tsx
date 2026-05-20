import { useEffect, useState } from 'react';
import { Button, Empty, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Eye, EyeOff, RefreshCw, Radio } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import apiService, { type EmployeeLiveLocation } from '@/services/api';
import { CameraStatusBadge } from '@/components/camera/CameraStatusBadge';
import { EmployeeLiveLocationPanel } from '@/components/camera/EmployeeLiveLocationPanel';
import { formatDateTime } from '@/utils/date';

const RealtimeMonitoring = () => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const statesQuery = useQuery({
    queryKey: ['employee-location-states'],
    queryFn: () => apiService.listEmployeeLocationStates({ page: 1, limit: 200 }),
    refetchInterval: 10_000
  });

  useEffect(() => {
    const socket = new WebSocket(apiService.getEmployeeLocationWebSocketUrl());
    socket.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: ['employee-location-states'] });
    };
    return () => socket.close();
  }, [queryClient]);

  const columns: ColumnsType<EmployeeLiveLocation> = [
    {
      title: 'Xodim',
      dataIndex: ['employee', 'full_name'],
      fixed: 'left',
      render: (name: string, row) => (
        <button
          type="button"
          className="text-left font-semibold text-slate-900 hover:text-blue-600 dark:text-white"
          onClick={() => setSelectedEmployeeId(row.employee_id)}
        >
          {name}
        </button>
      )
    },
    {
      title: 'Holat',
      width: 130,
      render: (_, row) => (
        <Tag
          icon={row.is_visible ? <Eye size={13} /> : <EyeOff size={13} />}
          color={row.inferred ? 'orange' : row.is_visible ? 'green' : 'red'}
        >
          {row.inferred ? 'Inferred' : row.is_visible ? 'Visible' : 'Not visible'}
        </Tag>
      )
    },
    {
      title: 'Active camera',
      render: (_, row) => (
        <div className="flex flex-col gap-1">
          <span>{row.active_camera?.name || '-'}</span>
          {row.active_camera ? <CameraStatusBadge status={row.active_camera.status} /> : null}
        </div>
      )
    },
    {
      title: 'Zone',
      render: (_, row) => row.active_zone?.name || '-'
    },
    {
      title: 'Room',
      render: (_, row) => row.active_room?.name || row.assigned_room?.name || '-'
    },
    {
      title: 'Confidence',
      width: 120,
      render: (_, row) =>
        typeof row.confidence === 'number' ? `${Math.round(row.confidence * 100)}%` : '-'
    },
    {
      title: 'Last seen',
      dataIndex: 'last_seen_at',
      width: 180,
      render: (value?: string | null) => (value ? formatDateTime(value) : '-')
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radio size={22} className="text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
              Realtime monitoring
            </h2>
          </div>
        </div>
        <Button
          icon={<RefreshCw size={16} />}
          loading={statesQuery.isFetching}
          onClick={() => void statesQuery.refetch()}
        >
          Yangilash
        </Button>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Table
          rowKey="employee_id"
          columns={columns}
          dataSource={statesQuery.data ?? []}
          loading={statesQuery.isLoading}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description="Realtime state topilmadi" /> }}
          onRow={(row) => ({
            onClick: () => setSelectedEmployeeId(row.employee_id)
          })}
        />
      </motion.div>

      <EmployeeLiveLocationPanel
        employeeId={selectedEmployeeId}
        open={Boolean(selectedEmployeeId)}
        onClose={() => setSelectedEmployeeId(null)}
      />
    </div>
  );
};

export default RealtimeMonitoring;
