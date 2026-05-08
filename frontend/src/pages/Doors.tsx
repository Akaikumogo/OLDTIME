import { useState } from 'react';
import { Button, Empty, Form, Input, Modal, Table, Tag, Select, message, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Plus, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import type { Door } from '@/services/api';
import { formatDisplayDate } from '@/utils/date';
import { canWrite } from '@/utils/can';

const Doors = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoor, setEditingDoor] = useState<Door | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const writable = canWrite();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['doors', page, limit],
    queryFn: () =>
      apiService.listDoors({
        page,
        limit
      })
  });

  const createMutation = useMutation({
    mutationFn: (values: any) =>
      apiService.createDoor(values),
    onSuccess: () => {
      message.success('Eshik muvaffaqiyatli qo\'shildi');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['doors'] });
    },
    onError: () => {
      message.error('Eshik qo\'shishda xatolik yuz berdi');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      apiService.updateDoor(id, values),
    onSuccess: () => {
      message.success('Eshik muvaffaqiyatli yangilandi');
      setIsModalOpen(false);
      setEditingDoor(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['doors'] });
    },
    onError: () => {
      message.error('Eshik yangilashda xatolik yuz berdi');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiService.deleteDoor(id),
    onSuccess: () => {
      message.success('Eshik muvaffaqiyatli o\'chirildi');
      queryClient.invalidateQueries({ queryKey: ['doors'] });
    },
    onError: () => {
      message.error('Eshik o\'chirishda xatolik yuz berdi');
    }
  });

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      createMutation.mutate(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      if (editingDoor) {
        updateMutation.mutate({ id: editingDoor.id, values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleEdit = (door: Door) => {
    setEditingDoor(door);
    form.setFieldsValue({
      name: door.name,
      ip_address: door.ip_address,
      event_type: door.event_type,
      is_active: door.is_active
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingDoor(null);
    form.resetFields();
  };

  const columns: ColumnsType<Door> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      render: (id: string) => <span className="font-mono text-xs">{id.slice(0, 8)}...</span>
    },
    {
      title: 'Nomi',
      dataIndex: 'name',
      sorter: true
    },
    {
      title: 'IP manzil',
      dataIndex: 'ip_address',
      width: 150
    },
    {
      title: 'Turi',
      dataIndex: 'event_type',
      width: 100
    },
    {
      title: 'Holat',
      dataIndex: 'connection_status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          online: 'green',
          offline: 'red',
          unknown: 'gray'
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: 'Aktiv',
      dataIndex: 'is_active',
      width: 80,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Ha' : 'Yo\'q'}
        </Tag>
      )
    },
    {
      title: 'Yaratilgan',
      dataIndex: 'created_at',
      width: 120,
      render: (date: string) => formatDisplayDate(date)
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 120,
      render: (_, record: Door) => (
        <div className="flex gap-2">
          {writable ? (
            <>
              <Button
                type="text"
                size="small"
                icon={<Edit size={16} />}
                onClick={() => handleEdit(record)}
              />
              <Popconfirm
                title="Eshikni o'chirmoqchimisiz?"
                onConfirm={() => handleDelete(record.id)}
                okText="Ha"
                cancelText="Yo'q"
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<Trash2 size={16} />}
                />
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
            Eshiklar
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kirish nazorat eshiklari
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            icon={<RefreshCw size={16} />}
            loading={isLoading}
            onClick={() => void refetch()}
          >
            Yangilash
          </Button>
          {writable ? (
            <Button type="primary" icon={<Plus size={16} />} onClick={() => setIsModalOpen(true)}>
              Qo'shish
            </Button>
          ) : null}
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
          scroll={{ x: 1000 }}
          locale={{ emptyText: <Empty description="Eshiklar topilmadi" /> }}
        />
      </motion.div>

      <Modal
        title={editingDoor ? "Eshikni tahrirlash" : "Eshik qo'shish"}
        open={isModalOpen}
        onCancel={handleModalClose}
        footer={[
          <Button key="cancel" onClick={handleModalClose}>
            Bekor qilish
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={editingDoor ? handleUpdate : handleCreate}
          >
            {editingDoor ? "Yangilash" : "Saqlash"}
          </Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Nomi"
            rules={[{ required: true, message: 'Nomini kiriting' }]}
          >
            <Input placeholder="Eshik nomi" />
          </Form.Item>
          <Form.Item
            name="ip_address"
            label="IP manzil"
            rules={[{ required: true, message: 'IP manzilini kiriting' }]}
          >
            <Input placeholder="192.168.1.1" />
          </Form.Item>
          <Form.Item
            name="event_type"
            label="Turi"
            rules={[{ required: true, message: 'Turini tanlang' }]}
          >
            <Select>
              <Select.Option value="entry">Kirish</Select.Option>
              <Select.Option value="exit">Chiqish</Select.Option>
              <Select.Option value="both">Ikkalasi ham</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="Aktiv" initialValue={true}>
            <Select>
              <Select.Option value={true}>Ha</Select.Option>
              <Select.Option value={false}>Yo'q</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Doors;
