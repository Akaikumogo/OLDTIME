import axios, { type AxiosInstance } from 'axios';
import { notification } from 'antd';

export const API_BASE_URL = '';
export const BACKEND_ORIGIN =
  typeof window === 'undefined' ? '' : window.location.origin;

const TOKEN_KEYS = {
  access: 'accessToken',
  refresh: 'refreshToken',
  user: 'user',
  isLoggedIn: 'isLoggedIn'
} as const;

type ApiErrorBody = { detail?: string; message?: string } | unknown;

function readStoredValue(key: string) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

// Toast spam'ni oldini olish: bir xil xabarni 3 sekund ichida takror chiqarmaydi
const recentNotifications = new Map<string, number>();
const NOTIFICATION_DEDUP_WINDOW_MS = 3000;

function shouldNotify(key: string): boolean {
  const now = Date.now();
  const last = recentNotifications.get(key);
  if (last !== undefined && now - last < NOTIFICATION_DEDUP_WINDOW_MS) {
    return false;
  }
  recentNotifications.set(key, now);
  // Eski yozuvlarni tozalash (xotira o'sib ketmasligi uchun)
  if (recentNotifications.size > 50) {
    for (const [k, t] of recentNotifications) {
      if (now - t > NOTIFICATION_DEDUP_WINDOW_MS) {
        recentNotifications.delete(k);
      }
    }
  }
  return true;
}

function showErrorNotification(error: unknown) {
  if (!axios.isAxiosError(error)) {
    const msg = String(error);
    if (!shouldNotify(`generic:${msg}`)) return;
    notification.error({
      message: 'Kutilmagan xato',
      description: msg,
      placement: 'topRight',
      duration: 4
    });
    return;
  }

  const status = error.response?.status ?? 0;
  if (status === 401) return;

  const data = error.response?.data as ApiErrorBody;
  const msg =
    (typeof (data as { detail?: unknown })?.detail === 'string' &&
      (data as { detail: string }).detail) ||
    (typeof (data as { message?: unknown })?.message === 'string' &&
      (data as { message: string }).message) ||
    error.message ||
    'Noma`lum xato yuz berdi';

  if (!shouldNotify(`${status}:${msg}`)) return;

  notification.error({
    message: status ? `Xato (${status})` : 'Network xato',
    description: msg,
    placement: 'topRight',
    duration: 5
  });
}

export type AuthUser = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer' | string;
  user: AuthUser;
};

export type MessageResponse = { message: string };
export type OperationsStatus = {
  backup: {
    configured: boolean;
    exists: boolean;
    path?: string;
    file_count?: number;
    latest_file?: {
      name: string;
      size_bytes: number;
      modified_at: number;
    } | null;
  };
  logs: {
    configured: boolean;
    exists: boolean;
    path?: string;
    file_count?: number;
    latest_file?: {
      name: string;
      size_bytes: number;
      modified_at: number;
    } | null;
  };
  database: {
    backup_dir_env: boolean;
    log_dir_env: boolean;
  };
};

export type AdminEnvelope = { message: string; admin: AuthUser };
export type AdminListMeta = {
  total_items: number;
  total_pages: number;
  current_page: number;
  limit: number;
  has_next: boolean;
  has_prev: boolean;
  next_page: number | null;
  prev_page: number | null;
};
export type AdminListResponse = { meta: AdminListMeta; data: AuthUser[] };

export type Department = { id: string; name: string; created_at: string };
export type DepartmentEnvelope = { message: string; data: Department };
export type DepartmentListResponse = { data: Department[] };
export type DepartmentResponse = Department;

export type Position = { id: string; name: string; created_at: string };
export type PositionEnvelope = { message: string; data: Position };
export type PositionListResponse = { data: Position[] };
export type PositionResponse = Position;

export type Employee = {
  id: string;
  full_name: string;
  employee_code?: string | null;
  email?: string | null;
  phone_number?: string | null;
  is_active: boolean;
  created_at: string;
  photo_url?: string | null;
  department: { id: string; name: string };
  position: { id: string; name: string };
};
export type EmployeeEnvelope = { message: string; data: Employee };
export type EmployeeListMeta = { page: number; limit: number; total: number };
export type EmployeeListResponse = { meta: EmployeeListMeta; data: Employee[] };
export type EmployeeResponse = Employee;

export type Door = {
  id: string;
  name: string;
  ip_address: string;
  event_type: string;
  is_active: boolean;
  created_at: string;
  connection_status?: 'online' | 'offline' | 'unknown' | string;
  last_checked_at?: string | null;
  last_success_at?: string | null;
  last_error?: string | null;
};
export type DoorEnvelope = { message: string; data: Door };
export type DoorListMeta = { page: number; limit: number; total: number };
export type DoorListResponse = { meta: DoorListMeta; data: Door[] };
export type DoorResponse = Door;

