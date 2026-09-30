import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";

export async function extractPdf(buffer: Buffer) {
  if (buffer.length > 25 * 1024 * 1024) throw new Error("PDF exceeds 25 MB limit");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return {
      sha256: createHash("sha256").update(buffer).digest("hex"),
      pages: result.total,
      text: result.text.slice(0, 5_000_000),
    };
  } finally {
    await parser.destroy();
  }
}
