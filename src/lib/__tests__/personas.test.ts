import { describe, expect, it } from 'vitest';
import { PERSONAS, TAROT_CARDS, drawTarot, isPersonaId, personaBlock, personaName, pick } from '../ai/personas';
import { CHARACTERS, visibleFor, nameOf, byId } from '../../data/characters';

describe('페르소나 · 캐릭터 데이터', () => {
  it('모든 페르소나는 원칙·예시·인사·형식을 갖고 성별별 프롬프트 블록에 들어간다', () => {
    for (const p of Object.values(PERSONAS)) {
      expect(p.principles.length).toBeGreaterThan(0);
      for (const g of ['male', 'female'] as const) {
        expect(pick(p.samples, g).length).toBeGreaterThan(0);
        expect(pick(p.prompts, g).length).toBeGreaterThan(0);
        const b = personaBlock(p, g);
        expect(b).toContain(pick(p.greeting, g));
        expect(b).toContain(p.principles[0]);
        expect(b).toContain(g === 'female' ? '여성' : '남성');
      }
      expect(p.format.maxChars).toBeGreaterThanOrEqual(250);
    }
    expect(isPersonaId('soeun')).toBe(true);
    expect(isPersonaId('seohwa')).toBe(true);
    expect(isPersonaId('hub')).toBe(false);
  });

  it('노션 설정: 호칭·말투가 내담자 성별에 따라 달라진다', () => {
    const gihoon = PERSONAS['hub-m'];
    expect(personaName(gihoon, 'male')).toBe('기훈형');
    expect(personaName(gihoon, 'female')).toBe('기훈오빠');
    expect(pick(gihoon.tone, 'female')).toContain('-요체');
    expect(pick(gihoon.tone, 'male')).toContain('반말');
    // 여성 내담자에게는 남성용 예시가 안 들어간다
    expect(personaBlock(gihoon, 'female')).not.toContain('여자친구가 화났는데 나도 연락 안 할까?');
    expect(personaBlock(gihoon, 'male')).toContain('여자친구가 화났는데 나도 연락 안 할까?');

    const seonghyun = PERSONAS.seonghyun;
    expect(personaName(seonghyun, 'female')).toBe('성현오빠');
    expect(pick(seonghyun.tone, 'male')).toContain('무조건 반말');
    expect(personaBlock(seonghyun, 'female')).toContain('남성 입장에서 상대 남성의 심리와 행동을 번역');
    expect(personaBlock(seonghyun, 'male')).toContain('남사친이랑 둘이 술');
    expect(personaBlock(seonghyun, 'female')).not.toContain('남사친이랑 둘이 술');

    const goeun = PERSONAS['hub-f'];
    expect(goeun.age).toBe(31);
    expect(personaName(goeun, 'male')).toBe('고은누나');
    expect(goeun.scope).toBe('relationships');
    expect(goeun.format.maxChars).toBeGreaterThan(500);
    expect(personaBlock(goeun, 'male')).toContain('고민 상대 여성의 연령대');
    expect(PERSONAS.seohwa.fewShots.length).toBeGreaterThan(0);
    expect(personaBlock(PERSONAS.seohwa)).toContain('답변 예시');
  });

  it('채팅 캐릭터는 모두 존재하는 페르소나를 가리킨다', () => {
    for (const c of CHARACTERS.filter((c) => c.screen === 'chat')) expect(c.persona && isPersonaId(c.persona)).toBe(true);
  });

  it('네 상담 캐릭터는 남녀 모두에게 보이고 성별 허브가 맨 위, 소개 캐릭터는 플래그 OFF 면 안 보인다', () => {
    const m = visibleFor('형', false).map((c) => c.id);
    const f = visibleFor('언니', false).map((c) => c.id);
    for (const id of ['hub-m', 'hub-f', 'soeun', 'seonghyun']) {
      expect(m).toContain(id);
      expect(f).toContain(id);
    }
    expect(m[0]).toBe('hub-m');
    expect(f[0]).toBe('hub-f');
    expect(m).not.toContain('jihyun');
    expect(visibleFor('언니', true).map((c) => c.id)).toContain('jihyun');
    expect(nameOf(byId('jihyun')!, '언니')).toBe('지현언니');
    expect(nameOf(byId('hub-m')!, '언니')).toBe('기훈오빠');
    expect(nameOf(byId('hub-f')!, '형')).toBe('고은누나');
    expect(nameOf(byId('soeun')!, '언니')).toBe('소은언니');
    expect(nameOf(byId('saju-master')!, '형')).toBe('서화');
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

import { chatSystem, EMPTY_MEMO } from '../ai/chat';
describe('채팅 프롬프트 — 캐릭터별 형식·범위·성별', () => {
  it('공통 250자 규칙 대신 캐릭터별 답변 형식이 들어간다', () => {
    const goeun = chatSystem('언니', {}, EMPTY_MEMO, [], 1, PERSONAS['hub-f']);
    expect(goeun).toContain('전체 650자 이내');
    expect(goeun).toContain('3~5개의 짧은 문단');
    expect(goeun).toContain('대인관계 고민도');
    expect(goeun).not.toContain('250자 이내');
    const seonghyun = chatSystem('언니', {}, EMPTY_MEMO, [], 1, PERSONAS.seonghyun);
    expect(seonghyun).toContain('짧은 말 여러 덩어리');
    expect(seonghyun).toContain('성현오빠');
    expect(seonghyun).toContain('연애와 상관없는 질문');
    const soeun = chatSystem('형', {}, EMPTY_MEMO, [], 1, PERSONAS.soeun);
    expect(soeun).toContain('전체 250자 이내');
  });
  it('조종 조언 금지는 유지하되 고은언니의 허용 전략(먼저 하던 걸 줄이고 관찰)은 막지 않는다', () => {
    const s = chatSystem('언니', {}, EMPTY_MEMO, [], 1, PERSONAS['hub-f']);
    expect(s).toContain('질투 유발');
    expect(s).toContain('내가 먼저 하던 걸 줄이고');
    expect(s).toContain('캐릭터 자신의 짧은 경험담');
  });
});
