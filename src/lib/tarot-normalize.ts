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

// 메이저 아르카나 22장 (TAROT_CARDS 와 같아야 한다 — tarot.test.ts 가 확인). 이 파일은 import 를 두지 않는다
const CARD_NAMES = ['바보', '마법사', '여사제', '여황제', '황제', '교황', '연인', '전차', '힘', '은둔자', '운명의 수레바퀴', '정의', '매달린 사람', '죽음', '절제', '악마', '탑', '별', '달', '태양', '심판', '세계'];
export const NORMALIZE_CARD_NAMES: readonly string[] = CARD_NAMES;
const JOSA = '(가|이|를|을|는|은|로|으로|랑|이랑|와|과|도|만|야|이야|요|이요|예요|이에요|임|입니다)?';
// 낱말 하나가 통째로 카드 이름·방향·"카드"인 경우만 지운다 ("힘들어요", "별로" 같은 일반 낱말은 그대로)
const CARD_WORD = new RegExp(`^(${CARD_NAMES.filter((n) => !n.includes(' ')).join('|')})(카드)?${JOSA}$`);
const CARD_PHRASE = new RegExp(`(${CARD_NAMES.filter((n) => n.includes(' ')).map((n) => n.replace(' ', '\\s*')).join('|')})(\\s*카드)?${JOSA}(?=\\s|$)`, 'g');
const ORIENT_WORD = new RegExp(`^((정|역|순|바른|거꾸로)\\s*(방향|위치)?|정위치|역위치|upright|reversed|(타로)?카드|타로|메이저|아르카나)${JOSA}$`, 'i');
// 카드를 지정하려는 말 ("나왔다고 치고 봐 줘", "~로 해 줘", "뽑아 줘")
const CARD_ASK = /^(나왔다고|나온|나왔어|나왔다|치고|쳐|뽑아|뽑은|뽑았어|뽑았다|골랐어|고른|고를게|선택|선택할게|줘|줘요|주세요|해|해줘|해석|해석해|봐|봐줘|봐요|보여|보여줘|원해|원해요|할래|할게|내|제|이번|이걸로|그걸로|걸로|으로|로)$/;

/**
 * 모델을 부르기 전의 값싼 판정: 고민이 전혀 없는 입력이면 카드를 뽑지 않는다 (카드 선택 화면도 띄우지 않는다).
 * - 'control': 재추첨·제한 해제 요청만
 * - 'card': 카드 이름·방향만 ("바보 순방향", "연인 카드 나왔다고 치고 봐 줘")
 * - 'empty': 인사·웃음·의미 없는 글자
 * 애매하면 false(=카드를 뽑고 모델이 판정).
 */
export function notAQuestion(normalized: string): false | 'control' | 'card' | 'empty' {
  const hadControl = new RegExp(CONTROL_REQUEST.source, 'gi').test(normalized);
  const rest = normalized
    .replace(new RegExp(CONTROL_REQUEST.source, 'gi'), ' ')
    .replace(/[\s.,!?~…·ㅋㅎㅠㅜ^;:'"()[\]-]+/g, ' ')
    .trim();
  const why = hadControl ? 'control' : 'empty';
  if (!rest) return why;
  const noPhrase = rest.replace(CARD_PHRASE, ' ').trim();
  const words = noPhrase.split(' ').filter(Boolean);
  if (words.every((w) => FILLER.test(w))) return why;
  // 카드 이름·방향을 뺀 나머지가 없거나 카드를 지정하는 말뿐이면, 고민 없이 카드만 말한 것
  const mentionsCard = noPhrase !== rest || words.some((w) => CARD_WORD.test(w) || ORIENT_WORD.test(w));
  if (mentionsCard && words.every((w) => CARD_WORD.test(w) || ORIENT_WORD.test(w) || CARD_ASK.test(w) || FILLER.test(w))) return hadControl ? 'control' : 'card';
  // 한글·영문 글자가 2자 미만이면 질문으로 보기 어렵다
  if ((rest.match(/[가-힣a-zA-Z]/g) ?? []).length < 2) return why;
  return false;
}
