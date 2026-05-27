import express from 'express';
import jwt from 'jsonwebtoken';
import ExcelJS from 'exceljs';

import Employee from '../models/Employee.js';
import Seminar from '../models/Seminar.js';
import Registration from '../models/Registration.js';
import Notification from '../models/Notification.js';
import Evaluation from '../models/Evaluation.js';
import RegistrationArchive from '../models/RegistrationArchive.js';
import SeminarArchive from '../models/SeminarArchive.js';
import MaintenanceLog from '../models/MaintenanceLog.js';
import {
  getSchoolYear,
  currentSchoolYear,
  isValidSchoolYear,
} from '../services/schoolYearService.js';
import {
  runSnapshot,
  restoreFromSnapshot,
  getSnapshotStatus,
  BACKUP_DATABASE_NAME,
} from '../services/backupDatabaseService.js';
import { runDriveBackupNow } from '../services/driveBackupScheduler.js';
import { getLatestDriveBackup } from '../services/driveBackupService.js';

const router = express.Router();

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

const RESET_PHRASE = 'GIMS MAINTENANCE';
const RESTORE_PHRASE = 'GIMS RESTORE';

const displayValue = (value) => {
  if (value === null || value === undefined) return 'None';
  if (typeof value === 'number') return value;
  const s = String(value);
  return s.trim() === '' ? 'None' : s;
};

const formatDate = (d) => {
  if (!d) return 'None';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return 'None';
  return dt.toISOString().slice(0, 10);
};

// Build a "Last, First" display string + a lowercase last-name sort key.
// Prefers explicit firstName/lastName fields; falls back to parsing the
// full name (last token = last name).
const buildNameFields = (firstName, lastName, fullName) => {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (l || f) {
    const display = l && f ? `${l}, ${f}` : (l || f);
    return { display, sortKey: (l || f).toLowerCase() };
  }
  const n = (fullName || '').trim();
  if (!n) return { display: 'None', sortKey: '~~' };
  const parts = n.split(/\s+/);
  if (parts.length === 1) {
    return { display: parts[0], sortKey: parts[0].toLowerCase() };
  }
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return { display: `${last}, ${first}`, sortKey: last.toLowerCase() };
};

// GET /api/admin/maintenance/current-school-year
router.get('/current-school-year', authMiddleware, (req, res) => {
  res.json({ schoolYear: currentSchoolYear() });
});

// GET /api/admin/maintenance/preview?schoolYear=YYYY-YYYY
router.get('/preview', authMiddleware, async (req, res, next) => {
  try {
    const schoolYear = String(req.query.schoolYear || currentSchoolYear());
    if (!isValidSchoolYear(schoolYear)) {
      return res.status(400).json({ message: 'Invalid schoolYear (expected YYYY-YYYY)' });
    }

    // Reset archives ALL existing seminars/registrations into the chosen school year.
    const seminars = await Seminar.find({}).lean();
    const registrations = await Registration.find({}).lean();

    const employeeIds = new Set(registrations.map((r) => String(r.employeeID)));
    const certificatesIssued = registrations.filter((r) => r.certificateIssued).length;

    res.json({
      schoolYear,
      counts: {
        seminars: seminars.length,
        registrations: registrations.length,
        employeesAffected: employeeIds.size,
        certificatesIssued,
      },
    });
  } catch (err) {
    next(err);
  }
});

const MASTERLIST_COLUMNS = [
  { header: 'Employee Name',         key: 'name',         width: 28 },
  { header: 'Department',            key: 'department',   width: 30 },
  { header: 'Position',              key: 'position',     width: 22 },
  { header: 'Email',                 key: 'email',        width: 30 },
  { header: 'Seminar Title',         key: 'seminarTitle', width: 34 },
  { header: 'Seminar Date',          key: 'seminarDate',  width: 14 },
  { header: 'Duration (hrs)',        key: 'duration',     width: 14 },
  { header: 'Status',                key: 'status',       width: 14 },
  { header: 'Certificate Issued',    key: 'certIssued',   width: 16 },
  { header: 'Certificate Code',      key: 'certCode',     width: 26 },
  { header: 'Certificate Issued At', key: 'certIssuedAt', width: 18 },
  { header: 'School Year',           key: 'schoolYear',   width: 14 },
];

// Columns that are repeated per seminar (rendered as a numbered, multi-line list
// inside a single row per employee). Other columns are rendered once.
const PER_SEMINAR_KEYS = [
  'seminarTitle', 'seminarDate', 'duration', 'status',
  'certIssued', 'certCode', 'certIssuedAt', 'schoolYear',
];

