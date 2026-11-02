import type { HubCharacter } from '../App';
import { CHARACTERS, nameOf, type Character } from '../data/characters';
import { Avatar } from '../components/CharacterRow';
import { isOn, setFlag } from '../lib/flags';

// 대화 탭 — 최근 대화 목록 (프로토타입: 세션 저장이 없으므로 예시 데이터)
const SAMPLE: { id: string; last: string; when: string; badge?: string }[] = [
  { id: 'hub', last: '어제 연락은 결국 안 했어?', when: '오후 9:12', badge: '1' },
  { id: 'yeosachin', last: '답장 분석 결과 나왔어', when: '오후 6:40', badge: '결과' },
  { id: 'compat-master', last: '두 사람의 갈등 궁합 결과가 나왔어요', when: '어제', badge: '결과' },
  { id: 'teacher', last: '애착유형 결과를 같이 볼까?', when: '2일 전' },
  { id: 'soeun', last: '그 답장은 이렇게 보는 게 맞아', when: '3일 전' },
];

export function TalkTab({ hub, onOpen }: { hub: HubCharacter; onOpen: (c: Character) => void }) {
  return (
    <div className="talk">
      <h1 className="tab-title">대화</h1>
      <div className="list-card">
        {SAMPLE.map((s, i) => {
          const c = CHARACTERS.find((x) => x.id === s.id)!;
          return (
            <button key={s.id} className={`chat-list-row${i === SAMPLE.length - 1 ? ' last' : ''}`} onClick={() => onOpen(c)}>
              <Avatar c={c} size={52} />
              <span className="chat-list-text">
                <strong>
                  {nameOf(c, hub)} <em className="ai-badge">AI</em>
                </strong>
                <span>{s.last}</span>
              </span>
              <span className="chat-list-meta">
                <span>{s.when}</span>
                {s.badge && <em className={s.badge === '결과' ? 'pill violet' : 'pill pink'}>{s.badge}</em>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="foot-note">예시 데이터예요. 세션 저장·사이드바는 다음 단계에서 붙여요.</p>
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
  const intro = isOn('intro_tab');
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
