/**
 * 사주×MBTI 궁합 — 점수와 근거는 코드가 확정, 문장만 LLM.
 *
 * 같은 두 원국·같은 MBTI 조합이면 늘 같은 점수가 나온다.
 * 가중치는 팀 합의 대상이며 바꾸면 COMPAT_VERSION 을 올린다 (캐시 무효화).
 */
import {
  getHeavenlyStemElement,
  getTenGod,
  type EarthlyBranch,
  type FiveElement,
  type HeavenlyStem,
} from 'manseryeok';
import { GENERATES, branchRelations, loveStarBranches, stemRelations, TEN_GOD_GROUP } from '../saju-analysis.js';
import { ELEMENTS, type SajuResult } from '../saju.js';

export const COMPAT_VERSION = '2026-10-28.1';

export interface CompatItem {
  key: string;
  title: string;
  delta: number;
  detail: string;
  category: '일간' | '이성의 별' | '일지' | '띠' | '오행' | '끌림' | 'MBTI';
}

/** 가중치 표 (문서 자동 생성에도 사용) */
export const COMPAT_RULES = {
  base: 60,
  min: 15,
  max: 98,
  dayMaster: { 천간합: 12, 상생: 6, 비화: 3, 상극: -4, 천간충: -8 },
  loveStar: 6,
  dayBranch: { 육합: 10, 삼합: 5, 반합: 5, 충: -10, 형: -5, 자형: -3, 원진: -6, 해: -4, 파: -3 } as Record<string, number>,
  zodiac: { 육합: 4, 삼합: 4, 반합: 4, 충: -4, 원진: -3 } as Record<string, number>,
  elementFill: 4,
  elementFillMax: 2,
  sharedGap: -2,
  peachBlossom: 4,
  mbti: { SN_same: 6, SN_diff: -2, EI_diff: 3, EI_same: 2, TF_diff: 2, TF_same: 2, JP_diff: 1, JP_same: 2 },
};

export const COMPAT_GRADES: [number, string][] = [
  [85, '천생연분에 가까워요'],
  [72, '잘 맞는 편이에요'],
  [58, '노력하면 좋아져요'],
  [45, '서로 맞춰 가야 해요'],
  [0, '많이 다른 두 사람이에요'],
];
export const gradeOfCompat = (score: number) => COMPAT_GRADES.find(([t]) => score >= t)![1];

export interface Person {
  label: string;
  saju: SajuResult;
  mbti: string | null;
}

const EL_GEN = GENERATES;

/** 받침에 맞는 조사: josa('썸녀', '이/가') → '썸녀가' */
export function josa(word: string, pair: '이/가' | '은/는' | '을/를' | '과/와'): string {
  if (word === '나' && pair === '이/가') return '내가';
  const [withBatchim, without] = pair.split('/');
  const last = word.charCodeAt(word.length - 1);
  const hasBatchim = last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 !== 0 : false;
  return word + (hasBatchim ? withBatchim : without);
}
const controls = (a: FiveElement, b: FiveElement) => {
  const C: Record<FiveElement, FiveElement> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };
  return C[a] === b;
};

