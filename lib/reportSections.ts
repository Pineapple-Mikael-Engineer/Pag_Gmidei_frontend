export type ReportSections = {
  avance: string;
  problemas: string;
  siguientePaso: string;
  evidencia: string[];
};

export const EMPTY_REPORT_SECTIONS: ReportSections = {
  avance: '',
  problemas: '',
  siguientePaso: '',
  evidencia: [],
};

function normalizeEvidence(lines: string[]): string[] {
  return lines
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

export function buildReportMarkdown(sections: ReportSections): string {
  const evidenceLines = sections.evidencia.filter(Boolean).map((link) => `- ${link.trim()}`);

  return [
    '## Avance',
    sections.avance.trim() || 'Sin actualizaciones.',
    '',
    '## Problemas',
    sections.problemas.trim() || 'Sin problemas reportados.',
    '',
    '## Siguiente paso',
    sections.siguientePaso.trim() || 'Sin siguiente paso definido.',
    '',
    '## Evidencia',
    evidenceLines.length > 0 ? evidenceLines.join('\n') : '- Sin evidencia',
  ].join('\n');
}

export function parseReportMarkdown(markdown: string): ReportSections {
  if (!markdown.trim()) return EMPTY_REPORT_SECTIONS;

  const sections: Record<string, string[]> = {
    avance: [],
    problemas: [],
    siguientePaso: [],
    evidencia: [],
  };

  let current: keyof typeof sections = 'avance';
  const lines = markdown.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const normalized = line.trim().toLowerCase();

    if (normalized === '## avance') {
      current = 'avance';
      continue;
    }
    if (normalized === '## problemas') {
      current = 'problemas';
      continue;
    }
    if (normalized === '## siguiente paso') {
      current = 'siguientePaso';
      continue;
    }
    if (normalized === '## evidencia') {
      current = 'evidencia';
      continue;
    }

    sections[current].push(line);
  }

  return {
    avance: sections.avance.join('\n').trim(),
    problemas: sections.problemas.join('\n').trim(),
    siguientePaso: sections.siguientePaso.join('\n').trim(),
    evidencia: normalizeEvidence(sections.evidencia),
  };
}

export function parseEvidenceFromInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((link) => link.trim())
    .filter(Boolean);
}
