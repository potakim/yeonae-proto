/**
 * 진태양시 보정 시각 계산 (manseryeok@2.0.0 내부 모듈 이식).
 *
 * manseryeok 은 보정된 시각을 외부로 내보내지 않아서, 원국 JSON 에 "입력 시각 → 보정 시각"을
 * 남기기 위해 같은 로직을 그대로 옮겼다. 시주 판정은 여전히 라이브러리가 하고,
 * 여기 값은 기록·표시용이다. 라이브러리 시주와 일치하는지는 테스트에서 확인한다.
 *
 * 원본: manseryeok/dist/time/korea-timezone.js, true-solar-time.js
 * MIT License, Copyright (c) 2025 Yoohyojun
 */
import { equationOfTimeMinutes } from 'manseryeok';

const STANDARD_EPOCHS = [
  { year: 1908, month: 4, day: 1, offsetMin: 510 },
  { year: 1912, month: 1, day: 1, offsetMin: 540 },
  { year: 1954, month: 3, day: 21, offsetMin: 510 },
  { year: 1961, month: 8, day: 10, offsetMin: 540 },
];
const DEFAULT_OFFSET_MIN = 540;

const DST_INTERVALS = [
  [[1948, 6, 1, 0], [1948, 9, 13, 0]],
  [[1949, 4, 3, 0], [1949, 9, 11, 0]],
  [[1950, 4, 1, 0], [1950, 9, 10, 0]],
  [[1951, 5, 6, 0], [1951, 9, 9, 0]],
  [[1955, 5, 5, 0], [1955, 9, 9, 0]],
  [[1956, 5, 20, 0], [1956, 9, 30, 0]],
  [[1957, 5, 5, 0], [1957, 9, 22, 0]],
  [[1958, 5, 4, 0], [1958, 9, 21, 0]],
  [[1959, 5, 3, 0], [1959, 9, 20, 0]],
  [[1960, 5, 1, 0], [1960, 9, 18, 0]],
  [[1987, 5, 10, 2], [1987, 10, 11, 3]],
  [[1988, 5, 8, 2], [1988, 10, 9, 3]],
] as const;

const key = (y: number, mo: number, d: number, h: number) => ((y * 12 + (mo - 1)) * 31 + (d - 1)) * 24 + h;

function standardOffsetMin(y: number, mo: number, d: number): number {
  const k = key(y, mo, d, 0);
  let offset = DEFAULT_OFFSET_MIN;
  for (const e of STANDARD_EPOCHS) {
    if (k >= key(e.year, e.month, e.day, 0)) offset = e.offsetMin;
    else break;
  }
  return offset;
}

export function isKoreaDst(y: number, mo: number, d: number, h: number): boolean {
  const k = key(y, mo, d, h);
  return DST_INTERVALS.some(([s, e]) => k >= key(s[0], s[1], s[2], s[3]) && k < key(e[0], e[1], e[2], e[3]));
}

export interface CorrectedTime {
  /** 보정된 지방 진태양시 HH:MM */
  time: string;
  /** 보정으로 날짜가 바뀌었으면 그 날짜 */
  date: { year: number; month: number; day: number };
  /** 입력 시각 대비 총 보정량(분, 음수면 이르게) */
  totalMinutes: number;
  breakdown: { longitudeMinutes: number; equationOfTimeMinutes: number; standardOffsetMinutes: number; dstApplied: boolean };
}

/** 한국 벽시계 시각 → 출생지 지방 진태양시 */
export function toTrueSolarTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  longitude: number,
): CorrectedTime {
  const MIN = 60000;
  const dst = isKoreaDst(year, month, day, hour);
  const std = standardOffsetMin(year, month, day);
  const civil = std + (dst ? 60 : 0);
  const wallMs = Date.UTC(year, month - 1, day, hour, minute);
  const instant = wallMs - civil * MIN;
  const eot = equationOfTimeMinutes(instant);
  const apparent = instant + (longitude * 4 + eot) * MIN;
  const a = new Date(apparent);
  return {
    time: `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`,
    date: { year: a.getUTCFullYear(), month: a.getUTCMonth() + 1, day: a.getUTCDate() },
    totalMinutes: Math.round((apparent - wallMs) / MIN),
    breakdown: {
      longitudeMinutes: Math.round((longitude * 4 - std) * 10) / 10,
      equationOfTimeMinutes: Math.round(eot * 10) / 10,
      standardOffsetMinutes: std,
      dstApplied: dst,
    },
  };
}
