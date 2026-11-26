// 화면설계서 v0.3 §10 캐릭터표 + 노션 캐릭터 페이지 2026-11-19 개정 기준. 페르소나(프롬프트용)는 src/lib/ai/personas.ts.
// 상담 캐릭터는 실명으로 표시한다 (고정 나이 없음, 형·오빠·언니·누나 호칭은 사용자가 부를 때만).
// 이미지: 노션 페르소나 자료(실사형, AI 생성) — 출시 전 초상권·실존 인물 유사성 검토 대상.
import type { Screen } from '../App';
import { PERSONAS, genderOfHub, personaName, type PersonaId } from '../lib/ai/personas';

export type Category = 'counsel' | 'kakao' | 'trait' | 'saju' | 'intro';

export interface ProfileAsk {
  icon: 'heart' | 'users' | 'refresh' | 'chat' | 'calendar' | 'send' | 'info' | 'message' | 'handshake' | 'heartHandshake';
  label: string;
  /** 대화의 첫 메시지로 보낼 문장 (없으면 label) */
  text?: string;
  /** 대화 대신 열 화면 (예: 궁합) */
  screen?: Screen;
}

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
  /** 프로필 키워드 칩 (7차 리뷰 프로필 레이아웃). 서화의 4개는 노션 지정, 나머지는 임시안 */
  chips?: string[];
  /** 프로필의 질문 줄 — 누르면 그 문장으로 대화를 시작하거나(text) 다른 화면으로 간다(screen) */
  asks?: ProfileAsk[];
  /** 상담 캐릭터 프로필 화면 (8차 리뷰 2026-11-26 「캐릭터 별 프로필 화면」) — 있으면 새 프로필 화면을 쓴다 */
  showcase?: {
    /** 부를 때 쓰는 이름 ("기훈은 이렇게 도와줘요", "기훈과 대화하기") */
    short: string;
    /** 사진 위 대화 예시 4개: 사용자 → 캐릭터 → 보낼 말(인용) → 캐릭터 */
    sample: { user: string; reply: string; quote: string; after: string };
    /** 안내 박스 */
    note: { title: string; body: string };
    /** 배경 사진(-cover.webp)의 크롭 기준점 (object-position) */
    photoPos: string;
  };
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
    tagline: '기혼 선배 · 싸움보다 해결을 보는 조언',
    mbti: 'ESFJ',
    does: ['감정은 받아주고, 사실과 추측은 나눠서 봐요', '실제로 보낼 말과 행동을 하나씩 제안해요', '한 번의 실수와 반복되는 패턴을 구분해요'],
    when: ['뭐부터 물어봐야 할지 모를 때', '싸우고 나서 어떻게 풀지 막막할 때'],
    chips: ['갈등 조율', '서운함', '장기 연애', '결혼한 선배'],
    asks: [
      { icon: 'message', label: '같은 문제로 자꾸 싸워요' },
      { icon: 'handshake', label: '서운한 걸 어떻게 말하죠?' },
      { icon: 'heartHandshake', label: '사과만 하고 달라지는 게 없어요' },
    ],
    showcase: {
      short: '기훈',
      sample: { user: '남자친구가 요즘 연락을 잘 안 해요.', reply: '서운했겠다. 근데 연락이 준 거랑 마음이 식은 건 달라요.', quote: '“요즘 연락이 줄어서 좀 멀어진 느낌이 들어.”', after: '이렇게 말해 보고, 그다음 반응을 같이 봐요.' },
      note: { title: '무료로 대화할 수 있어요', body: '대화 원문은 30일 뒤 자동으로 지워져요. AI 의견이며 전문 상담을 대신하지 않아요.' },
      photoPos: '50% 28%',
    },
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
    tagline: '결혼 준비 중인 선배 · 내 편에서 해결 방법',
    mbti: 'ISFJ',
    does: ['내 편에서 먼저 상황을 들어줘요', '정면으로 부딪히지 않는 대처법을 찾아요', '상대에게 보낼 문장을 같이 골라줘요'],
    when: ['뭐부터 물어봐야 할지 모를 때', '말은 하고 싶은데 싸우긴 싫을 때'],
    chips: ['할 말 하는 법', '현실 전략', '결혼 준비', '직장·사람 관계'],
    asks: [
      { icon: 'message', label: '나만 먼저 연락하는 것 같아요' },
      { icon: 'handshake', label: '싸우지 않고 마음을 전하고 싶어요' },
      { icon: 'heartHandshake', label: '결혼 이야기를 꺼내기 어려워요' },
    ],
    showcase: {
      short: '고은',
      sample: { user: '매번 제가 언제 볼지 물어보는 게 싫어요.', reply: '그쪽에서 먼저 날짜를 꺼내줬으면 했던 거구나. 이렇게 보내보는 건 어때?', quote: '“다음엔 네가 되는 날 먼저 알려줄 수 있어?”', after: '다음 약속은 먼저 잡아줬으면 좋겠다고 말해도 돼.' },
      note: { title: '대화 원문은 30일 뒤 자동으로 지워져요', body: 'AI 캐릭터의 의견이에요. 전문 상담이나 의료 진단을 대신하지 않아요.' },
      photoPos: '60% 35%',
    },
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
    tagline: '질문 많은 연하 동생 · 사실과 추측 구분',
    mbti: 'ENTP',
    does: ['판단을 바꿀 단서를 하나씩 물어봐요', '무조건 편들지 않고 솔직하게 말해요', '다음에 할 행동을 하나로 정리해줘요'],
    when: ['내가 예민한 건지 헷갈릴 때', '상황을 객관적으로 보고 싶을 때'],
    chips: ['썸', '연락', '사실 확인', '현실 점검'],
    asks: [
      { icon: 'message', label: '제가 잘못한 건가요?' },
      { icon: 'handshake', label: '상대 행동이 이해가 안 돼요' },
      { icon: 'heartHandshake', label: '썸인지 아닌지 헷갈려요' },
    ],
    showcase: {
      short: '소은',
      sample: { user: '면접 봤다고 했는데 어땠냐고 안 물어봐요.', reply: '아, 진짜 서운한 건 그거였네요. 돌려 말하지 말고 이렇게요.', quote: '“오늘 면접 어땠는지 먼저 물어봐 줬으면 했어.”', after: '왜 안 물어봤냐고 따지는 것보다 이게 더 잘 전해져요.' },
      note: { title: '대화 원문은 30일 뒤 자동으로 지워져요', body: 'AI 캐릭터의 의견이에요. 전문 상담이나 의료 진단을 대신하지 않아요.' },
      photoPos: '50% 40%',
    },
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
    tagline: '연하 남동생 · 남자 입장에서 본 현실 해석',
    mbti: 'INTP',
    does: ['남자 입장에서 상대 행동을 해석해줘요', '확인된 사실과 내 추측을 나눠서 봐요', '이 관계가 나에게 괜찮은지 같이 점검해요'],
    when: ['남자 마음을 모르겠을 때', '이 관계가 나한테 괜찮은지 헷갈릴 때'],
    chips: ['남자 입장', '썸', '재회', '현실 점검'],
    asks: [
      { icon: 'message', label: '연락이 줄었는데 마음이 식었을까요?' },
      { icon: 'handshake', label: '제가 너무 예민한 걸까요?' },
      { icon: 'heartHandshake', label: '이 관계, 이대로 괜찮을까요?' },
    ],
    showcase: {
      short: '성현',
      sample: { user: '전 애인한테 “잘 지내?”라고 왔어요.', reply: '다시 만날 마음이 없다면, 이 정도로 답해도 돼요.', quote: '“응, 잘 지내. 너도 잘 지냈으면 좋겠어.”', after: '끝에 “너는?”을 안 붙여도 반갑게 인사할 수 있어요.' },
      note: { title: '대화 원문은 30일 뒤 자동으로 지워져요', body: 'AI 캐릭터의 의견이에요. 전문 상담이나 의료 진단을 대신하지 않아요.' },
      photoPos: '50% 42%',
    },
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
    chips: ['카톡 분석', '호감도', '답장 추천', '재회'],
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
    chips: ['선톡', '답장 시간', '대화량', '기간별 변화'],
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
    chips: ['연애 성향', '애착 유형', '강점', '조심할 점'],
    pricing: '문항·채점 무료 · 해석 15크레딧',
    image: 'teacher', // 노션 선생님 페이지 사진 (2026-11-26)
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
    chips: ['사주', '궁합', '연애운', '인연'],
    asks: [
      { icon: 'heart', label: '요즘 내 연애운이 궁금해요' },
      { icon: 'users', label: '그 사람과 궁합을 보고 싶어요', screen: 'compat' },
      { icon: 'refresh', label: '재회해도 괜찮을지 궁금해요' },
    ],
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
    chips: ['연애 타로', '카드 한 장', '오늘의 질문'],
    asks: [
      { icon: 'heart', label: '그 사람도 저한테 관심이 있을까요?' },
      { icon: 'send', label: '제가 먼저 연락해도 될까요?' },
      { icon: 'refresh', label: '다시 만나도 괜찮을까요?' },
    ],
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
    chips: ['소개팅', '프로필', '애프터'],
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
    chips: ['소개', '취향 정리', '매칭'],
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

/** 프로필 화면 전용 사진 (8차 리뷰 「캐릭터 별 비주얼」): 배경 사진과 원형 프로필 사진. 목록의 작은 아바타는 기존 얼굴 사진을 그대로 쓴다 */
export const coverUrl = (c: Character) => (c.image && c.showcase ? `/characters/${c.image}-cover.webp` : null);
export const profilePhotoUrl = (c: Character) => (c.image && c.showcase ? `/characters/${c.image}-profile.webp` : null);
export const avatarUrl = (c: Character) => (c.image ? `/characters/${c.image}-avatar.webp` : null);
export const heroUrl = (c: Character) => (c.image ? `/characters/${c.image}-hero.webp` : null);
