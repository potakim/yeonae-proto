/**
 * 태어난 곳 선택용 시·도 → 시·군·구 대표 경도 (5차 리뷰 2026-11-19).
 * 값은 시청·군청·구청 부근의 근사 경도(동경, 소수 둘째 자리)다. 0.1° 차이는 시각으로 24초라 시주가 바뀌는 일은 드물지만,
 * 출시 전에는 행정구역 공공데이터로 대조·교체한다. 진태양시(trueSolar) 계산에만 쓰인다.
 * 일반구가 있는 시(수원·성남·창원 등)는 시 단위로 묶었다. 현재 행정구역 기준이라 옛 지명(예: 마산)은 없다.
 */
export interface Sido {
  name: string;
  /** 시·군·구를 고르지 않았을 때 쓰는 시·도 대표 경도 (시청·도청 부근) */
  longitude: number;
  districts: { name: string; longitude: number }[];
}

export const SIDO: Sido[] = [
  {
    name: '서울특별시',
    longitude: 126.98,
    districts: [
      { name: '종로구', longitude: 126.98 },
      { name: '중구', longitude: 126.99 },
      { name: '용산구', longitude: 126.99 },
      { name: '성동구', longitude: 127.04 },
      { name: '광진구', longitude: 127.08 },
      { name: '동대문구', longitude: 127.04 },
      { name: '중랑구', longitude: 127.09 },
      { name: '성북구', longitude: 127.02 },
      { name: '강북구', longitude: 127.03 },
      { name: '도봉구', longitude: 127.05 },
      { name: '노원구', longitude: 127.06 },
      { name: '은평구', longitude: 126.93 },
      { name: '서대문구', longitude: 126.94 },
      { name: '마포구', longitude: 126.90 },
      { name: '양천구', longitude: 126.87 },
      { name: '강서구', longitude: 126.85 },
      { name: '구로구', longitude: 126.89 },
      { name: '금천구', longitude: 126.90 },
      { name: '영등포구', longitude: 126.90 },
      { name: '동작구', longitude: 126.94 },
      { name: '관악구', longitude: 126.95 },
      { name: '서초구', longitude: 127.03 },
      { name: '강남구', longitude: 127.05 },
      { name: '송파구', longitude: 127.11 },
      { name: '강동구', longitude: 127.12 },
    ],
  },
  {
    name: '부산광역시',
    longitude: 129.08,
    districts: [
      { name: '중구', longitude: 129.03 },
      { name: '서구', longitude: 129.02 },
      { name: '동구', longitude: 129.05 },
      { name: '영도구', longitude: 129.07 },
      { name: '부산진구', longitude: 129.05 },
      { name: '동래구', longitude: 129.08 },
      { name: '남구', longitude: 129.08 },
      { name: '북구', longitude: 129.01 },
      { name: '해운대구', longitude: 129.16 },
      { name: '사하구', longitude: 128.97 },
      { name: '금정구', longitude: 129.09 },
      { name: '강서구', longitude: 128.98 },
      { name: '연제구', longitude: 129.08 },
      { name: '수영구', longitude: 129.11 },
      { name: '사상구', longitude: 128.99 },
      { name: '기장군', longitude: 129.22 },
    ],
  },
  {
    name: '대구광역시',
    longitude: 128.60,
    districts: [
      { name: '중구', longitude: 128.61 },
      { name: '동구', longitude: 128.64 },
      { name: '서구', longitude: 128.56 },
      { name: '남구', longitude: 128.60 },
      { name: '북구', longitude: 128.58 },
      { name: '수성구', longitude: 128.63 },
      { name: '달서구', longitude: 128.53 },
      { name: '달성군', longitude: 128.43 },
      { name: '군위군', longitude: 128.57 },
    ],
  },
  {
    name: '인천광역시',
    longitude: 126.71,
    districts: [
      { name: '중구', longitude: 126.62 },
      { name: '동구', longitude: 126.64 },
      { name: '미추홀구', longitude: 126.65 },
      { name: '연수구', longitude: 126.68 },
      { name: '남동구', longitude: 126.73 },
      { name: '부평구', longitude: 126.72 },
      { name: '계양구', longitude: 126.74 },
      { name: '서구', longitude: 126.68 },
      { name: '강화군', longitude: 126.49 },
      { name: '옹진군', longitude: 126.64 },
    ],
  },
  {
    name: '광주광역시',
    longitude: 126.85,
    districts: [
      { name: '동구', longitude: 126.92 },
      { name: '서구', longitude: 126.89 },
      { name: '남구', longitude: 126.90 },
      { name: '북구', longitude: 126.91 },
      { name: '광산구', longitude: 126.79 },
    ],
  },
  {
    name: '대전광역시',
    longitude: 127.38,
    districts: [
      { name: '동구', longitude: 127.45 },
      { name: '중구', longitude: 127.42 },
      { name: '서구', longitude: 127.38 },
      { name: '유성구', longitude: 127.36 },
      { name: '대덕구', longitude: 127.42 },
    ],
  },
  {
    name: '울산광역시',
    longitude: 129.31,
    districts: [
      { name: '중구', longitude: 129.33 },
      { name: '남구', longitude: 129.33 },
      { name: '동구', longitude: 129.42 },
      { name: '북구', longitude: 129.36 },
      { name: '울주군', longitude: 129.24 },
    ],
  },
  {
    name: '세종특별자치시',
    longitude: 127.29,
    districts: [
      { name: '세종시', longitude: 127.29 },
    ],
  },
  {
    name: '경기도',
    longitude: 127.01,
    districts: [
      { name: '수원시', longitude: 127.03 },
      { name: '성남시', longitude: 127.13 },
      { name: '의정부시', longitude: 127.03 },
      { name: '안양시', longitude: 126.96 },
      { name: '부천시', longitude: 126.77 },
      { name: '광명시', longitude: 126.86 },
      { name: '평택시', longitude: 127.11 },
      { name: '동두천시', longitude: 127.06 },
      { name: '안산시', longitude: 126.83 },
      { name: '고양시', longitude: 126.83 },
      { name: '과천시', longitude: 126.99 },
      { name: '구리시', longitude: 127.13 },
      { name: '남양주시', longitude: 127.22 },
      { name: '오산시', longitude: 127.08 },
      { name: '시흥시', longitude: 126.80 },
      { name: '군포시', longitude: 126.94 },
      { name: '의왕시', longitude: 126.97 },
      { name: '하남시', longitude: 127.21 },
      { name: '용인시', longitude: 127.18 },
      { name: '파주시', longitude: 126.78 },
      { name: '이천시', longitude: 127.44 },
      { name: '안성시', longitude: 127.28 },
      { name: '김포시', longitude: 126.72 },
      { name: '화성시', longitude: 126.83 },
      { name: '광주시', longitude: 127.26 },
      { name: '양주시', longitude: 127.05 },
      { name: '포천시', longitude: 127.20 },
      { name: '여주시', longitude: 127.64 },
      { name: '연천군', longitude: 127.07 },
      { name: '가평군', longitude: 127.51 },
      { name: '양평군', longitude: 127.49 },
    ],
  },
  {
    name: '강원특별자치도',
    longitude: 127.73,
    districts: [
      { name: '춘천시', longitude: 127.73 },
      { name: '원주시', longitude: 127.92 },
      { name: '강릉시', longitude: 128.88 },
      { name: '동해시', longitude: 129.11 },
      { name: '태백시', longitude: 128.99 },
      { name: '속초시', longitude: 128.59 },
      { name: '삼척시', longitude: 129.17 },
      { name: '홍천군', longitude: 127.89 },
      { name: '횡성군', longitude: 127.98 },
      { name: '영월군', longitude: 128.46 },
      { name: '평창군', longitude: 128.39 },
      { name: '정선군', longitude: 128.66 },
      { name: '철원군', longitude: 127.31 },
      { name: '화천군', longitude: 127.71 },
      { name: '양구군', longitude: 127.99 },
      { name: '인제군', longitude: 128.17 },
      { name: '고성군', longitude: 128.47 },
      { name: '양양군', longitude: 128.62 },
    ],
  },
  {
    name: '충청북도',
    longitude: 127.49,
    districts: [
      { name: '청주시', longitude: 127.49 },
      { name: '충주시', longitude: 127.93 },
      { name: '제천시', longitude: 128.19 },
      { name: '보은군', longitude: 127.73 },
      { name: '옥천군', longitude: 127.57 },
      { name: '영동군', longitude: 127.78 },
      { name: '증평군', longitude: 127.58 },
      { name: '진천군', longitude: 127.44 },
      { name: '괴산군', longitude: 127.79 },
      { name: '음성군', longitude: 127.69 },
      { name: '단양군', longitude: 128.37 },
    ],
  },
  {
    name: '충청남도',
    longitude: 126.67,
    districts: [
      { name: '천안시', longitude: 127.11 },
      { name: '공주시', longitude: 127.12 },
      { name: '보령시', longitude: 126.61 },
      { name: '아산시', longitude: 127.00 },
      { name: '서산시', longitude: 126.45 },
      { name: '논산시', longitude: 127.10 },
      { name: '계룡시', longitude: 127.25 },
      { name: '당진시', longitude: 126.65 },
      { name: '금산군', longitude: 127.49 },
      { name: '부여군', longitude: 126.91 },
      { name: '서천군', longitude: 126.69 },
      { name: '청양군', longitude: 126.80 },
      { name: '홍성군', longitude: 126.66 },
      { name: '예산군', longitude: 126.85 },
      { name: '태안군', longitude: 126.30 },
    ],
  },
  {
    name: '전북특별자치도',
    longitude: 127.11,
    districts: [
      { name: '전주시', longitude: 127.15 },
      { name: '군산시', longitude: 126.74 },
      { name: '익산시', longitude: 126.96 },
      { name: '정읍시', longitude: 126.86 },
      { name: '남원시', longitude: 127.39 },
      { name: '김제시', longitude: 126.88 },
      { name: '완주군', longitude: 127.16 },
      { name: '진안군', longitude: 127.42 },
      { name: '무주군', longitude: 127.66 },
      { name: '장수군', longitude: 127.52 },
      { name: '임실군', longitude: 127.29 },
      { name: '순창군', longitude: 127.14 },
      { name: '고창군', longitude: 126.70 },
      { name: '부안군', longitude: 126.73 },
    ],
  },
  {
    name: '전라남도',
    longitude: 126.46,
    districts: [
      { name: '목포시', longitude: 126.39 },
      { name: '여수시', longitude: 127.66 },
      { name: '순천시', longitude: 127.49 },
      { name: '나주시', longitude: 126.71 },
      { name: '광양시', longitude: 127.70 },
      { name: '담양군', longitude: 126.99 },
      { name: '곡성군', longitude: 127.29 },
      { name: '구례군', longitude: 127.46 },
      { name: '고흥군', longitude: 127.28 },
      { name: '보성군', longitude: 127.08 },
      { name: '화순군', longitude: 126.99 },
      { name: '장흥군', longitude: 126.91 },
      { name: '강진군', longitude: 126.77 },
      { name: '해남군', longitude: 126.60 },
      { name: '영암군', longitude: 126.70 },
      { name: '무안군', longitude: 126.48 },
      { name: '함평군', longitude: 126.52 },
      { name: '영광군', longitude: 126.51 },
      { name: '장성군', longitude: 126.78 },
      { name: '완도군', longitude: 126.76 },
      { name: '진도군', longitude: 126.26 },
      { name: '신안군', longitude: 126.11 },
    ],
  },
  {
    name: '경상북도',
    longitude: 128.51,
    districts: [
      { name: '포항시', longitude: 129.34 },
      { name: '경주시', longitude: 129.22 },
      { name: '김천시', longitude: 128.11 },
      { name: '안동시', longitude: 128.73 },
      { name: '구미시', longitude: 128.34 },
      { name: '영주시', longitude: 128.62 },
      { name: '영천시', longitude: 128.94 },
      { name: '상주시', longitude: 128.16 },
      { name: '문경시', longitude: 128.19 },
      { name: '경산시', longitude: 128.74 },
      { name: '의성군', longitude: 128.70 },
      { name: '청송군', longitude: 129.06 },
      { name: '영양군', longitude: 129.11 },
      { name: '영덕군', longitude: 129.37 },
      { name: '청도군', longitude: 128.73 },
      { name: '고령군', longitude: 128.26 },
      { name: '성주군', longitude: 128.28 },
      { name: '칠곡군', longitude: 128.40 },
      { name: '예천군', longitude: 128.45 },
      { name: '봉화군', longitude: 128.73 },
      { name: '울진군', longitude: 129.40 },
      { name: '울릉군', longitude: 130.91 },
    ],
  },
  {
    name: '경상남도',
    longitude: 128.69,
    districts: [
      { name: '창원시', longitude: 128.68 },
      { name: '진주시', longitude: 128.11 },
      { name: '통영시', longitude: 128.43 },
      { name: '사천시', longitude: 128.06 },
      { name: '김해시', longitude: 128.89 },
      { name: '밀양시', longitude: 128.75 },
      { name: '거제시', longitude: 128.62 },
      { name: '양산시', longitude: 129.04 },
      { name: '의령군', longitude: 128.26 },
      { name: '함안군', longitude: 128.41 },
      { name: '창녕군', longitude: 128.49 },
      { name: '고성군', longitude: 128.32 },
      { name: '남해군', longitude: 127.89 },
      { name: '하동군', longitude: 127.75 },
      { name: '산청군', longitude: 127.87 },
      { name: '함양군', longitude: 127.73 },
      { name: '거창군', longitude: 127.91 },
      { name: '합천군', longitude: 128.17 },
    ],
  },
  {
    name: '제주특별자치도',
    longitude: 126.53,
    districts: [
      { name: '제주시', longitude: 126.53 },
      { name: '서귀포시', longitude: 126.56 },
    ],
  },
];

