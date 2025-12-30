// Landmark-Presets für CLI-Testing und Plugin-Bundling
// Siehe: docs/entities/landmark.md

import { z } from 'zod';
import { landmarkSchema } from '../../src/types/entities/landmark';

// ============================================================================
// PRESET-SCHEMA
// ============================================================================

export const landmarkPresetSchema = landmarkSchema;
export const landmarkPresetsSchema = z.array(landmarkPresetSchema);

// ============================================================================
// PRESET-DATEN: Küstendorf-Karte
// ============================================================================
//
// Landmarks auf der Küstendorf-Overworld-Karte:
// - coastal-village: Sicheres Dorf im Zentrum
// - goblin-cave, watchtower-ruins: Bergstamm-Territorium (Nord)
// - smuggler-cove, lighthouse-ruins: Schmuggler-Territorium (West)
// - forest-shrine: Neutraler Ort im Wald

export const landmarkPresets = landmarkPresetsSchema.parse([
  // ──────────────────────────────────────────────────────────────────────────
  // Dorf (Ring 0)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'coastal-village',
    mapId: 'coastal-village-map',
    position: { q: 0, r: 0 },
    name: 'Küstendorf',
    icon: 'home',
    visible: true,
    description: 'Ein kleines Fischerdorf an der Küste.',
    gmNotes: 'Sicher. Taverne "Zum Salzigen Seehund" ist Treffpunkt für Gerüchte.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Goblin-Territorium (Ring 3 Nord)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'goblin-cave',
    mapId: 'coastal-village-map',
    position: { q: -1, r: 3 },
    name: 'Goblin-Höhle',
    icon: 'cave',
    visible: false,
    description: 'Ein schmaler Spalt im Fels, verdeckt durch Gestrüpp.',
    linkedMapId: 'goblin-cave-dungeon',
    spawnPosition: { q: 0, r: 0 },
  },
  {
    id: 'watchtower-ruins',
    mapId: 'coastal-village-map',
    position: { q: 0, r: 3 },
    name: 'Alter Wachturm',
    icon: 'tower',
    visible: true,
    height: 100,
    description: 'Eine verfallene Ruine aus längst vergessenen Zeiten.',
    gmNotes: 'Goblins nutzen den Turm als Aussichtsposten.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Schmuggler-Territorium (Ring 3 West)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'smuggler-cove',
    mapId: 'coastal-village-map',
    position: { q: -3, r: 0 },
    name: 'Schmuggler-Bucht',
    icon: 'anchor',
    visible: false,
    description: 'Eine Höhle hinter den Klippen, nur bei Ebbe zugänglich.',
    linkedMapId: 'smuggler-cove-dungeon',
    spawnPosition: { q: 0, r: 0 },
  },
  {
    id: 'lighthouse-ruins',
    mapId: 'coastal-village-map',
    position: { q: -3, r: 1 },
    name: 'Leuchtturm-Ruine',
    icon: 'lighthouse',
    visible: true,
    height: 60,
    glowsAtNight: true,
    description: 'Ein halb eingestürzter Leuchtturm. Nachts glimmt ein schwaches Licht.',
    gmNotes: 'Magisches Everbright-Licht. Schmuggler nutzen es als Orientierung.',
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Neutral (Ring 2)
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'forest-shrine',
    mapId: 'coastal-village-map',
    position: { q: -2, r: 2 },
    name: 'Moosbedeckter Schrein',
    icon: 'altar',
    visible: true,
    description: 'Ein uralter Schrein, überwuchert von Moos und Efeu.',
  },
]);

export default landmarkPresets;
