// In-Atlas backup database service.
//
// Maintains a "gims-backup" database inside the SAME cluster as production
// ("gims"). One-click snapshot + restore for admins. No external services,
// no credentials, no tokens. Blast radius is the same Atlas account/cluster
// — this protects against accidental deletes/imports/bugs, not Atlas-level
// disasters.
//
// Collections are batch-copied via the native Mongo driver (insertMany)
// for speed, but Mongoose owns the connection.

import mongoose from 'mongoose';

const BACKUP_DB_NAME = process.env.BACKUP_DB_NAME || 'gims-backup';
const META_COLLECTION = '_snapshot_meta';
const BATCH_SIZE = 500;

const getProductionDb = () => mongoose.connection.useDb(undefined, { useCache: false });
const getBackupDb = () => mongoose.connection.useDb(BACKUP_DB_NAME, { useCache: true });

const listProductionCollections = async () => {
  const db = mongoose.connection.db;
  const colls = await db.listCollections({}, { nameOnly: false }).toArray();
  // Skip system collections and the meta collection itself if present.
  return colls
    .filter((c) => c.type === 'collection' && !c.name.startsWith('system.'))
    .map((c) => c.name);
};

const copyCollection = async (sourceDb, targetDb, name) => {
  const source = sourceDb.collection(name);
  const target = targetDb.collection(name);

  // Drop existing target so the snapshot reflects current state exactly.
  try {
    await target.drop();
  } catch (err) {
    // 26 = namespace not found (collection doesn't exist yet). Anything else: rethrow.
    if (err?.code !== 26) throw err;
  }

  let copied = 0;
  const cursor = source.find({}, { noCursorTimeout: false });
  let batch = [];
  // eslint-disable-next-line no-restricted-syntax
  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await target.insertMany(batch, { ordered: false });
      copied += batch.length;
      batch = [];
    }
  }
  if (batch.length) {
    await target.insertMany(batch, { ordered: false });
    copied += batch.length;
  }
  return copied;
};

const writeMeta = async (targetDb, payload) => {
  const meta = targetDb.collection(META_COLLECTION);
  await meta.deleteMany({});
  await meta.insertOne(payload);
};

/**
 * Copy every collection from production (gims) into the backup database
 * (gims-backup). Returns { collections, totalDocs, startedAt, finishedAt }.
 */
export const runSnapshot = async ({ triggeredBy } = {}) => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Mongo connection not ready');
  }

  const startedAt = new Date();
  const productionDb = mongoose.connection.db;
  const backupConn = getBackupDb();
  const backupDb = backupConn.db;

  const collectionNames = await listProductionCollections();

  const perCollection = [];
  let totalDocs = 0;
  for (const name of collectionNames) {
    const copied = await copyCollection(productionDb, backupDb, name);
    perCollection.push({ name, count: copied });
    totalDocs += copied;
  }

  const finishedAt = new Date();
  await writeMeta(backupDb, {
    snapshotAt: finishedAt,
    startedAt,
    finishedAt,
    totalDocs,
    collections: perCollection,
    triggeredBy: triggeredBy || 'scheduler',
  });

  return { startedAt, finishedAt, totalDocs, collections: perCollection };
};

/**
 * Copy every collection from gims-backup BACK into gims, replacing live data.
 * DESTRUCTIVE — caller must enforce phrase confirmation.
 */
export const restoreFromSnapshot = async ({ triggeredBy } = {}) => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Mongo connection not ready');
  }

  const startedAt = new Date();
  const productionDb = mongoose.connection.db;
  const backupConn = getBackupDb();
  const backupDb = backupConn.db;

  const allBackupColls = await backupDb.listCollections({}, { nameOnly: false }).toArray();
  const collectionNames = allBackupColls
    .filter((c) => c.type === 'collection' && c.name !== META_COLLECTION && !c.name.startsWith('system.'))
    .map((c) => c.name);

  if (!collectionNames.length) {
    throw new Error('No snapshot exists yet. Run "Snapshot Now" first.');
  }

  const perCollection = [];
  let totalDocs = 0;
  for (const name of collectionNames) {
    const copied = await copyCollection(backupDb, productionDb, name);
    perCollection.push({ name, count: copied });
    totalDocs += copied;
  }

  const finishedAt = new Date();
  return {
    startedAt,
    finishedAt,
    totalDocs,
    collections: perCollection,
    triggeredBy: triggeredBy || 'manual',
  };
};

/**
 * Read snapshot metadata so the admin dashboard can show
 * "Last snapshot: ... at HH:MM" with collection counts.
 */
export const getSnapshotStatus = async () => {
  if (mongoose.connection.readyState !== 1) {
    return { exists: false, ready: false };
  }
  try {
    const backupConn = getBackupDb();
    const backupDb = backupConn.db;
    const meta = await backupDb.collection(META_COLLECTION).findOne({});
    if (!meta) return { exists: false, ready: true };
    return {
      exists: true,
      ready: true,
      snapshotAt: meta.snapshotAt,
      totalDocs: meta.totalDocs,
      collections: meta.collections,
      triggeredBy: meta.triggeredBy,
    };
  } catch (err) {
    return { exists: false, ready: true, error: err.message };
  }
};

export const BACKUP_DATABASE_NAME = BACKUP_DB_NAME;
