 import { describe, it, expect } from 'vitest';
 import { 
   detectSource, 
   detectEventKind, 
   parseDate, 
   isJsonInput, 
   smartImportParse 
 } from '@/lib/smartImport';
 
 describe('Smart Import', () => {
   describe('detectSource', () => {
     it('detects TransUnion from text', () => {
       expect(detectSource('TransUnion emailed response 02/04/26')).toBe('TransUnion');
     });
     
     it('detects TU alias', () => {
       expect(detectSource('TU sent letter')).toBe('TransUnion');
     });
     
     it('detects AG alias', () => {
       expect(detectSource('Filed with Attorney General')).toBe('AG');
     });
     
     it('returns null when no source found', () => {
       expect(detectSource('Some random text')).toBe(null);
     });
     
     it('is case insensitive', () => {
       expect(detectSource('EXPERIAN sent letter')).toBe('Experian');
     });
   });
   
   describe('detectEventKind', () => {
     it('detects response keywords', () => {
       expect(detectEventKind('TransUnion emailed response')).toBe('response');
       expect(detectEventKind('We received a letter')).toBe('response');
     });
     
     it('detects action keywords', () => {
       expect(detectEventKind('Sent dispute letter')).toBe('action');
       expect(detectEventKind('Filed complaint')).toBe('action');
     });
     
     it('detects outcome keywords', () => {
       expect(detectEventKind('Account deleted from report')).toBe('outcome');
      expect(detectEventKind('Investigation completed successfully')).toBe('outcome');
      expect(detectEventKind('Reinsertion detected on report')).toBe('outcome');
     });
     
     it('defaults to action', () => {
       expect(detectEventKind('Random text here')).toBe('action');
     });
   });
   
   describe('parseDate', () => {
     it('parses MM/DD/YY format', () => {
       expect(parseDate('Something happened 02/04/26')).toBe('2026-02-04');
     });
     
     it('parses MM/DD/YYYY format', () => {
       expect(parseDate('Event on 02/04/2026')).toBe('2026-02-04');
     });
     
     it('parses YYYY-MM-DD format', () => {
       expect(parseDate('Happened on 2026-02-04')).toBe('2026-02-04');
     });
     
     it('returns null for no date', () => {
       expect(parseDate('No date in this text')).toBe(null);
     });
   });
   
   describe('isJsonInput', () => {
     it('detects JSON object', () => {
       expect(isJsonInput('{"key": "value"}')).toBe(true);
       expect(isJsonInput('  { "key": "value" }')).toBe(true);
     });
     
     it('detects JSON array', () => {
       expect(isJsonInput('[1, 2, 3]')).toBe(true);
     });
     
     it('returns false for plain text', () => {
       expect(isJsonInput('TransUnion emailed response')).toBe(false);
     });
   });
   
   describe('smartImportParse - acceptance tests', () => {
     it('parses TransUnion emailed response correctly', () => {
       const text = 'TransUnion emailed response 02/04/26: ...';
       const result = smartImportParse(text);
       
       expect(result.source).toBe('TransUnion');
       expect(result.event_kind).toBe('response');
       expect(result.event_date).toBe('2026-02-04');
       expect(result.date_is_unknown).toBe(false);
       expect(result.raw_line).toBe(text);
     });
     
     it('handles text with no date', () => {
       const result = smartImportParse('Equifax sent something');
       
       expect(result.event_date).toBe(null);
       expect(result.date_is_unknown).toBe(true);
     });
     
     it('handles text with no recognizable source', () => {
       const result = smartImportParse('Something happened 01/01/25');
       
       expect(result.source).toBe(null);
     });
   });
 });
  
  // ====================================================================
  // REQUIRED ACCEPTANCE TESTS - Must pass before shipping
  // ====================================================================
  
  describe('Smart Import - Required Acceptance Tests', () => {
    it('TEST A: Real case - TransUnion emailed response with full message', () => {
      const text = 'TransUnion emailed response 02/04/26: Hi TERRENCE CLEVELAND. We received your dispute...';
      const result = smartImportParse(text);
      
      expect(result.source).toBe('TransUnion');
      expect(result.event_kind).toBe('response');
      expect(result.event_date).toBe('2026-02-04');
      expect(result.date_is_unknown).toBe(false);
      expect(result.raw_line).toBe(text);
    });
    
    it('TEST B: Invalid date rejected (99/99/26)', () => {
      const text = 'TransUnion response 99/99/26: ...';
      const result = smartImportParse(text);
      
      expect(result.event_date).toBe(null);
      expect(result.date_is_unknown).toBe(true);
      expect(result.source).toBe('TransUnion');
    });
    
    it('TEST C: No source detected goes to null (placement error)', () => {
      const text = 'Emailed response 02/04/26: ...';
      const result = smartImportParse(text);
      
      expect(result.source).toBe(null);
      expect(result.event_kind).toBe('response');
      expect(result.event_date).toBe('2026-02-04');
    });
  });