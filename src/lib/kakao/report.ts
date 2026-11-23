/**
 * 탐정 리포트 — 카카오톡 내보내기 파일에서 두 사람의 대화 패턴을 숫자로 집계한다.
 * 근거: 노션 「탐정 캐릭터(카톡 대화 심층 분석)」 2026-11-23.
 *
 * 원칙
 *  - 전부 코드로 계산한다 (LLM 없음). 브라우저 안에서만 돌고 대화 내용은 서버로 가지 않는다.
 *  - 숫자에서 속마음·호감도·관계의 우열을 판정하지 않는다. 수치, 비율, 기간, 표본 수, 집계 기준만 낸다.
 *  - 표본이 부족하면 값을 만들지 않고 null(화면: "집계 어려움")로 둔다.
 *
 * 집계 기준 (노션 "집계 기준 초안" — 공백 시간 등은 테스트 후 확정)
 *  - 새 대화: 앞 메시지와의 간격이 gapHours 이상이면 새 대화. 그 첫 메시지가 '선톡'. (하루의 첫 메시지와는 다를 수 있다)
 *  - 답장 시간: 한 사람의 연속 메시지 묶음이 끝난 시점 → 상대의 첫 메시지. 같은 대화 안에서만 잰다(공백을 넘으면 새 대화).
 *  - 질문: 물음표가 들어간 글 메시지 수. 실제 질문 의도와 정확히 같지는 않다.
 *  - 글자 수: 글 메시지만, 공백 포함.
 *  - 시각: 내보낸 파일에 적힌 시각 그대로(내보낸 기기의 시간대).
 */
import type { MediaKind, RawMessage } from './parse';

export const KAKAO_REPORT_VERSION = 'report-2026-11-23.1';
export const GAP_HOURS = [2, 4, 6, 12] as const;
export type GapHours = (typeof GAP_HOURS)[number];
export const DEFAULT_GAP_HOURS: GapHours = 6;
/** 중앙값·분포를 내는 최소 답장 수 */
export const MIN_REPLIES = 5;
/** 대화 단위 지표(지속 시간·발화 교대)를 내는 최소 대화 수 */
export const MIN_CONVERSATIONS = 3;
export const SHORT_LEN = 10;
export const FAST_REPLY_MIN = 10;

export type Who = 'me' | 'them';
export interface Pair<T> {
  me: T;
  them: T;
}
export interface ReportOptions {
  me: string;
  them: string;
  gapHours?: GapHours;
  /** YYYY-MM-DD (포함). 없으면 파일 전체 */
  from?: string;
  to?: string;
}

interface Msg {
  t: number; // 분 단위 타임스탬프 (로컬 달력 기준)
  date: string;
  hour: number;
  dow: number; // 0=일
  who: Who;
  text: string;
  kind: MediaKind | null;
}
interface Conv {
  msgs: Msg[];
  /** 파일의 맨 처음 대화 (앞에 공백이 있었는지 알 수 없다) */
  first: boolean;
  /** 뒤에 gap 이상 공백이 확인돼 끝난 것이 분명한 대화 */
  closed: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd);
};
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d: string, n: number) => {
  const x = toDate(d);
  x.setDate(x.getDate() + n);
  return fmtDate(x);
};
export const daysBetween = (from: string, to: string) => Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000) + 1;
const minutesOf = (date: string, time: string) => {
  const [h, m] = time.split(':').map(Number);
  return Math.round(toDate(date).getTime() / 60_000) + h * 60 + m;
};
const quantile = (sorted: number[], q: number) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return Math.round((sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)) * 10) / 10;
};
const median = (xs: number[]) => quantile([...xs].sort((a, b) => a - b), 0.5);
const pct = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 1000) / 10);
const pair = <T>(f: (w: Who) => T): Pair<T> => ({ me: f('me'), them: f('them') });

const QUESTION = /[?？]/;
const LAUGH_OR_EXCLAIM = /[!！]|ㅋㅋ|ㅎㅎ/;
export const BANDS = ['새벽(0~6시)', '오전(6~12시)', '오후(12~18시)', '저녁(18~24시)'] as const;
export const DOW = ['일', '월', '화', '수', '목', '금', '토'] as const;
const bandOf = (hour: number) => Math.min(3, Math.floor(hour / 6));

