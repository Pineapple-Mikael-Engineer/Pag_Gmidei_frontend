'use client';

import { FormEvent, useMemo, useState } from 'react';
import { commentsApi } from '../../lib/api';
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

const keyOf = (reportId: string) => `report-comments:${reportId}`;

function initials(name?: string) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function CommentSection({ reportId, currentUserId = 'me', currentUserName = 'Tú', initialComment }: Props) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingDraft, setEditingDraft] = useState('');
  const [warning, setWarning] = useState('');
  const [items, setItems] = useState<CommentItem[]>(() => {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(keyOf(reportId));
    const stored = raw ? (JSON.parse(raw) as CommentItem[]) : [];
    if (stored.length === 0 && initialComment) {
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
    return stored;
  });

  const orderedItems = useMemo(
    () => [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [items],
  );

  const persist = (next: CommentItem[]) => {
    setItems(next);
    localStorage.setItem(keyOf(reportId), JSON.stringify(next));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setWarning('');
    const fallback: CommentItem = {
      id: crypto.randomUUID(),
      reportId,
      userId: currentUserId,
      authorName: currentUserName,
      content: draft.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await commentsApi.create({ reportId, content: draft.trim() });
      const comment = res.data?.comment || res.data?.data || fallback;
      persist([
        ...items,
        {
          id: comment.id || fallback.id,
          reportId: comment.reportId || reportId,
          userId: comment.userId || currentUserId,
          authorName: comment.user?.fullName || currentUserName,
          content: comment.content || fallback.content,
          createdAt: comment.createdAt || fallback.createdAt,
          editedAt: comment.editedAt,
        },
      ]);
    } catch {
      persist([...items, fallback]);
      setWarning('No se pudo sincronizar el comentario con backend. Se guardó localmente.');
    }
    setDraft('');
  };

  const onSaveEdit = async (item: CommentItem) => {
    if (!editingDraft.trim()) return;
    setWarning('');
    const optimisticEditedAt = new Date().toISOString();
    try {
      await commentsApi.update(item.id, { content: editingDraft.trim() });
      persist(items.map((x) => (x.id === item.id ? { ...x, content: editingDraft.trim(), editedAt: optimisticEditedAt } : x)));
    } catch {
      persist(items.map((x) => (x.id === item.id ? { ...x, content: editingDraft.trim(), editedAt: optimisticEditedAt } : x)));
      setWarning('No se pudo sincronizar la edición con backend. Se aplicó localmente.');
    }
    setEditingId('');
    setEditingDraft('');
  };

  return (
    <section className="card space-y-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="section-title">Conversación</p>
          <h3 className="text-xl font-semibold text-slate-900">Comentarios del reporte</h3>
          <p className="text-sm text-slate-500 mt-1">Diseñados como una conversación real: autor visible, hora, edición y composición más clara.</p>
        </div>
        <div className="comment-count-pill">{orderedItems.length} comentario(s)</div>
      </div>

      {warning && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{warning}</p>}

      <div className="conversation-thread">
        {orderedItems.length === 0 && <div className="empty-state"><h3>Sin comentarios todavía</h3><p>Usa este espacio para validar hallazgos, pedir cambios o dejar contexto adicional.</p></div>}
        {orderedItems.map((item) => {
          const mine = item.userId === currentUserId;
          const isEditing = editingId === item.id;
          const displayName = mine ? 'Tú' : item.authorName || 'Usuario';
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
        <textarea className="input min-h-28" placeholder="Escribe un comentario útil para seguimiento, revisión o aprobación..." value={draft} onChange={(e) => setDraft(e.target.value)} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">Tip: usa este espacio para validar entregables o dejar próximos pasos.</p>
          <button className="btn-primary self-end" type="submit">Enviar comentario</button>
        </div>
      </form>
    </section>
  );
}
