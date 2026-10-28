export interface TreasureOrigin {
  treasureId: string;
  itemId: string;
  combatId: string | null;
  sceneId: string | null;
  locationId: string | null;
  sourceNoteId?: string;
  awardId?: string;
}
