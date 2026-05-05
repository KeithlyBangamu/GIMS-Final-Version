import express from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

import PinVerification from '../models/PinVerification.js';
import PasswordReset from '../models/PasswordReset.js';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import { sendPasswordResetPinEmail, sendVerificationPinEmail } from '../services/emailService.js';

const router = express.Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const EMAIL_DOMAINS = ['@xu.edu.ph', '@my.xu.edu.ph'];

const isValidXUEmail = (email) => {
  if (!email) return false;
  const trimmed = String(email).trim().toLowerCase();
  return EMAIL_DOMAINS.some((domain) => trimmed.endsWith(domain));
};

const generatePin = () => {
  return String(Math.floor(100000 + Math.random() * 900000));
};

const generateTemporaryPassword = () => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `Gad-${randomPart}${String(Date.now()).slice(-4)}`;
};

router.post('/send-pin', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'XU email is required.' });
    }
    if (!isValidXUEmail(email)) {
      return res
        .status(400)
        .json({ message: 'Only @xu.edu.ph or @my.xu.edu.ph emails are allowed.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ username: normalizedEmail });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: 'This email is already registered. Please sign in instead or use “Forgot password?”.' });
    }

    const code = generatePin();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await PinVerification.create({
      email: normalizedEmail,
      code,
      expiresAt,
    });

    await sendVerificationPinEmail(email, code, expiresAt);

    return res.json({ message: 'Verification PIN sent. Please check your email.' });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password/request', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'XU email is required.' });
    }
    if (!isValidXUEmail(email)) {
      return res
        .status(400)
        .json({ message: 'Only @xu.edu.ph or @my.xu.edu.ph emails are allowed.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ username: normalizedEmail, role: 'employee' });
    if (!user) {
      return res.status(404).json({ message: 'No employee account was found for this email.' });
    }

    const employee = await Employee.findById(user.employee).select('accountStatus');
    if (employee?.accountStatus === 'deactivated') {
      return res.status(403).json({ message: 'This account is deactivated. Please contact the GAD office.' });
    }

    const code = generatePin();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await PasswordReset.create({
      email: normalizedEmail,
      code,
      expiresAt,
    });

    await sendPasswordResetPinEmail(normalizedEmail, code, expiresAt);

    return res.json({ message: 'Password reset PIN sent. Please check your email.' });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password/verify', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and PIN are required.' });
    }
    if (!isValidXUEmail(email)) {
      return res
        .status(400)
        .json({ message: 'Only @xu.edu.ph or @my.xu.edu.ph emails are allowed.' });
    }

    const now = new Date();
    const record = await PasswordReset.findOne({
      email: email.toLowerCase().trim(),
      code: String(code).trim(),
      expiresAt: { $gt: now },
      usedAt: { $exists: false },
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired PIN.' });
    }

    record.usedAt = new Date();
    await record.save();

    const token = jwt.sign(
      {
        email: email.toLowerCase().trim(),
        scope: 'password-reset',
      },
      process.env.JWT_SECRET || 'gims-secret',
      { expiresIn: '10m' }
    );

    return res.json({ token });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password/confirm', async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }
    const token = header.replace('Bearer ', '');

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'gims-secret');
    } catch {
      return res.status(401).json({ message: 'Invalid or expired reset token.' });
    }

    if (payload.scope !== 'password-reset' || !payload.email) {
      return res.status(403).json({ message: 'Invalid reset scope.' });
    }

    const { password } = req.body;
    if (!password || String(password).trim().length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    const user = await User.findOne({ username: payload.email.toLowerCase().trim(), role: 'employee' });
    if (!user) {
      return res.status(404).json({ message: 'Employee account not found.' });
    }

    await user.setPassword(String(password).trim());
    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-pin', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and PIN are required.' });
    }
    if (!isValidXUEmail(email)) {
      return res
        .status(400)
        .json({ message: 'Only @xu.edu.ph or @my.xu.edu.ph emails are allowed.' });
    }

    const now = new Date();
    const record = await PinVerification.findOne({
      email: email.toLowerCase().trim(),
      code: String(code).trim(),
      expiresAt: { $gt: now },
      usedAt: { $exists: false },
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired PIN.' });
    }

    record.usedAt = new Date();
    await record.save();

    const token = jwt.sign(
      {
        email: email.toLowerCase().trim(),
        scope: 'registration',
      },
      process.env.JWT_SECRET || 'gims-secret',
      { expiresIn: '10m' }
    );

    return res.json({ token });
  } catch (err) {
    next(err);
  }
});

