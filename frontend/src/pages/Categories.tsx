import { useState } from 'react';
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Switch,
  Table,
  Tag,
  Tooltip,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Edit, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiService, {
  type CategoryRule,
  type CategoryRuleInput,
  type CategoryScope
} from '@/services/api';

const CATEGORY_COLORS: Record<string, string> = {
  productive: 'green',
  unproductive: 'red',
  neutral: 'default'
};

const CATEGORY_LABELS: Record<string, string> = {
  productive: 'Samarali',
  unproductive: 'Samarasiz',
  neutral: 'Neytral'
};

const PATTERN_TYPE_LABELS: Record<string, string> = {
  exact: 'Aynan',
  contains: "Ichida bor",
  regex: 'Regex'
};

const Categories = () => {
  const [scope, setScope] = useState<CategoryScope>('app');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRule | null>(null);
  const [form] = Form.useForm<CategoryRuleInput>();
  const queryClient = useQueryClient();

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiService.listDepartments()
  });

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['category-rules', scope, categoryFilter],
    queryFn: () =>
      apiService.listCategoryRules(scope, {
        category: categoryFilter as 'productive' | 'unproductive' | 'neutral' | undefined
      })
  });

  const createMutation = useMutation({
    mutationFn: (body: CategoryRuleInput) =>
      apiService.createCategoryRule(scope, body),
    onSuccess: () => {
      message.success("Qoida qo'shildi");
      handleClose();
      queryClient.invalidateQueries({ queryKey: ['category-rules'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<CategoryRuleInput> }) =>
      apiService.updateCategoryRule(scope, id, body),
    onSuccess: () => {
      message.success('Qoida yangilandi');
      handleClose();
      queryClient.invalidateQueries({ queryKey: ['category-rules'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteCategoryRule(scope, id),
    onSuccess: () => {
      message.success("Qoida o'chirildi");
      queryClient.invalidateQueries({ queryKey: ['category-rules'] });
    }
  });

  const handleClose = () => {
    setIsModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handleEdit = (rule: CategoryRule) => {
    setEditing(rule);
    form.setFieldsValue({
      pattern: rule.pattern,
      pattern_type: rule.pattern_type,
      category: rule.category,
      department_id: rule.department_id,
      label: rule.label,
      priority: rule.priority,
      is_active: rule.is_active
    });
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      pattern_type: 'contains',
      category: 'productive',
      priority: 100,
      is_active: true
    });
    setIsModalOpen(true);
  };

  const columns: ColumnsType<CategoryRule> = [
    {
      title: 'Pattern',
      dataIndex: 'pattern',
      render: (text: string, record) => (
        <div>
          <div className="font-medium">{text}</div>
          <Tag color="default" style={{ fontSize: 11 }}>
            {PATTERN_TYPE_LABELS[record.pattern_type] || record.pattern_type}
          </Tag>
        </div>
      )
    },
    {
      title: 'Kategoriya',
      dataIndex: 'category',
      width: 130,
      render: (cat: string) => (
        <Tag color={CATEGORY_COLORS[cat]}>{CATEGORY_LABELS[cat] || cat}</Tag>
      )
    },
    {
      title: 'Belgi',
      dataIndex: 'label',
      render: (label: string | null) => (label ? <Tag>{label}</Tag> : '-')
    },
    {
      title: "Bo'lim",
      dataIndex: 'department_id',
      width: 160,
      render: (id: string | null) => {
        if (!id) return <Tag color="blue">Global</Tag>;
        const dept = departments?.find((d) => d.id === id);
        return <Tag color="purple">{dept?.name ?? id}</Tag>;
      }
    },
    {
      title: 'Prioritet',
      dataIndex: 'priority',
      width: 100,
      sorter: (a, b) => a.priority - b.priority
    },
    {
      title: 'Aktiv',
      dataIndex: 'is_active',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? 'Ha' : "Yo'q"}</Tag>
      )
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <div className="flex gap-1">
          <Tooltip title="Tahrirlash">
            <Button
              type="text"
              size="small"
              icon={<Edit size={16} />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Qoidani o'chirmoqchimisiz?"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button type="text" size="small" danger icon={<Trash2 size={16} />} />
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
            Kategoriyalar
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Dasturlar va saytlarni samarali / samarasiz / neytral kategoriyalarga
            ajratish. Department'ga maxsus qoidalar globaldan ustun.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={scope}
            onChange={(v) => setScope(v as CategoryScope)}
            options={[
              { value: 'app', label: 'Dasturlar' },
              { value: 'site', label: 'Saytlar' }
            ]}
          />
          <Select
            placeholder="Kategoriya"
            style={{ width: 160 }}
            allowClear
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={Object.entries(CATEGORY_LABELS).map(([v, l]) => ({
              value: v,
              label: l
            }))}
          />
          <Button
            icon={<RefreshCw size={16} />}
            loading={isFetching}
            onClick={() => void refetch()}
          >
            Yangilash
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
            Yangi qoida
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
          pagination={{ pageSize: 25 }}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description="Qoida yo'q" /> }}
        />
      </motion.div>

      <Modal
        title={editing ? 'Qoidani tahrirlash' : 'Yangi qoida'}
        open={isModalOpen}
        onCancel={handleClose}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="pattern"
            label="Pattern (dastur nomi yoki domen)"
            rules={[{ required: true, message: 'Pattern kiriting' }]}
            tooltip="Misol: 'vscode', 'youtube.com', 'figma'"
          >
            <Input placeholder="vscode yoki youtube.com" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="pattern_type"
              label="Mos kelish turi"
              rules={[{ required: true }]}
            >
              <Select
                options={Object.entries(PATTERN_TYPE_LABELS).map(([v, l]) => ({
                  value: v,
                  label: l
                }))}
              />
            </Form.Item>
            <Form.Item
              name="category"
              label="Kategoriya"
              rules={[{ required: true }]}
            >
              <Select
                options={Object.entries(CATEGORY_LABELS).map(([v, l]) => ({
                  value: v,
                  label: l
                }))}
              />
            </Form.Item>
          </div>

          <Form.Item name="label" label="Belgi (ixtiyoriy)" tooltip="Masalan: IDE, Office, Social">
            <Input placeholder="IDE" />
          </Form.Item>

          <Form.Item
            name="department_id"
            label="Bo'lim (bo'sh = global)"
            tooltip="Department'ga maxsus qoida globaldan ustun ishlaydi"
          >
            <Select
              allowClear
              placeholder="Hammaga (global)"
              options={departments?.map((d) => ({ value: d.id, label: d.name })) ?? []}
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="priority"
              label="Prioritet"
              tooltip="Past raqam = yuqori prioritet"
            >
              <InputNumber min={0} max={10000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="is_active" label="Aktiv" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Categories;
