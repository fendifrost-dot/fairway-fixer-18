/**
 * Attachment Detector (B7)
 *
 * Detects Google Drive paths and file URLs in free-text columns / lines.
 * Returns { drive_path, file_url, mime_type, file_name } records.
 *
 * Patterns matched:
 *   - "[A-Z][A-Z\s]+ CREDIT/responses/<filename>.<ext>"   (project Drive path convention)
 *   - Bare strings ending in .png/.jpg/.jpeg/.pdf/.heic/.webp
 *   - URLs (http/https) with one of those extensions OR a Google Drive share URL
 *   - Strings preceded by "saved to", "saved at", "in Drive", "Drive at" — capture the path/URL after
 */

export interface ParsedAttachment {
  drive_path: string;
  file_url: string | null;
  mime_type: string;
  file_name: string;
  size_bytes?: number | null;
}

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
  gif: 'image/gif',
};

const EXTS = Object.keys(EXT_MIME).join('|');

// project-style Drive folder path: e.g. "SAM CREDIT/responses/2026-03-25-innovis-response.png"
const PROJECT_PATH_RE = new RegExp(
  `\\b([A-Z][A-Z\\s]{1,40}\\s+CREDIT\\/[A-Za-z0-9_\\-./]+\\.(?:${EXTS}))\\b`,
  'gi',
);

// any bare token ending in a known extension (no whitespace, allow dot/dash/underscore/slash)
const BARE_PATH_RE = new RegExp(
  `(?:[A-Za-z0-9_./-]+\\.(?:${EXTS}))`,
  'gi',
);

// URLs ending in known extensions OR Google Drive file/folder URLs
const URL_RE = /(https?:\/\/[^\s<>"')]+)/gi;
const DRIVE_URL_RE = /https?:\/\/(?:drive|docs)\.google\.com\/[^\s<>"')]+/i;

export function inferMimeFromName(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)(?:\?.*)?$/);
  const ext = m?.[1] ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

function fileNameFromPath(p: string): string {
  try {
    // strip query/hash
    const clean = p.split(/[?#]/)[0];
    const parts = clean.split('/').filter(Boolean);
    return parts[parts.length - 1] || p;
  } catch {
    return p;
  }
}

function dedupe(items: ParsedAttachment[]): ParsedAttachment[] {
  const seen = new Set<string>();
  const out: ParsedAttachment[] = [];
  for (const it of items) {
    const key = `${it.drive_path}|${it.file_url ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/**
 * Scan an arbitrary text snippet for attachment references.
 */
export function detectAttachmentsInText(text: string | null | undefined): ParsedAttachment[] {
  if (!text) return [];
  const found: ParsedAttachment[] = [];

  // 1) URLs first (so we don't double-match the bare-path inside)
  const urls = text.match(URL_RE) || [];
  for (const url of urls) {
    const isDrive = DRIVE_URL_RE.test(url);
    const name = fileNameFromPath(url);
    const mime = inferMimeFromName(name);
    // Only keep URLs that either (a) are a Drive URL or (b) end in a known extension
    if (!isDrive && mime === 'application/octet-stream') continue;
    found.push({
      drive_path: url,
      file_url: url,
      mime_type: mime,
      file_name: name,
    });
  }

  // 2) Project-style "X CREDIT/responses/file.ext" paths
  const projectMatches = text.match(PROJECT_PATH_RE) || [];
  for (const p of projectMatches) {
    const name = fileNameFromPath(p);
    found.push({
      drive_path: p.trim(),
      file_url: null,
      mime_type: inferMimeFromName(name),
      file_name: name,
    });
  }

  // 3) Bare path tokens (only when preceded by an obvious cue OR matching a known extension)
  //    To avoid false positives, only accept bare paths that contain a slash OR
  //    appear after "saved to" / "saved at" / "Drive at" / "in Drive".
  const cueRe = new RegExp(
    `(?:saved\\s+(?:to|at)|in\\s+Drive|Drive\\s+at|attachment[:\\s]+|file[:\\s]+)\\s*([^\\s,;]+\\.(?:${EXTS}))`,
    'gi',
  );
  let m: RegExpExecArray | null;
  while ((m = cueRe.exec(text)) !== null) {
    const p = m[1];
    const name = fileNameFromPath(p);
    found.push({
      drive_path: p,
      file_url: null,
      mime_type: inferMimeFromName(name),
      file_name: name,
    });
  }

  // 4) Slash-containing bare paths (e.g. "responses/foo.pdf")
  const slashy = text.match(BARE_PATH_RE) || [];
  for (const p of slashy) {
    if (!p.includes('/')) continue;
    if (/^https?:/i.test(p)) continue; // already handled
    const name = fileNameFromPath(p);
    found.push({
      drive_path: p,
      file_url: null,
      mime_type: inferMimeFromName(name),
      file_name: name,
    });
  }

  return dedupe(found);
}

/**
 * Operator-pasted line (one path/URL per line) → ParsedAttachment[].
 * Tolerates extra whitespace; skips empty lines; if a token has no recognizable
 * extension AND isn't a Drive URL we infer mime as octet-stream and keep the
 * raw text as drive_path so the operator's reference is preserved verbatim.
 */
export function parseAttachmentLines(text: string): ParsedAttachment[] {
  const out: ParsedAttachment[] = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/^https?:\/\//i.test(line)) {
      const name = fileNameFromPath(line);
      out.push({
        drive_path: line,
        file_url: line,
        mime_type: inferMimeFromName(name),
        file_name: name,
      });
      continue;
    }

    const detected = detectAttachmentsInText(line);
    if (detected.length > 0) {
      out.push(...detected);
      continue;
    }

    // Fallback: keep the raw line as drive_path with a generic mime.
    out.push({
      drive_path: line,
      file_url: null,
      mime_type: 'application/octet-stream',
      file_name: fileNameFromPath(line),
    });
  }
  return dedupe(out);
}

export function humanFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

export function isPdfMime(mime: string): boolean {
  return mime === 'application/pdf';
}