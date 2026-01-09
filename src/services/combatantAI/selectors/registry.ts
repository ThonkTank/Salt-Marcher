// Ziel: Selector-Registry für dynamische Algorithmus-Auswahl
// Siehe: docs/services/combatantAI/combatantAI.md

import type { ActionSelector } from './types';
import { greedySelector } from './greedySelector';
import { randomSelector } from './randomSelector';
import { factoredSelector } from './factoredSelector';
import { iterativeSelector } from './iterativeSelector';
import { bestFirstSelector } from './bestFirstSelector';
import { killerSelector } from './killerSelector';
import { lmrSelector } from './lmrSelector';
import { ucbSelector } from './ucbSelector';
import { starSelector } from './starSelector';
import { minimaxSelector } from './minimaxSelector';

// Registry: name → selector
const registry = new Map<string, ActionSelector>();

// Default selector name
const DEFAULT_SELECTOR = 'greedy';

/**
 * Registriert einen Selector.
 * Überschreibt bestehenden Selector mit gleichem Namen.
 */
export function registerSelector(selector: ActionSelector): void {
  registry.set(selector.name, selector);
}

/**
 * Gibt Selector by name zurück.
 * @returns Selector oder undefined wenn nicht gefunden
 */
export function getSelector(name: string): ActionSelector | undefined {
  return registry.get(name);
}

/**
 * Gibt Default-Selector zurück (greedy).
 * @throws Error wenn Default nicht registriert
 */
export function getDefaultSelector(): ActionSelector {
  const selector = registry.get(DEFAULT_SELECTOR);
  if (!selector) {
    throw new Error(`Default selector '${DEFAULT_SELECTOR}' not registered`);
  }
  return selector;
}

/**
 * Gibt alle registrierten Selector-Namen zurück.
 */
export function getRegisteredSelectors(): string[] {
  return Array.from(registry.keys());
}

// Auto-Register all selectors
registerSelector(greedySelector);
registerSelector(randomSelector);
registerSelector(factoredSelector);
registerSelector(iterativeSelector);
registerSelector(bestFirstSelector);
registerSelector(killerSelector);
registerSelector(lmrSelector);
registerSelector(ucbSelector);
registerSelector(starSelector);
registerSelector(minimaxSelector);
