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
  service: string;
  property: string;
}
export interface Filters {
  query: string;
  animals: string[];
  from: string;
  to: string;
  borough: string;
  overnight: boolean;
}
export interface Metadata {
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
