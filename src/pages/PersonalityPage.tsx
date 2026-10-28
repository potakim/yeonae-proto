import { useEffect, useMemo, useRef, useState } from 'react';
import { AI_NOTICE, postApi } from '../lib/ai/client';
import { SITUATIONS, type Situation } from '../lib/ai/personality';
import type { HubCharacter } from '../App';
import { AXIS_LABEL, LIKERT, POLE_LABEL, getQuestions, type TestMode } from '../lib/personality/questions';
import { scorePersonality, toPersonalityPayload, type Answers, type PersonalityResult } from '../lib/personality/scoring';
import { BORDER_TIPS, TYPE_PROFILES } from '../lib/personality/types';

type Stage = 'intro' | 'quiz' | 'result';

export default function PersonalityPage({ hub, onType }: { hub: HubCharacter; onType?: (type: string) => void }) {
  const [stage, setStage] = useState<Stage>('intro');
  const [mode, setMode] = useState<TestMode>('full');
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const advancing = useRef(false);

  const questions = useMemo(() => getQuestions(mode), [mode]);
  const result = useMemo(
    () => (stage === 'result' ? scorePersonality(questions, answers) : null),
    [stage, questions, answers],
  );

  const start = (m: TestMode) => {
    setMode(m);
    setAnswers({});
    setIndex(0);
    setStage('quiz');
  };

  const answer = (value: number) => {
    if (advancing.current) return; // 빠른 연타로 문항을 건너뛰지 않도록
    const q = questions[index];
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (index < questions.length - 1) {
      advancing.current = true;
      setTimeout(() => {
        setIndex((i) => i + 1);
        advancing.current = false;
      }, 140);
    } else {
      setStage('result');
      window.scrollTo(0, 0);
    }
  };

  if (stage === 'intro') {
    return (
      <div className="stack">
        <h2 className="page-title">성격유형 테스트</h2>
        <section className="card">
          <p className="lead">
            일상 문항과 연애 상황 문항이 섞여 있어요. 너무 오래 고민하지 말고, <strong>평소의 나</strong>에 가까운 쪽을
            골라 주세요.
          </p>
          <div className="stack-sm">
            <button className="btn-primary" onClick={() => start('full')}>
              정밀 테스트 · 32문항
            </button>
            <button className="btn-secondary" onClick={() => start('quick')}>
              빠른 테스트 · 16문항
            </button>
          </div>
          <p className="hint">자체 제작한 성격유형 테스트예요. 공식 MBTI® 검사와는 관련이 없어요.</p>
        </section>
      </div>
    );
  }

  if (stage === 'quiz') {
    const q = questions[index];
    const progress = (index / questions.length) * 100;
    return (
      <div className="stack quiz">
        <div className="progress">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="quiz-count">
          {index + 1} / {questions.length}
          {q.context === 'love' && <span className="tag-love">연애</span>}
        </div>
        <h2 className="quiz-question" key={q.id}>
          {q.text}
        </h2>
        <div className="likert">
          {LIKERT.map((l) => (
            <button
              key={l.value}
              className={`likert-btn ${answers[q.id] === l.value ? 'selected' : ''}`}
              onClick={() => answer(l.value)}
            >
              <span className={`likert-dot size-${l.value}`} />
              {l.label}
            </button>
          ))}
        </div>
        <button className="btn-text" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
          ← 이전 문항
        </button>
      </div>
    );
  }

  return result ? (
    <ResultView result={result} hub={hub} mode={mode} answers={answers} onType={onType} onRetry={() => setStage('intro')} />
  ) : null;
}

interface AiReading {
  headline: string;
  summary: string;
  loveStyle: string;
  strengths: string[];
  watchOut: string[];
  situationTip: string;
  hubComment: string;
}

