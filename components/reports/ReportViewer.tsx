'use client';

import { useMemo } from 'react';
import { renderMarkdownToHtml } from '../../lib/markdown';
import { parseReportMarkdown } from '../../lib/reportSections';

type Props = {
  markdown: string;
  externalLinks?: string[];
  links?: string[];
  hasEvidence?: boolean;
};

export default function ReportViewer({ markdown, externalLinks = [], links = [], hasEvidence }: Props) {
  const html = useMemo(() => renderMarkdownToHtml(markdown || ''), [markdown]);
  const sections = useMemo(() => parseReportMarkdown(markdown || ''), [markdown]);
  const mergedLinks = useMemo(() => Array.from(new Set([...links, ...sections.evidencia, ...externalLinks])).filter(Boolean), [links, sections.evidencia, externalLinks]);
  const hasEvidenceState = typeof hasEvidence === 'boolean' ? hasEvidence : mergedLinks.length > 0;

  const highlights = [
    { label: 'Avance', value: sections.avance || 'No se registró un avance específico.' },
    { label: 'Problemas', value: sections.problemas || 'Sin bloqueos declarados.' },
    { label: 'Siguiente paso', value: sections.siguientePaso || 'No se definió una siguiente acción.' },
  ];

  return (
    <div className="space-y-5">
      <div className="report-overview-grid">
        {highlights.map((item) => (
          <section key={item.label} className="report-highlight-card">
            <p className="section-title">{item.label}</p>
            <p className="text-sm leading-6 text-slate-700">{item.value}</p>
          </section>
        ))}
      </div>

      <div className="report-viewer-shell">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.85)]">
          <div className="report-markdown" dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <aside className="evidence-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-title">Evidencia</p>
              <h3 className="text-lg font-semibold text-slate-900">Recursos asociados</h3>
            </div>
            <span className={hasEvidenceState ? 'badge-ok' : 'badge-muted'}>{hasEvidenceState ? 'Con evidencia' : 'Sin evidencia'}</span>
          </div>
          <div className="mt-4 grid gap-2">
            {mergedLinks.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="evidence-card">
                {url}
              </a>
            ))}
            {!hasEvidenceState && <p className="text-sm text-slate-500">Este reporte no tiene links asociados.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
