import { useCallback, useState } from 'react';
import Home from './pages/Home';
import SeohwaPage from './pages/SeohwaPage';
import CounselorProfile from './pages/CounselorProfile';
import PersonalityPage from './pages/PersonalityPage';
import ChatPage from './pages/ChatPage';
import CompatPage from './pages/CompatPage';
import KakaoPage from './pages/KakaoPage';
import DetectivePage from './pages/DetectivePage';
import CharacterProfile from './pages/CharacterProfile';
import { IntroTab, MyTab, TalkTab } from './pages/TabStubs';
import BottomTab, { type Tab } from './components/BottomTab';
import { calculateSaju } from './lib/saju';
import { clearBirth, loadBirth, saveBirth, type StoredBirth } from './lib/birth-store';
import { byId, hubOf, nameOf, type Character } from './data/characters';
import { useFavorites } from './lib/favorites';
import { SessionProvider, useSessionStore } from './lib/sessions/context';
import { memoForNew, type Session } from './lib/sessions/store';
import SessionSheet from './components/SessionSheet';
import AnalysesSheet from './components/AnalysesSheet';
import { validAge } from './lib/ai/personas';

export type Screen = 'home' | 'saju' | 'personality' | 'chat' | 'compat' | 'kakao' | 'detective';
export type HubCharacter = '형' | '언니';

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}

const AGE_KEY = 'yeonae.age';
function readAge(): number | null {
  try {
    return validAge(Number(localStorage.getItem(AGE_KEY) ?? NaN));
  } catch {
    return null;
  }
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
  // 사용자 나이 — 프로토타입 임시 입력 (실서비스: 토스 로그인 생년월일로 서버가 계산). 비어 있으면 캐릭터가 나이를 지어내지 않는다
  const [age, setAgeState] = useState<number | null>(readAge);
  const setAge = (v: number | null) => {
    setAgeState(v);
    try {
      if (v === null) localStorage.removeItem(AGE_KEY);
      else localStorage.setItem(AGE_KEY, String(v));
    } catch {
      /* ignore */
    }
  };
  const favorites = useFavorites(hubOf(hub).id);
  // 내 출생 정보 — 이 기기에만 저장 (서화 채팅·궁합에 재사용). 실서비스: 토스 로그인 정보 + 서버 저장
  const [birth, setBirthState] = useState<StoredBirth | null>(loadBirth);
  const mySaju = birth?.input ?? null;
  const seohwa = byId('saju-master')!;
  const [myType, setMyType] = useState<string | null>(null);

  const go = (s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
  };
  const openProfile = (c: Character) => setProfile(c);
  // 프로필·홈에서 고른 질문 — 대화방이 열리면 첫 메시지로 한 번 보낸다
  const [starter, setStarter] = useState<string | null>(null);
  /** 세션을 열고 대화방으로 */
  const openSession = (c: Character, s: Session, first: string | null = null) => {
    setStarter(first);
    setSheet(null);
    setProfile(null);
    setCurrent(c);
    setSession(s);
    go(c.screen === 'saju' ? 'saju' : 'chat'); // 서화는 대화도 사주 화면의 「서화와 채팅」 탭에서 연다
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
    setSession(null);
    setStarter(null);
    go(target);
  };
  /** 고른 고민·질문으로 바로 시작 — 항상 새 상담을 만들고 그 문장을 첫 메시지로 보낸다 */
  const startTopic = (c: Character, text: string) => {
    const fresh = () => store.createSession({ character: c.id, title: '새 상담', origin: 'new', memo: memoForNew(store.listAnalyses()) });
    if (c.screen === 'chat') return openSession(c, fresh(), text);
    if (c.screen === 'saju') {
      // 서화: 출생 정보가 있으면 채팅 탭으로 바로, 없으면 입력 화면에서 시작하고 질문은 들고 간다
      if (birth) return openSession(c, fresh(), text);
      setProfile(null);
      setCurrent(c);
      setSession(null);
      setStarter(text);
      go('saju');
      return;
    }
    startWith(c);
  };
  /** 프로필 '이어서 대화' — 가장 최근 세션 재개 */
  const resumeWith = (c: Character) => {
    const last = store.listSessions(c.id)[0];
    if (last) openSession(c, last);
  };
  const backHome = () => {
    setCurrent(null);
    setSession(null);
    setStarter(null);
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
  const title = current ? nameOf(current, hub) : screen === 'saju' ? nameOf(seohwa, hub) : '모두의 연애';
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
        {screen === 'home' && tab === 'home' && <Home hub={hub} setHub={setHub} age={age} setAge={setAge} favorites={favorites} onOpen={openProfile} onResume={openSession} onTopic={(text) => startTopic(hubOf(hub), text)} onStart={startWith} />}
        {screen === 'home' && tab === 'talk' && <TalkTab hub={hub} onOpen={openProfile} onResume={openSession} />}
        {screen === 'home' && tab === 'intro' && <IntroTab />}
        {screen === 'home' && tab === 'my' && <MyTab />}
        {screen === 'saju' && (
          <SeohwaPage
            hub={hub}
            age={age}
            character={seohwa}
            birth={birth}
            onBirth={(input, place) => {
              const b = { input, place };
              saveBirth(b);
              setBirthState(b);
            }}
            onClearBirth={() => {
              clearBirth();
              setBirthState(null);
            }}
            session={session && session.character === seohwa.id ? session : null}
            onSession={setSession}
            initialTab={session && session.character === seohwa.id ? 'chat' : 'saju'}
            initialStarter={starter}
            go={go}
            profile={{ type: myType, dayPillar }}
          />
        )}
        {screen === 'personality' && <PersonalityPage hub={hub} onType={onType} />}
        {screen === 'chat' && chatSession && (
          <ChatPage key={chatSession.id} hub={hub} age={age} character={chatCharacter} session={chatSession} onSwitchSession={(s) => openSession(chatCharacter, s)} autoSend={starter} go={go} profile={{ type: myType, dayPillar }} />
        )}
        {screen === 'compat' && <CompatPage mySaju={mySaju} myType={myType} />}
        {screen === 'kakao' && <KakaoPage />}
        {screen === 'detective' && <DetectivePage />}
      </main>
      {inTabRoot && <BottomTab active={tab} onChange={setTab} />}
      {profile &&
        (() => {
          const P = profile.showcase ? CounselorProfile : CharacterProfile;
          return (
            <P
              c={profile}
              hub={hub}
              favorite={favorites.has(profile.id)}
              onToggleFavorite={favorites.toggle}
              onClose={() => setProfile(null)}
              onStart={startWith}
              onAsk={(c, ask) => (ask.screen ? startWith(c, ask.screen) : startTopic(c, ask.text ?? ask.label))}
              onResume={resumeWith}
              onAnalyses={(c) => setAnalysesFor(c)}
              recent={(() => {
                const last = store.listSessions(profile.id)[0];
                return last ? { title: last.title, when: last.updatedAt } : null;
              })()}
            />
          );
        })()}
      {sheet && <SessionSheet c={sheet} onClose={() => setSheet(null)} onStart={(s) => openSession(sheet, s)} />}
      {analysesFor && <AnalysesSheet sourceCharacter={analysesFor.id} onClose={() => setAnalysesFor(null)} />}
    </div>
  );
}
