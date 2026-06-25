import { ObservationStop, IObservationStop } from '../../models/ObservationStop';
import { emitHeinrichRecord } from '../../services/heinrich.service';
import { upsertActionFromSource } from '../../services/action.service';
import { Types } from 'mongoose';

/** Propaga una observación STOP a la pirámide y al motor de acciones. */
async function consolidate(doc: IObservationStop, userId?: Types.ObjectId) {
  await emitHeinrichRecord({
    folio: doc.folio,
    date: doc.date,
    level: doc.level,
    source: 'STOP',
    sourceRef: doc._id as Types.ObjectId,
    risk: doc.risk,
    area: doc.area,
    machine: doc.machine,
    description: doc.description,
    createdBy: userId,
  });

  await upsertActionFromSource({
    folio: doc.folio,
    source: 'STOP',
    sourceRef: doc._id as Types.ObjectId,
    area: doc.area,
    machine: doc.machine,
    description: doc.description,
    requiredAction: doc.requiredAction ?? '',
    risk: doc.risk,
    responsible: doc.responsible ?? '',
    dueDate: doc.dueDate,
    createdBy: userId,
  });
}

export async function createStop(payload: Partial<IObservationStop>, userId?: Types.ObjectId) {
  const doc = await ObservationStop.create({ ...payload, createdBy: userId });
  await consolidate(doc, userId);
  return doc;
}

export async function updateStop(id: string, payload: Partial<IObservationStop>, userId?: Types.ObjectId) {
  const doc = await ObservationStop.findByIdAndUpdate(id, payload, { new: true });
  if (doc) await consolidate(doc, userId);
  return doc;
}
