import { createHash, randomUUID } from 'node:crypto';
import type { CombatState, CombatLossBasis, CombatLossCandidate } from '../combat-contracts';
import { readNpc } from './npcs';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

/** Health belongs to runtime; durable defeat is a separate, explicit GM fact. */
export function combatNpcLosses(db: any, cam: string, combat: CombatState): CombatLossCandidate[] {
  const rows: CombatLossCandidate[] = [];
  for (const p of combat.participants) {
    if (!p.worldActorId) continue;
    const confirmed = combat.worldLosses?.some((l) => l.actorId === p.worldActorId),
      note = db
        .prepare(
          "SELECT trashed,json_extract(payload,'$.kind') kind FROM world_note WHERE campaign_id=? AND id=?",
        )
        .get(cam, p.worldActorId);
    if (!note || note.kind !== 'npc') {
      if (confirmed)
        rows.push({
          participantId: p.id,
          actorId: p.worldActorId,
          name: p.name,
          combatHp: p.hp,
          status: 'confirmed',
          basis: null,
        });
      continue;
    }
    if (note.trashed) {
      rows.push({
        participantId: p.id,
        actorId: p.worldActorId,
        name: p.name,
        combatHp: p.hp,
        status: confirmed ? 'confirmed' : 'unavailable',
        basis: null,
      });
      continue;
    }
    const npc = readNpc(db, cam, p.worldActorId),
      basis =
        npc.actorRevision === null
          ? null
          : {
              participantId: p.id,
              actorId: npc.id,
              noteRevision: npc.noteRevision,
              recordRevision: npc.record.revision,
              actorRevision: npc.actorRevision,
            };
    rows.push({
      participantId: p.id,
      actorId: npc.id,
      name: npc.name,
      combatHp: p.hp,
      status: confirmed
        ? 'confirmed'
        : npc.record.lifecycle === 'defeated'
          ? 'defeated'
          : basis
            ? 'available'
            : 'unavailable',
      basis,
    });
  }
  return rows;
}

export function confirmCombatNpcLosses(
  db: any,
  cam: string,
  combat: CombatState,
  losses: CombatLossBasis[],
) {
  if (combat.phase !== 'finished')
    throw new Error('NPC-Verluste erst nach dem bestätigten Kampfabschluss übernehmen.');
  if (
    !Array.isArray(losses) ||
    !losses.length ||
    losses.length > 1000 ||
    new Set(losses.map((l) => l?.actorId)).size !== losses.length
  )
    throw new Error('Wähle eindeutige NPC-Verluste.');
  const candidates = combatNpcLosses(db, cam, combat),
    records = losses.map((b) => {
      const candidate = candidates.find(
        (c) => c.participantId === b?.participantId && c.actorId === b?.actorId,
      );
      if (
        !candidate ||
        candidate.status !== 'available' ||
        !candidate.basis ||
        (
          ['participantId', 'actorId', 'noteRevision', 'recordRevision', 'actorRevision'] as const
        ).some((k) => candidate.basis![k] !== b[k])
      )
        throw new Error(
          'NPC-Verlustauswahl inzwischen geändert oder bereits bestätigt. Nachbereitung aktualisieren.',
        );
      return readNpc(db, cam, b.actorId);
    });
  // Validate the complete selection before changing any canonical World record.
  const before = records.map((n) => n.record),
    after = records.map((n) => ({
      ...n.record,
      revision: n.record.revision + 1,
      lifecycle: 'defeated' as const,
    }));
  for (const r of after) {
    const payload = JSON.stringify(r);
    db.prepare(
      'INSERT INTO npc_record VALUES(?,?,?,?,?,?) ON CONFLICT(campaign_id,id) DO UPDATE SET faction_id=excluded.faction_id,revision=excluded.revision,payload=excluded.payload,checksum=excluded.checksum',
    ).run(cam, r.id, r.factionId, r.revision, payload, hash(payload));
  }
  combat.worldLosses = [
    ...(combat.worldLosses ?? []),
    ...records.map((n, i) => ({
      actorId: n.id,
      name: n.name,
      recordRevision: after[i]!.revision,
    })),
  ];
  const body = JSON.stringify({
    kind: 'npc-losses',
    text: 'Kampfverluste bestätigt: ' + records.map((n) => n.name).join(', '),
    combatId: combat.id,
    recordedAt: new Date().toISOString(),
    facts: { before, after },
  });
  db.prepare('INSERT INTO world_history VALUES(?,?,?,?,?)').run(
    cam,
    randomUUID(),
    combat.sceneId,
    body,
    hash(body),
  );
}
