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
import { nameOf, type Character } from './data/characters';
import { useFavorites } from './lib/favorites';

export type Screen = 'home' | 'saju' | 'personality' | 'chat' | 'compat' | 'kakao';
export type HubCharacter = '형' | '언니';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
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
  const startWith = (c: Character) => {
    if (!c.screen) return;
    setProfile(null);
    setCurrent(c);
    go(c.screen);
  };
  const backHome = () => {
    setCurrent(null);
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

  // 소은누나/성현이형은 프로토타입에서 허브 대화 엔진을 공유(이름만 다름). 실서비스는 캐릭터별 프롬프트.
  const chatHub: HubCharacter = current?.id === 'soeun' ? '언니' : current?.id === 'seonghyun' ? '형' : hub;
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
        {screen === 'home' && tab === 'talk' && <TalkTab hub={hub} onOpen={openProfile} />}
        {screen === 'home' && tab === 'intro' && <IntroTab />}
        {screen === 'home' && tab === 'my' && <MyTab />}
        {screen === 'saju' && <SajuPage onSaved={setMySaju} />}
        {screen === 'personality' && <PersonalityPage hub={hub} onType={onType} />}
        {screen === 'chat' && <ChatPage hub={chatHub} go={go} profile={{ type: myType, dayPillar }} />}
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
        />
      )}
    </div>
  );
}
