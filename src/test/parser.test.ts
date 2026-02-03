import { describe, it, expect } from 'vitest';
import { parseUpdate } from '@/lib/parser';

describe('Deterministic Parser Contract', () => {
  const clientId = 'test-client-id';

  describe('Section Header Routing', () => {
    it('routes COMPLETED ACTIONS to timeline_events with event_kind=action', () => {
      const input = `COMPLETED ACTIONS:
2025-01-15 | Experian | Dispute Letter | Sent certified mail | Tracking #123`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(1);
      expect(result.timeline_events[0].event_kind).toBe('action');
      expect(result.timeline_events[0].source).toBe('experian');
    });

    it('routes RESPONSES RECEIVED to timeline_events with event_kind=response', () => {
      const input = `RESPONSES RECEIVED:
2025-02-10 | TransUnion | Verified | No documentation | Account XYZ`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(1);
      expect(result.timeline_events[0].event_kind).toBe('response');
      expect(result.timeline_events[0].source).toBe('transunion');
    });

    it('routes OUTCOMES OBSERVED to timeline_events with event_kind=outcome', () => {
      const input = `OUTCOMES OBSERVED:
2025-02-15 | Equifax | Account Deleted | Removed from report`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(1);
      expect(result.timeline_events[0].event_kind).toBe('outcome');
      expect(result.timeline_events[0].source).toBe('equifax');
    });

    it('routes OPEN / UNRESOLVED ITEMS to unresolved_items (not timeline)', () => {
      const input = `OPEN / UNRESOLVED ITEMS:
Experian | Collection account | Disputed | ABC Collections | 2025-01-20`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(0);
      expect(result.unresolved_items.length).toBe(1);
      expect(result.unresolved_items[0].source).toBe('experian');
    });

    it('routes SUGGESTED NEXT ACTIONS to scheduled_events (not timeline)', () => {
      const input = `SUGGESTED NEXT ACTIONS:
2025-02-25 | File CFPB Complaint | CFPB | High | Re: violation`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(0);
      expect(result.scheduled_events.length).toBe(1);
      expect(result.scheduled_events[0].priority).toBe('high');
    });
  });

  describe('No Silent Defaults - Missing Source', () => {
    it('routes lines with missing source to unrouted_lines (not timeline)', () => {
      const input = `COMPLETED ACTIONS:
2025-01-15 | Unknown Entity | Did something | Details`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(0);
      expect(result.unrouted_lines.length).toBe(1);
      expect(result.counts.unrouted).toBe(1);
    });
  });

  describe('All CRAs Expansion', () => {
    it('expands "All CRAs" to 3 separate events (experian, transunion, equifax)', () => {
      const input = `COMPLETED ACTIONS:
2025-01-20 | All CRAs | Dispute Letter | Sent to all bureaus`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(3);
      
      const sources = result.timeline_events.map(e => e.source).sort();
      expect(sources).toEqual(['equifax', 'experian', 'transunion']);
      
      // All should have scope=all_cras
      result.timeline_events.forEach(e => {
        expect(e.scope).toBe('all_cras');
      });
    });

    it('expands "All bureaus" to 3 separate events', () => {
      const input = `COMPLETED ACTIONS:
2025-01-20 | All bureaus | Freeze Request | Submitted online`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(3);
    });
  });

  describe('Source Normalization', () => {
    it('normalizes source variants correctly', () => {
      const input = `COMPLETED ACTIONS:
2025-01-15 | Lexis Nexis | Report Request | Requested
2025-01-16 | Trans Union | Dispute | Sent
2025-01-17 | Federal Trade Commission | ID Theft Report | Filed`;
      
      const result = parseUpdate(input, clientId);
      
      const sources = result.timeline_events.map(e => e.source);
      expect(sources).toContain('lexisnexis');
      expect(sources).toContain('transunion');
      expect(sources).toContain('ftc');
    });
  });

  describe('FTC Deterministic Classification', () => {
    it('auto-assigns source=ftc for FTC Identity Theft Report creation', () => {
      const input = `COMPLETED ACTIONS:
2025-01-10 | - | FTC Identity Theft Report | Created online | -`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(1);
      expect(result.timeline_events[0].source).toBe('ftc');
      expect(result.timeline_events[0].event_kind).toBe('action');
      expect(result.unrouted_lines.length).toBe(0);
    });

    it('auto-assigns source=ftc for Identity Theft Report filed', () => {
      const input = `COMPLETED ACTIONS:
2025-01-10 | Unknown | Identity Theft Report | Filed with FTC | -`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(1);
      expect(result.timeline_events[0].source).toBe('ftc');
    });

    it('auto-assigns source=ftc for identitytheft.gov submission', () => {
      const input = `COMPLETED ACTIONS:
2025-01-10 | - | Report | Submitted via identitytheft.gov | -`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(1);
      expect(result.timeline_events[0].source).toBe('ftc');
    });

    it('does not auto-assign ftc for unrelated content', () => {
      const input = `COMPLETED ACTIONS:
2025-01-10 | - | Random Report | Some details | -`;
      
      const result = parseUpdate(input, clientId);
      
      // Should be unrouted (no valid source)
      expect(result.timeline_events.length).toBe(0);
      expect(result.unrouted_lines.length).toBe(1);
    });
  });

  describe('Unrouted Handling', () => {
    it('routes lines before any section header to unrouted', () => {
      const input = `2025-01-15 | Experian | Something | Details
      
COMPLETED ACTIONS:
2025-01-20 | Equifax | Dispute | Sent`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events.length).toBe(1);
      expect(result.unrouted_lines.length).toBeGreaterThan(0);
    });

    it('creates notes_flags for unrouted lines', () => {
      const input = `Some random line | with pipes | but no header
      
COMPLETED ACTIONS:
2025-01-20 | Experian | Dispute | Sent`;
      
      const result = parseUpdate(input, clientId);
      
      const unroutedWarnings = result.notes_flags.filter(n => n.flag_type === 'unrouted_warning');
      expect(unroutedWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('Date Handling', () => {
    it('parses valid dates correctly', () => {
      const input = `COMPLETED ACTIONS:
2025-01-15 | Experian | Dispute | Sent`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events[0].event_date).toBe('2025-01-15');
      expect(result.timeline_events[0].date_is_unknown).toBe(false);
    });

    it('marks unknown dates correctly', () => {
      const input = `COMPLETED ACTIONS:
XX/XX/2025 | Experian | Dispute | Sent sometime`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.timeline_events[0].event_date).toBe(null);
      expect(result.timeline_events[0].date_is_unknown).toBe(true);
    });

    it('handles ASAP for scheduled events', () => {
      const input = `SUGGESTED NEXT ACTIONS:
ASAP | Follow up | Experian | High | Need to check`;
      
      const result = parseUpdate(input, clientId);
      
      expect(result.scheduled_events[0].due_date).toBe(null);
      expect(result.scheduled_events[0].due_text).toBe('ASAP');
    });
  });
});
