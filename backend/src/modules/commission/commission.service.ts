import { Types } from 'mongoose';
import { ObservationCommission, IObservationCommission } from '../../models/ObservationCommission';
import { emitHeinrichRecord } from '../../services/heinrich.service';
import { upsertActionFromSource } from '../../services/action.service';

async function consolidate(doc: IObservationCommission, userId?: Types.ObjectId) {
  await emitHeinrichRecord({
    folio: doc.folio,
    date: doc.date,
    level: doc.level,
    source: 'COMMISSION',
    sourceRef: doc._id as Types.ObjectId,
    risk: doc.risk,
    area: doc.area,
    machine: doc.machine,
    description: doc.description,
    createdBy: userId,
  });

  await upsertActionFromSource({
    folio: doc.folio,
    source: 'COMMISSION',
    sourceRef: doc._id as Types.ObjectId,
    area: doc.area,
    machine: doc.machine,
    description: doc.description,
    requiredAction: doc.correctiveAction ?? '',
    risk: doc.risk,
    responsible: doc.responsible ?? '',
    dueDate: doc.dueDate,
    createdBy: userId,
  });
}

export async function createCommission(payload: Partial<IObservationCommission>, userId?: Types.ObjectId) {
  const doc = await ObservationCommission.create({ ...payload, createdBy: userId });
  await consolidate(doc, userId);
  return doc;
}

export async function updateCommission(id: string, payload: Partial<IObservationCommission>, userId?: Types.ObjectId) {
  const doc = await ObservationCommission.findByIdAndUpdate(id, payload, { new: true });
  if (doc) await consolidate(doc, userId);
  return doc;
}
