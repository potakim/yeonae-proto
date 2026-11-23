import { PLACE_UNKNOWN, SIDO, type BirthPlace } from '../data/regions';

/**
 * 태어난 곳: 시·도 → 시·군·구 순서로 고른다 (5차 리뷰 2026-11-19). 경도 숫자는 보여 주지 않는다.
 * 모르면 '모름' → 한반도 평균 경도(127.5°).
 */
export default function BirthPlaceSelect({ value, onChange, hint = true }: { value: BirthPlace; onChange: (p: BirthPlace) => void; hint?: boolean }) {
  const sido = SIDO.find((s) => s.name === value.sido);
  return (
    <div className="field">
      <label>태어난 곳</label>
      <div className="place-row">
        <select value={value.sido} onChange={(e) => onChange({ sido: e.target.value, district: '' })} aria-label="시·도">
          {SIDO.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
          <option value={PLACE_UNKNOWN}>모름</option>
        </select>
        <select value={value.district} onChange={(e) => onChange({ sido: value.sido, district: e.target.value })} disabled={!sido} aria-label="시·군·구">
          <option value="">{sido ? '시·군·구 선택' : '—'}</option>
          {sido?.districts.map((d) => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      {hint && <p className="hint">태어난 곳을 모르겠다면 ‘모름’을 선택하세요. 태어난 곳은 진태양시를 계산할 때 사용해요.</p>}
    </div>
  );
}
