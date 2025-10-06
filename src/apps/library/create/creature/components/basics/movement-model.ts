// src/apps/library/create/creature/components/basics/movement-model.ts
// Movement-Model für den Movement-Editor

import type {
  CreatureSpeedExtra,
  CreatureSpeedValue,
  StatblockData,
} from "../../../core/creature-files";
import type { CreatureMovementType } from "../../presets";
import type { MovementEditorModel, MovementEntry } from "../../section-utils";

type SpeedFieldKey = Exclude<CreatureMovementType, never>;
type SpeedRecord = Record<SpeedFieldKey, CreatureSpeedValue | undefined> & {
  extras?: CreatureSpeedExtra[];
};

/**
 * Ensures data.speeds exists and has extras array
 */
function ensureSpeeds(data: StatblockData): SpeedRecord {
  const speeds = (data.speeds ??= {});
  if (!Array.isArray(speeds.extras)) speeds.extras = [];
  return speeds as SpeedRecord;
}

/**
 * Applies a speed value patch, removing the field if empty
 */
function applySpeedValue(
  data: StatblockData,
  key: SpeedFieldKey,
  patch: Partial<CreatureSpeedValue>
) {
  const speeds = ensureSpeeds(data);
  const prev = speeds[key] ?? {};
  const next: CreatureSpeedValue = { ...prev, ...patch };
  const hasContent = Boolean(next.distance?.trim()) || next.hover || Boolean(next.note?.trim());
  if (hasContent) speeds[key] = next;
  else delete speeds[key];
}

/**
 * Creates movement model for the movement editor
 *
 * Handles both standard movement types (walk, fly, swim, etc.) and custom extras.
 * Standard types are stored directly in data.speeds.{type}, extras are stored in data.speeds.extras[].
 *
 * @param data - The statblock data to read/write
 * @param movementTypes - List of standard movement types (e.g., [["walk", "Walk"], ["fly", "Fly"]])
 * @returns MovementEditorModel with get, add, remove, update methods
 *
 * @example
 * ```ts
 * const model = createMovementModel(data, CREATURE_MOVEMENT_TYPES);
 * model.add({ type: "walk", label: "Walk", distance: "30 ft.", hover: false });
 * model.add({ type: "custom", label: "Burrowing", distance: "10 ft.", hover: false });
 * const entries = model.get(); // Returns all movement entries
 * ```
 */
export function createMovementModel(
  data: StatblockData,
  movementTypes: ReadonlyArray<readonly [CreatureMovementType, string]>
): MovementEditorModel {
  return {
    get: () => {
      const speeds = ensureSpeeds(data);
      const entries: MovementEntry[] = [];

      // Standard movement types
      for (const [type, label] of movementTypes) {
        const speed = speeds[type as SpeedFieldKey];
        if (speed?.distance) {
          entries.push({
            type,
            label,
            distance: speed.distance,
            hover: speed.hover,
          });
        }
      }

      // Extras (custom movement types)
      if (speeds.extras) {
        for (const extra of speeds.extras) {
          entries.push({
            type: "custom",
            label: extra.label,
            distance: extra.distance ?? "",
            hover: extra.hover,
          });
        }
      }

      return entries;
    },

    add: (entry: MovementEntry) => {
      const speeds = ensureSpeeds(data);

      // Check if it's a standard movement type
      const standardType = movementTypes.find(([type]) => type === entry.type);

      if (standardType) {
        const [type] = standardType;
        applySpeedValue(data, type as SpeedFieldKey, {
          distance: entry.distance,
          hover: entry.hover,
        });
      } else {
        // It's a custom movement type, add to extras
        if (!speeds.extras) speeds.extras = [];
        speeds.extras.push({
          label: entry.label,
          distance: entry.distance,
          hover: entry.hover,
        });
      }
    },

    remove: (index: number) => {
      const entries = model.get();
      if (index < 0 || index >= entries.length) return;

      const entry = entries[index];
      const speeds = ensureSpeeds(data);

      // Check if it's a standard movement type
      const standardType = movementTypes.find(([type]) => type === entry.type);

      if (standardType) {
        const [type] = standardType;
        delete speeds[type as SpeedFieldKey];
      } else {
        // It's a custom movement type, remove from extras
        if (speeds.extras) {
          const extraIndex = speeds.extras.findIndex(
            (e) => e.label === entry.label && e.distance === entry.distance
          );
          if (extraIndex !== -1) {
            speeds.extras.splice(extraIndex, 1);
          }
        }
      }
    },

    update: (index: number, updates: Partial<MovementEntry>) => {
      // Not used for now, but required by interface
    },
  };

  // Need model reference for remove()
  const model = {
    get: function() {
      const speeds = ensureSpeeds(data);
      const entries: MovementEntry[] = [];
      for (const [type, label] of movementTypes) {
        const speed = speeds[type as SpeedFieldKey];
        if (speed?.distance) {
          entries.push({ type, label, distance: speed.distance, hover: speed.hover });
        }
      }
      if (speeds.extras) {
        for (const extra of speeds.extras) {
          entries.push({ type: "custom", label: extra.label, distance: extra.distance ?? "", hover: extra.hover });
        }
      }
      return entries;
    },
    add: function(entry: MovementEntry) {
      const speeds = ensureSpeeds(data);
      const standardType = movementTypes.find(([type]) => type === entry.type);
      if (standardType) {
        const [type] = standardType;
        applySpeedValue(data, type as SpeedFieldKey, { distance: entry.distance, hover: entry.hover });
      } else {
        if (!speeds.extras) speeds.extras = [];
        speeds.extras.push({ label: entry.label, distance: entry.distance, hover: entry.hover });
      }
    },
    remove: function(index: number) {
      const entries = model.get();
      if (index < 0 || index >= entries.length) return;
      const entry = entries[index];
      const speeds = ensureSpeeds(data);
      const standardType = movementTypes.find(([type]) => type === entry.type);
      if (standardType) {
        const [type] = standardType;
        delete speeds[type as SpeedFieldKey];
      } else {
        if (speeds.extras) {
          const extraIndex = speeds.extras.findIndex(
            (e) => e.label === entry.label && e.distance === entry.distance
          );
          if (extraIndex !== -1) speeds.extras.splice(extraIndex, 1);
        }
      }
    },
    update: function(index: number, updates: Partial<MovementEntry>) {
      // Not used
    },
  };

  return model;
}
