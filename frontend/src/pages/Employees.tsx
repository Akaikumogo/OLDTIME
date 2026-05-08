import { useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tag,
  Tooltip,
  Upload,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  AlertTriangle,
  Camera,
  Edit,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiService, { BACKEND_ORIGIN, type Employee } from '@/services/api';
import { formatDisplayDate } from '@/utils/date';
import { canWrite } from '@/utils/can';

type EmployeeFormValues = {
  full_name: string;
  employee_code?: string;
  department_id: string;
  position_id: string;
  is_active: boolean;
};

const buildPhotoUrl = (raw?: string | null): string | undefined => {
  if (!raw) return undefined;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${BACKEND_ORIGIN}${raw}`;
};

const Employees = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>();
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(true);
  const [showAutoImportedOnly, setShowAutoImportedOnly] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [photoFile, setPhotoFile] = useState<UploadFile | null>(null);
  const [form] = Form.useForm<EmployeeFormValues>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const writable = canWrite();

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.listDepartments()
  });

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: () => apiService.listPositions()
  });

  const autoImportedDeptId = useMemo(
    () =>
      departments?.find((d) => d.name.toLowerCase() === 'auto imported')?.id ??
      undefined,
    [departments]
  );

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'employees',
      page,
      limit,
      departmentFilter,
      activeFilter,
      showAutoImportedOnly ? autoImportedDeptId : null
    ],
    queryFn: () =>
      apiService.listEmployees({
        page,
        limit,
        department_id:
          showAutoImportedOnly && autoImportedDeptId
            ? autoImportedDeptId
            : departmentFilter,
        is_active: activeFilter,
        sort: 'created_at',
        order: 'desc'
      })
  });

  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    if (!search.trim()) return data.data;
    const lower = search.toLowerCase();
    return data.data.filter(
      (emp) =>
        emp.full_name.toLowerCase().includes(lower) ||
        (emp.employee_code ?? '').toLowerCase().includes(lower)
    );
  }, [data?.data, search]);

  const autoImportedCount = useMemo(() => {
    if (!data?.data) return 0;
    return data.data.filter(
      (e) => (e.department?.name ?? '').toLowerCase() === 'auto imported'
    ).length;
  }, [data?.data]);

  const uploadPhotoIfNeeded = async (employeeId: string) => {
    if (!photoFile?.originFileObj) return;
    try {
      await apiService.uploadEmployeePhoto(
        employeeId,
        photoFile.originFileObj as File
      );
    } catch {
      message.warning('Rasm yuklanmadi (xodim saqlandi)');
    }
  };

  const createMutation = useMutation({
    mutationFn: async (values: EmployeeFormValues) => {
      const created = await apiService.createEmployee({
        full_name: values.full_name,
        employee_code: values.employee_code?.trim() || null,
        department_id: values.department_id,
        position_id: values.position_id,
        is_active: values.is_active ?? true
      });
      await uploadPhotoIfNeeded(created.id);
      return created;
    },
    onSuccess: () => {
      message.success("Xodim muvaffaqiyatli qo'shildi");
      handleModalClose();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values
    }: {
      id: string;
      values: EmployeeFormValues;
    }) => {
      const updated = await apiService.updateEmployee(id, {
        full_name: values.full_name,
        employee_code: values.employee_code?.trim() || null,
        department_id: values.department_id,
        position_id: values.position_id,
        is_active: values.is_active
      });
      await uploadPhotoIfNeeded(id);
      return updated;
    },
    onSuccess: () => {
      message.success('Xodim yangilandi');
      handleModalClose();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteEmployee(id),
    onSuccess: () => {
      message.success('Xodim deaktiv qilindi');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    }
  });

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingEmployee) {
        updateMutation.mutate({ id: editingEmployee.id, values });
      } else {
        createMutation.mutate(values);
      }
    } catch {
      // validation handled by antd
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setPhotoFile(null);
    form.setFieldsValue({
      full_name: employee.full_name,
      employee_code: employee.employee_code ?? '',
      department_id: employee.department?.id,
      position_id: employee.position?.id,
      is_active: employee.is_active
    });
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    setPhotoFile(null);
    form.resetFields();
  };

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setPhotoFile(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true });
    setIsModalOpen(true);
  };

  const columns: ColumnsType<Employee> = [
    {
      title: '#',
      width: 56,
      render: (_, __, index) => (page - 1) * limit + index + 1
    },
    {
      title: 'Rasm',
      key: 'photo',
      width: 70,
      render: (_, record) => {
        const url = buildPhotoUrl(record.photo_url);
        return (
          <Avatar
            size={42}
            src={url}
            icon={<UserCircle2 size={28} />}
            style={!url ? { backgroundColor: '#3B82F6' } : undefined}
          />
        );
      }
    },
    {
      title: 'Ism Familiya',
      dataIndex: 'full_name',
      sorter: (a, b) => a.full_name.localeCompare(b.full_name),
      render: (name: string, record) => (
        <button
          type="button"
          onClick={() => navigate(`/employees/${record.id}`)}
          className="block text-left"
        >
          <div className="font-medium text-slate-900 hover:text-blue-600 dark:text-white">
            {name}
          </div>
          {record.employee_code ? (
            <div className="text-xs text-slate-500">#{record.employee_code}</div>
          ) : null}
        </button>
      )
    },
    {
      title: "Bo'lim",
      dataIndex: ['department', 'name'],
      render: (name: string) => {
        const isAuto = (name ?? '').toLowerCase() === 'auto imported';
        return (
          <Tag color={isAuto ? 'orange' : 'blue'}>
            {isAuto ? (
              <span className="inline-flex items-center gap-1">
                <AlertTriangle size={12} /> {name}
              </span>
            ) : (
              name
            )}
          </Tag>
        );
      }
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
      width: 130,
      render: (date: string) => formatDisplayDate(date)
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <div className="flex gap-1">
          <Tooltip title="Profil">
            <Button
              type="text"
              size="small"
              icon={<UserCircle2 size={16} />}
              onClick={() => navigate(`/employees/${record.id}`)}
            />
          </Tooltip>
          {writable ? (
            <>
              <Tooltip title="Tahrirlash">
                <Button
                  type="text"
                  size="small"
                  icon={<Edit size={16} />}
                  onClick={() => handleEdit(record)}
                />
              </Tooltip>
              <Popconfirm
                title="Xodimni deaktiv qilmoqchimisiz?"
                description="Ma'lumotlar saqlanib qoladi, faqat is_active=false bo'ladi."
                onConfirm={() => deleteMutation.mutate(record.id)}
                okText="Ha"
                cancelText="Yo'q"
              >
                <Tooltip title="Deaktiv qilish">
                  <Button type="text" size="small" danger icon={<Trash2 size={16} />} />
                </Tooltip>
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
            Xodimlar
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Xodimlar ro'yxati, profil rasmlari va tabel raqamlari
          </p>
          {autoImportedCount > 0 && !showAutoImportedOnly ? (
            <button
              onClick={() => setShowAutoImportedOnly(true)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300"
            >
              <AlertTriangle size={12} />
              {autoImportedCount} ta avtomatik import qilingan xodim — tartibga
              keltirish kerak
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Ism yoki tabel raqami..."
            prefix={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="Bo'lim"
            style={{ width: 180 }}
            value={departmentFilter}
            onChange={setDepartmentFilter}
            allowClear
            options={departments?.map((d) => ({ value: d.id, label: d.name })) ?? []}
          />
          <Select
            style={{ width: 130 }}
            value={activeFilter}
            onChange={setActiveFilter}
            allowClear
            placeholder="Holati"
            options={[
              { value: true, label: 'Aktiv' },
              { value: false, label: 'Noaktiv' }
            ]}
          />
          {showAutoImportedOnly ? (
            <Button
              type="dashed"
              danger
              onClick={() => setShowAutoImportedOnly(false)}
            >
              Auto-import filtrini olib tashlash
            </Button>
          ) : null}
          <Button
            icon={<RefreshCw size={16} />}
            loading={isFetching}
            onClick={() => void refetch()}
          >
            Yangilash
          </Button>
          {writable ? (
            <Button type="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
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
          scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description="Xodimlar topilmadi" /> }}
          onRow={(record) => ({
            onDoubleClick: () => navigate(`/employees/${record.id}`)
          })}
        />
      </motion.div>

      <Modal
        title={editingEmployee ? 'Xodimni tahrirlash' : "Xodim qo'shish"}
        open={isModalOpen}
        onCancel={handleModalClose}
        width={560}
        footer={[
          <Button key="cancel" onClick={handleModalClose}>
            Bekor qilish
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={handleSubmit}
          >
            {editingEmployee ? 'Yangilash' : 'Saqlash'}
          </Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <div className="mb-5 flex items-center gap-4">
            <Avatar
              size={84}
              src={
                photoFile?.originFileObj
                  ? URL.createObjectURL(photoFile.originFileObj as File)
                  : buildPhotoUrl(editingEmployee?.photo_url)
              }
              icon={<UserCircle2 size={48} />}
              style={
                !photoFile && !editingEmployee?.photo_url
                  ? { backgroundColor: '#3B82F6' }
                  : undefined
              }
            />
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                if (file.size > 5 * 1024 * 1024) {
                  message.error('Fayl 5MB dan katta bo\'lmasligi kerak');
                  return Upload.LIST_IGNORE;
                }
                setPhotoFile({
                  uid: file.uid ?? `${Date.now()}`,
                  name: file.name,
                  originFileObj: file
                } as UploadFile);
                return false;
              }}
            >
              <Button icon={<Camera size={14} />}>Rasm yuklash</Button>
            </Upload>
            {photoFile ? (
              <Button type="text" danger onClick={() => setPhotoFile(null)}>
                Bekor qilish
              </Button>
            ) : null}
          </div>

          <Form.Item
            name="full_name"
            label="Ism Familiya"
            rules={[{ required: true, message: 'Ism Familiyani kiriting' }]}
          >
            <Input placeholder="Ali Valiyev" />
          </Form.Item>

          <Form.Item
            name="employee_code"
            label="Tabel raqami / Karta ID"
            tooltip="Hikvision karta raqami yoki kompaniya tabel raqami. Unique."
          >
            <Input placeholder="12345" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="department_id"
              label="Bo'lim"
              rules={[{ required: true, message: "Bo'limni tanlang" }]}
            >
              <Select
                placeholder="Bo'limni tanlang"
                showSearch
                optionFilterProp="label"
                options={
                  departments?.map((d) => ({ value: d.id, label: d.name })) ?? []
                }
              />
            </Form.Item>

            <Form.Item
              name="position_id"
              label="Lavozim"
              rules={[{ required: true, message: 'Lavozimni tanlang' }]}
            >
              <Select
                placeholder="Lavozimni tanlang"
                showSearch
                optionFilterProp="label"
                options={
                  positions?.map((p) => ({ value: p.id, label: p.name })) ?? []
                }
              />
            </Form.Item>
          </div>

          <Form.Item
            name="is_active"
            label="Aktiv"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Employees;
