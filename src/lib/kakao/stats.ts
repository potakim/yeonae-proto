/**
 * 카톡 대화 통계 — 추출된 메시지(화자·텍스트·시각)로 코드가 계산한다.
 * 호감도 점수도 여기서 확정하고, LLM 은 이 숫자와 근거를 해석만 한다.
 */

export interface ChatMessage {
  speaker: 'me' | 'them' | 'system';
  text: string;
  /** "HH:MM" 24시간제, 모르면 null */
  time: string | null;
}

export const KAKAO_STATS_VERSION = '2026-10-28.1';

/* ───────────── 마스킹 ───────────── */

const PHONE = /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g;
const ACCOUNT = /\b\d{2,6}-\d{2,6}-\d{2,8}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const RRN = /\b\d{6}-?[1-4]\d{6}\b/g;

/** 이름·전화번호·계좌·이메일·주민번호를 가린다 */
export function maskText(text: string, names: string[]): string {
  let t = text.replace(RRN, '[번호]').replace(PHONE, '[전화번호]').replace(ACCOUNT, '[계좌]').replace(EMAIL, '[이메일]');
  for (const n of names) {
    const name = n.trim();
    if (name.length < 2) continue;
    t = t.split(name).join('[상대]');
    // 성 뺀 이름(예: 김민수 → 민수)도 가린다
    if (name.length === 3 && /^[가-힣]+$/.test(name)) t = t.split(name.slice(1)).join('[상대]');
  }
  return t;
}

/* ───────────── 통계 ───────────── */

const toMin = (t: string | null) => {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const ratio = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100) / 100);

const QUESTION = /[?？]|(까요?|니|냐|나요|을까|ㄹ까|어때|뭐해|언제|어디)\s*[~.!ㅋㅎ]*$/;
const LAUGH = /ㅋㅋ|ㅎㅎ|하하|크크/;
const AFFECTION = /보고\s?싶|좋아해|좋아|사랑|귀엽|귀여워|예쁘|이쁘|잘\s?자|꿈\s?꿔|고마워|♥|❤|💕|😘|🥰|자기야|설레/;
const EMOTICON = /\((이모티콘|스티커|emoticon)\)|[\u{1F300}-\u{1FAFF}]/u;
/** 대화가 끊겼다고 보는 간격(분) — 그 뒤 첫 메시지를 '선톡'으로 본다 */
const SESSION_GAP = 120;

export interface SpeakerStats {
  messages: number;
  avgLength: number;
  initiations: number;
  medianReplyMin: number | null;
  questions: number;
  laughs: number;
  affection: number;
  emoticons: number;
  /** 3개 이상 연달아 보낸 횟수 */
  bursts: number;
}

export function computeChatStats(messages: ChatMessage[]) {
  const msgs = messages.filter((m) => m.speaker !== 'system' && m.text.trim());
  const per = (who: 'me' | 'them'): SpeakerStats => {
    const mine = msgs.filter((m) => m.speaker === who);
    return {
      messages: mine.length,
      avgLength: mine.length ? Math.round(mine.reduce((s, m) => s + m.text.length, 0) / mine.length) : 0,
      initiations: 0,
      medianReplyMin: null,
      questions: mine.filter((m) => QUESTION.test(m.text)).length,
      laughs: mine.filter((m) => LAUGH.test(m.text)).length,
      affection: mine.filter((m) => AFFECTION.test(m.text)).length,
      emoticons: mine.filter((m) => EMOTICON.test(m.text)).length,
      bursts: 0,
    };
  };
  const me = per('me');
  const them = per('them');
  const S = { me, them };

  // 선톡: 첫 메시지, 날짜 구분선 뒤 첫 메시지, 2시간 이상 공백 뒤 첫 메시지
  const replies: Record<'me' | 'them', number[]> = { me: [], them: [] };
  let prev: ChatMessage | null = null;
  let newSession = true;
  let run = 0;
  const timesKnown = msgs.filter((m) => toMin(m.time) !== null).length;
  for (const m of messages) {
    if (m.speaker === 'system') {
      if (/\d+\s*(년|월|일)|요일/.test(m.text)) newSession = true;
      continue;
    }
    if (!m.text.trim()) continue;
    const t = toMin(m.time);
    const pt = prev ? toMin(prev.time) : null;
    if (prev && t !== null && pt !== null && t - pt >= SESSION_GAP) newSession = true;
    if (newSession) {
      S[m.speaker].initiations++;
      newSession = false;
    } else if (prev && prev.speaker !== m.speaker && t !== null && pt !== null && t >= pt) {
      replies[m.speaker].push(t - pt);
    }
    run = prev && prev.speaker === m.speaker ? run + 1 : 1;
    if (run === 3) S[m.speaker].bursts++;
    prev = m;
  }
  me.medianReplyMin = median(replies.me);
  them.medianReplyMin = median(replies.them);
  const total = me.messages + them.messages;
  const last = [...msgs].reverse()[0];

  return {
    version: KAKAO_STATS_VERSION,
    total,
    timesKnown: timesKnown >= Math.max(3, total * 0.5),
    me,
    them,
    share: { me: ratio(me.messages, total), them: ratio(them.messages, total) },
    initiationShare: { them: ratio(them.initiations, me.initiations + them.initiations) },
    lengthRatio: { themToMe: ratio(them.avgLength, me.avgLength) },
    lastSpeaker: last?.speaker ?? null,
  };
}

