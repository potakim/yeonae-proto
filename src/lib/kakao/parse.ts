/**
 * 카카오톡 '대화 내보내기' 텍스트 파서 (11/11 피드백).
 * 브라우저(코드)에서 파싱 → 화자 선택·기간 필터 → 서버엔 메시지 배열만 보낸다. Vision 추출 호출이 사라진다.
 *
 * 지원 형식
 *  - Android: `2024년 1월 15일 오후 3:12, 홍길동 : 메시지`  / 구분선 `2024년 1월 15일 월요일`
 *  - iOS:     `2024. 1. 15. 오후 3:12, 홍길동 : 메시지`     / 구분선 `2024. 1. 15. 월요일`
 *  - PC:      `[홍길동] [오후 3:12] 메시지`                  / 구분선 `--------------- 2024년 1월 15일 월요일 ---------------`
 *  - 여러 줄 메시지는 앞 메시지에 이어 붙인다.
 */
import type { ChatMessage } from './stats';

export interface RawMessage {
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM 24h
  speaker: string; // 이름 (system 이면 '')
  text: string;
  system?: boolean;
}

export interface ParsedChat {
  messages: RawMessage[];
  participants: { name: string; count: number }[];
  firstDate: string | null;
  lastDate: string | null;
  format: 'android' | 'ios' | 'pc' | 'unknown';
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: string, m: string, d: string) => `${y}-${pad(+m)}-${pad(+d)}`;

/** "오후 3:12" | "오전 12:05" | "15:12" → "HH:MM" */
export function toHHMM(ampm: string | undefined, h: string, m: string): string {
  let hh = +h;
  if (ampm) {
    if (ampm.startsWith('오후') && hh < 12) hh += 12;
    if (ampm.startsWith('오전') && hh === 12) hh = 0;
  }
  return `${pad(hh)}:${pad(+m)}`;
}

// Android: 2024년 1월 15일 오후 3:12, 이름 : 내용
const RE_ANDROID = /^(\d{4})년 (\d{1,2})월 (\d{1,2})일 (오전|오후) (\d{1,2}):(\d{2}), (.+?) : (.*)$/;
// iOS: 2024. 1. 15. 오후 3:12, 이름 : 내용
const RE_IOS = /^(\d{4})\. (\d{1,2})\. (\d{1,2})\. (오전|오후) (\d{1,2}):(\d{2}), (.+?) : (.*)$/;
// PC: [이름] [오후 3:12] 내용
const RE_PC = /^\[(.+?)\] \[(오전|오후) (\d{1,2}):(\d{2})\] (.*)$/;
// 날짜 구분선
const RE_DATE_KO = /^-*\s*(\d{4})년 (\d{1,2})월 (\d{1,2})일 [월화수목금토일]요일\s*-*$/;
const RE_DATE_IOS = /^(\d{4})\. (\d{1,2})\. (\d{1,2})\. [월화수목금토일]요일$/;
// 시스템 문구
const RE_SYSTEM = /(님이 들어왔습니다|님이 나갔습니다|님을 초대했습니다|채팅방 관리자가|카카오톡 대화$|저장한 날짜 :)/;
const SKIP_TEXT = new Set(['사진', '동영상', '이모티콘', '삭제된 메시지입니다.', '(파일)', '보이스톡 해요', '페이스톡 해요']);

export function parseKakaoExport(raw: string): ParsedChat {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const messages: RawMessage[] = [];
  let date = '';
  let format: ParsedChat['format'] = 'unknown';
  let last: RawMessage | null = null;

  for (const line0 of lines) {
    const line = line0.replace(/​/g, '').trimEnd();
    if (!line.trim()) continue;
    let m: RegExpMatchArray | null;
    if ((m = line.match(RE_DATE_KO)) || (m = line.match(RE_DATE_IOS))) {
      date = ymd(m[1], m[2], m[3]);
      messages.push({ date, time: null, speaker: '', text: `${+m[2]}월 ${+m[3]}일`, system: true });
      last = null;
      if (format === 'unknown' && line.startsWith('-')) format = 'pc';
      continue;
    }
    if ((m = line.match(RE_ANDROID)) || (m = line.match(RE_IOS))) {
      format = format === 'unknown' ? (line.includes('년') ? 'android' : 'ios') : format;
      date = ymd(m[1], m[2], m[3]);
      last = push(messages, { date, time: toHHMM(m[4], m[5], m[6]), speaker: m[7].trim(), text: m[8] });
      continue;
    }
    if ((m = line.match(RE_PC))) {
      format = format === 'unknown' ? 'pc' : format;
      last = push(messages, { date, time: toHHMM(m[2], m[3], m[4]), speaker: m[1].trim(), text: m[5] });
      continue;
    }
    if (RE_SYSTEM.test(line)) continue;
    // 여러 줄 메시지의 이어지는 줄
    if (last) last.text += `\n${line.trim()}`;
  }

  const counts = new Map<string, number>();
  for (const x of messages) if (!x.system && x.speaker) counts.set(x.speaker, (counts.get(x.speaker) ?? 0) + 1);
  const participants = [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const dated = messages.filter((x) => x.date);
  return { messages, participants, firstDate: dated[0]?.date ?? null, lastDate: dated[dated.length - 1]?.date ?? null, format };
}

function push(list: RawMessage[], m: RawMessage): RawMessage | null {
  if (SKIP_TEXT.has(m.text.trim())) return null;
  if (RE_SYSTEM.test(m.text)) return null;
  list.push(m);
  return m;
}

export type Period = 'all' | '7d' | '30d' | '90d' | { from: string; to: string };

/** 기간 필터 — 기준은 마지막 메시지 날짜 */
export function filterByPeriod(messages: RawMessage[], period: Period): RawMessage[] {
  if (period === 'all') return messages;
  const dated = messages.filter((m) => m.date);
  const lastDate = dated[dated.length - 1]?.date;
  if (!lastDate) return messages;
  let from: string;
  let to = lastDate;
  if (typeof period === 'string') {
    const days = { '7d': 7, '30d': 30, '90d': 90 }[period];
    const d = new Date(`${lastDate}T00:00:00`);
    d.setDate(d.getDate() - days + 1);
    from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } else {
    from = period.from;
    to = period.to;
  }
  return messages.filter((m) => m.date >= from && m.date <= to);
}

/** 서버 통계 입력(ChatMessage)으로 변환. 날짜가 바뀌는 지점에 system 구분선을 넣어 선톡 계산이 되게 한다 */
export function toChatMessages(messages: RawMessage[], me: string): ChatMessage[] {
  const out: ChatMessage[] = [];
  let prevDate = '';
  for (const m of messages) {
    if (m.system) {
      if (m.date !== prevDate) out.push({ speaker: 'system', text: m.text, time: null });
      prevDate = m.date;
      continue;
    }
    if (m.date && m.date !== prevDate) {
      out.push({ speaker: 'system', text: m.date.replace(/^\d{4}-(\d{2})-(\d{2})$/, (_, mm, dd) => `${+mm}월 ${+dd}일`), time: null });
      prevDate = m.date;
    }
    out.push({ speaker: m.speaker === me ? 'me' : 'them', text: m.text, time: m.time });
  }
  return out;
}
