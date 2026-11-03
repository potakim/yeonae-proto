import { useState } from 'react';
import type { Character } from '../data/characters';
import { useSessionStore } from '../lib/sessions/context';
import { ANALYSIS_LABEL, formatWhen, memoForContinue, memoForNew, memoForPartner, type Partner, type Session } from '../lib/sessions/store';

type Step = 'menu' | 'partner' | 'continue' | 'resume';

/**
 * 세션 선택 시트 (화면설계서 §7.1)
 *  - 새로운 상담: 완전히 새로운 고민 / 이전 상대에 대한 새로운 고민 / 이전 상담에서 이어서
 *  - 이전 상담 이어하기
 */
export default function SessionSheet({ c, onStart, onClose }: { c: Character; onStart: (s: Session) => void; onClose: () => void }) {
  const store = useSessionStore();
  const [step, setStep] = useState<Step>('menu');
  const [alias, setAlias] = useState('');
  const [note, setNote] = useState('');
  const sessions = store.listSessions(c.id);
  const partners = store.listPartners();
  const analyses = store.listAnalyses();

  const startNew = () => onStart(store.createSession({ character: c.id, title: '새 상담', origin: 'new', memo: memoForNew(analyses) }));
  const startPartner = (p: Partner) =>
    onStart(store.createSession({ character: c.id, title: `${p.alias} 이야기`, origin: 'partner', partnerId: p.id, memo: memoForPartner(p, store.listAnalyses()) }));
  const addPartner = () => startPartner(store.upsertPartner(alias, note.trim() || undefined));
  const startContinue = (parent: Session) =>
    onStart(store.createSession({ character: c.id, title: `${parent.title} (이어서)`, origin: 'continue', parentId: parent.id, partnerId: parent.partnerId, memo: memoForContinue(parent) }));

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="상담 선택">
        <div className="sheet-handle" />
        {step === 'menu' && (
          <>
            <h3>새로운 상담</h3>
            <button className="sheet-row" onClick={startNew}>
              <strong>완전히 새로운 고민</strong>
              <span>내 성향·사주 요약만 가지고 시작해요</span>
            </button>
            <button className="sheet-row" onClick={() => setStep('partner')}>
              <strong>이전 상대에 대한 새로운 고민</strong>
              <span>상대 프로필과 그 사람 관련 저장 분석을 불러와요</span>
            </button>
            <button className="sheet-row" disabled={sessions.length === 0} onClick={() => setStep('continue')}>
              <strong>이전 상담에서 이어서</strong>
              <span>{sessions.length ? '선택한 상담의 요약을 가지고 새 세션을 열어요' : '아직 이전 상담이 없어요'}</span>
            </button>
            {sessions.length > 0 && (
              <>
                <h3>이전 상담 이어하기</h3>
                {sessions.slice(0, 5).map((s) => (
                  <button key={s.id} className="sheet-row" onClick={() => onStart(s)}>
                    <strong>{s.title}</strong>
                    <span>
                      {formatWhen(s.updatedAt)} · {s.messages.length}개 메시지
                    </span>
                  </button>
                ))}
              </>
            )}
          </>
        )}

        {step === 'partner' && (
          <>
            <button className="btn-text" onClick={() => setStep('menu')}>
              ‹ 뒤로
            </button>
            <h3>어떤 상대 얘기예요?</h3>
            {partners.map((p) => {
              const n = analyses.filter((a) => a.partnerId === p.id);
              return (
                <button key={p.id} className="sheet-row" onClick={() => startPartner(p)}>
                  <strong>{p.alias}</strong>
                  <span>{n.length ? n.map((a) => ANALYSIS_LABEL[a.type]).join(' · ') : p.note || '저장된 분석 없음'}</span>
                </button>
              );
            })}
            <div className="sheet-form">
              <input className="text-input" placeholder="새 상대 별칭 (실명 대신)" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={20} />
              <input className="text-input" placeholder="관계 (예: 3개월 썸, 전남친)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={40} />
              <button className="btn-primary" disabled={!alias.trim()} onClick={addPartner}>
                이 상대로 시작
              </button>
            </div>
          </>
        )}

        {step === 'continue' && (
          <>
            <button className="btn-text" onClick={() => setStep('menu')}>
              ‹ 뒤로
            </button>
            <h3>어느 상담에서 이어갈까요?</h3>
            {sessions.map((s) => (
              <button key={s.id} className="sheet-row" onClick={() => startContinue(s)}>
                <strong>{s.title}</strong>
                <span>
                  {formatWhen(s.updatedAt)} · {s.memo.concern || '고민 미정리'}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
