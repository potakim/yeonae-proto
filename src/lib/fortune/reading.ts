/**
 * ③ 문장 생성 준비 — 서버와 브라우저가 같이 쓰는 순수 로직.
 *
 * 생년월일 → (계산) → (신호) → LLM 입력 컨텍스트 · 출력 JSON 스키마 · 캐시 키.
 * Claude 호출 자체는 api/fortune.ts (서버)에서만 한다.
 */
import type { DayBoundary, EarthlyBranch, FiveElement, HeavenlyStem } from 'manseryeok';
import { calculateSaju, toLlmPayload, type SajuInput, type SajuPayload } from '../saju.js';
import { CRITERIA_VERSION, ELEMENT_INFO, TEN_GOD_CRITERIA, RELATION_CRITERIA } from './criteria.js';
import {
  dailySignal,
  luckyElement,
  natalContext,
  resolveToday,
  weeklySignals,
  yearlySignals,
  ymdStr,
  type NatalContext,
} from './signals.js';

/** 프롬프트·스키마를 바꾸면 올린다 (캐시 키에 포함) */
export const PROMPT_VERSION = 'fortune-2026-10-28.2';

export type ReadingKind = 'natal' | 'today' | 'week' | 'year' | 'todayShared';
export const READING_KINDS: ReadingKind[] = ['natal', 'today', 'week', 'year', 'todayShared'];

export const KIND_LABEL: Record<ReadingKind, string> = {
  natal: '원국 풀이',
  today: '오늘의 연애운',
  week: '이번 주 연애운',
  year: '올해 연애운',
  todayShared: '오늘의 운세(공용)',
};

/* ───────────────────────── 신호 묶음 만들기 ───────────────────────── */

export interface BuildOptions {
  now: Date;
  /** 오늘 기준 관법 (기본: 입력의 자시 관법) */
  dayBoundary?: DayBoundary;
}

export function buildPersonalBundle(input: SajuInput, kind: Exclude<ReadingKind, 'todayShared'>, opt: BuildOptions) {
  const r = calculateSaju(input);
  const today = resolveToday(opt.now, opt.dayBoundary ?? input.dayBoundary);
  const payload = toLlmPayload(r, today.effectiveDate);
  const ctx = natalContext(r);
  const weak = payload.strength.verdict.includes('신약');
  const lucky = luckyElement(ctx, weak);

  const base = { natal: natalBrief(payload), lucky: luckyInfo(lucky.element, lucky.basis), today };
  switch (kind) {
    case 'natal':
      return { ...base, kind: 'natal' as const, period: 'lifetime', signals: null };
    case 'today':
      return { ...base, kind: 'today' as const, period: ymdStr(today.effectiveDate), signals: dailySignal(ctx, today.effectiveDate) };
    case 'week': {
      const w = weeklySignals(ctx, today.effectiveDate);
      return { ...base, kind: 'week' as const, period: `${w.start}~${w.end}`, signals: w };
    }
    case 'year': {
      const cl = r.detail.luckPillars?.pillars.find((p) => p.korean === payload.now.luck?.ganji);
      const y = yearlySignals(ctx, today.effectiveDate, cl ? { stem: cl.pillar.heavenlyStem, branch: cl.pillar.earthlyBranch } : null);
      return { ...base, kind: 'year' as const, period: `${y.saeunYear}`, signals: y };
    }
  }
}

/**
 * 공용 "오늘의 운세": 일주(60) × 성별(2) × 날짜 하나 → 하루 120건만 만들면 전 사용자가 공유.
 * 일간 기준 십신 + 일진과 일지(배우자 자리)의 관계까지만 반영한다.
 */
export function buildSharedBundle(day: { stem: HeavenlyStem; branch: EarthlyBranch }, gender: 'male' | 'female', opt: BuildOptions) {
  const today = resolveToday(opt.now, opt.dayBoundary ?? 'midnight');
  const ctx: NatalContext = {
    dayMaster: day.stem,
    gender,
    stems: [{ pos: 'day', char: day.stem }],
    branches: [{ pos: 'day', char: day.branch }],
    voidBranches: voidOfDay(day.stem, day.branch),
    elementCounts: { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 },
    missing: [],
    excess: [],
    loveStars: [],
  };
  return {
    kind: 'todayShared' as const,
    period: ymdStr(today.effectiveDate),
    natal: { dayPillar: day.stem + day.branch, gender, note: '일주만으로 보는 공용 운세 (원국 전체는 미반영)' },
    lucky: null,
    today,
    signals: dailySignal(ctx, today.effectiveDate),
  };
}

