// NPC-Presets für CLI-Testing
// Siehe: docs/entities/npc.md

import { z } from 'zod';
import { npcSchema } from '../../src/types/entities/npc';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const npcPresetSchema = npcSchema;
export const npcPresetsSchema = z.array(npcPresetSchema);

// ============================================================================
// PRESET-DATEN
// ============================================================================

export const npcPresets = npcPresetsSchema.parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Bergstamm-Goblins
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'griknak',
    name: 'Griknak der Hinkende',
    creature: { type: 'goblin', id: 'goblin' },
    factionId: 'bergstamm',
    personality: 'cunning',
    value: 'survival',
    quirk: 'Hinkt auf dem linken Bein',
    goal: 'Will den Boss beeindrucken',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 10, segment: 'morning' },
    lastEncounter: { year: 1, month: 1, day: 5, hour: 14, segment: 'afternoon' },
    encounterCount: 2,
    lastKnownPosition: { q: 3, r: -2 },
    currentHp: [[7, 1]],
    maxHp: 7,
  },
  {
    id: 'snaggle',
    name: 'Snaggle Zahnlos',
    creature: { type: 'goblin', id: 'goblin' },
    factionId: 'bergstamm',
    personality: 'greedy',
    value: 'wealth',
    goal: 'Schatz finden',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 10, hour: 8, segment: 'morning' },
    lastEncounter: { year: 1, month: 1, day: 10, hour: 8, segment: 'morning' },
    encounterCount: 1,
    currentHp: [[7, 1]],
    maxHp: 7,
  },
  {
    id: 'borgrik',
    name: 'Borgrik Scharfauge',
    creature: { type: 'hobgoblin', id: 'hobgoblin' },
    factionId: 'bergstamm',
    personality: 'disciplined',
    value: 'power',
    quirk: 'Schärft ständig seine Waffe',
    goal: 'Beförderung zum Kriegshauptmann',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 3, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 7, hour: 18, segment: 'dusk' },
    encounterCount: 3,
    lastKnownPosition: { q: 5, r: -4 },
    currentHp: [[11, 1]],
    maxHp: 11,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Küstenschmuggler
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'schwarzer-jack',
    name: 'Schwarzer Jack',
    creature: { type: 'bandit', id: 'bandit' },
    factionId: 'schmuggler',
    personality: 'suspicious',
    value: 'wealth',
    quirk: 'Zählt ständig seine Münzen',
    goal: 'Reich werden',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 3, hour: 16, segment: 'afternoon' },
    lastEncounter: { year: 1, month: 1, day: 8, hour: 20, segment: 'dusk' },
    encounterCount: 3,
    lastKnownPosition: { q: -5, r: 2 },
    currentHp: [[11, 1]],
    maxHp: 11,
  },
  {
    id: 'einaeugiger-pete',
    name: 'Einäugiger Pete',
    creature: { type: 'thug', id: 'thug' },
    factionId: 'schmuggler',
    personality: 'loyal',
    value: 'revenge',
    quirk: 'Reibt sich die Narbe über dem fehlenden Auge',
    goal: 'Den Verräter finden, der ihm das Auge genommen hat',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 5, hour: 22, segment: 'night' },
    lastEncounter: { year: 1, month: 1, day: 5, hour: 22, segment: 'night' },
    encounterCount: 1,
    currentHp: [[32, 1]],
    maxHp: 32,
  },
  {
    id: 'kapitaen-moreno',
    name: 'Kapitän Moreno',
    creature: { type: 'bandit-captain', id: 'bandit-captain' },
    factionId: 'schmuggler',
    personality: 'cunning',
    value: 'wealth',
    quirk: 'Poliert ständig seine Pistole',
    goal: 'Die Schmuggelrouten kontrollieren',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 10, hour: 14, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 10, hour: 14, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[52, 1]],
    maxHp: 52,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Fraktionslose NPCs (factionId weggelassen = undefined)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'einsamer-wolf',
    name: 'Graufell',
    creature: { type: 'wolf', id: 'wolf' },
    // factionId weggelassen = undefined (nicht null)
    personality: 'territorial',
    value: 'survival',
    goal: 'Rudel finden',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 2, hour: 6, segment: 'dawn' },
    lastEncounter: { year: 1, month: 1, day: 2, hour: 6, segment: 'dawn' },
    encounterCount: 1,
    lastKnownPosition: { q: 2, r: 1 },
    currentHp: [[11, 1]],
    maxHp: 11,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Test-Szenario NPCs: Aura-Clustering (Hobgoblin Captain + Goblins)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'captain-krug',
    name: 'Hauptmann Krug',
    creature: { type: 'hobgoblin-captain', id: 'hobgoblin-captain' },
    factionId: 'bergstamm',
    personality: 'disciplined',
    value: 'power',
    quirk: 'Brüllt Befehle auf Goblin',
    goal: 'Die Truppe zum Sieg führen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[58, 1]],
    maxHp: 58,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Test-Szenario NPCs: Bloodied Escalation (Berserkers)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'berserker-ragnar',
    name: 'Ragnar der Wilde',
    creature: { type: 'berserker', id: 'berserker' },
    personality: 'aggressive',
    value: 'glory',
    quirk: 'Lacht im Kampf',
    goal: 'Einen würdigen Tod finden',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[67, 1]],
    maxHp: 67,
  },
  {
    id: 'berserker-bjorn',
    name: 'Bjorn Blutaxt',
    creature: { type: 'berserker', id: 'berserker' },
    personality: 'aggressive',
    value: 'glory',
    quirk: 'Beißt auf seine Axt',
    goal: 'Den Feind zermalmen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[67, 1]],
    maxHp: 67,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Test-Szenario NPCs: Knights (Party)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'knight-aldric',
    name: 'Sir Aldric',
    creature: { type: 'knight', id: 'knight' },
    personality: 'honorable',
    value: 'justice',
    quirk: 'Poliert ständig sein Schwert',
    goal: 'Das Reich verteidigen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[52, 1]],
    maxHp: 52,
  },
  {
    id: 'knight-elara',
    name: 'Dame Elara',
    creature: { type: 'knight', id: 'knight' },
    personality: 'protective',
    value: 'duty',
    quirk: 'Betet vor jedem Kampf',
    goal: 'Die Schwachen beschützen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[52, 1]],
    maxHp: 52,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Test-Szenario NPCs: Scouts (Kiting Party)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'scout-finn',
    name: 'Finn Schnellfuß',
    creature: { type: 'scout', id: 'scout' },
    personality: 'cautious',
    value: 'survival',
    quirk: 'Prüft ständig den Wind',
    goal: 'Sicher nach Hause kommen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[16, 1]],
    maxHp: 16,
  },
  {
    id: 'scout-mira',
    name: 'Mira Waldhüterin',
    creature: { type: 'scout', id: 'scout' },
    personality: 'observant',
    value: 'knowledge',
    quirk: 'Summt leise vor sich hin',
    goal: 'Alles sehen, nichts verpassen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[16, 1]],
    maxHp: 16,
  },
  {
    id: 'scout-thorn',
    name: 'Thorn der Stille',
    creature: { type: 'scout', id: 'scout' },
    personality: 'quiet',
    value: 'precision',
    quirk: 'Spricht nur wenn nötig',
    goal: 'Nie einen Schuss verfehlen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[16, 1]],
    maxHp: 16,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Test-Szenario NPCs: Ogre (Glass Cannon)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'ogre-grok',
    name: 'Grok der Zerstörer',
    creature: { type: 'ogre', id: 'ogre' },
    personality: 'aggressive',
    value: 'food',
    quirk: 'Sabbert beim Kämpfen',
    goal: 'Alles zertrümmern und fressen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[68, 1]],
    maxHp: 68,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Test-Szenario NPCs: Priest (Healer)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'priest-marcus',
    name: 'Bruder Marcus',
    creature: { type: 'priest', id: 'priest' },
    personality: 'compassionate',
    value: 'faith',
    quirk: 'Murmelt ständig Gebete',
    goal: 'Die Verwundeten heilen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[38, 1]],
    maxHp: 38,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Test-Szenario NPCs: Bugbears (Grapplers)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'bugbear-gruk',
    name: 'Gruk Langarm',
    creature: { type: 'bugbear-warrior', id: 'bugbear-warrior' },
    personality: 'patient',
    value: 'trophies',
    quirk: 'Streichelt seine Beute',
    goal: 'Neue Gefangene machen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[33, 1]],
    maxHp: 33,
  },
  {
    id: 'bugbear-thrak',
    name: 'Thrak Würger',
    creature: { type: 'bugbear-warrior', id: 'bugbear-warrior' },
    personality: 'sadistic',
    value: 'fear',
    quirk: 'Knackt mit den Fingern',
    goal: 'Die Beute langsam zerquetschen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[33, 1]],
    maxHp: 33,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Test-Szenario NPCs: Gnoll Warriors
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'gnoll-yipp',
    name: 'Yipp der Jäger',
    creature: { type: 'gnoll-warrior', id: 'gnoll-warrior' },
    personality: 'feral',
    value: 'hunt',
    quirk: 'Schnüffelt ständig',
    goal: 'Beute reißen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[27, 1]],
    maxHp: 27,
  },
  {
    id: 'gnoll-krak',
    name: 'Krak der Verschlinger',
    creature: { type: 'gnoll-warrior', id: 'gnoll-warrior' },
    personality: 'hungry',
    value: 'food',
    quirk: 'Kaut auf Knochen',
    goal: 'Alles fressen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[27, 1]],
    maxHp: 27,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Test-Szenario NPCs: Owlbear (Brute)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'owlbear-grimclaw',
    name: 'Grimclaw',
    creature: { type: 'owlbear', id: 'owlbear' },
    personality: 'territorial',
    value: 'survival',
    quirk: 'Kreischt bei Annäherung',
    goal: 'Revier verteidigen',
    status: 'alive',
    firstEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    lastEncounter: { year: 1, month: 1, day: 1, hour: 12, segment: 'midday' },
    encounterCount: 1,
    currentHp: [[59, 1]],
    maxHp: 59,
  },
]);

export default npcPresets;
