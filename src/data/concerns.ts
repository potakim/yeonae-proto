/**
 * 사용자가 고르는 고민 — 대화 주제 추천 (7차 리뷰 2026-11-25, 노션 "고민 리스트" 표 그대로).
 * 고르면 그 문장이 첫 메시지로 전송된다.
 */
export interface ConcernTopic {
  topic: string;
  items: string[];
}

export const CONCERN_TOPICS: ConcernTopic[] = [
  { topic: '연락·카톡', items: ['연락이 뜸해졌어요', '답장이 고민돼요', '늘 저만 먼저 연락해요', '먼저 연락해도 될까요?'] },
  { topic: '썸·짝사랑', items: ['저한테도 관심이 있을까요?', '우리 무슨 사이인지 모르겠어요', '둘이 만나자고 하고 싶어요', '고백할까 말까 고민돼요'] },
  { topic: '소개팅·새로운 만남', items: ['소개팅에서 무슨 얘기를 할까요?', '한 번 더 만나자고 하고 싶어요', '기분 상하지 않게 거절하고 싶어요'] },
  { topic: '연애 중 느끼는 변화', items: ['요즘 저만 애쓰는 것 같아요', '만나도 예전처럼 즐겁지 않아요', '앞으로의 계획이 서로 달라요'] },
  { topic: '다툼·서운함', items: ['서운한 걸 어떻게 말할까요?', '같은 문제로 자꾸 싸워요', '제가 먼저 사과하고 싶어요'] },
  { topic: '이별·재회', items: ['계속 만나는 게 맞을까요?', '헤어진 사람에게 연락하고 싶어요', '다시 만나자는 말에 마음이 흔들려요', '헤어진 뒤 자꾸 생각나요'] },
  { topic: '내 마음 정리', items: ['제가 뭘 원하는지 모르겠어요', '연애할 때마다 불안해져요', '그냥 털어놓고 싶어요'] },
];

export const ALL_CONCERNS: string[] = CONCERN_TOPICS.flatMap((t) => t.items);
/** 첫 방문 때 홈에 보여 주는 고민 (노션 예시 화면) */
export const FIRST_VISIT_CONCERNS = ['연락이 뜸해졌어요', '답장이 고민돼요', '그냥 털어놓고 싶어요'];

/** 홈 "오늘의 고민" 3개 — 첫 방문이면 정해진 3개, 그 뒤로는 날짜에 따라 주제가 겹치지 않게 돌아가며 고른다 */
export function todaysConcerns(firstVisit: boolean, day: number): string[] {
  if (firstVisit) return FIRST_VISIT_CONCERNS;
  const n = CONCERN_TOPICS.length;
  return [0, 1, 2].map((k) => {
    const t = CONCERN_TOPICS[(((day + k * 2) % n) + n) % n];
    return t.items[(((day + k) % t.items.length) + t.items.length) % t.items.length];
  });
}
