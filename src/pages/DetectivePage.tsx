import { Icon } from '../components/Icon';
import { useMemo, useState } from 'react';
import SaveAnalysisButton from '../components/SaveAnalysisButton';
import { parseKakaoExport, type ParsedChat } from '../lib/kakao/parse';
import { BANDS, DEFAULT_GAP_HOURS, DOW, FAST_REPLY_MIN, GAP_HOURS, MIN_REPLIES, SHORT_LEN, addDays, buildReport, fmtMin, reportSummary, type GapHours, type KakaoReport, type Pair } from '../lib/kakao/report';

/**
 * 탐정 — 카톡 내보내기 파일을 숫자로 집계해 보여 주는 리포트 (노션 「탐정 캐릭터」 2026-11-23).
 * 전부 이 기기 안에서 계산한다. 대화 내용은 서버로 보내지 않고, AI 해석도 없다.
 * 흐름: 대화 제공 → 분석 범위 확인 → 리포트(기본 · 상세 · 기간 비교).
 */
const PERIODS = [
  ['14d', '최근 2주', 14],
  ['28d', '최근 4주', 28],
  ['84d', '최근 12주', 84],
  ['all', '전체', 0],
  ['custom', '직접 선택', 0],
] as const;
type PeriodKey = (typeof PERIODS)[number][0];

const NA = '집계 어려움';
const num = (v: number | null, unit = '') => (v === null ? NA : `${v}${unit}`);
const md = (d: string) => d.replace(/^\d{4}-(\d{2})-(\d{2})$/, (_, m, dd) => `${+m}/${+dd}`);

