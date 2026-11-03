import type { HubCharacter } from '../App';
import { CHARACTERS, nameOf, type Character } from '../data/characters';
import { Avatar } from '../components/CharacterRow';
import { isOn, setFlag } from '../lib/flags';
import { useSessionStore } from '../lib/sessions/context';
import { formatWhen, type Session } from '../lib/sessions/store';
import { AnalysisList } from '../components/AnalysesSheet';

// 대화 탭 — 캐릭터별 최근 세션 (화면설계서 §6.1). 탭하면 그 캐릭터의 가장 최근 세션으로.
export function TalkTab({ hub, onOpen, onResume }: { hub: HubCharacter; onOpen: (c: Character) => void; onResume: (c: Character, s: Session) => void }) {
  const store = useSessionStore();
  const latest = new Map<string, Session>();
  for (const s of store.listSessions()) if (!latest.has(s.character)) latest.set(s.character, s);
  const rows = [...latest.values()].sort((a, b) => b.updatedAt - a.updatedAt).map((s) => ({ s, c: CHARACTERS.find((x) => x.id === s.character)! })).filter((r) => r.c);
  return (
    <div className="talk">
      <h1 className="tab-title">대화</h1>
      {rows.length === 0 ? (
        <div className="card">
          <p>아직 대화가 없어요. 홈에서 캐릭터를 골라 시작해 보세요.</p>
        </div>
      ) : (
        <div className="list-card">
          {rows.map(({ s, c }, i) => {
            const last = [...s.messages].reverse().find((m) => m.role === 'assistant');
            const count = store.listSessions(c.id).length;
            return (
              <button key={c.id} className={`chat-list-row${i === rows.length - 1 ? ' last' : ''}`} onClick={() => onResume(c, s)} onContextMenu={(e) => (e.preventDefault(), onOpen(c))}>
                <Avatar c={c} size={52} />
                <span className="chat-list-text">
                  <strong>
                    {nameOf(c, hub)} <em className="ai-badge">AI</em>
                  </strong>
                  <span>{last?.content ?? s.title}</span>
                </span>
                <span className="chat-list-meta">
                  <span>{formatWhen(s.updatedAt)}</span>
                  {count > 1 && <em className="pill violet">{count}개 상담</em>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="foot-note">세션은 이 기기에만 저장돼요. 캐릭터를 길게 누르면 프로필이 열려요.</p>
    </div>
  );
}

export function IntroTab() {
  return (
    <div className="talk">
      <h1 className="tab-title">소개</h1>
      <div className="card">
        <p className="card-title">소개 서비스 (플래그 ON 상태)</p>
        <p>내 소개 프로필 · 추천 상대 카드 · 매칭 현황 · 소개팅 코치 바로가기가 들어올 자리예요.</p>
        <p className="hint">만남·소개팅 요건(실명 인증·신고 24h 대응·대화 저장·프로필 검증) 충족 후 활성화.</p>
      </div>
    </div>
  );
}

export function MyTab() {
  const store = useSessionStore();
  const intro = isOn('intro_tab');
  const analyses = store.listAnalyses();
  const sessions = store.listSessions();
  return (
    <div className="talk">
      <h1 className="tab-title">마이</h1>
      <div className="list-card">
        {['프로필 편집', '나의 연애 데이터', '저장된 분석', '크레딧', '알림', '설정', '고객센터', '이용약관 · 개인정보처리방침 · AI 이용 고지', '사업자 정보 (놀와이즈솔루션)'].map((t, i, a) => (
          <button key={t} className={`my-row${i === a.length - 1 ? ' last' : ''}`}>
            <span>{t}</span>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
      <div className="card dev-card">
        <p className="card-title">저장된 분석 ({analyses.length})</p>
        <AnalysisList items={analyses} />
      </div>
      <div className="card dev-card">
        <p className="card-title">데이터</p>
        <p>
          상담 세션 {sessions.length}개 · 상대 프로필 {store.listPartners().length}명 · 저장된 분석 {analyses.length}개
        </p>
        <button
          className="btn-text danger"
          onClick={() => {
            if (window.confirm('이 기기의 상담·상대·분석 데이터를 모두 삭제할까요?')) store.clearAll();
          }}
        >
          모든 데이터 삭제
        </button>
      </div>
      <div className="card dev-card">
        <p className="card-title">테스트 설정</p>
        <label className="check">
          <input
            type="checkbox"
            checked={intro}
            onChange={(e) => {
              setFlag('intro_tab', e.target.checked);
              window.location.reload();
            }}
          />
          소개 탭 플래그 (intro_tab) 켜기
        </label>
        <p className="hint">실서비스는 서버 원격 설정. 여기선 로컬 저장 후 새로고침.</p>
      </div>
    </div>
  );
}
