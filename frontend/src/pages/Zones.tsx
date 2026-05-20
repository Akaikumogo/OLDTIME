import { useState } from 'react';
import { Button, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Edit, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import apiService, { type Zone, type ZoneInput, type ZoneType } from '@/services/api';
import { canWrite } from '@/utils/can';

const zoneTypes: ZoneType[] = [
  'WORK_ROOM',
  'CORRIDOR',
  'REST_ZONE',
  'MEETING_ROOM',
  'ENTRANCE',
  'EXIT',
  'UNKNOWN'
];

const zoneColors: Record<ZoneType, string> = {
  WORK_ROOM: 'green',
  CORRIDOR: 'blue',
  REST_ZONE: 'orange',
  MEETING_ROOM: 'purple',
  ENTRANCE: 'cyan',
  EXIT: 'red',
  UNKNOWN: 'default'
};

const Zones = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [form] = Form.useForm<ZoneInput>();
  const queryClient = useQueryClient();
  const writable = canWrite();

  const zonesQuery = useQuery({
    queryKey: ['zones'],
    queryFn: () => apiService.listZones()
  });

  const createMutation = useMutation({
    mutationFn: (values: ZoneInput) => apiService.createZone(values),
    onSuccess: () => {
      message.success('Zone qo\'shildi');
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ['zones'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<ZoneInput> }) =>
      apiService.updateZone(id, values),
    onSuccess: () => {
      message.success('Zone yangilandi');
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ['zones'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteZone(id),
    onSuccess: () => {
      message.success('Zone o\'chirildi');
      void queryClient.invalidateQueries({ queryKey: ['zones'] });
    }
  });

  const openCreate = () => {
    setEditingZone(null);
    form.setFieldsValue({
      type: 'UNKNOWN',
      productivity_weight: 0,
      timeout_seconds: 0
    });
    setIsModalOpen(true);
  };

  const openEdit = (zone: Zone) => {
    setEditingZone(zone);
    form.setFieldsValue({
      name: zone.name,
      type: zone.type,
      productivity_weight: zone.productivity_weight,
      timeout_seconds: zone.timeout_seconds
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingZone(null);
    form.resetFields();
  };

  const save = async () => {
    const values = await form.validateFields();
    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, values });
      return;
    }
    createMutation.mutate(values);
  };

  const columns: ColumnsType<Zone> = [
    {
      title: 'Zone',
      dataIndex: 'name',
      render: (name: string) => (
        <span className="font-medium text-slate-900 dark:text-white">{name}</span>
      )
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 160,
      render: (type: ZoneType) => <Tag color={zoneColors[type]}>{type}</Tag>
    },
    {
      title: 'Weight',
      dataIndex: 'productivity_weight',
      width: 120
    },
    {
      title: 'Timeout',
      dataIndex: 'timeout_seconds',
      width: 130,
      render: (value: number) => `${value}s`
    },
    {
      title: 'Cameras',
      dataIndex: 'camera_count',
      width: 110
    },
    {
      title: 'Amallar',
      width: 120,
      render: (_, zone) =>
        writable ? (
          <div className="flex gap-2">
            <Button
              type="text"
              size="small"
              icon={<Edit size={16} />}
              onClick={() => openEdit(zone)}
            />
            <Popconfirm
              title="Zone o'chirilsinmi?"
              okText="Ha"
              cancelText="Yo'q"
              onConfirm={() => deleteMutation.mutate(zone.id)}
            >
              <Button type="text" size="small" danger icon={<Trash2 size={16} />} />
            </Popconfirm>
          </div>
        ) : null
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            Zones
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Button
            icon={<RefreshCw size={16} />}
            loading={zonesQuery.isFetching}
            onClick={() => void zonesQuery.refetch()}
          >
            Yangilash
          </Button>
          {writable ? (
            <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>
              Qo'shish
            </Button>
          ) : null}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={zonesQuery.data ?? []}
          loading={zonesQuery.isLoading}
          locale={{ emptyText: <Empty description="Zone topilmadi" /> }}
        />
      </motion.div>

      <Modal
        title={editingZone ? 'Zone tahrirlash' : 'Zone qo\'shish'}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={() => void save()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Nomi" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={zoneTypes.map((type) => ({ value: type, label: type }))} />
          </Form.Item>
          <Form.Item name="productivity_weight" label="Productivity weight">
            <InputNumber className="w-full" min={-10} max={10} step={0.1} />
          </Form.Item>
          <Form.Item name="timeout_seconds" label="Timeout seconds">
            <InputNumber className="w-full" min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Zones;
