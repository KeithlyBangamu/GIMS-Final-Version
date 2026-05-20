// Google Drive backup uploader.
//
// Generates a full-database CSV (same format as the /weekly-export.csv route)
// and uploads it to a configured Drive folder using OAuth user credentials.
// Service accounts can't upload to personal Drive (no storage quota), so this
// uses a long-lived refresh token belonging to a real Google user.
//
// Required env:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REFRESH_TOKEN
//   DRIVE_BACKUP_FOLDER_ID           Drive folder ID (must be writable by
//                                    the user that authorized the token)
// Optional env:
//   DRIVE_BACKUP_RETENTION_DAYS      delete backups older than N days (default 30)
//
// To obtain the refresh token, run: node src/scripts/getDriveRefreshToken.js

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

let driveClientPromise = null;
const getDriveClient = () => {
  if (driveClientPromise) return driveClientPromise;
  driveClientPromise = (async () => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        'Missing Drive OAuth env vars: GOOGLE_OAUTH_CLIENT_ID, ' +
        'GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_REFRESH_TOKEN are required.'
      );
    }
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oauth2 });
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
