import { useState } from 'react';
import BirthForm from '../components/BirthForm';
import { MBTI_TYPES, defaultBirth } from '../lib/birth-defaults';
import { AI_NOTICE, postApi } from '../lib/ai/client';
import { computeCompat, type CompatResult } from '../lib/compat/compat';
import { calculateSaju, type SajuInput } from '../lib/saju';

interface Reading {
  headline: string;
  summary: string;
  chemistry: string;
  communication: string;
  conflict: string;
  advice: string;
  closing: string;
}

export default function CompatPage({ mySaju, myType }: { mySaju: SajuInput | null; myType: string | null }) {
  const [me, setMe] = useState<SajuInput>(mySaju ?? defaultBirth('female'));
  const [partner, setPartner] = useState<SajuInput>(defaultBirth(mySaju?.gender === 'female' ? 'male' : 'female'));
  const [meMbti, setMeMbti] = useState(myType ?? '');
  const [partnerMbti, setPartnerMbti] = useState('');
  const [partnerLabel, setPartnerLabel] = useState('');
  const [result, setResult] = useState<CompatResult | null>(null);
  const [reading, setReading] = useState<{ reading: Reading; meta: { model: string; cached: boolean } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMe, setEditMe] = useState(!mySaju);

  const label = partnerLabel.trim() || '그 사람';

  const compute = () => {
    setError(null);
    setReading(null);
    try {
      const r = computeCompat(
        { label: '나', saju: calculateSaju(me), mbti: meMbti || null },
        { label, saju: calculateSaju(partner), mbti: partnerMbti || null },
      );
      setResult(r);
      setTimeout(() => document.getElementById('compat-result')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const askAi = async () => {
    setLoading(true);
    setError(null);
    try {
      setReading(
        await postApi('/api/compat', {
          me: { birth: me, mbti: meMbti || null, label: '나' },
          partner: { birth: partner, mbti: partnerMbti || null, label },
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stack">
      <h2 className="page-title">사주 × MBTI 궁합</h2>
      <section className="card bubble">
        <div className="bubble-who">🔮 모두 무당</div>
        <p>그 사람 생일 알아요? 이름은 필요 없어요. 생년월일이랑 아는 만큼만 알려 주면 두 사람 기운을 맞춰 볼게요.</p>
      </section>

      <section className="card">
        <h3 className="card-title">나</h3>
        {editMe ? (
          <BirthForm idPrefix="나" value={me} onChange={setMe} />
        ) : (
          <p>
            {me.year}.{me.month}.{me.day} {me.hour === null ? '(시간 모름)' : `${me.hour}:${String(me.minute).padStart(2, '0')}`} ·{' '}
            {me.gender === 'female' ? '여성' : '남성'} <button className="btn-text" onClick={() => setEditMe(true)}>수정</button>
          </p>
        )}
        <div className="field">
          <label>내 MBTI (선택)</label>
          <select value={meMbti} onChange={(e) => setMeMbti(e.target.value)}>
            <option value="">모름</option>
            {MBTI_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">그 사람</h3>
        <div className="field">
          <label>부를 별칭 (실명 말고, 10자 이내)</label>
          <input className="text-input" maxLength={10} placeholder="예: 썸남, 그 사람" value={partnerLabel} onChange={(e) => setPartnerLabel(e.target.value)} />
        </div>
        <BirthForm idPrefix="상대" value={partner} onChange={setPartner} />
        <div className="field">
          <label>그 사람 MBTI (선택)</label>
          <select value={partnerMbti} onChange={(e) => setPartnerMbti(e.target.value)}>
            <option value="">모름</option>
            {MBTI_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      <button className="btn-primary" onClick={compute}>궁합 점수 보기</button>

      {result && (
        <div className="stack" id="compat-result">
          <section className="card result-hero">
            <div className="compat-score">{result.score}<span>점</span></div>
            <div className="result-nick">{result.grade}</div>
            <p className="hint">{result.scoreMeaning}</p>
          </section>

          <section className="card">
            <h3 className="card-title">점수 근거</h3>
            <ul className="reasons">
              {result.items.map((i) => (
                <li key={i.key} className={i.delta > 0 ? 'plus' : 'minus'}>
                  <span className="delta">{i.delta > 0 ? `+${i.delta}` : i.delta}</span> <strong>{i.title}</strong>
                  <div className="muted">{i.detail}</div>
                </li>
              ))}
            </ul>
            <p className="hint">
              나 {result.me.dayMaster} · {result.me.dayPillar}일주 / {label} {result.partner.dayMaster} · {result.partner.dayPillar}일주
              {result.mbti && ` · ${result.mbti.pair}`}
            </p>
          </section>

          {reading ? (
            <article className="reading">
              <h4 className="reading-headline">{reading.reading.headline}</h4>
              {(
                [
                  ['총평', reading.reading.summary],
                  ['끌림과 잘 맞는 점', reading.reading.chemistry],
                  ['대화와 생활', reading.reading.communication],
                  ['부딪히는 지점', reading.reading.conflict],
                  ['무당의 조언', reading.reading.advice],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="reading-block">
                  <div className="reading-label">{k}</div>
                  <p>{v}</p>
                </div>
              ))}
              <p className="closing">“{reading.reading.closing}”</p>
              <p className="ai-label">
                {AI_NOTICE} · {reading.meta.model} · {reading.meta.cached ? '캐시' : '새로 생성'}
              </p>
            </article>
          ) : (
            <button className="btn-primary" disabled={loading} onClick={askAi}>
              {loading ? '무당이 두 사람 기운을 맞춰 보는 중… (20~40초)' : '무당에게 궁합 풀이 듣기 (AI)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
