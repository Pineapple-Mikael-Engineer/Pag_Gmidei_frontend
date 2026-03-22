'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ReportApiModel, reportsApi } from '../../../../lib/api';
import { formatPeruDateTime } from '../../../../lib/datetime';
import ReportViewer from '../../../../components/reports/ReportViewer';
import ReportEditor from '../../../../components/reports/ReportEditor';
import CommentSection from '../../../../components/reports/CommentSection';
import { useAuthStore } from '../../../../store/authStore';

type ReportDetail = ReportApiModel;

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
      .then((res) => setReport(res.data.report))
      .catch((err) => setError(err.response?.data?.error || 'No se pudo cargar el reporte.'))
      .finally(() => setLoading(false));

    if (typeof window !== 'undefined') {
      setLocalEditedAt(localStorage.getItem(getEditedStorageKey(reportId)) || '');
    }
  }, [reportId]);

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
      <section className="hero-surface">
        <div>
          <p className="section-title">Detalle</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Reporte enriquecido</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">La lectura se divide por bloques, evidencia y conversación para que el seguimiento del informe se sienta más cercano a una revisión real.</p>
        </div>
      </section>
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
                  <span className="badge-link">{report.subgroup?.name || report.subgroup?.code || 'Subgrupo'}</span>
                  <span className="badge-muted">{report.author.fullName}</span>
                </div>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{report.title}</h1>
                  <p className="text-sm text-slate-500 mt-2">
                    {report.author.fullName} · {report.subgroup?.name || report.subgroup?.code || 'Subgrupo'} · {formatPeruDateTime(report.reportDate)}
                  </p>
                  {(report.updatedAt || localEditedAt) && (
                    <p className="text-xs text-slate-400 mt-1">Editado el: {formatPeruDateTime(report.updatedAt || localEditedAt)}</p>
                  )}
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
              <ReportEditor
                mode="edit"
                showFiles={false}
                saving={savingEdit}
                initialTitle={report.title}
                initialMarkdown={report.description}
                initialComments={report.comments || ''}
                initialExternalLinks={report.externalLinks || []}
                initialLinks={report.links || []}
                submitLabel="Guardar cambios"
                onSubmit={async ({ title, markdown, comments, externalLinks }) => {
                  if (!canEdit) {
                    setError('No tienes permisos para editar este reporte.');
                    return;
                  }
                  setSavingEdit(true);
                  setError('');
                  setWarning('');
                  const editedAt = new Date().toISOString();
                  try {
                    const payload = { title, markdown, comments, externalLinks };
                    const res = await reportsApi.replace(report.id, payload);
                    const warn = warningMessageFromResponse(res.data);
                    if (warn) setWarning(warn);
                  } catch {
                    try {
                      await reportsApi.update(report.id, { title, markdown, comments, externalLinks });
                    } catch {
                      // fallback local
                    }
                  } finally {
                    const links = externalLinks.split(',').map((item) => item.trim()).filter(Boolean);
                    const updated: ReportDetail = {
                      ...report,
                      title,
                      description: markdown,
                      comments,
                      links,
                      externalLinks: links,
                      has_evidence: links.length > 0,
                      updatedAt: editedAt,
                      edited: true,
                    };
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
            ) : (
              <ReportViewer markdown={report.description} externalLinks={report.externalLinks || []} links={report.links || []} hasEvidence={report.has_evidence} />
            )}

            {(report.attachments || []).length > 0 && (
              <div className="attachment-grid">
                <div>
                  <p className="section-title">Archivos</p>
                  <h3 className="text-lg font-semibold text-slate-900">Adjuntos del reporte</h3>
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
