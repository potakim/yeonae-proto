import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { calculateSaju, type SajuInput } from '../saju';
import { computeCompat, compatCriteriaMarkdown } from '../compat/compat';
import { computeChatStats, interestScore, maskText, type ChatMessage } from '../kakao/stats';
import { gateCard, precheck, sanitizeMemo, stripCardMention } from '../ai/chat';
import { getQuestions } from '../personality/questions';
import type { CallModel } from '../../../server/llm';
import { handleCompat } from '../../../api/compat';
import { handleKakao } from '../../../api/kakao';
import { handleChat } from '../../../api/chat';
import { handlePersonality } from '../../../api/personality';

const birth = (y: number, m: number, d: number, h: number | null, gender: 'male' | 'female'): SajuInput => ({
  year: y, month: m, day: d, hour: h, minute: 0, isLunar: false, isLeapMonth: false,
  gender, longitude: 126.978, useTrueSolarTime: true, dayBoundary: 'midnight',
});

/** 스키마의 필드 모양대로 가짜 JSON 을 만드는 대역 */
function fakeFromSchema(schema: Record<string, unknown>): unknown {
  const t = schema.type;
  if (schema.enum) return (schema.enum as unknown[])[0];
  if (Array.isArray(t)) return null;
  if (t === 'object') {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, fakeFromSchema(v)]));
  }
  if (t === 'array') return [fakeFromSchema(schema.items as Record<string, unknown>)];
  if (t === 'boolean') return false;
  return '테스트';
}
const makeCaller = (overrides: Record<string, unknown>[] = []) => {
  const calls: Parameters<CallModel>[0][] = [];
  const fn: CallModel = async (args) => {
    calls.push(args);
    const o = overrides[calls.length - 1];
    const data = o ?? fakeFromSchema(args.schema as Record<string, unknown>);
    return { text: JSON.stringify(data), usage: { input: 10, output: 5 }, stop: 'end_turn' };
  };
  return { fn, calls };
};
const req = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': `t-${Math.random()}` } });

describe('궁합 (코드 점수)', () => {
  // 갑오 일주 남 1979-01-27 × 기미 일주? → 일간 갑-기 합을 만드는 상대를 고른다
  const me = calculateSaju(birth(1979, 1, 27, 12, 'male'));
  it('같은 입력이면 같은 점수, 범위 15~98', () => {
    const p = calculateSaju(birth(1995, 3, 15, 14, 'female'));
    const a = computeCompat({ label: '나', saju: me, mbti: 'INTJ' }, { label: '그 사람', saju: p, mbti: 'ENFP' });
    const b = computeCompat({ label: '나', saju: me, mbti: 'INTJ' }, { label: '그 사람', saju: p, mbti: 'ENFP' });
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThanOrEqual(15);
    expect(a.score).toBeLessThanOrEqual(98);
    expect(a.score).toBe(Math.max(15, Math.min(98, 60 + a.items.reduce((s, i) => s + i.delta, 0))));
  });

  it('일간 甲己합이면 +12, 남자에게 己는 정재 = 이성의 별', () => {
    // 일주가 기(己)인 날 찾기
    let p = null;
    for (let d = 1; d <= 30 && !p; d++) {
      const s = calculateSaju(birth(1996, 6, d, 12, 'female'));
      if (s.detail.day.heavenlyStem === '기') p = s;
    }
    const c = computeCompat({ label: '나', saju: me, mbti: null }, { label: '그 사람', saju: p!, mbti: null });
    expect(c.items.find((i) => i.key === 'dm.combine')?.delta).toBe(12);
    expect(c.items.some((i) => i.key === 'star.me')).toBe(true);
    expect(c.mbti).toBeNull();
    expect(c.items.some((i) => i.category === 'MBTI')).toBe(false);
  });

  it('일지 午×子 충은 -10', () => {
    let p = null;
    for (let d = 1; d <= 30 && !p; d++) {
      const s = calculateSaju(birth(1997, 4, d, 12, 'female'));
      if (s.detail.day.earthlyBranch === '자') p = s;
    }
    const c = computeCompat({ label: '나', saju: me, mbti: null }, { label: '그', saju: p!, mbti: null });
    expect(c.items.find((i) => i.key === 'db.충')?.delta).toBe(-10);
  });

  it('궁합 기준 문서가 코드와 같다 (UPDATE_DOCS=1 로 재생성)', () => {
    const path = fileURLToPath(new URL('../../../docs/compat-criteria.md', import.meta.url));
    const md = compatCriteriaMarkdown();
    if (process.env.UPDATE_DOCS === '1') writeFileSync(path, md);
    expect(readFileSync(path, 'utf8')).toBe(md);
  });
});