export interface ReplyStats {
  /** 유효 답장 수 (표본) */
  n: number;
  medianMin: number | null;
  p25Min: number | null;
  p75Min: number | null;
  /** [5분 이내, 5분 초과~1시간, 1시간 초과~기준 공백] 횟수 */
  buckets: [number, number, number];
  /** FAST_REPLY_MIN 분 안에 온 답장 비율(%) */
  fastPct: number | null;
}
export interface WeekRow {
  /** 그 주의 시작일(월요일). 분석 기간에 일부만 걸친 주는 partial */
  start: string;
  end: string;
  partial: boolean;
  messages: Pair<number>;
  initiations: Pair<number>;
  replyMedianMin: Pair<number | null>;
  replies: Pair<number>;
}

export interface KakaoReport {
  version: string;
  scope: {
    me: string;
    them: string;
    from: string;
    to: string;
    days: number;
    gapHours: GapHours;
    /** 분석에 쓴 메시지 (글 + 사진·이모티콘 등) */
    analyzed: number;
    text: number;
    media: number;
    excluded: { others: number; deleted: number; noTime: number };
    fileFrom: string;
    fileTo: string;
  };
  basic: {
    messages: Pair<number>;
    messageShare: Pair<number | null>;
    initiations: Pair<number>;
    conversations: number;
    reply: Pair<ReplyStats>;
    questions: Pair<number>;
    avgLength: Pair<number | null>;
    activeDays: number;
    mutualDays: number;
  };
  detail: {
    /** 대화별 전체 메시지 수 중앙값 */
    convMessagesMedian: number | null;
    /** 끝난 것이 확인된 대화의 지속 시간(분) 중앙값. 메시지 한 개뿐인 대화는 따로 센다 */
    convDurationMedianMin: number | null;
    singleMessageConvs: number;
    closedConvs: number;
    /** 한 대화 안에서 발신자가 바뀐 횟수 중앙값 */
    turnsMedian: number | null;
    /** 끝난 대화의 마지막 메시지를 보낸 횟수 */
    lastMessage: Pair<number>;
    startByDow: Pair<number>[];
    startByBand: Pair<number>[];
    replyByBand: Pair<{ medianMin: number | null; n: number }>[];
    replyByDow: Pair<{ medianMin: number | null; n: number }>[];
    /** 연속으로 보낸 메시지 묶음 크기 중앙값 */
    burstMedian: Pair<number | null>;
    bursts: Pair<number>;
    shortPct: Pair<number | null>;
    questionPct: Pair<number | null>;
    laughPct: Pair<number | null>;
    laughs: Pair<number>;
    media: Pair<Record<'photo' | 'video' | 'emoticon' | 'file' | 'call', number>>;
    /** 요일(0=일) × 시간대(4) 메시지 수 */
    grid: number[][];
    longestSilence: { hours: number; from: string; to: string } | null;
    busiestDays: { date: string; me: number; them: number }[];
    emptyDays: number;
  };
  weekly: WeekRow[];
  /** 같은 길이의 직전 기간과 비교. 파일에 그 기간 기록이 온전히 없으면 null */
  previous: {
    from: string;
    to: string;
    messages: Pair<number>;
    initiations: Pair<number>;
    replyMedianMin: Pair<number | null>;
    replies: Pair<number>;
  } | null;
  /** 탐정의 한마디 — 숫자를 문장으로 옮긴 것 (판정 없음) */
  comments: string[];
}

function replyStats(mins: number[], gapMin: number): ReplyStats {
  const s = [...mins].sort((a, b) => a - b);
  const enough = s.length >= MIN_REPLIES;
  return {
    n: s.length,
    medianMin: enough ? quantile(s, 0.5) : null,
    p25Min: enough ? quantile(s, 0.25) : null,
    p75Min: enough ? quantile(s, 0.75) : null,
    buckets: [s.filter((m) => m <= 5).length, s.filter((m) => m > 5 && m <= 60).length, s.filter((m) => m > 60 && m < gapMin).length],
    fastPct: enough ? pct(s.filter((m) => m <= FAST_REPLY_MIN).length, s.length) : null,
  };
}

