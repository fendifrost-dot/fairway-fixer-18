/**
 * Extract plain text from bureau response uploads (browser only).
 * PDF via pdf.js, DOCX via mammoth, images via Tesseract (lazy-loaded).
 */

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const version = (pdfjs as { version?: string }).version ?? '4.10.38';
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    parts.push(line);
  }
  return parts.join('\n\n').trim();
}

async function extractDocxText(file: File): Promise<string> {
  const { extractRawText } = await import('mammoth');
  const buf = await file.arrayBuffer();
  const { value } = await extractRawText({ arrayBuffer: buf });
  return (value || '').trim();
}

async function extractImageOcr(file: File): Promise<string> {
  const mod = await import('tesseract.js');
  const Tesseract = mod.default ?? mod;
  const recognize = Tesseract.recognize as (
    f: File,
    lang: string,
    opts: { logger: () => void }
  ) => Promise<{ data: { text: string } }>;
  const {
    data: { text },
  } = await recognize(file, 'eng', {
    logger: () => undefined,
  });
  return (text || '').trim();
}

const IMAGE_TYPES = /^image\//;

export function supportedResponseMimeTypes(): string[] {
  return [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
  ];
}

export async function extractResponseDocumentText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (type === 'text/plain' || name.endsWith('.txt')) {
    return (await file.text()).trim();
  }

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return extractPdfText(file);
  }

  if (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    return extractDocxText(file);
  }

  if (IMAGE_TYPES.test(type) || /\.(png|jpe?g|webp|gif)$/i.test(name)) {
    return extractImageOcr(file);
  }

  throw new Error(
    'Unsupported file type. Use PDF, DOCX, plain text, or a common image format (PNG/JPEG/WebP/GIF).'
  );
}
