import * as XLSX from 'xlsx';
import { Types } from 'mongoose';
import { ObservationStop } from '../../models/ObservationStop';
import { ObservationCommission } from '../../models/ObservationCommission';
import { Incident } from '../../models/Incident';
import { IpercAction } from '../../models/IpercAction';
import { HeinrichRecord } from '../../models/HeinrichRecord';
import { ImportJob } from '../../models/ImportJob';
import { createStop } from '../observationsStop/stop.service';
import { createCommission } from '../commission/commission.service';
import { createIncident } from '../incidents/incident.service';
import { createIperc } from '../iperc/iperc.service';
import { emitHeinrichRecord } from '../../services/heinrich.service';
import { HEINRICH_LEVELS, HeinrichLevel } from '../../constants/enums';

export type ImportTarget = 'HEINRICH' | 'STOP' | 'COMMISSION' | 'INCIDENT' | 'IPERC';

/** Lee el buffer del Excel y devuelve filas como objetos + columnas detectadas. */
export function parseExcel(buffer: Buffer): { columns: string[]; rows: Record<string, unknown>[] } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: false });
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return { columns, rows };
}

/** Aplica el mapeo columna_excel -> campo_destino. */
function applyMapping(row: Record<string, unknown>, mapping: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [excelCol, field] of Object.entries(mapping)) {
    if (field) out[field] = row[excelCol];
  }
  return out;
}

/** Normaliza un texto libre de nivel a un HeinrichLevel válido. */
export function normalizeLevel(value: unknown): HeinrichLevel | null {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  const direct = HEINRICH_LEVELS.find((l) => l === v);
  if (direct) return direct;
  const aliases: Record<string, HeinrichLevel> = {
    'ACTO INSEGURO': 'ACTO_INSEGURO',
    'ACTOS INSEGUROS': 'ACTO_INSEGURO',
    'CONDICION INSEGURA': 'CONDICION_INSEGURA',
    'CONDICIONES INSEGURAS': 'CONDICION_INSEGURA',
    'CASI INCIDENTE': 'CASI_INCIDENTE',
    'NEAR MISS': 'CASI_INCIDENTE',
    'PRIMEROS AUXILIOS': 'PRIMEROS_AUXILIOS',
    'TRATAMIENTO MEDICO': 'TRATAMIENTO_MEDICO',
    'ACTIVIDAD RESTRINGIDA': 'ACTIVIDAD_RESTRINGIDA',
    'LOST TIME': 'LOST_TIME',
    LTI: 'LOST_TIME',
    FATALIDAD: 'FATALIDAD',
  };
  return aliases[v] ?? null;
}

interface ImportResult {
  total: number;
  inserted: number;
  rejected: { row: number; folio?: string; reason: string }[];
}

/**
 * Importa filas al destino indicado, mapea columnas, valida folio único y
 * consolida pirámide/acciones según corresponda.
 */
export async function importRows(
  target: ImportTarget,
  rows: Record<string, unknown>[],
  mapping: Record<string, string>,
  userId?: Types.ObjectId
): Promise<ImportResult> {
  const rejected: ImportResult['rejected'] = [];
  let inserted = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = applyMapping(rows[i], mapping);
    const folio = raw.folio ? String(raw.folio).trim() : undefined;

    try {
      if (!folio) throw new Error('Folio vacío');

      if (target === 'HEINRICH') {
        const level = normalizeLevel(raw.level);
        if (!level) throw new Error(`Nivel no reconocido: "${raw.level}"`);
        const exists = await HeinrichRecord.findOne({ folio, source: 'EXCEL' });
        if (exists) throw new Error('Folio duplicado');
        await emitHeinrichRecord({
          folio,
          date: raw.date ? new Date(String(raw.date)) : new Date(),
          level,
          source: 'EXCEL',
          severity: raw.severity ? Number(raw.severity) : undefined,
          area: raw.area ? String(raw.area) : undefined,
          machine: raw.machine ? String(raw.machine) : undefined,
          description: raw.description ? String(raw.description) : undefined,
          createdBy: userId,
        });
      } else if (target === 'STOP') {
        if (await ObservationStop.findOne({ folio })) throw new Error('Folio duplicado');
        await createStop({ ...raw, level: normalizeLevel(raw.level) ?? 'ACTO_INSEGURO' } as never, userId);
      } else if (target === 'COMMISSION') {
        if (await ObservationCommission.findOne({ folio })) throw new Error('Folio duplicado');
        await createCommission({ ...raw, level: normalizeLevel(raw.level) ?? 'CONDICION_INSEGURA' } as never, userId);
      } else if (target === 'INCIDENT') {
        if (await Incident.findOne({ folio })) throw new Error('Folio duplicado');
        await createIncident({ ...raw, level: normalizeLevel(raw.level) ?? 'CASI_INCIDENTE' } as never, userId);
      } else if (target === 'IPERC') {
        if (await IpercAction.findOne({ folio })) throw new Error('Folio duplicado');
        await createIperc(raw as never, userId);
      }
      inserted++;
    } catch (e) {
      rejected.push({ row: i + 2, folio, reason: (e as Error).message });
    }
  }

  return { total: rows.length, inserted, rejected };
}

const targetSource: Record<ImportTarget, 'STOP' | 'COMMISSION' | 'INCIDENT' | 'IPERC' | 'EXCEL'> = {
  HEINRICH: 'EXCEL',
  STOP: 'STOP',
  COMMISSION: 'COMMISSION',
  INCIDENT: 'INCIDENT',
  IPERC: 'IPERC',
};

export async function logImport(
  fileName: string,
  target: ImportTarget,
  result: ImportResult,
  mapping: Record<string, string>,
  userId?: Types.ObjectId
) {
  return ImportJob.create({
    fileName,
    target,
    source: targetSource[target],
    total: result.total,
    inserted: result.inserted,
    rejectedCount: result.rejected.length,
    rejected: result.rejected,
    mapping,
    createdBy: userId,
  });
}
