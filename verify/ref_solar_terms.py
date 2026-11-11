"""
독립 기준 1: NASA JPL DE421 천체력 + Skyfield 로 24절기 절입 순간을 계산한다.

- 절입 = 태양의 '겉보기 지심 황경(of date, 광행차·장동 포함)'이 15°의 배수가 되는 순간
  (한국천문연구원 역서와 같은 정의)
- DE421 유효 범위: 1899-07 ~ 2053-10 → 1900~2050년만 계산
- 출력: verify/data/ref_solar_terms_de421.json  { "YYYY-idx": utc_ms }  (idx 0=소한 … 23=동지)

실행: python3 verify/ref_solar_terms.py
"""
import json
import os
import sys

import skyfield_data  # pip install skyfield skyfield-data  (de421.bsp 동봉)
from skyfield.api import load_file, load
from skyfield.framelib import ecliptic_frame
from skyfield.searchlib import find_discrete

Y0, Y1 = 1900, 2050

bsp_path = os.path.join(os.path.dirname(skyfield_data.__file__), 'data', 'de421.bsp')
eph = load_file(bsp_path)
ts = load.timescale(builtin=True)
earth, sun = eph['earth'], eph['sun']


def sector(t):
    """겉보기 황경을 15° 구간 번호(0~23, 춘분=0)로."""
    lat, lon, _ = earth.at(t).observe(sun).apparent().frame_latlon(ecliptic_frame)
    return (lon.degrees // 15).astype(int) % 24


sector.step_days = 5  # 절기 간격(약 15일)보다 충분히 작게

out = {}
t0 = ts.utc(Y0 - 1, 12, 1)
t1 = ts.utc(Y1 + 1, 1, 31)
times, sectors = find_discrete(t0, t1, sector)
for t, s in zip(times, sectors):
    lon = s * 15  # 이 순간 도달한 황경
    idx = ((lon - 285) % 360) // 15  # 0=소한(285°) … 23=동지(270°)
    dt = t.utc_datetime()
    year = dt.year
    # 절기는 '달력상 그 해' 에 속한 것으로 키를 잡는다 (소한=1월, 동지=12월)
    if not (Y0 <= year <= Y1):
        continue
    ms = round(t.utc_datetime().timestamp() * 1000)
    out[f'{year}-{int(idx)}'] = ms

os.makedirs(os.path.join(os.path.dirname(__file__), 'data'), exist_ok=True)
path = os.path.join(os.path.dirname(__file__), 'data', 'ref_solar_terms_de421.json')
with open(path, 'w') as f:
    json.dump(out, f)
print('terms:', len(out), 'expected:', (Y1 - Y0 + 1) * 24, '→', path, file=sys.stderr)
