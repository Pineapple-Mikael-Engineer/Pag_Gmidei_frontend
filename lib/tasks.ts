import { tasksApi } from './api';

export type TaskStatus = 'pendiente' | 'en_progreso' | 'completada' | 'vencida';

export type TaskScore = 'sin_revisar' | 'parcial' | 'cumplida' | 'destacada';

export interface TaskAssignee {
  id: string;
  fullName: string;
  roleLabel: string;
}

export interface TaskSubtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  subgroupId: string;
  subgroupName: string;
  assigneeId: string;
  assigneeName: string;
  assigneeRole: string;
  mentorOrLeaderIds: string[];
  startDate: string;
  endDate: string;
  status: TaskStatus;
  progressNote?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  labels?: string[];
  score?: TaskScore;
  reviewNote?: string;
  subtasks?: TaskSubtask[];
  linkedReportIds?: string[];
  leaderValidation?: {
    checked: boolean;
    reviewerId?: string;
    reviewerName?: string;
    reviewedAt?: string;
  };
}

export interface TaskMutationInput {
  title?: string;
  description?: string;
  subgroupId?: string;
  subgroupName?: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeRole?: string;
  mentorOrLeaderIds?: string[];
  startDate?: string;
  endDate?: string;
  status?: TaskStatus;
  progressNote?: string;
  labels?: string[];
  score?: TaskScore;
  reviewNote?: string;
  leaderValidation?: TaskItem['leaderValidation'];
  subtasks?: TaskSubtask[];
  linkedReportIds?: string[];
  completedAt?: string;
}

export interface TaskLoadResult {
  tasks: TaskItem[];
  source: 'backend' | 'local';
}

const STORAGE_KEY = 'dashboard-tasks:v3';

function normalizeComparableId(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function buildTaskSubtask(raw: any, index: number): TaskSubtask {
  return {
    id: normalizeComparableId(raw?.id || raw?._id || `subtask-${index}`),
    title: String(raw?.title || raw?.name || raw?.label || '').trim(),
    done: Boolean(raw?.done || raw?.completed || raw?.checked),
  };
}

function normalizeSubtasks(subtasks?: any[]): TaskSubtask[] {
  if (!Array.isArray(subtasks)) return [];
  return subtasks
    .filter(Boolean)
    .map((item, index) => buildTaskSubtask(item, index))
    .filter((item) => item.title.length > 0);
}

function extractTaskCollections(payload: any): any[][] {
  const candidates = [
    payload,
    payload?.tasks,
    payload?.task,
    payload?.data,
    payload?.data?.tasks,
    payload?.data?.task,
    payload?.data?.items,
    payload?.items,
    payload?.rows,
    payload?.results,
  ];

  return candidates
    .map((candidate) => (Array.isArray(candidate) ? candidate : candidate ? [candidate] : []))
    .filter((candidate) => candidate.length > 0);
}

function isOverdue(task: TaskItem) {
  return task.status !== 'completada' && new Date(task.endDate).getTime() < Date.now();
}

export function normalizeTask(task: TaskItem): TaskItem {
  const normalized: TaskItem = {
    ...task,
    labels: task.labels || [],
    score: task.score || 'sin_revisar',
    reviewNote: task.reviewNote || '',
    progressNote: task.progressNote || '',
    subtasks: normalizeSubtasks(task.subtasks),
    linkedReportIds: (task.linkedReportIds || []).map((item) => normalizeComparableId(item)).filter(Boolean),
    leaderValidation: task.leaderValidation || { checked: false },
  };

  if (isOverdue(normalized)) return { ...normalized, status: 'vencida' };
  if (normalized.status === 'vencida' && new Date(normalized.endDate).getTime() >= Date.now()) return { ...normalized, status: 'pendiente' };
  return normalized;
}

function normalizeTaskFromBackend(raw: any): TaskItem {
  return normalizeTask({
    id: normalizeComparableId(raw?.id || raw?._id || raw?.taskId || crypto.randomUUID()),
    title: String(raw?.title || '').trim(),
    description: String(raw?.description || raw?.details || '').trim(),
    subgroupId: normalizeComparableId(raw?.subgroupId || raw?.subgroup?.id || raw?.projectId || ''),
    subgroupName: String(raw?.subgroupName || raw?.subgroup?.name || raw?.subgroup?.code || raw?.projectName || '').trim(),
    assigneeId: normalizeComparableId(raw?.assigneeId || raw?.assignee?.id || raw?.userId || ''),
    assigneeName: String(raw?.assigneeName || raw?.assignee?.fullName || raw?.user?.fullName || '').trim(),
    assigneeRole: String(raw?.assigneeRole || raw?.assignee?.roleLabel || raw?.roleLabel || '').trim(),
    mentorOrLeaderIds: Array.isArray(raw?.mentorOrLeaderIds)
      ? raw.mentorOrLeaderIds.map((item: unknown) => normalizeComparableId(item)).filter(Boolean)
      : Array.isArray(raw?.reviewers)
        ? raw.reviewers.map((item: any) => normalizeComparableId(item?.id || item)).filter(Boolean)
        : [],
    startDate: String(raw?.startDate || raw?.from || raw?.createdAt || '').slice(0, 10),
    endDate: String(raw?.endDate || raw?.to || raw?.dueDate || raw?.createdAt || '').slice(0, 10),
    status: (raw?.status || 'pendiente') as TaskStatus,
    progressNote: String(raw?.progressNote || '').trim(),
    createdAt: raw?.createdAt || new Date().toISOString(),
    updatedAt: raw?.updatedAt || raw?.createdAt || new Date().toISOString(),
    completedAt: raw?.completedAt,
    labels: Array.isArray(raw?.labels) ? raw.labels.filter(Boolean) : [],
    score: (raw?.score || 'sin_revisar') as TaskScore,
    reviewNote: String(raw?.reviewNote || '').trim(),
    subtasks: normalizeSubtasks(raw?.subtasks),
    linkedReportIds: Array.isArray(raw?.linkedReportIds)
      ? raw.linkedReportIds.map((item: unknown) => normalizeComparableId(item)).filter(Boolean)
      : Array.isArray(raw?.reportIds)
        ? raw.reportIds.map((item: unknown) => normalizeComparableId(item)).filter(Boolean)
        : [],
    leaderValidation: raw?.leaderValidation
      ? {
          checked: Boolean(raw.leaderValidation.checked),
          reviewerId: raw.leaderValidation.reviewerId,
          reviewerName: raw.leaderValidation.reviewerName,
          reviewedAt: raw.leaderValidation.reviewedAt,
        }
      : { checked: false },
  });
}

function parseBackendTasks(payload: any): TaskItem[] {
  for (const collection of extractTaskCollections(payload)) {
    const normalized = collection
      .filter(Boolean)
      .map((item) => normalizeTaskFromBackend(item))
      .filter((item) => item.title.length > 0);
    if (normalized.length > 0) return normalized;
  }
  return [];
}

function toBackendPayload(input: TaskMutationInput) {
  return {
    ...input,
    subtasks: normalizeSubtasks(input.subtasks),
    linkedReportIds: (input.linkedReportIds || []).map((item) => normalizeComparableId(item)).filter(Boolean),
  };
}

export function loadTasks(): TaskItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('dashboard-tasks:v2') || localStorage.getItem('dashboard-tasks:v1');
    const parsed = raw ? (JSON.parse(raw) as TaskItem[]) : [];
    return parsed.map(normalizeTask);
  } catch {
    return [];
  }
}

