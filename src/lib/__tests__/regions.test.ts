import { describe, expect, it } from 'vitest';
import { DEFAULT_PLACE, PLACE_UNKNOWN, SIDO, longitudeOf, placeOfLongitude } from '../../data/regions';
import { calculateSaju, type SajuInput } from '../saju';

describe('태어난 곳: 시·도 → 시·군·구 (5차 리뷰)', () => {
  it('17개 시·도, 시·군·구 229개, 이름 중복 없음', () => {
    expect(SIDO).toHaveLength(17);
    expect(SIDO.reduce((n, s) => n + s.districts.length, 0)).toBe(229);
    for (const s of SIDO) expect(new Set(s.districts.map((d) => d.name)).size, s.name).toBe(s.districts.length);
  });
  it('경도는 국내 범위이고, 시·군·구는 시·도 대표 경도에서 크게 벗어나지 않는다', () => {
    for (const s of SIDO) {
      expect(s.longitude).toBeGreaterThan(125.5);
      expect(s.longitude).toBeLessThan(130);
      for (const d of s.districts) {
        expect(d.longitude, `${s.name} ${d.name}`).toBeGreaterThan(124.5);
        expect(d.longitude, `${s.name} ${d.name}`).toBeLessThan(131);
        // 울릉군(경북)만 예외적으로 멀다
        if (d.name !== '울릉군') expect(Math.abs(d.longitude - s.longitude), `${s.name} ${d.name}`).toBeLessThan(1.6);
      }
    }
  });
  it('선택 → 경도: 시·군·구, 시·도만, 모름', () => {
    expect(longitudeOf({ sido: '경기도', district: '의정부시' })).toBe(127.03);
    expect(longitudeOf({ sido: '경기도', district: '' })).toBe(127.01);
    expect(longitudeOf({ sido: PLACE_UNKNOWN, district: '' })).toBeNull();
    expect(longitudeOf(DEFAULT_PLACE)).toBe(126.98);
    expect(placeOfLongitude(null).sido).toBe(PLACE_UNKNOWN);
    expect(placeOfLongitude(126.98).sido).toBe('서울특별시');
    expect(placeOfLongitude(129.07).sido).toBe('부산광역시');
  });
  it('한국 표준 보정·보정 없음은 태어난 곳의 영향을 받지 않는다', () => {
    const base: SajuInput = { year: 1995, month: 3, day: 15, hour: 23, minute: 20, isLunar: false, isLeapMonth: false, gender: 'female', longitude: null, timeStandard: 'korea', dayBoundary: 'jasi' };
    for (const timeStandard of ['korea', 'none'] as const) {
      const a = calculateSaju({ ...base, timeStandard, longitude: longitudeOf({ sido: '인천광역시', district: '옹진군' }) }).detail;
      const b = calculateSaju({ ...base, timeStandard, longitude: longitudeOf({ sido: '경상북도', district: '울릉군' }) }).detail;
      const c = calculateSaju({ ...base, timeStandard, longitude: null }).detail;
      expect(a.hourString).toBe(b.hourString);
      expect(a.dayString).toBe(b.dayString);
      expect(a.hourString).toBe(c.hourString);
    }
  });
});
