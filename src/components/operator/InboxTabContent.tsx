import { ChatGPTImport } from '@/components/operator/ChatGPTImport';
import { ResponseAnalyzerPanel } from '@/components/operator/ResponseAnalyzerPanel';
import type { TimelineEvent } from '@/types/operator';
import type { ParseResult } from '@/types/parser';

export interface InboxTabContentProps {
  clientId: string;
  events: TimelineEvent[];
  onImportComplete: (result: ParseResult) => void;
}

/**
 * Bundled for lazy loading — keeps pdf/mammoth/tesseract chunks off the evidence tab critical path.
 */
export default function InboxTabContent({ clientId, events, onImportComplete }: InboxTabContentProps) {
  return (
    <div className="space-y-6">
      <ChatGPTImport clientId={clientId} onImportComplete={onImportComplete} />
      <ResponseAnalyzerPanel clientId={clientId} events={events} />
    </div>
  );
}
