import {
  calculateFourPillars,
  getVoidBranches,
  type EarthlyBranch,
  type HeavenlyStem,
  getHeavenlyStemElement,
  getEarthlyBranchElement,
  getTenGod,
  getBranchTenGod,
  lunarToSolar,
  type BirthInfo,
  type DayBoundary,
  type FiveElement,
  type FourPillarsDetail,
  type Gender,
} from 'manseryeok';
import {
  POSITION_LABEL,
  SEASON,
  TEN_GOD_GROUP,
  branchRelations,
  hiddenStemsOf,
  judgeStrength,
  specialStars,
  stemRelations,
  twelveStage,
  type Placed,
  type Position,
  type TenGodGroup,
} from './saju-analysis';
import { toTrueSolarTime } from './vendor/korea-time';

/** 출생지 경도 프리셋 (동경, 시청 기준 근사값) */
export const BIRTH_PLACES: { name: string; longitude: number | null }[] = [
  { name: '서울', longitude: 126.978 },
  { name: '인천', longitude: 126.705 },
  { name: '수원·경기 남부', longitude: 127.029 },
  { name: '춘천', longitude: 127.73 },
  { name: '강릉', longitude: 128.876 },
  { name: '대전', longitude: 127.385 },
  { name: '청주', longitude: 127.489 },
  { name: '전주', longitude: 127.148 },
  { name: '광주', longitude: 126.852 },
  { name: '대구', longitude: 128.601 },
  { name: '포항', longitude: 129.343 },
  { name: '울산', longitude: 129.311 },
  { name: '부산', longitude: 129.075 },
  { name: '창원', longitude: 128.681 },
  { name: '제주', longitude: 126.531 },
  { name: '모름 (한반도 평균 127.5°)', longitude: null },
];

export interface SajuInput {
  year: number;
  month: number;
  day: number;
  /** null 이면 시간 모름 */
  hour: number | null;
  minute: number;
  isLunar: boolean;
  isLeapMonth: boolean;
  gender: Gender;
  /** null 이면 기본 경도(127.5) */
  longitude: number | null;
  useTrueSolarTime: boolean;
  dayBoundary: DayBoundary;
}

export const PILLAR_KEYS = ['hour', 'day', 'month', 'year'] as const;
export type PillarKey = (typeof PILLAR_KEYS)[number];
export const PILLAR_LABEL: Record<PillarKey, string> = {
  hour: '시주',
  day: '일주',
  month: '월주',
  year: '연주',
};

export const ELEMENTS: FiveElement[] = ['목', '화', '토', '금', '수'];
export const ELEMENT_HANJA: Record<FiveElement, string> = {
  목: '木',
  화: '火',
  토: '土',
  금: '金',
  수: '水',
};

export interface SajuResult {
  input: SajuInput;
  detail: FourPillarsDetail;
  /** 양력 환산일 (음력 입력이면 변환값) */
  solarDate: { year: number; month: number; day: number };
  hourKnown: boolean;
  /** 오행 분포 (시간 모름이면 시주 제외 6글자) */
  elementCounts: Record<FiveElement, number>;
  /** 진태양시 보정을 껐을 때와 기둥이 달라지는지 비교 */
  correctionDiff: { key: PillarKey; withCorrection: string; without: string }[];
  /** 시간 모름일 때, 하루 중 시각에 따라 연·월·일주가 바뀌는 날(절입일 등)인지 */
  ambiguousWithoutHour: { key: PillarKey; values: string[] }[];
  warnings: string[];
}

function toBirthInfo(input: SajuInput, hour: number, minute: number, trueSolar: boolean): BirthInfo {
  return {
    year: input.year,
    month: input.month,
    day: input.day,
    hour,
    minute,
    isLunar: input.isLunar,
    isLeapMonth: input.isLunar ? input.isLeapMonth : false,
    gender: input.gender,
    dayBoundary: input.dayBoundary,
    trueSolarTime: trueSolar
      ? { longitude: input.longitude ?? undefined, applyEquationOfTime: true, applyHistoricalDst: true }
      : undefined,
  };
}

function pillarString(d: FourPillarsDetail, key: PillarKey): string {
  return d[`${key}String` as const];
}

