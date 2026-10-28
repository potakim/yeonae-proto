import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { SajuPayload } from '../lib/saju';

type Mode = 'personality' | 'thisYear';
const MODES: { value: Mode; label: string }[] = [
  { value: 'personality', label: '타고난 연애 성향' },
  { value: 'thisYear', label: '지금의 연애운' },
];

const ACCESS_KEY = 'modu-yeonae.accessCode';
const readCode = () => {
  try {
    return localStorage.getItem(ACCESS_KEY) ?? '';
  } catch {
    return '';
  }
};

interface Usage {
  model: string;
  input: number;
  output: number;
  stop: string;
}

/** 스트림 끝에 붙는 <!--usage {...}--> / <!--error "..."--> 를 떼어 낸다 */
function splitTrailer(text: string): { body: string; usage: Usage | null; error: string | null } {
  let body = text;
  let usage: Usage | null = null;
  let error: string | null = null;
  const u = body.match(/\n*<!--usage (.*?)-->\s*$/s);
  if (u) {
    usage = JSON.parse(u[1]);
    body = body.slice(0, u.index);
  }
  const e = body.match(/\n*<!--error (.*?)-->\s*$/s);
  if (e) {
    error = JSON.parse(e[1]);
    body = body.slice(0, e.index);
  }
  return { body, usage, error };
}

export default function InterpretPanel({ payload }: { payload: SajuPayload }) {
  const [mode, setMode] = useState<Mode>('personality');
  const [question, setQuestion] = useState('');
  const [code, setCode] = useState(readCode);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 화면을 벗어나면 진행 중인 요청을 끊는다 (원국이 바뀌면 부모가 key 로 새로 마운트)
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setText('');
    setUsage(null);
    setError(null);
    setStatus('loading');
    const started = performance.now();
    try {
      localStorage.setItem(ACCESS_KEY, code);
    } catch {
      /* 저장 실패는 무시 */
    }

    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-code': code },
        body: JSON.stringify({ payload, mode, question }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const msg = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(msg.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setText(splitTrailer(acc).body);
      }
      const t = splitTrailer(acc);
      setText(t.body);
      setUsage(t.usage);
      if (t.error) throw new Error(t.error);
      setStatus('done');
    } catch (e) {
      if (ac.signal.aborted) {
        setStatus('done');
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    } finally {
      setElapsed(Math.round((performance.now() - started) / 100) / 10);
    }
  };

  return (
    <section className="card interpret">
      <h3 className="card-title">🔮 무당에게 풀이 듣기</h3>

      <div className="segmented">
        {MODES.map((m) => (
          <button key={m.value} className={mode === m.value ? 'active' : ''} onClick={() => setMode(m.value)}>
            {m.label}
          </button>
        ))}
      </div>

      <textarea
        className="question"
        rows={2}
        maxLength={300}
        placeholder="(선택) 궁금한 거 하나만 적어 주세요. 예: 지금 만나는 사람이랑 오래갈까요?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <details className="advanced">
        <summary>테스트 설정</summary>
        <div className="field">
          <label htmlFor="access-code">접근 코드 (서버에 설정한 경우만)</label>
          <input id="access-code" className="text-input" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
      </details>

      {status === 'loading' ? (
        <button className="btn-secondary" onClick={() => abortRef.current?.abort()}>
          그만 듣기
        </button>
      ) : (
        <button className="btn-primary" onClick={run}>
          {status === 'idle' ? '풀이 들어 보기' : '다시 풀이 받기'}
        </button>
      )}

      {error && <p className="error">풀이를 받지 못했어요: {error}</p>}

      {(text || status === 'loading') && (
        <article className="reading" aria-live="polite">
          {text ? renderMarkdown(text) : <p className="hint">무당이 원국을 살펴보는 중…</p>}
          {status === 'loading' && text && <span className="cursor" aria-hidden />}
        </article>
      )}

      {(status === 'done' || status === 'error') && text && (
        <p className="ai-label">
          생성형 AI가 사주 데이터를 바탕으로 작성한 풀이예요. 재미와 참고용으로만 봐 주세요.
          {usage && (
            <>
              <br />
              {usage.model} · 입력 {usage.input.toLocaleString()} / 출력 {usage.output.toLocaleString()} 토큰
              {elapsed !== null && ` · ${elapsed}초`}
              {usage.stop !== 'end_turn' && ` · 종료 사유 ${usage.stop}`}
            </>
          )}
        </p>
      )}
    </section>
  );
}

/* ── 아주 작은 마크다운 렌더러: ### 제목, **굵게**, - 목록, 문단만 ── */
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

function renderMarkdown(md: string): ReactNode[] {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{inline(para.join(' '))}</p>);
    if (list.length)
      blocks.push(
        <ul key={blocks.length}>
          {list.map((li, i) => (
            <li key={i}>{inline(li)}</li>
          ))}
        </ul>,
      );
    para = [];
    list = [];
  };
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (!t) {
      flush();
    } else if (/^#{1,6}\s/.test(t)) {
      flush();
      blocks.push(<h4 key={blocks.length}>{inline(t.replace(/^#+\s*/, ''))}</h4>);
    } else if (/^[-*]\s/.test(t)) {
      if (para.length) flush();
      list.push(t.slice(2));
    } else {
      if (list.length) flush();
      para.push(t);
    }
  }
  flush();
  return blocks;
}
