package src.features.dungeon.runtime;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import shell.api.ServiceRegistry;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;

public final class DungeonEditorFeatureRuntimeRoot implements DungeonEditorRuntimeOperations {
    private final DungeonEditorControlsModel controlsModel;
    private final DungeonEditorMapSurfaceModel mapSurfaceModel;
    private final DungeonEditorStateModel stateModel;
    private final DungeonEditorMainViewInteractionState interactionState;
    private final DungeonEditorAuthoredRuntimeOperations operationOwner;
    private final DungeonEditorPointerSession pointerSession = new DungeonEditorPointerSession();
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
    private final List<Consumer<DungeonEditorRuntimePublication>> subscribers = new CopyOnWriteArrayList<>();

    public static DungeonEditorFeatureRuntimeRoot create(ServiceRegistry registry) {
        ServiceRegistry safeRegistry = Objects.requireNonNull(registry, "registry");
        DungeonEditorMainViewInteractionState interactionState = new DungeonEditorMainViewInteractionState();
        return new DungeonEditorFeatureRuntimeRoot(
                safeRegistry.require(DungeonEditorControlsModel.class),
                safeRegistry.require(DungeonEditorMapSurfaceModel.class),
                safeRegistry.require(DungeonEditorStateModel.class),
                interactionState,
                DungeonEditorAuthoredRuntimeAssembly.create(safeRegistry, interactionState));
    }

    private DungeonEditorFeatureRuntimeRoot(
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DungeonEditorMainViewInteractionState interactionState,
            DungeonEditorAuthoredRuntimeOperations operationOwner
    ) {
        this.controlsModel = Objects.requireNonNull(controlsModel, "controlsModel");
        this.mapSurfaceModel = Objects.requireNonNull(mapSurfaceModel, "mapSurfaceModel");
        this.stateModel = Objects.requireNonNull(stateModel, "stateModel");
        this.interactionState = Objects.requireNonNull(interactionState, "interactionState");
        this.operationOwner = Objects.requireNonNull(operationOwner, "operationOwner");
        this.stateModel.subscribe(ignored -> publishCurrentToSubscribers());
    }

    public DungeonEditorRuntimeOperations operations() {
        return this;
    }

    @Override
    public void selectMap(long mapIdValue) {
        clearInteractionSession();
        clearInlineLabelEditSession();
        operationOwner.selectMap(mapIdValue);
    }

    @Override
    public void createMap(String mapName) {
        clearInteractionSession();
        operationOwner.createMap(mapName);
    }

    @Override
    public void renameMap(long mapIdValue, String mapName) {
        operationOwner.renameMap(mapIdValue, mapName);
    }

    @Override
    public void deleteMap(long mapIdValue) {
        clearInteractionSession();
        operationOwner.deleteMap(mapIdValue);
    }

    @Override
    public void setViewMode(String viewModeKey) {
        clearInteractionSession();
        operationOwner.setViewMode(viewModeKey);
    }

    @Override
    public void setTool(String toolKey) {
        clearInteractionSession();
        clearPointerSession();
        clearInlineLabelEditSession();
        operationOwner.setTool(toolKey);
    }

    @Override
    public void cancelActivePreviewSession() {
        clearInteractionSession();
        clearPointerSession();
        clearInlineLabelEditSession();
        operationOwner.cancelActivePreviewSession();
    }

    @Override
    public void shiftProjectionLevel(int levelShift) {
        operationOwner.shiftProjectionLevel(levelShift);
    }

    @Override
    public void setOverlay(String modeKey, int levelRange, double opacity, List<Integer> selectedLevels) {
        operationOwner.setOverlay(modeKey, levelRange, opacity, selectedLevels);
    }

