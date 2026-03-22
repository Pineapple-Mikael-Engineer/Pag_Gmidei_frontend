'use client';

import { useMemo } from 'react';
import { parseReportMarkdown } from '../../lib/reportSections';

type RelatedTask = {
  id: string;
  title: string;
  assigneeName?: string;
  startDate?: string;
  endDate?: string;
};

type Props = {
  markdown: string;
  externalLinks?: string[];
  links?: string[];
  hasEvidence?: boolean;
  relatedTasks?: RelatedTask[];
};

export default function ReportViewer({ markdown, externalLinks = [], links = [], hasEvidence, relatedTasks = [] }: Props) {
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
      {relatedTasks.length > 0 && (
        <section className="card space-y-3">
          <div>
            <p className="section-title">Tareas asociadas</p>
            <h3 className="text-lg font-semibold text-slate-900">Este reporte aporta a estas tareas</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {relatedTasks.map((task) => (
              <article key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-medium text-slate-900">{task.title}</p>
                <p className="text-xs text-slate-500 mt-1">{task.assigneeName || 'Sin responsable'}{task.startDate && task.endDate ? ` · ${task.startDate} → ${task.endDate}` : ''}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.85)] space-y-4">
          <article className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <p className="section-title">Avance</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{sections.avance || 'Sin actualizaciones registradas.'}</p>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <p className="section-title">Problemas</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{sections.problemas || 'Sin bloqueos declarados.'}</p>
          </article>
          <article className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
            <p className="section-title">Siguiente paso</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{sections.siguientePaso || 'No se definió una siguiente acción.'}</p>
          </article>
        </section>

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
