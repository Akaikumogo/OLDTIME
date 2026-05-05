import { useState } from 'react';
import { Button, Empty, Form, Input, Modal, Select, Table, Tag, message, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Plus, RefreshCw, Edit, Trash2, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import type { Employee } from '@/services/api';
import { formatDisplayDate } from '@/utils/date';

const Employees = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['employees', page, limit],
    queryFn: () =>
      apiService.listEmployees({
        page,
        limit,
        sort: 'created_at',
        order: 'desc'
      })
  });

  const filteredData = data?.data.filter(emp =>
    emp.full_name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.listDepartments()
  });

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => apiService.listPositions()
  });

  const createMutation = useMutation({
    mutationFn: (values: any) =>
      apiService.createEmployee(values),
    onSuccess: () => {
      message.success('Xodim muvaffaqiyatli qo\'shildi');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: () => {
      message.error('Xodim qo\'shishda xatolik yuz berdi');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      apiService.updateEmployee(id, values),
    onSuccess: () => {
      message.success('Xodim muvaffaqiyatli yangilandi');
      setIsModalOpen(false);
      setEditingEmployee(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: () => {
      message.error('Xodim yangilashda xatolik yuz berdi');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiService.deleteEmployee(id),
    onSuccess: () => {
      message.success('Xodim muvaffaqiyatli o\'chirildi');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: () => {
      message.error('Xodim o\'chirishda xatolik yuz berdi');
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
      if (editingEmployee) {
        updateMutation.mutate({ id: editingEmployee.id, values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    form.setFieldsValue({
      full_name: employee.full_name,
      email: employee.email,
      phone_number: employee.phone_number,
      department_id: employee.department?.id,
      position_id: employee.position?.id,
      is_active: employee.is_active
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    form.resetFields();
  };

  const columns: ColumnsType<Employee> = [
    {
      title: '#',
      width: 60,
      render: (_, __, index) => (page - 1) * limit + index + 1
    },
    {
      title: 'Xodim ismi',
      dataIndex: 'full_name',
      sorter: true
    },
    {
      title: 'Bo\'lim',
      dataIndex: ['department', 'name'],
      render: (name: string) => <Tag color="blue">{name}</Tag>
    },
    {
      title: 'Lavozim',
      dataIndex: ['position', 'name'],
      render: (name: string) => <Tag color="green">{name}</Tag>
    },
    {
      title: 'Holati',
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
      render: (_, record: Employee) => (
        <div className="flex gap-2">
          <Button
            type="text"
            size="small"
            icon={<Edit size={16} />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Xodimni o'chirmoqchimisiz?"
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
            Xodimlar
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Xodimlar ro'yxati va boshqaruv
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Input
            placeholder="Xodim qidirish..."
            prefix={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => void refetch()}
            style={{ width: 200 }}
            allowClear
          />
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
          dataSource={filteredData}
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
          locale={{ emptyText: <Empty description="Xodimlar topilmadi" /> }}
        />
      </motion.div>

      <Modal
        title={editingEmployee ? "Xodimni tahrirlash" : "Xodim qo'shish"}
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
            onClick={editingEmployee ? handleUpdate : handleCreate}
          >
            {editingEmployee ? "Yangilash" : "Saqlash"}
          </Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="full_name"
            label="Xodim ismi"
            rules={[{ required: true, message: 'Xodim ismini kiriting' }]}
          >
            <Input placeholder="Ism Familiya" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="phone_number" label="Telefon raqam">
            <Input placeholder="+998 90 123 45 67" />
          </Form.Item>
          <Form.Item
            name="department_id"
            label="Bo'lim"
            rules={[{ required: true, message: 'Bo\'limni tanlang' }]}
          >
            <Select placeholder="Bo'limni tanlang">
              {departments?.map((dept: any) => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="position_id"
            label="Lavozim"
            rules={[{ required: true, message: 'Lavozimni tanlang' }]}
          >
            <Select placeholder="Lavozimni tanlang">
              {positions?.map((pos: any) => (
                <Select.Option key={pos.id} value={pos.id}>
                  {pos.name}
                </Select.Option>
              ))}
            </Select>
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

export default Employees;
