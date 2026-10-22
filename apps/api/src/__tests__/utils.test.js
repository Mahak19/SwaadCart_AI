import { describe, it, expect } from 'vitest';
import { fuzzyMatch } from '../utils/fuzzyMatch.js';
import { startOfWeek, daysLeftInWeek } from '../utils/dateHelpers.js';

describe('fuzzyMatch', () => {
  it('returns 1 for an exact (case-insensitive) match', () => {
    expect(fuzzyMatch('Tomato', 'tomato')).toBe(1);
  });

  it('returns 0.8 when one string contains the other', () => {
    expect(fuzzyMatch('Tomato', 'tomato chopped')).toBe(0.8);
    expect(fuzzyMatch('tomato chopped', 'Tomato')).toBe(0.8);
  });

  it('returns 0 for unrelated strings', () => {
    expect(fuzzyMatch('tomato', 'onion')).toBe(0);
  });

  it('returns 0 for empty inputs', () => {
    expect(fuzzyMatch('', 'tomato')).toBe(0);
    expect(fuzzyMatch('tomato', null)).toBe(0);
  });
});

describe('dateHelpers', () => {
  it('startOfWeek returns Monday at midnight', () => {
    const wednesday = new Date('2026-03-11T10:30:00');
    const monday = startOfWeek(wednesday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getHours()).toBe(0);
    expect(monday.toDateString()).toBe(new Date('2026-03-09').toDateString());
  });

  it('daysLeftInWeek counts the remaining days of the current week', () => {
    expect(daysLeftInWeek(new Date('2026-03-09T08:00:00'))).toBe(7);
    expect(daysLeftInWeek(new Date('2026-03-13T08:00:00'))).toBe(3);
  });
});
