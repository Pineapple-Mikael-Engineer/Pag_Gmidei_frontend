'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { GROUP_ROLE_LABELS, GroupRole } from '../../../lib/api';
import { reportsApi, subgroupsApi } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { formatPeruDateTime } from '../../../lib/datetime';

type ReportItem = {
  id: string;
  title: string;
  description: string;
  reportDate: string;
  comments?: string | null;
  subgroup?: { id: string; name: string; code: string };
  author: { id: string; fullName: string; role?: GroupRole };
  attachments: Array<{ id: string; originalName: string }>;
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

  const [title, setTitle] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [comments, setComments] = useState('');
  const [externalLinks, setExternalLinks] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);

  const [subgroupId, setSubgroupId] = useState('');
  const [mySubgroups, setMySubgroups] = useState<Array<{ subgroupId: string; subgroup?: { name?: string; code?: string } }>>([]);

  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [filterSubgroupId, setFilterSubgroupId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    subgroupsApi.getMy()
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

  useEffect(() => { loadReports(); }, [onlyMine, filterSubgroupId, filterStatus, fromDate, toDate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
      Array.from(files || []).forEach((f) => formData.append('attachments', f));
      await reportsApi.create(formData);
      setTitle('');
      setMarkdown('');
      setComments('');
      setExternalLinks('');
      setFiles(null);
      await loadReports();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'No se pudo crear el reporte.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-bold">Reportes</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 shadow-sm border space-y-3">
        <h2 className="font-semibold">Nuevo reporte</h2>
        <select className="w-full border rounded p-2" value={subgroupId} onChange={(e) => setSubgroupId(e.target.value)}>
          {mySubgroups.map((m) => (
            <option key={m.subgroupId} value={m.subgroupId}>{m.subgroup?.name || m.subgroup?.code || m.subgroupId}</option>
          ))}
        </select>
        <input className="w-full border rounded p-2" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="w-full border rounded p-2 min-h-32" placeholder="Contenido del reporte en Markdown (opcional si subes archivos)" value={markdown} onChange={(e) => setMarkdown(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="Enlaces externos (separados por comas)" value={externalLinks} onChange={(e) => setExternalLinks(e.target.value)} />
        <input className="w-full border rounded p-2" placeholder="Comentarios adicionales" value={comments} onChange={(e) => setComments(e.target.value)} />
        <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
        <p className="text-xs text-gray-500">Puedes guardar con archivos, enlaces o contenido markdown.</p>
        <button disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar reporte'}</button>
      </form>

      <div className="bg-white rounded-xl p-5 shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="border rounded p-2 text-sm lg:col-span-2" placeholder="Buscar por título o contenido" />
          <select value={filterSubgroupId} onChange={(e) => setFilterSubgroupId(e.target.value)} className="border rounded p-2 text-sm">
            <option value="">Todos subgrupos</option>
            {mySubgroups.map((m) => <option key={m.subgroupId} value={m.subgroupId}>{m.subgroup?.name || m.subgroup?.code || m.subgroupId}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded p-2 text-sm">
            <option value="">Todos estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border rounded p-2 text-sm" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border rounded p-2 text-sm" />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />Solo mis reportes</label>
          <button onClick={loadReports} className="border rounded px-3 py-2 text-sm">Aplicar filtros</button>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {loading ? <p>Cargando...</p> : (
          <div className="space-y-3">
            {reports.length === 0 && <p className="text-gray-500">No hay reportes con esos filtros.</p>}
            {reports.map((r) => (
              <Link key={r.id} href={`/dashboard/reports/view?id=${r.id}`} className="block border rounded-lg p-3 hover:bg-gray-50">
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.title}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{r.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{r.author.fullName} · {r.author.role ? GROUP_ROLE_LABELS[r.author.role] : '—'} · {formatPeruDateTime(r.reportDate)}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {r.subgroup?.name || r.subgroup?.code || 'Subgrupo'}
                    {r.status && <p className="mt-1">{STATUS_LABELS[r.status] || r.status}</p>}
                    {(r.attachments?.length ?? 0) > 0 && <p className="mt-1 text-blue-700">{r.attachments.length} adjunto(s)</p>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
