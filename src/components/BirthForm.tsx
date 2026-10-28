import { BIRTH_PLACES, type SajuInput } from '../lib/saju';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/** 궁합 등에서 쓰는 간단한 생년월일시 입력 (관법은 기본값: 진태양시 보정·자정 기준) */
export default function BirthForm({ value, onChange, idPrefix }: { value: SajuInput; onChange: (v: SajuInput) => void; idPrefix: string }) {
  const set = (patch: Partial<SajuInput>) => onChange({ ...value, ...patch });
  const num = (s: string) => (s === '' ? 0 : Number(s.replace(/\D/g, '')));
  const placeIdx = Math.max(0, BIRTH_PLACES.findIndex((p) => p.longitude === value.longitude));

  return (
    <div className="form">
      <div className="field">
        <label>달력</label>
        <div className="segmented">
          <button className={!value.isLunar ? 'active' : ''} onClick={() => set({ isLunar: false, isLeapMonth: false })}>양력</button>
          <button className={value.isLunar ? 'active' : ''} onClick={() => set({ isLunar: true })}>음력</button>
        </div>
        {value.isLunar && (
          <label className="check">
            <input type="checkbox" checked={value.isLeapMonth} onChange={(e) => set({ isLeapMonth: e.target.checked })} />
            윤달이에요
          </label>
        )}
      </div>
      <div className="field">
        <label>생년월일</label>
        <div className="row3">
          <div className="suffix-input">
            <input inputMode="numeric" aria-label={`${idPrefix} 년`} value={value.year || ''} onChange={(e) => set({ year: num(e.target.value) })} />
            <span>년</span>
          </div>
          <div className="suffix-input">
            <input inputMode="numeric" aria-label={`${idPrefix} 월`} value={value.month || ''} onChange={(e) => set({ month: num(e.target.value) })} />
            <span>월</span>
          </div>
          <div className="suffix-input">
            <input inputMode="numeric" aria-label={`${idPrefix} 일`} value={value.day || ''} onChange={(e) => set({ day: num(e.target.value) })} />
            <span>일</span>
          </div>
        </div>
      </div>
      <div className="field">
        <label>태어난 시간</label>
        <div className="row2">
          <select aria-label={`${idPrefix} 시`} value={value.hour ?? 12} disabled={value.hour === null} onChange={(e) => set({ hour: Number(e.target.value) })}>
            {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}시</option>)}
          </select>
          <select aria-label={`${idPrefix} 분`} value={value.minute} disabled={value.hour === null} onChange={(e) => set({ minute: Number(e.target.value) })}>
            {MINUTES.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>)}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={value.hour === null} onChange={(e) => set({ hour: e.target.checked ? null : 12 })} />
          시간을 몰라요
        </label>
      </div>
      <div className="field">
        <label>성별</label>
        <div className="segmented">
          <button className={value.gender === 'female' ? 'active' : ''} onClick={() => set({ gender: 'female' })}>여성</button>
          <button className={value.gender === 'male' ? 'active' : ''} onClick={() => set({ gender: 'male' })}>남성</button>
        </div>
      </div>
      <div className="field">
        <label>태어난 곳</label>
        <select value={placeIdx} onChange={(e) => set({ longitude: BIRTH_PLACES[Number(e.target.value)].longitude })}>
          {BIRTH_PLACES.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
        </select>
      </div>
    </div>
  );
}
