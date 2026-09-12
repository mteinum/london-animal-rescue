import type { Snapshot } from './types';
import { animalGroup } from './classifications';
/** Additive revision of envelope v1. Older snapshots have unknown parent fields. */
export function readSnapshot(value: unknown): Snapshot {
  const snapshot = value as Snapshot;
  if (
    snapshot?.version !== 1 ||
    !Array.isArray(snapshot.records) ||
    !snapshot.records.length ||
    !snapshot.metadata?.coverage
  )
    throw new Error('Snapshot is invalid or uses an unsupported version');
  snapshot.records = snapshot.records.map((r) => ({
    ...r,
    category: animalGroup(r.animal || r.category || ''),
    description: typeof r.description === 'string' ? r.description : '',
    serviceCategory: r.serviceCategory?.trim() || '',
    service: r.service?.trim() || '',
    propertyCategory: r.propertyCategory?.trim() || '',
    property: r.property?.trim() || '',
  }));
  snapshot.metadata.categories = [...new Set(snapshot.records.map((r) => r.category))].sort();
  return snapshot;
}
