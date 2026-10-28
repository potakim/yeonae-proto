/**
 * 허브 채팅 (아는 형/언니) — 안전 장치 + 프롬프트 + 소개 카드.
 *
 * 안전 원칙 (기획설계서 5.2): 위기·피해 정황은 LLM 자유 생성에 맡기지 않고 고정 응답.
 *  1) 입력 규칙 검사(정규식)로 먼저 걸러 고정 응답 → LLM 호출 안 함
 *  2) LLM 이 스스로 분류한 category 가 위험이면 답을 고정 응답으로 교체
 */
export const CHAT_PROMPT_VERSION = 'chat-2026-10-28.2';
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

/* ───────────── 대화 메모 (일관성 유지) ─────────────
 * 모델이 매 턴 "사용자가 직접 말한 사실"만 메모로 갱신하고, 브라우저가 다음 요청에 돌려보낸다.
 * 대화가 길어져 앞부분이 잘려도 메모가 남아 맥락이 끊기지 않는다. 서버는 길이·형식만 검사한다.
 */
export const SITUATIONS = ['모름', '솔로', '썸', '연애중', '이별', '재회 고민', '기타'] as const;
export interface ChatMemo {
  situation: (typeof SITUATIONS)[number];
  concern: string;
  partner: string;
  facts: string[];
}
export const EMPTY_MEMO: ChatMemo = { situation: '모름', concern: '', partner: '', facts: [] };

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, n) : '');
export function sanitizeMemo(v: unknown): ChatMemo {
  if (!v || typeof v !== 'object') return { ...EMPTY_MEMO };
  const o = v as Record<string, unknown>;
  return {
    situation: SITUATIONS.includes(o.situation as ChatMemo['situation']) ? (o.situation as ChatMemo['situation']) : '모름',
    concern: clip(o.concern, 120),
    partner: clip(o.partner, 120),
    facts: Array.isArray(o.facts) ? o.facts.map((f) => clip(f, 80)).filter(Boolean).slice(-8) : [],
  };
}

export const greetingOf = (hub: Hub) =>
  `안녕, 나 아는 ${hub}야. 요즘 연애 쪽으로 마음 쓰이는 거 있어요? 썸이든 이별이든 편하게 털어놔요.`;

/** 카드 소개는 코드가 최종 결정: 사용자 발화 2번 이상 + 이미 보여 준 카드는 다시 안 띄움 */
export function gateCard(card: Card, userTurns: number, shown: Card[]): Card {
  if (card === 'none') return 'none';
  if (userTurns < 2) return 'none';
  if (shown.includes(card)) return 'none';
  return card;
}

/** 코드가 카드를 막았는데 답 끝에 소개 문장이 남았으면 그 문장을 뺀다 */
export function stripCardMention(reply: string): string {
  const parts = reply.split(/(?<=[.!?。…~])\s+/);
  if (parts.length < 2) return reply;
  const last = parts[parts.length - 1];
  return /소개|여사친|무당|테스트 해|분석해 볼|궁합|연애운/.test(last) ? parts.slice(0, -1).join(' ') : reply;
}

