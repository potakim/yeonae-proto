import { describe, expect, it } from 'vitest';
import { LocalSessionStore, memoForContinue, memoForNew, memoForPartner, titleFrom } from '../sessions/store';

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}

describe('세션 저장소 (§7)', () => {
  it('세션을 만들고 저장하고 다시 읽는다', () => {
    const st = mem();
    const a = new LocalSessionStore(st);
    const s = a.createSession({ character: 'soeun', title: '새 상담', origin: 'new', memo: { situation: '모름', concern: '', partner: '', facts: [] } });
    a.updateSession(s.id, { title: titleFrom('남친이 요즘 연락이 뜸해졌어요'), messages: [{ role: 'user', content: '남친이' }] });
    const b = new LocalSessionStore(st);
    expect(b.listSessions('soeun')[0].title).toBe('남친이 요즘 연락이 뜸해졌어요');
    expect(b.listSessions('hub-m')).toHaveLength(0);
  });

  it('고정된 세션이 먼저, 그다음 최근순', () => {
    const a = new LocalSessionStore(mem());
    const m = { situation: '모름' as const, concern: '', partner: '', facts: [] };
    const s1 = a.createSession({ character: 'x', title: '1', origin: 'new', memo: m });
    const s2 = a.createSession({ character: 'x', title: '2', origin: 'new', memo: m });
    a.updateSession(s1.id, { pinned: true });
    expect(a.listSessions('x').map((s) => s.id)).toEqual([s1.id, s2.id]);
  });

  it('이전 상담에서 이어서: 부모 memo + 요약 한 줄, 원문은 안 넘어간다', () => {
    const a = new LocalSessionStore(mem());
    const parent = a.createSession({
      character: 'x',
      title: '전남친 연락 고민',
      origin: 'new',
      memo: { situation: '이별', concern: '전남친이 연락을 해옴', partner: '전남친, 3년 연애', facts: ['지난주 통화함'] },
      messages: [{ role: 'user', content: '비밀 원문' }],
    });
    const memo = memoForContinue(parent);
    expect(memo.situation).toBe('이별');
    expect(memo.facts).toContain('지난주 통화함');
    expect(memo.facts.some((f) => f.startsWith('이전 상담(전남친 연락 고민)'))).toBe(true);
    expect(JSON.stringify(memo)).not.toContain('비밀 원문');
  });

  it('이전 상대에 대한 새 고민: 그 상대의 저장 분석만 요약으로 들어간다', () => {
    const a = new LocalSessionStore(mem());
    const p = a.upsertPartner('지훈', '3개월 썸');
    const q = a.upsertPartner('민수');
    a.saveAnalysis({ type: 'match', sourceCharacter: 'saju-master', partnerId: p.id, title: '궁합 결과 — 지훈', summary: '궁합 72점' });
    a.saveAnalysis({ type: 'kakao', sourceCharacter: 'yeosachin', partnerId: q.id, title: '카톡 분석 — 민수', summary: '호감도 40점' });
    a.saveAnalysis({ type: 'trait', sourceCharacter: 'teacher', title: '연애 성향', summary: 'ENFP 불꽃형' });
    const memo = memoForPartner(p, a.listAnalyses());
    expect(memo.partner).toBe('지훈 · 3개월 썸');
    expect(memo.facts).toEqual(['[궁합 결과] 궁합 72점']);
    expect(memoForNew(a.listAnalyses()).facts).toEqual(['[내 연애 성향] ENFP 불꽃형']);
    expect(a.upsertPartner('지훈').id).toBe(p.id); // 같은 별칭은 같은 상대
  });

  it('세션 삭제해도 저장된 분석은 남고, 전체 삭제는 다 지운다', () => {
    const a = new LocalSessionStore(mem());
    const s = a.createSession({ character: 'x', title: 't', origin: 'new', memo: { situation: '모름', concern: '', partner: '', facts: [] } });
    a.saveAnalysis({ type: 'trait', sourceCharacter: 'teacher', title: 't', summary: 's' });
    a.deleteSession(s.id);
    expect(a.listSessions()).toHaveLength(0);
    expect(a.listAnalyses()).toHaveLength(1);
    a.clearAll();
    expect(a.listAnalyses()).toHaveLength(0);
  });

  it('제목은 타로 카드 표기를 빼고 22자에서 자른다', () => {
    expect(titleFrom('연락할까요?\n[카드: 별 (정방향)]')).toBe('연락할까요?');
    expect(titleFrom('가'.repeat(30))).toBe('가'.repeat(22) + '…');
    expect(titleFrom('   ')).toBe('새 상담');
  });
});
