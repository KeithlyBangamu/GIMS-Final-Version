// Daily database-snapshot scheduler.
//
// Runs once an hour. If the local time is the configured run-hour (default 02:00
// Manila / Philippine Time) and no snapshot has been taken in the last 23 hours,
// it triggers runSnapshot(). This is simpler than a real cron parser and stays
// resilient to server restarts (Render redeploys, etc.).

import MaintenanceLog from '../models/MaintenanceLog.js';
import { currentSchoolYear } from './schoolYearService.js';
import { runSnapshot, getSnapshotStatus } from './backupDatabaseService.js';

const HOUR_MS = 60 * 60 * 1000;
const TICK_INTERVAL_MS = HOUR_MS;
// PHT is UTC+8 with no DST.
const PHT_OFFSET_HOURS = 8;
const RUN_HOUR_PHT = Number(process.env.BACKUP_RUN_HOUR_PHT || 2); // 02:00 PHT default

const getCurrentHourPHT = () => {
  const nowUtc = new Date();
  const phtHour = (nowUtc.getUTCHours() + PHT_OFFSET_HOURS) % 24;
  return phtHour;
};

export const runBackupTick = async () => {
  try {
    if (getCurrentHourPHT() !== RUN_HOUR_PHT) {
      return { skipped: true, reason: 'not-run-hour' };
    }
    const status = await getSnapshotStatus();
    if (status?.snapshotAt) {
      const ageMs = Date.now() - new Date(status.snapshotAt).getTime();
      if (ageMs < 23 * HOUR_MS) {
        return { skipped: true, reason: 'already-snapshotted-today' };
      }
    }

    const result = await runSnapshot({ triggeredBy: 'scheduler' });

    try {
      await MaintenanceLog.create({
        action: 'snapshot-create',
        schoolYear: currentSchoolYear() || 'unknown',
        triggeredByName: 'scheduler',
        counts: {
          registrationsArchived: 0,
          seminarsArchived: 0,
          employeesAffected: 0,
          registrationsRestored: result.totalDocs,
          seminarsRestored: result.collections.length,
        },
        notes: `Automatic daily snapshot: ${result.totalDocs} docs across ${result.collections.length} collections.`,
      });
    } catch (logErr) {
      console.error('[backup] failed to write maintenance log:', logErr.message);
    }

    console.log(
      `[backup] daily snapshot complete: ${result.totalDocs} docs, ${result.collections.length} collections`
    );
    return { ran: true, ...result };
  } catch (err) {
    console.error('[backup] tick failed:', err.message);
    return { ran: false, error: err.message };
  }
};

let intervalHandle = null;

export const startBackupScheduler = () => {
  if (intervalHandle) return;

  // Run a soft check ~60s after boot. Won't actually snapshot unless we
  // happen to be in the run-hour and no snapshot has been made today.
  setTimeout(() => {
    runBackupTick().catch((err) =>
      console.error('[backup] boot tick error:', err.message)
    );
  }, 60 * 1000);

  intervalHandle = setInterval(() => {
    runBackupTick().catch((err) =>
      console.error('[backup] tick error:', err.message)
    );
  }, TICK_INTERVAL_MS);

  console.log(
    `[backup] scheduler started — will snapshot daily at ~${String(RUN_HOUR_PHT).padStart(2, '0')}:00 PHT`
  );
};

export const stopBackupScheduler = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};
