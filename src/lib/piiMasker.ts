/**
 * PII Masking Utility
 *
 * Masks personally identifiable information before sending text to external AI models.
 * Defense-in-depth: client-side masking + server-side masking in edge function.
 *
 * Patterns masked:
 * - SSN: XXX-XX-XXXX or 9 consecutive digits
 * - Account numbers: 10+ digit sequences → ****{last4}
 * - Already-masked patterns (****1234) are left untouched
 */

export interface MaskResult {
  masked: string;
  hadPII: boolean;
  maskCount: number;
}

export function maskPII(text: string): MaskResult {
  let hadPII = false;
  let maskCount = 0;
  let masked = text;

  // SSN with dashes: 123-45-6789 → XXX-XX-XXXX
  masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, () => {
    hadPII = true;
    maskCount++;
    return 'XXX-XX-XXXX';
  });

  // SSN without dashes: 9 consecutive digits (not part of a longer number)
  masked = masked.replace(/(?<!\d)\d{9}(?!\d)/g, () => {
    hadPII = true;
    maskCount++;
    return 'XXXXXXXXX';
  });

  // Account numbers: 10+ consecutive digits → ****{last4}
  // Skip already-masked patterns like ****1234
  masked = masked.replace(/(?<!\*)\b(\d{10,})\b/g, (match) => {
    hadPII = true;
    maskCount++;
    return '****' + match.slice(-4);
  });

  return { masked, hadPII, maskCount };
}

/**
 * Batch mask multiple lines, preserving original line indices.
 */
export function maskPIIBatch(lines: string[]): {
  maskedLines: string[];
  totalMaskCount: number;
} {
  let totalMaskCount = 0;
  const maskedLines = lines.map((line) => {
    const result = maskPII(line);
    totalMaskCount += result.maskCount;
    return result.masked;
  });
  return { maskedLines, totalMaskCount };
}
