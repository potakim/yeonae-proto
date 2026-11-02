import type { HubCharacter } from '../App';
import { CATEGORY_LABEL, nameOf, type Character } from '../data/characters';
import { Avatar } from '../components/CharacterRow';

interface Props {
  c: Character;
  hub: HubCharacter;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onStart: (c: Character) => void;
  /** 최근 세션 (프로토타입: 없음) */
  recent?: { title: string; when: string } | null;
}

export default function CharacterProfile({ c, hub, favorite, onToggleFavorite, onClose, onStart, recent = null }: Props) {
  const name = nameOf(c, hub);
  const disabled = c.screen === null;
  return (
    <div className="profile" style={{ ['--hero' as string]: c.bg }}>
      {/* 풀블리드 영역 — 일러스트가 오면 background-image 로 교체 */}
      <div className="profile-hero">
        <div className="profile-hero-art" aria-hidden>
          {c.emoji}
        </div>
        <div className="profile-top">
          <button className="hero-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
          <span className="hero-actions">
            <button className={`hero-btn${favorite ? ' on' : ''}`} onClick={() => onToggleFavorite(c.id)} aria-label="즐겨찾기" aria-pressed={favorite}>
              {favorite ? '★' : '☆'}
            </button>
            <button className="hero-btn" aria-label="공유">
              ⤴
            </button>
            <button className="hero-btn" aria-label="정보">
              ⓘ
            </button>
          </span>
        </div>
        <div className="profile-cat">
          <span />
          {CATEGORY_LABEL[c.category]}
          <span />
        </div>
        <div className="profile-id">
          <span className="profile-avatar">
            <Avatar c={c} size={112} />
          </span>
          <h2>
            {name} <em aria-hidden>♡</em>
          </h2>
          <p className="profile-role">{c.roleLine}</p>
          <p className="profile-tag">{c.tagline}</p>
        </div>
      </div>

      <div className="profile-info">
        <dl>
          <dt>이 캐릭터가 해주는 것</dt>
          <dd>
            <ul>
              {c.does.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </dd>
          <dt>추천 상황</dt>
          <dd>{c.when.join(' · ')}</dd>
          <dt>이용 가격 / 무료 범위</dt>
          <dd>{c.pricing}</dd>
          <dt>최근 이용 기록</dt>
          <dd className="muted">{recent ? `${recent.title} · ${recent.when}` : '아직 대화한 적이 없어요'}</dd>
        </dl>
        <p className="ai-label">대화와 풀이는 생성형 AI가 작성해요. 결과는 재미와 참고용이에요.</p>
      </div>

      <div className="profile-actions">
        <button className="profile-action primary" onClick={() => onStart(c)} disabled={disabled}>
          <span aria-hidden>💬</span>
          {disabled ? '준비 중' : '대화 시작'}
        </button>
        <button className="profile-action" disabled={!recent} onClick={() => onStart(c)}>
          <span aria-hidden>↩</span>이어서 대화
        </button>
        <button className="profile-action" disabled>
          <span aria-hidden>📋</span>저장된 분석
        </button>
      </div>
    </div>
  );
}
