import dayjs from 'dayjs';

const now = dayjs();
const today = now.format('YYYY-MM-DD');
const createdAtBase = now.subtract(12, 'day').toISOString();

type AnyRecord = Record<string, any>;

type MockState = {
  admins: AnyRecord[];
  departments: AnyRecord[];
  positions: AnyRecord[];
  employees: AnyRecord[];
  doors: AnyRecord[];
  attendancePolicy: AnyRecord | null;
  attendanceEvents: AnyRecord[];
  workPermissions: AnyRecord[];
  computers: AnyRecord[];
  computerActivity: AnyRecord[];
};

const baseDepartments = [
  { id: 'dep-admin', name: 'Administratsiya', created_at: createdAtBase },
  { id: 'dep-hr', name: 'HR', created_at: createdAtBase },
  { id: 'dep-it', name: 'IT', created_at: createdAtBase },
  { id: 'dep-finance', name: 'Finance', created_at: createdAtBase }
];

const basePositions = [
  { id: 'pos-head', name: 'Bo‘lim boshlig‘i', created_at: createdAtBase },
  { id: 'pos-manager', name: 'Manager', created_at: createdAtBase },
  { id: 'pos-specialist', name: 'Specialist', created_at: createdAtBase },
  { id: 'pos-operator', name: 'Operator', created_at: createdAtBase }
];

const baseDoors = [
  {
    id: 'door-1',
    name: 'Kirish 1',
    ip_address: '192.168.30.166',
    event_type: 'entry',
    is_active: true,
    created_at: createdAtBase,
    connection_status: 'online',
    last_checked_at: now.toISOString(),
    last_success_at: now.toISOString(),
    last_error: null
  },
  {
    id: 'door-2',
    name: 'Chiqish 1',
    ip_address: '192.168.30.167',
    event_type: 'exit',
    is_active: true,
    created_at: createdAtBase,
    connection_status: 'online',
    last_checked_at: now.toISOString(),
    last_success_at: now.toISOString(),
    last_error: null
  }
];

const baseEmployees = [
  {
    id: 'emp-1',
    full_name: 'Turbdjanova Yulduz Tulyabaevna',
    is_active: true,
    created_at: createdAtBase,
    department: baseDepartments[1],
    position: basePositions[2]
  },
  {
    id: 'emp-2',
    full_name: 'Rahmonov Alisher Zokirjonovich',
    is_active: true,
    created_at: createdAtBase,
    department: baseDepartments[2],
    position: basePositions[0]
  },
  {
    id: 'emp-3',
    full_name: 'Abdulaxatov Abdulmalik Xojiymuratovich',
    is_active: true,
    created_at: createdAtBase,
    department: baseDepartments[0],
    position: basePositions[1]
  },
  {
    id: 'emp-4',
    full_name: 'Sunnatov Ubaydulla Hamidullayevich',
    is_active: true,
    created_at: createdAtBase,
    department: baseDepartments[2],
    position: basePositions[2]
  },
  {
    id: 'emp-5',
    full_name: 'Bekova Nazira Muminxodjaevna',
    is_active: true,
    created_at: createdAtBase,
    department: baseDepartments[3],
    position: basePositions[3]
  }
];

