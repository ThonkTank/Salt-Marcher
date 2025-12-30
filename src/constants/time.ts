// Zeit-bezogene Konstanten
// Siehe: docs/features/Time.md

// Tages-Segmente für Zeit-System
export const TIME_SEGMENTS = ['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night'] as const;
export type TimeSegment = typeof TIME_SEGMENTS[number];
