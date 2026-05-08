import { useState } from 'react';
import { Button, Empty, Form, Input, Modal, Table, Tag, Select, message, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Plus, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import type { Computer, Employee } from '@/services/api';
import { formatDateTime, formatDisplayDate } from '@/utils/date';
import { canWrite } from '@/utils/can';

type ComputerFormValues = {
  device_id?: string | null;
  hostname: string;
  ip_address?: string | null;
  mac_address: string;
  os_name?: string | null;
  agent_version?: string | null;
  employee_id?: string | null;
  is_active: boolean;
};

const connectionColor: Record<string, string> = {
  online: 'green',
  offline: 'red',
  unknown: 'default'
};

const Computers = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComputer, setEditingComputer] = useState<Computer | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const writable = canWrite();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['computers', page, limit],
    queryFn: () =>
      apiService.listComputers({
        page,
        limit
      })
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-for-computers'],
    queryFn: () =>
      apiService.listEmployees({
        page: 1,
        limit: 100,
        is_active: true,
        sort: 'name',
        order: 'asc'
      })
  });

  const createMutation = useMutation({
    mutationFn: (values: ComputerFormValues) => apiService.createComputer(values),
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
    mutationFn: ({ id, values }: { id: string; values: Partial<ComputerFormValues> }) =>
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
      device_id: computer.device_id,
      hostname: computer.hostname,
      ip_address: computer.ip_address,
      mac_address: computer.mac_address,
      os_name: computer.os_name,
      agent_version: computer.agent_version,
      employee_id: computer.employee?.id ?? null,
      is_active: computer.is_active
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
      title: 'Device ID',
      dataIndex: 'device_id',
      width: 120,
      render: (id: string | null) => id ? <span className="font-mono text-xs">{id.slice(0, 12)}...</span> : '-'
    },
    {
      title: 'Nomi',
      dataIndex: 'hostname',
      sorter: true
    },
    {
      title: 'Xodim',
      dataIndex: ['employee', 'full_name'],
      width: 180,
      render: (name: string | undefined) => name || '-'
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
      title: 'OS',
      dataIndex: 'os_name',
      width: 150,
      ellipsis: true,
      render: (value: string | null) => value || '-'
    },
    {
      title: 'Agent',
      dataIndex: 'agent_version',
      width: 100,
      render: (value: string | null) => value || '-'
    },
    {
      title: 'Ulanish',
      dataIndex: 'connection_status',
      width: 110,
      render: (status: string = 'unknown') => (
        <Tag color={connectionColor[status] ?? 'default'}>
          {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Noma\'lum'}
        </Tag>
      )
    },
    {
      title: 'Aktiv',
      dataIndex: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Aktiv' : 'Noaktiv'}
        </Tag>
      )
    },
    {
      title: 'Oxirgi signal',
      dataIndex: 'last_seen_at',
      width: 170,
      render: (date: string | null) => date ? formatDateTime(date) : '-'
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
          {writable ? (
            <>
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
          scroll={{ x: 1420 }}
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
          <Form.Item name="device_id" label="Device ID">
            <Input placeholder="Agent avtomatik yaratadi" />
          </Form.Item>
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
          <Form.Item
            name="mac_address"
            label="MAC manzil"
            rules={[{ required: true, message: 'MAC manzilni kiriting' }]}
          >
            <Input placeholder="00:1A:2B:3C:4D:5E" />
          </Form.Item>
          <Form.Item name="employee_id" label="Xodim">
            <Select
              allowClear
              showSearch
              placeholder="Xodimni tanlang"
              optionFilterProp="label"
              options={
                employees?.data.map((employee: Employee) => ({
                  value: employee.id,
                  label: `${employee.full_name}${employee.employee_code ? ` (#${employee.employee_code})` : ''}`
                })) ?? []
              }
            />
          </Form.Item>
          <Form.Item name="os_name" label="Operatsion tizim">
            <Input placeholder="Windows 11 / macOS 15" />
          </Form.Item>
          <Form.Item name="agent_version" label="Agent versiyasi">
            <Input placeholder="1.0.0" />
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
