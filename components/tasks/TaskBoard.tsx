'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { GroupRole } from '../../lib/api';
import { loadTasks, TaskAssignee, TaskItem, TaskScore, TaskStatus, updateTask, upsertTask } from '../../lib/tasks';

type MembershipProject = {
  subgroupId: string;
  subgroup?: { name?: string; code?: string };
  roles: GroupRole[];
};

type MemberDirectory = Record<string, TaskAssignee[]>;

type Props = {
  currentUserId: string;
  currentUserName: string;
  isGodAdmin?: boolean;
  projects: MembershipProject[];
  memberDirectory: MemberDirectory;
};

type TaskTab = 'overview' | 'assign' | 'review';

const STATUS_LABELS: Record<TaskStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  vencida: 'Vencida',
};

const SCORE_LABELS: Record<TaskScore, string> = {
  sin_revisar: 'Sin revisar',
  parcial: 'Cumplimiento parcial',
  cumplida: 'Cumplida',
  destacada: 'Destacada',
};

const TASK_LABELS = ['Alta prioridad', 'Bloqueada', 'Requiere apoyo', 'Autónoma'];

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

function canLeadProject(projectRoles: GroupRole[]) {
  return projectRoles.includes('LIDER');
}

export default function TaskBoard({ currentUserId, currentUserName, isGodAdmin = false, projects, memberDirectory }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [viewMode, setViewMode] = useState<'mine' | 'managed'>('mine');
  const [activeTab, setActiveTab] = useState<TaskTab>('overview');
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

  const leaderProjectIds = useMemo(
    () => new Set(projects.filter((project) => isGodAdmin || canLeadProject(project.roles)).map((project) => project.subgroupId)),
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
      const canSee = isGodAdmin || task.assigneeId === currentUserId || task.mentorOrLeaderIds.includes(currentUserId);
      if (!canSee) return false;
      if (viewMode === 'mine' && task.assigneeId !== currentUserId) return false;
      if (viewMode === 'managed' && !task.mentorOrLeaderIds.includes(currentUserId) && !isGodAdmin) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      if (projectFilter && task.subgroupId !== projectFilter) return false;
      if (memberFilter && task.assigneeId !== memberFilter) return false;
      return true;
    });
  }, [tasks, currentUserId, isGodAdmin, memberFilter, projectFilter, statusFilter, viewMode]);

  const reviewableTasks = useMemo(
    () => visibleTasks.filter((task) => isGodAdmin || leaderProjectIds.has(task.subgroupId)),
    [isGodAdmin, leaderProjectIds, visibleTasks],
  );

  const canSeeReviewTab = useMemo(() => {
    if (isGodAdmin) return true;
    return projects.some((project) => canManageProject(project.roles));
  }, [isGodAdmin, projects]);

  const summary = useMemo(() => {
    const completed = visibleTasks.filter((task) => task.status === 'completada').length;
    return {
      total: visibleTasks.length,
      pending: visibleTasks.filter((task) => task.status === 'pendiente').length,
      progressing: visibleTasks.filter((task) => task.status === 'en_progreso').length,
      completed,
      overdue: visibleTasks.filter((task) => task.status === 'vencida').length,
      validated: visibleTasks.filter((task) => task.leaderValidation?.checked).length,
      completionRate: visibleTasks.length === 0 ? 0 : Math.round((completed / visibleTasks.length) * 100),
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
      labels: [],
      score: 'sin_revisar',
      reviewNote: '',
      leaderValidation: { checked: false },
      createdAt: now,
      updatedAt: now,
    });
    setTasks(next);
    setForm((prev) => ({ ...emptyForm, subgroupId: prev.subgroupId }));
    setFeedback('Tarea creada y visible para el miembro asignado, su mentor y su líder.');
    setActiveTab('overview');
  };

  const handleStatusChange = (task: TaskItem, status: TaskStatus) => {
    const next = updateTask(task.id, { status });
    setTasks(next);
  };

  const handleNoteChange = (task: TaskItem, note: string, field: 'progressNote' | 'reviewNote') => {
    const next = updateTask(task.id, { [field]: note });
    setTasks(next);
  };

  const toggleLabel = (task: TaskItem, label: string) => {
    const current = task.labels || [];
    const labels = current.includes(label) ? current.filter((item) => item !== label) : [...current, label];
    const next = updateTask(task.id, { labels });
    setTasks(next);
  };

  const handleScoreChange = (task: TaskItem, score: TaskScore) => {
    const next = updateTask(task.id, { score });
    setTasks(next);
  };

  const handleLeaderValidation = (task: TaskItem, checked: boolean) => {
    const next = updateTask(task.id, {
      leaderValidation: {
        checked,
        reviewerId: checked ? currentUserId : undefined,
        reviewerName: checked ? currentUserName : undefined,
        reviewedAt: checked ? new Date().toISOString() : undefined,
      },
    });
    setTasks(next);
  };

  return (
    <div className="space-y-6">
      <div className="module-tabs">
        <button type="button" className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Visualización de tareas</button>
        <button type="button" className={activeTab === 'assign' ? 'active' : ''} onClick={() => setActiveTab('assign')}>Asignación</button>
        {canSeeReviewTab && <button type="button" className={activeTab === 'review' ? 'active' : ''} onClick={() => setActiveTab('review')}>Calificación</button>}
      </div>

      {activeTab === 'overview' && (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="stat-card"><span className="stat-label">Visibles</span><strong className="stat-value">{summary.total}</strong></div>
            <div className="stat-card"><span className="stat-label">Pendientes</span><strong className="stat-value">{summary.pending}</strong></div>
            <div className="stat-card"><span className="stat-label">En progreso</span><strong className="stat-value">{summary.progressing}</strong></div>
            <div className="stat-card"><span className="stat-label">Cumplidas</span><strong className="stat-value">{summary.completed}</strong></div>
            <div className="stat-card danger"><span className="stat-label">% cumplimiento</span><strong className="stat-value">{summary.completionRate}%</strong></div>
          </div>

          <div className="card space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="section-title">Visualización</p>
                <h2 className="text-xl font-semibold text-slate-900">Seguimiento de tareas</h2>
                <p className="text-sm text-slate-500 mt-1">Esta pestaña concentra el estado operativo sin mezclarlo con asignación ni calificación.</p>
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
                  <option key={project.subgroupId} value={project.subgroupId}>{project.subgroup?.name || project.subgroup?.code || project.subgroupId}</option>
                ))}
              </select>
              <select className="input" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
                <option value="">Todos los miembros</option>
                {Array.from(new Map(Object.values(memberDirectory).flat().map((member) => [member.id, member])).values()).map((member) => (
                  <option key={member.id} value={member.id}>{member.fullName}</option>
                ))}
              </select>
              <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos los estados</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>

            <div className="space-y-4">
              {visibleTasks.length === 0 && <div className="empty-state"><h3>No hay tareas para este filtro</h3><p>Cambia la vista o asigna nuevas tareas desde la pestaña correspondiente.</p></div>}
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
                          <span className={`review-pill ${task.leaderValidation?.checked ? 'approved' : 'pending'}`}>{task.leaderValidation?.checked ? 'Validada por líder' : 'Pendiente de validar'}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
                          <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {(task.labels || []).length === 0 && <span className="badge-muted">Sin etiquetas extra</span>}
                          {(task.labels || []).map((label) => <span key={label} className="tag-chip">{label}</span>)}
                          <span className="tag-chip subtle">{SCORE_LABELS[task.score || 'sin_revisar']}</span>
                        </div>
                      </div>

                      {canUpdate && (
                        <div className="task-actions space-y-2">
                          <select className="input" value={task.status} onChange={(event) => handleStatusChange(task, event.target.value as TaskStatus)}>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[1.3fr_0.9fr]">
                      <div>
                        <label className="editor-label">Bitácora de la tarea</label>
                        <textarea
                          className="input min-h-24"
                          value={task.progressNote || ''}
                          onChange={(event) => handleNoteChange(task, event.target.value, 'progressNote')}
                          placeholder="Añade avances, incidencias o el estado operativo de la tarea."
                          disabled={!canUpdate}
                        />
                      </div>
                      <div className="task-meta-panel">
                        <p><strong>Ventana:</strong> {task.startDate} → {task.endDate}</p>
                        <p><strong>Cumplida:</strong> {task.completedAt ? new Date(task.completedAt).toLocaleString('es-PE') : 'Aún no'}</p>
                        <p><strong>Validación líder:</strong> {task.leaderValidation?.reviewerName || 'Pendiente'}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'assign' && (
        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="card space-y-4">
            <div>
              <p className="section-title">Asignación</p>
              <h2 className="text-xl font-semibold text-slate-900">Crear nueva tarea</h2>
              <p className="text-sm text-slate-500 mt-1">Aquí solo se gestiona la asignación para no saturar la vista operativa.</p>
            </div>

            {manageableProjects.length === 0 ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Necesitas ser líder o mentor de un proyecto para crear tareas.</p>
            ) : (
              <form className="space-y-3" onSubmit={handleCreateTask}>
                <div className="editor-section">
                  <label className="editor-label">Proyecto</label>
                  <select className="input" value={form.subgroupId} onChange={(event) => setForm((prev) => ({ ...prev, subgroupId: event.target.value }))} required>
                    {manageableProjects.map((project) => <option key={project.subgroupId} value={project.subgroupId}>{project.subgroup?.name || project.subgroup?.code || project.subgroupId}</option>)}
                  </select>
                </div>
                <div className="editor-section">
                  <label className="editor-label">Miembro responsable</label>
                  <select className="input" value={form.assigneeId} onChange={(event) => setForm((prev) => ({ ...prev, assigneeId: event.target.value }))} required>
                    <option value="">Selecciona un miembro</option>
                    {availableAssignees.map((member) => <option key={member.id} value={member.id}>{member.fullName} · {member.roleLabel}</option>)}
                  </select>
                </div>
                <div className="editor-section">
                  <label className="editor-label">Tarea</label>
                  <input className="input" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Ej. Preparar pruebas de integración" required />
                </div>
                <div className="editor-section">
                  <label className="editor-label">Descripción / criterio de cumplimiento</label>
                  <textarea className="input min-h-28" value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Define qué debe entregar el miembro y cómo validar el cumplimiento." required />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="editor-section"><label className="editor-label">Inicio</label><input className="input" type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} required /></div>
                  <div className="editor-section"><label className="editor-label">Fin</label><input className="input" type="date" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} required /></div>
                </div>
                <button className="btn-primary" type="submit">Crear tarea</button>
              </form>
            )}
            {feedback && <p className="text-sm text-blue-700">{feedback}</p>}
          </div>

          <div className="card space-y-4">
            <div>
              <p className="section-title">Reglas</p>
              <h2 className="text-xl font-semibold text-slate-900">Cómo se califican</h2>
            </div>
            <ul className="check-list-panel text-sm text-slate-600">
              <li>El estado operativo indica si la tarea está pendiente, en progreso, completada o vencida.</li>
              <li>Las etiquetas rápidas ayudan a contextualizar prioridad, bloqueos o autonomía.</li>
              <li>La casilla de validación es para el líder del proyecto o administrador.</li>
              <li>La nota de revisión permite dejar la calificación o criterio de cumplimiento.</li>
            </ul>
          </div>
        </section>
      )}

      {canSeeReviewTab && activeTab === 'review' && (
        <section className="card space-y-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-title">Calificación</p>
              <h2 className="text-xl font-semibold text-slate-900">Revisión por etiquetas y validación</h2>
              <p className="text-sm text-slate-500 mt-1">Separa la evaluación del trabajo operativo. Aquí se revisa cumplimiento, notas y checkbox de validación del líder.</p>
            </div>
            <div className="review-summary-strip">
              <span>{summary.completed} cumplidas</span>
              <span>{summary.validated} validadas</span>
              <span>{summary.overdue} vencidas</span>
            </div>
          </div>

          {reviewableTasks.length === 0 && <div className="empty-state"><h3>No hay tareas para calificar</h3><p>Necesitas ser líder del proyecto o administrador para usar esta pestaña.</p></div>}

          <div className="space-y-4">
            {reviewableTasks.map((task) => {
              const canToggleValidation = isGodAdmin || leaderProjectIds.has(task.subgroupId);
              return (
                <article key={task.id} className="review-card">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`task-status status-${task.status}`}>{STATUS_LABELS[task.status]}</span>
                        <span className="badge-link">{task.assigneeName}</span>
                        <span className="badge-muted">{task.subgroupName}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
                        <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                      </div>
                    </div>
                    <div className="task-review-box">
                      <label className={`leader-checkbox ${canToggleValidation ? '' : 'disabled'}`}>
                        <input type="checkbox" checked={!!task.leaderValidation?.checked} onChange={(event) => handleLeaderValidation(task, event.target.checked)} disabled={!canToggleValidation} />
                        Validada por líder
                      </label>
                      <p className="text-xs text-slate-500">{task.leaderValidation?.reviewerName ? `Última validación: ${task.leaderValidation.reviewerName}` : 'Sin validación aún.'}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="editor-label">Etiquetas de seguimiento</p>
                      <div className="flex flex-wrap gap-2">
                        {TASK_LABELS.map((label) => (
                          <button key={label} type="button" className={`tag-toggle ${(task.labels || []).includes(label) ? 'active' : ''}`} onClick={() => toggleLabel(task, label)}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                      <div>
                        <p className="editor-label">Nivel de cumplimiento</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {Object.entries(SCORE_LABELS).map(([value, label]) => (
                            <button key={value} type="button" className={`score-card ${task.score === value ? 'active' : ''}`} onClick={() => handleScoreChange(task, value as TaskScore)}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="editor-label">Nota de calificación</label>
                        <textarea className="input min-h-24" value={task.reviewNote || ''} onChange={(event) => handleNoteChange(task, event.target.value, 'reviewNote')} placeholder="Deja observaciones sobre el cumplimiento de la tarea." />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
