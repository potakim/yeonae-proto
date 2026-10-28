/**
 * POST /api/chat — 허브 채팅 (아는 형/언니), 경량 모델.
 * 본문: { hub: '형'|'언니', messages: [{ role: 'user'|'assistant', content }], profile?: { type?, dayPillar? } }
 * 대화 내용은 저장하지 않는다 (브라우저가 들고 있다가 매번 보냄).
 */
import {
  CARDS,
  CATEGORIES,
  CHAT_PROMPT_VERSION,
  MAX_CHARS,
  MAX_TURNS,
  SAFE_REPLY,
  chatSchema,
  chatSystem,
  precheck,
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
  if (pre) return json(200, { reply: SAFE_REPLY[pre as Exclude<Category, 'normal'>], card: 'none', safety: { category: pre, by: 'rule' }, meta: { model: null } });

  if (rateLimited(request, 'chat', 20)) return json(429, { error: '대화가 너무 빨라요. 잠깐 쉬었다 해요.' });
  const call = resolveCaller(env, deps.callModel);
  if (call instanceof Response) return call;
  const model = modelFor(env, 'light');
  const profile = (body.profile ?? {}) as { type?: string; dayPillar?: string };
  const safeProfile = {
    type: typeof profile.type === 'string' && /^[EI][SN][TF][JP]$/.test(profile.type) ? profile.type : null,
    dayPillar: typeof profile.dayPillar === 'string' && /^[가-힣]{2}$/.test(profile.dayPillar) ? profile.dayPillar : null,
  };

  const r = await callJson<{ category: Category; reply: string; card: Card }>(
    call,
    { model, system: chatSystem(hub, safeProfile), history: msgs.slice(0, -1), user: last.content, schema: chatSchema, maxTokens: 600 },
    'chat',
  );
  if (r instanceof Response) return r;

  // 2) 모델 분류가 위험이면 고정 응답으로 교체
  const cat = CATEGORIES.includes(r.data.category) ? r.data.category : 'normal';
  if (cat !== 'normal') {
    return json(200, { reply: SAFE_REPLY[cat], card: 'none', safety: { category: cat, by: 'model' }, meta: { model, promptVersion: CHAT_PROMPT_VERSION, usage: r.usage } });
  }
  const card = CARDS.includes(r.data.card) ? r.data.card : 'none';
  return json(200, { reply: r.data.reply, card, safety: null, meta: { model, promptVersion: CHAT_PROMPT_VERSION, usage: r.usage } });
}

export default {
  fetch(request: Request) {
    return handleChat(request);
  },
};
