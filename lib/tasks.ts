export type TaskStatus = 'pendiente' | 'en_progreso' | 'completada' | 'vencida';

export type TaskScore = 'sin_revisar' | 'parcial' | 'cumplida' | 'destacada';

export interface TaskAssignee {
  id: string;
  fullName: string;
  roleLabel: string;
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
  leaderValidation?: {
    checked: boolean;
    reviewerId?: string;
    reviewerName?: string;
    reviewedAt?: string;
  };
}

const STORAGE_KEY = 'dashboard-tasks:v2';

function isOverdue(task: TaskItem) {
  return task.status !== 'completada' && new Date(task.endDate).getTime() < Date.now();
}

function normalizeTask(task: TaskItem): TaskItem {
  const normalized: TaskItem = {
    ...task,
    labels: task.labels || [],
    score: task.score || 'sin_revisar',
    reviewNote: task.reviewNote || '',
    leaderValidation: task.leaderValidation || { checked: false },
  };

  if (isOverdue(normalized)) return { ...normalized, status: 'vencida' };
  if (normalized.status === 'vencida') return { ...normalized, status: 'pendiente' };
  return normalized;
}

export function loadTasks(): TaskItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('dashboard-tasks:v1');
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
