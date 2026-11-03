import type { Character } from '../data/characters';
import { avatarUrl, nameOf } from '../data/characters';
import type { HubCharacter } from '../App';

interface Props {
  c: Character;
  hub: HubCharacter;
  onOpen: (c: Character) => void;
  favorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  /** 즐겨찾기 섹션처럼 우측에 ★ 토글을 보여줄지 */
  showStar?: boolean;
  last?: boolean;
}

export function Avatar({ c, size = 56 }: { c: Character; size?: number }) {
  const src = avatarUrl(c);
  return (
    <span className="avatar" style={{ width: size, height: size, background: c.bg, fontSize: Math.round(size * 0.5) }} aria-hidden>
      {src ? <img src={src} alt="" width={size} height={size} loading="lazy" /> : c.emoji}
    </span>
  );
}

export default function CharacterRow({ c, hub, onOpen, favorite, onToggleFavorite, showStar, last }: Props) {
  return (
    <div className={`char-row${last ? ' last' : ''}`}>
      <button className="char-row-main" onClick={() => onOpen(c)}>
        <Avatar c={c} />
        <span className="char-row-text">
          <strong>
            {nameOf(c, hub)}
            {c.paid && <em className="badge badge-paid">유료</em>}
            {c.isNew && <em className="badge badge-new">NEW</em>}
          </strong>
          <span>{c.roleLine}</span>
        </span>
      </button>
      {showStar && onToggleFavorite ? (
        <button
          className={`star${favorite ? ' on' : ''}`}
          onClick={() => onToggleFavorite(c.id)}
          aria-label={favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          aria-pressed={favorite}
        >
          {favorite ? '★' : '☆'}
        </button>
      ) : (
        <button className="chev" onClick={() => onOpen(c)} aria-label="프로필 보기">
          ›
        </button>
      )}
    </div>
  );
}
