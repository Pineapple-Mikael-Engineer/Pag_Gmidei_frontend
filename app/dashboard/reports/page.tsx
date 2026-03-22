'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { GROUP_ROLE_LABELS, GroupRole, ReportApiModel, reportsApi, subgroupsApi } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { formatPeruDateTime } from '../../../lib/datetime';
import ReportEditor from '../../../components/reports/ReportEditor';
import { parseReportMarkdown } from '../../../lib/reportSections';
import { getReportReview, loadReportReviews, ReportReviewStatus, updateReportReview } from '../../../lib/reportReviews';
import { setLinkedTaskIds } from '../../../lib/reportTaskLinks';
import { fetchTasksFromAnySource, TaskItem } from '../../../lib/tasks';

type ReportItem = ReportApiModel & {
  status?: 'EN_PROGRESO' | 'COMPLETADO' | 'REVISADO';
  author: { id: string; fullName: string; role?: GroupRole };
};

type ProjectMembership = {
  subgroupId: string;
  subgroup?: { name?: string; code?: string };
  roles?: GroupRole[];
};

type MemberItem = {
  userId: string;
  roles: GroupRole[];
  user: { id: string; fullName: string; email: string };
};

type ReportTab = 'create' | 'browse' | 'review';

const STATUS_LABELS: Record<string, string> = {
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  REVISADO: 'Revisado',
};

const REVIEW_STATUS_LABELS: Record<ReportReviewStatus, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  requiere_cambios: 'Requiere cambios',
};

const REPORT_LABELS = ['Con evidencia clara', 'Seguimiento urgente', 'Bien documentado', 'Requiere mentoría'];

function warningMessageFromResponse(payload: any): string {
  const warning = payload?.warning || payload?.warnings?.[0];
  if (!warning) return '';
  return typeof warning === 'string' ? warning : warning.message || 'Se recibió una advertencia del backend.';
}

