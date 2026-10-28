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

      <button className="menu-card" onClick={() => go('chat')}>
        <span className="menu-emoji" aria-hidden>
          💬
        </span>
        <span className="menu-text">
          <strong>{`아는 ${hub}에게 털어놓기`}</strong>
          <span>고민을 들어 주고 맞는 전문가를 소개해 줘요 · AI 대화</span>
        </span>
        <span className="menu-chev" aria-hidden>
          ›
        </span>
      </button>

      <button className="menu-card" onClick={() => go('kakao')}>
        <span className="menu-emoji" aria-hidden>
          📱
        </span>
        <span className="menu-text">
          <strong>카톡 분석</strong>
          <span>캡처만 올리면 호감도·관계 단계·답장 추천 · 여사친</span>
        </span>
        <span className="menu-chev" aria-hidden>
          ›
        </span>
      </button>

      <button className="menu-card" onClick={() => go('compat')}>
        <span className="menu-emoji" aria-hidden>
          💞
        </span>
        <span className="menu-text">
          <strong>사주 × MBTI 궁합</strong>
          <span>그 사람 생일로 두 사람 기운 맞춰 보기 · 무당</span>
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
          <strong>사주 원국 · 연애운</strong>
          <span>만세력 계산 + 오늘·이번 주·올해 연애운 · 무당</span>
        </span>
        <span className="menu-chev" aria-hidden>
          ›
        </span>
      </button>

      <button className="menu-card" onClick={() => go('personality')}>
        <span className="menu-emoji" aria-hidden>
          🧠
        </span>
        <span className="menu-text">
          <strong>연애 성향 테스트</strong>
          <span>32문항(빠른 16문항) + 아는 형/언니 AI 해석</span>
        </span>
        <span className="menu-chev" aria-hidden>
          ›
        </span>
      </button>

      <div className="notice">
        <strong>가능성 검증용 프로토타입이에요.</strong>
        <ul>
          <li>사주·성격유형·궁합·카톡 통계는 코드로 계산하고, 풀이와 대화는 생성형 AI(Claude)가 작성해요.</li>
          <li>AI 기능을 쓸 때만 입력값이 서버로 전송돼요. 생년월일·대화·스크린샷은 저장하지 않아요.</li>
          <li>AI 결과는 재미와 참고용이에요. 성격유형 테스트는 자체 제작 문항이며 공식 MBTI® 검사가 아니에요.</li>
        </ul>
      </div>
    </div>
  );
}
