'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted">Cargando…</div>;
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen p-6 max-w-[1600px]">{children}</main>
    </div>
  );
}
