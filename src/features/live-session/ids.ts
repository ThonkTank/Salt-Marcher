type OpaqueId<Name extends string> = string & { readonly __opaqueId: Name };

export type CampaignId = OpaqueId<"CampaignId">;
export type CharacterId = OpaqueId<"CharacterId">;
export type LiveSceneId = OpaqueId<"LiveSceneId">;
export type MaskId = OpaqueId<"MaskId">;
export type OwnerId = OpaqueId<"OwnerId">;
export type CommandId = OpaqueId<"CommandId">;
export type CommandDigest = OpaqueId<"CommandDigest">;
export type PreparationId = OpaqueId<"PreparationId">;
export type ReferenceId = OpaqueId<"ReferenceId">;
export type Revision = number & { readonly __revision: true };

function opaque<Name extends string>(
  value: unknown,
  label: string,
): OpaqueId<Name> {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    throw new Error(`${label} ist keine gültige opaque Kennung.`);
  return value as OpaqueId<Name>;
}

export const campaignId = (value: unknown, label = "campaignId"): CampaignId =>
  opaque<"CampaignId">(value, label);
export const characterId = (
  value: unknown,
  label = "characterId",
): CharacterId => opaque<"CharacterId">(value, label);
export const liveSceneId = (
  value: unknown,
  label = "liveSceneId",
): LiveSceneId => opaque<"LiveSceneId">(value, label);
export const maskId = (value: unknown, label = "maskId"): MaskId =>
  opaque<"MaskId">(value, label);
export const ownerId = (value: unknown, label = "ownerId"): OwnerId =>
  opaque<"OwnerId">(value, label);
export const commandId = (value: unknown, label = "commandId"): CommandId =>
  opaque<"CommandId">(value, label);
export const commandDigest = (
  value: unknown,
  label = "commandDigest",
): CommandDigest => opaque<"CommandDigest">(value, label);
export const preparationId = (
  value: unknown,
  label = "preparationId",
): PreparationId => opaque<"PreparationId">(value, label);
export const referenceId = (
  value: unknown,
  label = "referenceId",
): ReferenceId => opaque<"ReferenceId">(value, label);

export function revision(value: unknown, label = "revision"): Revision {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error(`${label} ist keine nichtnegative sichere Revision.`);
  return value as Revision;
}
