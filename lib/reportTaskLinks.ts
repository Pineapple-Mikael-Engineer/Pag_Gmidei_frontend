const STORAGE_KEY = 'report-task-links:v1';

type ReportTaskLinkMap = Record<string, string[]>;

function loadMap(): ReportTaskLinkMap {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as ReportTaskLinkMap;
  } catch {
    return {};
  }
}

function saveMap(map: ReportTaskLinkMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getLinkedTaskIds(reportId: string): string[] {
  return loadMap()[reportId] || [];
}

export function setLinkedTaskIds(reportId: string, taskIds: string[]) {
  const map = loadMap();
  map[reportId] = Array.from(new Set(taskIds.filter(Boolean)));
  saveMap(map);
}
