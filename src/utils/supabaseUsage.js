import { supabase } from '../supabaseClient';

export function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;

  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function calcPercent(usedBytes = 0, limitBytes = 500 * 1024 * 1024) {
  const used = Number(usedBytes || 0);
  const limit = Number(limitBytes || 1);

  return Math.min(100, Math.round((used / limit) * 100));
}

export async function getSupabaseUsageMonitor() {
  const { data, error } = await supabase.rpc('get_supabase_usage_monitor');

  if (error) {
    throw new Error(error.message || 'Errore lettura memoria Supabase.');
  }

  return {
    databaseBytes: Number(data?.databaseBytes || 0),
    storageBytes: Number(data?.storageBytes || 0),
    totalBytes: Number(data?.totalBytes || 0),
    tables: Array.isArray(data?.tables) ? data.tables : [],
    buckets: Array.isArray(data?.buckets) ? data.buckets : [],
    updatedAt: data?.updatedAt || null,
  };
}