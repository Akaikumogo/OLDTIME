import { useState } from 'react';
import { Button, Empty, Form, Input, Modal, Table, message, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Plus, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import type { Position } from '@/services/api';
import { formatDisplayDate } from '@/utils/date';

const Positions = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['positions'],
    queryFn: () => apiService.listPositions()
  });

  const createMutation = useMutation({
    mutationFn: (values: any) =>
      apiService.createPosition(values),
    onSuccess: () => {
      message.success('Lavozim muvaffaqiyatli qo\'shildi');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
    onError: () => {
      message.error('Lavozim qo\'shishda xatolik yuz berdi');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      apiService.updatePosition(id, values),
    onSuccess: () => {
      message.success('Lavozim muvaffaqiyatli yangilandi');
      setIsModalOpen(false);
      setEditingPosition(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
    onError: () => {
      message.error('Lavozim yangilashda xatolik yuz berdi');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiService.deletePosition(id),
    onSuccess: () => {
      message.success('Lavozim muvaffaqiyatli o\'chirildi');
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
    onError: () => {
      message.error('Lavozim o\'chirishda xatolik yuz berdi');
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
      if (editingPosition) {
        updateMutation.mutate({ id: editingPosition.id, values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleEdit = (position: Position) => {
    setEditingPosition(position);
    form.setFieldsValue({
      name: position.name
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingPosition(null);
    form.resetFields();
  };

  const columns: ColumnsType<Position> = [
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
      title: 'Yaratilgan',
      dataIndex: 'created_at',
      width: 120,
      render: (date: string) => formatDisplayDate(date)
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 120,
      render: (_, record: Position) => (
        <div className="flex gap-2">
          <Button
            type="text"
            size="small"
            icon={<Edit size={16} />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Lavozimni o'chirmoqchimisiz?"
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
        </div>
      )
    }
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            Lavozimlar
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Lavozimlar ro'yxati va boshqaruv
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
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setIsModalOpen(true)}>
            Qo'shish
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
          dataSource={data ?? []}
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 600 }}
          locale={{ emptyText: <Empty description="Lavozimlar topilmadi" /> }}
        />
      </motion.div>

      <Modal
        title={editingPosition ? "Lavozimni tahrirlash" : "Lavozim qo'shish"}
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
            onClick={editingPosition ? handleUpdate : handleCreate}
          >
            {editingPosition ? "Yangilash" : "Saqlash"}
          </Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Nomi"
            rules={[{ required: true, message: 'Nomini kiriting' }]}
          >
            <Input placeholder="Lavozim nomi" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Positions;
