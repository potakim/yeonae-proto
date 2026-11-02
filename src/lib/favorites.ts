import { useCallback, useState } from 'react';

// 즐겨찾기 (화면설계서 v0.2 §4.1). 프로토타입은 localStorage, 실서비스는 favorites 테이블.
const KEY = 'yeonae.favorites';
const DEFAULT = ['hub'];

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return Array.isArray(v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>(read);
  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-5);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return { ids, toggle, has: (id: string) => ids.includes(id) };
}
