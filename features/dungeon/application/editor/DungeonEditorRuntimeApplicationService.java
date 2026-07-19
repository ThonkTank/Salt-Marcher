package features.dungeon.application.editor;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import features.dungeon.application.authored.DungeonAuthoredApplicationService;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.structure.feature.FeatureMarkerKind;
import features.dungeon.domain.core.structure.stair.StairGeometrySpec;
import features.dungeon.domain.core.structure.stair.StairShape;
import features.dungeon.domain.core.structure.transition.TransitionAnchor;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.application.editor.session.DungeonEditorDungeonFacts;
import features.dungeon.application.editor.session.DungeonEditorDungeonState;
import features.dungeon.application.editor.session.DungeonEditorRoomNarrationInput;
import features.dungeon.application.editor.session.DungeonEditorSession;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.session.DungeonEditorSessionSnapshot;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.application.editor.session.DungeonEditorSessionWorkflow;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.api.editor.DungeonEditorViewportInput;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceGeometry;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary;
import features.dungeon.application.editor.helper.DungeonEditorSessionPreviewHelper;
import features.dungeon.application.editor.helper.DungeonEditorSnapshotStateProjectionHelper;

public final class DungeonEditorRuntimeApplicationService {

    private final DungeonAuthoredApplicationService authoredService;
    private final DungeonEditorPublishedState editorPublishedState;

    public DungeonEditorRuntimeApplicationService(
            DungeonAuthoredApplicationService authoredService,
            DungeonEditorPublishedState editorPublishedState
    ) {
        this.authoredService = Objects.requireNonNull(authoredService, "authoredService");
        this.editorPublishedState = Objects.requireNonNull(editorPublishedState, "editorPublishedState");
    }

    public <T> T openSession(DungeonEditorDungeonState dungeonState, RuntimeSessionFactory<T> factory) {
        RuntimeSessionFactory<T> safeFactory = Objects.requireNonNull(factory, "factory");
        RuntimeSession session = new RuntimeSession(
                authoredService,
                authoredService.openSession(Objects.requireNonNull(dungeonState, "dungeonState")),
                editorPublishedState,
                dungeonState);
        return safeFactory.create(session);
    }

    @FunctionalInterface
    public interface RuntimeSessionFactory<T> {
        T create(RuntimeSession session);
    }

    public static final class RuntimeSession {
        private final DungeonAuthoredApplicationService authoredService;
        private final DungeonAuthoredApplicationService.Session authored;
        private final DungeonEditorPublishedState editorPublishedState;
        private final DungeonEditorDungeonState dungeonState;
        private final DungeonEditorSessionWorkflow workflow = new DungeonEditorSessionWorkflow();
        private final SnapshotBuilder snapshotBuilder;
        private final PreviewLifecycle previewLifecycle;

        private RuntimeSession(
                DungeonAuthoredApplicationService authoredService,
                DungeonAuthoredApplicationService.Session authored,
                DungeonEditorPublishedState editorPublishedState,
                DungeonEditorDungeonState dungeonState
        ) {
            this.authoredService = Objects.requireNonNull(authoredService, "authoredService");
            this.authored = Objects.requireNonNull(authored, "authored");
            this.editorPublishedState = Objects.requireNonNull(editorPublishedState, "editorPublishedState");
            this.dungeonState = Objects.requireNonNull(dungeonState, "dungeonState");
            snapshotBuilder = new SnapshotBuilder(this.authored, this.dungeonState);
            previewLifecycle = new PreviewLifecycle();
        }

        public boolean hasSelectedMap() {
            return workflow.session().hasSelectedMap();
        }

        public @Nullable MapId selectedMapId() {
            return workflow.session().selectedMapId();
        }

        public int projectionLevel() {
            return workflow.session().projectionLevel();
        }

        public DungeonEditorSessionValues.Selection selection() {
            return workflow.session().selection();
        }

        public void applySessionEffect(DungeonEditorSessionEffect effect) {
            workflow.applyEffect(effect);
        }

        public void clearPreviewWithStatus(String statusText) {
            workflow.clearPreviewWithStatus(statusText);
        }

        public void clearPreviewWithCommandOutcome(DungeonEditorCommandOutcome outcome) {
            workflow.clearPreviewWithCommandOutcome(outcome);
        }

