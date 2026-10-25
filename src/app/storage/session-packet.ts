import { restLabel } from '../session-day';
import { readNarrative } from './narrative';
import { readSessionProgress } from './visit-outcomes';
import { visitOutcomeLabel } from '../visit-outcome-contracts';
import { createHash } from 'node:crypto';
import { readSession } from './session';
import { checkedLocationDocument } from '../../features/location/location-schema';
import { worldNoteDocument } from '../../features/world/world-notes';
import { SRD_5_1_NOTICE } from '../../features/catalog/creature-catalog';
import { assessEncounter, encounterEntryLabel } from '../encounter-contracts';
import type { SessionPacket, SessionPacketBlock } from '../session-packet-contracts';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
function payload(row: any) {
  if (hash(row.payload) !== row.checksum) throw new Error('Eine Mappenquelle ist beschädigt.');
  return JSON.parse(row.payload);
}
export function readSessionPacket(db: any, cam: string, planId: string): SessionPacket {
  return db.transaction(() => {
    const session = readSession(db, cam, planId),
      plan = session.plan,
      warnings: string[] = [];
    const cache = new Map<string, SessionPacketBlock[]>(),
      locations = new Map<string, string>();
    const note = (id: string): SessionPacketBlock[] => {
      const key = 'note:' + id;
      if (cache.has(key)) return cache.get(key)!;
      const row = db.prepare('SELECT * FROM world_note WHERE campaign_id=? AND id=?').get(cam, id);
      if (!row || row.trashed) {
        warnings.push('Weltverweis ' + id + ' fehlt oder liegt im Papierkorb.');
        cache.set(key, []);
        return [];
      }
      const n = worldNoteDocument(payload(row)),
        action = { kind: 'reference' as const, ref: { kind: 'note' as const, id: n.id } },
        blocks: SessionPacketBlock[] = [
          {
            heading:
              n.title +
              ' · ' +
              {
                note: 'Notiz',
                npc: 'NSC',
                faction: 'Fraktion',
                quest: 'Quest',
                rumor: 'Gerücht',
                rule: 'Regelreferenz',
              }[n.kind],
            text: n.gmNotes,
            kind: 'reference',
            action,
          },
        ];
      if (n.kind === 'quest' || n.kind === 'rumor') {
        const v = readNarrative(db, cam, n.id);
        blocks.push({
          heading: n.title + ' · Status und Belohnung',
          kind: 'gm',
          action,
          text: [
            v.state.status === 'closed' ? 'Geschlossen' : 'Offen',
            v.award ? 'Belohnung bereits vergeben' : v.state.poolXp + ' Gruppen-XP vorbereitet',
            ...(!v.award ? v.state.items.map((i) => i.quantity + ' × ' + i.name) : []),
            v.award ? 'Bestätigtes Ergebnis · ' + v.award.recordedAt + '\n' + v.award.outcome : '',
            v.draft ? 'Gesicherte Eingabe vorhanden; diese Mappe zeigt den bestätigten Stand.' : '',
          ]
            .filter(Boolean)
            .join('\n'),
        });
      }
      if (n.readAloud.trim())
        blocks.unshift({
          heading: n.title + ' · Zum Vorlesen',
          text: n.readAloud,
          kind: 'read-aloud',
          action,
        });
      if (n.relations.length)
        blocks.push({
          heading: n.title + ' · Beziehungen',
          text: n.relations
            .map((r) => {
              const target = db
                .prepare(
                  'SELECT payload,checksum,trashed FROM world_note WHERE campaign_id=? AND id=?',
                )
                .get(cam, r.targetId);
              return (
                r.label +
                ' → ' +
                (target && !target.trashed ? worldNoteDocument(payload(target)).title : r.targetId)
              );
            })
            .join('\n'),
          kind: 'reference',
          action,
        });
      cache.set(key, blocks);
      return blocks;
    };
    const location = (id: string): SessionPacketBlock[] => {
      const key = 'location:' + id;
      if (cache.has(key)) return cache.get(key)!;
      const row = db.prepare('SELECT * FROM location WHERE campaign_id=? AND id=?').get(cam, id);
      if (!row || row.trashed) {
        warnings.push('Ort ' + id + ' fehlt oder liegt im Papierkorb.');
        cache.set(key, []);
        return [];
      }
      const l = checkedLocationDocument(payload(row));
      locations.set(id, l.name);
      const blocks = l.sections
        .filter((s) => s.markdown.trim())
        .map((s) => ({
          heading: l.name + ' · ' + s.title,
          text: s.markdown,
          kind: 'reference' as const,
          action: { kind: 'reference' as const, ref: { kind: 'location' as const, id: l.id } },
        }));
      cache.set(key, blocks);
      return blocks;
    };
    const progress = readSessionProgress(db, cam, planId);
    const visits = plan.scenes.map((v, index) => {
      const detail = session.visits[index]!,
        blocks: SessionPacketBlock[] = [];
      if (detail.readAloud.trim())
        blocks.push({ heading: 'Zum Vorlesen', text: detail.readAloud, kind: 'read-aloud' });
      if (v.notes.trim()) blocks.push({ heading: 'GM-Notizen', text: v.notes, kind: 'gm' });
      if (v.locationId) blocks.push(...location(v.locationId));
      const noteIds = new Set(detail.noteIds);
      for (const id of detail.groupIds) {
        const g = session.groups.find((g) => g.id === id);
        if (!g) {
          warnings.push('Begegnung ' + id + ' fehlt.');
          continue;
        }
        const assessment = assessEncounter(
          session.profile.party,
          g.plan.entries.map((e) => ({
            xp: g.plan.sources.find((c) => c.id === e.creatureId)?.xp,
            count: e.count,
          })),
        );
        const text = [
          g.notes,
          'Status: ' + (g.locationId ? 'am Ort platziert' : 'vorbereitet, noch nicht platziert'),
          'XP ' +
            assessment.baseXp +
            ' · gewichtet ' +
            assessment.adjustedXp +
            ' · ' +
            (assessment.difficulty ?? 'keine bewertbare Planungsparty'),
          ...g.plan.entries.map((e) => encounterEntryLabel(e, g.plan.sources)),
          ...g.actors.map(
            (a) =>
              a.name +
              ': HP ' +
              a.hp +
              '/' +
              a.maxHp +
              (a.tempHp ? ' + ' + a.tempHp + ' temporär' : '') +
              (a.conditions ? ' · ' + a.conditions : '') +
              (a.defeated ? ' · besiegt' : '') +
              (a.unavailable ? ' · nicht verfügbar' : ''),
          ),
        ]
          .filter(Boolean)
          .join('\n');
        blocks.push({
          heading: 'Begegnung: ' + g.title,
          text,
          kind: 'encounter',
          action: { kind: 'encounter', groupId: g.id, groupRevision: g.revision },
        });
        for (const a of g.actors) noteIds.add(a.id);
        for (const c of g.plan.sources) {
          if (!g.plan.entries.some((e) => e.creatureId === c.id)) continue;
          const normalized = (text: string) => text.trim().replace(/\s+/g, ' ');
          const details = [...c.traits, ...c.actions, ...c.legendaryActions].some(
            (a) => normalized(a.description) === normalized(c.details),
          )
            ? ''
            : c.details;
          const text = [
            `${c.size} ${c.type} · HG ${c.challengeRating} · ${c.xp} XP`,
            `RK ${c.ac} · HP ${c.hp} (${c.hitDice}) · Tempo ${c.speed}`,
            Object.entries(c.abilities)
              .map(([k, v]) => k.toUpperCase() + ' ' + v)
              .join(' · '),
            ...[
              ['Rettungswürfe', c.savingThrows],
              ['Fertigkeiten', c.skills],
              ['Sinne', c.senses],
              ['Sprachen', c.languages],
              ['Empfindlichkeiten', c.damageVulnerabilities],
              ['Resistenzen', c.damageResistances],
              ['Immunitäten', c.damageImmunities],
              ['Zustandsimmunitäten', c.conditionImmunities],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => k + ': ' + v),
            ...c.traits.map((a) => 'Merkmal: ' + a.name + '\n' + a.description),
            ...c.actions.map((a) => 'Aktion: ' + a.name + '\n' + a.description),
            ...c.legendaryActions.map((a) => 'Legendäre Aktion: ' + a.name + '\n' + a.description),
            details,
            'Quelle: ' + c.sourceLabel + ' · ' + c.sourceVersion + '\n' + SRD_5_1_NOTICE,
          ]
            .filter(Boolean)
            .join('\n\n');
          blocks.push({ heading: 'Statblock: ' + c.name, text, kind: 'encounter' });
        }
      }
      for (const id of noteIds) blocks.push(...note(id));
      const r = detail.reward;
      if (r)
        blocks.push({
          heading: 'Belohnung',
          kind: 'reward',
          action: { kind: 'reward' },
          text: [
            r.poolXp + ' Gruppen-XP',
            r.awarded ? 'XP bereits vergeben' : 'XP noch nicht vergeben',
            r.placedTreasureId ? 'Beute bereits platziert' : 'Beute noch nicht platziert',
            ...r.items.map(
              (i) => `${i.quantity} × ${i.name} · ${i.valueGold} GM je Stück · ${i.category}`,
            ),
          ].join('\n'),
        });
      if (detail.allocationXp !== undefined)
        blocks.push({
          heading: 'Geplantes Szenenbudget',
          kind: 'gm',
          text: detail.allocationXp + ' angepasste XP · Ziel für diese Szene',
        });
      if (detail.restAfter)
        blocks.push({
          heading: restLabel(detail.restAfter.kind) + ' nach dieser Szene',
          kind: 'gm',
          text:
            'Vor ' +
            (plan.scenes[index + 1]?.title || 'der nächsten Szene') +
            '. Beim Spielen ausdrücklich rasten; dieser Eintrag plant nur die Pause.',
        });
      const played = progress.visits[index]!;
      if (played.count)
        blocks.push({
          heading: 'Spielverlauf · ' + played.count + ' Übernahmen',
          kind: 'gm',
          text:
            played.occurrences
              .map(
                (o) =>
                  (o.sceneTitle || 'Gruppe') +
                  ' · ' +
                  (o.outcome
                    ? visitOutcomeLabel(o.outcome.status)
                    : 'Begonnen, Ergebnis noch offen') +
                  (o.outcome ? ' · ' + o.outcome.recordedAt + '\n' + o.outcome.text : ''),
              )
              .join('\n\n') +
            (played.count > 5 ? '\n\nNur die fünf neuesten Übernahmen angezeigt.' : ''),
        });
      return {
        id: v.id,
        title: v.title || 'Besuch ' + (index + 1),
        locationId: v.locationId,
        location: v.locationId ? (locations.get(v.locationId) ?? 'Nicht verfügbarer Ort') : null,
        blocks,
      };
    });
    const p = {
      planId: plan.id,
      planName: plan.name,
      planRevision: plan.revision,
      campaignName: db.prepare('SELECT name FROM campaign WHERE id=?').get(cam).name,
      party: session.profile.party.map(
        (p) => p.count + ' × ' + (p.name || 'Figur') + ' · Stufe ' + (p.level ?? '?'),
      ),
      visits,
      warnings,
    };
    return { ...p, basis: hash(JSON.stringify(p)) };
  })();
}