    @Override
    public void applyPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (applyDraftPointer(action, toolKey, sample, wallSingleClickMode, transitionDestination)) {
            return;
        }
        if (applyPointPointer(action, toolKey, sample, wallSingleClickMode, transitionDestination)) {
            return;
        }
        applySelectionPointer(action, toolKey, sample, wallSingleClickMode, transitionDestination);
    }

    private boolean applyDraftPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorTool wallTool = DungeonEditorWallBoundaryDraftRuntimeOperation.wallTool(toolKey);
        if (wallTool != null) {
            operationOwner.applyWallBoundaryDraft(
                    action,
                    wallTool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
            return true;
        }
        DungeonEditorTool doorTool = DungeonEditorDoorBoundaryDraftRuntimeOperation.doorTool(toolKey);
        if (doorTool != null) {
            operationOwner.applyDoorBoundaryDraft(
                    action,
                    doorTool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
            return true;
        }
        DungeonEditorTool corridorTool = DungeonEditorCorridorDraftRuntimeOperation.corridorTool(toolKey);
        if (corridorTool != null) {
            operationOwner.applyCorridorDraft(
                    action,
                    corridorTool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
            return true;
        }
        DungeonEditorTool stairTool = DungeonEditorStairDraftRuntimeOperation.stairTool(toolKey);
        if (stairTool != null) {
            operationOwner.applyStairDraft(
                    action,
                    stairTool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
            return true;
        }
        return false;
    }

    private boolean applyPointPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorTool editorTool = DungeonEditorRuntimeEnumTranslator.editorTool(toolKey);
        DungeonEditorSessionValues.Tool roomTool = DungeonEditorRoomPaintRuntimeOperation.roomTool(editorTool);
        if (roomTool != null) {
            operationOwner.applyRoomPaint(
                    action,
                    roomTool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
            return true;
        }
        if (DungeonEditorStairDeleteRuntimeOperation.handles(editorTool)) {
            operationOwner.applyStairDelete(
                    action,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
            return true;
        }
        if (DungeonEditorTransitionRuntimeOperation.handles(editorTool)) {
            operationOwner.applyTransition(
                    action,
                    editorTool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
            return true;
        }
        if (DungeonEditorFeatureMarkerRuntimeOperation.handles(editorTool)) {
            operationOwner.applyFeatureMarker(
                    action,
                    editorTool,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
            return true;
        }
        return false;
    }

    private void applySelectionPointer(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        if (DungeonEditorTool.SELECT == DungeonEditorRuntimeEnumTranslator.editorTool(toolKey)) {
            operationOwner.applySelectionHandlePreview(
                    action,
                    sample,
                    wallSingleClickMode,
                    transitionDestination);
        }
    }

    @Override
    public PointerWorkflowIntent pointerWorkflowIntent(
            String selectedTool,
            PointerWorkflowGesture gesture
    ) {
        return DungeonEditorPointerWorkflowIntentResolver.resolve(selectedTool, gesture);
    }

    @Override
    public boolean acceptPointerSession(
            PointerAction action,
            String toolKey,
            PointerSample sample,
            int projectionLevel
    ) {
        return pointerSession.accept(action, toolKey, sample, projectionLevel);
    }

    @Override
    public void clearPointerSession() {
        pointerSession.clear();
    }

    @Override
    public void scrollSelection(int levelDelta) {
        operationOwner.scrollSelection(levelDelta);
    }

    @Override
    public void saveRoomNarration(RoomNarration narration) {
        RoomNarration safeNarration = narration == null ? new RoomNarration(0L, "", List.of()) : narration;
        statePanelRoomNarrationDrafts.clear(currentSelectedMapIdValue(), safeNarration.roomId());
        operationOwner.saveRoomNarration(narration);
    }

    @Override
    public void updateStatePanelRoomNarrationDraft(RoomNarrationDraftInput input) {
        statePanelRoomNarrationDrafts.update(currentSelectedMapIdValue(), input);
        publishCurrentToSubscribers();
    }

    @Override
    public void updateStatePanelLabelNameDraft(String targetKind, long targetId, String name) {
        statePanelLabelNameDrafts.update(currentSelectedMapIdValue(), targetKind, targetId, name);
        publishCurrentToSubscribers();
    }

    @Override
    public void updateStatePanelCorridorPointDraft(String q, String r) {
        statePanelCorridorPointDrafts.update(currentSelectedMapIdValue(), currentStateSelection(), q, r);
        publishCurrentToSubscribers();
    }

    @Override
    public void moveStatePanelCorridorPoint(int q, int r) {
        statePanelCorridorPointDrafts.move(currentSelectedMapIdValue(), currentStateSelection(), q, r, operationOwner);
    }

    @Override
    public void updateStatePanelTransitionDescriptionDraft(long transitionId, String description) {
        statePanelTransitionDescriptionDrafts.update(currentSelectedMapIdValue(), transitionId, description);
        publishCurrentToSubscribers();
    }

    @Override
    public void updateStatePanelTransitionDestinationDraft(TransitionDestinationDraftInput input) {
        TransitionDestinationDraftInput safeInput = input == null
                ? new TransitionDestinationDraftInput("", "", "", "", true)
                : input;
        long selectedMapIdValue = currentSelectedMapIdValue();
        DungeonEditorStatePanelTransitionDestinationDrafts.Target target = statePanelTransitionDestinationTarget();
        statePanelTransitionDestinationDrafts.update(
                selectedMapIdValue,
                target.visible(),
                target.sourceTransitionId(),
                safeInput);
        publishCurrentToSubscribers();
    }

    @Override
    public void updateStatePanelStairGeometryDraft(StairGeometryDraftInput input) {
        statePanelStairGeometryDrafts.update(currentSelectedMapIdValue(), input);
        publishCurrentToSubscribers();
    }

    @Override
    public void saveLabelName(String targetKind, long targetId, String name) {
        statePanelLabelNameDrafts.clear(currentSelectedMapIdValue(), targetKind, targetId);
        operationOwner.saveLabelName(targetKind, targetId, name);
    }

    @Override
    public void beginInlineLabelEdit(DungeonEditorInlineLabelEditSession session) {
        DungeonEditorInlineLabelEditSession safeSession = session == null
                ? DungeonEditorInlineLabelEditSession.inactive()
                : session;
        if (!safeSession.active() || safeSession.targetKind().isBlank() || safeSession.targetId() <= 0L) {
            inlineLabelEditSession = DungeonEditorInlineLabelEditSession.inactive();
        } else {
            inlineLabelEditSession = safeSession;
        }
        publishCurrentToSubscribers();
    }

    @Override
    public void updateInlineLabelEditDraft(String text) {
        inlineLabelEditSession = inlineLabelEditSession.withDraftText(text);
        publishCurrentToSubscribers();
    }

    @Override
    public void cancelInlineLabelEdit() {
        clearInlineLabelEditSession();
        publishCurrentToSubscribers();
    }

    @Override
    public void commitInlineLabelEdit(String text) {
        DungeonEditorInlineLabelEditSession editSession = inlineLabelEditSession;
        clearInlineLabelEditSession();
        publishCurrentToSubscribers();
        if (!editSession.active() || editSession.targetId() <= 0L || text == null || text.isBlank()) {
            return;
        }
        saveLabelName(editSession.targetKind(), editSession.targetId(), text);
    }

    @Override
    public void saveTransitionLink(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        long selectedMapIdValue = currentSelectedMapIdValue();
        operationOwner.saveTransitionLink(sourceTransitionId, targetMapId, targetTransitionId, bidirectional);
        if (transitionLinkCommitted(sourceTransitionId, targetMapId, targetTransitionId)) {
            statePanelTransitionDestinationDrafts.clear(selectedMapIdValue, sourceTransitionId);
            publishCurrentToSubscribers();
        }
    }

    @Override
    public void saveTransitionDescription(long transitionId, String description) {
        statePanelTransitionDescriptionDrafts.clear(currentSelectedMapIdValue(), transitionId);
        operationOwner.saveTransitionDescription(transitionId, description);
    }

    @Override
    public void saveStairGeometry(
            long stairId,
            String shapeName,
            String directionName,
            int dimension1,
            int dimension2
    ) {
        statePanelStairGeometryDrafts.clear(currentSelectedMapIdValue(), stairId);
        operationOwner.saveStairGeometry(stairId, shapeName, directionName, dimension1, dimension2);
    }

    public DungeonEditorRuntimePublication currentPublication() {
        return DungeonEditorRuntimePublication.published(currentFrame());
    }

    public Runnable subscribe(Consumer<DungeonEditorRuntimePublication> subscriber) {
        Consumer<DungeonEditorRuntimePublication> safeSubscriber =
                Objects.requireNonNull(subscriber, "subscriber");
        subscribers.add(safeSubscriber);
        return () -> subscribers.remove(safeSubscriber);
    }

    private void publishCurrentToSubscribers() {
        DungeonEditorRuntimePublication publication = currentPublication();
        subscribers.forEach(subscriber -> subscriber.accept(publication));
    }

    private DungeonEditorRenderFrame currentFrame() {
        DungeonEditorControlsSnapshot controls = controlsModel.current();
        DungeonEditorMapSurfaceSnapshot mapSurface = mapSurfaceModel.current();
        DungeonEditorStateSnapshot state = stateModel.current();
        return new DungeonEditorRenderFrame(
                controls,
                mapSurface,
                state,
                preparedFacts(controls, mapSurface),
                prepareStatePanelRoomNarrationDrafts(controls, state),
                prepareStatePanelLabelNameDraft(controls, state),
                prepareStatePanelCorridorPointDraft(controls, state),
                prepareStatePanelTransitionDescriptionDraft(controls, state),
                prepareStatePanelTransitionDestinationDraft(controls, state),
                prepareStatePanelStairGeometryDraft(controls, state),
                inlineLabelEditSession);
    }

    private void clearInlineLabelEditSession() {
        inlineLabelEditSession = DungeonEditorInlineLabelEditSession.inactive();
    }

    private void clearInteractionSession() {
        interactionState.clear();
    }

    private DungeonEditorStatePanelRoomNarrationDrafts.VisibleDrafts prepareStatePanelRoomNarrationDrafts(
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

    private DungeonEditorStatePanelLabelNameDrafts.Draft prepareStatePanelLabelNameDraft(
            DungeonEditorControlsSnapshot controls,
            DungeonEditorStateSnapshot state
    ) {
        LabelNameTarget target = labelNameTarget(state == null ? null : state.selection());
        long selectedMapIdValue = selectedMapIdValue(controls);
        statePanelLabelNameDrafts.retainOnlyVisibleDraftForMap(selectedMapIdValue, target.kind(), target.id());
        return statePanelLabelNameDrafts.current(selectedMapIdValue, target.kind(), target.id());
    }

    private DungeonEditorStatePanelCorridorPointDrafts.Draft prepareStatePanelCorridorPointDraft(
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

    private DungeonEditorStatePanelTransitionDescriptionDrafts.Draft prepareStatePanelTransitionDescriptionDraft(
            DungeonEditorControlsSnapshot controls,
            DungeonEditorStateSnapshot state
    ) {
        long selectedMapIdValue = selectedMapIdValue(controls);
        long transitionId = selectedTransitionId(state == null ? null : state.selection());
        statePanelTransitionDescriptionDrafts.retainOnlyVisibleDraftForMap(selectedMapIdValue, transitionId);
        return statePanelTransitionDescriptionDrafts.current(selectedMapIdValue, transitionId);
    }

    private DungeonEditorStatePanelTransitionDestinationDrafts.Draft prepareStatePanelTransitionDestinationDraft(
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

    private DungeonEditorStatePanelStairGeometryDrafts.Draft prepareStatePanelStairGeometryDraft(
            DungeonEditorControlsSnapshot controls,
            DungeonEditorStateSnapshot state
    ) {
        long selectedMapIdValue = selectedMapIdValue(controls);
        long stairId = selectedStairId(state == null ? null : state.selection());
        statePanelStairGeometryDrafts.retainOnlyVisibleDraftForMap(selectedMapIdValue, stairId);
        return statePanelStairGeometryDrafts.current(selectedMapIdValue, stairId);
    }

    private DungeonEditorStateSnapshot.Selection currentStateSelection() {
        DungeonEditorStateSnapshot state = stateModel.current();
        return state == null ? DungeonEditorStateSnapshot.Selection.empty() : state.selection();
    }

    private DungeonEditorStatePanelTransitionDestinationDrafts.Target statePanelTransitionDestinationTarget() {
        return DungeonEditorStatePanelTransitionDestinationDrafts.target(controlsModel.current(), stateModel.current());
    }

    private boolean transitionLinkCommitted(long sourceTransitionId, long targetMapId, long targetTransitionId) {
        DungeonEditorStateSnapshot state = stateModel.current();
        return selectedTransitionId(state == null ? null : state.selection()) == sourceTransitionId
                && DungeonEditorTransitionLinkCommitEvidence.matches(
                state == null ? null : state.inspector(),
                targetMapId,
                targetTransitionId);
    }

    private static DungeonEditorPreparedFrameFacts preparedFacts(
            DungeonEditorControlsSnapshot controlsSnapshot,
            DungeonEditorMapSurfaceSnapshot mapSurfaceSnapshot
    ) {
        DungeonEditorControlsSnapshot safeControls = controlsSnapshot == null
                ? DungeonEditorControlsSnapshot.empty("")
                : controlsSnapshot;
        var mapEntries = safeControls.maps().stream()
                .map(DungeonEditorFeatureRuntimeRoot::toMapEntry)
                .toList();
        DungeonMapId selectedMapId = safeControls.selectedMapId();
        var reachableLevels = safeControls.reachableLevels();
        int projectionLevel = clampProjectionLevel(reachableLevels, safeControls.projectionLevel());
        DungeonOverlaySettings overlaySettings = safeControls.overlaySettings() == null
                ? DungeonOverlaySettings.defaults()
                : safeControls.overlaySettings();
        DungeonEditorViewMode viewMode = safeControls.viewMode() == null
                ? DungeonEditorViewMode.GRID
                : safeControls.viewMode();
        DungeonEditorTool selectedTool = safeControls.selectedTool() == null
                ? DungeonEditorTool.SELECT
                : safeControls.selectedTool();
        return new DungeonEditorPreparedFrameFacts(
                mapEntries,
                keyOf(selectedMapId),
                selectedMapId == null ? 0L : selectedMapId.value(),
                reachableLevels,
                false,
                statusTextFor(safeControls, mapEntries),
                viewMode.name(),
                DungeonEditorPreparedFrameFacts.labelForViewMode(viewMode.name()),
                overlaySettings,
                DungeonEditorPreparedFrameFacts.OverlayFrame.from(overlaySettings),
                projectionLevel,
                selectedTool.name(),
                DungeonEditorToolFrameLabels.labelFor(selectedTool),
                DungeonEditorPreparedFrameFacts.MapInteractionFrame.from(mapSurfaceSnapshot));
    }

    private static DungeonEditorPreparedFrameFacts.MapEntry toMapEntry(DungeonMapSummary summary) {
        DungeonMapSummary safeSummary = summary == null
                ? new DungeonMapSummary(new DungeonMapId(1L), "Dungeon Map", 0L)
                : summary;
        return new DungeonEditorPreparedFrameFacts.MapEntry(
                keyOf(safeSummary.mapId()),
                safeSummary.mapId() == null ? 0L : safeSummary.mapId().value(),
                safeSummary.mapName(),
                safeSummary.revision());
    }

    private static String keyOf(DungeonMapId mapId) {
        return mapId == null ? "" : Long.toString(mapId.value());
    }

    private long currentSelectedMapIdValue() {
        return selectedMapIdValue(controlsModel.current());
    }

    private static long selectedMapIdValue(DungeonEditorControlsSnapshot controls) {
        if (controls == null || controls.selectedMapId() == null) {
            return 0L;
        }
        return controls.selectedMapId().value();
    }

    private static long selectedTransitionId(DungeonEditorStateSnapshot.Selection selection) {
        DungeonEditorTopologyElementRef topologyRef = selection == null
                ? DungeonEditorTopologyElementRef.empty()
                : selection.topologyRef();
        return "TRANSITION".equals(topologyRef.kind()) ? topologyRef.id() : 0L;
    }

    private static long selectedStairId(DungeonEditorStateSnapshot.Selection selection) {
        DungeonEditorTopologyElementRef topologyRef = selection == null
                ? DungeonEditorTopologyElementRef.empty()
                : selection.topologyRef();
        return "STAIR".equals(topologyRef.kind()) ? topologyRef.id() : 0L;
    }

    private static LabelNameTarget labelNameTarget(DungeonEditorStateSnapshot.Selection selection) {
        DungeonEditorStateSnapshot.Selection safeSelection = selection == null
                ? DungeonEditorStateSnapshot.Selection.empty()
                : selection;
        if (clusterNameTarget(safeSelection)) {
            return new LabelNameTarget("CLUSTER", safeSelection.clusterId());
        }
        DungeonEditorTopologyElementRef topologyRef = safeSelection.topologyRef();
        return "ROOM".equals(topologyRef.kind())
                ? new LabelNameTarget("ROOM", topologyRef.id())
                : LabelNameTarget.empty();
    }

    private static boolean clusterNameTarget(DungeonEditorStateSnapshot.Selection selection) {
        return clusterLabelSelection(selection) || clusterOnlySelection(selection);
    }

    private static boolean clusterLabelSelection(DungeonEditorStateSnapshot.Selection selection) {
        return selection.handleRef() != null && DungeonEditorHandleKind.CLUSTER_LABEL == selection.handleRef().kind();
    }

    private static boolean clusterOnlySelection(DungeonEditorStateSnapshot.Selection selection) {
        return selection.clusterSelection() && !"ROOM".equals(selection.topologyRef().kind());
    }

    private record LabelNameTarget(String kind, long id) {
        LabelNameTarget {
            kind = kind == null ? "" : kind;
            id = Math.max(0L, id);
        }

        static LabelNameTarget empty() {
            return new LabelNameTarget("", 0L);
        }
    }

    private static int clampProjectionLevel(List<Integer> reachableLevels, int projectionLevel) {
        if (reachableLevels == null || reachableLevels.isEmpty()) {
            return Math.max(0, projectionLevel);
        }
        return Math.max(reachableLevels.getFirst(), Math.min(reachableLevels.getLast(), projectionLevel));
    }

    private static String statusTextFor(
            DungeonEditorControlsSnapshot controls,
            List<DungeonEditorPreparedFrameFacts.MapEntry> mapEntries
    ) {
        if (controls.surfaceLoaded()) {
            return controls.statusText();
        }
        if (mapEntries.isEmpty()) {
            return "Keine Dungeon-Maps vorhanden.";
        }
        if (controls.selectedMapId() == null) {
            return "Kein Dungeon ausgewählt.";
        }
        return controls.statusText();
    }

}