router.post('/create-account', async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) {
      return res.status(401).json({ message: 'Missing Authorization header' });
    }
    const token = header.replace('Bearer ', '');

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'gims-secret');
    } catch {
      return res.status(401).json({ message: 'Invalid or expired registration token.' });
    }

    if (payload.scope !== 'registration' || !payload.email) {
      return res.status(403).json({ message: 'Invalid registration scope.' });
    }

    const { firstName, lastName, department, position, birthSex, genderIdentity, password } = req.body;

    if (!firstName || !lastName || !department || !position || !birthSex || !password) {
      return res
        .status(400)
        .json({ message: 'First Name, Last Name, Department, Position, Birth Sex, and Password are required.' });
    }

    const existing = await Employee.findOne({ email: payload.email });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const employee = await Employee.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: fullName,
      email: payload.email,
      department,
      position,
      birthSex: String(birthSex || '').trim(),
      genderIdentity: genderIdentity || undefined,
      role: 'employee',
    });

    const user = new User({
      username: payload.email,
      role: 'employee',
      passwordHash: '',
      employee: employee._id,
    });
    await user.setPassword(password);
    await user.save();

    const sessionToken = jwt.sign(
      { id: employee._id, role: employee.role, email: employee.email },
      process.env.JWT_SECRET || 'gims-secret',
      { expiresIn: '8h' }
    );

    return res.status(201).json({
      message: 'Account created successfully.',
      employee,
      token: sessionToken,
    });
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

    const user = await User.findOne({ username: email.toLowerCase().trim() }).populate('employee');
    if (!user || !(await user.validatePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const role = user.role;
    const employeeDoc = user.employee;

    // For employees we expect an attached employee document
    if (role === 'employee' && !employeeDoc) {
      return res.status(401).json({ message: 'Employee profile not found.' });
    }
    if (role === 'employee' && employeeDoc?.accountStatus === 'deactivated') {
      return res.status(403).json({ message: 'Your account is deactivated. Please contact the GAD office.' });
    }

    const id = employeeDoc?._id || user._id;

    const token = jwt.sign(
      { id, role, email: email.toLowerCase().trim() },
      process.env.JWT_SECRET || 'gims-secret',
      { expiresIn: '8h' }
    );

    return res.json({ token, role });
  } catch (err) {
    next(err);
  }
});

router.get('/google-config', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || '' });
});

router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Missing Google credential.' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: 'Google sign-in is not configured on the server.' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: 'Invalid Google credential.' });
    }

    const email = String(payload?.email || '').toLowerCase().trim();
    if (!payload?.email_verified) {
      return res.status(401).json({ message: 'Google email is not verified.' });
    }
    if (!isValidXUEmail(email)) {
      return res.status(403).json({ message: 'Only @xu.edu.ph or @my.xu.edu.ph accounts can sign in.' });
    }

    const user = await User.findOne({ username: email }).populate('employee');
    if (!user) {
      const profileToken = jwt.sign(
        {
          email,
          scope: 'google-profile-completion',
          firstName: payload?.given_name || '',
          lastName: payload?.family_name || '',
        },
        process.env.JWT_SECRET || 'gims-secret',
        { expiresIn: '15m' }
      );
      return res.status(200).json({
        needsProfile: true,
        profileToken,
        email,
        firstName: payload?.given_name || '',
        lastName: payload?.family_name || '',
      });
    }
    if (user.role === 'employee' && !user.employee) {
      return res.status(401).json({ message: 'Employee profile not found.' });
    }
    if (user.role === 'employee' && user.employee?.accountStatus === 'deactivated') {
      return res.status(403).json({ message: 'Your account is deactivated. Please contact the GAD office.' });
    }

    const id = user.employee?._id || user._id;
    const token = jwt.sign(
      { id, role: user.role, email },
      process.env.JWT_SECRET || 'gims-secret',
      { expiresIn: '8h' }
    );

    return res.json({ token, role: user.role });
  } catch (err) {
    next(err);
  }
});

router.post('/google/complete-account', async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ message: 'Missing Authorization header' });
    const token = header.replace('Bearer ', '');

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'gims-secret');
    } catch {
      return res.status(401).json({ message: 'Invalid or expired profile token.' });
    }
    if (payload.scope !== 'google-profile-completion' || !payload.email) {
      return res.status(403).json({ message: 'Invalid profile scope.' });
    }
    if (!isValidXUEmail(payload.email)) {
      return res.status(403).json({ message: 'Only @xu.edu.ph or @my.xu.edu.ph accounts can sign in.' });
    }

    const { firstName, lastName, department, position, birthSex, genderIdentity } = req.body;
    const fName = String(firstName || payload.firstName || '').trim();
    const lName = String(lastName || payload.lastName || '').trim();

    if (!fName || !lName || !department || !position || !birthSex) {
      return res.status(400).json({
        message: 'First Name, Last Name, Department, Position, and Birth Sex are required.',
      });
    }

    const existingUser = await User.findOne({ username: payload.email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }
    const existingEmployee = await Employee.findOne({ email: payload.email });
    if (existingEmployee) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const fullName = `${fName} ${lName}`;
    const employee = await Employee.create({
      firstName: fName,
      lastName: lName,
      name: fullName,
      email: payload.email,
      department,
      position,
      birthSex: String(birthSex || '').trim(),
      genderIdentity: genderIdentity || undefined,
      role: 'employee',
    });

    // Random password that satisfies the password policy. Google sign-in is the auth path,
    // but the User schema requires a passwordHash. The user can later set a real password
    // via the existing forgot-password flow if they want password login too.
    const randomPassword = `Goog!e-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;

    const user = new User({
      username: payload.email,
      role: 'employee',
      passwordHash: '',
      employee: employee._id,
    });
    await user.setPassword(randomPassword);
    await user.save();

    const sessionToken = jwt.sign(
      { id: employee._id, role: employee.role, email: employee.email },
      process.env.JWT_SECRET || 'gims-secret',
      { expiresIn: '8h' }
    );

    return res.status(201).json({
      message: 'Account created successfully.',
      employee,
      token: sessionToken,
      role: 'employee',
    });
  } catch (err) {
    next(err);
  }
});

export default router;

