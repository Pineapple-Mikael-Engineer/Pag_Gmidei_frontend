import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_URL = 'https://pag-gmidei-backend.onrender.com/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: Error) => void }> = [];

function processQueue(error: Error | null, token: string | null = null) {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token!));
  failedQueue = [];
}

api.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (err) {
        console.error('Error refreshing auth token:', err);
        processQueue(err as Error, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth/login/?expired=1';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export type GroupRole = 'MIEMBRO' | 'LIDER' | 'MENTOR';

export const GROUP_ROLE_LABELS: Record<GroupRole, string> = {
  MIEMBRO: 'Miembro',
  LIDER: 'Líder',
  MENTOR: 'Mentor',
};

export interface UserMembership {
  subgroupId: string;
  subgroupName?: string;
  subgroupCode?: string;
  roles: GroupRole[];
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  memberships: UserMembership[];
  role?: GroupRole | null;
  isGodAdmin?: boolean;
}

export interface LoginPayload { email: string; password: string }
export interface RegisterPayload { email: string; password: string; fullName: string }

export const authApi = {
  register: (data: RegisterPayload) => api.post('/auth/register', data),
  login: (data: LoginPayload) => api.post('/auth/login', data),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
};

export const reportsApi = {
  getAll: (params?: { authorId?: string; subgroupId?: string; status?: string; q?: string; from?: string; to?: string; page?: number; limit?: number }) => api.get('/reports', { params }),
  getOne: (id: string) => api.get(`/reports/${id}`),
  create: (formData: FormData) => api.post('/reports', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: string, data: object) => api.patch(`/reports/${id}`, data),
  delete: (id: string) => api.delete(`/reports/${id}`),
  downloadAttachment: (reportId: string, fileId: string) => api.get(`/reports/${reportId}/attachments/${fileId}`, { responseType: 'blob' }),
  downloadUrl: (reportId: string, fileId: string) => `${API_URL}/reports/${reportId}/attachments/${fileId}`,
};

export const calendarApi = {
  getEvents: (params?: { start?: string; end?: string; subgroupId?: string }) => api.get('/calendar', { params }),
  createEventInSubgroup: (subgroupId: string, data: object) => api.post(`/calendar/subgroups/${subgroupId}`, data),
  updateEvent: (id: string, data: object) => api.patch(`/calendar/${id}`, data),
  deleteEvent: (id: string) => api.delete(`/calendar/${id}`),
};

export const usersApi = {
  getMe: () => api.get('/users/me'),
  getAll: (role?: GroupRole) => api.get('/users', { params: { role } }),
  updateMe: (data: object) => api.patch('/users/me', data),
};

export const adminApi = {
  getUsers: () => api.get('/admin/users'),
  setUserStatus: (userId: string, isActive: boolean) => api.patch(`/admin/users/${userId}/status`, { isActive }),
  updateUser: (userId: string, data: { fullName?: string; isActive?: boolean; isGodAdmin?: boolean }) => api.patch(`/admin/users/${userId}`, data),
  deleteUser: (userId: string) => api.delete(`/admin/users/${userId}`),
  getReports: (params?: { q?: string; subgroupId?: string; authorId?: string; status?: string }) => api.get('/admin/reports', { params }),
  updateReport: (reportId: string, data: { status?: 'EN_PROGRESO' | 'COMPLETADO' | 'REVISADO'; comments?: string }) => api.patch(`/admin/reports/${reportId}`, data),
  deleteReport: (reportId: string) => api.delete(`/admin/reports/${reportId}`),
  getProjects: () => api.get('/admin/projects'),
  updateProject: (subgroupId: string, data: { name?: string; code?: string; description?: string | null; isActive?: boolean }) => api.patch(`/admin/projects/${subgroupId}`, data),
  deleteProject: (subgroupId: string, confirmationCode: string) => api.delete(`/admin/projects/${subgroupId}`, { data: { confirmationCode } }),
};

export const subgroupsApi = {
  createProject: (data: { name: string; code: string; description?: string }) => api.post('/subgroups', data),
  updateProject: (subgroupId: string, data: { name?: string; code?: string; description?: string }) => api.patch(`/subgroups/${subgroupId}`, data),
  deleteProject: (subgroupId: string) => api.delete(`/subgroups/${subgroupId}`),
  getMy: () => api.get('/subgroups/my'),
  getMembers: (subgroupId: string) => api.get(`/subgroups/${subgroupId}/members`),
  addMember: (subgroupId: string, data: { userId?: string; email?: string; roles?: GroupRole[] }) => api.post(`/subgroups/${subgroupId}/members`, data),
  setMemberRoles: (subgroupId: string, userId: string, roles: GroupRole[]) => api.patch(`/subgroups/${subgroupId}/members/${userId}/roles`, { roles }),
  removeMember: (subgroupId: string, userId: string) => api.delete(`/subgroups/${subgroupId}/members/${userId}`),
};
