import { Icon, type IconName } from './Icon';
import { isOn } from '../lib/flags';

export type Tab = 'home' | 'talk' | 'intro' | 'my';

const TABS: { key: Tab; label: string; icon: IconName; flag?: 'intro_tab' }[] = [
  { key: 'home', label: '홈', icon: 'house' },
  { key: 'talk', label: '대화', icon: 'message' },
  { key: 'intro', label: '소개', icon: 'heart', flag: 'intro_tab' },
  { key: 'my', label: '마이', icon: 'user' },
];

export default function BottomTab({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs = TABS.filter((t) => !t.flag || isOn(t.flag));
  return (
    <nav className="bottom-tab" aria-label="하단 탭">
      {tabs.map((t) => (
        <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => onChange(t.key)} aria-current={active === t.key ? 'page' : undefined}>
          <span className="tab-icon" aria-hidden>
            <Icon name={t.icon} size={22} />
          </span>
          <span className="tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
