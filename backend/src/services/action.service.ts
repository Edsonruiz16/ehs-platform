import { Types } from 'mongoose';
import { Action, IAction } from '../models/Action';
import { RiskLevel, Source, ActionStatus } from '../constants/enums';

export interface UpsertActionInput {
  folio: string;
  source: Source;
  sourceRef?: Types.ObjectId;
  area?: string;
  machine?: string;
  description: string;
  requiredAction: string;
  risk: RiskLevel;
  responsible: string;
  dueDate?: Date;
  status?: ActionStatus;
  createdBy?: Types.ObjectId;
}

/**
 * Crea/actualiza una acción en el MOTOR ÚNICO. Si la fuente no trae acción
 * requerida ni responsable, no se crea (devuelve null).
 */
export async function upsertActionFromSource(input: UpsertActionInput): Promise<IAction | null> {
  if (!input.requiredAction || !input.responsible) return null;

  return Action.findOneAndUpdate(
    { folio: input.folio, source: input.source },
    {
      $set: {
        source: input.source,
        sourceRef: input.sourceRef,
        area: input.area,
        machine: input.machine,
        description: input.description,
        requiredAction: input.requiredAction,
        risk: input.risk,
        responsible: input.responsible,
        dueDate: input.dueDate,
      },
      $setOnInsert: { status: input.status ?? 'ABIERTA', createdBy: input.createdBy },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/** Registra cambio de estatus con historial. */
export async function changeActionStatus(
  id: string,
  status: ActionStatus,
  by?: Types.ObjectId,
  evidence?: string
): Promise<IAction | null> {
  const action = await Action.findById(id);
  if (!action) return null;

  if (action.status !== status) {
    action.history.push({ at: new Date(), by, field: 'status', from: action.status, to: status });
    action.status = status;
    action.closedAt = status === 'CERRADA' ? new Date() : undefined;
  }
  if (evidence) action.evidence.push(evidence);
  action.updatedBy = by;
  await action.save();
  return action;
}