describe('카톡 통계·마스킹', () => {
  it('전화번호·계좌·이름(성 뺀 이름 포함)을 가린다', () => {
    const t = maskText('김민수야 010-1234-5678로 연락줘 민수 계좌 110-123-456789', ['김민수']);
    expect(t).not.toMatch(/010|1234|민수|110-123/);
    expect(t).toContain('[전화번호]');
    expect(t).toContain('[계좌]');
  });

  const conv: ChatMessage[] = [
    { speaker: 'system', text: '2026년 10월 27일 화요일', time: null },
    { speaker: 'them', text: '뭐해? 오늘 날씨 좋다', time: '10:00' },
    { speaker: 'me', text: '나 카페 왔어 ㅋㅋ', time: '10:05' },
    { speaker: 'them', text: '어디 카페? 나도 가고 싶다', time: '10:06' },
    { speaker: 'me', text: '성수동!', time: '10:20' },
    { speaker: 'them', text: '다음에 같이 가자 보고싶다', time: '10:21' },
    { speaker: 'me', text: '좋아', time: '14:30' },
    { speaker: 'them', text: '잘자 ㅎㅎ', time: '23:00' },
  ];

  it('선톡·답장 시간·질문·애정 표현', () => {
    const s = computeChatStats(conv);
    expect(s.them.messages).toBe(4);
    expect(s.me.messages).toBe(3);
    // 10:00 첫 메시지(상대), 14:30(4시간 공백 → 나), 23:00(상대)
    expect(s.them.initiations).toBe(2);
    expect(s.me.initiations).toBe(1);
    expect(s.them.medianReplyMin).toBe(1);
    expect(s.them.questions).toBe(2);
    expect(s.them.affection).toBeGreaterThanOrEqual(2);
  });

  it('호감도: 빠른 답장·선톡·질문·애정 → 높음, 대화가 짧아 신뢰도 낮음', () => {
    const i = interestScore(computeChatStats(conv));
    expect(i.score).toBeGreaterThanOrEqual(75);
    expect(i.confidence).toBe('낮음');
    expect(i.factors.map((f) => f.key)).toEqual(expect.arrayContaining(['reply.fast', 'init.them', 'affection']));
  });
});

describe('허브 채팅 안전 장치', () => {
  it('위기·피해·감시 요청 규칙 감지', () => {
    expect(precheck('요즘 너무 힘들어서 죽고 싶어')).toBe('crisis');
    expect(precheck('남친이 저를 때렸어요')).toBe('violence_victim');
    expect(precheck('여친 폰 비밀번호 몰래 알아내는 법')).toBe('harmful_request');
    expect(precheck('썸남이 답장을 늦게 해요')).toBeNull();
  });

  it('위기 발화는 LLM 호출 없이 고정 응답(109 안내)', async () => {
    const c = makeCaller();
    const res = await handleChat(req({ hub: '형', messages: [{ role: 'user', content: '그냥 사라지고 싶어요' }] }), { env: {}, callModel: c.fn });
    const j = await res.json();
    expect(j.reply).toContain('109');
    expect(j.safety.by).toBe('rule');
    expect(c.calls).toHaveLength(0);
  });

  it('모델이 위험으로 분류하면 고정 응답으로 교체', async () => {
    const c = makeCaller([{ category: 'violence_victim', reply: '모델 답', card: 'kakao' }]);
    const res = await handleChat(req({ hub: '언니', messages: [{ role: 'user', content: '요즘 그 사람이 좀 무서워요' }] }), { env: {}, callModel: c.fn });
    const j = await res.json();
    expect(j.reply).toContain('1366');
    expect(j.card).toBe('none');
  });

  it('정상 대화: 경량 모델, 이전 턴은 history 로', async () => {
    const c = makeCaller([{ category: 'normal', reply: '그랬구나', card: 'kakao' }]);
    const res = await handleChat(
      req({ hub: '형', messages: [{ role: 'user', content: '썸남 답장이 느려요' }, { role: 'assistant', content: '얼마나?' }, { role: 'user', content: '반나절이요' }] }),
      { env: {}, callModel: c.fn },
    );
    const j = await res.json();
    expect(j.card).toBe('kakao');
    expect(c.calls[0].model).toBe('claude-haiku-5-5');
    expect(c.calls[0].history).toHaveLength(2);
  });
});

