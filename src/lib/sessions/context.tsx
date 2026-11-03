import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LocalSessionStore, type SessionStore } from './store';

const Ctx = createContext<SessionStore | null>(null);

export function SessionProvider({ children, store }: { children: ReactNode; store?: SessionStore }) {
  const value = useMemo(() => store ?? new LocalSessionStore(), [store]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 저장소 + 변경 시 리렌더 */
// oxlint-disable-next-line react/only-export-components
export function useSessionStore(): SessionStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('SessionProvider 가 필요해요');
  const [, bump] = useState(0);
  useEffect(() => store.subscribe(() => bump((n) => n + 1)), [store]);
  return store;
}
