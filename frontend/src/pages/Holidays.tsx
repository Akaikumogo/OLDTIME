import { useState } from 'react';
import {
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tag,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { Edit, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiService, { type Holiday } from '@/services/api';

const TYPE_COLORS: Record<string, string> = {
  public: 'red',
  company: 'blue',
  weekend: 'default'
};

const TYPE_LABELS: Record<string, string> = {
  public: 'Davlat bayrami',
  company: 'Kompaniya',
  weekend: 'Dam olish kuni'
};

const Holidays = () => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => apiService.listHolidays({ year })
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiService.createHoliday(body),
    onSuccess: () => {
      message.success("Bayram qo'shildi");
      handleClose();
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      apiService.updateHoliday(id, body),
    onSuccess: () => {
      message.success('Bayram yangilandi');
      handleClose();
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteHoliday(id),
    onSuccess: () => {
      message.success("Bayram o'chirildi");
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    }
  });

  const handleClose = () => {
    setIsModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const date =
      values.holiday_date && typeof values.holiday_date.format === 'function'
        ? values.holiday_date.format('YYYY-MM-DD')
        : values.holiday_date;
    const body = {
      holiday_date: date,
      name: values.name,
      holiday_type: values.holiday_type,
      is_paid: values.is_paid ?? true
    };
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        body: { name: body.name, holiday_type: body.holiday_type, is_paid: body.is_paid }
      });
    } else {
      createMutation.mutate(body);
    }
  };

  const handleEdit = (holiday: Holiday) => {
    setEditing(holiday);
    form.setFieldsValue({
      holiday_date: dayjs(holiday.date),
      name: holiday.name,
      holiday_type: holiday.type,
      is_paid: holiday.is_paid
    });
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ holiday_type: 'public', is_paid: true });
    setIsModalOpen(true);
  };

  const columns: ColumnsType<Holiday> = [
    {
      title: 'Sana',
      dataIndex: 'date',
      width: 130,
      render: (d: string) => (
        <div>
          <div className="font-medium">{dayjs(d).format('DD.MM.YYYY')}</div>
          <div className="text-xs text-slate-500">
            {dayjs(d).format('dddd')}
          </div>
        </div>
      ),
      sorter: (a, b) => a.date.localeCompare(b.date)
    },
    {
      title: 'Nomi',
      dataIndex: 'name'
    },
    {
      title: 'Turi',
      dataIndex: 'type',
      width: 160,
      render: (t: string) => <Tag color={TYPE_COLORS[t]}>{TYPE_LABELS[t] || t}</Tag>
    },
    {
      title: "To'lanadi",
      dataIndex: 'is_paid',
      width: 110,
      render: (paid: boolean) => (
        <Tag color={paid ? 'green' : 'default'}>{paid ? 'Ha' : "Yo'q"}</Tag>
      )
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <div className="flex gap-1">
          <Button
            type="text"
            size="small"
            icon={<Edit size={16} />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Bayramni o'chirmoqchimisiz?"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button type="text" size="small" danger icon={<Trash2 size={16} />} />
          </Popconfirm>
        </div>
      )
    }
  ];

  const yearOptions = Array.from({ length: 5 }).map((_, i) => {
    const y = new Date().getFullYear() - 2 + i;
    return { value: y, label: y.toString() };
  });

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            Bayramlar va dam olish kunlari
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Bayram kunlarida kelgan event'larga maxsus "holiday" status beriladi
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={year}
            onChange={setYear}
            options={yearOptions}
            style={{ width: 110 }}
          />
          <Button
            icon={<RefreshCw size={16} />}
            loading={isFetching}
            onClick={() => void refetch()}
          >
            Yangilash
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
            Yangi bayram
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
          locale={{ emptyText: <Empty description="Bayramlar topilmadi" /> }}
        />
      </motion.div>

      <Modal
        title={editing ? 'Bayramni tahrirlash' : 'Yangi bayram'}
        open={isModalOpen}
        onCancel={handleClose}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="holiday_date"
            label="Sana"
            rules={[{ required: true, message: 'Sanani tanlang' }]}
          >
            <DatePicker
              format="DD.MM.YYYY"
              style={{ width: '100%' }}
              disabled={!!editing}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="Nomi"
            rules={[{ required: true, message: 'Nomini kiriting' }]}
          >
            <Input placeholder="Yangi yil" />
          </Form.Item>
          <Form.Item
            name="holiday_type"
            label="Turi"
            rules={[{ required: true }]}
          >
            <Select
              options={Object.entries(TYPE_LABELS).map(([v, l]) => ({
                value: v,
                label: l
              }))}
            />
          </Form.Item>
          <Form.Item name="is_paid" label="To'lanadi" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Holidays;
