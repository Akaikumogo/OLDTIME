import axios, { type AxiosInstance } from 'axios';
import { notification } from 'antd';

const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  'http://localhost:8000';

export const BACKEND_ORIGIN = new URL(API_BASE_URL).origin;

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

function showErrorNotification(error: unknown) {
  if (!axios.isAxiosError(error)) {
    notification.error({
      message: 'Kutilmagan xato',
      description: String(error),
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
  created_at: string;
  employee_id: string | null;
  employee_name: string | null;
  employee: { full_name: string } | null;  door: { id: string; name: string; ip_address: string; event_type: string };
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
  computer_id: string;
  employee_id?: string | null;
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
      baseURL: API_BASE_URL,
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
    }>(
      `${API_BASE_URL}/admin/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );

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
    lunch_start_time: string;
    lunch_end_time: string;
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
}

const apiService = new ApiService();
export default apiService;
