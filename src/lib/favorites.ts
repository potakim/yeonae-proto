import { useCallback, useState } from 'react';

// 즐겨찾기 (화면설계서 v0.2 §4.1). 프로토타입은 localStorage, 실서비스는 favorites 테이블.
const KEY = 'yeonae.favorites';
const DEFAULT: string[] | null = null; // 한 번도 고른 적 없으면 null → 홈이 성별 허브를 기본 즐겨찾기로 보여 준다

function read(): string[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return Array.isArray(v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

/** defaultId: 아직 즐겨찾기를 건드린 적 없는 사용자에게 고정해 보여 줄 성별 허브 (기훈형/고은언니) */
export function useFavorites(defaultId: string) {
  const [stored, setStored] = useState<string[] | null>(read);
  const ids = stored ?? [defaultId];
  const toggle = useCallback(
    (id: string) => {
      setStored((prev) => {
        const cur = prev ?? [defaultId];
        const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-5);
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [defaultId],
  );
  return { ids, toggle, has: (id: string) => ids.includes(id) };
}
