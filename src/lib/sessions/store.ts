/**
 * 세션·저장된 분석 저장소 (화면설계서 v0.3 §7).
 *
 * 프로토타입은 localStorage(LocalSessionStore). 실서비스는 같은 SessionStore 인터페이스로
 * Supabase 등 서버 구현(chat_sessions / chat_messages / saved_analyses / partners, 암호화·30일 파기)으로 교체한다.
 *
 * 데이터 분리 원칙:
 *  - 사용자 공통 데이터(성향·사주 원국)는 App 상태/프로필에, 세션엔 넣지 않는다
 *  - 상대방(partner)은 별칭으로만 저장, 세션은 partnerId 로 연결
 *  - 저장된 분석은 캐릭터에 종속되지 않는 공통 자산 (sourceCharacter 는 라벨)
 *  - 다른 상대의 세션 원문은 절대 섞지 않는다 — 새 세션에 넘기는 건 memo·요약뿐
 */
import type { ChatMemo } from '../ai/chat';

export type SessionOrigin = 'new' | 'partner' | 'continue' | 'handoff';

export interface StoredMsg {
  role: 'user' | 'assistant';
  content: string;
  card?: string;
  safety?: boolean;
}

export interface Session {
  id: string;
  character: string; // characters.ts id
  title: string;
  origin: SessionOrigin;
  partnerId?: string;
  parentId?: string;
  memo: ChatMemo;
  messages: StoredMsg[];
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Partner {
  id: string;
  alias: string; // 실명 대신 별칭
  note?: string; // 관계·만난 기간 등 사용자가 적은 것
  createdAt: number;
}

export type AnalysisType = 'trait' | 'match' | 'fortune' | 'saju' | 'kakao';

export interface SavedAnalysis {
  id: string;
  type: AnalysisType;
  sourceCharacter: string; // 생성한 캐릭터 id
  partnerId?: string;
  title: string; // 예: 궁합 결과 — 지훈
  summary: string; // 다른 세션에 주입되는 한두 줄 (원문 아님)
  data?: unknown; // 화면 재표시용 (선택)
  createdAt: number;
}

export interface SessionStore {
  listSessions(character?: string): Session[];
  getSession(id: string): Session | undefined;
  createSession(input: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'messages'> & { messages?: StoredMsg[] }): Session;
  updateSession(id: string, patch: Partial<Pick<Session, 'title' | 'memo' | 'messages' | 'pinned'>>): Session | undefined;
  deleteSession(id: string): void;

  listPartners(): Partner[];
  upsertPartner(alias: string, note?: string): Partner;

  listAnalyses(filter?: { partnerId?: string; type?: AnalysisType }): SavedAnalysis[];
  saveAnalysis(input: Omit<SavedAnalysis, 'id' | 'createdAt'>): SavedAnalysis;
  deleteAnalysis(id: string): void;

