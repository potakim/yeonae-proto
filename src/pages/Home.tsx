import type { HubCharacter, Screen } from '../App';

interface Props {
  hub: HubCharacter;
  setHub: (h: HubCharacter) => void;
  go: (s: Screen) => void;
}

export default function Home({ hub, setHub, go }: Props) {
  return (
    <div className="stack">
      <section className="hero">
        <div className="hero-avatar" aria-hidden>
          {hub === '형' ? '🧢' : '🎀'}
        </div>
        <h1 className="hero-title">
          연애가 궁금할 땐
          <br />
          아는 {hub}한테 물어봐
        </h1>
        <p className="hero-sub">사주랑 성격유형으로 너를 먼저 알아볼게.</p>
        <div className="segmented" role="tablist" aria-label="허브 캐릭터 선택">
          {(['형', '언니'] as const).map((h) => (
            <button
              key={h}
              role="tab"
              aria-selected={hub === h}
              className={hub === h ? 'active' : ''}
              onClick={() => setHub(h)}
            >
              아는 {h}
            </button>
          ))}
        </div>
      </section>

      <button className="menu-card" onClick={() => go('personality')}>
        <span className="menu-emoji" aria-hidden>
          🧠
        </span>
        <span className="menu-text">
          <strong>성격유형 테스트</strong>
          <span>연애 상황 문항이 섞인 32문항 · 약 4분 (빠른 16문항도 있어요)</span>
        </span>
        <span className="menu-chev" aria-hidden>
          ›
        </span>
      </button>

      <button className="menu-card" onClick={() => go('saju')}>
        <span className="menu-emoji" aria-hidden>
          📜
        </span>
        <span className="menu-text">
          <strong>만세력 · 사주 원국</strong>
          <span>KASI 기준 계산 · 진태양시 · 야자시 관법 · 대운</span>
        </span>
        <span className="menu-chev" aria-hidden>
          ›
        </span>
      </button>

      <div className="notice">
        <strong>가능성 검증용 프로토타입이에요.</strong>
        <ul>
          <li>계산은 모두 브라우저에서 이뤄지고, 입력값은 어디에도 저장·전송되지 않아요.</li>
          <li>AI 해석(LLM)은 아직 붙이지 않았어요. 결과 화면에서 LLM에 넘길 데이터 형태를 확인할 수 있어요.</li>
          <li>성격유형 테스트는 자체 제작 문항이며 공식 MBTI® 검사가 아니에요.</li>
        </ul>
      </div>
    </div>
  );
}
