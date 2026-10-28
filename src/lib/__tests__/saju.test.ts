import { describe, expect, it } from 'vitest';
import { calculateFourPillars, getSolarTermsOfYear } from 'manseryeok';
// 교차검증용 (중국 기준 만세력, devDependency)
// @ts-expect-error 타입 선언 없음
import { Solar } from 'lunar-javascript';
import { calculateSaju, type SajuInput } from '../saju';

const base: SajuInput = {
  year: 1992,
  month: 10,
  day: 24,
  hour: 5,
  minute: 30,
  isLunar: false,
  isLeapMonth: false,
  gender: 'male',
  longitude: null,
  useTrueSolarTime: false,
  dayBoundary: 'midnight',
};

describe('만세력 골든 케이스', () => {
  it('1992-10-24 05:30 → 임신·경술·계유·을묘', () => {
    const r = calculateSaju(base);
    expect(r.detail.toObject()).toEqual({ year: '임신', month: '경술', day: '계유', hour: '을묘' });
  });

  it('음력 1992-09-29 입력 = 양력 1992-10-24 와 같은 원국', () => {
    const r = calculateSaju({ ...base, year: 1992, month: 9, day: 29, isLunar: true });
    expect(r.solarDate).toEqual({ year: 1992, month: 10, day: 24 });
    expect(r.detail.toObject()).toEqual({ year: '임신', month: '경술', day: '계유', hour: '을묘' });
  });

  it('진태양시 보정: 1990-05-15 07:05 서울 → 진시가 아닌 묘시, 보정 차이를 알려 줌', () => {
    const r = calculateSaju({ ...base, year: 1990, month: 5, day: 15, hour: 7, minute: 5, longitude: 126.978, useTrueSolarTime: true });
    expect(r.detail.hourString).toBe('기묘');
    expect(r.correctionDiff.map((c) => c.key)).toContain('hour');
  });

  it('시간 모름 + 입춘 당일(2024-02-04)은 연·월주 후보가 갈림을 경고', () => {
    const r = calculateSaju({ ...base, year: 2024, month: 2, day: 4, hour: null });
    const keys = r.ambiguousWithoutHour.map((a) => a.key);
    expect(keys).toContain('year');
    expect(keys).toContain('month');
    // 시주 제외 6글자
    expect(Object.values(r.elementCounts).reduce((a, b) => a + b, 0)).toBe(6);
  });

  it('시간 모름 + 평범한 날은 진태양시를 켜도 후보 경고가 없음', () => {
    const r = calculateSaju({ ...base, year: 1995, month: 3, day: 15, hour: null, longitude: 126.978, useTrueSolarTime: true });
    expect(r.ambiguousWithoutHour).toEqual([]);
    expect(r.detail.dayString).toBe(calculateSaju({ ...base, year: 1995, month: 3, day: 15, hour: 12, minute: 0 }).detail.dayString);
  });

  it('존재하지 않는 음력 날짜는 오류', () => {
    expect(() => calculateSaju({ ...base, year: 2023, month: 2, day: 30, isLunar: true, isLeapMonth: true })).toThrow();
  });
});

describe('lunar-javascript(6tail) 교차검증', () => {
  const toYmd = (d: Date) => [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()] as const;

  // 1900-01-01 ~ 2099-12-31, 13일 간격 샘플 (~5,600일)
  const dates: (readonly [number, number, number])[] = [];
  for (let t = Date.UTC(1900, 0, 1); t < Date.UTC(2100, 0, 1); t += 13 * 86400000) {
    dates.push(toYmd(new Date(t)));
  }

  it('일주(日柱)는 전 구간 일치', () => {
    const mismatches = dates.filter(([y, m, d]) => {
      const ours = calculateFourPillars({ year: y, month: m, day: d, hour: 12, minute: 0 }).dayHanja;
      const theirs = Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar().getEightChar().getDay();
      return ours !== theirs;
    });
    expect(mismatches).toEqual([]);
  });

  it('연주·월주 불일치는 절입일(±2일)에서만 발생 — 한국(KST)·중국(CST) 기준 차이', () => {
    const nearTerm = (y: number, m: number, d: number) => {
      const t = Date.UTC(y, m - 1, d);
      return [y - 1, y, y + 1]
        .filter((yy) => yy >= 1800 && yy <= 2300)
        .flatMap((yy) => getSolarTermsOfYear(yy))
        .filter((s) => s.index % 2 === 0) // 절(節)만
        .some((s) => Math.abs(s.date.getTime() - t) <= 2 * 86400000);
    };
    const bad = dates.filter(([y, m, d]) => {
      const ours = calculateFourPillars({ year: y, month: m, day: d, hour: 12, minute: 0 });
      const ec = Solar.fromYmdHms(y, m, d, 12, 0, 0).getLunar().getEightChar();
      const differs = ours.yearHanja !== ec.getYear() || ours.monthHanja !== ec.getMonth();
      return differs && !nearTerm(y, m, d);
    });
    expect(bad).toEqual([]);
  });
});
