import { useState } from 'react';
import type { Character } from '../data/characters';
import { useSessionStore } from '../lib/sessions/context';
import { formatWhen, type Session } from '../lib/sessions/store';
import { AnalysisList } from './AnalysesSheet';
import SessionSheet from './SessionSheet';

/** 대화방 사이드바 (화면설계서 §7.2) */
export default function ChatSidebar({
  c,
  name,
  current,
  onSwitch,
  onClose,
}: {
  c: Character;
  name: string;
  current: Session;
  onSwitch: (s: Session) => void;
  onClose: () => void;
}) {
  const store = useSessionStore();
  const [sheet, setSheet] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const sessions = store.listSessions(c.id);
  const analyses = store.listAnalyses();
  const partnerAnalyses = current.partnerId ? analyses.filter((a) => a.partnerId === current.partnerId) : [];

  const rename = (s: Session) => {
    const t = window.prompt('상담 이름', s.title);
    if (t && t.trim()) store.updateSession(s.id, { title: t.trim().slice(0, 30) });
    setMenuFor(null);
  };
  const remove = (s: Session) => {
    if (!window.confirm('이 상담의 대화를 삭제할까요? 저장된 분석은 남아요.')) return;
    store.deleteSession(s.id);
    setMenuFor(null);
    if (s.id === current.id) {
      const next = store.listSessions(c.id)[0];
      if (next) onSwitch(next);
      else setSheet(true);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="상담 목록">
        <div className="drawer-head">
          <strong>☰ {name}</strong>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <h4>새로운 상담</h4>
        <button className="drawer-row primary" onClick={() => setSheet(true)}>
          ＋ 새로운 상담 시작
        </button>

        <h4>이전 상담</h4>
        {sessions.map((s) => (
          <div key={s.id} className={`drawer-session${s.id === current.id ? ' active' : ''}`}>
            <button className="drawer-row" onClick={() => onSwitch(s)} onContextMenu={(e) => (e.preventDefault(), setMenuFor(s.id))}>
              <span className="drawer-title">
                {s.pinned && '📌 '}
                {s.title}
              </span>
              <span className="muted">{formatWhen(s.updatedAt)}</span>
            </button>
            <button className="icon-btn small" onClick={() => setMenuFor(menuFor === s.id ? null : s.id)} aria-label="메뉴">
              ⋯
            </button>
            {menuFor === s.id && (
              <div className="drawer-menu">
                <button onClick={() => rename(s)}>이름 변경</button>
                <button onClick={() => (store.updateSession(s.id, { pinned: !s.pinned }), setMenuFor(null))}>{s.pinned ? '고정 해제' : '고정'}</button>
                <button className="danger" onClick={() => remove(s)}>
                  삭제
                </button>
              </div>
            )}
          </div>
        ))}

        <h4>저장된 분석</h4>
        {current.partnerId && partnerAnalyses.length > 0 && (
          <>
            <p className="hint">이 상담의 상대와 관련</p>
            <AnalysisList items={partnerAnalyses} compact />
          </>
        )}
        <AnalysisList items={analyses.filter((a) => !partnerAnalyses.includes(a)).slice(0, 8)} compact />

        <h4>
          <button className="btn-text" onClick={() => setMemoOpen((o) => !o)}>
            이 세션이 기억하는 것 {memoOpen ? '▴' : '▾'}
          </button>
        </h4>
        {memoOpen && (
          <div className="memo-box">
            <p>
              <b>상황</b> {current.memo.situation} · <b>고민</b> {current.memo.concern || '—'}
            </p>
            <p>
              <b>상대</b> {current.memo.partner || '—'}
            </p>
            <ul>{current.memo.facts.map((f) => <li key={f}>{f}</li>)}</ul>
            <button className="btn-text danger" onClick={() => store.updateSession(current.id, { memo: { situation: '모름', concern: '', partner: '', facts: [] } })}>
              기억 지우기
            </button>
          </div>
        )}
        <p className="hint">기기에만 저장돼요 (프로토타입). 실서비스는 암호화 저장 · 30일 후 파기.</p>
      </aside>
      {sheet && (
        <SessionSheet
          c={c}
          onClose={() => setSheet(false)}
          onStart={(s) => {
            setSheet(false);
            onSwitch(s);
          }}
        />
      )}
    </div>
  );
}
