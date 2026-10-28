/**
 * ② 신호 추출 — 오늘·이번 주·올해의 간지가 내 원국과 어떤 관계인지 코드로 확정한다.
 *
 * LLM 은 여기서 나온 신호(십신, 관계, 공망, 신살 활성화, 오행 보완/과다, 점수·등급)만
 * 근거로 문장을 쓴다. 간지 계산·관계 판정·점수는 전부 이 파일과 criteria.ts 가 책임진다.
 */
import {
  calculateFourPillars,
  getHeavenlyStemElement,
  getEarthlyBranchElement,
  getSolarTermsOfYear,
  getTenGod,
  getBranchTenGod,
  type DayBoundary,
  type EarthlyBranch,
  type FiveElement,
  type HeavenlyStem,
  type TenGod,
} from 'manseryeok';
import {
  TEN_GOD_GROUP,
  branchRelations,
  loveStarBranches,
  stemRelations,
  twelveStage,
  type Placed,
  type Position,
  type TenGodGroup,
} from '../saju-analysis.js';
import { ELEMENTS, describeRelation, groupRelations, type Rel, type SajuResult } from '../saju.js';
import {
  ELEMENT_EXCESS_SCORE,
  ELEMENT_FILL_SCORE,
  EXCESS_THRESHOLD,
  LOVE_STAR,
  LOVE_STAR_BONUS,
  RELATION_CRITERIA,
  STAR_ACTIVATION,
  TEN_GOD_CRITERIA,
  VOID_SCORE,
  gradeOf,
  type Tone,
} from './criteria.js';

