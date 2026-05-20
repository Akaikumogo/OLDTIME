import { useState } from 'react';
import { Button, Empty, Form, Input, Modal, Popconfirm, Select, Switch, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Camera as CameraIcon, Edit, Plus, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import apiService, {
  type Camera,
  type CameraInput,
  type CameraStatus,
  type Room,
  type Zone
} from '@/services/api';
import { CameraStatusBadge } from '@/components/camera/CameraStatusBadge';
import { canWrite } from '@/utils/can';

type CameraFormValues = CameraInput;

const Cameras = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [form] = Form.useForm<CameraFormValues>();
  const queryClient = useQueryClient();
  const writable = canWrite();

  const camerasQuery = useQuery({
    queryKey: ['cameras', page, limit],
    queryFn: () => apiService.listCameras({ page, limit })
  });

  const zonesQuery = useQuery({
    queryKey: ['zones-for-cameras'],
    queryFn: () => apiService.listZones()
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms-for-cameras'],
    queryFn: () => apiService.listRooms()
  });

  const createMutation = useMutation({
    mutationFn: (values: CameraFormValues) => apiService.createCamera(values),
    onSuccess: () => {
      message.success('Kamera qo\'shildi');
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<CameraFormValues> }) =>
      apiService.updateCamera(id, values),
    onSuccess: () => {
      message.success('Kamera yangilandi');
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteCamera(id),
    onSuccess: () => {
      message.success('Kamera o\'chirildi');
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
    }
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => apiService.testCamera(id),
    onSuccess: (result) => {
      message.info(result.message);
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
    }
  });

  const openCreate = () => {
    setEditingCamera(null);
    form.setFieldsValue({
      has_audio: true,
      has_speaker: false,
      status: 'unknown'
    });
    setIsModalOpen(true);
  };

  const openEdit = (camera: Camera) => {
    setEditingCamera(camera);
    form.setFieldsValue({
      name: camera.name,
      ip: camera.ip,
      username: camera.username,
      rtsp_main_url: camera.rtsp_main_url,
      rtsp_sub_url: camera.rtsp_sub_url,
      isapi_base_url: camera.isapi_base_url,
      zone_id: camera.zone_id,
      room_id: camera.room_id,
      has_audio: camera.has_audio,
      has_speaker: camera.has_speaker,
      status: camera.status
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCamera(null);
    form.resetFields();
  };

  const save = async () => {
    const values = await form.validateFields();
    if (editingCamera) {
      const payload = { ...values };
      if (!payload.password) delete payload.password;
      updateMutation.mutate({ id: editingCamera.id, values: payload });
      return;
    }
    createMutation.mutate(values);
  };

  const columns: ColumnsType<Camera> = [
    {
      title: 'Kamera',
      dataIndex: 'name',
      fixed: 'left',
      render: (name: string, camera) => (
        <div>
          <span className="font-medium text-slate-900 dark:text-white">{name}</span>
          <p className="text-xs text-slate-500">{camera.ip}</p>
        </div>
      )
    },
    {
      title: 'Zone',
      dataIndex: 'zone_name',
      width: 170,
      render: (_name: string, camera) => (
        <div className="flex flex-col gap-1">
          <span>{camera.zone_name}</span>
          <Tag>{camera.zone_type}</Tag>
        </div>
      )
    },
    {
      title: 'Room',
      dataIndex: 'room_name',
      width: 150,
      render: (name?: string | null) => name || '-'
    },
    {
      title: 'Audio',
      width: 120,
      render: (_, camera) => (
        <div className="flex flex-wrap gap-1">
          {camera.has_audio ? <Tag color="blue">Listen</Tag> : null}
          {camera.has_speaker ? <Tag color="green">Speaker</Tag> : null}
          {!camera.has_audio && !camera.has_speaker ? '-' : null}
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (status: CameraStatus) => <CameraStatusBadge status={status} />
    },
    {
      title: 'RTSP',
      dataIndex: 'rtsp_main_url',
      width: 280,
      ellipsis: true,
      render: (value: string) => <span className="font-mono text-xs">{value}</span>
    },
    {
      title: 'Amallar',
      width: 170,
      fixed: 'right',
      render: (_, camera) => (
        <div className="flex gap-2">
          <Button
            type="text"
            size="small"
            icon={<Wifi size={16} />}
            loading={testMutation.isPending}
            onClick={() => testMutation.mutate(camera.id)}
          />
          {writable ? (
            <>
              <Button
                type="text"
                size="small"
                icon={<Edit size={16} />}
                onClick={() => openEdit(camera)}
              />
              <Popconfirm
                title="Kamera o'chirilsinmi?"
                okText="Ha"
                cancelText="Yo'q"
                onConfirm={() => deleteMutation.mutate(camera.id)}
              >
                <Button type="text" size="small" danger icon={<Trash2 size={16} />} />
              </Popconfirm>
            </>
          ) : null}
        </div>
      )
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            Cameras
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Button
            icon={<RefreshCw size={16} />}
            loading={camerasQuery.isFetching}
            onClick={() => void camerasQuery.refetch()}
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
          dataSource={camerasQuery.data?.data ?? []}
          loading={camerasQuery.isLoading}
          scroll={{ x: 1350 }}
          pagination={{
            current: page,
            pageSize: limit,
            total: camerasQuery.data?.meta.total ?? 0,
            showSizeChanger: true,
            onChange: (newPage, newLimit) => {
              setPage(newPage);
              setLimit(newLimit);
            }
          }}
          locale={{ emptyText: <Empty description="Kamera topilmadi" /> }}
        />
      </motion.div>

      <Modal
        title={editingCamera ? 'Kamera tahrirlash' : 'Kamera qo\'shish'}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={() => void save()}
        width={720}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="name" label="Nomi" rules={[{ required: true }]}>
              <Input prefix={<CameraIcon size={15} />} />
            </Form.Item>
            <Form.Item name="ip" label="IP" rules={[{ required: true }]}>
              <Input placeholder="192.168.30.52" />
            </Form.Item>
            <Form.Item name="username" label="Username" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="password"
              label={editingCamera ? 'Password' : 'Password *'}
              rules={editingCamera ? [] : [{ required: true }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </div>
          <Form.Item name="rtsp_main_url" label="RTSP main" rules={[{ required: true }]}>
            <Input placeholder="rtsp://192.168.30.52:554/Streaming/Channels/101" />
          </Form.Item>
          <Form.Item name="rtsp_sub_url" label="RTSP sub">
            <Input placeholder="rtsp://192.168.30.52:554/Streaming/Channels/102" />
          </Form.Item>
          <Form.Item name="isapi_base_url" label="ISAPI base">
            <Input placeholder="http://192.168.30.52" />
          </Form.Item>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="zone_id" label="Zone" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={(zonesQuery.data ?? []).map((zone: Zone) => ({
                  value: zone.id,
                  label: `${zone.name} (${zone.type})`
                }))}
              />
            </Form.Item>
            <Form.Item name="room_id" label="Room">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={(roomsQuery.data ?? []).map((room: Room) => ({
                  value: room.id,
                  label: room.name
                }))}
              />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select
                options={(['unknown', 'online', 'offline', 'error', 'testing'] as CameraStatus[]).map(
                  (status) => ({ value: status, label: status })
                )}
              />
            </Form.Item>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="has_audio" label="Audio listen" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="has_speaker" label="Speaker talkback" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Cameras;
