import type { Result } from '../shared/contracts';

export type SceneCheckMode = 'normal' | 'advantage' | 'disadvantage';
export interface SceneCheck {
  id: string;
  sceneId: string;
  ordinal: number;
  label: string;
  ruleNoteId: string | null;
  ruleTitle: string | null;
  ruleSourceRevision: number | null;
  mode: SceneCheckMode;
  modifier: number;
  dc: number | null;
  rolls: number[];
  total: number;
  outcome: 'success' | 'failure' | null;
  sceneInstantMs: string;
  recordedAt: string;
  rollKind?: 'check' | 'formula';
  formulaKind?: 'attack' | 'damage';
  actor?: string | null;
  formula?: string;
  sourceCreatureId?: string | null;
  sourceActionId?: string | null;
}
export interface SceneChecks {
  sceneId: string;
  revision: number;
  checks: SceneCheck[];
  truncated: boolean;
}
export interface SceneCheckCommand {
  commandId: string;
  campaignId: string;
  token: string;
  sceneId: string;
  expectedRevision: number;
  // New rule-bound rolls require the displayed pin basis; old receipts remain replayable.
  action:
    | {
        kind: 'roll';
        label: string;
        ruleNoteId: string | null;
        expectedRuleSourceRevision?: number;
        mode: SceneCheckMode;
        modifier: number;
        dc: number | null;
        actor?: string | null;
        sourceCreatureId?: string | null;
        sourceActionId?: string | null;
      }
    | {
        kind: 'formula';
        formulaKind?: 'attack' | 'damage';
        label: string;
        actor: string | null;
        formula: string;
        dc: number | null;
        sourceCreatureId: string | null;
        sourceActionId: string | null;
      };
}
export interface SceneCheckAPI {
  sceneChecks(token: string, sceneId: string): Promise<Result<SceneChecks>>;
  executeSceneCheck(command: SceneCheckCommand): Promise<Result<SceneChecks>>;
}
