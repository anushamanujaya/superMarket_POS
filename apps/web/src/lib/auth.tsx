'use client';
import { createContext, ReactNode, useContext } from 'react';

export interface Me {
  id: string;
  name: string;
  permissions: string[];
  branchIds: string[] | 'ALL';
}

const Ctx = createContext<Me | null>(null);

export function AuthProvider({ me, children }: { me: Me; children: ReactNode }) {
  return <Ctx.Provider value={me}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const me = useContext(Ctx);
  if (!me) throw new Error('AuthProvider missing');
  return { me, can: (perm: string) => me.permissions.includes(perm) };
}
