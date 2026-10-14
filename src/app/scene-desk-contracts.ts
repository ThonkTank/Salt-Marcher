import type { Result } from "./contracts";
import type {
  Note,
  PreparationDraft,
  PreparationCommand,
} from "./preparation-contracts";
import type { LocationDocument } from "../features/location/location-schema";
import type { Creature } from "../features/catalog/creature-catalog";
import type { ItemDefinition } from "./items-contracts";
import type { EncounterPlan } from "./encounter-contracts";
export type DeskRef = {
  kind: "note" | "location" | "creature" | "item" | "encounter";
  id: string;
};
export interface DeskEntry {
  ref: DeskRef;
  title: string;
  label: string;
  unavailable?: boolean;
}
export interface DeskContent extends DeskEntry {
  links?: {label:string;entry:DeskEntry}[];
  revision: number;
  note?: Note;
  location?: LocationDocument;
  creature?: Creature;
  item?: ItemDefinition;
  encounter?: EncounterPlan;
}
export interface SceneDesk {
  sceneId: string;
  revision: number;
  pins: DeskEntry[];
  place: DeskEntry | null;
}
export interface SceneDeskAPI {
  sceneDesk(token: string, sceneId: string): Promise<Result<SceneDesk>>;
  searchDesk(
    token: string,
    kind: "world" | "item" | "creature" | "encounter",
    search: string,
    offset: number,
  ): Promise<Result<{ entries: DeskEntry[]; next: number | null;notice?:string }>>;
  deskContent(token: string, ref: DeskRef): Promise<Result<DeskContent>>;
  pinSceneDesk(
    token: string,
    sceneId: string,
    revision: number,
    ref: DeskRef,
    pin: boolean,
  ): Promise<Result<SceneDesk>>;
  keepDeskDraft(
    token: string,
    draft: PreparationDraft,
    expected: string | null,
  ): Promise<Result<void>>;
}
export type DeskEditCommand = PreparationCommand;
