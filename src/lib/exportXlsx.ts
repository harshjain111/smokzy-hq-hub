import writeXlsxFile from "write-excel-file/browser";

/**
 * Exports an array of plain objects to a downloaded .xlsx file.
 * Column headers are taken from the keys of the first object (same
 * convention the old XLSX.utils.json_to_sheet-based exports used); each
 * cell's type (string/number/boolean/date) is inferred by the library from
 * the JS value itself, so mixed columns (e.g. a number or a "-" fallback)
 * work without extra handling.
 */
export async function exportToXlsx(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = "Sheet1"
) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const columns = headers.map((header) => ({
    header: { value: header, fontWeight: "bold" as const },
    cell: (row: Record<string, unknown>) => {
      const value = row[header];
      return { value: value === undefined ? null : (value as string | number | boolean | Date | null) };
    },
  }));

  await writeXlsxFile(data, { columns, sheet: sheetName }).toFile(filename);
}