const STEMS: HeavenlyStem[] = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const BRANCHES: EarthlyBranch[] = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
function voidOfDay(stem: HeavenlyStem, branch: EarthlyBranch): EarthlyBranch[] {
  // 순(旬)의 시작(갑X)에서 지지 10개를 쓰고 남는 2개
  const start = (BRANCHES.indexOf(branch) - STEMS.indexOf(stem) + 12) % 12;
  return [BRANCHES[(start + 10) % 12], BRANCHES[(start + 11) % 12]];
}

export type Bundle = ReturnType<typeof buildPersonalBundle> | ReturnType<typeof buildSharedBundle>;

/** LLM 에 넘길 원국 요약 — 토큰 절약을 위해 해석에 쓰는 것만 */
export function natalBrief(p: SajuPayload) {
  const pillar = (k: 'year' | 'month' | 'day' | 'hour') => {
    const x = p.pillars[k];
    return x
      ? {
          ganji: x.ganji,
          stem: `${x.stem.char}(${x.stem.element}, ${x.stem.tenGod})`,
          branch: `${x.branch.char}(${x.branch.element}, ${x.branch.tenGod})`,
          hidden: x.branch.hiddenStems.map((h) => `${h.stem}${h.tenGod}`).join(' '),
          twelveStage: x.twelveStage,
        }
      : null;
  };
  const luck = p.luckPillars?.list ?? [];
  const ci = luck.findIndex((l) => l.current);
  return {
    gender: p.input.gender,
    ageNow: p.ageNow,
    hourKnown: p.input.hourKnown,
    dayMaster: `${p.dayMaster.stem}(${p.dayMaster.yinYang}${p.dayMaster.element})`,
    pillars: { year: pillar('year'), month: pillar('month'), day: pillar('day'), hour: pillar('hour') },
    season: p.season.label,
    elementCounts: p.elementCounts.counts,
    missingElements: p.elementCounts.missing,
    tenGodCounts: p.tenGodCounts.counts,
    strength: { verdict: p.strength.verdict, note: '간이 판정' },
    relations: p.relations,
    specialStars: p.specialStars.map((s) => `${s.name} ${s.char}(${s.where.join('·')})`),
    voidBranches: p.voidBranches.byDayPillar,
    luck: ci >= 0 ? luck.slice(Math.max(0, ci - 1), ci + 3).map((l) => ({ ganji: l.ganji, from: l.startDate.slice(0, 4), to: l.endDate.slice(0, 4), tenGod: `${l.stemTenGod}/${l.branchTenGod}`, current: l.current })) : [],
  };
}

function luckyInfo(element: FiveElement, basis: string) {
  const e = ELEMENT_INFO[element];
  return { element, basis, color: e.color, direction: e.direction, numbers: e.numbers, items: e.items };
}

/* ───────────────────────── 프롬프트 ───────────────────────── */