const state: MockState = {
  admins: [
    {
      id: 'admin-1',
      full_name: 'Sarvarbek Xazratov',
      username: 'sarvarbek',
      email: 'admin@workplus.test',
      role: 'admin',
      is_active: true,
      created_at: createdAtBase
    }
  ],
  departments: structuredClone(baseDepartments),
  positions: structuredClone(basePositions),
  employees: structuredClone(baseEmployees),
  doors: structuredClone(baseDoors),
  attendancePolicy: {
    id: 1,
    work_start_time: '09:00',
    work_end_time: '18:00',
    lunch_start_time: '13:00',
    lunch_end_time: '14:00',
    late_grace_minutes: 10,
    early_leave_grace_minutes: 10,
    is_active: true,
    created_at: createdAtBase,
    updated_at: now.toISOString()
  },
  attendanceEvents: [
    {
      id: 'ae-1',
      card_id: '1001',
      serial_no: '900001',
      event_timestamp: now.hour(9).minute(7).second(12).toISOString(),
      status: 'late',
      match_status: 'matched',
      picture_path: null,
      created_at: now.hour(9).minute(7).second(20).toISOString(),
      employee_id: 'emp-1',
      employee_name: baseEmployees[0].full_name,
      door: baseDoors[0]
    },
    {
      id: 'ae-2',
      card_id: '1001',
      serial_no: '900002',
      event_timestamp: now.hour(12).minute(4).second(3).toISOString(),
      status: 'lunch_out',
      match_status: 'matched',
      picture_path: null,
      created_at: now.hour(12).minute(4).second(10).toISOString(),
      employee_id: 'emp-1',
      employee_name: baseEmployees[0].full_name,
      door: baseDoors[0]
    },
    {
      id: 'ae-3',
      card_id: '1001',
      serial_no: '900003',
      event_timestamp: now.hour(13).minute(2).second(11).toISOString(),
      status: 'lunch_return',
      match_status: 'matched',
      picture_path: null,
      created_at: now.hour(13).minute(2).second(18).toISOString(),
      employee_id: 'emp-1',
      employee_name: baseEmployees[0].full_name,
      door: baseDoors[1]
    },
    {
      id: 'ae-4',
      card_id: '1001',
      serial_no: '900004',
      event_timestamp: now.hour(18).minute(5).second(34).toISOString(),
      status: 'on_time_exit',
      match_status: 'matched',
      picture_path: null,
      created_at: now.hour(18).minute(5).second(40).toISOString(),
      employee_id: 'emp-1',
      employee_name: baseEmployees[0].full_name,
      door: baseDoors[1]
    },
    {
      id: 'ae-5',
      card_id: '1002',
      serial_no: '900005',
      event_timestamp: now.hour(9).minute(1).second(2).toISOString(),
      status: 'on_time',
      match_status: 'matched',
      picture_path: null,
      created_at: now.hour(9).minute(1).second(9).toISOString(),
      employee_id: 'emp-2',
      employee_name: baseEmployees[1].full_name,
      door: baseDoors[0]
    }
  ],
  workPermissions: [
    {
      id: 'perm-1',
      permission_date: today,
      start_time: '11:00',
      end_time: '12:10',
      reason: 'Tashqi uchrashuv',
      permission_type: 'task',
      status: 'approved',
      created_at: now.subtract(1, 'day').toISOString(),
      employee: { id: 'emp-1', full_name: baseEmployees[0].full_name }
    }
  ],
  computers: [
    {
      id: 'comp-1',
      hostname: 'WORKPLUS-OPS-01',
      mac_address: 'A8:7B:9D:11:22:33',
      ip_address: '192.168.30.51',
      os_name: 'Windows 11',
      agent_version: '1.0.0',
      is_active: true,
      last_seen_at: now.subtract(30, 'seconds').toISOString(),
      created_at: createdAtBase,
      connection_status: 'online',
      employee: { id: 'emp-1', full_name: baseEmployees[0].full_name }
    },
    {
      id: 'comp-2',
      hostname: 'WORKPLUS-IT-02',
      mac_address: 'A8:7B:9D:44:55:66',
      ip_address: '192.168.30.52',
      os_name: 'macOS 14',
      agent_version: '1.0.1',
      is_active: true,
      last_seen_at: now.subtract(4, 'minutes').toISOString(),
      created_at: createdAtBase,
      connection_status: 'offline',
      employee: { id: 'emp-2', full_name: baseEmployees[1].full_name }
    }
  ],
  computerActivity: [
    {
      id: 'act-1',
      computer_id: 'comp-1',
      employee_id: 'emp-1',
      app_name: 'Chrome',
      window_title: 'WorkPlus Admin Panel',
      url: 'https://workplus.local/dashboard',
      started_at: now.subtract(2, 'hours').minute(10).second(0).millisecond(0).toISOString(),
      ended_at: now.subtract(2, 'hours').minute(55).second(0).millisecond(0).toISOString(),
      duration_seconds: 2700,
      created_at: now.subtract(2, 'hours').toISOString()
    },
    {
      id: 'act-2',
      computer_id: 'comp-1',
      employee_id: 'emp-1',
      app_name: 'VS Code',
      window_title: 'attendance.py',
      url: null,
      started_at: now.subtract(1, 'hours').minute(5).second(0).millisecond(0).toISOString(),
      ended_at: now.subtract(1, 'hours').minute(48).second(0).millisecond(0).toISOString(),
      duration_seconds: 2580,
      created_at: now.subtract(1, 'hours').toISOString()
    },
    {
      id: 'act-3',
      computer_id: 'comp-2',
      employee_id: 'emp-2',
      app_name: 'YouTube',
      window_title: 'UX reference',
      url: 'https://youtube.com/watch?v=demo',
      started_at: now.subtract(3, 'hours').minute(0).second(0).millisecond(0).toISOString(),
      ended_at: now.subtract(3, 'hours').minute(20).second(0).millisecond(0).toISOString(),
      duration_seconds: 1200,
      created_at: now.subtract(3, 'hours').toISOString()
    }
  ]
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function paginate<T>(items: T[], page = 1, limit = 10) {
  const start = (page - 1) * limit;
  return items.slice(start, start + limit);
}

function listMeta(total: number, page = 1, limit = 10) {
  return { page, limit, total };
}

function matchDate(value: string, date: string) {
  return dayjs(value).format('YYYY-MM-DD') === date;
}

function siteFromUrl(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}

function computeEmployeeTimeline(employeeId: string, date: string) {
  const events = state.attendanceEvents
    .filter((item) => item.employee_id === employeeId && matchDate(item.event_timestamp, date))
    .sort((a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime());
  const permissions = state.workPermissions.filter(
    (item) => item.employee?.id === employeeId && item.permission_date === date && item.status === 'approved'
  );
  const computerActivity = state.computerActivity.filter(
    (item) => item.employee_id === employeeId && matchDate(item.started_at, date)
  );

  const segments: AnyRecord[] = [];
  let openEntry: string | null = null;
  events.forEach((event) => {
    const time = dayjs(event.event_timestamp);
    if (event.door.event_type === 'entry') {
      openEntry = time.toISOString();
    } else if (openEntry) {
      segments.push({
        type: 'work',
        label: 'Ish joyida',
        start: dayjs(openEntry).format('HH:mm'),
        end: time.format('HH:mm'),
        start_full: dayjs(openEntry).format('HH:mm:ss'),
        end_full: time.format('HH:mm:ss'),
        color: 'emerald'
      });
      openEntry = null;
    }
  });

  permissions.forEach((item) => {
    segments.push({
      type: 'permission',
      label: item.permission_type,
      start: item.start_time.slice(0, 5),
      end: item.end_time.slice(0, 5),
      start_full: item.start_time,
      end_full: item.end_time,
      color: 'gray',
      reason: item.reason
    });
  });

  const markers = events.map((event) => ({
    type: event.door.event_type,
    label: event.door.event_type === 'entry' ? 'Kirish' : 'Chiqish',
    time: dayjs(event.event_timestamp).format('HH:mm'),
    full_time: dayjs(event.event_timestamp).format('HH:mm:ss'),
    status: event.status,
    color: event.status === 'late' || event.status === 'early_exit' ? 'red' : 'green',
    door_name: event.door.name
  }));

  return {
    employee: state.employees.find((item) => item.id === employeeId)?.full_name
      ? { id: employeeId, full_name: state.employees.find((item) => item.id === employeeId)?.full_name }
      : { id: employeeId, full_name: 'Unknown' },
    date,
    segments,
    markers,
    computer_activity: computerActivity.map((item) => {
      const value = `${item.app_name} ${item.url || ''}`.toLowerCase();
      const category = value.includes('youtube') || value.includes('instagram')
        ? 'social'
        : value.includes('code') || value.includes('figma') || value.includes('excel')
          ? 'work'
          : value.includes('chrome') || value.includes('safari') || value.includes('edge')
            ? 'browser'
            : 'neutral';
      const color = category === 'social' ? 'rose' : category === 'work' ? 'emerald' : category === 'browser' ? 'sky' : 'slate';
      return {
        id: item.id,
        app_name: item.app_name,
        window_title: item.window_title,
        url: item.url,
        started_at: item.started_at,
        ended_at: item.ended_at,
        duration_seconds: item.duration_seconds,
        color,
        category
      };
    }),
    summary: {
      first_entry: markers.find((item) => item.type === 'entry')?.time ?? null,
      last_exit: [...markers].reverse().find((item) => item.type === 'exit')?.time ?? null,
      attendance_event_count: events.length,
      attendance_segment_count: segments.filter((item) => item.type === 'work').length,
      permission_segment_count: permissions.length,
      computer_activity_count: computerActivity.length,
      work_seconds: segments
        .filter((item) => item.type === 'work')
        .reduce((sum, item) => sum + Math.max(dayjs(`2000-01-01 ${item.end}`).diff(dayjs(`2000-01-01 ${item.start}`), 'second'), 0), 0),
      permission_seconds: permissions.reduce((sum, item) => sum + Math.max(dayjs(`2000-01-01 ${item.end_time}`).diff(dayjs(`2000-01-01 ${item.start_time}`), 'second'), 0), 0),
      computer_seconds: computerActivity.reduce((sum, item) => sum + item.duration_seconds, 0)
    }
  };
}

function buildAttendanceDaily(employeeId?: string, employeeName?: string, dateFrom?: string, dateTo?: string) {
  const rows = state.employees
    .filter((employee) => employee.is_active)
    .filter((employee) => (employeeId ? employee.id === employeeId : true))
    .filter((employee) => (employeeName ? employee.full_name.toLowerCase().includes(employeeName.toLowerCase()) : true))
    .flatMap((employee) => {
      const dates = [dateFrom || today, dateTo || today];
      const dateSet = new Set(dates.filter(Boolean));
      return [...dateSet].map((date) => {
        const timeline = computeEmployeeTimeline(employee.id, date);
        return {
          id: `${employee.id}:${date}`,
          date,
          employee: { id: employee.id, full_name: employee.full_name },
          first_entry: timeline.summary?.first_entry ?? null,
          first_entry_full: timeline.summary?.first_entry ? `${timeline.summary.first_entry}:00` : null,
          last_exit: timeline.summary?.last_exit ?? null,
          last_exit_full: timeline.summary?.last_exit ? `${timeline.summary.last_exit}:00` : null,
          statuses: timeline.markers.map((marker) => marker.status),
          markers: timeline.markers.map((marker) => ({
            type: marker.type,
            label: marker.label,
            time: marker.time,
            full_time: marker.full_time,
            status: marker.status,
            color: marker.color,
            door_name: marker.door_name
          })),
          segments: timeline.segments,
          computer_activity_count: timeline.summary?.computer_activity_count ?? timeline.computer_activity.length,
          computer_seconds: timeline.summary?.computer_seconds ?? 0,
          top_apps: [...new Set(timeline.computer_activity.map((item) => item.app_name))].slice(0, 3),
          top_sites: [...new Set(timeline.computer_activity.map((item) => siteFromUrl(item.url)))]
            .filter((item): item is string => Boolean(item))
            .slice(0, 3)
        };
      });
    });
  return rows;
}

function buildAttendanceSummary(dateFrom: string, dateTo: string) {
  const rows = state.attendanceEvents.filter((item) => {
    const d = dayjs(item.event_timestamp);
    return d.valueOf() >= dayjs(dateFrom).startOf('day').valueOf() && d.valueOf() <= dayjs(dateTo).endOf('day').valueOf();
  });
  return {
    date_from: dateFrom,
    date_to: dateTo,
    total_events: rows.length,
    active_employees: state.employees.filter((item) => item.is_active).length,
    on_time: rows.filter((item) => item.status === 'on_time').length,
    late: rows.filter((item) => item.status === 'late').length,
    early_exit: rows.filter((item) => item.status === 'early_exit').length,
    on_time_exit: rows.filter((item) => item.status === 'on_time_exit').length,
    lunch_out: rows.filter((item) => item.status === 'lunch_out').length,
    lunch_return: rows.filter((item) => item.status === 'lunch_return').length,
    unmatched: rows.filter((item) => item.status === 'unmatched_employee').length,
    ambiguous: rows.filter((item) => item.status === 'ambiguous_employee').length,
    permissions: state.workPermissions.filter((item) => item.status === 'approved').length
  };
}

function buildComputerAnalytics(dateFrom: string, dateTo: string, employeeId?: string) {
  const rows = state.computerActivity.filter((item) => {
    const d = dayjs(item.started_at);
    const dateOk = d.valueOf() >= dayjs(dateFrom).startOf('day').valueOf() && d.valueOf() <= dayjs(dateTo).endOf('day').valueOf();
    const employeeOk = employeeId ? item.employee_id === employeeId : true;
    return dateOk && employeeOk;
  });

  const topAppsMap = new Map<string, { name: string; duration_seconds: number; events: number }>();
  const siteMap = new Map<string, { name: string; duration_seconds: number; events: number }>();
  rows.forEach((item) => {
    const app = topAppsMap.get(item.app_name) ?? { name: item.app_name, duration_seconds: 0, events: 0 };
    app.duration_seconds += item.duration_seconds;
    app.events += 1;
    topAppsMap.set(item.app_name, app);

    const site = siteFromUrl(item.url);
    if (site) {
      const current = siteMap.get(site) ?? { name: site, duration_seconds: 0, events: 0 };
      current.duration_seconds += item.duration_seconds;
      current.events += 1;
      siteMap.set(site, current);
    }
  });

  return {
    date_from: dateFrom,
    date_to: dateTo,
    total_duration_seconds: rows.reduce((sum, item) => sum + item.duration_seconds, 0),
    active_computers: state.computers.filter((item) => item.is_active).length,
    online_computers: state.computers.filter((item) => item.connection_status === 'online').length,
    offline_computers: state.computers.filter((item) => item.connection_status !== 'online').length,
    top_apps: [...topAppsMap.values()].sort((a, b) => b.duration_seconds - a.duration_seconds).slice(0, 10),
    top_sites: [...siteMap.values()].sort((a, b) => b.duration_seconds - a.duration_seconds).slice(0, 10),
    recent_activity: rows
      .slice()
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 20)
  };
}

export const mockApi = {
  isEnabled() {
    return false;
  },
  me() {
    return clone(state.admins[0]);
  },
  listAdmins(params?: { page?: number; limit?: number; role?: string }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 10;
    const items = state.admins.filter((item) => (params?.role ? item.role === params.role : true));
    return {
      meta: {
        total_items: items.length,
        total_pages: Math.max(1, Math.ceil(items.length / limit)),
        current_page: page,
        limit,
        has_next: page * limit < items.length,
        has_prev: page > 1,
        next_page: page * limit < items.length ? page + 1 : null,
        prev_page: page > 1 ? page - 1 : null
      },
      data: paginate(items, page, limit).map(clone)
    };
  },
  listDepartments() {
    return clone(state.departments);
  },
  listPositions() {
    return clone(state.positions);
  },
  listEmployees(params: { page: number; limit: number; department_id?: string; is_active?: boolean }) {
    const items = state.employees.filter((item) => (params.department_id ? item.department.id === params.department_id : true))
      .filter((item) => (typeof params.is_active === 'boolean' ? item.is_active === params.is_active : true));
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    return {
      meta: listMeta(items.length, page, limit),
      data: paginate(items, page, limit).map(clone)
    };
  },
  getEmployee(employeeId: string) {
    return clone(state.employees.find((item) => item.id === employeeId) ?? state.employees[0]);
  },
  createEmployee(body: { full_name: string; department_id: string; position_id: string; is_active?: boolean }) {
    const employee = {
      id: `emp-${Date.now()}`,
      full_name: body.full_name,
      is_active: body.is_active ?? true,
      created_at: new Date().toISOString(),
      department: state.departments.find((item) => item.id === body.department_id) ?? state.departments[0],
      position: state.positions.find((item) => item.id === body.position_id) ?? state.positions[0]
    };
    state.employees.unshift(employee);
    return clone(employee);
  },
  updateEmployee(employeeId: string, body: Partial<{ full_name: string; department_id: string; position_id: string; is_active: boolean }>) {
    const idx = state.employees.findIndex((item) => item.id === employeeId);
    if (idx >= 0) {
      state.employees[idx] = {
        ...state.employees[idx],
        ...(body.full_name ? { full_name: body.full_name } : {}),
        ...(typeof body.is_active === 'boolean' ? { is_active: body.is_active } : {}),
        ...(body.department_id ? { department: state.departments.find((item) => item.id === body.department_id) ?? state.departments[0] } : {}),
        ...(body.position_id ? { position: state.positions.find((item) => item.id === body.position_id) ?? state.positions[0] } : {})
      };
    }
    return clone(state.employees[idx] ?? state.employees[0]);
  },
  deleteEmployee(employeeId: string) {
    state.employees = state.employees.filter((item) => item.id !== employeeId);
    return { message: 'ok' };
  },
  listDoors(params: { page: number; limit: number }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    return { meta: listMeta(state.doors.length, page, limit), data: paginate(state.doors, page, limit).map(clone) };
  },
  getDoor(doorId: string) {
    return clone(state.doors.find((item) => item.id === doorId) ?? state.doors[0]);
  },
  createDoor(body: { name: string; ip_address: string; event_type: string; is_active?: boolean }) {
    const door = { id: `door-${Date.now()}`, ...body, is_active: body.is_active ?? true, created_at: new Date().toISOString(), connection_status: 'online' };
    state.doors.unshift(door);
    return clone(door);
  },
  updateDoor(doorId: string, body: Partial<{ name: string; ip_address: string; event_type: string; is_active: boolean }>) {
    const idx = state.doors.findIndex((item) => item.id === doorId);
    if (idx >= 0) state.doors[idx] = { ...state.doors[idx], ...body };
    return clone(state.doors[idx] ?? state.doors[0]);
  },
  deleteDoor(doorId: string) {
    state.doors = state.doors.filter((item) => item.id !== doorId);
    return { message: 'ok' };
  },
  getAttendancePolicy() {
    return clone(state.attendancePolicy);
  },
  upsertAttendancePolicy(body: AnyRecord) {
    state.attendancePolicy = { id: 1, ...body, created_at: state.attendancePolicy?.created_at ?? new Date().toISOString(), updated_at: new Date().toISOString() };
    return clone(state.attendancePolicy);
  },
  listAttendanceEvents(params: AnyRecord) {
    const items = state.attendanceEvents.filter((item) => (params.employee_id ? item.employee_id === params.employee_id : true));
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    return { meta: listMeta(items.length, page, limit), data: paginate(items, page, limit).map(clone) };
  },
  listAttendanceDaily(params: AnyRecord) {
    const items = buildAttendanceDaily(params.employee_id, params.employee_name, params.date_from ?? today, params.date_to ?? today);
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    return { meta: listMeta(items.length, page, limit), data: paginate(items, page, limit).map(clone) };
  },
  getAttendanceEvent(eventId: string) {
    return clone(state.attendanceEvents.find((item) => item.id === eventId) ?? state.attendanceEvents[0]);
  },
  createAttendanceEvent(body: AnyRecord) {
    const employee = state.employees.find((item) => item.full_name === body.employee_name) ?? state.employees[0];
    const event = {
      id: `ae-${Date.now()}`,
      card_id: body.card_id ?? null,
      serial_no: body.serial_no ?? null,
      event_timestamp: body.event_timestamp,
      status: 'on_time',
      match_status: 'matched',
      picture_path: body.picture_path ?? null,
      created_at: new Date().toISOString(),
      employee_id: employee?.id ?? null,
      employee_name: employee?.full_name ?? body.employee_name,
      door: state.doors[0]
    };
    state.attendanceEvents.unshift(event);
    return clone(event);
  },
  updateAttendanceEvent(eventId: string, body: AnyRecord) {
    const idx = state.attendanceEvents.findIndex((item) => item.id === eventId);
    if (idx >= 0) state.attendanceEvents[idx] = { ...state.attendanceEvents[idx], ...body };
    return clone(state.attendanceEvents[idx] ?? state.attendanceEvents[0]);
  },
  deleteAttendanceEvent(eventId: string) {
    state.attendanceEvents = state.attendanceEvents.filter((item) => item.id !== eventId);
    return { message: 'ok' };
  },
  getPollerStatus() {
    return {
      running: true,
      poll_interval_seconds: 5,
      active_doors: state.doors.length,
      last_tick_at: now.toISOString(),
      last_error: null
    };
  },
  createWorkPermission(body: AnyRecord) {
    const permission = {
      id: `perm-${Date.now()}`,
      permission_date: body.permission_date,
      start_time: body.start_time,
      end_time: body.end_time,
      reason: body.reason,
      permission_type: body.permission_type,
      status: body.status,
      created_at: new Date().toISOString(),
      employee: state.employees.find((item) => item.id === body.employee_id) ?? { id: body.employee_id, full_name: 'Unknown' }
    };
    state.workPermissions.unshift(permission);
    return clone(permission);
  },
  listWorkPermissions(params: AnyRecord) {
    const items = state.workPermissions.filter((item) => (params.employee_id ? item.employee.id === params.employee_id : true));
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    return { meta: listMeta(items.length, page, limit), data: paginate(items, page, limit).map(clone) };
  },
  updateWorkPermission(permissionId: string, body: AnyRecord) {
    const idx = state.workPermissions.findIndex((item) => item.id === permissionId);
    if (idx >= 0) state.workPermissions[idx] = { ...state.workPermissions[idx], ...body };
    return clone(state.workPermissions[idx] ?? state.workPermissions[0]);
  },
  deleteWorkPermission(permissionId: string) {
    state.workPermissions = state.workPermissions.filter((item) => item.id !== permissionId);
    return { message: 'ok' };
  },
  getAttendanceSummary(params: AnyRecord) {
    return buildAttendanceSummary(params.date_from, params.date_to);
  },
  getEmployeeTimeline(params: { employee_id: string; date: string }) {
    return computeEmployeeTimeline(params.employee_id, params.date);
  },
  listComputers(params: AnyRecord) {
    const items = state.computers
      .filter((item) => (params.employee_id ? item.employee?.id === params.employee_id : true))
      .filter((item) => (typeof params.is_active === 'boolean' ? item.is_active === params.is_active : true));
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    return { meta: listMeta(items.length, page, limit), data: paginate(items, page, limit).map(clone) };
  },
  createComputer(body: AnyRecord) {
    const employee = body.employee_id
      ? state.employees.find((item) => item.id === body.employee_id) ?? null
      : null;
    const computer = {
      id: `comp-${Date.now()}`,
      hostname: body.hostname,
      mac_address: body.mac_address,
      ip_address: body.ip_address ?? null,
      os_name: body.os_name ?? null,
      agent_version: body.agent_version ?? null,
      is_active: body.is_active ?? true,
      last_seen_at: null,
      created_at: new Date().toISOString(),
      connection_status: 'unknown',
      employee: employee ? { id: employee.id, full_name: employee.full_name } : null
    };
    state.computers.unshift(computer);
    return clone(computer);
  },
  updateComputer(computerId: string, body: AnyRecord) {
    const idx = state.computers.findIndex((item) => item.id === computerId);
    if (idx >= 0) {
      const employee = body.employee_id
        ? state.employees.find((item) => item.id === body.employee_id) ?? null
        : body.employee_id === null
          ? null
          : state.computers[idx].employee;
      state.computers[idx] = {
        ...state.computers[idx],
        ...body,
        employee
      };
    }
    return clone(state.computers[idx] ?? state.computers[0]);
  },
  deleteComputer(computerId: string) {
    state.computers = state.computers.map((item) =>
      item.id === computerId ? { ...item, is_active: false, connection_status: 'offline' } : item
    );
    return { message: 'ok' };
  },
  assignComputer(computerId: string, body: AnyRecord) {
    const idx = state.computers.findIndex((item) => item.id === computerId);
    if (idx >= 0) {
      const employee = state.employees.find((item) => item.id === body.employee_id) ?? null;
      state.computers[idx] = { ...state.computers[idx], employee };
    }
    return clone(state.computers[idx] ?? state.computers[0]);
  },
  listComputerActivity(params: AnyRecord) {
    const items = state.computerActivity.filter((item) => (params.employee_id ? item.employee_id === params.employee_id : true));
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    return { meta: listMeta(items.length, page, limit), data: paginate(items, page, limit).map(clone) };
  },
  getComputerAnalytics(params: AnyRecord) {
    return buildComputerAnalytics(params.date_from, params.date_to, params.employee_id);
  }
};
