'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { buildReportMarkdown, parseEvidenceFromInput, parseReportMarkdown, ReportSections } from '../../lib/reportSections';
import { TaskItem } from '../../lib/tasks';
import FileUploadField from './FileUploadField';

type ReportEditorData = {
  title: string;
  markdown: string;
  comments: string;
  externalLinks: string;
  reportDate: string;
  taskIds: string[];
  attachments?: FileList | null;
};

type Props = {
  mode?: 'create' | 'edit';
  initialTitle?: string;
  initialMarkdown?: string;
  initialComments?: string;
  initialExternalLinks?: string[];
  initialLinks?: string[];
  initialReportDate?: string;
  initialTaskIds?: string[];
  availableTasks?: TaskItem[];
  saving?: boolean;
  showFiles?: boolean;
  allowReportDateEditing?: boolean;
  onSubmit: (payload: ReportEditorData) => Promise<void> | void;
  submitLabel?: string;
};

const emptySections: ReportSections = {
  avance: '',
  problemas: '',
  siguientePaso: '',
  evidencia: [],
};

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function isTaskEligibleForReport(_task: TaskItem, _reportDate: string) {
  return true;
}

export default function ReportEditor({
  mode = 'create',
  initialTitle = '',
  initialMarkdown = '',
  initialComments = '',
  initialExternalLinks = [],
  initialLinks = [],
  initialReportDate,
  initialTaskIds = [],
  availableTasks = [],
  saving = false,
  showFiles = true,
  allowReportDateEditing = true,
  onSubmit,
  submitLabel,
}: Props) {
  const parsed = useMemo(() => parseReportMarkdown(initialMarkdown), [initialMarkdown]);

  const [title, setTitle] = useState(initialTitle);
  const [comments, setComments] = useState(initialComments);
  const [reportDate, setReportDate] = useState((initialReportDate || todayValue()).slice(0, 10));
  const [taskIds, setTaskIds] = useState<string[]>(initialTaskIds);
  const [sections, setSections] = useState<ReportSections>(initialMarkdown ? parsed : emptySections);
  const [externalLinks, setExternalLinks] = useState<string[]>(Array.from(new Set([...initialExternalLinks, ...initialLinks])));
  const [newLink, setNewLink] = useState('');
  const [taskError, setTaskError] = useState('');

  const label = submitLabel || (mode === 'edit' ? 'Guardar edición' : 'Guardar reporte');
  const eligibleTasks = useMemo(
    () => availableTasks.filter((task) => isTaskEligibleForReport(task, reportDate)),
    [availableTasks, reportDate],
  );
  const eligibleTaskIds = useMemo(() => new Set(eligibleTasks.map((task) => task.id)), [eligibleTasks]);

  useEffect(() => {
    setTaskIds((prev) => prev.filter((taskId) => eligibleTaskIds.has(taskId)));
  }, [eligibleTaskIds]);

  useEffect(() => {
    if (!allowReportDateEditing) {
      setReportDate(todayValue());
    }
  }, [allowReportDateEditing]);

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

  const toggleTask = (taskId: string) => {
    setTaskError('');
    setTaskIds((prev) => (prev.includes(taskId) ? prev.filter((item) => item !== taskId) : [...prev, taskId]));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validTaskIds = taskIds.filter((taskId) => eligibleTaskIds.has(taskId));
    if (validTaskIds.length === 0) {
      setTaskError(eligibleTasks.length === 0
        ? 'No hay tareas disponibles asociadas a tu usuario dentro del proyecto seleccionado.'
        : 'Debes asociar al menos una tarea antes de guardar el reporte.');
      return;
    }
    const markdown = buildReportMarkdown({ ...sections, evidencia: externalLinks });
    await onSubmit({
      title,
      markdown,
      comments,
      externalLinks: externalLinks.join(', '),
      reportDate,
      taskIds: validTaskIds,
      attachments: null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="report-editor space-y-5">
      <div className="editor-section">
        <label className="editor-label">Título del reporte</label>
        <input className="input" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className={`grid gap-3 ${allowReportDateEditing ? 'md:grid-cols-2' : ''}`}>
        {allowReportDateEditing ? (
          <div className="editor-section">
            <label className="editor-label">Fecha del reporte</label>
            <input className="input" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} required />
          </div>
        ) : (
          <div className="editor-section">
            <label className="editor-label">Fecha del reporte</label>
            <div className="input bg-slate-50 text-slate-500">Se usará la fecha de hoy: {reportDate}</div>
          </div>
        )}
        <div className="editor-section">
          <label className="editor-label">Comentarios adicionales</label>
          <input className="input" placeholder="Notas breves para revisión" value={comments} onChange={(e) => setComments(e.target.value)} />
        </div>
      </div>

      <div className="editor-section space-y-3">
        <div>
          <label className="editor-label">Asociar a tareas activas</label>
          <p className="text-sm text-slate-500 mt-1">Debes asociar al menos una tarea. Para depuración, aquí se listan las tareas asociadas a tu usuario dentro del proyecto seleccionado, sin filtrar por fechas.</p>
        </div>
        {eligibleTasks.length === 0 ? (
          <div className="empty-state"><h3>Sin tareas disponibles</h3><p>No se encontraron tareas asociadas a tu usuario dentro del proyecto seleccionado.</p></div>
        ) : (
          <div className="grid gap-2">
            {eligibleTasks.map((task) => (
              <label key={task.id} className={`rounded-2xl border px-4 py-3 text-sm ${taskIds.includes(task.id) ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={taskIds.includes(task.id)} onChange={() => toggleTask(task.id)} className="mt-1" />
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{task.assigneeName} · {task.startDate} → {task.endDate}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
        {taskError && <p className="text-sm text-red-600">{taskError}</p>}
      </div>

      <div className="space-y-3">
        <div className="editor-section">
          <label className="editor-label">Avance</label>
          <textarea className="input min-h-28" placeholder="Describe el progreso de hoy..." value={sections.avance} onChange={(e) => setSections((prev) => ({ ...prev, avance: e.target.value }))} />
        </div>
        <div className="editor-section">
          <label className="editor-label">Problemas</label>
          <textarea className="input min-h-24" placeholder="Bloqueos o riesgos identificados..." value={sections.problemas} onChange={(e) => setSections((prev) => ({ ...prev, problemas: e.target.value }))} />
        </div>
        <div className="editor-section">
          <label className="editor-label">Siguiente paso</label>
          <textarea className="input min-h-24" placeholder="¿Cuál es la siguiente acción concreta?" value={sections.siguientePaso} onChange={(e) => setSections((prev) => ({ ...prev, siguientePaso: e.target.value }))} />
        </div>
      </div>

      <div className="editor-section space-y-2">
        <p className="editor-label">Evidencia (links)</p>
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

      {showFiles && (
        <FileUploadField
          onUploadedUrl={(url) => {
            setExternalLinks((prev) => Array.from(new Set([...prev, url])));
            setSections((prev) => ({ ...prev, evidencia: Array.from(new Set([...prev.evidencia, url])) }));
          }}
        />
      )}

      <button disabled={saving || eligibleTasks.length === 0} className="btn-primary disabled:opacity-60">{saving ? 'Guardando...' : label}</button>
    </form>
  );
}
