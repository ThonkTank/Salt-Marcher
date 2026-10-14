import type {Result} from './contracts';

export type SceneCheckMode='normal'|'advantage'|'disadvantage';
export interface SceneCheck {
  id:string;sceneId:string;ordinal:number;label:string;ruleNoteId:string|null;ruleTitle:string|null;ruleSourceRevision:number|null;
  mode:SceneCheckMode;modifier:number;dc:number|null;rolls:number[];total:number;
  outcome:'success'|'failure'|null;sceneInstantMs:string;recordedAt:string;
  rollKind?:'check'|'formula';actor?:string|null;formula?:string;sourceCreatureId?:string|null;sourceActionId?:string|null;
}
export interface SceneChecks {sceneId:string;revision:number;checks:SceneCheck[];truncated:boolean}
export interface SceneCheckCommand {
  commandId:string;campaignId:string;token:string;sceneId:string;expectedRevision:number;
  action:{kind:'roll';label:string;ruleNoteId:string|null;mode:SceneCheckMode;modifier:number;dc:number|null}
    |{kind:'formula';label:string;actor:string|null;formula:string;dc:number|null;sourceCreatureId:string|null;sourceActionId:string|null};
}
export interface SceneCheckAPI {
  sceneChecks(token:string,sceneId:string):Promise<Result<SceneChecks>>;
  executeSceneCheck(command:SceneCheckCommand):Promise<Result<SceneChecks>>;
}
