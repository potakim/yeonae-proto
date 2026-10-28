import { describe, expect, it } from 'vitest';
import { calculateSaju, type SajuInput } from '../saju';
import { criteriaMarkdown } from '../fortune/criteria';
import {
  dailySignal,
  dayPillarOf,
  monthsOfSaeun,
  natalContext,
  resolveToday,
  saeunYearOf,
  weeklySignals,
  yearlySignals,
} from '../fortune/signals';
import { buildPersonalBundle, buildSharedBundle, cacheKeySource, outputSchema } from '../fortune/reading';
import { handleFortune, type ReadingCache } from '../../../api/fortune';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const user: SajuInput = {
  year: 1979, month: 1, day: 27, hour: 12, minute: 30,
  isLunar: false, isLeapMonth: false, gender: 'male',
  longitude: 126.978, useTrueSolarTime: true, dayBoundary: 'midnight',
};
const ctx = natalContext(calculateSaju(user));
// 2026-10-28 16:00 KST
const NOW = new Date('2026-10-28T07:00:00Z');

describe('오늘 일진 · 자시 관법', () => {
  it('2026-10-28 일진은 을해', () => {
    expect(dayPillarOf({ year: 2026, month: 10, day: 28 })).toEqual({ stem: '을', branch: '해' });
  });

  it('23:30 KST: 자정 기준·야자시는 당일, 자시 기준은 다음날 일진', () => {
    const late = new Date('2026-10-28T14:30:00Z'); // 23:30 KST
    expect(resolveToday(late, 'midnight').effectiveDate.day).toBe(28);
    expect(resolveToday(late, 'splitJasi').effectiveDate.day).toBe(28);
    const j = resolveToday(late, 'jasi');
    expect(j.effectiveDate.day).toBe(29);
    expect(j.note).toContain('자시');
  });

  it('UTC 기준으로는 전날이어도 KST 날짜를 쓴다', () => {
    expect(resolveToday(new Date('2026-10-27T16:30:00Z'), 'midnight').calendarDate).toBe('2026-10-28');
  });
});

describe('일진 신호 — 갑오 일주 남성, 을해일', () => {
  const s = dailySignal(ctx, { year: 2026, month: 10, day: 28 });

  it('십신: 을=겁재, 해=편인 (해 정기 임수)', () => {
    expect(s.stem.tenGod).toBe('겁재');
    expect(s.branch.tenGod).toBe('편인');
  });

  it('수(水)는 원국에 없으므로 보완 신호', () => {
    expect(s.elementFills).toContain('수');
  });

  it('일진 乙이 시간 庚과 乙庚합', () => {
    expect(s.relations.some((r) => r.type === '천간합' && r.where.includes('시주') && r.where.includes('일진'))).toBe(true);
  });

  it('점수 = 겁재(-1) + 편인(-1) + 乙庚합(+1) + 수 보완(+1) = 0 → 보통', () => {
    expect(s.reasons.map((r) => r.code)).toEqual(['tenGod.stem.겁재', 'tenGod.branch.편인', 'relation.천간합', 'element.fill.수']);
    expect(s.score).toBe(0);
    expect(s.grade).toBe('보통');
  });

  it('공망일: 일진 지지가 진·사면 공망 표시', () => {
    // 2026-10-30 = 정축? 직접 찾기: 일주 공망 진·사가 오는 날
    const days = weeklySignals(ctx, { year: 2026, month: 10, day: 28 }, 12).days;
    const voidDay = days.find((d) => d.branch.char === '진' || d.branch.char === '사')!;
    expect(voidDay.isVoid).toBe(true);
    expect(voidDay.reasons.some((r) => r.code === 'void')).toBe(true);
  });

  it('오(午)일은 홍염 활성 + 화 과다, 자(子)일은 일지 충', () => {
    const days = weeklySignals(ctx, { year: 2026, month: 10, day: 28 }, 12).days;
    const wu = days.find((d) => d.branch.char === '오')!;
    expect(wu.activatedStars).toContain('홍염살');
    expect(wu.elementExcess).toContain('화');
    const zi = days.find((d) => d.branch.char === '자')!;
    expect(zi.reasons.map((r) => r.code)).toContain('relation.충.day');
  });
});

describe('주간', () => {
  it('7일, 시작·끝, 좋은 날/조심할 날은 최고·최저 점수일', () => {
    const w = weeklySignals(ctx, { year: 2026, month: 10, day: 28 });
    expect(w.days).toHaveLength(7);
    expect(w.start).toBe('2026-10-28');
    expect(w.end).toBe('2026-11-03');
    const max = Math.max(...w.days.map((d) => d.score));
    for (const d of w.bestDays) expect(w.days.find((x) => x.date === d)!.score).toBe(max);
  });
});

