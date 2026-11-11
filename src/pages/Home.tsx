import { useState } from 'react';
import type { HubCharacter } from '../App';
import { SECTIONS, byId, nameOf, visibleFor, type Character } from '../data/characters';
import { isOn } from '../lib/flags';
import CharacterRow from '../components/CharacterRow';

interface Props {
  hub: HubCharacter;
  setHub: (h: HubCharacter) => void;
  favorites: { ids: string[]; toggle: (id: string) => void; has: (id: string) => boolean };
  onOpen: (c: Character) => void;
}

function Section({
  icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="section">
      <button className="section-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="section-icon" aria-hidden>
          {icon}
        </span>
        <span className="section-title">{title}</span>
        <span className={`section-chev${open ? ' open' : ''}`} aria-hidden>
          ⌄
        </span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

export default function Home({ hub, setHub, favorites, onOpen }: Props) {
  const introOn = isOn('intro_tab');
  const visible = visibleFor(hub, introOn);
  const favs = favorites.ids.map((id) => visible.find((c) => c.id === id)).filter(Boolean) as Character[];

  return (
    <div className="home">
      <header className="home-head">
        <span className="logo" aria-hidden>
          ♥
        </span>
        <h1>모두의 연애</h1>
        <button className="icon-btn" aria-label="검색">
          🔍
        </button>
      </header>

      {/* 내 프로필 카드 — 프로토타입: 허브 성별 선택을 겸한다 (실서비스는 토스 로그인 성별) */}
      <div className="me-card">
        <span className="me-avatar" aria-hidden>
          👤
        </span>
        <span className="me-text">
          <strong>user_name</strong>
          <span>연애 고민이 있다면, 언제든지 💕</span>
        </span>
        <span className="segmented mini" role="tablist" aria-label="허브 캐릭터">
          {(['형', '언니'] as const).map((h) => (
            <button key={h} role="tab" aria-selected={hub === h} className={hub === h ? 'active' : ''} onClick={() => setHub(h)}>
              {h}
            </button>
          ))}
        </span>
      </div>

      <Section icon="☆" title="즐겨찾기">
        {favs.length === 0 ? (
          <p className="empty">자주 쓰는 캐릭터를 ★로 고정해요</p>
        ) : (
          favs.map((c, i) => (
            <CharacterRow key={c.id} c={c} hub={hub} onOpen={onOpen} showStar favorite onToggleFavorite={favorites.toggle} last={i === favs.length - 1} />
          ))
        )}
      </Section>

      {SECTIONS.filter((s) => !s.flag || introOn).map((s) => {
        const list = visible.filter((c) => c.category === s.key);
        return (
          <Section key={s.key} icon={s.icon} title={s.title}>
            {list.map((c, i) => (
              <CharacterRow key={c.id} c={c} hub={hub} onOpen={onOpen} last={i === list.length - 1} />
            ))}
          </Section>
        );
      })}

      <Section icon="✨" title="추천 서비스">
        <div className="reco-scroll">
          <button className="reco-card" onClick={() => onOpen(byId('soeun')!)}>
            <span className="reco-label">지금 나에게 필요한 상담</span>
            <strong>연락이 뜸해졌다면</strong>
            <span>{nameOf(byId('soeun')!, hub)}에게 물어봐요</span>
          </button>
          <button className="reco-card violet" onClick={() => onOpen(byId('saju-master')!)}>
            <span className="reco-label">새로 열린 서비스</span>
            <strong>오늘의 연애운</strong>
            <span>서화 · 무료</span>
          </button>
          <button className="reco-card" onClick={() => onOpen(byId('teacher')!)}>
            <span className="reco-label">상담 데이터 기반 추천</span>
            <strong>내 연애 성향부터</strong>
            <span>선생님 · 문항 무료</span>
          </button>
        </div>
      </Section>

      <p className="foot-note">
        사주·성격유형·궁합·카톡 통계는 코드로 계산하고, 풀이와 대화는 생성형 AI가 작성해요. 결과는 재미와 참고용이에요.
      </p>
    </div>
  );
}
