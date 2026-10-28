import { useEffect, useRef, useState } from 'react';
import type { HubCharacter, Screen } from '../App';
import { postApi } from '../lib/ai/client';
import { CARD_INFO, EMPTY_MEMO, greetingOf, type Card, type ChatMemo } from '../lib/ai/chat';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  card?: Card;
  safety?: boolean;
}

const CARD_SCREEN: Record<Exclude<Card, 'none'>, Screen> = { kakao: 'kakao', compat: 'compat', fortune: 'saju', personality: 'personality' };

export default function ChatPage({
  hub,
  go,
  profile,
}: {
  hub: HubCharacter;
  go: (s: Screen) => void;
  profile: { type: string | null; dayPillar: string | null };
}) {
  const greet = greetingOf(hub);
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
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const shownCards = msgs.flatMap((m) => (m.card && m.card !== 'none' ? [m.card] : []));
      const r = await postApi<{ reply: string; card: Card; memo: ChatMemo; safety: { category: string } | null }>('/api/chat', {
        hub,
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
      setInput(text);
    } finally {
      setLoading(false);
    }
  };

  const who = hub === '형' ? '🧢 아는 형' : '🎀 아는 언니';

  return (
    <div className="chat">
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
