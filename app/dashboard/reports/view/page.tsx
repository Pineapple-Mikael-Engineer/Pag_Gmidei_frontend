'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { reportsApi } from '../../../../lib/api';
import { formatPeruDateTime } from '../../../../lib/datetime';
import ReportViewer from '../../../../components/reports/ReportViewer';
import ReportEditor from '../../../../components/reports/ReportEditor';
import CommentSection from '../../../../components/reports/CommentSection';
import { useAuthStore } from '../../../../store/authStore';

type ReportDetail = {
  id: string;
  title: string;
  description: string;
  reportDate: string;
  updatedAt?: string;
  comments?: string | null;
  externalLinks?: string[];
  author: { id: string; fullName: string };
  subgroup?: { id: string; name: string; code: string };
  attachments?: Array<{ id: string; originalName: string }>;
};

const editedKey = (id: string) => `report-edited-at:${id}`;

export default function ReportDetailPage() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id') || '';
  const user = useAuthStore((s) => s.user);

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [localEditedAt, setLocalEditedAt] = useState('');
  const [error, setError] = useState('');

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
      setLocalEditedAt(localStorage.getItem(editedKey(reportId)) || '');
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
      <div className="card bg-gradient-to-r from-white to-slate-50/80">
        <p className="section-title">Detalle de reporte</p>
        <p className="text-sm text-slate-500">Vista enriquecida con markdown mejorado, evidencia y comentarios tipo timeline.</p>
      </div>
      <Link href="/dashboard/reports" className="text-blue-600 hover:underline text-sm">
        ← Volver a reportes
      </Link>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!report ? (
        <p>No se encontró el reporte.</p>
      ) : (
        <>
          <div className="card space-y-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.9)]">
            <div className="flex justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{report.title}</h1>
                <p className="text-sm text-slate-500 mt-1">
                  {report.author.fullName} · {report.subgroup?.name || report.subgroup?.code || 'Subgrupo'} · {formatPeruDateTime(report.reportDate)}
                </p>
                {(report.updatedAt || localEditedAt) && (
                  <p className="text-xs text-slate-400 mt-1">Editado el: {formatPeruDateTime(report.updatedAt || localEditedAt)}</p>
                )}
              </div>
              <button className="btn-secondary h-fit" onClick={() => setEditing((prev) => !prev)}>
                {editing ? 'Cancelar' : 'Editar reporte'}
              </button>
            </div>

            {editing ? (
              <ReportEditor
                mode="edit"
                showFiles={false}
                saving={savingEdit}
                initialTitle={report.title}
                initialMarkdown={report.description}
                initialComments={report.comments || ''}
                initialExternalLinks={report.externalLinks || []}
                submitLabel="Guardar cambios"
                onSubmit={async ({ title, markdown, comments, externalLinks }) => {
                  setSavingEdit(true);
                  setError('');
                  const editedAt = new Date().toISOString();
                  try {
                    await reportsApi.update(report.id, {
                      title,
                      markdown,
                      comments,
                      externalLinks,
                    });
                  } catch {
                    // fallback local si backend no soporta todos los campos
                  } finally {
                    const updated: ReportDetail = {
                      ...report,
                      title,
                      description: markdown,
                      comments,
                      externalLinks: externalLinks.split(',').map((item) => item.trim()).filter(Boolean),
                      updatedAt: editedAt,
                    };
                    setReport(updated);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem(editedKey(report.id), editedAt);
                    }
                    setLocalEditedAt(editedAt);
                    setEditing(false);
                    setSavingEdit(false);
                  }
                }}
              />
            ) : (
              <ReportViewer markdown={report.description} externalLinks={report.externalLinks || []} />
            )}

            {(report.attachments || []).length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Archivos adjuntos</p>
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