export function calculateSaju(input: SajuInput): SajuResult {
  const hourKnown = input.hour !== null;
  const hour = input.hour ?? 12;
  const minute = hourKnown ? input.minute : 0;
  const warnings: string[] = [];
  // 시간을 모르면 진태양시 보정은 의미가 없고, 정오 기준 계산 시 날짜가 바뀌지 않도록 보정을 끈다
  const trueSolar = hourKnown && input.useTrueSolarTime;

  // 라이브러리가 범위·유효성 오류 시 RangeError(한국어 메시지)를 던진다 → 호출부에서 처리
  const detail = calculateFourPillars(toBirthInfo(input, hour, minute, trueSolar));

  const solarDate = input.isLunar
    ? lunarToSolar(input.year, input.month, input.day, input.isLeapMonth)
    : { year: input.year, month: input.month, day: input.day };

  // 오행 분포
  const elementCounts = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<FiveElement, number>;
  for (const key of PILLAR_KEYS) {
    if (key === 'hour' && !hourKnown) continue;
    const p = detail[key];
    elementCounts[getHeavenlyStemElement(p.heavenlyStem)] += 1;
    elementCounts[getEarthlyBranchElement(p.earthlyBranch)] += 1;
  }

  // 진태양시 보정 유무 비교 (시간을 아는 경우만 의미 있음)
  const correctionDiff: SajuResult['correctionDiff'] = [];
  if (hourKnown) {
    const other = calculateFourPillars(toBirthInfo(input, hour, minute, !input.useTrueSolarTime));
    for (const key of PILLAR_KEYS) {
      const a = pillarString(detail, key);
      const b = pillarString(other, key);
      if (a !== b) {
        correctionDiff.push({
          key,
          withCorrection: input.useTrueSolarTime ? a : b,
          without: input.useTrueSolarTime ? b : a,
        });
      }
    }
  }

  // 시간 모름: 그날 00:00 ~ 22:59 사이에 절입으로 연·월주가 바뀌는지 확인.
  // (일주는 자정 기준이면 하루 안에서 바뀌지 않고, 23시대는 자시 관법 문제라 별도 경고로 다루지 않음)
  const ambiguousWithoutHour: SajuResult['ambiguousWithoutHour'] = [];
  if (!hourKnown) {
    const samples = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].flatMap((h) => [
      calculateFourPillars(toBirthInfo(input, h, 0, false)),
      calculateFourPillars(toBirthInfo(input, h, 59, false)),
    ]);
    for (const key of ['year', 'month'] as const) {
      const values = [...new Set(samples.map((s) => pillarString(s, key)))];
      if (values.length > 1) ambiguousWithoutHour.push({ key, values });
    }
    warnings.push('태어난 시간을 모르면 시주(時柱)는 빼고 6글자로 풀이해요.');
    if (ambiguousWithoutHour.length > 0) {
      warnings.push(
        '이날은 하루 안에서 절기가 바뀌어 태어난 시각에 따라 기둥이 달라질 수 있어요. 정확한 시간을 넣어 주세요.',
      );
    }
  }

  if (input.year < 1908 && !input.useTrueSolarTime) {
    warnings.push('1908년 이전 출생은 지방시 기록일 가능성이 높아 진태양시 보정을 권장해요.');
  }

  return {
    input,
    detail,
    solarDate,
    hourKnown,
    elementCounts,
    correctionDiff,
    ambiguousWithoutHour,
    warnings,
  };
}

/* ───────────────────────── LLM 입력 데이터 (v2) ───────────────────────── */

export const SAJU_SCHEMA = 'modu-yeonae.saju.v2';
export const ENGINE = 'manseryeok@2.0.0';

type Ymd = { year: number; month: number; day: number };

/** 한국 시간 기준 오늘 날짜 */
export function todayKst(now: Date = new Date()): Ymd {
  const k = new Date(now.getTime() + 9 * 3600000);
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1, day: k.getUTCDate() };
}

