import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Exports an array of plain objects to a downloaded PDF table.
 * Column headers are taken from the keys of the first object.
 */
export function exportToPdf(
  data: Record<string, unknown>[],
  filename: string,
  title?: string,
  orientation: "portrait" | "landscape" = "portrait"
) {
  if (data.length === 0) return;

  const doc = new jsPDF({ orientation });
  const headers = Object.keys(data[0]);

  if (title) {
    doc.setFontSize(14);
    doc.text(title, 14, 18);
  }

  autoTable(doc, {
    startY: title ? 26 : 14,
    head: [headers],
    body: data.map((row) => headers.map((h) => String(row[h] ?? ""))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    margin: { left: 10, right: 10 },
  });

  doc.save(filename);
}
