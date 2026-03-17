'use client';

import { FormEvent, useMemo, useState } from 'react';
import { formatPeruDateTime } from '../../lib/datetime';

type CommentItem = {
  id: string;
  authorId: string;
  authorName: string;
  message: string;
  createdAt: string;
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
  const [items, setItems] = useState<CommentItem[]>(() => {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(keyOf(reportId));
    const stored = raw ? (JSON.parse(raw) as CommentItem[]) : [];
    if (stored.length === 0 && initialComment) {
      return [{
        id: 'seed-comment',
        authorId: 'system',
        authorName: 'Comentario inicial',
        message: initialComment,
        createdAt: new Date().toISOString(),
      }];
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

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const next = [...items, {
      id: crypto.randomUUID(),
      authorId: currentUserId,
      authorName: currentUserName,
      message: draft.trim(),
      createdAt: new Date().toISOString(),
    }];
    persist(next);
    setDraft('');
  };

  return (
    <section className="card space-y-4">
      <h3 className="text-base font-semibold text-slate-900">Comentarios</h3>

      <div className="timeline space-y-3">
        {orderedItems.length === 0 && <p className="text-sm text-slate-500">Sin comentarios todavía.</p>}
        {orderedItems.map((item) => {
          const mine = item.authorId === currentUserId;
          return (
            <article key={item.id} className={`comment-bubble ${mine ? 'mine' : ''}`}>
              <div className="comment-meta">
                <span>{mine ? 'Tú' : item.authorName}</span>
                <time>{formatPeruDateTime(item.createdAt)}</time>
              </div>
              <p>{item.message}</p>
            </article>
          );
        })}
      </div>

      <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-[1fr_auto]">
        <textarea
          className="input min-h-20"
          placeholder="Escribe un comentario..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn-primary self-end" type="submit">Enviar</button>
      </form>
    </section>
  );
}
