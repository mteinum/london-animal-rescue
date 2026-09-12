import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { normalize, parseCSV } from './normalize';
import { dimensions, classificationValue } from '../src/classifications';
const source = 'https://data.london.gov.uk/dataset/animal-rescue-incidents-attended-by-lfb-2ogkn';
await mkdir('data/source', { recursive: true });
await mkdir('public/data', { recursive: true });
const local = process.argv.includes('--local');
let provenance: { source: string; download: string; retrieved: string };
if (local) {
  provenance = JSON.parse(await readFile('data/source/retrieval.json', 'utf8'));
} else {
  const page = execFileSync('curl', ['-fLSs', '--max-time', '90', source], {
    maxBuffer: 10e6,
  }).toString();
  const links = [
    ...page.matchAll(/href="(https:\/\/data\.london\.gov\.uk\/download\/[^\"]+)"/g),
  ].map((m) => m[1].replace(/&amp;/g, '&'));
  const download = links.find((s) => /Animal.*(?:csv|xlsx)/i.test(s));
  if (!download)
    throw new Error(
      'Current official download not found; snapshot untouched. Inspect the dataset page.',
    );
  const data = execFileSync('curl', ['-fLSs', '--max-time', '180', download], { maxBuffer: 50e6 });
  await writeFile('data/source/lfb-download.bin', data);
  await writeFile('data/source/page.html', page);
  provenance = { source, download, retrieved: new Date().toISOString() };
  await writeFile('data/source/retrieval.json', JSON.stringify(provenance, null, 2));
}
const bytes = await readFile('data/source/lfb-download.bin');
let csv: string;
let sourceFormat: string;
if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
  sourceFormat = 'XLSX (official link is labelled CSV)';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('data/source/lfb-download.bin');
  const sheet = workbook.worksheets.find((s) =>
    s.getRow(1).values.toString().includes('IncidentNumber'),
  );
  if (!sheet) throw new Error('Incident sheet missing');
  const rows: string[][] = [];
  // ExcelJS computes this by scanning every row; cache it once for linear extraction.
  const columnCount = sheet.columnCount;
  sheet.eachRow((row) => {
    const cells: string[] = [];
    for (let i = 1; i <= columnCount; i++) {
      const v = row.getCell(i).value;
      cells.push(
        v instanceof Date
          ? v.toISOString().slice(0, 19)
          : v === null
            ? ''
            : typeof v === 'object'
              ? row.getCell(i).text
              : String(v),
      );
    }
    rows.push(cells);
  });
  csv = Papa.unparse(rows);
} else {
  sourceFormat = 'CSV';
  try {
    csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    csv = new TextDecoder('windows-1252').decode(bytes);
  }
}
const rows = parseCSV(csv),
  result = normalize(rows);
if (result.records.length < 1000) throw new Error('Unexpectedly small dataset; snapshot untouched');
const metadata = {
  ...provenance,
  sourceFormat,
  normalizationVersion: 2,
  classifications: Object.fromEntries(
    dimensions.map((d) => {
      const totals: Record<string, number> = {};
      for (const r of result.records) {
        const value = classificationValue(r[d.field]);
        totals[value] = (totals[value] ?? 0) + 1;
      }
      return [d.field, totals];
    }),
  ),
  sha256: createHash('sha256').update(bytes).digest('hex'),
  total: result.records.length,
  mapped: result.records.filter((r) => r.location).length,
  coverage: { from: result.records[0].date, to: result.records.at(-1)!.date },
  categories: [...new Set(result.records.map((r) => r.category))].sort(),
  boroughs: [...new Set(result.records.map((r) => r.borough))].sort(),
  rejected: result.rejected,
  duplicates: result.duplicates,
  timezone: 'Not documented by source. Civil recorded clocks; no UTC/BST conversion.',
  geographicNote:
    'Rounded BNG grid references, inferred from field names, magnitudes and verification against supplied latitude/longitude. 100 m grid spacing observed; not a guaranteed accuracy. Helmert conversion (metre-level approximation), no invented addresses. Only rounded coordinates are mapped; other rows remain in the list.',
};
await writeFile('public/data/source.csv', csv);
await writeFile(
  'public/data/incidents.json',
  JSON.stringify({ version: 1, records: result.records, metadata }),
);
await writeFile('public/data/provenance.json', JSON.stringify(metadata, null, 2));
console.log(JSON.stringify(metadata, null, 2));
