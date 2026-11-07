import type { Point } from '../shared/contracts';

export const roadStyles = [
  ['blended', 'Weicher Weg'],
  ['solid', 'Durchgezogen'],
  ['dashed', 'Gestrichelt'],
  ['dotted', 'Gepunktet'],
  ['double', 'Doppellinie mit Randstrichen'],
  ['dash-dot-dot', 'Strich-Doppelpunkt'],
  ['arrows', 'Pfeile'],
  ['rail', 'Schraffur'],
  ['dash-dot', 'Strichpunkt'],
  ['worn', 'Breiter Pinselstrich'],
] as const;

export type RoadStyle = (typeof roadStyles)[number][0];

export interface LandscapeLine {
  version: 1;
  curve: 'smooth' | 'linear';
  color: string;
  roughness: number;
  meander: number;
  fadeIn: boolean;
  seed: number;
  style: RoadStyle;
  overSymbols: boolean;
  /** Continuity retained when a line is split; all distances remain world meters. */
  continuity?: { before?: Point; after?: Point; segmentOffset: number; distanceOffset: number };
}
