/**
 * manseryeok 독립 검증 스크립트
 *
 * 라이브러리 결과를 "라이브러리와 출처가 다른" 기준과 항목별로 대조한다.
 *   - 절입 시각 : NASA JPL DE421 + Skyfield (verify/ref_solar_terms.py 로 생성), astronomy-engine(VSOP87)
 *   - 음양력    : korean-lunar-calendar (KASI 데이터 기반 별도 구현)
 *   - 일주      : 율리우스일(JDN) 산술 — 2000-01-01 = 戊午 로 독립 검산
 *   - 연·월주   : DE421 절입 + 오호둔 표를 직접 구현
 *   - 시주      : 오자둔 표 직접 구현, 자시 관법 3종
 *   - 표준시·서머타임 : Node 내장 IANA tz (Asia/Seoul)
 *   - 균시차    : astronomy-engine 태양 시각(hour angle)
 *   - 십신·공망 : 표 직접 구현, 전 조합
 *   - 대운      : DE421 절입으로 방향·대운수 재계산
 *
 * 실행: python3 verify/ref_solar_terms.py && node verify/verify.mjs
 * 결과: verify/data/report.json (+ 콘솔 요약)
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

const M = require('manseryeok');
const { koreaCivilOffsetMin } = require(path.join(here, '../node_modules/manseryeok/dist/time/korea-timezone.js'));
const KLC = require('korean-lunar-calendar');
const A = require('astronomy-engine');

const REF = JSON.parse(fs.readFileSync(path.join(here, 'data/ref_solar_terms_de421.json'), 'utf8'));
const MIN = 60_000;
const DAY = 86_400_000;
const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
const ganji = (i) => STEMS[((i % 10) + 10) % 10] + BRANCHES[((i % 12) + 12) % 12];
const kst = (ms) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
const report = {};
const log = (...a) => console.log(...a);

function summarize(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, min: s[0], p50: q(0.5), p99: q(0.99), max: s[s.length - 1] };
}

// ─────────────────────────────────────────────────────────────
// 1. 절입 시각
// ─────────────────────────────────────────────────────────────
{
  log('\n[1] 절입 시각 (1900~2050, 24절기 × 151년)');
  const diffsSec = [];
  const aeVsRef = [];
  const over = [];
  for (let y = 1900; y <= 2050; y++) {
    for (let i = 0; i < 24; i++) {
      const ref = REF[`${y}-${i}`];
      const lib = M.getSolarTerm(y, i).date.getTime();
      const d = (lib - ref) / 1000;
      diffsSec.push(d);
      if (Math.abs(d) > 60) over.push({ year: y, term: M.SOLAR_TERM_NAMES[i], libKST: kst(lib), refKST: kst(ref), diffSec: Math.round(d) });
      // astronomy-engine 으로 DE421 기준 자체를 교차확인
      const lon = (285 + 15 * i) % 360;
      const ae = A.SearchSunLongitude(lon, A.MakeTime(new Date(ref - 5 * DAY)), 10);
      aeVsRef.push((ae.date.getTime() - ref) / 1000);
    }
  }
  const absSorted = diffsSec.map(Math.abs);
  report.solarTerms = {
    range: '1900-2050',
    count: diffsSec.length,
    libMinusRefSec: summarize(diffsSec),
    absOver60s: over.length,
    absOver120s: absSorted.filter((x) => x > 120).length,
    worst: over.sort((a, b) => Math.abs(b.diffSec) - Math.abs(a.diffSec)).slice(0, 15),
    astronomyEngineMinusDE421Sec: summarize(aeVsRef),
  };
  log('  lib - DE421 (초):', report.solarTerms.libMinusRefSec);
  log('  |차이| > 60초:', over.length, ' > 120초:', report.solarTerms.absOver120s);
  log('  기준 신뢰도 (astronomy-engine - DE421, 초):', report.solarTerms.astronomyEngineMinusDE421Sec);

  // 1-b. 한국천문연구원(KASI) 공식 발표값(분 단위)과 직접 대조
  const K = JSON.parse(fs.readFileSync(path.join(here, 'data/kasi_official.json'), 'utf8'));
  const toMs = (y, s) => {
    const [md, hm] = s.split(' ');
    const [mo, d] = md.split('-').map(Number);
    const [h, mi] = hm.split(':').map(Number);
    return Date.UTC(y, mo - 1, d, h, mi) - 9 * 3600e3;
  };
  const rows = [];
  for (const y of [2025, 2028]) K[y].forEach((s, i) => rows.push([y, i, s]));
  for (const [i, s] of Object.entries(K['2026_partial'])) rows.push([2026, +i, s]);
  let libEq = 0, de421RoundEq = 0;
  const kasiBad = [];
  for (const [y, i, s] of rows) {
    const k = toMs(y, s);
    const lib = M.getSolarTerm(y, i).date.getTime();
    if (lib === k) libEq++;
    else kasiBad.push({ year: y, term: M.SOLAR_TERM_NAMES[i], isJeol: i % 2 === 0, kasi: s, lib: kst(lib).slice(5, 16) });
    if (Math.round(REF[`${y}-${i}`] / MIN) * MIN === k) de421RoundEq++;
  }
  // 1-c. KASI 는 '반올림 분'으로 발표 → DE421 반올림 분을 KASI 대용으로 삼아 전 구간 비교
  let jeolDiff = 0, qiDiff = 0;
  const jeolDiffList = [];
  for (let y = 1900; y <= 2050; y++) for (let i = 0; i < 24; i++) {
    const lib = M.getSolarTerm(y, i).date.getTime();
    const ref = Math.round(REF[`${y}-${i}`] / MIN) * MIN;
    if (lib !== ref) {
      if (i % 2 === 0) { jeolDiff++; jeolDiffList.push({ year: y, term: M.SOLAR_TERM_NAMES[i], libMinusRefMin: (lib - ref) / MIN }); }
      else qiDiff++;
    }
  }
  report.solarTermsKasi = {
    kasiOfficialCount: rows.length,
    libMatchesKasi: libEq,
    de421RoundedMatchesKasi: de421RoundEq,
    libVsKasiMismatches: kasiBad,
    minuteLevelVsDE421Rounded: { jeol: { total: 151 * 12, differ: jeolDiff }, junggi: { total: 151 * 12, differ: qiDiff }, jeolSamples: jeolDiffList.slice(0, 30), jeolByDecade: jeolDiffList.reduce((a, r) => ((a[`${Math.floor(r.year / 10) * 10}s`] = (a[`${Math.floor(r.year / 10) * 10}s`] ?? 0) + 1), a), {}) },
  };
  log(`  KASI 공식값 ${rows.length}개 대조: 라이브러리 일치 ${libEq}, DE421(반올림) 일치 ${de421RoundEq}`);
  for (const b of kasiBad) log(`    차이: ${b.year} ${b.term}(${b.isJeol ? '절' : '중기'}) KASI ${b.kasi} / lib ${b.lib}`);
  log(`  분 단위(DE421 반올림=KASI 방식) 불일치: 절 ${jeolDiff}/${151 * 12}, 중기 ${qiDiff}/${151 * 12}`);
  log('    절 불일치 연대별:', JSON.stringify(report.solarTermsKasi.minuteLevelVsDE421Rounded.jeolByDecade));
}

// ─────────────────────────────────────────────────────────────
// 2. 음양력 변환 (양→음, 음→양)
// ─────────────────────────────────────────────────────────────
{
  log('\n[2] 음양력 변환 (양력 1900-01-31 ~ 2050-12-31 전 일자)');
  const klc = new KLC();
  let n = 0;
  const bad = [];
  for (let t = Date.UTC(1900, 0, 31); t <= Date.UTC(2050, 11, 31); t += DAY) {
    const d = new Date(t);
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
    n++;
    klc.setSolarDate(y, m, dd);
    const r = klc.getLunarCalendar();
    const l = M.solarToLunar(y, m, dd);
    const libLeap = !!(l.isLeapMonth ?? l.isLeap ?? l.leap);
    const fmtL = (o) => `${o.year}-${o.month}-${o.day}${o.leap ? '(윤)' : ''}`;
    if (l.year !== r.year || l.month !== r.month || l.day !== r.day || libLeap !== r.intercalation) {
      bad.push({ solar: `${y}-${m}-${dd}`, lib: fmtL({ ...l, leap: libLeap }), ref: fmtL({ ...r, leap: r.intercalation }) });
    }
    // 역변환 (기준 음력 날짜를 라이브러리가 받아들이는지 포함)
    try {
      const back = M.lunarToSolar(r.year, r.month, r.day, r.intercalation);
      if (back.year !== y || back.month !== m || back.day !== dd) bad.push({ lunar: fmtL({ ...r, leap: r.intercalation }), libBack: `${back.year}-${back.month}-${back.day}`, expected: `${y}-${m}-${dd}` });
    } catch (e) {
      bad.push({ lunar: fmtL({ ...r, leap: r.intercalation }), expected: `${y}-${m}-${dd}`, libError: e.message });
    }
  }
  const byYear = {};
  for (const b of bad) {
    const yr = (b.solar ?? b.expected).slice(0, 4);
    byYear[yr] = (byYear[yr] ?? 0) + 1;
  }
  // 2-b. 중국 음력(lunar-javascript)과 다른 날 — 한국 기준을 제대로 따르는지 확인용
  const { Solar } = require('lunar-javascript');
  let cnDiff = 0;
  const cnYears = new Set();
  for (let t = Date.UTC(1900, 0, 31); t <= Date.UTC(2049, 11, 31); t += DAY) {
    const d = new Date(t);
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
    const c = Solar.fromYmd(y, m, dd).getLunar();
    const l = M.solarToLunar(y, m, dd);
    if (c.getYear() !== l.year || Math.abs(c.getMonth()) !== l.month || c.getDay() !== l.day || (c.getMonth() < 0) !== l.isLeapMonth) {
      cnDiff++;
      cnYears.add(y);
    }
  }
  report.lunar = { days: n, mismatches: bad.length, mismatchesByYear: byYear, samples: bad.slice(0, 12), differsFromChineseCalendar1900to2049: { days: cnDiff, years: cnYears.size } };
  log('  비교 일수:', n, ' 불일치:', bad.length, ' 연도별:', JSON.stringify(byYear));
  log(`  참고: 같은 기간 중국 음력과 다른 날 ${cnDiff}일(${cnYears.size}개 연도) → 이 날들도 한국(KASI) 기준과 일치`);
}

// ─────────────────────────────────────────────────────────────
// 3. 일주 — JDN 산술 (1800~2300)
// ─────────────────────────────────────────────────────────────
{
  log('\n[3] 일주 (1800-01-01 ~ 2300-12-31 전 일자, JDN 산술)');
  let n = 0;
  const bad = [];
  for (let t = Date.UTC(1800, 0, 1); t <= Date.UTC(2300, 11, 31); t += DAY) {
    const d = new Date(t);
    const jdn = Math.round(t / DAY) + 2440588; // 1970-01-01 = JDN 2440588
    const expected = ganji(jdn + 49); // 2000-01-01(JDN 2451545) → 54 = 무오
    const r = M.calculateFourPillars({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: 12, minute: 0 });
    n++;
    if (r.dayString !== expected) bad.push({ date: d.toISOString().slice(0, 10), lib: r.dayString, expected });
  }
  report.dayPillar = { days: n, mismatches: bad.length, samples: bad.slice(0, 10), anchorCheck: ganji(2451545 + 49) };
  log('  비교 일수:', n, ' 불일치:', bad.length, ' (검산 앵커 2000-01-01 =', ganji(2451545 + 49) + ')');
}

// ─────────────────────────────────────────────────────────────
// 4. 연주·월주 — DE421 절입 + 오호둔 독립 구현
// ─────────────────────────────────────────────────────────────
const JEOL = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0]; // 인월~축월을 여는 절
function refYearMonth(instant) {
  // 직전 절(節) 찾기
  const y = new Date(instant).getUTCFullYear();
  let best = -Infinity, bestIdx = -1, bestYear = 0;
  for (const yy of [y - 1, y, y + 1]) for (const idx of JEOL) {
    const t = REF[`${yy}-${idx}`];
    if (t !== undefined && t <= instant && t > best) { best = t; bestIdx = idx; bestYear = yy; }
  }
  const monthNo = JEOL.indexOf(bestIdx) + 1; // 1=인월 … 12=축월
  const lichun = REF[`${y}-2`];
  const sajuYear = instant < lichun ? y - 1 : y;
  const yearStem = (((sajuYear - 4) % 10) + 10) % 10;
  // 오호둔: 갑기년 병인월, 을경년 무인월, 병신년 경인월, 정임년 임인월, 무계년 갑인월
  const firstStem = { 0: 2, 1: 4, 2: 6, 3: 8, 4: 0 }[yearStem % 5];
  const monthStem = (firstStem + monthNo - 1) % 10;
  const monthBranch = (monthNo + 1) % 12; // 인=2
  return {
    year: STEMS[yearStem] + BRANCHES[(((sajuYear - 4) % 12) + 12) % 12],
    month: STEMS[monthStem] + BRANCHES[monthBranch],
  };
}
{
  log('\n[4] 연주·월주 (1900~2050: 매일 정오 + 모든 절입 전후 ±1·±2·±5분)');
  let n = 0;
  const bad = [];
  const byOffset = {};
  const check = (instant, tag, bucket) => {
    const w = new Date(instant + 9 * 3600e3); // KST 벽시계
    const r = M.calculateFourPillars({ year: w.getUTCFullYear(), month: w.getUTCMonth() + 1, day: w.getUTCDate(), hour: w.getUTCHours(), minute: w.getUTCMinutes() });
    const e = refYearMonth(instant);
    n++;
    byOffset[bucket] ??= { checks: 0, mismatches: 0 };
    byOffset[bucket].checks++;
    if (r.yearString !== e.year || r.monthString !== e.month) {
      byOffset[bucket].mismatches++;
      bad.push({ tag, kst: kst(instant), lib: `${r.yearString} ${r.monthString}`, ref: `${e.year} ${e.month}` });
    }
  };
  // 기준표가 1900년부터라 1900년 1월(직전 대설이 1899년)은 제외
  for (let t = Date.UTC(1900, 1, 10, 3); t < Date.UTC(2050, 11, 1); t += DAY) check(t, 'noon', '매일 정오');
  for (let y = 1900; y <= 2050; y++) for (const idx of JEOL) {
    if (y === 1900 && idx === 0) continue;
    const t = REF[`${y}-${idx}`];
    // 입력은 분 단위만 가능 → 기준 절입이 속한 '분'의 시작/끝에서 ±N분
    const floor = Math.floor(t / MIN) * MIN;
    for (const off of [-5, -2, -1]) check(floor + off * MIN, `${y} ${M.SOLAR_TERM_NAMES[idx]} ${off}분`, `절입 ${-off}분 전`);
    for (const off of [1, 2, 5]) check(floor + off * MIN, `${y} ${M.SOLAR_TERM_NAMES[idx]} +${off}분`, `절입 ${off}분 후`);
  }
  report.yearMonthPillar = { checks: n, mismatches: bad.length, byOffset, samples: bad.slice(0, 20) };
  log('  비교 수:', n, ' 불일치:', bad.length);
  for (const [k, v] of Object.entries(byOffset)) log(`    ${k}: ${v.mismatches}/${v.checks}`);
}

// ─────────────────────────────────────────────────────────────
// 5. 시주 + 자시 관법 (보정 없음 = 벽시계 기준)
// ─────────────────────────────────────────────────────────────
{
  log('\n[5] 시주·자시 관법 (60일주 × 하루 1440분 전체 × 관법 3종)');
  let n = 0;
  const bad = [];
  // 오자둔: 갑기일 갑자시, 을경일 병자시, 병신일 무자시, 정임일 경자시, 무계일 임자시
  const ziStem = (dayStem) => [0, 2, 4, 6, 8][dayStem % 5];
  const startDay = Date.UTC(2000, 0, 1); // 戊午
  for (let k = 0; k < 60; k++) {
    const t = startDay + k * DAY;
    const d = new Date(t);
    const jdn = Math.round(t / DAY) + 2440588;
    const dayIdx = (jdn + 49) % 60;
    for (let minuteOfDay = 0; minuteOfDay < 1440; minuteOfDay++) {
      const h = Math.floor(minuteOfDay / 60), mi = minuteOfDay % 60;
      const shichen = Math.floor(((minuteOfDay + 60) % 1440) / 120);
      const late = h === 23;
      for (const mode of ['midnight', 'jasi', 'splitJasi']) {
        // 기대값: 일주 / 시주 천간 기준일
        const dayG = mode === 'jasi' && late ? dayIdx + 1 : dayIdx;
        const stemBase = (mode === 'jasi' || mode === 'splitJasi') && late ? dayIdx + 1 : dayIdx;
        const hourG = STEMS[(ziStem(stemBase % 10) + shichen) % 10] + BRANCHES[shichen];
        const r = M.calculateFourPillars({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: h, minute: mi, dayBoundary: mode });
        n++;
        if (r.dayString !== ganji(dayG) || r.hourString !== hourG) bad.push({ date: d.toISOString().slice(0, 10), time: `${h}:${mi}`, mode, lib: `${r.dayString} ${r.hourString}`, ref: `${ganji(dayG)} ${hourG}` });
      }
    }
  }
  report.hourPillar = { checks: n, mismatches: bad.length, samples: bad.slice(0, 20) };
  log('  비교 수:', n, ' 불일치:', bad.length);
}

// ─────────────────────────────────────────────────────────────
// 6. 표준시·서머타임 이력 vs IANA tz (Asia/Seoul)
// ─────────────────────────────────────────────────────────────
{
  log('\n[6] 한국 표준시·서머타임 이력 (1900~2000 매시각, IANA tz 대조)');
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  const wall = (ms) => {
    const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
  };
  let n = 0;
  const badHours = [];
  for (let t = Date.UTC(1900, 0, 1); t < Date.UTC(2000, 0, 1); t += 3600e3) {
    const w = wall(t);
    const ianaOffset = Math.round((Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - t) / MIN);
    const lib = koreaCivilOffsetMin(w.y, w.mo, w.d, w.h);
    n++;
    if (lib !== ianaOffset) badHours.push({ utc: new Date(t).toISOString().slice(0, 16), wall: `${w.y}-${w.mo}-${w.d} ${w.h}:${String(w.mi).padStart(2, '0')}`, lib, iana: ianaOffset });
  }
  // 연속 구간으로 묶기
  const ranges = [];
  for (const b of badHours) {
    const last = ranges[ranges.length - 1];
    const t = Date.parse(b.utc + 'Z');
    if (last && t - last.endMs === 3600e3 && last.lib === b.lib && last.iana === b.iana) { last.endMs = t; last.endWall = b.wall; last.hours++; }
    else ranges.push({ startWall: b.wall, endWall: b.wall, endMs: t, lib: b.lib, iana: b.iana, hours: 1 });
  }
  report.timezone = { hours: n, mismatchHours: badHours.length, ranges: ranges.map(({ endMs, ...r }) => r) };
  log('  비교 시각 수:', n, ' 불일치 시간:', badHours.length, ' 구간:', ranges.length);
  for (const r of ranges) log('   ', r.startWall, '~', r.endWall, `lib +${r.lib / 60}h vs IANA +${r.iana / 60}h (${r.hours}시간)`);
}

// ─────────────────────────────────────────────────────────────
// 7. 균시차 (Equation of Time) vs astronomy-engine
// ─────────────────────────────────────────────────────────────
{
  log('\n[7] 균시차 (1900~2050, 5일 간격 × 하루 4회)');
  const diffs = [];
  const greenwich = new A.Observer(0, 0, 0);
  for (let t = Date.UTC(1900, 0, 1); t < Date.UTC(2051, 0, 1); t += 5 * DAY + 6 * 3600e3) {
    const at = A.MakeTime(new Date(t));
    const ha = A.HourAngle('Sun', at, greenwich); // 시간 단위
    const apparentSolar = ((ha + 12) % 24 + 24) % 24;
    const ut = (new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60);
    let eot = (apparentSolar - ut) * 60;
    if (eot > 720) eot -= 1440;
    if (eot < -720) eot += 1440;
    diffs.push((M.equationOfTimeMinutes(t) - eot) * 60); // 초
  }
  report.equationOfTime = { libMinusRefSec: summarize(diffs) };
  log('  lib - 기준 (초):', report.equationOfTime.libMinusRefSec);
}

// ─────────────────────────────────────────────────────────────
// 8. 십신·공망 전 조합
// ─────────────────────────────────────────────────────────────
{
  log('\n[8] 십신(10×10, 10×12) · 공망(60일주)');
  const el = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]; // 목화토금수
  const brMain = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8]; // 지지 본기(정기) 천간: 자=계 축=기 인=갑 묘=을 진=무 사=병 오=정 미=기 신=경 유=신 술=무 해=임
  const NAMES = [['비견', '겁재'], ['식신', '상관'], ['편재', '정재'], ['편관', '정관'], ['편인', '정인']];
  const tg = (me, other) => {
    const rel = (el[other] - el[me] + 5) % 5; // 0 같음 1 내가 생 2 내가 극 3 나를 극 4 나를 생
    const same = me % 2 === other % 2;
    return NAMES[rel][same ? 0 : 1];
  };
  let n = 0;
  const bad = [];
  for (let me = 0; me < 10; me++) {
    for (let o = 0; o < 10; o++) {
      n++;
      const lib = M.getTenGod(STEMS[me], STEMS[o]);
      if (lib !== tg(me, o)) bad.push({ me: STEMS[me], other: STEMS[o], lib, ref: tg(me, o) });
    }
    for (let b = 0; b < 12; b++) {
      n++;
      const lib = M.getBranchTenGod(STEMS[me], BRANCHES[b]);
      const ref = tg(me, brMain[b]);
      if (lib !== ref) bad.push({ me: STEMS[me], branch: BRANCHES[b], lib, ref });
    }
  }
  // 공망: 일주가 속한 순(旬)의 빠진 두 지지
  const voidBad = [];
  for (let g = 0; g < 60; g++) {
    const xunStart = g - (g % 10);
    const firstBranch = xunStart % 12;
    const ref = [BRANCHES[(firstBranch + 10) % 12], BRANCHES[(firstBranch + 11) % 12]];
    const lib = M.getVoidBranches(STEMS[g % 10], BRANCHES[g % 12]);
    n++;
    if (lib.join() !== ref.join()) voidBad.push({ day: ganji(g), lib, ref });
  }
  report.tenGodsVoid = { checks: n, tenGodMismatches: bad.length, voidMismatches: voidBad.length, samples: [...bad, ...voidBad].slice(0, 10) };
  log('  비교 수:', n, ' 십신 불일치:', bad.length, ' 공망 불일치:', voidBad.length);
}

// ─────────────────────────────────────────────────────────────
// 9. 대운 방향·대운수 (DE421 절입으로 재계산)
// ─────────────────────────────────────────────────────────────
{
  log('\n[9] 대운 (1900~2050 무작위 출생 20,000건)');
  // mulberry32 — 재현 가능한 의사난수
  let seed = 20261111;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  let n = 0;
  const bad = [];
  const allJeol = [];
  for (let y = 1899; y <= 2050; y++) for (const idx of JEOL) if (REF[`${y}-${idx}`]) allJeol.push(REF[`${y}-${idx}`]);
  allJeol.sort((a, b) => a - b);
  for (let k = 0; k < 20000; k++) {
    const instant = Math.floor((Date.UTC(1900, 1, 10) + rand() * (Date.UTC(2050, 10, 1) - Date.UTC(1900, 1, 10))) / MIN) * MIN;
    const gender = rand() < 0.5 ? 'male' : 'female';
    const w = new Date(instant + 9 * 3600e3);
    const r = M.calculateFourPillars({ year: w.getUTCFullYear(), month: w.getUTCMonth() + 1, day: w.getUTCDate(), hour: w.getUTCHours(), minute: w.getUTCMinutes(), gender });
    const ym = refYearMonth(instant);
    const yangYear = STEMS.indexOf(ym.year[0]) % 2 === 0;
    const forward = (yangYear && gender === 'male') || (!yangYear && gender === 'female');
    const days = forward
      ? (allJeol.find((t) => t > instant) - instant) / DAY
      : (instant - [...allJeol].reverse().find((t) => t <= instant)) / DAY;
    const startAge = Math.max(1, Math.round(days / 3));
    const lp = r.luckPillars;
    n++;
    if (lp.forward !== forward || lp.startAge !== startAge) {
      bad.push({ kst: kst(instant), gender, lib: { forward: lp.forward, startAge: lp.startAge }, ref: { forward, startAge, days: +days.toFixed(4) } });
    }
  }
  report.luckPillars = { checks: n, mismatches: bad.length, samples: bad.slice(0, 15) };
  log('  비교 수:', n, ' 불일치:', bad.length);
}

fs.writeFileSync(path.join(here, 'data/report.json'), JSON.stringify(report, null, 2));
log('\n→ verify/data/report.json 저장');
