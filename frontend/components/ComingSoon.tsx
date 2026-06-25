export default function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="card text-center py-16">
        <div className="text-4xl mb-3">🚧</div>
        <p className="text-slate-600 font-medium">Módulo en construcción (siguiente iteración del frontend).</p>
        <p className="text-sm text-muted mt-2">
          {note ??
            'El backend ya expone todos los endpoints CRUD para esta sección; falta la UI, que sigue el mismo patrón que Observaciones STOP.'}
        </p>
      </div>
    </div>
  );
}
