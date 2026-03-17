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
    <section className="card space-y-4">
      <h3 className="text-base font-semibold text-slate-900">Comentarios</h3>

      {warning && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">{warning}</p>}

      <div className="timeline space-y-3">
        {orderedItems.length === 0 && <p className="text-sm text-slate-500">Sin comentarios todavía.</p>}
        {orderedItems.map((item) => {
          const mine = item.userId === currentUserId;
          const isEditing = editingId === item.id;
          return (
            <article key={item.id} className={`comment-bubble ${mine ? 'mine' : ''}`}>
              <div className="comment-meta">
                <span>{mine ? 'Tú' : item.authorName || 'Usuario'}</span>
                <time>
                  {formatPeruDateTime(item.createdAt)}
                  {item.editedAt ? ' · editado' : ''}
                </time>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <textarea className="input min-h-16" value={editingDraft} onChange={(e) => setEditingDraft(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary text-sm" onClick={() => onSaveEdit(item)}>Guardar</button>
                    <button type="button" className="btn-secondary text-sm" onClick={() => { setEditingId(''); setEditingDraft(''); }}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <>
                  <p>{item.content}</p>
                  {mine && item.id !== 'seed-comment' && (
                    <button type="button" className="text-xs text-blue-700 mt-2 hover:underline" onClick={() => { setEditingId(item.id); setEditingDraft(item.content); }}>
                      Editar
                    </button>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-[1fr_auto]">
        <textarea className="input min-h-20" placeholder="Escribe un comentario..." value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="btn-primary self-end" type="submit">Enviar</button>
      </form>
    </section>
  );
}
