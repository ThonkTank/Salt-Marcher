import type { Result } from './contracts';

export interface SceneRulePin {
  noteId: string;
  sourceRevision: number;
  title: string;
  readAloud: string;
  gmNotes: string;
  currentRevision: number | null;
  stale: boolean;
  unavailable: boolean;
}
export interface SceneRules {
  sceneId: string;
  revision: number;
  pins: SceneRulePin[];
}
export interface SceneRuleCommand {
  commandId: string;
  campaignId: string;
  token: string;
  sceneId: string;
  expectedRevision: number;
  action:
    | { kind: 'pin' | 'refresh'; noteId: string; expectedSourceRevision?: number }
    | { kind: 'unpin'; noteId: string };
}
export interface RuleReferenceAPI {
  sceneRules(token: string, sceneId: string): Promise<Result<SceneRules>>;
  executeSceneRule(command: SceneRuleCommand): Promise<Result<SceneRules>>;
}
