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

function normalizeBucketRow(bucket = {}) {
  return {
    bucketId: bucket.bucketId || bucket.name || bucket.id || 'bucket',
    files: Number(bucket.files || 0),
    bytes: Number(bucket.bytes || 0),
  };
}

async function listBucketFilesRecursive(bucketName, path = '') {
  const output = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(path, {
        limit,
        offset,
        sortBy: {
          column: 'name',
          order: 'asc',
        },
      });

    if (error) {
      throw error;
    }

    const items = Array.isArray(data) ? data : [];

    for (const item of items) {
      const itemPath = path ? `${path}/${item.name}` : item.name;

      const isFolder =
        !item.id &&
        !item.metadata &&
        !item.updated_at &&
        !item.created_at;

      if (isFolder) {
        const nestedFiles = await listBucketFilesRecursive(bucketName, itemPath);
        output.push(...nestedFiles);
      } else {
        output.push({
          name: item.name,
          path: itemPath,
          size: Number(item.metadata?.size || 0),
          updatedAt: item.updated_at || null,
          createdAt: item.created_at || null,
        });
      }
    }

    if (items.length < limit) break;

    offset += limit;
  }

  return output;
}

async function getStorageUsageDirectly() {
  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    throw error;
  }

  const bucketRows = [];

  for (const bucket of buckets || []) {
    try {
      const files = await listBucketFilesRecursive(bucket.name);
      const bytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);

      bucketRows.push({
        bucketId: bucket.name,
        files: files.length,
        bytes,
      });
    } catch (bucketError) {
      console.warn(`Impossibile leggere il bucket ${bucket.name}:`, bucketError);

      bucketRows.push({
        bucketId: bucket.name,
        files: 0,
        bytes: 0,
        error: bucketError.message || 'Errore lettura bucket',
      });
    }
  }

  return {
    buckets: bucketRows,
    storageBytes: bucketRows.reduce((sum, bucket) => sum + Number(bucket.bytes || 0), 0),
  };
}

export async function getSupabaseUsageMonitor() {
  let rpcUsage = null;
  let rpcError = null;

  try {
    const { data, error } = await supabase.rpc('get_supabase_usage_monitor');

    if (error) {
      throw error;
    }

    rpcUsage = {
      databaseBytes: Number(data?.databaseBytes || 0),
      storageBytes: Number(data?.storageBytes || 0),
      totalBytes: Number(data?.totalBytes || 0),
      tables: Array.isArray(data?.tables) ? data.tables : [],
      buckets: Array.isArray(data?.buckets) ? data.buckets.map(normalizeBucketRow) : [],
      updatedAt: data?.updatedAt || null,
    };
  } catch (err) {
    console.warn('Funzione SQL memoria Supabase non disponibile o non aggiornata:', err);
    rpcError = err;
  }

  let directStorage = null;
  let directStorageError = null;

  try {
    directStorage = await getStorageUsageDirectly();
  } catch (err) {
    console.warn('Lettura diretta Supabase Storage non riuscita:', err);
    directStorageError = err;
  }

  if (!rpcUsage && !directStorage) {
    throw new Error(
      rpcError?.message ||
        directStorageError?.message ||
        'Errore lettura memoria Supabase.'
    );
  }

  const databaseBytes = Number(rpcUsage?.databaseBytes || 0);

  const storageBytes =
    directStorage
      ? Number(directStorage.storageBytes || 0)
      : Number(rpcUsage?.storageBytes || 0);

  const buckets =
    directStorage?.buckets?.length
      ? directStorage.buckets
      : Array.isArray(rpcUsage?.buckets)
        ? rpcUsage.buckets
        : [];

  const tables = Array.isArray(rpcUsage?.tables) ? rpcUsage.tables : [];

  return {
    databaseBytes,
    storageBytes,
    totalBytes: databaseBytes + storageBytes,
    tables,
    buckets,
    updatedAt: new Date().toISOString(),
  };
}