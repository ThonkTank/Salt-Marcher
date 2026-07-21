package features.dungeon.application.editor;


final class DungeonEditorRuntimeDraftSession {
    private final DungeonEditorStatePanelLabelNameDrafts statePanelLabelNameDrafts =
            new DungeonEditorStatePanelLabelNameDrafts();
    private final DungeonEditorStatePanelCorridorPointDrafts statePanelCorridorPointDrafts =
            new DungeonEditorStatePanelCorridorPointDrafts();
    private final DungeonEditorStatePanelTransitionDescriptionDrafts statePanelTransitionDescriptionDrafts =
            new DungeonEditorStatePanelTransitionDescriptionDrafts();
    private final DungeonEditorStatePanelTransitionDestinationDrafts statePanelTransitionDestinationDrafts =
            new DungeonEditorStatePanelTransitionDestinationDrafts();
    private final DungeonEditorStatePanelRoomNarrationDrafts statePanelRoomNarrationDrafts =
            new DungeonEditorStatePanelRoomNarrationDrafts();
    private final DungeonEditorStatePanelStairGeometryDrafts statePanelStairGeometryDrafts =
            new DungeonEditorStatePanelStairGeometryDrafts();

    private DungeonEditorInlineLabelEditSession inlineLabelEditSession =
            DungeonEditorInlineLabelEditSession.inactive();

    void clearRoomNarrationDraft(long selectedMapIdValue, long roomId) {
        statePanelRoomNarrationDrafts.clear(selectedMapIdValue, roomId);
    }

    void updateRoomNarrationDraft(long selectedMapIdValue, RoomNarrationDraftInput input) {
        statePanelRoomNarrationDrafts.update(selectedMapIdValue, input);
    }

    void updateLabelNameDraft(long selectedMapIdValue, DungeonEditorRuntimeLabelTarget target, String name) {
        statePanelLabelNameDrafts.update(selectedMapIdValue, target, name);
    }

    void clearLabelNameDraft(long selectedMapIdValue, DungeonEditorRuntimeLabelTarget target) {
        statePanelLabelNameDrafts.clear(selectedMapIdValue, target);
    }

    void updateCorridorPointDraft(
            long selectedMapIdValue,
            features.dungeon.api.editor.DungeonEditorSelection selection,
            String q,
            String r
    ) {
        statePanelCorridorPointDrafts.update(selectedMapIdValue, selection, q, r);
    }

    DungeonEditorRuntimeContext.Result moveCorridorPoint(
            long selectedMapIdValue,
            features.dungeon.api.editor.DungeonEditorSelection selection,
            int q,
            int r,
            DungeonEditorSelectedHandleRuntimeOperation selectedHandleOperation
    ) {
        return statePanelCorridorPointDrafts.move(selectedMapIdValue, selection, q, r, selectedHandleOperation);
    }

    void updateTransitionDescriptionDraft(long selectedMapIdValue, long transitionId, String description) {
        statePanelTransitionDescriptionDrafts.update(selectedMapIdValue, transitionId, description);
    }

    void clearTransitionDescriptionDraft(long selectedMapIdValue, long transitionId) {
        statePanelTransitionDescriptionDrafts.clear(selectedMapIdValue, transitionId);
    }

    void updateTransitionDestinationDraft(
            long selectedMapIdValue,
            DungeonEditorControlProjection controls,
            DungeonEditorInspectorProjection state,
            TransitionDestinationDraftInput input
    ) {
        TransitionDestinationDraftInput safeInput = input == null
                ? TransitionDestinationDraftInput.unlinkedEntrance()
                : input;
        DungeonEditorStatePanelTransitionDestinationDrafts.Target target =
                DungeonEditorStatePanelTransitionDestinationDrafts.target(controls, state);
        statePanelTransitionDestinationDrafts.update(
                selectedMapIdValue,
                target.visible(),
                target.sourceTransitionId(),
                safeInput);
    }