export type ChatStats = ReturnType<typeof computeChatStats>;

/* ───────────── 호감도 (상대 → 나) ───────────── */

export interface InterestFactor {
  key: string;
  delta: number;
  text: string;
}

export function interestScore(s: ChatStats) {
  const f: InterestFactor[] = [];
  const add = (key: string, delta: number, text: string) => f.push({ key, delta, text });
  const t = s.them;

  if (t.medianReplyMin !== null) {
    if (t.medianReplyMin <= 10) add('reply.fast', 10, `상대 답장이 빠른 편 (중간값 ${t.medianReplyMin}분)`);
    else if (t.medianReplyMin <= 60) add('reply.ok', 5, `상대 답장이 무난한 편 (중간값 ${t.medianReplyMin}분)`);
    else if (t.medianReplyMin > 180) add('reply.slow', -8, `상대 답장이 느린 편 (중간값 ${t.medianReplyMin}분)`);
  }
  const init = s.initiationShare.them;
  if (s.me.initiations + t.initiations >= 2) {
    if (init >= 0.4) add('init.them', 8, `상대가 먼저 말을 거는 비율 ${Math.round(init * 100)}%`);
    else if (init <= 0.15) add('init.me', -6, `대화를 거의 내가 먼저 시작 (상대 선톡 ${Math.round(init * 100)}%)`);
  }
  const lr = s.lengthRatio.themToMe;
  if (s.me.avgLength > 0) {
    if (lr >= 0.8) add('len.balanced', 5, '상대 메시지 길이가 나와 비슷하거나 김');
    else if (lr <= 0.4) add('len.short', -6, '상대 메시지가 내 것보다 많이 짧음');
  }
  if (t.messages >= 5) {
    const q = t.questions / t.messages;
    if (q >= 0.2) add('question', 7, `상대가 질문을 자주 함 (${Math.round(q * 100)}%) — 대화를 이어 가려는 신호`);
    else if (q < 0.05) add('question.low', -3, '상대 질문이 거의 없음');
  }
  if (t.affection >= 2) add('affection', 8, `상대의 애정·호감 표현 ${t.affection}회`);
  if (t.laughs + t.emoticons >= 3) add('mood', 3, '웃음·이모티콘이 자주 섞인 편한 분위기');
  if (s.share.them >= 0.4) add('share.ok', 5, `대화량이 고른 편 (상대 ${Math.round(s.share.them * 100)}%)`);
  else if (s.share.them <= 0.25) add('share.low', -5, `대화량이 나에게 쏠림 (상대 ${Math.round(s.share.them * 100)}%)`);
  if (s.me.bursts >= 2 && t.bursts === 0) add('burst.me', -3, '내가 연달아 보내는 경우가 많음');

  const score = Math.max(5, Math.min(95, 50 + f.reduce((a, x) => a + x.delta, 0)));
  const confidence = s.total < 20 || !s.timesKnown ? '낮음' : s.total < 60 ? '보통' : '높음';
  const label = score >= 75 ? '호감 신호가 뚜렷해요' : score >= 60 ? '호감 쪽으로 기울어 있어요' : score >= 45 ? '아직은 판단이 어려워요' : '관심이 크진 않아 보여요';
  return { score, label, confidence, factors: f, note: '대화 일부로 추정한 참고값이에요 (기본 50에서 근거를 더하고 뺌, 5~95)' };
}

export type Interest = ReturnType<typeof interestScore>;
