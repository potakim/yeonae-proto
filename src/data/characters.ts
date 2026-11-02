// 화면설계서 v0.2 §10 캐릭터 확정표 기준.
// 일러스트가 준비되기 전까지 avatar 는 이모지 + 파스텔 배경으로 대체한다.
import type { Screen } from '../App';

export type Category = 'counsel' | 'kakao' | 'trait' | 'saju' | 'intro';

export interface Character {
  id: string;
  /** 사용자 성별에 따라 이름이 갈리는 캐릭터(모두의 형/언니)는 함수로 */
  name: string | ((hub: '형' | '언니') => string);
  category: Category;
  roleLine: string; // 홈 목록의 한 줄 소개 (캐릭터 1인칭)
  tagline: string; // 프로필 화면 태그
  does: string[]; // 이 캐릭터가 해주는 것
  when: string[]; // 추천 상황
  pricing: string; // 이용 가격 / 무료 범위
  emoji: string;
  bg: string; // avatar.bg.* 토큰
  paid?: boolean;
  isNew?: boolean;
  /** 프로토타입에서 연결되는 기존 화면 */
  screen: Screen | null;
  /** 소개 캐릭터는 intro_tab 플래그가 꺼져 있으면 어디에도 노출되지 않는다 */
  flag?: 'intro_tab';
}

export const SECTIONS: { key: Category; icon: string; title: string; flag?: 'intro_tab' }[] = [
  { key: 'counsel', icon: '💬', title: '연애 상담' },
  { key: 'kakao', icon: '📱', title: '카톡 분석' },
  { key: 'trait', icon: '🧩', title: '성향 테스트' },
  { key: 'saju', icon: '☯️', title: '사주 · 궁합' },
  { key: 'intro', icon: '👥', title: '소개', flag: 'intro_tab' },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  counsel: '연애 상담 캐릭터',
  kakao: '카톡 분석 캐릭터',
  trait: '성향 테스트 캐릭터',
  saju: '사주 · 궁합 캐릭터',
  intro: '소개 캐릭터',
};

