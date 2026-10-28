/**
 * 성격유형 결과 → 아는 형/언니 해석 (프롬프트·스키마·캐시 키). 서버·브라우저 공용 순수 로직.
 * 채점은 코드(scoring.ts), 문장만 LLM.
 */
import { AXIS_LABEL, getQuestions, type TestMode } from '../personality/questions.js';
import { scorePersonality, type Answers, type PersonalityResult } from '../personality/scoring.js';
import { TYPE_PROFILES } from '../personality/types.js';

export const PERSONALITY_PROMPT_VERSION = 'personality-2026-10-28.1';
export type Hub = '형' | '언니';
export type Situation = '솔로' | '썸' | '연애중' | '이별';
export const SITUATIONS: Situation[] = ['솔로', '썸', '연애중', '이별'];

export function scoreFromAnswers(mode: TestMode, answers: Answers): PersonalityResult {
  return scorePersonality(getQuestions(mode), answers);
}

export function personalityData(r: PersonalityResult, situation: Situation | null) {
  const p = TYPE_PROFILES[r.type];
  return {
    type: r.type,
    instrument: '모두의 연애 자체 성격유형 테스트 (공식 MBTI® 아님)',
    axes: r.axes.map((a) => ({
      axis: AXIS_LABEL[a.axis],
      result: a.pole,
      percent: `${a.left} ${a.leftPercent}% : ${a.right} ${100 - a.leftPercent}%`,
      clarity: a.clarity,
      tieBroken: a.tieBroken,
    })),
    baseProfile: { nickname: p.nickname, summary: p.summary, loveStyle: p.loveStyle, strengths: p.strengths, watchOut: p.watchOut },
    situation,
  };
}

export function personalitySystem(hub: Hub): string {
  return `너는 연애 상담 앱 '모두의 연애'의 허브 캐릭터 "아는 ${hub}"야. 성격유형으로 사람을 읽는 데 달인이고, 편하고 솔직하지만 따뜻해.
말투는 친근한 해요체("~해요", "~거든요")를 기본으로, 가끔 짧은 반말 감탄("야, 이거 딱 너다") 정도만 섞어.

## 근거 규칙
- <data>의 유형·축별 비율·명확도와 baseProfile(팀이 쓴 기본 설명)이 근거야. 그 방향 안에서 풀어 써.
- clarity가 '경계'인 축은 "상황에 따라 양쪽이 다 나오는 편"으로 설명하고 단정하지 마.
- situation이 있으면(썸/연애중/이별/솔로) 그 상황에 맞는 조언으로 맞춰. 없으면 일반적인 연애 관점.
- 공식 MBTI 검사가 아니라 자체 테스트라는 점을 과장하지 말고, 유형으로 사람을 단정하지 마.

## 공통 금지
- 진단·병명·치료 권유처럼 들리는 표현, 특정 유형 비하
- 상대를 조종하거나 집착을 부추기는 조언
- 마크다운 기호 사용. 각 문자열은 평문`;
}

const s = (description: string) => ({ type: 'string', description });
export const personalitySchema = {
  type: 'object',
  properties: {
    headline: s('한 줄 제목 (20자 이내)'),
    summary: s('이 사람을 한 문단으로 (2문장, 100자 이내)'),
    loveStyle: s('연애할 때 모습 3문장 (180자 이내), 축별 비율 근거 1~2개'),
    strengths: { type: 'array', description: '연애 강점 3개, 각각 25자 이내', items: { type: 'string' } },
    watchOut: { type: 'array', description: '조심할 점 2개, 각각 35자 이내, 대처법 포함', items: { type: 'string' } },
    situationTip: s('지금 상황(situation)에 맞는 구체적인 조언 2문장 (situation 이 없으면 일반 조언)'),
    hubComment: s('아는 형/언니의 한마디 (반말 섞어도 됨, 50자 이내)'),
  },
  required: ['headline', 'summary', 'loveStyle', 'strengths', 'watchOut', 'situationTip', 'hubComment'],
  additionalProperties: false,
};

export function personalityUser(data: ReturnType<typeof personalityData>): string {
  return `성격유형 테스트 결과를 연애 관점으로 풀어 줘.\n\n<data>\n${JSON.stringify(data)}\n</data>`;
}

/** 같은 유형·같은 축 명확도·같은 상황이면 같은 해석 → 공유 캐시 */
export function personalityCacheSource(r: PersonalityResult, situation: Situation | null, hub: Hub, model: string) {
  const sig = r.axes.map((a) => `${a.pole}${a.clarity}${a.tieBroken ? '*' : ''}`).join('');
  return ['personality', r.type, sig, situation ?? '-', hub, PERSONALITY_PROMPT_VERSION, model].join('#');
}
