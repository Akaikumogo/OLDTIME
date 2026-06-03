import { useState } from 'react';
import { Button, Drawer, Empty, Select, Spin, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UserX } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiService, { type Camera, type Employee, type UnknownDetectionItem } from '@/services/api';
import { formatDateTime } from '@/utils/date';

const baseColumns: ColumnsType<UnknownDetectionItem> = [
  {
    title: 'Kamera',
    dataIndex: 'camera_name',
    render: (name: string, row) => (
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-xs text-slate-400">{row.camera_ip}</p>
      </div>
    )
  },
  {
    title: 'Zona / Xona',
    render: (_: unknown, row) => (
      <div>
        <Tag>{row.zone_name}</Tag>
        {row.room_name ? <Tag color="blue">{row.room_name}</Tag> : null}
      </div>
    )
  },
  {
    title: 'Track ID',
    dataIndex: 'track_id',
    render: (v: string) => <span className="font-mono text-xs">{v.slice(0, 16)}</span>
  },
  {
    title: 'Tur',
    dataIndex: 'detection_type',
    render: (v: string) => <Tag>{v}</Tag>
  },
  {
    title: 'Ishonch',
    dataIndex: 'confidence',
    render: (v: number) => `${Math.round(v * 100)}%`
  },
  {
    title: 'Ko\'rilgan',
    dataIndex: 'seen_at',
    render: (v: string) => formatDateTime(v)
  },
  {
    title: 'Ketgan',
    dataIndex: 'disappeared_at',
    render: (v?: string | null) =>
      v ? formatDateTime(v) : <Tag color="red">Hali kamerada</Tag>
  },
  {
    title: 'Davomiyligi',
    dataIndex: 'duration_seconds',
    render: (v?: number | null) => (v != null ? `${v}s` : '-')
  }
];

type Props = {
  cameras: Camera[];
};

export function UnknownDetectionsPanel({ cameras }: Props) {
  const [open, setOpen] = useState(false);
  const [cameraId, setCameraId] = useState<string | undefined>();
  const [activeOnly, setActiveOnly] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['unknown-detections', cameraId, activeOnly, page],
    queryFn: () =>
      apiService.listUnknownDetections({
        camera_id: cameraId,
        active_only: activeOnly,
        page,
        limit: 50
      }),
    enabled: open,
    refetchInterval: open ? 10_000 : false
  });

  const employeesQuery = useQuery({
    queryKey: ['employees-for-unknown-links'],
    queryFn: () =>
      apiService.listEmployees({
        page: 1,
        limit: 500,
        is_active: true,
        sort: 'name',
        order: 'asc'
      }),
    enabled: open
  });

  const linkMutation = useMutation({
    mutationFn: ({ detectionId, employeeId }: { detectionId: string; employeeId: string }) =>
      apiService.linkUnknownDetectionToEmployee(detectionId, employeeId),
    onSuccess: () => {
      message.success('Noma\'lum track xodimga biriktirildi');
      void queryClient.invalidateQueries({ queryKey: ['unknown-detections'] });
      void queryClient.invalidateQueries({ queryKey: ['camera-crossing-events'] });
      void queryClient.invalidateQueries({ queryKey: ['cameras-live-unknown-detections'] });
      void queryClient.invalidateQueries({ queryKey: ['cameras-live-matched-detections'] });
    }
  });

  const total = query.data?.meta.total ?? 0;
  const data = query.data?.data ?? [];
  const employeeOptions = (employeesQuery.data?.data ?? []).map((employee: Employee) => ({
    value: employee.id,
    label: employee.full_name
  }));
  const columns: ColumnsType<UnknownDetectionItem> = [
    ...baseColumns,
    {
      title: 'Xodimga biriktirish',
      width: 260,
      render: (_, row) => (
        <Select
          showSearch
          placeholder="Employee tanlash"
          style={{ width: 230 }}
          optionFilterProp="label"
          options={employeeOptions}
          loading={employeesQuery.isFetching || linkMutation.isPending}
          onSelect={(employeeId: string) =>
            linkMutation.mutate({ detectionId: row.id, employeeId })
          }
        />
      )
    }
  ];

  return (
    <>
      <Tooltip title="Noma'lum odamlar tarixi">
        <Button
          icon={<UserX size={15} />}
          onClick={() => setOpen(true)}
          danger={false}
        >
          Begonalar
        </Button>
      </Tooltip>

      <Drawer
        title={
          <div className="flex items-center gap-2">
            <UserX size={18} className="text-red-500" />
            <span>Noma'lum odamlar — kamera tarixi</span>
          </div>
        }
        width={900}
        open={open}
        onClose={() => setOpen(false)}
        styles={{ body: { padding: 16 } }}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Select
            placeholder="Barcha kameralar"
            allowClear
            style={{ width: 200 }}
            value={cameraId}
            onChange={(v) => { setCameraId(v); setPage(1); }}
            options={cameras.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            style={{ width: 160 }}
            value={activeOnly ? 'active' : 'all'}
            onChange={(v) => { setActiveOnly(v === 'active'); setPage(1); }}
            options={[
              { value: 'all', label: 'Hammasi' },
              { value: 'active', label: 'Hali kamerada' }
            ]}
          />
        </div>

        {query.isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Spin />
          </div>
        ) : data.length === 0 ? (
          <Empty description="Noma'lum odamlar topilmadi" />
        ) : (
          <Table
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={data}
            loading={query.isFetching}
            pagination={{
              current: page,
              pageSize: 50,
              total,
              onChange: setPage,
              showTotal: (t) => `Jami: ${t}`
            }}
            scroll={{ x: 800 }}
          />
        )}
      </Drawer>
    </>
  );
}
