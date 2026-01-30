import { TimelineEvent, Recommendation, EventSource, SimplePriority } from '@/types/operator';
import { differenceInDays } from 'date-fns';

const DATA_BROKER_FREEZE_SOURCES: EventSource[] = ['LexisNexis', 'CoreLogic', 'Innovis', 'Sagestream'];
const CRA_SOURCES: EventSource[] = ['Experian', 'TransUnion', 'Equifax'];

export function generateRecommendations(events: TimelineEvent[]): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const today = new Date();
  
  // Get completed actions by source
  const completedSources = new Set<EventSource>();
  const disputesBySource = new Map<EventSource, TimelineEvent[]>();
  const responsesBySource = new Map<EventSource, TimelineEvent[]>();
  
  for (const event of events) {
    if (event.category === 'Action' && event.source) {
      completedSources.add(event.source);
      
      // Track CRA disputes
      if (CRA_SOURCES.includes(event.source)) {
        const existing = disputesBySource.get(event.source) || [];
        existing.push(event);
        disputesBySource.set(event.source, existing);
      }
    }
    
    if (event.category === 'Response' && event.source) {
      const existing = responsesBySource.get(event.source) || [];
      existing.push(event);
      responsesBySource.set(event.source, existing);
    }
  }
  
  // Rule 1: Data broker freeze sequence
  const hasLexisNexis = completedSources.has('LexisNexis');
  const hasCoreLogic = completedSources.has('CoreLogic');
  const hasInnovis = completedSources.has('Innovis');
  const hasSagestream = completedSources.has('Sagestream');
  
  if (hasLexisNexis && hasCoreLogic && hasInnovis && !hasSagestream) {
    recommendations.push({
      id: 'sagestream-freeze',
      title: 'Submit Sagestream Freeze',
      reason: 'LexisNexis, CoreLogic, and Innovis freezes are complete. Sagestream is the next step.',
      priority: 'Medium',
      source: 'Sagestream',
    });
  }
  
  // Suggest missing data broker freezes individually
  if (!hasLexisNexis) {
    recommendations.push({
      id: 'lexisnexis-freeze',
      title: 'Submit LexisNexis Freeze',
      reason: 'LexisNexis freeze not yet completed. This is a key data broker.',
      priority: 'Medium',
      source: 'LexisNexis',
    });
  }
  
  if (!hasCoreLogic) {
    recommendations.push({
      id: 'corelogic-freeze',
      title: 'Submit CoreLogic Freeze',
      reason: 'CoreLogic freeze not yet completed.',
      priority: 'Low',
      source: 'CoreLogic',
    });
  }
  
  if (!hasInnovis) {
    recommendations.push({
      id: 'innovis-freeze',
      title: 'Submit Innovis Freeze',
      reason: 'Innovis freeze not yet completed.',
      priority: 'Low',
      source: 'Innovis',
    });
  }
  
  // Rule 2 & 3: CRA dispute escalation based on responses
  for (const source of CRA_SOURCES) {
    const disputes = disputesBySource.get(source) || [];
    const responses = responsesBySource.get(source) || [];
    
    if (disputes.length === 0) continue;
    
    // Check for problematic responses
    for (const response of responses) {
      const summaryLower = (response.summary || '').toLowerCase();
      const detailsLower = (response.details || '').toLowerCase();
      const fullText = summaryLower + ' ' + detailsLower;
      
      const hasVerified = fullText.includes('verified') || fullText.includes('verified as accurate');
      const hasUpdated = fullText.includes('updated');
      const hasInsufficient = fullText.includes('insufficient') || fullText.includes('incomplete');
      const hasReinserted = fullText.includes('reinserted') || fullText.includes('re-inserted');
      
      if (hasReinserted) {
        // Rule 3: Reinsertion escalation
        recommendations.push({
          id: `reinsertion-escalation-${source}`,
          title: `Send Reinsertion Dispute + CFPB Escalation (${source})`,
          reason: `${source} reinserted previously deleted items. This is a potential FCRA violation.`,
          priority: 'High',
          source,
        });
      } else if (hasVerified || hasUpdated || hasInsufficient) {
        // Rule 2: CFPB complaint for unsatisfactory response
        recommendations.push({
          id: `cfpb-complaint-${source}`,
          title: `File CFPB Complaint (${source})`,
          reason: `${source} responded with "${hasVerified ? 'verified' : hasUpdated ? 'updated' : 'insufficient investigation'}". Consider CFPB escalation.`,
          priority: 'High',
          source: 'CFPB',
        });
      }
    }
    
    // Check for disputes older than 35 days without resolution
    for (const dispute of disputes) {
      const disputeDate = new Date(dispute.event_date);
      const daysSinceDispute = differenceInDays(today, disputeDate);
      
      if (daysSinceDispute > 35) {
        // Check if there's a satisfactory response
        const hasPositiveResponse = responses.some(r => {
          const text = (r.summary || '').toLowerCase();
          return text.includes('deleted') || text.includes('removed');
        });
        
        if (!hasPositiveResponse) {
          recommendations.push({
            id: `cfpb-35day-${source}-${dispute.id}`,
            title: `File CFPB Complaint - 35 Day Violation (${source})`,
            reason: `Dispute filed ${daysSinceDispute} days ago with no resolution. CRAs must investigate within 30 days.`,
            priority: 'High',
            source: 'CFPB',
          });
        }
      }
    }
  }
  
  // Deduplicate recommendations by id
  const seen = new Set<string>();
  const unique: Recommendation[] = [];
  
  for (const rec of recommendations) {
    if (!seen.has(rec.id)) {
      seen.add(rec.id);
      unique.push(rec);
    }
  }
  
  // Sort by priority
  const priorityOrder: Record<SimplePriority, number> = { High: 0, Medium: 1, Low: 2 };
  unique.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return unique;
}
