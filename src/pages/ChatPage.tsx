import { useEffect, useRef, useState } from 'react';
import type { HubCharacter, Screen } from '../App';
import { postApi } from '../lib/ai/client';
import { CARD_INFO, type Card, type ChatMemo, type Help } from '../lib/ai/chat';
import { useSessionStore } from '../lib/sessions/context';
import { titleFrom, type Session } from '../lib/sessions/store';
import ChatSidebar from '../components/ChatSidebar';
import { PERSONAS, genderOfHub, pick } from '../lib/ai/personas';
import { CrystalBall, TarotCardView, TarotPick } from '../components/Tarot';
import type { TarotDraw } from '../lib/tarot';
import { normalizeQuestion } from '../lib/tarot-normalize';
import { nameOf, type Character } from '../data/characters';
import { Avatar } from '../components/CharacterRow';
import type { Evidence } from '../lib/ai/saju-chat';
import type { SajuInput } from '../lib/saju';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  card?: Card;
  /** 예전 기록의 고정 안전 문구 표시용 */
  safety?: boolean;
  /** 서버가 위험 종류에 맞춰 붙인 도움 안내 */
  help?: Help | null;
  /** 타로: 이 질문에 서버가 뽑아 준 카드 (카드 그림·이름·방향은 이 값으로만 그린다) */
  tarot?: TarotDraw;
  /** 타로: 질문이 아니거나 범위 밖이라 카드를 쓰지 않은 회차 */
  voided?: boolean;
  /** 서화: 이 답에 쓰인 사주 근거 카드 (서버 계산값) */
  evidence?: Evidence[];
}

const EL_CLASS: Record<string, string> = { 목: 'el-wood', 화: 'el-fire', 토: 'el-earth', 금: 'el-metal', 수: 'el-water' };

type TarotStatus = 'reading' | 'need_question' | 'out_of_scope' | 'safety';
type DrawRes = { status: 'draw'; token: string; question: string } | { status: 'need_question' | 'safety'; question: string; reply: string; help?: Help | null };
type ReadRes = { status: TarotStatus; reply: string; card?: TarotDraw; help?: Help | null };
/** 지난 회차 기록 — 서버가 다시 정규화하고, 카드는 "지난 카드" 한 줄로만 쓴다 */
const tarotHistory = (list: Msg[]) => list.map(({ role, content, tarot }) => ({ role, content, ...(tarot ? { tarot: { index: tarot.index, reversed: tarot.reversed } } : {}) }));

const CARD_SCREEN: Record<Exclude<Card, 'none'>, Screen> = { kakao: 'kakao', compat: 'compat', fortune: 'saju', personality: 'personality' };