describe('API 핸들러 (Claude 대역)', () => {
  it('궁합: 서버가 두 원국을 계산, 같은 요청은 캐시', async () => {
    const store = new Map<string, unknown>();
    const cache = { get: async (k: string) => store.get(k) ?? null, set: async (k: string, v: unknown) => void store.set(k, v) };
    const c = makeCaller();
    const body = { me: { birth: birth(1979, 1, 27, 12, 'male'), mbti: 'intj' }, partner: { birth: birth(1995, 3, 15, null, 'female'), label: '썸녀<script>' } };
    const a = await (await handleCompat(req(body), { env: {}, cache, callModel: c.fn })).json();
    const b = await (await handleCompat(req(body), { env: {}, cache, callModel: c.fn })).json();
    expect(a.compat.me.mbti).toBe('INTJ');
    expect(a.compat.partner.label).toBe('썸녀script');
    expect(a.meta.cached).toBe(false);
    expect(b.meta.cached).toBe(true);
    expect(c.calls).toHaveLength(1);
    expect(c.calls[0].user).not.toContain('1995');
  });

  it('궁합: 잘못된 MBTI 는 400', async () => {
    const res = await handleCompat(req({ me: { birth: birth(1979, 1, 27, 12, 'male'), mbti: 'ABCD' }, partner: { birth: birth(1995, 3, 15, null, 'female') } }), { env: {}, callModel: makeCaller().fn });
    expect(res.status).toBe(400);
  });

  it('카톡: 추출 → 마스킹 → 통계 → 해석, 원문은 응답에 없음', async () => {
    const extraction = {
      readable: true,
      reason: '',
      partnerName: '김민수',
      messages: [
        { speaker: 'them', text: '민수가 보낸 메시지 010-1111-2222', time: '10:00' },
        { speaker: 'me', text: '응응 ㅋㅋ', time: '10:02' },
        { speaker: 'them', text: '오늘 뭐해?', time: '10:03' },
        { speaker: 'me', text: '집!', time: '10:10' },
      ],
    };
    const c = makeCaller([extraction]);
    const res = await handleKakao(req({ images: [{ data: 'AAAA', mediaType: 'image/png' }], note: '소개팅 2주차' }), { env: {}, callModel: c.fn });
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(c.calls).toHaveLength(2);
    expect(Array.isArray(c.calls[0].user)).toBe(true); // 이미지 블록
    const second = c.calls[1].user as string;
    expect(second).not.toMatch(/민수|010-1111/);
    expect(JSON.stringify(j)).not.toMatch(/민수|010-1111|오늘 뭐해/);
    expect(j.stats.them.messages).toBe(2);
    expect(j.meta.extractedMessages).toBe(4);
  });

  it('카톡: 읽을 수 없는 이미지면 422', async () => {
    const c = makeCaller([{ readable: false, reason: '카톡 화면이 아니에요', partnerName: null, messages: [] }]);
    const res = await handleKakao(req({ images: [{ data: 'AAAA' }] }), { env: {}, callModel: c.fn });
    expect(res.status).toBe(422);
    expect(c.calls).toHaveLength(1);
  });

  it('성격유형: 서버에서 재채점, 응답 누락은 400', async () => {
    const qs = getQuestions('quick');
    const answers = Object.fromEntries(qs.map((q) => [q.id, q.pole === 'I' || q.pole === 'N' || q.pole === 'F' || q.pole === 'P' ? 5 : 1]));
    const c = makeCaller();
    const j = await (await handlePersonality(req({ mode: 'quick', answers, hub: '언니', situation: '썸' }), { env: {}, cache: { get: async () => null, set: async () => {} }, callModel: c.fn })).json();
    expect(j.type).toBe('INFP');
    expect(c.calls[0].system).toContain('아는 언니');
    const bad = await handlePersonality(req({ mode: 'quick', answers: {}, hub: '형' }), { env: {}, callModel: c.fn });
    expect(bad.status).toBe(400);
  });
});

