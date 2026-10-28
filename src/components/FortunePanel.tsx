import { useEffect, useMemo, useRef, useState } from 'react';
import type { SajuInput } from '../lib/saju';
import { buildPersonalBundle, buildSharedBundle, KIND_LABEL, type ReadingKind } from '../lib/fortune/reading';
import type { FlowSignal } from '../lib/fortune/signals';

type PersonalKind = Exclude<ReadingKind, 'todayShared'>;
const TABS: { kind: PersonalKind; label: string }[] = [
  { kind: 'today', label: '오늘' },
  { kind: 'week', label: '이번 주' },
  { kind: 'year', label: '올해' },
  { kind: 'natal', label: '원국 풀이' },
];

const ACCESS_KEY = 'modu-yeonae.accessCode';
const load = () => {
  try {
    return localStorage.getItem(ACCESS_KEY) ?? '';
  } catch {
    return '';
  }
};

interface Reading {
  headline: string;
  summary?: string;
  love?: string;
  caution: string;
  lucky: { item: string; action: string };
  closing: string;
  personality?: string;
  loveStyle?: string;
  goodMatch?: string;
  luckFlow?: string;
  days?: { date: string; line: string }[];
  months?: { month: string; line: string }[];
}

interface ApiResult {
  reading?: Reading;
  meta: { model: string; cached?: boolean; promptVersion: string; criteriaVersion: string; usage?: { input: number; output: number }; dryRun?: boolean; cacheKey: string };
  prompt?: { system: string; user: string; schema: unknown };
}