function ResultView({
  result,
  hub,
  mode,
  answers,
  onType,
  onRetry,
}: {
  result: PersonalityResult;
  hub: HubCharacter;
  mode: TestMode;
  answers: Answers;
  onType?: (type: string) => void;
  onRetry: () => void;
}) {
  const profile = TYPE_PROFILES[result.type];
  const [situation, setSituation] = useState<Situation | null>(null);
  const [ai, setAi] = useState<{ reading: AiReading; meta: { model: string; cached: boolean } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    onType?.(result.type);
  }, [onType, result.type]);

  const askAi = async () => {
    setLoading(true);
    setError(null);
    try {
      setAi(await postApi('/api/personality', { mode, answers, hub, situation }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  const borderAxes = result.axes.filter((a) => a.clarity === '경계');
  const payload = toPersonalityPayload(result, mode);

  return (
    <div className="stack">
      <section className="card result-hero">
        <div className="result-type">{result.type}</div>
        <div className="result-nick">{profile.nickname}</div>
        <p className="result-summary">{profile.summary}</p>
      </section>

      <section className="card">
        <h3 className="card-title">성향 스펙트럼</h3>
        <div className="axes">
          {result.axes.map((a) => {
            const leftWins = a.pole === a.left;
            return (
              <div key={a.axis} className="axis">
                <div className="axis-head">
                  <span>{AXIS_LABEL[a.axis]}</span>
                  <span className={`clarity clarity-${a.clarity.replace(' ', '')}`}>
                    {a.clarity}
                    {a.tieBroken ? ' · 동점' : ''}
                  </span>
                </div>
                <div className="axis-bar">
                  <span className={`axis-pole ${leftWins ? 'win' : ''}`}>
                    {a.left} {POLE_LABEL[a.left]} {a.leftPercent}%
                  </span>
                  <div className="axis-track">
                    <div className="axis-fill-left" style={{ width: `${a.leftPercent}%` }} />
                  </div>
                  <span className={`axis-pole right ${!leftWins ? 'win' : ''}`}>
                    {100 - a.leftPercent}% {POLE_LABEL[a.right]} {a.right}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">연애할 때 나는</h3>
        <p>{profile.loveStyle}</p>
        <div className="two-col">
          <div>
            <h4>💪 연애 강점</h4>
            <ul>
              {profile.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>🚧 조심할 점</h4>
            <ul>
              {profile.watchOut.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {borderAxes.length > 0 && (
        <section className="card">
          <h3 className="card-title">양쪽 성향이 비슷한 영역</h3>
          {borderAxes.map((a) => (
            <p key={a.axis}>
              <strong>{AXIS_LABEL[a.axis]}</strong> · {BORDER_TIPS[a.axis]}
            </p>
          ))}
        </section>
      )}

      <section className="card bubble">
        <div className="bubble-who">{hub === '형' ? '🧢 아는 형' : '🎀 아는 언니'}</div>
        {ai ? (
          <div className="ai-reading">
            <h4 className="reading-headline">{ai.reading.headline}</h4>
            <p>{ai.reading.summary}</p>
            <div className="reading-label">연애할 때 나는</div>
            <p>{ai.reading.loveStyle}</p>
            <div className="two-col">
              <div>
                <h4>💪 연애 강점</h4>
                <ul>{ai.reading.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div>
                <h4>🚧 조심할 점</h4>
                <ul>{ai.reading.watchOut.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            </div>
            <div className="reading-label">{situation ? `${situation}인 지금` : '지금 해 볼 것'}</div>
            <p>{ai.reading.situationTip}</p>
            <p className="closing">“{ai.reading.hubComment}”</p>
            <p className="ai-label">
              {AI_NOTICE} · {ai.meta.model} · {ai.meta.cached ? '캐시' : '새로 생성'}
            </p>
          </div>
        ) : (
          <p>{hub === '형' ? profile.hubComment : profile.hubComment.replace(/형/g, '언니')}</p>
        )}
        <div className="field">
          <label>지금 내 상황 (선택하면 맞춤 조언)</label>
          <div className="segmented">
            {SITUATIONS.map((x) => (
              <button key={x} className={situation === x ? 'active' : ''} onClick={() => setSituation(situation === x ? null : x)}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <button className="btn-primary" disabled={loading} onClick={askAi}>
          {loading ? `아는 ${hub}가 생각하는 중…` : ai ? '다시 풀이 받기' : `아는 ${hub}에게 자세히 듣기 (AI)`}
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      <div className="stack-sm">
        <button className="btn-secondary" onClick={onRetry}>
          다시 테스트하기
        </button>
      </div>

      <details className="card dev">
        <summary>개발용 · LLM 해석 단계에 넘길 데이터</summary>
        <pre>{JSON.stringify(payload, null, 2)}</pre>
      </details>

      <p className="hint center">자체 제작한 성격유형 테스트예요. 공식 MBTI® 검사와는 관련이 없어요.</p>
    </div>
  );
}
