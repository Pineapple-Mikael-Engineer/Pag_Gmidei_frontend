'use client';

import { useMemo } from 'react';
import { renderMarkdownToHtml } from '../../lib/markdown';
import { parseReportMarkdown } from '../../lib/reportSections';

type Props = {
  markdown: string;
  externalLinks?: string[];
};

export default function ReportViewer({ markdown, externalLinks = [] }: Props) {
  const html = useMemo(() => renderMarkdownToHtml(markdown || ''), [markdown]);
  const sections = useMemo(() => parseReportMarkdown(markdown || ''), [markdown]);
  const hasEvidence = sections.evidencia.length > 0 || externalLinks.length > 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.8)]">
      <div className="report-markdown" dangerouslySetInnerHTML={{ __html: html }} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Evidencia</p>
          <span className={hasEvidence ? 'badge-ok' : 'badge-muted'}>{hasEvidence ? 'Con evidencia' : 'Sin evidencia'}</span>
        </div>
        <div className="mt-2 grid gap-2">
          {(sections.evidencia.length > 0 ? sections.evidencia : externalLinks).map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="evidence-card">
              {url}
            </a>
          ))}
          {!hasEvidence && <p className="text-sm text-slate-500">Este reporte no tiene links asociados.</p>}
        </div>
      </div>
    </div>
  );
}
