import { Types } from 'mongoose';
import { IpercAction, IIpercAction } from '../../models/IpercAction';
import { upsertActionFromSource } from '../../services/action.service';

/** IPERC no alimenta la pirámide; sólo el motor de acciones (source = IPERC). */
async function consolidate(doc: IIpercAction, userId?: Types.ObjectId) {
  await upsertActionFromSource({
    folio: doc.folio,
    source: 'IPERC',
    sourceRef: doc._id as Types.ObjectId,
    area: doc.area,
    machine: doc.machine,
    description: doc.description,
    requiredAction: doc.requiredAction,
    risk: doc.riskLevel,
    responsible: doc.responsible,
    dueDate: doc.dueDate,
    status: doc.status as never,
    createdBy: userId,
  });
}

export async function createIperc(payload: Partial<IIpercAction>, userId?: Types.ObjectId) {
  const doc = await IpercAction.create({ ...payload, createdBy: userId });
  await consolidate(doc, userId);
  return doc;
}

export async function updateIperc(id: string, payload: Partial<IIpercAction>, userId?: Types.ObjectId) {
  const doc = await IpercAction.findByIdAndUpdate(id, payload, { new: true });
  if (doc) await consolidate(doc, userId);
  return doc;
}
