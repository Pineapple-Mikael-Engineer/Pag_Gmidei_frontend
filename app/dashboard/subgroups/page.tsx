'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { GROUP_ROLE_LABELS, GroupRole, reportsApi, subgroupsApi } from '../../../lib/api';
import { formatPeruDateTime } from '../../../lib/datetime';
import { useAuthStore } from '../../../store/authStore';

interface ProjectItem {
  subgroupId: string;
  roles: GroupRole[];
  subgroup: { id: string; name: string; code: string; description?: string | null };
}
interface MemberItem { userId: string; roles: GroupRole[]; user: { id: string; fullName: string; email: string } }
interface ProjectReport { id: string; title: string; reportDate: string; author: { fullName: string }; attachments: Array<{ id: string }>; externalLinks?: string[] }

export default function ProjectsPage() {
  const user = useAuthStore((s) => s.user);
  const canAccess = !!user?.isGodAdmin || (user?.memberships || []).some((m) => m.roles.includes('MENTOR'));

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectId, setProjectId] = useState('');
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [projectReports, setProjectReports] = useState<ProjectReport[]>([]);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<GroupRole[]>(['MIEMBRO']);
  const [error, setError] = useState('');

  const loadProjects = async () => {
    const res = await subgroupsApi.getMy();
    const list = (res.data.subgroups || []).filter((p: ProjectItem) => p.subgroup);
    setProjects(list);
    if (list.length && !projectId) setProjectId(list[0].subgroupId);
  };

  const loadMembers = async (id = projectId) => {
    if (!id) return;
    const res = await subgroupsApi.getMembers(id);
    setMembers(res.data.members || []);
  };

  const loadReports = async (id = projectId) => {
    if (!id) return;
    const res = await reportsApi.getAll({ subgroupId: id, limit: 20 });
    setProjectReports(res.data.data || []);
  };

  useEffect(() => { if (canAccess) loadProjects().catch(() => setError('No se pudo cargar proyectos.')); }, [canAccess]);
  useEffect(() => {
    if (!projectId) return;
    loadMembers(projectId).catch(() => setError('No se pudo cargar miembros.'));
    loadReports(projectId).catch(() => setError('No se pudieron cargar reportes del proyecto.'));
  }, [projectId]);

  const myRoles = useMemo(() => projects.find((s) => s.subgroupId === projectId)?.roles || [], [projects, projectId]);
  const canManageProject = !!user?.isGodAdmin || myRoles.includes('MENTOR');

  const toggleRole = (r: GroupRole) => setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  if (!canAccess) {
    return <div className="p-8">Acceso restringido. Esta sección es solo para mentores y modo dios.</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Proyectos</h1>
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-white/90 backdrop-blur border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
        <h2 className="font-semibold text-slate-800">Crear proyecto de ingeniería</h2>
        <div className="grid md:grid-cols-3 gap-2">
          <input className="border rounded p-2" placeholder="Nombre del proyecto" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="border rounded p-2" placeholder="Código (ej. TURTLEBOT)" value={code} onChange={(e) => setCode(e.target.value)} />
          <input className="border rounded p-2" placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg px-4 py-2 font-medium shadow hover:opacity-95" onClick={async () => {
          try {
            await subgroupsApi.createProject({ name, code, description });
            setName(''); setCode(''); setDescription('');
            await loadProjects();
          } catch (e: any) { setError(e.response?.data?.error || 'No se pudo crear proyecto.'); }
        }}>Crear proyecto</button>
      </div>

      <div className="flex items-center gap-2 bg-white/80 border border-slate-200 rounded-xl px-3 py-2 w-fit">
        <label className="text-sm">Proyecto:</label>
        <select className="border rounded p-2" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => <option key={p.subgroupId} value={p.subgroupId}>{p.subgroup.name} ({p.subgroup.code})</option>)}
        </select>
      </div>

      {projectId && (
        <div className="bg-white/90 border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
          <h2 className="font-semibold">Datos del proyecto</h2>
          <p className="text-sm text-gray-600">Rol actual en este proyecto: {myRoles.map((r) => GROUP_ROLE_LABELS[r]).join(', ') || 'Ninguno'}</p>
          {canManageProject && (
            <button className="border border-red-300 text-red-700 rounded px-3 py-1 text-sm" onClick={async () => {
              if (!confirm('¿Desactivar este proyecto?')) return;
              try { await subgroupsApi.deleteProject(projectId); setProjectId(''); await loadProjects(); }
              catch (e: any) { setError(e.response?.data?.error || 'No se pudo eliminar proyecto.'); }
            }}>Desactivar proyecto</button>
          )}
        </div>
      )}

      {canManageProject && projectId && (
        <div className="bg-white/90 border border-slate-200 rounded-2xl p-5 space-y-2 shadow-sm">
          <h2 className="font-semibold">Asignar miembros al proyecto</h2>
          <div className="flex gap-2">
            <input className="border rounded p-2 flex-1" placeholder="correo@uni.pe" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="bg-blue-600 text-white px-3 rounded" onClick={async () => {
              try {
                await subgroupsApi.addMember(projectId, { email, roles });
                setEmail(''); setRoles(['MIEMBRO']);
                await loadMembers();
              } catch (e: any) { setError(e.response?.data?.error || 'No se pudo agregar miembro.'); }
            }}>Agregar</button>
          </div>
          <div className="flex gap-3 text-sm">
            {(['MIEMBRO', 'LIDER', 'MENTOR'] as GroupRole[]).map((r) => (
              <label key={r} className="flex items-center gap-1"><input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} />{GROUP_ROLE_LABELS[r]}</label>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white/95 border border-slate-200 rounded-2xl divide-y shadow-sm">
          <div className="p-4 font-semibold">Miembros del proyecto</div>
          {members.map((m) => (
            <div key={m.userId} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{m.user.fullName}</p>
                <p className="text-sm text-gray-600">{m.user.email}</p>
                <p className="text-xs text-gray-500">{m.roles.map((r) => GROUP_ROLE_LABELS[r]).join(', ')}</p>
              </div>
              {canManageProject && (
                <div className="flex gap-2">
                  <button className="border rounded px-2 py-1 text-xs" onClick={async () => {
                    const next: GroupRole[] = m.roles.includes('LIDER') ? ['MIEMBRO'] : ['MIEMBRO', 'LIDER'];
                    try { await subgroupsApi.setMemberRoles(projectId, m.userId, next); await loadMembers(); }
                    catch (e: any) { setError(e.response?.data?.error || 'No se pudo actualizar roles.'); }
                  }}>Alternar líder</button>
                  <button className="border border-red-300 text-red-700 rounded px-2 py-1 text-xs" onClick={async () => {
                    try { await subgroupsApi.removeMember(projectId, m.userId); await loadMembers(); }
                    catch (e: any) { setError(e.response?.data?.error || 'No se pudo remover miembro.'); }
                  }}>Remover</button>
                </div>
              )}
            </div>
          ))}
          {members.length === 0 && <p className="p-4 text-sm text-gray-500">Sin miembros activos.</p>}
        </div>

        <div className="bg-white/95 border border-slate-200 rounded-2xl divide-y shadow-sm">
          <div className="p-4 font-semibold">Reportes del proyecto</div>
          {projectReports.map((r) => (
            <Link key={r.id} href={`/dashboard/reports/view?id=${r.id}`} className="block p-4 hover:bg-gray-50">
              <p className="font-medium">{r.title}</p>
              <p className="text-xs text-gray-500">{r.author.fullName} · {formatPeruDateTime(r.reportDate)} · {r.attachments?.length || 0} adj.</p>
              {(r.externalLinks?.length || 0) > 0 && <p className="text-xs text-blue-700">{r.externalLinks?.length} enlace(s)</p>}
            </Link>
          ))}
          {projectReports.length === 0 && <p className="p-4 text-sm text-gray-500">No hay reportes en este proyecto.</p>}
        </div>
      </div>
    </div>
  );
}
