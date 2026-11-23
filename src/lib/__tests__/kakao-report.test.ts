/**
 * 탐정 리포트 집계 — 노션 「탐정 캐릭터」의 집계 기준을 손으로 계산한 값과 대조한다.
 */
import { describe, expect, it } from 'vitest';
import { parseKakaoExport } from '../kakao/parse';
import { buildReport, reportSummary, MIN_REPLIES } from '../kakao/report';

const line = (d: string, t: string, who: string, text: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return `${y}년 ${m}월 ${dd}일 ${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(mi).padStart(2, '0')}, ${who} : ${text}`;
};
const file = (rows: [string, string, string, string][]) => parseKakaoExport(rows.map((r) => line(...r)).join('\n'), { keepMedia: true });

// 11/2(월) ~ 11/4(수). 공백 6시간 기준으로 대화 4개.
const base: [string, string, string, string][] = [
  // 대화 1 (11/2 오전) — 내가 시작
  ['2026-11-02', '09:00', '나', '좋은 아침!'],
  ['2026-11-02', '09:01', '나', '오늘 뭐해?'],
  ['2026-11-02', '09:11', '지훈', '출근 중'], // 지훈 답장 10분 (묶음 끝 09:01 → 09:11)
  ['2026-11-02', '09:13', '나', '화이팅ㅋㅋ'], // 내 답장 2분
  // 대화 2 (11/2 저녁, 9시간 뒤) — 지훈이 시작
  ['2026-11-02', '18:30', '지훈', '퇴근했어'],
  ['2026-11-02', '18:34', '나', '수고했어 저녁 먹었어?'], // 내 답장 4분
  ['2026-11-02', '19:40', '지훈', '사진'], // 지훈 답장 66분 (사진도 메시지로 센다)
  ['2026-11-02', '19:41', '지훈', '이거 먹는 중'],
  ['2026-11-02', '19:42', '나', '맛있겠다'], // 내 답장 1분
  // 대화 3 (11/3 밤, 자정을 넘김) — 내가 시작
  ['2026-11-03', '23:50', '나', '자?'],
  ['2026-11-04', '00:05', '지훈', '아니 왜?'], // 지훈 답장 15분 (날짜가 바뀌어도 계산)
  ['2026-11-04', '00:06', '나', '그냥 생각나서'], // 내 답장 1분
  // 대화 4 (11/4 저녁) — 내가 시작, 답 없음
  ['2026-11-04', '20:00', '나', '오늘은 어땠어?'],
];

describe('탐정 리포트: 기본 지표', () => {
  const p = file(base);
  const r = buildReport(p.messages, { me: '나', them: '지훈', gapHours: 6 })!;

  it('분석 범위: 기간·메시지 수·글과 그 밖', () => {
    expect(r.scope.from).toBe('2026-11-02');
    expect(r.scope.to).toBe('2026-11-04');
    expect(r.scope.days).toBe(3);
    expect(r.scope.analyzed).toBe(13);
    expect(r.scope.text).toBe(12);
    expect(r.scope.media).toBe(1);
  });
  it('메시지 수와 비율', () => {
    expect(r.basic.messages).toEqual({ me: 8, them: 5 });
    expect(r.basic.messageShare.me).toBe(61.5);
  });
  it('선톡: 공백 6시간 뒤 첫 메시지 (하루의 첫 메시지가 아님)', () => {
    expect(r.basic.conversations).toBe(4);
    expect(r.basic.initiations).toEqual({ me: 3, them: 1 });
    // 공백을 2시간으로 줄여도 이 파일에서는 같은 4개
    expect(buildReport(p.messages, { me: '나', them: '지훈', gapHours: 2 })!.basic.conversations).toBe(4);
    // 12시간이면 11/2 오전·저녁이 한 대화로 합쳐진다
    const r12 = buildReport(p.messages, { me: '나', them: '지훈', gapHours: 12 })!;
    expect(r12.basic.conversations).toBe(3);
    expect(r12.basic.initiations).toEqual({ me: 3, them: 0 });
  });
  it('답장 시간: 묶음 끝 → 상대 첫 메시지, 자정을 넘겨도 계산, 표본이 적으면 중앙값을 내지 않는다', () => {
    expect(r.basic.reply.me.n).toBe(4); // 2, 4, 1, 1분
    expect(r.basic.reply.them.n).toBe(3); // 10, 66, 15분
    expect(r.basic.reply.me.buckets).toEqual([4, 0, 0]);
    expect(r.basic.reply.them.buckets).toEqual([0, 2, 1]);
    expect(r.basic.reply.me.n).toBeLessThan(MIN_REPLIES);
    expect(r.basic.reply.me.medianMin).toBeNull();
    expect(r.comments.join(' ')).toContain('표본이 부족해서');
  });
  it('질문은 물음표가 들어간 글 메시지 수', () => {
    expect(r.basic.questions).toEqual({ me: 4, them: 1 });
  });
  it('대화가 오간 날과 서로 보낸 날', () => {
    expect(r.basic.activeDays).toBe(3);
    expect(r.basic.mutualDays).toBe(2); // 11/3 은 나만 보냄
  });
  it('상세: 끝난 대화·마지막 메시지·사진 수·가장 활발한 날', () => {
    expect(r.detail.closedConvs).toBe(3); // 파일 끝에 걸린 대화 4는 끝났는지 알 수 없어 제외
    expect(r.detail.lastMessage).toEqual({ me: 3, them: 0 });
    expect(r.detail.media.them.photo).toBe(1);
    expect(r.detail.busiestDays).toEqual([{ date: '2026-11-02', me: 5, them: 4 }]);
    expect(r.detail.laughs.me).toBe(2); // "좋은 아침!", "화이팅ㅋㅋ"
    expect(r.detail.emptyDays).toBe(0);
  });
  it('탐정의 한마디는 숫자만 말하고 판정하지 않는다', () => {
    const c = r.comments.join(' ');
    expect(c).toContain('네가 대화를 2번 더 먼저 시작했어');
    expect(c).toContain('6시간 넘게 대화가 없다가');
    expect(c).not.toMatch(/호감|좋아하|마음이 식|관심이 (없|있)/);
    expect(reportSummary(r)).toContain('선톡 나 3·상대 1');
  });
});