const ymdStr = (d: Ymd) => `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
const cmp = (a: Ymd, b: Ymd) => (a.year - b.year) * 10000 + (a.month - b.month) * 100 + (a.day - b.day);

function addYmd(d: Ymd, years: number, months: number, days: number): Ymd {
  const t = new Date(Date.UTC(d.year + years, d.month - 1 + months, d.day + days));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** 만 나이 */
function fullAge(birth: Ymd, at: Ymd): number {
  return at.year - birth.year - (at.month * 100 + at.day < birth.month * 100 + birth.day ? 1 : 0);
}

/**
 * 해석 단계(LLM)에 넘길 구조화 데이터. 계산은 전부 여기서 끝내고 LLM 은 해석만 한다.
 * @param referenceDate 대운·세운·월운의 "지금" 기준일 (기본: 오늘 KST)
 */
export function toLlmPayload(r: SajuResult, referenceDate: Ymd = todayKst()) {
  const d = r.detail;
  const dm = d.day.heavenlyStem;
  const keys = (['year', 'month', 'day', 'hour'] as const).filter((k) => k !== 'hour' || r.hourKnown);

  const pillar = (key: PillarKey) => {
    if (key === 'hour' && !r.hourKnown) return null;
    const branch = d[key].earthlyBranch;
    const hidden = hiddenStemsOf(dm, branch);
    return {
      ganji: pillarString(d, key),
      hanja: d[`${key}Hanja` as const],
      stem: {
        char: d[key].heavenlyStem,
        element: d[`${key}Element` as const].stem,
        yinYang: d[`${key}YinYang` as const].stem,
        tenGod: key === 'day' ? '일간' : d.tenGods[key].stem,
      },
      branch: {
        char: branch,
        element: d[`${key}Element` as const].branch,
        /** 지지 자리(체) 음양. 십신 판단에는 쓰지 말 것 → mainQi 기준 */
        yinYangPosition: d[`${key}YinYang` as const].branch,
        /** 정기(본기). 지지 십신은 이 글자 기준 */
        mainQi: hidden[hidden.length - 1].stem,
        tenGod: d.tenGods[key].branch,
        hiddenStems: hidden,
      },
      /** 12운성: 일간이 이 지지에서 갖는 기운 (봉법) */
      twelveStage: twelveStage(dm, branch),
    };
  };

  // 원국 글자 배치
  const natalStems: Placed<HeavenlyStem>[] = keys.map((k) => ({ pos: k, char: d[k].heavenlyStem }));
  const natalBranches: Placed<EarthlyBranch>[] = keys.map((k) => ({ pos: k, char: d[k].earthlyBranch }));
  const natalFull = keys.map((k) => ({ pos: k, stem: d[k].heavenlyStem, branch: d[k].earthlyBranch }));

  // 십신 분포 (천간 + 지지 정기, 일간 제외)
  const tenGodCounts: Record<TenGodGroup, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const k of keys) {
    if (k !== 'day') tenGodCounts[TEN_GOD_GROUP[d.tenGods[k].stem]] += 1;
    tenGodCounts[TEN_GOD_GROUP[d.tenGods[k].branch]] += 1;
  }

  // 대운 타임라인 (실제 날짜 기준)
  const birth = r.solarDate;
  const lp = d.luckPillars;
  let luck = null;
  let currentLuck: { ganji: string; stem: HeavenlyStem; branch: EarthlyBranch } | null = null;
  if (lp) {
    const firstStart = addYmd(birth, lp.startYears, lp.startMonths, lp.startDays);
    const list = lp.pillars.map((p, i) => {
      const start = addYmd(firstStart, i * 10, 0, 0);
      const end = addYmd(start, 10, 0, -1);
      const current = cmp(referenceDate, start) >= 0 && cmp(referenceDate, end) <= 0;
      if (current) currentLuck = { ganji: p.korean, stem: p.pillar.heavenlyStem, branch: p.pillar.earthlyBranch };
      return {
        ganji: p.korean,
        /** 대운수 표기(엔진 반올림값, 관례상 표시용) */
        label: `${p.age}대운`,
        startDate: ymdStr(start),
        endDate: ymdStr(end),
        ageAtStart: `만 ${lp.startYears + i * 10}세 ${lp.startMonths}개월`,
        stemTenGod: getTenGod(dm, p.pillar.heavenlyStem),
        branchTenGod: getBranchTenGod(dm, p.pillar.earthlyBranch),
        twelveStage: twelveStage(dm, p.pillar.earthlyBranch),
        current,
      };
    });
    luck = {
      direction: lp.forward ? 'forward' : 'backward',
      startAge: lp.startAge,
      startAgeBasis: '대운수(절입까지 일수÷3 반올림). 실제 시작 시점은 firstStartDate 기준',
      firstStartDate: ymdStr(firstStart),
      precise: { years: lp.startYears, months: lp.startMonths, days: lp.startDays },
      list,
    };
  }

  // 세운·월운 (기준일의 연주·월주 = 입춘·절입 기준)
  const ref = calculateFourPillars({ ...referenceDate, hour: 12, minute: 0 });
  const flow = (pos: Position, stem: HeavenlyStem, branch: EarthlyBranch) => ({
    ganji: stem + branch,
    stemTenGod: getTenGod(dm, stem),
    branchTenGod: getBranchTenGod(dm, branch),
    twelveStage: twelveStage(dm, branch),
    relationsWithNatal: groupRelations([
      ...stemRelations([...natalStems, { pos, char: stem }], pos),
      ...branchRelations([...natalBranches, { pos, char: branch }], pos),
    ]).map(describe),
  });
  const cl = currentLuck as { ganji: string; stem: HeavenlyStem; branch: EarthlyBranch } | null;

  const strength = judgeStrength(dm, natalFull);
  const missing = ELEMENTS.filter((e) => r.elementCounts[e] === 0);

  return {
    schema: SAJU_SCHEMA,
    engine: ENGINE,
    referenceDate: ymdStr(referenceDate),
    input: {
      calendar: r.input.isLunar ? (r.input.isLeapMonth ? 'lunar-leap' : 'lunar') : 'solar',
      date: { year: r.input.year, month: r.input.month, day: r.input.day },
      time: r.hourKnown ? `${String(r.input.hour).padStart(2, '0')}:${String(r.input.minute).padStart(2, '0')}` : null,
      hourKnown: r.hourKnown,
      gender: r.input.gender,
      longitude: r.input.longitude ?? 127.5,
      trueSolarTime: r.input.useTrueSolarTime,
      dayBoundary: r.input.dayBoundary,
    },
    solarBirthDate: r.solarDate,
    correctedTime:
      r.hourKnown && r.input.useTrueSolarTime
        ? toTrueSolarTime(r.solarDate.year, r.solarDate.month, r.solarDate.day, r.input.hour!, r.input.minute, r.input.longitude ?? 127.5)
        : null,
    ageNow: fullAge(birth, referenceDate),
    dayMaster: { stem: dm, element: d.dayElement.stem, yinYang: d.dayYinYang.stem },
    pillars: {
      year: pillar('year'),
      month: pillar('month'),
      day: pillar('day'),
      hour: pillar('hour'),
    },
    season: { monthBranch: d.month.earthlyBranch, label: SEASON[d.month.earthlyBranch] },
    elementCounts: {
      basis: r.hourKnown ? '천간·지지 8글자 단순 개수' : '시주 제외 6글자 단순 개수',
      counts: r.elementCounts,
      missing,
    },
    tenGodCounts: { basis: '천간 + 지지 정기 기준, 일간 제외', counts: tenGodCounts },
    strength,
    relations: groupRelations([...stemRelations(natalStems), ...branchRelations(natalBranches)]).map(describe),
    specialStars: specialStars(dm, natalFull).map((s) => ({
      ...s,
      where: s.positions.map((p) => POSITION_LABEL[p]),
    })),
    voidBranches: {
      byDayPillar: d.voidBranches,
      byYearPillar: getVoidBranches(d.year.heavenlyStem, d.year.earthlyBranch),
      inNatal: natalBranches.filter((b) => d.voidBranches.includes(b.char)).map((b) => POSITION_LABEL[b.pos]),
    },
    luckPillars: luck,
    now: {
      luck: cl ? flow('luck', cl.stem, cl.branch) : null,
      annual: flow('annual', ref.year.heavenlyStem, ref.year.earthlyBranch),
      monthly: flow('monthly', ref.month.heavenlyStem, ref.month.earthlyBranch),
    },
    warnings: r.warnings,
  };
}

export type SajuPayload = ReturnType<typeof toLlmPayload>;

type Rel = ReturnType<typeof branchRelations>[number];

/** 같은 종류·같은 글자 조합이 여러 자리에서 반복되면 하나로 묶는다 (예: 丑 1개 + 午 3개 → 축오 해 1건) */
function groupRelations(rels: Rel[]): Rel[] {
  const out: Rel[] = [];
  for (const r of rels) {
    const sig = `${r.type}|${[...new Set(r.chars)].sort().join('')}`;
    const prev = out.find((o) => `${o.type}|${[...new Set(o.chars)].sort().join('')}` === sig);
    if (!prev) {
      out.push({ ...r, positions: [...r.positions], chars: [...r.chars] });
      continue;
    }
    for (let i = 0; i < r.positions.length; i++) {
      if (!prev.positions.includes(r.positions[i])) {
        prev.positions.push(r.positions[i]);
        prev.chars.push(r.chars[i]);
      }
    }
    prev.adjacent = Boolean(prev.adjacent || r.adjacent);
    prev.note = `${[...new Set(prev.chars)].map((c) => `${c} ${prev.chars.filter((x) => x === c).length}개`).join(' · ')}가 서로 맞물림`;
  }
  return out;
}

function describe(rel: Rel) {
  return {
    type: rel.type,
    chars: rel.chars.join(''),
    where: rel.positions.map((p) => POSITION_LABEL[p]),
    ...(rel.result ? { result: rel.result } : {}),
    ...(rel.adjacent !== undefined ? { adjacent: rel.adjacent } : {}),
    ...(rel.note ? { note: rel.note } : {}),
  };
}
