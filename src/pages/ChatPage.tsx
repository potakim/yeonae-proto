import { useEffect, useRef, useState } from 'react';
import type { HubCharacter, Screen } from '../App';
import { postApi } from '../lib/ai/client';
import { CARD_INFO, EMPTY_MEMO, type Card, type ChatMemo } from '../lib/ai/chat';
import { PERSONAS, drawTarot } from '../lib/ai/personas';
import { nameOf, type Character } from '../data/characters';
import { Avatar } from '../components/CharacterRow';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  card?: Card;
  safety?: boolean;
}

const CARD_SCREEN: Record<Exclude<Card, 'none'>, Screen> = { kakao: 'kakao', compat: 'compat', fortune: 'saju', personality: 'personality' };

export default function ChatPage({
  hub,
  character,
  go,
  profile,
}: {
  hub: HubCharacter;
  character: Character;
  go: (s: Screen) => void;
  profile: { type: string | null; dayPillar: string | null };
}) {
  const persona = PERSONAS[character.persona ?? (hub === '언니' ? 'hub-f' : 'hub-m')];
  const greet = persona.greeting;
  // 서버가 돌려준 대화 메모(사용자가 말한 사실). 다음 요청에 그대로 돌려보내 맥락을 유지한다
  const [memo, setMemo] = useState<ChatMemo>(EMPTY_MEMO);
  const [msgs, setMsgs] = useState<Msg[]>([]);
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
    // 타로: 카드는 코드가 뽑아 사용자 메시지에 붙인다 (LLM 이 임의로 뽑지 못하게)
    const text = persona.id === 'tarot' ? `${typed}\n[카드: ${(({ name, reversed }) => `${name} (${reversed ? '역방향' : '정방향'})`)(drawTarot())}]` : typed;
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setInput('');
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
      if (r.memo) setMemo(r.memo);
      setMsgs([...next, { role: 'assistant', content: r.reply, card: r.card, safety: !!r.safety }]);
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
          <span>{character.tagline}</span>
        </div>
      </div>
      <p className="hint center">AI가 답하는 대화예요. 대화 내용은 저장하지 않아요.</p>
      <div className="chat-list">
        <Bubble who={who} text={greet} />
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="chat-row me">
              <div className="chat-bubble me">{m.content}</div>
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
        {loading && <Bubble who={who} text="…" />}
        <div ref={endRef} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="chat-input">
        <textarea
          rows={1}
          maxLength={500}
          placeholder="고민을 적어 주세요"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn-primary" disabled={!input.trim() || loading} onClick={send}>
          보내기
        </button>
      </div>
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
