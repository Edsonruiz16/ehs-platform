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
const crypto = require('crypto');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ehs_platform';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Copia recuperable de contraseñas (solo visible para el ADMIN). El hash bcrypt no es reversible,
// así que ciframos una copia con AES-256-GCM usando una clave derivada del JWT_SECRET.
function pwKey() { return crypto.createHash('sha256').update('pwview:' + JWT_SECRET).digest(); }
function encPw(plain) {
  try { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', pwKey(), iv);
    const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
    return iv.toString('hex') + ':' + c.getAuthTag().toString('hex') + ':' + ct.toString('hex'); }
  catch { return undefined; }
}
function decPw(blob) {
  try { if (!blob || blob.split(':').length !== 3) return null; const [iv, tag, ct] = blob.split(':');
    const d = crypto.createDecipheriv('aes-256-gcm', pwKey(), Buffer.from(iv, 'hex')); d.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([d.update(Buffer.from(ct, 'hex')), d.final()]).toString('utf8'); }
  catch { return null; }
}
const userView = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, area: u.area, active: u.active, password: u.password, viewPassword: decPw(u.passwordPlain) });

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
  passwordPlain: { type: String, select: false }, // copia cifrada (AES) para que el admin pueda consultarla
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
  // Datos importados del Excel mensual de la plataforma STOP
  checklistNo: String,
  mainCategory: String,
  subCategory: String,
  subArea: String,
  shift: String,
  safeComment: String,
  unsafeComment: String,
  kind: { type: String, enum: ['SEGURA', 'INSEGURA'] },
  imported: { type: Boolean, default: false },
  rowKey: { type: String, index: true }, // huella de la fila importada (evita duplicados al re-importar)
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

// Genera el siguiente folio consecutivo para un modelo dado
async function nextFolio(Model, prefix) {
  const last = await Model.findOne({ folio: new RegExp('^' + prefix + '-') })
    .sort({ createdAt: -1 })
    .select('folio');
  if (!last) return prefix + '-0001';
  const parts = last.folio.split('-');
  const num = parseInt(parts[parts.length - 1]) || 0;
  return prefix + '-' + String(num + 1).padStart(4, '0');
}

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
  const user = await User.create({ name, email: email.toLowerCase(), password: hash(password), passwordPlain: encPw(password), role: 'CAPTURISTA' });
  res.status(201).json({ token: sign(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
}));
api.get('/me', protect, (req, res) => res.json({ user: req.user }));
api.get('/areas', protect, wrap(async (_req, res) => res.json({ items: await Area.find().sort({ name: 1 }) })));

// --- Folios automáticos ---
api.get('/commission/next-folio', protect, wrap(async (_,res) => res.json({ folio: await nextFolio(Commission, 'COM')   })));
api.get('/incidents/next-folio',  protect, wrap(async (_,res) => res.json({ folio: await nextFolio(Incident,   'INC')   })));
api.get('/iperc/next-folio',      protect, wrap(async (_,res) => res.json({ folio: await nextFolio(Iperc,      'IPERC') })));

