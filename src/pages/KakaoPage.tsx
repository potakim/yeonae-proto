import { useState } from 'react';
import { AI_NOTICE, postApi } from '../lib/ai/client';
import type { ChatStats, Interest } from '../lib/kakao/stats';

const MAX_IMAGES = 6;
const MAX_WIDTH = 1280;
const MAX_TOTAL = 3_800_000; // base64 합계 (서버 한도 4.3MB 안쪽)

interface Shot {
  name: string;
  data: string; // base64 (jpeg)
  preview: string;
}

interface Reading {
  headline: string;
  interestComment: string;
  stage: string;
  signals: string[];
  worry: string;
  advice: string;
  replySuggestions: { tone: string; text: string }[];
  closing: string;
}
interface ApiResult {
  stats: ChatStats;
  interest: Interest;
  reading: Reading;
  safetyNotice: string | null;
  meta: { model: string; extractedMessages: number; usage: { input: number; output: number }; privacy: string };
}

/** 브라우저에서 줄여서 JPEG base64 로 (원본은 서버에 보내지 않음) */
async function shrink(file: File): Promise<Shot> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const url = canvas.toDataURL('image/jpeg', 0.82);
  return { name: file.name, data: url.split(',')[1], preview: url };
}

export default function KakaoPage() {
  const [agreed, setAgreed] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const total = shots.reduce((s, x) => s + x.data.length, 0);

  const pick = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const list = [...files].slice(0, MAX_IMAGES - shots.length);
    try {
      const next = await Promise.all(list.map(shrink));
      setShots((s) => [...s, ...next]);
    } catch {
      setError('이미지를 읽지 못했어요. 스크린샷 파일인지 확인해 주세요.');
    }
  };

  const analyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await postApi<ApiResult>('/api/kakao', {
        images: shots.map((s) => ({ data: s.data, mediaType: 'image/jpeg' })),
        note: note || undefined,
      });
      setResult(r);
      setTimeout(() => document.getElementById('kakao-result')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(t);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* 복사 실패는 무시 */
    }
  };

  return (
    <div className="stack">
      <h2 className="page-title">카톡 분석</h2>
      <section className="card bubble">
        <div className="bubble-who">💬 여사친</div>
        <p>카톡 캡처 보여줘요. 연애 프로 정주행으로 단련된 눈으로 분위기 읽어 줄게요. 순서대로 올리면 더 정확해요.</p>
      </section>

      <section className="card">
        <h3 className="card-title">올리기 전에 확인해 주세요</h3>
        <ul className="notice-list">
          <li>대화 상대의 정보가 포함될 수 있어요. 이름·전화번호·계좌는 가려서 분석해요.</li>
          <li>스크린샷과 대화 원문은 분석에만 쓰고 저장하지 않아요. AI 학습에도 쓰지 않아요.</li>
          <li>결과는 대화 일부로 AI가 추정한 거예요. 상대의 진짜 마음을 대신하진 않아요.</li>
        </ul>
        <label className="check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          확인했어요
        </label>
      </section>

      {agreed && (
        <section className="card form">
          <div className="field">
            <label>
              스크린샷 ({shots.length}/{MAX_IMAGES})
            </label>
            {shots.length < MAX_IMAGES && (
              <input type="file" accept="image/*" multiple onChange={(e) => { void pick(e.target.files); e.target.value = ''; }} />
            )}
            {shots.length > 0 && (
              <div className="thumbs">
                {shots.map((s, i) => (
                  <div key={i} className="thumb">
                    <img src={s.preview} alt={`스크린샷 ${i + 1}`} />
                    <button aria-label="빼기" onClick={() => setShots((x) => x.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
            {total > MAX_TOTAL && <p className="error">용량이 커요. 장수를 줄여 주세요.</p>}
          </div>
          <div className="field">
            <label>상황 한 줄 (선택)</label>
            <textarea className="question" rows={2} maxLength={300} placeholder="예: 소개팅 후 2주째 연락 중이에요. 애프터 신청해도 될까요?" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn-primary" disabled={!shots.length || loading || total > MAX_TOTAL} onClick={analyze}>
            {loading ? '여사친이 읽는 중… (30~60초)' : '분석하기 (AI)'}
          </button>
        </section>
      )}

      {result && (
        <div className="stack" id="kakao-result">
          {result.safetyNotice && <section className="card warn"><p>⚠️ {result.safetyNotice}</p></section>}
          <section className="card result-hero">
            <div className="hint">상대의 호감도 (추정)</div>
            <div className="compat-score">{result.interest.score}<span>점</span></div>
            <div className="result-nick">{result.interest.label}</div>
            <p className="hint">
              관계 단계: <strong>{result.reading.stage}</strong> · 신뢰도 {result.interest.confidence}
            </p>
          </section>

          <article className="reading">
            <h4 className="reading-headline">{result.reading.headline}</h4>
            <div className="reading-block">
              <div className="reading-label">호감도 해석</div>
              <p>{result.reading.interestComment}</p>
            </div>
            <div className="reading-block">
              <div className="reading-label">눈에 띈 신호</div>
              <ul>{result.reading.signals.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
            <div className="reading-block">
              <div className="reading-label">신경 쓰이는 점</div>
              <p>{result.reading.worry}</p>
            </div>
            <div className="reading-block">
              <div className="reading-label">지금 해 볼 것</div>
              <p>{result.reading.advice}</p>
            </div>
            <div className="reading-block">
              <div className="reading-label">답장 추천 (눌러서 복사)</div>
              {result.reading.replySuggestions.map((r) => (
                <button key={r.tone} className="reply-chip" onClick={() => copy(r.text)}>
                  <span className="muted">{r.tone}</span> {r.text} {copied === r.text && <span className="muted">· 복사됨</span>}
                </button>
              ))}
            </div>
            <p className="closing">“{result.reading.closing}”</p>
            <p className="ai-label">
              AI가 대화 일부를 바탕으로 추정한 결과예요. {AI_NOTICE}
              <br />
              {result.meta.privacy} · 읽은 메시지 {result.meta.extractedMessages}개 · {result.meta.model} · 토큰 {result.meta.usage.input.toLocaleString()}/{result.meta.usage.output.toLocaleString()}
            </p>
          </article>

          <section className="card">
            <h3 className="card-title">숫자로 보면</h3>
            <table className="stat-table">
              <thead>
                <tr><th></th><th>나</th><th>상대</th></tr>
              </thead>
              <tbody>
                <tr><td>메시지</td><td>{result.stats.me.messages}</td><td>{result.stats.them.messages}</td></tr>
                <tr><td>평균 길이</td><td>{result.stats.me.avgLength}자</td><td>{result.stats.them.avgLength}자</td></tr>
                <tr><td>먼저 말 걸기</td><td>{result.stats.me.initiations}</td><td>{result.stats.them.initiations}</td></tr>
                <tr><td>답장 (중간값)</td><td>{fmtMin(result.stats.me.medianReplyMin)}</td><td>{fmtMin(result.stats.them.medianReplyMin)}</td></tr>
                <tr><td>질문</td><td>{result.stats.me.questions}</td><td>{result.stats.them.questions}</td></tr>
                <tr><td>애정 표현</td><td>{result.stats.me.affection}</td><td>{result.stats.them.affection}</td></tr>
                <tr><td>ㅋㅋ·이모티콘</td><td>{result.stats.me.laughs + result.stats.me.emoticons}</td><td>{result.stats.them.laughs + result.stats.them.emoticons}</td></tr>
              </tbody>
            </table>
            <h4>호감도 근거</h4>
            <ul className="reasons">
              {result.interest.factors.map((f) => (
                <li key={f.key} className={f.delta > 0 ? 'plus' : 'minus'}>
                  <span className="delta">{f.delta > 0 ? `+${f.delta}` : f.delta}</span> {f.text}
                </li>
              ))}
              {result.interest.factors.length === 0 && <li className="muted">두드러진 신호가 없어요</li>}
            </ul>
            <p className="hint">{result.interest.note}</p>
          </section>
        </div>
      )}
    </div>
  );
}

const fmtMin = (m: number | null) => (m === null ? '-' : m < 60 ? `${m}분` : `${Math.round((m / 60) * 10) / 10}시간`);
