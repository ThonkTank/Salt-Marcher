import { checkedCombat } from '../combat-contracts';
import { checkedChaseView } from '../chase-contracts';
import { checkedDefinition } from '../item-definition-validation';
import { createHash } from 'node:crypto';
import {
  checkedCommitReference,
  type CommitReference,
  type CommitOutcome,
} from '../commit-receipt';

export function readCommitReceipt(db: any, ref: CommitReference): CommitOutcome {
  checkedCommitReference(ref);
  const table =
    ref.family === 'session'
      ? 'session_receipt'
      : ref.family === 'progress'
        ? 'progress_receipt'
        : ref.family === 'combat'
          ? 'combat_receipt'
          : ref.family === 'chase'
            ? 'chase_receipt'
            : 'shop_receipt';
  const row = db
    .prepare(`SELECT campaign_id,fingerprint,payload,checksum FROM ${table} WHERE command_id=?`)
    .get(ref.commandId);
  if (!row) return { outcome: 'not-applied' };
  if (row.campaign_id !== ref.campaignId || row.fingerprint !== ref.fingerprint)
    throw new Error('Buchungskennung wurde anders verwendet.');
  if (createHash('sha256').update(row.payload).digest('hex') !== row.checksum)
    throw new Error('Buchungsbeleg ist beschädigt. Originaldaten bleiben erhalten.');
  const value = JSON.parse(row.payload);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Buchungsbeleg hat ein ungültiges Format.');
  if (ref.family === 'session') {
    if (
      !value.profile ||
      typeof value.profile.planId !== 'string' ||
      !Number.isSafeInteger(value.profile.revision) ||
      !Array.isArray(value.visits) ||
      !Array.isArray(value.groups) ||
      !Array.isArray(value.encounters)
    )
      throw new Error('Spielabendbeleg hat ein unbekanntes Format.');
    if (
      !db
        .prepare('SELECT 1 FROM plan WHERE campaign_id=? AND id=?')
        .get(ref.campaignId, value.profile.planId)
    )
      throw new Error('Spielabendbeleg gehört nicht zum gespeicherten Plan.');
  } else if (ref.family === 'progress') {
    if (
      !Array.isArray(value.characters) ||
      !Array.isArray(value.notices) ||
      !Array.isArray(value.ledgerIds) ||
      value.ledgerIds.some((id: unknown) => typeof id !== 'string') ||
      (value.treasureId !== null && typeof value.treasureId !== 'string')
    )
      throw new Error('Fortschrittsbeleg hat ein unbekanntes Format.');
  } else if (ref.family === 'combat') {
    if (!value.combat || !Array.isArray(value.recent) || typeof value.canUndo !== 'boolean')
      throw new Error('Kampfbeleg hat ein unbekanntes Format.');
    checkedCombat(value.combat);
    if (
      !db
        .prepare('SELECT 1 FROM combat WHERE campaign_id=? AND id=? AND scene_id=?')
        .get(ref.campaignId, value.combat.id, value.combat.sceneId)
    )
      throw new Error('Kampfbeleg gehört nicht zum gespeicherten Kampf.');
  } else if (ref.family === 'chase') {
    checkedChaseView(value);
    if (
      value.chase &&
      !db
        .prepare('SELECT 1 FROM chase WHERE campaign_id=? AND id=? AND scene_id=?')
        .get(ref.campaignId, value.chase.id, value.chase.sceneId)
    )
      throw new Error('Verfolgungsbeleg gehört nicht zur gespeicherten Verfolgung.');
  } else {
    if (!value.definition && !value.shop)
      throw new Error('Shopbeleg hat kein bestätigtes Ergebnis.');
    if (value.definition) checkedDefinition(value.definition);
    if (value.shop) {
      const s = value.shop;
      if (
        !s.shop ||
        typeof s.shop.id !== 'string' ||
        !Number.isSafeInteger(s.shop.revision) ||
        s.shop.revision < 1 ||
        !Array.isArray(s.shop.stock) ||
        !Array.isArray(s.items) ||
        !Array.isArray(s.history) ||
        typeof s.ownerName !== 'string' ||
        typeof s.unavailable !== 'boolean'
      )
        throw new Error('Shopbeleg hat ein unbekanntes Format.');
      for (const d of s.items) checkedDefinition(d);
    }
  }
  return { outcome: 'applied', value };
}
