export interface DayRow {
  level: number;
  count: number;
}
export interface DayPlanEntry {
  id: string;
  revision: number;
  count: number;
  restBefore?: 'short' | 'long';
}
export interface DayRequest {
  source: 'active' | 'custom';
  rows: DayRow[];
  totalXp: number;
  rewardXp?: number;
  encounters?: DayPlanEntry[];
}
export interface DayRestStop {
  after: number;
  shortDue: number;
  longDue: number;
}
export interface DayItineraryStage extends DayPlanEntry {
  name: string;
  difficulty: string | null;
  baseXp: number;
  adjustedXp: number;
  multiplier: number;
  loadShare: number;
  rewardShare: number;
  cumulativeLoadXp: number;
  cumulativeRewardXp: number;
  shortDue: number | null;
  longDue: number | null;
  knownRestStates: number;
  restStops?: DayRestStop[];
}
export interface DayItinerary {
  stages: DayItineraryStage[];
  partySize: number;
  rawLoadXp: number;
  rawRewardXp: number;
  totalLoadXp: number;
  totalRewardXp: number;
  pacing?: DayPacing;
  plannedRests: { short: number; long: number };
}
export interface DayProjection {
  name: string;
  count: number;
  beforeXp: number;
  afterXp: number;
  beforeLevel: number;
  afterLevel: number;
}
export interface DayCalculation {
  partySize: number;
  dailyBudget: number;
  totalXp: number;
  rewardXp: number;
  shareXp: number;
  totalAwardXp: number;
  milestones: [number, number, number];
  thresholds: number[];
  completedDays: number;
  dayProgress: number;
  shortRests: number;
  longRests: number;
  timeline: { label: string; xp: number }[];
  projections: DayProjection[];
}
export interface DaySnapshot {
  available: boolean;
  partySize: number;
  averageLevel: number | null;
  dailyBudget: number | null;
  shortXp: number | null;
  longXp: number | null;
  reason: string;
  rows: { level: number | null; count: number }[];
  members: {
    id: string;
    name: string;
    xp: number | null;
    level: number | null;
    restKnown: boolean;
    shortXp: number;
    longXp: number;
    nextShort: number | null;
    remainingLong: number | null;
  }[];
}
export interface DayRestFrame {
  budget: number;
  consumed: number;
  shortXp: number;
  baseline: number;
  sections: number;
  fill: number;
  nextRest: number;
  remainingLong: number;
  due: 'short' | 'long' | null;
}
export interface DayPacing {
  plannedRests?: { short: number; long: number };
  projectedKnown?: number;
  projectedSections?: number | null;
  partySize: number;
  known: number;
  loadShare: number | null;
  totalLoad: number | null;
  currentFill: number | null;
  projectedFill: number | null;
  commonSections: number | null;
  /** Smallest additional group pool whose rounded share reaches a known member's mark. */
  untilShort: number | null;
  untilLong: number | null;
  members: {
    id: string;
    name: string;
    before: DayRestFrame | null;
    after: DayRestFrame | null;
    reason: string | null;
  }[];
}
export interface DayView {
  advancement?: DayAdvancement;
  snapshot: DaySnapshot;
  calculation: DayCalculation | null;
  problem: string | null;
  pacing?: DayPacing;
  itinerary?: DayItinerary;
}

export interface DayLevelMark {
  level: number;
  groupXp: number;
  shareXp: number;
  missingGroupXp: number;
  members: { name: string; count: number }[];
  stage: number | null;
}
export interface DayAdvancement {
  reached: DayLevelMark[];
  next: DayLevelMark[];
  atMaximum: number;
}
