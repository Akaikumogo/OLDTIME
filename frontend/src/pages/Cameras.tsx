import { useEffect, useState, type PointerEvent } from 'react';
import { Button, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Switch, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftRight, Camera as CameraIcon, Edit, Plus, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import apiService, {
  BACKEND_ORIGIN,
  type Camera,
  type CameraCrossingEventItem,
  type CameraCrossingRuleInput,
  type CameraInput,
  type CameraRoomPresenceItem,
  type CameraStatus,
  type Employee,
  type Room,
  type Zone
} from '@/services/api';
import { CameraStatusBadge } from '@/components/camera/CameraStatusBadge';
import { canWrite } from '@/utils/can';

type CameraFormValues = CameraInput;
type CrossingFormValues = CameraCrossingRuleInput;
type DragPoint = 'start' | 'end';

const DEFAULT_CROSSING_RULE: Required<CrossingFormValues> = {
  name: 'Main crossing line',
  enabled: false,
  line_x1: 0.5,
  line_y1: 0.1,
  line_x2: 0.5,
  line_y2: 0.9,
  entry_direction: 'negative_to_positive'
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDuration(seconds?: number | null) {
  if (seconds == null) return '-';
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes < 60) return `${minutes} daq ${rem}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours} soat ${minutes % 60} daq`;
}

function tokenizedStreamUrl(path?: string | null) {
  if (!path) return null;
  const token =
    localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  const base = path.startsWith('http') ? path : `${BACKEND_ORIGIN}${path}`;
  const url = new URL(base);
  url.searchParams.set('profile', 'main');
  url.searchParams.set('format', 'mp4');
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function roundCoord(value: number) {
  return Math.round(clamp01(value) * 1000) / 1000;
}

function crossingGeometry(rule: Required<CrossingFormValues>) {
  const dx = rule.line_x2 - rule.line_x1;
  const dy = rule.line_y2 - rule.line_y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const mx = (rule.line_x1 + rule.line_x2) / 2;
  const my = (rule.line_y1 + rule.line_y2) / 2;

  const positive = {
    x: clamp01(mx + nx * 0.18),
    y: clamp01(my + ny * 0.18)
  };
  const negative = {
    x: clamp01(mx - nx * 0.18),
    y: clamp01(my - ny * 0.18)
  };
  const positiveNear = {
    x: clamp01(mx + nx * 0.09),
    y: clamp01(my + ny * 0.09)
  };
  const negativeNear = {
    x: clamp01(mx - nx * 0.09),
    y: clamp01(my - ny * 0.09)
  };

  const entryIsPositive = rule.entry_direction === 'negative_to_positive';
  return {
    entry: entryIsPositive ? positive : negative,
    exit: entryIsPositive ? negative : positive,
    arrowStart: entryIsPositive ? negativeNear : positiveNear,
    arrowEnd: entryIsPositive ? positiveNear : negativeNear
  };
}

const Cameras = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [crossingCamera, setCrossingCamera] = useState<Camera | null>(null);
  const [crossingDraft, setCrossingDraft] = useState<Required<CrossingFormValues>>(DEFAULT_CROSSING_RULE);
  const [dragPoint, setDragPoint] = useState<DragPoint | null>(null);
  const [presenceDate, setPresenceDate] = useState(localDateKey());
  const [presenceEmployeeId, setPresenceEmployeeId] = useState<string | undefined>();
  const [presenceRoomId, setPresenceRoomId] = useState<string | undefined>();
  const [presenceCameraId, setPresenceCameraId] = useState<string | undefined>();
  const [presencePage, setPresencePage] = useState(1);
  const [form] = Form.useForm<CameraFormValues>();
  const [crossingForm] = Form.useForm<CrossingFormValues>();
  const queryClient = useQueryClient();
  const writable = canWrite();

  const camerasQuery = useQuery({
    queryKey: ['cameras', page, limit],
    queryFn: () => apiService.listCameras({ page, limit })
  });

  const zonesQuery = useQuery({
    queryKey: ['zones-for-cameras'],
    queryFn: () => apiService.listZones()
  });

  const roomsQuery = useQuery({
    queryKey: ['rooms-for-cameras'],
    queryFn: () => apiService.listRooms()
  });

  const employeesQuery = useQuery({
    queryKey: ['employees-for-camera-links'],
    queryFn: () =>
      apiService.listEmployees({
        page: 1,
        limit: 500,
        is_active: true,
        sort: 'name',
        order: 'asc'
      })
  });

  const today = localDateKey();
  const crossingEventsQuery = useQuery({
    queryKey: ['camera-crossing-events', today],
    queryFn: () =>
      apiService.listCameraCrossingEvents({
        date_from: today,
        date_to: today,
        limit: 50
      }),
    refetchInterval: 10_000
  });

  const roomPresenceQuery = useQuery({
    queryKey: [
      'camera-room-presence',
      presenceDate,
      presenceEmployeeId,
      presenceRoomId,
      presenceCameraId,
      presencePage
    ],
    queryFn: () =>
      apiService.listCameraRoomPresence({
        date_from: presenceDate,
        date_to: presenceDate,
        employee_id: presenceEmployeeId,
        room_id: presenceRoomId,
        camera_id: presenceCameraId,
        page: presencePage,
        limit: 50
      }),
    refetchInterval: 10_000
  });

  const crossingRuleQuery = useQuery({
    queryKey: ['camera-crossing-rule', crossingCamera?.id],
    queryFn: () => apiService.getCameraCrossingRule(crossingCamera!.id),
    enabled: Boolean(crossingCamera)
  });

  useEffect(() => {
    if (!crossingRuleQuery.data) return;
    const next = {
      name: crossingRuleQuery.data.name,
      enabled: crossingRuleQuery.data.enabled,
      line_x1: crossingRuleQuery.data.line_x1,
      line_y1: crossingRuleQuery.data.line_y1,
      line_x2: crossingRuleQuery.data.line_x2,
      line_y2: crossingRuleQuery.data.line_y2,
      entry_direction: crossingRuleQuery.data.entry_direction
    };
    setCrossingDraft(next);
    crossingForm.setFieldsValue(next);
  }, [crossingForm, crossingRuleQuery.data]);

  const createMutation = useMutation({
    mutationFn: (values: CameraFormValues) => apiService.createCamera(values),
    onSuccess: () => {
      message.success('Kamera qo\'shildi');
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<CameraFormValues> }) =>
      apiService.updateCamera(id, values),
    onSuccess: () => {
      message.success('Kamera yangilandi');
      closeModal();
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
      void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteCamera(id),
    onSuccess: () => {
      message.success('Kamera o\'chirildi');
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
    }
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => apiService.testCamera(id),
    onSuccess: (result) => {
      message.info(result.message);
      void queryClient.invalidateQueries({ queryKey: ['cameras'] });
    }
  });

  const updateCrossingMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CrossingFormValues }) =>
      apiService.updateCameraCrossingRule(id, values),
    onSuccess: () => {
      message.success('Kamera chegarasi saqlandi');
      setCrossingCamera(null);
      void queryClient.invalidateQueries({ queryKey: ['camera-crossing-rule'] });
    }
  });

  const linkCrossingMutation = useMutation({
    mutationFn: ({ eventId, employeeId }: { eventId: string; employeeId: string }) =>
      apiService.linkCameraCrossingEventToEmployee(eventId, employeeId),
    onSuccess: () => {
      message.success('Track xodimga biriktirildi');
      void queryClient.invalidateQueries({ queryKey: ['camera-crossing-events'] });
      void queryClient.invalidateQueries({ queryKey: ['unknown-detections'] });
      void queryClient.invalidateQueries({ queryKey: ['cameras-live-unknown-detections'] });
      void queryClient.invalidateQueries({ queryKey: ['cameras-live-matched-detections'] });
    }
  });

  const openCreate = () => {
    setEditingCamera(null);
    form.setFieldsValue({
      has_audio: true,
      has_speaker: false,
      status: 'unknown'
    });
    setIsModalOpen(true);
  };

  const openEdit = (camera: Camera) => {
    setEditingCamera(camera);
    form.setFieldsValue({
      name: camera.name,
      ip: camera.ip,
      username: camera.username,
      rtsp_main_url: camera.rtsp_main_url,
      rtsp_sub_url: camera.rtsp_sub_url,
      isapi_base_url: camera.isapi_base_url,
      zone_id: camera.zone_id,
      room_id: camera.room_id,
      has_audio: camera.has_audio,
      has_speaker: camera.has_speaker,
      status: camera.status
    });
    setIsModalOpen(true);
  };

  const openCrossing = (camera: Camera) => {
    setCrossingCamera(camera);
    setCrossingDraft(DEFAULT_CROSSING_RULE);
    crossingForm.setFieldsValue(DEFAULT_CROSSING_RULE);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCamera(null);
    form.resetFields();
  };

  const save = async () => {
    const values = await form.validateFields();
    if (editingCamera) {
      const payload = { ...values };
      if (!payload.password) delete payload.password;
      updateMutation.mutate({ id: editingCamera.id, values: payload });
      return;
    }
    createMutation.mutate(values);
  };

  const saveCrossing = async () => {
    if (!crossingCamera) return;
    const values = await crossingForm.validateFields();
    updateCrossingMutation.mutate({ id: crossingCamera.id, values });
  };

  const updateDraggedPoint = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragPoint) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = roundCoord((event.clientX - rect.left) / rect.width);
    const y = roundCoord((event.clientY - rect.top) / rect.height);
    const values =
      dragPoint === 'start'
        ? { line_x1: x, line_y1: y }
        : { line_x2: x, line_y2: y };
    crossingForm.setFieldsValue(values);
    setCrossingDraft((current) => ({ ...current, ...values }));
  };

  const startPointDrag = (point: DragPoint) => (event: PointerEvent<SVGCircleElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragPoint(point);
  };

  const columns: ColumnsType<Camera> = [
    {
      title: 'Kamera',
      dataIndex: 'name',
      fixed: 'left',
      render: (name: string, camera) => (
        <div>
          <span className="font-medium text-slate-900 dark:text-white">{name}</span>
          <p className="text-xs text-slate-500">{camera.ip}</p>
        </div>
      )
    },
    {
      title: 'Zone',
      dataIndex: 'zone_name',
      width: 170,
      render: (_name: string, camera) => (
        <div className="flex flex-col gap-1">
          <span>{camera.zone_name}</span>
          <Tag>{camera.zone_type}</Tag>
        </div>
      )
    },
    {
      title: 'Room',
      dataIndex: 'room_name',
      width: 150,
      render: (name?: string | null) => name || '-'
    },
    {
      title: 'Audio',
      width: 120,
      render: (_, camera) => (
        <div className="flex flex-wrap gap-1">
          {camera.has_audio ? <Tag color="blue">Listen</Tag> : null}
          {camera.has_speaker ? <Tag color="green">Speaker</Tag> : null}
          {!camera.has_audio && !camera.has_speaker ? '-' : null}
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (status: CameraStatus) => <CameraStatusBadge status={status} />
    },
    {
      title: 'RTSP',
      dataIndex: 'rtsp_main_url',
      width: 280,
      ellipsis: true,
      render: (value: string) => <span className="font-mono text-xs">{value}</span>
    },
    {
      title: 'Amallar',
      width: 170,
      fixed: 'right',
      render: (_, camera) => (
        <div className="flex gap-2">
          <Button
            type="text"
            size="small"
            icon={<Wifi size={16} />}
            loading={testMutation.isPending}
            onClick={() => testMutation.mutate(camera.id)}
          />
          {writable ? (
            <>
              <Button
                type="text"
                size="small"
                icon={<ArrowLeftRight size={16} />}
                onClick={() => openCrossing(camera)}
              />
              <Button
                type="text"
                size="small"
                icon={<Edit size={16} />}
                onClick={() => openEdit(camera)}
              />
              <Popconfirm
                title="Kamera o'chirilsinmi?"
                okText="Ha"
                cancelText="Yo'q"
                onConfirm={() => deleteMutation.mutate(camera.id)}
              >
                <Button type="text" size="small" danger icon={<Trash2 size={16} />} />
              </Popconfirm>
            </>
          ) : null}
        </div>
      )
    }
  ];

  const crossingEventColumns: ColumnsType<CameraCrossingEventItem> = [
    {
      title: 'Vaqt',
      dataIndex: 'crossed_at',
      width: 120,
      render: (value: string) => new Date(value).toLocaleTimeString()
    },
    {
      title: 'Holat',
      dataIndex: 'direction',
      width: 110,
      render: (direction: CameraCrossingEventItem['direction']) => (
        <Tag color={direction === 'entry' ? 'green' : 'orange'}>
          {direction === 'entry' ? 'Kirdi' : 'Chiqdi'}
        </Tag>
      )
    },
    {
      title: 'Kim',
      render: (_, event) =>
        event.employee_name ? (
          event.employee_name
        ) : (
          <Select
            showSearch
            placeholder={`Track: ${event.track_id.slice(0, 12)}`}
            style={{ width: 240 }}
            optionFilterProp="label"
            loading={employeesQuery.isFetching || linkCrossingMutation.isPending}
            onSelect={(employeeId: string) =>
              linkCrossingMutation.mutate({ eventId: event.id, employeeId })
            }
            options={(employeesQuery.data?.data ?? []).map((employee: Employee) => ({
              value: employee.id,
              label: employee.full_name
            }))}
          />
        )
    },
    {
      title: 'Xona',
      render: (_, event) => event.room_name || '-'
    },
    {
      title: 'Kamera',
      dataIndex: 'camera_name',
      width: 220
    }
  ];

  const roomPresenceColumns: ColumnsType<CameraRoomPresenceItem> = [
    {
      title: 'Kim',
      render: (_, row) => row.employee_name || `Track: ${row.track_id.slice(0, 14)}`
    },
    {
      title: 'Xona',
      render: (_, row) => row.room_name || '-'
    },
    {
      title: 'Kamera',
      dataIndex: 'camera_name',
      width: 200
    },
    {
      title: 'Kirdi',
      dataIndex: 'entered_at',
      width: 120,
      render: (value: string) => new Date(value).toLocaleTimeString()
    },
    {
      title: 'Chiqdi',
      dataIndex: 'exited_at',
      width: 120,
      render: (value: string | null | undefined, row) =>
        value ? new Date(value).toLocaleTimeString() : (
          <Tag color={row.status === 'pending_exit' ? 'gold' : 'green'}>
            {row.status === 'pending_exit' ? 'Tekshirilmoqda' : 'Ichkarida'}
          </Tag>
        )
    },
    {
      title: 'Davomiyligi',
      dataIndex: 'duration_seconds',
      width: 140,
      render: (value?: number | null) => formatDuration(value)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => <Tag>{value}</Tag>
    }
  ];

  const crossingStreamSrc = tokenizedStreamUrl(crossingCamera?.stream_url);
  const crossingSides = crossingGeometry(crossingDraft);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
            Cameras
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Button
            icon={<RefreshCw size={16} />}
            loading={camerasQuery.isFetching}
            onClick={() => void camerasQuery.refetch()}
          >
            Yangilash
          </Button>
          {writable ? (
            <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>
              Qo'shish
            </Button>
          ) : null}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={camerasQuery.data?.data ?? []}
          loading={camerasQuery.isLoading}
          scroll={{ x: 1350 }}
          pagination={{
            current: page,
            pageSize: limit,
            total: camerasQuery.data?.meta?.total ?? 0,
            showSizeChanger: true,
            onChange: (newPage, newLimit) => {
              setPage(newPage);
              setLimit(newLimit);
            }
          }}
          locale={{ emptyText: <Empty description="Kamera topilmadi" /> }}
        />
      </motion.div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
            Bugungi kirish/chiqish
          </h3>
          <Button
            icon={<RefreshCw size={16} />}
            loading={crossingEventsQuery.isFetching}
            onClick={() => void crossingEventsQuery.refetch()}
          >
            Yangilash
          </Button>
        </div>
        <Table
          rowKey="id"
          columns={crossingEventColumns}
          dataSource={crossingEventsQuery.data?.data ?? []}
          loading={crossingEventsQuery.isLoading}
          pagination={false}
          locale={{ emptyText: <Empty description="Bugun crossing event yo'q" /> }}
        />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
            Kunlik xona tarixi
          </h3>
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              value={presenceDate}
              style={{ width: 160 }}
              onChange={(event) => {
                setPresenceDate(event.target.value || localDateKey());
                setPresencePage(1);
              }}
            />
            <Select
              allowClear
              showSearch
              placeholder="Employee"
              optionFilterProp="label"
              style={{ width: 220 }}
              value={presenceEmployeeId}
              onChange={(value) => {
                setPresenceEmployeeId(value);
                setPresencePage(1);
              }}
              options={(employeesQuery.data?.data ?? []).map((employee: Employee) => ({
                value: employee.id,
                label: employee.full_name
              }))}
            />
            <Select
              allowClear
              showSearch
              placeholder="Room"
              optionFilterProp="label"
              style={{ width: 180 }}
              value={presenceRoomId}
              onChange={(value) => {
                setPresenceRoomId(value);
                setPresencePage(1);
              }}
              options={(roomsQuery.data ?? []).map((room: Room) => ({
                value: room.id,
                label: room.name
              }))}
            />
            <Select
              allowClear
              showSearch
              placeholder="Camera"
              optionFilterProp="label"
              style={{ width: 200 }}
              value={presenceCameraId}
              onChange={(value) => {
                setPresenceCameraId(value);
                setPresencePage(1);
              }}
              options={(camerasQuery.data?.data ?? []).map((camera: Camera) => ({
                value: camera.id,
                label: camera.name
              }))}
            />
            <Button
              icon={<RefreshCw size={16} />}
              loading={roomPresenceQuery.isFetching}
              onClick={() => void roomPresenceQuery.refetch()}
            >
              Yangilash
            </Button>
          </div>
        </div>
        <Table
          rowKey="id"
          columns={roomPresenceColumns}
          dataSource={roomPresenceQuery.data?.data ?? []}
          loading={roomPresenceQuery.isLoading}
          pagination={{
            current: presencePage,
            pageSize: 50,
            total: roomPresenceQuery.data?.meta?.total ?? 0,
            onChange: setPresencePage,
            showTotal: (total) => `Jami: ${total}`
          }}
          locale={{ emptyText: <Empty description="Bu sana uchun xona tarixi yo'q" /> }}
        />
      </div>

      <Modal
        title={editingCamera ? 'Kamera tahrirlash' : 'Kamera qo\'shish'}
        open={isModalOpen}
        onCancel={closeModal}
        onOk={() => void save()}
        width={720}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="name" label="Nomi" rules={[{ required: true }]}>
              <Input prefix={<CameraIcon size={15} />} />
            </Form.Item>
            <Form.Item name="ip" label="IP" rules={[{ required: true }]}>
              <Input placeholder="192.168.30.52" />
            </Form.Item>
            <Form.Item name="username" label="Username" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="password"
              label={editingCamera ? 'Password' : 'Password *'}
              rules={editingCamera ? [] : [{ required: true }]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </div>
          <Form.Item name="rtsp_main_url" label="RTSP main" rules={[{ required: true }]}>
            <Input placeholder="rtsp://192.168.30.52:554/Streaming/Channels/101" />
          </Form.Item>
          <Form.Item name="rtsp_sub_url" label="RTSP sub">
            <Input placeholder="rtsp://192.168.30.52:554/Streaming/Channels/102" />
          </Form.Item>
          <Form.Item name="isapi_base_url" label="ISAPI base">
            <Input placeholder="http://192.168.30.52" />
          </Form.Item>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="zone_id" label="Zone" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={(zonesQuery.data ?? []).map((zone: Zone) => ({
                  value: zone.id,
                  label: `${zone.name} (${zone.type})`
                }))}
              />
            </Form.Item>
            <Form.Item name="room_id" label="Room">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={(roomsQuery.data ?? []).map((room: Room) => ({
                  value: room.id,
                  label: room.name
                }))}
              />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select
                options={(['unknown', 'online', 'offline', 'error', 'testing'] as CameraStatus[]).map(
                  (status) => ({ value: status, label: status })
                )}
              />
            </Form.Item>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="has_audio" label="Audio listen" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="has_speaker" label="Speaker talkback" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={crossingCamera ? `${crossingCamera.name} - kirish/chiqish chegarasi` : 'Kirish/chiqish chegarasi'}
        open={Boolean(crossingCamera)}
        onCancel={() => setCrossingCamera(null)}
        onOk={() => void saveCrossing()}
        width={760}
        confirmLoading={updateCrossingMutation.isPending}
      >
        <Form
          form={crossingForm}
          layout="vertical"
          onValuesChange={(_, values) => {
            setCrossingDraft({ ...DEFAULT_CROSSING_RULE, ...values });
          }}
        >
          <div className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
            <div className="relative aspect-video">
              {crossingStreamSrc ? (
                <video
                  key={crossingStreamSrc}
                  className="h-full w-full object-cover"
                  src={crossingStreamSrc}
                  autoPlay
                  muted
                  playsInline
                  controls={false}
                />
              ) : null}
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 56.25"
                preserveAspectRatio="none"
                onPointerMove={updateDraggedPoint}
                onPointerUp={() => setDragPoint(null)}
                onPointerLeave={() => setDragPoint(null)}
              >
                <defs>
                  <marker id="crossing-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                    <path d="M0,0 L5,2.5 L0,5 Z" fill="#22c55e" />
                  </marker>
                </defs>
                <line
                  x1={crossingDraft.line_x1 * 100}
                  y1={crossingDraft.line_y1 * 56.25}
                  x2={crossingDraft.line_x2 * 100}
                  y2={crossingDraft.line_y2 * 56.25}
                  stroke="#f97316"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={crossingSides.arrowStart.x * 100}
                  y1={crossingSides.arrowStart.y * 56.25}
                  x2={crossingSides.arrowEnd.x * 100}
                  y2={crossingSides.arrowEnd.y * 56.25}
                  stroke="#22c55e"
                  strokeWidth="1"
                  markerEnd="url(#crossing-arrow)"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={crossingSides.entry.x * 100}
                  y={crossingSides.entry.y * 56.25}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize="3.2"
                  fontWeight="700"
                  paintOrder="stroke"
                  stroke="#16a34a"
                  strokeWidth="1"
                >
                  Kirish
                </text>
                <text
                  x={crossingSides.exit.x * 100}
                  y={crossingSides.exit.y * 56.25}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize="3.2"
                  fontWeight="700"
                  paintOrder="stroke"
                  stroke="#f97316"
                  strokeWidth="1"
                >
                  Chiqish
                </text>
                <circle
                  cx={crossingDraft.line_x1 * 100}
                  cy={crossingDraft.line_y1 * 56.25}
                  r="1.8"
                  fill="#f97316"
                  stroke="#ffffff"
                  strokeWidth="0.5"
                  className="cursor-grab"
                  onPointerDown={startPointDrag('start')}
                />
                <circle
                  cx={crossingDraft.line_x2 * 100}
                  cy={crossingDraft.line_y2 * 56.25}
                  r="1.8"
                  fill="#f97316"
                  stroke="#ffffff"
                  strokeWidth="0.5"
                  className="cursor-grab"
                  onPointerDown={startPointDrag('end')}
                />
              </svg>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Form.Item name="name" label="Nomi" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="enabled" label="Faol" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="entry_direction" label="Kirish yo'nalishi" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'negative_to_positive', label: '1-tomon: kirish' },
                  { value: 'positive_to_negative', label: '2-tomon: kirish' }
                ]}
              />
            </Form.Item>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {(['line_x1', 'line_y1', 'line_x2', 'line_y2'] as const).map((field) => (
              <Form.Item key={field} name={field} label={field} rules={[{ required: true }]}>
                <InputNumber min={0} max={1} step={0.01} className="w-full" />
              </Form.Item>
            ))}
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Cameras;
