package src.features.dungeon.runtime;

import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;

@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.TooManyMethods"})
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
            DungeonEditorStateSnapshot.Selection selection,
            String q,
            String r
    ) {
        statePanelCorridorPointDrafts.update(selectedMapIdValue, selection, q, r);
    }

    DungeonEditorRuntimeContext.Result moveCorridorPoint(
            long selectedMapIdValue,
            DungeonEditorStateSnapshot.Selection selection,
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
            DungeonEditorControlsSnapshot controls,
            DungeonEditorStateSnapshot state,
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

    DungeonEditorRuntimeDraftFrame draftFrame(
            DungeonEditorControlsSnapshot controls,
            DungeonEditorStateSnapshot state
    ) {
        return new DungeonEditorRuntimeDraftFrame(
                roomNarrationDrafts(controls, state),
                labelNameDraft(controls, state),
                corridorPointDraft(controls, state),
                transitionDescriptionDraft(controls, state),
                transitionDestinationDraft(controls, state),
                stairGeometryDraft(controls, state),
                inlineLabelEditSession);
    }

    private DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts roomNarrationDrafts(
            DungeonEditorControlsSnapshot controls,
            DungeonEditorStateSnapshot state
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
            DungeonEditorControlsSnapshot controls,
            DungeonEditorStateSnapshot state
    ) {
        DungeonEditorRuntimeLabelTarget target = labelNameTarget(state == null ? null : state.selection());
        long selectedMapIdValue = selectedMapIdValue(controls);
        statePanelLabelNameDrafts.retainOnlyVisibleDraftForMap(selectedMapIdValue, target);
        return statePanelLabelNameDrafts.current(selectedMapIdValue, target);
    }

    private DungeonEditorStatePanelCorridorPointDrafts.Draft corridorPointDraft(
            DungeonEditorControlsSnapshot controls,
            DungeonEditorStateSnapshot state
    ) {
        long selectedMapIdValue = selectedMapIdValue(controls);
        DungeonEditorStateSnapshot.Selection selection = state == null
                ? DungeonEditorStateSnapshot.Selection.empty()
                : state.selection();
        statePanelCorridorPointDrafts.retainOnlyVisibleDraftForMap(selectedMapIdValue, selection);
        return statePanelCorridorPointDrafts.current(selectedMapIdValue, selection);
    }

    private DungeonEditorStatePanelTransitionDescriptionDrafts.Draft transitionDescriptionDraft(
            DungeonEditorControlsSnapshot controls,
            DungeonEditorStateSnapshot state
    ) {
        long selectedMapIdValue = selectedMapIdValue(controls);
        long transitionId = selectedTransitionId(state == null ? null : state.selection());
        statePanelTransitionDescriptionDrafts.retainOnlyVisibleDraftForMap(selectedMapIdValue, transitionId);
        return statePanelTransitionDescriptionDrafts.current(selectedMapIdValue, transitionId);
    }

    private DungeonEditorStatePanelTransitionDestinationDrafts.Draft transitionDestinationDraft(
            DungeonEditorControlsSnapshot controls,
            DungeonEditorStateSnapshot state
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
            DungeonEditorControlsSnapshot controls,
            DungeonEditorStateSnapshot state
    ) {
        long selectedMapIdValue = selectedMapIdValue(controls);
        long stairId = selectedStairId(state == null ? null : state.selection());
        statePanelStairGeometryDrafts.retainOnlyVisibleDraftForMap(selectedMapIdValue, stairId);
        return statePanelStairGeometryDrafts.current(selectedMapIdValue, stairId);
    }

    static long selectedMapIdValue(DungeonEditorControlsSnapshot controls) {
        if (controls == null || controls.selectedMapId() == null) {
            return 0L;
        }
        return controls.selectedMapId().value();
    }

    static long selectedTransitionId(DungeonEditorStateSnapshot.Selection selection) {
        var topologyRef = selection == null
                ? DungeonEditorStateSnapshot.Selection.empty().topologyRef()
                : selection.topologyRef();
        return "TRANSITION".equals(topologyRef.kind()) ? topologyRef.id() : 0L;
    }

    private static long selectedStairId(DungeonEditorStateSnapshot.Selection selection) {
        var topologyRef = selection == null
                ? DungeonEditorStateSnapshot.Selection.empty().topologyRef()
                : selection.topologyRef();
        return "STAIR".equals(topologyRef.kind()) ? topologyRef.id() : 0L;
    }

    private static DungeonEditorRuntimeLabelTarget labelNameTarget(DungeonEditorStateSnapshot.Selection selection) {
        DungeonEditorStateSnapshot.Selection safeSelection = selection == null
                ? DungeonEditorStateSnapshot.Selection.empty()
                : selection;
        if (clusterNameTarget(safeSelection)) {
            return DungeonEditorRuntimeLabelTarget.cluster(safeSelection.clusterId());
        }
        var topologyRef = safeSelection.topologyRef();
        return "ROOM".equals(topologyRef.kind())
                ? DungeonEditorRuntimeLabelTarget.room(topologyRef.id())
                : DungeonEditorRuntimeLabelTarget.empty();
    }

    private static boolean clusterNameTarget(DungeonEditorStateSnapshot.Selection selection) {
        return clusterLabelSelection(selection) || clusterOnlySelection(selection);
    }

    private static boolean clusterLabelSelection(DungeonEditorStateSnapshot.Selection selection) {
        return selection.handleRef() != null && "CLUSTER_LABEL".equals(selection.handleRef().kind().name());
    }

    private static boolean clusterOnlySelection(DungeonEditorStateSnapshot.Selection selection) {
        return selection.clusterSelection() && !"ROOM".equals(selection.topologyRef().kind());
    }

}
