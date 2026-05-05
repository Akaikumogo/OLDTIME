import { useState } from 'react';
import { Button, Empty, Select, Table, Tag, Modal, Form, Input, message, Popconfirm } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { RefreshCw, Edit, Trash2, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import { DateFilter } from '@/components/filters/DateFilter';
import type { AttendanceEvent } from '@/services/api';
import { formatDateTime } from '@/utils/date';

const AttendanceEvents = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [dateFrom, setDateFrom] = useState<string | undefined>(undefined);
  const [dateTo, setDateTo] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AttendanceEvent | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['attendance-events', page, limit, dateFrom, dateTo, status, search],
    queryFn: () =>
      apiService.listAttendanceEvents({
        page,
        limit,
        date_from: dateFrom ? dateFrom : undefined,
        date_to: dateTo ? dateTo : undefined,
        status,
        employee_name: search || undefined,
        sort: 'event_timestamp',
        order: 'desc'
      })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      apiService.updateAttendanceEvent(id, values),
    onSuccess: () => {
      message.success('Hodisa muvaffaqiyatli yangilandi');
      setIsModalOpen(false);
      setEditingEvent(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['attendance-events'] });
    },
    onError: () => {
      message.error('Hodisa yangilashda xatolik yuz berdi');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiService.deleteAttendanceEvent(id),
    onSuccess: () => {
      message.success('Hodisa muvaffaqiyatli o\'chirildi');
      queryClient.invalidateQueries({ queryKey: ['attendance-events'] });
    },
    onError: () => {
      message.error('Hodisa o\'chirishda xatolik yuz berdi');
    }
  });

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      if (editingEvent) {
        updateMutation.mutate({ id: editingEvent.id, values });
      }
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleEdit = (event: AttendanceEvent) => {
    setEditingEvent(event);
    form.setFieldsValue({
      employee_name: event.employee_name,
      card_id: event.card_id,
      status: event.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    form.resetFields();
  };

  const columns: ColumnsType<AttendanceEvent> = [
    {
      title: '#',
      width: 60,
      render: (_, __, index) => (page - 1) * limit + index + 1
    },
    {
      title: 'Xodim',
      dataIndex: 'employee',
      render: (employee: { full_name: string } | null) => employee?.full_name || '-'
    },
    {
      title: 'Card ID',
      dataIndex: 'card_id',
      width: 100,
      render: (cardId: string | null) => cardId || '-'
    },
    {
      title: 'Serial',
      dataIndex: 'serial_no',
      width: 100,
      render: (serial: string | null) => serial || '-'
    },
    {
      title: 'Turi',
      dataIndex: 'door_event_type',
      width: 100
    },
    {
      title: 'Vaqt',
      dataIndex: 'event_timestamp',
      width: 160,
      render: (date: string) => formatDateTime(date)
    },
    {
      title: 'Kirish',
      dataIndex: 'entry_time',
      width: 100,
      render: (time: string | null) => time ? formatDateTime(time).split(' ')[1] : '-'
    },
    {
      title: 'Chiqish',
      dataIndex: 'exit_time',
      width: 100,
      render: (time: string | null) => time ? formatDateTime(time).split(' ')[1] : '-'
    },
    {
      title: 'Holat',
      dataIndex: 'status',
      width: 100,
      render: (status: string | null) => {
        if (!status) return '-';
        const colorMap: Record<string, string> = {
          on_time: 'green',
          late: 'red',
          lunch_out: 'gold',
          lunch_return: 'cyan',
          early_exit: 'volcano',
          on_time_exit: 'green'
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: 'Match',
      dataIndex: 'match_status',
      width: 100,
      render: (status: string | null) => {
        if (!status) return '-';
        const colorMap: Record<string, string> = {
          matched: 'green',
          unmatched: 'red'
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: 'Esim',
      dataIndex: ['door', 'name'],
      width: 120
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 120,
      render: (_, record: AttendanceEvent) => (
        <div className="flex gap-2">
          <Button
            type="text"
            size="small"
            icon={<Edit size={16} />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Hodisani o'chirmoqchimisiz?"
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
            Davomat hodisalari
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kirish/chiqish hodisalari ro'yxati
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
          <DateFilter
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="Dan"
            allowClear
          />
          <DateFilter
            value={dateTo}
            onChange={setDateTo}
            placeholder="Gacha"
            allowClear
          />
          <Select
            placeholder="Holat"
            allowClear
            style={{ width: 120 }}
            onChange={setStatus}
            options={[
              { value: 'on_time', label: 'Vaqtida' },
              { value: 'late', label: 'Kechikdi' },
              { value: 'lunch_out', label: 'Tushlik' },
              { value: 'lunch_return', label: 'Qaytdi' },
              { value: 'early_exit', label: 'Erta ketdi' }
            ]}
          />
          <Button
            icon={<RefreshCw size={16} />}
            loading={isLoading}
            onClick={() => void refetch()}
          >
            Yangilash
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
          scroll={{ x: 1400 }}
          locale={{ emptyText: <Empty description="Davomat hodisalari topilmadi" /> }}
        />
      </motion.div>

      <Modal
        title="Hodisani tahrirlash"
        open={isModalOpen}
        onCancel={handleModalClose}
        footer={[
          <Button key="cancel" onClick={handleModalClose}>
            Bekor qilish
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={updateMutation.isPending}
            onClick={handleUpdate}
          >
            Yangilash
          </Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="employee_name"
            label="Xodim ismi"
            rules={[{ required: true, message: 'Xodim ismini kiriting' }]}
          >
            <Input placeholder="Ism Familiya" />
          </Form.Item>
          <Form.Item name="card_id" label="Card ID">
            <Input placeholder="Card ID" />
          </Form.Item>
          <Form.Item name="status" label="Holati">
            <Select>
              <Select.Option value="on_time">Vaqtida</Select.Option>
              <Select.Option value="late">Kechikdi</Select.Option>
              <Select.Option value="lunch_out">Tushlik</Select.Option>
              <Select.Option value="lunch_return">Qaytdi</Select.Option>
              <Select.Option value="early_exit">Erta ketdi</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AttendanceEvents;
