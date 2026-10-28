import { AXIS_POLES, type Axis, type Pole, type Question } from './questions.js';

/** 문항 id → 응답(1~5) */
export type Answers = Record<string, number>;

export type Clarity = '경계' | '약간' | '뚜렷' | '매우 뚜렷';

export interface AxisResult {
  axis: Axis;
  left: Pole;
  right: Pole;
  /** 왼쪽 성향(E·S·T·J) 비율 0~100. 오른쪽은 100 - leftPercent */
  leftPercent: number;
  /** 선택된 성향 */
  pole: Pole;
  /** 원점수: -max ~ +max (양수면 왼쪽) */
  raw: number;
  max: number;
  clarity: Clarity;
  /** 동점이라 보조 규칙으로 결정했는지 */
  tieBroken: boolean;
}

export interface PersonalityResult {
  type: string;
  axes: AxisResult[];
  answeredCount: number;
  totalCount: number;
}

const AXES: Axis[] = ['EI', 'SN', 'TF', 'JP'];

export function clarityOf(leftPercent: number): Clarity {
  const d = Math.abs(leftPercent - 50);
  if (d < 10) return '경계';
  if (d < 25) return '약간';
  if (d < 40) return '뚜렷';
  return '매우 뚜렷';
}

/**
 * 채점 규칙
 * 1) 응답 1~5 를 중앙(3) 기준 -2 ~ +2 로 변환.
 * 2) 문항 성향이 축의 왼쪽(E·S·T·J)이면 그대로, 오른쪽이면 부호 반전해 합산.
 * 3) 축 원점수 범위는 ±(문항수 × 2). 이를 0~100% 로 정규화.
 * 4) 원점수가 0(완전 동점)이면, 그 축의 "연애 문항"만 다시 합산해 결정하고,
 *    그래도 0이면 오른쪽 성향(I·N·F·P)으로 둔다. (보조 규칙 사용 여부를 결과에 표시)
 */
export function scorePersonality(questions: readonly Question[], answers: Answers): PersonalityResult {
  const axes = AXES.map<AxisResult>((axis) => {
    const [left, right] = AXIS_POLES[axis];
    const qs = questions.filter((q) => q.axis === axis);
    const signed = (q: Question) => {
      const v = answers[q.id];
      if (v === undefined) return 0;
      const centered = v - 3;
      return q.pole === left ? centered : -centered;
    };
    const raw = qs.reduce((sum, q) => sum + signed(q), 0);
    const max = qs.length * 2;
    const leftPercent = max === 0 ? 50 : Math.round(50 + (raw / max) * 50);

    let pole: Pole;
    let tieBroken = false;
    if (raw > 0) pole = left;
    else if (raw < 0) pole = right;
    else {
      tieBroken = true;
      const loveRaw = qs.filter((q) => q.context === 'love').reduce((s, q) => s + signed(q), 0);
      pole = loveRaw > 0 ? left : right;
    }

    return { axis, left, right, leftPercent, pole, raw, max, clarity: clarityOf(leftPercent), tieBroken };
  });

  return {
    type: axes.map((a) => a.pole).join(''),
    axes,
    answeredCount: questions.filter((q) => answers[q.id] !== undefined).length,
    totalCount: questions.length,
  };
}

/** LLM 해석 단계에 넘길 구조화 데이터 */
export function toPersonalityPayload(r: PersonalityResult, mode: string) {
  return {
    schema: 'modu-yeonae.personality.v1',
    instrument: 'modu-yeonae-type-v1 (자체 제작, 공식 MBTI® 아님)',
    mode,
    type: r.type,
    axes: Object.fromEntries(
      r.axes.map((a) => [
        a.axis,
        {
          pole: a.pole,
          [a.left]: a.leftPercent,
          [a.right]: 100 - a.leftPercent,
          clarity: a.clarity,
          tieBroken: a.tieBroken,
        },
      ]),
    ),
  };
}
