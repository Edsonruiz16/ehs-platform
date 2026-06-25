# EHS Platform — Gestión de Seguridad Industrial

Plataforma web EHS / HSE para captura, clasificación, visualización y seguimiento de seguridad industrial, con núcleo en la **Pirámide de Heinrich** y un **motor único de acciones** correctivas/preventivas.

> Observaciones STOP · Comisión de Seguridad e Higiene · Incidentes/Accidentes · Acciones IPERC · Importación Excel · Dashboard ejecutivo.

---

## ✨ Características

- **Pirámide de Heinrich** consolidada automáticamente desde múltiples fuentes (directa e indirecta).
- **Motor único de acciones**: toda acción —venga de STOP, Comisión, Incidente o IPERC— se centraliza para análisis global (abiertas / en proceso / cerradas / vencidas).
- **Importación de Excel** con vista previa, mapeo de columnas, validación, anti-duplicados y log de importación.
- **Dashboard ejecutivo** con pirámide, dona de acciones, tendencia mensual, rankings por área/máquina/responsable y distribución por origen.
- **Roles y permisos** (ADMIN / CAPTURISTA / CONSULTA) con autenticación JWT.
- **Semaforización** de riesgo (verde/amarillo/rojo) y de vencimiento de acciones.

---

## 🧱 Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js · Express · TypeScript (arquitectura modular: routes → controller → service → model) |
| Base de datos | MongoDB · Mongoose |
| Auth | JWT + middleware de roles |
| Excel | SheetJS (`xlsx`) |
| Frontend | Next.js (App Router) · TypeScript · Tailwind CSS · Recharts |
| Validación | Zod |

---

## 📐 Arquitectura y modelo de datos

### Consolidación (clave del diseño)
- Cada fuente guarda su documento de negocio **y emite**:
  - un registro normalizado en **`heinrich_records`** (alimenta pirámide + dashboard), y
  - si trae acción + responsable, una entrada en **`actions`** (motor único).
- El dashboard se calcula por **agregaciones en lectura** sobre `heinrich_records` y `actions` (rápido con índices; aislado en `dashboard.service.ts` para migrar a snapshots si crece).

### Niveles de la pirámide
`ACTO_INSEGURO · CONDICION_INSEGURA · CASI_INCIDENTE · PRIMEROS_AUXILIOS · TRATAMIENTO_MEDICO · ACTIVIDAD_RESTRINGIDA · LOST_TIME · FATALIDAD`

- **Riesgo** = `BAJO | MEDIO | ALTO` (atributo de acción/observación).
- **Severidad** = ordinal `1..5` (atributo del incidente, **no** nivel) → evita doble conteo.

### Colecciones
`users · areas · machines · catalogs · heinrich_records · actions · observations_stop · observations_commission · incidents · iperc_actions · import_jobs`

---

## 🗂️ Estructura del proyecto

```
ehs-platform/
├── backend/
│   ├── src/
│   │   ├── config/         # env, conexión Mongo
│   │   ├── constants/      # enums del dominio (niveles, riesgo, roles…)
│   │   ├── middleware/     # auth (JWT/roles), errores, validación Zod
│   │   ├── models/         # esquemas Mongoose
│   │   ├── modules/        # auth, observationsStop, commission, incidents,
│   │   │                   # iperc, actions, dashboard, catalogs, import
│   │   ├── services/       # heinrich.service (emisión) · action.service (motor)
│   │   ├── utils/          # ApiError, asyncHandler, filtros
│   │   ├── routes/         # router principal
│   │   ├── app.ts · server.ts · seed.ts
│   └── package.json
└── frontend/
    ├── app/                # App Router: /login, dashboard, módulos
    ├── components/         # Sidebar, KPIs, charts (pirámide, dona, barras…)
    ├── lib/                # api client, auth context, helpers
    └── package.json
```

---

## 🚀 Instalación y arranque (local)

### Requisitos
- Node.js 18+
- MongoDB en local (`mongodb://127.0.0.1:27017`) o Atlas.

### 1) Backend
```bash
cd backend
cp .env.example .env          # ajusta MONGODB_URI y JWT_SECRET
npm install
npm run seed                  # crea admin + catálogos + datos demo
npm run dev                   # API en http://localhost:4000/api
```

### 2) Frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # app en http://localhost:3000
```

### Acceso demo
| Rol | Correo | Password |
|---|---|---|
| Admin | `admin@ehs.local` | `Admin123*` |
| Capturista | `capturista@ehs.local` | `Captura123*` |
| Consulta | `gerencia@ehs.local` | `Consulta123*` |

---

## 🔑 Variables de entorno

**backend/.env**
```
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/ehs_platform
JWT_SECRET=cambia_este_secreto
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:3000
SEED_ADMIN_EMAIL=admin@ehs.local
SEED_ADMIN_PASSWORD=Admin123*
```

**frontend/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

---

## 📡 API principal

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login (devuelve JWT) |
| GET | `/api/dashboard/overview` | Todos los widgets del dashboard (acepta filtros) |
| GET | `/api/dashboard/pyramid` | Pirámide + tendencia + origen |
| CRUD | `/api/observations-stop` | Observaciones STOP |
| CRUD | `/api/commission` | Hallazgos de Comisión |
| CRUD | `/api/incidents` | Incidentes / Accidentes |
| CRUD | `/api/iperc` | Acciones IPERC |
| GET / PATCH | `/api/actions`, `/api/actions/:id/status` | Motor de acciones |
| POST | `/api/import/preview` · `/api/import/commit` | Importación Excel |
| CRUD | `/api/areas` · `/api/machines` · `/api/catalogs` · `/api/users` | Catálogos |

**Filtros globales** (query string): `year, month, from, to, area, machine, source, status, risk, responsible, level`.

---

## 🗺️ Roadmap

- [ ] UI completa de Comisión, Incidentes e IPERC (mismo patrón que STOP).
- [ ] Exportación de tablas/reportes a Excel.
- [ ] Carga de evidencias (archivos) y galería.
- [ ] Notificaciones de vencimiento (email / in-app).
- [ ] Permisos por planta/sitio y multi-tenant.
- [ ] Indicadores ambientales y de salud ocupacional.
- [ ] Auditoría/bitácora completa por registro.
- [ ] Snapshots de dashboard precalculados (cron) para alto volumen.

---

## 📄 Licencia
MIT.
