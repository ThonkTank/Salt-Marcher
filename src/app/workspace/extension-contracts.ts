import type { Result } from '../shared/contracts';
export const extensionRights = ['ownedUnits.read', 'ownedUnits.write'] as const;
export type ExtensionRight = (typeof extensionRights)[number];
export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  hostApi: 1;
  unitCodec: 'way-note:1';
  rights: ExtensionRight[];
}
export interface ExtensionPackage {
  format: 'Kampagnenwerkstatt Extension';
  version: 1;
  manifest: ExtensionManifest;
  renderer: { html: string; script: string; styles: string };
}
export interface ExtensionInfo {
  id: string;
  revision: number;
  generation: string;
  manifest: ExtensionManifest;
  hash: string;
  state: 'installed' | 'removed';
  grants: ExtensionRight[];
}
export interface ExtensionPreview {
  ticket: string;
  hash: string;
  bytes: number;
  manifest: ExtensionManifest;
  expectedRevision: number | null;
}
export type ExtensionAction =
  | {
      kind: 'install';
      ticket: string;
      hash: string;
      expectedRevision: number | null;
      rights: ExtensionRight[];
    }
  | { kind: 'revoke' | 'remove'; id: string; expectedRevision: number };
export interface ExtensionCommand {
  commandId: string;
  action: ExtensionAction;
}
const exact = (value: unknown, keys: string[]) =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype &&
  Reflect.ownKeys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const id = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9.-]{0,99}$/.test(value);
const revision = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 1;
export function checkedExtensionCommand(value: unknown): ExtensionCommand {
  if (!exact(value, ['commandId', 'action']))
    throw new Error('Installationsauftrag hat ein unbekanntes Format.');
  const command = value as ExtensionCommand;
  if (typeof command.commandId !== 'string' || !command.commandId || command.commandId.length > 128)
    throw new Error('Installationskennung fehlt.');
  const action: any = command.action;
  if (action?.kind === 'install') {
    if (
      !exact(action, ['kind', 'ticket', 'hash', 'expectedRevision', 'rights']) ||
      typeof action.ticket !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(action.ticket) ||
      typeof action.hash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(action.hash) ||
      (action.expectedRevision !== null && !revision(action.expectedRevision)) ||
      !Array.isArray(action.rights) ||
      action.rights.length > extensionRights.length ||
      new Set(action.rights).size !== action.rights.length ||
      action.rights.some((right: unknown) => !extensionRights.includes(right as ExtensionRight))
    )
      throw new Error('Installationsauftrag ist ungültig.');
  } else if (action?.kind === 'revoke' || action?.kind === 'remove') {
    if (
      !exact(action, ['kind', 'id', 'expectedRevision']) ||
      !id(action.id) ||
      !revision(action.expectedRevision)
    )
      throw new Error('Installationsauftrag ist ungültig.');
  } else throw new Error('Installationsaktion unbekannt.');
  return structuredClone(command);
}
export interface ExtensionPage {
  items: ExtensionInfo[];
  problems: { id: string; message: string }[];
  next: string | null;
}
export interface ExtensionAPI {
  extensionPreview(): Promise<Result<ExtensionPreview | null>>;
  extensions(after: string | null): Promise<Result<ExtensionPage>>;
  executeExtension(command: ExtensionCommand): Promise<Result<ExtensionInfo>>;
  extensionOutcome(command: ExtensionCommand): Promise<Result<ExtensionInfo | null>>;
}
