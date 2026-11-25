import { describe, expect, it } from 'vitest';
import { ALL_CONCERNS, CONCERN_TOPICS, FIRST_VISIT_CONCERNS, todaysConcerns } from '../../data/concerns';
import { CHARACTERS, visibleFor } from '../../data/characters';

describe('대화 주제 추천 (7차 리뷰)', () => {
  it('노션 표와 같은 7개 주제 · 24개 고민', () => {
    expect(CONCERN_TOPICS.map((t) => t.topic)).toEqual(['연락·카톡', '썸·짝사랑', '소개팅·새로운 만남', '연애 중 느끼는 변화', '다툼·서운함', '이별·재회', '내 마음 정리']);
    expect(ALL_CONCERNS).toHaveLength(24);
    expect(new Set(ALL_CONCERNS).size).toBe(24);
  });
  it('첫 방문은 정해진 3개, 그 뒤로는 날짜마다 서로 다른 주제에서 3개', () => {
    expect(todaysConcerns(true, 123)).toEqual(FIRST_VISIT_CONCERNS);
    for (const x of FIRST_VISIT_CONCERNS) expect(ALL_CONCERNS).toContain(x);
    for (let d = 0; d < 60; d++) {
      const xs = todaysConcerns(false, 20000 + d);
      expect(xs).toHaveLength(3);
      for (const x of xs) expect(ALL_CONCERNS).toContain(x);
      const topics = xs.map((x) => CONCERN_TOPICS.find((t) => t.items.includes(x))!.topic);
      expect(new Set(topics).size).toBe(3);
    }
    expect(todaysConcerns(false, 20000)).not.toEqual(todaysConcerns(false, 20001));
  });
});

describe('프로필 레이아웃 데이터 (7차 리뷰)', () => {
  it('보이는 캐릭터는 모두 키워드 칩이 있고, 서화는 노션 지정 4개', () => {
    for (const c of visibleFor('형', true)) expect(c.chips?.length, c.id).toBeGreaterThanOrEqual(3);
    expect(CHARACTERS.find((c) => c.id === 'saju-master')!.chips).toEqual(['사주', '궁합', '연애운', '인연']);
  });
  it('질문 줄은 3개씩이고, 대화가 되는 캐릭터에만 있다', () => {
    for (const c of CHARACTERS.filter((c) => c.asks)) {
      expect(c.asks, c.id).toHaveLength(3);
      expect(c.screen === 'chat' || c.screen === 'saju', c.id).toBe(true);
    }
    const seohwa = CHARACTERS.find((c) => c.id === 'saju-master')!;
    expect(seohwa.asks!.map((a) => a.label)).toEqual(['요즘 내 연애운이 궁금해요', '그 사람과 궁합을 보고 싶어요', '재회해도 괜찮을지 궁금해요']);
    expect(seohwa.asks![1].screen).toBe('compat');
  });
});