export default function ChatPage({
  hub,
  age,
  character,
  session,
  onSwitchSession,
  go,
  profile,
  birth = null,
  onOpenSaju,
  autoSend = null,
  onEvidence,
}: {
  hub: HubCharacter;
  /** 사용자 나이 (프로토타입 임시 입력, 없으면 null) */
  age: number | null;
  character: Character;
  session: Session;
  onSwitchSession: (s: Session) => void;
  go: (s: Screen) => void;
  profile: { type: string | null; dayPillar: string | null };
  /** 서화 전용: 내 출생 정보. 서버가 이 값으로 사주를 계산해 풀이 근거로 쓴다 */
  birth?: SajuInput | null;
  /** 서화 전용: 근거 카드에서 「사주 한눈에 보기」로 */
  onOpenSaju?: () => void;
  /** 대화가 비어 있을 때 한 번 자동으로 보낼 첫 질문 */
  autoSend?: string | null;
  /** 서화 전용: 가장 최근 답의 근거가 바뀌면 알려 준다 */
  onEvidence?: (e: Evidence[]) => void;
}) {
  const store = useSessionStore();
  const persona = PERSONAS[character.persona ?? (hub === '언니' ? 'hub-f' : 'hub-m')];
  const gender = genderOfHub(hub);
  const greet = pick(persona.greeting, gender);
  const guidePrompts = pick(persona.prompts, gender);
  // 서버가 돌려준 대화 메모(사용자가 말한 사실). 다음 요청에 그대로 돌려보내 맥락을 유지한다.
  // 세션에서 복원하고, 바뀔 때마다 세션에 저장한다 (원문 보관은 store 가 상한 관리).
  const [memo, setMemo] = useState<ChatMemo>(session.memo);
  const [msgs, setMsgs] = useState<Msg[]>(session.messages as Msg[]);
  const [sidebar, setSidebar] = useState(false);
  const [guide, setGuide] = useState(false);
  // 타로: 서버가 질문을 정규화하고 카드를 뽑아 토큰으로 돌려준다 → 5장 중 하나를 고르면 공개 → 해석 요청
  const [pendingTarot, setPendingTarot] = useState<{ token: string; question: string } | null>(null);
  // 타로: 해석 요청이 실패했을 때 같은 카드로 다시 요청하기 위한 토큰
  const [retryToken, setRetryToken] = useState<string | null>(null);
  const isTarot = persona.id === 'tarot';
  // 입력창 가이드: 캐릭터별 예시를 돌아가며 보여준다 (피드백 11/11)
  const placeholder = msgs.filter((m) => m.role === 'user').length === 0 ? `예) ${guidePrompts[0]}` : '고민을 적어 주세요';
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, loading, pendingTarot]);

  const send = async () => {
    const typed = input.trim();
    if (!typed || loading) return;
    setInput(''); // 보내면 입력창을 비운다 (실패 시 되돌림)
    if (isTarot) return void tarotDraw(typed);
    await submit(typed, typed);
  };

  const persist = (all: Msg[], typed: string, userTurnsBefore: number, nextMemo: ChatMemo = memo) =>
    store.updateSession(session.id, {
      messages: all,
      memo: nextMemo,
      ...(session.title === '새 상담' && userTurnsBefore === 0 ? { title: titleFrom(typed) } : {}),
    });

  /** 타로 [1] 질문 → 서버가 정규화·추첨 (카드는 아직 안 온다). 질문이 아니면 카드 없이 바로 답 */
  const tarotDraw = async (typed: string) => {
    setLoading(true);
    setError(null);
    setRetryToken(null);
    try {
      const r = await postApi<DrawRes>('/api/tarot', { action: 'draw', question: typed });
      if (r.status === 'draw') {
        setPendingTarot({ token: r.token, question: r.question });
        return;
      }
      const all: Msg[] = [...msgs, { role: 'user', content: r.question, voided: true }, { role: 'assistant', content: r.reply, help: r.help ?? null }];
      setMsgs(all);
      persist(all, r.question, msgs.filter((m) => m.role === 'user').length);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setInput(typed);
    } finally {
      setLoading(false);
    }
  };

  /** 타로 [3] 카드 공개 뒤 해석 요청. 실패하면 카드는 그대로 두고 같은 토큰으로 다시 요청할 수 있다 */
  const tarotRead = async (token: string, base: Msg[]) => {
    setLoading(true);
    setError(null);
    setRetryToken(null);
    try {
      const r = await postApi<ReadRes>('/api/tarot', { action: 'read', token, history: tarotHistory(base.slice(0, -1)) });
      const mine = base[base.length - 1];
      // reading 이 아니면 이 회차의 카드는 무효 — 말풍선에서 카드를 지운다
      const user: Msg = r.status === 'reading' ? mine : { role: 'user', content: mine.content, voided: true };
      const all: Msg[] = [...base.slice(0, -1), user, { role: 'assistant', content: r.reply, help: r.help ?? null }];
      setMsgs(all);
      persist(all, mine.content, base.filter((m) => m.role === 'user').length - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRetryToken(token);
    } finally {
      setLoading(false);
    }
  };

  const tarotPicked = (card: TarotDraw) => {
    if (!pendingTarot) return;
    const base: Msg[] = [...msgs, { role: 'user', content: pendingTarot.question, tarot: card }];
    setMsgs(base);
    setPendingTarot(null);
    void tarotRead(pendingTarot.token, base);
  };

  const submit = async (typed: string, text: string) => {
    const userTurnsBefore = msgs.filter((m) => m.role === 'user').length;
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setLoading(true);
    setError(null);
    try {
      const shownCards = msgs.flatMap((m) => (m.card && m.card !== 'none' ? [m.card] : []));
      const r = await postApi<{ reply: string; card: Card; memo: ChatMemo; safety: { category: string; help?: Help | null } | null; evidence?: Evidence[] }>('/api/chat', {
        hub,
        userAge: age,
        character: persona.id,
        profile,
        memo,
        shownCards,
        ...(birth ? { birth } : {}),
        messages: next.map(({ role, content }) => ({ role, content })),
      });
      const all: Msg[] = [...next, { role: 'assistant', content: r.reply, card: r.card, help: r.safety?.help ?? null, ...(r.evidence?.length ? { evidence: r.evidence } : {}) }];
      if (r.memo) setMemo(r.memo);
      if (r.evidence?.length) onEvidence?.(r.evidence);
      setMsgs(all);
      persist(all, typed, userTurnsBefore, r.memo ?? memo);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMsgs(msgs); // 실패한 메시지는 입력창으로 되돌림
      setInput(typed);
    } finally {
      setLoading(false);
    }
  };

  // 「서화에게 내 사주 풀어보기」로 들어오면 첫 질문을 대신 보내 준다 (빈 대화에서 한 번만)
  const autoSent = useRef(false);
  useEffect(() => {
    if (!autoSend || autoSent.current || msgs.length > 0) return;
    autoSent.current = true;
    void submit(autoSend, autoSend);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- autoSend 가 들어온 순간에만 실행
  }, [autoSend]);

  const who = nameOf(character, hub);

  return (
    <div className={`chat${pendingTarot ? ' tarot-dark' : ''}`}>
      <div className="chat-head">
        <Avatar c={character} size={44} />
        <div>
          <strong>{who}</strong>
          <span>{session.title === '새 상담' ? character.tagline : session.title}</span>
        </div>
        <button className="icon-btn" onClick={() => setSidebar(true)} aria-label="상담 목록">
          ☰
        </button>
      </div>
      {session.origin !== 'new' && msgs.length === 0 && (
        <p className="hint center">
          {session.origin === 'continue' ? '이전 상담의 요약을 가지고 시작해요.' : session.origin === 'partner' ? `${memo.partner || '그 사람'}에 대한 새 고민이에요.` : '다른 캐릭터에서 넘어온 상담이에요.'}
        </p>
      )}
      <p className="hint center">{birth ? 'AI가 내 사주 정보를 바탕으로 작성한 풀이예요. 대화는 이 기기에만 저장돼요.' : 'AI가 답하는 대화예요. 대화는 이 기기에만 저장돼요.'}</p>
      <div className="chat-list">
        <Bubble who={who} text={greet} />
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="chat-row me">
              {/* 타로: 예전 기록에 남은 [카드: …] 표기는 화면에 보이지 않게 정규화해서 그린다 */}
              <div className="chat-bubble me">{isTarot ? normalizeQuestion(m.content).text || m.content : m.content}</div>
              {m.tarot && !m.voided && <TarotCardView card={m.tarot} />}
            </div>
          ) : (
            <div key={i}>
              <Bubble who={who} text={m.content} safety={m.safety} />
              {m.help && <HelpCard help={m.help} />}
              {m.evidence && m.evidence.length > 0 && <EvidenceCards items={m.evidence} onOpenSaju={onOpenSaju} />}
              {m.card && m.card !== 'none' && (
                <div className="intro-card">
                  <div className="intro-who">{CARD_INFO[m.card].who} 소개</div>
                  <strong>{CARD_INFO[m.card].title}</strong>
                  <p>{CARD_INFO[m.card].desc}</p>
                  <button className="btn-secondary" onClick={() => go(CARD_SCREEN[m.card as Exclude<Card, 'none'>])}>
                    소개받기
                  </button>
                </div>
              )}
            </div>
          ),
        )}
        {pendingTarot && (
          <>
            <div className="chat-row me">
              <div className="chat-bubble me">{pendingTarot.question}</div>
            </div>
            <TarotPick
              key={pendingTarot.token}
              reveal={async () => (await postApi<{ card: TarotDraw }>('/api/tarot', { action: 'reveal', token: pendingTarot.token })).card}
              onPick={tarotPicked}
            />
          </>
        )}
        {loading && (isTarot && msgs[msgs.length - 1]?.tarot ? <CrystalBall /> : <Bubble who={who} text="…" />)}
        {retryToken && !loading && (
          <div className="guide-row">
            <button className="btn-secondary" onClick={() => void tarotRead(retryToken, msgs)}>
              같은 카드로 다시 해석 받기
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {error && <p className="error">{error}</p>}
      {msgs.filter((m) => m.role === 'user').length === 0 && !pendingTarot && (
        <div className="guide-row">
          <button className="btn-text" onClick={() => setGuide(true)}>
            ⓘ 어떤 고민을 털어놓으면 좋을까?
          </button>
        </div>
      )}
      {guide && (
        <div className="sheet-backdrop" onClick={() => setGuide(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="고민 예시">
            <div className="sheet-handle" />
            <h3>{who}에게 이렇게 말해 보세요</h3>
            <p className="hint">탭하면 입력창에 들어가요. 상황·상대·내가 걸리는 점을 함께 적으면 더 정확해져요.</p>
            {guidePrompts.map((t) => (
              <button
                key={t}
                className="sheet-row"
                onClick={() => {
                  setInput(t);
                  setGuide(false);
                }}
              >
                <strong>{t}</strong>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="chat-input">
        <textarea
          rows={1}
          maxLength={500}
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn-primary" disabled={!input.trim() || loading || !!pendingTarot} onClick={send}>
          보내기
        </button>
      </div>
      {sidebar && (
        <ChatSidebar
          c={character}
          name={who}
          current={session}
          onClose={() => setSidebar(false)}
          onSwitch={(s) => {
            setSidebar(false);
            onSwitchSession(s);
          }}
        />
      )}
    </div>
  );
}

/** 서화: 풀이 근거 — 글자·숫자는 서버가 계산한 값만 그린다 */
function EvidenceCards({ items, onOpenSaju }: { items: Evidence[]; onOpenSaju?: () => void }) {
  return (
    <div className="evidence" role="note" aria-label="풀이 근거">
      <div className="evidence-head">
        <strong>풀이 근거</strong>
        {onOpenSaju && (
          <button className="btn-text" onClick={onOpenSaju}>
            사주 한눈에 보기 ›
          </button>
        )}
      </div>
      <div className="evidence-list">
        {items.map((e) => (
          <div key={e.key} className="evidence-card">
            {e.glyph && <span className={`evidence-glyph ${EL_CLASS[e.glyph.element] ?? ''}`}>{e.glyph.hanja}</span>}
            <div className="evidence-body">
              <span className="evidence-title">{e.title}</span>
              <span className="evidence-text">{e.text}</span>
              {e.elements && (
                <div className="evidence-bars">
                  {Object.entries(e.elements).map(([el, n]) => (
                    <span key={el} className="evidence-bar">
                      <i className={EL_CLASS[el] ?? ''} style={{ height: `${Math.min(n, 5) * 6 + 2}px` }} />
                      <small>
                        {el}
                        {n}
                      </small>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 위험 종류에 맞는 도움 안내 — 캐릭터 답과 따로, 서버가 정한 연락처만 보여 준다 */
function HelpCard({ help }: { help: Help }) {
  return (
    <div className="help-card" role="note">
      <strong>{help.title}</strong>
      <ul>
        {help.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

/** 답변의 빈 줄은 말풍선 구분 (캐릭터별 답변 형식) */
function Bubble({ who, text, safety }: { who: string; text: string; safety?: boolean }) {
  const parts = safety ? [text] : text.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean).slice(0, 6);
  return (
    <div className="chat-row">
      <div className="chat-who">
        {who} <span className="ai-badge">{safety ? '안내' : 'AI'}</span>
      </div>
      {(parts.length ? parts : [text]).map((t, i) => (
        <div key={i} className={`chat-bubble ${safety ? 'safety' : ''}${i > 0 ? ' cont' : ''}`}>
          {t}
        </div>
      ))}
    </div>
  );
}
