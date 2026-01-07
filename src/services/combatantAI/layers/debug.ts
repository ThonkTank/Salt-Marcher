// Ziel: Debug-Visualisierung fuer Layer-System
// Siehe: docs/services/combatantAI/combatantAI.md
//
// Entwicklungs-Tools, nicht fuer Produktion

import type {
  GridPosition,
  FinalResolvedData,
  ActionWithLayer,
} from '@/types/combat';
import { positionToKey, getExpectedValue } from '@/utils';

// ============================================================================
// DEBUG & VISUALIZATION
// ============================================================================

/**
 * ASCII-Heatmap fuer Action-Range.
 */
export function visualizeActionRange(
  action: ActionWithLayer,
  center: GridPosition,
  radius: number
): string {
  const lines: string[] = [];
  const sourcePos = action._layer.sourcePosition;

  lines.push(`Action: ${action.name ?? action.id} (Range: ${action._layer.rangeCells} cells)`);
  lines.push(`Source: (${sourcePos.x}, ${sourcePos.y})`);
  lines.push('');

  for (let dy = -radius; dy <= radius; dy++) {
    let line = '';
    for (let dx = -radius; dx <= radius; dx++) {
      const cell: GridPosition = {
        x: center.x + dx,
        y: center.y + dy,
        z: center.z,
      };
      const cellKey = positionToKey(cell);
      const rangeData = action._layer.grid.get(cellKey);

      if (cell.x === sourcePos.x && cell.y === sourcePos.y) {
        line += 'S '; // Source
      } else if (!rangeData?.inRange) {
        line += '. ';
      } else if (rangeData.inNormalRange) {
        line += '# '; // Normal range
      } else {
        line += 'o '; // Long range
      }
    }
    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Debug-Ausgabe fuer Target-Resolution.
 */
export function explainTargetResolution(
  resolved: FinalResolvedData
): string {
  const lines: string[] = [];

  lines.push(`Target: ${resolved.targetId}`);
  lines.push(`Hit Chance: ${(resolved.finalHitChance * 100).toFixed(1)}%`);
  lines.push(`Base Hit Chance: ${(resolved.base.baseHitChance * 100).toFixed(1)}%`);
  lines.push(`Attack Bonus: +${resolved.base.attackBonus}`);
  lines.push(`Net Advantage: ${resolved.netAdvantage}`);
  lines.push(`Expected Damage: ${getExpectedValue(resolved.effectiveDamagePMF).toFixed(1)}`);
  lines.push(`Active Effects: ${resolved.activeEffects.join(', ') || 'none'}`);

  return lines.join('\n');
}
