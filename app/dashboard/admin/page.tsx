'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminApi, commentsApi, CommentApiModel } from '../../../lib/api';
import { formatPeruDateTime } from '../../../lib/datetime';
import { deleteTaskInAnySource, fetchTasksFromAnySource, TaskItem, updateTaskInAnySource } from '../../../lib/tasks';
import { useAuthStore } from '../../../store/authStore';

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  isGodAdmin?: boolean;
}

interface AdminReport {
  id: string;
  title: string;
  status: 'EN_PROGRESO' | 'COMPLETADO' | 'REVISADO';
  reportDate: string;
  comments?: string | null;
  author: { id?: string; fullName: string; email: string };
  subgroup?: { name: string; code: string };
  attachments?: Array<{ id: string; originalName: string }>;
}

interface AdminProject {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  _count?: { members?: number; reports?: number };
}

type AdminTab = 'users' | 'reports' | 'projects' | 'tasks' | 'comments' | 'tools';

type TaskDraft = {
  status: TaskItem['status'];
  startDate: string;
  endDate: string;
  progressNote: string;
  reviewNote: string;
};

type AdminComment = CommentApiModel & {
  authorName: string;
};

function normalizeCommentList(payload: any): AdminComment[] {
  const collections = [
    payload,
    payload?.comments,
    payload?.data,
    payload?.data?.comments,
    payload?.items,
    payload?.rows,
  ];

  const rows = collections.find((candidate) => Array.isArray(candidate)) || [];
  return rows
    .filter(Boolean)
    .map((item: any, index: number) => ({
      id: String(item.id || item._id || item.commentId || `comment-${index}`),
      reportId: String(item.reportId || item.report?.id || ''),
      userId: String(item.userId || item.user?.id || item.authorId || ''),
      content: String(item.content || item.text || item.body || '').trim(),
      createdAt: item.createdAt || item.updatedAt || new Date().toISOString(),
      editedAt: item.editedAt,
      user: item.user,
      authorName: item.user?.fullName || item.authorName || item.author?.fullName || 'Usuario',
    }))
    .filter((item: AdminComment) => item.content.length > 0)
    .sort((a: AdminComment, b: AdminComment) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, TaskDraft>>({});
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [search, setSearch] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskProjectFilter, setTaskProjectFilter] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [toolsJson, setToolsJson] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const setTaskDraft = (task: TaskItem, patch?: Partial<TaskDraft>) => {
    setTaskDrafts((prev) => ({
      ...prev,
      [task.id]: {
        status: patch?.status || prev[task.id]?.status || task.status,
        startDate: patch?.startDate || prev[task.id]?.startDate || task.startDate,
        endDate: patch?.endDate || prev[task.id]?.endDate || task.endDate,
        progressNote: patch?.progressNote ?? prev[task.id]?.progressNote ?? task.progressNote ?? '',
        reviewNote: patch?.reviewNote ?? prev[task.id]?.reviewNote ?? task.reviewNote ?? '',
      },
    }));
  };

  const loadUsers = async () => {
    try {
      const res = await adminApi.getUsers();
      setUsers(res.data.users || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo cargar usuarios');
    }
  };

  const loadReports = async () => {
    try {
      const res = await adminApi.getReports({ q: search || undefined });
      const nextReports = res.data.reports || [];
      setReports(nextReports);
      if (!selectedReportId && nextReports.length > 0) {
        setSelectedReportId(nextReports[0].id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo cargar reportes');
    }
  };

  const loadProjects = async () => {
    try {
      const res = await adminApi.getProjects();
      setProjects(res.data.projects || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudieron cargar proyectos');
    }
  };

  const loadTasks = async () => {
    try {
      const result = await fetchTasksFromAnySource();
      setTasks(result.tasks);
      setTaskDrafts({});
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudieron cargar tareas');
    }
  };

  const loadComments = async (reportIdParam?: string) => {
    const reportId = reportIdParam || selectedReportId;
    if (!reportId) {
      setComments([]);
      return;
    }
    try {
      const res = await commentsApi.listByReport(reportId);
      setComments(normalizeCommentList(res.data));
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudieron cargar comentarios');
    }
  };

  useEffect(() => {
    if (!user?.isGodAdmin) return;
    setError('');
    setFeedback('');
    if (tab === 'users') void loadUsers();
    if (tab === 'reports') void loadReports();
    if (tab === 'projects') void loadProjects();
    if (tab === 'tasks') void loadTasks();
    if (tab === 'comments') {
      void loadReports();
    }
  }, [user?.isGodAdmin, tab]);

  useEffect(() => {
    if (tab === 'comments' && selectedReportId) {
      void loadComments(selectedReportId);
    }
  }, [selectedReportId, tab]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (taskProjectFilter && task.subgroupId !== taskProjectFilter) return false;
      if (taskStatusFilter && task.status !== taskStatusFilter) return false;
      if (taskSearch.trim()) {
        const needle = taskSearch.trim().toLowerCase();
        const haystack = [task.title, task.assigneeName, task.subgroupName, task.description].join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [taskProjectFilter, taskSearch, taskStatusFilter, tasks]);

  const selectedReportLabel = useMemo(() => {
    return reports.find((report) => report.id === selectedReportId)?.title || 'Sin reporte seleccionado';
  }, [reports, selectedReportId]);

  const toolsPayload = useMemo(() => ({
    users,
    reports,
    projects,
    tasks,
    comments,
  }), [comments, projects, reports, tasks, users]);

  const handleTaskSave = async (task: TaskItem) => {
    const draft = taskDrafts[task.id] || {
      status: task.status,
      startDate: task.startDate,
      endDate: task.endDate,
      progressNote: task.progressNote || '',
      reviewNote: task.reviewNote || '',
    };

    await updateTaskInAnySource(task.id, draft);
    setFeedback(`Tarea actualizada: ${task.title}`);
    await loadTasks();
  };

  const handleCommentSave = async (comment: AdminComment) => {
    await commentsApi.update(comment.id, { content: comment.content });
    setFeedback(`Comentario actualizado en ${selectedReportLabel}.`);
    await loadComments(comment.reportId || selectedReportId);
  };

  const handleTaskDelete = async (task: TaskItem) => {
    if (!confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
    await deleteTaskInAnySource(task.id);
    setFeedback(`Tarea eliminada: ${task.title}`);
    await loadTasks();
  };

  const handleCommentDelete = async (comment: AdminComment) => {
    if (!confirm('¿Eliminar comentario definitivamente?')) return;
    await commentsApi.delete(comment.id);
    setFeedback(`Comentario eliminado en ${selectedReportLabel}.`);
    await loadComments(comment.reportId || selectedReportId);
  };

  if (!user?.isGodAdmin) return <div className="page-shell">Acceso restringido.</div>;

  return (
    <div className="page-shell space-y-4">
      <div className="card bg-gradient-to-r from-white to-slate-50/80 space-y-2">
        <h1 className="text-2xl font-bold">Panel Dios</h1>
        <p className="text-sm text-slate-500">Administración global de usuarios, reportes, proyectos, tareas, comentarios y herramientas de inspección.</p>
      </div>

      <div className="card flex gap-2 flex-wrap">
        {[
          ['users', 'Usuarios'],
          ['reports', 'Reportes'],
          ['projects', 'Proyectos'],
          ['tasks', 'Tareas'],
          ['comments', 'Comentarios'],
          ['tools', 'Herramientas'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={`btn-secondary ${tab === value ? 'bg-slate-900 text-white border-slate-900' : ''}`}
            onClick={() => setTab(value as AdminTab)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {feedback && <p className="text-sm text-emerald-700">{feedback}</p>}

      {tab === 'users' && (
        <div className="card divide-y">
          {users.map((u) => (
            <div key={u.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{u.fullName}</p>
                <p className="text-sm text-gray-600">{u.email}</p>
                <p className="text-xs text-gray-500">{u.isGodAdmin ? 'Modo dios' : 'Usuario estándar'} · {u.isActive ? 'Puede iniciar sesión' : 'Login bloqueado'}</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <button className="btn-secondary text-sm" onClick={async () => { await adminApi.setUserStatus(u.id, !u.isActive); await loadUsers(); }}>
                  {u.isActive ? 'Bloquear login' : 'Habilitar login'}
                </button>
                <button className="btn-secondary text-sm" onClick={async () => {
                  const newName = prompt('Nuevo nombre para el usuario:', u.fullName);
                  if (!newName) return;
                  await adminApi.updateUser(u.id, { fullName: newName });
                  await loadUsers();
                }}>Renombrar</button>
                <button className="btn-secondary text-sm" onClick={async () => {
                  await adminApi.updateUser(u.id, { isGodAdmin: !u.isGodAdmin });
                  await loadUsers();
                }}>{u.isGodAdmin ? 'Quitar Dios' : 'Hacer Dios'}</button>
                <button className="border border-red-300 text-red-700 rounded-xl px-3 py-1 text-sm hover:bg-red-50" onClick={async () => { if (confirm('¿Eliminar usuario definitivamente?')) { await adminApi.deleteUser(u.id); await loadUsers(); } }}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-3">
          <div className="card flex gap-2">
            <input className="input flex-1" placeholder="Buscar reporte" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn-secondary" onClick={() => void loadReports()}>Buscar</button>
          </div>

          <div className="card divide-y">
            {reports.map((r) => (
              <div key={r.id} className="p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{r.title}</p>
                  <p className="text-sm text-gray-600">{r.author.fullName} ({r.author.email}) · {r.subgroup?.name || r.subgroup?.code || 'Proyecto'}</p>
                  <p className="text-xs text-gray-500">{formatPeruDateTime(r.reportDate)} · Estado: {r.status} · {r.attachments?.length || 0} adj.</p>
                  {r.comments && <p className="text-xs text-gray-500 mt-1">Nota: {r.comments}</p>}
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <button className="btn-secondary text-sm" onClick={async () => { await adminApi.updateReport(r.id, { status: r.status === 'REVISADO' ? 'EN_PROGRESO' : 'REVISADO' }); await loadReports(); }}>
                    {r.status === 'REVISADO' ? 'Hacer visible' : 'Ocultar'}
                  </button>
                  <button className="btn-secondary text-sm" onClick={async () => { const note = prompt('Comentario de moderación:', r.comments || ''); if (note === null) return; await adminApi.updateReport(r.id, { comments: note }); await loadReports(); }}>
                    Nota
                  </button>
                  <button className="border border-red-300 text-red-700 rounded-xl px-3 py-1 text-sm hover:bg-red-50" onClick={async () => { if (confirm('¿Eliminar reporte definitivamente?')) { await adminApi.deleteReport(r.id); await loadReports(); } }}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
            {reports.length === 0 && <p className="p-4 text-sm text-gray-500">No hay reportes para mostrar.</p>}
          </div>
        </div>
      )}

      {tab === 'projects' && (
        <div className="card divide-y">
          {projects.map((p) => (
            <div key={p.id} className="p-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{p.name} <span className="text-xs text-gray-500">({p.code})</span></p>
                {p.description && <p className="text-sm text-gray-600">{p.description}</p>}
                <p className="text-xs text-gray-500 mt-1">Estado: {p.isActive ? 'Activo' : 'Inactivo'} · Miembros: {p._count?.members ?? 0} · Reportes: {p._count?.reports ?? 0}</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                <button className="btn-secondary text-sm" onClick={async () => {
                  const newName = prompt('Nuevo nombre del proyecto:', p.name);
                  if (!newName) return;
                  await adminApi.updateProject(p.id, { name: newName });
                  await loadProjects();
                }}>Renombrar</button>
                <button className="btn-secondary text-sm" onClick={async () => {
                  const newCode = prompt('Nuevo código del proyecto:', p.code);
                  if (!newCode) return;
                  await adminApi.updateProject(p.id, { code: newCode });
                  await loadProjects();
                }}>Editar código</button>
                <button className="btn-secondary text-sm" onClick={async () => {
                  const next = !p.isActive;
                  await adminApi.updateProject(p.id, { isActive: next });
                  await loadProjects();
                }}>{p.isActive ? 'Desactivar' : 'Activar'}</button>
                <button className="border border-red-300 text-red-700 rounded-xl px-3 py-1 text-sm hover:bg-red-50" onClick={async () => {
                  const confirmationCode = prompt(`Para eliminar este proyecto escribe su código exacto: ${p.code}`);
                  if (!confirmationCode) return;
                  await adminApi.deleteProject(p.id, confirmationCode);
                  await loadProjects();
                }}>Eliminar</button>
              </div>
            </div>
          ))}
          {projects.length === 0 && <p className="p-4 text-sm text-gray-500">No hay proyectos para mostrar.</p>}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-3">
          <div className="card grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
            <input className="input" placeholder="Buscar tarea, proyecto o responsable" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} />
            <select className="input" value={taskProjectFilter} onChange={(event) => setTaskProjectFilter(event.target.value)}>
              <option value="">Todos los proyectos</option>
              {Array.from(new Map(tasks.map((task) => [task.subgroupId, task])).values()).map((task) => (
                <option key={task.subgroupId} value={task.subgroupId}>{task.subgroupName}</option>
              ))}
            </select>
            <select className="input" value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_progreso">En progreso</option>
              <option value="completada">Completada</option>
              <option value="vencida">Vencida</option>
            </select>
            <button className="btn-secondary" onClick={() => void loadTasks()}>Recargar</button>
          </div>

          <div className="card divide-y">
            {filteredTasks.map((task) => {
              const draft = taskDrafts[task.id] || {
                status: task.status,
                startDate: task.startDate,
                endDate: task.endDate,
                progressNote: task.progressNote || '',
                reviewNote: task.reviewNote || '',
              };

              return (
                <div key={task.id} className="p-4 space-y-3">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-gray-600">{task.assigneeName} · {task.subgroupName}</p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <select className="input" value={draft.status} onChange={(event) => setTaskDraft(task, { status: event.target.value as TaskItem['status'] })}>
                      <option value="pendiente">Pendiente</option>
                      <option value="en_progreso">En progreso</option>
                      <option value="completada">Completada</option>
                      <option value="vencida">Vencida</option>
                    </select>
                    <input className="input" type="date" value={draft.startDate} onChange={(event) => setTaskDraft(task, { startDate: event.target.value })} />
                    <input className="input" type="date" value={draft.endDate} onChange={(event) => setTaskDraft(task, { endDate: event.target.value })} />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <textarea className="input min-h-24" value={draft.progressNote} onChange={(event) => setTaskDraft(task, { progressNote: event.target.value })} placeholder="Bitácora / seguimiento operativo" />
                    <textarea className="input min-h-24" value={draft.reviewNote} onChange={(event) => setTaskDraft(task, { reviewNote: event.target.value })} placeholder="Nota de revisión" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button className="border border-red-300 text-red-700 rounded-xl px-3 py-1 text-sm hover:bg-red-50" onClick={() => void handleTaskDelete(task)}>Eliminar</button>
                    <button className="btn-secondary text-sm" onClick={() => setTaskDraft(task, {
                      status: task.status,
                      startDate: task.startDate,
                      endDate: task.endDate,
                      progressNote: task.progressNote || '',
                      reviewNote: task.reviewNote || '',
                    })}>Revertir</button>
                    <button className="btn-primary text-sm" onClick={() => void handleTaskSave(task)}>Guardar cambios</button>
                  </div>
                </div>
              );
            })}
            {filteredTasks.length === 0 && <p className="p-4 text-sm text-gray-500">No hay tareas para mostrar.</p>}
          </div>
        </div>
      )}

      {tab === 'comments' && (
        <div className="space-y-3">
          <div className="card grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <select className="input" value={selectedReportId} onChange={(event) => setSelectedReportId(event.target.value)}>
              <option value="">Selecciona un reporte</option>
              {reports.map((report) => (
                <option key={report.id} value={report.id}>{report.title}</option>
              ))}
            </select>
            <button className="btn-secondary" onClick={() => void loadReports()}>Recargar reportes</button>
            <button className="btn-secondary" onClick={() => void loadComments()}>Recargar comentarios</button>
          </div>

          <div className="card divide-y">
            {comments.map((comment) => (
              <div key={comment.id} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{comment.authorName}</p>
                  <p className="text-xs text-gray-500">{formatPeruDateTime(comment.createdAt)}</p>
                </div>
                <textarea
                  className="input min-h-24"
                  value={comment.content}
                  onChange={(event) => setComments((prev) => prev.map((item) => item.id === comment.id ? { ...item, content: event.target.value } : item))}
                />
                <div className="flex justify-end gap-2">
                  <button className="border border-red-300 text-red-700 rounded-xl px-3 py-1 text-sm hover:bg-red-50" onClick={() => void handleCommentDelete(comment)}>Eliminar</button>
                  <button className="btn-primary text-sm" onClick={() => void handleCommentSave(comment)}>Guardar comentario</button>
                </div>
              </div>
            ))}
            {comments.length === 0 && <p className="p-4 text-sm text-gray-500">No hay comentarios para este reporte.</p>}
          </div>
        </div>
      )}

      {tab === 'tools' && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="card"><p className="text-xs text-slate-500">Usuarios</p><p className="text-2xl font-semibold">{users.length}</p></div>
            <div className="card"><p className="text-xs text-slate-500">Reportes</p><p className="text-2xl font-semibold">{reports.length}</p></div>
            <div className="card"><p className="text-xs text-slate-500">Proyectos</p><p className="text-2xl font-semibold">{projects.length}</p></div>
            <div className="card"><p className="text-xs text-slate-500">Tareas</p><p className="text-2xl font-semibold">{tasks.length}</p></div>
            <div className="card"><p className="text-xs text-slate-500">Comentarios</p><p className="text-2xl font-semibold">{comments.length}</p></div>
          </div>

          <div className="card space-y-3">
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => void loadUsers()}>Recargar usuarios</button>
              <button className="btn-secondary" onClick={() => void loadReports()}>Recargar reportes</button>
              <button className="btn-secondary" onClick={() => void loadProjects()}>Recargar proyectos</button>
              <button className="btn-secondary" onClick={() => void loadTasks()}>Recargar tareas</button>
              <button className="btn-secondary" onClick={() => void loadComments()}>Recargar comentarios</button>
              <button className="btn-secondary" onClick={() => setToolsJson(JSON.stringify(toolsPayload, null, 2))}>Volcar JSON</button>
            </div>
            <textarea className="input min-h-[24rem] font-mono text-xs" value={toolsJson} onChange={(event) => setToolsJson(event.target.value)} placeholder="Aquí puedes inspeccionar el volcado JSON de las tablas cargadas." />
          </div>
        </div>
      )}
    </div>
  );
}
