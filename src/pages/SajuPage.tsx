import { useMemo, useState } from 'react';
import FortunePanel from '../components/FortunePanel';
import type { FiveElement, Gender } from 'manseryeok';
import {
  BIRTH_PLACES,
  DEFAULT_JASI_RULE,
  DEFAULT_TIME_STANDARD,
  JASI_RULE_INFO,
  TIME_STANDARD_INFO,
  type JasiRule,
  type TimeStandard,
  ELEMENTS,
  ELEMENT_HANJA,
  PILLAR_KEYS,
  PILLAR_LABEL,
  calculateSaju,
  toLlmPayload,
  type SajuInput,
  type SajuResult,
} from '../lib/saju';

const ELEMENT_CLASS: Record<FiveElement, string> = {
  목: 'el-wood',
  화: 'el-fire',
  토: 'el-earth',
  금: 'el-metal',
  수: 'el-water',
};

const TIME_STANDARD_OPTIONS = (['korea', 'trueSolar', 'none'] as const).map((value) => ({ value, ...TIME_STANDARD_INFO[value] }));
const JASI_RULE_OPTIONS = (['jasi', 'splitJasi'] as const).map((value) => ({ value, ...JASI_RULE_INFO[value] }));

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export default function SajuPage({ onSaved }: { onSaved?: (input: SajuInput) => void }) {
  const [year, setYear] = useState('1995');
  const [month, setMonth] = useState('3');
  const [day, setDay] = useState('15');
  const [hour, setHour] = useState(14);
  const [minute, setMinute] = useState(30);
  const [hourUnknown, setHourUnknown] = useState(false);
  const [isLunar, setIsLunar] = useState(false);
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [gender, setGender] = useState<Gender>('female');
  const [placeIdx, setPlaceIdx] = useState(0);
  const [timeStandard, setTimeStandard] = useState<TimeStandard>(DEFAULT_TIME_STANDARD);
  const [dayBoundary, setDayBoundary] = useState<JasiRule>(DEFAULT_JASI_RULE);

  const [result, setResult] = useState<SajuResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (![y, m, d].every(Number.isInteger)) {
      setError('생년월일을 숫자로 입력해 주세요.');
      return;
    }
    const input: SajuInput = {
      year: y,
      month: m,
      day: d,
      hour: hourUnknown ? null : hour,
      minute,
      isLunar,
      isLeapMonth,
      gender,
      longitude: BIRTH_PLACES[placeIdx].longitude,
      timeStandard,
      dayBoundary,
    };
    try {
      setResult(calculateSaju(input));
      onSaved?.(input);
      setTimeout(() => document.getElementById('saju-result')?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="stack">
      <h2 className="page-title">만세력 · 사주 원국</h2>

      <section className="card form">
        <div className="field">
          <label>달력</label>
          <div className="segmented">
            <button className={!isLunar ? 'active' : ''} onClick={() => setIsLunar(false)}>
              양력
            </button>
            <button className={isLunar ? 'active' : ''} onClick={() => setIsLunar(true)}>
              음력
            </button>
          </div>
          {isLunar && (
            <label className="check">
              <input type="checkbox" checked={isLeapMonth} onChange={(e) => setIsLeapMonth(e.target.checked)} />
              윤달이에요
            </label>
          )}
        </div>

        <div className="field">
          <label>생년월일</label>
          <div className="row3">
            <div className="suffix-input">
              <input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} aria-label="년" />
              <span>년</span>
            </div>
            <div className="suffix-input">
              <input inputMode="numeric" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="월" />
              <span>월</span>
            </div>
            <div className="suffix-input">
              <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} aria-label="일" />
              <span>일</span>
            </div>
          </div>
        </div>

        <div className="field">
          <label>태어난 시간</label>
          <div className="row2">
            <select value={hour} disabled={hourUnknown} onChange={(e) => setHour(Number(e.target.value))} aria-label="시">
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}시
                </option>
              ))}
            </select>
            <select value={minute} disabled={hourUnknown} onChange={(e) => setMinute(Number(e.target.value))} aria-label="분">
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, '0')}분
                </option>
              ))}
            </select>
          </div>
          <label className="check">
            <input type="checkbox" checked={hourUnknown} onChange={(e) => setHourUnknown(e.target.checked)} />
            시간을 몰라요
          </label>
        </div>

        <div className="field">
          <label>성별 (대운 계산에 필요해요)</label>
          <div className="segmented">
            <button className={gender === 'female' ? 'active' : ''} onClick={() => setGender('female')}>
              여성
            </button>
            <button className={gender === 'male' ? 'active' : ''} onClick={() => setGender('male')}>
              남성
            </button>
          </div>
        </div>

        <div className="field">
          <label>태어난 곳</label>
          <select value={placeIdx} onChange={(e) => setPlaceIdx(Number(e.target.value))}>
            {BIRTH_PLACES.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
                {p.longitude ? ` (${p.longitude}°E)` : ''}
              </option>
            ))}
          </select>
          {timeStandard === 'trueSolar' && <p className="hint">진태양시는 이 경도로 계산해요.</p>}
        </div>

        <details className="advanced">
          <summary>고급 설정 (관법)</summary>
          <div className="field">
            <label>시주 시간 기준</label>
            <div className="radio-list">
              {TIME_STANDARD_OPTIONS.map((o) => (
                <label key={o.value} className="radio">
                  <input
                    type="radio"
                    name="timeStandard"
                    checked={timeStandard === o.value}
                    onChange={() => setTimeStandard(o.value)}
                  />
                  <span>
                    <strong>{o.label}</strong> · {o.desc}
                  </span>
                </label>
              ))}
            </div>
            <p className="hint">
              한국 표준시는 동경 135° 기준이라 실제 태양보다 약 30분 빨라요. 서머타임(1948~51, 1955~60, 1987~88)과
              1954~61년 표준시는 어떤 기준이든 자동으로 반영해요.
            </p>
          </div>
          <div className="field">
            <label>자시(밤 {timeStandard === 'none' ? '11시' : '11시 30분'} 이후) 출생</label>
            <div className="radio-list">
              {JASI_RULE_OPTIONS.map((o) => (
                <label key={o.value} className="radio">
                  <input
                    type="radio"
                    name="dayBoundary"
                    checked={dayBoundary === o.value}
                    onChange={() => setDayBoundary(o.value)}
                  />
                  <span>
                    <strong>{o.label}</strong> · {o.desc}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </details>

        {error && <p className="error">{error}</p>}
        <button className="btn-primary" onClick={submit}>
          사주 원국 보기
        </button>
      </section>

      {result && <SajuResultView r={result} />}
    </div>
  );
}

function SajuResultView({ r }: { r: SajuResult }) {
  const d = r.detail;
  const total = Object.values(r.elementCounts).reduce((a, b) => a + b, 0);
  // 렌더마다 새로 만들면 풀이 패널이 초기화되므로 결과가 바뀔 때만 계산
  const payload = useMemo(() => toLlmPayload(r), [r]);

  return (
    <div className="stack" id="saju-result">
      <section className="card">
        <div className="result-meta">
          {r.input.isLunar ? (
            <>
              음력 {r.input.year}.{r.input.month}.{r.input.day}
              {r.input.isLeapMonth ? '(윤)' : ''} → 양력 {r.solarDate.year}.{r.solarDate.month}.{r.solarDate.day}
            </>
          ) : (
            <>
              양력 {r.solarDate.year}.{r.solarDate.month}.{r.solarDate.day}
            </>
          )}
          {r.hourKnown && (
            <>
              {' '}
              · {String(r.input.hour).padStart(2, '0')}:{String(r.input.minute).padStart(2, '0')}
            </>
          )}
        </div>
        <div className="basis-chips" aria-label="적용 기준">
          {payload.basis.map((b) => (
            <span key={b} className="basis-chip">
              {b}
            </span>
          ))}
        </div>

        <div className="pillars">
          {PILLAR_KEYS.map((key) => {
            const hidden = key === 'hour' && !r.hourKnown;
            const p = d[key];
            const el = d[`${key}Element` as const];
            const tg = d.tenGods[key];
            return (
              <div key={key} className={`pillar ${hidden ? 'pillar-hidden' : ''}`}>
                <div className="pillar-label">{PILLAR_LABEL[key]}</div>
                {hidden ? (
                  <div className="pillar-unknown">시간
                    <br />
                    모름
                  </div>
                ) : (
                  <>
                    <div className="tengod">{tg.stem}</div>
                    <div className={`char ${ELEMENT_CLASS[el.stem]}`}>
                      <span className="char-ko">{p.heavenlyStem}</span>
                      <span className="char-han">{d[`${key}Hanja` as const][0]}</span>
                    </div>
                    <div className={`char ${ELEMENT_CLASS[el.branch]}`}>
                      <span className="char-ko">{p.earthlyBranch}</span>
                      <span className="char-han">{d[`${key}Hanja` as const][1]}</span>
                    </div>
                    <div className="tengod">{tg.branch}</div>
                    <div className="hidden-stems" title="지장간">
                      {payload.pillars[key]?.branch.hiddenStems.map((h) => h.stem).join(' ')}
                    </div>
                    <div className="stage">{payload.pillars[key]?.twelveStage}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="pillar-legend">윗줄 천간 십신 · 아랫줄 지지 십신 · 지장간 · 12운성</p>
        <p className="day-master">
          일간(나): <strong>{d.day.heavenlyStem}</strong> · {d.dayYinYang.stem}
          {d.dayElement.stem}
        </p>
      </section>

      {r.warnings.length > 0 && (
        <section className="card warn">
          {r.warnings.map((w) => (
            <p key={w}>⚠️ {w}</p>
          ))}
          {r.ambiguousWithoutHour.map((a) => (
            <p key={a.key}>
              · {PILLAR_LABEL[a.key]} 후보: {a.values.join(' / ')}
            </p>
          ))}
        </section>
      )}

      {(r.zodiac.differs || r.standardDiff.length > 0 || r.jasiDiff) && (
        <section className="card info">
          {r.zodiac.differs && (
            <p>
              ℹ️ 사주는 입춘을 기준으로 해가 바뀌어서 <strong>{r.zodiac.saju}띠</strong>로 봐요. 설날 기준으로는{' '}
              {r.zodiac.seollal}띠예요.
            </p>
          )}
          {(r.standardDiff.length > 0 || r.jasiDiff) && (
            <>
              <p>ℹ️ 기준에 따라 결과가 달라지는 출생 시각이에요. 다른 앱과 다르게 보이면 아래 기준 차이 때문이에요.</p>
              {r.standardDiff.map((s) => (
                <p key={s.standard} className="info-row">
                  · {TIME_STANDARD_INFO[s.standard].withParticle} 보면: {s.changes.map((c) => `${PILLAR_LABEL[c.key]} ${c.value}`).join(', ')}
                </p>
              ))}
              {r.jasiDiff && (
                <p className="info-row">
                  · {JASI_RULE_INFO[r.jasiDiff.rule].ifApplied}:{' '}
                  {r.jasiDiff.changes.map((c) => `${PILLAR_LABEL[c.key]} ${c.value}`).join(', ')}
                </p>
              )}
            </>
          )}
        </section>
      )}

      <section className="card">
        <h3 className="card-title">오행 분포 ({total}글자)</h3>
        <div className="elements">
          {ELEMENTS.map((e) => (
            <div key={e} className="element-row">
              <span className={`element-chip ${ELEMENT_CLASS[e]}`}>
                {e} {ELEMENT_HANJA[e]}
              </span>
              <div className="bar">
                <div className={`bar-fill ${ELEMENT_CLASS[e]}`} style={{ width: `${(r.elementCounts[e] / total) * 100}%` }} />
              </div>
              <span className="element-count">{r.elementCounts[e]}</span>
            </div>
          ))}
        </div>
        <p className="hint">천간·지지 글자 기준 단순 개수예요. 지장간·계절 가중치는 해석 단계에서 반영할 예정이에요.</p>
      </section>

      <section className="card">
        <h3 className="card-title">구조 한눈에 보기</h3>
        <dl className="facts">
          <dt>신강약</dt>
          <dd>
            {payload.strength.verdict} <span className="muted">(돕는 힘 {Math.round(payload.strength.supportRatio * 100)}%
            · 득령 {payload.strength.deukryeong ? 'O' : 'X'} · 득지 {payload.strength.deukji ? 'O' : 'X'} · 득세{' '}
            {payload.strength.deukse ? 'O' : 'X'})</span>
          </dd>
          <dt>십신 분포</dt>
          <dd>
            {Object.entries(payload.tenGodCounts.counts)
              .map(([k, v]) => `${k} ${v}`)
              .join(' · ')}
          </dd>
          <dt>계절</dt>
          <dd>
            {payload.season.label} ({payload.season.monthBranch}월)
            {payload.elementCounts.missing.length > 0 && ` · 없는 오행: ${payload.elementCounts.missing.join(', ')}`}
          </dd>
          <dt>합충형파해</dt>
          <dd>
            {payload.relations.length === 0
              ? '없음'
              : payload.relations.map((rel) => (
                  <span key={rel.type + rel.where.join()} className="tag">
                    {rel.type} {[...new Set(rel.chars)].join('')}
                    {rel.result ? `→${rel.result}` : ''} <span className="muted">({rel.where.join('·')})</span>
                  </span>
                ))}
          </dd>
          <dt>신살</dt>
          <dd>
            {payload.specialStars.length === 0
              ? '없음'
              : payload.specialStars.map((st) => (
                  <span key={st.name + st.char} className="tag">
                    {st.name} {st.char} <span className="muted">({st.where.join('·')})</span>
                  </span>
                ))}
          </dd>
          <dt>공망</dt>
          <dd>
            일주 기준 {payload.voidBranches.byDayPillar.join('')} · 연주 기준 {payload.voidBranches.byYearPillar.join('')}
            {payload.voidBranches.inNatal.length > 0 && ` · 원국 해당: ${payload.voidBranches.inNatal.join(', ')}`}
          </dd>
        </dl>
        <p className="hint">신강약은 간이 점수예요. 신살은 학파마다 기준이 달라 대표적인 것만 표시해요.</p>
      </section>

      {d.luckPillars && (
        <section className="card">
          <h3 className="card-title">
            대운 · {d.luckPillars.forward ? '순행' : '역행'} · 대운수 {d.luckPillars.startAge}
          </h3>
          <div className="luck-scroll">
            {payload.luckPillars!.list.map((p) => (
              <div key={p.startDate} className={`luck-item ${p.current ? 'luck-current' : ''}`} title={p.display}>
                <div className="luck-age">{p.label}</div>
                <div className="luck-ganji">{p.ganji}</div>
                <div className="luck-age">{p.ageAtStart.replace(' 0개월', '')}</div>
                <div className="luck-age">
                  {p.startDate.slice(0, 4)}.{p.startDate.slice(5, 7)}~
                </div>
              </div>
            ))}
          </div>
          <p className="hint">
            대운수({d.luckPillars.startAge})는 관례로 쓰는 숫자이고, 나이는 만 나이예요. 첫 대운은{' '}
            {payload.luckPillars!.firstStartDate}부터(출생 후 {d.luckPillars.startYears}년 {d.luckPillars.startMonths}개월{' '}
            {d.luckPillars.startDays}일) · 올해 세운 {payload.now.annual.ganji} · 이번 달 {payload.now.monthly.ganji}
          </p>
        </section>
      )}

      <FortunePanel key={JSON.stringify(r.input)} input={r.input} />

      <details className="card dev">
        <summary>개발용 · LLM 해석 단계에 넘길 데이터</summary>
        <pre>{JSON.stringify(payload, null, 2)}</pre>
      </details>
    </div>
  );
}
