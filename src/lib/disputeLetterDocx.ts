import { Document, Packer, Paragraph, TextRun } from 'docx';

const FONT = 'Arial';
const BODY_SIZE = 24; // half-points → 12pt
const LINE_SPACING_AFTER = 200;

export interface LetterDownloadMeta {
  clientName: string;
  recipientName: string;
  letterType: string;
  downloadDate?: Date;
}

export function sanitizeFilenameSegment(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}

export function letterTypeLabelForFilename(letterType: string): string {
  return letterType
    .replace(/^Response Analyzer\s*[—–-]\s*/i, '')
    .replace(/\s+[—–]\s+/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .trim();
}

export function buildLetterDownloadFilename(
  meta: LetterDownloadMeta,
  ext: 'docx' | 'pdf' = 'docx',
): string {
  const date = meta.downloadDate ?? new Date();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const typeLabel = letterTypeLabelForFilename(meta.letterType);
  const base = `${meta.clientName} - ${meta.recipientName} ${typeLabel} - ${mm}.${dd}`;
  return `${sanitizeFilenameSegment(base)}.${ext}`;
}

export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1');
}

function textRun(text: string, opts: { bold?: boolean } = {}): TextRun {
  return new TextRun({
    text,
    font: FONT,
    size: BODY_SIZE,
    bold: opts.bold,
  });
}

function blockToParagraph(block: string): Paragraph {
  const lines = block
    .split('\n')
    .map((line) => stripInlineMarkdown(line.trim()))
    .filter(Boolean);

  if (lines.length === 0) {
    return new Paragraph({ children: [], spacing: { after: LINE_SPACING_AFTER } });
  }

  const bulletLines = lines.filter((line) => /^[-*•]\s+/.test(line));
  if (bulletLines.length === lines.length) {
    return new Paragraph({
      children: lines.flatMap((line, index) => {
        const text = line.replace(/^[-*•]\s+/, '');
        const runs: TextRun[] = [textRun(`• ${text}`)];
        if (index < lines.length - 1) runs.push(new TextRun({ break: 1 }));
        return runs;
      }),
      spacing: { after: LINE_SPACING_AFTER },
    });
  }

  const children: TextRun[] = [];
  lines.forEach((line, index) => {
    if (index > 0) children.push(new TextRun({ break: 1 }));
    children.push(textRun(line));
  });

  return new Paragraph({
    children,
    spacing: { after: LINE_SPACING_AFTER },
  });
}

export function buildDocxParagraphs(bodyMd: string): Paragraph[] {
  const trimmed = bodyMd.trim();
  if (!trimmed) {
    return [new Paragraph({ children: [textRun('')] })];
  }

  return trimmed
    .split(/\n{2,}/)
    .map((block) => blockToParagraph(block));
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadDisputeLetterDocx(
  bodyMd: string,
  meta: LetterDownloadMeta,
): Promise<void> {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: buildDocxParagraphs(bodyMd),
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, buildLetterDownloadFilename(meta, 'docx'));
}

function letterBodyToPrintHtml(bodyMd: string, meta: LetterDownloadMeta): string {
  const paragraphs = bodyMd
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block
        .split('\n')
        .map((line) => stripInlineMarkdown(line.trim()))
        .filter(Boolean);
      if (lines.length === 0) return '';
      const htmlLines = lines.map((line) => {
        const bullet = /^[-*•]\s+/.test(line);
        const text = bullet ? line.replace(/^[-*•]\s+/, '') : line;
        return bullet ? `<li>${escapeHtml(text)}</li>` : escapeHtml(text);
      });
      const allBullets = lines.every((line) => /^[-*•]\s+/.test(line));
      if (allBullets) {
        return `<ul>${htmlLines.join('')}</ul>`;
      }
      return `<p>${htmlLines.join('<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(buildLetterDownloadFilename(meta, 'pdf'))}</title>
  <style>
    @page { size: letter; margin: 1in; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12pt;
      line-height: 1.4;
      color: #000;
      max-width: 6.5in;
      margin: 0 auto;
    }
    p { margin: 0 0 12pt; }
    ul { margin: 0 0 12pt 1.25em; padding: 0; }
    li { margin-bottom: 4pt; }
  </style>
</head>
<body>
${paragraphs}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Opens a print-ready view so the operator can save as PDF from the browser. */
export function downloadDisputeLetterPdf(bodyMd: string, meta: LetterDownloadMeta): void {
  const html = letterBodyToPrintHtml(bodyMd, meta);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Please allow popups to download the PDF');
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}

export function clientDisplayName(client: {
  legal_full_name?: string | null;
  legal_name?: string | null;
  preferred_name?: string | null;
} | null | undefined): string {
  return (
    client?.legal_full_name?.trim() ||
    client?.legal_name?.trim() ||
    client?.preferred_name?.trim() ||
    'Client'
  );
}
