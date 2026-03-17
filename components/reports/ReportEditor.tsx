'use client';

import { FormEvent, useMemo, useState } from 'react';
import { buildReportMarkdown, parseEvidenceFromInput, parseReportMarkdown, ReportSections } from '../../lib/reportSections';

type ReportEditorData = {
  title: string;
  markdown: string;
  comments: string;
  externalLinks: string;
  attachments?: FileList | null;
};

type Props = {
  mode?: 'create' | 'edit';
  initialTitle?: string;
  initialMarkdown?: string;
  initialComments?: string;
  initialExternalLinks?: string[];
  saving?: boolean;
  showFiles?: boolean;
  onSubmit: (payload: ReportEditorData) => Promise<void> | void;
  submitLabel?: string;
};

const emptySections: ReportSections = {
  avance: '',
  problemas: '',
  siguientePaso: '',
  evidencia: [],
};

export default function ReportEditor({
  mode = 'create',
  initialTitle = '',
  initialMarkdown = '',
  initialComments = '',
  initialExternalLinks = [],
  saving = false,
  showFiles = true,
  onSubmit,
  submitLabel,
}: Props) {
  const parsed = useMemo(() => parseReportMarkdown(initialMarkdown), [initialMarkdown]);

  const [title, setTitle] = useState(initialTitle);
  const [comments, setComments] = useState(initialComments);
  const [sections, setSections] = useState<ReportSections>(initialMarkdown ? parsed : emptySections);
  const [externalLinks, setExternalLinks] = useState<string[]>(initialExternalLinks);
  const [newLink, setNewLink] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);

  const label = submitLabel || (mode === 'edit' ? 'Guardar edición' : 'Guardar reporte');

  const addLink = () => {
    const links = parseEvidenceFromInput(newLink);
    if (links.length === 0) return;
    setExternalLinks((prev) => Array.from(new Set([...prev, ...links])));
    setSections((prev) => ({ ...prev, evidencia: Array.from(new Set([...prev.evidencia, ...links])) }));
    setNewLink('');
  };

  const removeLink = (link: string) => {
    setExternalLinks((prev) => prev.filter((item) => item !== link));
    setSections((prev) => ({ ...prev, evidencia: prev.evidencia.filter((item) => item !== link) }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const markdown = buildReportMarkdown({ ...sections, evidencia: externalLinks });
    await onSubmit({
      title,
      markdown,
      comments,
      externalLinks: externalLinks.join(', '),
      attachments: files,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">{mode === 'edit' ? 'Editar reporte' : 'Nuevo reporte'}</h2>
        <p className="text-sm text-slate-500">Formato guiado por bloques para mantener consistencia.</p>
      </div>

      <input className="input" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />

      <div className="space-y-3">
        <textarea className="input min-h-28" placeholder="Avance" value={sections.avance} onChange={(e) => setSections((prev) => ({ ...prev, avance: e.target.value }))} />
        <textarea className="input min-h-24" placeholder="Problemas" value={sections.problemas} onChange={(e) => setSections((prev) => ({ ...prev, problemas: e.target.value }))} />
        <textarea className="input min-h-24" placeholder="Siguiente paso" value={sections.siguientePaso} onChange={(e) => setSections((prev) => ({ ...prev, siguientePaso: e.target.value }))} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Evidencia (links)</p>
        <div className="flex gap-2">
          <input className="input" placeholder="https://..." value={newLink} onChange={(e) => setNewLink(e.target.value)} />
          <button type="button" className="btn-secondary" onClick={addLink}>Agregar</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {externalLinks.length === 0 && <span className="badge-muted">Sin evidencia</span>}
          {externalLinks.map((link) => (
            <span key={link} className="badge-link">
              {link}
              <button type="button" onClick={() => removeLink(link)} className="ml-2 text-xs">✕</button>
            </span>
          ))}
        </div>
      </div>

      <input className="input" placeholder="Comentarios adicionales" value={comments} onChange={(e) => setComments(e.target.value)} />

      {showFiles && <input type="file" multiple onChange={(e) => setFiles(e.target.files)} className="input" />}

      <button disabled={saving} className="btn-primary disabled:opacity-60">{saving ? 'Guardando...' : label}</button>
    </form>
  );
}
