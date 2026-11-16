/**
 * POST /api/tarot — 타로마스터 전용 (3차 리뷰 2026-11-16: 프롬프트 인젝션 방어 구조).
 *
 * { action: 'draw', question }            → 질문 정규화 → 서버가 카드 추첨 → { status:'draw', token, question }
 *                                            (카드는 아직 안 보냄. 질문이 아니면 카드 없이 need_question)
 * { action: 'reveal', token }             → { card: { index, name, reversed } }  같은 토큰은 항상 같은 카드
 * { action: 'read', token, history? }     → 시스템 프롬프트 + <draw> + <user_input> 로 모델 호출 → 출력 검사
 *                                            → { status, reply, card? }  reading 이 아니면 카드는 무효(void)
 *
 * 브라우저가 보내는 것은 질문·토큰·지난 회차 기록뿐. 카드 이름은 받지 않는다 (지난 회차는 표시용 기록에서 읽되 해석엔 안 씀).
 * 프로토타입 한계: 저장소가 없어 재추첨 횟수·무료 1장 차감은 강제하지 못한다 → 실서비스 draws 테이블에서 처리.
 */
import { SAFE_REPLY, precheck, type Category } from '../src/lib/ai/chat.js';
import { TAROT_CARDS } from '../src/lib/ai/personas.js';
import { normalizeQuestion, notAQuestion } from '../src/lib/tarot-normalize.js';
import { callJson, json, modelFor, rateLimited, readJsonBody, resolveCaller, type HandlerDeps } from '../server/llm.js';
import {
  CANNED,
  SAFETY_LINES,
  TAROT_PROMPT_VERSION,
  TAROT_SYSTEM,
  cardName,
  checkReading,
  clampReply,
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
type Out = { status: TarotStatus; card: string; orientation: string; reply: string };

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
    const pre = precheck(body.question);
    const n = normalizeQuestion(body.question);
    if (pre) return json(200, { status: 'safety', question: n.text || '…', reply: SAFE_REPLY[pre as Exclude<Category, 'normal'>], meta });
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
      const text = clampReply(r.data.reply || CANNED.empty);
      return json(200, { status, reply: status === 'safety' ? `${text}\n${SAFETY_LINES}` : text, void: true, meta: { ...meta, model, usage: r.usage } });
    }
    const why = checkReading(r.data, draw);
    if (!why) return json(200, { status: 'reading', reply: clampReply(r.data.reply), card, meta: { ...meta, model, usage: r.usage, retried: attempt > 0 } });
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
