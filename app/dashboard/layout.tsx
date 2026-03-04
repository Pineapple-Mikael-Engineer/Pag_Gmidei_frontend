'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../store/authStore';
import { authApi, GROUP_ROLE_LABELS } from '../../lib/api';
import { LayoutDashboard, FileText, Calendar, Users, LogOut, ChevronRight, Shield, FolderKanban } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoggedIn, hasHydrated, clearAuth, refreshToken } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isLoggedIn) router.replace('/auth/login');
  }, [hasHydrated, isLoggedIn, router]);

  const navItems = useMemo(() => {
    const base = [
      { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
      { href: '/dashboard/reports', label: 'Reportes', icon: FileText },
      { href: '/dashboard/calendar', label: 'Calendario', icon: Calendar },
      { href: '/dashboard/members', label: 'Miembros', icon: Users },
    ];
    const canManageProjects = user?.isGodAdmin || (user?.memberships || []).some((m) => m.roles.includes('MENTOR'));
    if (canManageProjects) base.push({ href: '/dashboard/subgroups', label: 'Proyectos', icon: FolderKanban });
    if (user?.isGodAdmin) base.push({ href: '/dashboard/admin', label: 'Panel Dios', icon: Shield });
    return base;
  }, [user]);

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken); }
    finally { clearAuth(); router.push('/auth/login'); }
  };

  if (!hasHydrated || !user) return null;

  const primaryRole = user.memberships?.[0]?.roles?.[0];

  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="w-72 bg-gradient-to-b from-slate-950 via-blue-950 to-indigo-950 text-white flex flex-col shadow-2xl">
        <div className="p-6 border-b border-blue-900/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center font-black text-lg text-slate-900">U</div>
            <div>
              <p className="font-bold text-sm leading-tight tracking-wide">UNI Engineering Hub</p>
              <p className="text-blue-200 text-xs">Gestión técnica de proyectos</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${active ? 'bg-white/15 text-white ring-1 ring-cyan-300/40' : 'text-blue-100 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon size={18} /> {label}
                {active && <ChevronRight size={14} className="ml-auto text-cyan-200" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-900/70">
          <div className="mb-3 rounded-xl bg-white/5 p-3 border border-white/10">
            <p className="text-sm font-semibold truncate">{user.fullName}</p>
            <p className="text-xs text-cyan-200 truncate">{primaryRole ? GROUP_ROLE_LABELS[primaryRole] : (user.isGodAdmin ? 'Administrador' : 'Sin rol')}</p>
            <p className="text-xs text-blue-200/90 truncate">{user.email}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-blue-100 hover:text-red-300 text-sm transition w-full">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-gradient-to-br from-slate-100 to-blue-50/40">{children}</main>
    </div>
  );
}
