export type ReportReviewStatus = 'pendiente' | 'en_revision' | 'aprobado' | 'requiere_cambios';

export interface ReportReviewItem {
  reportId: string;
  status: ReportReviewStatus;
  tags: string[];
  reviewNote: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  checklist: {
    claridad: boolean;
    evidencia: boolean;
    siguientePaso: boolean;
  };
}

const STORAGE_KEY = 'report-reviews:v1';

const defaultReview = (reportId: string): ReportReviewItem => ({
  reportId,
  status: 'pendiente',
  tags: [],
  reviewNote: '',
  checklist: {
    claridad: false,
    evidencia: false,
    siguientePaso: false,
  },
});

export function loadReportReviews(): ReportReviewItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReportReviewItem[]) : [];
  } catch {
    return [];
  }
}

export function getReportReview(reportId: string): ReportReviewItem {
  return loadReportReviews().find((item) => item.reportId === reportId) || defaultReview(reportId);
}

export function saveReportReviews(items: ReportReviewItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function updateReportReview(reportId: string, patch: Partial<ReportReviewItem>) {
  const current = getReportReview(reportId);
  const nextItem: ReportReviewItem = {
    ...current,
    ...patch,
    checklist: {
      ...current.checklist,
      ...(patch.checklist || {}),
    },
  };
  const all = loadReportReviews();
  const next = [...all.filter((item) => item.reportId !== reportId), nextItem];
  saveReportReviews(next);
  return next;
}
