/** 생년월일 입력 검증 (서버 공통) */
import type { DayBoundary } from 'manseryeok';
import { calculateSaju, type SajuInput, type SajuResult } from '../src/lib/saju.js';
import { BadRequest, int } from './llm.js';

const BOUNDARIES: DayBoundary[] = ['midnight', 'jasi', 'splitJasi'];

export function parseBirth(b: unknown, label = 'birth'): SajuInput {
  if (!b || typeof b !== 'object') throw new BadRequest(`${label} 가 필요해요.`);
  const o = b as Record<string, unknown>;
  const gender = o.gender === 'male' || o.gender === 'female' ? o.gender : null;
  if (!gender) throw new BadRequest(`${label}.gender 는 male/female 이어야 해요.`);
  let longitude: number | null = null;
  if (o.longitude !== null && o.longitude !== undefined) {
    if (typeof o.longitude !== 'number' || o.longitude <= 120 || o.longitude >= 135) throw new BadRequest(`${label}.longitude 값이 올바르지 않아요.`);
    longitude = o.longitude;
  }
  return {
    year: int(o.year, `${label}.year`, 1900, 2100),
    month: int(o.month, `${label}.month`, 1, 12),
    day: int(o.day, `${label}.day`, 1, 31),
    hour: o.hour === null || o.hour === undefined ? null : int(o.hour, `${label}.hour`, 0, 23),
    minute: o.minute === undefined || o.minute === null ? 0 : int(o.minute, `${label}.minute`, 0, 59),
    isLunar: o.isLunar === true,
    isLeapMonth: o.isLeapMonth === true,
    gender,
    longitude,
    useTrueSolarTime: o.useTrueSolarTime !== false,
    dayBoundary: BOUNDARIES.includes(o.dayBoundary as DayBoundary) ? (o.dayBoundary as DayBoundary) : 'midnight',
  };
}

/** 만세력 엔진은 날짜 오류를 RangeError(한국어)로 던진다 → 400 으로 */
export function safeSaju(input: SajuInput): SajuResult {
  try {
    return calculateSaju(input);
  } catch (e) {
    if (e instanceof RangeError) throw new BadRequest(e.message);
    throw e;
  }
}

const MBTI_RE = /^[EI][SN][TF][JP]$/;
export function parseMbti(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).toUpperCase().trim();
  if (!MBTI_RE.test(s)) throw new BadRequest('MBTI 는 네 글자(예: INFP)로 입력해 주세요.');
  return s;
}
