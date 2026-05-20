import Registration from '../models/Registration.js';
import Seminar from '../models/Seminar.js';
import Employee from '../models/Employee.js';
import { sendSeminarReminderEmail } from './emailService.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const TICK_INTERVAL_MS = HOUR; // run every hour

// Pick the relevant date for a registration:
//  - multi-session "pick-one" seminars: use chosenSessionId's date
//  - everything else: the next upcoming session date, or seminar.date
const resolveTargetSession = (seminar, registration) => {
  const sessions = Array.isArray(seminar.sessions) ? seminar.sessions : [];
  if (sessions.length > 0) {
    if (seminar.multiSessionType === 'pick-one' && registration.chosenSessionId) {
      const chosen = sessions.find(
        (s) => String(s._id) === String(registration.chosenSessionId)
      );
      if (chosen) return { date: chosen.date, startTime: chosen.startTime };
    }
    // Otherwise, find the next upcoming session that hasn't been held
    const now = Date.now();
    const upcoming = sessions
      .filter((s) => !s.isHeld && s.date && new Date(s.date).getTime() > now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    if (upcoming) return { date: upcoming.date, startTime: upcoming.startTime };
  }
  return { date: seminar.date, startTime: seminar.startTime };
};

export const runReminderTick = async () => {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * HOUR);
  const windowEnd = new Date(now.getTime() + 25 * HOUR);

  // Candidate seminars: have a session/date inside [now+23h, now+25h]
  const seminars = await Seminar.find({
    isDeleted: { $ne: true },
    isHeld: { $ne: true },
    $or: [
      { date: { $gte: windowStart, $lte: windowEnd } },
      { 'sessions.date': { $gte: windowStart, $lte: windowEnd } },
    ],
  }).lean();

  if (seminars.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  const seminarIds = seminars.map((s) => s._id);
  const seminarMap = new Map(seminars.map((s) => [String(s._id), s]));

  const registrations = await Registration.find({
    seminarID: { $in: seminarIds },
    status: { $in: ['pre-registered', 'registered'] },
    reminderSentAt: null,
  });

  if (registrations.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  const employeeIds = [...new Set(registrations.map((r) => String(r.employeeID)))];
  const employees = await Employee.find({ _id: { $in: employeeIds } }).lean();
  const empMap = new Map(employees.map((e) => [String(e._id), e]));

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const reg of registrations) {
    const seminar = seminarMap.get(String(reg.seminarID));
    const employee = empMap.get(String(reg.employeeID));
    if (!seminar || !employee || !employee.email) {
      skipped += 1;
      continue;
    }
    if (employee.accountStatus === 'deactivated') {
      skipped += 1;
      continue;
    }

    const target = resolveTargetSession(seminar, reg);
    if (!target.date) {
      skipped += 1;
      continue;
    }

    const targetTime = new Date(target.date).getTime();
    const diff = targetTime - now.getTime();
    if (diff < 23 * HOUR || diff > 25 * HOUR) {
      // The registration's actual target session is not within the T-1 window
      // (e.g. a multi-session seminar where this employee picked a later date).
      skipped += 1;
      continue;
    }

    try {
      await sendSeminarReminderEmail({
        employee,
        seminar,
        sessionDate: target.date,
        sessionStartTime: target.startTime,
      });
      reg.reminderSentAt = new Date();
      reg.reminderTargetDate = new Date(target.date);
      await reg.save();
      sent += 1;
    } catch (err) {
      console.error(`[reminder] failed for ${employee.email}:`, err.message);
      failed += 1;
    }
  }

  return { sent, skipped, failed };
};

let intervalHandle = null;

export const startReminderScheduler = () => {
  if (intervalHandle) return;

  // Run once shortly after boot so we don't miss anything if the server
  // restarted right inside the T-1 window.
  setTimeout(() => {
    runReminderTick()
      .then((r) => console.log(`[reminder] boot tick:`, r))
      .catch((err) => console.error('[reminder] boot tick error:', err));
  }, 30 * 1000);

  intervalHandle = setInterval(() => {
    runReminderTick()
      .then((r) => {
        if (r.sent > 0 || r.failed > 0) {
          console.log(`[reminder] tick:`, r);
        }
      })
      .catch((err) => console.error('[reminder] tick error:', err));
  }, TICK_INTERVAL_MS);
};

export const stopReminderScheduler = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};
