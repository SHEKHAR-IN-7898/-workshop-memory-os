import { parse } from "csv-parse/sync";

export function parseCsv(input: string): Record<string, string>[] {
  const rows = parse(input, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  return rows;
}

export function requiredColumns(rows: Record<string,string>[], columns: string[]): void {
  if (!rows.length) throw new Error("CSV contains no rows");
  const present = new Set(Object.keys(rows[0]!));
  const missing = columns.filter((column) => !present.has(column));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);
}
