/**
 * POST /api/fortune — ①계산 → ②신호 → ③Claude 문장 생성 (JSON 구조 출력) + 캐시.
 *
 * 요청 본문
 *   { kind: 'natal'|'today'|'week'|'year', birth: SajuInput }                 개인화 풀이
 *   { kind: 'todayShared', dayPillar: { stem, branch }, gender }              공용 오늘 운세 (일주 기준)
 *   공통 선택: dryRun (Claude 호출 없이 신호·프롬프트·캐시 키만 반환), characterName
 *
 * 서버가 생년월일로 직접 계산한다 (클라이언트 계산값을 믿지 않음).
 * 생년월일 원본은 저장하지 않고, 캐시 키는 간지·성별·기간·버전의 해시만 쓴다.
 *
 * 환경 변수: ANTHROPIC_API_KEY(필수, dryRun 제외), ANTHROPIC_MODEL, INTERPRET_ACCESS_CODE
 */
import Anthropic from '@anthropic-ai/sdk';
import type { DayBoundary, EarthlyBranch, HeavenlyStem } from 'manseryeok';
import type { SajuInput } from '../src/lib/saju.js';
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
  sha256Hex,
  type Bundle,
  type ReadingKind,
} from '../src/lib/fortune/reading.js';
import { CRITERIA_VERSION } from '../src/lib/fortune/criteria.js';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_BODY = 4_000;

/* ───────────── 캐시 (프로토타입: 인스턴스 메모리. 실서비스: Vercel KV·Redis 등으로 교체) ───────────── */

export interface ReadingCache {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSec: number): Promise<void>;
}

const mem = new Map<string, { value: unknown; exp: number }>();
export const memoryCache: ReadingCache = {
  async get(key) {
    const hit = mem.get(key);
    if (!hit) return null;
    if (hit.exp < Date.now()) {
      mem.delete(key);
      return null;
    }
    return hit.value;
  },
  async set(key, value, ttlSec) {
    if (mem.size > 5000) mem.delete(mem.keys().next().value!);
    mem.set(key, { value, exp: Date.now() + ttlSec * 1000 });
  },
};

/* ───────────── 입력 검증 ───────────── */

const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const BOUNDARIES: DayBoundary[] = ['midnight', 'jasi', 'splitJasi'];

class BadRequest extends Error {}
const int = (v: unknown, name: string, min: number, max: number) => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new BadRequest(`${name} 값이 올바르지 않아요.`);
  return v;
};

function parseBirth(b: unknown): SajuInput {
  if (!b || typeof b !== 'object') throw new BadRequest('birth 가 필요해요.');
  const o = b as Record<string, unknown>;
  const gender = o.gender === 'male' || o.gender === 'female' ? o.gender : null;
  if (!gender) throw new BadRequest('gender 는 male/female 이어야 해요.');
  const dayBoundary = BOUNDARIES.includes(o.dayBoundary as DayBoundary) ? (o.dayBoundary as DayBoundary) : 'midnight';
  return {
    year: int(o.year, 'year', 1900, 2100),
    month: int(o.month, 'month', 1, 12),
    day: int(o.day, 'day', 1, 31),
    hour: o.hour === null || o.hour === undefined ? null : int(o.hour, 'hour', 0, 23),
    minute: o.minute === undefined ? 0 : int(o.minute, 'minute', 0, 59),
    isLunar: o.isLunar === true,
    isLeapMonth: o.isLeapMonth === true,
    gender,
    longitude: o.longitude === null || o.longitude === undefined ? null : typeof o.longitude === 'number' && o.longitude > 120 && o.longitude < 135 ? o.longitude : (() => { throw new BadRequest('longitude 값이 올바르지 않아요.'); })(),
    useTrueSolarTime: o.useTrueSolarTime !== false,
    dayBoundary,
  };
}

function buildBundle(body: Record<string, unknown>, kind: ReadingKind, now: Date): Bundle {
  if (kind === 'todayShared') {
    const dp = body.dayPillar as { stem?: string; branch?: string } | undefined;
    if (!dp || !STEMS.includes(dp.stem ?? '') || !BRANCHES.includes(dp.branch ?? '')) throw new BadRequest('dayPillar {stem, branch} 가 필요해요.');
    if ((STEMS.indexOf(dp.stem!) % 2) !== (BRANCHES.indexOf(dp.branch!) % 2)) throw new BadRequest('존재하지 않는 일주예요 (음양 불일치).');
    const gender = body.gender === 'female' ? 'female' : 'male';
    return buildSharedBundle({ stem: dp.stem as HeavenlyStem, branch: dp.branch as EarthlyBranch }, gender, { now });
  }
  const birth = parseBirth(body.birth);
  try {
    return buildPersonalBundle(birth, kind, { now });
  } catch (e) {
    // 만세력 엔진은 날짜 오류를 RangeError(한국어)로 던진다
    if (e instanceof RangeError) throw new BadRequest(e.message);
    throw e;
  }
}

