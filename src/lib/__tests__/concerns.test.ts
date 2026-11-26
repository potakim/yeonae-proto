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

describe('상담 캐릭터 프로필 화면 (8차 리뷰 2026-11-26)', () => {
  const four = ['hub-m', 'hub-f', 'seonghyun', 'soeun'].map((id) => CHARACTERS.find((c) => c.id === id)!);
  it('상담 4인만 새 프로필 화면 데이터가 있다', () => {
    expect(CHARACTERS.filter((c) => c.showcase).map((c) => c.id).sort()).toEqual(['hub-f', 'hub-m', 'seonghyun', 'soeun']);
  });
  it('노션 표의 문구: 역할 소개, 대화 예시 4개, 상담 특징 3개, 고민 카드 3개, 안내 박스', () => {
    for (const c of four) {
      expect(c.tagline, c.id).toContain(' · ');
      expect(Object.values(c.showcase!.sample).every((x) => x.length > 0), c.id).toBe(true);
      expect(c.showcase!.sample.quote, c.id).toMatch(/^“.*”$/);
      expect(c.does, c.id).toHaveLength(3);
      expect(c.asks, c.id).toHaveLength(3);
      expect(c.name.endsWith(c.showcase!.short), c.id).toBe(true);
    }
    const goeun = four[1];
    expect(goeun.tagline).toBe('결혼 준비 중인 선배 · 내 편에서 해결 방법');
    expect(goeun.showcase!.sample.user).toBe('매번 제가 언제 볼지 물어보는 게 싫어요.');
    expect(goeun.asks!.map((a) => a.label)).toEqual(['나만 먼저 연락하는 것 같아요', '싸우지 않고 마음을 전하고 싶어요', '결혼 이야기를 꺼내기 어려워요']);
    expect(goeun.showcase!.note.title).toBe('대화 원문은 30일 뒤 자동으로 지워져요');
    expect(four[0].showcase!.note.title).toBe('무료로 대화할 수 있어요');
  });
});
