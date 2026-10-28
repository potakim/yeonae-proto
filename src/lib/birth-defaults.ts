import type { Gender } from 'manseryeok';
import { BIRTH_PLACES, type SajuInput } from './saju';

export const MBTI_TYPES = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
];

export function defaultBirth(gender: Gender = 'female'): SajuInput {
  return {
    year: 1995, month: 3, day: 15, hour: 14, minute: 30,
    isLunar: false, isLeapMonth: false, gender,
    longitude: BIRTH_PLACES[0].longitude, useTrueSolarTime: true, dayBoundary: 'midnight',
  };
}

