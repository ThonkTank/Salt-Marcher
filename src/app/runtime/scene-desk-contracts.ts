import type { Creature } from '../../features/catalog/creature-catalog';
import type { LocationDocument } from '../../features/location/location-schema';
import type { Note, PreparationCommand, PreparationDraft } from '../campaign/preparation-contracts';
import type { EncounterPlan } from '../catalog/encounter-contracts';
import type { ItemDefinition } from '../catalog/items-contracts';
import type { Result } from '../shared/contracts';
import { DeskRef } from '../shared/desk-reference';
export interface DeskEntry {
  ref: DeskRef;
  title: string;
  label: string;
  unavailable?: boolean;
  revision?: number;
  preview?:
    | import('../campaign/preparation-contracts').NoteSearchPreview
    | { label: string; text: string };
}
export interface DeskContent extends DeskEntry {
  links?: { label: string; entry: DeskEntry }[];
  revision: number;
  referenceNotice?: string;
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
export interface SceneCreationInput {
  kind: 'npc' | 'faction' | 'quest' | 'rumor' | 'location';
  name: string;
  notes: string;
  pin: boolean;
  contributors: boolean;
}
export interface SceneCreationDraft {
  writeId: string;
  input: SceneCreationInput;
  command: PreparationCommand | null;
}
export interface SceneDeskAPI {
  sceneCreationDraft(token: string, sceneId: string): Promise<Result<SceneCreationDraft | null>>;
  keepSceneCreationDraft(
    token: string,
    sceneId: string,
    draft: SceneCreationDraft | null,
    expected: string | null,
  ): Promise<Result<void>>;
  sceneDesk(token: string, sceneId: string): Promise<Result<SceneDesk>>;
  searchDesk(
    token: string,
    kind: 'world' | 'note' | 'rule' | 'item' | 'creature' | 'encounter' | 'reference',
    search: string,
    offset: number,
  ): Promise<Result<{ entries: DeskEntry[]; next: number | null; notice?: string }>>;
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