export function buildSystemPrompt(characterName: string): string {
  return `너는 연애 상담 앱 '모두의 연애'의 사주 캐릭터 "${characterName}"야.
명리학을 오래 공부한, 다정하지만 할 말은 하는 무당. "~해요", "~거든요", 가끔 "~구먼" 정도의 친근한 말투로 20~40대가 편하게 읽게 써.

## 근거 규칙 (가장 중요)
- 판단 근거는 <data> 안의 값뿐이야. 간지·십신·관계·점수·등급은 이미 코드가 확정했어. 다시 계산하거나 바꾸지 마.
- <data>에 없는 간지, 합·충, 신살, 용신·격국, 사건을 새로 말하지 마.
- grade·score·reasons가 있으면 그 방향(좋음/보통/조심)을 그대로 따라. 점수 숫자 자체는 말하지 마.
- 같은 신호는 <criteria>의 의미 방향 안에서만 풀어 써. 표현은 자유지만 방향은 바꾸지 마.
- 이성의 별: 남자는 재성, 여자는 관성. 단정하지 말고 "~하기 쉬운 흐름" 식으로.
- hourKnown이 false면 시주 없이 본 풀이라는 점을 한 번 짚어 줘.
- 행운 포인트(lucky)는 data.lucky 값만 써. 아이템은 반드시 items 중에서 골라.

## 금지
- 건강·사고·금전 손실·이별/이혼 확정 같은 단정·공포 표현
- 부적·굿·유료 상담 권유, 특정 상품 구매 유도
- 상대를 조종하거나 집착을 부추기는 조언
- JSON 필드 이름이나 "점수", "코드가 계산" 같은 내부 표현 노출

## 형식
- 지정된 JSON 스키마로만 답해. 각 문자열은 마크다운 없이 평문.
- 각 항목의 글자 수 안내를 지켜. 근거를 전부 나열하지 말고 가장 중요한 것만 골라.
- 사주 용어는 처음 나올 때 괄호로 쉽게 풀어 줘. 예: 상관(말·표현의 기운)
- 연애 관점을 우선해. 일·돈 이야기는 연애와 이어질 때만 짧게.`;
}

/** 해석 기준 중 이번 데이터에 등장하는 항목만 발췌 (토큰 절약) */
function criteriaExcerpt(bundle: Bundle): string {
  const text = JSON.stringify(bundle);
  const tg = Object.entries(TEN_GOD_CRITERIA)
    .filter(([k]) => text.includes(k))
    .map(([k, v]) => `- ${k}(${v.tone}): ${v.keyword} — ${v.love}`);
  const rel = Object.entries(RELATION_CRITERIA)
    .filter(([k]) => text.includes(`"${k}"`))
    .map(([k, v]) => `- ${k}: ${v.meaning} — ${v.love}`);
  return [`[십신]`, ...tg, `[관계]`, ...rel].join('\n');
}

const KIND_GUIDE: Record<ReadingKind, string> = {
  natal: '원국 자체를 풀어 줘. 일간 성향, 오행 과다·부족, 십신 구성(특히 이성의 별 위치), 원국 관계로 연애 스타일을 설명해.',
  today: '오늘 일진(signals) 기준 오늘의 연애운. 원국은 배경으로만 짧게. signals.grade 방향을 따라.',
  week: '이번 주 7일(signals.days) 흐름. days 배열에는 날짜마다 한 줄씩, 그 날의 grade 방향대로. bestDays·cautionDays를 총평에 언급.',
  year: '올해 세운(signals.annual)과 현재 대운(signals.luck), 월별 흐름(signals.months). months 배열에는 12개월 각각 한 줄씩. 세운은 입춘부터라는 점을 자연스럽게.',
  todayShared: '같은 일주를 가진 모든 사람이 보는 공용 오늘 운세. 개인 원국을 아는 척하지 말고, 일주와 오늘 일진의 관계만으로 써.',
};

export function buildUserMessage(bundle: Bundle): string {
  return `## 이번 요청: ${KIND_LABEL[bundle.kind]}
${KIND_GUIDE[bundle.kind]}

<criteria version="${CRITERIA_VERSION}">
${criteriaExcerpt(bundle)}
</criteria>

<data>
${JSON.stringify(bundle, llmReplacer)}
</data>`;
}

/** LLM 에 불필요한 내부 필드는 빼서 토큰을 줄인다 (화면·캐시용 데이터는 그대로) */
const DROP_KEYS = new Set(['code', 'adjacent', 'group', 'scope', 'positions', 'kstTime', 'dayBoundary', 'calendarDate']);
function llmReplacer(key: string, value: unknown) {
  return DROP_KEYS.has(key) ? undefined : value;
}

/* ───────────────────────── 출력 스키마 ───────────────────────── */

const str = (description: string) => ({ type: 'string', description });

