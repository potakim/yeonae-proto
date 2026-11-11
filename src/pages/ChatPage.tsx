import { useEffect, useRef, useState } from 'react';
import type { HubCharacter, Screen } from '../App';
import { postApi } from '../lib/ai/client';
import { CARD_INFO, type Card, type ChatMemo } from '../lib/ai/chat';
import { useSessionStore } from '../lib/sessions/context';
import { titleFrom, type Session } from '../lib/sessions/store';
import ChatSidebar from '../components/ChatSidebar';
import { PERSONAS } from '../lib/ai/personas';
import { TarotCardView, TarotPick } from '../components/Tarot';
import type { TarotDraw } from '../lib/tarot';
import { nameOf, type Character } from '../data/characters';
import { Avatar } from '../components/CharacterRow';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  card?: Card;
  safety?: boolean;
  /** 타로: 이 질문에 뽑힌 카드 (content 에는 [카드: …] 태그로 들어가 서버로 감) */
  tarot?: TarotDraw;
}

const TAROT_TAG = /\n?\[카드:.*?\]$/;

const CARD_SCREEN: Record<Exclude<Card, 'none'>, Screen> = { kakao: 'kakao', compat: 'compat', fortune: 'saju', personality: 'personality' };

export default function ChatPage({
  hub,
  character,
  session,
  onSwitchSession,
  go,
  profile,
}: {
  hub: HubCharacter;
  character: Character;
  session: Session;
  onSwitchSession: (s: Session) => void;
  go: (s: Screen) => void;
  profile: { type: string | null; dayPillar: string | null };
}) {
  const store = useSessionStore();
  const persona = PERSONAS[character.persona ?? (hub === '언니' ? 'hub-f' : 'hub-m')];
  const greet = persona.greeting;
  // 서버가 돌려준 대화 메모(사용자가 말한 사실). 다음 요청에 그대로 돌려보내 맥락을 유지한다.
  // 세션에서 복원하고, 바뀔 때마다 세션에 저장한다 (원문 보관은 store 가 상한 관리).
  const [memo, setMemo] = useState<ChatMemo>(session.memo);
  const [msgs, setMsgs] = useState<Msg[]>(session.messages as Msg[]);
  const [sidebar, setSidebar] = useState(false);
  const [guide, setGuide] = useState(false);
  // 타로: 질문을 먼저 보여주고 카드 5장 중 하나를 고르게 한 뒤 전송
  const [pendingTarot, setPendingTarot] = useState<string | null>(null);
  // 입력창 가이드: 캐릭터별 예시를 돌아가며 보여준다 (피드백 11/11)
  const placeholder = msgs.filter((m) => m.role === 'user').length === 0 ? `예) ${persona.prompts[0]}` : '고민을 적어 주세요';
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, loading]);

  const send = async () => {
    const typed = input.trim();
    if (!typed || loading) return;
    if (persona.id === 'tarot') {
      // 카드 선택 단계로 — 카드는 코드가 뽑고, 선택 후 submit() 이 태그를 붙여 보낸다
      setPendingTarot(typed);
      setInput('');
      return;
    }
    await submit(typed, typed);
  };

  const submit = async (typed: string, text: string, tarot?: TarotDraw) => {
    const userTurnsBefore = msgs.filter((m) => m.role === 'user').length;
    const next: Msg[] = [...msgs, { role: 'user', content: text, ...(tarot ? { tarot } : {}) }];
    setMsgs(next);
    setPendingTarot(null);
    setLoading(true);
    setError(null);
    try {
      const shownCards = msgs.flatMap((m) => (m.card && m.card !== 'none' ? [m.card] : []));
      const r = await postApi<{ reply: string; card: Card; memo: ChatMemo; safety: { category: string } | null }>('/api/chat', {
        hub,
        character: persona.id,
        profile,
        memo,
        shownCards,
        messages: next.map(({ role, content }) => ({ role, content })),
      });
      const all: Msg[] = [...next, { role: 'assistant', content: r.reply, card: r.card, safety: !!r.safety }];
      if (r.memo) setMemo(r.memo);
      setMsgs(all);
      store.updateSession(session.id, {
        messages: all,
        memo: r.memo ?? memo,
        ...(session.title === '새 상담' && userTurnsBefore === 0 ? { title: titleFrom(typed) } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMsgs(msgs); // 실패한 메시지는 입력창으로 되돌림
      setInput(typed);
    } finally {
      setLoading(false);
    }
  };

  const who = nameOf(character, hub);

  return (
    <div className="chat">
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
      <p className="hint center">AI가 답하는 대화예요. 대화는 이 기기에만 저장돼요.</p>
      <div className="chat-list">
        <Bubble who={who} text={greet} />
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="chat-row me">
              <div className="chat-bubble me">{m.tarot ? m.content.replace(TAROT_TAG, '') : m.content}</div>
              {m.tarot && <TarotCardView card={m.tarot} />}
            </div>
          ) : (
            <div key={i}>
              <Bubble who={who} text={m.content} safety={m.safety} />
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
              <div className="chat-bubble me">{pendingTarot}</div>
            </div>
            <TarotPick onPick={(c) => void submit(pendingTarot, `${pendingTarot}\n[카드: ${c.name} (${c.reversed ? '역방향' : '정방향'})]`, c)} />
          </>
        )}
        {loading && <Bubble who={who} text="…" />}
        <div ref={endRef} />
      </div>
      {error && <p className="error">{error}</p>}
      {msgs.filter((m) => m.role === 'user').length === 0 && (
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
            {persona.prompts.map((t) => (
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

function Bubble({ who, text, safety }: { who: string; text: string; safety?: boolean }) {
  return (
    <div className="chat-row">
      <div className="chat-who">
        {who} <span className="ai-badge">{safety ? '안내' : 'AI'}</span>
      </div>
      <div className={`chat-bubble ${safety ? 'safety' : ''}`}>{text}</div>
    </div>
  );
}
