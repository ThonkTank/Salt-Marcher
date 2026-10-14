import type { Result } from './contracts';
export interface CharacterProfile {
  name: string; playerName?: string; species?: string; characterClass?: string;
  armorClass?: number; passivePerception?: number; speedFeet?: number;
}
export interface Character {
  id: string; ordinal: number; profile: CharacterProfile; profileRevision: number;
  active: boolean; membershipRevision: number; sceneId: string | null;
}
export interface LiveScene {
  id: string; revision: number; title: string; notes: string; readAloud?:string; locationId: string | null;
  membershipRevision: number; retired: boolean;
  clock: { epochId: string; instantMs: string; revision: number };
  members: string[];
  adoption: { id: string; planId: string; planRevision: number; visitId: string; title: string; notes: string; locationId: string | null } | null;
}
export interface LiveView {
  rosterRevision: number; roster: Character[]; primaryId: string | null; focusId: string | null; focusRevision: number | null;
  scenes: { id: string; title: string; primary: boolean; members: number; membershipRevision: number; clock: LiveScene['clock'] }[];
  archiveCount: number;
  scene: LiveScene | null;
}
export type LiveAction =
  | { kind: 'initialize'; expectedRosterRevision: number }
  | { kind: 'create-character'; profile: CharacterProfile }
  | { kind: 'profile'; characterId: string; expectedRevision: number; profile: CharacterProfile }
  | { kind: 'membership'; characterId: string; expectedRevision: number; expectedRosterRevision: number; active: boolean; targetSceneId: string | null; expectedFocusRevision: number | null }
  | { kind: 'apply-visit'; planId: string; expectedPlanRevision: number; visitId: string; sceneId: string; expectedRevision: number;expectedVisitRevision?:number }
  | { kind: 'scene-content'; sceneId: string; expectedRevision: number; title: string; notes: string; readAloud?:string; locationId: string | null }
  | { kind: 'focus'; sceneId: string; expectedRevision: number }
  | { kind: 'move'; sceneId: string; expectedRosterRevision: number; expectedFocusRevision: number; expectedClockRevision: number; expectedSceneMembershipRevision: number; memberIds: string[];
      target: { kind: 'new'; title: string; expectedContentRevision: number } | { kind: 'existing'; sceneId: string; expectedClockRevision: number; expectedMembershipRevision: number } }
  | { kind: 'live-moment'; sceneId: string; expectedRevision: number; category: 'combat'|'narrative'|'reward'|'travel'|'party'|'world'; title: string; summary: string; followUp?:{kind:'quest'|'rumor';id:string}|null }
  | { kind: 'advance-clock'; sceneId: string; expectedRevision: number; amount: number; unit: TimeUnit; calendarVersion: 'relative-v1'; reason: string };
