/**
 * 허브 채팅 (아는 형/언니) — 안전 장치 + 프롬프트 + 소개 카드.
 *
 * 안전 원칙 (기획설계서 5.2): 위기·피해 정황은 LLM 자유 생성에 맡기지 않고 고정 응답.
 *  1) 입력 규칙 검사(정규식)로 먼저 걸러 고정 응답 → LLM 호출 안 함
 *  2) LLM 이 스스로 분류한 category 가 위험이면 답을 고정 응답으로 교체
 */
export const CHAT_PROMPT_VERSION = 'chat-2026-10-28.1';
export type Hub = '형' | '언니';

export const CARDS = ['none', 'kakao', 'compat', 'fortune', 'personality'] as const;
export type Card = (typeof CARDS)[number];
export const CARD_INFO: Record<Exclude<Card, 'none'>, { who: string; title: string; desc: string }> = {
  kakao: { who: '💬 여사친', title: '카톡 분석', desc: '카톡 캡처로 상대 호감도·관계 단계를 읽고 답장도 추천해 줘요' },
  compat: { who: '🔮 모두 무당', title: '사주×MBTI 궁합', desc: '그 사람 생일만 알면 두 사람 기운을 맞춰 봐요' },
  fortune: { who: '🔮 모두 무당', title: '연애운', desc: '오늘·이번 주·올해 연애 흐름을 봐요' },
  personality: { who: '🧠 아는 형/언니', title: '연애 성향 테스트', desc: '32문항으로 내 연애 스타일을 알아봐요' },
};

export const CATEGORIES = ['normal', 'crisis', 'violence_victim', 'harmful_request', 'sexual'] as const;
export type Category = (typeof CATEGORIES)[number];

const CRISIS = /(자살|죽고\s*싶|죽어\s*버리|죽을\s*래|자해|손목\s*(을|그|긋)|목\s*매|뛰어\s*내리|살기\s*싫|사라지고\s*싶|극단적\s*(인\s*)?선택|유서|수면제\s*(를|을)?\s*(모아|많이))/;
const VICTIM = /(때렸|때려|맞았|폭행|협박|스토킹|따라\s*다녀|감금|강제로|불법\s*촬영|몰카|리벤지|영상\s*(을\s*)?(뿌린|유포))/;
const HARMFUL = /(위치\s*추적|몰래\s*(보|확인|깔|설치|녹음)|(폰|휴대폰|핸드폰)\s*(비번|비밀번호)|카톡\s*(몰래|훔쳐)|계정\s*(해킹|몰래)|미행|뒷조사|흥신소)/;

export function precheck(text: string): Category | null {
  if (CRISIS.test(text)) return 'crisis';
  if (VICTIM.test(text)) return 'violence_victim';
  if (HARMFUL.test(text)) return 'harmful_request';
  return null;
}

/** 고정 안전 응답 — 캐릭터 톤을 멈추고 공감 + 도움 안내 + 대화는 이어 간다 */
export const SAFE_REPLY: Record<Exclude<Category, 'normal'>, string> = {
  crisis:
    '지금 많이 힘든 마음이 느껴져요. 이 얘기를 꺼내 줘서 고마워요. 혼자 버티지 않았으면 좋겠어요. 지금 바로 이야기 나눌 수 있는 곳이 있어요.\n· 자살예방상담전화 109 (24시간)\n· 정신건강위기상담 1577-0199\n· 위험이 급하면 112 또는 119\n괜찮다면 여기서도 지금 어떤 마음인지 조금 더 들려줄래요? 천천히 들을게요.',
  violence_victim:
    '그런 일을 겪었다면 정말 무섭고 힘들었겠어요. 당신 잘못이 아니에요. 혼자 감당하지 말고 도움을 받을 수 있는 곳에 꼭 알렸으면 해요.\n· 여성긴급전화 1366 (24시간, 남성도 상담 가능)\n· 지금 위험하면 112\n· 디지털 성범죄 피해는 디지털성범죄피해자지원센터 02-735-8994\n지금은 안전한 곳에 있어요? 괜찮다면 상황을 조금 더 얘기해 줘요.',
  harmful_request:
    '그 마음이 얼마나 답답한지는 알 것 같아요. 그래도 상대 몰래 위치나 폰, 계정을 확인하는 건 도와줄 수 없어요. 관계를 더 망가뜨리고 법적으로도 문제가 될 수 있거든요. 대신 지금 제일 불안한 게 뭔지, 상대에게 어떻게 솔직하게 물어볼지 같이 정리해 볼까요?',
  sexual:
    '그 얘기는 여기서 자세히 다루기 어려워요. 연애 고민이나 관계 이야기라면 언제든 같이 고민할게요. 지금 제일 마음 쓰이는 게 뭐예요?',
};

export function chatSystem(hub: Hub, profile: { type?: string | null; dayPillar?: string | null }): string {
  const p = [profile.type ? `성격유형 ${profile.type}` : null, profile.dayPillar ? `${profile.dayPillar} 일주` : null].filter(Boolean).join(', ');
  return `너는 연애 상담 앱 '모두의 연애'의 허브 캐릭터 "아는 ${hub}"야. 연애 고민을 편하게 털어놓는 상대. 솔직하고 직설적이지만 따뜻해.
말투: 친근한 해요체("~해요", "~거든요")가 기본, 가끔 짧은 반말 감탄("에이~", "야 그건 좀")만 섞어. 비속어·과한 유행어 금지.
${p ? `사용자 정보(참고만, 매번 언급하지 마): ${p}` : ''}

## 대화 방식
- 한 번에 2~4문장. 먼저 공감하고, 상황을 파악하는 질문은 한 번에 하나만.
- 처음 3~5턴은 상황(썸/연애중/이별/솔로, 무엇이 고민인지)을 파악해.
- 상황이 충분히 보이면 card 로 전문 캐릭터를 소개해. 맞는 게 없으면 none.
  · kakao: 카톡·연락 패턴, 상대 마음이 궁금할 때 → 여사친
  · compat: 그 사람과 잘 맞는지, 궁합이 궁금할 때 → 무당
  · fortune: 언제 인연이 오는지, 연애운·시기가 궁금할 때 → 무당
  · personality: 내 연애 스타일·반복되는 패턴이 궁금할 때 → 성격 테스트
- 같은 카드를 연달아 권하지 마. 소개할 땐 reply 에 자연스럽게 한 문장으로 연결해.

## 안전
- category 를 정직하게 분류해: 자살·자해 암시 crisis, 폭력·협박·스토킹 피해 violence_victim, 상대 감시·몰래 확인·조종 요청 harmful_request, 성적인 요청 sexual, 그 외 normal.
- normal 이 아니면 reply 는 짧게 공감만 써(서버가 안전 안내로 바꿔 보여 줘).
- 진단·치료 권유처럼 들리는 말, 상대 비하, 집착·조종·떠보기 조언은 하지 마.
- 마크다운 기호 쓰지 마.`;
}

export const chatSchema = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: [...CATEGORIES] },
    reply: { type: 'string', description: '사용자에게 보낼 답 (2~4문장, 250자 이내)' },
    card: { type: 'string', enum: [...CARDS], description: '지금 소개할 전문 캐릭터, 없으면 none' },
  },
  required: ['category', 'reply', 'card'],
  additionalProperties: false,
};

export const MAX_TURNS = 20;
export const MAX_CHARS = 500;
