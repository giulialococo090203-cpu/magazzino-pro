import { supabase } from '../supabaseClient';

const DEFAULT_LIMIT_BYTES = 500 * 1024 * 1024;
const KNOWN_BUCKETS = ['fatture'];

export function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;

  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function calcPercent(usedBytes = 0, limitBytes = DEFAULT_LIMIT_BYTES) {
  const used = Number(usedBytes || 0);
  const limit = Number(limitBytes || 1);

  return Math.min(100, Math.round((used / limit) * 100));
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeBucketRow(bucket = {}) {
  return {
    bucketId:
      bucket.bucketId ||
      bucket.bucket_id ||
      bucket.name ||
      bucket.id ||
      'bucket',
    files: toNumber(bucket.files || bucket.fileCount || bucket.file_count),
    bytes: toNumber(bucket.bytes || bucket.size || bucket.totalBytes || bucket.total_bytes),
    error: bucket.error || '',
  };
}

function normalizeTableRow(table = {}) {
  return {
    tableName:
      table.tableName ||
      table.table_name ||
      table.name ||
      'tabella',
    bytes: toNumber(table.bytes || table.size || table.totalBytes || table.total_bytes),
  };
}

function normalizeRpcUsage(data) {
  const raw = Array.isArray(data) ? data[0] : data;

  if (!raw || typeof raw !== 'object') return null;

  const databaseBytes = toNumber(
    raw.databaseBytes ||
      raw.database_bytes ||
      raw.dbBytes ||
      raw.db_bytes
  );

  const storageBytes = toNumber(
    raw.storageBytes ||
      raw.storage_bytes
  );

  const totalBytes = toNumber(
    raw.totalBytes ||
      raw.total_bytes ||
      databaseBytes + storageBytes
  );

  const tables = Array.isArray(raw.tables)
    ? raw.tables.map(normalizeTableRow)
    : [];

  const buckets = Array.isArray(raw.buckets)
    ? raw.buckets.map(normalizeBucketRow)
    : [];

  return {
    databaseBytes,
    storageBytes,
    totalBytes,
    tables,
    buckets,
    updatedAt:
      raw.updatedAt ||
      raw.updated_at ||
      raw.generatedAt ||
      raw.generated_at ||
      null,
  };
}

function isFolderItem(item = {}) {
  const hasMetadataSize = item?.metadata && item.metadata.size !== undefined;
  const hasFileId = Boolean(item?.id);

  if (hasMetadataSize || hasFileId) return false;

  return true;
}

async function listBucketFilesRecursive(bucketName, path = '') {
  const output = [];
  const limit = 100;
  let offset = 0;

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
      if (!item?.name) continue;

      const itemPath = path ? `${path}/${item.name}` : item.name;

      if (isFolderItem(item)) {
        const nested = await listBucketFilesRecursive(bucketName, itemPath);
        output.push(...nested);
      } else {
        output.push({
          name: item.name,
          path: itemPath,
          size: toNumber(item.metadata?.size),
          updatedAt: item.updated_at || item.updatedAt || null,
          createdAt: item.created_at || item.createdAt || null,
        });
      }
    }

    if (items.length < limit) break;

    offset += limit;
  }

  return output;
}

async function getAvailableBuckets() {
  try {
    const { data, error } = await supabase.storage.listBuckets();

    if (error) throw error;

    const names = (Array.isArray(data) ? data : [])
      .map((bucket) => bucket?.name || bucket?.id)
      .filter(Boolean);

    const merged = [...new Set([...names, ...KNOWN_BUCKETS])];

    return merged;
  } catch (err) {
    console.warn('Lista bucket non leggibile, uso bucket noti:', err);
    return [...KNOWN_BUCKETS];
  }
}

async function getStorageUsageDirectly() {
  const bucketNames = await getAvailableBuckets();
  const bucketRows = [];

  for (const bucketName of bucketNames) {
    try {
      const files = await listBucketFilesRecursive(bucketName);
      const bytes = files.reduce((sum, file) => sum + toNumber(file.size), 0);

      bucketRows.push({
        bucketId: bucketName,
        files: files.length,
        bytes,
        error: '',
      });
    } catch (err) {
      console.warn(`Impossibile leggere il bucket ${bucketName}:`, err);

      bucketRows.push({
        bucketId: bucketName,
        files: 0,
        bytes: 0,
        error: err?.message || 'Errore lettura bucket',
      });
    }
  }

  return {
    buckets: bucketRows,
    storageBytes: bucketRows.reduce((sum, bucket) => sum + toNumber(bucket.bytes), 0),
  };
}

async function getRpcUsage() {
  const { data, error } = await supabase.rpc('get_supabase_usage_monitor');

  if (error) throw error;

  return normalizeRpcUsage(data);
}

export async function getSupabaseUsageMonitor() {
  let rpcUsage = null;
  let rpcError = null;

  try {
    rpcUsage = await getRpcUsage();
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

  const databaseBytes = toNumber(rpcUsage?.databaseBytes);

  const storageBytes = directStorage
    ? toNumber(directStorage.storageBytes)
    : toNumber(rpcUsage?.storageBytes);

  const buckets =
    directStorage?.buckets?.length > 0
      ? directStorage.buckets.map(normalizeBucketRow)
      : Array.isArray(rpcUsage?.buckets)
        ? rpcUsage.buckets.map(normalizeBucketRow)
        : [];

  const tables = Array.isArray(rpcUsage?.tables)
    ? rpcUsage.tables.map(normalizeTableRow)
    : [];

  return {
    databaseBytes,
    storageBytes,
    totalBytes: databaseBytes + storageBytes,
    tables,
    buckets,
    updatedAt: new Date().toISOString(),
  };
}

export default {
  formatBytes,
  calcPercent,
  getSupabaseUsageMonitor,
};