describe('허브 채팅 일관성', () => {
  it('메모: 형식·길이 정리, 엉뚱한 상황값은 모름', () => {
    const m = sanitizeMemo({ situation: '우주', concern: '<b>답장</b>이 느려요', partner: 'x'.repeat(300), facts: ['a', '', 'b', 1] });
    expect(m.situation).toBe('모름');
    expect(m.concern).toBe('b답장/b이 느려요');
    expect(m.partner.length).toBe(120);
    expect(m.facts).toEqual(['a', 'b']);
  });

  it('카드: 첫 발화엔 안 띄우고, 이미 보여 준 카드는 다시 안 띄움', () => {
    expect(gateCard('kakao', 1, [])).toBe('none');
    expect(gateCard('kakao', 2, [])).toBe('kakao');
    expect(gateCard('kakao', 3, ['kakao'])).toBe('none');
    expect(gateCard('compat', 3, ['kakao'])).toBe('compat');
  });

  it('카드를 막으면 답 끝의 소개 문장도 뺀다', () => {
    expect(stripCardMention('그랬구나. 답장이 느리면 답답하죠. 여사친한테 카톡 한번 보여 줄래요?')).toBe('그랬구나. 답장이 느리면 답답하죠.');
    expect(stripCardMention('그랬구나. 얼마나 됐어요?')).toBe('그랬구나. 얼마나 됐어요?');
  });

  it('메모·이미 본 카드가 시스템 프롬프트에 들어가고, 갱신된 메모가 돌아온다', async () => {
    const c = makeCaller([
      { category: 'normal', focus: '답장이 반나절 걸림', memo: { situation: '썸', concern: '썸남 답장이 느림', partner: '소개팅 상대', facts: ['2주째 연락'] }, reply: '반나절이면 서운하죠. 여사친한테 카톡 보여 줄래요?', card: 'kakao' },
    ]);
    const res = await handleChat(
      req({
        hub: '형',
        memo: { situation: '썸', concern: '썸남 답장이 느림', partner: '소개팅 상대', facts: [] },
        shownCards: ['kakao'],
        messages: [{ role: 'user', content: '썸남 답장이 느려요' }, { role: 'assistant', content: '얼마나?' }, { role: 'user', content: '반나절이요' }],
      }),
      { env: {}, callModel: c.fn },
    );
    const j = await res.json();
    expect(c.calls[0].system).toContain('썸남 답장이 느림');
    expect(c.calls[0].system).toContain('이미 소개한 카드: kakao');
    expect(j.card).toBe('none');
    expect(j.reply).toBe('반나절이면 서운하죠.');
    expect(j.memo.facts).toEqual(['2주째 연락']);
    expect(j.meta.cardGated).toBe('kakao');
  });

  it('첫 발화에서는 프롬프트로 카드 금지를 알린다', async () => {
    const c = makeCaller([{ category: 'normal', focus: '인사', memo: { situation: '모름', concern: '', partner: '', facts: [] }, reply: '반가워요. 무슨 일 있어요?', card: 'none' }]);
    await handleChat(req({ hub: '언니', messages: [{ role: 'user', content: '안녕하세요' }] }), { env: {}, callModel: c.fn });
    expect(c.calls[0].system).toContain('card 를 반드시 none');
    expect(c.calls[0].system).toContain('안녕, 나 아는 언니야');
  });
});

