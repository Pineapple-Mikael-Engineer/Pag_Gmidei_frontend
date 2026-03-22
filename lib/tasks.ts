export type TaskStatus = 'pendiente' | 'en_progreso' | 'completada' | 'vencida';

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
}

const STORAGE_KEY = 'dashboard-tasks:v1';

function isOverdue(task: TaskItem) {
  return task.status !== 'completada' && new Date(task.endDate).getTime() < Date.now();
}

function normalizeStatus(task: TaskItem): TaskItem {
  if (isOverdue(task)) return { ...task, status: 'vencida' };
  if (task.status === 'vencida') return { ...task, status: 'pendiente' };
  return task;
}

export function loadTasks(): TaskItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as TaskItem[]) : [];
    return parsed.map(normalizeStatus);
  } catch {
    return [];
  }
}

export function saveTasks(tasks: TaskItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.map(normalizeStatus)));
}

export function upsertTask(task: TaskItem) {
  const tasks = loadTasks();
  const next = [...tasks.filter((item) => item.id !== task.id), normalizeStatus(task)].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  saveTasks(next);
  return next;
}

export function updateTask(taskId: string, patch: Partial<TaskItem>) {
  const tasks = loadTasks().map((task) => {
    if (task.id !== taskId) return task;
    const updated = normalizeStatus({ ...task, ...patch, updatedAt: new Date().toISOString() });
    if (updated.status === 'completada' && !updated.completedAt) {
      updated.completedAt = new Date().toISOString();
    }
    return updated;
  });
  saveTasks(tasks);
  return tasks;
}
