/**
 * Evidence Timeline Types
 */

import { TimelineEvent, EventSource } from '@/types/operator';

export type EvidenceCategory = 'Action' | 'Response' | 'Outcome' | 'Note';

export interface PlacementDebug {
  source: string;
  kind: string;
  date: string;
  placedIn: string;
}

export interface EvidenceItemProps {
  event: TimelineEvent;
  clientId: string;
  showDebug?: boolean;
  onDragStart?: (event: TimelineEvent) => void;
}

export interface SourceSectionProps {
  source: EventSource;
  events: TimelineEvent[];
  clientId: string;
  showDebug?: boolean;
  isDropTarget?: boolean;
  onDrop?: (event: TimelineEvent, toSource: EventSource) => void;
}

export interface EvidenceTimelineProps {
  events: TimelineEvent[];
  clientId: string;
}
