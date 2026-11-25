/**
 * 개발·검수용 화면 요소(프롬프트 미리보기, 모델·토큰 표시, 테스트 설정)를 보일지.
 * 프로토타입 빌드는 기본으로 보이고, 실서비스 빌드는 VITE_HIDE_DEV=1 로 숨긴다 (7차 리뷰 2026-11-25 "내부 용어·개발 문구").
 */
export const SHOW_DEV: boolean = import.meta.env.VITE_HIDE_DEV !== '1';
