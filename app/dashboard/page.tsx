'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { reportsApi, usersApi, GROUP_ROLE_LABELS, GroupRole } from '../../lib/api';
import { formatPeruDateTime } from '../../lib/datetime';
import { CheckSquare, FileText, Users } from 'lucide-react';
import Link from 'next/link';
import { loadTasks } from '../../lib/tasks';

interface Stats { reports: number; members: number; tasks: number; }
interface Report {
  id: string;
  title: string;
  reportDate: string;
  attachments?: any[];
  author: { fullName: string; role?: GroupRole };
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<Stats>({ reports: 0, members: 0, tasks: 0 });
  const [recentReports, setRecentReports] = useState<Report[]>([]);

  useEffect(() => {
    Promise.allSettled([reportsApi.getAll({ limit: 5 }), usersApi.getAll()])
      .then(([rep, usr]) => {
        const reportsTotal = rep.status === 'fulfilled' ? (rep.value.data.meta?.total || 0) : 0;
        const membersTotal = usr.status === 'fulfilled' ? (usr.value.data.users?.length || 0) : 0;
        const tasksTotal = user?.id ? loadTasks().filter((task) => task.assigneeId === user.id || task.mentorOrLeaderIds.includes(user.id)).length : 0;
        setStats({ reports: reportsTotal, members: membersTotal, tasks: tasksTotal });
        setRecentReports(rep.status === 'fulfilled' ? (rep.value.data.data || []) : []);
      })
      .catch(console.error);
  }, [user?.id]);

  const primaryRole = user?.memberships?.[0]?.roles?.[0];
  const quickLinks = useMemo(
    () => [
      { href: '/dashboard/reports', title: 'Explorar informes', description: 'Filtra por miembro, evidencia y estado.', icon: FileText },
      { href: '/dashboard/tasks', title: 'Gestionar tareas', description: 'Asigna responsables y valida cumplimiento.', icon: CheckSquare },
    ],
    [],
  );

  return (
    <div className="page-shell space-y-6">
      <section className="hero-surface">
        <div>
          <p className="section-title">Inicio</p>
          <h1 className="text-3xl font-bold text-slate-950">¡Hola, {user?.fullName?.split(' ')[0]}! 👋</h1>
          <p className="mt-2 text-slate-500">{primaryRole ? GROUP_ROLE_LABELS[primaryRole] : ''} · {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total reportes', value: stats.reports, icon: FileText, color: 'bg-blue-500' },
          { label: 'Miembros activos', value: stats.members, icon: Users, color: 'bg-emerald-500' },
          { label: 'Tareas visibles', value: stats.tasks, icon: CheckSquare, color: 'bg-violet-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`${color} w-12 h-12 rounded-xl flex items-center justify-center`}><Icon size={22} className="text-white" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{value}</p><p className="text-sm text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Reportes recientes</h2>
            <Link href="/dashboard/reports" className="text-blue-600 text-sm hover:underline">Ver todos →</Link>
          </div>

          {recentReports.length === 0 ? <p className="text-gray-400 text-center py-8">No hay reportes aún.</p> : (
            <div className="space-y-3">
              {recentReports.map((r) => (
                <Link key={r.id} href={`/dashboard/reports/view?id=${r.id}`} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition border border-slate-200">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{r.title}</p>
                    <p className="text-xs text-gray-400">{r.author.fullName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{formatPeruDateTime(r.reportDate)}</p>
                    {(r.attachments?.length ?? 0) > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{r.attachments?.length ?? 0} adj.</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Accesos rápidos</h2>
          {quickLinks.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href} className="quick-link-card">
              <div className="quick-link-icon"><Icon size={18} /></div>
              <div>
                <p className="font-medium text-slate-900">{title}</p>
                <p className="text-sm text-slate-500">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
