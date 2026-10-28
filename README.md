# 모두의 연애 · 웹뷰 프로토타입

만세력(사주 원국)과 자체 성격유형 테스트가 **웹뷰(Vite + React + TS)** 구조에서 문제없이 돌아가는지 판단하기 위한 프로토타입입니다.
앱인토스 WebView SDK는 아직 붙이지 않았고, Vercel 같은 일반 정적 호스팅에서 바로 테스트할 수 있습니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 단위 테스트 (만세력 골든 케이스 + 교차검증, 채점 로직)
npm run build    # dist/ 생성
```

Node 18 이상.

### Claude 해석 연결 (테스트)

```bash
cp .env.example .env.local   # ANTHROPIC_API_KEY 입력
npm run dev                  # 만세력 결과 아래 "무당에게 풀이 듣기"
```

- `api/interpret.ts` 하나가 Vercel 함수이자 로컬 개발 API예요 (`vite.config.ts`의 개발 미들웨어가 같은 파일을 불러 씀).
- 키는 서버에서만 읽어요 (`VITE_` 접두사 없음 → 브라우저 번들에 안 들어감).
- 모델 기본값 `claude-sonnet-5-5`, `ANTHROPIC_MODEL`로 변경. 응답은 스트리밍, 끝에 토큰 사용량 표시.
- `INTERPRET_ACCESS_CODE`를 넣으면 화면의 "테스트 설정"에 같은 코드를 입력해야 호출돼요. Vercel 공개 URL에선 꼭 설정하세요.
- 풀이 주제 2종: 타고난 연애 성향 / 지금의 연애운(대운·세운·월운). 선택 질문 1개(300자).
- **프로토타입 한정**: 원국 JSON은 브라우저에서 계산해 보내요. 실서비스에선 서버가 생년월일시를 받아 직접 계산해야 해요.

## Vercel 배포

둘 중 편한 방법으로.

1. **GitHub 연동**: 이 폴더를 GitHub 저장소로 올린 뒤 Vercel → Add New → Project → 저장소 선택 → Deploy.
   프레임워크는 Vite로 자동 인식됩니다 (`vercel.json`에도 명시).
2. **CLI**: 폴더에서 `npx vercel` → 로그인 → 질문은 기본값으로 진행. 운영 URL은 `npx vercel --prod`.

라우팅은 화면 상태로만 처리하므로 SPA rewrite 설정은 필요 없습니다.

## 구조

```
src/
  lib/
    saju.ts                    만세력 계산 래퍼 (manseryeok@2.0.0 고정)
                               - 시간 모름 처리, 절입일 후보 경고, 진태양시 보정 비교
                               - 오행 분포, LLM 입력용 JSON(toLlmPayload, schema v2)
    saju-analysis.ts           결정적 파생 계산: 지장간, 12운성, 합충형파해·원진·자형·삼합/반합/방합,
                               신살(도화·역마·화개·홍염·천을귀인·양인·괴강·백호), 간이 신강약
    vendor/korea-time.ts       진태양시 보정 시각 (manseryeok 내부 로직 이식, MIT) — 기록·표시용
  components/
    InterpretPanel.tsx         Claude 풀이 요청·스트리밍 표시·AI 고지
api/
  interpret.ts                 POST /api/interpret (Vercel 함수 + 로컬 개발 API)
    personality/
      questions.ts             자체 문항 32개 (+ 빠른 모드 16개)
      scoring.ts               채점 로직, LLM 입력용 JSON
      types.ts                 16유형 연애 중심 설명 + 허브 캐릭터 한마디
    __tests__/                 vitest
  pages/
    Home.tsx                   허브(아는 형/언니 선택)
    SajuPage.tsx               입력 폼 → 원국·십신·오행·공망·대운
    PersonalityPage.tsx        문항 진행 → 결과
