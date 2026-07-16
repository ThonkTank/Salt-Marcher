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
import features.dungeon.application.editor.session.DungeonEditorSessionWorkflow;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceCoreGeometry;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapSummary;
import features.dungeon.application.editor.helper.DungeonEditorSessionPreviewHelper;
import features.dungeon.application.editor.helper.DungeonEditorSnapshotStateProjectionHelper;

public final class DungeonEditorRuntimeApplicationService {

    private static final String INVALID_STAIR_GEOMETRY_STATUS = "Treppengeometrie ungueltig.";

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

        public DungeonEditorSessionSnapshot.SessionFrameData setViewMode(
                DungeonEditorSessionValues.ViewMode viewMode
        ) {
            workflow.setViewMode(viewMode);
            DungeonEditorSessionSnapshot.SessionFrameData frameData =
                    DungeonEditorSessionSnapshot.sessionFrameData(workflow.session());
            editorPublishedState.publishEditorSessionFrame(frameData);
            return frameData;
        }

        public DungeonEditorSessionSnapshot.ControlsData setToolControlsOnly(
                DungeonEditorSessionValues.Tool tool
        ) {
            workflow.setTool(tool);
            DungeonEditorSessionSnapshot.ControlsData controls =
                    DungeonEditorSessionSnapshot.controlsData(workflow.session());
            editorPublishedState.publishEditorControls(controls);
            return controls;
        }

        public DungeonEditorSessionSnapshot.SnapshotData setTool(
                DungeonEditorSessionValues.Tool tool
        ) {
            workflow.setTool(tool);
            DungeonEditorSessionSnapshot.SnapshotData snapshot =
                    workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
            editorPublishedState.publishEditorSnapshot(snapshot);
            return snapshot;
        }

        public DungeonEditorSessionSnapshot.SessionFrameData shiftProjectionLevel(int projectionLevelDelta) {
            workflow.shiftProjectionLevel(projectionLevelDelta);
            DungeonEditorSessionSnapshot.SessionFrameData frameData =
                    DungeonEditorSessionSnapshot.sessionFrameData(workflow.session());
            editorPublishedState.publishEditorSessionFrame(frameData);
            return frameData;
        }

