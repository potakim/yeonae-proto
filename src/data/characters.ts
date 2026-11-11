// 화면설계서 v0.3 §10 캐릭터표 기준. 페르소나(프롬프트용)는 src/lib/ai/personas.ts.
// 이미지: 노션 페르소나 자료(실사형, AI 생성) — 출시 전 초상권·실존 인물 유사성 검토 대상.
import type { Screen } from '../App';
import { PERSONAS, genderOfHub, personaName, type PersonaId } from '../lib/ai/personas';

export type Category = 'counsel' | 'kakao' | 'trait' | 'saju' | 'intro';

export interface Character {
  id: string;
  name: string;
  /** 성별 허브: 남성 사용자는 기훈형, 여성 사용자는 고은언니가 기본(즐겨찾기 고정·목록 맨 위). 다른 쪽도 목록에는 보인다 */
  hubFor?: '형' | '언니';
  category: Category;
  roleLine: string; // 홈 목록 한 줄 소개 (1인칭)
  tagline: string; // 프로필 태그
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
    name: '기훈형',
    hubFor: '형',
    category: 'counsel',
    roleLine: '무슨 일인지 일단 얘기해봐',
    tagline: '종합 연애 상담 · 갈등 조율 · 34세 ESFJ',
    does: ['고민을 끝까지 들어 주고 상황을 정리해 줘요', '이기는 법보다 관계를 풀고 상대 감정을 다치지 않게 하는 쪽으로 조언해요', '필요하면 맞는 캐릭터를 소개해 줘요'],
    when: ['뭐부터 물어봐야 할지 모를 때', '싸우고 나서 어떻게 풀지 막막할 때'],
    pricing: '무료 · 하루 15턴',
    image: 'hub-m',
    emoji: '🧢',
    bg: 'var(--avatar-blue)',
    screen: 'chat',
    persona: 'hub-m',
  },
  {
    id: 'hub-f',
    name: '고은언니',
    hubFor: '언니',
    category: 'counsel',
    roleLine: '무슨 일인지 일단 얘기해봐',
    tagline: '종합 연애 상담 · 현실적 전략 · 30세 ISFJ',
    does: ['고민을 끝까지 들어 주고 상황을 정리해 줘요', '직설보다 우회적이고 전략적인 방법을 알려 줘요', '필요하면 맞는 캐릭터를 소개해 줘요'],
    when: ['뭐부터 물어봐야 할지 모를 때', '말은 하고 싶은데 싸우긴 싫을 때'],
    pricing: '무료 · 하루 15턴',
    image: 'hub-f',
    emoji: '🎀',
    bg: 'var(--avatar-pink)',
    screen: 'chat',
    persona: 'hub-f',
  },
  {
    id: 'soeun',
    name: '소은누나',
    category: 'counsel',
    roleLine: '여자 입장에서 솔직하게 볼게',
    tagline: '여자 심리 · 사실 기반 직언 · 25세 ENTP',
    does: ['여자 입장에서 상대의 말과 행동을 읽어 줘요', '네 해석과 실제 확인된 사실을 분리해서 짚어 줘요'],
    when: ['연락이 줄어든 것 같을 때', '그 사람 속마음이 궁금할 때'],
    pricing: '무료 하루 15턴 · 답장 분석 5크레딧',
    image: 'soeun',
    emoji: '💁‍♀️',
    bg: 'var(--avatar-pink)',
    screen: 'chat',
    persona: 'soeun',
  },
  {
    id: 'seonghyun',
    name: '성현이형',
    category: 'counsel',
    roleLine: '남자 입장에서 행동을 짚어줄게',
    tagline: '남자 심리 · 논리 기반 행동 코칭 · 27세 INTP',
    does: ['남자 입장에서 상대 행동의 의미를 풀어 줘요', '관계 유지보다 너한테 이익이 되는 쪽으로 사실대로 말해 줘요'],
    when: ['남자 마음을 모르겠을 때', '말보다 행동 조언이 필요할 때'],
    pricing: '무료 하루 15턴 · 행동 플랜 5크레딧',
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
    roleLine: '카톡 보여줘, 그 사람 마음 읽어줄게',
    tagline: '카톡 대화 분석 · 답장 추천 · 재회 가능성',
    does: ['카톡 캡처로 호감도·관계 단계를 분석해 줘요', '답장 문구를 추천하고 재회 가능성을 봐 줘요'],
    when: ['답장 어떻게 보낼지 고민될 때', '그 사람이 날 어떻게 생각하는지 알고 싶을 때'],
    pricing: '무료 요약 · 심층 리포트 30크레딧 · 답장 추천 5크레딧',
    emoji: '📸',
    bg: 'var(--avatar-peach)',
    paid: true,
    screen: 'kakao',
    placeholder: true,
  },
  {
    id: 'teacher',
    name: '선생님',
    category: 'trait',
    roleLine: '네 연애 성향부터 같이 들여다보자',
    tagline: '연애 성향 테스트 · 애착유형 · 이별 회복 단계',
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
    tagline: '기가 센 무당 · 개인 사주 · 연애운 · 궁합',
    does: ['만세력으로 원국을 계산하고 연애 흐름을 풀어 줘요', '오늘·이번 주·올해 연애운을 봐 줘요', '그 사람 생일로 두 사람 궁합을 봐 줘요'],
    when: ['요즘 연애가 왜 안 풀리는지 궁금할 때', '자꾸 싸울 때, 썸이 될지 궁금할 때', '재회를 고민할 때'],
    pricing: '오늘의 운세 무료 · 원국 풀이·올해 운세·궁합 리포트 크레딧',
    image: 'saju-master',
    emoji: '🔮',
    bg: 'var(--avatar-violet)',
    paid: true,
    screen: 'saju',
    persona: 'seohwa', // 대화방 통합 시 사용 (현재는 폼 화면)
    extra: [{ label: '궁합 보기', screen: 'compat' }],
  },
  {
    id: 'tarot',
    name: '타로마스터',
    category: 'saju',
    roleLine: '질문 하나, 카드 한 장. 뽑아볼까?',
    tagline: '연애 타로 · 오늘의 한 장 (임시명)',
    does: ['질문을 말하면 카드 한 장을 뽑아 연애 상황에 맞게 풀어 줘요', '재미로 보는 결과예요'],
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
    tagline: '소개팅 준비 · 프로필 문구 · 애프터 코칭',
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

/** 이 사용자에게 보이는 캐릭터. 네 상담 캐릭터는 남녀 모두에게 보이고(노션: 아는형/오빠, 아는언니/누나), 성별 허브가 맨 위 */
export function visibleFor(hub: '형' | '언니', introOn: boolean): Character[] {
  const list = CHARACTERS.filter((c) => !c.flag || (c.flag === 'intro_tab' && introOn));
  return [...list.filter((c) => c.hubFor === hub), ...list.filter((c) => c.hubFor !== hub)];
}

export function hubOf(hub: '형' | '언니'): Character {
  return CHARACTERS.find((c) => c.hubFor === hub)!;
}

/** 사용자 성별에 따른 호칭: 기훈형/기훈오빠, 고은언니/고은누나, 성현이형/성현오빠, 소은누나/소은언니, 지현누나/지현언니 */
export function nameOf(c: Character, hub: '형' | '언니'): string {
  return c.persona ? personaName(PERSONAS[c.persona], genderOfHub(hub)) : c.name;
}

export function byId(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

export const avatarUrl = (c: Character) => (c.image ? `/characters/${c.image}-avatar.webp` : null);
export const heroUrl = (c: Character) => (c.image ? `/characters/${c.image}-hero.webp` : null);
