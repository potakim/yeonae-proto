import { describe, expect, it } from 'vitest';
import { calculateFourPillars, getSolarTermsOfYear } from 'manseryeok';
// 교차검증용 (중국 기준 만세력, devDependency)
// @ts-expect-error 타입 선언 없음
import { Solar } from 'lunar-javascript';
import { calculateSaju, normalizeBirthOptions, toLlmPayload, type SajuInput } from '../saju';
import { defaultBirth } from '../birth-defaults';

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
  timeStandard: 'none',
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
    const r = calculateSaju({ ...base, year: 1990, month: 5, day: 15, hour: 7, minute: 5, longitude: 126.978, timeStandard: 'trueSolar' });
    expect(r.detail.hourString).toBe('기묘');
    expect(r.standardDiff.find((d) => d.standard === 'none')!.changes.map((c) => c.key)).toContain('hour');
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
    const r = calculateSaju({ ...base, year: 1995, month: 3, day: 15, hour: null, longitude: 126.978, timeStandard: 'trueSolar' });
    expect(r.ambiguousWithoutHour).toEqual([]);
    expect(r.detail.dayString).toBe(calculateSaju({ ...base, year: 1995, month: 3, day: 15, hour: 12, minute: 0 }).detail.dayString);
  });

  it('보정 없음에서도 서머타임은 반영: 1988-07-15 09:40(서머타임) = 실제 KST 08:40 → 진시', () => {
    const r = calculateSaju({ ...base, year: 1988, month: 7, day: 15, hour: 9, minute: 40, timeStandard: 'none' });
    expect(r.detail.hour.earthlyBranch).toBe('진');
  });

  it('보정 없음에서도 1954~61년 UTC+8:30 표준시는 반영: 1958-01-10 06:50 = KST 07:20 → 진시', () => {
    const r = calculateSaju({ ...base, year: 1958, month: 1, day: 10, hour: 6, minute: 50, timeStandard: 'none' });
    expect(r.detail.hour.earthlyBranch).toBe('진');
  });

  it('보정 없음은 평상시(1990년대) 입력을 KST 그대로 사용', () => {
    const r = calculateSaju({ ...base, timeStandard: 'none' });
    expect(r.detail.toObject()).toEqual({ year: '임신', month: '경술', day: '계유', hour: '을묘' });
  });

  it('존재하지 않는 음력 날짜는 오류', () => {
    expect(() => calculateSaju({ ...base, year: 2023, month: 2, day: 30, isLunar: true, isLeapMonth: true })).toThrow();
  });
});

