import { useState } from 'react';
import { Button, Empty, Form, Input, Modal, Table, Tag, Select, message, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Plus, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import type { AuthUser } from '@/services/api';
import { formatDisplayDate } from '@/utils/date';

const Admins = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AuthUser | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admins', page, limit],
    queryFn: () =>
      apiService.listAdmins({
        page,
        limit
      })
  });

  const createMutation = useMutation({
    mutationFn: (values: any) =>
      apiService.createAdmin(values),
    onSuccess: () => {
      message.success('Admin muvaffaqiyatli qo\'shildi');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: () => {
      message.error('Admin qo\'shishda xatolik yuz berdi');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      apiService.updateAdmin(id, values),
    onSuccess: () => {
      message.success('Admin muvaffaqiyatli yangilandi');
      setIsModalOpen(false);
      setEditingAdmin(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: () => {
      message.error('Admin yangilashda xatolik yuz berdi');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiService.deleteAdmin(id),
    onSuccess: () => {
      message.success('Admin muvaffaqiyatli o\'chirildi');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: () => {
      message.error('Admin o\'chirishda xatolik yuz berdi');
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
      if (editingAdmin) {
        updateMutation.mutate({ id: editingAdmin.id, values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleEdit = (admin: AuthUser) => {
    setEditingAdmin(admin);
    form.setFieldsValue({
      full_name: admin.full_name,
      email: admin.email,
      role: admin.role,
      is_active: admin.is_active
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingAdmin(null);
    form.resetFields();
  };

  const columns: ColumnsType<AuthUser> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      render: (id: string) => <span className="font-mono text-xs">{id.slice(0, 8)}...</span>
    },
    {
      title: 'Ism',
      dataIndex: 'full_name',
      sorter: true
    },
    {
      title: 'Email',
      dataIndex: 'email',
      width: 200
    },
    {
      title: 'Rol',
      dataIndex: 'role',
      width: 100,
      render: (role: string) => {
        const colorMap: Record<string, string> = {
          admin: 'purple',
          hr: 'blue',
          manager: 'green'
        };
        return <Tag color={colorMap[role] || 'default'}>{role}</Tag>;
      }
    },
    {
      title: 'Holat',
      dataIndex: 'is_active',
      width: 80,
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
      render: (_, record: AuthUser) => (
        <div className="flex gap-2">
          <Button
            type="text"
            size="small"
            icon={<Edit size={16} />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Adminni o'chirmoqchimisiz?"
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
            Adminlar
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Adminlar ro'yxati va boshqaruv
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
            total: data?.meta.total_items ?? 0,
            showSizeChanger: true,
            onChange: (newPage, newLimit) => {
              setPage(newPage);
              setLimit(newLimit);
            }
          }}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description="Adminlar topilmadi" /> }}
        />
      </motion.div>

      <Modal
        title={editingAdmin ? "Adminni tahrirlash" : "Admin qo'shish"}
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
            onClick={editingAdmin ? handleUpdate : handleCreate}
          >
            {editingAdmin ? "Yangilash" : "Saqlash"}
          </Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="full_name"
            label="Ism"
            rules={[{ required: true, message: 'Ismni kiriting' }]}
          >
            <Input placeholder="Ism Familiya" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: 'Emailni kiriting' }]}
          >
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Parol"
            rules={[{ required: !editingAdmin, message: 'Parolni kiriting' }]}
          >
            <Input.Password placeholder="Parol" />
          </Form.Item>
          <Form.Item
            name="role"
            label="Rol"
            rules={[{ required: true, message: 'Rolni tanlang' }]}
          >
            <Select>
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="hr">HR</Select.Option>
              <Select.Option value="manager">Manager</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="Aktiv" initialValue={true}>
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

export default Admins;
