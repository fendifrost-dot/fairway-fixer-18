/**
 * Unresolved State Panel
 * 
 * Displays unresolved items grouped by source (fixed sections)
 * Within each: bucket by item_type (Accounts, Inquiries, Personal IDs, Addresses, Employment, Other)
 * Sorting: last_noted_date newest->oldest, null last
 * 
 * Shows ONLY event_date/last_noted_date; never shows imported/created timestamps.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertCircle, Building2, FileQuestion, User, MapPin, Briefcase, HelpCircle } from 'lucide-react';
import { UnresolvedItem, NormalizedSource, UnresolvedItemType } from '@/types/parser';
import { getSourceDisplayName, SOURCE_CATEGORIES } from '@/lib/parser/sourceNormalizer';
import { format, parseISO } from 'date-fns';

interface UnresolvedStatePanelProps {
  items: UnresolvedItem[];
}

// Fixed source order for display
const SOURCE_ORDER: (NormalizedSource | 'all_cras')[] = [
  'experian',
  'transunion', 
  'equifax',
  'innovis',
  'lexisnexis',
  'sagestream',
  'corelogic',
  'ftc',
  'cfpb',
  'bbb',
  'ag',
];

// Item type display config
const ITEM_TYPE_CONFIG: Record<UnresolvedItemType, { label: string; icon: React.ElementType }> = {
  account: { label: 'Accounts', icon: Building2 },
  inquiry: { label: 'Inquiries', icon: FileQuestion },
  personal_identifier: { label: 'Personal Identifiers', icon: User },
  address: { label: 'Addresses', icon: MapPin },
  employment: { label: 'Employment', icon: Briefcase },
  other: { label: 'Other', icon: HelpCircle },
};

const ITEM_TYPE_ORDER: UnresolvedItemType[] = [
  'account',
  'inquiry', 
  'personal_identifier',
  'address',
  'employment',
  'other',
];

/**
 * Sort items by last_noted_date (newest first, null last)
 */
function sortByDate(items: UnresolvedItem[]): UnresolvedItem[] {
  return [...items].sort((a, b) => {
    if (!a.last_noted_date && !b.last_noted_date) return 0;
    if (!a.last_noted_date) return 1;
    if (!b.last_noted_date) return -1;
    return b.last_noted_date.localeCompare(a.last_noted_date);
  });
}

/**
 * Group items by source
 */
function groupBySource(items: UnresolvedItem[]): Map<NormalizedSource | 'all_cras', UnresolvedItem[]> {
  const groups = new Map<NormalizedSource | 'all_cras', UnresolvedItem[]>();
  
  for (const item of items) {
    if (item.source_scope === 'all_cras') {
      // all_cras items appear under each CRA section with badge
      for (const cra of SOURCE_CATEGORIES.credit_bureaus.slice(0, 3)) {
        const existing = groups.get(cra) || [];
        groups.set(cra, [...existing, item]);
      }
    } else if (item.source) {
      const existing = groups.get(item.source) || [];
      groups.set(item.source, [...existing, item]);
    }
  }
  
  return groups;
}

/**
 * Group items by item_type within a source group
 */
function groupByItemType(items: UnresolvedItem[]): Map<UnresolvedItemType, UnresolvedItem[]> {
  const groups = new Map<UnresolvedItemType, UnresolvedItem[]>();
  
  for (const item of items) {
    const existing = groups.get(item.item_type) || [];
    groups.set(item.item_type, [...existing, item]);
  }
  
  return groups;
}

function formatDate(dateStr: string | null, isUnknown: boolean): string {
  if (isUnknown || !dateStr) return 'Date unknown';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return 'Date unknown';
  }
}

export function UnresolvedStatePanel({ items }: UnresolvedStatePanelProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Unresolved State
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No unresolved items</p>
        </CardContent>
      </Card>
    );
  }
  
  const groupedBySource = groupBySource(items);
  
  // Only show sources that have items
  const activeSources = SOURCE_ORDER.filter(s => groupedBySource.has(s));
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Unresolved State
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="multiple" className="w-full">
          {activeSources.map(sourceKey => {
            const sourceItems = groupedBySource.get(sourceKey) || [];
            if (sourceItems.length === 0) return null;
            
            const displayName = sourceKey === 'all_cras' 
              ? 'All CRAs' 
              : getSourceDisplayName(sourceKey);
            
            const byItemType = groupByItemType(sourceItems);
            
            return (
              <AccordionItem key={sourceKey} value={sourceKey} className="border-b last:border-b-0">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                  <div className="flex items-center justify-between w-full pr-2">
                    <span className="font-medium">{displayName}</span>
                    <Badge variant="outline" className="text-xs">
                      {sourceItems.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <div className="space-y-3">
                    {ITEM_TYPE_ORDER.map(itemType => {
                      const typeItems = byItemType.get(itemType);
                      if (!typeItems || typeItems.length === 0) return null;
                      
                      const config = ITEM_TYPE_CONFIG[itemType];
                      const Icon = config.icon;
                      const sortedItems = sortByDate(typeItems);
                      
                      return (
                        <div key={itemType} className="space-y-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </div>
                          <div className="space-y-1 pl-5">
                            {sortedItems.map((item, idx) => (
                              <div 
                                key={idx} 
                                className="text-sm p-2 bg-muted/30 rounded-md border border-border/50"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {item.counterparty && (
                                        <span className="font-medium">{item.counterparty}</span>
                                      )}
                                      {item.account_ref && (
                                        <span className="text-muted-foreground">({item.account_ref})</span>
                                      )}
                                      {item.source_scope === 'all_cras' && (
                                        <Badge variant="secondary" className="text-xs">All CRAs</Badge>
                                      )}
                                    </div>
                                    <div className="text-muted-foreground text-xs mt-1">
                                      {item.description}
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <Badge 
                                      variant={item.status.toLowerCase().includes('disputed') ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {item.status}
                                    </Badge>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {formatDate(item.last_noted_date, item.date_is_unknown)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
