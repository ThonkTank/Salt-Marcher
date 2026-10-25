import type { CampaignCatalogCommand } from './campaign-contracts';

/** Shared by the writer and local intent recovery; validation never normalizes bytes. */
export function validateCampaignCatalogCommand(
  value: unknown,
): asserts value is CampaignCatalogCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Kampagnenauftrag ungültig.');
  const c = value as Record<string, unknown>;
  if (
    typeof c.commandId !== 'string' ||
    !c.commandId ||
    c.commandId.length > 128 ||
    !['create', 'open', 'rename', 'trash', 'erase'].includes(c.kind as string)
  )
    throw new Error('Kampagnenauftrag ungültig.');
  if (c.kind === 'create' || c.kind === 'rename')
    if (typeof c.name !== 'string' || !c.name.trim() || c.name.trim().length > 100)
      throw new Error('Kampagnenname benötigt 1–100 Zeichen.');
  if (c.kind !== 'create' && (typeof c.id !== 'string' || !c.id))
    throw new Error('Kampagnenkennung fehlt.');
  if (c.kind === 'rename' || c.kind === 'trash' || c.kind === 'erase')
    if (
      typeof c.expectedRevision !== 'number' ||
      !Number.isSafeInteger(c.expectedRevision) ||
      c.expectedRevision < 0
    )
      throw new Error('Kampagnenstand fehlt.');
  if (c.kind === 'trash' && typeof c.trashed !== 'boolean')
    throw new Error('Papierkorbaktion ungültig.');
  if (c.kind === 'erase' && typeof c.confirmName !== 'string')
    throw new Error('Löschbestätigung fehlt.');
}