describe('올해 — 입춘 기준', () => {
  it('2026-02-03은 아직 을사년, 2026-02-04부터 병오년', () => {
    expect(saeunYearOf({ year: 2026, month: 2, day: 3 })).toBe(2025);
    expect(saeunYearOf({ year: 2026, month: 2, day: 4 })).toBe(2026);
  });

  it('병오년 12개월: 경인월(입춘)부터 신축월(소한)까지, 빈틈 없이 이어짐', () => {
    const m = monthsOfSaeun(2026);
    expect(m).toHaveLength(12);
    expect(m[0].stem + m[0].branch).toBe('경인');
    expect(m[8].stem + m[8].branch).toBe('무술');
    expect(m[11].stem + m[11].branch).toBe('신축');
    for (let i = 1; i < 12; i++) {
      const prevEnd = new Date(Date.UTC(m[i - 1].end.year, m[i - 1].end.month - 1, m[i - 1].end.day + 1));
      expect(prevEnd.getUTCDate()).toBe(m[i].start.day);
    }
  });

  it('세운 병오 + 대운 경오 + 현재 월은 무술', () => {
    const y = yearlySignals(ctx, { year: 2026, month: 10, day: 28 }, { stem: '경', branch: '오' });
    expect(y.annual.ganji).toBe('병오');
    expect(y.luck!.ganji).toBe('경오');
    expect(y.months.find((m) => m.current)!.ganji).toBe('무술');
    expect(y.period.start).toBe('2026-02-04');
  });
});

describe('LLM 입력 · 스키마 · 캐시 키', () => {
  it('원국 요약은 대운 최대 4개만', () => {
    const b = buildPersonalBundle(user, 'year', { now: NOW });
    expect(b.natal.luck.length).toBeLessThanOrEqual(4);
    expect(b.natal.luck.some((l) => l.current)).toBe(true);
    expect(b.lucky!.element).toBe('수');
  });

  it('행운 아이템은 스키마 enum 으로 묶인다', () => {
    const b = buildPersonalBundle(user, 'today', { now: NOW });
    const s = outputSchema(b) as { properties: { lucky: { properties: { item: { enum: string[] } } } } };
    expect(s.properties.lucky.properties.item.enum).toEqual(b.lucky!.items);
  });

  it('캐시 키: 같은 원국·날짜면 같고, 날짜·종류가 다르면 다름. 생년월일 원본은 없음', () => {
    const a = cacheKeySource(buildPersonalBundle(user, 'today', { now: NOW }), 'm', 'c');
    const b = cacheKeySource(buildPersonalBundle({ ...user, minute: 40 }, 'today', { now: NOW }), 'm', 'c');
    const c = cacheKeySource(buildPersonalBundle(user, 'today', { now: new Date('2026-10-29T07:00:00Z') }), 'm', 'c');
    const d = cacheKeySource(buildPersonalBundle(user, 'week', { now: NOW }), 'm', 'c');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a).not.toContain('1979');
  });

  it('공용 오늘 운세: 일주 공망 계산', () => {
    const b = buildSharedBundle({ stem: '갑', branch: '오' }, 'male', { now: NOW });
    expect(b.period).toBe('2026-10-28');
    expect(b.signals.ganji).toBe('을해');
  });
});

describe('/api/fortune 핸들러 (Claude 호출은 대역)', () => {
  const store = new Map<string, unknown>();
  const cache: ReadingCache = { get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v) };
  let calls = 0;
  const callModel = async ({ schema }: { schema: object }) => {
    calls++;
    const props = (schema as { properties: Record<string, unknown> }).properties;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(props)) out[k] = k === 'lucky' ? { item: '차 한 잔', action: '테스트' } : k === 'days' || k === 'months' ? [] : `${k} 테스트`;
    return { text: JSON.stringify(out), usage: { input: 100, output: 50 }, stop: 'end_turn' };
  };
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    handleFortune(new Request('http://x/api/fortune', { method: 'POST', body: JSON.stringify(body), headers }), {
      env: {}, cache, now: () => NOW, callModel,
    });

  it('dryRun: Claude 호출 없이 신호·프롬프트·스키마 반환', async () => {
    const res = await post({ kind: 'today', birth: user, dryRun: true });
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.bundle.signals.ganji).toBe('을해');
    expect(j.prompt.user).toContain('<data>');
    expect(calls).toBe(0);
  });

  it('첫 호출은 생성, 두 번째는 캐시', async () => {
    const a = await (await post({ kind: 'today', birth: user })).json();
    const b = await (await post({ kind: 'today', birth: user })).json();
    expect(a.meta.cached).toBe(false);
    expect(b.meta.cached).toBe(true);
    expect(calls).toBe(1);
    expect(b.reading.headline).toBe('headline 테스트');
    expect(b.signals.grade).toBe('보통');
  });

  it('잘못된 입력은 400', async () => {
    expect((await post({ kind: 'today', birth: { ...user, month: 13 } })).status).toBe(400);
    expect((await post({ kind: 'nope', birth: user })).status).toBe(400);
    expect((await post({ kind: 'todayShared', dayPillar: { stem: '갑', branch: '축' } })).status).toBe(400);
  });

  it('접근 코드 설정 시 헤더 필요', async () => {
    const res = await handleFortune(new Request('http://x', { method: 'POST', body: '{}' }), { env: { INTERPRET_ACCESS_CODE: 'abc' }, cache });
    expect(res.status).toBe(401);
  });
});

describe('해석 기준 문서', () => {
  it('docs/interpretation-criteria.md 가 criteria.ts 와 같다 (UPDATE_DOCS=1 로 재생성)', () => {
    const path = fileURLToPath(new URL('../../../docs/interpretation-criteria.md', import.meta.url));
    const md = criteriaMarkdown();
    if (process.env.UPDATE_DOCS === '1') writeFileSync(path, md);
    expect(readFileSync(path, 'utf8')).toBe(md);
  });
});