describe('한국 기준 기본값 (2026-11-11 결정)', () => {
  const ko: SajuInput = { ...base, timeStandard: 'korea', dayBoundary: 'jasi' };

  it('기본값은 한국 표준 보정 + 자시부터 다음날', () => {
    const d = defaultBirth();
    expect(d.timeStandard).toBe('korea');
    expect(d.dayBoundary).toBe('jasi');
  });

  it('한국 표준 보정은 30분 경계: 07:29 묘시, 07:30 진시 (서울·부산 상관없이 같음)', () => {
    const at = (h: number, m: number, longitude: number | null) =>
      calculateSaju({ ...ko, year: 1995, month: 11, day: 5, hour: h, minute: m, longitude }).detail.hour.earthlyBranch;
    expect(at(7, 29, 126.978)).toBe('묘');
    expect(at(7, 30, 126.978)).toBe('진');
    expect(at(7, 29, 129.075)).toBe('묘');
  });

  it('같은 출생이라도 기준별로 다르면 차이를 알려 준다: 1995-11-05 07:20 서울', () => {
    const r = calculateSaju({ ...ko, year: 1995, month: 11, day: 5, hour: 7, minute: 20, longitude: 126.978 });
    expect(r.detail.hourString).toBe('기묘');
    expect(r.standardDiff.map((d) => d.standard).sort()).toEqual(['none', 'trueSolar']);
    expect(r.standardDiff.every((d) => d.changes.some((c) => c.key === 'hour' && c.value === '경진'))).toBe(true);
  });

  it('국내 보정 규칙과 일치: 1958(UTC+8:30)은 시계 그대로, 1988 서머타임은 90분, 평소는 30분', () => {
    // 1958-01-10 06:50 → 그대로 06:50 → 묘시
    expect(calculateSaju({ ...ko, year: 1958, month: 1, day: 10, hour: 6, minute: 50 }).detail.hour.earthlyBranch).toBe('묘');
    // 1988-07-15 09:40 (서머타임) → 08:10 → 진시
    expect(calculateSaju({ ...ko, year: 1988, month: 7, day: 15, hour: 9, minute: 40 }).detail.hour.earthlyBranch).toBe('진');
    // 1958-07-15 10:40 (UTC+8:30 + 서머타임) → 09:40 → 사시
    expect(calculateSaju({ ...ko, year: 1958, month: 7, day: 15, hour: 10, minute: 40 }).detail.hour.earthlyBranch).toBe('사');
    // 1995-07-15 09:20 (평소) → 08:50 → 진시
    expect(calculateSaju({ ...ko, year: 1995, month: 7, day: 15, hour: 9, minute: 20 }).detail.hour.earthlyBranch).toBe('진');
  });

  it('자시: 23:20 은 당일 해시, 23:50 은 다음날 갑자시. 야자시 적용 시 일주만 당일', () => {
    const at = (h: number, m: number, rule: 'jasi' | 'splitJasi') => {
      const r = calculateSaju({ ...ko, year: 2024, month: 3, day: 10, hour: h, minute: m, dayBoundary: rule });
      return `${r.detail.dayString} ${r.detail.hourString}`;
    };
    expect(at(23, 20, 'jasi')).toBe('계유 계해');
    expect(at(23, 50, 'jasi')).toBe('갑술 갑자');
    expect(at(23, 50, 'splitJasi')).toBe('계유 갑자');
    // 다음날 00:20 도 같은 자시
    expect(calculateSaju({ ...ko, year: 2024, month: 3, day: 11, hour: 0, minute: 20 }).detail.hourString).toBe('갑자');
  });

  it('자시 출생이면 야자시 적용 시 달라지는 일주를 알려 준다', () => {
    const r = calculateSaju({ ...ko, year: 2024, month: 3, day: 10, hour: 23, minute: 50 });
    expect(r.jasiDiff).toEqual({ rule: 'splitJasi', changes: [{ key: 'day', value: '계유' }] });
    expect(calculateSaju({ ...ko, year: 2024, month: 3, day: 10, hour: 14, minute: 0 }).jasiDiff).toBeNull();
  });

  it('띠: 1995-02-02 은 설날(1/31) 지나 돼지띠지만 입춘(2/4) 전이라 사주는 개띠', () => {
    const r = calculateSaju({ ...ko, year: 1995, month: 2, day: 2, hour: 12, minute: 0 });
    expect(r.detail.yearString).toBe('갑술');
    expect(r.zodiac).toEqual({ saju: '개', seollal: '돼지', differs: true });
    expect(calculateSaju({ ...ko, year: 1995, month: 3, day: 2, hour: 12, minute: 0 }).zodiac.differs).toBe(false);
  });

  it('이전 형식 입력 변환: useTrueSolarTime·midnight', () => {
    expect(normalizeBirthOptions({})).toEqual({ timeStandard: 'korea', dayBoundary: 'jasi' });
    expect(normalizeBirthOptions({ useTrueSolarTime: true, dayBoundary: 'midnight' })).toEqual({ timeStandard: 'trueSolar', dayBoundary: 'jasi' });
    expect(normalizeBirthOptions({ useTrueSolarTime: false, dayBoundary: 'splitJasi' })).toEqual({ timeStandard: 'none', dayBoundary: 'splitJasi' });
    expect(normalizeBirthOptions({ timeStandard: 'none', useTrueSolarTime: true })).toEqual({ timeStandard: 'none', dayBoundary: 'jasi' });
    expect(normalizeBirthOptions({ timeStandard: 'weird' })).toEqual({ timeStandard: 'korea', dayBoundary: 'jasi' });
  });

  it('LLM 데이터에 적용 기준·보정 시각·대운 표기가 들어간다', () => {
    const p = toLlmPayload(calculateSaju({ ...ko, year: 1995, month: 3, day: 15, hour: 7, minute: 20, gender: 'female' }), { year: 2026, month: 11, day: 11 });
    expect(p.schema).toBe('modu-yeonae.saju.v3');
    expect(p.basis).toEqual(['한국 표준 보정(동경 127.5°)', '서머타임·옛 표준시 반영', '밤 11시 30분부터 다음날']);
    expect(p.correctedTime!.time).toBe('06:50');
    expect(p.luckPillars!.list[0].display).toMatch(/^\d+대운 · 만 \d+세 \d+개월\(\d{4}년 \d{1,2}월\)부터$/);
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
