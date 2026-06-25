# EHS Platform — Una sola página

Plataforma EHS / HSE en **una sola página** con pestañas, sobre **MongoDB**. Núcleo en la **Pirámide de Heinrich** y un **motor único de acciones** correctivas/preventivas.

> Un solo servidor Node sirve la página (`public/index.html`) **y** la API REST hacia MongoDB. Sin paso de build, sin framework de frontend que compilar.

---

## ✨ Módulos (todos en la misma página, como pestañas)

- **Dashboard** — pirámide de Heinrich, dona de acciones, tendencia mensual, rankings por área/máquina/responsable, distribución por origen. Con filtros (año, mes, área, origen).
- **Observaciones STOP** — alta/edición/baja; alimenta pirámide + acciones.
- **Comisión de Seguridad e Higiene** — hallazgos de inspección.
- **Incidentes / Accidentes** — con severidad (1-5) y días perdidos.
- **Acciones IPERC** — derivadas de matriz IPERC.
- **Motor de Acciones** — repositorio único de todas las acciones, con semáforo de vencimiento.
- **Importar Excel** — vista previa, mapeo de columnas, validación, anti-duplicados y log.

---

## 🧱 Stack

| Capa | Tecnología |
|---|---|
| Servidor + API | Node.js · Express (un solo `server.js`) |
| Base de datos | MongoDB · Mongoose (Atlas o local) |
| Auth | JWT + bcrypt · roles ADMIN / CAPTURISTA / CONSULTA |
| Excel | SheetJS (`xlsx`) |
| Frontend | **Una página**: React + Chart.js + Tailwind por CDN (sin build) |

### Diseño clave
- Cada fuente (STOP, Comisión, Incidente, Excel) **emite** un registro normalizado en `heinrich_records` (alimenta pirámide y dashboard) y, si trae acción + responsable, una entrada en `actions` (motor único).
- **Riesgo** = `BAJO/MEDIO/ALTO`. **Severidad** = ordinal `1..5` del incidente (atributo, no nivel) → evita doble conteo.
- Dashboard por agregaciones en lectura (rápido con índices).

---

## 🗂️ Estructura

```
ehs-platform/
├── server.js            # Servidor único: modelos, API, consolidación, seed
├── public/
│   └── index.html       # La página única (todas las pestañas)
├── package.json
├── .env.example
└── README.md
```

---

## 🚀 Puesta en marcha

### 1) Requisitos
- Node.js 18+
- Una base MongoDB (recomendado **MongoDB Atlas**, free tier).

### 2) Configurar MongoDB Atlas
1. Crea un cluster gratuito en https://www.mongodb.com/atlas
2. **Database Access** → crea un usuario/clave.
3. **Network Access** → permite tu IP (o `0.0.0.0/0` para pruebas).
4. **Connect → Drivers** → copia la cadena `mongodb+srv://…`.

### 3) Variables de entorno
```bash
cp .env.example .env
# Edita .env y pega tu MONGODB_URI de Atlas + un JWT_SECRET propio
```

### 4) Instalar y correr
```bash
npm install
npm start
# Abre http://localhost:4000
```
La primera vez, si la base está vacía, se **siembran datos demo** automáticamente.

### Acceso demo
| Rol | Correo | Password |
|---|---|---|
| Admin | `admin@ehs.local` | `Admin123*` |
| Capturista | `capturista@ehs.local` | `Captura123*` |
| Consulta | `gerencia@ehs.local` | `Consulta123*` |

---

## 🔑 Variables de entorno (`.env`)

```
PORT=4000
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/ehs_platform
JWT_SECRET=un_secreto_largo_y_aleatorio
JWT_EXPIRES_IN=8h
SEED_ON_START=true
SEED_ADMIN_EMAIL=admin@ehs.local
SEED_ADMIN_PASSWORD=Admin123*
```

---

## ☁️ Despliegue (GitHub + host)

1. Sube el repo a GitHub.
2. Conéctalo en **Render / Railway / Fly.io** (cualquiera con Node):
   - Build command: `npm install`
   - Start command: `npm start`
   - Variables de entorno: las de `.env` (sobre todo `MONGODB_URI` y `JWT_SECRET`).
3. Listo: el mismo servicio sirve la página y la API.

---

## 📡 API principal

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login (JWT) |
| GET | `/api/dashboard` | Datos del dashboard (acepta filtros) |
| CRUD | `/api/stop` `/api/commission` `/api/incidents` `/api/iperc` | Fuentes EHS |
| GET/PATCH | `/api/actions`, `/api/actions/:id/status`, `/api/actions/summary` | Motor de acciones |
| POST | `/api/import/preview` · `/api/import/commit` | Importación Excel |
| GET | `/api/areas` | Catálogo de áreas |

Filtros (query): `year, month, from, to, area, machine, source, status, risk, responsible, level`.

---

## 🗺️ Roadmap
- [ ] Exportación de tablas a Excel.
- [ ] Carga de evidencias (archivos).
- [ ] Notificaciones de vencimiento.
- [ ] Catálogos editables (áreas/máquinas) y gestión de usuarios desde la UI.
- [ ] Permisos por planta/sitio.

## 📄 Licencia
MIT.