/** 한 대화 안의 답장: 묶음이 끝난 시점 → 상대의 첫 메시지 */
function repliesIn(conv: Conv): { who: Who; min: number; at: Msg }[] {
  const out: { who: Who; min: number; at: Msg }[] = [];
  for (let i = 1; i < conv.msgs.length; i++) {
    const prev = conv.msgs[i - 1];
    const cur = conv.msgs[i];
    if (cur.who !== prev.who) out.push({ who: cur.who, min: cur.t - prev.t, at: prev });
  }
  return out;
}

function window(convs: Conv[], from: string, to: string, gapMin: number) {
  const inRange = (m: Msg) => m.date >= from && m.date <= to;
  const msgs = convs.flatMap((c) => c.msgs).filter(inRange);
  // 선톡: 대화의 첫 메시지가 기간 안에 있는 대화
  const started = convs.filter((c) => inRange(c.msgs[0]));
  const replies = convs.flatMap(repliesIn).filter((r) => inRange(r.at));
  return {
    msgs,
    started,
    replies,
    messages: pair((w) => msgs.filter((m) => m.who === w).length),
    initiations: pair((w) => started.filter((c) => c.msgs[0].who === w).length),
    reply: pair((w) => replyStats(replies.filter((r) => r.who === w).map((r) => r.min), gapMin)),
  };
}

const fmtMin = (m: number | null) => (m === null ? '집계 어려움' : m < 60 ? `${Math.round(m)}분` : `${Math.floor(m / 60)}시간 ${Math.round(m % 60)}분`);

function buildComments(r: Omit<KakaoReport, 'comments'>): string[] {
  const b = r.basic;
  const out: string[] = [];
  out.push(`${r.scope.from}부터 ${r.scope.to}까지 ${r.scope.days}일, 분석할 수 있는 메시지 ${r.scope.analyzed}개를 살펴봤어.`);
  const di = b.initiations.me - b.initiations.them;
  if (b.conversations === 0) out.push('이 기간에는 새로 시작된 대화가 없어서 선톡은 셀 수 없었어.');
  else if (di === 0) out.push(`대화를 먼저 시작한 횟수는 둘 다 ${b.initiations.me}번으로 같아.`);
  else out.push(`이번 기록에서는 ${di > 0 ? '네가' : '상대가'} 대화를 ${Math.abs(di)}번 더 먼저 시작했어. (너 ${b.initiations.me}번, 상대 ${b.initiations.them}번)`);
  if (b.reply.me.medianMin !== null && b.reply.them.medianMin !== null)
    out.push(`답장 시간의 중앙값은 네가 ${fmtMin(b.reply.me.medianMin)}, 상대가 ${fmtMin(b.reply.them.medianMin)}이야. 각각 답장 ${b.reply.me.n}번, ${b.reply.them.n}번 기준이야.`);
  else out.push(`답장 시간은 표본이 부족해서 비교를 보류할게. (네 답장 ${b.reply.me.n}번, 상대 답장 ${b.reply.them.n}번, ${MIN_REPLIES}번 이상일 때만 계산해)`);
  out.push(`물음표가 들어간 메시지는 네가 ${b.questions.me}개, 상대가 ${b.questions.them}개야. 보낸 메시지는 네가 ${b.messages.me}개, 상대가 ${b.messages.them}개고.`);
  out.push(`선톡은 ${r.scope.gapHours}시간 넘게 대화가 없다가 처음 보낸 메시지를 기준으로 셌어. 이 숫자는 이 파일 안의 기록일 뿐이고, 마음의 크기를 재는 건 아니야.`);
  return out;
}

