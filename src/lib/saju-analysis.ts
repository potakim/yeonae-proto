/**
 * 원국 파생 데이터 (결정적 계산).
 *
 * LLM 이 가장 자주 지어내는 부분 — 지장간, 12운성, 합충형파해, 신살, 신강약 —을 코드로 계산해서
 * 해석 단계에 "사실"로 넘긴다. 학파마다 갈리는 항목(신살 기준, 신강약 판정)은 method 필드로
 * 어떤 기준을 썼는지 같이 넘겨서, LLM 이 단정하지 않고 근거를 말하게 한다.
 */
import {
  getHeavenlyStemElement,
  getHeavenlyStemYinYang,
  getTenGod,
  type EarthlyBranch,
  type FiveElement,
  type HeavenlyStem,
  type TenGod,
  type YinYang,
} from 'manseryeok';

/* ───────────────────────── 기본 표 ───────────────────────── */

export type Position = 'year' | 'month' | 'day' | 'hour' | 'luck' | 'annual' | 'monthly';
export const POSITION_LABEL: Record<Position, string> = {
  year: '연주',
  month: '월주',
  day: '일주',
  hour: '시주',
  luck: '대운',
  annual: '세운',
  monthly: '월운',
};
const NATAL: Position[] = ['year', 'month', 'day', 'hour'];

/** 지장간 (여기 → 중기 → 정기). 한국에서 흔히 쓰는 월률분야 순서 */
export const HIDDEN_STEMS: Record<EarthlyBranch, HeavenlyStem[]> = {
  자: ['임', '계'],
  축: ['계', '신', '기'],
  인: ['무', '병', '갑'],
  묘: ['갑', '을'],
  진: ['을', '계', '무'],
  사: ['무', '경', '병'],
  오: ['병', '기', '정'],
  미: ['정', '을', '기'],
  신: ['무', '임', '경'],
  유: ['경', '신'],
  술: ['신', '정', '무'],
  해: ['무', '갑', '임'],
};

const BRANCH_ORDER: EarthlyBranch[] = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const STAGES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'] as const;
export type TwelveStage = (typeof STAGES)[number];
/** 12운성 장생 위치 (양간 순행, 음간 역행) */
const CHANGSAENG: Record<HeavenlyStem, EarthlyBranch> = {
  갑: '해', 병: '인', 무: '인', 경: '사', 임: '신',
  을: '오', 정: '유', 기: '유', 신: '자', 계: '묘',
};

export function twelveStage(stem: HeavenlyStem, branch: EarthlyBranch): TwelveStage {
  const start = BRANCH_ORDER.indexOf(CHANGSAENG[stem]);
  const target = BRANCH_ORDER.indexOf(branch);
  const forward = getHeavenlyStemYinYang(stem) === '양';
  const steps = forward ? (target - start + 12) % 12 : (start - target + 12) % 12;
  return STAGES[steps];
}

const GENERATES: Record<FiveElement, FiveElement> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };

export type TenGodGroup = '비겁' | '식상' | '재성' | '관성' | '인성';
export const TEN_GOD_GROUP: Record<TenGod, TenGodGroup> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상', 편재: '재성',
  정재: '재성', 편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성',
};

const SEASON: Record<EarthlyBranch, string> = {
  인: '초봄', 묘: '한봄', 진: '늦봄(환절기)', 사: '초여름', 오: '한여름', 미: '늦여름(환절기)',
  신: '초가을', 유: '한가을', 술: '늦가을(환절기)', 해: '초겨울', 자: '한겨울', 축: '늦겨울(환절기)',
};

/* ───────────────────────── 지장간 · 12운성 ───────────────────────── */

export interface HiddenStemInfo {
  stem: HeavenlyStem;
  element: FiveElement;
  yinYang: YinYang;
  role: '여기' | '중기' | '정기';
  tenGod: TenGod;
}

export function hiddenStemsOf(dayMaster: HeavenlyStem, branch: EarthlyBranch): HiddenStemInfo[] {
  const list = HIDDEN_STEMS[branch];
  return list.map((stem, i) => ({
    stem,
    element: getHeavenlyStemElement(stem),
    yinYang: getHeavenlyStemYinYang(stem),
    role: i === list.length - 1 ? '정기' : list.length === 3 && i === 1 ? '중기' : '여기',
    tenGod: getTenGod(dayMaster, stem),
  }));
}

/* ───────────────────────── 합충형파해 ───────────────────────── */

export interface Placed<T> {
  pos: Position;
  char: T;
}