// Aggregate per employee. Returns one row per unique name (alphabetical),
// with an `items` array of per-seminar entries.
const buildMasterlistData = async (schoolYear, { source }) => {
  const byEmployee = new Map();
  const add = (emp, item) => {
    const { display, sortKey } = buildNameFields(emp?.firstName, emp?.lastName, emp?.name);
    // Group by the original employee identity when available; otherwise fall back
    // to the display string. This prevents accidentally merging two employees
    // who happen to share a last name.
    const groupKey = emp?._id ? `id:${String(emp._id)}` : `name:${display.toLowerCase()}`;
    if (!byEmployee.has(groupKey)) {
      byEmployee.set(groupKey, {
        name: display,
        sortKey,
        department: displayValue(emp?.department),
        position:   displayValue(emp?.position),
        email:      displayValue(emp?.email),
        items: [],
      });
    }
    byEmployee.get(groupKey).items.push(item);
  };

  if (source === 'archive') {
    const regs = await RegistrationArchive.find({ schoolYear }).lean();
    for (const r of regs) {
      const s = r.seminarSnapshot || {};
      const e = r.employeeSnapshot || {};
      add(e, {
        seminarTitle: displayValue(s.title),
        seminarDate:  formatDate(s.date),
        duration:     displayValue(s.durationHours),
        status:       displayValue(r.status),
        certIssued:   r.certificateIssued ? 'Yes' : 'No',
        certCode:     displayValue(r.certificateCode),
        certIssuedAt: formatDate(r.certificateIssuedAt),
        schoolYear:   displayValue(r.schoolYear),
      });
    }
  } else {
    // Live source = ALL seminars / registrations (the reset archives everything).
    const seminars = await Seminar.find({}).lean();
    const seminarMap = new Map(seminars.map((s) => [String(s._id), s]));
    const registrations = await Registration.find({}).lean();
    const employeeIds = [...new Set(registrations.map((r) => String(r.employeeID)))];
    const employees = await Employee.find({ _id: { $in: employeeIds } }).lean();
    const empMap = new Map(employees.map((e) => [String(e._id), e]));

    for (const r of registrations) {
      const s = seminarMap.get(String(r.seminarID)) || {};
      const e = empMap.get(String(r.employeeID)) || {};
      add(e, {
        seminarTitle: displayValue(s.title),
        seminarDate:  formatDate(s.date),
        duration:     displayValue(s.durationHours),
        status:       displayValue(r.status),
        certIssued:   r.certificateIssued ? 'Yes' : 'No',
        certCode:     displayValue(r.certificateCode),
        certIssuedAt: formatDate(r.certificateIssuedAt),
        schoolYear:   displayValue(r.schoolYear || schoolYear),
      });
    }
  }

  const rows = [...byEmployee.values()];
  rows.sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey), undefined, { sensitivity: 'base' }));
  for (const row of rows) {
    row.items.sort((a, b) => {
      if (a.seminarDate === 'None') return 1;
      if (b.seminarDate === 'None') return -1;
      return String(a.seminarDate).localeCompare(String(b.seminarDate));
    });
  }
  return rows;
};

