import { useState } from 'react';
import {
  Avatar,
  Button,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Table,
  Tag,
  Tooltip,
  message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AlertTriangle,
  Edit,
  ImageIcon,
  Link2,
  RefreshCw,
  Search,
  Trash2,
  UserCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiService, {
  BACKEND_ORIGIN,
  type AttendanceEvent,
  type Employee
} from '@/services/api';
import { DateFilter } from '@/components/filters/DateFilter';
import { formatDateTime } from '@/utils/date';

const buildImageUrl = (raw?: string | null): string | undefined => {
  if (!raw) return undefined;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `${BACKEND_ORIGIN}${raw}`;
};

const STATUS_COLORS: Record<string, string> = {
  on_time: 'green',
  late: 'red',
  entry: 'blue',
  exit: 'default',
  lunch_out: 'gold',
  lunch_return: 'cyan',
  early_exit: 'volcano',
  on_time_exit: 'green',
  unmatched_employee: 'magenta',
  ambiguous_employee: 'purple',
  holiday: 'gold',
  weekend: 'default'
};

const STATUS_LABELS: Record<string, string> = {
  on_time: 'Vaqtida',
  late: 'Kechikdi',
  entry: 'Kirish',
  exit: 'Chiqish',
  lunch_out: 'Tushlikka',
  lunch_return: 'Qaytdi',
  early_exit: 'Erta ketdi',
  on_time_exit: 'Vaqtida ketdi',
  unmatched_employee: 'Topilmadi',
  ambiguous_employee: 'Shubhali',
  holiday: 'Bayram',
  weekend: 'Dam olish'
};

type MatchFilter = 'all' | 'matched' | 'unmatched_or_ambiguous';

const AttendanceEvents = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [dateFrom, setDateFrom] = useState<string | undefined>();
  const [dateTo, setDateTo] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [search, setSearch] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AttendanceEvent | null>(null);
  const [form] = Form.useForm();

  const [linkModalEvent, setLinkModalEvent] = useState<AttendanceEvent | null>(null);
  const [linkSelectedEmployee, setLinkSelectedEmployee] = useState<string | undefined>();

  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      'attendance-events',
      page,
      limit,
      dateFrom,
      dateTo,
      statusFilter,
      matchFilter,
      search
    ],
    queryFn: () =>
      apiService.listAttendanceEvents({
        page,
        limit,
        date_from: dateFrom,
        date_to: dateTo,
        status: statusFilter,
        match_status: matchFilter === 'all' ? undefined : matchFilter,
        employee_name: search || undefined,
        sort: 'event_timestamp',
        order: 'desc'
      })
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-for-link'],
    queryFn: () =>
      apiService.listEmployees({
        page: 1,
        limit: 100,
        is_active: true,
        sort: 'name',
        order: 'asc'
      }),
    enabled: !!linkModalEvent
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      apiService.updateAttendanceEvent(id, values),
    onSuccess: () => {
      message.success('Hodisa yangilandi');
      setIsEditModalOpen(false);
      setEditingEvent(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['attendance-events'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteAttendanceEvent(id),
    onSuccess: () => {
      message.success("Hodisa o'chirildi");
      queryClient.invalidateQueries({ queryKey: ['attendance-events'] });
    }
  });

  const linkMutation = useMutation({
    mutationFn: ({ eventId, employeeId }: { eventId: string; employeeId: string }) =>
      apiService.linkEventToEmployee(eventId, employeeId),
    onSuccess: () => {
      message.success('Event xodimga biriktirildi');
      setLinkModalEvent(null);
      setLinkSelectedEmployee(undefined);
      queryClient.invalidateQueries({ queryKey: ['attendance-events'] });
    }
  });

  const handleEdit = (event: AttendanceEvent) => {
    setEditingEvent(event);
    form.setFieldsValue({
      employee_name: event.employee_name ?? event.employee?.full_name,
      card_id: event.card_id,
      status: event.status
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      if (editingEvent) {
        updateMutation.mutate({ id: editingEvent.id, values });
      }
    } catch {
      // antd handles
    }
  };

  const unmatchedCount =
    data?.data.filter(
      (e) => e.match_status === 'unmatched' || e.match_status === 'ambiguous'
    ).length ?? 0;

  const columns: ColumnsType<AttendanceEvent> = [
    {
      title: '#',
      width: 56,
      render: (_, __, index) => (page - 1) * limit + index + 1
    },
    {
      title: 'Rasm',
      key: 'picture',
      width: 70,
      render: (_, record) => {
        const url = buildImageUrl(record.picture_url);
        if (!url) {
          return (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-400 dark:bg-slate-800">
              <ImageIcon size={18} />
            </div>
          );
        }
        return (
          <Image
            src={url}
            alt="event"
            width={40}
            height={40}
            preview={{ maskClassName: 'rounded-md' }}
            style={{ borderRadius: 6, objectFit: 'cover' }}
          />
        );
      }
    },
    {
      title: 'Xodim',
      key: 'employee',
      render: (_, record) => {
        const isUnmatched =
          record.match_status === 'unmatched' || record.match_status === 'ambiguous';
        return (
          <div className="flex items-center gap-2">
            <Avatar size={28} icon={<UserCircle2 size={20} />} />
            <div>
              <div
                className={`text-sm font-medium ${
                  isUnmatched ? 'text-orange-600 dark:text-orange-400' : ''
                }`}
              >
                {record.employee?.full_name || record.employee_name || '-'}
              </div>
              {record.card_id ? (
                <div className="text-xs text-slate-500">#{record.card_id}</div>
              ) : null}
            </div>
          </div>
        );
      }
    },
    {
      title: 'Eshik',
      dataIndex: ['door', 'name'],
      width: 140,
      render: (name: string, record) => (
        <div>
          <div className="text-sm">{name}</div>
          <Tag color={record.door.event_type === 'entry' ? 'blue' : 'orange'}>
            {record.door.event_type === 'entry' ? 'Kirish' : 'Chiqish'}
          </Tag>
        </div>
      )
    },
    {
      title: 'Vaqt',
      dataIndex: 'event_timestamp',
      width: 170,
      render: (date: string) => formatDateTime(date)
    },
    {
      title: 'Holat',
      dataIndex: 'status',
      width: 130,
      render: (status: string | null) => {
        if (!status) return '-';
        return (
          <Tag color={STATUS_COLORS[status] || 'default'}>
            {STATUS_LABELS[status] || status}
          </Tag>
        );
      }
    },
    {
      title: 'Match',
      dataIndex: 'match_status',
      width: 110,
      render: (status: string | null) => {
        if (!status) return '-';
        const colors: Record<string, string> = {
          matched: 'green',
          unmatched: 'red',
          ambiguous: 'orange'
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      }
    },
    {
      title: 'Amallar',
      key: 'actions',
      width: 130,
      render: (_, record) => {
        const needsLink =
          record.match_status === 'unmatched' || record.match_status === 'ambiguous';
        return (
          <div className="flex gap-1">
            {needsLink ? (
              <Tooltip title="Xodimga biriktirish">
                <Button
                  type="text"
                  size="small"
                  icon={<Link2 size={16} />}
                  onClick={() => {
                    setLinkModalEvent(record);
                    setLinkSelectedEmployee(undefined);
                  }}
                />
              </Tooltip>
            ) : null}
            <Tooltip title="Tahrirlash">
              <Button
                type="text"
                size="small"
                icon={<Edit size={16} />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
            <Popconfirm
              title="Hodisani o'chirmoqchimisiz?"
              description="Audit log saqlanib qoladi."
              onConfirm={() => deleteMutation.mutate(record.id)}
              okText="Ha"
              cancelText="Yo'q"
            >
              <Tooltip title="O'chirish">
                <Button type="text" size="small" danger icon={<Trash2 size={16} />} />
              </Tooltip>
            </Popconfirm>
          </div>
        );
      }
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
            Kirish va chiqish eventlari, biriktirilmaganlarni qo'lda biriktirish
          </p>
          {unmatchedCount > 0 && matchFilter === 'all' ? (
            <button
              onClick={() => setMatchFilter('unmatched_or_ambiguous')}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300"
            >
              <AlertTriangle size={12} />
              {unmatchedCount} ta event biriktirilmagan — ko'rsatish
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={matchFilter}
            onChange={(v) => setMatchFilter(v as MatchFilter)}
            options={[
              { value: 'all', label: 'Hammasi' },
              { value: 'matched', label: 'Biriktirilgan' },
              { value: 'unmatched_or_ambiguous', label: 'Biriktirilmagan' }
            ]}
          />
          <Input
            placeholder="Xodim ismi..."
            prefix={<Search size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => void refetch()}
            style={{ width: 200 }}
            allowClear
          />
          <DateFilter value={dateFrom} onChange={setDateFrom} placeholder="Dan" allowClear />
          <DateFilter value={dateTo} onChange={setDateTo} placeholder="Gacha" allowClear />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 140 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
              value,
              label
            }))}
          />
          <Button
            icon={<RefreshCw size={16} />}
            loading={isFetching}
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
            onChange: (p, l) => {
              setPage(p);
              setLimit(l);
            }
          }}
          scroll={{ x: 1200 }}
          locale={{ emptyText: <Empty description="Hodisalar topilmadi" /> }}
        />
      </motion.div>

      {/* Edit modal */}
      <Modal
        title="Hodisani tahrirlash"
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingEvent(null);
          form.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => setIsEditModalOpen(false)}>
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
          <Form.Item name="employee_name" label="Xodim ismi">
            <Input placeholder="Ism Familiya" />
          </Form.Item>
          <Form.Item name="card_id" label="Card ID">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select
              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
                value,
                label
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Link to employee modal */}
      <Modal
        title="Eventni xodimga biriktirish"
        open={!!linkModalEvent}
        onCancel={() => {
          setLinkModalEvent(null);
          setLinkSelectedEmployee(undefined);
        }}
        footer={[
          <Button key="cancel" onClick={() => setLinkModalEvent(null)}>
            Bekor qilish
          </Button>,
          <Button
            key="submit"
            type="primary"
            disabled={!linkSelectedEmployee}
            loading={linkMutation.isPending}
            onClick={() => {
              if (linkModalEvent && linkSelectedEmployee) {
                linkMutation.mutate({
                  eventId: linkModalEvent.id,
                  employeeId: linkSelectedEmployee
                });
              }
            }}
          >
            Biriktirish
          </Button>
        ]}
      >
        {linkModalEvent ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
              <div className="font-medium">
                {linkModalEvent.employee_name || '(ism yo\'q)'}
              </div>
              <div className="text-xs text-slate-500">
                {linkModalEvent.card_id ? `Card ID: ${linkModalEvent.card_id} · ` : ''}
                {formatDateTime(linkModalEvent.event_timestamp)} ·{' '}
                {linkModalEvent.door.name}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Qaysi xodimga biriktiramiz?
              </label>
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder="Xodimni qidiring..."
                value={linkSelectedEmployee}
                onChange={setLinkSelectedEmployee}
                optionFilterProp="label"
                options={
                  employees?.data.map((e: Employee) => ({
                    value: e.id,
                    label: `${e.full_name}${e.employee_code ? ` (#${e.employee_code})` : ''}`
                  })) ?? []
                }
              />
              <p className="mt-2 text-xs text-slate-500">
                Status policy bo'yicha avtomatik qayta hisoblanadi va audit log
                yoziladi.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default AttendanceEvents;
