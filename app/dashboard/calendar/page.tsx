'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { reportsApi, subgroupsApi } from '../../../lib/api';
import { formatPeruDateTime, toPeruDateKey } from '../../../lib/datetime';

interface DayReport {
  id: string;
  title: string;
  reportDate: string;
  author: { fullName: string };
  subgroup?: { name?: string; code?: string };
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString('es-PE');
}

function monthGrid(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<Array<{ subgroupId: string; subgroup?: { name?: string; code?: string } }>>([]);
  const [reports, setReports] = useState<DayReport[]>([]);
  const [selectedDate, setSelectedDate] = useState(toPeruDateKey(new Date()));
  const [error, setError] = useState('');

  useEffect(() => {
    subgroupsApi.getMy()
      .then((res) => {
        const list = res.data.subgroups || [];
        setProjects(list);
        if (list.length > 0) setProjectId(list[0].subgroupId);
        else setError('No tienes membresías activas de proyecto.');
      })
      .catch(() => setError('No se pudieron cargar tus proyectos.'));
  }, []);

  const range = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    return { first, last };
  }, [cursor]);

  const load = async () => {
    if (!projectId) return;
    setError('');
    try {
      const res = await reportsApi.getAll({ subgroupId: projectId, limit: 500 });
      setReports(res.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudieron cargar reportes del calendario.');
    }
  };

  useEffect(() => {
    if (projectId) load();
  }, [projectId, cursor.getFullYear(), cursor.getMonth()]);

  const grouped = useMemo(() => {
    const map = new Map<string, DayReport[]>();
    for (const r of reports) {
      const key = toPeruDateKey(r.reportDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(r);
    }
    return map;
  }, [reports]);

  const days = useMemo(() => monthGrid(cursor), [cursor]);
  const selectedReports = grouped.get(selectedDate) || [];

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h1 className="text-2xl font-bold">Calendario de Reportes</h1>
        <div className="flex gap-2">
          <button className="border px-3 py-2 rounded" onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>Anterior</button>
          <button className="border px-3 py-2 rounded" onClick={() => setCursor(new Date())}>Hoy</button>
          <button className="border px-3 py-2 rounded" onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>Siguiente</button>
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-sm">Proyecto:</label>
        <select className="border rounded p-2" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => (
            <option key={p.subgroupId} value={p.subgroupId}>{p.subgroup?.name || p.subgroup?.code || p.subgroupId}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white border rounded-xl p-4">
        <p className="text-sm text-gray-600 mb-3">{cursor.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })}</p>
        <div className="grid grid-cols-7 gap-2 text-xs text-gray-500 mb-2">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => <div key={d} className="text-center">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const key = toDateKey(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const hasReports = (grouped.get(key)?.length || 0) > 0;
            const isSelected = key === selectedDate;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                className={`h-20 border rounded p-2 text-left transition ${isSelected ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-200'} ${inMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{d.getDate()}</span>
                  {hasReports && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                </div>
                {hasReports && <p className="text-[11px] text-blue-700 mt-1">{grouped.get(key)?.length} rep.</p>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border rounded-xl divide-y">
        <div className="p-4 font-semibold">Reportes del día {formatDateKey(selectedDate)}</div>
        {selectedReports.length === 0 && <p className="p-4 text-sm text-gray-500">No hay reportes en esta fecha.</p>}
        {selectedReports.map((r) => (
          <Link key={r.id} href={`/dashboard/reports/view?id=${r.id}`} className="block p-4 hover:bg-gray-50">
            <p className="font-medium">{r.title}</p>
            <p className="text-xs text-gray-500">{r.author.fullName} · {r.subgroup?.name || r.subgroup?.code || 'Proyecto'}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
