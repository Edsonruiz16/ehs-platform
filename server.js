/**
 * EHS Platform — servidor único.
 * Sirve la página única (public/index.html) + API REST sobre MongoDB.
 * Núcleo: Pirámide de Heinrich (heinrich_records) + motor único de acciones (actions).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const XLSX = require('xlsx');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ehs_platform';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// ---------------------------------------------------------------------------
// Seguridad: Rate limiting y control de intentos fallidos
// ---------------------------------------------------------------------------
const loginAttempts = new Map();
const registrationIPs = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutos
const MAX_REGISTRATIONS_PER_IP = 3;
const REGISTRATION_WINDOW = 24 * 60 * 60 * 1000; // 24 horas

function recordLoginAttempt(email) {
  const key = email.toLowerCase();
  const now = Date.now();
  if (!loginAttempts.has(key)) loginAttempts.set(key, []);
  const attempts = loginAttempts.get(key).filter(t => now - t < LOGIN_ATTEMPT_WINDOW);
  attempts.push(now);
  loginAttempts.set(key, attempts);
  return attempts.length;
}

function isAccountLocked(email) {
  const key = email.toLowerCase();
  const attempts = loginAttempts.get(key) || [];
  return attempts.length >= MAX_LOGIN_ATTEMPTS;
}

function recordRegistration(ip) {
  const now = Date.now();
  if (!registrationIPs.has(ip)) registrationIPs.set(ip, []);
  const regs = registrationIPs.get(ip).filter(t => now - t < REGISTRATION_WINDOW);
  regs.push(now);
  registrationIPs.set(ip, regs);
  return regs.length;
}

function validatePassword(password) {
  if (password.length < 8) return 'Mínimo 8 caracteres';
  if (!/[a-z]/.test(password)) return 'Debe incluir minúsculas';
  if (!/[A-Z]/.test(password)) return 'Debe incluir mayúsculas';
  if (!/[0-9]/.test(password)) return 'Debe incluir números';
  return null;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------------------------------------------------------------------------
// Constantes de dominio
// ---------------------------------------------------------------------------
const LEVELS = [
  'ACTO_INSEGURO', 'CONDICION_INSEGURA', 'CASI_INCIDENTE', 'PRIMEROS_AUXILIOS',
  'TRATAMIENTO_MEDICO', 'ACTIVIDAD_RESTRINGIDA', 'LOST_TIME', 'FATALIDAD',
];
const SOURCES = ['STOP', 'COMMISSION', 'INCIDENT', 'IPERC', 'EXCEL'];
const RISKS = ['BAJO', 'MEDIO', 'ALTO'];
const ACTION_STATUS = ['ABIERTA', 'EN_PROCESO', 'CERRADA'];
const ROLES = ['ADMIN', 'CAPTURISTA', 'CONSULTA'];

// ---------------------------------------------------------------------------
// Modelos
// ---------------------------------------------------------------------------
const { Schema, model, Types } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'CAPTURISTA' },
  area: String,
  active: { type: Boolean, default: true },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lockedUntil: { type: Date, select: false },
}, { timestamps: true });
userSchema.methods.comparePassword = function (c) { return bcrypt.compare(c, this.password); };
const User = model('User', userSchema);

const areaSchema = new Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
}, { timestamps: true });
const Area = model('Area', areaSchema);

const heinrichSchema = new Schema({
  folio: { type: String, required: true },
  date: { type: Date, required: true, index: true },
  level: { type: String, enum: LEVELS, required: true, index: true },
  severity: Number,
  risk: { type: String, enum: RISKS },
  source: { type: String, enum: SOURCES, required: true, index: true },
  sourceRef: Schema.Types.ObjectId,
  area: { type: String, index: true },
  machine: String,
  description: String,
}, { timestamps: true });
heinrichSchema.index({ folio: 1, source: 1 }, { unique: true });
heinrichSchema.index({ date: -1, area: 1, level: 1 });
const Heinrich = model('HeinrichRecord', heinrichSchema);

const actionSchema = new Schema({
  folio: { type: String, required: true },
  source: { type: String, enum: SOURCES, required: true, index: true },
  sourceRef: Schema.Types.ObjectId,
  area: { type: String, index: true },
  machine: String,
  description: { type: String, required: true },
  requiredAction: { type: String, required: true },
  risk: { type: String, enum: RISKS, default: 'MEDIO', index: true },
  responsible: { type: String, required: true, index: true },
  dueDate: { type: Date, index: true },
  status: { type: String, enum: ACTION_STATUS, default: 'ABIERTA', index: true },
  closedAt: Date,
  comments: String,
}, { timestamps: true });
actionSchema.index({ folio: 1, source: 1 }, { unique: true });
const Action = model('Action', actionSchema);

// Fuentes de negocio
const stopSchema = new Schema({
  folio: { type: String, required: true, unique: true },
  date: { type: Date, required: true },
  observer: { type: String, required: true },
  area: { type: String, required: true },
  machine: String,
  description: { type: String, required: true },
  level: { type: String, enum: LEVELS, default: 'ACTO_INSEGURO' },
  risk: { type: String, enum: RISKS, default: 'MEDIO' },
  requiredAction: String,
  responsible: String,
  dueDate: Date,
}, { timestamps: true });
const Stop = model('ObservationStop', stopSchema);

const commissionSchema = new Schema({
  folio: { type: String, required: true, unique: true },
  date: { type: Date, required: true },
  auditor: { type: String, required: true },
  area: { type: String, required: true },
  machine: String,
  description: { type: String, required: true },
  level: { type: String, enum: LEVELS, default: 'CONDICION_INSEGURA' },
  risk: { type: String, enum: RISKS, default: 'MEDIO' },
  correctiveAction: String,
  responsible: String,
  dueDate: Date,
}, { timestamps: true });
const Commission = model('ObservationCommission', commissionSchema);

const incidentSchema = new Schema({
  folio: { type: String, required: true, unique: true },
  eventDate: { type: Date, required: true },
  area: { type: String, required: true },
  machine: String,
  person: String,
  description: { type: String, required: true },
  level: { type: String, enum: LEVELS, default: 'CASI_INCIDENTE' },
  severity: { type: Number, min: 1, max: 5 },
  lostDays: { type: Number, default: 0 },
  rootCause: String,
  correctiveAction: String,
  responsible: String,
  dueDate: Date,
  risk: { type: String, enum: RISKS, default: 'ALTO' },
}, { timestamps: true });
const Incident = model('Incident', incidentSchema);

const ipercSchema = new Schema({
  folio: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
  area: { type: String, required: true },
  process: String,
  machine: String,
  risk: { type: String, required: true },
  riskLevel: { type: String, enum: RISKS, default: 'MEDIO' },
  description: { type: String, required: true },
  requiredAction: { type: String, required: true },
  responsible: { type: String, required: true },
  dueDate: Date,
  status: { type: String, enum: ACTION_STATUS, default: 'ABIERTA' },
  comments: String,
}, { timestamps: true });
const Iperc = model('IpercAction', ipercSchema);

const importJobSchema = new Schema({
  fileName: String,
  target: String,
  total: Number,
  inserted: Number,
  rejectedCount: Number,
  rejected: [{ row: Number, folio: String, reason: String, _id: false }],
}, { timestamps: true });
const ImportJob = model('ImportJob', importJobSchema);

// ---------------------------------------------------------------------------
// Consolidación: emisión a pirámide y motor de acciones
// ---------------------------------------------------------------------------
async function emitHeinrich(d) {
  await Heinrich.findOneAndUpdate(
    { folio: d.folio, source: d.source },
    { $set: d },
    { upsert: true, setDefaultsOnInsert: true }
  );
}
async function upsertAction(d) {
  if (!d.requiredAction || !d.responsible) return;
  await Action.findOneAndUpdate(
    { folio: d.folio, source: d.source },
    {
      $set: {
        sourceRef: d.sourceRef, area: d.area, machine: d.machine, description: d.description,
        requiredAction: d.requiredAction, risk: d.risk, responsible: d.responsible, dueDate: d.dueDate,
      },
      $setOnInsert: { status: d.status || 'ABIERTA' },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

async function consolidateStop(doc) {
  await emitHeinrich({ folio: doc.folio, date: doc.date, level: doc.level, source: 'STOP', sourceRef: doc._id, risk: doc.risk, area: doc.area, machine: doc.machine, description: doc.description });
  await upsertAction({ folio: doc.folio, source: 'STOP', sourceRef: doc._id, area: doc.area, machine: doc.machine, description: doc.description, requiredAction: doc.requiredAction, risk: doc.risk, responsible: doc.responsible, dueDate: doc.dueDate });
}
async function consolidateCommission(doc) {
  await emitHeinrich({ folio: doc.folio, date: doc.date, level: doc.level, source: 'COMMISSION', sourceRef: doc._id, risk: doc.risk, area: doc.area, machine: doc.machine, description: doc.description });
  await upsertAction({ folio: doc.folio, source: 'COMMISSION', sourceRef: doc._id, area: doc.area, machine: doc.machine, description: doc.description, requiredAction: doc.correctiveAction, risk: doc.risk, responsible: doc.responsible, dueDate: doc.dueDate });
}
async function consolidateIncident(doc) {
  await emitHeinrich({ folio: doc.folio, date: doc.eventDate, level: doc.level, source: 'INCIDENT', sourceRef: doc._id, severity: doc.severity, risk: doc.risk, area: doc.area, machine: doc.machine, description: doc.description });
  await upsertAction({ folio: doc.folio, source: 'INCIDENT', sourceRef: doc._id, area: doc.area, machine: doc.machine, description: doc.description, requiredAction: doc.correctiveAction, risk: doc.risk, responsible: doc.responsible, dueDate: doc.dueDate });
}
async function consolidateIperc(doc) {
  await upsertAction({ folio: doc.folio, source: 'IPERC', sourceRef: doc._id, area: doc.area, machine: doc.machine, description: doc.description, requiredAction: doc.requiredAction, risk: doc.riskLevel, responsible: doc.responsible, dueDate: doc.dueDate, status: doc.status });
}

function dueState(a) {
  if (a.status === 'CERRADA') return 'CERRADA';
  if (!a.dueDate) return 'AL_DIA';
  const diff = (new Date(a.dueDate).getTime() - Date.now()) / 86400000;
  if (diff < 0) return 'VENCIDA';
  if (diff <= 7) return 'POR_VENCER';
  return 'AL_DIA';
}

// ---------------------------------------------------------------------------
// App + auth
// ---------------------------------------------------------------------------
const app = express();
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN || '*' : '*' }));
app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

function sign(user) {
  return jwt.sign({ id: String(user._id), name: user.name, email: user.email, role: user.role, area: user.area }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function protect(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return res.status(401).json({ message: 'Token no proporcionado' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); }
  catch { return res.status(401).json({ message: 'Token inválido o expirado' }); }
}
function canWrite(req, res, next) {
  if (req.user && req.user.role !== 'CONSULTA') return next();
  return res.status(403).json({ message: 'Sin permisos de escritura' });
}
function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'ADMIN') return next();
  return res.status(403).json({ message: 'Solo administradores' });
}
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  const code = e.code === 11000 ? 409 : 400;
  res.status(code).json({ message: e.code === 11000 ? 'Folio duplicado' : e.message });
});

// Filtro global a partir de query params.
function buildFilter(q, dateField = 'date') {
  const f = {};
  const df = {};
  if (q.from) df.$gte = new Date(q.from);
  if (q.to) df.$lte = new Date(q.to);
  if (q.year || q.month) {
    const y = Number(q.year) || new Date().getFullYear(); // si no hay año, usa el actual
    if (q.month) { const m = Number(q.month) - 1; df.$gte = new Date(y, m, 1); df.$lte = new Date(y, m + 1, 0, 23, 59, 59); }
    else { df.$gte = new Date(y, 0, 1); df.$lte = new Date(y, 11, 31, 23, 59, 59); }
  }
  if (Object.keys(df).length) f[dateField] = df;
  ['area', 'machine', 'source', 'status', 'risk', 'responsible', 'level'].forEach((k) => { if (q[k]) f[k] = q[k]; });
  return f;
}

const api = express.Router();

// --- Auth ---
api.post('/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email y contraseña requeridos' });
  if (!validateEmail(email)) return res.status(400).json({ message: 'Email inválido' });

  const now = new Date();
  const user = await User.findOne({ email: (email || '').toLowerCase(), active: true }).select('+password +failedLoginAttempts +lockedUntil');

  if (!user) { recordLoginAttempt(email); return res.status(401).json({ message: 'Credenciales inválidas' }); }
  if (user.lockedUntil && user.lockedUntil > now) return res.status(429).json({ message: 'Cuenta bloqueada por seguridad. Intenta más tarde.' });
  if (!(await user.comparePassword(password))) {
    recordLoginAttempt(email);
    const attempts = recordLoginAttempt(email);
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      await User.updateOne({ _id: user._id }, { lockedUntil: new Date(now.getTime() + 30 * 60 * 1000) });
      return res.status(429).json({ message: 'Cuenta bloqueada por seguridad (demasiados intentos fallidos).' });
    }
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  await User.updateOne({ _id: user._id }, { failedLoginAttempts: 0, lockedUntil: null });
  res.json({ token: sign(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
}));
api.post('/auth/register', wrap(async (req, res) => {
  const { name, email, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  if (!name || !email || !password) return res.status(400).json({ message: 'Nombre, email y contraseña requeridos' });
  if (!validateEmail(email)) return res.status(400).json({ message: 'Email inválido' });
  if (name.length < 2 || name.length > 100) return res.status(400).json({ message: 'Nombre debe tener 2-100 caracteres' });

  const passErr = validatePassword(password);
  if (passErr) return res.status(400).json({ message: 'Contraseña débil: ' + passErr });

  const regCount = recordRegistration(ip);
  if (regCount > MAX_REGISTRATIONS_PER_IP) return res.status(429).json({ message: 'Demasiados registros desde esta IP. Intenta más tarde.' });

  const existing = await User.findOne({ email: (email || '').toLowerCase() });
  if (existing) return res.status(409).json({ message: 'Email ya registrado' });

  const hash = (p) => bcrypt.hashSync(p, 10);
  const user = await User.create({ name, email: email.toLowerCase(), password: hash(password), role: 'CAPTURISTA' });
  res.status(201).json({ token: sign(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
}));
api.get('/me', protect, (req, res) => res.json({ user: req.user }));
api.get('/areas', protect, wrap(async (_req, res) => res.json({ items: await Area.find().sort({ name: 1 }) })));

// --- Admin: Gestión de Usuarios ---
api.get('/users', protect, isAdmin, wrap(async (_req, res) => {
  const users = await User.find().select('+password').sort({ createdAt: -1 });
  res.json({ items: users.map(u => ({ id: u._id, name: u.name, email: u.email, role: u.role, password: u.password, area: u.area, active: u.active })) });
}));
api.post('/users', protect, isAdmin, wrap(async (req, res) => {
  const { name, email, password, role, area } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Nombre, email y contraseña requeridos' });
  if (!validateEmail(email)) return res.status(400).json({ message: 'Email inválido' });
  if (name.length < 2 || name.length > 100) return res.status(400).json({ message: 'Nombre debe tener 2-100 caracteres' });
  if (!['ADMIN', 'CAPTURISTA', 'CONSULTA'].includes(role || 'CAPTURISTA')) return res.status(400).json({ message: 'Rol inválido' });

  const passErr = validatePassword(password);
  if (passErr) return res.status(400).json({ message: 'Contraseña débil: ' + passErr });

  const existing = await User.findOne({ email: (email || '').toLowerCase() });
  if (existing) return res.status(409).json({ message: 'Email ya registrado' });
  const hash = (p) => bcrypt.hashSync(p, 10);
  const user = await User.create({ name, email: email.toLowerCase(), password: hash(password), role: role || 'CAPTURISTA', area });
  res.status(201).json({ item: { id: user._id, name: user.name, email: user.email, role: user.role, password: user.password, area: user.area, active: user.active } });
}));
api.patch('/users/:id', protect, isAdmin, wrap(async (req, res) => {
  const { name, email, role, area, active } = req.body;
  const update = {};
  if (name) update.name = name;
  if (email) update.email = email.toLowerCase();
  if (role) update.role = role;
  if (area) update.area = area;
  if (active !== undefined) update.active = active;
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('+password');
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ item: { id: user._id, name: user.name, email: user.email, role: user.role, password: user.password, area: user.area, active: user.active } });
}));
api.patch('/users/:id/password', protect, isAdmin, wrap(async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'Contraseña requerida' });
  const hash = (p) => bcrypt.hashSync(p, 10);
  const user = await User.findByIdAndUpdate(req.params.id, { password: hash(password) }, { new: true }).select('+password');
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ item: { id: user._id, name: user.name, email: user.email, role: user.role, password: user.password, area: user.area, active: user.active } });
}));
api.delete('/users/:id', protect, isAdmin, wrap(async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ ok: true });
}));

// --- Recurso genérico (CRUD + consolidación) ---
function resource(pathName, Model, opts = {}) {
  const dateField = opts.dateField || 'date';
  api.get(`/${pathName}`, protect, wrap(async (req, res) => {
    const f = buildFilter(req.query, dateField);
    const limit = Math.min(500, Number(req.query.limit) || 200);
    const items = await Model.find(f).sort({ [dateField]: -1 }).limit(limit);
    res.json({ items, total: await Model.countDocuments(f) });
  }));
  api.post(`/${pathName}`, protect, canWrite, wrap(async (req, res) => {
    const doc = await Model.create(req.body);
    if (opts.consolidate) await opts.consolidate(doc);
    res.status(201).json({ item: doc });
  }));
  api.put(`/${pathName}/:id`, protect, canWrite, wrap(async (req, res) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!doc) return res.status(404).json({ message: 'No encontrado' });
    if (opts.consolidate) await opts.consolidate(doc);
    res.json({ item: doc });
  }));
  api.delete(`/${pathName}/:id`, protect, canWrite, wrap(async (req, res) => {
    const doc = await Model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'No encontrado' });
    if (opts.source) { await Heinrich.deleteOne({ folio: doc.folio, source: opts.source }); await Action.deleteOne({ folio: doc.folio, source: opts.source }); }
    res.json({ ok: true });
  }));
}
resource('stop', Stop, { consolidate: consolidateStop, source: 'STOP' });
resource('commission', Commission, { consolidate: consolidateCommission, source: 'COMMISSION' });
resource('incidents', Incident, { dateField: 'eventDate', consolidate: consolidateIncident, source: 'INCIDENT' });
resource('iperc', Iperc, { consolidate: consolidateIperc, source: 'IPERC' });

// --- Acciones (motor) ---
api.get('/actions', protect, wrap(async (req, res) => {
  const f = buildFilter(req.query, 'dueDate');
  let items = (await Action.find(f).sort({ dueDate: 1 }).limit(500).lean()).map((a) => ({ ...a, dueState: dueState(a) }));
  if (req.query.due) items = items.filter((a) => a.dueState === req.query.due);
  res.json({ items });
}));
api.get('/actions/summary', protect, wrap(async (_req, res) => {
  const all = await Action.find().select('status risk dueDate').lean();
  const byStatus = { ABIERTA: 0, EN_PROCESO: 0, CERRADA: 0 };
  const byRisk = { BAJO: 0, MEDIO: 0, ALTO: 0 };
  const byDue = { AL_DIA: 0, POR_VENCER: 0, VENCIDA: 0, CERRADA: 0 };
  all.forEach((a) => { byStatus[a.status]++; byRisk[a.risk]++; byDue[dueState(a)]++; });
  res.json({ total: all.length, byStatus, byRisk, byDue });
}));
api.patch('/actions/:id/status', protect, canWrite, wrap(async (req, res) => {
  const { status } = req.body;
  const doc = await Action.findByIdAndUpdate(req.params.id, { status, closedAt: status === 'CERRADA' ? new Date() : null }, { new: true });
  if (!doc) return res.status(404).json({ message: 'No encontrada' });
  res.json({ item: doc });
}));

// --- Dashboard (agregaciones) ---
function fillLevels(rows) {
  const map = new Map(rows.map((r) => [r._id, r.count]));
  return LEVELS.map((level) => ({ level, count: map.get(level) || 0 }));
}
api.get('/dashboard', protect, wrap(async (req, res) => {
  const f = buildFilter(req.query, 'date');
  const af = buildFilter(req.query, 'dueDate'); delete af.level;
  const [lvl, bySource, monthlyRows, byArea, byMachine, cond, acts, actions, topResp] = await Promise.all([
    Heinrich.aggregate([{ $match: f }, { $group: { _id: '$level', count: { $sum: 1 } } }]),
    Heinrich.aggregate([{ $match: f }, { $group: { _id: '$source', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Heinrich.aggregate([{ $match: f }, { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' }, l: '$level' }, count: { $sum: 1 } } }, { $sort: { '_id.y': 1, '_id.m': 1 } }]),
    Heinrich.aggregate([{ $match: f }, { $group: { _id: '$area', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 12 }]),
    Heinrich.aggregate([{ $match: { ...f, machine: { $ne: null } } }, { $group: { _id: '$machine', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 12 }]),
    Heinrich.aggregate([{ $match: { ...f, level: 'CONDICION_INSEGURA' } }, { $group: { _id: '$area', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Heinrich.aggregate([{ $match: { ...f, level: 'ACTO_INSEGURO' } }, { $group: { _id: '$area', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Action.find(af).select('status risk dueDate').lean(),
    Action.aggregate([{ $match: { ...af, status: { $in: ['ABIERTA', 'EN_PROCESO'] } } }, { $group: { _id: '$responsible', open: { $sum: 1 } } }, { $sort: { open: -1 } }, { $limit: 10 }]),
  ]);

  const byStatus = { ABIERTA: 0, EN_PROCESO: 0, CERRADA: 0 };
  const byRisk = { BAJO: 0, MEDIO: 0, ALTO: 0 };
  const byDue = { AL_DIA: 0, POR_VENCER: 0, VENCIDA: 0, CERRADA: 0 };
  actions.forEach((a) => { byStatus[a.status]++; byRisk[a.risk]++; byDue[dueState(a)]++; });

  const byMonth = new Map();
  monthlyRows.forEach((r) => {
    const key = `${r._id.y}-${String(r._id.m).padStart(2, '0')}`;
    if (!byMonth.has(key)) { const base = { month: key }; LEVELS.forEach((l) => (base[l] = 0)); byMonth.set(key, base); }
    byMonth.get(key)[r._id.l] = r.count;
  });

  res.json({
    pyramid: fillLevels(lvl),
    bySource: bySource.map((s) => ({ source: s._id, count: s.count })),
    monthly: [...byMonth.values()],
    byArea: byArea.map((r) => ({ area: r._id, count: r.count })),
    byMachine: byMachine.map((r) => ({ machine: r._id, count: r.count })),
    topConditions: cond.map((r) => ({ area: r._id, count: r.count })),
    topActs: acts.map((r) => ({ area: r._id, count: r.count })),
    topResponsibles: topResp.map((r) => ({ responsible: r._id, open: r.open })),
    actionsSummary: { total: actions.length, byStatus, byRisk, byDue },
  });
}));

// --- Importación Excel ---
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
function parseExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
  return { columns: rows.length ? Object.keys(rows[0]) : [], rows };
}
function normLevel(v) {
  if (!v) return null;
  const s = String(v).trim().toUpperCase();
  if (LEVELS.includes(s)) return s;
  const a = {
    'ACTO INSEGURO': 'ACTO_INSEGURO', 'ACTOS INSEGUROS': 'ACTO_INSEGURO',
    'CONDICION INSEGURA': 'CONDICION_INSEGURA', 'CONDICIONES INSEGURAS': 'CONDICION_INSEGURA',
    'CASI INCIDENTE': 'CASI_INCIDENTE', 'NEAR MISS': 'CASI_INCIDENTE',
    'PRIMEROS AUXILIOS': 'PRIMEROS_AUXILIOS', 'TRATAMIENTO MEDICO': 'TRATAMIENTO_MEDICO',
    'ACTIVIDAD RESTRINGIDA': 'ACTIVIDAD_RESTRINGIDA', 'LOST TIME': 'LOST_TIME', 'LTI': 'LOST_TIME', 'FATALIDAD': 'FATALIDAD',
  };
  return a[s] || null;
}
api.post('/import/preview', protect, canWrite, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Archivo no proporcionado' });
  const { columns, rows } = parseExcel(req.file.buffer);
  res.json({ columns, preview: rows.slice(0, 10), totalRows: rows.length });
}));
api.post('/import/commit', protect, canWrite, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Archivo no proporcionado' });
  const target = req.body.target;
  const mapping = typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping || '{}') : (req.body.mapping || {});
  const { rows } = parseExcel(req.file.buffer);
  const rejected = []; let inserted = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = {};
    for (const [col, field] of Object.entries(mapping)) if (field) raw[field] = rows[i][col];
    const folio = raw.folio ? String(raw.folio).trim() : null;
    try {
      if (!folio) throw new Error('Folio vacío');
      if (target === 'HEINRICH') {
        const level = normLevel(raw.level);
        if (!level) throw new Error('Nivel no reconocido: ' + raw.level);
        if (await Heinrich.findOne({ folio, source: 'EXCEL' })) throw new Error('Folio duplicado');
        await emitHeinrich({ folio, date: raw.date ? new Date(raw.date) : new Date(), level, source: 'EXCEL', severity: raw.severity ? Number(raw.severity) : undefined, area: raw.area, machine: raw.machine, description: raw.description });
      } else if (target === 'STOP') {
        if (await Stop.findOne({ folio })) throw new Error('Folio duplicado');
        await consolidateStop(await Stop.create({ ...raw, level: normLevel(raw.level) || 'ACTO_INSEGURO' }));
      } else if (target === 'COMMISSION') {
        if (await Commission.findOne({ folio })) throw new Error('Folio duplicado');
        await consolidateCommission(await Commission.create({ ...raw, level: normLevel(raw.level) || 'CONDICION_INSEGURA' }));
      } else if (target === 'INCIDENT') {
        if (await Incident.findOne({ folio })) throw new Error('Folio duplicado');
        await consolidateIncident(await Incident.create({ ...raw, level: normLevel(raw.level) || 'CASI_INCIDENTE' }));
      } else if (target === 'IPERC') {
        if (await Iperc.findOne({ folio })) throw new Error('Folio duplicado');
        await consolidateIperc(await Iperc.create(raw));
      } else throw new Error('Destino inválido');
      inserted++;
    } catch (e) { rejected.push({ row: i + 2, folio, reason: e.message }); }
  }
  await ImportJob.create({ fileName: req.file.originalname, target, total: rows.length, inserted, rejectedCount: rejected.length, rejected });
  res.json({ result: { total: rows.length, inserted, rejected } });
}));

app.use('/api', api);
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Servir la página única
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ---------------------------------------------------------------------------
// Seed automático (si la base está vacía)
// ---------------------------------------------------------------------------
async function seedIfEmpty() {
  if (process.env.SEED_ON_START === 'false') return;
  if ((await User.countDocuments()) > 0) return;
  console.log('[seed] Base vacía: generando datos demo...');

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@ehs.local';
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'Admin123*';
  const hash = (p) => bcrypt.hashSync(p, 10);
  await User.create([
    { name: 'Administrador EHS', email: adminEmail, password: hash(adminPass), role: 'ADMIN' },
    { name: 'Capturista Demo', email: 'capturista@ehs.local', password: hash('Captura123*'), role: 'CAPTURISTA', area: 'PROD' },
    { name: 'Gerencia Demo', email: 'gerencia@ehs.local', password: hash('Consulta123*'), role: 'CONSULTA' },
  ]);

  const AREAS = [['PROD', 'Producción'], ['MANT', 'Mantenimiento'], ['ALM', 'Almacén'], ['CALID', 'Calidad'], ['LOG', 'Logística']];
  await Area.insertMany(AREAS.map(([code, name]) => ({ code, name })));
  const MACH = ['TORNO-01', 'PRENSA-02', 'MONTAC-01', 'BANDA-03'];
  const PEOPLE = ['J. Pérez', 'M. López', 'R. Sánchez', 'A. Torres', 'L. Gómez'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rdate = () => { const d = new Date(); d.setMonth(d.getMonth() - Math.floor(Math.random() * 6)); d.setDate(1 + Math.floor(Math.random() * 27)); return d; };
  const due = () => { const d = new Date(); d.setDate(d.getDate() + Math.floor(Math.random() * 40) - 15); return d; };

  for (let i = 1; i <= 40; i++) {
    const doc = await Stop.create({ folio: `STOP-${String(i).padStart(4, '0')}`, date: rdate(), observer: pick(PEOPLE), area: pick(AREAS)[0], machine: Math.random() > .5 ? pick(MACH) : undefined, description: 'Observación de comportamiento.', level: Math.random() > .5 ? 'ACTO_INSEGURO' : 'CONDICION_INSEGURA', risk: pick(RISKS), requiredAction: Math.random() > .4 ? 'Reforzar capacitación.' : undefined, responsible: pick(PEOPLE), dueDate: due() });
    await consolidateStop(doc);
  }
  for (let i = 1; i <= 20; i++) {
    const doc = await Commission.create({ folio: `COM-${String(i).padStart(4, '0')}`, date: rdate(), auditor: pick(PEOPLE), area: pick(AREAS)[0], machine: pick(MACH), description: 'Hallazgo de inspección.', level: pick(['CONDICION_INSEGURA', 'ACTO_INSEGURO', 'CASI_INCIDENTE']), risk: pick(RISKS), correctiveAction: 'Corregir condición.', responsible: pick(PEOPLE), dueDate: due() });
    await consolidateCommission(doc);
  }
  const ilev = ['CASI_INCIDENTE', 'PRIMEROS_AUXILIOS', 'TRATAMIENTO_MEDICO', 'ACTIVIDAD_RESTRINGIDA', 'LOST_TIME'];
  for (let i = 1; i <= 14; i++) {
    const level = pick(ilev);
    const doc = await Incident.create({ folio: `INC-${String(i).padStart(4, '0')}`, eventDate: rdate(), area: pick(AREAS)[0], machine: pick(MACH), person: pick(PEOPLE), description: 'Evento en planta.', level, severity: 1 + Math.floor(Math.random() * 5), lostDays: level === 'LOST_TIME' ? 1 + Math.floor(Math.random() * 10) : 0, rootCause: 'Causa raíz en análisis.', correctiveAction: 'Medida correctiva.', responsible: pick(PEOPLE), dueDate: due(), risk: 'ALTO' });
    await consolidateIncident(doc);
  }
  for (let i = 1; i <= 18; i++) {
    const doc = await Iperc.create({ folio: `IPERC-${String(i).padStart(4, '0')}`, date: rdate(), area: pick(AREAS)[0], process: 'Proceso productivo', machine: pick(MACH), risk: 'Riesgo de matriz IPERC', riskLevel: pick(RISKS), description: 'Hallazgo IPERC.', requiredAction: 'Acción preventiva.', responsible: pick(PEOPLE), dueDate: due(), status: pick(ACTION_STATUS) });
    await consolidateIperc(doc);
  }
  // Garantiza un registro por nivel para ver la pirámide completa.
  for (const level of LEVELS) await emitHeinrich({ folio: `DEMO-${level}`, date: rdate(), level, source: 'EXCEL', area: pick(AREAS)[0] });

  console.log(`[seed] Listo. Login: ${adminEmail} / ${adminPass}`);
}

// ---------------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------------
// Si no hay cadena real configurada, arranca una MongoDB temporal en memoria (modo demo).
async function resolveMongoUri() {
  if (MONGODB_URI && !MONGODB_URI.includes('PEGAR_AQUI')) return MONGODB_URI;
  console.log('[db] MONGODB_URI no configurada → iniciando MongoDB en memoria (DEMO; los datos NO persisten).');
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  global.__memServer = mem;
  return mem.getUri('ehs_platform');
}

(async () => {
  try {
    mongoose.set('strictQuery', true);
    const uri = await resolveMongoUri();
    await mongoose.connect(uri);
    console.log('[db] Conectado a MongoDB');
    await seedIfEmpty();
    app.listen(PORT, () => console.log(`[server] EHS Platform en http://localhost:${PORT}`));
  } catch (err) {
    console.error('[server] Error al iniciar:', err.message);
    process.exit(1);
  }
})();
