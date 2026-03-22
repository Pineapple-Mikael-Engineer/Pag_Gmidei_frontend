'use client';

import { useEffect, useMemo, useState } from 'react';
import TaskBoard from '../../../components/tasks/TaskBoard';
import { GROUP_ROLE_LABELS, GroupRole, subgroupsApi } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

type ProjectMembership = {
  subgroupId: string;
  roles: GroupRole[];
  subgroup?: { name?: string; code?: string };
};

type MemberItem = {
  userId: string;
  roles: GroupRole[];
  user: { id: string; fullName: string; email: string };
};

export default function TasksPage() {
  const user = useAuthStore((state) => state.user);
  const [projects, setProjects] = useState<ProjectMembership[]>([]);
  const [membersByProject, setMembersByProject] = useState<Record<string, MemberItem[]>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await subgroupsApi.getMy();
        const memberships = res.data.subgroups || [];
        setProjects(memberships);

        const entries = await Promise.all(
          memberships.map(async (project: ProjectMembership) => {
            try {
              const response = await subgroupsApi.getMembers(project.subgroupId);
              return [project.subgroupId, response.data.members || []] as const;
            } catch {
              return [project.subgroupId, []] as const;
            }
          }),
        );

        setMembersByProject(Object.fromEntries(entries));
      } catch (err: any) {
        const fallbackProjects = (user?.memberships || []).map((membership) => ({
          subgroupId: membership.subgroupId,
          roles: membership.roles,
          subgroup: { name: membership.subgroupName, code: membership.subgroupCode },
        }));
        if (fallbackProjects.length > 0) {
          setProjects(fallbackProjects);
          setError('');
        } else {
          setError(err.response?.data?.error || 'No se pudo cargar el módulo de tareas.');
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const memberDirectory = useMemo(() => {
    return Object.fromEntries(
      Object.entries(membersByProject).map(([projectId, members]) => [
        projectId,
        members.map((member) => ({
          id: member.user.id,
          fullName: member.user.fullName,
          roleLabel: member.roles.map((role) => GROUP_ROLE_LABELS[role]).join(' / ') || 'Sin rol',
        })),
      ]),
    );
  }, [membersByProject]);

  return (
    <div className="page-shell space-y-6">
      <div>
        <p className="section-title">Tareas</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Centro de tareas</h1>
      </div>

      {loading && <div className="card"><p>Cargando contexto de tareas...</p></div>}
      {error && <div className="card"><p className="text-sm text-red-600">{error}</p></div>}

      {!loading && !error && user && (
        <TaskBoard currentUserId={user.id} currentUserName={user.fullName} isGodAdmin={user.isGodAdmin} projects={projects} memberDirectory={memberDirectory} />
      )}
    </div>
  );
}