// --- Admin: Gestión de Usuarios ---
api.get('/users', protect, isAdmin, wrap(async (_req, res) => {
  const users = await User.find().select('+password +passwordPlain').sort({ createdAt: -1 });
  res.json({ items: users.map(userView) });
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
  const user = await User.create({ name, email: email.toLowerCase(), password: hash(password), passwordPlain: encPw(password), role: role || 'CAPTURISTA', area });
  res.status(201).json({ item: userView(user) });
}));
api.patch('/users/:id', protect, isAdmin, wrap(async (req, res) => {
  const { name, email, role, area, active } = req.body;
  const update = {};
  if (name) update.name = name;
  if (email) update.email = email.toLowerCase();
  if (role) update.role = role;
  if (area) update.area = area;
  if (active !== undefined) update.active = active;
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('+password +passwordPlain');
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ item: userView(user) });
}));
api.patch('/users/:id/password', protect, isAdmin, wrap(async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ message: 'Contraseña requerida' });
  const hash = (p) => bcrypt.hashSync(p, 10);
  const user = await User.findByIdAndUpdate(req.params.id, { password: hash(password), passwordPlain: encPw(password) }, { new: true }).select('+password +passwordPlain');
  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
  res.json({ item: userView(user) });
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
    const body = { ...req.body };
    delete body.folio; // folio siempre lo genera el servidor
    body.folio = await nextFolio(Model, opts.prefix || pathName.toUpperCase());
    const doc = await Model.create(body);
    if (opts.consolidate) await opts.consolidate(doc);
    res.status(201).json({ item: doc });
  }));
  api.put(`/${pathName}/:id`, protect, canWrite, wrap(async (req, res) => {
    const body = { ...req.body };
    delete body.folio; // el folio nunca se puede cambiar después de creado
    const doc = await Model.findByIdAndUpdate(req.params.id, body, { new: true });
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
// STOP no usa el recurso genérico: se alimenta por importación automática (sin registro manual).
// Lectura: cualquier usuario autenticado. Importar/eliminar: solo ADMIN.
api.get('/stop', protect, wrap(async (req, res) => {
  const f = buildFilter(req.query, 'date');
  const items = await Stop.find(f).sort({ date: -1 }).limit(1000);
  res.json({ items, total: await Stop.countDocuments(f) });
}));
api.delete('/stop/:id', protect, isAdmin, wrap(async (req, res) => {
  const doc = await Stop.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: 'No encontrado' });
  await Heinrich.deleteOne({ folio: doc.folio, source: 'STOP' });
  await Action.deleteOne({ folio: doc.folio, source: 'STOP' });
  res.json({ ok: true });
}));
resource('commission', Commission, { consolidate: consolidateCommission, source: 'COMMISSION', prefix: 'COM' });
resource('incidents', Incident, { dateField: 'eventDate', consolidate: consolidateIncident, source: 'INCIDENT', prefix: 'INC' });
resource('iperc', Iperc, { consolidate: consolidateIperc, source: 'IPERC', prefix: 'IPERC' });

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
// --- Clasificación automática STOP → nivel de pirámide ---
// Categorías de personas/comportamiento = ACTO INSEGURO; de entorno/físicas = CONDICIÓN INSEGURA.
const STOP_ACT_CATS  = new Set(['personal protective equipment', 'reactions of people', 'positions of people', 'tools and equipment - actions', 'procedures', 'housekeeping standards']);
const STOP_COND_CATS = new Set(['work area and structures', 'tools and equipment - conditions', 'environment']);
// Si el comentario describe un evento real (derrame, "casi…", conato, etc.) se eleva a CASI INCIDENTE.
// Señales inequívocas: evitamos verbos preventivos ("para no caer") que darían falsos positivos.
const NEARMISS_RE = /\bcasi\b|\bcuasi|por poco|estuvo a punto|a punto de|amago|conato|derrame|fuga de|quemadura|corto ?circuito/i;
function classifyStop(mainCategory, unsafeComment) {
  if (NEARMISS_RE.test(unsafeComment || '')) return 'CASI_INCIDENTE';
  const c = String(mainCategory || '').trim().toLowerCase();
  if (STOP_COND_CATS.has(c)) return 'CONDICION_INSEGURA';
  if (STOP_ACT_CATS.has(c)) return 'ACTO_INSEGURO';
  if (/condition|area|environment|structure/.test(c)) return 'CONDICION_INSEGURA';
  return 'ACTO_INSEGURO';
}
function parseStopDate(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  const s = String(v || '').trim(); if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); // dd/mm/yyyy
  if (m) { let [, d, mo, y] = m; y = +y < 100 ? 2000 + +y : +y; return new Date(+y, +mo - 1, +d); }
  const d = new Date(s); return isNaN(d) ? null : d;
}
function pickCol(headers, ...names) {
  const low = headers.map((h) => String(h || '').trim().toLowerCase());
  for (const n of names) { const i = low.indexOf(n.toLowerCase()); if (i >= 0) return i; }
  return -1;
}

