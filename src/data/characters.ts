// 화면설계서 v0.3 §10 캐릭터표 + 노션 캐릭터 페이지 2026-11-19 개정 기준. 페르소나(프롬프트용)는 src/lib/ai/personas.ts.
// 상담 캐릭터는 실명으로 표시한다 (고정 나이 없음, 형·오빠·언니·누나 호칭은 사용자가 부를 때만).
// 이미지: 노션 페르소나 자료(실사형, AI 생성) — 출시 전 초상권·실존 인물 유사성 검토 대상.
import type { Screen } from '../App';
import { PERSONAS, genderOfHub, personaName, type PersonaId } from '../lib/ai/personas';

export type Category = 'counsel' | 'kakao' | 'trait' | 'saju' | 'intro';

export interface Character {
  id: string;
  name: string;
  /** 성별 허브: 남성 사용자는 최기훈, 여성 사용자는 이고은이 기본(즐겨찾기 고정·목록 맨 위). 다른 쪽도 목록에는 보인다 */
  hubFor?: '형' | '언니';
  category: Category;
  roleLine: string; // 홈 목록 한 줄 소개 (1인칭)
  tagline: string; // 프로필 태그
  /** 프로필에 작게 따로 보여 주는 MBTI (한 줄 소개에서 분리 — 7차 리뷰) */
  mbti?: string;
  does: string[];
  when: string[];
  pricing: string;
  /** 실사 이미지 (public/characters/<id>-avatar.webp, -hero.webp). 없으면 이모지 */
  image?: string;
  emoji: string;
  bg: string;
  paid?: boolean;
  isNew?: boolean;
  /** 대화 시작 시 가는 화면 */
  screen: Screen | null;
  /** 채팅 엔진을 쓸 때 적용할 페르소나 */
  persona?: PersonaId;
  /** 프로필에서 추가로 열 수 있는 기능 (예: 서화 → 궁합) */
  extra?: { label: string; screen: Screen }[];
  /** 소개 캐릭터는 intro_tab 플래그가 꺼져 있으면 어디에도 노출되지 않는다 */
  flag?: 'intro_tab';
  /** 페르소나·이미지 미정 */
  placeholder?: boolean;
}

export const SECTIONS: { key: Category; icon: string; title: string; flag?: 'intro_tab' }[] = [
  { key: 'counsel', icon: '💬', title: '연애 상담' },
  { key: 'kakao', icon: '📱', title: '카톡 분석' },
  { key: 'trait', icon: '🧩', title: '성향 테스트' },
  { key: 'saju', icon: '☯️', title: '사주 · 궁합 · 타로' },
  { key: 'intro', icon: '👥', title: '소개', flag: 'intro_tab' },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  counsel: '연애 상담 캐릭터',
  kakao: '카톡 분석 캐릭터',
  trait: '성향 테스트 캐릭터',
  saju: '사주 · 궁합 · 타로 캐릭터',
  intro: '소개 캐릭터',
};

