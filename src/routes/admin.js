import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import Employee from '../models/Employee.js';
import Seminar from '../models/Seminar.js';
import Registration from '../models/Registration.js';
import Notification from '../models/Notification.js';
import LearningMaterial from '../models/LearningMaterial.js';
import Article from '../models/Article.js';
import Evaluation from '../models/Evaluation.js';
import { sendBulkReminders, sendReminderEmail } from '../services/emailService.js';
import User from '../models/User.js';
import {
  buildCertificateDownload,
  renderCertificateBuffer,
  issueCertificateForRegistration,
} from '../services/certificateService.js';
import { generateCHEDReport } from '../services/reportService.js';

const router = express.Router();

const ensureUploadsDir = () => {
  const dir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ensureUploadsDir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const materialsUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = ['.pdf', '.ppt', '.pptx'];
    const allowedMime = [
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    if (allowedExts.includes(ext) || allowedMime.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only PDF and PowerPoint (.ppt, .pptx) files are allowed.'));
  },
});


const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Missing Authorization header' });
  const token = header.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'gims-secret');
    if (payload.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const makeEmployeeDisplayId = (id) => {
  const tail = String(id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  return `EMP-${tail || '000000'}`;
};

const parseDateOnly = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeCertificateReleaseMode = ({ certificateReleaseMode, autoSendCertificates }) => {
  const mode = String(certificateReleaseMode || '').trim().toLowerCase();
  if (['manual', 'evaluation', 'automatic'].includes(mode)) return mode;
  return String(autoSendCertificates).toLowerCase() === 'true' ? 'automatic' : 'evaluation';
};

const SEMINAR_DELETE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const permanentlyDeleteSeminarsByIds = async (seminarIds) => {
  if (!Array.isArray(seminarIds) || seminarIds.length === 0) return;
  await Registration.deleteMany({ seminarID: { $in: seminarIds } });
  await Notification.deleteMany({ seminarID: { $in: seminarIds } });
  await Evaluation.deleteMany({ seminarID: { $in: seminarIds } });
  await Employee.updateMany(
    { seminarsAttended: { $in: seminarIds } },
    { $pull: { seminarsAttended: { $in: seminarIds } } }
  );
  await Seminar.deleteMany({ _id: { $in: seminarIds } });
};

const purgeExpiredDeletedSeminars = async () => {
  const now = new Date();
  const expired = await Seminar.find({
    isDeleted: true,
    deletePermanentlyAt: { $lte: now },
  })
    .select('_id')
    .lean();

  if (!expired.length) return;

  await permanentlyDeleteSeminarsByIds(expired.map((s) => s._id));
};

const findActiveSeminarById = (id) => {
  return Seminar.findOne({ _id: id, isDeleted: { $ne: true } });
};

const buildActiveSeminarIdSet = async () => {
  const activeSeminars = await Seminar.find({ isDeleted: { $ne: true } }).select('_id').lean();
  return new Set(activeSeminars.map((s) => String(s._id)));
};

const countActiveAttendedSeminars = (seminarIds, activeSeminarIdSet) => {
  if (!Array.isArray(seminarIds) || seminarIds.length === 0) return 0;
  const unique = new Set(seminarIds.map((id) => String(id)));
  let count = 0;
  unique.forEach((id) => {
    if (activeSeminarIdSet.has(id)) count += 1;
  });
  return count;
};

router.post('/seed-admin', async (req, res, next) => {
  try {
    const { name, email, password, birthSex } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (!password) return res.status(400).json({ message: 'Password is required' });

    const normalizedBirthSex = String(birthSex || '').trim();

    let employee = await Employee.findOne({ email: email.toLowerCase().trim() });
    if (!employee) {
      if (!normalizedBirthSex) {
        return res.status(400).json({ message: 'Birth Sex is required' });
      }
      employee = await Employee.create({
        name: name || 'GIMS Admin',
        email: email.toLowerCase().trim(),
        department: 'GAD Office',
        position: 'Administrator',
        birthSex: normalizedBirthSex,
        role: 'admin',
      });
    } else {
      employee.role = 'admin';
      if (normalizedBirthSex) employee.birthSex = normalizedBirthSex;
      await employee.save();
    }

    let user = await User.findOne({ username: email.toLowerCase().trim(), role: 'admin' });
    if (!user) {
      user = new User({
        username: email.toLowerCase().trim(),
        role: 'admin',
        passwordHash: '',
        employee: employee._id,
      });
    }
    user.employee = employee._id;
    await user.setPassword(password);
    await user.save();

    const token = jwt.sign(
      { id: employee._id, role: 'admin', email: employee.email },
      process.env.JWT_SECRET || 'gims-secret',
      { expiresIn: '8h' }
    );

    res.json({ token, employee });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({
      username: email.toLowerCase().trim(),
      role: 'admin',
    }).populate('employee');

    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }

    const employee = user.employee;
    const id = employee?._id || user._id;

    const token = jwt.sign(
      { id, role: 'admin', email: email.toLowerCase().trim() },
      process.env.JWT_SECRET || 'gims-secret',
      { expiresIn: '8h' }
    );

    res.json({ token });
  } catch (err) {
    next(err);
  }
});

// Lightweight badge counts shown on the admin sidebar (pending actions for
// seminars). The frontend polls this to render the unread-style dot.
router.get('/notifications/summary', authMiddleware, async (req, res, next) => {
  try {
    const pendingApprovals = await Registration.countDocuments({ status: 'pre-registered' });

    const seminars = await Seminar.find({ isDeleted: { $ne: true } })
      .select('isHeld sessions')
      .lean();
    const pendingFinalization = seminars.reduce((acc, s) => {
      const sessions = Array.isArray(s.sessions) ? s.sessions : [];
      const allHeld = sessions.length > 0 && sessions.every((sess) => sess.isHeld);
      return acc + (allHeld && !s.isHeld ? 1 : 0);
    }, 0);

    res.json({
      seminars: {
        pendingApprovals,
        pendingFinalization,
        total: pendingApprovals + pendingFinalization,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Aggregated notification bell feed for admins. Returns a small list of
// general-purpose items grouped by seminar (pre-registrations awaiting
// approval, evaluations submitted) so a single bell scales across many
// employees without one row per person.
router.get('/notifications/bell', authMiddleware, async (req, res, next) => {
  try {
    const seminars = await Seminar.find({ isDeleted: { $ne: true } })
      .select('title date')
      .lean();
    const seminarMap = new Map(seminars.map((s) => [String(s._id), s]));

    const pendingBySeminar = await Registration.aggregate([
      { $match: { status: 'pre-registered' } },
      { $group: { _id: '$seminarID', count: { $sum: 1 }, latest: { $max: '$registeredAt' } } },
    ]);

    const evalsBySeminar = await Evaluation.aggregate([
      { $group: { _id: '$seminarID', count: { $sum: 1 }, latest: { $max: '$submittedAt' } } },
    ]);

    const items = [];

    for (const row of pendingBySeminar) {
      const seminar = seminarMap.get(String(row._id));
      if (!seminar) continue;
      const count = Number(row.count || 0);
      if (count <= 0) continue;
      items.push({
        type: 'pre-registration',
        seminarId: String(row._id),
        seminarTitle: seminar.title || 'Untitled Seminar',
        count,
        message:
          count === 1
            ? `1 employee pre-registered for "${seminar.title}" — review and approve.`
            : `${count} employees pre-registered for "${seminar.title}" — review and approve.`,
        timestamp: row.latest || new Date(),
      });
    }

    for (const row of evalsBySeminar) {
      const seminar = seminarMap.get(String(row._id));
      if (!seminar) continue;
      const count = Number(row.count || 0);
      if (count <= 0) continue;
      items.push({
        type: 'evaluation',
        seminarId: String(row._id),
        seminarTitle: seminar.title || 'Untitled Seminar',
        count,
        message:
          count === 1
            ? `1 evaluation submitted for "${seminar.title}".`
            : `${count} evaluations submitted for "${seminar.title}".`,
        timestamp: row.latest || new Date(),
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const totalPendingApprovals = items
      .filter((i) => i.type === 'pre-registration')
      .reduce((acc, i) => acc + i.count, 0);

    res.json({
      items,
      unreadCount: items.length,
      totalPendingApprovals,
    });
  } catch (err) {
    next(err);
  }
});

// Dashboard summary
router.get('/reports/summary', authMiddleware, async (req, res, next) => {
  try {
    const activeFilter = { role: 'employee', accountStatus: { $ne: 'deactivated' } };
    const inactiveFilter = { role: 'employee', accountStatus: 'deactivated' };
    const totalEmployees = await Employee.countDocuments(activeFilter);
    const deactivatedEmployees = await Employee.countDocuments(inactiveFilter);

    const [employees, activeSeminarIdSet] = await Promise.all([
      Employee.find(activeFilter).select('seminarsAttended requiredSeminarsPerYear').lean(),
      buildActiveSeminarIdSet(),
    ]);

    const compliant = employees.reduce((count, employee) => {
      const required = Number(employee.requiredSeminarsPerYear || 5);
      const attended = countActiveAttendedSeminars(employee.seminarsAttended, activeSeminarIdSet);
      return count + (attended >= required ? 1 : 0);
    }, 0);
    const nonCompliant = totalEmployees - compliant;
    const completionRate = totalEmployees === 0 ? 0 : (compliant / totalEmployees) * 100;

    res.json({
      totalEmployees,
      deactivatedEmployees,
      compliant,
      nonCompliant,
      completionRatePercent: Number(completionRate.toFixed(1)),
    });
  } catch (err) {
    next(err);
  }
});

// Employee table listing
router.get('/employees', authMiddleware, async (req, res, next) => {
  try {
    const { department, accountStatus, name } = req.query;
    const filter = { role: 'employee' };
    if (department && String(department).trim()) {
      filter.department = String(department).trim();
    }
    const nameFilter = String(name || '').trim();
    if (nameFilter) {
      const escaped = nameFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = { $regex: escaped, $options: 'i' };
    }
    const statusFilter = String(accountStatus || 'active').trim().toLowerCase();
    if (statusFilter === 'active') {
      filter.accountStatus = { $ne: 'deactivated' };
    }
    if (statusFilter === 'deactivated') {
      filter.accountStatus = 'deactivated';
    }

    const [employees, activeSeminarIdSet] = await Promise.all([
      Employee.find(filter).sort({ department: 1, name: 1 }).lean(),
      buildActiveSeminarIdSet(),
    ]);

    const rows = employees.map((e) => {
      const attended = countActiveAttendedSeminars(e.seminarsAttended, activeSeminarIdSet);
      const required = Number(e.requiredSeminarsPerYear || 5);
      const isCompliant = attended >= required;
      return {
        id: e._id.toString(),
        employeeId: makeEmployeeDisplayId(e._id),
        name: e.name,
        email: e.email,
        department: e.department,
        position: e.position,
        seminarsAttended: attended,
        requiredSeminarsPerYear: required,
        seminarStatus: isCompliant ? 'Complete' : 'Incomplete',
        completionText: `${attended}/${required}`,
        accountStatus: e.accountStatus === 'deactivated' ? 'deactivated' : 'active',
        isActive: e.accountStatus !== 'deactivated',
        deactivatedAt: e.deactivatedAt || null,
        registeredAt: e.createdAt || null,
        updatedAt: e.updatedAt,
      };
    });

    const departments = await Employee.distinct('department');

    res.json({ rows, departments });
  } catch (err) {
    next(err);
  }
});

router.patch('/employees/:id/account-status', authMiddleware, async (req, res, next) => {
  try {
    const desiredStatus = String(req.body?.accountStatus || '').trim().toLowerCase();
    if (!['active', 'deactivated'].includes(desiredStatus)) {
      return res.status(400).json({ message: 'accountStatus must be either active or deactivated.' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }
    if (employee.role === 'admin') {
      return res.status(400).json({ message: 'Admin accounts cannot be deactivated from this view.' });
    }

    employee.accountStatus = desiredStatus;
    employee.deactivatedAt = desiredStatus === 'deactivated' ? new Date() : null;
    await employee.save();

    res.json({
      message: desiredStatus === 'deactivated' ? 'Employee account deactivated.' : 'Employee account reactivated.',
      employee: {
        id: employee._id.toString(),
        accountStatus: employee.accountStatus,
        deactivatedAt: employee.deactivatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/employees/:id/profile', authMiddleware, async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate({
        path: 'seminarsAttended',
        select: 'title date startTime',
        match: { isDeleted: { $ne: true } },
      })
      .lean();

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found.' });
    }

    const registrations = await Registration.find({ employeeID: employee._id })
      .populate({
        path: 'seminarID',
        select: 'title date startTime',
        match: { isDeleted: { $ne: true } },
      })
      .sort({ createdAt: -1 })
      .lean();

    const reservedSeminars = registrations
      .filter(
        (r) =>
          Boolean(r?.seminarID) && ['registered', 'pre-registered'].includes(String(r?.status || '').toLowerCase())
      )
      .map((r) => ({
        id: r?.seminarID?._id?.toString() || '',
        title: r?.seminarID?.title || 'Untitled seminar',
        date: r?.seminarID?.date || null,
        startTime: r?.seminarID?.startTime || '',
        status: r.status,
      }));

    const takenFromRegistrations = registrations
      .filter((r) => Boolean(r?.seminarID) && String(r?.status || '').toLowerCase() === 'attended')
      .map((r) => ({
        id: r?.seminarID?._id?.toString() || '',
        title: r?.seminarID?.title || 'Untitled seminar',
        date: r?.seminarID?.date || null,
        startTime: r?.seminarID?.startTime || '',
      }));

    const takenSeen = new Set(takenFromRegistrations.map((s) => String(s.id || '')));
    const takenFromEmployeeRecord = (Array.isArray(employee.seminarsAttended) ? employee.seminarsAttended : [])
      .map((s) => ({
        id: s?._id?.toString() || '',
        title: s?.title || 'Untitled seminar',
        date: s?.date || null,
        startTime: s?.startTime || '',
      }))
      .filter((s) => {
        const key = String(s.id || '');
        if (!key || takenSeen.has(key)) return false;
        takenSeen.add(key);
        return true;
      });

    const takenSeminars = [...takenFromRegistrations, ...takenFromEmployeeRecord];
    const certificates = registrations
      .filter((r) => Boolean(r?.seminarID) && String(r?.status || '').toLowerCase() === 'attended' && r.certificateIssued)
      .map((r) => ({
        registrationId: r._id.toString(),
        seminarId: r.seminarID?._id?.toString() || '',
        title: r.seminarID?.title || 'Untitled seminar',
        date: r.seminarID?.date || null,
        startTime: r.seminarID?.startTime || '',
        certificateIssued: Boolean(r.certificateIssued),
        certificateCode: r.certificateCode || '',
        certificateIssuedAt: r.certificateIssuedAt || r.updatedAt || null,
        evaluationAvailable: Boolean(r.evaluationAvailable),
        evaluationCompleted: Boolean(r.evaluationCompleted),
      }));
    const attended = takenSeminars.length;
    const required = Number(employee.requiredSeminarsPerYear || 5);

    res.json({
      profile: {
        id: employee._id.toString(),
        employeeId: makeEmployeeDisplayId(employee._id),
        name: employee.name || '',
        email: employee.email || '',
        department: employee.department || '',
        position: employee.position || '',
        accountStatus: employee.accountStatus === 'deactivated' ? 'deactivated' : 'active',
        deactivatedAt: employee.deactivatedAt || null,
        registeredAt: employee.createdAt || null,
        seminarStatus: attended >= required ? 'Complete' : 'Incomplete',
        completionText: `${attended}/${required}`,
      },
      reservedSeminars,
      takenSeminars,
      certificates,
    });
  } catch (err) {
    next(err);
  }
});

// Bulk notify selected employees
router.post('/employees/notify', authMiddleware, async (req, res, next) => {
  try {
    const { employeeIds } = req.body;
    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ message: 'employeeIds is required.' });
    }

    const employees = await Employee.find({
      _id: { $in: employeeIds },
      role: 'employee',
      accountStatus: { $ne: 'deactivated' },
    });

    let sent = 0;
    const activeSeminarIdSet = await buildActiveSeminarIdSet();
    for (const employee of employees) {
      const required = Number(employee.requiredSeminarsPerYear || 5);
      const completed = countActiveAttendedSeminars(employee.seminarsAttended, activeSeminarIdSet);
      const remaining = required - completed;
      if (remaining <= 0) continue;

      try {
        await sendReminderEmail(employee, remaining);
        sent += 1;
      } catch (err) {
        console.error(`Failed to notify ${employee.email}:`, err?.message || err);
      }
    }

    res.json({ sent });
  } catch (err) {
    next(err);
  }
});

const buildValidatedSessions = (rawSessions, allowPast = false) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessions = [];
  for (const s of rawSessions) {
    if (!s.date || !s.startTime || !s.durationHours) {
      return { error: 'Each session requires a date, start time, and duration.' };
    }
    const d = parseDateOnly(s.date);
    if (!d) return { error: `Invalid session date: ${s.date}` };
    d.setHours(0, 0, 0, 0);
    if (!allowPast && d < today) return { error: 'Session dates cannot be in the past.' };
    sessions.push({ ...s, date: d, durationHours: Number(s.durationHours) });
  }
  sessions.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { sessions };
};

router.post('/seminars', authMiddleware, async (req, res, next) => {
  try {
    const { title, description, mandatory, capacity, autoSendCertificates, certificateReleaseMode, multiSessionType } = req.body;
    if (!title || !description || !capacity) {
      return res.status(400).json({ message: 'Title, description, and capacity are required.' });
    }

    const rawSessions =
      Array.isArray(req.body.sessions) && req.body.sessions.length > 0
        ? req.body.sessions
        : [{ date: req.body.date, startTime: req.body.startTime, durationHours: req.body.durationHours }];

    const { sessions, error } = buildValidatedSessions(rawSessions);
    if (error) return res.status(400).json({ message: error });

    const releaseMode = normalizeCertificateReleaseMode({ certificateReleaseMode, autoSendCertificates });
    const resolvedSessionType = sessions.length > 1 && multiSessionType === 'pick-one' ? 'pick-one' : 'all';

    const seminar = await Seminar.create({
      title: String(title).trim(),
      description: String(description).trim(),
      date: sessions[0].date,
      startTime: sessions[0].startTime,
      durationHours: sessions[0].durationHours,
      sessions,
      mandatory: String(mandatory).toLowerCase() === 'true',
      capacity: Number(capacity),
      autoSendCertificates: releaseMode === 'automatic',
      certificateReleaseMode: releaseMode,
      multiSessionType: resolvedSessionType,
      createdBy: req.user.id,
    });

    res.status(201).json(seminar);
  } catch (err) {
    next(err);
  }
});

router.get('/seminars', authMiddleware, async (req, res, next) => {
  try {
    await purgeExpiredDeletedSeminars();
    const seminars = await Seminar.find({ isDeleted: { $ne: true } }).sort({ date: -1, startTime: -1 });
    const result = seminars.map((s) => {
      const obj = s.toObject();
      obj.hasPendingFinalization =
        Array.isArray(s.sessions) &&
        s.sessions.length > 0 &&
        s.sessions.every((sess) => sess.isHeld) &&
        !s.isHeld;
      return obj;
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/seminars/deleted', authMiddleware, async (req, res, next) => {
  try {
    await purgeExpiredDeletedSeminars();
    const now = new Date();
    const seminars = await Seminar.find({
      isDeleted: true,
      deletePermanentlyAt: { $gt: now },
    })
      .sort({ deletedAt: -1, date: -1, startTime: -1 })
      .lean();
    res.json(seminars);
  } catch (err) {
    next(err);
  }
});

router.post('/seminars/:id/restore', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await Seminar.findOne({ _id: req.params.id, isDeleted: true });
    if (!seminar) return res.status(404).json({ message: 'Deleted seminar not found.' });

    seminar.isDeleted = false;
    seminar.deletedAt = null;
    seminar.deletePermanentlyAt = null;
    await seminar.save();

    const attendedEmployeeIds = await Registration.distinct('employeeID', {
      seminarID: seminar._id,
      status: 'attended',
    });
    if (attendedEmployeeIds.length > 0) {
      await Employee.updateMany(
        { _id: { $in: attendedEmployeeIds } },
        { $addToSet: { seminarsAttended: seminar._id } }
      );
    }

    res.json({ message: 'Seminar restored successfully.', seminar });
  } catch (err) {
    next(err);
  }
});

router.delete('/seminars/:id/permanent', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await Seminar.findOne({ _id: req.params.id, isDeleted: true });
    if (!seminar) return res.status(404).json({ message: 'Deleted seminar not found.' });

    await permanentlyDeleteSeminarsByIds([seminar._id]);

    res.json({ message: 'Seminar permanently deleted.' });
  } catch (err) {
    next(err);
  }
});

// Mark a single session as held
router.post('/seminars/:id/sessions/:sessionId/held', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await findActiveSeminarById(req.params.id);
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });

    const session = seminar.sessions.id(req.params.sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (!session.isHeld) {
      session.isHeld = true;
      session.heldAt = new Date();
    }
    if (!seminar.isHeld) {
      seminar.isHeld = true;
      seminar.heldAt = new Date();
    }
    await seminar.save();
    res.json({ message: 'Session marked as held.', session });
  } catch (err) {
    next(err);
  }
});

// Record attendance for a single session
router.post('/seminars/:id/sessions/:sessionId/attendance', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await findActiveSeminarById(req.params.id);
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });

    const session = seminar.sessions.id(req.params.sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (!session.isHeld) return res.status(400).json({ message: 'Mark this session as held before recording attendance.' });

    const attendedIds = Array.isArray(req.body?.attendedRegistrationIds)
      ? req.body.attendedRegistrationIds.map(String)
      : [];

    const registrations = await Registration.find({
      seminarID: seminar._id,
      status: { $in: ['registered', 'attended', 'absent'] },
    });

    for (const reg of registrations) {
      const attended = attendedIds.includes(String(reg._id));
      if (!Array.isArray(reg.sessionAttendance)) reg.sessionAttendance = [];
      const idx = reg.sessionAttendance.findIndex((sa) => String(sa.sessionId) === String(session._id));
      if (idx >= 0) {
        reg.sessionAttendance[idx].attended = attended;
        reg.sessionAttendance[idx].markedAt = new Date();
      } else {
        reg.sessionAttendance.push({ sessionId: session._id, attended, markedAt: new Date() });
      }
      reg.markModified('sessionAttendance');
      await reg.save();
    }

    res.json({ message: `Session attendance saved for ${registrations.length} participant(s).` });
  } catch (err) {
    next(err);
  }
});

// Finalize overall attendance based on all held sessions
router.post('/seminars/:id/attendance/finalize', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await findActiveSeminarById(req.params.id);
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });

    const heldSessions = (seminar.sessions || []).filter((s) => s.isHeld);
    if (!heldSessions.length) {
      return res.status(400).json({ message: 'Mark at least one session as held before finalizing.' });
    }

    const registrations = await Registration.find({
      seminarID: seminar._id,
      status: { $in: ['registered', 'attended', 'absent'] },
    });

    if (!registrations.length) {
      return res.json({ message: 'No approved participants found.', attendedCount: 0, absentCount: 0 });
    }

    let attendedCount = 0;
    let absentCount = 0;
    const attendedEmployeeIds = [];
    const absentEmployeeIds = [];

    const requiredToPass = seminar.requiredSessionsToPass
      ? Math.min(seminar.requiredSessionsToPass, heldSessions.length)
      : heldSessions.length;

    for (const reg of registrations) {
      let passed = false;
      if (seminar.multiSessionType === 'pick-one' && reg.chosenSessionId) {
        // Only check the one session the employee chose
        const chosenHeld = heldSessions.find((s) => String(s._id) === String(reg.chosenSessionId));
        if (chosenHeld) {
          const entry = (reg.sessionAttendance || []).find((sa) => String(sa.sessionId) === String(chosenHeld._id));
          passed = entry?.attended === true;
        }
      } else {
        const sessionsAttended = heldSessions.filter((session) => {
          const entry = (reg.sessionAttendance || []).find((sa) => String(sa.sessionId) === String(session._id));
          return entry?.attended === true;
        }).length;
        passed = sessionsAttended >= requiredToPass;
      }
      reg.status = passed ? 'attended' : 'absent';
      if (passed) {
        reg.evaluationAvailable = true;
        attendedEmployeeIds.push(reg.employeeID);
        attendedCount++;
      } else {
        reg.evaluationAvailable = false;
        reg.certificateIssued = false;
        absentEmployeeIds.push(reg.employeeID);
        absentCount++;
      }
      await reg.save();
    }

    if (attendedEmployeeIds.length) {
      await Employee.updateMany(
        { _id: { $in: attendedEmployeeIds } },
        { $addToSet: { seminarsAttended: seminar._id } }
      );
    }
    if (absentEmployeeIds.length) {
      await Employee.updateMany(
        { _id: { $in: absentEmployeeIds } },
        { $pull: { seminarsAttended: seminar._id } }
      );
    }

    const attendedRegs = registrations.filter((r) => r.status === 'attended');
    for (const reg of attendedRegs) {
      await Notification.create({
        employeeID: reg.employeeID,
        type: 'evaluation',
        message: `An evaluation form is now available for the seminar: "${seminar.title}". Please share your feedback.`,
        seminarID: seminar._id,
        registrationID: reg._id,
      });
    }

    if (seminar.certificateReleaseMode === 'automatic' && attendedRegs.length > 0) {
      for (const reg of attendedRegs) {
        await issueCertificateForRegistration({ registration: reg, seminar, employee: { _id: reg.employeeID }, Notification });
      }
    }

    res.json({ message: 'Attendance finalized successfully.', attendedCount, absentCount });
  } catch (err) {
    next(err);
  }
});