  clearAll(): void;
  subscribe(fn: () => void): () => void;
}

export const ANALYSIS_LABEL: Record<AnalysisType, string> = {
  trait: '연애 성향',
  match: '궁합 결과',
  fortune: '연애운',
  saju: '사주 원국',
  kakao: '카톡 분석',
};

const KEY = 'yeonae.sessions.v1';
const MAX_MESSAGES = 60; // 세션당 보관 원문 상한 (실서비스는 30일 파기)

interface Blob {
  sessions: Session[];
  partners: Partner[];
  analyses: SavedAnalysis[];
}

const uid = () => (typeof globalThis.crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export class LocalSessionStore implements SessionStore {
  private blob: Blob;
  private subs = new Set<() => void>();
  private storage: StorageLike | null;
  constructor(storage: StorageLike | null = typeof localStorage === 'undefined' ? null : localStorage) {
    this.storage = storage;
    this.blob = this.read();
  }
  private read(): Blob {
    try {
      const v = JSON.parse(this.storage?.getItem(KEY) ?? 'null');
      if (v && Array.isArray(v.sessions)) return { sessions: v.sessions, partners: v.partners ?? [], analyses: v.analyses ?? [] };
    } catch {
      /* ignore */
    }
    return { sessions: [], partners: [], analyses: [] };
  }
  private write() {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.blob));
    } catch {
      /* 용량 초과 등은 무시 — 메모리 상태는 유지 */
    }
    this.subs.forEach((f) => f());
  }

  listSessions(character?: string) {
    return this.blob.sessions
      .filter((s) => !character || s.character === character)
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
  }
  getSession(id: string) {
    return this.blob.sessions.find((s) => s.id === id);
  }
  createSession(input: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'messages'> & { messages?: StoredMsg[] }) {
    const now = Date.now();
    const s: Session = { ...input, messages: input.messages ?? [], id: uid(), createdAt: now, updatedAt: now };
    this.blob.sessions.push(s);
    this.write();
    return s;
  }
  updateSession(id: string, patch: Partial<Pick<Session, 'title' | 'memo' | 'messages' | 'pinned'>>) {
    const s = this.getSession(id);
    if (!s) return undefined;
    Object.assign(s, patch, { updatedAt: Date.now() });
    if (s.messages.length > MAX_MESSAGES) s.messages = s.messages.slice(-MAX_MESSAGES);
    this.write();
    return s;
  }
  deleteSession(id: string) {
    this.blob.sessions = this.blob.sessions.filter((s) => s.id !== id);
    this.write();
  }

  listPartners() {
    return [...this.blob.partners].sort((a, b) => b.createdAt - a.createdAt);
  }
  upsertPartner(alias: string, note?: string) {
    const a = alias.trim().slice(0, 20);
    let p = this.blob.partners.find((x) => x.alias === a);
    if (!p) {
      p = { id: uid(), alias: a, note, createdAt: Date.now() };
      this.blob.partners.push(p);
    } else if (note) p.note = note;
    this.write();
    return p;
  }

  listAnalyses(filter?: { partnerId?: string; type?: AnalysisType }) {
    return this.blob.analyses
      .filter((a) => (!filter?.partnerId || a.partnerId === filter.partnerId) && (!filter?.type || a.type === filter.type))
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  saveAnalysis(input: Omit<SavedAnalysis, 'id' | 'createdAt'>) {
    const a: SavedAnalysis = { ...input, id: uid(), createdAt: Date.now() };
    this.blob.analyses.unshift(a);
    if (this.blob.analyses.length > 50) this.blob.analyses.length = 50;
    this.write();
    return a;
  }
  deleteAnalysis(id: string) {
    this.blob.analyses = this.blob.analyses.filter((a) => a.id !== id);
    this.write();
  }

  clearAll() {
    this.blob = { sessions: [], partners: [], analyses: [] };
    try {
      this.storage?.removeItem(KEY);
    } catch {
      /* ignore */
    }
    this.subs.forEach((f) => f());
  }
  subscribe(fn: () => void) {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }
}

/** 세션 제목: 첫 사용자 발화에서 (LLM 미사용 — 프롬프트 검토 대상이 늘지 않게) */
export function titleFrom(text: string): string {
  const t = text.replace(/\s+/g, ' ').replace(/\n?\[카드:.*?\]/g, '').trim();
  return (t.length > 22 ? `${t.slice(0, 22)}…` : t) || '새 상담';
}

export function formatWhen(ts: number, now = Date.now()): string {
  const d = now - ts;
  if (d < 60_000) return '방금';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}분 전`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}시간 전`;
  if (d < 7 * 86_400_000) return `${Math.floor(d / 86_400_000)}일 전`;
  const dt = new Date(ts);
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

/* ───── 새 세션에 넘길 맥락 조립 (§7.3) ───── */

const EMPTY: ChatMemo = { situation: '모름', concern: '', partner: '', facts: [] };

/** 이전 상담에서 이어서: 부모 세션의 memo + "이전 상담 요약" 사실 한 줄 */
export function memoForContinue(parent: Session): ChatMemo {
  const facts = [...parent.memo.facts];
  const line = `이전 상담(${parent.title}): ${parent.memo.concern || '고민 이어서'}`.slice(0, 60);
  if (!facts.includes(line)) facts.push(line);
  return { ...parent.memo, facts: facts.slice(-6) };
}

/** 이전 상대에 대한 새로운 고민: 상대 프로필 + 그 상대 관련 저장 분석 요약만 (다른 세션 원문·고민은 넣지 않음) */
export function memoForPartner(partner: Partner, analyses: SavedAnalysis[]): ChatMemo {
  const facts = analyses
    .filter((a) => a.partnerId === partner.id)
    .slice(0, 3)
    .map((a) => `[${ANALYSIS_LABEL[a.type]}] ${a.summary}`.slice(0, 60));
  return { ...EMPTY, partner: [partner.alias, partner.note].filter(Boolean).join(' · ').slice(0, 120), facts };
}

/** 완전히 새로운 고민: 공통 데이터만. 사용자 본인 분석(성향·사주)은 요약으로 */
export function memoForNew(analyses: SavedAnalysis[]): ChatMemo {
  const facts = analyses
    .filter((a) => !a.partnerId && (a.type === 'trait' || a.type === 'saju'))
    .slice(0, 2)
    .map((a) => `[내 ${ANALYSIS_LABEL[a.type]}] ${a.summary}`.slice(0, 60));
  return { ...EMPTY, facts };
}