export interface Relation {
  type: string;
  /** 관련 글자 위치 (같은 글자가 여러 개면 모두) */
  positions: Position[];
  chars: string[];
  /** 합의 결과 오행 등 */
  result?: FiveElement;
  /** 원국 내 바로 붙어 있는 기둥끼리인지 (작용력 판단 참고) */
  adjacent?: boolean;
  note?: string;
}

const pairKey = (a: string, b: string) => [a, b].sort().join('');
const pairTable = <T extends string>(rows: [T, T, FiveElement?][]) =>
  new Map(rows.map(([a, b, r]) => [pairKey(a, b), r ?? null] as const));

const STEM_COMBINE = pairTable<HeavenlyStem>([
  ['갑', '기', '토'], ['을', '경', '금'], ['병', '신', '수'], ['정', '임', '목'], ['무', '계', '화'],
]);
const STEM_CLASH = pairTable<HeavenlyStem>([['갑', '경'], ['을', '신'], ['병', '임'], ['정', '계']]);

const BRANCH_PAIR_RULES: { type: string; table: Map<string, FiveElement | null>; note?: string }[] = [
  { type: '육합', table: pairTable<EarthlyBranch>([['자', '축', '토'], ['인', '해', '목'], ['묘', '술', '화'], ['진', '유', '금'], ['사', '신', '수'], ['오', '미', '화']]) },
  { type: '충', table: pairTable<EarthlyBranch>([['자', '오'], ['축', '미'], ['인', '신'], ['묘', '유'], ['진', '술'], ['사', '해']]) },
  { type: '형', table: pairTable<EarthlyBranch>([['인', '사'], ['사', '신'], ['인', '신'], ['축', '술'], ['술', '미'], ['축', '미'], ['자', '묘']]) },
  { type: '파', table: pairTable<EarthlyBranch>([['자', '유'], ['축', '진'], ['인', '해'], ['묘', '오'], ['사', '신'], ['미', '술']]) },
  { type: '해', table: pairTable<EarthlyBranch>([['자', '미'], ['축', '오'], ['인', '사'], ['묘', '진'], ['신', '해'], ['유', '술']]) },
  { type: '원진', table: pairTable<EarthlyBranch>([['자', '미'], ['축', '오'], ['인', '유'], ['묘', '신'], ['진', '해'], ['사', '술']]) },
];
const SELF_PUNISH: EarthlyBranch[] = ['진', '오', '유', '해'];

const TRINES: { set: EarthlyBranch[]; result: FiveElement }[] = [
  { set: ['신', '자', '진'], result: '수' },
  { set: ['해', '묘', '미'], result: '목' },
  { set: ['인', '오', '술'], result: '화' },
  { set: ['사', '유', '축'], result: '금' },
];
const DIRECTIONALS: { set: EarthlyBranch[]; result: FiveElement }[] = [
  { set: ['인', '묘', '진'], result: '목' },
  { set: ['사', '오', '미'], result: '화' },
  { set: ['신', '유', '술'], result: '금' },
  { set: ['해', '자', '축'], result: '수' },
];
const TRIPLE_PUNISH: EarthlyBranch[][] = [
  ['인', '사', '신'],
  ['축', '술', '미'],
];

const ADJ = new Set(['year|month', 'month|day', 'day|hour']);
const isAdjacent = (a: Position, b: Position) => ADJ.has(`${a}|${b}`) || ADJ.has(`${b}|${a}`);

/**
 * @param focus 지정하면 이 위치가 하나라도 포함된 관계만 남긴다 (대운·세운 대 원국)
 */
export function stemRelations(stems: Placed<HeavenlyStem>[], focus?: Position): Relation[] {
  const out: Relation[] = [];
  for (let i = 0; i < stems.length; i++) {
    for (let j = i + 1; j < stems.length; j++) {
      const a = stems[i];
      const b = stems[j];
      if (focus && a.pos !== focus && b.pos !== focus) continue;
      const k = pairKey(a.char, b.char);
      const base = { positions: [a.pos, b.pos], chars: [a.char, b.char], adjacent: isAdjacent(a.pos, b.pos) };
      if (STEM_COMBINE.has(k)) out.push({ type: '천간합', result: STEM_COMBINE.get(k)!, ...base });
      if (STEM_CLASH.has(k)) out.push({ type: '천간충', ...base });
    }
  }
  return out;
}

