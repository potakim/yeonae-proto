import { useState } from 'react';
import { drawTarotCard, tarotImage, type TarotDraw } from '../lib/tarot';

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
 * 뒷면 5장 중 한 장 고르기 → 뒤집기 → onPick.
 * 어느 자리를 골라도 카드는 코드가 무작위로 뽑는다 (서버·LLM 이 뽑지 않음).
 */
export function TarotPick({ onPick, rand }: { onPick: (card: TarotDraw) => void; rand?: () => number }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [card, setCard] = useState<TarotDraw | null>(null);
  const choose = (i: number) => {
    if (picked !== null) return;
    const c = drawTarotCard(rand);
    setPicked(i);
    setCard(c);
    window.setTimeout(() => onPick(c), 1100);
  };
  return (
    <div className="tarot-pick" role="group" aria-label="카드 고르기">
      <p className="tarot-pick-hint">{picked === null ? '마음이 가는 카드 한 장을 골라요' : `${card?.name} ${card?.reversed ? '역방향' : '정방향'}`}</p>
      <div className="tarot-fan">
        {[0, 1, 2, 3, 4].map((i) => (
          <button
            key={i}
            className={`tarot-slot${picked === i ? ' flipped' : ''}${picked !== null && picked !== i ? ' dim' : ''}`}
            style={{ ['--i' as string]: i - 2 }}
            onClick={() => choose(i)}
            disabled={picked !== null}
            aria-label={`${i + 1}번째 카드`}
          >
            <span className="tarot-inner">
              <span className="tarot-face back">
                <CardBack />
              </span>
              <span className="tarot-face front">{card && picked === i && <img src={tarotImage(card.index)} alt="" className={card.reversed ? 'reversed' : ''} />}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