export const CHARACTERS: Character[] = [
  {
    id: 'hub-m',
    name: '최기훈',
    hubFor: '형',
    category: 'counsel',
    roleLine: '표정이 안 좋아 보이는데, 무슨 일 있어?',
    tagline: '결혼한 선배 형, 싸운 뒤 푸는 법을 같이 고민해요',
    mbti: 'ESFJ',
    does: ['고민을 끝까지 듣고 상황부터 같이 정리해요', '누가 이기느냐보다 싸움을 어떻게 끝낼지 같이 고민해요', '다른 캐릭터가 더 맞는 고민이면 연결해요'],
    when: ['뭐부터 물어봐야 할지 모를 때', '싸우고 나서 어떻게 풀지 막막할 때'],
    pricing: '하루 15번 대화 무료',
    image: 'hub-m',
    emoji: '🧢',
    bg: 'var(--avatar-blue)',
    screen: 'chat',
    persona: 'hub-m',
  },
  {
    id: 'hub-f',
    name: '이고은',
    hubFor: '언니',
    category: 'counsel',
    roleLine: '얘기가 좀 뒤죽박죽이어도 괜찮아. 천천히 들려줘',
    tagline: '결혼 준비 중인 선배 언니, 싸우지 않고 할 말 하는 법을 알려 줘요',
    mbti: 'ISFJ',
    does: ['내 편에서 이야기를 끝까지 들어요', '정면으로 부딪히지 않고 원하는 걸 얻는 말을 같이 찾아요', '연애 말고 직장이나 사람 관계 고민도 괜찮아요'],
    when: ['뭐부터 물어봐야 할지 모를 때', '말은 하고 싶은데 싸우긴 싫을 때'],
    pricing: '하루 15번 대화 무료',
    image: 'hub-f',
    emoji: '🎀',
    bg: 'var(--avatar-pink)',
    screen: 'chat',
    persona: 'hub-f',
  },
  {
    id: 'soeun',
    name: '박소은',
    category: 'counsel',
    roleLine: '잠깐만요, 그 전에는 어땠는데요?',
    tagline: '연하 동생, 되물어 가며 상황을 같이 짚어 봐요',
    mbti: 'ENTP',
    does: ['빠른 리액션과 질문으로 상황을 같이 정리해요', '내 느낌과 실제로 있었던 일을 나눠서 봐요', '무조건 편들지 않고 지금 할 수 있는 행동을 짚어 줘요'],
    when: ['내가 예민한 건지 헷갈릴 때', '상황을 객관적으로 보고 싶을 때'],
    pricing: '하루 15번 대화 무료',
    image: 'soeun',
    emoji: '💁‍♀️',
    bg: 'var(--avatar-pink)',
    screen: 'chat',
    persona: 'soeun',
  },
  {
    id: 'seonghyun',
    name: '이성현',
    category: 'counsel',
    roleLine: '무슨 일 있어요?',
    tagline: '연하 남동생, 남자 입장에서 솔직하게 말해 줘요',
    mbti: 'INTP',
    does: ['남자 입장에서 그 행동이 어떤 뜻일 수 있는지 설명해요', '관계 유지보다 나한테 괜찮은 선택인지 같이 봐요', '연애 얘기가 아니어도 편하게 얘기해요'],
    when: ['남자 마음을 모르겠을 때', '이 관계가 나한테 괜찮은지 헷갈릴 때'],
    pricing: '하루 15번 대화 무료',
    image: 'seonghyun',
    emoji: '🤔',
    bg: 'var(--avatar-mint)',
    screen: 'chat',
    persona: 'seonghyun',
  },
  {
    id: 'yeosachin',
    name: '여사친',
    category: 'kakao',
    roleLine: '카톡 보여줘, 분위기 같이 봐 줄게',
    tagline: '카톡을 보고 호감도와 보낼 답장을 봐 줘요',
    does: ['카톡 캡처를 보고 호감도와 관계 단계를 짐작해요', '보낼 답장을 골라 주고, 재회 가능성도 같이 봐요'],
    when: ['답장 어떻게 보낼지 고민될 때', '그 사람이 날 어떻게 생각하는지 알고 싶을 때'],
    pricing: '무료 요약 · 심층 리포트 30크레딧 · 답장 추천 5크레딧',
    emoji: '📸',
    bg: 'var(--avatar-peach)',
    paid: true,
    screen: 'kakao',
    placeholder: true,
  },
  {
    // 노션 「탐정 캐릭터(카톡 대화 심층 분석)」 2026-11-23 — 이름·외형·말투·무료/유료 범위는 미정
    id: 'detective',
    name: '탐정',
    category: 'kakao',
    roleLine: '기록에 있는 것만 셀게. 숫자로 보여줄게',
    tagline: '카톡 기록으로 선톡과 답장 시간을 세어 봐요',
    does: ['누가 먼저 대화를 시작했는지, 답장까지 얼마나 걸렸는지 같은 기준으로 세어 비교해요', '기간을 나눠 대화량과 답장 시간이 어떻게 달라졌는지 보여 줘요', '숫자와 함께 집계 기준과 표본 수를 알려 주고, 속마음은 판정하지 않아요'],
    when: ['내가 늘 먼저 연락했나 궁금할 때', '요즘 대화가 줄었는지 기록으로 확인하고 싶을 때'],
    pricing: '추후 안내 · 대화 내용은 기기 안에서만 계산',
    emoji: '🕵️',
    bg: 'var(--avatar-mint)',
    isNew: true,
    screen: 'detective',
    placeholder: true,
  },
  {
    id: 'teacher',
    name: '선생님',
    category: 'trait',
    roleLine: '네 연애 성향부터 같이 들여다보자',
    tagline: '테스트로 연애 성향과 애착 유형을 알아봐요',
    does: ['자체 제작 문항으로 연애 성향을 알아봐요', '결과를 연애 상황에 맞춰 해석해 줘요'],
    when: ['나는 왜 매번 이럴까 싶을 때', '내 연애 패턴을 알고 싶을 때'],
    pricing: '문항·채점 무료 · 해석 15크레딧',
    emoji: '📝',
    bg: 'var(--avatar-yellow)',
    screen: 'personality',
    placeholder: true,
  },
  {
    id: 'saju-master',
    name: '서화',
    category: 'saju',
    roleLine: '됐고, 사주 보고 딱 말해 줄게',
    tagline: '거침없이 말하는 사주 풀이, 연애운과 궁합을 봐요',
    does: ['생년월일시로 사주를 계산해 연애운을 풀어요', '오늘, 이번 주, 올해 연애운을 볼 수 있어요', '그 사람 생일을 알면 궁합도 봐요'],
    when: ['요즘 연애가 왜 안 풀리는지 궁금할 때', '자꾸 싸울 때, 썸이 될지 궁금할 때', '재회를 고민할 때'],
    pricing: '오늘의 운세 무료 · 원국 풀이·올해 운세·궁합 리포트 크레딧',
    image: 'saju-master',
    emoji: '🔮',
    bg: 'var(--avatar-violet)',
    paid: true,
    screen: 'saju',
    persona: 'seohwa', // 사주 화면의 「서화와 채팅」 탭에서 사용
    extra: [{ label: '궁합 보기', screen: 'compat' }],
  },
  {
    id: 'tarot',
    name: '타로마스터',
    category: 'saju',
    roleLine: '질문 하나, 카드 한 장. 뽑아볼까?',
    tagline: '질문 하나에 카드 한 장, 연애 타로',
    does: ['질문을 말하면 카드 한 장을 뽑아 연애 상황에 맞게 풀어 줘요'],
    when: ['연락할까 말까 망설여질 때', '가볍게 오늘 흐름이 궁금할 때'],
    pricing: '하루 1장 무료 · 추가 뽑기 2크레딧',
    image: 'tarot',
    emoji: '🃏',
    bg: 'var(--avatar-violet)',
    isNew: true,
    screen: 'chat',
    persona: 'tarot',
  },
  {
    id: 'intro-coach',
    name: '소개팅 코치',
    category: 'intro',
    roleLine: '소개 전후, 뭘 준비하면 될지 알려줄게',
    tagline: '소개팅 준비부터 애프터까지',
    does: ['프로필 사진·자기소개 문구를 봐 줘요', '소개 전후 대화를 코칭해 줘요'],
    when: ['소개팅을 앞두고 있을 때'],
    pricing: '코칭 10크레딧',
    emoji: '🎯',
    bg: 'var(--avatar-lavender)',
    isNew: true,
    screen: null,
    flag: 'intro_tab',
    placeholder: true,
  },
  {
    id: 'jihyun',
    name: '지현누나',
    category: 'intro',
    roleLine: '너 지금 만나는 사람 없으면 소개 받아볼래?',
    tagline: '취향·성격 기반 실제 사람 추천 · 34세 ENTJ',
    does: ['네 취향·취미·성격을 파악해서 잘 맞는 사람을 찾아 줘요'],
    when: ['새로운 만남을 시작하고 싶을 때'],
    pricing: '추후 안내',
    image: 'jihyun',
    emoji: '👍',
    bg: 'var(--avatar-lavender)',
    isNew: true,
    screen: 'chat',
    persona: 'jihyun',
    flag: 'intro_tab',
  },
];

/** 이 사용자에게 보이는 캐릭터. 네 상담 캐릭터는 남녀 모두에게 보이고, 성별 허브가 맨 위 */
export function visibleFor(hub: '형' | '언니', introOn: boolean): Character[] {
  const list = CHARACTERS.filter((c) => !c.flag || (c.flag === 'intro_tab' && introOn));
  return [...list.filter((c) => c.hubFor === hub), ...list.filter((c) => c.hubFor !== hub)];
}

export function hubOf(hub: '형' | '언니'): Character {
  return CHARACTERS.find((c) => c.hubFor === hub)!;
}

/** 화면에 쓰는 이름. 상담 캐릭터는 실명(성별과 무관), 지현만 성별별 호칭이 남아 있다 */
export function nameOf(c: Character, hub: '형' | '언니'): string {
  return c.persona ? personaName(PERSONAS[c.persona], genderOfHub(hub)) : c.name;
}

export function byId(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

export const avatarUrl = (c: Character) => (c.image ? `/characters/${c.image}-avatar.webp` : null);
export const heroUrl = (c: Character) => (c.image ? `/characters/${c.image}-hero.webp` : null);
