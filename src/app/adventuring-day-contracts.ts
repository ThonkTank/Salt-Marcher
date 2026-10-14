export interface DayRow {level:number;count:number}
export interface DayRequest {source:'active'|'custom';rows:DayRow[];totalXp:number;rewardXp?:number}
export interface DayProjection {name:string;count:number;beforeXp:number;afterXp:number;beforeLevel:number;afterLevel:number}
export interface DayCalculation {partySize:number;dailyBudget:number;totalXp:number;rewardXp:number;shareXp:number;totalAwardXp:number;milestones:[number,number,number];thresholds:number[];completedDays:number;dayProgress:number;shortRests:number;longRests:number;timeline:{label:string;xp:number}[];projections:DayProjection[]}
export interface DaySnapshot {available:boolean;partySize:number;averageLevel:number|null;dailyBudget:number|null;shortXp:number|null;longXp:number|null;reason:string;rows:{level:number|null;count:number}[];members:{id:string;name:string;xp:number|null;level:number|null;restKnown:boolean;shortXp:number;longXp:number;nextShort:number|null;remainingLong:number|null}[]}
export interface DayView {snapshot:DaySnapshot;calculation:DayCalculation|null;problem:string|null}
