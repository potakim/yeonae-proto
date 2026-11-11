/**
 * 한국 시간 관행별로 원국이 얼마나 달라지는지 측정.
 * 서울 출생, 1975~2005년 무작위 출생 시각 50,000건 (KST 벽시계, 분 단위).
 *  A 진태양시   : 서울 경도 126.978° + 균시차 + 서머타임   ← 앱 기본값
 *  B 경도만     : 서울 경도, 균시차 없음 (약 32분)
 *  C 30분 보정  : 동경 127.5°, 균시차 없음 (자시 23:30~01:29, 국내 만세력에서 흔한 방식)
 *  D 정시       : 동경 135° (자시 23:00~00:59)
 * 실행: node verify/korea-conventions.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('manseryeok');

const MODES = {
  A: { longitude: 126.978, applyEquationOfTime: true, applyHistoricalDst: true },
  B: { longitude: 126.978, applyEquationOfTime: false, applyHistoricalDst: true },
  C: { longitude: 127.5, applyEquationOfTime: false, applyHistoricalDst: true },
  D: { longitude: 135, applyEquationOfTime: false, applyHistoricalDst: true },
};
let seed = 7;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
const N = 50000;
const pairs = ['A-C', 'A-D', 'C-D', 'A-B'];
const diff = Object.fromEntries(pairs.map((p) => [p, { hour: 0, day: 0, any: 0 }]));
for (let i = 0; i < N; i++) {
  const t = new Date(Date.UTC(1975, 0, 1) + Math.floor(rand() * (Date.UTC(2006, 0, 1) - Date.UTC(1975, 0, 1)) / 60000) * 60000);
  const b = { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate(), hour: t.getUTCHours(), minute: t.getUTCMinutes(), dayBoundary: 'midnight' };
  const r = Object.fromEntries(Object.entries(MODES).map(([k, o]) => [k, M.calculateFourPillars({ ...b, trueSolarTime: o })]));
  for (const p of pairs) {
    const [x, y] = p.split('-');
    const h = r[x].hourString !== r[y].hourString;
    const d = r[x].dayString !== r[y].dayString;
    if (h) diff[p].hour++;
    if (d) diff[p].day++;
    if (h || d || r[x].monthString !== r[y].monthString || r[x].yearString !== r[y].yearString) diff[p].any++;
  }
}
const pct = (n) => `${((n / N) * 100).toFixed(1)}%`;
console.log(`서울 출생 1975~2005 무작위 ${N.toLocaleString()}건 — 관행끼리 원국이 달라지는 비율`);
for (const p of pairs) console.log(`  ${p}: 시주 ${pct(diff[p].hour)} · 일주 ${pct(diff[p].day)} · 어느 기둥이든 ${pct(diff[p].any)}`);
