import { useCallback, useState } from 'react';
import Home from './pages/Home';
import SajuPage from './pages/SajuPage';
import PersonalityPage from './pages/PersonalityPage';
import ChatPage from './pages/ChatPage';
import CompatPage from './pages/CompatPage';
import KakaoPage from './pages/KakaoPage';
import CharacterProfile from './pages/CharacterProfile';
import { IntroTab, MyTab, TalkTab } from './pages/TabStubs';
import BottomTab, { type Tab } from './components/BottomTab';
import { calculateSaju, type SajuInput } from './lib/saju';
import { hubOf, nameOf, type Character } from './data/characters';
import { useFavorites } from './lib/favorites';
import { SessionProvider, useSessionStore } from './lib/sessions/context';
import { memoForNew, type Session } from './lib/sessions/store';
import SessionSheet from './components/SessionSheet';
import AnalysesSheet from './components/AnalysesSheet';

export type Screen = 'home' | 'saju' | 'personality' | 'chat' | 'compat' | 'kakao';
export type HubCharacter = '형' | '언니';

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

function Shell() {
  const store = useSessionStore();
  const [tab, setTab] = useState<Tab>('home');
  const [session, setSession] = useState<Session | null>(null); // 지금 열린 대화 세션
  const [sheet, setSheet] = useState<Character | null>(null); // 세션 선택 시트
  const [analysesFor, setAnalysesFor] = useState<Character | null>(null); // 저장된 분석 시트
  const [screen, setScreen] = useState<Screen>('home');
  const [profile, setProfile] = useState<Character | null>(null); // 서비스 프로필 모달
  const [current, setCurrent] = useState<Character | null>(null); // 지금 대화 중인 캐릭터
  const [hub, setHub] = useState<HubCharacter>('형');
  const favorites = useFavorites();
  // 이 세션에서 입력한 내 정보 (궁합·대화에 재사용, 저장하지 않음)
  const [mySaju, setMySaju] = useState<SajuInput | null>(null);
  const [myType, setMyType] = useState<string | null>(null);

  const go = (s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
  };
  const openProfile = (c: Character) => setProfile(c);
  /** 세션을 열고 대화방으로 */
  const openSession = (c: Character, s: Session) => {
    setSheet(null);
    setProfile(null);
    setCurrent(c);
    setSession(s);
    go('chat');
  };
  /** 프로필 '대화 시작' — 채팅 캐릭터는 이전 상담이 있으면 세션 시트, 없으면 바로 새 세션. 폼 화면 캐릭터는 그 화면으로 */
  const startWith = (c: Character, screen?: Screen) => {
    const target = screen ?? c.screen;
    if (!target) return;
    if (target === 'chat') {
      if (store.listSessions(c.id).length > 0) {
        setSheet(c);
        return;
      }
      openSession(c, store.createSession({ character: c.id, title: '새 상담', origin: 'new', memo: memoForNew(store.listAnalyses()) }));
      return;
    }
    setProfile(null);
    setCurrent(c);
    go(target);
  };
  /** 프로필 '이어서 대화' — 가장 최근 세션 재개 */
  const resumeWith = (c: Character) => {
    const last = store.listSessions(c.id)[0];
    if (last) openSession(c, last);
  };
  const backHome = () => {
    setCurrent(null);
    setSession(null);
    go('home');
  };
  const onType = useCallback((t: string) => setMyType(t), []);
  const dayPillar = (() => {
    try {
      return mySaju ? calculateSaju(mySaju).detail.dayString : null;
    } catch {
      return null;
    }
  })();

  // 채팅 엔진은 공용, 페르소나(프롬프트)는 캐릭터별 — 허브 카드 '소개받기'로 들어오면 current 가 없으므로 성별 허브
  const chatCharacter = current?.persona ? current : hubOf(hub);
  // chat 화면은 항상 openSession 을 거쳐 들어온다 (렌더 중 세션 생성 금지)
  const chatSession = screen === 'chat' ? session : null;
  const title = current ? nameOf(current, hub) : '모두의 연애';
  const inTabRoot = screen === 'home';

  return (
    <div className="app">
      {!inTabRoot && (
        <header className="topbar">
          <button className="topbar-back" onClick={backHome} aria-label="홈으로">
            ‹
          </button>
          <span className="topbar-title">{title}</span>
          <span className="topbar-badge">PROTOTYPE</span>
        </header>
      )}
      <main className={`content${inTabRoot ? ' tab-root' : ''}`}>
        {screen === 'home' && tab === 'home' && <Home hub={hub} setHub={setHub} favorites={favorites} onOpen={openProfile} />}
        {screen === 'home' && tab === 'talk' && <TalkTab hub={hub} onOpen={openProfile} onResume={openSession} />}
        {screen === 'home' && tab === 'intro' && <IntroTab />}
        {screen === 'home' && tab === 'my' && <MyTab />}
        {screen === 'saju' && <SajuPage onSaved={setMySaju} />}
        {screen === 'personality' && <PersonalityPage hub={hub} onType={onType} />}
        {screen === 'chat' && chatSession && (
          <ChatPage key={chatSession.id} hub={hub} character={chatCharacter} session={chatSession} onSwitchSession={(s) => openSession(chatCharacter, s)} go={go} profile={{ type: myType, dayPillar }} />
        )}
        {screen === 'compat' && <CompatPage mySaju={mySaju} myType={myType} />}
        {screen === 'kakao' && <KakaoPage />}
      </main>
      {inTabRoot && <BottomTab active={tab} onChange={setTab} />}
      {profile && (
        <CharacterProfile
          c={profile}
          hub={hub}
          favorite={favorites.has(profile.id)}
          onToggleFavorite={favorites.toggle}
          onClose={() => setProfile(null)}
          onStart={startWith}
          onResume={resumeWith}
          onAnalyses={(c) => setAnalysesFor(c)}
          recent={(() => {
            const last = store.listSessions(profile.id)[0];
            return last ? { title: last.title, when: last.updatedAt } : null;
          })()}
        />
      )}
      {sheet && <SessionSheet c={sheet} onClose={() => setSheet(null)} onStart={(s) => openSession(sheet, s)} />}
      {analysesFor && <AnalysesSheet sourceCharacter={analysesFor.id} onClose={() => setAnalysesFor(null)} />}
    </div>
  );
}
