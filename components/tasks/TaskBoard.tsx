'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { GroupRole } from '../../lib/api';
import { loadTasks, TaskAssignee, TaskItem, TaskStatus, updateTask, upsertTask } from '../../lib/tasks';

type MembershipProject = {
  subgroupId: string;
  subgroup?: { name?: string; code?: string };
  roles: GroupRole[];
};

type MemberDirectory = Record<string, TaskAssignee[]>;

type Props = {
  currentUserId: string;
  isGodAdmin?: boolean;
  projects: MembershipProject[];
  memberDirectory: MemberDirectory;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  vencida: 'Vencida',
};

const emptyForm = {
  subgroupId: '',
  assigneeId: '',
  title: '',
  description: '',
  startDate: '',
  endDate: '',
};

function canManageProject(projectRoles: GroupRole[]) {
  return projectRoles.includes('MENTOR') || projectRoles.includes('LIDER');
}

export default function TaskBoard({ currentUserId, isGodAdmin = false, projects, memberDirectory }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [viewMode, setViewMode] = useState<'mine' | 'managed'>('mine');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const loaded = loadTasks();
    setTasks(loaded);
    if (projects.length > 0) {
      const manageable = projects.find((project) => canManageProject(project.roles));
      setForm((prev) => ({
        ...prev,
        subgroupId: manageable?.subgroupId || projects[0].subgroupId,
      }));
    }
  }, [projects]);

  const manageableProjects = useMemo(
    () => projects.filter((project) => isGodAdmin || canManageProject(project.roles)),
    [isGodAdmin, projects],
  );

  const availableAssignees = useMemo(
    () => memberDirectory[form.subgroupId] || [],
    [form.subgroupId, memberDirectory],
  );

  useEffect(() => {
    if (!form.subgroupId) return;
    if (!availableAssignees.some((member) => member.id === form.assigneeId)) {
      setForm((prev) => ({ ...prev, assigneeId: availableAssignees[0]?.id || '' }));
    }
  }, [availableAssignees, form.assigneeId, form.subgroupId]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      const canSee =
        isGodAdmin ||
        task.assigneeId === currentUserId ||
        task.mentorOrLeaderIds.includes(currentUserId);
      if (!canSee) return false;
      if (viewMode === 'mine' && task.assigneeId !== currentUserId) return false;
      if (viewMode === 'managed' && !task.mentorOrLeaderIds.includes(currentUserId) && !isGodAdmin) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      if (projectFilter && task.subgroupId !== projectFilter) return false;
      if (memberFilter && task.assigneeId !== memberFilter) return false;
      return true;
    });
  }, [tasks, currentUserId, isGodAdmin, memberFilter, projectFilter, statusFilter, viewMode]);

  const summary = useMemo(() => {
    return {
      total: visibleTasks.length,
      pending: visibleTasks.filter((task) => task.status === 'pendiente').length,
      progressing: visibleTasks.filter((task) => task.status === 'en_progreso').length,
      completed: visibleTasks.filter((task) => task.status === 'completada').length,
      overdue: visibleTasks.filter((task) => task.status === 'vencida').length,
    };
  }, [visibleTasks]);

  const handleCreateTask = (event: FormEvent) => {
    event.preventDefault();
    const project = projects.find((item) => item.subgroupId === form.subgroupId);
    const assignee = availableAssignees.find((item) => item.id === form.assigneeId);
    if (!project || !assignee) {
      setFeedback('Selecciona un proyecto y un miembro válidos para crear la tarea.');
      return;
    }
    const leaderIds = (memberDirectory[project.subgroupId] || [])
      .filter((member) => member.roleLabel.toLowerCase().includes('líder') || member.roleLabel.toLowerCase().includes('mentor'))
      .map((member) => member.id);

    const now = new Date().toISOString();
    const next = upsertTask({
      id: crypto.randomUUID(),
      title: form.title.trim(),
      description: form.description.trim(),
      subgroupId: project.subgroupId,
      subgroupName: project.subgroup?.name || project.subgroup?.code || project.subgroupId,
      assigneeId: assignee.id,
      assigneeName: assignee.fullName,
      assigneeRole: assignee.roleLabel,
      mentorOrLeaderIds: Array.from(new Set([...leaderIds, currentUserId])),
      startDate: form.startDate,
      endDate: form.endDate,
      status: 'pendiente',
      progressNote: '',
      createdAt: now,
      updatedAt: now,
    });
    setTasks(next);
    setForm((prev) => ({ ...emptyForm, subgroupId: prev.subgroupId }));
    setFeedback('Tarea creada y visible para el miembro asignado, su mentor y su líder.');
  };

  const handleStatusChange = (task: TaskItem, status: TaskStatus) => {
    const next = updateTask(task.id, { status });
    setTasks(next);
  };

  const handleNoteChange = (task: TaskItem, note: string) => {
    const next = updateTask(task.id, { progressNote: note });
    setTasks(next);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.7fr]">
        <section className="card space-y-4">
          <div>
            <p className="section-title">Asignación</p>
            <h2 className="text-xl font-semibold text-slate-900">Nuevo flujo de tareas</h2>
            <p className="text-sm text-slate-500 mt-1">
              Las tareas se asignan por miembro y rango de fechas. Solo las ven el miembro asignado, el mentor, el líder y el administrador.
            </p>
          </div>

          {manageableProjects.length === 0 ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Necesitas ser líder o mentor de un proyecto para crear tareas.
            </p>
          ) : (
            <form className="space-y-3" onSubmit={handleCreateTask}>
              <div className="editor-section">
                <label className="editor-label">Proyecto</label>
                <select
                  className="input"
                  value={form.subgroupId}
                  onChange={(event) => setForm((prev) => ({ ...prev, subgroupId: event.target.value }))}
                  required
                >
                  {manageableProjects.map((project) => (
                    <option key={project.subgroupId} value={project.subgroupId}>
                      {project.subgroup?.name || project.subgroup?.code || project.subgroupId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="editor-section">
                <label className="editor-label">Miembro responsable</label>
                <select
                  className="input"
                  value={form.assigneeId}
                  onChange={(event) => setForm((prev) => ({ ...prev, assigneeId: event.target.value }))}
                  required
                >
                  <option value="">Selecciona un miembro</option>
                  {availableAssignees.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName} · {member.roleLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="editor-section">
                <label className="editor-label">Tarea</label>
                <input
                  className="input"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ej. Preparar pruebas de integración"
                  required
                />
              </div>

              <div className="editor-section">
                <label className="editor-label">Descripción / criterio de cumplimiento</label>
                <textarea
                  className="input min-h-28"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Define qué debe entregar el miembro y cómo validar el cumplimiento."
                  required
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="editor-section">
                  <label className="editor-label">Inicio</label>
                  <input className="input" type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} required />
                </div>
                <div className="editor-section">
                  <label className="editor-label">Fin</label>
                  <input className="input" type="date" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} required />
                </div>
              </div>

              <button className="btn-primary" type="submit">Crear tarea</button>
            </form>
          )}

          {feedback && <p className="text-sm text-blue-700">{feedback}</p>}
        </section>

        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="stat-card">
              <span className="stat-label">Visibles</span>
              <strong className="stat-value">{summary.total}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">Pendientes</span>
              <strong className="stat-value">{summary.pending}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">En progreso</span>
              <strong className="stat-value">{summary.progressing}</strong>
            </div>
            <div className="stat-card danger">
              <span className="stat-label">Vencidas</span>
              <strong className="stat-value">{summary.overdue}</strong>
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="section-title">Panel</p>
                <h2 className="text-xl font-semibold text-slate-900">Seguimiento de tareas</h2>
              </div>

              <div className="segmented-control">
                <button type="button" className={viewMode === 'mine' ? 'active' : ''} onClick={() => setViewMode('mine')}>Mis tareas</button>
                <button type="button" className={viewMode === 'managed' ? 'active' : ''} onClick={() => setViewMode('managed')}>Supervisión</button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <select className="input" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                <option value="">Todos los proyectos</option>
                {projects.map((project) => (
                  <option key={project.subgroupId} value={project.subgroupId}>
                    {project.subgroup?.name || project.subgroup?.code || project.subgroupId}
                  </option>
                ))}
              </select>

              <select className="input" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
                <option value="">Todos los miembros</option>
                {Array.from(new Map(Object.values(memberDirectory).flat().map((member) => [member.id, member])).values()).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>

              <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              {visibleTasks.length === 0 && (
                <div className="empty-state">
                  <h3>No hay tareas para este filtro</h3>
                  <p>Cambia de vista o crea una nueva tarea para comenzar el seguimiento.</p>
                </div>
              )}

              {visibleTasks.map((task) => {
                const canUpdate = isGodAdmin || task.assigneeId === currentUserId || task.mentorOrLeaderIds.includes(currentUserId);
                return (
                  <article key={task.id} className="task-card">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`task-status status-${task.status}`}>{STATUS_LABELS[task.status]}</span>
                          <span className="badge-muted">{task.subgroupName}</span>
                          <span className="badge-link">{task.assigneeName}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        </div>
                        <div className="grid gap-2 text-sm text-slate-500 md:grid-cols-3">
                          <p><strong className="text-slate-700">Responsable:</strong> {task.assigneeName}</p>
                          <p><strong className="text-slate-700">Rol:</strong> {task.assigneeRole}</p>
                          <p><strong className="text-slate-700">Ventana:</strong> {task.startDate} → {task.endDate}</p>
                        </div>
                      </div>

                      {canUpdate && (
                        <div className="task-actions">
                          <select className="input" value={task.status} onChange={(event) => handleStatusChange(task, event.target.value as TaskStatus)}>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr]">
                      <div>
                        <label className="editor-label">Bitácora / verificación</label>
                        <textarea
                          className="input min-h-24"
                          value={task.progressNote || ''}
                          onChange={(event) => handleNoteChange(task, event.target.value)}
                          placeholder="Añade avances, incidencias o la validación de cumplimiento."
                          disabled={!canUpdate}
                        />
                      </div>
                      <div className="task-meta-panel">
                        <p><strong>Creada:</strong> {new Date(task.createdAt).toLocaleString('es-PE')}</p>
                        <p><strong>Actualizada:</strong> {new Date(task.updatedAt).toLocaleString('es-PE')}</p>
                        <p><strong>Cumplida:</strong> {task.completedAt ? new Date(task.completedAt).toLocaleString('es-PE') : 'Aún no'}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
