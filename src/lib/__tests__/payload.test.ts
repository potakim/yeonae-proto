import { describe, expect, it } from 'vitest';
import { calculateFourPillars } from 'manseryeok';
import { calculateSaju, toLlmPayload, type SajuInput } from '../saju';
import { branchRelations, twelveStage } from '../saju-analysis';
import { toTrueSolarTime } from '../vendor/korea-time';

// 사용자 검증 케이스: 1979-01-27 서울 남성, 午시 (시각은 午시 범위 안의 값으로 가정)
const user: SajuInput = {
  year: 1979, month: 1, day: 27, hour: 12, minute: 30,
  isLunar: false, isLeapMonth: false, gender: 'male',
  longitude: 126.978, useTrueSolarTime: true, dayBoundary: 'midnight',
};

describe('v2 payload — 1979-01-27 갑오 일주', () => {
  const p = toLlmPayload(calculateSaju(user), { year: 2026, month: 10, day: 28 });

  it('원국·십신은 v1과 동일', () => {
    expect([p.pillars.year!.ganji, p.pillars.month!.ganji, p.pillars.day!.ganji, p.pillars.hour!.ganji]).toEqual(['무오', '을축', '갑오', '경오']);
    expect(p.pillars.year!.branch.tenGod).toBe('상관');
    expect(p.pillars.month!.branch.tenGod).toBe('정재');
  });

  it('午 지지: 자리 음양은 양, 정기는 丁(음) → 상관', () => {
    expect(p.pillars.day!.branch.yinYangPosition).toBe('양');
    expect(p.pillars.day!.branch.mainQi).toBe('정');
    expect(p.pillars.day!.branch.hiddenStems.map((h) => h.stem)).toEqual(['병', '기', '정']);
  });

  it('12운성: 갑목은 午에서 사(死), 丑에서 관대', () => {
    expect(p.pillars.day!.twelveStage).toBe('사');
    expect(p.pillars.month!.twelveStage).toBe('관대');
  });

  it('관계: 을경합, 갑경충, 午午 자형, 丑午 해·원진', () => {
    const types = p.relations.map((r) => `${r.type}:${[...new Set(r.chars)].sort().join('')}`);
    expect(types).toContain('천간합:경을');
    expect(types).toContain('천간충:갑경');
    expect(types).toContain('자형:오');
    expect(p.relations.find((r) => r.type === '자형')!.where).toEqual(['연주', '일주', '시주']);
    // 丑 1개와 午 3개의 관계는 한 건으로 묶인다
    const hae = p.relations.find((r) => r.type === '해')!;
    expect(hae.where).toEqual(['연주', '월주', '일주', '시주']);
    expect(hae.note).toContain('오 3개');
    expect(types.filter((t) => t === '원진:오축')).toHaveLength(1);
  });

  it('신살: 홍염(午), 천을귀인(丑), 도화(午, 사유축 기준은 없음 — 인오술 기준 卯 없음)', () => {
    const names = p.specialStars.map((s) => `${s.name}:${s.char}`);
    expect(names).toContain('홍염살:오');
    expect(names).toContain('천을귀인:축');
    expect(names).not.toContain('도화:묘');
  });

  it('신강약: 비겁 을 하나뿐 → 신약 계열, 득령 못함', () => {
    expect(p.strength.deukryeong).toBe(false);
    expect(p.strength.verdict).toMatch(/신약/);
  });

  it('대운: 순행, 현재(2026-10) 경오 대운', () => {
    expect(p.luckPillars!.direction).toBe('forward');
    expect(p.now.luck!.ganji).toBe('경오');
    expect(p.luckPillars!.list.filter((l) => l.current)).toHaveLength(1);
  });

  it('세운 2026 = 병오, 원국 午와 자형', () => {
    expect(p.now.annual.ganji).toBe('병오');
    expect(p.now.annual.relationsWithNatal.some((r) => r.type === '자형')).toBe(true);
  });

  it('진태양시: 서울 12:30 → 약 11:45 (경도 -32분, 균시차 약 -13분)', () => {
    expect(p.correctedTime!.time).toBe('11:45');
    expect(p.ageNow).toBe(47);
    expect(p.voidBranches.byDayPillar).toEqual(['진', '사']);
  });
});

describe('분석 표 단위 검증', () => {
  it('12운성 양간 순행/음간 역행', () => {
    expect(twelveStage('갑', '해')).toBe('장생');
    expect(twelveStage('갑', '묘')).toBe('제왕');
    expect(twelveStage('을', '오')).toBe('장생');
    expect(twelveStage('을', '사')).toBe('목욕');
    expect(twelveStage('경', '유')).toBe('제왕');
  });

  it('삼합·반합·방합·충', () => {
    const t = (bs: string[]) =>
      branchRelations(bs.map((c, i) => ({ pos: (['year', 'month', 'day', 'hour'] as const)[i], char: c as never }))).map((r) => r.type);
    expect(t(['신', '자', '진'])).toContain('삼합');
    expect(t(['인', '오', '해'])).toContain('반합');
    expect(t(['인', '술', '해'])).not.toContain('반합');
    expect(t(['사', '오', '미'])).toContain('방합');
    expect(t(['자', '오'])).toContain('충');
    expect(t(['인', '사', '신'])).toContain('삼형');
  });

  it('보정 시각으로 다시 계산한 시주가 엔진 시주와 같다 (여러 날짜 샘플)', () => {
    const samples = [
      [1955, 6, 1, 7, 10], [1987, 7, 1, 13, 5], [1979, 1, 27, 12, 30], [2001, 11, 3, 23, 40], [1990, 5, 15, 7, 5],
    ] as const;
    for (const [y, m, d, h, mi] of samples) {
      const lib = calculateFourPillars({
        year: y, month: m, day: d, hour: h, minute: mi,
        trueSolarTime: { longitude: 126.978, applyEquationOfTime: true, applyHistoricalDst: true },
      });
      const c = toTrueSolarTime(y, m, d, h, mi, 126.978);
      const [hh, mm] = c.time.split(':').map(Number);
      const plain = calculateFourPillars({ ...c.date, hour: hh, minute: mm });
      expect(plain.hourString).toBe(lib.hourString);
    }
  });
});
