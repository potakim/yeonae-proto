/**
 * POST /api/fortune — ①계산 → ②신호 → ③Claude 문장 생성 (JSON 구조 출력) + 캐시.
 *
 * 요청 본문
 *   { kind: 'natal'|'today'|'week'|'year', birth: SajuInput }                 개인화 풀이
 *   { kind: 'todayShared', dayPillar: { stem, branch }, gender }              공용 오늘 운세 (일주 기준)
 *   공통 선택: dryRun (Claude 호출 없이 신호·프롬프트·캐시 키만 반환), characterName
 *
 * 서버가 생년월일로 직접 계산한다. 생년월일 원본은 저장하지 않고 캐시 키는 간지·성별·기간·버전 해시만.
 */
import type { EarthlyBranch, HeavenlyStem } from 'manseryeok';
import {
  CACHE_TTL,
  PROMPT_VERSION,
  READING_KINDS,
  buildPersonalBundle,
  buildSharedBundle,
  buildSystemPrompt,
  buildUserMessage,
  cacheKeySource,
  outputSchema,
  type Bundle,
  type ReadingKind,
} from '../src/lib/fortune/reading.js';
import { CRITERIA_VERSION } from '../src/lib/fortune/criteria.js';
import { BadRequest, callJson, json, memoryCache, modelFor, rateLimited, readJsonBody, resolveCaller, sha256Hex, type HandlerDeps } from '../server/llm.js';
import { parseBirth } from '../server/birth.js';

export type { ReadingCache } from '../server/llm.js';

const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

function buildBundle(body: Record<string, unknown>, kind: ReadingKind, now: Date): Bundle {
  if (kind === 'todayShared') {
    const dp = body.dayPillar as { stem?: string; branch?: string } | undefined;
    if (!dp || !STEMS.includes(dp.stem ?? '') || !BRANCHES.includes(dp.branch ?? '')) throw new BadRequest('dayPillar {stem, branch} 가 필요해요.');
    if (STEMS.indexOf(dp.stem!) % 2 !== BRANCHES.indexOf(dp.branch!) % 2) throw new BadRequest('존재하지 않는 일주예요 (음양 불일치).');
    const gender = body.gender === 'female' ? 'female' : 'male';
    return buildSharedBundle({ stem: dp.stem as HeavenlyStem, branch: dp.branch as EarthlyBranch }, gender, { now });
  }
  const birth = parseBirth(body.birth);
  try {
    return buildPersonalBundle(birth, kind, { now });
  } catch (e) {
    if (e instanceof RangeError) throw new BadRequest(e.message);
    throw e;
  }
}

export async function handleFortune(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const cache = deps.cache ?? memoryCache;
  const body = await readJsonBody(request, env, 4_000);
  if (body instanceof Response) return body;

  const kind = body.kind as ReadingKind;
  if (!READING_KINDS.includes(kind)) return json(400, { error: `kind 는 ${READING_KINDS.join('/')} 중 하나예요.` });

  let bundle: Bundle;
  try {
    bundle = buildBundle(body, kind, deps.now ? deps.now() : new Date());
  } catch (e) {
    if (e instanceof BadRequest) return json(400, { error: e.message });
    throw e;
  }

  const model = modelFor(env, 'report');
  const characterName = typeof body.characterName === 'string' ? body.characterName.slice(0, 20) : '모두 무당';
  const system = buildSystemPrompt(characterName);
  const user = buildUserMessage(bundle);
  const schema = outputSchema(bundle);
  const cacheKey = await sha256Hex(cacheKeySource(bundle, model, characterName));
  const meta = { model, promptVersion: PROMPT_VERSION, criteriaVersion: CRITERIA_VERSION, cacheKey };
  const base = { kind, period: bundle.period, signals: bundle.signals, lucky: bundle.lucky, today: bundle.today };

  if (body.dryRun === true) {
    return json(200, { kind, period: bundle.period, bundle, prompt: { system, user, schema }, meta: { ...meta, dryRun: true } });
  }

  const cached = (await cache.get(cacheKey)) as { reading: unknown; usage: unknown; createdAt: string } | null;
  if (cached) return json(200, { ...base, reading: cached.reading, meta: { ...meta, cached: true, createdAt: cached.createdAt, usage: cached.usage } });

  if (rateLimited(request, 'fortune', 10)) return json(429, { error: '잠시 후 다시 시도해 주세요. (분당 요청 제한)' });
  const call = resolveCaller(env, deps.callModel);
  if (call instanceof Response) return call;
  const r = await callJson(call, { model, system, user, schema }, 'fortune');
  if (r instanceof Response) return r;

  const createdAt = new Date().toISOString();
  await cache.set(cacheKey, { reading: r.data, usage: r.usage, createdAt }, CACHE_TTL[kind]);
  return json(200, { ...base, reading: r.data, meta: { ...meta, cached: false, createdAt, usage: r.usage } });
}

export default {
  fetch(request: Request) {
    return handleFortune(request);
  },
};