export default function FortunePanel({ input }: { input: SajuInput }) {
  const [kind, setKind] = useState<PersonalKind>('today');
  const [code, setCode] = useState(load);
  const [dryRun, setDryRun] = useState(false);
  const [results, setResults] = useState<Partial<Record<ReadingKind, ApiResult>>>({});
  const [loading, setLoading] = useState<ReadingKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // ② 신호는 브라우저에서도 같은 코드로 즉시 계산해 보여 준다 (풀이 전에도 근거 확인 가능)
  const [now] = useState(() => new Date());
  const bundle = useMemo(() => buildPersonalBundle(input, kind, { now }), [input, kind, now]);
  const dayPillar = useMemo(() => {
    const b = buildPersonalBundle(input, 'natal', { now });
    const g = b.natal.pillars.day!.ganji;
    return { stem: g[0], branch: g[1] };
  }, [input, now]);
  const shared = useMemo(
    () => buildSharedBundle(dayPillar as Parameters<typeof buildSharedBundle>[0], input.gender, { now }),
    [dayPillar, input.gender, now],
  );

  const request = async (k: ReadingKind) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(k);
    setError(null);
    try {
      localStorage.setItem(ACCESS_KEY, code);
    } catch {
      /* 무시 */
    }
    try {
      const body =
        k === 'todayShared'
          ? { kind: k, dayPillar, gender: input.gender, dryRun }
          : { kind: k, birth: input, dryRun };
      const res = await fetch('/api/fortune', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-code': code },
        body: JSON.stringify(body),
        signal: ac.signal,
      });
      const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setResults((r) => ({ ...r, [k]: j }));
    } catch (e) {
      if (!ac.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const result = results[kind];
  const sharedResult = results.todayShared;

  return (
    <section className="card fortune">
      <h3 className="card-title">🔮 운세 · 무당 풀이</h3>
      <div className="segmented tabs4">
        {TABS.map((t) => (
          <button key={t.kind} className={kind === t.kind ? 'active' : ''} onClick={() => setKind(t.kind)}>
            {t.label}
          </button>
        ))}
      </div>

      {bundle.today.note && kind !== 'natal' && <p className="hint">{bundle.today.note}</p>}

      {/* ② 코드가 확정한 신호 */}
      {kind === 'today' && bundle.kind === 'today' && <DaySignal s={bundle.signals} title={`${bundle.period} 일진`} />}
      {kind === 'week' && bundle.kind === 'week' && (
        <WeekSignals w={bundle.signals} lines={result?.reading?.days} />
      )}
      {kind === 'year' && bundle.kind === 'year' && <YearSignals y={bundle.signals} lines={result?.reading?.months} />}
      {kind === 'natal' && <p className="hint">원국 구조(위 카드)를 근거로 타고난 연애 성향을 풀어요.</p>}

      {bundle.lucky && (
        <p className="lucky-line">
          행운 오행 <strong>{bundle.lucky.element}</strong> · {bundle.lucky.color} · {bundle.lucky.direction} · 숫자{' '}
          {bundle.lucky.numbers.join(', ')} <span className="muted">({bundle.lucky.basis})</span>
        </p>
      )}

      <details className="advanced">
        <summary>테스트 설정</summary>
        <div className="field">
          <label htmlFor="access-code">접근 코드 (서버에 설정한 경우만)</label>
          <input id="access-code" className="text-input" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <label className="check">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          미리보기: Claude 호출 없이 프롬프트만 받기
        </label>
      </details>

      <button className="btn-primary" disabled={loading !== null} onClick={() => request(kind)}>
        {loading === kind ? '무당이 풀이를 쓰는 중… (20~40초)' : `${KIND_LABEL[kind]} 풀이 받기`}
      </button>
      {error && <p className="error">풀이를 받지 못했어요: {error}</p>}

      {result && <ReadingView kind={kind} r={result} />}

      {kind === 'today' && (
        <div className="shared-box">
          <p className="hint">
            공용판: 같은 일주({shared.natal.dayPillar})·성별이면 모두 같은 풀이를 봐요. 하루 120건만 만들면 되는 무료 유입용 버전이에요.
            (오늘 {shared.signals.ganji}, {shared.signals.grade})
          </p>
          <button className="btn-secondary" disabled={loading !== null} onClick={() => request('todayShared')}>
            {loading === 'todayShared' ? '불러오는 중…' : '공용 오늘의 운세 받기'}
          </button>
          {sharedResult && <ReadingView kind="todayShared" r={sharedResult} />}
        </div>
      )}
    </section>
  );
}

/* ───────────── 신호 표시 ───────────── */

const toneClass = (tone: string) => (tone === '좋음' ? 'tone-good' : tone === '주의' ? 'tone-care' : 'tone-mid');

function Grade({ s }: { s: Pick<FlowSignal, 'grade' | 'tone'> }) {
  return <span className={`grade ${toneClass(s.tone)}`}>{s.grade}</span>;
}

function DaySignal({ s, title }: { s: FlowSignal; title: string }) {
  return (
    <div className="signal">
      <div className="signal-head">
        <span>
          {title} <strong>{s.ganji}</strong>
        </span>
        <Grade s={s} />
      </div>
      <div className="chips">
        <span className="tag">천간 {s.stem.char} {s.stem.tenGod}</span>
        <span className="tag">지지 {s.branch.char} {s.branch.tenGod}</span>
        <span className="tag">12운성 {s.twelveStage}</span>
        {s.loveStar && <span className="tag tag-love">이성의 별</span>}
        {s.isVoid && <span className="tag">공망</span>}
        {s.activatedStars.map((x) => (
          <span key={x} className="tag tag-love">{x}</span>
        ))}
      </div>
      <ul className="reasons">
        {s.reasons.map((r) => (
          <li key={r.code} className={r.delta > 0 ? 'plus' : 'minus'}>
            <span className="delta">{r.delta > 0 ? `+${r.delta}` : r.delta}</span> {r.text}
          </li>
        ))}
        {s.reasons.length === 0 && <li className="muted">두드러진 신호가 없는 평범한 흐름</li>}
      </ul>
    </div>
  );
}

function WeekSignals({ w, lines }: { w: { days: (FlowSignal & { date: string; weekday: string })[]; bestDays: string[]; cautionDays: string[] }; lines?: { date: string; line: string }[] }) {
  return (
    <div className="rows">
      {w.days.map((d) => (
        <div key={d.date} className="row">
          <div className="row-date">
            {d.date.slice(5).replace('-', '/')} ({d.weekday})
            <div className="muted">{d.ganji}</div>
          </div>
          <div className="row-body">
            <Grade s={d} />
            {w.bestDays.includes(d.date) && <span className="tag tag-love">좋은 날</span>}
            {w.cautionDays.includes(d.date) && <span className="tag">조심할 날</span>}
            <div className="row-line">{lines?.find((l) => l.date === d.date)?.line ?? shortReasons(d)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function YearSignals({
  y,
  lines,
}: {
  y: { saeunYear: number; period: { start: string; note: string }; annual: FlowSignal; luck: FlowSignal | null; months: (FlowSignal & { start: string; end: string; current: boolean; term: string })[] };
  lines?: { month: string; line: string }[];
}) {
  return (
    <>
      <DaySignal s={y.annual} title={`${y.saeunYear} 세운 (${y.period.start}~)`} />
      {y.luck && <DaySignal s={y.luck} title="현재 대운" />}
      <p className="hint">{y.period.note}</p>
      <div className="rows">
        {y.months.map((m) => (
          <div key={m.start} className={`row ${m.current ? 'row-current' : ''}`}>
            <div className="row-date">
              {m.start.slice(5).replace('-', '/')}~
              <div className="muted">
                {m.ganji}월 · {m.term}
              </div>
            </div>
            <div className="row-body">
              <Grade s={m} />
              <span className="muted"> {m.stem.tenGod}/{m.branch.tenGod}</span>
              <div className="row-line">{lines?.find((l) => l.month === m.start.slice(0, 7))?.line ?? ''}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** 풀이 받기 전 줄 요약: 근거 문구의 앞부분만 */
function shortReasons(s: FlowSignal): string {
  const parts = s.reasons.map((r) => `${r.delta > 0 ? '+' : '−'} ${r.text.split(':')[0].replace(/^(천간|지지) . = /, '')}`);
  return parts.length ? parts.join(' · ') : '두드러진 신호 없음';
}

/* ───────────── 풀이 표시 ───────────── */

function ReadingView({ kind, r }: { kind: ReadingKind; r: ApiResult }) {
  if (r.meta.dryRun && r.prompt) {
    return (
      <details className="dev" open>
        <summary>미리보기 · {KIND_LABEL[kind]} 프롬프트 ({r.prompt.user.length.toLocaleString()}자)</summary>
        <pre>{r.prompt.system}</pre>
        <pre>{r.prompt.user}</pre>
        <pre>{JSON.stringify(r.prompt.schema, null, 2)}</pre>
      </details>
    );
  }
  const x = r.reading;
  if (!x) return null;
  const blocks: [string, string | undefined][] = [
    ['총평', x.summary],
    ['타고난 성향', x.personality],
    ['연애 스타일', x.loveStyle],
    ['잘 맞는 상대', x.goodMatch],
    ['연애운', x.love],
    ['대운의 흐름', x.luckFlow],
    ['조심할 점', x.caution],
  ];
  return (
    <article className="reading">
      <h4 className="reading-headline">{x.headline}</h4>
      {blocks
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="reading-block">
            <div className="reading-label">{k}</div>
            <p>{v}</p>
          </div>
        ))}
      <div className="reading-block lucky">
        <div className="reading-label">행운 포인트</div>
        <p>
          <strong>{x.lucky.item}</strong> — {x.lucky.action}
        </p>
      </div>
      <p className="closing">“{x.closing}”</p>
      <p className="ai-label">
        생성형 AI가 사주 신호를 바탕으로 작성한 풀이예요. 재미와 참고용으로만 봐 주세요.
        <br />
        {r.meta.model} · {r.meta.cached ? '캐시' : '새로 생성'} · 프롬프트 {r.meta.promptVersion} · 기준 {r.meta.criteriaVersion}
        {r.meta.usage && ` · 입력 ${r.meta.usage.input.toLocaleString()} / 출력 ${r.meta.usage.output.toLocaleString()} 토큰`}
      </p>
    </article>
  );
}
