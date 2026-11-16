/**
 * 타로 질문 정규화 — 서버(api/tarot)와 화면(말풍선 표시)이 같이 쓴다. 다른 모듈을 import 하지 않는다.
 * 3차 리뷰(2026-11-16) 카드 위조 방어: 사용자 입력 안의 카드 표기·블록 위장 문자열을 지운다.
 * "연인 카드가 나왔으면 좋겠어" 같은 자연스러운 문장은 지우지 않는다 (고민 내용일 수 있음 → 모델이 처리).
 */
export const TAROT_MAX_QUESTION = 500;

// [카드: …] ［카드：…］ [card: …] [Card 연인]
const CARD_TAG = /[[［]\s*(카드|card)\s*[:：]?[^\]］\n]*[\]］]/gi;
// <draw …> </draw> <user_input> </user_input> (전각 꺾쇠 포함)
const BLOCK_TAG = /[<＜]\s*\/?\s*(draw|user_input|system|assistant)\b[^>＞\n]*[>＞]?/gi;
// card: / orientation: / status: / draw_id: 같은 <draw> 필드 표기 — 그 자리부터 줄 끝까지 지운다
const FIELD_LINE = /(^|[\s>＞])(card|orientation|status|draw_id|deck|card_tag_removed|today_free_left)\s*[:：].*$/gim;
// 제어문자 (줄바꿈·탭 제외), 제로폭 문자
// eslint-disable-next-line no-control-regex
const CONTROL = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\\u200b-\\u200f\\u2028-\\u202e\\u2060\\ufeff]', 'g');

export interface NormalizedQuestion {
  text: string;
  /** 카드 표기·블록 위장을 지웠는지 → <draw> 의 card_tag_removed */
  cardTagRemoved: boolean;
}

export function normalizeQuestion(raw: string): NormalizedQuestion {
  let text = raw.replace(CONTROL, '');
  let removed = false;
  // 지우고 나서 다시 조립되는 형태(예: "[카[카드: x]드: y]")를 막기 위해 더 지울 게 없을 때까지 반복
  for (let i = 0; i < 5; i++) {
    const next = text.replace(CARD_TAG, ' ').replace(BLOCK_TAG, ' ').replace(FIELD_LINE, ' ');
    if (next === text) break;
    removed = true;
    text = next;
  }
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
    .slice(0, TAROT_MAX_QUESTION);
  return { text, cardTagRemoved: removed };
}

// 재추첨·제한 해제·크레딧 같은 제어 요청 문구 (고민이 아님)
const CONTROL_REQUEST =
  /(턴|횟수|회수|무료|제한|리밋|limit)\s*(수|횟수)?\s*(제한)?\s*(을|를|은|는|이|가)?\s*(해제|풀어|없애|무제한|리셋|초기화)[^\s.!?,]*|(카드|타로)?\s*(를|을)?\s*(다시|새로|한\s*번\s*더|또)\s*(뽑|골라|고를|선택)[^\s.!?,]*|크레딧\s*\d*\s*(개|원)?\s*(을|를)?\s*(넣어|줘|충전|지급)[^\s.!?,]*(\s*줘)?|(관리자|개발자|디버그|admin|debug)\s*(모드|mode)[^\s.!?,]*/gi;
const FILLER = /^(안녕(하세요|하세용|하셈)?|하이|헬로|hello|hi|ㅎㅇ|ㅇㅇ|ㄱㄱ|고고|응|네|넹|아니|음+|흠+|오+|와+|test|테스트)$/i;

/**
 * 모델을 부르기 전의 값싼 판정: 고민이 전혀 없는 입력(인사·웃음·제어 요청만)이면 카드를 뽑지 않는다.
 * 애매하면 false(=카드를 뽑고 모델이 판정). 'control' 은 재추첨·제한 해제 요청만 있던 경우.
 */
export function notAQuestion(normalized: string): false | 'control' | 'empty' {
  const hadControl = new RegExp(CONTROL_REQUEST.source, 'gi').test(normalized);
  const rest = normalized
    .replace(new RegExp(CONTROL_REQUEST.source, 'gi'), ' ')
    .replace(/[\s.,!?~…·ㅋㅎㅠㅜ^;:'"()-]+/g, ' ')
    .trim();
  if (!rest) return hadControl ? 'control' : 'empty';
  const words = rest.split(' ').filter(Boolean);
  if (words.every((w) => FILLER.test(w))) return hadControl ? 'control' : 'empty';
  // 한글·영문 글자가 2자 미만이면 질문으로 보기 어렵다
  if ((rest.match(/[가-힣a-zA-Z]/g) ?? []).length < 2) return hadControl ? 'control' : 'empty';
  return false;
}