export function computeCompat(me: Person, partner: Person) {
  const items: CompatItem[] = [];
  const R = COMPAT_RULES;
  const a = me.saju.detail;
  const b = partner.saju.detail;
  const aDm = a.day.heavenlyStem;
  const bDm = b.day.heavenlyStem;
  const aEl = getHeavenlyStemElement(aDm);
  const bEl = getHeavenlyStemElement(bDm);
  const add = (i: CompatItem) => items.push(i);

  // 1) 일간끼리
  const stemRel = stemRelations([{ pos: 'day', char: aDm }, { pos: 'luck', char: bDm }]).map((r) => r.type);
  if (stemRel.includes('천간합')) add({ key: 'dm.combine', title: `일간 ${aDm}${bDm} 합`, delta: R.dayMaster.천간합, detail: '서로를 끌어당겨 묶는 합. 처음부터 마음이 잘 통하는 조합', category: '일간' });
  else if (stemRel.includes('천간충')) add({ key: 'dm.clash', title: `일간 ${aDm}${bDm} 충`, delta: R.dayMaster.천간충, detail: '생각의 방향이 정면으로 달라 부딪히기 쉬움. 대신 서로 자극이 됨', category: '일간' });
  if (EL_GEN[aEl] === bEl) add({ key: 'dm.generate.me', title: `${josa(me.label, '이/가')} ${josa(partner.label, '을/를')} 생해 줌 (${aEl}→${bEl})`, delta: R.dayMaster.상생, detail: `${me.label} 쪽이 챙겨 주고 북돋아 주는 관계`, category: '일간' });
  else if (EL_GEN[bEl] === aEl) add({ key: 'dm.generate.partner', title: `${josa(partner.label, '이/가')} ${josa(me.label, '을/를')} 생해 줌 (${bEl}→${aEl})`, delta: R.dayMaster.상생, detail: `${partner.label} 쪽이 기대게 해 주는 관계`, category: '일간' });
  else if (aEl === bEl) add({ key: 'dm.same', title: `같은 ${aEl} 기운`, delta: R.dayMaster.비화, detail: '친구처럼 편하고 말이 통하지만 고집이 부딪힐 수 있음', category: '일간' });
  else if (controls(aEl, bEl)) add({ key: 'dm.control.me', title: `${josa(me.label, '이/가')} ${josa(partner.label, '을/를')} 극함 (${aEl}→${bEl})`, delta: R.dayMaster.상극, detail: `${me.label} 쪽이 주도하고 ${partner.label} 쪽이 맞추기 쉬움. 배려가 필요`, category: '일간' });
  else if (controls(bEl, aEl)) add({ key: 'dm.control.partner', title: `${josa(partner.label, '이/가')} ${josa(me.label, '을/를')} 극함 (${bEl}→${aEl})`, delta: R.dayMaster.상극, detail: `${partner.label} 쪽이 주도하고 ${me.label} 쪽이 맞추기 쉬움. 배려가 필요`, category: '일간' });

  // 2) 이성의 별 (남: 재성, 여: 관성) — 상대 일간이 내게 그 별인지, 양방향
  const isLoveStar = (myDm: HeavenlyStem, gender: 'male' | 'female', other: HeavenlyStem) => {
    const g = TEN_GOD_GROUP[getTenGod(myDm, other)];
    return gender === 'male' ? g === '재성' : g === '관성';
  };
  if (isLoveStar(aDm, me.saju.input.gender, bDm))
    add({ key: 'star.me', title: `${josa(partner.label, '은/는')} ${me.label}의 이성의 별`, delta: R.loveStar, detail: `${me.label} 입장에서 ${partner.label}의 일간(${getTenGod(aDm, bDm)})이 전통적으로 배우자를 뜻하는 기운`, category: '이성의 별' });
  if (isLoveStar(bDm, partner.saju.input.gender, aDm))
    add({ key: 'star.partner', title: `${josa(me.label, '은/는')} ${partner.label}의 이성의 별`, delta: R.loveStar, detail: `${partner.label} 입장에서 ${me.label}의 일간(${getTenGod(bDm, aDm)})이 배우자를 뜻하는 기운`, category: '이성의 별' });

  // 3) 일지(배우자 자리)끼리, 4) 연지(띠)끼리
  const pairRel = (x: EarthlyBranch, y: EarthlyBranch) =>
    [...new Set(branchRelations([{ pos: 'day', char: x }, { pos: 'luck', char: y }]).map((r) => r.type))];
  const aDb = a.day.earthlyBranch;
  const bDb = b.day.earthlyBranch;
  for (const t of pairRel(aDb, bDb)) {
    const d = R.dayBranch[t];
    if (d !== undefined) add({ key: `db.${t}`, title: `일지 ${aDb}${bDb} ${t}`, delta: d, detail: DAY_BRANCH_TEXT[t] ?? t, category: '일지' });
  }
  const aYb = a.year.earthlyBranch;
  const bYb = b.year.earthlyBranch;
  for (const t of pairRel(aYb, bYb)) {
    const d = R.zodiac[t];
    if (d !== undefined) add({ key: `zodiac.${t}`, title: `띠 ${aYb}${bYb} ${t}`, delta: d, detail: `띠끼리 ${t} — 가볍게 참고하는 전통 궁합`, category: '띠' });
  }

  // 5) 오행 보완
  const ac = me.saju.elementCounts;
  const bc = partner.saju.elementCounts;
  const fillsMe = ELEMENTS.filter((e) => ac[e] === 0 && bc[e] >= 2).slice(0, R.elementFillMax);
  const fillsPartner = ELEMENTS.filter((e) => bc[e] === 0 && ac[e] >= 2).slice(0, R.elementFillMax);
  for (const e of fillsMe) add({ key: `el.fill.me.${e}`, title: `${josa(partner.label, '이/가')} ${me.label}의 빈 ${josa(e, '을/를')} 채움`, delta: R.elementFill, detail: `${me.label}의 원국에 없는 ${e} 기운이 ${partner.label}에게 넉넉함`, category: '오행' });
  for (const e of fillsPartner) add({ key: `el.fill.partner.${e}`, title: `${josa(me.label, '이/가')} ${partner.label}의 빈 ${josa(e, '을/를')} 채움`, delta: R.elementFill, detail: `${partner.label}의 원국에 없는 ${e} 기운이 ${me.label}에게 넉넉함`, category: '오행' });
  const sharedGap = ELEMENTS.filter((e) => ac[e] === 0 && bc[e] === 0);
  for (const e of sharedGap) add({ key: `el.gap.${e}`, title: `둘 다 ${josa(e, '이/가')} 없음`, delta: R.sharedGap, detail: `같은 빈자리를 가진 두 사람 — ${e}의 성질을 함께 의식하면 좋음`, category: '오행' });

  // 6) 도화 교차 (끌림)
  const peach = (owner: SajuResult, other: SajuResult) => {
    const d = owner.detail;
    const stars = loveStarBranches(d.day.heavenlyStem, d.year.earthlyBranch, d.day.earthlyBranch).filter((s) => s.name === '도화').map((s) => s.char);
    return [other.detail.day.earthlyBranch, other.detail.year.earthlyBranch].some((x) => stars.includes(x));
  };
  if (peach(me.saju, partner.saju)) add({ key: 'peach.me', title: `${josa(partner.label, '이/가')} ${me.label}의 도화 글자를 가짐`, delta: R.peachBlossom, detail: `${josa(me.label, '이/가')} ${partner.label}에게 눈길이 가기 쉬운 끌림`, category: '끌림' });
  if (peach(partner.saju, me.saju)) add({ key: 'peach.partner', title: `${josa(me.label, '이/가')} ${partner.label}의 도화 글자를 가짐`, delta: R.peachBlossom, detail: `${josa(partner.label, '이/가')} ${me.label}에게 끌리기 쉬움`, category: '끌림' });

  // 7) MBTI
  let mbti: { pair: string; note: string } | null = null;
  if (me.mbti && partner.mbti) {
    const m = R.mbti;
    const [x, y] = [me.mbti, partner.mbti];
    const same = (i: number) => x[i] === y[i];
    add(same(1)
      ? { key: 'mbti.SN.same', title: `${x[1]}${y[1]} 인식 방식이 같음`, delta: m.SN_same, detail: '대화의 결이 비슷해서 말이 잘 통함', category: 'MBTI' }
      : { key: 'mbti.SN.diff', title: `${x[1]}·${y[1]} 인식 방식이 다름`, delta: m.SN_diff, detail: '한 명은 구체·현실, 한 명은 가능성·의미 — 대화가 엇갈릴 때 예시로 맞추기', category: 'MBTI' });
    add(same(0)
      ? { key: 'mbti.EI.same', title: `둘 다 ${x[0]}`, delta: m.EI_same, detail: x[0] === 'E' ? '함께 밖으로 나가는 에너지' : '조용한 시간을 서로 존중', category: 'MBTI' }
      : { key: 'mbti.EI.diff', title: 'E·I 균형', delta: m.EI_diff, detail: '바깥 활동과 쉬는 시간의 균형을 맞춰 줌', category: 'MBTI' });
    add(same(2)
      ? { key: 'mbti.TF.same', title: `둘 다 ${x[2]}`, delta: m.TF_same, detail: x[2] === 'T' ? '문제를 논리로 함께 푸는 편' : '감정을 잘 알아주는 편', category: 'MBTI' }
      : { key: 'mbti.TF.diff', title: 'T·F 차이', delta: m.TF_diff, detail: '서로 보완되지만, 다툴 때 "해결"과 "공감" 중 무엇이 먼저인지 정해 두기', category: 'MBTI' });
    add(same(3)
      ? { key: 'mbti.JP.same', title: `둘 다 ${x[3]}`, delta: m.JP_same, detail: x[3] === 'J' ? '계획이 잘 맞음' : '즉흥 데이트가 잘 맞음', category: 'MBTI' }
      : { key: 'mbti.JP.diff', title: 'J·P 차이', delta: m.JP_diff, detail: '계획파와 즉흥파 — 큰 틀만 정하고 나머지는 열어 두기', category: 'MBTI' });
    mbti = { pair: `${x} × ${y}`, note: '자체 기준표 (재미로 보는 참고값)' };
  }

  const sum = items.reduce((s, i) => s + i.delta, 0);
  const score = Math.max(R.min, Math.min(R.max, R.base + sum));
  const byCategory = Object.fromEntries(
    (['일간', '이성의 별', '일지', '띠', '오행', '끌림', 'MBTI'] as const).map((c) => [c, items.filter((i) => i.category === c).reduce((s, i) => s + i.delta, 0)]),
  );
  const describe = (p: Person) => {
    const d = p.saju.detail;
    return {
      label: p.label,
      gender: p.saju.input.gender,
      dayMaster: `${d.day.heavenlyStem}(${d.dayYinYang.stem}${d.dayElement.stem})`,
      dayPillar: d.dayString,
      zodiacBranch: d.year.earthlyBranch,
      elementCounts: p.saju.elementCounts,
      hourKnown: p.saju.hourKnown,
      mbti: p.mbti,
    };
  };
  return {
    version: COMPAT_VERSION,
    score,
    grade: gradeOfCompat(score),
    scoreMeaning: '기본 60점에서 아래 근거들을 더하고 뺀 값이에요 (15~98). 재미로 보는 참고 점수예요.',
    me: describe(me),
    partner: describe(partner),
    items,
    byCategory,
    mbti,
  };
}

