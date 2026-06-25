/**
 * Enumeraciones centrales del dominio EHS.
 * La pirámide de Heinrich se modela por NIVELES; la severidad es un atributo
 * ordinal del evento (no un nivel) para evitar doble conteo.
 */

/** Niveles de la Pirámide de Heinrich (de base a cúspide). */
export const HEINRICH_LEVELS = [
  'ACTO_INSEGURO',
  'CONDICION_INSEGURA',
  'CASI_INCIDENTE',
  'PRIMEROS_AUXILIOS',
  'TRATAMIENTO_MEDICO',
  'ACTIVIDAD_RESTRINGIDA',
  'LOST_TIME',
  'FATALIDAD',
] as const;
export type HeinrichLevel = (typeof HEINRICH_LEVELS)[number];

/** Etiquetas legibles para UI. */
export const HEINRICH_LABELS: Record<HeinrichLevel, string> = {
  ACTO_INSEGURO: 'Actos inseguros',
  CONDICION_INSEGURA: 'Condiciones inseguras',
  CASI_INCIDENTE: 'Casi incidente / Near miss',
  PRIMEROS_AUXILIOS: 'Primeros auxilios',
  TRATAMIENTO_MEDICO: 'Tratamiento médico',
  ACTIVIDAD_RESTRINGIDA: 'Actividad restringida',
  LOST_TIME: 'Lost Time (LTI)',
  FATALIDAD: 'Fatalidad',
};

/** Origen del registro (de qué módulo proviene). */
export const SOURCES = ['STOP', 'COMMISSION', 'INCIDENT', 'IPERC', 'EXCEL'] as const;
export type Source = (typeof SOURCES)[number];

/** Nivel de riesgo (probabilidad x consecuencia esperada). */
export const RISK_LEVELS = ['BAJO', 'MEDIO', 'ALTO'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Estatus de una acción correctiva/preventiva. */
export const ACTION_STATUS = ['ABIERTA', 'EN_PROCESO', 'CERRADA'] as const;
export type ActionStatus = (typeof ACTION_STATUS)[number];

/** Roles de usuario. */
export const ROLES = ['ADMIN', 'CAPTURISTA', 'CONSULTA'] as const;
export type Role = (typeof ROLES)[number];

/** Severidad ordinal del evento (atributo, NO nivel de pirámide). */
export const SEVERITY_LEVELS = [1, 2, 3, 4, 5] as const;
export type Severity = (typeof SEVERITY_LEVELS)[number];

/** Tipos de catálogo genérico configurable. */
export const CATALOG_TYPES = [
  'OBSERVATION_TYPE',
  'INCIDENT_TYPE',
  'FINDING_TYPE',
  'EVENT_TYPE',
] as const;
export type CatalogType = (typeof CATALOG_TYPES)[number];