/* ───────────── 핸들러 ───────────── */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export interface HandlerDeps {
  env?: Record<string, string | undefined>;
  cache?: ReadingCache;
  now?: () => Date;
  /** 테스트용: Claude 호출 대체 */
  callModel?: (args: { model: string; system: string; user: string; schema: object }) => Promise<{ text: string; usage: { input: number; output: number }; stop: string | null }>;
}

export async function handleFortune(request: Request, deps: HandlerDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const cache = deps.cache ?? memoryCache;
  if (request.method !== 'POST') return json(405, { error: 'POST 만 지원해요.' });

  const code = env.INTERPRET_ACCESS_CODE;
  if (code && request.headers.get('x-access-code') !== code) return json(401, { error: '접근 코드가 맞지 않아요.' });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: '요청이 너무 커요.' });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'JSON 형식이 아니에요.' });
  }

  const kind = body.kind as ReadingKind;
  if (!READING_KINDS.includes(kind)) return json(400, { error: `kind 는 ${READING_KINDS.join('/')} 중 하나예요.` });

  let bundle: Bundle;
  try {
    bundle = buildBundle(body, kind, deps.now ? deps.now() : new Date());
  } catch (e) {
    if (e instanceof BadRequest) return json(400, { error: e.message });
    throw e;
  }

  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const characterName = typeof body.characterName === 'string' ? body.characterName.slice(0, 20) : '모두 무당';
  const system = buildSystemPrompt(characterName);
  const user = buildUserMessage(bundle);
  const schema = outputSchema(bundle);
  const cacheKey = await sha256Hex(cacheKeySource(bundle, model, characterName));
  const meta = { model, promptVersion: PROMPT_VERSION, criteriaVersion: CRITERIA_VERSION, cacheKey };

  if (body.dryRun === true) {
    return json(200, { kind, period: bundle.period, bundle, prompt: { system, user, schema }, meta: { ...meta, dryRun: true } });
  }

  const cached = (await cache.get(cacheKey)) as { reading: unknown; usage: unknown; createdAt: string } | null;
  if (cached) {
    return json(200, { kind, period: bundle.period, signals: bundle.signals, lucky: bundle.lucky, today: bundle.today, reading: cached.reading, meta: { ...meta, cached: true, createdAt: cached.createdAt, usage: cached.usage } });
  }

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey && !deps.callModel) return json(500, { error: 'ANTHROPIC_API_KEY 환경 변수가 설정되지 않았어요.' });

  const call = deps.callModel ?? defaultCallModel(apiKey!);
  let result;
  try {
    result = await call({ model, system, user, schema });
  } catch (e) {
    console.error('[fortune]', e);
    return json(502, { error: friendlyError(e, model) });
  }
  if (result.stop === 'refusal' || result.stop === 'max_tokens') {
    return json(502, { error: result.stop === 'refusal' ? '이 요청은 풀이를 만들 수 없었어요.' : '풀이가 너무 길어 중간에 끊겼어요. 다시 시도해 주세요.' });
  }
  let reading: unknown;
  try {
    reading = JSON.parse(result.text);
  } catch {
    return json(502, { error: '풀이 형식이 올바르지 않아요. 다시 시도해 주세요.' });
  }

  const createdAt = new Date().toISOString();
  await cache.set(cacheKey, { reading, usage: result.usage, createdAt }, CACHE_TTL[kind]);
  return json(200, { kind, period: bundle.period, signals: bundle.signals, lucky: bundle.lucky, today: bundle.today, reading, meta: { ...meta, cached: false, createdAt, usage: result.usage } });
}

function defaultCallModel(apiKey: string): NonNullable<HandlerDeps['callModel']> {
  const client = new Anthropic({ apiKey });
  return async ({ model, system, user, schema }) => {
    const msg = await client.messages.create({
      model,
      max_tokens: 3000,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: { type: 'json_schema', schema: schema as Record<string, unknown> } },
    });
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    return { text, usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens }, stop: msg.stop_reason };
  };
}

function friendlyError(e: unknown, model: string): string {
  if (e instanceof Anthropic.AuthenticationError) return 'API 키가 올바르지 않아요 (ANTHROPIC_API_KEY 확인).';
  if (e instanceof Anthropic.NotFoundError) return `모델을 찾을 수 없어요 (ANTHROPIC_MODEL=${model}).`;
  if (e instanceof Anthropic.RateLimitError) return '요청이 많아 잠시 막혔어요. 조금 뒤 다시 시도해 주세요.';
  if (e instanceof Anthropic.BadRequestError) return `요청 형식 오류: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `Claude API 오류 ${e.status ?? ''}`.trim();
  return e instanceof Error ? e.message : String(e);
}

export default {
  fetch(request: Request) {
    return handleFortune(request);
  },
};