export const CHARACTERS: Character[] = [
  {
    id: 'hub',
    name: (hub) => `모두의 ${hub}`,
    category: 'counsel',
    roleLine: '무슨 일인지 일단 얘기해봐',
    tagline: '종합 연애 상담, 고민 정리, 전문가 연결',
    does: ['고민을 끝까지 들어 주고 상황을 정리해 줘요', '필요하면 맞는 캐릭터를 소개해 줘요'],
    when: ['뭐부터 물어봐야 할지 모를 때', '그냥 털어놓고 싶을 때'],
    pricing: '무료 · 하루 15턴',
    emoji: '🧢',
    bg: 'var(--avatar-blue)',
    screen: 'chat',
  },
  {
    id: 'soeun',
    name: '소은누나',
    category: 'counsel',
    roleLine: '여자 입장에서 솔직하게 볼게',
    tagline: '상대 심리, 연락 문제, 썸/연애 고민 상담',
    does: ['여자 입장에서 상대의 말과 행동을 읽어 줘요', '답장·연락 타이밍을 솔직하게 짚어 줘요'],
    when: ['연락이 줄어든 것 같을 때', '그 사람 속마음이 궁금할 때'],
    pricing: '무료 하루 15턴 · 답장 분석 5크레딧',
    emoji: '💁‍♀️',
    bg: 'var(--avatar-pink)',
    screen: 'chat',
  },
  {
    id: 'seonghyun',
    name: '성현이형',
    category: 'counsel',
    roleLine: '남자 입장에서 행동을 짚어줄게',
    tagline: '남자 심리, 행동 코칭, 관계 전략',
    does: ['남자 입장에서 상대 행동의 의미를 풀어 줘요', '다음에 뭘 하면 좋을지 행동으로 알려 줘요'],
    when: ['남자 마음을 모르겠을 때', '말보다 행동 조언이 필요할 때'],
    pricing: '무료 하루 15턴 · 행동 플랜 5크레딧',
    emoji: '🤔',
    bg: 'var(--avatar-mint)',
    screen: 'chat',
  },
  {
    id: 'yeosachin',
    name: '여사친',
    category: 'kakao',
    roleLine: '카톡 보여줘, 그 사람 마음 읽어줄게',
    tagline: '카톡 대화 분석, 답장 추천, 재회 가능성',
    does: ['카톡 캡처로 호감도·관계 단계를 분석해 줘요', '답장 문구를 추천하고 재회 가능성을 봐 줘요'],
    when: ['답장 어떻게 보낼지 고민될 때', '그 사람이 날 어떻게 생각하는지 알고 싶을 때'],
    pricing: '무료 요약 · 심층 리포트 30크레딧 · 답장 추천 5크레딧',
    emoji: '📸',
    bg: 'var(--avatar-peach)',
    paid: true,
    screen: 'kakao',
  },
  {
    id: 'teacher',
    name: '선생님',
    category: 'trait',
    roleLine: '네 연애 성향부터 같이 들여다보자',
    tagline: '연애 성향 테스트, 애착유형, 이별 회복 단계',
    does: ['자체 제작 문항으로 연애 성향을 알아봐요', '결과를 연애 상황에 맞춰 해석해 줘요'],
    when: ['나는 왜 매번 이럴까 싶을 때', '내 연애 패턴을 알고 싶을 때'],
    pricing: '문항·채점 무료 · 해석 15크레딧',
    emoji: '📝',
    bg: 'var(--avatar-yellow)',
    screen: 'personality',
  },
  {
    id: 'saju-master',
    name: '사주마스터',
    category: 'saju',
    roleLine: '사주와 연애 흐름을 풀어볼게',
    tagline: '개인 사주, 연애운, 올해의 흐름',
    does: ['만세력으로 원국을 계산하고 연애 흐름을 풀어 줘요', '오늘·이번 주·올해 연애운을 봐 줘요'],
    when: ['요즘 연애가 왜 안 풀리는지 궁금할 때', '시기를 알고 싶을 때'],
    pricing: '오늘의 운세 무료 · 원국 풀이·올해 운세 크레딧',
    emoji: '🔮',
    bg: 'var(--avatar-violet)',
    paid: true,
    screen: 'saju',
  },
  {
    id: 'compat-master',
    name: '궁합도사',
    category: 'saju',
    roleLine: '둘이 왜 자꾸 어긋나는지 볼까?',
    tagline: '연인 / 썸 / 전 연인 궁합',
    does: ['두 사람의 사주와 성향으로 궁합을 봐 줘요', '어디서 어긋나는지, 어떻게 맞추는지 알려 줘요'],
    when: ['자꾸 싸울 때', '썸이 될지 궁금할 때', '재회를 고민할 때'],
    pricing: '무료 요약 · 궁합 리포트 30크레딧',
    emoji: '🃏',
    bg: 'var(--avatar-violet)',
    paid: true,
    screen: 'compat',
  },
  {
    id: 'intro-coach',
    name: '소개팅 코치',
    category: 'intro',
    roleLine: '소개 전후, 뭘 준비하면 될지 알려줄게',
    tagline: '소개팅 준비, 프로필 문구, 애프터 코칭',
    does: ['프로필 사진·자기소개 문구를 봐 줘요', '소개 전후 대화를 코칭해 줘요'],
    when: ['소개팅을 앞두고 있을 때'],
    pricing: '코칭 10크레딧',
    emoji: '🎯',
    bg: 'var(--avatar-lavender)',
    isNew: true,
    screen: null,
    flag: 'intro_tab',
  },
  {
    id: 'intro-bro',
    name: '소개해주는 형',
    category: 'intro',
    roleLine: '이제 새로운 사람을 만나볼래?',
    tagline: '내 성향에 맞는 실제 사람 추천',
    does: ['상담 데이터 요약을 바탕으로 맞는 사람을 소개해 줘요'],
    when: ['새로운 만남을 시작하고 싶을 때'],
    pricing: '추후 안내',
    emoji: '👍',
    bg: 'var(--avatar-lavender)',
    isNew: true,
    screen: null,
    flag: 'intro_tab',
  },
];

export function nameOf(c: Character, hub: '형' | '언니'): string {
  return typeof c.name === 'function' ? c.name(hub) : c.name;
}

export function byId(id: string): Character | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