export type Ymd = { year: number; month: number; day: number };
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export const ymdStr = (d: Ymd) => `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
export function addDays(d: Ymd, n: number): Ymd {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}
const weekday = (d: Ymd) => WEEKDAY[new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()];
const cmp = (a: Ymd, b: Ymd) => (a.year - b.year) * 10000 + (a.month - b.month) * 100 + (a.day - b.day);

/* ───────────────────────── 오늘 (자시 관법 반영) ───────────────────────── */

export interface TodayContext {
  /** 한국 시간 달력 날짜 */
  calendarDate: string;
  /** 일진 기준 날짜 (자시 관법으로 다음날이 될 수 있음) */
  effectiveDate: Ymd;
  kstTime: string;
  dayBoundary: DayBoundary;
  note: string | null;
}

/**
 * "오늘"의 일진 기준일. 자정 기준·야자시는 달력 날짜 그대로,
 * 자시 기준이면 23시부터 다음날 일진으로 본다.
 */
export function resolveToday(now: Date, dayBoundary: DayBoundary): TodayContext {
  const k = new Date(now.getTime() + 9 * 3600000);
  const cal: Ymd = { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1, day: k.getUTCDate() };
  const hour = k.getUTCHours();
  const shift = dayBoundary === 'jasi' && hour >= 23;
  return {
    calendarDate: ymdStr(cal),
    effectiveDate: shift ? addDays(cal, 1) : cal,
    kstTime: `${String(hour).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`,
    dayBoundary,
    note: shift ? '자시 기준 관법이라 23시부터 다음날 일진으로 봤어요.' : null,
  };
}

/** 날짜의 일진 (정오 기준이라 자시 경계 영향 없음) */
export function dayPillarOf(d: Ymd) {
  const p = calculateFourPillars({ ...d, hour: 12, minute: 0 });
  return { stem: p.day.heavenlyStem, branch: p.day.earthlyBranch };
}

/* ───────────────────────── 원국 컨텍스트 ───────────────────────── */

export interface NatalContext {
  dayMaster: HeavenlyStem;
  gender: 'male' | 'female';
  stems: Placed<HeavenlyStem>[];
  branches: Placed<EarthlyBranch>[];
  voidBranches: EarthlyBranch[];
  elementCounts: Record<FiveElement, number>;
  missing: FiveElement[];
  excess: FiveElement[];
  loveStars: ReturnType<typeof loveStarBranches>;
}

export function natalContext(r: SajuResult): NatalContext {
  const d = r.detail;
  const keys = (['year', 'month', 'day', 'hour'] as const).filter((k) => k !== 'hour' || r.hourKnown);
  return {
    dayMaster: d.day.heavenlyStem,
    gender: r.input.gender,
    stems: keys.map((k) => ({ pos: k, char: d[k].heavenlyStem })),
    branches: keys.map((k) => ({ pos: k, char: d[k].earthlyBranch })),
    voidBranches: d.voidBranches,
    elementCounts: r.elementCounts,
    missing: ELEMENTS.filter((e) => r.elementCounts[e] === 0),
    excess: ELEMENTS.filter((e) => r.elementCounts[e] >= EXCESS_THRESHOLD),
    loveStars: loveStarBranches(d.day.heavenlyStem, d.year.earthlyBranch, d.day.earthlyBranch),
  };
}

/* ───────────────────────── 흐름 신호 ───────────────────────── */

export interface Reason {
  code: string;
  delta: number;
  text: string;
}

export interface FlowSignal {
  scope: 'day' | 'month' | 'year' | 'luck';
  ganji: string;
  stem: { char: HeavenlyStem; element: FiveElement; tenGod: TenGod; group: TenGodGroup };
  branch: { char: EarthlyBranch; element: FiveElement; tenGod: TenGod; group: TenGodGroup };
  /** 일간이 이 지지에서 갖는 12운성 */
  twelveStage: string;
  loveStar: boolean;
  relations: ReturnType<typeof describeRelation>[];
  /** 일진 지지가 일주 공망 글자인지 */
  isVoid: boolean;
  activatedStars: string[];
  elementFills: FiveElement[];
  elementExcess: FiveElement[];
  score: number;
  grade: string;
  tone: Tone;
  reasons: Reason[];
}

const POS_FOR: Record<FlowSignal['scope'], Position> = { day: 'daily', month: 'monthly', year: 'annual', luck: 'luck' };

export function flowSignal(ctx: NatalContext, scope: FlowSignal['scope'], stem: HeavenlyStem, branch: EarthlyBranch): FlowSignal {
  const pos = POS_FOR[scope];
  const stemTg = getTenGod(ctx.dayMaster, stem);
  const branchTg = getBranchTenGod(ctx.dayMaster, branch);
  const reasons: Reason[] = [];
  const add = (code: string, delta: number, text: string) => {
    if (delta !== 0) reasons.push({ code, delta, text });
  };

  // 1) 십신
  add(`tenGod.stem.${stemTg}`, TEN_GOD_CRITERIA[stemTg].score, `천간 ${stem} = ${stemTg}: ${TEN_GOD_CRITERIA[stemTg].keyword}`);
  add(`tenGod.branch.${branchTg}`, TEN_GOD_CRITERIA[branchTg].score, `지지 ${branch} = ${branchTg}: ${TEN_GOD_CRITERIA[branchTg].keyword}`);
  const loveStar = LOVE_STAR[ctx.gender].includes(stemTg) || LOVE_STAR[ctx.gender].includes(branchTg);
  if (loveStar) add('loveStar', LOVE_STAR_BONUS, `이성의 별(${LOVE_STAR[ctx.gender].join('·')})이 들어옴`);

  // 2) 원국과의 관계 (종류당 1회 반영, 일간·일지 직접이면 추가)
  const raw: Rel[] = groupRelations([
    ...stemRelations([...ctx.stems, { pos, char: stem }], pos),
    ...branchRelations([...ctx.branches, { pos, char: branch }], pos),
  ]);
  const seen = new Set<string>();
  for (const rel of raw) {
    const c = RELATION_CRITERIA[rel.type];
    if (!c) continue;
    const touchesDay = rel.positions.includes('day');
    if (!seen.has(rel.type)) {
      seen.add(rel.type);
      add(`relation.${rel.type}`, c.score, `${rel.type}(${[...new Set(rel.chars)].join('')}): ${c.love}`);
    }
    if (touchesDay && c.dayBonus !== 0 && !seen.has(`${rel.type}@day`)) {
      seen.add(`${rel.type}@day`);
      const where = rel.type.startsWith('천간') ? '일간' : '일지(배우자 자리)';
      add(`relation.${rel.type}.day`, c.dayBonus, `${where}와 직접 ${rel.type}`);
    }
  }
  const relations = raw.map(describeRelation);

  // 3) 공망 (일진만)
  const isVoid = scope === 'day' && ctx.voidBranches.includes(branch);
  if (isVoid) add('void', VOID_SCORE, `일진 지지 ${branch}가 공망`);

  // 4) 신살 활성화
  const activatedStars = ctx.loveStars.filter((s) => s.char === branch).map((s) => s.name);
  for (const name of new Set(activatedStars)) add(`star.${name}`, STAR_ACTIVATION[name].score, `${name} 글자(${branch})가 들어옴: ${STAR_ACTIVATION[name].love}`);

  // 5) 오행 보완·과다
  const els = [getHeavenlyStemElement(stem), getEarthlyBranchElement(branch)];
  const elementFills = [...new Set(els.filter((e) => ctx.missing.includes(e)))];
  const elementExcess = [...new Set(els.filter((e) => ctx.excess.includes(e)))];
  for (const e of elementFills) add(`element.fill.${e}`, ELEMENT_FILL_SCORE, `원국에 없는 ${e} 기운을 채워 줌`);
  for (const e of elementExcess) add(`element.excess.${e}`, ELEMENT_EXCESS_SCORE, `이미 많은 ${e} 기운이 더해짐`);

  const score = reasons.reduce((a, r) => a + r.delta, 0);
  const g = gradeOf(score);
  return {
    scope,
    ganji: stem + branch,
    stem: { char: stem, element: els[0], tenGod: stemTg, group: TEN_GOD_GROUP[stemTg] },
    branch: { char: branch, element: els[1], tenGod: branchTg, group: TEN_GOD_GROUP[branchTg] },
    twelveStage: twelveStage(ctx.dayMaster, branch),
    loveStar,
    relations,
    isVoid,
    activatedStars: [...new Set(activatedStars)],
    elementFills,
    elementExcess,
    score,
    grade: g.grade,
    tone: g.tone,
    reasons,
  };
}

/* ───────────────────────── 오늘 · 이번 주 ───────────────────────── */

export function dailySignal(ctx: NatalContext, date: Ymd) {
  const { stem, branch } = dayPillarOf(date);
  return { date: ymdStr(date), weekday: weekday(date), ...flowSignal(ctx, 'day', stem, branch) };
}

export function weeklySignals(ctx: NatalContext, start: Ymd, days = 7) {
  const list = Array.from({ length: days }, (_, i) => dailySignal(ctx, addDays(start, i)));
  const max = Math.max(...list.map((d) => d.score));
  const min = Math.min(...list.map((d) => d.score));
  return {
    start: ymdStr(start),
    end: ymdStr(addDays(start, days - 1)),
    days: list,
    bestDays: max >= 1 ? list.filter((d) => d.score === max).map((d) => d.date) : [],
    cautionDays: min <= -1 ? list.filter((d) => d.score === min).map((d) => d.date) : [],
  };
}

/* ───────────────────────── 올해 (입춘 기준) ───────────────────────── */

/** 절입 순간(UTC) → 한국 날짜 */
const kstDate = (utc: Date): Ymd => {
  const k = new Date(utc.getTime() + 9 * 3600000);
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1, day: k.getUTCDate() };
};

/** 기준일이 속한 세운 연도 (입춘 전이면 전년도) */
export function saeunYearOf(d: Ymd): number {
  const ipchun = getSolarTermsOfYear(d.year).find((t) => t.index === 2)!;
  return cmp(d, kstDate(ipchun.date)) < 0 ? d.year - 1 : d.year;
}

/** 세운 연도의 12개월 (입춘~다음 해 소한까지의 절 기준) */
export function monthsOfSaeun(year: number) {
  const terms = [
    ...getSolarTermsOfYear(year).filter((t) => t.index % 2 === 0 && t.index >= 2),
    ...getSolarTermsOfYear(year + 1).filter((t) => t.index === 0 || t.index === 2),
  ];
  return terms.slice(0, 12).map((t, i) => {
    const start = kstDate(t.date);
    const end = addDays(kstDate(terms[i + 1].date), -1);
    // 절입 다음 날 정오는 확실히 그 달 안이다
    const p = calculateFourPillars({ ...addDays(start, 1), hour: 12, minute: 0 });
    return { term: t.name, start, end, stem: p.month.heavenlyStem, branch: p.month.earthlyBranch };
  });
}

export function yearlySignals(ctx: NatalContext, reference: Ymd, currentLuck: { stem: HeavenlyStem; branch: EarthlyBranch } | null) {
  const y = saeunYearOf(reference);
  const ipchun = kstDate(getSolarTermsOfYear(y).find((t) => t.index === 2)!.date);
  const yp = calculateFourPillars({ ...addDays(ipchun, 1), hour: 12, minute: 0 });
  const months = monthsOfSaeun(y).map((m) => ({
    term: m.term,
    start: ymdStr(m.start),
    end: ymdStr(m.end),
    current: cmp(reference, m.start) >= 0 && cmp(reference, m.end) <= 0,
    ...flowSignal(ctx, 'month', m.stem, m.branch),
  }));
  const sorted = [...months].sort((a, b) => b.score - a.score);
  return {
    saeunYear: y,
    period: { start: ymdStr(ipchun), end: months[months.length - 1].end, note: '세운은 양력 1월 1일이 아니라 입춘부터 바뀌어요' },
    annual: flowSignal(ctx, 'year', yp.year.heavenlyStem, yp.year.earthlyBranch),
    luck: currentLuck ? flowSignal(ctx, 'luck', currentLuck.stem, currentLuck.branch) : null,
    months,
    bestMonths: sorted.filter((m) => m.score >= 1).slice(0, 3).map((m) => m.start.slice(0, 7)),
    cautionMonths: sorted.reverse().filter((m) => m.score <= -1).slice(0, 3).map((m) => m.start.slice(0, 7)),
  };
}

/* ───────────────────────── 행운 포인트 ───────────────────────── */

const GEN: Record<FiveElement, FiveElement> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };

/** 행운 오행: 없는 오행 → 가장 적은 오행. 동률이면 신약은 인성, 신강은 식상 오행 우선 */
export function luckyElement(ctx: NatalContext, weak: boolean): { element: FiveElement; basis: string } {
  const dm = getHeavenlyStemElement(ctx.dayMaster);
  const resource = (Object.keys(GEN) as FiveElement[]).find((e) => GEN[e] === dm)!;
  const output = GEN[dm];
  const min = Math.min(...ELEMENTS.map((e) => ctx.elementCounts[e]));
  const candidates = ELEMENTS.filter((e) => ctx.elementCounts[e] === min);
  const pref = weak ? resource : output;
  const element = candidates.includes(pref) ? pref : candidates[0];
  return {
    element,
    basis: `${min === 0 ? '원국에 없는' : '원국에서 가장 적은'} 오행${candidates.length > 1 ? ` 중 ${weak ? '신약이라 일간을 돕는' : '신강이라 기운을 풀어 주는'} 쪽` : ''}`,
  };
}
