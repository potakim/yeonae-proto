import type { HubCharacter } from '../App';
import { CATEGORY_LABEL, heroUrl, nameOf, type Character, type ProfileAsk } from '../data/characters';
import { Icon } from '../components/Icon';
import type { Screen } from '../App';
import { Avatar } from '../components/CharacterRow';
import { formatWhen } from '../lib/sessions/store';

interface Props {
  c: Character;
  hub: HubCharacter;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onStart: (c: Character, screen?: Screen) => void;
  /** 질문 줄을 눌렀을 때 — 그 문장으로 대화를 시작하거나 해당 화면으로 */
  onAsk: (c: Character, ask: ProfileAsk) => void;
  onResume: (c: Character) => void;
  onAnalyses: (c: Character) => void;
  /** 최근 세션 */
  recent?: { title: string; when: number } | null;
}

export default function CharacterProfile({ c, hub, favorite, onToggleFavorite, onClose, onStart, onAsk, onResume, onAnalyses, recent = null }: Props) {
  const name = nameOf(c, hub);
  const disabled = c.screen === null;
  const hero = heroUrl(c);
  return (
    <div className="profile" style={{ ['--hero' as string]: c.bg }}>
      {/* 풀블리드 영역 — 일러스트가 오면 background-image 로 교체 */}
      <div className={`profile-hero${hero ? ' has-image' : ''}`} style={hero ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.7) 100%), url(${hero})` } : undefined}>
        {!hero && (
          <div className="profile-hero-art" aria-hidden>
            {c.emoji}
          </div>
        )}
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
          <p className="profile-tag">{c.tagline}</p>
          {c.mbti && <p className="profile-meta">{c.mbti}</p>}
          {c.chips && (
            <p className="profile-chips">
              {c.chips.map((x) => (
                <span key={x}>{x}</span>
              ))}
            </p>
          )}
          <p className="profile-bubble">{c.roleLine}</p>
        </div>
      </div>

      <div className="profile-info">
        {c.asks && !disabled && (
          <div className="profile-asks">
            <h3>무엇이 궁금하신가요?</h3>
            {c.asks.map((a, i) => (
              <button key={a.label} className="ask-row" onClick={() => onAsk(c, a)}>
                <span className={`ask-icon${i % 2 ? ' violet' : ''}`}>
                  <Icon name={a.icon} size={20} />
                </span>
                <span className="ask-label">{a.label}</span>
                <Icon name="next" size={16} />
              </button>
            ))}
          </div>
        )}
        <div className="profile-does">
          <h3>{name}의 상담은 이래요</h3>
          <ul>
            {c.does.map((d) => (
              <li key={d}>
                <Icon name="check" size={16} />
                {d}
              </li>
            ))}
          </ul>
        </div>
        <div className="profile-note">
          <Icon name="info" size={20} />
          <p>
            {c.id === 'saju-master' ? (
              <>
                더 정확한 풀이를 위해 생년월일과 태어난 시간을 입력해 주세요.
                <small>입력한 정보는 이 기기에 저장되고, 풀이를 만들 때만 서버로 보내요.</small>
              </>
            ) : (
              <>
                생성형 AI가 쓴 답변이에요. 재미와 참고용으로 봐 주세요.
                <small>
                  {c.image && '캐릭터 이미지는 AI로 생성한 가상 인물이에요.'}
                  {c.placeholder && (c.image ? ' 이 캐릭터의 대화 기능은 준비 중이에요.' : ' 이 캐릭터의 페르소나·이미지는 준비 중이에요.')}
                </small>
              </>
            )}
          </p>
        </div>
        <dl>
          <dt>추천 상황</dt>
          <dd>{c.when.join(' · ')}</dd>
          <dt>이용 가격 / 무료 범위</dt>
          <dd>{c.pricing}</dd>
          {c.extra && (
            <>
              <dt>이 캐릭터의 다른 기능</dt>
              <dd className="extra-chips">
                {c.extra.map((e) => (
                  <button key={e.screen} className="chip-btn" onClick={() => onStart(c, e.screen)}>
                    {e.label} ›
                  </button>
                ))}
              </dd>
            </>
          )}
          <dt>최근 이용 기록</dt>
          <dd className="muted">{recent ? `${recent.title} · ${formatWhen(recent.when)}` : '아직 대화한 적이 없어요'}</dd>
        </dl>
      </div>

      <div className="profile-actions">
        <button className="profile-action primary" onClick={() => onStart(c)} disabled={disabled}>
          <span aria-hidden>💬</span>
          {disabled ? '준비 중' : '대화 시작'}
        </button>
        <button className="profile-action" disabled={!recent || (c.screen !== 'chat' && c.screen !== 'saju')} onClick={() => onResume(c)}>
          <span aria-hidden>↩</span>이어서 대화
        </button>
        <button className="profile-action" onClick={() => onAnalyses(c)}>
          <span aria-hidden>📋</span>저장된 분석
        </button>
      </div>
    </div>
  );
}
