import { useState } from 'react';
import { tarotImage, type TarotDraw } from '../lib/tarot';

/**
 * 타로 카드 — 이미지는 라이더-웨이트 덱(Pamela Colman Smith, 1909, 퍼블릭 도메인) 위키미디어 커먼즈 사본.
 * public/tarot/major-NN.webp, NN = TAROT_CARDS 인덱스.
 */
/** 카드 뒷면 — 앱 컬러로 직접 그린 패턴 (원작 덱 뒷면 미사용) */
export function CardBack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 200" role="img" aria-label="뒤집힌 카드">
      <defs>
        <linearGradient id="tb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8e5cff" />
          <stop offset="1" stopColor="#f044a7" />
        </linearGradient>
        <pattern id="tp" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="1.6" fill="#fff" opacity="0.35" />
          <path d="M10 2 L11.5 8 L18 10 L11.5 12 L10 18 L8.5 12 L2 10 L8.5 8 Z" fill="#fff" opacity="0.12" />
        </pattern>
      </defs>
      <rect x="2" y="2" width="116" height="196" rx="10" fill="url(#tb)" />
      <rect x="2" y="2" width="116" height="196" rx="10" fill="url(#tp)" />
      <rect x="9" y="9" width="102" height="182" rx="7" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" />
      <circle cx="60" cy="100" r="26" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" />
      <path d="M60 74 L63.5 92 L82 100 L63.5 108 L60 126 L56.5 108 L38 100 L56.5 92 Z" fill="#fff" opacity="0.9" />
      <circle cx="60" cy="100" r="5" fill="#f044a7" />
    </svg>
  );
}

/** 선택된 카드 (앞면). reversed 면 180° 회전 */
export function TarotCardView({ card, size = 'md' }: { card: TarotDraw; size?: 'sm' | 'md' }) {
  return (
    <figure className={`tarot-card ${size}`}>
      <img src={tarotImage(card.index)} alt={`${card.name} 카드`} className={card.reversed ? 'reversed' : ''} />
      <figcaption>
        <strong>{card.name}</strong>
        <span className={card.reversed ? 'rev' : ''}>{card.reversed ? '역방향' : '정방향'}</span>
      </figcaption>
    </figure>
  );
}

/**
 * 뒷면 5장 중 한 장 고르기 (3차 리뷰 2026-11-16: 선택 확인 단계 추가).
 * ① 카드를 누르면 위로 빠져 반짝이고 나머지는 흑백 → ② "이 카드로 결정" 을 눌러야 확정 (고른 카드를 다시 누르면 취소)
 * → ③ 서버가 뽑아 둔 카드를 받아 뒤집기 → onPick.
 * 어느 자리를 골라도 카드는 서버가 이미 뽑아 둔 한 장이다 (브라우저·LLM 이 뽑지 않음).
 */
export function TarotPick({ reveal, onPick }: { reveal: () => Promise<TarotDraw>; onPick: (card: TarotDraw) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<TarotDraw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = busy || card !== null;
  const tap = (i: number) => {
    if (locked) return;
    setError(null);
    setSelected((cur) => (cur === i ? null : i));
  };
  const confirm = async () => {
    if (selected === null || locked) return;
    setBusy(true);
    try {
      const c = await reveal();
      setCard(c);
      window.setTimeout(() => onPick(c), 1100);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const hint = card ? `${card.name} ${card.reversed ? '역방향' : '정방향'}` : selected === null ? '마음이 가는 카드 한 장을 골라요' : '정말 이 카드로 결정하시겠습니까?';
  return (
    <div className={`tarot-pick${selected !== null ? ' has-selection' : ''}`} role="group" aria-label="카드 고르기">
      <p className="tarot-pick-hint" aria-live="polite">
        {hint}
      </p>
      <div className="tarot-fan">
        {[0, 1, 2, 3, 4].map((i) => (
          <button
            key={i}
            className={`tarot-slot${selected === i ? ' selected' : ''}${selected !== null && selected !== i ? ' dim' : ''}${card && selected === i ? ' flipped' : ''}`}
            style={{ ['--i' as string]: i - 2 }}
            onClick={() => tap(i)}
            disabled={locked}
            aria-pressed={selected === i}
            aria-label={`${i + 1}번째 카드${selected === i ? ' (선택됨, 다시 누르면 취소)' : ''}`}
          >
            <span className="tarot-inner">
              <span className="tarot-face back">
                <CardBack />
              </span>
              <span className="tarot-face front">{card && selected === i && <img src={tarotImage(card.index)} alt="" className={card.reversed ? 'reversed' : ''} />}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="tarot-confirm">
        {selected !== null && !card && (
          <>
            <button className="btn-primary tarot-confirm-btn" onClick={() => void confirm()} disabled={busy}>
              {busy ? '카드를 여는 중…' : '✓ 이 카드로 결정'}
            </button>
            <p className="tarot-confirm-note">선택한 카드를 다시 누르면 다른 카드를 고를 수 있어요</p>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

/** 답변 대기 중 수정구 (3차 리뷰: 3~5초 대기 시간의 몰입감) */
export function CrystalBall() {
  return (
    <div className="crystal" role="status" aria-live="polite">
      <div className="crystal-orb" aria-hidden>
        <span className="crystal-glow" />
        <span className="crystal-ball" />
        <span className="crystal-spark s1">✦</span>
        <span className="crystal-spark s2">✦</span>
        <span className="crystal-spark s3">✧</span>
        <span className="crystal-base" />
      </div>
      <p className="crystal-text">수정구에 카드의 기운을 비추는 중…</p>
      <span className="crystal-dots" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <p className="crystal-sub">보통 3~5초 걸려요</p>
    </div>
  );
}
