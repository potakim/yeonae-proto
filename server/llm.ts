/**
 * 서버 공통: Claude 호출(JSON 구조 출력·이미지), 접근 코드, 요청 제한, 캐시, 오류 문구.
 * api/*.ts 함수들이 함께 쓴다. 브라우저 번들에는 들어가지 않는다.
 */
import Anthropic from '@anthropic-ai/sdk';

export type Env = Record<string, string | undefined>;

/** 리포트 해석(상위 모델) / 대화·추출 보조(경량 모델) */
export const modelFor = (env: Env, tier: 'report' | 'light') =>
  tier === 'light' ? env.ANTHROPIC_MODEL_LIGHT || 'claude-haiku-5-5' : env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export class BadRequest extends Error {}

/* ───────────── 캐시 (프로토타입: 인스턴스 메모리. 실서비스: KV·Redis 로 교체) ───────────── */

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

/* ───────────── 요청 제한 (IP·분 단위, 인스턴스 메모리) ───────────── */

const hits = new Map<string, number[]>();
export function rateLimited(request: Request, bucket: string, perMinute: number): boolean {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
  const key = `${bucket}|${ip}`;
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= perMinute) {
    hits.set(key, list);
    return true;
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) hits.delete(hits.keys().next().value!);
  return false;
}

/* ───────────── 요청 공통 처리 ───────────── */

export async function readJsonBody(request: Request, env: Env, maxBytes: number): Promise<Record<string, unknown> | Response> {
  if (request.method !== 'POST') return json(405, { error: 'POST 만 지원해요.' });
  const code = env.INTERPRET_ACCESS_CODE;
  if (code && request.headers.get('x-access-code') !== code) return json(401, { error: '접근 코드가 맞지 않아요.' });
  const raw = await request.text();
  if (raw.length > maxBytes) return json(413, { error: '요청이 너무 커요.' });
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'JSON 객체가 필요해요.' });
    return body as Record<string, unknown>;
  } catch {
    return json(400, { error: 'JSON 형식이 아니에요.' });
  }
}

/* ───────────── Claude 호출 ───────────── */

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string } };

export interface CallArgs {
  model: string;
  system: string;
  /** 문자열 또는 이미지가 섞인 콘텐츠 */
  user: string | ContentBlock[];
  schema: object;
  maxTokens?: number;
  /** 대화형: 이전 턴 (user/assistant 교대) */
  history?: { role: 'user' | 'assistant'; content: string }[];
}
export interface CallResult {
  text: string;
  usage: { input: number; output: number };
  stop: string | null;
}
export type CallModel = (args: CallArgs) => Promise<CallResult>;

export function claudeCaller(apiKey: string): CallModel {
  const client = new Anthropic({ apiKey });
  return async ({ model, system, user, schema, maxTokens, history }) => {
    const msg = await client.messages.create({
      model,
      max_tokens: maxTokens ?? 3000,
      system,
      messages: [...(history ?? []), { role: 'user', content: user }],
      output_config: { format: { type: 'json_schema', schema: schema as Record<string, unknown> } },
    });
    const text = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    return { text, usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens }, stop: msg.stop_reason };
  };
}

/** 호출 → JSON 파싱까지. 실패하면 사용자에게 보여 줄 문구와 함께 Response 를 돌려준다 */
export async function callJson<T = unknown>(
  call: CallModel,
  args: CallArgs,
  tag: string,
): Promise<{ data: T; usage: CallResult['usage'] } | Response> {
  let result: CallResult;
  try {
    result = await call(args);
  } catch (e) {
    console.error(`[${tag}]`, e instanceof Error ? e.message : e);
    return json(502, { error: friendlyError(e, args.model) });
  }
  if (result.stop === 'refusal') return json(502, { error: '이 요청은 풀이를 만들 수 없었어요.' });
  if (result.stop === 'max_tokens') return json(502, { error: '결과가 너무 길어 중간에 끊겼어요. 다시 시도해 주세요.' });
  try {
    return { data: JSON.parse(result.text) as T, usage: result.usage };
  } catch {
    return json(502, { error: '결과 형식이 올바르지 않아요. 다시 시도해 주세요.' });
  }
}

export function resolveCaller(env: Env, injected?: CallModel): CallModel | Response {
  if (injected) return injected;
  if (!env.ANTHROPIC_API_KEY) return json(500, { error: 'ANTHROPIC_API_KEY 환경 변수가 설정되지 않았어요.' });
  return claudeCaller(env.ANTHROPIC_API_KEY);
}

export function friendlyError(e: unknown, model: string): string {
  if (e instanceof Anthropic.AuthenticationError) return 'API 키가 올바르지 않아요 (ANTHROPIC_API_KEY 확인).';
  if (e instanceof Anthropic.NotFoundError) return `모델을 찾을 수 없어요 (${model}).`;
  if (e instanceof Anthropic.RateLimitError) return '요청이 많아 잠시 막혔어요. 조금 뒤 다시 시도해 주세요.';
  if (e instanceof Anthropic.BadRequestError) return `요청 형식 오류: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `Claude API 오류 ${e.status ?? ''}`.trim();
  return e instanceof Error ? e.message : String(e);
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 공통 의존성 (테스트에서 주입) */
export interface HandlerDeps {
  env?: Env;
  cache?: ReadingCache;
  now?: () => Date;
  callModel?: CallModel;
}

/* ───────────── 입력 검증 보조 ───────────── */

export const int = (v: unknown, name: string, min: number, max: number) => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new BadRequest(`${name} 값이 올바르지 않아요.`);
  return v;
};

/** 공통 캐릭터 금지 규칙 (모든 프롬프트에 붙임) */
export const COMMON_RULES = `## 공통 금지
- 건강·사고·금전 손실·이별/이혼 확정 같은 단정·공포 표현
- 부적·굿·유료 상담 권유, 특정 상품 구매 유도
- 상대를 조종·감시하거나 집착을 부추기는 조언 (위치 추적, 몰래 연락, 계정 접근 등)
- 정신질환 진단이나 치료 권유처럼 들리는 표현
- JSON 필드 이름, "점수 계산", "코드" 같은 내부 표현 노출
- 마크다운 기호(#, **, -) 사용. 각 문자열은 평문으로`;
