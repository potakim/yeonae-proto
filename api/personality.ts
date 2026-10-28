/**
 * POST /api/personality — 성격유형 테스트 응답을 서버에서 다시 채점하고 아는 형/언니가 해석.
 * 본문: { mode: 'full'|'quick', answers: { [문항id]: 1~5 }, hub: '형'|'언니', situation?: '솔로'|'썸'|'연애중'|'이별' }
 */
import { getQuestions, type TestMode } from '../src/lib/personality/questions.js';
import {
  PERSONALITY_PROMPT_VERSION,
  SITUATIONS,
  personalityCacheSource,
  personalityData,
  personalitySchema,
  personalitySystem,
  personalityUser,
  scoreFromAnswers,
  type Hub,
  type Situation,
} from '../src/lib/ai/personality.js';
import { callJson, json, memoryCache, modelFor, rateLimited, readJsonBody, resolveCaller, sha256Hex, type HandlerDeps } from '../server/llm.js';

export async function handlePersonality(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const cache = deps.cache ?? memoryCache;
  const body = await readJsonBody(request, env, 4_000);
  if (body instanceof Response) return body;

  const mode: TestMode = body.mode === 'quick' ? 'quick' : 'full';
  const hub: Hub = body.hub === '언니' ? '언니' : '형';
  const situation = SITUATIONS.includes(body.situation as Situation) ? (body.situation as Situation) : null;
  const answers = body.answers as Record<string, unknown>;
  if (!answers || typeof answers !== 'object') return json(400, { error: 'answers 가 필요해요.' });
  const questions = getQuestions(mode);
  const clean: Record<string, number> = {};
  for (const q of questions) {
    const v = answers[q.id];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) return json(400, { error: `문항 ${q.id} 응답이 없거나 올바르지 않아요.` });
    clean[q.id] = v;
  }

  const result = scoreFromAnswers(mode, clean);
  const data = personalityData(result, situation);
  const model = modelFor(env, 'report');
  const cacheKey = await sha256Hex(personalityCacheSource(result, situation, hub, model));
  const meta = { model, promptVersion: PERSONALITY_PROMPT_VERSION, cacheKey };

  const cached = (await cache.get(cacheKey)) as { reading: unknown; usage: unknown } | null;
  if (cached) return json(200, { type: result.type, reading: cached.reading, meta: { ...meta, cached: true, usage: cached.usage } });

  if (rateLimited(request, 'personality', 10)) return json(429, { error: '잠시 후 다시 시도해 주세요.' });
  const call = resolveCaller(env, deps.callModel);
  if (call instanceof Response) return call;
  const r = await callJson(call, { model, system: personalitySystem(hub), user: personalityUser(data), schema: personalitySchema, maxTokens: 1500 }, 'personality');
  if (r instanceof Response) return r;

  await cache.set(cacheKey, { reading: r.data, usage: r.usage }, 180 * 86400);
  return json(200, { type: result.type, reading: r.data, meta: { ...meta, cached: false, usage: r.usage } });
}

export default {
  fetch(request: Request) {
    return handlePersonality(request);
  },
};