router.get('/seminars/:id/participants', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await Seminar.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      .select('title isHeld heldAt sessions registeredEmployees autoSendCertificates certificateReleaseMode')
      .populate('registeredEmployees', 'name department position email');
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });

    const registrations = await Registration.find({ seminarID: req.params.id })
      .populate('employeeID')
      .sort({ registeredAt: -1 });

    const rowMap = new Map();

    registrations.forEach((r) => {
      rowMap.set(String(r.employeeID?._id || r.employeeID), {
        id: r._id,
        employeeId: String(r.employeeID?._id || r.employeeID),
        name: r.employeeID?.name,
        department: r.employeeID?.department,
        position: r.employeeID?.position,
        email: r.employeeID?.email,
        status: r.status,
        certificateIssued: Boolean(r.certificateIssued),
        evaluationAvailable: Boolean(r.evaluationAvailable),
        evaluationCompleted: Boolean(r.evaluationCompleted),
        evaluationStatus: r.evaluationCompleted
          ? 'Answered'
          : r.evaluationAvailable
            ? 'Not Answered'
            : 'Not Available',
        sessionAttendance: Array.isArray(r.sessionAttendance) ? r.sessionAttendance : [],
      });
    });

    const fallbackEmployees = Array.isArray(seminar.registeredEmployees) ? seminar.registeredEmployees : [];
    fallbackEmployees.forEach((employee) => {
      const key = String(employee._id);
      if (rowMap.has(key)) return;
      rowMap.set(key, {
        id: key,
        employeeId: key,
        name: employee.name,
        department: employee.department,
        position: employee.position,
        email: employee.email,
        status: 'registered',
        certificateIssued: false,
        evaluationAvailable: false,
        evaluationCompleted: false,
        evaluationStatus: 'Not Available',
      });
    });

    const rows = Array.from(rowMap.values());

    res.json({
      seminar: {
        id: seminar._id,
        title: seminar.title,
        isHeld: Boolean(seminar.isHeld),
        heldAt: seminar.heldAt,
        sessions: Array.isArray(seminar.sessions) ? seminar.sessions : [],
        registeredCount: rows.length,
        autoSendCertificates: Boolean(seminar.autoSendCertificates),
        certificateReleaseMode: seminar.certificateReleaseMode || (seminar.autoSendCertificates ? 'automatic' : 'evaluation'),
      },
      rows,
    });
  } catch (err) {
    next(err);
  }
});

