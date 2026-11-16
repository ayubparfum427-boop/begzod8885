import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function cleanPdfText(input: unknown): string {
  return String(input ?? "")
    .replace(/[‘’`ʻʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, "-");
}

export function exportToExcel(
  rows: Record<string, string | number>[],
  sheetName: string,
  fileName: string
) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportToCSV(
  rows: Record<string, string | number>[],
  fileName: string
) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const val = String(r[h] ?? "").replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(",")
    ),
  ];
  const blob = new Blob(["\uFEFF" + csvLines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(params: {
  title: string;
  subtitle?: string;
  headers: string[];
  body: Array<Array<string | number>>;
  fileName: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  // Brand header bar
  doc.setFillColor(6, 78, 59); // #064E3B Emerald
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, "F");

  doc.setTextColor(212, 175, 55); // #D4AF37 Gold
  doc.setFontSize(16);
  doc.text("AYUB CLUB PRO - AYUB PARFUM", 40, 30);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(cleanPdfText(params.title), 40, 48);

  if (params.subtitle) {
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.text(cleanPdfText(params.subtitle), 40, 84);
  }

  autoTable(doc, {
    startY: params.subtitle ? 98 : 80,
    head: [params.headers.map(cleanPdfText)],
    body: params.body.map((row) => row.map(cleanPdfText)),
    headStyles: {
      fillColor: [6, 78, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [243, 244, 246],
    },
    styles: {
      fontSize: 9,
      cellPadding: 6,
    },
  });

  doc.save(`${params.fileName}.pdf`);
}
