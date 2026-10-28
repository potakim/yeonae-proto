/** 브라우저 → /api/* 호출 공통 (접근 코드 헤더, 오류 문구) */
const ACCESS_KEY = 'modu-yeonae.accessCode';

export function getAccessCode(): string {
  try {
    return localStorage.getItem(ACCESS_KEY) ?? '';
  } catch {
    return '';
  }
}
export function setAccessCode(code: string) {
  try {
    localStorage.setItem(ACCESS_KEY, code);
  } catch {
    /* 저장 실패는 무시 */
  }
}

export async function postApi<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-access-code': getAccessCode() },
    body: JSON.stringify(body),
    signal,
  });
  const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
  return j as T;
}

export const AI_NOTICE = '생성형 AI가 작성한 결과예요. 재미와 참고용으로만 봐 주세요.';
