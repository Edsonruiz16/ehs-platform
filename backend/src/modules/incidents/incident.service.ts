import { Types } from 'mongoose';
import { Incident, IIncident } from '../../models/Incident';
import { emitHeinrichRecord } from '../../services/heinrich.service';
import { upsertActionFromSource } from '../../services/action.service';

async function consolidate(doc: IIncident, userId?: Types.ObjectId) {
  await emitHeinrichRecord({
    folio: doc.folio,
    date: doc.eventDate,
    level: doc.level,
    source: 'INCIDENT',
    sourceRef: doc._id as Types.ObjectId,
    severity: doc.severity,
    risk: doc.risk,
    area: doc.area,
    machine: doc.machine,
    description: doc.description,
    createdBy: userId,
  });

  await upsertActionFromSource({
    folio: doc.folio,
    source: 'INCIDENT',
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

export async function createIncident(payload: Partial<IIncident>, userId?: Types.ObjectId) {
  const doc = await Incident.create({ ...payload, createdBy: userId });
  await consolidate(doc, userId);
  return doc;
}

export async function updateIncident(id: string, payload: Partial<IIncident>, userId?: Types.ObjectId) {
  const doc = await Incident.findByIdAndUpdate(id, payload, { new: true });
  if (doc) await consolidate(doc, userId);
  return doc;
}
