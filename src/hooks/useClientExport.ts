import { supabase } from '@/integrations/supabase/client';

/**
 * Export client data as a JSON snapshot for backup before deletion.
 * Includes: client, matters, timeline_events, operator_tasks, baseline_analyses.
 * Does NOT include raw file blobs (storage objects) — only metadata.
 */
export async function exportClientSnapshot(clientId: string): Promise<boolean> {
  const [clientRes, mattersRes, eventsRes, tasksRes, baselinesRes] =
    await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('matters').select('*').eq('client_id', clientId),
      supabase.from('timeline_events').select('*').eq('client_id', clientId),
      supabase.from('operator_tasks').select('*').eq('client_id', clientId),
      supabase.from('baseline_analyses').select('*').eq('client_id', clientId),
    ]);

  if (clientRes.error) throw clientRes.error;

  const snapshot = {
    _export_version: 1,
    _exported_at: new Date().toISOString(),
    _warning:
      'This export is a point-in-time snapshot. It does not include storage objects or file blobs.',
    client: clientRes.data,
    matters: mattersRes.data || [],
    timeline_events: eventsRes.data || [],
    operator_tasks: tasksRes.data || [],
    baseline_analyses: baselinesRes.data || [],
  };

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `client-export-${clientId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return true;
}
