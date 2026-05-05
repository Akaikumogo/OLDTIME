import { useState } from 'react';
import { Button, Empty, Form, Input, Modal, Table, Tag, Select, message, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Plus, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import type { Computer } from '@/services/api';
import { formatDisplayDate } from '@/utils/date';

const Computers = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComputer, setEditingComputer] = useState<Computer | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['computers', page, limit],
    queryFn: () =>
      apiService.listComputers({
        page,
        limit
      })
  });

  const createMutation = useMutation({
    mutationFn: (values: any) =>
      apiService.createComputer(values),
    onSuccess: () => {
      message.success('Kompyuter muvaffaqiyatli qo\'shildi');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['computers'] });
    },
    onError: () => {
      message.error('Kompyuter qo\'shishda xatolik yuz berdi');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      apiService.updateComputer(id, values),
    onSuccess: () => {
      message.success('Kompyuter muvaffaqiyatli yangilandi');
      setIsModalOpen(false);
      setEditingComputer(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['computers'] });
    },
    onError: () => {
      message.error('Kompyuter yangilashda xatolik yuz berdi');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiService.deleteComputer(id),
    onSuccess: () => {
      message.success('Kompyuter muvaffaqiyatli o\'chirildi');
      queryClient.invalidateQueries({ queryKey: ['computers'] });
    },
    onError: () => {
      message.error('Kompyuter o\'chirishda xatolik yuz berdi');
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
      if (editingComputer) {
        updateMutation.mutate({ id: editingComputer.id, values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleEdit = (computer: Computer) => {
    setEditingComputer(computer);
    form.setFieldsValue({
      hostname: computer.hostname,
      ip_address: computer.ip_address,
      mac_address: computer.mac_address,
      is_active: true
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingComputer(null);
    form.resetFields();
  };

  const columns: ColumnsType<Computer> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      render: (id: string) => <span className="font-mono text-xs">{id.slice(0, 8)}...</span>
    },
    {
      title: 'Nomi',
      dataIndex: 'hostname',
      sorter: true
    },
    {
      title: 'IP manzil',
      dataIndex: 'ip_address',
      width: 150
    },
    {
      title: 'MAC manzil',
      dataIndex: 'mac_address',
      width: 150
    },
    {
      title: 'Holat',
      dataIndex: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Aktiv' : 'Noaktiv'}
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
      render: (_, record: Computer) => (
        <div className="flex gap-2">
          <Button
            type="text"
            size="small"
            icon={<Edit size={16} />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Kompyuterni o'chirmoqchimisiz?"
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
            Kompyuterlar
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kompyuterlar ro'yxati va boshqaruv
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
          locale={{ emptyText: <Empty description="Kompyuterlar topilmadi" /> }}
        />
      </motion.div>

      <Modal
        title={editingComputer ? "Kompyuterni tahrirlash" : "Kompyuter qo'shish"}
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
            onClick={editingComputer ? handleUpdate : handleCreate}
          >
            {editingComputer ? "Yangilash" : "Saqlash"}
          </Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="hostname"
            label="Nomi"
            rules={[{ required: true, message: 'Nomini kiriting' }]}
          >
            <Input placeholder="Kompyuter nomi" />
          </Form.Item>
          <Form.Item name="ip_address" label="IP manzil">
            <Input placeholder="192.168.1.1" />
          </Form.Item>
          <Form.Item name="mac_address" label="MAC manzil">
            <Input placeholder="00:1A:2B:3C:4D:5E" />
          </Form.Item>
          <Form.Item name="is_active" label="Holati" initialValue={true}>
            <Select>
              <Select.Option value={true}>Aktiv</Select.Option>
              <Select.Option value={false}>Noaktiv</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Computers;