export function branchRelations(branches: Placed<EarthlyBranch>[], focus?: Position): Relation[] {
  const out: Relation[] = [];
  const touches = (ps: Position[]) => !focus || ps.includes(focus);

  // 두 글자 관계
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      const a = branches[i];
      const b = branches[j];
      if (!touches([a.pos, b.pos])) continue;
      const k = pairKey(a.char, b.char);
      const base = { positions: [a.pos, b.pos], chars: [a.char, b.char], adjacent: isAdjacent(a.pos, b.pos) };
      for (const rule of BRANCH_PAIR_RULES) {
        if (!rule.table.has(k)) continue;
        const r = rule.table.get(k);
        out.push({ type: rule.type, ...(r ? { result: r } : {}), ...base });
      }
    }
  }

  // 자형: 같은 글자 2개 이상 (진·오·유·해)
  for (const ch of SELF_PUNISH) {
    const hits = branches.filter((b) => b.char === ch);
    const ps = hits.map((h) => h.pos);
    if (hits.length >= 2 && touches(ps)) {
      out.push({ type: '자형', positions: ps, chars: hits.map((h) => h.char), note: `${ch} ${hits.length}개` });
    }
  }

  // 삼합·반합, 방합, 삼형
  const present = (set: EarthlyBranch[]) => set.filter((c) => branches.some((b) => b.char === c));
  const posOf = (set: EarthlyBranch[]) => branches.filter((b) => set.includes(b.char));
  for (const t of TRINES) {
    const got = present(t.set);
    const hits = posOf(t.set);
    if (!touches(hits.map((h) => h.pos))) continue;
    if (got.length === 3) {
      out.push({ type: '삼합', result: t.result, positions: hits.map((h) => h.pos), chars: hits.map((h) => h.char) });
    } else if (got.length === 2 && got.includes(t.set[1])) {
      out.push({ type: '반합', result: t.result, positions: hits.map((h) => h.pos), chars: hits.map((h) => h.char), note: `왕지 ${t.set[1]} 포함` });
    }
  }
  for (const d of DIRECTIONALS) {
    const hits = posOf(d.set);
    if (present(d.set).length === 3 && touches(hits.map((h) => h.pos))) {
      out.push({ type: '방합', result: d.result, positions: hits.map((h) => h.pos), chars: hits.map((h) => h.char) });
    }
  }
  for (const set of TRIPLE_PUNISH) {
    const hits = posOf(set);
    if (present(set).length === 3 && touches(hits.map((h) => h.pos))) {
      out.push({ type: '삼형', positions: hits.map((h) => h.pos), chars: hits.map((h) => h.char) });
    }
  }
  return out;
}

/* ───────────────────────── 신살 ───────────────────────── */

export interface SpecialStar {
  name: string;
  /** 무엇을 기준으로 봤는지 */
  basis: string;
  positions: Position[];
  char: string;
}

/** 삼합 그룹 기준 신살 (연지·일지 기준) */
const GROUP_STARS: Record<string, Record<'도화' | '역마' | '화개', EarthlyBranch>> = {
  인오술: { 도화: '묘', 역마: '신', 화개: '술' },
  신자진: { 도화: '유', 역마: '인', 화개: '진' },
  사유축: { 도화: '오', 역마: '해', 화개: '축' },
  해묘미: { 도화: '자', 역마: '사', 화개: '미' },
};
const groupOf = (b: EarthlyBranch) => Object.keys(GROUP_STARS).find((k) => k.includes(b))!;

/** 일간 기준 */
const HONGYEOM: Record<HeavenlyStem, EarthlyBranch> = {
  갑: '오', 을: '오', 병: '인', 정: '미', 무: '진', 기: '진', 경: '술', 신: '유', 임: '자', 계: '신',
};
const CHEONEUL: Record<HeavenlyStem, EarthlyBranch[]> = {
  갑: ['축', '미'], 무: ['축', '미'], 경: ['축', '미'],
  을: ['자', '신'], 기: ['자', '신'],
  병: ['해', '유'], 정: ['해', '유'],
  임: ['사', '묘'], 계: ['사', '묘'],
  신: ['인', '오'],
};
const YANGIN: Partial<Record<HeavenlyStem, EarthlyBranch>> = { 갑: '묘', 병: '오', 무: '오', 경: '유', 임: '자' };
const GOEGANG = ['경진', '경술', '임진', '임술', '무진', '무술'];
const BAEKHO = ['갑진', '을미', '병술', '정축', '무진', '임술', '계축'];

