import { useState } from 'react';
import Home from './pages/Home';
import SajuPage from './pages/SajuPage';
import PersonalityPage from './pages/PersonalityPage';

export type Screen = 'home' | 'saju' | 'personality';
export type HubCharacter = '형' | '언니';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [hub, setHub] = useState<HubCharacter>('형');

  const go = (s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
  };

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
        <span className="topbar-title">모두의 연애</span>
        <span className="topbar-badge">PROTOTYPE</span>
      </header>
      <main className="content">
        {screen === 'home' && <Home hub={hub} setHub={setHub} go={go} />}
        {screen === 'saju' && <SajuPage />}
        {screen === 'personality' && <PersonalityPage hub={hub} />}
      </main>
    </div>
  );
}