/** '모름' — 한반도 평균 경도(동경 127.5°)로 계산한다 (SajuInput.longitude = null) */
export const PLACE_UNKNOWN = '모름';

export interface BirthPlace {
  /** 시·도 이름 또는 PLACE_UNKNOWN */
  sido: string;
  /** 시·군·구 이름. 빈 문자열이면 시·도 대표 경도 */
  district: string;
}

export const DEFAULT_PLACE: BirthPlace = { sido: '서울특별시', district: '' };

export function longitudeOf(place: BirthPlace): number | null {
  const s = SIDO.find((x) => x.name === place.sido);
  if (!s) return null;
  return s.districts.find((d) => d.name === place.district)?.longitude ?? s.longitude;
}

/** 저장된 경도에서 선택 상태를 되살린다 (궁합 화면 등 경도만 들고 있는 폼용). 정확히 같은 값이 없으면 가장 가까운 시·도 */
export function placeOfLongitude(longitude: number | null): BirthPlace {
  if (longitude === null) return { sido: PLACE_UNKNOWN, district: '' };
  let best = SIDO[0];
  for (const s of SIDO) {
    if (s.longitude === longitude) return { sido: s.name, district: '' };
    if (Math.abs(s.longitude - longitude) < Math.abs(best.longitude - longitude)) best = s;
  }
  return { sido: best.name, district: '' };
}
