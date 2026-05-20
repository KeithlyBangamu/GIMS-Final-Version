// Google Drive backup uploader.
//
// Generates a full-database CSV (same format as the /weekly-export.csv route)
// and uploads it to a configured Drive folder using a service-account key.
//
// Required env:
//   GOOGLE_SERVICE_ACCOUNT_KEY_PATH  absolute or project-relative path to JSON key
//   DRIVE_BACKUP_FOLDER_ID           Drive folder ID (must be shared with the
//                                    service-account email as Editor)
// Optional env:
//   DRIVE_BACKUP_RETENTION_DAYS      delete backups older than N days (default 30)

import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { Readable } from 'stream';
import mongoose from 'mongoose';

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  let s;
  if (typeof value === 'object') {
    try { s = JSON.stringify(value); } catch { s = String(value); }
  } else {
    s = String(value);
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const buildCsvForCollection = async (collName) => {
  const db = mongoose.connection.db;
  const coll = db.collection(collName);
  const docs = await coll.find({}).toArray();
  if (!docs.length) return `# ${collName} (0 rows)\r\n\r\n`;
  const colSet = new Set();
  for (const doc of docs) Object.keys(doc).forEach((k) => colSet.add(k));
  const cols = ['_id', ...Array.from(colSet).filter((c) => c !== '_id')];
  const lines = [];
  lines.push(`# ${collName} (${docs.length} rows)`);
  lines.push(cols.map(csvEscape).join(','));
  for (const doc of docs) {
    lines.push(cols.map((c) => csvEscape(doc[c])).join(','));
  }
  lines.push('');
  lines.push('');
  return lines.join('\r\n');
};

export const buildFullBackupCsv = async () => {
  const db = mongoose.connection.db;
  const allColls = await db.listCollections({}, { nameOnly: false }).toArray();
  const names = allColls
    .filter((c) => c.type === 'collection' && !c.name.startsWith('system.'))
    .map((c) => c.name)
    .sort();
  let body = '';
  body += `# GIMS Daily Backup\r\n`;
  body += `# Generated at: ${new Date().toISOString()}\r\n`;
  body += `# Collections: ${names.length}\r\n\r\n`;
  for (const name of names) {
    body += await buildCsvForCollection(name);
  }
  return { csv: body, collectionCount: names.length };
};

const resolveKeyPath = () => {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || 'gims-drive-key.json';
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
};

let driveClientPromise = null;
const getDriveClient = () => {
  if (driveClientPromise) return driveClientPromise;
  driveClientPromise = (async () => {
    const keyPath = resolveKeyPath();
    if (!fs.existsSync(keyPath)) {
      throw new Error(`Drive key file not found at ${keyPath}`);
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const authClient = await auth.getClient();
    return google.drive({ version: 'v3', auth: authClient });
  })().catch((err) => {
    driveClientPromise = null;
    throw err;
  });
  return driveClientPromise;
};

export const uploadBackupToDrive = async () => {
  const folderId = process.env.DRIVE_BACKUP_FOLDER_ID;
  if (!folderId) throw new Error('DRIVE_BACKUP_FOLDER_ID env var is not set');

  const drive = await getDriveClient();
  const { csv, collectionCount } = await buildFullBackupCsv();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `GIMS-Daily-Backup-${stamp}.csv`;

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: 'text/csv',
    },
    media: {
      mimeType: 'text/csv',
      body: Readable.from(csv),
    },
    fields: 'id, name, createdTime, size',
  });

  return {
    fileId: res.data.id,
    filename: res.data.name,
    createdTime: res.data.createdTime,
    size: res.data.size,
    collectionCount,
  };
};

export const getLatestDriveBackup = async () => {
  const folderId = process.env.DRIVE_BACKUP_FOLDER_ID;
  if (!folderId) return { configured: false };
  const drive = await getDriveClient();
  const list = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and name contains 'GIMS-Daily-Backup-'`,
    fields: 'files(id, name, createdTime, size, webViewLink)',
    orderBy: 'createdTime desc',
    pageSize: 1,
  });
  const file = (list.data.files || [])[0] || null;
  return {
    configured: true,
    folderId,
    latest: file
      ? {
          id: file.id,
          name: file.name,
          createdTime: file.createdTime,
          size: file.size,
          webViewLink: file.webViewLink,
        }
      : null,
  };
};

export const pruneOldBackups = async () => {
  const folderId = process.env.DRIVE_BACKUP_FOLDER_ID;
  if (!folderId) return { deleted: 0 };
  const retentionDays = Number(process.env.DRIVE_BACKUP_RETENTION_DAYS || 30);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return { deleted: 0 };

  const drive = await getDriveClient();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  const list = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and name contains 'GIMS-Daily-Backup-' and createdTime < '${cutoffIso}'`,
    fields: 'files(id, name, createdTime)',
    pageSize: 100,
  });

  const files = list.data.files || [];
  for (const f of files) {
    try {
      await drive.files.delete({ fileId: f.id });
    } catch (err) {
      console.error(`[drive-backup] failed to delete ${f.name}:`, err.message);
    }
  }
  return { deleted: files.length };
};
