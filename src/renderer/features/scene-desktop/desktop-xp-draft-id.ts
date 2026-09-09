export function desktopXpDraftId(
  campaignId: string,
  sceneId: string,
  characterId: string
): string {
  return `desktop-xp:${campaignId}:${sceneId}:${characterId}`
}
