/**
 * POST /api/kakao — 카톡 스크린샷 분석 (여사친).
 * 본문: { images: [{ data: base64, mediaType: 'image/jpeg'|'image/png'|'image/webp' }] (1~6장), note?: string }
 *
 * 처리: Vision 추출 → 이름·번호 마스킹 → 통계·호감도(코드) → 해석(LLM)
 * 개인정보: 이미지·원문은 메모리에서만 처리하고 저장·로그·캐시하지 않는다.
 * 응답에는 통계·호감도·리포트와 메시지 개수만 담고, 대화 원문은 돌려주지 않는다.
 */
import {
  EXTRACT_SYSTEM,
  KAKAO_PROMPT_VERSION,
  SAFETY_NOTICE,
  analysisSchema,
  analysisSystem,
  analysisUser,
  extractSchema,
  type Extraction,
} from '../src/lib/ai/kakao.js';
import { computeChatStats, interestScore, maskText, type ChatMessage } from '../src/lib/kakao/stats.js';
import { callJson, json, modelFor, rateLimited, readJsonBody, resolveCaller, type ContentBlock, type HandlerDeps } from '../server/llm.js';

const MAX_IMAGES = 6;
const MAX_BODY = 4_300_000; // Vercel 요청 본문 한도(4.5MB) 안쪽
const TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type MediaType = (typeof TYPES)[number];

export async function handleKakao(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const body = await readJsonBody(request, env, MAX_BODY);
  if (body instanceof Response) return body;

  const images = body.images as { data?: unknown; mediaType?: unknown }[] | undefined;
  if (!Array.isArray(images) || images.length === 0) return json(400, { error: '스크린샷을 1장 이상 올려 주세요.' });
  if (images.length > MAX_IMAGES) return json(400, { error: `스크린샷은 최대 ${MAX_IMAGES}장까지예요.` });
  const blocks: ContentBlock[] = [];
  for (const [i, img] of images.entries()) {
    if (typeof img?.data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(img.data.slice(0, 200))) return json(400, { error: `${i + 1}번째 이미지 형식이 올바르지 않아요.` });
    const mt = TYPES.includes(img.mediaType as MediaType) ? (img.mediaType as MediaType) : 'image/jpeg';
    blocks.push({ type: 'text', text: `스크린샷 ${i + 1}/${images.length}` });
    blocks.push({ type: 'image', source: { type: 'base64', media_type: mt, data: img.data } });
  }
  blocks.push({ type: 'text', text: '위 스크린샷의 대화를 규칙대로 옮겨 적어 줘.' });
  const note = typeof body.note === 'string' && body.note.trim() ? maskText(body.note.trim().slice(0, 300), []) : null;

  if (rateLimited(request, 'kakao', 4)) return json(429, { error: '잠시 후 다시 시도해 주세요. (분석은 분당 4회까지)' });
  const call = resolveCaller(env, deps.callModel);
  if (call instanceof Response) return call;
  const model = modelFor(env, 'report');

  // 1) 추출
  const ex = await callJson<Extraction>(call, { model, system: EXTRACT_SYSTEM, user: blocks, schema: extractSchema, maxTokens: 6000 }, 'kakao.extract');
  if (ex instanceof Response) return ex;
  if (!ex.data.readable) return json(422, { error: `대화를 읽지 못했어요: ${ex.data.reason || '카톡 대화 화면인지 확인해 주세요.'}` });

  // 2) 마스킹 + 통계 (코드)
  const names = ex.data.partnerName ? [ex.data.partnerName] : [];
  const messages: ChatMessage[] = ex.data.messages.map((m) => ({ ...m, text: maskText(m.text, names) }));
  const stats = computeChatStats(messages);
  if (stats.me.messages + stats.them.messages < 3) return json(422, { error: '대화가 너무 짧아요. 주고받은 메시지가 보이는 스크린샷을 더 올려 주세요.' });
  const interest = interestScore(stats);

  // LLM 에는 마지막 30개 메시지만, 한 메시지 100자까지
  const excerpt = messages
    .filter((m) => m.speaker !== 'system')
    .slice(-30)
    .map((m) => `${m.speaker === 'me' ? '나' : '[상대]'}${m.time ? ` ${m.time}` : ''}: ${m.text.slice(0, 100)}`)
    .join('\n');

  // 3) 해석
  const an = await callJson<{ safetyConcern: boolean } & Record<string, unknown>>(
    call,
    { model, system: analysisSystem(), user: analysisUser(stats, interest, excerpt, note), schema: analysisSchema, maxTokens: 2000 },
    'kakao.analyze',
  );
  if (an instanceof Response) return an;

  return json(200, {
    stats,
    interest,
    reading: an.data,
    safetyNotice: an.data.safetyConcern ? SAFETY_NOTICE : null,
    meta: {
      model,
      promptVersion: KAKAO_PROMPT_VERSION,
      statsVersion: stats.version,
      extractedMessages: messages.length,
      usage: { input: ex.usage.input + an.usage.input, output: ex.usage.output + an.usage.output },
      privacy: '스크린샷과 대화 원문은 저장하지 않았어요.',
    },
  });
}

export default {
  fetch(request: Request) {
    return handleKakao(request);
  },
};
