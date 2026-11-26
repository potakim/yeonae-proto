/**
 * POST /api/chat — 캐릭터 채팅, 경량 모델.
 * 본문: { hub, character?, userAge?, messages: [{ role, content }], memo?: ChatMemo, shownCards?: Card[], profile?: { type?, dayPillar? }, birth?: SajuInput, speech?: 'formal' | 'casual' }
 * character 가 seohwa 면 birth 가 필수다. 서버가 사주를 계산해 프롬프트에 넣고, 답에 쓰인 근거 카드(evidence)를 계산값으로 만들어 돌려준다.
 * hub(성별)·userAge 는 실서비스에서 토스 로그인 정보로 서버가 채운다. 프로토타입은 브라우저가 보낸 값을 쓴다.
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
  HELP,
  SAFE_REPLY,
  helpFor,
  strongCrisis,
  chatSchema,
  chatSystem,
  gateCard,
  sanitizeMemo,
  stripCardMention,
  type ChatMemo,
  type Card,
  type Category,
  type Hub,
} from '../src/lib/ai/chat.js';
import { PERSONAS, PERSONA_VERSION, isPersonaId, validAge } from '../src/lib/ai/personas.js';
import { SAJU_CHAT_VERSION, buildEvidence, checkSajuReply, fallbackSajuReply, sajuChatSchema, sajuSection } from '../src/lib/ai/saju-chat.js';
import { toLlmPayload, todayKst, type SajuPayload } from '../src/lib/saju.js';
import { BadRequest, callJson, json, modelFor, rateLimited, readJsonBody, resolveCaller, type HandlerDeps } from '../server/llm.js';
import { parseBirth, safeSaju } from '../server/birth.js';

export async function handleChat(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const body = await readJsonBody(request, env, 20_000);
  if (body instanceof Response) return body;

  let hub: Hub = body.hub === '언니' ? '언니' : '형';
  // 캐릭터 페르소나 (없으면 성별 허브). 프롬프트 버전 = chat + persona
  const persona = PERSONAS[isPersonaId(body.character) ? body.character : hub === '언니' ? 'hub-f' : 'hub-m'];
  // 타로는 카드 추첨·입력 격리·출력 검사가 필요해 전용 경로만 쓴다 (3차 리뷰 2026-11-16)
  if (persona.id === 'tarot') return json(400, { error: '타로는 /api/tarot 을 사용해요.' });
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

  const memo = sanitizeMemo(body.memo);
  const shown: Card[] = Array.isArray(body.shownCards) ? (body.shownCards as unknown[]).filter((c): c is Card => CARDS.includes(c as Card) && c !== 'none') : [];
  const userTurns = msgs.filter((m) => m.role === 'user').length;
  let userAge = validAge(body.userAge);
  // 말투 설정 (마이 > 말투). 실서비스: 사용자 설정에서 서버가 읽는다
  const speech = body.speech === 'formal' || body.speech === 'casual' ? body.speech : null;

  // 서화: 서버가 생년월일로 사주를 직접 계산한다 (브라우저가 보낸 간지·풀이는 받지 않는다). 생년월일은 저장하지 않는다.
  let saju: SajuPayload | null = null;
  if (persona.id === 'seohwa') {
    if (!body.birth) return json(400, { error: '서화와 얘기하려면 출생 정보가 먼저 필요해요. 「사주 한눈에 보기」에서 입력해 주세요.', code: 'birth_required' });
    try {
      const birth = parseBirth(body.birth);
      saju = toLlmPayload(safeSaju(birth), todayKst(deps.now?.() ?? new Date()));
      hub = birth.gender === 'female' ? '언니' : '형'; // 성별·나이는 출생 정보 기준
      userAge = validAge(saju.ageNow) ?? userAge;
    } catch (e) {
      if (e instanceof BadRequest) return json(400, { error: e.message });
      throw e;
    }
  }
  const version = `${CHAT_PROMPT_VERSION}+${PERSONA_VERSION}${saju ? `+${SAJU_CHAT_VERSION}` : ''}`;

  // 안전망: 명백한 현재형 자해·자살 표현 (과거·부정·인용은 제외). 모델을 부르되, 못 부르면 고정 문구로 답한다.
  const strong = strongCrisis(last.content);
  const fallback = () => json(200, { reply: SAFE_REPLY.crisis, card: 'none', memo, safety: { category: 'crisis', by: 'rule', help: HELP.crisis }, meta: { model: null, promptVersion: version, character: persona.id } });

  if (rateLimited(request, 'chat', 20)) return strong ? fallback() : json(429, { error: '대화가 너무 빨라요. 잠깐 쉬었다 해요.' });
  const call = resolveCaller(env, deps.callModel);
  if (call instanceof Response) return strong ? fallback() : call;
  const model = env.ANTHROPIC_MODEL_CHAT || modelFor(env, 'light');
  const profile = (body.profile ?? {}) as { type?: string; dayPillar?: string };
  const safeProfile = {
    type: typeof profile.type === 'string' && /^[EI][SN][TF][JP]$/.test(profile.type) ? profile.type : null,
    dayPillar: typeof profile.dayPillar === 'string' && /^[가-힣]{2}$/.test(profile.dayPillar) ? profile.dayPillar : null,
  };

  type Out = { category: Category; focus: string; memo: ChatMemo; reply: string; card: Card; evidence?: unknown };
  const args = {
    model,
    system: chatSystem(hub, safeProfile, memo, shown, userTurns, persona, userAge, saju ? sajuSection(saju) : null, speech),
    history: msgs.slice(0, -1),
    user: last.content,
    schema: saju ? sajuChatSchema : chatSchema,
    maxTokens: 2000,
  };
  let r = await callJson<Out>(call, args, 'chat');
  if (r instanceof Response) return strong ? fallback() : r;
  // 서화: 일간을 실제와 다르게 말했으면 보내지 않는다 → 1회 재생성, 그래도 틀리면 기본 문구
  let sajuFix: { retried: boolean; fallback: boolean; failed: string[] } | null = null;
  if (saju && r.data.category === 'normal') {
    const why = checkSajuReply(String(r.data.reply ?? ''), saju);
    if (why) {
      console.warn(`[chat] 서화 출력 검사 실패 #1: ${why}`);
      sajuFix = { retried: true, fallback: false, failed: [why] };
      const again = await callJson<Out>(call, args, 'chat');
      const why2 = again instanceof Response ? '재생성 실패' : again.data.category === 'normal' ? checkSajuReply(String(again.data.reply ?? ''), saju) : null;
      if (!(again instanceof Response) && !why2) r = again;
      else {
        console.warn(`[chat] 서화 출력 검사 실패 #2: ${why2}`);
        sajuFix = { retried: true, fallback: true, failed: [why, why2 ?? ''] };
        r = { ...r, data: { ...r.data, reply: fallbackSajuReply(saju), evidence: ['dayMaster', 'strength'], card: 'none' } };
      }
    }
  }

  const cat = CATEGORIES.includes(r.data.category) ? r.data.category : 'normal';
  const nextMemo = sanitizeMemo(r.data.memo ?? memo);
  const meta = { model, promptVersion: version, character: persona.id, usage: r.usage, focus: r.data.focus, ...(sajuFix ? { sajuFix } : {}) };
  const reply = typeof r.data.reply === 'string' ? r.data.reply.trim() : '';

  // 성적인 요청만 고정 문구. 나머지 안전 상황은 모델이 캐릭터 말투로 차분하게 답하고, 서버가 종류에 맞는 도움 안내를 붙인다.
  if (cat === 'sexual') return json(200, { reply: SAFE_REPLY.sexual, card: 'none', memo, safety: { category: cat, by: 'model', help: null }, meta });
  if (cat !== 'normal') {
    return json(200, { reply: reply || SAFE_REPLY.crisis, card: 'none', memo: nextMemo, safety: { category: cat, by: 'model', help: helpFor(cat) }, meta });
  }
  // 모델은 normal 이라고 했지만 명백한 현재형 표현이 있었다 → 답은 그대로 두고 도움 안내만 붙인다
  if (strong) return json(200, { reply: reply || SAFE_REPLY.crisis, card: 'none', memo: nextMemo, safety: { category: 'crisis', by: 'rule', help: HELP.crisis }, meta });

  const proposed = CARDS.includes(r.data.card) ? r.data.card : 'none';
  const card = gateCard(proposed, userTurns, shown);
  return json(200, {
    reply: proposed !== 'none' && card === 'none' ? stripCardMention(reply) : reply,
    card,
    memo: nextMemo,
    safety: null,
    ...(saju ? { evidence: buildEvidence(r.data.evidence, saju) } : {}),
    meta: { ...meta, cardGated: proposed !== card ? proposed : null },
  });
}

export default {
  fetch(request: Request) {
    return handleChat(request);
  },
};
