/** Extract text from PDF using pdfjs-dist (text layer first). */
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export async function extractTextFromPdfFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(text);
  }

  const combined = pages.join('\n\n').trim();
  if (!combined) {
    throw new Error('No text layer found in PDF — OCR fallback required (Phase 2)');
  }
  return combined;
}
