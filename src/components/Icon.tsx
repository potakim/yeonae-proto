/**
 * 선형 아이콘 — 기능·메뉴를 나타내는 이모지 대신 쓴다 (6차 리뷰 2026-11-23 "이모지 아이콘 교체").
 * 도형은 Lucide 것을 그대로 쓴다. 선 굵기 기본 2px. 장식용이라 스크린리더에서는 숨기고, 버튼 쪽에 aria-label 을 둔다.
 */
import { createElement } from 'react';
import { LUCIDE, type IconName } from './lucide-icons';

export type { IconName };

export function Icon({ name, size = 16, strokeWidth = 2, fill = 'none' }: { name: IconName; size?: number; strokeWidth?: number; fill?: string }) {
  return (
    <svg className="line-icon" width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {LUCIDE[name].map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
