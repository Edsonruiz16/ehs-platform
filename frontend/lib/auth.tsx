'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken, clearToken, getToken } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'CAPTURISTA' | 'CONSULTA';
  area?: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ehs_user') : null;
    if (stored && getToken()) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setToken(res.token);
    localStorage.setItem('ehs_user', JSON.stringify(res.user));
    setUser(res.user);
    router.push('/');
  }

  function logout() {
    clearToken();
    setUser(null);
    router.push('/login');
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