export function outputSchema(bundle: Bundle) {
  const items = bundle.lucky?.items ?? Object.values(ELEMENT_INFO).flatMap((e) => e.items);
  const common = {
    headline: str('한 줄 제목 (20자 이내)'),
    summary: str('총평 2문장 (100자 이내)'),
    love: str('연애운 3문장 (180자 이내), 근거 1~2개만 자연스럽게'),
    caution: str('조심할 점 2문장 (100자 이내), 대처법으로 끝내기'),
    lucky: {
      type: 'object',
      properties: { item: { type: 'string', enum: items, description: '행운 아이템 (목록 중 하나)' }, action: str('오늘/이번 기간에 해 볼 작은 행동 한 문장') },
      required: ['item', 'action'],
      additionalProperties: false,
    },
    closing: str('캐릭터 말투의 따뜻한 마무리 한 문장 (50자 이내)'),
  };
  const commonKeys = ['headline', 'summary', 'love', 'caution', 'lucky', 'closing'];
  switch (bundle.kind) {
    case 'natal':
      return {
        type: 'object',
        properties: {
          headline: common.headline,
          personality: str('일간·오행으로 본 타고난 성향 3문장 (180자 이내)'),
          loveStyle: str('연애 스타일 4문장 (250자 이내, 일지·이성의 별·관계 중 핵심 2~3개만)'),
          goodMatch: str('잘 맞는 상대의 기운 3문장 (150자 이내, 부족한 오행·십신 근거)'),
          caution: common.caution,
          lucky: common.lucky,
          closing: common.closing,
        },
        required: ['headline', 'personality', 'loveStyle', 'goodMatch', 'caution', 'lucky', 'closing'],
        additionalProperties: false,
      };
    case 'week':
      return {
        type: 'object',
        properties: {
          ...common,
          days: {
            type: 'array',
            description: '7일 각각 한 줄',
            items: { type: 'object', properties: { date: { type: 'string', format: 'date' }, line: str('그날 한 줄 (30자 안팎)') }, required: ['date', 'line'], additionalProperties: false },
          },
        },
        required: [...commonKeys, 'days'],
        additionalProperties: false,
      };
    case 'year':
      return {
        type: 'object',
        properties: {
          ...common,
          luckFlow: str('현재 대운이 올해 연애에 주는 배경 2문장'),
          months: {
            type: 'array',
            description: '12개월 각각 한 줄',
            items: { type: 'object', properties: { month: str('YYYY-MM (그 달 시작일 기준)'), line: str('그달 한 줄 (35자 안팎)') }, required: ['month', 'line'], additionalProperties: false },
          },
        },
        required: [...commonKeys, 'luckFlow', 'months'],
        additionalProperties: false,
      };
    default:
      return { type: 'object', properties: common, required: commonKeys, additionalProperties: false };
  }
}

/* ───────────────────────── 캐시 키 ───────────────────────── */

/**
 * 원국 해시 + 종류 + 기간 + 프롬프트/기준 버전 + 모델.
 * 생년월일 원본 대신 간지·성별만 쓴다 (같은 원국이면 같은 풀이 → 공유 가능, 개인정보 최소화).
 */
export function cacheKeySource(bundle: Bundle, model: string, characterName: string): string {
  const natalKey =
    bundle.kind === 'todayShared'
      ? `${bundle.natal.dayPillar}|${bundle.natal.gender}`
      : [bundle.natal.pillars.year?.ganji, bundle.natal.pillars.month?.ganji, bundle.natal.pillars.day?.ganji, bundle.natal.pillars.hour?.ganji ?? '-', bundle.natal.gender].join('|');
  // 원국 풀이는 나이·대운에 따라 문장이 달라질 수 있어 현재 대운까지 키에 포함
  const extra = bundle.kind === 'natal' ? bundle.natal.luck.find((l) => l.current)?.ganji ?? '' : '';
  return [bundle.kind, natalKey, bundle.period, extra, PROMPT_VERSION, CRITERIA_VERSION, model, characterName].join('#');
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 캐시 유지 기간(초) */
export const CACHE_TTL: Record<ReadingKind, number> = {
  todayShared: 2 * 86400,
  today: 2 * 86400,
  week: 8 * 86400,
  year: 400 * 86400,
  natal: 3650 * 86400,
};