export type AttendancePolicy = {
  id: string;
  work_start_time: string;
  work_end_time: string;
  lunch_start_time: string;
  lunch_end_time: string;
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type AttendancePolicyEnvelope = {
  message: string;
  data: AttendancePolicy;
};
export type AttendancePolicyResponse = { data: AttendancePolicy | null };

export type AttendanceEvent = {
  id: string;
  card_id: string | null;
  serial_no: string | null;
  event_timestamp: string;
  status: string | null;
  match_status: string | null;
  picture_path: string | null;
  picture_url: string | null;
  created_at: string;
  employee_id: string | null;
  employee_name: string | null;
  employee: { id: string | null; full_name: string } | null;
  door: { id: string; name: string; ip_address: string; event_type: string };
};
export type AttendanceEventEnvelope = {
  message: string;
  data: AttendanceEvent;
};
export type AttendanceEventListMeta = {
  page: number;
  limit: number;
  total: number;
};
export type AttendanceEventListResponse = {
  meta: AttendanceEventListMeta;
  data: AttendanceEvent[];
};
export type AttendanceEventResponse = AttendanceEvent;

export type AttendanceDailyMarker = {
  type: 'entry' | 'exit' | string;
  label: string;
  time: string;
  full_time: string;
  status: string;
  color: string;
  door_name: string;
};

export type AttendanceDailySegment = {
  type: string;
  label: string;
  start: string;
  end: string;
  start_full: string;
  end_full: string;
  color: string;
  reason?: string | null;
};

export type AttendanceDailyRow = {
  id: string;
  date: string;
  employee: { id: string; full_name: string };
  first_entry?: string | null;
  first_entry_full?: string | null;
  last_exit?: string | null;
  last_exit_full?: string | null;
  statuses: string[];
  markers: AttendanceDailyMarker[];
  segments: AttendanceDailySegment[];
  computer_activity_count?: number;
  computer_seconds?: number;
  top_apps?: string[];
  top_sites?: string[];
};
export type AttendanceDailyListResponse = {
  meta: AttendanceEventListMeta;
  data: AttendanceDailyRow[];
};

export type HikvisionPollerStatusResponse = {
  running: boolean;
  poll_interval_seconds: number;
  active_doors: number;
  last_tick_at?: string | null;
  last_error?: string | null;
};

export type WorkPermission = {
  id: string;
  permission_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  permission_type: string;
  status: string;
  created_at: string;
  employee: { id: string; full_name: string };
};
export type WorkPermissionEnvelope = { message: string; data: WorkPermission };
export type WorkPermissionListResponse = {
  meta: AttendanceEventListMeta;
  data: WorkPermission[];
};

export type ReportSummary = {
  date_from: string;
  date_to: string;
  total_events: number;
  active_employees: number;
  on_time: number;
  late: number;
  early_exit: number;
  on_time_exit: number;
  lunch_out: number;
  lunch_return: number;
  unmatched: number;
  ambiguous: number;
  permissions: number;
};

export type TimelineSegment = {
  type: string;
  label: string;
  start: string;
  end: string;
  color: string;
  reason?: string | null;
};

export type TimelineMarker = {
  type: string;
  label: string;
  time: string;
  status: string;
  color: string;
  door_name: string;
};

export type EmployeeTimelineComputerActivity = {
  id: string;
  app_name: string;
  window_title?: string | null;
  url?: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  color: string;
  category: string;
};

export type EmployeeTimelineSummary = {
  first_entry?: string | null;
  last_exit?: string | null;
  attendance_event_count: number;
  attendance_segment_count: number;
  permission_segment_count: number;
  computer_activity_count: number;
  work_seconds: number;
  permission_seconds: number;
  computer_seconds: number;
};

export type EmployeeTimeline = {
  employee: { id: string; full_name: string };
  date: string;
  segments: TimelineSegment[];
  markers: TimelineMarker[];
  computer_activity: EmployeeTimelineComputerActivity[];
  summary?: EmployeeTimelineSummary | null;
};

export type Computer = {
  id: string;
  device_id?: string | null;
  hostname: string;
  mac_address: string;
  ip_address?: string | null;
  os_name?: string | null;
  agent_version?: string | null;
  is_active: boolean;
  last_seen_at?: string | null;
  created_at: string;
  connection_status?: 'online' | 'offline' | 'unknown' | string;
  employee?: { id: string; full_name: string } | null;
};
export type ComputerEnvelope = { message: string; data: Computer };
export type ComputerListResponse = {
  meta: AttendanceEventListMeta;
  data: Computer[];
};

export type ComputerActivity = {
  id: string;
  device_id?: string | null;
  computer_id: string;
  employee_id?: string | null;
  computer?: { id: string; hostname: string } | null;
  employee?: { id: string; full_name: string } | null;
  app_name: string;
  window_title?: string | null;
  url?: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  created_at: string;
};
export type ComputerActivityListResponse = {
  meta: AttendanceEventListMeta;
  data: ComputerActivity[];
};

export type ComputerUsageStat = {
  name: string;
  duration_seconds: number;
  events: number;
};

export type ComputerAnalytics = {
  date_from: string;
  date_to: string;
  total_duration_seconds: number;
  active_computers: number;
  online_computers: number;
  offline_computers: number;
  top_apps: ComputerUsageStat[];
  top_sites: ComputerUsageStat[];
  recent_activity: ComputerActivity[];
};

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      headers: { 'Content-Type': 'application/json' }
    });

    this.api.interceptors.request.use((config) => {
      const accessToken = readStoredValue(TOKEN_KEYS.access);
      if (accessToken) {
        config.headers = config.headers || {};
        (config.headers as Record<string, string>).Authorization =
          `Bearer ${accessToken}`;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error: unknown) => {
        if (!axios.isAxiosError(error)) {
          showErrorNotification(error);
          return Promise.reject(error);
        }

        const originalRequest = error.config as
          | (typeof error.config & { _retry?: boolean })
          | undefined;
        const status = error.response?.status;
        const requestUrl = originalRequest?.url || '';
        const isAuthRequest =
          requestUrl.includes('/admin/login') ||
          requestUrl.includes('/admin/refresh');

        if (
          status === 401 &&
          originalRequest &&
          !originalRequest._retry &&
          !isAuthRequest
        ) {
          originalRequest._retry = true;
          try {
            const accessToken = await this.refreshAccessToken();
            originalRequest.headers = originalRequest.headers || {};
            (originalRequest.headers as Record<string, string>).Authorization =
              `Bearer ${accessToken}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            this.clearSession();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        showErrorNotification(error);
        return Promise.reject(error);
      }
    );
  }

  private setSession(login: LoginResponse) {
    localStorage.setItem(TOKEN_KEYS.access, login.access_token);
    localStorage.setItem(TOKEN_KEYS.refresh, login.refresh_token);
    localStorage.setItem(TOKEN_KEYS.user, JSON.stringify(login.user));
    localStorage.setItem(TOKEN_KEYS.isLoggedIn, 'true');
  }

  clearSession() {
    localStorage.removeItem(TOKEN_KEYS.access);
    localStorage.removeItem(TOKEN_KEYS.refresh);
    localStorage.removeItem(TOKEN_KEYS.user);
    localStorage.removeItem(TOKEN_KEYS.isLoggedIn);
    sessionStorage.removeItem(TOKEN_KEYS.access);
    sessionStorage.removeItem(TOKEN_KEYS.refresh);
    sessionStorage.removeItem(TOKEN_KEYS.user);
    sessionStorage.removeItem(TOKEN_KEYS.isLoggedIn);
  }

  async login(username: string, password: string) {
    const { data } = await this.api.post<LoginResponse>('/admin/login', {
      username,
      password
    });
    this.setSession(data);
    return data.user;
  }

  private async refreshAccessToken(): Promise<string> {
    const refreshToken = readStoredValue(TOKEN_KEYS.refresh);
    if (!refreshToken) throw new Error('No refresh token');

    const { data } = await axios.post<{
      access_token: string;
      token_type: string;
    }>('/admin/refresh', { refresh_token: refreshToken }, {
      headers: { 'Content-Type': 'application/json' }
    });

    localStorage.setItem(TOKEN_KEYS.access, data.access_token);
    return data.access_token;
  }

  async me(): Promise<AuthUser> {
    const { data } = await this.api.get<AdminEnvelope>('/me');
    return data.admin;
  }

  async listAdmins(params?: { page?: number; limit?: number; role?: string }) {
    const { data } = await this.api.get<AdminListResponse>('/admins', {
      params
    });
    return data;
  }

  async createAdmin(body: {
    full_name: string;
    username: string;
    email: string;
    password: string;
    role?: string;
  }) {
    const { data } = await this.api.post<AdminEnvelope>('/admin/create', body);
    return data.admin;
  }

  async updateAdmin(
    adminId: string,
    body: Partial<
      Pick<AuthUser, 'full_name' | 'username' | 'email' | 'role' | 'is_active'>
    >
  ) {
    const { data } = await this.api.patch<AdminEnvelope>(
      `/admin/${adminId}`,
      body
    );
    return data.admin;
  }

  async deleteAdmin(adminId: string) {
    const { data } = await this.api.delete<MessageResponse>(
      `/admin/${adminId}`
    );
    return data;
  }

  async getOperationsStatus() {
    const { data } = await this.api.get<OperationsStatus>(
      '/system/operations-status'
    );
    return data;
  }

  async listDepartments() {
    const { data } = await this.api.get<DepartmentListResponse>('/departments');
    return data.data;
  }

  async getDepartment(departmentId: string) {
    const { data } = await this.api.get<DepartmentResponse>(
      `/departments/${departmentId}`
    );
    return data;
  }

  async createDepartment(body: { name: string }) {
    const { data } = await this.api.post<DepartmentEnvelope>(
      '/departments',
      body
    );
    return data.data;
  }

  async updateDepartment(departmentId: string, body: { name: string }) {
    const { data } = await this.api.patch<DepartmentEnvelope>(
      `/departments/${departmentId}`,
      body
    );
    return data.data;
  }

  async deleteDepartment(departmentId: string) {
    const { data } = await this.api.delete<MessageResponse>(
      `/departments/${departmentId}`
    );
    return data;
  }

  async listPositions() {
    const { data } = await this.api.get<PositionListResponse>('/positions');
    return data.data;
  }

  async getPosition(positionId: string) {
    const { data } = await this.api.get<PositionResponse>(
      `/positions/${positionId}`
    );
    return data;
  }

  async createPosition(body: { name: string }) {
    const { data } = await this.api.post<PositionEnvelope>('/positions', body);
    return data.data;
  }

  async updatePosition(positionId: string, body: { name: string }) {
    const { data } = await this.api.patch<PositionEnvelope>(
      `/positions/${positionId}`,
      body
    );
    return data.data;
  }

  async deletePosition(positionId: string) {
    const { data } = await this.api.delete<MessageResponse>(
      `/positions/${positionId}`
    );
    return data;
  }

  async listEmployees(params: {
    page: number;
    limit: number;
    department_id?: string;
    is_active?: boolean;
    sort?: 'created_at' | 'name';
    order?: 'asc' | 'desc';
  }) {
    const { data } = await this.api.get<EmployeeListResponse>('/employees', {
      params
    });
    return data;
  }

  async uploadEmployeePhoto(employeeId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await this.api.post<{
      message: string;
      employee_id: string;
      filename: string;
      photo_url: string;
    }>(`/employees/${employeeId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  }

  async deleteEmployeePhoto(employeeId: string) {
    const { data } = await this.api.delete<{ message: string }>(
      `/employees/${employeeId}/photo`
    );
    return data;
  }

  async getEmployee(employeeId: string) {
    const { data } = await this.api.get<EmployeeResponse>(
      `/employees/${employeeId}`
    );
    return data;
  }

  async createEmployee(body: {
    full_name: string;
    department_id: string;
    position_id: string;
    employee_code?: string | null;
    is_active?: boolean;
  }) {
    const { data } = await this.api.post<EmployeeEnvelope>('/employees', body);
    return data.data;
  }

  async updateEmployee(
    employeeId: string,
    body: Partial<{
      full_name: string;
      department_id: string;
      position_id: string;
      employee_code: string | null;
      is_active: boolean;
    }>
  ) {
    const { data } = await this.api.patch<EmployeeEnvelope>(
      `/employees/${employeeId}`,
      body
    );
    return data.data;
  }

  async deleteEmployee(employeeId: string) {
    const { data } = await this.api.delete<MessageResponse>(
      `/employees/${employeeId}`
    );
    return data;
  }

  async listDoors(params: {
    page: number;
    limit: number;
    name?: string;
    ip_address?: string;
    event_type?: string;
    is_active?: boolean;
    sort?: 'name' | 'ip_address' | 'event_type' | 'created_at';
    order?: 'asc' | 'desc';
  }) {
    const { data } = await this.api.get<DoorListResponse>('/doors', { params });
    return data;
  }

  async getDoor(doorId: string) {
    const { data } = await this.api.get<DoorResponse>(`/doors/${doorId}`);
    return data;
  }

  async createDoor(body: {
    name: string;
    ip_address: string;
    event_type: string;
    is_active?: boolean;
  }) {
    const { data } = await this.api.post<DoorEnvelope>('/doors', body);
    return data.data;
  }

  async updateDoor(
    doorId: string,
    body: Partial<{
      name: string;
      ip_address: string;
      event_type: string;
      is_active: boolean;
    }>
  ) {
    const { data } = await this.api.patch<DoorEnvelope>(
      `/doors/${doorId}`,
      body
    );
    return data.data;
  }

  async deleteDoor(doorId: string) {
    const { data } = await this.api.delete<MessageResponse>(`/doors/${doorId}`);
    return data;
  }

  async getAttendancePolicy() {
    const { data } =
      await this.api.get<AttendancePolicyResponse>('/attendance-policy');
    return data.data;
  }

  async upsertAttendancePolicy(body: {
    work_start_time: string;
    work_end_time: string;
    lunch_start_time: string | null;
    lunch_end_time: string | null;
    late_grace_minutes: number;
    early_leave_grace_minutes: number;
    is_active: boolean;
  }) {
    const { data } = await this.api.put<AttendancePolicyEnvelope>(
      '/attendance-policy',
      body
    );
    return data.data;
  }

  async listAttendanceEvents(params: {
    page: number;
    limit: number;
    employee_id?: string;
    employee_name?: string;
    door_id?: string;
    event_type?: string;
    status?: string;
    match_status?:
      | 'matched'
      | 'unmatched'
      | 'ambiguous'
      | 'unmatched_or_ambiguous';
    date_from?: string;
    date_to?: string;
    sort?: 'event_timestamp' | 'created_at' | 'employee_name' | 'status';
    order?: 'asc' | 'desc';
  }) {
    const { data } = await this.api.get<AttendanceEventListResponse>(
      '/attendance-events',
      {
        params
      }
    );
    return data;
  }

  async linkEventToEmployee(eventId: string, employeeId: string) {
    const { data } = await this.api.post<AttendanceEventEnvelope>(
      `/attendance-events/${eventId}/link-employee`,
      { employee_id: employeeId }
    );
    return data.data;
  }

  async uploadEventPhoto(eventId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await this.api.post<{
      message: string;
      event_id: string;
      picture_path: string;
      picture_url: string;
    }>(`/attendance-events/${eventId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  }

  async listAttendanceDaily(params: {
    page: number;
    limit: number;
    employee_id?: string;
    employee_name?: string;
    department_id?: string;
    event_type?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    sort?: 'date' | 'employee_name' | 'first_entry' | 'last_exit';
    order?: 'asc' | 'desc';
  }) {
    const { data } = await this.api.get<AttendanceDailyListResponse>(
      '/attendance-events/daily',
      { params }
    );
    return data;
  }

  async getAttendanceEvent(eventId: string) {
    const { data } = await this.api.get<AttendanceEventResponse>(
      `/attendance-events/${eventId}`
    );
    return data;
  }

  async createAttendanceEvent(body: {
    door_id: string;
    employee_name: string;
    event_timestamp: string;
    card_id?: string | null;
    serial_no?: string | null;
    picture_path?: string | null;
  }) {
    const { data } = await this.api.post<AttendanceEventEnvelope>(
      '/attendance-events',
      body
    );
    return data.data;
  }

  async updateAttendanceEvent(
    eventId: string,
    body: Partial<{
      door_id: string;
      employee_name: string;
      event_timestamp: string;
      card_id: string | null;
      picture_path: string | null;
      status: string | null;
    }>
  ) {
    const { data } = await this.api.patch<AttendanceEventEnvelope>(
      `/attendance-events/${eventId}`,
      body
    );
    return data.data;
  }

  async deleteAttendanceEvent(eventId: string) {
    const { data } = await this.api.delete<MessageResponse>(
      `/attendance-events/${eventId}`
    );
    return data;
  }

  async getPollerStatus() {
    const { data } = await this.api.get<HikvisionPollerStatusResponse>(
      '/attendance-poller/status'
    );
    return data;
  }

  async createWorkPermission(body: {
    employee_id: string;
    permission_date: string;
    start_time: string;
    end_time: string;
    reason: string;
    permission_type: string;
    status: string;
  }) {
    const { data } = await this.api.post<WorkPermissionEnvelope>(
      '/work-permissions',
      body
    );
    return data.data;
  }

  async listWorkPermissions(params: {
    page: number;
    limit: number;
    employee_id?: string;
    employee_name?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
  }) {
    const { data } = await this.api.get<WorkPermissionListResponse>(
      '/work-permissions',
      {
        params
      }
    );
    return data;
  }

  async updateWorkPermission(
    permissionId: string,
    body: Partial<{
      permission_date: string;
      start_time: string;
      end_time: string;
      reason: string;
      permission_type: string;
      status: string;
    }>
  ) {
    const { data } = await this.api.patch<WorkPermissionEnvelope>(
      `/work-permissions/${permissionId}`,
      body
    );
    return data.data;
  }

  async deleteWorkPermission(permissionId: string) {
    const { data } = await this.api.delete<MessageResponse>(
      `/work-permissions/${permissionId}`
    );
    return data;
  }

  async getAttendanceSummary(params: {
    date_from: string;
    date_to: string;
    department_id?: string;
    employee_id?: string;
  }) {
    const { data } = await this.api.get<ReportSummary>(
      '/reports/attendance-summary',
      {
        params
      }
    );
    return data;
  }

  async getEmployeeTimeline(params: { employee_id: string; date: string }) {
    const { data } = await this.api.get<EmployeeTimeline>(
      '/reports/employee-timeline',
      {
        params
      }
    );
    return data;
  }

  async listComputers(params: {
    page: number;
    limit: number;
    employee_id?: string;
    hostname?: string;
    is_active?: boolean;
  }) {
    const { data } = await this.api.get<ComputerListResponse>('/computers', {
      params
    });
    return data;
  }

  async createComputer(body: {
    device_id?: string | null;
    hostname: string;
    mac_address: string;
    ip_address?: string | null;
    os_name?: string | null;
    agent_version?: string | null;
    employee_id?: string | null;
    is_active?: boolean;
  }) {
    const { data } = await this.api.post<ComputerEnvelope>('/computers', body);
    return data.data;
  }

  async updateComputer(
    computerId: string,
    body: Partial<{
      hostname: string;
      device_id: string | null;
      mac_address: string;
      ip_address: string | null;
      os_name: string | null;
      agent_version: string | null;
      employee_id: string | null;
      is_active: boolean;
    }>
  ) {
    const { data } = await this.api.patch<ComputerEnvelope>(
      `/computers/${computerId}`,
      body
    );
    return data.data;
  }

  async deleteComputer(computerId: string) {
    const { data } = await this.api.delete<MessageResponse>(
      `/computers/${computerId}`
    );
    return data;
  }

  async assignComputer(
    computerId: string,
    body: { employee_id?: string | null }
  ) {
    const { data } = await this.api.patch<{ message: string; data: Computer }>(
      `/computers/${computerId}/assign`,
      body
    );
    return data.data;
  }

  async listComputerActivity(params: {
    page: number;
    limit: number;
    employee_id?: string;
    computer_id?: string;
    app_name?: string;
    date_from?: string;
    date_to?: string;
  }) {
    const { data } = await this.api.get<ComputerActivityListResponse>(
      '/computer-activity',
      { params }
    );
    return data;
  }

  async getComputerAnalytics(params: {
    date_from: string;
    date_to: string;
    employee_id?: string;
  }) {
    const { data } = await this.api.get<ComputerAnalytics>(
      '/computer-analytics',
      {
        params
      }
    );
    return data;
  }

  // ---------- Productivity / Categories ----------
  async listCategoryRules(
    scope: 'app' | 'site',
    params?: {
      department_id?: string;
      category?: 'productive' | 'unproductive' | 'neutral';
      is_active?: boolean;
    }
  ) {
    const { data } = await this.api.get<{ data: CategoryRule[] }>(
      `/categories/${scope}`,
      { params }
    );
    return data.data;
  }

  async createCategoryRule(scope: 'app' | 'site', body: CategoryRuleInput) {
    const { data } = await this.api.post<{
      message: string;
      data: CategoryRule;
    }>(`/categories/${scope}`, body);
    return data.data;
  }

  async updateCategoryRule(
    scope: 'app' | 'site',
    ruleId: string,
    body: Partial<CategoryRuleInput>
  ) {
    const { data } = await this.api.patch<{
      message: string;
      data: CategoryRule;
    }>(`/categories/${scope}/${ruleId}`, body);
    return data.data;
  }

  async deleteCategoryRule(scope: 'app' | 'site', ruleId: string) {
    const { data } = await this.api.delete<MessageResponse>(
      `/categories/${scope}/${ruleId}`
    );
    return data;
  }

  async getProductivityOverview(params: {
    date_from: string;
    date_to: string;
    employee_id?: string;
    department_id?: string;
  }) {
    const { data } = await this.api.get<ProductivityBreakdown>(
      '/reports/productivity',
      { params }
    );
    return data;
  }

  async getProductivityByEmployee(params: {
    date_from: string;
    date_to: string;
    department_id?: string;
  }) {
    const { data } = await this.api.get<EmployeeProductivityList>(
      '/reports/productivity-by-employee',
      { params }
    );
    return data;
  }

  async getProductivityByDepartment(params: {
    date_from: string;
    date_to: string;
  }) {
    const { data } = await this.api.get<DepartmentProductivityList>(
      '/reports/productivity-by-department',
      { params }
    );
    return data;
  }

  async listAppConfig() {
    const { data } = await this.api.get<{ data: AppConfigItem[] }>(
      '/app-config'
    );
    return data.data;
  }

  async updateAppConfig(key: string, value: string, description?: string) {
    const { data } = await this.api.put<AppConfigItem>(`/app-config/${key}`, {
      value,
      description
    });
    return data;
  }

  // ---------- Shifts ----------
  async listShifts(params?: { is_active?: boolean }) {
    const { data } = await this.api.get<{ data: Shift[] }>('/shifts', {
      params
    });
    return data.data;
  }

  async createShift(body: ShiftInput) {
    const { data } = await this.api.post<{ message: string; data: Shift }>(
      '/shifts',
      body
    );
    return data.data;
  }

  async updateShift(shiftId: string, body: Partial<ShiftInput>) {
    const { data } = await this.api.patch<{ message: string; data: Shift }>(
      `/shifts/${shiftId}`,
      body
    );
    return data.data;
  }

  async deleteShift(shiftId: string) {
    const { data } = await this.api.delete<MessageResponse>(
      `/shifts/${shiftId}`
    );
    return data;
  }

  async listEmployeeShifts(params?: { employee_id?: string }) {
    const { data } = await this.api.get<{ data: EmployeeShiftAssignment[] }>(
      '/employee-shifts',
      { params }
    );
    return data.data;
  }

  async assignEmployeeShift(body: {
    employee_id: string;
    shift_id: string;
    effective_from: string;
    effective_to?: string | null;
  }) {
    const { data } = await this.api.post<{
      message: string;
      data: EmployeeShiftAssignment;
    }>('/employee-shifts', body);
    return data.data;
  }

  // ---------- Holidays ----------
  async listHolidays(params?: { year?: number; holiday_type?: string }) {
    const { data } = await this.api.get<{ data: Holiday[] }>('/holidays', {
      params
    });
    return data.data;
  }

  async createHoliday(body: HolidayInput) {
    const { data } = await this.api.post<{ message: string; data: Holiday }>(
      '/holidays',
      body
    );
    return data.data;
  }

  async updateHoliday(
    holidayId: string,
    body: Partial<Omit<HolidayInput, 'holiday_date'>>
  ) {
    const { data } = await this.api.patch<{ message: string; data: Holiday }>(
      `/holidays/${holidayId}`,
      body
    );
    return data.data;
  }

  async deleteHoliday(holidayId: string) {
    const { data } = await this.api.delete<MessageResponse>(
      `/holidays/${holidayId}`
    );
    return data;
  }

  // ---------- Audit ----------
  async listRecentAudit(params?: { limit?: number; action?: string }) {
    const { data } = await this.api.get<{ data: AuditEntry[] }>(
      '/audit/attendance-events/recent',
      { params }
    );
    return data.data;
  }

  async listAuditForEvent(eventId: string) {
    const { data } = await this.api.get<{ data: AuditEntry[] }>(
      `/audit/attendance-events/${eventId}`
    );
    return data.data;
  }

  // ---------- AI Camera Tracking ----------
  getEmployeeLocationWebSocketUrl() {
    const token = readStoredValue(TOKEN_KEYS.access) || '';
    const wsOrigin = window.location.origin.replace(/^http/i, 'ws');
    return `${wsOrigin}/ws/employee-location?token=${encodeURIComponent(token)}`;
  }

  async listZones() {
    const { data } = await this.api.get<{ data: Zone[] }>('/zones');
    return data.data;
  }

  async createZone(body: ZoneInput) {
    const { data } = await this.api.post<{ message: string; data: Zone }>(
      '/zones',
      body
    );
    return data.data;
  }

  async updateZone(zoneId: string, body: Partial<ZoneInput>) {
    const { data } = await this.api.patch<{ message: string; data: Zone }>(
      `/zones/${zoneId}`,
      body
    );
    return data.data;
  }

  async deleteZone(zoneId: string) {
    const { data } = await this.api.delete<MessageResponse>(`/zones/${zoneId}`);
    return data;
  }

  async listRooms() {
    const { data } = await this.api.get<{ data: Room[] }>('/rooms');
    return data.data;
  }

  async createRoom(body: RoomInput) {
    const { data } = await this.api.post<{ message: string; data: Room }>(
      '/rooms',
      body
    );
    return data.data;
  }

  async updateRoom(roomId: string, body: Partial<RoomInput>) {
    const { data } = await this.api.patch<{ message: string; data: Room }>(
      `/rooms/${roomId}`,
      body
    );
    return data.data;
  }

  async deleteRoom(roomId: string) {
    const { data } = await this.api.delete<MessageResponse>(`/rooms/${roomId}`);
    return data;
  }

  async listCameras(params?: {
    page?: number;
    limit?: number;
    zone_id?: string;
    room_id?: string;
    status?: CameraStatus;
  }) {
    const { data } = await this.api.get<CameraListResponse>('/cameras', {
      params
    });
    return data;
  }

  async createCamera(body: CameraInput) {
    const { data } = await this.api.post<{ message: string; data: Camera }>(
      '/cameras',
      body
    );
    return data.data;
  }

  async updateCamera(cameraId: string, body: Partial<CameraInput>) {
    const { data } = await this.api.patch<{ message: string; data: Camera }>(
      `/cameras/${cameraId}`,
      body
    );
    return data.data;
  }

  async deleteCamera(cameraId: string) {
    const { data } = await this.api.delete<MessageResponse>(
      `/cameras/${cameraId}`
    );
    return data;
  }

  async testCamera(cameraId: string) {
    const { data } = await this.api.post<CameraTestResponse>(
      `/cameras/${cameraId}/test`
    );
    return data;
  }

  async snapshotCamera(cameraId: string) {
    const { data } = await this.api.post<CameraTestResponse>(
      `/cameras/${cameraId}/snapshot`
    );
    return data;
  }

  async talkCamera(cameraId: string, action: 'start' | 'stop') {
    const { data } = await this.api.post<CameraTalkResponse>(
      `/cameras/${cameraId}/talk`,
      { action }
    );
    return data;
  }

  async assignEmployeeRoom(employeeId: string, assignedRoomId: string) {
    const { data } = await this.api.put<EmployeeCameraAssignment>(
      `/employees/${employeeId}/room-assignment`,
      { assigned_room_id: assignedRoomId }
    );
    return data;
  }

  async listUnknownDetections(params?: {
    camera_id?: string;
    date_from?: string;
    date_to?: string;
    active_only?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { data } = await this.api.get<{
      meta: { page: number; limit: number; total: number };
      data: UnknownDetectionItem[];
    }>('/unknown-detections', { params });
    return data;
  }

  async getLiveUnknownDetections() {
    const { data } = await this.api.get<{ data: LiveUnknownDetection[] }>(
      '/cameras/live-unknown-detections'
    );
    return data.data;
  }

  async getLiveMatchedDetections() {
    const { data } = await this.api.get<{ data: LiveMatchedDetection[] }>(
      '/cameras/live-matched-detections'
    );
    return data.data;
  }

  async getCameraMediaGatewayStatus() {
    const { data } = await this.api.get<CameraMediaGatewayStatus>(
      '/cameras/media-gateway/status'
    );
    return data;
  }

  async getEmployeeLiveLocation(employeeId: string) {
    const { data } = await this.api.get<EmployeeLiveLocation>(
      `/employees/${employeeId}/live-location`
    );
    return data;
  }

  async getEmployeeCameraViews(employeeId: string) {
    const { data } = await this.api.get<EmployeeCameraViews>(
      `/employees/${employeeId}/camera-views`
    );
    return data;
  }

  async getEmployeeLocationTimeline(employeeId: string, limit = 100) {
    const { data } = await this.api.get<{ data: LocationTimelineItem[] }>(
      `/employees/${employeeId}/location-timeline`,
      { params: { limit } }
    );
    return data.data;
  }

  async getEmployeeDailyTimeline(employeeId: string, date: string) {
    const { data } = await this.api.get<EmployeeDailyTimeline>(
      `/employees/${employeeId}/daily-timeline`,
      { params: { date } }
    );
    return data;
  }

  async getEmployeeCameraProductivity(params: {
    employee_id: string;
    date_from: string;
    date_to: string;
  }) {
    const { employee_id, ...query } = params;
    const { data } = await this.api.get<CameraProductivityBreakdown>(
      `/employees/${employee_id}/camera-productivity`,
      { params: query }
    );
    return data;
  }

  async listEmployeeLocationStates(params?: { page?: number; limit?: number }) {
    const { data } = await this.api.get<{ data: EmployeeLiveLocation[] }>(
      '/employee-location-states',
      { params }
    );
    return data.data;
  }
}

// ============ Productivity types ============
export type CategoryScope = 'app' | 'site';
export type CategoryKind = 'productive' | 'unproductive' | 'neutral';
export type PatternType = 'exact' | 'contains' | 'regex';

export type CategoryRule = {
  id: string;
  pattern: string;
  pattern_type: PatternType;
  category: CategoryKind;
  department_id: string | null;
  label: string | null;
  priority: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CategoryRuleInput = {
  pattern: string;
  pattern_type: PatternType;
  category: CategoryKind;
  department_id?: string | null;
  label?: string | null;
  priority?: number;
  is_active?: boolean;
};

export type ProductivityBucket = {
  name: string;
  duration_seconds: number;
  share: number;
};

export type ProductivityBreakdown = {
  productive_seconds: number;
  unproductive_seconds: number;
  neutral_seconds: number;
  idle_seconds: number;
  active_seconds: number;
  total_seconds: number;
  productivity_score: number;
  by_app: ProductivityBucket[];
  by_site: ProductivityBucket[];
  by_label: ProductivityBucket[];
};

export type EmployeeProductivityRow = {
  employee: {
    id: string;
    full_name: string;
    department?: { id: string | null; name: string | null } | null;
  };
  productive_seconds: number;
  unproductive_seconds: number;
  neutral_seconds: number;
  idle_seconds: number;
  active_seconds: number;
  total_seconds: number;
  productivity_score: number;
};

export type EmployeeProductivityList = {
  date_from: string;
  date_to: string;
  rows: EmployeeProductivityRow[];
};

export type DepartmentProductivityRow = {
  department: { id: string; name: string };
  employees: number;
  productive_seconds: number;
  unproductive_seconds: number;
  neutral_seconds: number;
  idle_seconds: number;
  active_seconds: number;
  total_seconds: number;
  productivity_score: number;
};

export type DepartmentProductivityList = {
  date_from: string;
  date_to: string;
  rows: DepartmentProductivityRow[];
};

export type AppConfigItem = {
  key: string;
  value: string | null;
  description: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

// ============ Shifts ============
export type Shift = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_overnight: boolean;
  lunch_start_time: string | null;
  lunch_end_time: string | null;
  late_grace_minutes: number;
  early_leave_grace_minutes: number;
  work_days: string[];
  is_active: boolean;
  created_at?: string;
};

export type ShiftInput = {
  name: string;
  start_time: string;
  end_time: string;
  is_overnight?: boolean;
  lunch_start_time?: string | null;
  lunch_end_time?: string | null;
  late_grace_minutes?: number;
  early_leave_grace_minutes?: number;
  work_days?: string[];
  is_active?: boolean;
};

export type EmployeeShiftAssignment = {
  id: string;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  employee: { id: string; full_name: string };
  shift: Shift;
};

// ============ Holidays ============
export type Holiday = {
  id: string;
  date: string;
  name: string;
  type: 'public' | 'company' | 'weekend';
  is_paid: boolean;
};

export type HolidayInput = {
  holiday_date: string;
  name: string;
  holiday_type?: 'public' | 'company' | 'weekend';
  is_paid?: boolean;
};

// ============ Audit ============
export type AuditEntry = {
  id: string;
  event_id: string;
  action: 'created' | 'updated' | 'deleted';
  changed_by: {
    id: string | null;
    full_name: string | null;
    username: string | null;
  };
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_at: string;
};

// ============ AI Camera Tracking ============
export type ZoneType =
  | 'WORK_ROOM'
  | 'CORRIDOR'
  | 'REST_ZONE'
  | 'MEETING_ROOM'
  | 'ENTRANCE'
  | 'EXIT'
  | 'UNKNOWN';

export type CameraStatus =
  | 'online'
  | 'offline'
  | 'error'
  | 'testing'
  | 'unknown';

export type DetectionType = 'FACE' | 'BODY' | 'FACE_BODY';

export type Zone = {
  id: string;
  name: string;
  type: ZoneType;
  productivity_weight: number;
  timeout_seconds: number;
  created_at: string;
  camera_count: number;
};

export type ZoneInput = {
  name: string;
  type: ZoneType;
  productivity_weight?: number;
  timeout_seconds?: number;
};

export type CameraMini = {
  id: string;
  name: string;
  ip: string;
  status: CameraStatus;
  zone_id: string;
  zone_name: string;
  has_audio: boolean;
  has_speaker: boolean;
  is_primary: boolean;
  view_position?: string | null;
  stream_url: string;
  audio_url: string;
};

export type RoomCameraInput = {
  camera_id: string;
  is_primary?: boolean;
  view_position?: string | null;
};

export type Room = {
  id: string;
  name: string;
  department_id?: string | null;
  department_name?: string | null;
  floor?: string | null;
  description?: string | null;
  created_at: string;
  cameras: CameraMini[];
};

export type RoomInput = {
  name: string;
  department_id?: string | null;
  floor?: string | null;
  description?: string | null;
  cameras?: RoomCameraInput[];
};

export type Camera = {
  id: string;
  name: string;
  ip: string;
  username: string;
  password_configured: boolean;
  rtsp_main_url: string;
  rtsp_sub_url?: string | null;
  isapi_base_url?: string | null;
  zone_id: string;
  zone_name: string;
  zone_type: ZoneType;
  room_id?: string | null;
  room_name?: string | null;
  has_audio: boolean;
  has_speaker: boolean;
  status: CameraStatus;
  last_checked_at?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
  stream_url: string;
  audio_url: string;
};

export type CameraMediaGatewayStatus = {
  status: 'online' | 'offline' | 'not_configured';
  gateway_url: string | null;
  message?: string;
  streams?: Record<string, unknown>;
};

export type CameraInput = {
  name: string;
  ip: string;
  username: string;
  password?: string;
  rtsp_main_url: string;
  rtsp_sub_url?: string | null;
  isapi_base_url?: string | null;
  zone_id: string;
  room_id?: string | null;
  has_audio?: boolean;
  has_speaker?: boolean;
  status?: CameraStatus;
};

export type CameraListResponse = {
  meta: { page: number; limit: number; total: number };
  data: Camera[];
};

export type CameraTestResponse = {
  camera_id: string;
  status: CameraStatus;
  message: string;
  snapshot_url?: string | null;
  has_audio: boolean;
  has_speaker: boolean;
};

export type CameraTalkResponse = {
  camera_id: string;
  status: string;
  message: string;
  talkback_url?: string | null;
};

export type EmployeeCameraAssignment = {
  id: string;
  employee_id: string;
  assigned_room_id: string;
  assigned_camera_id?: string | null;
  created_at: string;
  updated_at: string;
  room: Room;
};

export type EmployeeLiveLocationEvent = {
  employee_id: string;
  active_camera_id?: string | null;
  active_zone_id?: string | null;
  assigned_camera_id?: string | null;
  is_visible: boolean;
  inferred: boolean;
  last_seen_at?: string | null;
  detection_type?: DetectionType | null;
  confidence?: number | null;
};

export type EmployeeLiveLocation = EmployeeLiveLocationEvent & {
  employee: {
    id: string;
    full_name: string;
    employee_code?: string | null;
    department?: { id?: string | null; name?: string | null };
    position?: { id?: string | null; name?: string | null };
  };
  active_camera?: Camera | null;
  active_zone?: Zone | null;
  active_room?: Room | null;
  assigned_room?: Room | null;
  assigned_cameras: CameraMini[];
  inferred_zone_id?: string | null;
  updated_at?: string | null;
};

export type EmployeeCameraViews = {
  employee_id: string;
  active_camera?: Camera | null;
  assigned_room_camera?: Camera | null;
  assigned_room_cameras: CameraMini[];
};

export type LocationTimelineItem = {
  id: string;
  camera_id: string;
  camera_name: string;
  zone_id: string;
  zone_name: string;
  zone_type: ZoneType;
  room_id?: string | null;
  room_name?: string | null;
  detection_type: DetectionType;
  confidence: number;
  track_id: string;
  seen_at: string;
  disappeared_at?: string | null;
  duration_seconds?: number | null;
  snapshot_path?: string | null;
};

export type DailyTimelineSegment = {
  zone_id: string;
  zone_name: string;
  zone_type: ZoneType;
  camera_id?: string | null;
  camera_name?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  start_at: string;
  end_at: string;
  start_clock: string;
  end_clock: string;
  duration_seconds: number;
  detections: number;
};

export type DailyZoneTotal = {
  zone_id: string;
  zone_name: string;
  zone_type: ZoneType;
  total_seconds: number;
};

export type EmployeeDailyTimeline = {
  employee_id: string;
  date: string;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  total_tracked_seconds: number;
  segments: DailyTimelineSegment[];
  zone_totals: DailyZoneTotal[];
};

export type CameraProductivityBreakdown = {
  assigned_room_visible_seconds: number;
  work_zone_visible_seconds: number;
  rest_zone_seconds: number;
  corridor_seconds: number;
  unknown_seconds: number;
  not_visible_seconds: number;
  inferred_zone_seconds: number;
  productivity_score: number;
};

export type UnknownDetectionItem = {
  id: string;
  camera_id: string;
  camera_name: string;
  camera_ip: string;
  zone_id: string;
  zone_name: string;
  room_id?: string | null;
  room_name?: string | null;
  track_id: string;
  detection_type: DetectionType;
  confidence: number;
  seen_at: string;
  disappeared_at?: string | null;
  duration_seconds?: number | null;
  snapshot_path?: string | null;
  bbox?: Record<string, unknown> | null;
};

export type DetectionBbox = {
  x: number;
  y: number;
  w: number;
  h: number;
  fw?: number;
  fh?: number;
};

export type LiveUnknownDetection = {
  id: string;
  camera_id: string;
  track_id: string;
  detection_type: DetectionType;
  confidence: number;
  seen_at: string;
  snapshot_path?: string | null;
  bbox?: DetectionBbox | null;
};

export type LiveMatchedDetection = {
  id: string;
  camera_id: string;
  track_id: string;
  employee_id: string;
  employee_name: string;
  detection_type: DetectionType;
  confidence: number;
  seen_at: string;
  snapshot_path?: string | null;
  bbox?: DetectionBbox | null;
};

const apiService = new ApiService();
export default apiService;
