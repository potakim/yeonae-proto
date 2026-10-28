/** 궁합 해석 (무당) — 프롬프트·스키마·캐시 키. 점수·근거는 compat.ts 가 확정 */
import { COMPAT_VERSION, type CompatResult } from '../compat/compat.js';
import type { SajuResult } from '../saju.js';

export const COMPAT_PROMPT_VERSION = 'compat-2026-10-28.1';

export function compatSystem(characterName: string): string {
  return `너는 연애 상담 앱 '모두의 연애'의 사주 캐릭터 "${characterName}"야. 두 사람의 궁합을 보는 다정하지만 할 말은 하는 무당.
"~해요", "~거든요", 가끔 "~구먼" 정도의 친근한 말투.

## 근거 규칙
- <data>의 score·grade·items(근거와 점수)는 코드가 이미 확정했어. 숫자를 바꾸거나 새 근거를 만들지 마.
- 점수가 높은 근거는 강점으로, 음수 근거는 "맞춰 가야 할 지점 + 방법"으로 풀어.
- 점수 숫자는 headline·summary 에서 한 번만 자연스럽게 언급해도 되고, 개별 근거 점수는 말하지 마.
- MBTI 는 자체 기준이라 가볍게 다뤄. mbti 가 null 이면 MBTI 이야기는 하지 마.
- 두 사람을 me.label / partner.label 로 불러.
- hourKnown 이 false 인 사람이 있으면 "태어난 시간 없이 본 궁합"이라고 한 번 짚어 줘.

## 금지
- 헤어져야 한다, 큰일 난다 같은 단정·공포 표현, 낮은 점수를 이유로 관계를 끝내라는 조언
- 부적·굿·유료 상담 권유, 상대를 조종하거나 시험해 보라는 조언
- 마크다운 기호, JSON 필드 이름 노출. 각 문자열은 평문`;
}

const s = (description: string) => ({ type: 'string', description });
export const compatSchema = {
  type: 'object',
  properties: {
    headline: s('한 줄 제목 (20자 이내)'),
    summary: s('두 사람 궁합 총평 2문장 (120자 이내)'),
    chemistry: s('끌림과 잘 맞는 점 3문장 (180자 이내), 일간·이성의 별·도화·오행 근거 중 핵심만'),
    communication: s('대화·생활 스타일 2~3문장 (150자 이내), MBTI 가 있으면 반영'),
    conflict: s('부딪히기 쉬운 지점과 푸는 법 3문장 (180자 이내), 음수 근거 기반'),
    advice: s('두 사람에게 주는 구체적인 조언 2문장 (100자 이내)'),
    closing: s('무당 말투의 따뜻한 마무리 한 문장 (50자 이내)'),
  },
  required: ['headline', 'summary', 'chemistry', 'communication', 'conflict', 'advice', 'closing'],
  additionalProperties: false,
};

export function compatUser(c: CompatResult): string {
  return `두 사람의 궁합을 풀어 줘.\n\n<data>\n${JSON.stringify(c)}\n</data>`;
}

const natalKey = (r: SajuResult) => [r.detail.yearString, r.detail.monthString, r.detail.dayString, r.hourKnown ? r.detail.hourString : '-', r.input.gender].join('|');

export function compatCacheSource(a: SajuResult, b: SajuResult, c: CompatResult, model: string, characterName: string) {
  return ['compat', natalKey(a), natalKey(b), c.me.mbti ?? '-', c.partner.mbti ?? '-', c.me.label, c.partner.label, COMPAT_VERSION, COMPAT_PROMPT_VERSION, model, characterName].join('#');
}