const buildMasterlistWorkbook = async (schoolYear, rows) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GIMS — GAD Integrated Management System';
  wb.created = new Date();

  const ws = wb.addWorksheet(`SY ${schoolYear}`, {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  const colCount = MASTERLIST_COLUMNS.length;
  const lastColLetter = ws.getColumn(colCount).letter;

  // Title row
  ws.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = ws.getCell('A1');
  titleCell.value = `GIMS YEARLY ARCHIVE • SCHOOL YEAR ${schoolYear.replace('-', '–')}`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF14264F' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  // Subtitle row
  ws.mergeCells(`A2:${lastColLetter}2`);
  const subCell = ws.getCell('A2');
  subCell.value = 'Xavier University – Ateneo de Cagayan • GAD Integrated Management System';
  subCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF6B7280' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 18;

  // Spacer row 3 (left blank by design)
  ws.getRow(3).height = 8;

  // Header row 4
  ws.columns = MASTERLIST_COLUMNS.map((c) => ({ key: c.key, width: c.width }));
  const headerRow = ws.getRow(4);
  MASTERLIST_COLUMNS.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF203A73' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FF14264F' } },
      bottom: { style: 'thin', color: { argb: 'FF14264F' } },
      left:   { style: 'thin', color: { argb: 'FF14264F' } },
      right:  { style: 'thin', color: { argb: 'FF14264F' } },
    };
  });
  headerRow.height = 26;

  // Data rows: one per employee. Per-seminar columns become numbered, multi-line cells.
  rows.forEach((row, idx) => {
    const data = {
      name: row.name,
      department: row.department,
      position: row.position,
      email: row.email,
    };
    const count = row.items.length;
    PER_SEMINAR_KEYS.forEach((key) => {
      if (count === 0) {
        data[key] = '—';
      } else {
        data[key] = row.items
          .map((it, i) => `${i + 1}. ${it[key] ?? 'None'}`)
          .join('\n');
      }
    });

    const excelRow = ws.addRow(data);
    const lineCount = Math.max(1, count);
    excelRow.height = Math.min(260, 22 + (lineCount - 1) * 16);
    const isAlt = idx % 2 === 1;

    excelRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF111827' } };
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.border = {
        top:    { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
      };
      if (isAlt) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF6F8FC' },
        };
      }
    });

    // Center-align short/code-like columns
    ['seminarDate', 'duration', 'status', 'certIssued', 'certCode', 'certIssuedAt', 'schoolYear']
      .forEach((key) => {
        const cell = excelRow.getCell(key);
        cell.alignment = { ...cell.alignment, horizontal: 'center' };
      });

    // Bold the employee name
    const nameCell = excelRow.getCell('name');
    nameCell.font = { ...nameCell.font, bold: true, color: { argb: 'FF14264F' } };

    // Dim "None" / empty employee-level cells
    ['name', 'department', 'position', 'email'].forEach((key) => {
      const cell = excelRow.getCell(key);
      if (cell.value === 'None') {
        cell.font = { ...cell.font, italic: true, color: { argb: 'FF9CA3AF' } };
      }
    });

    // Dim em-dash placeholder in per-seminar cells when employee has no records
    if (count === 0) {
      PER_SEMINAR_KEYS.forEach((key) => {
        const cell = excelRow.getCell(key);
        cell.font = { ...cell.font, italic: true, color: { argb: 'FF9CA3AF' } };
      });
    }
  });

  // If empty result, add a friendly note row
  if (rows.length === 0) {
    ws.mergeCells(`A5:${lastColLetter}5`);
    const empty = ws.getCell('A5');
    empty.value = `No registrations found for school year ${schoolYear}.`;
    empty.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF6B7280' } };
    empty.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(5).height = 28;
  }

  return wb;
};

const sendWorkbook = async (res, filename, wb) => {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
};

