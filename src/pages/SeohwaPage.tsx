/**
 * 서화 — 채팅방 이원화 (4차 리뷰 2026-11-18).
 *  탭 1 「사주 한눈에 보기」: 출생 정보 입력·원국·운세 (기존 화면)
 *  탭 2 「서화와 채팅」: 내 사주를 근거로 대화. 답 아래에 풀이 근거 카드가 붙는다.
 * 두 탭은 같이 마운트해 두고 숨기기만 한다 (탭을 오가도 입력·대화 상태가 유지되게).
 */
import { useState } from 'react';
import type { HubCharacter, Screen } from '../App';
import SajuPage from './SajuPage';
import ChatPage from './ChatPage';
import type { Character } from '../data/characters';
import type { StoredBirth } from '../lib/birth-store';
import type { Evidence } from '../lib/ai/saju-chat';
import type { SajuInput } from '../lib/saju';
import type { BirthPlace } from '../data/regions';
import { useSessionStore } from '../lib/sessions/context';
import { memoForNew, type Session } from '../lib/sessions/store';

export type SeohwaTab = 'saju' | 'chat';
/** 「서화에게 내 사주 풀어보기」로 들어왔을 때 대신 보내는 첫 질문 */
export const SEOHWA_STARTER = '내 사주에서 연애 쪽으로 제일 먼저 봐야 할 게 뭐야?';

const lastEvidence = (s: Session | null): Evidence[] => {
  const list = (s?.messages ?? []) as { evidence?: Evidence[] }[];
  return [...list].reverse().find((m) => m.evidence?.length)?.evidence ?? [];
};

export default function SeohwaPage({
  hub,
  age,
  character,
  birth,
  onBirth,
  onClearBirth,
  session,
  onSession,
  initialTab,
  go,
  profile,
}: {
  hub: HubCharacter;
  age: number | null;
  character: Character;
  birth: StoredBirth | null;
  onBirth: (input: SajuInput, place: BirthPlace) => void;
  onClearBirth: () => void;
  /** 지금 열린 서화 대화 (없으면 채팅 탭을 열 때 최근 대화를 잇거나 새로 만든다) */
  session: Session | null;
  onSession: (s: Session) => void;
  initialTab: SeohwaTab;
  go: (s: Screen) => void;
  profile: { type: string | null; dayPillar: string | null };
}) {
  const store = useSessionStore();
  const [tab, setTab] = useState<SeohwaTab>(initialTab);
  const [starter, setStarter] = useState<string | null>(null);
  // 가장 최근 답에 쓰인 근거 — 「사주 한눈에 보기」 탭에서도 보여 준다
  const [used, setUsed] = useState<Evidence[]>(() => lastEvidence(session));

  /** 채팅 탭 열기 — 세션은 여기(이벤트 핸들러)에서만 만든다 */
  const openChat = (withStarter: boolean) => {
    if (birth && !session) {
      const s = store.listSessions(character.id)[0] ?? store.createSession({ character: character.id, title: '새 상담', origin: 'new', memo: memoForNew(store.listAnalyses()) });
      onSession(s);
    }
    if (withStarter) setStarter(SEOHWA_STARTER);
    setTab('chat');
    window.scrollTo(0, 0);
  };
  const openSaju = () => {
    setTab('saju');
    window.scrollTo(0, 0);
  };

  return (
    <div className="seohwa">
      <div className="seohwa-tabs" role="tablist" aria-label="서화">
        <button role="tab" aria-selected={tab === 'saju'} className={tab === 'saju' ? 'active' : ''} onClick={openSaju}>
          사주 한눈에 보기
        </button>
        <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'active' : ''} onClick={() => openChat(false)}>
          서화와 채팅
        </button>
      </div>

      <div role="tabpanel" hidden={tab !== 'saju'}>
        <SajuPage
          initial={birth}
          onSaved={onBirth}
          onClear={() => {
            onClearBirth();
            setUsed([]);
          }}
          onAskSeohwa={() => openChat(true)}
          usedEvidence={used}
        />
      </div>

      <div role="tabpanel" hidden={tab !== 'chat'}>
        {birth && session ? (
          <ChatPage
            key={session.id}
            hub={hub}
            age={age}
            character={character}
            session={session}
            onSwitchSession={(s) => {
              setStarter(null);
              setUsed(lastEvidence(s));
              onSession(s);
            }}
            go={go}
            profile={profile}
            birth={birth.input}
            onOpenSaju={openSaju}
            autoSend={starter}
            onEvidence={setUsed}
          />
        ) : (
          <section className="card seohwa-gate">
            <strong>출생 정보가 먼저 필요해요</strong>
            <p>서화는 내 사주를 근거로 얘기해요. 생년월일과 태어난 시간을 입력하면 바로 대화할 수 있어요.</p>
            <button className="btn-primary" onClick={openSaju}>
              출생 정보 입력하기
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
