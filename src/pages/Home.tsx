import { useState } from 'react';
import type { HubCharacter } from '../App';
import { CHARACTERS, SECTIONS, byId, hubOf, nameOf, visibleFor, type Character } from '../data/characters';
import { todaysConcerns } from '../data/concerns';
import { isOn } from '../lib/flags';
import CharacterRow, { Avatar } from '../components/CharacterRow';
import ConcernSheet from '../components/ConcernSheet';
import { Icon, type IconName } from '../components/Icon';
import { useSessionStore } from '../lib/sessions/context';
import { formatWhen, type Session } from '../lib/sessions/store';

interface Props {
  hub: HubCharacter;
  setHub: (h: HubCharacter) => void;
  age: number | null;
  setAge: (v: number | null) => void;
  favorites: { ids: string[]; toggle: (id: string) => void; has: (id: string) => boolean };
  onOpen: (c: Character) => void;
  /** 이어서 상담 — 그 상담을 바로 연다 */
  onResume: (c: Character, s: Session) => void;
  /** 고른 고민으로 상담 시작 */
  onTopic: (text: string) => void;
  /** 캐릭터의 기능 화면으로 바로 (카톡 분석 예시의 '캡처 올리기') */
  onStart: (c: Character) => void;
}

function Section({
  icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: IconName;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="section">
      <button className="section-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="section-icon" aria-hidden>
          <Icon name={icon} size={18} />
        </span>
        <span className="section-title">{title}</span>
        <span className={`section-chev${open ? ' open' : ''}`} aria-hidden>
          <Icon name="down" size={18} />
        </span>
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

/** 카톡 분석 예시 — 어떤 식으로 읽어 주는지 보여 주는 가상의 대화 (실제 사용자 대화가 아니다) */
function KakaoExample({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="kakao-example">
      <div className="kakao-example-head">
        <span>분석 예시</span>
        <span>가상의 대화</span>
      </div>
      <div className="kakao-example-chat" aria-label="카톡 대화 예시">
        <span className="kx-date">11월 24일 일요일</span>
        <div className="kx-row me">
          <small>오후 11:38</small>
          <span className="kx-bubble me">오늘 전시 재밌었어요</span>
        </div>
        <div className="kx-row">
          <span className="kx-bubble them mark">저도요 ㅎㅎ 다음엔 어디 갈지 정했어요?</span>
          <small>오후 11:42</small>
        </div>
      </div>
      <p className="kakao-example-note">
        <i aria-hidden />
        <strong>질문으로 끝맺음</strong> · 대화를 이어가려는 신호
      </p>
      <button className="btn-primary" onClick={onUpload}>
        <Icon name="upload" size={18} />
        캡처 올리기
      </button>
    </div>
  );
}

export default function Home({ hub, setHub, age, setAge, favorites, onOpen, onResume, onTopic, onStart }: Props) {
  const store = useSessionStore();
  const [concernSheet, setConcernSheet] = useState(false);
  // 이어서 상담: 사용자가 한 번이라도 말한 상담 중 최근 것 (캐릭터별 1개, 최대 2개)
  const recent: { s: Session; c: Character }[] = [];
  for (const s of store.listSessions().sort((a, b) => b.updatedAt - a.updatedAt)) {
    const c = CHARACTERS.find((x) => x.id === s.character);
    if (!c || recent.some((r) => r.c.id === c.id) || !s.messages.some((m) => m.role === 'user')) continue;
    recent.push({ s, c });
    if (recent.length === 2) break;
  }
  const [day] = useState(() => Math.floor((Date.now() + 9 * 3600_000) / 86_400_000)); // 한국 시간 기준 날짜 번호
  const concerns = todaysConcerns(recent.length === 0, day);
  const counselor = hubOf(hub);
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
          <Icon name="search" size={20} />
        </button>
      </header>

      {/* 내 프로필 카드 — 프로토타입: 성별·나이를 임시로 입력받는다 (실서비스는 토스 로그인 성별·생년월일) */}
      <div className="me-card">
        <span className="me-avatar" aria-hidden>
          <Icon name="user" size={26} />
        </span>
        <span className="me-text">
          <strong>user_name</strong>
          <span>연애 고민, 언제든 얘기해요</span>
        </span>
        <span className="me-settings">
          <span className="segmented mini" role="tablist" aria-label="내 성별">
            {(['형', '언니'] as const).map((h) => (
              <button key={h} role="tab" aria-selected={hub === h} className={hub === h ? 'active' : ''} onClick={() => setHub(h)}>
                {h === '형' ? '남성' : '여성'}
              </button>
            ))}
          </span>
          <label className="me-age">
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="나이"
              aria-label="내 나이 (선택)"
              value={age ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''));
                setAge(e.target.value === '' ? null : Number.isInteger(n) && n > 0 ? n : age);
              }}
            />
            <span>세</span>
          </label>
        </span>
      </div>

      {recent.length > 0 && (
        <section className="section resume">
          <div className="section-head static">
            <span className="section-title">이어서 상담</span>
          </div>
          <div className="section-body">
            {recent.map(({ s, c }, i) => {
              const last = [...s.messages].reverse().find((m) => m.role === 'assistant');
              return (
                <button key={s.id} className={`chat-list-row${i === recent.length - 1 ? ' last' : ''}`} onClick={() => onResume(c, s)}>
                  <Avatar c={c} size={48} />
                  <span className="chat-list-text">
                    <strong>{nameOf(c, hub)}</strong>
                    <span>{last?.content ?? s.title}</span>
                  </span>
                  <span className="chat-list-meta">
                    <span>{formatWhen(s.updatedAt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <Section icon="star" title="즐겨찾기">
        {favs.length === 0 ? (
          <p className="empty">자주 찾는 캐릭터를 즐겨찾기해 보세요</p>
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
            {s.key === 'kakao' && byId('yeosachin') && <KakaoExample onUpload={() => onStart(byId('yeosachin')!)} />}
          </Section>
        );
      })}

      <Section icon="heart" title="오늘의 고민">
        <div className="reco-scroll">
          {concerns.map((x, i) => (
            <button key={x} className={`reco-card${i === 1 ? ' violet' : ''}`} onClick={() => onTopic(x)}>
              <span className="reco-label">오늘의 고민</span>
              <strong>{x}</strong>
              <span>이 고민 고르기</span>
            </button>
          ))}
        </div>
        <button className="btn-text concern-more" onClick={() => setConcernSheet(true)}>
          다른 고민 보기
        </button>
      </Section>

      <p className="foot-note">
        사주·성격유형·궁합·카톡 통계는 코드로 계산하고, 풀이와 대화는 생성형 AI가 써요. 재미와 참고용으로 봐 주세요.
      </p>
      {concernSheet && (
        <ConcernSheet
          who={nameOf(counselor, hub)}
          onClose={() => setConcernSheet(false)}
          onPick={(x) => {
            setConcernSheet(false);
            onTopic(x);
          }}
        />
      )}
    </div>
  );
}