// --- Importación automática de Excel STOP (solo admin) ---
api.post('/import/stop', protect, isAdmin, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Archivo no proporcionado' });
  const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
  const hasHeaders = (row) => row.some((c) => /checklist\s*no/i.test(String(c))) && row.some((c) => /observer/i.test(String(c)));
  let rows = null, headerIdx = -1;
  for (const name of ['Sheet1', ...wb.SheetNames]) {
    if (!wb.Sheets[name]) continue;
    const r = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
    const idx = r.findIndex(hasHeaders);
    if (idx >= 0) { rows = r; headerIdx = idx; break; }
  }
  if (headerIdx < 0) return res.status(400).json({ message: 'No se encontró la estructura esperada (columnas “Checklist No” y “Observer Name”). Verifica que sea el Excel de STOP.' });

  const H = rows[headerIdx];
  const col = {
    chk: pickCol(H, 'Checklist No'), obs: pickCol(H, 'Observer Name'), date: pickCol(H, 'Date'),
    area: pickCol(H, 'Area Name'), sub: pickCol(H, 'Sub Area Name'), shift: pickCol(H, 'Shift Name'),
    main: pickCol(H, 'Main Category'), subCat: pickCol(H, 'Sub Category'),
    safe: pickCol(H, 'Safe Comments', 'Safe Comment'), unsafe: pickCol(H, 'Unsafe Comments', 'Unsafe Comment'),
  };
  const get = (r, i) => (i >= 0 ? String(r[i] ?? '').trim() : '');

  const summary = { total: 0, inserted: 0, duplicates: 0, empty: 0, safe: 0, byLevel: { ACTO_INSEGURO: 0, CONDICION_INSEGURA: 0, CASI_INCIDENTE: 0 } };
  const errors = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const chk = get(r, col.chk);
    if (!chk || !/\d/.test(chk)) continue; // fila vacía o pie de página
    summary.total++;
    const safe = get(r, col.safe), unsafe = get(r, col.unsafe);
    if (!safe && !unsafe) { summary.empty++; continue; }
    const mainCat = get(r, col.main), subCat = get(r, col.subCat);
    // Huella de contenido: un mismo checklist puede traer varias filas (distintas categorías);
    // deduplicamos por contenido para conservar TODOS los comentarios y que re-importar sea idempotente.
    const rowKey = crypto.createHash('sha1').update([chk, mainCat, subCat, safe, unsafe].join('|')).digest('hex');
    try {
      if (await Stop.findOne({ rowKey })) { summary.duplicates++; continue; }
      // Folio único: STOP-{checklist}, y -2, -3… si el checklist tiene varias observaciones.
      let folio = 'STOP-' + chk, n = 2;
      while (await Stop.findOne({ folio })) folio = 'STOP-' + chk + '-' + (n++);
      const kind = unsafe ? 'INSEGURA' : 'SEGURA';
      const level = kind === 'INSEGURA' ? classifyStop(mainCat, unsafe) : 'ACTO_INSEGURO';
      const doc = await Stop.create({
        folio, rowKey, checklistNo: chk, date: parseStopDate(r[col.date]) || new Date(),
        observer: get(r, col.obs) || 'N/D', area: get(r, col.area) || 'N/D',
        subArea: get(r, col.sub), shift: get(r, col.shift), mainCategory: mainCat, subCategory: subCat,
        safeComment: safe, unsafeComment: unsafe, description: unsafe || safe,
        level, kind, imported: true, risk: level === 'CASI_INCIDENTE' ? 'ALTO' : 'MEDIO',
      });
      if (kind === 'INSEGURA') { // solo las inseguras alimentan la pirámide
        await emitHeinrich({ folio: doc.folio, date: doc.date, level: doc.level, source: 'STOP', sourceRef: doc._id, risk: doc.risk, area: doc.area, description: doc.description });
        summary.byLevel[level] = (summary.byLevel[level] || 0) + 1;
      } else summary.safe++;
      summary.inserted++;
    } catch (e) { errors.push({ row: i + 1, folio: 'STOP-' + chk, reason: e.message }); }
  }
  await ImportJob.create({ fileName: req.file.originalname, target: 'STOP_AUTO', total: summary.total, inserted: summary.inserted, rejectedCount: errors.length, rejected: errors });
  res.json({ result: { ...summary, errors: errors.slice(0, 20) } });
}));

api.post('/import/preview', protect, isAdmin, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Archivo no proporcionado' });
  const { columns, rows } = parseExcel(req.file.buffer);
  res.json({ columns, preview: rows.slice(0, 10), totalRows: rows.length });
}));
api.post('/import/commit', protect, isAdmin, upload.single('file'), wrap(async (req, res) => {
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
    { name: 'Administrador EHS', email: adminEmail, password: hash(adminPass), passwordPlain: encPw(adminPass), role: 'ADMIN' },
    { name: 'Capturista Demo', email: 'capturista@ehs.local', password: hash('Captura123*'), passwordPlain: encPw('Captura123*'), role: 'CAPTURISTA', area: 'PROD' },
    { name: 'Gerencia Demo', email: 'gerencia@ehs.local', password: hash('Consulta123*'), passwordPlain: encPw('Consulta123*'), role: 'CONSULTA' },
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