export function chatSystem(hub: Hub, profile: { type?: string | null; dayPillar?: string | null }, memo: ChatMemo, shown: Card[], userTurns = 2): string {
  const p = [profile.type ? `성격유형 ${profile.type}` : null, profile.dayPillar ? `${profile.dayPillar} 일주` : null].filter(Boolean).join(', ');
  return `너는 연애 상담 앱 '모두의 연애'의 허브 캐릭터 "아는 ${hub}"야. 연애 고민을 편하게 털어놓는 상대. 솔직하고 직설적이지만 따뜻해.
말투: 친근한 해요체("~해요", "~거든요")가 기본, 가끔 짧은 반말 감탄("에이~", "야 그건 좀")만 섞어. 비속어·과한 유행어 금지. 처음부터 끝까지 같은 말투를 유지해.

대화는 네가 먼저 이렇게 인사하며 시작됐어: "${greetingOf(hub)}"

<memo>
지금까지 사용자가 직접 말한 내용 (이게 대화의 기준이야)
${JSON.stringify(memo)}
</memo>
${userTurns < 2 ? '이번 답에서는 card 를 반드시 none 으로 해. 아직 상황을 듣는 단계야.\n' : ''}${shown.length ? `이미 소개한 카드: ${shown.join(', ')} (다시 소개하지 마)\n` : ''}${p ? `사용자 프로필(사용자가 사주·성향을 먼저 물을 때만 꺼내. 먼저 언급하지 마): ${p}\n` : ''}
## 일관성 규칙 (가장 중요)
- 답은 사용자의 마지막 말에 대한 반응이어야 해. 먼저 focus 에 그 요지를 한 줄로 적고, reply 는 그 요지에서 벗어나지 마.
- memo 와 대화에 없는 사실(상대 이름·나이·직업·성별·사건·기간)을 지어내거나 넘겨짚지 마. 모르면 물어봐.
- 이미 사용자가 답한 걸 다시 묻지 마. 앞에서 한 말·조언과 모순되는 말을 하지 마.
- 사용자가 화제를 바꾸면 따라가되, 앞의 고민과 연결되면 자연스럽게 이어 줘.
- 새로운 화제(사주·운세·MBTI·다른 고민)를 네가 먼저 꺼내지 마. 사용자가 꺼냈을 때만 다뤄.
- 연애와 상관없는 질문(코딩·숙제·뉴스 등)엔 한 문장으로 가볍게 받아 주고, 연애 이야기로 부드럽게 돌아와.
- 질문은 한 번에 하나. 2~4문장, 250자 이내.

## memo 갱신
- 이번 사용자 말까지 반영해 memo 를 다시 써. 사용자가 직접 말한 것만 적고 네 추측·조언은 적지 마.
- situation: 솔로/썸/연애중/이별/재회 고민/기타, 아직 모르면 모름. concern: 핵심 고민 한 줄. partner: 상대에 대해 들은 사실. facts: 그 밖에 사용자가 말한 중요한 사실(최대 8개, 오래된 것부터 빠짐).
- 사용자가 정정하면 memo 도 정정해.

## 소개 카드
- 상황과 고민이 어느 정도 보이면 card 로 전문 캐릭터를 소개해. 맞는 게 없으면 none.
  · kakao: 카톡·연락 패턴, 상대 마음이 궁금할 때 → 여사친
  · compat: 그 사람과 잘 맞는지 궁금할 때 → 무당
  · fortune: 인연이 언제 오는지, 연애운·시기가 궁금할 때 → 무당
  · personality: 내 연애 스타일·반복되는 패턴이 궁금할 때 → 성격 테스트
- 카드를 고르면 reply 마지막 한 문장으로 자연스럽게 연결해. 카드가 none 이면 카드 얘기를 하지 마.

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
    focus: { type: 'string', description: '사용자 마지막 말의 요지 한 줄 (사용자에게 안 보임)' },
    memo: {
      type: 'object',
      properties: {
        situation: { type: 'string', enum: [...SITUATIONS] },
        concern: { type: 'string' },
        partner: { type: 'string' },
        facts: { type: 'array', items: { type: 'string' } },
      },
      required: ['situation', 'concern', 'partner', 'facts'],
      additionalProperties: false,
    },
    reply: { type: 'string', description: '사용자에게 보낼 답 (2~4문장, 250자 이내), focus 에서 벗어나지 않게' },
    card: { type: 'string', enum: [...CARDS], description: '지금 소개할 전문 캐릭터, 없으면 none' },
  },
  required: ['category', 'focus', 'memo', 'reply', 'card'],
  additionalProperties: false,
};

export const MAX_TURNS = 20;
export const MAX_CHARS = 500;
