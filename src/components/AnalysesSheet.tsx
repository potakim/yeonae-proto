import { CHARACTERS } from '../data/characters';
import { useSessionStore } from '../lib/sessions/context';
import { ANALYSIS_LABEL, formatWhen, type SavedAnalysis } from '../lib/sessions/store';

/** 저장된 분석 목록 — 캐릭터 종속이 아닌 공통 자산. sourceCharacter 는 라벨로만. */
export function AnalysisList({ items, compact }: { items: SavedAnalysis[]; compact?: boolean }) {
  const store = useSessionStore();
  if (items.length === 0) return <p className="empty">아직 저장된 분석이 없어요. 궁합·성향·카톡 결과 아래 [저장]을 눌러 보세요.</p>;
  return (
    <ul className="analysis-list">
      {items.map((a) => {
        const src = CHARACTERS.find((c) => c.id === a.sourceCharacter);
        return (
          <li key={a.id}>
            <div className="analysis-head">
              <span className={`pill ${a.type === 'match' || a.type === 'saju' || a.type === 'fortune' ? 'violet' : 'pink'}`}>{ANALYSIS_LABEL[a.type]}</span>
              <strong>{a.title}</strong>
              <span className="muted">
                {src?.name ?? a.sourceCharacter} · {formatWhen(a.createdAt)}
              </span>
            </div>
            {!compact && <p>{a.summary}</p>}
            {!compact && (
              <button className="btn-text danger" onClick={() => store.deleteAnalysis(a.id)}>
                삭제
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function AnalysesSheet({ sourceCharacter, onClose }: { sourceCharacter?: string; onClose: () => void }) {
  const store = useSessionStore();
  const all = store.listAnalyses();
  const mine = sourceCharacter ? all.filter((a) => a.sourceCharacter === sourceCharacter) : all;
  const others = sourceCharacter ? all.filter((a) => a.sourceCharacter !== sourceCharacter) : [];
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="저장된 분석">
        <div className="sheet-handle" />
        <h3>{sourceCharacter ? '이 캐릭터가 만든 분석' : '저장된 분석'}</h3>
        <AnalysisList items={mine} />
        {others.length > 0 && (
          <>
            <h3>다른 캐릭터의 분석 (공통)</h3>
            <AnalysisList items={others} compact />
          </>
        )}
      </div>
    </div>
  );
}
