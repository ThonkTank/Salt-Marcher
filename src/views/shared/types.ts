// Ziel: Shared TypeScript Interfaces fuer View-Komponenten
// Siehe: docs/views/shared.md

import type { Action } from '#entities/action';
import type { Combatant } from '@/types/combat';

// ============================================================================
// GRID CANVAS
// ============================================================================

export interface GridPosition {
  x: number;
  y: number;
}

export interface GridEntity {
  id: string;
  position: GridPosition;
  label: string; // Initial oder kurzer Name
  color: string; // Token-Farbe
  size?: number; // 1 = Medium, 2 = Large, etc.
  isActive?: boolean; // Aktueller Turn
  conditions?: string[]; // Icons fuer Conditions
}

export interface TerrainCell {
  position: GridPosition;
  type: 'difficult' | 'hazard' | 'cover' | 'wall';
  opacity?: number;
}

export interface GridCanvasProps {
  width: number; // Grid-Breite in Zellen
  height: number; // Grid-Hoehe in Zellen
  cellSize?: number; // Pixel pro Zelle (default: 32)
  entities: GridEntity[];
  selectedEntityId: string | null;
  highlightedCells?: GridPosition[]; // Bewegung, Reichweite
  targetedCells?: GridPosition[]; // Angriffsziele
  terrain?: TerrainCell[];
  onEntityClick: (id: string) => void;
  onCellClick: (pos: GridPosition) => void;
  onCellHover?: (pos: GridPosition | null) => void;
}

// ============================================================================
// ACTION PANEL
// ============================================================================

export interface ActionModifier {
  name: string; // "Pack Tactics"
  effect: string; // "Advantage"
  source: 'attacker' | 'target' | 'terrain' | 'condition';
}

export interface ActionPanelProps {
  position: GridPosition;
  cellSize: number;
  anchor?: 'right' | 'left' | 'top' | 'bottom'; // default: 'right'
  action: Action;
  attacker: Combatant;
  target: Combatant;
  modifiers: ActionModifier[];
  onRoll: () => void;
  onEnterResult: () => void;
  onExecute?: () => void; // Fuer Aktionen ohne Wuerfeln (Dash, Disengage)
}

// ============================================================================
// UNIFIED RESOLUTION POPUP
// ============================================================================

export type RollResult = 'hit' | 'miss' | 'crit' | 'save' | 'fail';

/** Info fuer Turn-Effect Resolution */
export interface EffectInfo {
  name: string;
  description: string;
  saveDC: number;
  saveAbility: string;
  damage?: string; // Dice expression falls Schaden
}

/** Discriminated Union fuer alle Resolution-Typen */
export type ResolutionRequest =
  | { type: 'action'; action: Action; attacker: Combatant; target: Combatant; mode: 'roll' | 'enter' }
  | { type: 'reaction'; reaction: Action; owner: Combatant; trigger: string }
  | { type: 'concentration'; combatant: Combatant; spell: string; damage: number }
  | { type: 'turnEffect'; combatant: Combatant; timing: 'start' | 'end'; effect: EffectInfo };

/** Result-Typen fuer Resolution */
export type ResolutionResult =
  | { type: 'action'; rollResult: RollResult; attackRoll?: number; damageRoll?: number; totalDamage: number }
  | { type: 'reaction'; used: boolean }
  | { type: 'concentration'; saved: boolean }
  | { type: 'turnEffect'; saved: boolean; damage?: number };

/** Props fuer ResolutionPopup */
export interface ResolutionPopupProps {
  request: ResolutionRequest;
  onResolve: (result: ResolutionResult) => void;
  onCancel: () => void;
}

// Legacy types (deprecated, use ResolutionRequest/Result stattdessen)
/** @deprecated Use ResolutionRequest with type='action' */
export interface ActionResolutionProps {
  action: Action;
  attacker: Combatant;
  target: Combatant;
  mode: 'roll' | 'enter';
  onConfirm: (result: ActionResolutionResult) => void;
  onCancel: () => void;
}

/** @deprecated Use ResolutionResult with type='action' */
export interface ActionResolutionResult {
  rollResult: RollResult;
  attackRoll?: number;
  damageRoll?: number;
  totalDamage: number;
}

// ============================================================================
// TOOLTIP
// ============================================================================

export interface TooltipProps {
  content: string | (() => string); // Lazy fuer Schema-Generierung
  position?: 'top' | 'right' | 'bottom' | 'left'; // default: 'top'
  delay?: number; // ms vor Anzeige (default: 300)
}
