package features.dungeon.application.editor;

record DungeonEditorDraftProjection(
        DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts roomNarrationDrafts,
        DungeonEditorStatePanelLabelNameDrafts.Draft labelNameDraft,
        DungeonEditorStatePanelCorridorPointDrafts.Draft corridorPointDraft,
        DungeonEditorStatePanelTransitionDescriptionDrafts.Draft transitionDescriptionDraft,
        DungeonEditorStatePanelTransitionDestinationDrafts.Draft transitionDestinationDraft,
        DungeonEditorStatePanelStairGeometryDrafts.Draft stairGeometryDraft,
        DungeonEditorInlineLabelEditSession inlineLabelEditSession
) {
    DungeonEditorDraftProjection {
        roomNarrationDrafts = roomNarrationDrafts == null
                ? DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts.empty() : roomNarrationDrafts;
        labelNameDraft = labelNameDraft == null
                ? DungeonEditorStatePanelLabelNameDrafts.Draft.empty() : labelNameDraft;
        corridorPointDraft = corridorPointDraft == null
                ? DungeonEditorStatePanelCorridorPointDrafts.Draft.empty() : corridorPointDraft;
        transitionDescriptionDraft = transitionDescriptionDraft == null
                ? DungeonEditorStatePanelTransitionDescriptionDrafts.Draft.empty() : transitionDescriptionDraft;
        transitionDestinationDraft = transitionDestinationDraft == null
                ? DungeonEditorStatePanelTransitionDestinationDrafts.Draft.empty() : transitionDestinationDraft;
        stairGeometryDraft = stairGeometryDraft == null
                ? DungeonEditorStatePanelStairGeometryDrafts.Draft.empty() : stairGeometryDraft;
        inlineLabelEditSession = inlineLabelEditSession == null
                ? DungeonEditorInlineLabelEditSession.inactive() : inlineLabelEditSession;
    }
}
