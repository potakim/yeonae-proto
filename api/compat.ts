/**
 * POST /api/compat — 사주×MBTI 궁합. 두 사람 원국과 점수는 서버 코드가 계산하고 무당이 해석.
 * 본문: { me: { birth, mbti?, label? }, partner: { birth, mbti?, label? }, dryRun? }
 * 상대는 실명 대신 별칭만 받는다. 생년월일 원본은 저장하지 않는다.
 */
import { computeCompat } from '../src/lib/compat/compat.js';
import { COMPAT_PROMPT_VERSION, compatCacheSource, compatSchema, compatSystem, compatUser } from '../src/lib/ai/compat.js';
import { BadRequest, callJson, json, memoryCache, modelFor, rateLimited, readJsonBody, resolveCaller, sha256Hex, type HandlerDeps } from '../server/llm.js';
import { parseBirth, parseMbti, safeSaju } from '../server/birth.js';

const cleanLabel = (v: unknown, fallback: string) => {
  const s = typeof v === 'string' ? v.replace(/[<>{}\n\r]/g, '').trim().slice(0, 10) : '';
  return s || fallback;
};

export async function handleCompat(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const cache = deps.cache ?? memoryCache;
  const body = await readJsonBody(request, env, 4_000);
  if (body instanceof Response) return body;

  let compat, a, b;
  try {
    const me = (body.me ?? {}) as Record<string, unknown>;
    const partner = (body.partner ?? {}) as Record<string, unknown>;
    a = safeSaju(parseBirth(me.birth, 'me.birth'));
    b = safeSaju(parseBirth(partner.birth, 'partner.birth'));
    compat = computeCompat(
      { label: cleanLabel(me.label, '나'), saju: a, mbti: parseMbti(me.mbti) },
      { label: cleanLabel(partner.label, '그 사람'), saju: b, mbti: parseMbti(partner.mbti) },
    );
  } catch (e) {
    if (e instanceof BadRequest) return json(400, { error: e.message });
    throw e;
  }

  const model = modelFor(env, 'report');
  const characterName = '모두 무당';
  const cacheKey = await sha256Hex(compatCacheSource(a, b, compat, model, characterName));
  const meta = { model, promptVersion: COMPAT_PROMPT_VERSION, compatVersion: compat.version, cacheKey };
  if (body.dryRun === true) return json(200, { compat, prompt: { system: compatSystem(characterName), user: compatUser(compat), schema: compatSchema }, meta: { ...meta, dryRun: true } });

  const cached = (await cache.get(cacheKey)) as { reading: unknown; usage: unknown } | null;
  if (cached) return json(200, { compat, reading: cached.reading, meta: { ...meta, cached: true, usage: cached.usage } });

  if (rateLimited(request, 'compat', 10)) return json(429, { error: '잠시 후 다시 시도해 주세요.' });
  const call = resolveCaller(env, deps.callModel);
  if (call instanceof Response) return call;
  const r = await callJson(call, { model, system: compatSystem(characterName), user: compatUser(compat), schema: compatSchema, maxTokens: 2000 }, 'compat');
  if (r instanceof Response) return r;
  await cache.set(cacheKey, { reading: r.data, usage: r.usage }, 365 * 86400);
  return json(200, { compat, reading: r.data, meta: { ...meta, cached: false, usage: r.usage } });
}

export default {
  fetch(request: Request) {
    return handleCompat(request);
  },
};
