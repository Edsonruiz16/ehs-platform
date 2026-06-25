'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/pyramid', label: 'Pirámide Heinrich', icon: '🔺' },
  { href: '/observations-stop', label: 'Observaciones STOP', icon: '👁️' },
  { href: '/commission', label: 'Comisión Seg. e Higiene', icon: '📋' },
  { href: '/incidents', label: 'Incidentes / Accidentes', icon: '⚠️' },
  { href: '/iperc', label: 'Acciones IPERC', icon: '🛡️' },
  { href: '/actions', label: 'Motor de Acciones', icon: '✅' },
  { href: '/import', label: 'Importar Excel', icon: '📥' },
  { href: '/catalogs', label: 'Catálogos', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 shrink-0 bg-brand-dark text-white min-h-screen flex flex-col">
      <div className="p-4 flex items-center gap-3 border-b border-white/10">
        <div className="h-9 w-9 rounded-lg bg-white/15 grid place-items-center font-bold">EHS</div>
        <div>
          <div className="font-semibold leading-tight">EHS Platform</div>
          <div className="text-[11px] text-white/60">Seguridad Industrial</div>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active ? 'bg-white/15 font-medium' : 'text-white/75 hover:bg-white/10'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="text-sm font-medium truncate">{user?.name}</div>
        <div className="text-[11px] text-white/60 mb-2">{user?.role}</div>
        <button onClick={logout} className="btn-ghost w-full !bg-white/10 !text-white hover:!bg-white/20 text-xs">
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
