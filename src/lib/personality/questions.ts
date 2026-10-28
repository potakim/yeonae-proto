/**
 * 모두의 연애 — 자체 제작 성격유형 문항 (v1)
 *
 * 설계 원칙
 * - 4개 축 × 8문항 = 32문항, 5점 리커트.
 * - 축마다 왼쪽 성향(E·S·T·J) 4문항, 오른쪽 성향(I·N·F·P) 4문항으로 균형 배치
 *   → "그렇다"로 몰아 찍는 응답 편향(묵종 편향)이 한쪽 결과로 쏠리지 않도록.
 * - 성향별 4문항 중 2문항은 일상, 2문항은 연애 상황 문항.
 * - quick: true 문항만 모으면 축당 4문항(양쪽 2문항씩) = 16문항 빠른 버전.
 * - 모든 문항은 팀 자체 작성. 공식 MBTI® 문항이나 OEJTS(CC BY-NC-SA) 문항을 사용하지 않음.
 */

export type Axis = 'EI' | 'SN' | 'TF' | 'JP';
export type Pole = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';

export interface Question {
  id: string;
  axis: Axis;
  /** 이 문항에 "그렇다"고 답할수록 가까워지는 성향 */
  pole: Pole;
  text: string;
  context: 'daily' | 'love';
  quick: boolean;
}

export const AXIS_POLES: Record<Axis, [Pole, Pole]> = {
  EI: ['E', 'I'],
  SN: ['S', 'N'],
  TF: ['T', 'F'],
  JP: ['J', 'P'],
};

export const AXIS_LABEL: Record<Axis, string> = {
  EI: '에너지 방향',
  SN: '정보를 받아들이는 방식',
  TF: '결정하는 방식',
  JP: '생활 리듬',
};

export const POLE_LABEL: Record<Pole, string> = {
  E: '외향',
  I: '내향',
  S: '감각',
  N: '직관',
  T: '사고',
  F: '감정',
  J: '계획',
  P: '유연',
};

