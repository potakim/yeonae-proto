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
  const startWith = (c: Character, screen?: Screen) => {
    const target = screen ?? c.screen;
    if (!target) return;
    setProfile(null);
    setCurrent(c);
    go(target);
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

  // 채팅 엔진은 공용, 페르소나(프롬프트)는 캐릭터별 — 허브 카드 '소개받기'로 들어오면 current 가 없으므로 성별 허브
  const chatCharacter = current?.persona ? current : hubOf(hub);
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
        {screen === 'chat' && <ChatPage key={chatCharacter.id} hub={hub} character={chatCharacter} go={go} profile={{ type: myType, dayPillar }} />}
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
