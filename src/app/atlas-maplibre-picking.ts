import type {MapLibreOverlay} from '@deck.gl/maplibre';
import type {Deck} from '@deck.gl/core';
import {ensureAtlasDeckPickingDepth} from './atlas-deck-picking';

/** Historical overlay compatibility until the direct renderer is qualified. */
export function ensureAtlasPickingDepth(overlay: MapLibreOverlay): void {
  const deck = (overlay as unknown as {_deck?: Deck})._deck;
  if (!deck) throw new Error('Unsupported Atlas Deck picker contract');
  ensureAtlasDeckPickingDepth(deck);
}
