'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { commentsApi, reportsApi } from '../../lib/api';
import { formatPeruDateTime } from '../../lib/datetime';

type CommentItem = {
  id: string;
  reportId: string;
  userId: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  authorName?: string;
};

type Props = {
  reportId: string;
  currentUserId?: string;
  currentUserName?: string;
  initialComment?: string | null;
};

function initials(name?: string) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function normalizeComparableId(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function seedFromInitialComment(reportId: string, initialComment?: string | null): CommentItem[] {
  if (!initialComment) return [];
  return [
    {
      id: 'seed-comment',
      reportId,
      userId: 'system',
      authorName: 'Comentario inicial',
      content: initialComment,
      createdAt: new Date().toISOString(),
    },
  ];
}

function extractCommentCollections(payload: any): any[][] {
  const possibleCollections = [
    payload,
    payload?.comments,
    payload?.comment,
    payload?.data,
    payload?.data?.comments,
    payload?.data?.comment,
    payload?.data?.items,
    payload?.data?.rows,
    payload?.items,
    payload?.rows,
    payload?.results,
    payload?.report?.comments,
    payload?.report?.commentList,
    payload?.report?.commentsList,
    payload?.report?.thread,
    payload?.report?.conversation,
  ];

  return possibleCollections
    .map((candidate) => (Array.isArray(candidate) ? candidate : candidate ? [candidate] : []))
    .filter((candidate) => candidate.length > 0);
}

function normalizeComments(rawComments: any[], reportId: string): CommentItem[] {
  const expectedReportId = normalizeComparableId(reportId);

  return rawComments
    .filter(Boolean)
    .map((comment: any, index: number) => {
      const linkedReportId =
        comment.reportId ||
        comment.report?.id ||
        comment.report?._id ||
        comment.report?.reportId ||
        comment.report_id ||
        reportId;

      return {
        id: normalizeComparableId(comment.id || comment._id || comment.commentId || `comment-${index}`),
        reportId: normalizeComparableId(linkedReportId) || expectedReportId,
        userId: normalizeComparableId(comment.userId || comment.user?.id || comment.authorId || comment.author?.id || 'unknown'),
        authorName: comment.user?.fullName || comment.authorName || comment.author?.fullName || comment.user?.name || 'Usuario',
        content: String(comment.content || comment.text || comment.body || '').trim(),
        createdAt: comment.createdAt || comment.date || comment.updatedAt || new Date().toISOString(),
        editedAt: comment.editedAt,
      };
    })
    .filter((comment) => comment.content.length > 0)
    .filter((comment) => !comment.reportId || comment.reportId === expectedReportId);
}

function extractCommentsFromPayload(payload: any, reportId: string, initialComment?: string | null): CommentItem[] {
  const merged = new Map<string, CommentItem>();

  for (const candidate of extractCommentCollections(payload)) {
    const normalized = normalizeComments(candidate, reportId);
    normalized.forEach((comment) => {
      const key = comment.id || `${comment.userId}:${comment.createdAt}:${comment.content}`;
      if (!merged.has(key)) merged.set(key, comment);
    });
  }

  if (merged.size > 0) return Array.from(merged.values());

  const possibleString =
    (typeof payload?.report?.comments === 'string' && payload.report.comments) ||
    (typeof payload?.comments === 'string' && payload.comments) ||
    (typeof payload?.data?.comments === 'string' && payload.data.comments) ||
    initialComment;

  return seedFromInitialComment(reportId, possibleString);
}

export default function CommentSection({ reportId, currentUserId = 'me', currentUserName = 'Tú', initialComment }: Props) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingDraft, setEditingDraft] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CommentItem[]>([]);

  const loadComments = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setWarning('');
    }

    try {
      const res = await commentsApi.listByReport(reportId);
      const normalized = extractCommentsFromPayload(res.data, reportId, initialComment);
      if (normalized.length > 0) {
        setItems(normalized);
        return normalized;
      }
    } catch {
      // fallback below
    }

    try {
      const res = await reportsApi.getOne(reportId);
      const fallbackFromReport = extractCommentsFromPayload(res.data, reportId, initialComment);
      setItems(fallbackFromReport);
      return fallbackFromReport;
    } catch {
      const seeded = seedFromInitialComment(reportId, initialComment);
      setItems(seeded);
      setWarning('El backend no devolvió una lista de comentarios persistidos para este reporte.');
      return seeded;
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [initialComment, reportId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const orderedItems = useMemo(
    () => [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [items],
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setWarning('');

    try {
      const res = await commentsApi.create({ reportId, content: draft.trim() });
      const created = res.data?.comment || res.data?.data;
      const refreshed = await loadComments({ silent: true });
      const createdId = normalizeComparableId(created?.id || created?._id || created?.commentId);
      const wasConfirmed = createdId ? refreshed.some((item) => item.id === createdId) : false;

      if (!createdId || !wasConfirmed) {
        setWarning('El backend respondió al crear el comentario, pero luego no lo devolvió en la lectura. Parece un problema de persistencia o de listado en backend.');
      } else {
        setDraft('');
      }
    } catch {
      setWarning('No se pudo guardar el comentario en backend. No se agregó localmente para evitar inconsistencias.');
    }
  };

  const onSaveEdit = async (item: CommentItem) => {
    if (!editingDraft.trim()) return;
    setWarning('');
    try {
      await commentsApi.update(item.id, { content: editingDraft.trim() });
      const refreshed = await loadComments({ silent: true });
      const updated = refreshed.find((entry) => entry.id === item.id);
      if (!updated || updated.content !== editingDraft.trim()) {
        setWarning('El backend respondió a la edición, pero la lectura posterior no reflejó el cambio.');
      }
    } catch {
      setWarning('No se pudo persistir la edición del comentario en backend.');
    }
    setEditingId('');
    setEditingDraft('');
  };

  return (
    <section className="card space-y-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-title">Comentarios</p>
          <h3 className="text-xl font-semibold text-slate-900">Conversación pública del reporte</h3>
        </div>
        <div className="comment-count-pill">{orderedItems.length} comentario(s)</div>
      </div>

      {warning && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{warning}</p>}

      <div className="conversation-thread">
        {loading && <p className="text-sm text-slate-500">Cargando comentarios...</p>}
        {!loading && orderedItems.length === 0 && <div className="empty-state"><h3>Sin comentarios todavía</h3><p>Esta conversación solo mostrará comentarios confirmados por backend.</p></div>}
        {orderedItems.map((item) => {
          const mine = item.userId === currentUserId;
          const isEditing = editingId === item.id;
          const displayName = mine ? currentUserName || 'Tú' : item.authorName || 'Usuario';
          return (
            <article key={item.id} className={`message-card ${mine ? 'mine' : ''}`}>
              <div className="message-avatar">{initials(displayName)}</div>
              <div className="message-body">
                <div className="comment-meta rich">
                  <span className="font-medium text-slate-800">{displayName}</span>
                  <time>
                    {formatPeruDateTime(item.createdAt)}
                    {item.editedAt ? ' · editado' : ''}
                  </time>
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea className="input min-h-24" value={editingDraft} onChange={(e) => setEditingDraft(e.target.value)} />
                    <div className="flex gap-2">
                      <button type="button" className="btn-primary text-sm" onClick={() => onSaveEdit(item)}>Guardar</button>
                      <button type="button" className="btn-secondary text-sm" onClick={() => { setEditingId(''); setEditingDraft(''); }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="message-text">{item.content}</p>
                    {mine && item.id !== 'seed-comment' && (
                      <button type="button" className="text-xs text-blue-700 mt-3 hover:underline" onClick={() => { setEditingId(item.id); setEditingDraft(item.content); }}>
                        Editar comentario
                      </button>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="comment-composer">
        <textarea className="input min-h-28" placeholder="Escribe un comentario visible para todos los usuarios que pueden ver el reporte..." value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">El comentario solo se mostrará si backend lo devuelve en la lectura posterior.</p>
          <button className="btn-primary self-end" type="submit">Enviar comentario</button>
        </div>
      </form>
    </section>
  );
}
