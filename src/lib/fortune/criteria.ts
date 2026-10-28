/**
 * 해석 기준 (팀 합의 대상).
 *
 * 같은 신호면 늘 같은 방향으로 해석되도록 의미와 점수를 한곳에 둔다.
 * - 점수는 코드가 매기고(signals.ts), LLM 은 이 의미표의 방향 안에서 문장만 쓴다.
 * - 값을 바꾸면 CRITERIA_VERSION 을 올린다 → 캐시 키가 바뀌어 예전 풀이가 재사용되지 않는다.
 * - 사람이 읽는 문서는 docs/interpretation-criteria.md (npm run criteria:doc 으로 재생성).
 */
import type { FiveElement, TenGod } from 'manseryeok';

export const CRITERIA_VERSION = '2026-10-28.1';

export type Tone = '좋음' | '중립' | '주의';

export interface TenGodCriterion {
  keyword: string;
  /** 연애 관점 의미 (일진·세운 등 흐름으로 들어올 때) */
  love: string;
  tone: Tone;
  /** 흐름 점수 (천간·지지 각각 적용) */
  score: number;
}

export const TEN_GOD_CRITERIA: Record<TenGod, TenGodCriterion> = {
  비견: { keyword: '자기 주장·독립', love: '내 페이스가 강해져요. 맞춰 주기보다 내 방식을 고집하기 쉬운 흐름', tone: '중립', score: 0 },
  겁재: { keyword: '경쟁·충동', love: '경쟁자나 질투가 끼어들기 쉬워요. 즉흥적인 결정은 한 번 더 생각', tone: '주의', score: -1 },
  식신: { keyword: '여유·표현·즐거움', love: '자연스러운 매력이 드러나요. 편안한 데이트, 가벼운 대화에 좋은 흐름', tone: '좋음', score: 1 },
  상관: { keyword: '솔직함·말·감정 표현', love: '솔직함이 매력이 되지만, 말이 앞서 상처를 줄 수 있어요', tone: '중립', score: 0 },
  편재: { keyword: '활동·사교·새 만남', love: '새로운 사람을 만날 기회, 이벤트·모임에서 인연이 생기기 쉬워요', tone: '좋음', score: 1 },
  정재: { keyword: '안정·책임·현실', love: '꾸준하고 안정적인 관계에 좋아요. 현실적인 약속을 정하기 좋은 흐름', tone: '좋음', score: 1 },
  편관: { keyword: '긴장·카리스마·압박', love: '강하게 끌리는 사람이 나타나거나 관계에 긴장감이 생겨요', tone: '중립', score: 0 },
  정관: { keyword: '신뢰·약속·격식', love: '진지한 관계로 나아가기 좋아요. 소개·공식적인 만남에 유리', tone: '좋음', score: 1 },
  편인: { keyword: '직관·생각·고립', love: '생각이 많아져 혼자 결론을 내리기 쉬워요. 오해는 바로 물어보기', tone: '주의', score: -1 },
  정인: { keyword: '배려·돌봄·안정감', love: '따뜻한 배려를 주고받아요. 마음을 털어놓기 좋은 흐름', tone: '좋음', score: 1 },
};

/** 전통 관점의 이성(배우자) 별: 남자는 재성, 여자는 관성 */
export const LOVE_STAR: Record<'male' | 'female', TenGod[]> = {
  male: ['편재', '정재'],
  female: ['편관', '정관'],
};
export const LOVE_STAR_BONUS = 1;

export interface RelationCriterion {
  meaning: string;
  love: string;
  /** 흐름 글자(일진·세운 등)가 원국과 이 관계일 때 점수 */
  score: number;
  /** 일지(배우자 자리) 또는 일간과 직접 맺어질 때 추가 점수 */
  dayBonus: number;
}

