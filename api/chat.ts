/**
 * POST /api/chat — 허브 채팅 (아는 형/언니), 경량 모델.
 * 본문: { hub, messages: [{ role, content }], memo?: ChatMemo, shownCards?: Card[], profile?: { type?, dayPillar? } }
 * 대화 내용은 저장하지 않는다 (브라우저가 대화·메모를 들고 있다가 매번 보냄).
 *
 * 일관성 장치: ① 메모(사용자가 말한 사실) 유지 ② 답 전에 마지막 말의 요지(focus)를 먼저 쓰게 함
 * ③ 카드 소개는 코드가 최종 결정 (2번째 사용자 발화부터, 같은 카드 재소개 금지)
 */
import {
  CARDS,
  CATEGORIES,
  CHAT_PROMPT_VERSION,
  MAX_CHARS,
  MAX_TURNS,
  SAFE_REPLY,
  EMPTY_MEMO,
  chatSchema,
  chatSystem,
  gateCard,
  precheck,
  sanitizeMemo,
  stripCardMention,
  type ChatMemo,
  type Card,
  type Category,
  type Hub,
} from '../src/lib/ai/chat.js';
import { callJson, json, modelFor, rateLimited, readJsonBody, resolveCaller, type HandlerDeps } from '../server/llm.js';

export async function handleChat(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const body = await readJsonBody(request, env, 20_000);
  if (body instanceof Response) return body;

  const hub: Hub = body.hub === '언니' ? '언니' : '형';
  const raw = body.messages as { role?: unknown; content?: unknown }[] | undefined;
  if (!Array.isArray(raw) || raw.length === 0) return json(400, { error: 'messages 가 필요해요.' });
  const msgs = raw.slice(-MAX_TURNS).map((m) => ({
    role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: typeof m.content === 'string' ? m.content.slice(0, MAX_CHARS) : '',
  }));
  // 첫 메시지는 user 여야 한다
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  const last = msgs[msgs.length - 1];
  if (!last || last.role !== 'user' || !last.content.trim()) return json(400, { error: '마지막 메시지는 사용자 메시지여야 해요.' });

  // 1) 규칙 검사 → 위험하면 LLM 없이 고정 응답
  const pre = precheck(last.content);
  const memo = sanitizeMemo(body.memo);
  const shown: Card[] = Array.isArray(body.shownCards) ? (body.shownCards as unknown[]).filter((c): c is Card => CARDS.includes(c as Card) && c !== 'none') : [];
  const userTurns = msgs.filter((m) => m.role === 'user').length;
  if (pre) return json(200, { reply: SAFE_REPLY[pre as Exclude<Category, 'normal'>], card: 'none', memo, safety: { category: pre, by: 'rule' }, meta: { model: null } });

  if (rateLimited(request, 'chat', 20)) return json(429, { error: '대화가 너무 빨라요. 잠깐 쉬었다 해요.' });
  const call = resolveCaller(env, deps.callModel);
  if (call instanceof Response) return call;
  const model = env.ANTHROPIC_MODEL_CHAT || modelFor(env, 'light');
  const profile = (body.profile ?? {}) as { type?: string; dayPillar?: string };
  const safeProfile = {
    type: typeof profile.type === 'string' && /^[EI][SN][TF][JP]$/.test(profile.type) ? profile.type : null,
    dayPillar: typeof profile.dayPillar === 'string' && /^[가-힣]{2}$/.test(profile.dayPillar) ? profile.dayPillar : null,
  };

  const r = await callJson<{ category: Category; focus: string; memo: ChatMemo; reply: string; card: Card }>(
    call,
    { model, system: chatSystem(hub, safeProfile, memo, shown, userTurns), history: msgs.slice(0, -1), user: last.content, schema: chatSchema, maxTokens: 900 },
    'chat',
  );
  if (r instanceof Response) return r;

  // 2) 모델 분류가 위험이면 고정 응답으로 교체
  const cat = CATEGORIES.includes(r.data.category) ? r.data.category : 'normal';
  if (cat !== 'normal') {
    return json(200, { reply: SAFE_REPLY[cat], card: 'none', memo, safety: { category: cat, by: 'model' }, meta: { model, promptVersion: CHAT_PROMPT_VERSION, usage: r.usage } });
  }
  const proposed = CARDS.includes(r.data.card) ? r.data.card : 'none';
  const card = gateCard(proposed, userTurns, shown);
  const nextMemo = sanitizeMemo(r.data.memo ?? EMPTY_MEMO);
  return json(200, {
    reply: proposed !== 'none' && card === 'none' ? stripCardMention(r.data.reply) : r.data.reply,
    card,
    memo: nextMemo,
    safety: null,
    meta: { model, promptVersion: CHAT_PROMPT_VERSION, usage: r.usage, focus: r.data.focus, cardGated: proposed !== card ? proposed : null },
  });
}

export default {
  fetch(request: Request) {
    return handleChat(request);
  },
};
