/**
 * 말투 설정 — 사용자가 고르면 모든 캐릭터가 그 말투로 답한다 (2026-11-26 기획 답변: 채팅 안에서 바꾸기보다 개인 설정으로).
 * 프로토타입은 이 기기에 저장. 실서비스는 사용자 설정으로 서버에 저장한다.
 */
export type SpeechSetting = 'default' | 'formal' | 'casual';
export const SPEECH_KEY = 'yeonae.speech';
export const SPEECH_OPTIONS: { value: SpeechSetting; label: string }[] = [
  { value: 'default', label: '캐릭터 기본' },
  { value: 'formal', label: '존댓말' },
  { value: 'casual', label: '반말' },
];
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const storageOrNull = (): StorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
export function loadSpeech(storage: StorageLike | null = storageOrNull()): SpeechSetting {
  try {
    const v = storage?.getItem(SPEECH_KEY);
    return v === 'formal' || v === 'casual' ? v : 'default';
  } catch {
    return 'default';
  }
}
export function saveSpeech(v: SpeechSetting, storage: StorageLike | null = storageOrNull()): void {
  try {
    if (v === 'default') storage?.removeItem(SPEECH_KEY);
    else storage?.setItem(SPEECH_KEY, v);
  } catch {
    /* 저장 실패는 무시 */
  }
}
/** API 로 보낼 값 (기본이면 보내지 않는다) */
export const speechParam = (v: SpeechSetting): { speech?: 'formal' | 'casual' } => (v === 'default' ? {} : { speech: v });
