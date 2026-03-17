'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { GROUP_ROLE_LABELS, GroupRole } from '../../../lib/api';
import { reportsApi, subgroupsApi } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { formatPeruDateTime } from '../../../lib/datetime';
import ReportEditor from '../../../components/reports/ReportEditor';
import { parseReportMarkdown } from '../../../lib/reportSections';

type ReportItem = {
  id: string;
  title: string;
  description: string;
  reportDate: string;
  comments?: string | null;
  subgroup?: { id: string; name: string; code: string };
  author: { id: string; fullName: string; role?: GroupRole };
  attachments: Array<{ id: string; originalName: string }>;
  externalLinks?: string[];
  status?: 'EN_PROGRESO' | 'COMPLETADO' | 'REVISADO';
};

const STATUS_LABELS: Record<string, string> = {
  EN_PROGRESO: 'En progreso',
  COMPLETADO: 'Completado',
  REVISADO: 'Revisado',
};

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [subgroupId, setSubgroupId] = useState('');
  const [mySubgroups, setMySubgroups] = useState<Array<{ subgroupId: string; subgroup?: { name?: string; code?: string } }>>([]);

  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [filterSubgroupId, setFilterSubgroupId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    subgroupsApi
      .getMy()
      .then((res) => {
        const list = res.data.subgroups || [];
        setMySubgroups(list);
        if (!subgroupId && list.length > 0) setSubgroupId(list[0].subgroupId);
      })
      .catch(() => {
        const fallback = (user?.memberships || []).map((m) => ({ subgroupId: m.subgroupId, subgroup: { name: m.subgroupName, code: m.subgroupCode } }));
        setMySubgroups(fallback);
      });
  }, [user?.id]);

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
      setReports(res.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudieron cargar los reportes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [onlyMine, filterSubgroupId, filterStatus, fromDate, toDate]);

  return (
    <div className="page-shell space-y-6">
      <div className="card bg-gradient-to-r from-white to-slate-50/80">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sistema de reportes</h1>
        <p className="text-sm text-slate-500 mt-1">Visualización tipo timeline, edición rápida y reportes guiados por bloques.</p>
      </div>
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

        <ReportEditor
          saving={saving}
          onSubmit={async ({ title, markdown, comments, externalLinks, attachments }) => {
            setSaving(true);
            setError('');
            try {
              const formData = new FormData();
              formData.append('title', title);
              formData.append('markdown', markdown);
              formData.append('comments', comments);
              if (externalLinks.trim()) formData.append('externalLinks', externalLinks);
              if (!subgroupId) throw new Error('Selecciona subgrupo');
              formData.append('subgroupId', subgroupId);
              Array.from(attachments || []).forEach((f) => formData.append('attachments', f));
              await reportsApi.create(formData);
              await loadReports();
            } catch (err: any) {
              setError(err.response?.data?.error || err.message || 'No se pudo crear el reporte.');
            } finally {
              setSaving(false);
            }
          }}
        />
      </div>

      <div className="card">
        <p className="section-title">Timeline de reportes</p>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input lg:col-span-2" placeholder="Buscar por título o contenido" />
          <select value={filterSubgroupId} onChange={(e) => setFilterSubgroupId(e.target.value)} className="input">
            <option value="">Todos subgrupos</option>
            {mySubgroups.map((m) => (
              <option key={m.subgroupId} value={m.subgroupId}>
                {m.subgroup?.name || m.subgroup?.code || m.subgroupId}
              </option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input">
            <option value="">Todos estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />Solo mis reportes
          </label>
          <button onClick={loadReports} className="btn-secondary">Aplicar filtros</button>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {loading ? (
          <p>Cargando...</p>
        ) : (
          <div className="space-y-4">
            {reports.length === 0 && <p className="text-slate-500">No hay reportes con esos filtros.</p>}
            {reports.map((r) => {
              const sections = parseReportMarkdown(r.description);
              const hasEvidence = sections.evidencia.length > 0 || (r.externalLinks?.length || 0) > 0;
              return (
                <Link key={r.id} href={`/dashboard/reports/view?id=${r.id}`} className="timeline-card">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{r.title}</p>
                      <p className="text-sm text-slate-600 line-clamp-2">{sections.avance || r.description}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {r.author.fullName} · {r.author.role ? GROUP_ROLE_LABELS[r.author.role] : '—'} · {formatPeruDateTime(r.reportDate)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-500 space-y-1">
                      <p>{r.subgroup?.name || r.subgroup?.code || 'Subgrupo'}</p>
                      {r.status && <p>{STATUS_LABELS[r.status] || r.status}</p>}
                      <p className={hasEvidence ? 'text-emerald-700' : 'text-slate-400'}>{hasEvidence ? 'Con evidencia' : 'Sin evidencia'}</p>
                      {(r.attachments?.length ?? 0) > 0 && <p className="text-blue-700">{r.attachments.length} adjunto(s)</p>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
