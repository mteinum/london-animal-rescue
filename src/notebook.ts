export const NOTEBOOK_KEY = 'london-animal-rescue:notebook:v1';
export interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}
export function readNotebook(storage: Store): { ids: string[]; error: string } {
  try {
    const raw = storage.getItem(NOTEBOOK_KEY);
    if (!raw) return { ids: [], error: '' };
    const d: unknown = JSON.parse(raw);
    if (
      !d ||
      typeof d !== 'object' ||
      !('version' in d) ||
      d.version !== 1 ||
      !('ids' in d) ||
      !Array.isArray(d.ids)
    )
      return {
        ids: [],
        error: 'Notebook format could not be read. Existing storage has not been changed.',
      };
    return {
      ids: [
        ...new Set(
          d.ids.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 100),
        ),
      ].slice(0, 20000),
      error: '',
    };
  } catch {
    return {
      ids: [],
      error: 'Local notebook storage is unavailable. Changes will last for this visit only.',
    };
  }
}
export function writeNotebook(storage: Store, ids: string[]): boolean {
  try {
    storage.setItem(NOTEBOOK_KEY, JSON.stringify({ version: 1, ids: [...new Set(ids)] }));
    return true;
  } catch {
    return false;
  }
}
