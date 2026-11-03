import { useState } from 'react';
import { useSessionStore } from '../lib/sessions/context';
import type { AnalysisType } from '../lib/sessions/store';

/**
 * 결과 화면의 [저장] — 저장된 분석(공통 자산)에 편입. 원문이 아니라 요약만 다른 세션에 주입된다.
 * partnerAlias 가 있으면 상대 프로필(별칭)에 연결한다.
 */
export default function SaveAnalysisButton({
  type,
  sourceCharacter,
  title,
  summary,
  data,
  partnerAlias,
}: {
  type: AnalysisType;
  sourceCharacter: string;
  title: string;
  summary: string;
  data?: unknown;
  partnerAlias?: string;
}) {
  const store = useSessionStore();
  const [saved, setSaved] = useState(false);
  const [alias, setAlias] = useState(partnerAlias ?? '');
  const needsAlias = type === 'match' || type === 'kakao';
  const save = () => {
    const partner = needsAlias && alias.trim() ? store.upsertPartner(alias) : undefined;
    store.saveAnalysis({ type, sourceCharacter, title: partner ? `${title} — ${partner.alias}` : title, summary: summary.slice(0, 160), data, partnerId: partner?.id });
    setSaved(true);
  };
  if (saved) return <p className="hint center">✓ 저장했어요. 다른 캐릭터와 대화할 때 요약으로 참고돼요.</p>;
  return (
    <div className="save-box">
      {needsAlias && (
        <input className="text-input" placeholder="상대 별칭 (예: 지훈) — 실명 대신" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={20} />
      )}
      <button className="btn-secondary" onClick={save} disabled={needsAlias && !alias.trim()}>
        📋 이 결과 저장하기
      </button>
    </div>
  );
}