export function specialStars(
  dayStem: HeavenlyStem,
  natal: { pos: Position; stem: HeavenlyStem; branch: EarthlyBranch }[],
): SpecialStar[] {
  const out: SpecialStar[] = [];
  const find = (target: EarthlyBranch) => natal.filter((p) => p.branch === target).map((p) => p.pos);
  const push = (name: string, basis: string, target: EarthlyBranch) => {
    const ps = find(target);
    if (ps.length > 0 && !out.some((s) => s.name === name && s.char === target)) {
      out.push({ name, basis, positions: ps, char: target });
    }
  };

  for (const baseKey of ['year', 'day'] as const) {
    const base = natal.find((p) => p.pos === baseKey);
    if (!base) continue;
    const g = GROUP_STARS[groupOf(base.branch)];
    for (const star of ['도화', '역마', '화개'] as const) {
      push(star, `${POSITION_LABEL[baseKey]} 지지(${base.branch}) 삼합 기준`, g[star]);
    }
  }
  push('홍염살', `일간(${dayStem}) 기준`, HONGYEOM[dayStem]);
  for (const b of CHEONEUL[dayStem]) push('천을귀인', `일간(${dayStem}) 기준`, b);
  const yi = YANGIN[dayStem];
  if (yi) push('양인', `일간(${dayStem}) 기준`, yi);

  const day = natal.find((p) => p.pos === 'day')!;
  const dayGanji = day.stem + day.branch;
  if (GOEGANG.includes(dayGanji)) out.push({ name: '괴강', basis: '일주', positions: ['day'], char: dayGanji });
  for (const p of natal) {
    if (BAEKHO.includes(p.stem + p.branch)) out.push({ name: '백호', basis: '기둥 간지', positions: [p.pos], char: p.stem + p.branch });
  }
  return out;
}

/* ───────────────────────── 신강약 (간이) ───────────────────────── */

export interface StrengthResult {
  verdict: '신강' | '중화(신강 쪽)' | '중화(신약 쪽)' | '신약' | '극신약 경향' | '극신강 경향';
  /** 일간을 돕는 힘의 비율 0~1 */
  supportRatio: number;
  deukryeong: boolean;
  deukji: boolean;
  deukse: boolean;
  method: string;
}

const STRENGTH_WEIGHTS: Record<'year' | 'month' | 'day' | 'hour', { stem: number; branch: number }> = {
  year: { stem: 1, branch: 1 },
  month: { stem: 1, branch: 3 },
  day: { stem: 0, branch: 1.5 },
  hour: { stem: 1, branch: 1 },
};

export function judgeStrength(
  dayStem: HeavenlyStem,
  natal: { pos: 'year' | 'month' | 'day' | 'hour'; stem: HeavenlyStem; branch: EarthlyBranch }[],
): StrengthResult {
  const dm = getHeavenlyStemElement(dayStem);
  const helps = (el: FiveElement) => el === dm || GENERATES[el] === dm;
  const mainEl = (b: EarthlyBranch) => getHeavenlyStemElement(HIDDEN_STEMS[b][HIDDEN_STEMS[b].length - 1]);

  let support = 0;
  let total = 0;
  let otherHelpers = 0;
  for (const p of natal) {
    const w = STRENGTH_WEIGHTS[p.pos];
    if (p.pos !== 'day') {
      total += w.stem;
      if (helps(getHeavenlyStemElement(p.stem))) {
        support += w.stem;
        otherHelpers += 1;
      }
    }
    total += w.branch;
    if (helps(mainEl(p.branch))) {
      support += w.branch;
      if (p.pos !== 'month' && p.pos !== 'day') otherHelpers += 1;
    }
  }
  const ratio = Math.round((support / total) * 100) / 100;
  const month = natal.find((p) => p.pos === 'month')!;
  const day = natal.find((p) => p.pos === 'day')!;
  const verdict: StrengthResult['verdict'] =
    ratio >= 0.75 ? '극신강 경향' : ratio >= 0.55 ? '신강' : ratio >= 0.47 ? '중화(신강 쪽)' : ratio >= 0.38 ? '중화(신약 쪽)' : ratio >= 0.2 ? '신약' : '극신약 경향';
  return {
    verdict,
    supportRatio: ratio,
    deukryeong: helps(mainEl(month.branch)),
    deukji: helps(mainEl(day.branch)),
    deukse: otherHelpers >= 3,
    method:
      '간이 점수: 비겁·인성 오행 비중(천간 1, 월지 3, 일지 1.5, 그 외 지지 1, 지지는 정기 기준). 조후·합화·통근 깊이는 미반영 — 참고용',
  };
}

export { NATAL, SEASON, GENERATES };
