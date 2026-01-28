import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCase } from '@/hooks/useCases';
import { 
  useCompletedActions, 
  useResponseActions, 
  useToDoActions, 
  useUpdateCaseAction,
  type ActionCategory 
} from '@/hooks/useCaseActions';
import { AddEntryDialog } from '@/components/cases/AddEntryDialog';
import { format } from 'date-fns';
import { ArrowLeft, Loader2, Plus, Check, Calendar as CalendarIcon } from 'lucide-react';

export default function CaseSummary() {
  const { caseId } = useParams<{ caseId: string }>();
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [addEntryCategory, setAddEntryCategory] = useState<ActionCategory>('Completed');

  const { data: caseData, isLoading: caseLoading } = useCase(caseId);
  const { data: completedActions = [] } = useCompletedActions(caseId);
  const { data: responseActions = [] } = useResponseActions(caseId);
  const { data: todoActions = [] } = useToDoActions(caseId);
  const updateAction = useUpdateCaseAction();

  const handleMarkDone = (actionId: string) => {
    if (!caseId) return;
    updateAction.mutate({ id: actionId, caseId, status: 'Done' });
  };

  const openAddEntry = (category: ActionCategory) => {
    setAddEntryCategory(category);
    setAddEntryOpen(true);
  };

  if (caseLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Case not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/cases">Back to Cases</Link>
        </Button>
      </div>
    );
  }

  const clientName = caseData.client?.preferred_name || caseData.client?.legal_name || 'Unknown';
  const clientStatus = caseData.client?.status || 'Active';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/cases">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Cases
          </Link>
        </Button>
      </div>

      {/* 1. CLIENT HEADER */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{clientName}</h1>
              <p className="text-sm text-muted-foreground font-mono mt-1">
                Case ID: {caseId?.slice(0, 8)}
              </p>
            </div>
            <div className="text-right space-y-2">
              <Badge variant={clientStatus === 'Active' ? 'default' : clientStatus === 'Pending' ? 'secondary' : 'outline'}>
                {clientStatus}
              </Badge>
              <p className="text-xs text-muted-foreground">
                Updated {format(new Date(caseData.updated_at), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. COMPLETED (Itemized Table) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Completed</CardTitle>
          <Button size="sm" variant="outline" onClick={() => openAddEntry('Completed')}>
            <Plus className="h-4 w-4 mr-1" />
            Add Entry
          </Button>
        </CardHeader>
        <CardContent>
          {completedActions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No completed actions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Completed Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedActions.map(action => (
                  <TableRow key={action.id}>
                    <TableCell className="font-medium">{action.title}</TableCell>
                    <TableCell>{format(new Date(action.event_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">
                      {action.details || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 3. DISPUTE RESPONSES (Log) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Dispute Responses</CardTitle>
          <Button size="sm" variant="outline" onClick={() => openAddEntry('Response')}>
            <Plus className="h-4 w-4 mr-1" />
            Add Entry
          </Button>
        </CardHeader>
        <CardContent>
          {responseActions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No dispute responses logged.</p>
          ) : (
            <div className="space-y-4">
              {responseActions.map(action => (
                <div key={action.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-medium">{action.related_entity || 'Unknown Bureau'}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {format(new Date(action.event_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{action.title}</p>
                  {action.details && (
                    <p className="text-sm">{action.details}</p>
                  )}
                  {(action.related_account || action.related_account_masked) && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Account: {action.related_account} {action.related_account_masked && `(${action.related_account_masked})`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. SUGGESTED TO DO (Task List) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Suggested To Do</CardTitle>
          <Button size="sm" variant="outline" onClick={() => openAddEntry('ToDo')}>
            <Plus className="h-4 w-4 mr-1" />
            Add Entry
          </Button>
        </CardHeader>
        <CardContent>
          {todoActions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No pending tasks.</p>
          ) : (
            <div className="space-y-3">
              {todoActions.map(action => (
                <div key={action.id} className="flex items-center justify-between border rounded-lg p-4">
                  <div className="flex-1">
                    <p className="font-medium">{action.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {action.due_date && (
                        <span className="text-sm text-muted-foreground">
                          Due: {format(new Date(action.due_date), 'MMM d, yyyy')}
                        </span>
                      )}
                      {action.priority && (
                        <Badge 
                          variant={action.priority === 'High' ? 'destructive' : action.priority === 'Medium' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {action.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled>
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      Add to Calendar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => handleMarkDone(action.id)}
                      disabled={updateAction.isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Mark Done
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Entry Dialog */}
      <AddEntryDialog
        open={addEntryOpen}
        onOpenChange={setAddEntryOpen}
        caseId={caseId!}
        defaultCategory={addEntryCategory}
      />
    </div>
  );
}
