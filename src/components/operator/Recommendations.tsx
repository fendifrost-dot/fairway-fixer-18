import { Recommendation, EventSource } from '@/types/operator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Plus } from 'lucide-react';
import { useCreateOperatorTask } from '@/hooks/useOperatorTasks';
import { addDays, format } from 'date-fns';

interface RecommendationsProps {
  recommendations: Recommendation[];
  clientId: string;
}

export function Recommendations({ recommendations, clientId }: RecommendationsProps) {
  const createTask = useCreateOperatorTask();
  
  const handleCreateTask = (rec: Recommendation) => {
    const dueDate = format(addDays(new Date(), rec.priority === 'High' ? 3 : rec.priority === 'Medium' ? 7 : 14), 'yyyy-MM-dd');
    
    createTask.mutate({
      client_id: clientId,
      title: rec.title,
      due_date: dueDate,
      due_time: null,
      notes: null,
      linked_event_ids: [],
      recurrence_rule: null,
      priority: rec.priority,
      status: 'Open',
    });
  };
  
  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No recommendations at this time. Add more timeline events to get suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          Recommendations ({recommendations.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map(rec => (
          <div key={rec.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge 
                  variant={rec.priority === 'High' ? 'destructive' : rec.priority === 'Medium' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {rec.priority}
                </Badge>
                {rec.source && (
                  <Badge variant="outline" className="text-xs">
                    {rec.source}
                  </Badge>
                )}
              </div>
              <p className="font-medium text-sm">{rec.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{rec.reason}</p>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleCreateTask(rec)}
              disabled={createTask.isPending}
            >
              <Plus className="h-3 w-3 mr-1" />
              Create Task
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
