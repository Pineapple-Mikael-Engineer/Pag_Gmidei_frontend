'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { reportsApi, usersApi, GROUP_ROLE_LABELS, GroupRole } from '../../lib/api';
import { formatPeruDateTime } from '../../lib/datetime';
import { FileText, Users } from 'lucide-react';
import Link from 'next/link';

interface Stats { reports: number; members: number; }
interface Report {
  id: string;
  title: string;
  reportDate: string;
  attachments?: any[];
  author: { fullName: string; role?: GroupRole };
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<Stats>({ reports: 0, members: 0 });
  const [recentReports, setRecentReports] = useState<Report[]>([]);

  useEffect(() => {
    Promise.allSettled([reportsApi.getAll({ limit: 5 }), usersApi.getAll()])
      .then(([rep, usr]) => {
        const reportsTotal = rep.status === 'fulfilled' ? (rep.value.data.meta?.total || 0) : 0;
        const membersTotal = usr.status === 'fulfilled' ? (usr.value.data.users?.length || 0) : 0;
        setStats({ reports: reportsTotal, members: membersTotal });
        setRecentReports(rep.status === 'fulfilled' ? (rep.value.data.data || []) : []);
      })
      .catch(console.error);
  }, []);

  const primaryRole = user?.memberships?.[0]?.roles?.[0];

  return (
    <div className="page-shell">
      <div className="card bg-gradient-to-r from-white to-slate-50/80 mb-6">
      <div className="">
        <h1 className="text-2xl font-bold text-gray-900">¡Hola, {user?.fullName?.split(' ')[0]}! 👋</h1>
        <p className="text-gray-500 mt-1">{primaryRole ? GROUP_ROLE_LABELS[primaryRole] : ''} · {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[{ label: 'Total Reportes', value: stats.reports, icon: FileText, color: 'bg-blue-500' }, { label: 'Miembros Activos', value: stats.members, icon: Users, color: 'bg-green-500' }].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`${color} w-12 h-12 rounded-xl flex items-center justify-center`}><Icon size={22} className="text-white" /></div>
            <div><p className="text-2xl font-bold text-gray-900">{value}</p><p className="text-sm text-gray-500">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Reportes Recientes</h2>
          <Link href="/dashboard/reports" className="text-blue-600 text-sm hover:underline">Ver todos →</Link>
        </div>

        {recentReports.length === 0 ? <p className="text-gray-400 text-center py-8">No hay reportes aún.</p> : (
          <div className="space-y-3">
            {recentReports.map((r) => (
              <Link key={r.id} href={`/dashboard/reports/view?id=${r.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition border border-slate-200">
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
    </div>
  );
}
