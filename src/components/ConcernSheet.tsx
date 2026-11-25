import { CONCERN_TOPICS } from '../data/concerns';

/** 고민 전체 목록 — 주제별로 고르면 그 문장으로 상담을 시작한다 */
export default function ConcernSheet({ who, onPick, onClose }: { who: string; onPick: (text: string) => void; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet concern-sheet" role="dialog" aria-label="고민 고르기" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden />
        <h3>어떤 고민이에요?</h3>
        <p className="hint">고르면 {who}에게 그 말로 상담을 시작해요.</p>
        <div className="concern-list">
          {CONCERN_TOPICS.map((t) => (
            <div key={t.topic} className="concern-topic">
              <h4>{t.topic}</h4>
              <div className="concern-items">
                {t.items.map((x) => (
                  <button key={x} className="chip-btn" onClick={() => onPick(x)}>
                    {x}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button className="btn-text" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
