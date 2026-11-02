import { isOn } from '../lib/flags';

export type Tab = 'home' | 'talk' | 'intro' | 'my';

const TABS: { key: Tab; label: string; icon: string; flag?: 'intro_tab' }[] = [
  { key: 'home', label: '홈', icon: '⌂' },
  { key: 'talk', label: '대화', icon: '💬' },
  { key: 'intro', label: '소개', icon: '♡', flag: 'intro_tab' },
  { key: 'my', label: '마이', icon: '👤' },
];

export default function BottomTab({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs = TABS.filter((t) => !t.flag || isOn(t.flag));
  return (
    <nav className="bottom-tab" aria-label="하단 탭">
      {tabs.map((t) => (
        <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => onChange(t.key)} aria-current={active === t.key ? 'page' : undefined}>
          <span className="tab-icon" aria-hidden>
            {t.icon}
          </span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
