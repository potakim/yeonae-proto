/**
 * POST /api/tarot — 타로마스터 전용 (3차 리뷰 2026-11-16: 프롬프트 인젝션 방어 구조).
 *
 * { action: 'draw', question }            → 질문 정규화 → 서버가 카드 추첨 → { status:'draw', token, question }
 *                                            (카드는 아직 안 보냄. 질문이 아니면 카드 없이 need_question)
 * { action: 'reveal', token }             → { card: { index, name, reversed } }  같은 토큰은 항상 같은 카드
 * { action: 'read', token, history? }     → 시스템 프롬프트 + <draw> + <user_input> 로 모델 호출(말풍선 목록) → 출력 검사
 *                                            → { status, reply, card? }  reading 이 아니면 카드는 무효(void)
 *
 * 브라우저가 보내는 것은 질문·토큰·지난 회차 기록뿐. 카드 이름은 받지 않는다 (지난 회차는 표시용 기록에서 읽되 해석엔 안 씀).
 * 프로토타입 한계: 저장소가 없어 재추첨 횟수·무료 1장 차감은 강제하지 못한다 → 실서비스 draws 테이블에서 처리.
 */
import { HELP, SAFE_REPLY, strongCrisis, type Help } from '../src/lib/ai/chat.js';
import { TAROT_CARDS } from '../src/lib/ai/personas.js';
import { normalizeQuestion, notAQuestion } from '../src/lib/tarot-normalize.js';
import { callJson, json, modelFor, rateLimited, readJsonBody, resolveCaller, type HandlerDeps } from '../server/llm.js';
import {
  CANNED,
  TAROT_PROMPT_VERSION,
  TAROT_SYSTEM,
  cardName,
  checkReading,
  bubblesOf,
  clampReply,
  joinBubbles,
  currentMessage,
  drawCard,
  fallbackReading,
  openDraw,
  orientationOf,
  pastMessage,
  sealDraw,
  tarotSchema,
  type TarotStatus,
} from '../server/tarot.js';

const MAX_HISTORY_TURNS = 6;
type Out = { status: TarotStatus; card: string; orientation: string; safety_type?: string; bubbles?: unknown; reply?: unknown };
/** 위험 종류에 맞는 도움 안내만 붙인다 (연락처를 일괄 표시하지 않음 — 노션 2026-11-19 개정). other 는 안내 없이 안전 확인만 */
const helpOf = (t: string | undefined): Help | null => (t === 'self_harm' ? HELP.crisis : t === 'harm_others' ? HELP.harm_others : t === 'violence' ? HELP.violence_victim : null);

/** 브라우저가 보낸 지난 회차 기록을 모델용 이력으로 다시 만든다 (사용자 글은 정규화, 카드는 "지난 카드" 한 줄) */
function buildHistory(raw: unknown): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(raw)) return [];
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of raw.slice(-MAX_HISTORY_TURNS * 2) as { role?: unknown; content?: unknown; tarot?: { index?: unknown; reversed?: unknown } }[]) {
    const content = typeof m?.content === 'string' ? m.content : '';
    if (m?.role === 'assistant') {
      if (out.length && out[out.length - 1].role === 'user') out.push({ role: 'assistant', content: content.slice(0, 600) });
    } else {
      const idx = m?.tarot?.index;
      const card = typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < TAROT_CARDS.length ? { name: TAROT_CARDS[idx], reversed: m.tarot?.reversed === true } : null;
      const q = normalizeQuestion(content).text;
      if (!q) continue;
      if (out.length && out[out.length - 1].role === 'user') out.pop(); // user 가 연속되면 앞의 것을 버린다
      out.push({ role: 'user', content: pastMessage(q, card) });
    }
  }
  if (out.length && out[out.length - 1].role === 'user') out.pop(); // 마지막은 assistant 로 끝나야 이번 메시지를 붙일 수 있다
  return out;
}

