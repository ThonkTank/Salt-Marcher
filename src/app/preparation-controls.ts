export interface PreparationControls {
  save: boolean;
  clearTimeline: boolean;
  addRelation: boolean;
}

export function preparationControls(input: {
  dirty: boolean;
  blocked: boolean;
  sceneCount: number;
  trashedNote: boolean;
  relationTargetCount: number;
}): PreparationControls {
  return {
    save: input.dirty && !input.blocked,
    clearTimeline: input.sceneCount > 0,
    addRelation: !input.trashedNote && input.relationTargetCount > 0,
  };
}
