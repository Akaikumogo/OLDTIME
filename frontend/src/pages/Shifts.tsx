import { useState } from 'react';
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Switch,
  Table,
  Tag,
  TimePicker,
  Tooltip,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Edit, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiService, { type Shift } from '@/services/api';

const DAY_LABELS: Record<string, string> = {
  mon: 'Du',
  tue: 'Se',
  wed: 'Ch',
  thu: 'Pa',
  fri: 'Ju',
  sat: 'Sh',
  sun: 'Ya'
};

const DAY_KEYS: Array<keyof typeof DAY_LABELS> = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

type ShiftFormValues = {
  name: string;
  start_time: Dayjs;
  end_time: Dayjs;
  is_overnight: boolean;
  lunch_start_time?: Dayjs | null;
  lunch_end_time?: Dayjs | null;
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  work_days: string[];
  is_active: boolean;
};

const Shifts = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form] = Form.useForm<ShiftFormValues>();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => apiService.listShifts()
  });

  const buildBody = (values: ShiftFormValues) => ({
    name: values.name,
    start_time: values.start_time.format('HH:mm'),
    end_time: values.end_time.format('HH:mm'),
    is_overnight: values.is_overnight,
    lunch_start_time: values.lunch_start_time
      ? values.lunch_start_time.format('HH:mm')
      : null,
    lunch_end_time: values.lunch_end_time
      ? values.lunch_end_time.format('HH:mm')
      : null,
    late_grace_minutes: values.late_grace_minutes,
    early_leave_grace_minutes: values.early_leave_grace_minutes,
    work_days: values.work_days,
    is_active: values.is_active
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiService.createShift(body),
    onSuccess: () => {
      message.success("Smena qo'shildi");
      handleClose();
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      apiService.updateShift(id, body),
    onSuccess: () => {
      message.success('Smena yangilandi');
      handleClose();
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteShift(id),
    onSuccess: () => {
      message.success("Smena o'chirildi");
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    }
  });

  const handleClose = () => {
    setIsModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const body = buildBody(values);
    if (editing) {
      updateMutation.mutate({ id: editing.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const handleEdit = (shift: Shift) => {
    setEditing(shift);
    form.setFieldsValue({
      name: shift.name,
      start_time: dayjs(shift.start_time, 'HH:mm'),
      end_time: dayjs(shift.end_time, 'HH:mm'),
      is_overnight: shift.is_overnight,
      lunch_start_time: shift.lunch_start_time ? dayjs(shift.lunch_start_time, 'HH:mm') : null,
      lunch_end_time: shift.lunch_end_time ? dayjs(shift.lunch_end_time, 'HH:mm') : null,
      late_grace_minutes: shift.late_grace_minutes,
      early_leave_grace_minutes: shift.early_leave_grace_minutes,
      work_days: shift.work_days,
      is_active: shift.is_active
    });
    setIsModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      is_overnight: false,
      late_grace_minutes: 5,
      early_leave_grace_minutes: 5,
      work_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      is_active: true
    });
    setIsModalOpen(true);
  };

  const columns: ColumnsType<Shift> = [
    {
      title: 'Nomi',
      dataIndex: 'name',
      render: (name: string, record) => (
        <div>
          <div className="font-medium">{name}</div>
          {record.is_overnight ? <Tag color="purple">Tunda</Tag> : null}
        </div>
      )
    },
    {
      title: 'Vaqt',
      key: 'time',
      render: (_, record) => (
        <span>
          {record.start_time} – {record.end_time}
        </span>
      )
    },
    {
      title: 'Tushlik',
      key: 'lunch',
      render: (_, record) =>
        record.lunch_start_time && record.lunch_end_time ? (
          <span>
            {record.lunch_start_time} – {record.lunch_end_time}
          </span>
        ) : (
          '-'
        )
    },
    {
      title: 'Kunlar',
      dataIndex: 'work_days',
      render: (days: string[]) => (
        <div className="flex flex-wrap gap-1">
          {DAY_KEYS.map((d) => (
            <Tag
              key={d}
              color={days.includes(d) ? 'blue' : 'default'}
              style={{ minWidth: 32, textAlign: 'center', margin: 0 }}
            >
              {DAY_LABELS[d]}
            </Tag>
          ))}
        </div>
      )
    },
    {
      title: 'Grace',
      key: 'grace',
      render: (_, record) => (
        <span className="text-xs">
          +{record.late_grace_minutes} / -{record.early_leave_grace_minutes} daq
        </span>
      )
    },
    {
      title: 'Aktiv',
      dataIndex: 'is_active',
      width: 80,
      render: (a: boolean) => <Tag color={a ? 'green' : 'default'}>{a ? 'Ha' : "Yo'q"}</Tag>
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <div className="flex gap-1">
          <Tooltip title="Tahrirlash">
            <Button type="text" size="small" icon={<Edit size={16} />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Smenani o'chirmoqchimisiz?"
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
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Smenalar</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ish vaqti, tushlik, grace daqiqalari va hafta kunlari. Tunda smenalar ham
            qo'llab-quvvatlanadi.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            icon={<RefreshCw size={16} />}
            loading={isFetching}
            onClick={() => void refetch()}
          >
            Yangilash
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
            Yangi smena
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
          scroll={{ x: 1100 }}
          locale={{ emptyText: <Empty description="Smena yo'q" /> }}
        />
      </motion.div>

      <Modal
        title={editing ? 'Smenani tahrirlash' : 'Yangi smena'}
        open={isModalOpen}
        onCancel={handleClose}
        onOk={handleSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Smena nomi"
            rules={[{ required: true, message: 'Nomini kiriting' }]}
          >
            <Input placeholder="Asosiy / Tungi / Yarim kun" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="start_time"
              label="Boshlanish"
              rules={[{ required: true }]}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="end_time"
              label="Tugash"
              rules={[{ required: true }]}
            >
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item
            name="is_overnight"
            label="Tunda smena (kunni bosib o'tadi)"
            valuePropName="checked"
            tooltip="22:00 → 06:00 kabi smenalar uchun yoqing"
          >
            <Switch />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="lunch_start_time" label="Tushlik boshlanishi">
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="lunch_end_time" label="Tushlik tugashi">
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="late_grace_minutes"
              label="Kechikish grace (daqiqa)"
              rules={[{ required: true }]}
            >
              <InputNumber min={0} max={180} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="early_leave_grace_minutes"
              label="Erta ketish grace (daqiqa)"
              rules={[{ required: true }]}
            >
              <InputNumber min={0} max={180} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item
            name="work_days"
            label="Ish kunlari"
            rules={[{ required: true, message: 'Hech bo\'lmasa bir kun tanlang' }]}
          >
            <DaysSelect />
          </Form.Item>

          <Form.Item name="is_active" label="Aktiv" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const DaysSelect = ({
  value = [],
  onChange
}: {
  value?: string[];
  onChange?: (v: string[]) => void;
}) => {
  const toggle = (day: string) => {
    if (!onChange) return;
    if (value.includes(day)) onChange(value.filter((d) => d !== day));
    else onChange([...value, day]);
  };
  return (
    <div className="flex gap-1">
      {DAY_KEYS.map((d) => {
        const active = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            className={`h-9 w-12 rounded-md border text-sm font-medium transition ${
              active
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {DAY_LABELS[d]}
          </button>
        );
      })}
    </div>
  );
};

export default Shifts;