export default function DetectivePage() {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedChat | null>(null);
  const [me, setMe] = useState('');
  const [them, setThem] = useState('');
  const [period, setPeriod] = useState<PeriodKey>('28d');
  const [range, setRange] = useState({ from: '', to: '' });
  const [gap, setGap] = useState<GapHours>(DEFAULT_GAP_HOURS);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = (text: string) => {
    setError(null);
    setShow(false);
    setRawText(text);
    const p = parseKakaoExport(text, { keepMedia: true });
    setParsed(p);
    // 누가 '나'인지는 파일만으로 알 수 없어 사용자가 고른다. 기본값은 두 번째로 많이 보낸 사람
    const mine = p.participants[1]?.name ?? p.participants[0]?.name ?? '';
    setMe(mine);
    setThem(p.participants.find((x) => x.name !== mine)?.name ?? '');
    if (text.trim() && p.participants.length === 0) setError('카톡 대화 내보내기 형식이 아닌 것 같아요. 카톡 대화방 › ≡ › 대화 내보내기(텍스트)로 받은 파일을 넣어 주세요.');
    if (p.lastDate) setRange({ from: p.firstDate ?? p.lastDate, to: p.lastDate });
  };
  const pickFile = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      load(await f.text());
    } catch {
      setError('파일을 읽지 못했어요.');
    }
  };
  const chooseMe = (name: string) => {
    setMe(name);
    if (them === name || !them) setThem(parsed?.participants.find((x) => x.name !== name)?.name ?? '');
    setShow(false);
  };

  const report = useMemo<KakaoReport | null>(() => {
    if (!parsed || !me || !them || me === them || !parsed.lastDate) return null;
    const days = PERIODS.find((p) => p[0] === period)![2];
    const span = period === 'custom' ? range : period === 'all' ? {} : { from: addDays(parsed.lastDate, -days + 1), to: parsed.lastDate };
    return buildReport(parsed.messages, { me, them, gapHours: gap, ...span });
  }, [parsed, me, them, period, range, gap]);

  const ready = parsed && parsed.participants.length >= 2;

  return (
    <div className="page detective">
      <h2 className="page-title">대화 기록 리포트</h2>
      <section className="card bubble">
        <span className="bubble-who">탐정</span>
        <p>
          카톡 대화 파일을 주면 누가 먼저 말을 걸었는지, 답장까지 얼마나 걸렸는지 같은 걸 숫자로 정리해 줄게. 나는 기록에 있는 것만 세. 그 사람 속마음이 어떤지는 숫자로 판정하지 않아.
        </p>
      </section>

      <section className="card form">
        <p className="hint">
          <Icon name="lock" />
          대화 내용은 이 기기 안에서만 계산하고 서버로 보내지 않아요. 카톡 대화방 › 오른쪽 위 ≡ › 대화 내보내기 › 텍스트만으로 받은 파일을 넣어 주세요.
        </p>
        <div className="field">
          <label>내보내기 파일 (.txt)</label>
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(e) => {
              void pickFile(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        <div className="field">
          <label>또는 붙여넣기</label>
          <textarea className="question" rows={4} placeholder={'2026년 11월 1일 오후 3:12, 지훈 : 뭐해?\n2026년 11월 1일 오후 3:15, 나 : 그냥 있어'} value={rawText} onChange={(e) => load(e.target.value)} />
        </div>
        {error && <p className="error">{error}</p>}
        {parsed && parsed.participants.length === 1 && <p className="error">한 사람의 메시지만 있어서 두 사람을 비교할 수 없어요.</p>}

        {ready && (
          <div className="parsed-box">
            <div className="field">
              <label>이 중에 나는?</label>
              <div className="chips">
                {parsed.participants.map((p) => (
                  <button key={p.name} className={`chip-btn${me === p.name ? ' on' : ''}`} onClick={() => chooseMe(p.name)}>
                    {p.name} ({p.count})
                  </button>
                ))}
              </div>
            </div>
            {parsed.participants.length > 2 && (
              <div className="field">
                <label>누구와의 대화를 볼까요? (두 사람만 비교해요)</label>
                <div className="chips">
                  {parsed.participants
                    .filter((p) => p.name !== me)
                    .map((p) => (
                      <button key={p.name} className={`chip-btn${them === p.name ? ' on' : ''}`} onClick={() => setThem(p.name)}>
                        {p.name} ({p.count})
                      </button>
                    ))}
                </div>
              </div>
            )}
            <div className="field">
              <label>분석 기간</label>
              <div className="chips">
                {PERIODS.map(([k, label]) => (
                  <button key={k} className={`chip-btn${period === k ? ' on' : ''}`} onClick={() => setPeriod(k)}>
                    {label}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="row">
                  <input type="date" value={range.from} min={parsed.firstDate ?? undefined} max={parsed.lastDate ?? undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} aria-label="시작일" />
                  <input type="date" value={range.to} min={parsed.firstDate ?? undefined} max={parsed.lastDate ?? undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} aria-label="종료일" />
                </div>
              )}
            </div>
            <div className="field">
              <label>새 대화로 보는 공백 (선톡 기준)</label>
              <div className="chips">
                {GAP_HOURS.map((h) => (
                  <button key={h} className={`chip-btn${gap === h ? ' on' : ''}`} onClick={() => setGap(h)}>
                    {h}시간
                  </button>
                ))}
              </div>
              <p className="hint">이 시간 넘게 대화가 없다가 처음 보낸 메시지를 선톡으로 세요. 하루의 첫 메시지와는 다를 수 있어요.</p>
            </div>
          </div>
        )}
      </section>

      {ready && !report && <p className="hint center">이 기간에는 분석할 수 있는 메시지가 없어요. 기간을 넓혀 보세요.</p>}

      {report && (
        <section className="card">
          <h3 className="card-title">분석 범위 확인</h3>
          <dl className="scope-list">
            <dt>참여자</dt>
            <dd>
              나 = {report.scope.me} · 상대 = {report.scope.them}
            </dd>
            <dt>기간</dt>
            <dd>
              {report.scope.from} ~ {report.scope.to} ({report.scope.days}일)
            </dd>
            <dt>분석할 메시지</dt>
            <dd>
              {report.scope.analyzed}개 (글 {report.scope.text}개, 사진·이모티콘 등 {report.scope.media}개)
            </dd>
            <dt>제외한 항목</dt>
            <dd>
              다른 참여자 {report.scope.excluded.others}개 · 삭제된 메시지 {report.scope.excluded.deleted}개 · 시각을 읽지 못한 메시지 {report.scope.excluded.noTime}개
            </dd>
            <dt>시각 기준</dt>
            <dd>내보낸 파일에 적힌 시각 그대로</dd>
          </dl>
          {!show && (
            <button className="btn-primary" onClick={() => setShow(true)}>
              이 범위로 리포트 보기
            </button>
          )}
        </section>
      )}

      {report && show && <Report r={report} />}
    </div>
  );
}

function Report({ r }: { r: KakaoReport }) {
  const b = r.basic;
  const d = r.detail;
  const total = b.messages.me + b.messages.them;
  return (
    <>
      <section className="card bubble">
        <span className="bubble-who">탐정의 한마디</span>
        {r.comments.map((c) => (
          <p key={c}>{c}</p>
        ))}
      </section>

      <section className="card">
        <h3 className="card-title">기본 리포트</h3>
        <PairTable
          rows={[
            ['보낸 메시지', `${b.messages.me}개 (${num(b.messageShare.me, '%')})`, `${b.messages.them}개 (${num(b.messageShare.them, '%')})`],
            ['선톡 (대화를 먼저 시작)', `${b.initiations.me}회`, `${b.initiations.them}회`],
            ['답장 시간 중앙값', `${fmtMin(b.reply.me.medianMin)} · 답장 ${b.reply.me.n}회`, `${fmtMin(b.reply.them.medianMin)} · 답장 ${b.reply.them.n}회`],
            ['물음표가 있는 메시지', `${b.questions.me}개`, `${b.questions.them}개`],
            ['글 메시지 평균 길이', num(b.avgLength.me, '자'), num(b.avgLength.them, '자')],
          ]}
        />
        <div className="share-bar" role="img" aria-label={`메시지 비율 나 ${b.messageShare.me}% 상대 ${b.messageShare.them}%`}>
          <span style={{ width: `${total ? (b.messages.me / total) * 100 : 50}%` }} />
        </div>
        <p className="stat-line">
          새로 시작된 대화 <strong>{b.conversations}개</strong> · 대화가 오간 날 <strong>{b.activeDays}일</strong> / {r.scope.days}일 · 서로 메시지를 보낸 날 <strong>{b.mutualDays}일</strong>
        </p>

        <h4 className="sub-title">답장 시간 분포</h4>
        <Buckets who="나" s={b.reply.me} gap={r.scope.gapHours} />
        <Buckets who="상대" s={b.reply.them} gap={r.scope.gapHours} />

        <details className="criteria">
          <summary>집계 기준 보기</summary>
          <ul>
            <li>
              선톡: {r.scope.gapHours}시간 이상 대화가 없다가 처음 보낸 메시지. 파일의 맨 첫 메시지도 새 대화의 시작으로 셌어요.
            </li>
            <li>답장 시간: 한 사람이 연달아 보낸 메시지 묶음이 끝난 시점부터 상대의 첫 메시지까지. 같은 대화 안에서만 재고, 공백을 넘긴 메시지는 답장이 아니라 새 대화로 봐요.</li>
            <li>중앙값과 비율은 답장이 {MIN_REPLIES}회 이상일 때만 계산해요. 부족하면 “{NA}”으로 표시해요.</li>
            <li>질문: 물음표가 들어간 글 메시지 수예요. 물음표 없는 질문은 빠지고, 물음표가 있어도 실제 질문이 아닐 수 있어요.</li>
            <li>평균 길이: 글 메시지의 글자 수(공백 포함). 사진·이모티콘 등은 메시지 수에는 포함하고 길이 계산에서는 빼요.</li>
            <li>같은 날 서로 보냈다는 것은 그 메시지가 서로의 답장이라는 뜻은 아니에요.</li>
            <li>파일에서 빠진 대화나 삭제된 메시지, 기간의 앞뒤 경계는 결과에 영향을 줄 수 있어요.</li>
          </ul>
        </details>
      </section>

      <section className="card">
        <details className="detail-block">
          <summary>
            <h3 className="card-title">상세 리포트</h3>
          </summary>

          <h4 className="sub-title">대화의 시작과 이어짐</h4>
          <p className="stat-line">
            대화별 메시지 수 중앙값 <strong>{num(d.convMessagesMedian, '개')}</strong> · 발신자가 바뀐 횟수 중앙값 <strong>{num(d.turnsMedian, '회')}</strong>
          </p>
          <p className="stat-line">
            대화 지속 시간 중앙값 <strong>{fmtMin(d.convDurationMedianMin)}</strong> (끝난 것이 확인된 대화 {d.closedConvs}개 중 메시지 한 개뿐인 대화 {d.singleMessageConvs}개는 따로 셈)
          </p>
          <PairTable
            rows={[
              ['대화의 마지막 메시지', `${d.lastMessage.me}회`, `${d.lastMessage.them}회`],
              ...BANDS.map((name, i) => [`${name}에 시작`, `${d.startByBand[i].me}회`, `${d.startByBand[i].them}회`] as [string, string, string]),
            ]}
          />
          <p className="hint">마지막 메시지를 보냈다는 것이 상대가 무시했다는 뜻은 아니에요. 파일 끝에 걸린 대화는 끝났는지 알 수 없어 뺐어요.</p>

          <h4 className="sub-title">답장 속도</h4>
          <PairTable
            rows={[
              [`${FAST_REPLY_MIN}분 안에 온 답장`, num(b.reply.me.fastPct, '%'), num(b.reply.them.fastPct, '%')],
              ['답장 시간 25% ~ 75% 구간', b.reply.me.p25Min === null ? NA : `${fmtMin(b.reply.me.p25Min)} ~ ${fmtMin(b.reply.me.p75Min)}`, b.reply.them.p25Min === null ? NA : `${fmtMin(b.reply.them.p25Min)} ~ ${fmtMin(b.reply.them.p75Min)}`],
              ...BANDS.map((name, i) => [`${name} 메시지에 대한 답장`, `${fmtMin(d.replyByBand[i].me.medianMin)} (${d.replyByBand[i].me.n}회)`, `${fmtMin(d.replyByBand[i].them.medianMin)} (${d.replyByBand[i].them.n}회)`] as [string, string, string]),
            ]}
          />
          <p className="hint">시간대는 상대의 메시지 묶음이 끝난 시각 기준이에요. 괄호 안은 그 구간의 답장 수이고, {MIN_REPLIES}회 미만이면 비교를 보류해요.</p>

          <h4 className="sub-title">메시지와 표현</h4>
          <PairTable
            rows={[
              ['한 번에 연달아 보낸 메시지 수(중앙값)', `${num(d.burstMedian.me, '개')} · 묶음 ${d.bursts.me}개`, `${num(d.burstMedian.them, '개')} · 묶음 ${d.bursts.them}개`],
              [`${SHORT_LEN}자 이하 메시지 비율`, num(d.shortPct.me, '%'), num(d.shortPct.them, '%')],
              ['물음표 메시지 비율', num(d.questionPct.me, '%'), num(d.questionPct.them, '%')],
              ['느낌표·ㅋㅋ·ㅎㅎ가 있는 메시지', `${d.laughs.me}개 (${num(d.laughPct.me, '%')})`, `${d.laughs.them}개 (${num(d.laughPct.them, '%')})`],
              ['사진', `${d.media.me.photo}개`, `${d.media.them.photo}개`],
              ['이모티콘', `${d.media.me.emoticon}개`, `${d.media.them.emoticon}개`],
            ]}
          />
          <p className="hint">비율의 분모는 각자의 글 메시지 수예요. 느낌표나 웃음 표현의 수로 감정이나 친밀도를 판정하지 않아요. 사진·이모티콘은 파일에 종류가 적혀 있는 것만 셌어요.</p>

          <h4 className="sub-title">요일·시간대별 메시지 수</h4>
          <Grid grid={d.grid} />

          <h4 className="sub-title">기간 안에서</h4>
          <p className="stat-line">
            가장 활발한 날{' '}
            <strong>
              {d.busiestDays.map((x) => `${md(x.date)} (나 ${x.me} · 상대 ${x.them})`).join(', ')}
            </strong>
          </p>
          <p className="stat-line">
            메시지가 없던 날 <strong>{d.emptyDays}일</strong>
            {d.longestSilence && (
              <>
                {' '}
                · 가장 긴 공백 <strong>{d.longestSilence.hours}시간</strong> ({md(d.longestSilence.from)} → {md(d.longestSilence.to)})
              </>
            )}
          </p>
          <p className="hint">연락이 없었다는 것은 이 파일 안에서만 그렇다는 뜻이에요. 기간 앞뒤의 기록은 알 수 없어요.</p>
        </details>
      </section>

      <section className="card">
        <h3 className="card-title">기간별 변화</h3>
        <div className="week-scroll">
          <table className="stat-table week-table">
            <thead>
              <tr>
                <th>주</th>
                <th>메시지</th>
                <th>선톡</th>
                <th>답장 중앙값</th>
              </tr>
            </thead>
            <tbody>
              {r.weekly.map((w) => (
                <tr key={w.start}>
                  <td>
                    {md(w.start)}~{md(w.end)}
                    {w.partial && <em className="partial"> 일부</em>}
                  </td>
                  <td>
                    {w.messages.me} · {w.messages.them}
                  </td>
                  <td>
                    {w.initiations.me} · {w.initiations.them}
                  </td>
                  <td>
                    {fmtMin(w.replyMedianMin.me)} · {fmtMin(w.replyMedianMin.them)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">각 칸은 “나 · 상대” 순서예요. 주는 월요일부터 일요일까지예요. “일부”는 분석 기간에 일부만 걸친 주예요. 답장이 {MIN_REPLIES}회 미만인 주는 중앙값을 내지 않아요.</p>

        <h4 className="sub-title">직전 같은 길이 기간과 비교</h4>
        {r.previous ? (
          <>
            <PairTable
              head={[`${md(r.previous.from)}~${md(r.previous.to)}`, `${md(r.scope.from)}~${md(r.scope.to)}`]}
              rows={[
                ['내 메시지', `${r.previous.messages.me}개`, `${b.messages.me}개 (${diff(b.messages.me - r.previous.messages.me)})`],
                ['상대 메시지', `${r.previous.messages.them}개`, `${b.messages.them}개 (${diff(b.messages.them - r.previous.messages.them)})`],
                ['내 선톡', `${r.previous.initiations.me}회`, `${b.initiations.me}회 (${diff(b.initiations.me - r.previous.initiations.me)})`],
                ['상대 선톡', `${r.previous.initiations.them}회`, `${b.initiations.them}회 (${diff(b.initiations.them - r.previous.initiations.them)})`],
                ['내 답장 중앙값', `${fmtMin(r.previous.replyMedianMin.me)} (${r.previous.replies.me}회)`, `${fmtMin(b.reply.me.medianMin)} (${b.reply.me.n}회)`],
                ['상대 답장 중앙값', `${fmtMin(r.previous.replyMedianMin.them)} (${r.previous.replies.them}회)`, `${fmtMin(b.reply.them.medianMin)} (${b.reply.them.n}회)`],
              ]}
            />
            <p className="hint">괄호 안은 실제 건수 차이예요. 증가율 대신 건수로 보여 줘요.</p>
          </>
        ) : (
          <p className="hint">파일에 직전 {r.scope.days}일의 기록이 온전히 없어서 비교하지 않았어요.</p>
        )}
      </section>

      <SaveAnalysisButton type="kakao" sourceCharacter="detective" title="대화 기록 리포트" summary={reportSummary(r)} data={{ scope: r.scope, basic: r.basic, version: r.version }} />
      <p className="foot-note">이 리포트는 제공한 파일 안의 기록을 센 결과예요. 답장이 빠르거나 선톡이 많은 것을 호감이나 애정의 크기로 단정하지 않아요.</p>
    </>
  );
}

const diff = (n: number) => (n === 0 ? '변화 없음' : n > 0 ? `+${n}` : `${n}`);

function PairTable({ rows, head = ['나', '상대'] }: { rows: [string, string, string][]; head?: [string, string] }) {
  return (
    <table className="stat-table pair-table">
      <thead>
        <tr>
          <th />
          <th>{head[0]}</th>
          <th>{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, a, b]) => (
          <tr key={label}>
            <td>{label}</td>
            <td>{a}</td>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Buckets({ who, s, gap }: { who: string; s: KakaoReport['basic']['reply'][keyof Pair<unknown>]; gap: number }) {
  const labels = ['5분 이내', '5분~1시간', `1시간~${gap}시간`];
  return (
    <div className="bucket-row">
      <span className="bucket-who">{who}</span>
      {s.n === 0 ? (
        <span className="hint">답장 기록 없음</span>
      ) : (
        <span className="bucket-bar" role="img" aria-label={`${who} 답장 ${labels.map((l, i) => `${l} ${s.buckets[i]}회`).join(', ')}`}>
          {s.buckets.map((n, i) => (n > 0 ? <i key={i} className={`b${i}`} style={{ flexGrow: n }} title={`${labels[i]} ${n}회`} /> : null))}
        </span>
      )}
      <span className="bucket-nums">{s.n > 0 && labels.map((l, i) => `${l} ${s.buckets[i]}`).join(' · ')}</span>
    </div>
  );
}

function Grid({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  // 월요일부터 보여 준다
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <table className="heat">
      <thead>
        <tr>
          <th />
          {BANDS.map((b) => (
            <th key={b}>{b.replace(/\(.*\)/, '')}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {order.map((dow) => (
          <tr key={dow}>
            <th>{DOW[dow]}</th>
            {grid[dow].map((n, i) => (
              <td key={i} style={{ ['--v' as string]: n / max }}>
                {n}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
