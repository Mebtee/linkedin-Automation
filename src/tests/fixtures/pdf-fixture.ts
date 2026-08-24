// ─── Test Fixture: minimal valid PDFs built byte-by-byte ────────────────────
// Produces real PDF files (correct xref offsets, Helvetica base font) so that
// extraction tests exercise genuine parsing — no mocking of pdf.js.

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildTestPdf(pageTexts: readonly string[]): Uint8Array {
  const pageCount = pageTexts.length;
  const objects: string[] = [];

  // Object numbering: 1 catalog · 2 pages tree · 3 font · pages start at 4.
  const pageObjNum = (i: number) => 4 + i * 2;
  const contentObjNum = (i: number) => 5 + i * 2;
  const lastObjNum = contentObjNum(pageCount - 1);

  const kids = Array.from({ length: pageCount }, (_, i) => `${pageObjNum(i)} 0 R`).join(" ");

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  for (let i = 0; i < pageCount; i++) {
    const lines = pageTexts[i]!.split("\n");
    const streamLines = lines.map((l) => `(${escapePdfText(l)}) Tj T*`).join("\n");
    const stream =
      `BT\n/F1 11 Tf\n72 720 Td\n14 TL\n${streamLines}\nET`;

    objects[pageObjNum(i)] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjNum(i)} 0 R >>`;
    objects[contentObjNum(i)] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }

  // ── Serialize with a correct xref table ──
  let out = "%PDF-1.4\n";
  const offsets: number[] = new Array(lastObjNum + 1).fill(0);

  for (let num = 1; num <= lastObjNum; num++) {
    offsets[num] = out.length;
    out += `${num} 0 obj\n${objects[num]}\nendobj\n`;
  }

  const xrefStart = out.length;
  out += `xref\n0 ${lastObjNum + 1}\n0000000000 65535 f \n`;
  for (let num = 1; num <= lastObjNum; num++) {
    out += `${String(offsets[num]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${lastObjNum + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(out);
}
