import { supabase } from '@/integrations/supabase/client';
import type { FunctionInvokeOptions } from '@supabase/supabase-js';

type InvokeBody = Record<string, unknown> | undefined;

function messageFromPayload(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (typeof row.error === 'string' && row.error.trim()) return row.error;
  if (typeof row.message === 'string' && row.message.trim()) return row.message;
  if (row.code === 'NOT_FOUND') {
    return 'Edge function is not deployed on this Supabase project.';
  }
  return null;
}

/**
 * Invoke a Supabase edge function and surface JSON error bodies (not just generic HTTP errors).
 */
export async function invokeEdgeFunction<T = Record<string, unknown>>(
  functionName: string,
  options?: FunctionInvokeOptions
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, options);

  const payloadMessage = messageFromPayload(data);
  if (payloadMessage) {
    throw new Error(payloadMessage);
  }

  if (error) {
    throw error;
  }

  return data as T;
}

export async function invokeEdgeFunctionWithBody<T = Record<string, unknown>>(
  functionName: string,
  body: InvokeBody
): Promise<T> {
  return invokeEdgeFunction<T>(functionName, { body });
}