export function saveTasks(tasks: TaskItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.map(normalizeTask)));
}

export function upsertTask(task: TaskItem) {
  const tasks = loadTasks();
  const next = [...tasks.filter((item) => item.id !== task.id), normalizeTask(task)].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  saveTasks(next);
  return next;
}

export function updateTask(taskId: string, patch: Partial<TaskItem>) {
  const tasks = loadTasks().map((task) => {
    if (task.id !== taskId) return task;
    const updated = normalizeTask({ ...task, ...patch, updatedAt: new Date().toISOString() });
    if (updated.status === 'completada' && !updated.completedAt) {
      updated.completedAt = new Date().toISOString();
    }
    return updated;
  });
  saveTasks(tasks);
  return tasks;
}

export async function fetchTasksFromAnySource(): Promise<TaskLoadResult> {
  try {
    const response = await tasksApi.getAll();
    const parsed = parseBackendTasks(response.data);
    if (parsed.length > 0) {
      saveTasks(parsed);
      return { tasks: parsed, source: 'backend' };
    }
  } catch {
    // fallback local
  }

  return { tasks: loadTasks(), source: 'local' };
}

export async function createTaskInAnySource(task: TaskItem): Promise<TaskLoadResult> {
  const normalized = normalizeTask(task);
  try {
    const response = await tasksApi.create(toBackendPayload(normalized));
    const created = parseBackendTasks(response.data);
    if (created.length > 0) {
      const merged = [...loadTasks().filter((item) => item.id !== created[0].id), created[0]].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      );
      saveTasks(merged);
      return { tasks: merged, source: 'backend' };
    }
  } catch {
    // fallback local
  }

  return { tasks: upsertTask(normalized), source: 'local' };
}

export async function updateTaskInAnySource(taskId: string, patch: TaskMutationInput): Promise<TaskLoadResult> {
  try {
    const response = await tasksApi.update(taskId, toBackendPayload(patch));
    const updatedFromBackend = parseBackendTasks(response.data);
    if (updatedFromBackend.length > 0) {
      const merged = [...loadTasks().filter((item) => item.id !== taskId), updatedFromBackend[0]].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      );
      saveTasks(merged);
      return { tasks: merged, source: 'backend' };
    }
  } catch {
    // fallback local
  }

  return { tasks: updateTask(taskId, patch), source: 'local' };
}