export interface LiveCommand { commandId: string; campaignId: string; token: string; action: LiveAction }
export interface LiveAck {
  commandId: string; targetId: string; revision: number; rosterRevision: number; scene?: LiveScene; character?: Character;
  session?: { primaryId: string; focusId: string; focusRevision: number; retired: { id: string; clock: LiveScene['clock'] }[];
    members: Pick<Character, 'id' | 'active' | 'membershipRevision' | 'sceneId'>[]; groups: { id: string; membershipRevision: number; members: number }[];
    createdScene?: LiveView['scenes'][number]; archiveCount: number };
}
export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';
export function advanceInstant(instantMs: string, amount: number, unit: TimeUnit): string {
  const factors: Record<TimeUnit, bigint> = { seconds: 1000n, minutes: 60000n, hours: 3600000n, days: 86400000n };
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Object.hasOwn(factors, unit) || !/^(0|[1-9][0-9]{0,29})$/.test(instantMs)) throw new Error('Zeitspanne benötigt eine positive ganze Zahl und eine gültige Einheit.');
  const next = BigInt(instantMs) + BigInt(amount) * factors[unit];
  if (next.toString().length > 30) throw new Error('Zeitwert zu groß.');
  return next.toString();
}
export function formatInstant(instantMs: string): string {
  const seconds = BigInt(instantMs) / 1000n;
  const pad = (n: bigint) => n.toString().padStart(2, '0');
  return 'Tag ' + (seconds / 86400n) + ' · ' + pad(seconds / 3600n % 24n) + ':' + pad(seconds / 60n % 60n) + ':' + pad(seconds % 60n);
}
export interface LiveAPI {
  live(token: string): Promise<Result<LiveView>>;
  liveScene(token: string, id: string): Promise<Result<LiveScene>>;
  liveArchives(token: string, after: string | null): Promise<Result<{ items: { id: string; title: string }[]; next: string | null }>>;
  executeLive(command: LiveCommand): Promise<Result<LiveAck>>;
  liveStatus(command: LiveCommand, token: string): Promise<Result<LiveStatus>>;
}
export interface LiveStatus { outcome: 'applied' | 'not-applied' | 'conflict'; receipt: LiveAck | null; targetChanged: boolean; currentScene?: LiveScene; currentCharacter?: Character }
export function checkedCharacterProfile(value: CharacterProfile): CharacterProfile {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) throw new Error('Ungültiges Charakterprofil.');
  const keys = ['name', 'playerName', 'species', 'characterClass', 'armorClass', 'passivePerception', 'speedFeet'];
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !keys.includes(key))) throw new Error('Unbekanntes Profilfeld.');
  for (const key of Reflect.ownKeys(value)) if (!('value' in Object.getOwnPropertyDescriptor(value, key)!)) throw new Error('Profil benötigt eigene Werte.');
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 1000) throw new Error('Charaktername fehlt.');
  for (const text of [value.playerName, value.species, value.characterClass]) if (text !== undefined && (typeof text !== 'string' || text.length > 1000)) throw new Error('Ungültiger Profiltext.');
  for (const number of [value.armorClass, value.passivePerception, value.speedFeet]) if (number !== undefined && (!Number.isSafeInteger(number) || number < 0)) throw new Error('Profilwerte müssen nichtnegative ganze Zahlen sein.');
  return { ...value };
}
export function validateLiveCommand(command: LiveCommand) {
  if (!command || ![command.commandId, command.campaignId, command.token].every(v => typeof v === 'string' && !!v && v.length <= 1000) || !command.action) throw new Error('Ungültiger Liveauftrag.');
  const action = command.action;
  if ('expectedRevision' in action && (!Number.isSafeInteger(action.expectedRevision) || action.expectedRevision < 0)) throw new Error('Ungültige Zielrevision.');
  if ('expectedRosterRevision' in action && (!Number.isSafeInteger(action.expectedRosterRevision) || action.expectedRosterRevision < 0)) throw new Error('Ungültige Partyrevision.');
  if ('expectedPlanRevision' in action && (!Number.isSafeInteger(action.expectedPlanRevision) || action.expectedPlanRevision < 0)) throw new Error('Ungültige Planrevision.');
  if (action.kind === 'move' && (!Number.isSafeInteger(action.expectedSceneMembershipRevision) || action.expectedSceneMembershipRevision < 0 || !Number.isSafeInteger(action.expectedFocusRevision) || action.expectedFocusRevision < 0)) throw new Error('Ungültige Gruppenrevision.');
  const fields = action as unknown as Record<string, unknown>;
  for (const key of ['characterId', 'sceneId', 'planId', 'visitId']) {
    const id = fields[key];
    if (key in fields && (typeof id !== 'string' || !id || id.length > 1000)) throw new Error('Ungültiges Änderungsziel.');
  }
  if ('locationId' in action && action.locationId !== null && (typeof action.locationId !== 'string' || !action.locationId || action.locationId.length > 1000)) throw new Error('Ungültiger Szenenort.');
  if(action.kind==='live-moment'&&(!['combat','narrative','reward','travel','party','world'].includes(action.category)||typeof action.title!=='string'||!action.title.trim()||action.title.length>1000||typeof action.summary!=='string'||action.summary.length>10000))throw new Error('Chronikeintrag benötigt einen Titel und höchstens 10.000 Zeichen Notiz.');
  if(action.kind==='live-moment'&&action.followUp!==undefined&&action.followUp!==null&&(!['quest','rumor'].includes(action.followUp.kind)||typeof action.followUp.id!=='string'||!action.followUp.id||action.followUp.id.length>1000))throw new Error('Ungültige Folgespur.');
}
