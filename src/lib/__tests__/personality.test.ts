import { describe, expect, it } from 'vitest';
import { AXIS_POLES, QUESTIONS, getQuestions, type Axis } from '../personality/questions';
import { scorePersonality, type Answers } from '../personality/scoring';
import { TYPE_PROFILES } from '../personality/types';

const AXES: Axis[] = ['EI', 'SN', 'TF', 'JP'];

describe('문항 구성', () => {
  it('32문항, id 중복 없음, 출제 순서가 전 문항을 포함', () => {
    expect(QUESTIONS).toHaveLength(32);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(32);
    expect(getQuestions('full')).toHaveLength(32);
    expect(new Set(getQuestions('full').map((q) => q.id)).size).toBe(32);
  });

  it.each(AXES)('%s 축: 양방향 4문항씩, 성향별 연애 문항 2개', (axis) => {
    const [l, r] = AXIS_POLES[axis];
    for (const pole of [l, r]) {
      const qs = QUESTIONS.filter((q) => q.axis === axis && q.pole === pole);
      expect(qs).toHaveLength(4);
      expect(qs.filter((q) => q.context === 'love')).toHaveLength(2);
    }
  });

  it.each(AXES)('빠른 모드 %s 축: 양방향 2문항씩', (axis) => {
    const [l, r] = AXIS_POLES[axis];
    const qs = getQuestions('quick').filter((q) => q.axis === axis);
    expect(qs.filter((q) => q.pole === l)).toHaveLength(2);
    expect(qs.filter((q) => q.pole === r)).toHaveLength(2);
  });

  it('출제 순서에서 같은 축이 연달아 나오지 않음', () => {
    for (const mode of ['full', 'quick'] as const) {
      const qs = getQuestions(mode);
      for (let i = 1; i < qs.length; i++) expect(qs[i].axis).not.toBe(qs[i - 1].axis);
    }
  });

  it('16개 유형 설명이 모두 있음', () => {
    const types = ['E', 'I'].flatMap((a) =>
      ['S', 'N'].flatMap((b) => ['T', 'F'].flatMap((c) => ['J', 'P'].map((d) => a + b + c + d))),
    );
    for (const t of types) expect(TYPE_PROFILES[t]).toBeDefined();
  });
});

describe('채점', () => {
  const qs = getQuestions('full');
  const fill = (f: (pole: string) => number): Answers => Object.fromEntries(qs.map((q) => [q.id, f(q.pole)]));

  it('왼쪽 성향 문항 전부 매우 그렇다 + 오른쪽 전부 전혀 아니다 → ESTJ 100%', () => {
    const r = scorePersonality(qs, fill((p) => ('ESTJ'.includes(p) ? 5 : 1)));
    expect(r.type).toBe('ESTJ');
    expect(r.axes.every((a) => a.leftPercent === 100 && a.clarity === '매우 뚜렷')).toBe(true);
  });

  it('반대로 → INFP 0%', () => {
    const r = scorePersonality(qs, fill((p) => ('ESTJ'.includes(p) ? 1 : 5)));
    expect(r.type).toBe('INFP');
    expect(r.axes.every((a) => a.leftPercent === 0)).toBe(true);
  });

  it('전부 "매우 그렇다"로 찍으면 균형 배치 덕분에 모든 축이 50%(경계)·동점 처리', () => {
    const r = scorePersonality(qs, fill(() => 5));
    expect(r.axes.every((a) => a.raw === 0 && a.leftPercent === 50 && a.clarity === '경계' && a.tieBroken)).toBe(true);
  });

  it('동점이면 연애 문항으로 결정', () => {
    // EI 축: 일상 문항은 E쪽, 연애 문항은 I쪽으로 응답 → 합계 0, 연애 문항 기준 I
    const answers: Answers = {};
    for (const q of qs) {
      if (q.axis !== 'EI') answers[q.id] = 3;
      else if (q.context === 'daily') answers[q.id] = q.pole === 'E' ? 5 : 1;
      else answers[q.id] = q.pole === 'E' ? 1 : 5;
    }
    const ei = scorePersonality(qs, answers).axes[0];
    expect(ei.raw).toBe(0);
    expect(ei.tieBroken).toBe(true);
    expect(ei.pole).toBe('I');
  });

  it('중간 응답 퍼센트 계산', () => {
    // EI: E문항 4개 "그렇다"(+1씩), I문항 4개 "보통"(0) → raw 4 / max 16 → 62.5 → 63%
    const answers: Answers = {};
    for (const q of qs) answers[q.id] = q.axis === 'EI' && q.pole === 'E' ? 4 : 3;
    const ei = scorePersonality(qs, answers).axes[0];
    expect(ei.raw).toBe(4);
    expect(ei.leftPercent).toBe(63);
    expect(ei.pole).toBe('E');
    expect(ei.clarity).toBe('약간');
  });
});
