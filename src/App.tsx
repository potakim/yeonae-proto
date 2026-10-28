import { useCallback, useState } from 'react';
import Home from './pages/Home';
import SajuPage from './pages/SajuPage';
import PersonalityPage from './pages/PersonalityPage';
import ChatPage from './pages/ChatPage';
import CompatPage from './pages/CompatPage';
import KakaoPage from './pages/KakaoPage';
import { calculateSaju, type SajuInput } from './lib/saju';

export type Screen = 'home' | 'saju' | 'personality' | 'chat' | 'compat' | 'kakao';
export type HubCharacter = '형' | '언니';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [hub, setHub] = useState<HubCharacter>('형');
  // 이 세션에서 입력한 내 정보 (궁합·대화에 재사용, 저장하지 않음)
  const [mySaju, setMySaju] = useState<SajuInput | null>(null);
  const [myType, setMyType] = useState<string | null>(null);

  const go = (s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
  };
  const onType = useCallback((t: string) => setMyType(t), []);
  const dayPillar = (() => {
    try {
      return mySaju ? calculateSaju(mySaju).detail.dayString : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="app">
      <header className="topbar">
        {screen !== 'home' ? (
          <button className="topbar-back" onClick={() => go('home')} aria-label="홈으로">
            ‹
          </button>
        ) : (
          <span className="topbar-spacer" />
        )}
        <span className="topbar-title">{screen === 'chat' ? `아는 ${hub}` : '모두의 연애'}</span>
        <span className="topbar-badge">PROTOTYPE</span>
      </header>
      <main className="content">
        {screen === 'home' && <Home hub={hub} setHub={setHub} go={go} />}
        {screen === 'saju' && <SajuPage onSaved={setMySaju} />}
        {screen === 'personality' && <PersonalityPage hub={hub} onType={onType} />}
        {screen === 'chat' && <ChatPage hub={hub} go={go} profile={{ type: myType, dayPillar }} />}
        {screen === 'compat' && <CompatPage mySaju={mySaju} myType={myType} />}
        {screen === 'kakao' && <KakaoPage />}
      </main>
    </div>
  );
}