        public @Nullable MapSnapshot loadCommittedSnapshot() {
            return snapshotBuilder.loadCommittedSnapshot(workflow.session().selectedMapId());
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData publishCurrent() {
            return publish(previewLifecycle.preparePublishCurrent()).snapshot();
        }

        public CurrentGridPublication committedGridOrPublishCurrentResult() {
            PreviewLifecycle.CurrentGridResult result = previewLifecycle.committedGridOrCurrentFallback();
            return new CurrentGridPublication(result.committedSnapshot(), publish(result.outcome()).snapshot());
        }

        public PublicationResult applyEffect(
                DungeonEditorSessionEffect effect,
                @Nullable AuthoredCommit authoredCommit
        ) {
            return publish(previewLifecycle.applyEffect(effect, authoredCommit));
        }

        public DungeonEditorDungeonFacts currentFacts() {
            return previewLifecycle.currentFacts();
        }

        public DungeonEditorSessionSnapshot.SnapshotData selectMap(long mapId) {
            workflow.selectMap(mapId);
            snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
            DungeonEditorSessionSnapshot.SnapshotData snapshot =
                    workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
            editorPublishedState.publishEditorSnapshot(snapshot);
            return snapshot;
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData setViewport(
                DungeonEditorViewportInput viewport
        ) {
            DungeonEditorViewportInput safeViewport = Objects.requireNonNull(viewport, "viewport");
            if (safeViewport.level() != workflow.session().projectionLevel()) {
                return null;
            }
            snapshotBuilder.setViewport(safeViewport);
            MapId mapId = workflow.session().selectedMapId();
            if (mapId == null || !snapshotBuilder.requestAuthoredSurface(mapId, workflow.session())) {
                return null;
            }
            DungeonEditorSessionSnapshot.SnapshotData snapshot =
                    workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
            editorPublishedState.publishEditorSnapshot(snapshot);
            return snapshot;
        }

        public DungeonEditorSessionSnapshot.SnapshotData createMap(String mapName) {
            authored.createMapCatalog(mapName);
            MapId nextMapId = dungeonState.currentFacts(
                    workflow.session().selectedMapId(),
                    workflow.session().selection(),
                    workflow.session().preview()).mutationMapId();
            workflow.applyMapLifecycle(DungeonEditorSessionWorkflow.MAP_CREATED, nextMapId);
            return refreshAuthoredSnapshot();
        }

        public DungeonEditorSessionSnapshot.SnapshotData renameMap(long mapId, String mapName) {
            if (DungeonEditorWorkspaceValues.hasId(mapId)) {
                authored.renameMapCatalog(new MapId(mapId), mapName);
            }
            MapId nextMapId = dungeonState.currentFacts(
                    workflow.session().selectedMapId(),
                    workflow.session().selection(),
                    workflow.session().preview()).mutationMapId();
            workflow.applyMapLifecycle(DungeonEditorSessionWorkflow.MAP_RENAMED, nextMapId);
            return refreshAuthoredSnapshot();
        }

        public DungeonEditorSessionSnapshot.SnapshotData deleteMap(long mapId) {
            if (DungeonEditorWorkspaceValues.hasId(mapId)) {
                authored.deleteMapCatalog(new MapId(mapId));
            }
            snapshotBuilder.refreshCatalog();
            DungeonEditorSessionSnapshot.SnapshotData refreshedSnapshot =
                    snapshotBuilder.execute(workflow.session());
            workflow.applyMapLifecycle(
                    DungeonEditorSessionWorkflow.MAP_DELETED,
                    firstSnapshotMapId(refreshedSnapshot.maps()));
            return refreshAuthoredSnapshot();
        }

        public DungeonEditorSessionSnapshot.SnapshotData undo() {
            MapId mapId = workflow.session().selectedMapId();
            if (mapId != null) {
                authoredService.undo(mapId, authored);
                workflow.clearPreviewWithCommandOutcome(currentFacts().commandOutcome());
            }
            return refreshAuthoredSnapshot();
        }

        public DungeonEditorSessionSnapshot.SnapshotData redo() {
            MapId mapId = workflow.session().selectedMapId();
            if (mapId != null) {
                authoredService.redo(mapId, authored);
                workflow.clearPreviewWithCommandOutcome(currentFacts().commandOutcome());
            }
            return refreshAuthoredSnapshot();
        }

        public boolean canUndo() {
            return authoredService.canUndo(workflow.session().selectedMapId());
        }

        public boolean canRedo() {
            return authoredService.canRedo(workflow.session().selectedMapId());
        }

        public DungeonEditorSessionSnapshot.SessionFrameData setViewMode(
                DungeonEditorViewMode viewMode
        ) {
            workflow.setViewMode(viewMode);
            DungeonEditorSessionSnapshot.SessionFrameData frameData =
                    DungeonEditorSessionSnapshot.sessionFrameData(workflow.session());
            editorPublishedState.publishEditorSessionFrame(frameData);
            return frameData;
        }

        public DungeonEditorSessionSnapshot.ControlsData setToolControlsOnly(
                DungeonEditorToolSelection selection
        ) {
            workflow.setTool(selection);
            DungeonEditorSessionSnapshot.ControlsData controls =
                    DungeonEditorSessionSnapshot.controlsData(workflow.session());
            editorPublishedState.publishEditorControls(controls);
            return controls;
        }

        public DungeonEditorSessionSnapshot.SnapshotData setTool(
                DungeonEditorToolSelection selection
        ) {
            workflow.setTool(selection);
            DungeonEditorSessionSnapshot.SnapshotData snapshot =
                    workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
            editorPublishedState.publishEditorSnapshot(snapshot);
            return snapshot;
        }

        public DungeonEditorSessionSnapshot.SnapshotData shiftProjectionLevel(int projectionLevelDelta) {
            workflow.shiftProjectionLevel(projectionLevelDelta);
            return refreshAuthoredSnapshot();
        }

        public DungeonEditorSessionSnapshot.SessionFrameData setOverlay(
                DungeonOverlaySettings overlaySettings
        ) {
            workflow.setOverlay(overlaySettings);
            DungeonEditorSessionSnapshot.SessionFrameData frameData =
                    DungeonEditorSessionSnapshot.sessionFrameData(workflow.session());
            editorPublishedState.publishEditorSessionFramePreservingSurface(frameData);
            return frameData;
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData saveRoomNarration(
                DungeonAuthoredApplicationService.RoomNarrationInput input
        ) {
            DungeonAuthoredApplicationService.RoomNarrationInput safeInput =
                    input == null ? new DungeonAuthoredApplicationService.RoomNarrationInput(0L, "", List.of()) : input;
            DungeonEditorRoomNarrationInput roomNarration = roomNarration(safeInput);
            if (roomNarration == null || !DungeonEditorWorkspaceValues.hasId(roomNarration.roomId())) {
                return rejectInvalidTarget();
            }
            if (workflow.session().selectedMapId() != null) {
                authored.saveAuthoredRoomNarration(workflow.session().selectedMapId(), roomNarration);
            }
            workflow.clearPreviewWithCommandOutcome(currentFacts().commandOutcome());
            return publishCurrent();
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData saveLabelName(
                DungeonAuthoredApplicationService.LabelNameInput input
        ) {
            DungeonAuthoredApplicationService.LabelNameInput safeInput = input == null
                    ? new DungeonAuthoredApplicationService.LabelNameInput(
                            DungeonAuthoredApplicationService.LabelTargetKind.EMPTY,
                            0L,
                            "")
                    : input;
            if (workflow.session().selectedMapId() != null) {
                authored.saveAuthoredLabelName(
                        workflow.session().selectedMapId(),
                        safeInput.targetType(),
                        safeInput.targetId(),
                        safeInput.name());
            }
            workflow.clearPreviewWithCommandOutcome(currentFacts().commandOutcome());
            return publishCurrent();
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData saveTransitionDescription(
                DungeonAuthoredApplicationService.TransitionDescriptionInput input
        ) {
            DungeonAuthoredApplicationService.TransitionDescriptionInput safeInput = input == null
                    ? new DungeonAuthoredApplicationService.TransitionDescriptionInput(0L, "")
                    : input;
            if (safeInput.transitionId() <= 0L || !workflow.session().hasSelectedMap()) {
                return rejectInvalidTarget();
            }
            authored.saveAuthoredTransitionDescription(
                    workflow.session().selectedMapId(),
                    safeInput.transitionId(),
                    safeInput.description());
            workflow.clearPreviewWithCommandOutcome(currentFacts().commandOutcome());
            return publishCurrent();
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData saveFeatureMarkerSemantics(
                DungeonAuthoredApplicationService.FeatureMarkerSemanticsInput input
        ) {
            DungeonAuthoredApplicationService.FeatureMarkerSemanticsInput safeInput = input == null
                    ? new DungeonAuthoredApplicationService.FeatureMarkerSemanticsInput(0L, "", "")
                    : input;
            if (safeInput.markerId() <= 0L
                    || safeInput.label().isBlank()
                    || !workflow.session().hasSelectedMap()) {
                return rejectInvalidTarget();
            }
            authored.saveAuthoredFeatureMarkerSemantics(
                    workflow.session().selectedMapId(),
                    safeInput.markerId(),
                    safeInput.label(),
                    safeInput.description());
            workflow.clearPreviewWithCommandOutcome(currentFacts().commandOutcome());
            return publishCurrent();
        }

        public DungeonAuthoredApplicationService.OperationResult saveTransitionLink(
                DungeonAuthoredApplicationService.TransitionLinkInput input
        ) {
            if (!workflow.session().hasSelectedMap()) {
                return rejectTransitionLink();
            }
            return saveTransitionLink(workflow.session().selectedMapId(), input);
        }

        public DungeonAuthoredApplicationService.OperationResult saveTransitionLink(
                MapId sourceMapId,
                DungeonAuthoredApplicationService.TransitionLinkInput input
        ) {
            DungeonAuthoredApplicationService.TransitionLinkInput safeInput = input == null
                    ? new DungeonAuthoredApplicationService.TransitionLinkInput(0L, 0L, 0L, false)
                    : input;
            if (sourceMapId == null) {
                return rejectTransitionLink();
            }
            boolean result = authored.saveAuthoredTransitionLink(
                    sourceMapId,
                    safeInput.sourceTransitionId(),
                    safeInput.targetMapId(),
                    safeInput.targetTransitionId(),
                    safeInput.bidirectional());
            if (!result) {
                return rejectTransitionLink();
            }
            workflow.clearPreviewWithCommandOutcome(currentFacts().commandOutcome());
            publishCurrent();
            return DungeonAuthoredApplicationService.OperationResult.fromNullable(Boolean.TRUE);
        }

        private DungeonAuthoredApplicationService.OperationResult rejectTransitionLink() {
            workflow.clearPreviewWithCommandOutcome(DungeonEditorCommandOutcome.rejected(
                    DungeonEditorCommandOutcome.RejectionReason.MISSING_TRANSITION_DESTINATION));
            publishCurrent();
            return DungeonAuthoredApplicationService.OperationResult.fromNullable(null);
        }

        private DungeonEditorSessionSnapshot.@Nullable SnapshotData rejectInvalidTarget() {
            workflow.clearPreviewWithCommandOutcome(DungeonEditorCommandOutcome.rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET));
            return publishCurrent();
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData saveStairGeometry(
                DungeonAuthoredApplicationService.StairGeometryInput input
        ) {
            DungeonAuthoredApplicationService.StairGeometryInput safeInput = input == null
                    ? new DungeonAuthoredApplicationService.StairGeometryInput(0L, "", "", 0, 0)
                    : input;
            StairShape shape = StairShape.supportedEditorShape(safeInput.shapeName());
            Direction direction = Direction.supportedCardinal(safeInput.directionName());
            StairGeometrySpec spec = authored.stairGeometrySpec(
                    workflow.session().selectedMapId(),
                    safeInput.stairId(),
                    shape,
                    direction,
                    safeInput.dimension1(),
                    safeInput.dimension2());
            if (!workflow.session().hasSelectedMap()
                    || safeInput.stairId() <= 0L
                    || shape == null
                    || direction == null
                    || !shape.supportsEditorDimensions(safeInput.dimension1(), safeInput.dimension2())
                    || !authored.canSaveStairGeometry(
                            workflow.session().selectedMapId(),
                            safeInput.stairId(),
                            spec)) {
                workflow.clearPreviewWithCommandOutcome(DungeonEditorCommandOutcome.rejected(
                        DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY));
                return publishCurrent();
            }
            authored.saveAuthoredStairGeometry(
                    workflow.session().selectedMapId(),
                    safeInput.stairId(),
                    spec);
            workflow.clearPreviewWithCommandOutcome(currentFacts().commandOutcome());
            return publishCurrent();
        }

        public void applyRoomRectangle(
                MapId mapId,
                Cell start,
                Cell end,
                boolean deleteMode
        ) {
            authoredService.applyRoomRectangle(mapId, start, end, deleteMode, authored);
        }

        public boolean canCreateStair(MapId mapId, StairGeometrySpec spec) {
            return authoredService.canCreateStair(mapId, spec, authored);
        }

        public void createStair(MapId mapId, StairGeometrySpec spec) {
            authoredService.createStair(mapId, spec, authored);
        }

        public boolean deleteStair(MapId mapId, long stairId) {
            return authoredService.deleteStair(mapId, stairId, authored);
        }

        public boolean canCreateTransition(
                MapId mapId,
                TransitionAnchor anchor,
                @Nullable TransitionDestination destination
        ) {
            return authoredService.canCreateTransition(mapId, anchor, destination, authored);
        }

        public void createTransition(
                MapId mapId,
                TransitionAnchor anchor,
                @Nullable TransitionDestination destination
        ) {
            authoredService.createTransition(mapId, anchor, destination, authored);
        }

        public boolean deleteTransition(MapId mapId, long transitionId) {
            return authoredService.deleteTransition(mapId, transitionId, authored);
        }

        public boolean canCreateFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor) {
            return authoredService.canCreateFeatureMarker(mapId, kind, anchor, authored);
        }

        public long createFeatureMarker(MapId mapId, FeatureMarkerKind kind, Cell anchor) {
            return authoredService.createFeatureMarker(mapId, kind, anchor, authored);
        }

        public boolean deleteFeatureMarker(MapId mapId, long markerId) {
            return authoredService.deleteFeatureMarker(mapId, markerId, authored);
        }

        public void createCorridor(MapId mapId, DungeonEditorSessionValues.CorridorCreatePreview preview) {
            authoredService.createCorridor(mapId, preview.start(), preview.end(), authored);
        }

        public void deleteCorridor(MapId mapId, DungeonEditorSessionValues.DeleteCorridorPreview preview) {
            authoredService.deleteCorridor(mapId, preview.target(), authored);
        }

        public void applyDoorBoundary(
                MapId mapId,
                long clusterId,
                features.dungeon.domain.core.geometry.Edge edge,
                boolean deleteMode
        ) {
            authoredService.applyDoorBoundary(
                    mapId,
                    clusterId,
                    DungeonEditorWorkspaceGeometry.unitEdges(List.of(edge)),
                    deleteMode,
                    authored);
        }

        public void applyWallBoundary(
                MapId mapId,
                long clusterId,
                List<features.dungeon.domain.core.geometry.Edge> edges,
                boolean deleteMode
        ) {
            authoredService.applyWallBoundary(
                    mapId,
                    clusterId,
                    DungeonEditorWorkspaceGeometry.unitEdges(edges),
                    deleteMode,
                    authored);
        }

        public void moveClusterHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview) {
            authoredService.moveClusterHandle(mapId, preview, authored);
        }

        public void moveDoorHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview) {
            authoredService.moveDoorHandle(mapId, preview, authored);
        }

        public void moveCorridorHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview) {
            authoredService.moveCorridorHandle(mapId, preview, authored);
        }

        public void moveStairHandle(MapId mapId, DungeonEditorSessionValues.MoveHandlePreview preview) {
            authoredService.moveStairHandle(mapId, preview, authored);
        }

        public void stretchClusterBoundary(
                MapId mapId,
                DungeonEditorSessionValues.MoveBoundaryStretchPreview preview
        ) {
            authoredService.stretchClusterBoundary(mapId, preview, authored);
        }

        private PublicationResult publish(PreviewLifecycle.PublicationOutcome outcome) {
            if (!outcome.publishesSnapshot()) {
                return PublicationResult.none();
            }
            if (outcome.controlsOnly()) {
                DungeonEditorSessionSnapshot.ControlsData controls =
                        DungeonEditorSessionSnapshot.controlsData(workflow.session());
                editorPublishedState.publishEditorControls(controls);
                return PublicationResult.controls(controls);
            }
            DungeonEditorSessionSnapshot.SnapshotData snapshot =
                    workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
            editorPublishedState.publishEditorSnapshot(snapshot);
            return PublicationResult.full(snapshot);
        }

        private DungeonEditorSessionSnapshot.SnapshotData refreshAuthoredSnapshot() {
            snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
            DungeonEditorSessionSnapshot.SnapshotData snapshot =
                    workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
            editorPublishedState.publishEditorSnapshot(snapshot);
            return snapshot;
        }

        private static @Nullable MapId firstSnapshotMapId(List<MapSummary> maps) {
            if (maps == null || maps.isEmpty()) {
                return null;
            }
            return maps.stream()
                    .min(RuntimeSession::compareSnapshotMapSummary)
                    .orElseThrow()
                    .mapId();
        }

        private static int compareSnapshotMapSummary(MapSummary left, MapSummary right) {
            int nameComparison = Comparator.nullsFirst(String.CASE_INSENSITIVE_ORDER)
                    .compare(left.mapName(), right.mapName());
            if (nameComparison != 0) {
                return nameComparison;
            }
            return Long.compare(left.mapId().value(), right.mapId().value());
        }

        private static DungeonEditorRoomNarrationInput roomNarration(
                DungeonAuthoredApplicationService.RoomNarrationInput input
        ) {
            List<DungeonEditorWorkspaceValues.RoomExitNarration> exits = new ArrayList<>();
            for (DungeonAuthoredApplicationService.RoomNarrationExitInput exit : input.exits()) {
                exits.add(new DungeonEditorWorkspaceValues.RoomExitNarration(
                        exit.label(),
                        new features.dungeon.domain.core.geometry.Cell(exit.q(), exit.r(), exit.level()),
                        exit.direction(),
                        exit.description()));
            }
            return new DungeonEditorRoomNarrationInput(input.roomId(), input.visualDescription(), exits);
        }

        private final class PreviewLifecycle {
            PublicationOutcome preparePublishCurrent() {
                snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
                return PublicationOutcome.PUBLISH_CURRENT;
            }

            CurrentGridResult committedGridOrCurrentFallback() {
                MapSnapshot committedSnapshot =
                        snapshotBuilder.loadCommittedSnapshot(workflow.session().selectedMapId());
                if (workflow.session().hasSelectedMap()
                        && committedSnapshot != null
                        && workflow.session().viewMode() == DungeonEditorViewMode.GRID) {
                    return new CurrentGridResult(committedSnapshot, PublicationOutcome.COMMITTED_GRID_AVAILABLE);
                }
                return new CurrentGridResult(null, prepareCurrentReadback());
            }

            PublicationOutcome applyEffect(
                    DungeonEditorSessionEffect effect,
                    @Nullable AuthoredCommit authoredCommit
            ) {
                if (effect == null || effect.isNoop()) {
                    return PublicationOutcome.UNCHANGED_PREVIEW_NOOP;
                }
                DungeonEditorSession previousSession = workflow.session();
                DungeonEditorSessionValues.Preview previousPreview = previousSession.preview();
                DungeonEditorSessionValues.Preview applyPreview = workflow.applyEffect(effect);
                if (applyPreview != null) {
                    applyAuthoredPreview(applyPreview, authoredCommit);
                    if (workflow.session().commandOutcome() instanceof DungeonEditorCommandOutcome.Rejected) {
                        return PublicationOutcome.REJECTED_PREVIEW_CLEARED;
                    }
                    return prepareAuthoredPreviewApplied();
                }
                if (effect.getSelection() != null || effect.isClearSelection()) {
                    return prepareSelectionPublication();
                }
                if (onlyStatusChanged(previousSession, workflow.session())) {
                    return PublicationOutcome.STATUS_ONLY_CONTROLS_PUBLISHED;
                }
                DungeonEditorSessionValues.Preview currentPreview = workflow.session().preview();
                if (workflow.session().commandOutcome() instanceof DungeonEditorCommandOutcome.Rejected
                        && !(previousPreview instanceof DungeonEditorSessionValues.NoPreview)
                        && currentPreview instanceof DungeonEditorSessionValues.NoPreview) {
                    return PublicationOutcome.REJECTED_PREVIEW_CLEARED;
                }
                if (!(currentPreview instanceof DungeonEditorSessionValues.NoPreview)) {
                    if (previousPreview.equals(currentPreview)) {
                        return PublicationOutcome.UNCHANGED_PREVIEW_NOOP;
                    }
                    return prepareInMemoryPreviewPublication();
                }
                if (!(previousPreview instanceof DungeonEditorSessionValues.NoPreview)) {
                    return PublicationOutcome.TRANSIENT_PREVIEW_CLEARED;
                }
                return preparePublishCurrent();
            }

            DungeonEditorDungeonFacts currentFacts() {
                return dungeonState.currentFacts(
                        workflow.session().selectedMapId(),
                        workflow.session().selection(),
                        workflow.session().preview());
            }

            private PublicationOutcome prepareCurrentReadback() {
                snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
                return PublicationOutcome.CURRENT_READBACK_PUBLISHED;
            }

            private PublicationOutcome prepareAuthoredPreviewApplied() {
                snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
                return PublicationOutcome.AUTHORED_PREVIEW_APPLIED;
            }

            private PublicationOutcome prepareSelectionPublication() {
                snapshotBuilder.refreshSelectionInspector(workflow.session());
                return PublicationOutcome.SELECTION_INSPECTOR_PUBLISHED;
            }

            private PublicationOutcome prepareInMemoryPreviewPublication() {
                snapshotBuilder.refreshInMemoryPreview(workflow.session());
                return PublicationOutcome.IN_MEMORY_PREVIEW_PUBLISHED;
            }

            private void applyAuthoredPreview(
                    DungeonEditorSessionValues.Preview applyPreview,
                    @Nullable AuthoredCommit authoredCommit
            ) {
                MapId mapId = workflow.session().selectedMapId();
                if (mapId != null && authoredCommit == null) {
                    authoredService.applyPreview(mapId, applyPreview, authored);
                }
                if (mapId != null && authoredCommit != null) {
                    authoredCommit.apply(mapId);
                }
                workflow.clearPreviewWithCommandOutcome(currentFacts().commandOutcome());
                if (DungeonEditorSessionPreviewHelper.clearsSelectionAfterApply(applyPreview)) {
                    workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
                }
            }

            private static boolean onlyStatusChanged(
                    DungeonEditorSession previousSession,
                    DungeonEditorSession currentSession
            ) {
                boolean commandStatusChanged =
                        !Objects.equals(previousSession.statusText(), currentSession.statusText())
                                || !Objects.equals(previousSession.commandOutcome(), currentSession.commandOutcome());
                return commandStatusChanged
                        && previousSession.withCommandStatus(
                                currentSession.statusText(),
                                currentSession.commandOutcome()).equals(currentSession);
            }

            private enum PublicationOutcome {
                COMMITTED_GRID_AVAILABLE(PublicationChannel.NONE),
                PUBLISH_CURRENT(PublicationChannel.FULL),
                AUTHORED_PREVIEW_APPLIED(PublicationChannel.FULL),
                SELECTION_INSPECTOR_PUBLISHED(PublicationChannel.FULL),
                DIRECT_AUTHORED_DRAG_PREVIEW_PUBLISHED(PublicationChannel.FULL),
                IN_MEMORY_PREVIEW_PUBLISHED(PublicationChannel.FULL),
                TRANSIENT_PREVIEW_CLEARED(PublicationChannel.FULL),
                REJECTED_PREVIEW_CLEARED(PublicationChannel.FULL),
                STATUS_ONLY_CONTROLS_PUBLISHED(PublicationChannel.CONTROLS),
                UNCHANGED_PREVIEW_NOOP(PublicationChannel.NONE),
                CURRENT_READBACK_PUBLISHED(PublicationChannel.FULL);

                private final PublicationChannel publicationChannel;

                PublicationOutcome(PublicationChannel publicationChannel) {
                    this.publicationChannel = publicationChannel;
                }

                boolean publishesSnapshot() {
                    return publicationChannel != PublicationChannel.NONE;
                }

                boolean controlsOnly() {
                    return publicationChannel == PublicationChannel.CONTROLS;
                }
            }

            private enum PublicationChannel {
                NONE,
                CONTROLS,
                FULL
            }

            private record CurrentGridResult(
                    MapSnapshot committedSnapshot,
                    PublicationOutcome outcome
            ) {
            }
        }
    }

    @FunctionalInterface
    public interface AuthoredCommit {
        void apply(MapId mapId);
    }

    public record CurrentGridPublication(
            @Nullable MapSnapshot committedSnapshot,
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
    ) {
    }

    public enum PublicationKind {
        NONE,
        FULL_SNAPSHOT,
        CONTROLS
    }

    public record PublicationResult(
            PublicationKind kind,
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot,
            DungeonEditorSessionSnapshot.@Nullable ControlsData controls
    ) {
        public PublicationResult {
            kind = Objects.requireNonNull(kind, "kind");
            switch (kind) {
                case NONE -> {
                    if (snapshot != null || controls != null) {
                        throw new IllegalArgumentException("NONE publication cannot carry snapshot or controls");
                    }
                }
                case FULL_SNAPSHOT -> {
                    if (snapshot == null || controls != null) {
                        throw new IllegalArgumentException("FULL_SNAPSHOT publication requires snapshot only");
                    }
                }
                case CONTROLS -> {
                    if (snapshot != null || controls == null) {
                        throw new IllegalArgumentException("CONTROLS publication requires controls only");
                    }
                }
            }
        }

        public static PublicationResult none() {
            return new PublicationResult(PublicationKind.NONE, null, null);
        }

        public static PublicationResult full(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
            return new PublicationResult(PublicationKind.FULL_SNAPSHOT, snapshot, null);
        }

        public static PublicationResult controls(DungeonEditorSessionSnapshot.ControlsData controls) {
            return new PublicationResult(PublicationKind.CONTROLS, null, controls);
        }
    }

    private static final class SnapshotBuilder {
        private final DungeonAuthoredApplicationService.Session authored;
        private final DungeonEditorDungeonState dungeonState;
        private DungeonEditorViewportInput latestViewport;

        private SnapshotBuilder(
                DungeonAuthoredApplicationService.Session authored,
                DungeonEditorDungeonState dungeonState
        ) {
            this.authored = Objects.requireNonNull(authored, "authored");
            this.dungeonState = Objects.requireNonNull(dungeonState, "dungeonState");
        }

        private DungeonEditorSessionSnapshot.SnapshotData execute(@Nullable DungeonEditorSession state) {
            DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
            List<MapSummary> maps = dungeonState
                    .currentFacts(null, safeState.selection(), safeState.preview())
                    .maps();
            @Nullable MapId resolvedMapId = resolveSelectedMapId(safeState, maps);
            return snapshotData(safeState, maps, resolvedMapId);
        }

        private void refreshAuthoredSnapshot(@Nullable DungeonEditorSession state) {
            DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
            refreshCatalog();
            List<MapSummary> maps = dungeonState
                    .currentFacts(null, safeState.selection(), safeState.preview())
                    .maps();
            @Nullable MapId resolvedMapId = resolveSelectedMapId(safeState, maps);
            refreshAuthoredSurface(resolvedMapId, safeState);
        }

        private void setViewport(DungeonEditorViewportInput viewport) {
            latestViewport = Objects.requireNonNull(viewport, "viewport");
        }

        private void refreshSelectionInspector(@Nullable DungeonEditorSession state) {
            DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
            MapId mapId = safeState.selectedMapId();
            if (mapId == null || !hasSelectionForInspector(safeState.selection())) {
                return;
            }
            loadSelectionInspector(mapId, safeState.selection());
        }

        private void refreshCatalog() {
            authored.searchMaps("");
        }

        private void refreshInMemoryPreview(@Nullable DungeonEditorSession state) {
            DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
            List<MapSummary> maps = dungeonState
                    .currentFacts(null, safeState.selection(), safeState.preview())
                    .maps();
            @Nullable MapId resolvedMapId = resolveSelectedMapId(safeState, maps);
            DungeonEditorDungeonFacts committedFacts = dungeonState.currentFacts(
                    resolvedMapId,
                    safeState.selection(),
                    DungeonEditorSessionValues.Preview.none());
            authored.executeInMemoryPreview(committedFacts.surface(), safeState.preview());
        }

        private @Nullable MapSnapshot loadCommittedSnapshot(@Nullable MapId mapId) {
            @Nullable MapSnapshot committed = dungeonState.committedFacts(mapId).committedSnapshot();
            return committed;
        }

        private DungeonEditorSessionSnapshot.SnapshotData snapshotData(
                DungeonEditorSession safeState,
                List<MapSummary> maps,
                @Nullable MapId resolvedMapId
        ) {
            DungeonEditorDungeonFacts surfaceFacts = dungeonState.currentFacts(
                    resolvedMapId,
                    safeState.selection(),
                    safeState.preview());
            DungeonEditorSessionSnapshot.SurfaceData surface = surfaceFacts.surface();
            String nextStatus = safeState.statusText().isBlank()
                    ? surfaceFacts.previewStatusText()
                    : safeState.statusText();
            return new DungeonEditorSessionSnapshot.SnapshotData(
                    maps,
                    resolvedMapId,
                    safeState.viewMode(),
                    safeState.toolSelection(),
                    safeState.projectionLevel(),
                    safeState.overlaySettings(),
                    safeState.selection(),
                    surface,
                    safeState.preview(),
                    nextStatus,
                    safeState.commandOutcome());
        }

        private boolean refreshAuthoredSurface(
                @Nullable MapId readbackMapId,
                DungeonEditorSession state
        ) {
            if (readbackMapId == null || latestViewport == null) {
                return false;
            }
            DungeonEditorViewportInput viewport = latestViewport.atLevel(state.projectionLevel());
            latestViewport = viewport;
            boolean accepted = authored.refreshViewport(
                    readbackMapId,
                    viewport.level(),
                    viewport.minimumQ(),
                    viewport.minimumR(),
                    viewport.maximumQ(),
                    viewport.maximumR());
            if (!accepted) {
                return false;
            }
            DungeonEditorSessionValues.Selection selection = state.selection();
            if (hasSelectionForInspector(selection)) {
                loadSelectionInspector(readbackMapId, selection);
            }
            return true;
        }

        private boolean requestAuthoredSurface(
                @Nullable MapId mapId,
                DungeonEditorSession state
        ) {
            if (mapId == null || latestViewport == null) {
                return false;
            }
            DungeonEditorViewportInput viewport = latestViewport.atLevel(state.projectionLevel());
            latestViewport = viewport;
            boolean accepted = authored.loadViewport(
                    mapId,
                    viewport.level(),
                    viewport.minimumQ(),
                    viewport.minimumR(),
                    viewport.maximumQ(),
                    viewport.maximumR());
            if (accepted && hasSelectionForInspector(state.selection())) {
                loadSelectionInspector(mapId, state.selection());
            }
            return accepted;
        }

        private static boolean hasSelectionForInspector(DungeonEditorSessionValues.Selection selection) {
            return !selection.topologyRef().equals(DungeonTopologyRef.empty())
                    || selection.clusterSelection()
                    || !selection.handleRef().equals(DungeonEditorSessionValues.emptyHandleRef());
        }

        private void loadSelectionInspector(
                MapId mapId,
                DungeonEditorSessionValues.Selection selection
        ) {
            DungeonEditorWorkspaceValues.HandleRef handleRef = selection.handleRef();
            DungeonTopologyRef inspectorRef = selection.topologyRef().equals(DungeonTopologyRef.empty())
                    ? handleRef.topologyRef()
                    : selection.topologyRef();
            long inspectorClusterId = selection.clusterId() > 0L
                    ? selection.clusterId()
                    : handleRef.clusterId();
            authored.loadInspectorWithSelection(
                    mapId,
                    inspectorRef,
                    inspectorClusterId,
                    selection.clusterSelection(),
                    handleRef);
        }

        private static @Nullable MapId resolveSelectedMapId(DungeonEditorSession state, List<MapSummary> maps) {
            @Nullable MapId requestedMapId = state.selectedMapId();
            if (requestedMapId == null && state.statusText().isBlank()) {
                return null;
            }
            if (requestedMapId == null) {
                return maps.isEmpty() ? null : maps.getFirst().mapId();
            }
            for (MapSummary summary : maps) {
                if (requestedMapId.equals(summary.mapId())) {
                    return requestedMapId;
                }
            }
            return maps.isEmpty() ? null : maps.getFirst().mapId();
        }

    }
}