export const RELATION_CRITERIA: Record<string, RelationCriterion> = {
  천간합: { meaning: '두 기운이 끌어당겨 묶임', love: '마음이 통하고 끌림이 생겨요', score: 1, dayBonus: 1 },
  육합: { meaning: '지지끼리 짝을 이뤄 묶임', love: '자연스럽게 가까워지는 흐름', score: 1, dayBonus: 1 },
  삼합: { meaning: '세 지지가 한 기운으로 모임', love: '주변 도움으로 관계가 풀려요', score: 1, dayBonus: 0 },
  반합: { meaning: '삼합의 두 글자가 모임', love: '협력과 공감이 생기는 흐름', score: 1, dayBonus: 0 },
  방합: { meaning: '같은 계절 기운이 모임', love: '한쪽 기운이 강해져 분위기가 몰려요', score: 0, dayBonus: 0 },
  천간충: { meaning: '두 기운이 부딪힘', love: '생각이나 의견 차이가 드러나요', score: -1, dayBonus: -1 },
  충: { meaning: '정반대 지지가 부딪힘', love: '변화·이동·갈등. 일지 충이면 관계 자리가 흔들려요', score: -1, dayBonus: -1 },
  형: { meaning: '지지끼리 조정·마찰', love: '사소한 마찰, 조율이 필요한 지점', score: -1, dayBonus: 0 },
  삼형: { meaning: '세 지지가 서로 형', love: '마찰이 겹치니 속도를 늦추기', score: -1, dayBonus: 0 },
  자형: { meaning: '같은 글자가 겹쳐 스스로 부담', love: '혼자 감정을 키우기 쉬워요. 스스로를 다그치지 않기', score: -1, dayBonus: 0 },
  파: { meaning: '틀어짐·깨짐', love: '약속이 어긋나기 쉬워요. 일정은 한 번 더 확인', score: -1, dayBonus: 0 },
  해: { meaning: '은근히 해를 끼침', love: '서운함이 쌓이기 쉬워요. 작은 일도 말로 풀기', score: -1, dayBonus: 0 },
  원진: { meaning: '이유 없이 끌리면서 미워함', love: '미묘한 감정 엇갈림. 단정하지 말고 확인하기', score: -1, dayBonus: -1 },
};

export const VOID_SCORE = -1;
export const VOID_MEANING = '공망(空亡): 기대만큼 채워지지 않는 기운. 큰 결정보다 정리·준비에 좋아요';

/** 원국의 연애 신살이 흐름에서 다시 들어올 때 */
export const STAR_ACTIVATION: Record<string, { love: string; score: number }> = {
  도화: { love: '매력이 눈에 띄는 날. 이성의 관심을 받기 쉬워요', score: 1 },
  홍염살: { love: '감성과 끌림이 강해져요. 분위기에 휩쓸리지 않게', score: 1 },
  역마: { love: '이동·여행 중 인연. 장거리·새로운 장소', score: 0 },
};

export const ELEMENT_FILL_SCORE = 1;
export const ELEMENT_EXCESS_SCORE = -1;
/** 원국에서 이 개수 이상이면 '과다' */
export const EXCESS_THRESHOLD = 3;

export interface ElementInfo {
  hanja: string;
  trait: string;
  love: string;
  color: string;
  direction: string;
  numbers: number[];
  items: string[];
}

export const ELEMENT_INFO: Record<FiveElement, ElementInfo> = {
  목: { hanja: '木', trait: '성장·시작·배려', love: '새로운 시작, 다정함', color: '초록', direction: '동쪽', numbers: [3, 8], items: ['화분', '나무 소품', '산책로'] },
  화: { hanja: '火', trait: '열정·표현·밝음', love: '적극적인 표현, 설렘', color: '빨강·주황', direction: '남쪽', numbers: [2, 7], items: ['향초', '조명 좋은 카페', '선글라스'] },
  토: { hanja: '土', trait: '안정·신뢰·포용', love: '듬직함, 오래가는 관계', color: '노랑·베이지', direction: '중앙', numbers: [5, 10], items: ['도자기 컵', '베이커리', '흙길 산책'] },
  금: { hanja: '金', trait: '결단·원칙·깔끔함', love: '명확한 선, 약속', color: '흰색·은색', direction: '서쪽', numbers: [4, 9], items: ['은 액세서리', '깔끔한 셔츠', '시계'] },
  수: { hanja: '水', trait: '지혜·유연·감성', love: '깊은 대화, 공감', color: '검정·남색', direction: '북쪽', numbers: [1, 6], items: ['물가 데이트', '차 한 잔', '향수'] },
};

/** 점수 → 등급 */
export function gradeOf(score: number): { grade: '아주 좋음' | '좋음' | '보통' | '조심' | '많이 조심'; tone: Tone } {
  if (score >= 3) return { grade: '아주 좋음', tone: '좋음' };
  if (score >= 1) return { grade: '좋음', tone: '좋음' };
  if (score > -1) return { grade: '보통', tone: '중립' };
  if (score >= -2) return { grade: '조심', tone: '주의' };
  return { grade: '많이 조심', tone: '주의' };
}

