import { useState } from 'react';
import { Button, Empty, Form, Input, Modal, Popconfirm, Select, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Edit, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import apiService, {
  type Camera,
  type Department,
  type Room,
  type RoomInput
} from '@/services/api';
import { canWrite } from '@/utils/can';

type RoomFormValues = {
  name: string;
  department_id?: string | null;
  floor?: string | null;
  description?: string | null;
  camera_ids?: string[];
  primary_camera_id?: string | null;
};

const Rooms = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([]);
  const [form] = Form.useForm<RoomFormValues>();
  const queryClient = useQueryClient();
  const writable = canWrite();

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: () => apiService.listRooms()
  });

  const camerasQuery = useQuery({
    queryKey: ['cameras-for-rooms'],
    queryFn: () => apiService.listCameras({ page: 1, limit: 200 })
  });

  const departmentsQuery = useQuery({
    queryKey: ['departments-for-rooms'],
    queryFn: () => apiService.listDepartments()
  });

  const createMutation = useMutation({
    mutationFn: (values: RoomInput) => apiService.createRoom(values),
    onSuccess: () => {
      message.success('Xona qo\'shildi');
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<RoomInput> }) =>
      apiService.updateRoom(id, values),
    onSuccess: () => {
      message.success('Xona yangilandi');
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteRoom(id),
    onSuccess: () => {
      message.success('Xona o\'chirildi');
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }
  });

  const openCreate = () => {
    setEditingRoom(null);
    setSelectedCameraIds([]);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEdit = (room: Room) => {
    const ids = room.cameras.map((camera) => camera.id);
    setEditingRoom(room);
    setSelectedCameraIds(ids);
    form.setFieldsValue({
      name: room.name,
      department_id: room.department_id,
      floor: room.floor,
      description: room.description,
      camera_ids: ids,
      primary_camera_id: room.cameras.find((camera) => camera.is_primary)?.id ?? ids[0]
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
    setSelectedCameraIds([]);
    form.resetFields();
  };

  const buildPayload = (values: RoomFormValues): RoomInput => {
    const cameraIds = values.camera_ids ?? [];
    const primaryId = values.primary_camera_id || cameraIds[0];
    return {
      name: values.name,
      department_id: values.department_id || null,
      floor: values.floor || null,
      description: values.description || null,
      cameras: cameraIds.map((cameraId) => ({
        camera_id: cameraId,
        is_primary: cameraId === primaryId
      }))
    };
  };

  const save = async () => {
    const values = await form.validateFields();
    const payload = buildPayload(values);
    if (editingRoom) {
      updateMutation.mutate({ id: editingRoom.id, values: payload });
      return;
    }
    createMutation.mutate(payload);
  };

  const columns: ColumnsType<Room> = [
    {
      title: 'Xona',
      dataIndex: 'name',
      render: (name: string, room) => (
        <div>
          <span className="font-medium text-slate-900 dark:text-white">{name}</span>
          <p className="text-xs text-slate-500">{room.floor || '-'}</p>
        </div>
      )
    },
    {
      title: 'Department',
      dataIndex: 'department_name',
      width: 180,
      render: (value?: string | null) => value || '-'
    },
    {
      title: 'Cameras',
      dataIndex: 'cameras',
      render: (cameras: Room['cameras']) => (
        <div className="flex flex-wrap gap-1">
          {cameras.length ? (
            cameras.map((camera) => (
              <Tag key={camera.id} color={camera.is_primary ? 'green' : 'default'}>
                {camera.name}
              </Tag>
            ))
          ) : (
            <span>-</span>
          )}
        </div>
      )
    },
    {
      title: 'Amallar',
      width: 120,
      render: (_, room) =>
        writable ? (
          <div className="flex gap-2">
            <Button
              type="text"
              size="small"
              icon={<Edit size={16} />}
              onClick={() => openEdit(room)}
            />
            <Popconfirm
              title="Xona o'chirilsinmi?"
              okText="Ha"
              cancelText="Yo'q"
              onConfirm={() => deleteMutation.mutate(room.id)}
            >
              <Button type="text" size="small" danger icon={<Trash2 size={16} />} />
            </Popconfirm>
          </div>
        ) : null
    }
  ];

  const cameras = camerasQuery.data?.data ?? [];
  const primaryOptions = cameras
    .filter((camera) => selectedCameraIds.includes(camera.id))
    .map((camera: Camera) => ({ value: camera.id, label: camera.name }));

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            Rooms
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Button
            icon={<RefreshCw size={16} />}
            loading={roomsQuery.isFetching}
            onClick={() => void roomsQuery.refetch()}
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
          dataSource={roomsQuery.data ?? []}
          loading={roomsQuery.isLoading}
          locale={{ emptyText: <Empty description="Xona topilmadi" /> }}
        />
      </motion.div>

      <Modal
        title={editingRoom ? 'Xona tahrirlash' : 'Xona qo\'shish'}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={() => void save()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={720}
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(_, values: RoomFormValues) => {
            const ids = values.camera_ids ?? [];
            setSelectedCameraIds(ids);
            const primary = values.primary_camera_id;
            if (primary && !ids.includes(primary)) {
              form.setFieldValue('primary_camera_id', ids[0] ?? null);
            }
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="name" label="Nomi" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="floor" label="Qavat">
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="department_id" label="Department">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={(departmentsQuery.data ?? []).map((department: Department) => ({
                value: department.id,
                label: department.name
              }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Izoh">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="camera_ids" label="Cameras">
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={cameras.map((camera: Camera) => ({
                value: camera.id,
                label: `${camera.name} (${camera.zone_name})`
              }))}
            />
          </Form.Item>
          <Form.Item name="primary_camera_id" label="Primary camera">
            <Select allowClear options={primaryOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Rooms;
