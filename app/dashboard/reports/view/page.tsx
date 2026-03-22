'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ReportApiModel, reportsApi, subgroupsApi } from '../../../../lib/api';
import { formatPeruDateTime } from '../../../../lib/datetime';
import ReportViewer from '../../../../components/reports/ReportViewer';
import ReportEditor from '../../../../components/reports/ReportEditor';
import CommentSection from '../../../../components/reports/CommentSection';
import { useAuthStore } from '../../../../store/authStore';
import { fetchTasksFromAnySource, TaskItem } from '../../../../lib/tasks';
import { getLinkedTaskIds, setLinkedTaskIds } from '../../../../lib/reportTaskLinks';

type ReportDetail = ReportApiModel;
type EditableSubgroup = { subgroupId: string; subgroup?: { name?: string; code?: string } };

const getEditedStorageKey = (id: string) => `report-edited-at:${id}`;

function warningMessageFromResponse(payload: any): string {
  const warning = payload?.warning || payload?.warnings?.[0];
  if (!warning) return '';
  return typeof warning === 'string' ? warning : warning.message || 'Se recibió una advertencia del backend.';
}

export default function ReportDetailPage() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id') || '';
  const user = useAuthStore((s) => s.user);

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [localEditedAt, setLocalEditedAt] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [mySubgroups, setMySubgroups] = useState<EditableSubgroup[]>([]);
  const [editSubgroupId, setEditSubgroupId] = useState('');
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  const canEdit = !!report && !!user && (user.isGodAdmin || user.id === report.author.id);

  useEffect(() => {
    if (!reportId) {
      setLoading(false);
      setError('ID de reporte inválido.');
      return;
    }
    setLoading(true);
    setError('');
    reportsApi
      .getOne(reportId)
      .then((res) => {
        const loadedReport = res.data.report;
        const linkedTaskIds = loadedReport?.taskIds || getLinkedTaskIds(reportId);
        setReport({ ...loadedReport, taskIds: linkedTaskIds });
        setEditSubgroupId(loadedReport?.subgroup?.id || '');
      })
      .catch((err) => setError(err.response?.data?.error || 'No se pudo cargar el reporte.'))
      .finally(() => setLoading(false));

    if (typeof window !== 'undefined') {
      setLocalEditedAt(localStorage.getItem(getEditedStorageKey(reportId)) || '');
    }
  }, [reportId]);

  useEffect(() => {
    subgroupsApi
      .getMy()
      .then((res) => setMySubgroups(res.data.subgroups || []))
      .catch(() => {
        const fallback = (user?.memberships || []).map((m) => ({ subgroupId: m.subgroupId, subgroup: { name: m.subgroupName, code: m.subgroupCode } }));
        setMySubgroups(fallback);
      });
  }, [user?.id, user?.memberships]);

  useEffect(() => {
    fetchTasksFromAnySource()
      .then((result) => setTasks(result.tasks))
      .catch(() => setTasks([]));
  }, []);

  useEffect(() => {
    if (!report || editSubgroupId) return;
    const fallback = mySubgroups.find((item) => item.subgroup?.name === report.subgroup?.name || item.subgroup?.code === report.subgroup?.code);
    if (fallback) setEditSubgroupId(fallback.subgroupId);
  }, [editSubgroupId, mySubgroups, report]);

  const selectedSubgroupLabel = useMemo(() => {
    const matched = mySubgroups.find((item) => item.subgroupId === editSubgroupId);
    return matched?.subgroup?.name || matched?.subgroup?.code || report?.subgroup?.name || report?.subgroup?.code || 'Subgrupo';
  }, [editSubgroupId, mySubgroups, report?.subgroup?.code, report?.subgroup?.name]);

  const editorTasks = useMemo(() => tasks.filter((task) => task.subgroupId === (editSubgroupId || report?.subgroup?.id || '') && (user?.isGodAdmin || task.assigneeId === user?.id || (!!user?.email && task.assigneeEmail === user.email))), [editSubgroupId, report?.subgroup?.id, tasks, user?.email, user?.id, user?.isGodAdmin]);

  const relatedTasks = useMemo(() => {
    const linkedTaskIds = report?.taskIds || [];
    return tasks.filter((task) => linkedTaskIds.includes(task.id)).map((task) => ({
      id: task.id,
      title: task.title,
      assigneeName: task.assigneeName,
      startDate: task.startDate,
      endDate: task.endDate,
    }));
  }, [report?.taskIds, tasks]);

  const handleDownload = async (fileId: string, originalName: string) => {
    if (!reportId) return;
    try {
      const res = await reportsApi.downloadAttachment(reportId, fileId);
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo descargar el archivo.');
    }
  };

  if (loading) return <div className="p-8">Cargando reporte...</div>;

  return (
    <div className="page-shell space-y-6">
      <Link href="/dashboard/reports" className="text-blue-600 hover:underline text-sm">
        ← Volver a reportes
      </Link>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {warning && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{warning}</p>}

      {!report ? (
        <p>No se encontró el reporte.</p>
      ) : (
        <>
          <div className="card space-y-6 report-detail-shell">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge-link">{selectedSubgroupLabel}</span>
                  <span className="badge-muted">{report.author.fullName}</span>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{report.title}</h1>
                  <p className="text-sm text-slate-500 mt-2">
                    {report.author.fullName} · {selectedSubgroupLabel} · {formatPeruDateTime(report.reportDate)}
                  </p>
                  {(report.updatedAt || localEditedAt) && <p className="text-xs text-slate-400 mt-1">Editado el: {formatPeruDateTime(report.updatedAt || localEditedAt)}</p>}
                </div>
              </div>
              {canEdit ? (
                <button className="btn-secondary h-fit" onClick={() => setEditing((prev) => !prev)}>
                  {editing ? 'Cancelar' : 'Editar reporte'}
                </button>
              ) : (
                <span className="badge-muted h-fit">Solo el autor o admin puede editar</span>
              )}
            </div>

            {editing && canEdit ? (
              <div className="space-y-4">
                <div className="editor-section">
                  <label className="editor-label">Grupo / proyecto del reporte</label>
                  <select className="input" value={editSubgroupId} onChange={(event) => setEditSubgroupId(event.target.value)}>
                    {mySubgroups.map((item) => (
                      <option key={item.subgroupId} value={item.subgroupId}>
                        {item.subgroup?.name || item.subgroup?.code || item.subgroupId}
                      </option>
                    ))}
                  </select>
                </div>
                <ReportEditor
                  mode="edit"
                  showFiles={false}
                  saving={savingEdit}
                  initialTitle={report.title}
                  initialMarkdown={report.description}
                  initialComments={report.comments || ''}
                  initialExternalLinks={report.externalLinks || []}
                  initialLinks={report.links || []}
                  initialReportDate={report.reportDate}
                  initialTaskIds={report.taskIds || []}
                  availableTasks={editorTasks}
                  submitLabel="Guardar cambios"
                  onSubmit={async ({ title, markdown, comments, externalLinks, reportDate, taskIds }) => {
                    if (!canEdit) {
                      setError('No tienes permisos para editar este reporte.');
                      return;
                    }
                    setSavingEdit(true);
                    setError('');
                    setWarning('');
                    const editedAt = new Date().toISOString();
                    try {
                      const payload = { title, markdown, comments, externalLinks, subgroupId: editSubgroupId, reportDate, taskIds };
                      const res = await reportsApi.replace(report.id, payload);
                      const warn = warningMessageFromResponse(res.data);
                      if (warn) setWarning(warn);
                    } catch {
                      try {
                        await reportsApi.update(report.id, { title, markdown, comments, externalLinks, subgroupId: editSubgroupId, reportDate, taskIds });
                      } catch {
                        // fallback local
                      }
                    } finally {
                      const links = externalLinks.split(',').map((item) => item.trim()).filter(Boolean);
                      const nextSubgroup = mySubgroups.find((item) => item.subgroupId === editSubgroupId);
                      const updated: ReportDetail = {
                        ...report,
                        title,
                        description: markdown,
                        comments,
                        reportDate,
                        taskIds,
                        links,
                        externalLinks: links,
                        has_evidence: links.length > 0,
                        updatedAt: editedAt,
                        edited: true,
                        subgroup: {
                          id: editSubgroupId || report.subgroup?.id || '',
                          name: nextSubgroup?.subgroup?.name || report.subgroup?.name || '',
                          code: nextSubgroup?.subgroup?.code || report.subgroup?.code || '',
                        },
                      };
                      setLinkedTaskIds(report.id, taskIds);
                      setTasks((prev) => prev.map((task) => ({
                        ...task,
                        linkedReportIds: taskIds.includes(task.id)
                          ? Array.from(new Set([...(task.linkedReportIds || []), report.id]))
                          : (task.linkedReportIds || []).filter((linkedId) => linkedId !== report.id),
                      })));
                      setReport(updated);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem(getEditedStorageKey(report.id), editedAt);
                      }
                      setLocalEditedAt(editedAt);
                      setEditing(false);
                      setSavingEdit(false);
                    }
                  }}
                />
              </div>
            ) : (
              <ReportViewer markdown={report.description} externalLinks={report.externalLinks || []} links={report.links || []} hasEvidence={report.has_evidence} relatedTasks={relatedTasks} />
            )}

            {(report.attachments || []).length > 0 && (
              <div className="attachment-grid">
                <div>
                  <p className="section-title">Archivos</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(report.attachments || []).map((a) => (
                    <button key={a.id} type="button" onClick={() => handleDownload(a.id, a.originalName)} className="btn-secondary text-sm">
                      {a.originalName}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <CommentSection reportId={report.id} currentUserId={user?.id} currentUserName={user?.fullName} initialComment={report.comments} />
        </>
      )}
    </div>
  );
}
