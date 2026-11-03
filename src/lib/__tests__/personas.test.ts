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
