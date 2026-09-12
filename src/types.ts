export interface Incident {
  id: string;
  date: string;
  clock: number;
  animal: string;
  category: string;
  description: string;
  borough: string;
  ward: string;
  postcode: string;
  street: string;
  station: string;
  location: {
    coordinates: [number, number];
    precision: 'rounded-grid';
    easting: number;
    northing: number;
  } | null;
  pumps: number | null;
  pumpHours: number | null;
  hourlyCost: number | null;
  cost: number | null;
  serviceCategory: string;
  service: string;
  propertyCategory: string;
  property: string;
}
export interface Filters {
  query: string;
  animals: string[];
  from: string;
  to: string;
  borough: string;
  overnight: boolean;
  serviceCategories: string[];
  services: string[];
  propertyCategories: string[];
  properties: string[];
}
export type View = 'explore' | 'patterns' | 'notebook' | 'cases';
export interface Navigation {
  view: View;
  caseAnimal: string;
}
export interface Metadata {
  normalizationVersion?: number;
  classifications?: Record<string, Record<string, number>>;
  retrieved: string;
  source: string;
  download: string;
  sourceFormat: string;
  total: number;
  mapped: number;
  coverage: { from: string; to: string };
  rejected: { row: number; reason: string }[];
  duplicates: string[];
  categories: string[];
  boroughs: string[];
  timezone: string;
  geographicNote: string;
  sha256: string;
}
export interface Snapshot {
  version: 1;
  records: Incident[];
  metadata: Metadata;
}