// GET /api/admin/maintenance/masterlist.xlsx?schoolYear=YYYY-YYYY
router.get('/masterlist.xlsx', authMiddleware, async (req, res, next) => {
  try {
    const schoolYear = String(req.query.schoolYear || currentSchoolYear());
    if (!isValidSchoolYear(schoolYear)) {
      return res.status(400).json({ message: 'Invalid schoolYear' });
    }
    const rows = await buildMasterlistData(schoolYear, { source: 'live' });
    const wb = await buildMasterlistWorkbook(schoolYear, rows);
    await sendWorkbook(res, `GIMS_Masterlist_${schoolYear}.xlsx`, wb);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/maintenance/reset-school-year
// body: { schoolYear, confirmPhrase, notes? }
router.post('/reset-school-year', authMiddleware, async (req, res, next) => {
  try {
    const { schoolYear, confirmPhrase, notes } = req.body || {};
    if (!isValidSchoolYear(schoolYear)) {
      return res.status(400).json({ message: 'Invalid schoolYear (expected YYYY-YYYY)' });
    }
    if (String(confirmPhrase || '').trim() !== RESET_PHRASE) {
      return res.status(400).json({ message: `Confirmation phrase must be exactly "${RESET_PHRASE}"` });
    }

    const adminEmployee = await Employee.findById(req.user.id).lean();
    const adminId = req.user.id;

    // 1. Gather ALL seminars and registrations. After this reset there should be
    //    no seminars left in the live collection — everything moves to the archive
    //    under the chosen school year label.
    const seminars = await Seminar.find({}).lean();
    const seminarIds = seminars.map((s) => s._id);
    const seminarMap = new Map(seminars.map((s) => [String(s._id), s]));

    const registrations = await Registration.find({}).lean();
    const affectedEmployeeIds = [...new Set(registrations.map((r) => String(r.employeeID)))];

    // Snapshot employee data for archive
    const employees = await Employee.find({ _id: { $in: affectedEmployeeIds } }).lean();
    const empMap = new Map(employees.map((e) => [String(e._id), e]));

    // 2. Copy registrations -> RegistrationArchive
    if (registrations.length) {
      const archiveDocs = registrations.map((r) => {
        const s = seminarMap.get(String(r.seminarID)) || {};
        const e = empMap.get(String(r.employeeID)) || {};
        return {
          schoolYear,
          archivedAt: new Date(),
          archivedBy: adminId,
          originalRegistrationId: r._id,
          seminarID: r.seminarID,
          employeeID: r.employeeID,
          registeredAt: r.registeredAt,
          status: r.status,
          certificateIssued: r.certificateIssued,
          certificateIssuedAt: r.certificateIssuedAt,
          certificateCode: r.certificateCode,
          evaluationAvailable: r.evaluationAvailable,
          evaluationCompleted: r.evaluationCompleted,
          sessionAttendance: r.sessionAttendance,
          chosenSessionId: r.chosenSessionId,
          originalCreatedAt: r.createdAt,
          originalUpdatedAt: r.updatedAt,
          seminarSnapshot: {
            title: s.title,
            description: s.description,
            location: s.location,
            date: s.date,
            durationHours: s.durationHours,
          },
          employeeSnapshot: {
            name: e.name,
            firstName: e.firstName,
            lastName: e.lastName,
            email: e.email,
            department: e.department,
            position: e.position,
          },
        };
      });
      await RegistrationArchive.insertMany(archiveDocs);
    }

    // 3. Pull SY's seminar IDs out of every employee's seminarsAttended[]
    if (seminarIds.length) {
      await Employee.updateMany(
        { seminarsAttended: { $in: seminarIds } },
        { $pull: { seminarsAttended: { $in: seminarIds } } }
      );
    }

    // 4. Delete the live registrations
    if (registrations.length) {
      await Registration.deleteMany({ _id: { $in: registrations.map((r) => r._id) } });
    }

    // 5. Copy seminars -> SeminarArchive, then delete from live
    if (seminars.length) {
      const seminarArchiveDocs = seminars.map((s) => ({
        schoolYear,
        archivedAt: new Date(),
        archivedBy: adminId,
        originalSeminarId: s._id,
        title: s.title,
        description: s.description,
        location: s.location,
        date: s.date,
        startTime: s.startTime,
        durationHours: s.durationHours,
        mandatory: s.mandatory,
        capacity: s.capacity,
        isHeld: s.isHeld,
        heldAt: s.heldAt,
        sessions: s.sessions,
        registeredEmployees: s.registeredEmployees,
        certificateReleaseMode: s.certificateReleaseMode,
        requiredSessionsToPass: s.requiredSessionsToPass,
        multiSessionType: s.multiSessionType,
        originalCreatedAt: s.createdAt,
        originalUpdatedAt: s.updatedAt,
      }));
      await SeminarArchive.insertMany(seminarArchiveDocs);

      // Cascade-delete related notifications/evaluations referencing those seminars
      await Notification.deleteMany({ seminarID: { $in: seminarIds } });
      await Evaluation.deleteMany({ seminarID: { $in: seminarIds } });
      await Seminar.deleteMany({ _id: { $in: seminarIds } });
    }

    // 6. Reset requiredSeminarsPerYear back to default for everyone (yearly stat)
    await Employee.updateMany({}, { $set: { requiredSeminarsPerYear: 5 } });

    // 7. Write maintenance log
    const log = await MaintenanceLog.create({
      action: 'school-year-reset',
      schoolYear,
      triggeredBy: adminId,
      triggeredByName: adminEmployee?.name || '',
      triggeredByEmail: adminEmployee?.email || req.user.email || '',
      triggeredAt: new Date(),
      counts: {
        registrationsArchived: registrations.length,
        seminarsArchived: seminars.length,
        employeesAffected: affectedEmployeeIds.length,
      },
      notes: String(notes || '').trim(),
    });

    res.json({
      message: 'School year reset complete',
      schoolYear,
      counts: log.counts,
      logId: log._id,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/maintenance/archives
router.get('/archives', authMiddleware, async (req, res, next) => {
  try {
    const years = await RegistrationArchive.aggregate([
      {
        $group: {
          _id: '$schoolYear',
          registrations: { $sum: 1 },
          certificates: { $sum: { $cond: ['$certificateIssued', 1, 0] } },
          employees: { $addToSet: '$employeeID' },
          firstArchivedAt: { $min: '$archivedAt' },
          lastArchivedAt: { $max: '$archivedAt' },
        },
      },
      {
        $project: {
          _id: 0,
          schoolYear: '$_id',
          registrations: 1,
          certificates: 1,
          employees: { $size: '$employees' },
          firstArchivedAt: 1,
          lastArchivedAt: 1,
        },
      },
      { $sort: { schoolYear: -1 } },
    ]);

    const seminarCounts = await SeminarArchive.aggregate([
      { $group: { _id: '$schoolYear', count: { $sum: 1 } } },
    ]);
    const seminarCountMap = new Map(seminarCounts.map((s) => [s._id, s.count]));
    years.forEach((y) => {
      y.seminars = seminarCountMap.get(y.schoolYear) || 0;
    });

    res.json({ archives: years });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/maintenance/archives/:schoolYear
router.get('/archives/:schoolYear', authMiddleware, async (req, res, next) => {
  try {
    const schoolYear = String(req.params.schoolYear);
    if (!isValidSchoolYear(schoolYear)) {
      return res.status(400).json({ message: 'Invalid schoolYear' });
    }

    const [seminars, registrations] = await Promise.all([
      SeminarArchive.find({ schoolYear }).sort({ date: 1 }).lean(),
      RegistrationArchive.find({ schoolYear }).sort({ archivedAt: 1 }).lean(),
    ]);

    // Group registrations by employee for a tidy view
    const byEmployee = new Map();
    for (const r of registrations) {
      const key = String(r.employeeID);
      if (!byEmployee.has(key)) {
        byEmployee.set(key, {
          employeeID: r.employeeID,
          employee: r.employeeSnapshot || {},
          registrations: [],
        });
      }
      byEmployee.get(key).registrations.push({
        seminarID: r.seminarID,
        seminar: r.seminarSnapshot || {},
        status: r.status,
        certificateIssued: r.certificateIssued,
        certificateCode: r.certificateCode,
        certificateIssuedAt: r.certificateIssuedAt,
        registeredAt: r.registeredAt,
      });
    }

    res.json({
      schoolYear,
      seminars,
      employees: [...byEmployee.values()],
      counts: {
        seminars: seminars.length,
        registrations: registrations.length,
        employees: byEmployee.size,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/maintenance/archives/:schoolYear/masterlist.xlsx
router.get('/archives/:schoolYear/masterlist.xlsx', authMiddleware, async (req, res, next) => {
  try {
    const schoolYear = String(req.params.schoolYear);
    if (!isValidSchoolYear(schoolYear)) {
      return res.status(400).json({ message: 'Invalid schoolYear' });
    }
    const rows = await buildMasterlistData(schoolYear, { source: 'archive' });
    const wb = await buildMasterlistWorkbook(schoolYear, rows);
    await sendWorkbook(res, `GIMS_Masterlist_${schoolYear}.xlsx`, wb);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/maintenance/archives/:schoolYear/restore
// body: { confirmPhrase, notes? }
// Moves an archived school year back into the live Seminar/Registration
// collections and re-adds the seminars to each affected employee's
// seminarsAttended[]. Then removes the archive docs.
router.post('/archives/:schoolYear/restore', authMiddleware, async (req, res, next) => {
  try {
    const schoolYear = String(req.params.schoolYear);
    if (!isValidSchoolYear(schoolYear)) {
      return res.status(400).json({ message: 'Invalid schoolYear' });
    }
    const { confirmPhrase, notes } = req.body || {};
    if (String(confirmPhrase || '').trim() !== RESET_PHRASE) {
      return res.status(400).json({ message: `Confirmation phrase must be exactly "${RESET_PHRASE}"` });
    }

    const adminEmployee = await Employee.findById(req.user.id).lean();
    const adminId = req.user.id;

    const seminarArchives = await SeminarArchive.find({ schoolYear }).lean();
    const regArchives = await RegistrationArchive.find({ schoolYear }).lean();

    if (!seminarArchives.length && !regArchives.length) {
      return res.status(404).json({ message: `No archive found for school year ${schoolYear}.` });
    }

    // Refuse if the live collections still contain a doc with the same ID
    // (would mean someone re-created records that collide with the archive).
    const seminarIds = seminarArchives.map((s) => s.originalSeminarId).filter(Boolean);
    const regIds = regArchives.map((r) => r.originalRegistrationId).filter(Boolean);
    const [seminarConflicts, regConflicts] = await Promise.all([
      seminarIds.length ? Seminar.find({ _id: { $in: seminarIds } }).select('_id').lean() : [],
      regIds.length ? Registration.find({ _id: { $in: regIds } }).select('_id').lean() : [],
    ]);
    if (seminarConflicts.length || regConflicts.length) {
      return res.status(409).json({
        message:
          `Cannot restore: ${seminarConflicts.length} seminar(s) and ` +
          `${regConflicts.length} registration(s) with conflicting IDs already exist live. ` +
          `Remove them first.`,
      });
    }

    // 1. Restore seminars
    if (seminarArchives.length) {
      const docs = seminarArchives.map((s) => ({
        _id: s.originalSeminarId,
        schoolYear: s.schoolYear,
        title: s.title,
        description: s.description || '',
        location: s.location || '',
        date: s.date,
        startTime: s.startTime,
        durationHours: s.durationHours,
        mandatory: !!s.mandatory,
        capacity: s.capacity,
        isHeld: !!s.isHeld,
        heldAt: s.heldAt,
        sessions: s.sessions || [],
        registeredEmployees: s.registeredEmployees || [],
        certificateReleaseMode: s.certificateReleaseMode,
        requiredSessionsToPass: s.requiredSessionsToPass,
        multiSessionType: s.multiSessionType,
        createdAt: s.originalCreatedAt,
        updatedAt: s.originalUpdatedAt,
      }));
      await Seminar.insertMany(docs);
    }

    // 2. Restore registrations
    if (regArchives.length) {
      const docs = regArchives.map((r) => ({
        _id: r.originalRegistrationId,
        seminarID: r.seminarID,
        employeeID: r.employeeID,
        schoolYear: r.schoolYear,
        registeredAt: r.registeredAt,
        status: r.status,
        certificateIssued: !!r.certificateIssued,
        certificateIssuedAt: r.certificateIssuedAt,
        certificateCode: r.certificateCode,
        evaluationAvailable: !!r.evaluationAvailable,
        evaluationCompleted: !!r.evaluationCompleted,
        sessionAttendance: r.sessionAttendance || [],
        chosenSessionId: r.chosenSessionId || null,
        createdAt: r.originalCreatedAt,
        updatedAt: r.originalUpdatedAt,
      }));
      await Registration.insertMany(docs);
    }

    // 3. Re-add seminars to each affected employee's seminarsAttended[]
    const employeeToSeminars = new Map();
    for (const r of regArchives) {
      if (!r.employeeID || !r.seminarID) continue;
      const k = String(r.employeeID);
      if (!employeeToSeminars.has(k)) employeeToSeminars.set(k, new Set());
      employeeToSeminars.get(k).add(String(r.seminarID));
    }
    const bulkOps = [];
    for (const [empId, sIds] of employeeToSeminars) {
      bulkOps.push({
        updateOne: {
          filter: { _id: empId },
          update: { $addToSet: { seminarsAttended: { $each: [...sIds] } } },
        },
      });
    }
    if (bulkOps.length) await Employee.bulkWrite(bulkOps);

    // 4. Delete archive docs for this school year
    await Promise.all([
      SeminarArchive.deleteMany({ schoolYear }),
      RegistrationArchive.deleteMany({ schoolYear }),
    ]);

    // 5. Audit log
    const log = await MaintenanceLog.create({
      action: 'school-year-restore',
      schoolYear,
      triggeredBy: adminId,
      triggeredByName: adminEmployee?.name || '',
      triggeredByEmail: adminEmployee?.email || req.user.email || '',
      triggeredAt: new Date(),
      counts: {
        seminarsRestored: seminarArchives.length,
        registrationsRestored: regArchives.length,
        employeesAffected: employeeToSeminars.size,
      },
      notes: String(notes || '').trim(),
    });

    res.json({
      message: 'Archive restored to live collections',
      schoolYear,
      counts: log.counts,
      logId: log._id,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/maintenance/logs
router.get('/logs', authMiddleware, async (req, res, next) => {
  try {
    const logs = await MaintenanceLog.find({})
      .sort({ triggeredAt: -1 })
      .limit(100)
      .lean();
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/maintenance/backfill-school-year
// One-time helper: stamps existing seminars/registrations that have no schoolYear.
router.post('/backfill-school-year', authMiddleware, async (req, res, next) => {
  try {
    const seminars = await Seminar.find({
      $or: [{ schoolYear: null }, { schoolYear: '' }, { schoolYear: { $exists: false } }],
    });
    let seminarsUpdated = 0;
    for (const s of seminars) {
      const sy = getSchoolYear(s.date);
      if (sy) {
        s.schoolYear = sy;
        await s.save();
        seminarsUpdated += 1;
      }
    }

    // For registrations: derive from the linked seminar's schoolYear
    const regs = await Registration.find({
      $or: [{ schoolYear: null }, { schoolYear: '' }, { schoolYear: { $exists: false } }],
    });
    let registrationsUpdated = 0;
    const seminarYearCache = new Map();
    for (const r of regs) {
      let sy = seminarYearCache.get(String(r.seminarID));
      if (sy === undefined) {
        const s = await Seminar.findById(r.seminarID).select('schoolYear date').lean();
        sy = s?.schoolYear || (s?.date ? getSchoolYear(s.date) : null);
        seminarYearCache.set(String(r.seminarID), sy);
      }
      if (sy) {
        r.schoolYear = sy;
        await r.save();
        registrationsUpdated += 1;
      }
    }

    res.json({
      message: 'Backfill complete',
      seminarsUpdated,
      registrationsUpdated,
    });
  } catch (err) {
    next(err);
  }
});

// Quick-add a past seminar that ran outside GIMS (e.g. during downtime).
// Creates the seminar already marked as held, so it can be used immediately
// by the attendance import flow.
router.post('/seminars/past', authMiddleware, async (req, res, next) => {
  try {
    const {
      title,
      date,
      startTime,
      endTime,
      durationHours,
      location,
      resourcePerson,
      description,
      mandatory,
      capacity,
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: 'Seminar title is required.' });
    }
    if (!date) {
      return res.status(400).json({ message: 'Date is required.' });
    }

    const cleanTitle = String(title).trim();

    const existing = await Seminar.findOne({ title: cleanTitle, isDeleted: { $ne: true } });
    if (existing) {
      return res.status(409).json({
        message: `A seminar titled "${cleanTitle}" already exists. Use the attendance import directly.`,
        seminar: { id: existing._id, title: existing.title, isHeld: existing.isHeld },
      });
    }

    const heldDate = new Date(date);
    if (Number.isNaN(heldDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date.' });
    }

    const seminar = await Seminar.create({
      title: cleanTitle,
      description: String(description || '').trim() || `Past seminar recorded via Maintenance backfill on ${new Date().toISOString().slice(0, 10)}.`,
      location: String(location || '').trim(),
      resourcePerson: String(resourcePerson || '').trim(),
      date: heldDate,
      startTime: String(startTime || '08:00').trim(),
      endTime: String(endTime || '').trim(),
      durationHours: Number(durationHours) > 0 ? Number(durationHours) : 1,
      mandatory: mandatory === true || mandatory === 'true',
      capacity: Number(capacity) > 0 ? Number(capacity) : 999,
      isHeld: true,
      heldAt: new Date(),
      createdBy: req.user?.id,
      certificateReleaseMode: 'evaluation',
    });

    try {
      await MaintenanceLog.create({
        action: 'attendance-import',
        schoolYear: getSchoolYear(heldDate) || currentSchoolYear() || 'unknown',
        triggeredBy: req.user?.id,
        triggeredByEmail: req.user?.email,
        notes: `Past seminar backfilled: "${cleanTitle}" (${heldDate.toISOString().slice(0, 10)}).`,
      });
    } catch (logErr) {
      console.error('Failed to write past-seminar maintenance log:', logErr.message);
    }

    res.status(201).json({
      message: 'Past seminar created. You can now import attendance for it.',
      seminar,
    });
  } catch (err) {
    next(err);
  }
});

// ============== Database Snapshot (in-Atlas backup) ==============

router.get('/snapshot/status', authMiddleware, async (req, res, next) => {
  try {
    const status = await getSnapshotStatus();
    res.json({
      backupDatabase: BACKUP_DATABASE_NAME,
      ...status,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/snapshot', authMiddleware, async (req, res, next) => {
  try {
    const result = await runSnapshot({ triggeredBy: req.user?.email || 'admin' });

    try {
      await MaintenanceLog.create({
        action: 'snapshot-create',
        schoolYear: currentSchoolYear() || 'unknown',
        triggeredBy: req.user?.id,
        triggeredByEmail: req.user?.email,
        counts: {
          registrationsArchived: 0,
          seminarsArchived: 0,
          employeesAffected: 0,
          registrationsRestored: result.totalDocs,
          seminarsRestored: result.collections.length,
        },
        notes: `Manual snapshot: ${result.totalDocs} docs across ${result.collections.length} collections.`,
      });
    } catch (logErr) {
      console.error('[snapshot] failed to write maintenance log:', logErr.message);
    }

    res.json({
      message: 'Snapshot created.',
      totalDocs: result.totalDocs,
      collections: result.collections,
      snapshotAt: result.finishedAt,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/snapshot/restore', authMiddleware, async (req, res, next) => {
  try {
    const phrase = String(req.body?.phrase || '').trim();
    if (phrase !== RESTORE_PHRASE) {
      return res.status(400).json({
        message: `To restore, type exactly: ${RESTORE_PHRASE}`,
      });
    }

    const status = await getSnapshotStatus();
    if (!status?.exists) {
      return res.status(400).json({
        message: 'No snapshot exists yet. Run "Snapshot Now" first.',
      });
    }

    const result = await restoreFromSnapshot({ triggeredBy: req.user?.email || 'admin' });

    try {
      await MaintenanceLog.create({
        action: 'snapshot-restore',
        schoolYear: currentSchoolYear() || 'unknown',
        triggeredBy: req.user?.id,
        triggeredByEmail: req.user?.email,
        counts: {
          registrationsArchived: 0,
          seminarsArchived: 0,
          employeesAffected: 0,
          registrationsRestored: result.totalDocs,
          seminarsRestored: result.collections.length,
        },
        notes: `Restored from snapshot taken ${status.snapshotAt ? new Date(status.snapshotAt).toISOString() : 'unknown'}. ${result.totalDocs} docs across ${result.collections.length} collections.`,
      });
    } catch (logErr) {
      console.error('[snapshot] failed to write restore maintenance log:', logErr.message);
    }

    res.json({
      message: 'Database restored from snapshot.',
      totalDocs: result.totalDocs,
      collections: result.collections,
      restoredFrom: status.snapshotAt,
    });
  } catch (err) {
    next(err);
  }
});

// ============== Weekly CSV Export (human-held backup) ==============

const WEEKLY_EXPORT_DAYS = Number(process.env.WEEKLY_EXPORT_DAYS || 7);

const csvEscape = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  let s;
  if (typeof value === 'object') {
    try { s = JSON.stringify(value); } catch { s = String(value); }
  } else {
    s = String(value);
  }
  // RFC 4180: quote if contains comma, quote, newline; escape quotes by doubling.
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const buildCsvForCollection = async (collName) => {
  const db = (await import('mongoose')).default.connection.db;
  const coll = db.collection(collName);
  const docs = await coll.find({}).toArray();
  if (!docs.length) return `# ${collName} (0 rows)\n\n`;

  // Determine column union across all docs so heterogeneous documents still render.
  const colSet = new Set();
  for (const doc of docs) {
    Object.keys(doc).forEach((k) => colSet.add(k));
  }
  // Prefer _id and createdAt first when present
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

router.get('/weekly-export.csv', authMiddleware, async (req, res, next) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const db = mongoose.connection.db;
    const allColls = await db.listCollections({}, { nameOnly: false }).toArray();
    const names = allColls
      .filter((c) => c.type === 'collection' && !c.name.startsWith('system.'))
      .map((c) => c.name)
      .sort();

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="GIMS-Weekly-Backup-${stamp}.csv"`
    );

    res.write(`# GIMS Weekly Backup\r\n`);
    res.write(`# Generated at: ${new Date().toISOString()}\r\n`);
    res.write(`# Collections: ${names.length}\r\n`);
    res.write(`\r\n`);

    for (const name of names) {
      const block = await buildCsvForCollection(name);
      res.write(block);
    }
    res.end();

    // Log the download (best-effort, don't fail the response if logging fails).
    MaintenanceLog.create({
      action: 'weekly-export-download',
      schoolYear: currentSchoolYear() || 'unknown',
      triggeredBy: req.user?.id,
      triggeredByEmail: req.user?.email,
      notes: `Weekly backup CSV downloaded (${names.length} collections).`,
    }).catch((err) => console.error('[weekly-export] log failed:', err.message));
  } catch (err) {
    next(err);
  }
});

router.post('/weekly-export/confirm', authMiddleware, async (req, res, next) => {
  try {
    await MaintenanceLog.create({
      action: 'weekly-export-confirmed',
      schoolYear: currentSchoolYear() || 'unknown',
      triggeredBy: req.user?.id,
      triggeredByEmail: req.user?.email,
      notes: 'Admin confirmed they saved the weekly backup CSV.',
    });
    res.json({ message: 'Weekly backup confirmed. Thank you.', confirmedAt: new Date() });
  } catch (err) {
    next(err);
  }
});

// Manual trigger for the Google Drive backup. Useful for testing without
// waiting for the scheduled run.
router.post('/drive-backup/run', authMiddleware, async (req, res, next) => {
  try {
    const result = await runDriveBackupNow();
    res.json({
      message: 'Backup uploaded to Google Drive.',
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/drive-backup/status', authMiddleware, async (req, res, next) => {
  try {
    const status = await getLatestDriveBackup();
    res.json(status);
  } catch (err) {
    res.status(200).json({ configured: true, error: err.message });
  }
});

router.get('/weekly-export/status', authMiddleware, async (req, res, next) => {
  try {
    const last = await MaintenanceLog.findOne({ action: 'weekly-export-confirmed' })
      .sort({ createdAt: -1 })
      .select('createdAt triggeredByEmail');

    const intervalMs = WEEKLY_EXPORT_DAYS * 24 * 60 * 60 * 1000;
    let daysSince = null;
    let isOverdue = true;
    let isUpcoming = false;
    let nextDueAt = null;
    let lastConfirmedAt = null;
    let lastConfirmedBy = null;

    if (last) {
      lastConfirmedAt = last.createdAt;
      lastConfirmedBy = last.triggeredByEmail || null;
      const ageMs = Date.now() - new Date(last.createdAt).getTime();
      daysSince = ageMs / (24 * 60 * 60 * 1000);
      isOverdue = ageMs >= intervalMs;
      isUpcoming = !isOverdue && ageMs >= (intervalMs - 2 * 24 * 60 * 60 * 1000);
      nextDueAt = new Date(new Date(last.createdAt).getTime() + intervalMs);
    }

    res.json({
      intervalDays: WEEKLY_EXPORT_DAYS,
      lastConfirmedAt,
      lastConfirmedBy,
      daysSince,
      isOverdue,
      isUpcoming,
      nextDueAt,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
