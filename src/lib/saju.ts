import {
  calculateFourPillars,
  getHeavenlyStemElement,
  getEarthlyBranchElement,
  lunarToSolar,
  type BirthInfo,
  type DayBoundary,
  type FiveElement,
  type FourPillarsDetail,
  type Gender,
} from 'manseryeok';

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

/** LLM 해석 단계에 넘길 구조화 데이터 (계산은 코드, 해석만 LLM) */
export function toLlmPayload(r: SajuResult) {
  const d = r.detail;
  const pillar = (key: PillarKey) =>
    key === 'hour' && !r.hourKnown
      ? null
      : {
          ganji: pillarString(d, key),
          hanja: d[`${key}Hanja` as const],
          stem: { char: d[key].heavenlyStem, element: d[`${key}Element` as const].stem, yinYang: d[`${key}YinYang` as const].stem },
          branch: { char: d[key].earthlyBranch, element: d[`${key}Element` as const].branch, yinYang: d[`${key}YinYang` as const].branch },
          tenGods: d.tenGods[key],
        };

  return {
    schema: 'modu-yeonae.saju.v1',
    engine: 'manseryeok@2.0.0',
    options: {
      calendar: r.input.isLunar ? (r.input.isLeapMonth ? 'lunar-leap' : 'lunar') : 'solar',
      trueSolarTime: r.input.useTrueSolarTime,
      longitude: r.input.longitude ?? 127.5,
      dayBoundary: r.input.dayBoundary,
      hourKnown: r.hourKnown,
    },
    solarBirthDate: r.solarDate,
    gender: r.input.gender,
    dayMaster: { stem: d.day.heavenlyStem, element: d.dayElement.stem, yinYang: d.dayYinYang.stem },
    pillars: {
      year: pillar('year'),
      month: pillar('month'),
      day: pillar('day'),
      hour: pillar('hour'),
    },
    elementCounts: r.elementCounts,
    voidBranches: d.voidBranches,
    luckPillars: d.luckPillars
      ? {
          direction: d.luckPillars.forward ? 'forward' : 'backward',
          startAge: d.luckPillars.startAge,
          list: d.luckPillars.pillars.map((p) => ({ age: p.age, ganji: p.korean })),
        }
      : null,
  };
}
