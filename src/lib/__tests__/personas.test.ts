import { describe, expect, it } from 'vitest';
import { PERSONAS, TAROT_CARDS, isPersonaId, personaBlock, personaName, pick, validAge } from '../ai/personas';
import { CHARACTERS, visibleFor, nameOf, byId } from '../../data/characters';

describe('페르소나 · 캐릭터 데이터', () => {
  it('모든 페르소나는 원칙·예시·인사·형식을 갖고 사용자 설정별 프롬프트 블록에 들어간다', () => {
    for (const p of Object.values(PERSONAS)) {
      expect(p.principles.length).toBeGreaterThan(0);
      for (const g of ['male', 'female', null] as const) {
        expect(pick(p.samples, g).length).toBeGreaterThan(0);
        expect(pick(p.prompts, g).length).toBeGreaterThan(0);
        const b = personaBlock(p, { gender: g, age: null });
        expect(b).toContain(pick(p.greeting, g));
        expect(b).toContain(p.principles[0]);
        expect(b).toContain(g === 'female' ? '사용자는 여성' : g === 'male' ? '사용자는 남성' : '성별은 확인되지 않았어');
      }
      expect(p.format.maxChars).toBeGreaterThanOrEqual(250);
    }
    expect(isPersonaId('soeun')).toBe(true);
    expect(isPersonaId('seohwa')).toBe(true);
    expect(isPersonaId('hub')).toBe(false);
  });

  it('11/19 개정: 고정 나이 없음 — 기훈·고은은 연상, 성현·소은은 동갑, 나이를 모르면 지어내지 않는다', () => {
    const F = { gender: 'female', age: 28 } as const;
    for (const id of ['hub-m', 'hub-f'] as const) {
      expect(PERSONAS[id].ageRelation).toBe('older');
      const b = personaBlock(PERSONAS[id], F);
      expect(b).toContain('사용자는 28세');
      expect(b).toContain('너는 사용자보다 나이가 많아');
      expect(personaBlock(PERSONAS[id], { gender: 'female', age: null })).toContain('숫자로 지어내지 마');
    }
    for (const id of ['seonghyun', 'soeun'] as const) {
      expect(PERSONAS[id].ageRelation).toBe('peer');
      expect(personaBlock(PERSONAS[id], F)).toContain('너는 사용자와 동갑이야');
      expect(personaBlock(PERSONAS[id], F)).toContain('연상인 것처럼 굴지 마');
    }
    // 예전 고정 나이가 프롬프트에 남아 있지 않다
    for (const id of ['hub-m', 'hub-f', 'seonghyun', 'soeun'] as const) expect(personaBlock(PERSONAS[id], { gender: 'male', age: null })).not.toMatch(/(34|31|30|27|25)세/);
    expect(validAge(28)).toBe(28);
    for (const bad of [0, 13, 100, 27.5, '28', null, undefined, NaN]) expect(validAge(bad)).toBeNull();
  });

  it('11/19 개정: 실명 표시, 스스로 형·오빠·언니·누나라고 하지 않고 사용자 말투 선호가 우선', () => {
    for (const id of ['hub-m', 'hub-f', 'seonghyun', 'soeun'] as const) {
      const p = PERSONAS[id];
      expect(personaName(p, 'male')).toBe(p.realName);
      expect(personaName(p, 'female')).toBe(p.realName);
      for (const g of ['male', 'female'] as const) {
        const b = personaBlock(p, { gender: g, age: 30 });
        expect(b).toContain('너 스스로를 형·오빠·언니·누나라고 부르지 마');
        expect(b).toContain('memo.pref');
        expect(pick(p.greeting, g)).not.toMatch(/기훈형|기훈오빠|고은언니|고은누나|성현이형|성현오빠|소은누나|소은언니/);
      }
    }
    // 서화·타로는 상담 캐릭터가 아니라 호칭·나이 규칙이 들어가지 않는다
    expect(personaBlock(PERSONAS.seohwa)).not.toContain('memo.pref');
  });

  it('기훈: 여성은 해요체, 남성은 반말, 성별을 모르면 해요체. 성별에 맞는 예시만 들어간다', () => {
    const gihoon = PERSONAS['hub-m'];
    expect(pick(gihoon.tone, 'female')).toContain('-요체');
    expect(pick(gihoon.tone, 'female')).toContain("'야', '너', '네가'로 부르지 않는다");
    expect(pick(gihoon.tone, 'male')).toContain('반말');
    expect(pick(gihoon.tone, null)).toContain('성별을 모르면 친근한 해요체');
    const f = personaBlock(gihoon, { gender: 'female', age: null });
    const m = personaBlock(gihoon, { gender: 'male', age: null });
    expect(f).not.toContain('여자친구가 화났는데 나도 연락 안 할까?');
    expect(m).toContain('여자친구가 화났는데 나도 연락 안 할까?');
    expect(m).toContain('못생겼다고 헤어지자고');
    expect(f).toContain('같은 문제로 계속 싸워요'); // 성별 공통 예시
    expect(f).toContain('한 번에 하나 정도만');
  });

  it('고은: 존댓말 기본(원하면 반말), 예비신부, 대인관계까지, 연령대별 해석', () => {
    const goeun = PERSONAS['hub-f'];
    const b = personaBlock(goeun, { gender: 'female', age: 27 });
    expect(pick(goeun.tone, 'female')).toContain('모르면 편안한 존댓말');
    expect(pick(goeun.tone, 'female')).toContain('반말을 원하');
    expect(b).toContain('예비신부');
    expect(b).toContain('이미 결혼한 사람처럼 말하');
    expect(b).toContain('그 연령대의 현실적인 관심사');
    expect(b).toContain('사용자가 반말을 원한 경우');
    expect(b).toContain('결혼 얘기만 나오면 기대되면서도 걱정돼요.');
    expect(pick(goeun.greeting, 'female')).toMatch(/요\.$/);
    expect(goeun.scope).toBe('relationships');
    expect(goeun.format.maxChars).toBeGreaterThan(500);
  });

  it('성현: 동갑 반말(원하면 존댓말), 2~4문장, 잡담에는 그냥 답한다', () => {
    const p = PERSONAS.seonghyun;
    expect(pick(p.tone, 'male')).toContain('동갑 친구의 친근한 반말이 기본');
    expect(pick(p.tone, 'male')).not.toContain('무조건 반말');
    expect(p.format.rule).toContain('2~4문장');
    expect(p.scope).toBe('open');
    const b = personaBlock(p, { gender: 'female', age: 26 });
    expect(b).toContain('오늘 저녁 뭐 먹을까?');
    expect(b).toContain('사용자가 존댓말을 원한 경우');
    expect(b).toContain('남성 입장에서 상대 남성의 심리와 행동을 번역');
  });

  it('소은: 질문 많은 동갑 친구 — 판단 로직·윤리·예시가 들어간다', () => {
    const p = PERSONAS.soeun;
    const b = personaBlock(p, { gender: 'male', age: 29 });
    expect(b).toContain('질문을 많이 던져서 상황을 같이 뜯어보는');
    expect(b).toContain('가장 중요한 질문 1~2개');
    expect(b).toContain('차단을 우회한 연락');
    expect(b).toContain('아 그러면 얘기가 좀 달라지는데?');
    expect(b).toContain('스스로를 누나·언니라고 부르지 않는다');
    expect(p.fewShots.length).toBeGreaterThanOrEqual(8);
    expect(p.scope).toBe('open');
    expect(p.format.rule).toContain('2~5문장');
    // 가이드 질문은 남녀 공용
    expect(pick(p.prompts, 'female')).toEqual(pick(p.prompts, 'male'));
    expect(PERSONAS.seohwa.fewShots.length).toBeGreaterThan(1);
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
    expect(nameOf(byId('hub-m')!, '언니')).toBe('최기훈');
    expect(nameOf(byId('hub-f')!, '형')).toBe('이고은');
    expect(nameOf(byId('soeun')!, '언니')).toBe('박소은');
    expect(nameOf(byId('seonghyun')!, '형')).toBe('이성현');
    // 프로필 태그에 고정 나이가 없다
    for (const id of ['hub-m', 'hub-f', 'soeun', 'seonghyun']) expect(byId(id)!.tagline).not.toMatch(/\d+세/);
    expect(nameOf(byId('saju-master')!, '형')).toBe('서화');
  });

  it('타로 덱은 메이저 아르카나 22장 (추첨은 서버 — tarot.test.ts)', () => {
    expect(TAROT_CARDS).toHaveLength(22);
  });
});