function canReviewProject(user: any, subgroupId?: string) {
  if (!subgroupId || !user) return false;
  if (user.isGodAdmin) return true;
  const membership = (user.memberships || []).find((item: any) => item.subgroupId === subgroupId);
  return !!membership && membership.roles.some((role: GroupRole) => role === 'MENTOR' || role === 'LIDER');
}

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [activeTab, setActiveTab] = useState<ReportTab>('browse');

  const [subgroupId, setSubgroupId] = useState('');
  const [mySubgroups, setMySubgroups] = useState<ProjectMembership[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<string, MemberItem[]>>({});
  const [reviewRefreshToken, setReviewRefreshToken] = useState(0);
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [filterSubgroupId, setFilterSubgroupId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMemberId, setFilterMemberId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    subgroupsApi
      .getMy()
      .then(async (res) => {
        const list = res.data.subgroups || [];
        setMySubgroups(list);
        if (!subgroupId && list.length > 0) setSubgroupId(list[0].subgroupId);

        const memberEntries = await Promise.all(
          list.map(async (item: ProjectMembership) => {
            try {
              const response = await subgroupsApi.getMembers(item.subgroupId);
              return [item.subgroupId, response.data.members || []] as const;
            } catch {
              return [item.subgroupId, []] as const;
            }
          }),
        );
        setMembersByProject(Object.fromEntries(memberEntries));
      })
      .catch(() => {
        const fallback = (user?.memberships || []).map((m) => ({ subgroupId: m.subgroupId, subgroup: { name: m.subgroupName, code: m.subgroupCode }, roles: m.roles }));
        setMySubgroups(fallback);
      });
  }, [subgroupId, user?.id, user?.memberships]);

  const memberOptions = useMemo(() => {
    const source = filterSubgroupId ? [filterSubgroupId] : mySubgroups.map((item) => item.subgroupId);
    return Array.from(new Map(source.flatMap((projectId) => (membersByProject[projectId] || []).map((member) => [member.user.id, member]))).values());
  }, [filterSubgroupId, membersByProject, mySubgroups]);

  useEffect(() => {
    fetchTasksFromAnySource()
      .then((result) => setTasks(result.tasks))
      .catch(() => setTasks([]));
  }, []);

  const projectTasks = useMemo(() => tasks.filter((task) => task.subgroupId === subgroupId && (user?.isGodAdmin || task.assigneeId === user?.id || (!!user?.email && task.assigneeEmail === user.email))), [subgroupId, tasks, user?.email, user?.id, user?.isGodAdmin]);

  const reportReviews = useMemo(() => {
    const loaded = loadReportReviews();
    return new Map(loaded.map((item) => [item.reportId, item]));
  }, [reviewRefreshToken]);

  const summary = useMemo(() => {
    return {
      total: reports.length,
      evidence: reports.filter((report) => report.has_evidence || (report.attachments?.length || 0) > 0 || (report.externalLinks?.length || 0) > 0).length,
      reviewed: reports.filter((report) => reportReviews.get(report.id)?.status === 'aprobado').length,
      members: new Set(reports.map((report) => report.author.id)).size,
    };
  }, [reportReviews, reports]);

  const canSeeReviewTab = useMemo(() => {
    if (user?.isGodAdmin) return true;
    return (user?.memberships || []).some((membership) => membership.roles.some((role) => role === 'LIDER' || role === 'MENTOR'));
  }, [user?.isGodAdmin, user?.memberships]);

  const reviewSummary = useMemo(() => {
    return {
      pending: reports.filter((report) => (reportReviews.get(report.id)?.status || 'pendiente') === 'pendiente').length,
      inReview: reports.filter((report) => reportReviews.get(report.id)?.status === 'en_revision').length,
      approved: reports.filter((report) => reportReviews.get(report.id)?.status === 'aprobado').length,
      changes: reports.filter((report) => reportReviews.get(report.id)?.status === 'requiere_cambios').length,
    };
  }, [reportReviews, reports]);

  const loadReports = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = { limit: 100 };
      if (onlyMine && user?.id) params.authorId = user.id;
      if (filterSubgroupId) params.subgroupId = filterSubgroupId;
      if (filterStatus) params.status = filterStatus;
      if (search.trim()) params.q = search.trim();
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await reportsApi.getAll(params);
      const loaded = (res.data.data || []) as ReportItem[];
      setReports(filterMemberId ? loaded.filter((report) => report.author.id === filterMemberId) : loaded);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudieron cargar los reportes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, [onlyMine, filterSubgroupId, filterStatus, filterMemberId, fromDate, toDate]);

  const updateReview = (reportId: string, patch: any) => {
    updateReportReview(reportId, {
      ...patch,
      reviewerId: user?.id,
      reviewerName: user?.fullName,
      reviewedAt: new Date().toISOString(),
    });
    setReviewRefreshToken((value) => value + 1);
  };

  return (
    <div className="page-shell space-y-6">
      <div>
        <p className="section-title">Informes</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Centro de reportes</h1>
      </div>

      <div className="module-tabs">
        <button type="button" className={activeTab === 'create' ? 'active' : ''} onClick={() => setActiveTab('create')}>Creación</button>
        <button type="button" className={activeTab === 'browse' ? 'active' : ''} onClick={() => setActiveTab('browse')}>Visualización</button>
        {canSeeReviewTab && <button type="button" className={activeTab === 'review' ? 'active' : ''} onClick={() => setActiveTab('review')}>Calificación</button>}
      </div>

      {activeTab === 'create' && (
        <section>
          <div className="card space-y-3">
            <p className="section-title">Creación de reporte</p>
            <label className="text-sm text-slate-600">Proyecto</label>
            <select className="input" value={subgroupId} onChange={(e) => setSubgroupId(e.target.value)}>
              {mySubgroups.map((m) => <option key={m.subgroupId} value={m.subgroupId}>{m.subgroup?.name || m.subgroup?.code || m.subgroupId}</option>)}
            </select>
            {warning && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{warning}</p>}
            <ReportEditor
              saving={saving}
              initialTaskIds={[]}
              availableTasks={projectTasks}
              onSubmit={async ({ title, markdown, comments, externalLinks, reportDate, taskIds, attachments }) => {
                setSaving(true);
                setError('');
                setWarning('');
                try {
                  const formData = new FormData();
                  formData.append('title', title);
                  formData.append('markdown', markdown);
                  formData.append('comments', comments);
                  formData.append('reportDate', reportDate);
                  if (externalLinks.trim()) formData.append('externalLinks', externalLinks);
                  if (!subgroupId) throw new Error('Selecciona subgrupo');
                  formData.append('subgroupId', subgroupId);
                  taskIds.forEach((taskId) => formData.append('taskIds', taskId));
                  Array.from(attachments || []).forEach((f) => formData.append('attachments', f));
                  const res = await reportsApi.create(formData);
                  const createdReportId = res.data?.report?.id || res.data?.data?.id || res.data?.id;
                  if (createdReportId) setLinkedTaskIds(createdReportId, taskIds);
                  const warn = warningMessageFromResponse(res.data);
                  if (warn) setWarning(warn);
                  await loadReports();
                  setActiveTab('browse');
                } catch (err: any) {
                  setError(err.response?.data?.error || err.message || 'No se pudo crear el reporte.');
                } finally {
                  setSaving(false);
                }
              }}
            />
          </div>


        </section>
      )}

      {activeTab === 'browse' && (
        <section className="card space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-title">Visualización</p>
              <h2 className="text-xl font-semibold text-slate-900">Explorador de informes</h2>
              <p className="text-sm text-slate-500 mt-1">Aquí viven los reportes y sus comentarios; la calificación se movió a una pestaña separada.</p>
            </div>
            <button onClick={loadReports} className="btn-secondary">Actualizar resultados</button>
          </div>

          <div className="filter-grid">
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="input filter-span-2" placeholder="Buscar por título o contenido" />
            <select value={filterSubgroupId} onChange={(e) => { setFilterSubgroupId(e.target.value); setFilterMemberId(''); }} className="input">
              <option value="">Todos los proyectos</option>
              {mySubgroups.map((m) => <option key={m.subgroupId} value={m.subgroupId}>{m.subgroup?.name || m.subgroup?.code || m.subgroupId}</option>)}
            </select>
            <select value={filterMemberId} onChange={(e) => setFilterMemberId(e.target.value)} className="input">
              <option value="">Todos los miembros</option>
              {memberOptions.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.fullName}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input">
              <option value="">Todos los estados backend</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
              Solo mis reportes
            </label>
            <button onClick={loadReports} className="btn-primary">Aplicar filtros</button>
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          {loading ? <p>Cargando...</p> : (
            <div className="space-y-4">
              {reports.length === 0 && <div className="empty-state"><h3>No hay reportes para esta combinación</h3><p>Prueba cambiando miembro, proyecto o rango de fechas.</p></div>}
              {reports.map((r) => {
                const sections = parseReportMarkdown(r.description);
                const hasEvidence = typeof r.has_evidence === 'boolean' ? r.has_evidence : ((r.links?.length || 0) > 0 || sections.evidencia.length > 0 || (r.externalLinks?.length || 0) > 0);
                const attachmentCount = r.attachments?.length || 0;
                const review = reportReviews.get(r.id) || getReportReview(r.id);
                return (
                  <Link key={r.id} href={`/dashboard/reports/view?id=${r.id}`} className="timeline-card rich-report-card">
                    <div className="report-card-accent" />
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge-muted">{r.subgroup?.name || r.subgroup?.code || 'Subgrupo'}</span>
                          {r.status && <span className="badge-link">{STATUS_LABELS[r.status] || r.status}</span>}
                          <span className={hasEvidence ? 'badge-ok' : 'badge-muted'}>{hasEvidence ? 'Con evidencia' : 'Sin evidencia'}</span>
                          <span className={`review-pill status-${review.status}`}>{REVIEW_STATUS_LABELS[review.status]}</span>
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{r.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{sections.avance || r.description}</p>
                        </div>
                        <div className="text-xs text-slate-500">{r.author.fullName} · {r.author.role ? GROUP_ROLE_LABELS[r.author.role] : '—'} · {formatPeruDateTime(r.reportDate)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="badge-muted">{attachmentCount > 0 ? `${attachmentCount} adj.` : 'Sin adjuntos'}</span>
                        {sections.problemas && <span className="badge-muted">Con problemas</span>}
                        {sections.siguientePaso && <span className="badge-muted">Con siguiente paso</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {canSeeReviewTab && activeTab === 'review' && (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="stat-card"><span className="stat-label">Pendientes</span><strong className="stat-value">{reviewSummary.pending}</strong></div>
            <div className="stat-card"><span className="stat-label">En revisión</span><strong className="stat-value">{reviewSummary.inReview}</strong></div>
            <div className="stat-card"><span className="stat-label">Aprobados</span><strong className="stat-value">{reviewSummary.approved}</strong></div>
            <div className="stat-card danger"><span className="stat-label">Con cambios</span><strong className="stat-value">{reviewSummary.changes}</strong></div>
          </div>

          <div className="card space-y-4">
            <div>
              <p className="section-title">Calificación de reportes</p>
              <h2 className="text-xl font-semibold text-slate-900">Etiquetas, checklist y decisión</h2>
              <p className="text-sm text-slate-500 mt-1">La revisión se separa del flujo de lectura para dejar más espacio a herramientas de calificación.</p>
            </div>

            {reports.length === 0 && <div className="empty-state"><h3>No hay reportes cargados</h3><p>Usa la pestaña de visualización para cargar primero la lista de reportes.</p></div>}

            <div className="space-y-4">
              {reports.map((report) => {
                const review = reportReviews.get(report.id) || getReportReview(report.id);
                const sections = parseReportMarkdown(report.description);
                const subgroupIdForPermissions = report.subgroup?.id || mySubgroups.find((item) => item.subgroup?.name === report.subgroup?.name || item.subgroup?.code === report.subgroup?.code)?.subgroupId;
                const allowed = canReviewProject(user, subgroupIdForPermissions);
                return (
                  <article key={report.id} className="review-card">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge-link">{report.author.fullName}</span>
                          <span className="badge-muted">{report.subgroup?.name || report.subgroup?.code || 'Subgrupo'}</span>
                          <span className={`review-pill status-${review.status}`}>{REVIEW_STATUS_LABELS[review.status]}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{report.title}</h3>
                          <p className="text-sm text-slate-600 mt-1">{sections.avance || report.description}</p>
                        </div>
                      </div>
                      <div className="review-summary-strip">
                        <span>{formatPeruDateTime(report.reportDate)}</span>
                        <span>{review.reviewerName || 'Sin revisor'}</span>
                      </div>
                    </div>

                    {!allowed ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Solo líderes, mentores o administradores del proyecto pueden calificar este reporte.</div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <p className="editor-label">Estado de calificación</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => (
                              <button key={value} type="button" className={`tag-toggle ${review.status === value ? 'active' : ''}`} onClick={() => updateReview(report.id, { status: value as ReportReviewStatus })}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="editor-label">Etiquetas</p>
                          <div className="flex flex-wrap gap-2">
                            {REPORT_LABELS.map((label) => (
                              <button
                                key={label}
                                type="button"
                                className={`tag-toggle ${review.tags.includes(label) ? 'active' : ''}`}
                                onClick={() => updateReview(report.id, { tags: review.tags.includes(label) ? review.tags.filter((item) => item !== label) : [...review.tags, label] })}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                          <div>
                            <p className="editor-label">Checklist de revisión</p>
                            <div className="check-list-panel review-checks">
                              {[
                                ['claridad', 'Explica claramente el avance'],
                                ['evidencia', 'Presenta evidencia suficiente'],
                                ['siguientePaso', 'Define un siguiente paso accionable'],
                              ].map(([key, label]) => (
                                <label key={key} className="leader-checkbox">
                                  <input type="checkbox" checked={review.checklist[key as keyof typeof review.checklist]} onChange={(event) => updateReview(report.id, { checklist: { [key]: event.target.checked } })} />
                                  {label}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="editor-label">Nota de calificación</label>
                            <textarea className="input min-h-24" value={review.reviewNote} onChange={(event) => updateReview(report.id, { reviewNote: event.target.value })} placeholder="Deja observaciones, aprobación o cambios solicitados." />
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
