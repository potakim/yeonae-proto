import { describe, expect, it } from 'vitest';
import { PERSONAS, TAROT_CARDS, drawTarot, isPersonaId, personaBlock } from '../ai/personas';
import { CHARACTERS, visibleFor, nameOf, byId } from '../../data/characters';

describe('페르소나 · 캐릭터 데이터', () => {
  it('모든 페르소나는 원칙·예시·인사를 갖고 프롬프트 블록에 들어간다', () => {
    for (const p of Object.values(PERSONAS)) {
      expect(p.principles.length).toBeGreaterThan(0);
      expect(p.samples.length).toBeGreaterThan(0);
      const b = personaBlock(p);
      expect(b).toContain(p.greeting);
      expect(b).toContain(p.principles[0]);
    }
    expect(isPersonaId('soeun')).toBe(true);
    expect(isPersonaId('seohwa')).toBe(true);
    // 노션 설정과의 일치: 성현이형·서화는 반말, 고은언니는 31세, 서화 few-shot 포함
    expect(PERSONAS.seonghyun.tone).toContain('항상 반말');
    expect(PERSONAS.seohwa.tone).toContain('반말');
    expect(PERSONAS['hub-f'].age).toBe(31);
    expect(personaBlock(PERSONAS.seohwa)).toContain('답변 예시');
    expect(personaBlock(PERSONAS['hub-m'])).toContain('하지 않는 것');
    expect(isPersonaId('hub')).toBe(false);
  });

  it('채팅 캐릭터는 모두 존재하는 페르소나를 가리킨다', () => {
    for (const c of CHARACTERS.filter((c) => c.screen === 'chat')) expect(c.persona && isPersonaId(c.persona)).toBe(true);
  });

  it('성별 허브는 한쪽만 보이고, 소개 캐릭터는 플래그 OFF 면 보이지 않는다', () => {
    const m = visibleFor('형', false).map((c) => c.id);
    const f = visibleFor('언니', false).map((c) => c.id);
    expect(m).toContain('hub-m');
    expect(m).not.toContain('hub-f');
    expect(f).toContain('hub-f');
    expect(f).not.toContain('hub-m');
    expect(m).not.toContain('jihyun');
    expect(visibleFor('언니', true).map((c) => c.id)).toContain('jihyun');
    expect(nameOf(byId('jihyun')!, '언니')).toBe('지현언니');
    expect(nameOf(byId('jihyun')!, '형')).toBe('지현누나');
  });

  it('타로는 22장 중 코드가 뽑는다', () => {
    expect(TAROT_CARDS).toHaveLength(22);
    expect(drawTarot(() => 0)).toEqual({ name: '바보', reversed: true });
    expect(drawTarot(() => 0.99)).toEqual({ name: '세계', reversed: false });
  });
});

import { drawTarotCard, tarotImage } from '../tarot';
describe('타로 카드 이미지 매핑', () => {
  it('카드 이름 인덱스가 라이더-웨이트 번호와 맞는다', () => {
    expect(drawTarotCard(() => 0)).toEqual({ index: 0, name: '바보', reversed: true });
    expect(drawTarotCard(() => 0.99)).toEqual({ index: 21, name: '세계', reversed: false });
    expect(tarotImage(7)).toBe('/tarot/major-07.webp');
  });
});