// Approve selected pre-registered participants
router.post('/seminars/:id/approve', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await findActiveSeminarById(req.params.id);
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });

    const registrationIds = Array.isArray(req.body?.registrationIds)
      ? req.body.registrationIds.map((id) => String(id))
      : [];
    if (!registrationIds.length) {
      return res.status(400).json({ message: 'Select at least one participant to approve.' });
    }

    const registrations = await Registration.find({
      _id: { $in: registrationIds },
      seminarID: seminar._id,
      status: 'pre-registered',
    }).populate('employeeID', 'name');

    let approvedCount = 0;
    for (const reg of registrations) {
      reg.status = 'registered';
      await reg.save();

      // Create approval notification
      await Notification.create({
        employeeID: reg.employeeID._id,
        type: 'approval',
        message: `You are officially part of the seminar: "${seminar.title}". You have been approved as an Official Participant.`,
        seminarID: seminar._id,
        registrationID: reg._id,
      });

      approvedCount += 1;
    }

    res.json({ message: `${approvedCount} participant(s) approved successfully.`, approvedCount });
  } catch (err) {
    next(err);
  }
});

router.post('/seminars/:id/held', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await findActiveSeminarById(req.params.id);
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });
    if (!seminar.isHeld) {
      seminar.isHeld = true;
      seminar.heldAt = new Date();
      await seminar.save();
    }
    res.json({
      message: 'Seminar marked as held. You can now record attendance.',
      seminar,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/seminars/:id/attendance', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await findActiveSeminarById(req.params.id);
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });
    if (!seminar.isHeld) {
      return res.status(400).json({ message: 'Mark the seminar as held before recording attendance.' });
    }

    const attendedRegistrationIds = Array.isArray(req.body?.attendedRegistrationIds)
      ? req.body.attendedRegistrationIds.map((id) => String(id))
      : [];

    // Only process registered (approved) participants, not pre-registered
    const registrations = await Registration.find({
      seminarID: seminar._id,
      status: { $in: ['registered', 'attended', 'absent'] },
    });

    if (!registrations.length) {
      return res.json({ message: 'No approved participants found.', attendedCount: 0, absentCount: 0 });
    }

    const attendedEmployeeIds = [];
    const absentEmployeeIds = [];

    for (const reg of registrations) {
      const isAttended = attendedRegistrationIds.includes(String(reg._id));
      reg.status = isAttended ? 'attended' : 'absent';

      if (isAttended) {
        // Enable evaluation form
        reg.evaluationAvailable = true;
        attendedEmployeeIds.push(reg.employeeID);
      } else {
        reg.certificateIssued = false;
        reg.certificateIssuedAt = undefined;
        reg.evaluationAvailable = false;
        absentEmployeeIds.push(reg.employeeID);
      }
      await reg.save();
    }

    if (attendedEmployeeIds.length) {
      await Employee.updateMany(
        { _id: { $in: attendedEmployeeIds } },
        { $addToSet: { seminarsAttended: seminar._id } }
      );
    }
    if (absentEmployeeIds.length) {
      await Employee.updateMany(
        { _id: { $in: absentEmployeeIds } },
        { $pull: { seminarsAttended: seminar._id } }
      );
    }

    // Send evaluation notifications to attendees
    const attendedRegs = registrations.filter((r) => r.status === 'attended');
    for (const reg of attendedRegs) {
      await Notification.create({
        employeeID: reg.employeeID,
        type: 'evaluation',
        message: `An evaluation form is now available for the seminar: "${seminar.title}". Please share your feedback.`,
        seminarID: seminar._id,
        registrationID: reg._id,
      });
    }

    // Auto-send certificates immediately only when the seminar is configured for it.
    if (seminar.certificateReleaseMode === 'automatic' && attendedRegs.length > 0) {
      for (const reg of attendedRegs) {
        await issueCertificateForRegistration({
          registration: reg,
          seminar,
          employee: { _id: reg.employeeID },
          Notification,
        });
      }
    }

    res.json({
      message: 'Attendance recorded successfully.',
      attendedCount: attendedEmployeeIds.length,
      absentCount: absentEmployeeIds.length,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/seminars/:id/certificates', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await findActiveSeminarById(req.params.id);
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });

    const registrationIds = Array.isArray(req.body?.registrationIds)
      ? req.body.registrationIds.map((id) => String(id))
      : [];
    if (!registrationIds.length) {
      return res.status(400).json({ message: 'Select at least one attendee.' });
    }

    const registrations = await Registration.find({
      _id: { $in: registrationIds },
      seminarID: seminar._id,
      status: 'attended',
      evaluationCompleted: true,
    });

    let releasedCount = 0;
    for (const reg of registrations) {
      const employee = await Employee.findById(reg.employeeID);
      if (!employee) continue;
      await issueCertificateForRegistration({ registration: reg, seminar, employee, Notification });

      releasedCount += 1;
    }

    res.json({
      message: 'Certificates released to selected attendees.',
      releasedCount,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/employees/:employeeId/certificates/:registrationId/download', authMiddleware, async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found.' });

    const registration = await Registration.findOne({
      _id: req.params.registrationId,
      employeeID: req.params.employeeId,
      status: 'attended',
      certificateIssued: true,
    }).populate({
      path: 'seminarID',
      select: 'title date startTime durationHours',
      match: { isDeleted: { $ne: true } },
    });

    if (!registration || !registration.seminarID) {
      return res.status(404).json({ message: 'Certificate not found.' });
    }

    const download = buildCertificateDownload({
      employee,
      registration,
      seminar: registration.seminarID,
    });
    const pngBuffer = await renderCertificateBuffer({ html: download.html });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="GIMS-Certificate-${download.fileNameSafe}-${download.certificateCode}.png"`
    );
    res.send(pngBuffer);
  } catch (err) {
    next(err);
  }
});

router.put('/seminars/:id', authMiddleware, async (req, res, next) => {
  try {
    const { title, description, mandatory, capacity, autoSendCertificates, certificateReleaseMode, multiSessionType } = req.body;
    if (!title || !description || !capacity) {
      return res.status(400).json({ message: 'Title, description, and capacity are required.' });
    }

    const seminar = await findActiveSeminarById(req.params.id);
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });

    const rawSessions =
      Array.isArray(req.body.sessions) && req.body.sessions.length > 0
        ? req.body.sessions
        : [{ date: req.body.date, startTime: req.body.startTime, durationHours: req.body.durationHours }];

    // Build existing session map to preserve isHeld/heldAt
    const existingMap = new Map((seminar.sessions || []).map((s) => [String(s._id), s]));

    const newSessions = [];
    for (const s of rawSessions) {
      const existing = s._id ? existingMap.get(String(s._id)) : null;
      if (existing?.isHeld) {
        // Keep held session exactly as-is
        newSessions.push(existing.toObject());
        continue;
      }
      if (!s.date || !s.startTime || !s.durationHours) {
        return res.status(400).json({ message: 'Each session requires a date, start time, and duration.' });
      }
      const d = parseDateOnly(s.date);
      if (!d) return res.status(400).json({ message: `Invalid session date: ${s.date}` });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      if (d < today) return res.status(400).json({ message: 'Session dates cannot be in the past.' });
      if (existing) {
        newSessions.push({ ...existing.toObject(), date: d, startTime: s.startTime, durationHours: Number(s.durationHours) });
      } else {
        newSessions.push({ date: d, startTime: s.startTime, durationHours: Number(s.durationHours) });
      }
    }
    newSessions.sort((a, b) => new Date(a.date) - new Date(b.date));

    seminar.title = String(title).trim();
    seminar.description = String(description).trim();
    seminar.sessions = newSessions;
    seminar.date = newSessions[0]?.date || seminar.date;
    seminar.startTime = newSessions[0]?.startTime || seminar.startTime;
    seminar.durationHours = newSessions[0]?.durationHours || seminar.durationHours;
    seminar.mandatory = String(mandatory).toLowerCase() === 'true';
    seminar.capacity = Number(capacity);
    const releaseMode = normalizeCertificateReleaseMode({ certificateReleaseMode, autoSendCertificates });
    seminar.certificateReleaseMode = releaseMode;
    seminar.autoSendCertificates = releaseMode === 'automatic';
    seminar.multiSessionType = newSessions.length > 1 && multiSessionType === 'pick-one' ? 'pick-one' : 'all';

    await seminar.save();
    res.json(seminar);
  } catch (err) {
    next(err);
  }
});

router.post('/seminars/:seminarId/participants/:registrationId/attend', authMiddleware, async (req, res, next) => {
  try {
    const registration = await Registration.findByIdAndUpdate(
      req.params.registrationId,
      { $set: { status: 'attended' } },
      { new: true }
    );
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    await Employee.findByIdAndUpdate(registration.employeeID, {
      $addToSet: { seminarsAttended: registration.seminarID },
    });
    res.json(registration);
  } catch (err) {
    next(err);
  }
});

router.delete(
  '/seminars/:seminarId/participants/:registrationId',
  authMiddleware,
  async (req, res, next) => {
    try {
      const registration = await Registration.findByIdAndDelete(req.params.registrationId);
      if (!registration) return res.status(404).json({ message: 'Registration not found' });

      await Seminar.findByIdAndUpdate(registration.seminarID, {
        $pull: { registeredEmployees: registration.employeeID },
      });

      res.json({ message: 'Registration removed' });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/seminars/:id/close', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await Seminar.findOneAndUpdate(
      { _id: req.params.id, isDeleted: { $ne: true } },
      { $set: { capacity: 0 } },
      { new: true }
    );
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });
    res.json(seminar);
  } catch (err) {
    next(err);
  }
});

router.delete('/seminars/:id', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await findActiveSeminarById(req.params.id);
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });

    const now = new Date();
    seminar.isDeleted = true;
    seminar.deletedAt = now;
    seminar.deletePermanentlyAt = new Date(now.getTime() + SEMINAR_DELETE_RETENTION_MS);
    await seminar.save();

    await Employee.updateMany(
      { seminarsAttended: seminar._id },
      { $pull: { seminarsAttended: seminar._id } }
    );

    res.json({
      message: 'Seminar moved to Recently Deleted. It will be permanently deleted in 7 days.',
      deletePermanentlyAt: seminar.deletePermanentlyAt,
    });
  } catch (err) {
    next(err);
  }
});

// Upload a material (PDF/PPT) to a specific seminar
router.post('/seminars/:id/materials', authMiddleware, materialsUpload.single('file'), async (req, res, next) => {
  try {
    const seminar = await findActiveSeminarById(req.params.id);
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });

    const { title, description } = req.body;
    if (!title || !req.file) {
      return res.status(400).json({ message: 'Title and file are required.' });
    }

    const material = await LearningMaterial.create({
      title: String(title).trim(),
      description: String(description || '').trim(),
      fileURL: `/uploads/${req.file.filename}`,
      uploadedBy: req.user.id,
    });

    seminar.materials.push(material._id);
    await seminar.save();

    res.status(201).json(material);
  } catch (err) {
    next(err);
  }
});

// Get all materials for a specific seminar (admin)
router.get('/seminars/:id/materials', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await Seminar.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      .populate('materials')
      .select('materials');
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });
    res.json(Array.isArray(seminar.materials) ? seminar.materials : []);
  } catch (err) {
    next(err);
  }
});

// Remove a material from a seminar
router.delete('/seminars/:id/materials/:materialId', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await findActiveSeminarById(req.params.id);
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });

    seminar.materials = seminar.materials.filter(
      (m) => String(m) !== String(req.params.materialId)
    );
    await seminar.save();

    const material = await LearningMaterial.findByIdAndDelete(req.params.materialId);
    if (material?.fileURL) {
      const filePath = path.join(process.cwd(), 'public', material.fileURL);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json({ message: 'Material removed successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/materials', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title || !req.file) {
      return res.status(400).json({ message: 'Title and file are required.' });
    }

    const material = await LearningMaterial.create({
      title,
      description,
      fileURL: `/uploads/${req.file.filename}`,
      uploadedBy: req.user.id,
    });

    res.status(201).json(material);
  } catch (err) {
    next(err);
  }
});

router.get('/materials', authMiddleware, async (req, res, next) => {
  try {
    const materials = await LearningMaterial.find().sort({ createdAt: -1 });
    res.json(materials);
  } catch (err) {
    next(err);
  }
});

const parseIdsParam = (raw) => {
  if (!raw) return null;
  const ids = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? ids : null;
};

router.get('/reports/ched.pdf', authMiddleware, async (req, res, next) => {
  try {
    const filter = { role: 'employee', accountStatus: { $ne: 'deactivated' } };
    const ids = parseIdsParam(req.query.ids);
    if (ids) filter._id = { $in: ids };
    const [employees, activeSeminarIdSet] = await Promise.all([
      Employee.find(filter)
        .select('name department position birthSex genderIdentity seminarsAttended requiredSeminarsPerYear')
        .lean(),
      buildActiveSeminarIdSet(),
    ]);

    const totalEmployees = employees.length;

    let totalCompliant = 0;
    let compliantMaleCount = 0;
    let compliantFemaleCount = 0;
    let compliantIntersexCount = 0;
    let compliantOtherBirthSexCount = 0;

    const deptStats = new Map();
    const employeeRows = [];

    employees.forEach((emp) => {
      const required = Number(emp.requiredSeminarsPerYear || 5);
      const attended = countActiveAttendedSeminars(emp.seminarsAttended, activeSeminarIdSet);
      const isCompliant = attended >= required;
      const dept = (emp.department || 'Unassigned').trim() || 'Unassigned';
      const sex = String(emp.birthSex || '').trim().toLowerCase();

      if (!deptStats.has(dept)) deptStats.set(dept, { total: 0, compliant: 0 });
      const stat = deptStats.get(dept);
      stat.total += 1;
      if (isCompliant) stat.compliant += 1;

      if (isCompliant) {
        totalCompliant += 1;
        if (sex === 'male') compliantMaleCount += 1;
        else if (sex === 'female') compliantFemaleCount += 1;
        else if (sex === 'intersex') compliantIntersexCount += 1;
        else compliantOtherBirthSexCount += 1;
      }

      employeeRows.push({
        name: emp.name,
        department: dept,
        position: emp.position,
        birthSex: emp.birthSex,
        genderIdentity: emp.genderIdentity,
        seminarCount: attended,
      });
    });

    const totalNonCompliant = totalEmployees - totalCompliant;
    const complianceRatePercent =
      totalEmployees === 0 ? 0 : Number(((totalCompliant / totalEmployees) * 100).toFixed(1));

    const departmentCompliance = Array.from(deptStats.entries())
      .map(([department, { total, compliant }]) => ({
        department,
        complianceRatePercent: total === 0 ? 0 : Number(((compliant / total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.complianceRatePercent - a.complianceRatePercent);

    const pdfBuffer = await generateCHEDReport({
      totalEmployees,
      totalCompliant,
      totalNonCompliant,
      complianceRatePercent,
      compliantMaleCount,
      compliantFemaleCount,
      compliantIntersexCount,
      compliantOtherBirthSexCount,
      departmentCompliance,
      employees: employeeRows,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="gims_ched_report.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

router.get('/reports/employees.csv', authMiddleware, async (req, res, next) => {
  try {
    const filter = {};
    const ids = parseIdsParam(req.query.ids);
    if (ids) filter._id = { $in: ids };
    const [employees, activeSeminarIdSet] = await Promise.all([
      Employee.find(filter).lean(),
      buildActiveSeminarIdSet(),
    ]);

    const header = 'Name,Department,Position,Seminars Attended\n';
    const rows = employees
      .map((e) => {
        const attended = countActiveAttendedSeminars(e.seminarsAttended, activeSeminarIdSet);
        return `"${(e.name || '').replace(/"/g, '""')}","${(e.department || '').replace(
          /"/g,
          '""'
        )}","${(e.position || '').replace(/"/g, '""')}",${attended}`;
      })
      .join('\n');

    const csv = header + rows;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="gims_employees.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/reminders', authMiddleware, async (req, res, next) => {
  try {
    const result = await sendBulkReminders();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Seminar-specific report: attendance counts + attendee demographic breakdown
router.get('/seminars/:id/report', authMiddleware, async (req, res, next) => {
  try {
    const seminar = await Seminar.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      .select('title date startTime isHeld sessions');
    if (!seminar) return res.status(404).json({ message: 'Seminar not found' });

    const registrations = await Registration.find({ seminarID: seminar._id })
      .populate('employeeID', 'birthSex genderIdentity name department')
      .lean();

    const counts = { preRegistered: 0, registered: 0, attended: 0, absent: 0 };
    const demographics = { male: 0, female: 0, other: 0 };

    for (const reg of registrations) {
      const status = String(reg.status || '').toLowerCase();
      if (status === 'pre-registered') counts.preRegistered += 1;
      else if (status === 'registered') counts.registered += 1;
      else if (status === 'attended') {
        counts.attended += 1;
        const sex = String(reg.employeeID?.birthSex || '').toLowerCase();
        if (sex.includes('male') && !sex.includes('female')) demographics.male += 1;
        else if (sex.includes('female')) demographics.female += 1;
        else demographics.other += 1;
      } else if (status === 'absent') counts.absent += 1;
    }

    const totalTracked = registrations.length;

    const sessionDates = Array.isArray(seminar.sessions) && seminar.sessions.length > 0
      ? seminar.sessions.map((s) => s.date).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))
      : [];

    const seminarDateDisplay = sessionDates.length > 1
      ? `${new Date(sessionDates[0]).toLocaleDateString()} – ${new Date(sessionDates[sessionDates.length - 1]).toLocaleDateString()}`
      : new Date(seminar.date).toLocaleDateString();

    res.json({
      seminarTitle: seminar.title,
      seminarDate: seminar.date,
      seminarDateDisplay,
      seminarStartTime: seminar.startTime,
      isHeld: Boolean(seminar.isHeld),
      sessionCount: sessionDates.length || 1,
      totalTracked,
      counts,
      demographics,
    });
  } catch (err) {
    next(err);
  }
});

// Get evaluations for a seminar
router.get('/seminars/:id/evaluations', authMiddleware, async (req, res, next) => {
  try {
    const evaluations = await Evaluation.find({ seminarID: req.params.id })
      .populate('employeeID', 'name department')
      .sort({ submittedAt: -1 });
    res.json(evaluations);
  } catch (err) {
    next(err);
  }
});

router.post('/articles', authMiddleware, upload.single('image'), async (req, res, next) => {
  try {
    const { title, content, seminarId, published } = req.body;
    if (!title || !content)
      return res.status(400).json({ message: 'title and content are required' });

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

    const article = await Article.create({
      title,
      content,
      imageUrl,
      seminar: seminarId || undefined,
      published: published === undefined ? true : String(published).toLowerCase() === 'true',
      publishedAt: new Date(),
      createdBy: req.user.id,
    });

    res.status(201).json(article);
  } catch (err) {
    next(err);
  }
});

router.get('/articles', authMiddleware, async (req, res, next) => {
  try {
    const articles = await Article.find()
      .populate('seminar')
      .sort({ publishedAt: -1, createdAt: -1 });
    res.json(articles);
  } catch (err) {
    next(err);
  }
});

router.delete('/articles/:id', authMiddleware, async (req, res, next) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);
    if (!article) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});


export default router;
