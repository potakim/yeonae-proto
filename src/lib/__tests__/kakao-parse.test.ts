import { describe, expect, it } from 'vitest';
import { filterByPeriod, parseKakaoExport, toChatMessages, toHHMM } from '../kakao/parse';
import { computeChatStats } from '../kakao/stats';

const ANDROID = `지훈 님과 카카오톡 대화
저장한 날짜 : 2026년 11월 10일 오후 9:00

2026년 11월 1일 토요일
2026년 11월 1일 오후 3:12, 지훈 : 뭐해?
2026년 11월 1일 오후 3:15, 나 : 그냥 있어
집에서 쉬는 중
2026년 11월 1일 오후 3:16, 지훈 : 사진
2026년 11월 1일 오후 11:40, 지훈 : 잘자 ㅎㅎ
2026년 11월 9일 월요일
2026년 11월 9일 오전 12:05, 나 : 자?
2026년 11월 9일 오전 9:30, 지훈 : 이모티콘
2026년 11월 9일 오전 9:31, 지훈 : 응 이제 봤어
`;

const IOS = `2026. 11. 1. 토요일
2026. 11. 1. 오후 3:12, 지훈 : 뭐해?
2026. 11. 1. 오후 3:15, 소은 : 그냥 있어
2026. 11. 2. 일요일
2026. 11. 2. 오전 10:00, 지훈 : 밥 먹었어?
`;

const PC = `지훈 님과 카카오톡 대화
저장한 날짜 : 2026-11-10 21:00:00

--------------- 2026년 11월 1일 토요일 ---------------
[지훈] [오후 3:12] 뭐해?
[나] [오후 3:15] 그냥 있어
[지훈] [오후 3:16] 삭제된 메시지입니다.
--------------- 2026년 11월 2일 일요일 ---------------
[지훈] [오전 10:00] 밥 먹었어?
`;

describe('카톡 내보내기 파서', () => {
  it('Android 형식: 날짜·시각·화자·여러 줄, 사진/이모티콘/헤더 제외', () => {
    const p = parseKakaoExport(ANDROID);
    expect(p.format).toBe('android');
    const msgs = p.messages.filter((m) => !m.system);
    expect(msgs.map((m) => m.text)).toEqual(['뭐해?', '그냥 있어\n집에서 쉬는 중', '잘자 ㅎㅎ', '자?', '응 이제 봤어']);
    expect(msgs[0]).toMatchObject({ date: '2026-11-01', time: '15:12', speaker: '지훈' });
    expect(msgs[3]).toMatchObject({ date: '2026-11-09', time: '00:05', speaker: '나' });
    expect(p.participants).toEqual([
      { name: '지훈', count: 3 },
      { name: '나', count: 2 },
    ]);
    expect(p.firstDate).toBe('2026-11-01');
    expect(p.lastDate).toBe('2026-11-09');
  });

  it('iOS·PC 형식', () => {
    const i = parseKakaoExport(IOS);
    expect(i.format).toBe('ios');
    expect(i.messages.filter((m) => !m.system)).toHaveLength(3);
    expect(i.messages.filter((m) => !m.system)[2]).toMatchObject({ date: '2026-11-02', time: '10:00' });
    const c = parseKakaoExport(PC);
    expect(c.format).toBe('pc');
    const msgs = c.messages.filter((m) => !m.system);
    expect(msgs).toHaveLength(3);
    expect(msgs[2]).toMatchObject({ date: '2026-11-02', time: '10:00', speaker: '지훈' });
  });

  it('오전/오후 변환', () => {
    expect(toHHMM('오후', '3', '05')).toBe('15:05');
    expect(toHHMM('오후', '12', '00')).toBe('12:00');
    expect(toHHMM('오전', '12', '05')).toBe('00:05');
    expect(toHHMM(undefined, '9', '7')).toBe('09:07');
  });

  it('기간 필터는 마지막 메시지 날짜 기준', () => {
    const p = parseKakaoExport(ANDROID);
    expect(filterByPeriod(p.messages, '7d').filter((m) => !m.system)).toHaveLength(2); // 11/3~11/9
    expect(filterByPeriod(p.messages, '30d').filter((m) => !m.system)).toHaveLength(5);
    expect(filterByPeriod(p.messages, { from: '2026-11-01', to: '2026-11-01' }).filter((m) => !m.system)).toHaveLength(3);
  });

  it('서버 입력으로 변환 → 통계가 계산된다 (선톡·답장 시간)', () => {
    const p = parseKakaoExport(ANDROID);
    const chat = toChatMessages(p.messages, '나');
    expect(chat.filter((m) => m.speaker === 'system').length).toBeGreaterThanOrEqual(2);
    expect(chat.filter((m) => m.speaker === 'me')).toHaveLength(2);
    const stats = computeChatStats(chat);
    expect(stats.me.messages).toBe(2);
    expect(stats.them.messages).toBe(3);
    expect(stats.them.initiations).toBeGreaterThanOrEqual(1);
  });

  it('형식이 아니면 참여자가 없다', () => {
    expect(parseKakaoExport('그냥 아무 글').participants).toHaveLength(0);
  });
});