export async function handleTarot(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const body = await readJsonBody(request, env, 30_000);
  if (body instanceof Response) return body;
  const now = (deps.now?.() ?? new Date()).getTime();
  const meta = { promptVersion: TAROT_PROMPT_VERSION };

  /* ── [1] draw: 질문 정규화 → 추첨 (카드는 토큰 안에만) ── */
  if (body.action === 'draw') {
    if (typeof body.question !== 'string' || !body.question.trim()) return json(400, { error: 'question 이 필요해요.' });
    if (rateLimited(request, 'tarot-draw', 20)) return json(429, { error: '카드를 너무 빨리 뽑고 있어요. 잠깐 쉬었다 해요.' });
    const n = normalizeQuestion(body.question);
    // 안전망: 명백한 현재형 자해·자살 표현이면 카드를 뽑지 않는다. 과거·인용 등 맥락이 필요한 경우는 해석 단계에서 모델이 판단한다.
    if (strongCrisis(body.question)) return json(200, { status: 'safety', question: n.text || '…', reply: SAFE_REPLY.crisis, help: HELP.crisis, meta });
    const not = notAQuestion(n.text);
    if (not) return json(200, { status: 'need_question', question: n.text || '…', reply: CANNED[not], meta });
    return json(200, { status: 'draw', token: sealDraw(env, drawCard(n.text, n.cardTagRemoved, now)), question: n.text, cardTagRemoved: n.cardTagRemoved, meta });
  }

  const draw = openDraw(env, body.token, now);
  if (body.action === 'reveal' || body.action === 'read') {
    if (!draw) return json(410, { error: CANNED.expired });
  } else {
    return json(400, { error: 'action 은 draw · reveal · read 중 하나여야 해요.' });
  }
  const card = { index: draw.index, name: cardName(draw), reversed: draw.reversed };

  /* ── [2] reveal: 저장된 카드 그대로 ── */
  if (body.action === 'reveal') return json(200, { card, meta });

  /* ── [3] read: 모델 호출 → 출력 검사 ── */
  if (rateLimited(request, 'tarot-read', 20)) return json(429, { error: '대화가 너무 빨라요. 잠깐 쉬었다 해요.' });
  const call = resolveCaller(env, deps.callModel);
  if (call instanceof Response) return call;
  const model = env.ANTHROPIC_MODEL_CHAT || modelFor(env, 'light');
  const args = { model, system: TAROT_SYSTEM, history: buildHistory(body.history), user: currentMessage(draw), schema: tarotSchema, maxTokens: 900 };

  let failed: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await callJson<Out>(call, args, 'tarot');
    if (r instanceof Response) return r;
    const status: TarotStatus = (['reading', 'need_question', 'out_of_scope', 'safety'] as const).includes(r.data.status) ? r.data.status : 'need_question';
    if (status !== 'reading') {
      // 카드 무효(void) — 화면은 이 회차의 카드를 지우고, 실서비스는 차감을 취소한다
      const text = clampReply(bubblesOf(r.data).join(' ') || CANNED.empty); // 해석이 아닌 답은 말풍선 하나로
      return json(200, { status, reply: text, help: status === 'safety' ? helpOf(r.data.safety_type) : null, void: true, meta: { ...meta, model, usage: r.usage } });
    }
    // 말풍선 목록을 빈 줄로 이어 붙인 문자열로 검사·전달한다 (화면은 빈 줄마다 말풍선을 나눈다)
    const reply = joinBubbles(bubblesOf(r.data));
    const why = checkReading({ card: r.data.card, orientation: r.data.orientation, reply }, draw);
    if (!why) return json(200, { status: 'reading', reply, card, meta: { ...meta, model, usage: r.usage, retried: attempt > 0 } });
    failed = [...failed, why];
    console.warn(`[tarot] 출력 검사 실패 #${attempt + 1}: ${why} (draw ${draw.id}, ${card.name} ${orientationOf(draw)})`);
  }
  // 두 번 실패 → 원 응답은 보내지 않고 기본 문구
  return json(200, { status: 'reading', reply: fallbackReading(draw), card, meta: { ...meta, model, fallback: true, failed } });
}

export default {
  fetch(request: Request) {
    return handleTarot(request);
  },
};