```

## 만세력 — 정확성 검증 내용

- 엔진: [manseryeok](https://github.com/yhj1024/manseryeok) 2.0.0 (MIT, KASI 정본 기반). 버전은 정확히 고정.
- 골든 케이스: 라이브러리 README 예시와 일치 확인 (양력·음력 입력, 진태양시 보정).
- **교차검증**: 1900-01-01 ~ 2099-12-31 전 일자(73,049일)를 중국 기준 만세력 `lunar-javascript`와 비교
  - 일주: 불일치 0건
  - 연주·월주: 99건 불일치, 모두 절입일 근처 (한국 KST와 중국 CST 기준 차이에서 오는 정상적인 차이)
  - 테스트에는 13일 간격 샘플로 상시 포함 (`npm test`)
- 관법 옵션: 진태양시(경도·균시차·과거 서머타임), 자시 날짜 경계 3종.
- 시간 모름: 시주 제외 6글자로 계산하고, 절입일이라 연·월주가 하루 안에서 바뀌면 후보를 경고.

> 실서비스 전에는 KASI 데이터나 검증된 상용 만세력과 대조한 자체 골든셋(절입 경계, 23시대 출생,
> 1948~1988년 서머타임 기간 출생 등)을 추가하는 것을 권장합니다.

## 원국 JSON v2 (`modu-yeonae.saju.v2`)

v1 대비 바뀐 점 — LLM이 지어내기 쉬운 값을 전부 코드에서 계산해 넘긴다.

| 항목 | 내용 |
|---|---|
| `input`, `correctedTime` | 입력 시각 원본과 진태양시 보정 결과(경도·균시차·서머타임 내역) — 재현·디버깅용 |
| `pillars.*.branch` | `yinYangPosition`(자리 음양)과 `mainQi`(정기)를 분리, 지장간 `hiddenStems`(십신 포함) |
| `pillars.*.twelveStage` | 일간 기준 12운성 |
| `relations` | 천간합·충, 육합·충·형·파·해·원진·자형·삼합·반합·방합·삼형 (같은 조합은 한 건으로 묶음, 인접 여부) |
| `specialStars` | 대표 신살과 판단 기준(`basis`) |
| `strength` | 간이 신강약 + 득령·득지·득세, 계산 방식(`method`) 명시 |
| `luckPillars.list` | 대운별 실제 시작·종료일, 만 나이, 십신, 12운성, `current` |
| `now` | 현재 대운·올해 세운·이번 달 월운과 원국의 관계 |
| `voidBranches` | 일주·연주 기준 공망, 원국 해당 여부 |

검증: `src/lib/__tests__/payload.test.ts` (1979-01-27 갑오 일주 케이스, 12운성·합충 표, 보정 시각 ↔ 엔진 시주 일치).

## 성격유형 테스트 — 설계

- **문항은 전부 자체 작성**. 공식 MBTI® 문항, OEJTS(CC BY-NC-SA, 비상업 라이선스) 문항은 사용하지 않음.
- 4축 × 8문항 = 32문항, 5점 리커트. 축마다 양쪽 성향 문항 4개씩 → "그렇다"로 몰아 찍어도 한쪽으로 쏠리지 않음
  (테스트로 확인: 전부 "매우 그렇다"면 모든 축 50%).
- 성향별 4문항 중 2문항은 연애 상황 문항.
- 채점: 응답을 -2~+2로 바꿔 방향에 맞게 합산 → 0~100%. 동점이면 연애 문항으로 결정하고 결과에 "동점" 표시.
- 명확도: 50%에서 10%p 미만 `경계`, 25%p 미만 `약간`, 40%p 미만 `뚜렷`, 그 이상 `매우 뚜렷`.
- 빠른 모드: 축당 4문항(양쪽 2개씩) 16문항.
- 화면에는 "공식 MBTI® 검사가 아님" 고지를 노출.

> 문항 신뢰도(내적 일관성)는 실제 응답 데이터가 모여야 검증할 수 있습니다. 파일럿에서 응답을 모아
> 축별 Cronbach's α와 문항-총점 상관을 보고 약한 문항을 교체하는 과정을 권장합니다.

## 앱인토스로 옮길 때 할 일

- `@apps-in-toss/web-framework` 설치 및 `npx ait init`, `granite.config.ts`의 appName·brand 설정
- TDS(WebView용) 컴포넌트로 UI 교체, 상단 바는 토스 내비게이션 바 사용 (자체 상단 바 제거)
- 토스 로그인 연동 (결과 저장이 필요해지는 시점)
- LLM 호출은 자체 백엔드에서 (API 키를 프론트에 두지 않음) + 생성형 AI 고지·라벨 표시
  → 프로토타입은 `api/interpret.ts`로 구현됨. 실서비스에선 서버 재계산·사용자별 호출 제한·결과 캐시 추가
- Pretendard 웹폰트 CDN 사용 여부 검수 확인 (안 되면 번들에 포함하거나 시스템 폰트 사용)