describe('탐정 리포트: 표본이 충분할 때·기간·제외 항목', () => {
  // 4주치: 매일 저녁 내가 묻고 지훈이 7분 뒤, 내가 3분 뒤 답한다. 뒤 2주는 지훈이 먼저 시작.
  const rows: [string, string, string, string][] = [];
  for (let i = 0; i < 28; i++) {
    const d = `2026-10-${String(5 + i).padStart(2, '0')}`.replace(/2026-10-(3[2-9]|[4-9]\d)/, (_, n) => `2026-11-${String(Number(n) - 31).padStart(2, '0')}`);
    const first = i < 14 ? '나' : '지훈';
    const second = i < 14 ? '지훈' : '나';
    rows.push([d, '20:00', first, '오늘 어땠어?'], [d, '20:07', second, '그냥 그랬어'], [d, '20:10', first, '고생했네']);
  }
  rows.push(['2026-11-01', '20:11', '민수', '나도 껴줘'], ['2026-11-01', '20:12', '지훈', '삭제된 메시지입니다.']);
  const p = file(rows);

  it('전체 기간: 중앙값·분위수·빠른 답장 비율', () => {
    const r = buildReport(p.messages, { me: '나', them: '지훈' })!;
    expect(r.scope.days).toBe(28);
    expect(r.scope.excluded).toEqual({ others: 1, deleted: 1, noTime: 0 });
    expect(r.basic.initiations).toEqual({ me: 14, them: 14 });
    // 앞 2주: 지훈 답 7분, 나 3분 / 뒤 2주: 나 7분, 지훈 3분 → 각자 14번씩 7분·3분
    expect(r.basic.reply.me.n).toBe(28);
    expect(r.basic.reply.me.medianMin).toBe(5);
    expect(r.basic.reply.me.fastPct).toBe(100);
    expect(r.detail.turnsMedian).toBe(2);
    expect(r.detail.convMessagesMedian).toBe(3);
    expect(r.detail.convDurationMedianMin).toBe(10);
    expect(r.weekly).toHaveLength(4);
    expect(r.weekly.every((w) => !w.partial)).toBe(true);
    expect(r.weekly[0].initiations).toEqual({ me: 7, them: 0 });
    expect(r.weekly[3].initiations).toEqual({ me: 0, them: 7 });
    expect(r.previous).toBeNull(); // 파일에 직전 기간이 없다
  });
  it('최근 2주만 보면 직전 2주와 비교한다', () => {
    const r = buildReport(p.messages, { me: '나', them: '지훈', from: '2026-10-19', to: '2026-11-01' })!;
    expect(r.scope.days).toBe(14);
    expect(r.basic.initiations).toEqual({ me: 0, them: 14 });
    expect(r.basic.reply.me.medianMin).toBe(7);
    expect(r.basic.reply.them.medianMin).toBe(3);
    expect(r.previous).not.toBeNull();
    expect(r.previous!.from).toBe('2026-10-05');
    expect(r.previous!.initiations).toEqual({ me: 14, them: 0 });
    expect(r.previous!.replyMedianMin).toEqual({ me: 3, them: 7 });
  });
  it('기간에 메시지가 없거나 상대를 못 찾으면 null', () => {
    expect(buildReport(p.messages, { me: '나', them: '없는사람', from: '2027-01-01', to: '2027-01-31' })).toBeNull();
    expect(buildReport([], { me: '나', them: '지훈' })).toBeNull();
  });
});

describe('내보내기 파서: keepMedia', () => {
  it('기본은 사진·이모티콘을 버리고, keepMedia 면 종류를 붙여 남긴다', () => {
    const raw = [line('2026-11-02', '09:00', '나', '사진'), line('2026-11-02', '09:01', '나', '이모티콘'), line('2026-11-02', '09:02', '나', '사진 3장'), line('2026-11-02', '09:03', '나', '사진 찍었어')].join('\n');
    expect(parseKakaoExport(raw).messages.filter((m) => !m.system).map((m) => m.text)).toEqual(['사진 3장', '사진 찍었어']);
    const kept = parseKakaoExport(raw, { keepMedia: true }).messages.filter((m) => !m.system);
    expect(kept.map((m) => m.kind ?? 'text')).toEqual(['photo', 'emoticon', 'photo', 'text']);
  });
});
