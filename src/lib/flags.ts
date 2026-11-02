// 기능 플래그 (화면설계서 v0.2 §8). 실서비스는 서버 원격 설정(feature_flags)으로 교체.
// 프로토타입: 빌드 환경변수 VITE_FLAG_INTRO_TAB=1 또는 URL ?intro=1 / localStorage 로 켠다.
export type Flag = 'intro_tab';

const KEY = 'yeonae.flags';

function stored(): Partial<Record<Flag, boolean>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function isOn(flag: Flag): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  if (flag === 'intro_tab' && q.has('intro')) return q.get('intro') !== '0';
  const s = stored();
  if (flag in s) return !!s[flag];
  if (flag === 'intro_tab') return import.meta.env.VITE_FLAG_INTRO_TAB === '1';
  return false;
}

export function setFlag(flag: Flag, on: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...stored(), [flag]: on }));
  } catch {
    /* ignore */
  }
}