        public DungeonEditorSessionSnapshot.SessionFrameData setOverlay(
                DungeonEditorSessionValues.OverlaySettings overlaySettings
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
                return null;
            }
            if (workflow.session().selectedMapId() != null) {
                authored.saveAuthoredRoomNarration(workflow.session().selectedMapId(), roomNarration);
            }
            workflow.clearPreviewWithStatus(currentFacts().mutationStatusText());
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
            workflow.clearPreviewWithStatus(currentFacts().mutationStatusText());
            return publishCurrent();
        }

        public DungeonEditorSessionSnapshot.@Nullable SnapshotData saveTransitionDescription(
                DungeonAuthoredApplicationService.TransitionDescriptionInput input
        ) {
            DungeonAuthoredApplicationService.TransitionDescriptionInput safeInput = input == null
                    ? new DungeonAuthoredApplicationService.TransitionDescriptionInput(0L, "")
                    : input;
            if (safeInput.transitionId() <= 0L || !workflow.session().hasSelectedMap()) {
                return null;
            }
            authored.saveAuthoredTransitionDescription(
                    workflow.session().selectedMapId(),
                    safeInput.transitionId(),
                    safeInput.description());
            workflow.clearPreviewWithStatus(currentFacts().mutationStatusText());
            return publishCurrent();
        }

        public DungeonAuthoredApplicationService.OperationResult saveTransitionLink(
                DungeonAuthoredApplicationService.TransitionLinkInput input
        ) {
            if (!workflow.session().hasSelectedMap()) {
                return DungeonAuthoredApplicationService.OperationResult.fromNullable(null);
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
                return DungeonAuthoredApplicationService.OperationResult.fromNullable(null);
            }
            boolean result = authored.saveAuthoredTransitionLink(
                    sourceMapId,
                    safeInput.sourceTransitionId(),
                    safeInput.targetMapId(),
                    safeInput.targetTransitionId(),
                    safeInput.bidirectional());
            if (!result) {
                return DungeonAuthoredApplicationService.OperationResult.fromNullable(null);
            }
            workflow.clearPreviewWithStatus(currentFacts().mutationStatusText());
            publishCurrent();
            return DungeonAuthoredApplicationService.OperationResult.fromNullable(Boolean.TRUE);
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
                workflow.clearPreviewWithStatus(INVALID_STAIR_GEOMETRY_STATUS);
                return publishCurrent();
            }
            authored.saveAuthoredStairGeometry(
                    workflow.session().selectedMapId(),
                    safeInput.stairId(),
                    spec);
            workflow.clearPreviewWithStatus(currentFacts().mutationStatusText());
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
                DungeonEditorWorkspaceValues.Edge edge,
                boolean deleteMode
        ) {
            authoredService.applyDoorBoundary(
                    mapId,
                    clusterId,
                    DungeonEditorWorkspaceCoreGeometry.edges(List.of(edge)),
                    deleteMode,
                    authored);
        }

        public void applyWallBoundary(
                MapId mapId,
                long clusterId,
                List<DungeonEditorWorkspaceValues.Edge> edges,
                boolean deleteMode
        ) {
            authoredService.applyWallBoundary(
                    mapId,
                    clusterId,
                    DungeonEditorWorkspaceCoreGeometry.edges(edges),
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
                        new DungeonEditorWorkspaceValues.Cell(exit.q(), exit.r(), exit.level()),
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
                        && workflow.session().viewMode().isGrid()) {
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
                    return prepareAuthoredPreviewApplied();
                }
                if (onlyStatusChanged(previousSession, workflow.session())) {
                    return PublicationOutcome.STATUS_ONLY_CONTROLS_PUBLISHED;
                }
                if (!DungeonEditorSessionPreviewHelper.inMemoryDragPreview(effect.getPreview())) {
                    return preparePublishCurrent();
                }
                if (previousPreview.equals(workflow.session().preview())) {
                    return PublicationOutcome.UNCHANGED_PREVIEW_NOOP;
                }
                return prepareInMemoryPreviewPublication();
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

            private PublicationOutcome prepareInMemoryPreviewPublication() {
                SnapshotBuilder.InMemoryPreviewRefresh refresh =
                        snapshotBuilder.refreshInMemoryPreview(workflow.session());
                return refresh.directAuthoredDragPreview()
                        ? PublicationOutcome.DIRECT_AUTHORED_DRAG_PREVIEW_PUBLISHED
                        : PublicationOutcome.IN_MEMORY_PREVIEW_PUBLISHED;
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
                workflow.clearPreviewWithStatus(currentFacts().mutationStatusText());
                if (DungeonEditorSessionPreviewHelper.clearsSelectionAfterApply(applyPreview)) {
                    workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
                }
            }

            private static boolean onlyStatusChanged(
                    DungeonEditorSession previousSession,
                    DungeonEditorSession currentSession
            ) {
                return !Objects.equals(previousSession.statusText(), currentSession.statusText())
                        && previousSession.withStatusText(currentSession.statusText()).equals(currentSession);
            }

            private enum PublicationOutcome {
                COMMITTED_GRID_AVAILABLE(PublicationChannel.NONE),
                PUBLISH_CURRENT(PublicationChannel.FULL),
                AUTHORED_PREVIEW_APPLIED(PublicationChannel.FULL),
                DIRECT_AUTHORED_DRAG_PREVIEW_PUBLISHED(PublicationChannel.FULL),
                IN_MEMORY_PREVIEW_PUBLISHED(PublicationChannel.FULL),
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
            refreshAuthoredSurface(resolvedMapId, safeState.selectedMapId(), safeState);
        }

        private void refreshCatalog() {
            authored.searchMaps("");
        }

        private InMemoryPreviewRefresh refreshInMemoryPreview(@Nullable DungeonEditorSession state) {
            DungeonEditorSession safeState = DungeonEditorSnapshotStateProjectionHelper.safeState(state);
            List<MapSummary> maps = dungeonState
                    .currentFacts(null, safeState.selection(), safeState.preview())
                    .maps();
            @Nullable MapId resolvedMapId = resolveSelectedMapId(safeState, maps);
            DungeonEditorDungeonFacts committedFacts = dungeonState.currentFacts(
                    resolvedMapId,
                    safeState.selection(),
                    DungeonEditorSessionValues.Preview.none());
            if (authored.executeAuthoredDragPreview(safeState.selectedMapId(), safeState.preview())) {
                return InMemoryPreviewRefresh.DIRECT_AUTHORED_DRAG_PREVIEW;
            }
            authored.executeInMemoryPreview(committedFacts.surface(), safeState.preview());
            return InMemoryPreviewRefresh.IN_MEMORY_PREVIEW;
        }

        private @Nullable MapSnapshot loadCommittedSnapshot(@Nullable MapId mapId) {
            if (mapId != null) {
                authored.loadMap(mapId);
            }
            return dungeonState.committedFacts(mapId).committedSnapshot();
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
                    safeState.selectedTool(),
                    safeState.projectionLevel(),
                    safeState.overlaySettings(),
                    safeState.selection(),
                    surface,
                    safeState.preview(),
                    nextStatus);
        }

        private void refreshAuthoredSurface(
                @Nullable MapId readbackMapId,
                @Nullable MapId authoredPreviewMapId,
                DungeonEditorSession state
        ) {
            if (readbackMapId == null) {
                return;
            }
            DungeonEditorSessionValues.Selection selection = state.selection();
            if (hasSelectionForInspector(selection)) {
                authored.loadMapWithSelection(
                        readbackMapId,
                        selection.topologyRef(),
                        selection.clusterId(),
                        selection.clusterSelection());
            } else {
                authored.loadMap(readbackMapId);
            }
            authored.executePreview(authoredPreviewMapId, state.preview());
        }

        private static boolean hasSelectionForInspector(DungeonEditorSessionValues.Selection selection) {
            return !selection.topologyRef().equals(DungeonTopologyRef.empty())
                    || selection.clusterSelection();
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

        private enum InMemoryPreviewRefresh {
            DIRECT_AUTHORED_DRAG_PREVIEW(true),
            IN_MEMORY_PREVIEW(false);

            private final boolean directAuthoredDragPreview;

            InMemoryPreviewRefresh(boolean directAuthoredDragPreview) {
                this.directAuthoredDragPreview = directAuthoredDragPreview;
            }

            boolean directAuthoredDragPreview() {
                return directAuthoredDragPreview;
            }
        }
    }
}
