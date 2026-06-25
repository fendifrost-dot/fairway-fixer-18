import { describe, it, expect } from 'vitest';
import {
  buildLetterDownloadFilename,
  letterTypeLabelForFilename,
  sanitizeFilenameSegment,
  stripInlineMarkdown,
} from '@/lib/disputeLetterDocx';

describe('disputeLetterDocx', () => {
  it('builds filename matching operator folder convention', () => {
    const name = buildLetterDownloadFilename(
      {
        clientName: 'Jamal Theodore Harris',
        recipientName: 'Equifax',
        letterType: 'Response Analyzer — Bureau Dispute — Follow-up',
        downloadDate: new Date(2026, 5, 25),
      },
      'docx',
    );
    expect(name).toBe('Jamal Theodore Harris - Equifax Bureau Dispute Follow-up - 06.25.docx');
  });

  it('strips Response Analyzer prefix from letter type label', () => {
    expect(letterTypeLabelForFilename('Response Analyzer — Inquiry Dispute — Initial')).toBe(
      'Inquiry Dispute Initial',
    );
  });

  it('removes invalid filename characters', () => {
    expect(sanitizeFilenameSegment('Bad: name/with\\chars')).toBe('Bad namewithchars');
  });

  it('strips inline markdown', () => {
    expect(stripInlineMarkdown('**Re:** Apple Card')).toBe('Re: Apple Card');
  });
});