import { tarotImage } from '../tarot';
describe('타로 카드 이미지 매핑', () => {
  it('카드 이름 인덱스가 라이더-웨이트 번호와 맞는다', () => {
    expect(TAROT_CARDS[0]).toBe('바보');
    expect(TAROT_CARDS[21]).toBe('세계');
    expect(tarotImage(7)).toBe('/tarot/major-07.webp');
  });
});

import { chatSystem, EMPTY_MEMO } from '../ai/chat';
describe('채팅 프롬프트 — 캐릭터별 형식·범위·사용자 설정', () => {
  it('캐릭터별 답변 형식과 범위가 들어간다', () => {
    const goeun = chatSystem('언니', {}, EMPTY_MEMO, [], 1, PERSONAS['hub-f']);
    expect(goeun).toContain('전체 700자 이내');
    expect(goeun).toContain('3~6개의 짧은 문단');
    expect(goeun).toContain('대인관계 고민도');
    const seonghyun = chatSystem('언니', {}, EMPTY_MEMO, [], 1, PERSONAS.seonghyun);
    expect(seonghyun).toContain('평소 2~4문장');
    expect(seonghyun).toContain('모든 대화를 연애 상담으로 몰지 말고');
    expect(seonghyun).not.toContain('연애 이야기로 부드럽게 돌아와');
    const gihoon = chatSystem('형', {}, EMPTY_MEMO, [], 1, PERSONAS['hub-m']);
    expect(gihoon).toContain('연애 이야기로 부드럽게 돌아와');
  });
  it('사용자 나이는 서버가 확인한 값만 들어가고, 잘못된 값은 버린다', () => {
    expect(chatSystem('형', {}, EMPTY_MEMO, [], 1, PERSONAS.soeun, 29)).toContain('사용자는 29세');
    const bad = chatSystem('형', {}, EMPTY_MEMO, [], 1, PERSONAS.soeun, 7);
    expect(bad).not.toContain('7세');
    expect(bad).toContain('나이는 확인되지 않았어');
  });
  it('답변 생동감·말투 선호·AI 고지 규칙이 들어간다', () => {
    const s = chatSystem('형', {}, EMPTY_MEMO, [], 3, PERSONAS['hub-m']);
    expect(s).toContain('## 답변 생동감');
    expect(s).toContain('같은 답을 반복하지 말고');
    expect(s).toContain('pref: 사용자가 직접 요청한 말투·호칭 선호');
    expect(s).toContain('정직하게 AI 캐릭터라고 답해');
  });
  it('안전: 이별·슬픔만으로 위기로 보지 않고, 연락처는 모델이 쓰지 않는다', () => {
    const s = chatSystem('형', {}, EMPTY_MEMO, [], 1, PERSONAS['hub-m']);
    expect(s).toContain('이별, 외모 비하, 서운함이나 슬픔만으로는 위기가 아니야');
    expect(s).toContain('harm_others');
    expect(s).toContain('위험한 물건을 내려놓으라고');
    expect(s).toContain('전화번호나 기관 이름은 네가 쓰지 마');
    expect(s).toContain('과거 얘기인지 지금 얘기인지');
    expect(s).not.toMatch(/109|1366|1577/);
  });
  it('조종 조언 금지는 유지하되 고은의 허용 전략(먼저 하던 걸 줄이고 관찰)은 막지 않는다', () => {
    const s = chatSystem('언니', {}, EMPTY_MEMO, [], 1, PERSONAS['hub-f']);
    expect(s).toContain('질투 유발');
    expect(s).toContain('내가 먼저 하던 걸 줄이고');
    expect(s).toContain('캐릭터 자신의 짧은 경험담');
  });
});

describe('탐정 캐릭터', () => {
  it('카톡 분석 섹션에 여사친과 함께 보이고, 전용 화면으로 간다', () => {
    const d = byId('detective')!;
    expect(d.category).toBe('kakao');
    expect(d.screen).toBe('detective');
    expect(byId('yeosachin')!.screen).toBe('kakao'); // 여사친은 그대로
    const ids = visibleFor('형', false).map((c) => c.id);
    expect(ids).toContain('detective');
    expect(ids).toContain('yeosachin');
  });
});
