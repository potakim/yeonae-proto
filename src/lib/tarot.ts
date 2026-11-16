export interface TarotDraw {
  index: number; // 0~21 (TAROT_CARDS 순서 = 라이더-웨이트 메이저 번호)
  name: string;
  reversed: boolean;
}

export const tarotImage = (index: number) => `/tarot/major-${String(index).padStart(2, '0')}.webp`;
