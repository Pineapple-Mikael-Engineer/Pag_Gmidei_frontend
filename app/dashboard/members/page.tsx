'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { GROUP_ROLE_LABELS, GroupRole, reportsApi, subgroupsApi } from '../../../lib/api';
import { formatPeruDateTime } from '../../../lib/datetime';
import { useAuthStore } from '../../../store/authStore';

interface ProjectMembership {
  subgroupId: string;
  roles: GroupRole[];
  subgroup?: { name?: string; code?: string };
}
interface MemberItem {
  userId: string;
  roles: GroupRole[];
  user: { id: string; fullName: string; email: string };
}
interface ReportItem {
  id: string;
  title: string;
  reportDate: string;
  author: { id: string; fullName: string };
  attachments: Array<{ id: string }>;
}

export default function MembersPage() {
  const user = useAuthStore((s) => s.user);

  const [projects, setProjects] = useState<ProjectMembership[]>([]);
  const [projectId, setProjectId] = useState('');
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    subgroupsApi.getMy()
      .then((res) => {
        const list = res.data.subgroups || [];
        setProjects(list);
        if (list.length > 0) setProjectId(list[0].subgroupId);
      })
      .catch(() => setError('No se pudo cargar tus proyectos.'));
  }, []);

  const loadProjectData = async (id = projectId) => {
    if (!id) return;
    setError('');
    try {
      const [mRes, rRes] = await Promise.all([
        subgroupsApi.getMembers(id),
        reportsApi.getAll({ subgroupId: id, limit: 100 }),
      ]);
      setMembers(mRes.data.members || []);
      setReports(rRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo cargar miembros/reportes del proyecto.');
    }
  };

  useEffect(() => {
    if (!projectId) return;
    setSelectedMemberId('');
    loadProjectData(projectId);
  }, [projectId]);

  const visibleReports = useMemo(() => {
    if (!selectedMemberId) return reports;
    return reports.filter((r) => r.author.id === selectedMemberId);
  }, [reports, selectedMemberId]);

  return (
    <div className="page-shell space-y-4">
      <div className="card bg-gradient-to-r from-white to-slate-50/80">
        <h1 className="text-2xl font-bold">Miembros</h1>
        <p className="text-sm text-slate-500">Seguimiento de integrantes y sus reportes por proyecto.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-sm">Proyecto:</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input">
          {projects.map((p) => (
            <option key={p.subgroupId} value={p.subgroupId}>{p.subgroup?.name || p.subgroup?.code || p.subgroupId}</option>
          ))}
        </select>

        <label className="text-sm">Filtrar reportes por miembro:</label>
        <select value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)} className="input">
          <option value="">Todos</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.user.fullName}</option>
          ))}
        </select>

        <button className="btn-secondary" onClick={() => loadProjectData()}>Actualizar</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card divide-y">
          <div className="p-4 font-semibold">Miembros del proyecto</div>
          {members.length === 0 && <p className="p-4 text-gray-500">No hay miembros visibles.</p>}
          {members.map((m) => (
            <div key={m.userId} className="p-4">
              <p className="font-medium">{m.user.fullName}</p>
              <p className="text-sm text-gray-600">{m.user.email}</p>
              <p className="text-xs text-gray-500">{m.roles.map((r) => GROUP_ROLE_LABELS[r]).join(', ') || 'Sin rol'}</p>
            </div>
          ))}
        </div>

        <div className="card divide-y">
          <div className="p-4 font-semibold">Reportes del proyecto{selectedMemberId ? ' (filtrados)' : ''}</div>
          {visibleReports.length === 0 && <p className="p-4 text-gray-500">No hay reportes para este filtro.</p>}
          {visibleReports.map((r) => (
            <Link key={r.id} href={`/dashboard/reports/view?id=${r.id}`} className="block p-4 hover:bg-slate-50 transition">
              <p className="font-medium">{r.title}</p>
              <p className="text-xs text-gray-500">{r.author.fullName} · {formatPeruDateTime(r.reportDate)} · {r.attachments?.length || 0} adj.</p>
            </Link>
          ))}
        </div>
      </div>

      {!projectId && <p className="text-sm text-gray-600">No tienes membresías activas en proyectos.</p>}
      {!!user && projects.length === 0 && <p className="text-sm text-gray-600">Solicita acceso a un proyecto para visualizar miembros y reportes.</p>}
    </div>
  );
}
