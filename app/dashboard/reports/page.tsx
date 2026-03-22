'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { GROUP_ROLE_LABELS, GroupRole, ReportApiModel, reportsApi, subgroupsApi } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { formatPeruDateTime } from '../../../lib/datetime';
import ReportEditor from '../../../components/reports/ReportEditor';
import { parseReportMarkdown } from '../../../lib/reportSections';

type ReportItem = ReportApiModel & {
  status?: 'EN_PROGRESO' | 'COMPLETADO' | 'REVISADO';
  author: { id: string; fullName: string; role?: GroupRole };
};

type ProjectMembership = {
  subgroupId: string;
  subgroup?: { name?: string; code?: string };
};

type MemberItem = {
  userId: string;
  roles: GroupRole[];
  user: { id: string; fullName: string; email: string };
};

const STATUS_LABELS: Record<string, string> = {
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  REVISADO: 'Revisado',
};

function warningMessageFromResponse(payload: any): string {
  const warning = payload?.warning || payload?.warnings?.[0];
  if (!warning) return '';
  return typeof warning === 'string' ? warning : warning.message || 'Se recibió una advertencia del backend.';
}

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const [subgroupId, setSubgroupId] = useState('');
  const [mySubgroups, setMySubgroups] = useState<ProjectMembership[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<string, MemberItem[]>>({});

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
        const fallback = (user?.memberships || []).map((m) => ({ subgroupId: m.subgroupId, subgroup: { name: m.subgroupName, code: m.subgroupCode } }));
        setMySubgroups(fallback);
      });
  }, [subgroupId, user?.id, user?.memberships]);

  const memberOptions = useMemo(() => {
    const source = filterSubgroupId ? [filterSubgroupId] : mySubgroups.map((item) => item.subgroupId);
    return Array.from(
      new Map(
        source.flatMap((projectId) => (membersByProject[projectId] || []).map((member) => [member.user.id, member])),
      ).values(),
    );
  }, [filterSubgroupId, membersByProject, mySubgroups]);

  const summary = useMemo(() => {
    return {
      total: reports.length,
      evidence: reports.filter((report) => report.has_evidence || (report.attachments?.length || 0) > 0 || (report.externalLinks?.length || 0) > 0).length,
      reviewed: reports.filter((report) => report.status === 'REVISADO').length,
      members: new Set(reports.map((report) => report.author.id)).size,
    };
  }, [reports]);

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

  return (
    <div className="page-shell space-y-6">
      <section className="hero-surface report-hero">
        <div className="space-y-3">
          <p className="section-title">Informes</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Centro de reportes</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Reúne redacción, evidencia y revisión en una misma experiencia. Ahora puedes filtrar por miembro, detectar reportes con evidencia y navegar la actividad como un timeline real.
          </p>
        </div>
        <div className="hero-metrics-grid">
          <div className="metric-card">
            <span className="metric-label">Reportes visibles</span>
            <strong className="metric-value">{summary.total}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Con evidencia</span>
            <strong className="metric-value">{summary.evidence}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Revisados</span>
            <strong className="metric-value">{summary.reviewed}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Miembros activos</span>
            <strong className="metric-value">{summary.members}</strong>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <div className="card space-y-3">
          <p className="section-title">Creación de reporte</p>
          <label className="text-sm text-slate-600">Proyecto</label>
          <select className="input" value={subgroupId} onChange={(e) => setSubgroupId(e.target.value)}>
            {mySubgroups.map((m) => (
              <option key={m.subgroupId} value={m.subgroupId}>
                {m.subgroup?.name || m.subgroup?.code || m.subgroupId}
              </option>
            ))}
          </select>

          {warning && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{warning}</p>}

          <ReportEditor
            saving={saving}
            onSubmit={async ({ title, markdown, comments, externalLinks, attachments }) => {
              setSaving(true);
              setError('');
              setWarning('');
              try {
                const formData = new FormData();
                formData.append('title', title);
                formData.append('markdown', markdown);
                formData.append('comments', comments);
                if (externalLinks.trim()) formData.append('externalLinks', externalLinks);
                if (!subgroupId) throw new Error('Selecciona subgrupo');
                formData.append('subgroupId', subgroupId);
                Array.from(attachments || []).forEach((f) => formData.append('attachments', f));
                const res = await reportsApi.create(formData);
                const warn = warningMessageFromResponse(res.data);
                if (warn) setWarning(warn);
                await loadReports();
              } catch (err: any) {
                setError(err.response?.data?.error || err.message || 'No se pudo crear el reporte.');
              } finally {
                setSaving(false);
              }
            }}
          />
        </div>

        <div className="card space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-title">Explorador</p>
              <h2 className="text-xl font-semibold text-slate-900">Visualización de informes</h2>
              <p className="text-sm text-slate-500 mt-1">Filtra por miembro, estado, fechas o proyecto y navega cada reporte con mejor jerarquía visual.</p>
            </div>
            <button onClick={loadReports} className="btn-secondary">Actualizar resultados</button>
          </div>

          <div className="filter-grid">
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="input filter-span-2" placeholder="Buscar por título o contenido" />
            <select value={filterSubgroupId} onChange={(e) => { setFilterSubgroupId(e.target.value); setFilterMemberId(''); }} className="input">
              <option value="">Todos los proyectos</option>
              {mySubgroups.map((m) => (
                <option key={m.subgroupId} value={m.subgroupId}>
                  {m.subgroup?.name || m.subgroup?.code || m.subgroupId}
                </option>
              ))}
            </select>
            <select value={filterMemberId} onChange={(e) => setFilterMemberId(e.target.value)} className="input">
              <option value="">Todos los miembros</option>
              {memberOptions.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.fullName}
                </option>
              ))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input">
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
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

          {loading ? (
            <p>Cargando...</p>
          ) : (
            <div className="space-y-4">
              {reports.length === 0 && <div className="empty-state"><h3>No hay reportes para esta combinación</h3><p>Prueba cambiando miembro, proyecto o rango de fechas.</p></div>}
              {reports.map((r) => {
                const sections = parseReportMarkdown(r.description);
                const hasEvidence = typeof r.has_evidence === 'boolean' ? r.has_evidence : ((r.links?.length || 0) > 0 || sections.evidencia.length > 0 || (r.externalLinks?.length || 0) > 0);
                const attachmentCount = r.attachments?.length || 0;
                return (
                  <Link key={r.id} href={`/dashboard/reports/view?id=${r.id}`} className="timeline-card rich-report-card">
                    <div className="report-card-accent" />
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge-muted">{r.subgroup?.name || r.subgroup?.code || 'Subgrupo'}</span>
                          {r.status && <span className="badge-link">{STATUS_LABELS[r.status] || r.status}</span>}
                          <span className={hasEvidence ? 'badge-ok' : 'badge-muted'}>{hasEvidence ? 'Con evidencia' : 'Sin evidencia'}</span>
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-slate-900">{r.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{sections.avance || r.description}</p>
                        </div>
                        <div className="text-xs text-slate-500">
                          {r.author.fullName} · {r.author.role ? GROUP_ROLE_LABELS[r.author.role] : '—'} · {formatPeruDateTime(r.reportDate)}
                        </div>
                      </div>

                      <div className="report-meta-stack">
                        <div>
                          <span className="meta-label">Problemas</span>
                          <p>{sections.problemas || 'Sin bloqueos registrados.'}</p>
                        </div>
                        <div>
                          <span className="meta-label">Siguiente paso</span>
                          <p>{sections.siguientePaso || 'No definido.'}</p>
                        </div>
                        <div>
                          <span className="meta-label">Adjuntos</span>
                          <p>{attachmentCount > 0 ? `${attachmentCount} archivo(s)` : 'Sin adjuntos'}</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
