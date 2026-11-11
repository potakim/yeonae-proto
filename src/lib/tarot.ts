import { TAROT_CARDS, drawTarot } from './ai/personas';

export interface TarotDraw {
  index: number; // 0~21 (TAROT_CARDS 순서 = 라이더-웨이트 메이저 번호)
  name: string;
  reversed: boolean;
}

export const tarotImage = (index: number) => `/tarot/major-${String(index).padStart(2, '0')}.webp`;

export function drawTarotCard(rand: () => number = Math.random): TarotDraw {
  const d = drawTarot(rand);
  return { index: TAROT_CARDS.indexOf(d.name as (typeof TAROT_CARDS)[number]), name: d.name, reversed: d.reversed };
}