    void clearTransitionDestinationDraft(long selectedMapIdValue, long sourceTransitionId) {
        statePanelTransitionDestinationDrafts.clear(selectedMapIdValue, sourceTransitionId);
    }

    void updateStairGeometryDraft(long selectedMapIdValue, StairGeometryDraftInput input) {
        statePanelStairGeometryDrafts.update(selectedMapIdValue, input);
    }

    void clearStairGeometryDraft(long selectedMapIdValue, long stairId) {
        statePanelStairGeometryDrafts.clear(selectedMapIdValue, stairId);
    }

    void beginInlineLabelEdit(DungeonEditorInlineLabelEditSession session) {
        DungeonEditorInlineLabelEditSession safeSession = session == null
                ? DungeonEditorInlineLabelEditSession.inactive()
                : session;
        inlineLabelEditSession = !safeSession.active()
                || !safeSession.target().present()
                ? DungeonEditorInlineLabelEditSession.inactive()
                : safeSession;
    }

    void updateInlineLabelEditDraft(String text) {
        inlineLabelEditSession = inlineLabelEditSession.withDraftText(text);
    }

    void clearInlineLabelEditSession() {
        inlineLabelEditSession = DungeonEditorInlineLabelEditSession.inactive();
    }

    DungeonEditorInlineLabelEditSession takeInlineLabelEditSession() {
        DungeonEditorInlineLabelEditSession editSession = inlineLabelEditSession;
        clearInlineLabelEditSession();
        return editSession;
    }

    DungeonEditorDraftProjection draftProjection(
            DungeonEditorControlProjection controls,
            DungeonEditorInspectorProjection state
    ) {
        return new DungeonEditorDraftProjection(
                roomNarrationDrafts(controls, state),
                labelNameDraft(controls, state),
                corridorPointDraft(controls, state),
                transitionDescriptionDraft(controls, state),
                transitionDestinationDraft(controls, state),
                stairGeometryDraft(controls, state),
                inlineLabelEditSession);
    }

    private DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts roomNarrationDrafts(
            DungeonEditorControlProjection controls,
            DungeonEditorInspectorProjection state
    ) {
        long selectedMapIdValue = selectedMapIdValue(controls);
        statePanelRoomNarrationDrafts.retainOnlyVisibleDraftsForMap(
                selectedMapIdValue,
                state == null ? null : state.inspector());
        return statePanelRoomNarrationDrafts.visibleDrafts(
                selectedMapIdValue,
                state == null ? null : state.inspector());
    }

    private DungeonEditorStatePanelLabelNameDrafts.Draft labelNameDraft(
            DungeonEditorControlProjection controls,
            DungeonEditorInspectorProjection state
    ) {
        DungeonEditorRuntimeLabelTarget target = labelNameTarget(state == null ? null : state.selection());
        long selectedMapIdValue = selectedMapIdValue(controls);
        statePanelLabelNameDrafts.retainOnlyVisibleDraftForMap(selectedMapIdValue, target);
        return statePanelLabelNameDrafts.current(selectedMapIdValue, target);
    }

    private DungeonEditorStatePanelCorridorPointDrafts.Draft corridorPointDraft(
            DungeonEditorControlProjection controls,
            DungeonEditorInspectorProjection state
    ) {
        long selectedMapIdValue = selectedMapIdValue(controls);
        features.dungeon.api.editor.DungeonEditorSelection selection = state == null
                ? features.dungeon.api.editor.DungeonEditorSelection.empty()
                : state.selection();
        statePanelCorridorPointDrafts.retainOnlyVisibleDraftForMap(selectedMapIdValue, selection);
        return statePanelCorridorPointDrafts.current(selectedMapIdValue, selection);
    }

    private DungeonEditorStatePanelTransitionDescriptionDrafts.Draft transitionDescriptionDraft(
            DungeonEditorControlProjection controls,
            DungeonEditorInspectorProjection state
    ) {
        long selectedMapIdValue = selectedMapIdValue(controls);
        long transitionId = selectedTransitionId(state == null ? null : state.selection());
        statePanelTransitionDescriptionDrafts.retainOnlyVisibleDraftForMap(selectedMapIdValue, transitionId);
        return statePanelTransitionDescriptionDrafts.current(selectedMapIdValue, transitionId);
    }

