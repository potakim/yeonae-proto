/**
 * 상담 캐릭터 프로필 화면 — 8차 리뷰(2026-11-26) 「캐릭터 별 프로필 화면」 구현 명세.
 *  - 세로 스크롤 영역은 하나. 스크롤 진행도에 맞춰 사진 프레임 높이를 줄이고 말풍선을 투명하게 만든다.
 *  - 사진은 object-fit: cover, 말풍선은 사진과 분리된 텍스트.
 *  - 원형 사진·이름·배지·소개는 사진과 시트의 경계에 걸쳐 함께 올라간다.
 *  - 대화 시작 버튼은 시트 콘텐츠의 맨 끝.
 * 명세에서 미정인 항목(임시 결정): 사진 높이 62vh → 168px / 고민 카드는 바로 전송 / 더보기 = 즐겨찾기·이어서 대화·저장된 분석 / 뒤로·닫기 = 홈.
 */
import { useEffect, useRef, useState } from 'react';
import type { HubCharacter } from '../App';
import { avatarUrl, heroUrl, type Character, type ProfileAsk } from '../data/characters';
import { Icon } from '../components/Icon';
import { formatWhen } from '../lib/sessions/store';

interface Props {
  c: Character;
  hub: HubCharacter;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onStart: (c: Character) => void;
  onAsk: (c: Character, ask: ProfileAsk) => void;
  onResume: (c: Character) => void;
  onAnalyses: (c: Character) => void;
  recent?: { title: string; when: number } | null;
}

const MIN_HERO = 168;

export default function CounselorProfile({ c, favorite, onToggleFavorite, onClose, onStart, onAsk, onResume, onAnalyses, recent = null }: Props) {
  const sc = c.showcase!;
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const hero = heroUrl(c);
  const avatar = avatarUrl(c);

  // 스크롤 위치 → 사진 높이·말풍선 투명도 (CSS 변수만 바꾼다. 터치·휠·트랙패드가 같은 스크롤 위치를 쓴다)
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const full = Math.max(MIN_HERO + 120, Math.round(el.clientHeight * 0.62));
      const range = full - MIN_HERO;
      const p = Math.min(1, Math.max(0, el.scrollTop / range));
      el.style.setProperty('--hero-full', `${full}px`);
      el.style.setProperty('--hero-h', `${full - range * p}px`);
      el.style.setProperty('--bubble-o', String(Math.max(0, 1 - p * 1.6)));
      el.classList.toggle('expanded', p >= 1);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="cp" ref={root} role="dialog" aria-label={`${c.name} 프로필`}>
      <header className="cp-head">
        <button className="cp-back" onClick={onClose} aria-label="뒤로">
          <Icon name="back" size={22} />
        </button>
        <strong>모두의 연애</strong>
        <span className="cp-head-actions">
          <button onClick={() => setMenu((m) => !m)} aria-label="더보기" aria-expanded={menu}>
            <Icon name="more" size={20} />
          </button>
          <i aria-hidden />
          <button onClick={onClose} aria-label="닫기">
            <Icon name="close" size={20} />
          </button>
        </span>
        {menu && (
          <div className="cp-menu" role="menu">
            <button
              role="menuitem"
              onClick={() => {
                onToggleFavorite(c.id);
                setMenu(false);
              }}
            >
              {favorite ? '즐겨찾기 해제' : '즐겨찾기에 추가'}
            </button>
            <button role="menuitem" disabled={!recent} onClick={() => onResume(c)}>
              이어서 대화{recent ? ` · ${formatWhen(recent.when)}` : ''}
            </button>
            <button role="menuitem" onClick={() => onAnalyses(c)}>
              저장된 분석
            </button>
          </div>
        )}
      </header>

      <div className="cp-hero">
        <div className="cp-photo">{hero ? <img src={hero} alt="" /> : <span style={{ background: c.bg }} />}</div>
        <div className="cp-bubbles" aria-label="대화 예시">
          <p className="cp-b me">{sc.sample.user}</p>
          <p className="cp-b">{sc.sample.reply}</p>
          <p className="cp-b quote">{sc.sample.quote}</p>
          <p className="cp-b">{sc.sample.after}</p>
        </div>
        <div className="cp-id">
          <span className="cp-avatar">{avatar ? <img src={avatar} alt="" /> : c.emoji}</span>
          <span className="cp-id-text">
            <span className="cp-name">
              <strong>{c.name}</strong>
              <em>AI 캐릭터</em>
            </span>
            <span className="cp-tag">{c.tagline}</span>
          </span>
        </div>
      </div>

      <div className="cp-sheet">
        <section>
          <h3>{sc.short}은 이렇게 도와줘요</h3>
          <ul className="cp-does">
            {c.does.map((d) => (
              <li key={d}>
                <i aria-hidden>
                  <Icon name="check" size={12} />
                </i>
                {d}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="underlined">자주 꺼내는 고민</h3>
          <div className="cp-asks">
            {(c.asks ?? []).map((a) => (
              <button key={a.label} className="cp-ask" onClick={() => onAsk(c, a)}>
                <span className="cp-ask-icon">
                  <Icon name={a.icon} size={20} />
                </span>
                <span className="cp-ask-label">{a.label}</span>
                <Icon name="next" size={18} />
              </button>
            ))}
          </div>
        </section>
        <div className="cp-note">
          <Icon name="info" size={20} />
          <p>
            <strong>{sc.note.title}</strong>
            {sc.note.body}
          </p>
        </div>
        <button className="cp-cta" onClick={() => onStart(c)}>
          {sc.short}과 대화하기
        </button>
      </div>
    </div>
  );
}
