'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { reportsApi } from '../../../../lib/api';
import { renderMarkdownToHtml } from '../../../../lib/markdown';
import { formatPeruDateTime } from '../../../../lib/datetime';

type ReportDetail = {
  id: string;
  title: string;
  description: string;
  reportDate: string;
  comments?: string | null;
  externalLinks?: string[];
  author: { id: string; fullName: string };
  subgroup?: { id: string; name: string; code: string };
  attachments?: Array<{ id: string; originalName: string }>;
};

export default function ReportDetailPage() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id') || '';

  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const html = useMemo(() => renderMarkdownToHtml(report?.description || ''), [report?.description]);

  useEffect(() => {
    if (!reportId) {
      setLoading(false);
      setError('ID de reporte inválido.');
      return;
    }
    setLoading(true);
    setError('');
    reportsApi.getOne(reportId)
      .then((res) => setReport(res.data.report))
      .catch((err) => setError(err.response?.data?.error || 'No se pudo cargar el reporte.'))
      .finally(() => setLoading(false));
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
    <div className="p-8 space-y-6">
      <Link href="/dashboard/reports" className="text-blue-600 hover:underline text-sm">← Volver a reportes</Link>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!report ? <p>No se encontró el reporte.</p> : (
        <div className="bg-white border rounded-xl p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-bold">{report.title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {report.author.fullName} · {report.subgroup?.name || report.subgroup?.code || 'Subgrupo'} · {formatPeruDateTime(report.reportDate)}
            </p>
          </div>

          <div className="max-w-none text-gray-800 space-y-2">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>

          {report.comments && (
            <div className="rounded-lg border p-3 bg-gray-50">
              <p className="text-sm font-medium">Comentarios</p>
              <p className="text-sm text-gray-700">{report.comments}</p>
            </div>
          )}

          {(report.externalLinks || []).length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Enlaces externos</p>
              <ul className="space-y-1">
                {(report.externalLinks || []).map((url) => (
                  <li key={url}>
                    <a href={url} className="text-blue-600 underline break-all" target="_blank" rel="noreferrer">{url}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(report.attachments || []).length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Archivos adjuntos</p>
              <div className="flex flex-wrap gap-2">
                {(report.attachments || []).map((a) => (
                  <button key={a.id} type="button" onClick={() => handleDownload(a.id, a.originalName)} className="px-3 py-1.5 border rounded text-sm text-blue-700 hover:bg-blue-50">
                    {a.originalName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