const Q: Question[] = [
  // ── EI ──────────────────────────────────────────
  { id: 'EI1', axis: 'EI', pole: 'E', context: 'daily', quick: true, text: '처음 보는 사람이 많은 자리에서도 먼저 말을 거는 편이다.' },
  { id: 'EI2', axis: 'EI', pole: 'E', context: 'daily', quick: false, text: '생각을 말로 꺼내면서 정리하는 편이다.' },
  { id: 'EI3', axis: 'EI', pole: 'E', context: 'love', quick: true, text: '썸 타는 상대와는 메시지보다 직접 만나서 이야기하는 게 편하다.' },
  { id: 'EI4', axis: 'EI', pole: 'E', context: 'love', quick: false, text: '연인과 함께 친구들 모임에 나가는 게 즐겁다.' },
  { id: 'EI5', axis: 'EI', pole: 'I', context: 'daily', quick: true, text: '사람들과 오래 어울리고 나면 혼자 충전하는 시간이 꼭 필요하다.' },
  { id: 'EI6', axis: 'EI', pole: 'I', context: 'daily', quick: false, text: '여럿이 대화할 때는 주로 듣는 쪽이다.' },
  { id: 'EI7', axis: 'EI', pole: 'I', context: 'love', quick: true, text: '데이트는 북적이는 곳보다 둘만 조용히 있을 수 있는 곳이 좋다.' },
  { id: 'EI8', axis: 'EI', pole: 'I', context: 'love', quick: false, text: '좋아하는 마음은 한참 생각하고 확신이 든 뒤에야 표현한다.' },

  // ── SN ──────────────────────────────────────────
  { id: 'SN1', axis: 'SN', pole: 'S', context: 'daily', quick: true, text: '설명을 들을 때 구체적인 예시나 숫자가 있어야 이해가 잘 된다.' },
  { id: 'SN2', axis: 'SN', pole: 'S', context: 'daily', quick: false, text: '새로운 방법보다 이미 검증된 방법을 따르는 게 마음이 편하다.' },
  { id: 'SN3', axis: 'SN', pole: 'S', context: 'love', quick: true, text: '상대가 했던 말이나 그날 입었던 옷 같은 구체적인 디테일을 잘 기억한다.' },
  { id: 'SN4', axis: 'SN', pole: 'S', context: 'love', quick: false, text: '"우리의 미래" 같은 이야기보다 이번 주말에 뭘 할지가 더 중요하다.' },
  { id: 'SN5', axis: 'SN', pole: 'N', context: 'daily', quick: true, text: '별일 없어도 "만약에 ~라면?" 같은 상상을 자주 한다.' },
  { id: 'SN6', axis: 'SN', pole: 'N', context: 'daily', quick: false, text: '사실 하나하나보다 전체 흐름이나 숨은 의미가 먼저 눈에 들어온다.' },
  { id: 'SN7', axis: 'SN', pole: 'N', context: 'love', quick: true, text: '마음에 드는 사람이 생기면 둘의 미래 장면을 자연스럽게 그려 보게 된다.' },
  { id: 'SN8', axis: 'SN', pole: 'N', context: 'love', quick: false, text: '연애에서는 서로의 가치관과 꿈이 통하는지가 무엇보다 중요하다.' },

  // ── TF ──────────────────────────────────────────
  { id: 'TF1', axis: 'TF', pole: 'T', context: 'daily', quick: true, text: '결정을 내릴 때 사람들의 기분보다 논리적으로 맞는지를 먼저 따진다.' },
  { id: 'TF2', axis: 'TF', pole: 'T', context: 'daily', quick: false, text: '친구가 고민을 털어놓으면 공감보다 해결책이 먼저 떠오른다.' },
  { id: 'TF3', axis: 'TF', pole: 'T', context: 'love', quick: true, text: '연인과 다툴 때 무엇이 맞는지 짚고 넘어가야 마음이 풀린다.' },
  { id: 'TF4', axis: 'TF', pole: 'T', context: 'love', quick: false, text: '연인에게도 고칠 점은 돌려 말하기보다 솔직하게 말하는 게 낫다고 생각한다.' },
  { id: 'TF5', axis: 'TF', pole: 'F', context: 'daily', quick: true, text: '맞는 말이라도 상대가 상처받을 것 같으면 표현을 고른다.' },
  { id: 'TF6', axis: 'TF', pole: 'F', context: 'daily', quick: false, text: '결정을 내릴 때 그 일로 영향을 받을 사람들의 마음이 신경 쓰인다.' },
  { id: 'TF7', axis: 'TF', pole: 'F', context: 'love', quick: true, text: '다툴 때는 누가 옳은지보다 서로 서운한 마음을 푸는 게 먼저다.' },
  { id: 'TF8', axis: 'TF', pole: 'F', context: 'love', quick: false, text: '연인이 힘들다고 하면 조언보다 일단 내 편이 되어 주고 싶다.' },

  // ── JP ──────────────────────────────────────────
  { id: 'JP1', axis: 'JP', pole: 'J', context: 'daily', quick: true, text: '할 일은 미리 끝내 놓아야 마음이 편하다.' },
  { id: 'JP2', axis: 'JP', pole: 'J', context: 'daily', quick: false, text: '여행을 가면 일정과 동선을 미리 짜 두는 편이다.' },
  { id: 'JP3', axis: 'JP', pole: 'J', context: 'love', quick: true, text: '데이트 약속이 갑자기 바뀌면 꽤 신경이 쓰인다.' },
  { id: 'JP4', axis: 'JP', pole: 'J', context: 'love', quick: false, text: '지금 관계가 썸인지 연애인지 분명하게 정해 두고 싶다.' },
  { id: 'JP5', axis: 'JP', pole: 'P', context: 'daily', quick: true, text: '계획을 세워도 그때그때 기분에 따라 바꾸는 일이 많다.' },
  { id: 'JP6', axis: 'JP', pole: 'P', context: 'daily', quick: false, text: '마감이 가까워져야 집중이 잘 된다.' },
  { id: 'JP7', axis: 'JP', pole: 'P', context: 'love', quick: true, text: '정해진 코스보다 그날 발길 닿는 대로 하는 데이트가 더 즐겁다.' },
  { id: 'JP8', axis: 'JP', pole: 'P', context: 'love', quick: false, text: '관계에 이름을 붙이기보다 흘러가는 대로 지켜보는 게 편하다.' },
];

export const QUESTIONS: readonly Question[] = Q;

/**
 * 출제 순서: 같은 축·같은 방향 문항이 연달아 나오지 않도록 축을 번갈아 섞은 고정 순서.
 * (무작위 셔플 대신 고정 순서 → 사용자 간 결과 비교와 디버깅이 쉬움)
 */
const ORDER = [
  'EI1', 'SN5', 'TF1', 'JP5',
  'EI7', 'SN3', 'TF7', 'JP3',
  'EI5', 'SN1', 'TF5', 'JP1',
  'EI3', 'SN7', 'TF3', 'JP7',
  'EI2', 'SN6', 'TF2', 'JP6',
  'EI8', 'SN4', 'TF8', 'JP4',
  'EI6', 'SN2', 'TF6', 'JP2',
  'EI4', 'SN8', 'TF4', 'JP8',
];

export type TestMode = 'full' | 'quick';

export function getQuestions(mode: TestMode): Question[] {
  const byId = new Map(Q.map((q) => [q.id, q]));
  const ordered = ORDER.map((id) => byId.get(id)!);
  return mode === 'quick' ? ordered.filter((q) => q.quick) : ordered;
}

export const LIKERT = [
  { value: 1, label: '전혀 아니다' },
  { value: 2, label: '아니다' },
  { value: 3, label: '보통이다' },
  { value: 4, label: '그렇다' },
  { value: 5, label: '매우 그렇다' },
] as const;