export type CompatResult = ReturnType<typeof computeCompat>;

const DAY_BRANCH_TEXT: Record<string, string> = {
  육합: '배우자 자리끼리 짝을 이뤄 자연스럽게 하나가 되는 조합',
  삼합: '배우자 자리가 같은 방향으로 힘을 모음',
  반합: '배우자 자리가 같은 방향으로 힘을 모음',
  충: '배우자 자리가 정면으로 부딪힘 — 생활 리듬·가치관 차이를 미리 대화로',
  형: '사소한 마찰이 생기기 쉬움 — 규칙을 정해 두면 편함',
  자형: '같은 글자끼리 — 비슷해서 같은 지점에서 예민해짐',
  원진: '끌리면서도 이유 없이 서운해지는 조합 — 단정 말고 확인하기',
  해: '서운함이 쌓이기 쉬움 — 작은 일도 말로 풀기',
  파: '약속이 어긋나기 쉬움 — 일정 공유를 습관으로',
};

export function compatCriteriaMarkdown(): string {
  const R = COMPAT_RULES;
  const L: string[] = ['# 모두의 연애 · 궁합 기준', '', `버전: \`${COMPAT_VERSION}\` · 원본: \`src/lib/compat/compat.ts\` (자동 생성)`, ''];
  L.push(`기본 ${R.base}점에서 아래 근거를 더하고 빼서 ${R.min}~${R.max} 사이로 자릅니다.`, '');
  L.push('| 범주 | 조건 | 점수 |', '|---|---|---|');
  for (const [k, v] of Object.entries(R.dayMaster)) L.push(`| 일간 | ${k} | ${v} |`);
  L.push(`| 이성의 별 | 상대 일간이 내 재성(남)·관성(여), 양방향 각각 | ${R.loveStar} |`);
  for (const [k, v] of Object.entries(R.dayBranch)) L.push(`| 일지(배우자 자리) | ${k} | ${v} |`);
  for (const [k, v] of Object.entries(R.zodiac)) L.push(`| 띠(연지) | ${k} | ${v} |`);
  L.push(`| 오행 | 내게 없는(0) 오행을 상대가 2개 이상, 각 방향 최대 ${R.elementFillMax}개 | ${R.elementFill} |`);
  L.push(`| 오행 | 둘 다 없는 오행 | ${R.sharedGap} |`);
  L.push(`| 끌림 | 상대 일지·연지가 내 도화 글자, 양방향 각각 | ${R.peachBlossom} |`);
  for (const [k, v] of Object.entries(R.mbti)) L.push(`| MBTI | ${k.replace('_', ' ')} | ${v} |`);
  L.push('', '| 점수 | 등급 문구 |', '|---|---|', ...COMPAT_GRADES.map(([t, g]) => `| ${t} 이상 | ${g} |`), '');
  L.push('공포·불안 조장 금지: 낮은 점수도 "맞춰 가야 할 지점"으로 표현합니다.', '');
  return L.join('\n');
}
