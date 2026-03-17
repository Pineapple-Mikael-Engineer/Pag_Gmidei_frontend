'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '../../../lib/api';
import { formatPeruDateTime } from '../../../lib/datetime';
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
  author: { fullName: string; email: string };
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

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);

  const [tab, setTab] = useState<'users' | 'reports' | 'projects'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

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
      setReports(res.data.reports || []);
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

  useEffect(() => {
    if (!user?.isGodAdmin) return;
    setError('');
    if (tab === 'users') loadUsers();
    if (tab === 'reports') loadReports();
    if (tab === 'projects') loadProjects();
  }, [user?.isGodAdmin, tab]);

  if (!user?.isGodAdmin) return <div className="page-shell">Acceso restringido.</div>;

  return (
    <div className="page-shell space-y-4">
      <div className="card bg-gradient-to-r from-white to-slate-50/80">
        <h1 className="text-2xl font-bold">Panel Dios</h1>
        <p className="text-sm text-slate-500">Administración global de usuarios, reportes y proyectos.</p>
      </div>

      <div className="card flex gap-2 flex-wrap">
        <button className={`btn-secondary ${tab === 'users' ? 'bg-slate-900 text-white border-slate-900' : ''}`} onClick={() => setTab('users')}>Usuarios</button>
        <button className={`btn-secondary ${tab === 'reports' ? 'bg-slate-900 text-white border-slate-900' : ''}`} onClick={() => setTab('reports')}>Reportes</button>
        <button className={`btn-secondary ${tab === 'projects' ? 'bg-slate-900 text-white border-slate-900' : ''}`} onClick={() => setTab('projects')}>Proyectos</button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
            <button className="btn-secondary" onClick={loadReports}>Buscar</button>
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
    </div>
  );
}
