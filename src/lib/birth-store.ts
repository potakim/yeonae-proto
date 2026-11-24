/**
 * 내 출생 정보 보관 — 이 기기(localStorage)에만 저장한다 (2026-11-24 결정, 프로토타입).
 * 실서비스: 토스 로그인 생년월일·성별 + 서버 저장으로 교체. 지우기 버튼으로 언제든 삭제할 수 있다.
 */
import type { SajuInput } from './saju';
import { placeOfLongitude, type BirthPlace } from '../data/regions';

export interface StoredBirth {
  input: SajuInput;
  place: BirthPlace;
}

export const BIRTH_KEY = 'yeonae.birth';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const storageOrNull = (): StorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
const isInt = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** 저장값이 깨졌거나 형식이 다르면 null (다시 입력받는다) */
export function parseStoredBirth(raw: string | null): StoredBirth | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { input?: Record<string, unknown>; place?: { sido?: unknown; district?: unknown } };
    const i = o?.input;
    if (!i || !isInt(i.year, 1900, 2100) || !isInt(i.month, 1, 12) || !isInt(i.day, 1, 31)) return null;
    if (i.hour !== null && !isInt(i.hour, 0, 23)) return null;
    if (i.gender !== 'male' && i.gender !== 'female') return null;
    if (i.longitude !== null && typeof i.longitude !== 'number') return null;
    const input = { ...i, minute: isInt(i.minute, 0, 59) ? i.minute : 0, isLunar: i.isLunar === true, isLeapMonth: i.isLeapMonth === true } as unknown as SajuInput;
    const place: BirthPlace = typeof o.place?.sido === 'string' && typeof o.place?.district === 'string' ? { sido: o.place.sido, district: o.place.district } : placeOfLongitude(input.longitude ?? null);
    return { input, place };
  } catch {
    return null;
  }
}

export function loadBirth(storage: StorageLike | null = storageOrNull()): StoredBirth | null {
  try {
    return parseStoredBirth(storage?.getItem(BIRTH_KEY) ?? null);
  } catch {
    return null;
  }
}
export function saveBirth(b: StoredBirth, storage: StorageLike | null = storageOrNull()): void {
  try {
    storage?.setItem(BIRTH_KEY, JSON.stringify(b));
  } catch {
    /* 저장 실패는 무시 (이번 세션에서는 메모리 값으로 계속 쓴다) */
  }
}
export function clearBirth(storage: StorageLike | null = storageOrNull()): void {
  try {
    storage?.removeItem(BIRTH_KEY);
  } catch {
    /* ignore */
  }
}