    private DungeonEditorStatePanelTransitionDestinationDrafts.Draft transitionDestinationDraft(
            DungeonEditorControlProjection controls,
            DungeonEditorInspectorProjection state
    ) {
        long selectedMapIdValue = selectedMapIdValue(controls);
        DungeonEditorStatePanelTransitionDestinationDrafts.Target target =
                DungeonEditorStatePanelTransitionDestinationDrafts.target(controls, state);
        statePanelTransitionDestinationDrafts.retainOnlyVisibleDraftForMap(
                selectedMapIdValue,
                target.visible(),
                target.sourceTransitionId());
        return statePanelTransitionDestinationDrafts.current(
                selectedMapIdValue,
                target.visible(),
                target.sourceTransitionId());
    }

    private DungeonEditorStatePanelStairGeometryDrafts.Draft stairGeometryDraft(
            DungeonEditorControlProjection controls,
            DungeonEditorInspectorProjection state
    ) {
        long selectedMapIdValue = selectedMapIdValue(controls);
        long stairId = selectedStairId(state == null ? null : state.selection());
        statePanelStairGeometryDrafts.retainOnlyVisibleDraftForMap(selectedMapIdValue, stairId);
        return statePanelStairGeometryDrafts.current(selectedMapIdValue, stairId);
    }

    static long selectedMapIdValue(DungeonEditorControlProjection controls) {
        if (controls == null || controls.selectedMapId() == null) {
            return 0L;
        }
        return controls.selectedMapId().value();
    }

    static long selectedTransitionId(features.dungeon.api.editor.DungeonEditorSelection selection) {
        var topologyRef = selection == null
                ? features.dungeon.api.editor.DungeonEditorSelection.empty().topologyRef()
                : selection.topologyRef();
        return topologyRef.kind() == features.dungeon.api.DungeonTopologyElementKind.TRANSITION
                ? topologyRef.id()
                : 0L;
    }

    private static long selectedStairId(features.dungeon.api.editor.DungeonEditorSelection selection) {
        var topologyRef = selection == null
                ? features.dungeon.api.editor.DungeonEditorSelection.empty().topologyRef()
                : selection.topologyRef();
        return topologyRef.kind() == features.dungeon.api.DungeonTopologyElementKind.STAIR
                ? topologyRef.id()
                : 0L;
    }

    private static DungeonEditorRuntimeLabelTarget labelNameTarget(features.dungeon.api.editor.DungeonEditorSelection selection) {
        features.dungeon.api.editor.DungeonEditorSelection safeSelection = selection == null
                ? features.dungeon.api.editor.DungeonEditorSelection.empty()
                : selection;
        if (clusterNameTarget(safeSelection)) {
            return DungeonEditorRuntimeLabelTarget.cluster(safeSelection.clusterId());
        }
        var topologyRef = safeSelection.topologyRef();
        return topologyRef.kind() == features.dungeon.api.DungeonTopologyElementKind.ROOM
                ? DungeonEditorRuntimeLabelTarget.room(topologyRef.id())
                : DungeonEditorRuntimeLabelTarget.empty();
    }

    private static boolean clusterNameTarget(features.dungeon.api.editor.DungeonEditorSelection selection) {
        return clusterLabelSelection(selection) || clusterOnlySelection(selection);
    }

    private static boolean clusterLabelSelection(features.dungeon.api.editor.DungeonEditorSelection selection) {
        return selection.handleRef() != null && "CLUSTER_LABEL".equals(selection.handleRef().kind().name());
    }

    private static boolean clusterOnlySelection(features.dungeon.api.editor.DungeonEditorSelection selection) {
        return selection.clusterSelection()
                && selection.topologyRef().kind() != features.dungeon.api.DungeonTopologyElementKind.ROOM;
    }

}
