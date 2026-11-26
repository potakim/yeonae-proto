/**
 * 선형 아이콘. 이모지·기호 글자 대신 쓴다 (7차 리뷰 2026-11-25).
 * message·handshake·heartHandshake 는 8차 프로필 목업(goeun-profile-mockup.html)에 들어 있던 Lucide 아이콘 경로(ISC 라이선스)다.
 * 본격적인 아이콘 교체(6차)는 별도 작업.
 */
const PATHS = {
  plus: ['M12 5v14M5 12h14'],
  back: ['M15 18l-6-6 6-6'],
  lock: ['M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z'],
  heart: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'],
  users: ['M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.5M17.5 14.5A5.5 5.5 0 0 1 21 19'],
  refresh: ['M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4'],
  chat: ['M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'],
  calendar: ['M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM5 10h14M9 3v4M15 3v4'],
  send: ['M5 12l14-7-5 14-3-6-6-1z'],
  next: ['M9 18l6-6-6-6'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  upload: ['M12 16V5M7 9.5L12 5l5 4.5M5 19h14'],
  more: ['M5 12h.01M12 12h.01M19 12h.01'],
  close: ['M18 6 6 18M6 6l12 12'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01'],
  message: ['M7.9 20A9 9 0 1 0 4 16.1L2 22z'],
  handshake: [
    'm11 17 2 2a1 1 0 1 0 3-3',
    'm14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4',
    'm21 3 1 11h-2',
    'M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3',
    'M3 4h8',
  ],
  heartHandshake: [
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
    'M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66',
    'm18 15-2-2',
    'm15 18-2-2',
  ],
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg className="line-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
