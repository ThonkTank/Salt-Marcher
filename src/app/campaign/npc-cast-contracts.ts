import type { NpcPlaces } from './npc-places-contracts';
import type { NpcDailySlot } from './npc-contracts';
import type { NpcPage, NpcView } from './npc-contracts';
import type { LiveScene } from '../runtime/live-contracts';
export interface NpcCastQuery {
  sceneId: string;
  text: string;
  scope: 'current' | 'all' | 'unplaced';
  offset: number;
}
export interface NpcCastPage extends NpcPage {
  sceneId: string;
  sceneTitle: string;
  locationTitle: string;
}
export interface NpcDossier {
  dailyPlan?: {
    targets?: import('./npc-contracts').NpcPlanLocation[];
    current: NpcDailySlot | null;
    next: NpcDailySlot | null;
    secondsUntilNext: number | null;
    problem: string | null;
    daySeconds: number;
    day?: string;
    weekdayTitle?: string;
    weekdayTitles?: string[];
    overrideLabel?: string | null;
    startsOnPreviousDay?: boolean;
    nextDate?: string | null;
  };
  places?: NpcPlaces;
  scene: LiveScene;
  date: string;
  npc: NpcView;
  locationTitle: string;
  faction: { id: string; title: string; available: boolean } | null;
  relations: {
    id: string;
    title: string;
    kind: string;
    label: string;
    incoming: boolean;
    available: boolean;
  }[];
  relationCount: number;
  groups: { id: string; title: string }[];
  autonomy: {
    enabled: boolean;
    paused: boolean;
    role: string;
    pending: string | null;
    jobName: string;
    progressSeconds: number;
    remainingIntervals: number;
    needs: { name: string; value: number }[];
  } | null;
  logs: { id: string; text: string }[];
}
