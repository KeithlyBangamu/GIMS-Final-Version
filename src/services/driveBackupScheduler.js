// Daily node-cron job that uploads a full-DB CSV backup to Google Drive.
//
// Env:
//   DRIVE_BACKUP_CRON      cron expression (default '0 2 * * *' — 02:00 daily)
//   DRIVE_BACKUP_TZ        timezone (default 'Asia/Manila')
//   DRIVE_BACKUP_ENABLED   set to 'false' to disable
//
// Skips silently if DRIVE_BACKUP_FOLDER_ID is missing, so dev environments
// without Drive credentials don't crash.

import cron from 'node-cron';
import MaintenanceLog from '../models/MaintenanceLog.js';
import { currentSchoolYear } from './schoolYearService.js';
import { uploadBackupToDrive, pruneOldBackups } from './driveBackupService.js';

let task = null;

export const runDriveBackupNow = async () => {
  const result = await uploadBackupToDrive();
  let pruned = { deleted: 0 };
  try {
    pruned = await pruneOldBackups();
  } catch (err) {
    console.error('[drive-backup] prune failed:', err.message);
  }

  try {
    await MaintenanceLog.create({
      action: 'drive-backup-upload',
      schoolYear: currentSchoolYear() || 'unknown',
      triggeredByName: 'scheduler',
      notes:
        `Uploaded ${result.filename} (${result.collectionCount} collections) ` +
        `to Google Drive. Pruned ${pruned.deleted} old backup(s).`,
    });
  } catch (logErr) {
    console.error('[drive-backup] log failed:', logErr.message);
  }

  console.log(
    `[drive-backup] uploaded ${result.filename} ` +
    `(${result.collectionCount} collections), pruned ${pruned.deleted}`
  );
  return { ...result, pruned: pruned.deleted };
};

export const startDriveBackupScheduler = () => {
  if (task) return;
  if (String(process.env.DRIVE_BACKUP_ENABLED || 'true').toLowerCase() === 'false') {
    console.log('[drive-backup] disabled via DRIVE_BACKUP_ENABLED=false');
    return;
  }
  if (
    !process.env.DRIVE_BACKUP_FOLDER_ID ||
    !process.env.GOOGLE_OAUTH_CLIENT_ID ||
    !process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  ) {
    console.log('[drive-backup] OAuth env vars or folder id missing — scheduler not started');
    return;
  }

  const expr = process.env.DRIVE_BACKUP_CRON || '0 2 * * *';
  const tz = process.env.DRIVE_BACKUP_TZ || 'Asia/Manila';

  if (!cron.validate(expr)) {
    console.error(`[drive-backup] invalid cron expression: ${expr}`);
    return;
  }

  task = cron.schedule(
    expr,
    () => {
      runDriveBackupNow().catch((err) =>
        console.error('[drive-backup] run failed:', err.message)
      );
    },
    { timezone: tz }
  );

  console.log(`[drive-backup] scheduler started — "${expr}" (${tz})`);
};

export const stopDriveBackupScheduler = () => {
  if (task) {
    task.stop();
    task = null;
  }
};