export function buildReport(raw: RawMessage[], opts: ReportOptions): KakaoReport | null {
  const gapHours = opts.gapHours ?? DEFAULT_GAP_HOURS;
  const gapMin = gapHours * 60;
  const excluded = { others: 0, deleted: 0, noTime: 0 };
  const all: Msg[] = [];
  for (const m of raw) {
    if (m.system || !m.speaker) continue;
    if (m.speaker !== opts.me && m.speaker !== opts.them) {
      excluded.others++;
      continue;
    }
    if (m.kind === 'deleted') {
      excluded.deleted++;
      continue;
    }
    if (!m.date || !m.time) {
      excluded.noTime++;
      continue;
    }
    const d = toDate(m.date);
    all.push({ t: minutesOf(m.date, m.time), date: m.date, hour: Number(m.time.slice(0, 2)), dow: d.getDay(), who: m.speaker === opts.me ? 'me' : 'them', text: m.text, kind: m.kind ?? null });
  }
  if (all.length === 0) return null;
  all.sort((a, b) => a.t - b.t);

  // 대화 나누기 (파일 전체 기준 — 기간 경계 앞뒤의 실제 공백을 알 수 있다)
  const convs: Conv[] = [];
  for (const m of all) {
    const cur = convs[convs.length - 1];
    if (!cur || m.t - cur.msgs[cur.msgs.length - 1].t >= gapMin) {
      if (cur) cur.closed = true;
      convs.push({ msgs: [m], first: convs.length === 0, closed: false });
    } else cur.msgs.push(m);
  }

  const fileFrom = all[0].date;
  const fileTo = all[all.length - 1].date;
  const from = opts.from && opts.from > fileFrom ? opts.from : fileFrom;
  const to = opts.to && opts.to < fileTo ? opts.to : fileTo;
  if (from > to) return null;
  const days = daysBetween(from, to);
  const w = window(convs, from, to, gapMin);
  if (w.msgs.length === 0) return null;

  const text = w.msgs.filter((m) => !m.kind);
  const count = (list: Msg[], who: Who, f: (m: Msg) => boolean = () => true) => list.filter((m) => m.who === who && f(m)).length;
  const dates = new Map<string, Pair<number>>();
  for (const m of w.msgs) {
    const d = dates.get(m.date) ?? { me: 0, them: 0 };
    d[m.who]++;
    dates.set(m.date, d);
  }
  const total = w.msgs.length;

  // 대화 단위 지표: 기간 안에서 시작한 대화만
  const closed = w.started.filter((c) => c.closed);
  const multi = closed.filter((c) => c.msgs.length > 1);
  const turns = (c: Conv) => c.msgs.reduce((n, m, i) => (i > 0 && m.who !== c.msgs[i - 1].who ? n + 1 : n), 0);
  const enoughConv = w.started.length >= MIN_CONVERSATIONS;

  // 연속 메시지 묶음
  const bursts: Pair<number[]> = { me: [], them: [] };
  for (const c of convs) {
    let run: Msg[] = [];
    const flush = () => {
      if (run.length && run[0].date >= from && run[0].date <= to) bursts[run[0].who].push(run.length);
      run = [];
    };
    for (const m of c.msgs) {
      if (run.length && run[0].who !== m.who) flush();
      run.push(m);
    }
    flush();
  }

  const grid = DOW.map(() => [0, 0, 0, 0]);
  for (const m of w.msgs) grid[m.dow][bandOf(m.hour)]++;

  // 가장 긴 공백 (기간 안의 연속 메시지 사이)
  let longest: KakaoReport['detail']['longestSilence'] = null;
  for (let i = 1; i < w.msgs.length; i++) {
    const gap = w.msgs[i].t - w.msgs[i - 1].t;
    if (!longest || gap > longest.hours * 60) longest = { hours: Math.round((gap / 60) * 10) / 10, from: w.msgs[i - 1].date, to: w.msgs[i].date };
  }
  const maxDay = Math.max(...[...dates.values()].map((d) => d.me + d.them));
  const mediaKinds = ['photo', 'video', 'emoticon', 'file', 'call'] as const;
  const byGroup = <K extends number>(n: number, key: (r: { at: Msg }) => K) =>
    Array.from({ length: n }, (_, i) =>
      pair((who) => {
        const xs = w.replies.filter((r) => r.who === who && key(r) === i).map((r) => r.min);
        return { medianMin: xs.length >= MIN_REPLIES ? median(xs) : null, n: xs.length };
      }),
    );

  // 주별 (월요일 시작)
  const weekly: WeekRow[] = [];
  const startOfWeek = (d: string) => addDays(d, -((toDate(d).getDay() + 6) % 7));
  for (let ws = startOfWeek(from); ws <= to; ws = addDays(ws, 7)) {
    const we = addDays(ws, 6);
    const a = ws < from ? from : ws;
    const b = we > to ? to : we;
    const x = window(convs, a, b, gapMin);
    weekly.push({ start: a, end: b, partial: a !== ws || b !== we, messages: x.messages, initiations: x.initiations, replyMedianMin: pair((who) => x.reply[who].medianMin), replies: pair((who) => x.reply[who].n) });
  }

  // 직전 같은 길이 기간 — 파일이 그 기간을 온전히 덮을 때만
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -days);
  let previous: KakaoReport['previous'] = null;
  if (prevFrom >= fileFrom) {
    const x = window(convs, prevFrom, prevTo, gapMin);
    previous = { from: prevFrom, to: prevTo, messages: x.messages, initiations: x.initiations, replyMedianMin: pair((who) => x.reply[who].medianMin), replies: pair((who) => x.reply[who].n) };
  }

  const report: Omit<KakaoReport, 'comments'> = {
    version: KAKAO_REPORT_VERSION,
    scope: { me: opts.me, them: opts.them, from, to, days, gapHours, analyzed: total, text: text.length, media: total - text.length, excluded, fileFrom, fileTo },
    basic: {
      messages: w.messages,
      messageShare: pair((who) => pct(w.messages[who], total)),
      initiations: w.initiations,
      conversations: w.started.length,
      reply: w.reply,
      questions: pair((who) => count(text, who, (m) => QUESTION.test(m.text))),
      avgLength: pair((who) => {
        const mine = text.filter((m) => m.who === who);
        return mine.length ? Math.round((mine.reduce((s, m) => s + m.text.length, 0) / mine.length) * 10) / 10 : null;
      }),
      activeDays: dates.size,
      mutualDays: [...dates.values()].filter((d) => d.me > 0 && d.them > 0).length,
    },
    detail: {
      convMessagesMedian: enoughConv ? median(w.started.map((c) => c.msgs.length)) : null,
      convDurationMedianMin: multi.length >= MIN_CONVERSATIONS ? median(multi.map((c) => c.msgs[c.msgs.length - 1].t - c.msgs[0].t)) : null,
      singleMessageConvs: closed.length - multi.length,
      closedConvs: closed.length,
      turnsMedian: enoughConv ? median(w.started.map(turns)) : null,
      lastMessage: pair((who) => closed.filter((c) => c.msgs[c.msgs.length - 1].who === who).length),
      startByDow: DOW.map((_, i) => pair((who) => w.started.filter((c) => c.msgs[0].who === who && c.msgs[0].dow === i).length)),
      startByBand: BANDS.map((_, i) => pair((who) => w.started.filter((c) => c.msgs[0].who === who && bandOf(c.msgs[0].hour) === i).length)),
      replyByBand: byGroup(4, (r) => bandOf(r.at.hour)),
      replyByDow: byGroup(7, (r) => r.at.dow),
      burstMedian: pair((who) => (bursts[who].length >= MIN_REPLIES ? median(bursts[who]) : null)),
      bursts: pair((who) => bursts[who].length),
      shortPct: pair((who) => pct(count(text, who, (m) => m.text.length <= SHORT_LEN), count(text, who))),
      questionPct: pair((who) => pct(count(text, who, (m) => QUESTION.test(m.text)), count(text, who))),
      laughPct: pair((who) => pct(count(text, who, (m) => LAUGH_OR_EXCLAIM.test(m.text)), count(text, who))),
      laughs: pair((who) => count(text, who, (m) => LAUGH_OR_EXCLAIM.test(m.text))),
      media: pair((who) => Object.fromEntries(mediaKinds.map((k) => [k, count(w.msgs, who, (m) => m.kind === k)])) as Record<(typeof mediaKinds)[number], number>),
      grid,
      longestSilence: longest,
      busiestDays: [...dates.entries()].filter(([, d]) => d.me + d.them === maxDay).map(([date, d]) => ({ date, ...d })),
      emptyDays: days - dates.size,
    },
    weekly,
    previous,
  };
  return { ...report, comments: buildComments(report) };
}

/** 저장된 분석·다른 캐릭터에 넘길 한 줄 요약 (원문 없음, 숫자만) */
export function reportSummary(r: KakaoReport): string {
  const b = r.basic;
  return `${r.scope.from}~${r.scope.to} 메시지 나 ${b.messages.me}·상대 ${b.messages.them}, 선톡 나 ${b.initiations.me}·상대 ${b.initiations.them}, 답장 중앙값 나 ${fmtMin(b.reply.me.medianMin)}·상대 ${fmtMin(b.reply.them.medianMin)}`;
}
export { fmtMin };