/** 사람이 검토할 수 있는 기준 문서 (docs/interpretation-criteria.md 로 저장) */
export function criteriaMarkdown(): string {
  const lines: string[] = [];
  lines.push('# 모두의 연애 · 해석 기준', '');
  lines.push(`버전: \`${CRITERIA_VERSION}\` · 원본: \`src/lib/fortune/criteria.ts\` (이 문서는 자동 생성, 직접 수정 금지)`, '');
  lines.push('점수는 코드가 매기고, LLM 은 아래 의미의 방향 안에서 문장만 씁니다.', '');
  lines.push('## 1. 십신 (흐름으로 들어올 때)', '', '| 십신 | 키워드 | 연애 의미 | 톤 | 점수 |', '|---|---|---|---|---|');
  for (const [k, v] of Object.entries(TEN_GOD_CRITERIA)) lines.push(`| ${k} | ${v.keyword} | ${v.love} | ${v.tone} | ${v.score} |`);
  lines.push('', `이성의 별: 남자 ${LOVE_STAR.male.join('·')}, 여자 ${LOVE_STAR.female.join('·')} — 흐름 천간 또는 지지에 있으면 +${LOVE_STAR_BONUS} (한 번만).`, '');
  lines.push('## 2. 원국과의 관계', '', '| 관계 | 뜻 | 연애 의미 | 점수 | 일간·일지 직접 시 추가 |', '|---|---|---|---|---|');
  for (const [k, v] of Object.entries(RELATION_CRITERIA)) lines.push(`| ${k} | ${v.meaning} | ${v.love} | ${v.score} | ${v.dayBonus} |`);
  lines.push('', `- 공망: ${VOID_MEANING} (점수 ${VOID_SCORE}, 일진 지지가 일주 공망일 때)`);
  lines.push('- 같은 종류 관계가 여러 원국 글자와 겹쳐도 종류당 한 번만 점수에 반영합니다.', '');
  lines.push('## 3. 신살 활성화', '', '원국 기준 도화·홍염·역마 글자가 흐름 지지로 다시 들어오면:', '', '| 신살 | 연애 의미 | 점수 |', '|---|---|---|');
  for (const [k, v] of Object.entries(STAR_ACTIVATION)) lines.push(`| ${k} | ${v.love} | ${v.score} |`);
  lines.push('', '## 4. 오행 보완·과다', '');
  lines.push(`- 원국에 없는(0개) 오행이 흐름에 들어오면 +${ELEMENT_FILL_SCORE} (보완)`);
  lines.push(`- 원국에 ${EXCESS_THRESHOLD}개 이상인 오행이 흐름에 또 들어오면 ${ELEMENT_EXCESS_SCORE} (과다)`, '');
  lines.push('| 오행 | 성질 | 연애 | 색 | 방향 | 숫자 | 행운 아이템 |', '|---|---|---|---|---|---|---|');
  for (const [k, v] of Object.entries(ELEMENT_INFO))
    lines.push(`| ${k}(${v.hanja}) | ${v.trait} | ${v.love} | ${v.color} | ${v.direction} | ${v.numbers.join('·')} | ${v.items.join(', ')} |`);
  lines.push('', '행운 오행: 원국에 없는 오행 → 가장 적은 오행 순. 동률이면 신약은 일간을 생하는 오행, 신강은 일간이 생하는 오행을 우선.', '');
  lines.push('## 5. 등급', '', '| 점수 | 등급 |', '|---|---|', '| 3 이상 | 아주 좋음 |', '| 1~2 | 좋음 |', '| 0 (−1 초과) | 보통 |', '| −1 ~ −2 | 조심 |', '| −3 이하 | 많이 조심 |', '');
  lines.push('## 6. 팀 확정이 필요한 관법', '');
  lines.push('- 지장간: 월률분야 순서(여기·중기·정기) 표 사용');
  lines.push('- 12운성: 봉법(일간 기준), 음간 역행');
  lines.push('- 신살: 도화·역마·화개는 연지·일지 삼합 기준, 홍염·천을귀인·양인은 일간 기준');
  lines.push('- 자시 관법 기본값: 자정 기준 (설정에서 자시·야자시 선택 가능)');
  lines.push('- 신강약: 간이 가중치(천간 1, 월지 3, 일지 1.5, 그 외 지지 1)');
  lines.push('- 위 점수 가중치 전체', '');
  return lines.join('\n');
}
